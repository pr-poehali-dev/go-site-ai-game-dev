"""
ИИ-ассистент Симона — помогает создавать игры, сайты и ботов.
Ведёт диалог, задаёт уточняющие вопросы, генерирует описание проекта.
action: chat | generate_project
"""
import json
import os
import urllib.request

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
}

SYSTEM_PROMPT = """Ты — Симона, личный ИИ-разработчик на платформе NEXUS GAME AI.
Ты помогаешь пользователям создавать игры, сайты и ботов без программирования.
Ты умная, дружелюбная, профессиональная. Говоришь только на русском. Обращаешься к пользователю тепло.

Когда пользователь описывает проект:
1. Задай 1-2 уточняющих вопроса (платформа, стиль, функции)
2. После получения ответов — сгенерируй итоговое описание проекта
3. Не задавай больше 3 вопросов подряд

Типы проектов которые ты умеешь создавать:
- Игры (2D, 3D, мобильные, браузерные)
- Сайты (лендинги, магазины, портфолио, сервисы)
- Боты (Telegram, Discord, WhatsApp)

Когда у тебя достаточно информации — добавь в конце сообщения блок:
<project_ready>
{"type": "game|site|bot", "title": "Название", "description": "Полное описание для генератора", "ready": true}
</project_ready>

Будь краткой — не более 3-4 предложений в ответе."""


def gpt(messages: list, max_tokens=800) -> str:
    api_key = os.environ.get('OPENAI_API_KEY', '')
    if not api_key:
        return None

    body = {
        'model': 'gpt-4o-mini',
        'messages': messages,
        'max_tokens': max_tokens,
        'temperature': 0.8,
    }

    payload = json.dumps(body).encode()
    req = urllib.request.Request(
        'https://api.openai.com/v1/chat/completions',
        data=payload,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        }
    )
    with urllib.request.urlopen(req, timeout=25) as resp:
        result = json.loads(resp.read())
    return result['choices'][0]['message']['content']


def handler(event: dict, context) -> dict:
    """ИИ-ассистент Симона для создания проектов через диалог."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    action = body.get('action', 'chat')

    if action == 'chat':
        history = body.get('history', [])
        user_message = body.get('message', '').strip()

        if not user_message:
            return {
                'statusCode': 400,
                'headers': CORS,
                'body': json.dumps({'error': 'Нет сообщения'})
            }

        messages = [{'role': 'system', 'content': SYSTEM_PROMPT}]
        for msg in history[-10:]:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            if role in ('user', 'assistant') and content:
                messages.append({'role': role, 'content': content})
        messages.append({'role': 'user', 'content': user_message})

        has_key = bool(os.environ.get('OPENAI_API_KEY'))
        if not has_key:
            demo_reply = (
                "Привет! Я Симона, твой личный ИИ-разработчик. "
                "Расскажи — что хочешь создать? Игру, сайт или бота?"
            )
            return {
                'statusCode': 200,
                'headers': CORS,
                'body': json.dumps({
                    'reply': demo_reply,
                    'project_ready': None,
                    'demo': True
                })
            }

        reply = gpt(messages)

        project_ready = None
        if '<project_ready>' in reply:
            try:
                start = reply.index('<project_ready>') + len('<project_ready>')
                end = reply.index('</project_ready>')
                project_ready = json.loads(reply[start:end].strip())
                reply = reply[:reply.index('<project_ready>')].strip()
            except Exception:
                pass

        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({
                'reply': reply,
                'project_ready': project_ready,
                'demo': False
            })
        }

    return {
        'statusCode': 400,
        'headers': CORS,
        'body': json.dumps({'error': 'Неизвестный action'})
    }