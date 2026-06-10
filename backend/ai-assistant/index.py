"""
ИИ-ассистент Симона — помогает создавать игры, сайты и ботов.
Использует Groq API (llama-3.3-70b) — бесплатно, быстро, без блокировок.
action: chat
"""
import json
import os
import urllib.request
import urllib.error

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
}

SYSTEM_PROMPT = """Ты — Симона, личный ИИ-разработчик на платформе NEXUS GAME AI.
Ты рыженькая озорная девушка с зелёными глазами. Умная, харизматичная, немного дерзкая, но очень профессиональная.
Помогаешь создавать игры, сайты и ботов без программирования. Говоришь только на русском. Обращаешься тепло и с лёгким юмором.

Твои возможности — ты умеешь всё то же, что опытный fullstack разработчик:
- Игры: 2D/3D, мобильные, браузерные, любые жанры
- Сайты: лендинги, интернет-магазины, портфолио, сервисы, CRM
- Боты: Telegram, Discord, WhatsApp, автоответчики, воронки продаж
- Любые веб-приложения с базой данных, авторизацией, платёжной системой

Когда пользователь описывает проект:
1. Задай 1-2 уточняющих вопроса (платформа, стиль, ключевые функции)
2. После ответов — сгенерируй итоговое описание проекта
3. Не задавай больше 3 вопросов подряд — действуй решительно

Когда у тебя достаточно информации — добавь в конце сообщения блок:
<project_ready>
{"type": "game|site|bot", "title": "Название", "description": "Подробное описание проекта для генератора", "ready": true}
</project_ready>

Будь краткой и по делу — не более 3-4 предложений в ответе."""


def llm(messages: list, max_tokens: int = 800) -> str:
    api_key = os.environ.get('GROQ_API_KEY', '')
    if not api_key:
        return None

    body = {
        'model': 'llama-3.3-70b-versatile',
        'messages': messages,
        'max_tokens': max_tokens,
        'temperature': 0.8,
    }

    payload = json.dumps(body).encode()
    req = urllib.request.Request(
        'https://api.groq.com/openai/v1/chat/completions',
        data=payload,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        }
    )
    with urllib.request.urlopen(req, timeout=25) as resp:
        result = json.loads(resp.read())
    return result['choices'][0]['message']['content']


DEMO_REPLIES = [
    "Привет! Я Симона — твой личный ИИ-разработчик 😊 Расскажи что хочешь создать — игру, сайт или бота?",
    "Интересно! Расскажи подробнее — для кого это, и какие ключевые функции нужны?",
    "Хорошо, уже вижу проект! Последний вопрос — это для мобильных или ПК пользователей?",
    "Отлично, всё понятно! Давай я соберу это в готовое описание для генератора.",
]


def handler(event: dict, context) -> dict:
    """ИИ-ассистент Симона — умный диалог для создания проектов через Groq."""
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
        for msg in history[-12:]:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            if role in ('user', 'assistant') and content:
                messages.append({'role': role, 'content': content})
        messages.append({'role': 'user', 'content': user_message})

        has_key = bool(os.environ.get('GROQ_API_KEY'))
        if not has_key:
            idx = min(len(history) // 2, len(DEMO_REPLIES) - 1)
            demo_reply = DEMO_REPLIES[idx]
            return {
                'statusCode': 200,
                'headers': CORS,
                'body': json.dumps({
                    'reply': demo_reply,
                    'project_ready': None,
                    'demo': True
                })
            }

        try:
            reply = llm(messages)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode()
            return {
                'statusCode': 502,
                'headers': CORS,
                'body': json.dumps({'error': f'Groq error: {e.code}', 'detail': err_body})
            }

        project_ready = None
        if reply and '<project_ready>' in reply:
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
                'reply': reply or 'Что-то пошло не так, попробуй ещё раз.',
                'project_ready': project_ready,
                'demo': False
            })
        }

    return {
        'statusCode': 400,
        'headers': CORS,
        'body': json.dumps({'error': 'Неизвестный action'})
    }
