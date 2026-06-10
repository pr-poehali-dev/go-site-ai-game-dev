"""
CRUD для игровых проектов пользователя.
action: list | create | update | delete | portfolio
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

def get_token(event):
    h = event.get('headers') or {}
    return h.get('X-Auth-Token') or h.get('x-auth-token') or ''

def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    body = json.loads(event.get('body') or '{}')
    token = get_token(event)
    action = body.get('action', '')

    conn = get_conn()
    cur = conn.cursor()

    # --- ПУБЛИЧНЫЙ ПОРТФОЛИО ---
    if action == 'portfolio' or (method == 'GET' and not token):
        cur.execute(
            f"""SELECT p.id, p.title, p.description, p.genre, p.engine, p.status, u.username
                FROM {SCHEMA}.game_projects p
                JOIN {SCHEMA}.users u ON u.id = p.user_id
                WHERE p.is_public = TRUE
                ORDER BY p.updated_at DESC
                LIMIT 20"""
        )
        cols = ['id', 'title', 'description', 'genre', 'engine', 'status', 'username']
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'projects': rows})}

    # --- СПИСОК ПРОЕКТОВ ПОЛЬЗОВАТЕЛЯ ---
    if action == 'list' or (method == 'GET' and token):
        user = get_user(cur, token)
        if not user:
            conn.close()
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

        user_id = user[0]
        cur.execute(
            f"""SELECT id, title, description, genre, engine, platform, graphics_style,
                       status, progress, is_public, created_at, updated_at
                FROM {SCHEMA}.game_projects
                WHERE user_id = %s
                ORDER BY updated_at DESC""",
            (user_id,)
        )
        cols = ['id', 'title', 'description', 'genre', 'engine', 'platform', 'graphics_style',
                'status', 'progress', 'is_public', 'created_at', 'updated_at']
        rows = cur.fetchall()
        projects = []
        for row in rows:
            p = dict(zip(cols, row))
            p['created_at'] = p['created_at'].isoformat() if p['created_at'] else None
            p['updated_at'] = p['updated_at'].isoformat() if p['updated_at'] else None
            projects.append(p)

        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'projects': projects})}

    # --- СОЗДАТЬ ПРОЕКТ ---
    if action == 'create' and method == 'POST':
        user = get_user(cur, token)
        if not user:
            conn.close()
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

        user_id = user[0]
        title = body.get('title', '').strip()
        if not title:
            conn.close()
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Название обязательно'})}

        cur.execute(
            f"""INSERT INTO {SCHEMA}.game_projects
                (user_id, title, description, genre, engine, platform, graphics_style, status, progress)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'draft', 0)
                RETURNING id, title, status, progress, created_at""",
            (user_id, title,
             body.get('description', ''),
             body.get('genre', ''),
             body.get('engine', ''),
             body.get('platform', ''),
             body.get('graphics_style', ''))
        )
        row = cur.fetchone()
        conn.commit()
        conn.close()

        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({
                'project': {
                    'id': row[0], 'title': row[1],
                    'status': row[2], 'progress': row[3],
                    'created_at': row[4].isoformat()
                }
            })
        }

    # --- ОБНОВИТЬ ПРОЕКТ ---
    if action == 'update' and method == 'POST':
        user = get_user(cur, token)
        if not user:
            conn.close()
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

        project_id = body.get('project_id')
        user_id = user[0]
        if not project_id:
            conn.close()
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Нужен project_id'})}

        fields = []
        vals = []
        for f in ['title', 'description', 'genre', 'engine', 'platform', 'graphics_style', 'status', 'progress', 'is_public']:
            if f in body:
                fields.append(f"{f} = %s")
                vals.append(body[f])

        if fields:
            fields.append("updated_at = NOW()")
            vals.extend([project_id, user_id])
            cur.execute(
                f"UPDATE {SCHEMA}.game_projects SET {', '.join(fields)} WHERE id = %s AND user_id = %s",
                vals
            )
            conn.commit()

        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

    # --- УДАЛИТЬ ПРОЕКТ ---
    if action == 'delete':
        user = get_user(cur, token)
        if not user:
            conn.close()
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

        project_id = body.get('project_id')
        if not project_id:
            conn.close()
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Нужен project_id'})}

        user_id = user[0]
        # Удаляем только свой проект
        cur.execute(
            f"DELETE FROM {SCHEMA}.game_projects WHERE id = %s AND user_id = %s RETURNING id",
            (project_id, user_id)
        )
        deleted = cur.fetchone()
        conn.commit()
        conn.close()

        if not deleted:
            return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Проект не найден'})}
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'deleted_id': project_id})}

    conn.close()
    return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Укажите action: list | create | update | delete | portfolio'})}