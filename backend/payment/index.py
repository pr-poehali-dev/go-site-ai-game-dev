"""
Платёжный шлюз: ЮKassa, Robokassa, Stripe.
Создание платежей, обработка вебхуков, активация подписки.
action: create | webhook_yukassa | webhook_robokassa | stripe_session | config
"""
import json
import os
import hashlib
import hmac
import base64
import urllib.request
import urllib.parse
import psycopg2
from datetime import datetime, timedelta

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p81816167_go_site_ai_game_dev')
CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
}

PLANS = {
    'starter': {'amount': 990,  'label': 'STARTER — 1 месяц'},
    'pro':     {'amount': 2990, 'label': 'PRO — 1 месяц'},
    'studio':  {'amount': 7990, 'label': 'STUDIO — 1 месяц'},
}

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def get_token(event):
    h = event.get('headers') or {}
    return h.get('X-Auth-Token') or h.get('x-auth-token') or ''

def get_user(cur, token):
    if not token:
        return None
    cur.execute(
        f"""SELECT u.id, u.username, u.email
            FROM {SCHEMA}.sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token = %s AND s.expires_at > NOW() AND u.is_active = TRUE""",
        (token,)
    )
    return cur.fetchone()

def activate_subscription(user_id: int, plan: str, amount: int):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        f"""INSERT INTO {SCHEMA}.subscriptions (user_id, plan, status, amount, expires_at)
            VALUES (%s, %s, 'active', %s, NOW() + INTERVAL '30 days')""",
        (user_id, plan, amount)
    )
    cur.execute(
        f"""INSERT INTO {SCHEMA}.wallet_transactions (user_id, amount, type, description)
            VALUES (%s, %s, 'payment', %s)""",
        (user_id, amount, f'Оплата подписки {plan.upper()} через платёжный шлюз')
    )
    conn.commit()
    conn.close()

def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    body_raw = event.get('body') or '{}'
    body = json.loads(body_raw) if body_raw else {}
    token = get_token(event)
    action = body.get('action', '')
    app_url = os.environ.get('APP_URL', 'https://nexus-game-ai.poehali.dev')

    # ─── КОНФИГ (публичные ключи для фронтенда) ───────────────────────────────
    if action == 'config':
        return {
            'statusCode': 200, 'headers': CORS,
            'body': json.dumps({
                'stripe_publishable_key': os.environ.get('STRIPE_PUBLISHABLE_KEY', ''),
                'yukassa_enabled': bool(os.environ.get('YUKASSA_SHOP_ID')),
                'robokassa_enabled': bool(os.environ.get('ROBOKASSA_LOGIN')),
                'stripe_enabled': bool(os.environ.get('STRIPE_SECRET_KEY')),
            })
        }

    # ─── СОЗДАТЬ ПЛАТЁЖ ────────────────────────────────────────────────────────
    if action == 'create' and method == 'POST':
        conn = get_conn()
        cur = conn.cursor()
        user = get_user(cur, token)
        conn.close()
        if not user:
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

        user_id, username, email = user
        plan = body.get('plan', 'starter')
        gateway = body.get('gateway', 'yukassa')  # yukassa | robokassa | stripe

        if plan not in PLANS:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Неверный план'})}

        amount = PLANS[plan]['amount']
        label = PLANS[plan]['label']
        order_id = f"{user_id}_{plan}_{int(datetime.now().timestamp())}"

        # ── ЮKassa ──────────────────────────────────────────────────────────────
        if gateway == 'yukassa':
            shop_id = os.environ.get('YUKASSA_SHOP_ID', '')
            secret_key = os.environ.get('YUKASSA_SECRET_KEY', '')
            if not shop_id or not secret_key:
                return {'statusCode': 503, 'headers': CORS, 'body': json.dumps({'error': 'ЮKassa не настроена'})}

            import uuid
            idempotence = str(uuid.uuid4())
            payload = json.dumps({
                'amount': {'value': str(amount) + '.00', 'currency': 'RUB'},
                'confirmation': {
                    'type': 'redirect',
                    'return_url': f"{app_url}/?payment=success&plan={plan}&order={order_id}"
                },
                'capture': True,
                'description': label,
                'metadata': {'user_id': user_id, 'plan': plan, 'order_id': order_id},
            }).encode()

            creds = base64.b64encode(f"{shop_id}:{secret_key}".encode()).decode()
            req = urllib.request.Request(
                'https://api.yookassa.ru/v3/payments',
                data=payload,
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Basic {creds}',
                    'Idempotence-Key': idempotence,
                }
            )
            with urllib.request.urlopen(req) as resp:
                result = json.loads(resp.read())

            return {
                'statusCode': 200, 'headers': CORS,
                'body': json.dumps({
                    'payment_url': result['confirmation']['confirmation_url'],
                    'payment_id': result['id'],
                    'gateway': 'yukassa'
                })
            }

        # ── Robokassa ───────────────────────────────────────────────────────────
        if gateway == 'robokassa':
            login = os.environ.get('ROBOKASSA_LOGIN', '')
            password1 = os.environ.get('ROBOKASSA_PASSWORD1', '')
            if not login or not password1:
                return {'statusCode': 503, 'headers': CORS, 'body': json.dumps({'error': 'Robokassa не настроена'})}

            inv_id = int(datetime.now().timestamp()) % 2147483647
            signature_str = f"{login}:{amount}.00:{inv_id}:{password1}"
            signature = hashlib.md5(signature_str.encode()).hexdigest()

            params = {
                'MrchLogin': login,
                'OutSum': f"{amount}.00",
                'InvId': str(inv_id),
                'Description': label,
                'SignatureValue': signature,
                'shp_user_id': str(user_id),
                'shp_plan': plan,
                'Encoding': 'utf-8',
            }
            payment_url = 'https://auth.robokassa.ru/Merchant/Index.aspx?' + urllib.parse.urlencode(params)

            return {
                'statusCode': 200, 'headers': CORS,
                'body': json.dumps({
                    'payment_url': payment_url,
                    'inv_id': inv_id,
                    'gateway': 'robokassa'
                })
            }

        # ── Stripe ──────────────────────────────────────────────────────────────
        if gateway == 'stripe':
            stripe_key = os.environ.get('STRIPE_SECRET_KEY', '')
            if not stripe_key:
                return {'statusCode': 503, 'headers': CORS, 'body': json.dumps({'error': 'Stripe не настроен'})}

            payload = urllib.parse.urlencode({
                'payment_method_types[]': 'card',
                'line_items[0][price_data][currency]': 'rub',
                'line_items[0][price_data][unit_amount]': str(amount * 100),
                'line_items[0][price_data][product_data][name]': label,
                'line_items[0][quantity]': '1',
                'mode': 'payment',
                'success_url': f"{app_url}/?payment=success&plan={plan}&order={order_id}",
                'cancel_url': f"{app_url}/?payment=cancel",
                'metadata[user_id]': str(user_id),
                'metadata[plan]': plan,
            }).encode()

            creds = base64.b64encode(f"{stripe_key}:".encode()).decode()
            req = urllib.request.Request(
                'https://api.stripe.com/v1/checkout/sessions',
                data=payload,
                headers={
                    'Authorization': f'Basic {creds}',
                    'Content-Type': 'application/x-www-form-urlencoded',
                }
            )
            with urllib.request.urlopen(req) as resp:
                result = json.loads(resp.read())

            return {
                'statusCode': 200, 'headers': CORS,
                'body': json.dumps({
                    'payment_url': result['url'],
                    'session_id': result['id'],
                    'gateway': 'stripe'
                })
            }

        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Неверный gateway'})}

    # ─── ВЕБХУК ЮKASSA ─────────────────────────────────────────────────────────
    if action == 'webhook_yukassa' and method == 'POST':
        event_data = body
        if event_data.get('event') == 'payment.succeeded':
            meta = event_data.get('object', {}).get('metadata', {})
            user_id = int(meta.get('user_id', 0))
            plan = meta.get('plan', 'starter')
            if user_id and plan in PLANS:
                activate_subscription(user_id, plan, PLANS[plan]['amount'])
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}

    # ─── ВЕБХУК ROBOKASSA ──────────────────────────────────────────────────────
    if action == 'webhook_robokassa' and method == 'POST':
        login = os.environ.get('ROBOKASSA_LOGIN', '')
        password2 = os.environ.get('ROBOKASSA_PASSWORD2', '')
        out_sum = body.get('OutSum', '')
        inv_id = body.get('InvId', '')
        signature = body.get('SignatureValue', '')
        user_id_str = body.get('shp_user_id', '0')
        plan = body.get('shp_plan', 'starter')

        check_str = f"{out_sum}:{inv_id}:{password2}:shp_plan={plan}:shp_user_id={user_id_str}"
        expected = hashlib.md5(check_str.encode()).hexdigest().upper()
        if signature.upper() == expected:
            user_id = int(user_id_str)
            if plan in PLANS:
                activate_subscription(user_id, plan, PLANS[plan]['amount'])
            return {'statusCode': 200, 'headers': CORS, 'body': f'OK{inv_id}'}

        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Неверная подпись'})}

    # ─── ВЕБХУК STRIPE ─────────────────────────────────────────────────────────
    if action == 'webhook_stripe' and method == 'POST':
        stripe_key = os.environ.get('STRIPE_SECRET_KEY', '')
        if not stripe_key:
            return {'statusCode': 503, 'headers': CORS, 'body': 'not configured'}

        event_type = body.get('type', '')
        if event_type == 'checkout.session.completed':
            meta = body.get('data', {}).get('object', {}).get('metadata', {})
            user_id = int(meta.get('user_id', 0))
            plan = meta.get('plan', 'starter')
            if user_id and plan in PLANS:
                activate_subscription(user_id, plan, PLANS[plan]['amount'])
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}

    # ─── ПРОВЕРКА СТАТУСА ПЛАТЕЖА (после редиректа) ────────────────────────────
    if action == 'check' and method == 'POST':
        conn = get_conn()
        cur = conn.cursor()
        user = get_user(cur, token)
        if not user:
            conn.close()
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

        user_id = user[0]
        cur.execute(
            f"""SELECT plan, status, expires_at FROM {SCHEMA}.subscriptions
                WHERE user_id = %s AND status = 'active'
                ORDER BY started_at DESC LIMIT 1""",
            (user_id,)
        )
        row = cur.fetchone()
        conn.close()
        if row:
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
                'has_subscription': True,
                'plan': row[0],
                'expires_at': row[2].isoformat() if row[2] else None
            })}
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'has_subscription': False})}

    return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Укажите action'})}
