"""
Авторизация пользователей: регистрация, вход, выход, проверка сессии.
action в теле запроса: register | login | logout | me
"""
import json
import os
import hashlib
import secrets
from datetime import datetime, timedelta
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p81816167_go_site_ai_game_dev')
CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
}

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def make_token() -> str:
    return secrets.token_hex(32)

def get_token(event):
    h = event.get('headers') or {}
    return h.get('X-Auth-Token') or h.get('x-auth-token') or ''

def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    body = json.loads(event.get('body') or '{}')
    action = body.get('action', '')

    # --- РЕГИСТРАЦИЯ ---
    if action == 'register' and method == 'POST':
        email = body.get('email', '').strip().lower()
        password = body.get('password', '')
        username = body.get('username', '').strip()

        if not email or not password or not username:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Заполните все поля'})}
        if len(password) < 6:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Пароль минимум 6 символов'})}

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email = %s", (email,))
        if cur.fetchone():
            conn.close()
            return {'statusCode': 409, 'headers': CORS, 'body': json.dumps({'error': 'Email уже зарегистрирован'})}

        pw_hash = hash_password(password)
        cur.execute(
            f"INSERT INTO {SCHEMA}.users (email, password_hash, username) VALUES (%s, %s, %s) RETURNING id",
            (email, pw_hash, username)
        )
        user_id = cur.fetchone()[0]
        cur.execute(f"INSERT INTO {SCHEMA}.wallet (user_id, balance) VALUES (%s, 0)", (user_id,))

        token = make_token()
        expires = datetime.now() + timedelta(days=30)
        cur.execute(
            f"INSERT INTO {SCHEMA}.sessions (user_id, token, expires_at) VALUES (%s, %s, %s)",
            (user_id, token, expires)
        )
        conn.commit()
        conn.close()

        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({
                'token': token,
                'user': {'id': user_id, 'email': email, 'username': username, 'role': 'user'}
            })
        }

    # --- ВХОД ---
    if action == 'login' and method == 'POST':
        email = body.get('email', '').strip().lower()
        password = body.get('password', '')

        if not email or not password:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Введите email и пароль'})}

        conn = get_conn()
        cur = conn.cursor()
        pw_hash = hash_password(password)
        cur.execute(
            f"SELECT id, username, role FROM {SCHEMA}.users WHERE email = %s AND password_hash = %s AND is_active = TRUE",
            (email, pw_hash)
        )
        row = cur.fetchone()
        if not row:
            conn.close()
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Неверный email или пароль'})}

        user_id, username, role = row
        token = make_token()
        expires = datetime.now() + timedelta(days=30)
        cur.execute(
            f"INSERT INTO {SCHEMA}.sessions (user_id, token, expires_at) VALUES (%s, %s, %s)",
            (user_id, token, expires)
        )
        conn.commit()
        conn.close()

        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({
                'token': token,
                'user': {'id': user_id, 'email': email, 'username': username, 'role': role}
            })
        }

    # --- ПРОВЕРКА СЕССИИ ---
    if action == 'me' or (method == 'GET' and get_token(event)):
        token = get_token(event)
        if not token:
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f"""SELECT u.id, u.email, u.username, u.role
                FROM {SCHEMA}.sessions s
                JOIN {SCHEMA}.users u ON u.id = s.user_id
                WHERE s.token = %s AND s.expires_at > NOW() AND u.is_active = TRUE""",
            (token,)
        )
        row = cur.fetchone()
        conn.close()

        if not row:
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Сессия истекла'})}

        user_id, email, username, role = row
        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({'user': {'id': user_id, 'email': email, 'username': username, 'role': role}})
        }

    # --- ВЫХОД ---
    if action == 'logout' and method == 'POST':
        token = get_token(event)
        if token:
            conn = get_conn()
            cur = conn.cursor()
            cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE token = %s", (token,))
            conn.commit()
            conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

    return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Укажите action: register | login | logout | me'})}
