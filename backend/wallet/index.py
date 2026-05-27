"""
Кошелёк пользователя: баланс, история транзакций, подписка.
action: balance | subscribe | stats
"""
import json
import os
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p81816167_go_site_ai_game_dev')
CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
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
        f"""SELECT u.id, u.username, u.role
            FROM {SCHEMA}.sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token = %s AND s.expires_at > NOW() AND u.is_active = TRUE""",
        (token,)
    )
    return cur.fetchone()

def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    body = json.loads(event.get('body') or '{}')
    token = get_token(event)
    action = body.get('action', 'balance')

    conn = get_conn()
    cur = conn.cursor()
    user = get_user(cur, token)

    if not user:
        conn.close()
        return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

    user_id, username, role = user

    # --- БАЛАНС + ПОДПИСКА + ИСТОРИЯ ---
    if action == 'balance':
        cur.execute(f"SELECT balance FROM {SCHEMA}.wallet WHERE user_id = %s", (user_id,))
        row = cur.fetchone()
        balance = row[0] if row else 0

        cur.execute(
            f"""SELECT plan, status, started_at, expires_at, amount
                FROM {SCHEMA}.subscriptions
                WHERE user_id = %s AND status = 'active'
                ORDER BY started_at DESC LIMIT 1""",
            (user_id,)
        )
        sub = cur.fetchone()
        subscription = None
        if sub:
            subscription = {
                'plan': sub[0], 'status': sub[1],
                'started_at': sub[2].isoformat() if sub[2] else None,
                'expires_at': sub[3].isoformat() if sub[3] else None,
                'amount': sub[4]
            }

        cur.execute(
            f"""SELECT amount, type, description, created_at
                FROM {SCHEMA}.wallet_transactions
                WHERE user_id = %s
                ORDER BY created_at DESC LIMIT 10""",
            (user_id,)
        )
        txs = []
        for r in cur.fetchall():
            txs.append({
                'amount': r[0], 'type': r[1],
                'description': r[2],
                'created_at': r[3].isoformat() if r[3] else None
            })

        conn.close()
        return {
            'statusCode': 200, 'headers': CORS,
            'body': json.dumps({'balance': balance, 'subscription': subscription, 'transactions': txs})
        }

    # --- ОФОРМИТЬ ПОДПИСКУ ---
    if action == 'subscribe' and method == 'POST':
        plan = body.get('plan', 'starter')
        plans = {'starter': 990, 'pro': 2990, 'studio': 7990}
        if plan not in plans:
            conn.close()
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Неверный план'})}

        amount = plans[plan]
        cur.execute(
            f"""INSERT INTO {SCHEMA}.subscriptions (user_id, plan, status, amount, expires_at)
                VALUES (%s, %s, 'active', %s, NOW() + INTERVAL '30 days')
                RETURNING id""",
            (user_id, plan, amount)
        )
        cur.execute(
            f"""INSERT INTO {SCHEMA}.wallet_transactions (user_id, amount, type, description)
                VALUES (%s, %s, 'subscription', %s)""",
            (user_id, -amount, f'Подписка {plan.upper()} на 30 дней')
        )
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'plan': plan})}

    # --- ADMIN СТАТИСТИКА ---
    if action == 'stats':
        if role != 'admin':
            conn.close()
            return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Нет доступа'})}

        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.subscriptions WHERE status = 'active'")
        active_subs = cur.fetchone()[0]
        cur.execute(
            f"SELECT COALESCE(SUM(ABS(amount)), 0) FROM {SCHEMA}.wallet_transactions "
            f"WHERE type = 'subscription' AND created_at > NOW() - INTERVAL '1 day'"
        )
        today_income = cur.fetchone()[0]
        cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.users WHERE is_active = TRUE")
        total_users = cur.fetchone()[0]

        conn.close()
        return {
            'statusCode': 200, 'headers': CORS,
            'body': json.dumps({
                'active_subs': active_subs,
                'today_income': int(today_income),
                'total_users': total_users
            })
        }

    conn.close()
    return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Укажите action: balance | subscribe | stats'})}
