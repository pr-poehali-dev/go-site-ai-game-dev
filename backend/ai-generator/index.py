"""
ИИ-генератор игр на базе GPT-4o.
Анализирует описание, определяет жанр, механики, архитектуру и сохраняет в БД.
action: analyze | generate | save
"""
import json
import os
import urllib.request
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
        f"""SELECT u.id, u.username FROM {SCHEMA}.sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token = %s AND s.expires_at > NOW() AND u.is_active = TRUE""",
        (token,)
    )
    return cur.fetchone()

def gpt(messages: list, max_tokens=1500, json_mode=True) -> str:
    api_key = os.environ.get('OPENAI_API_KEY', '')
    if not api_key:
        return None

    body = {
        'model': 'gpt-4o-mini',
        'messages': messages,
        'max_tokens': max_tokens,
        'temperature': 0.7,
    }
    if json_mode:
        body['response_format'] = {'type': 'json_object'}

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
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'POST')
    body = json.loads(event.get('body') or '{}')
    token = get_token(event)
    action = body.get('action', 'analyze')

    # ─── АНАЛИЗ ОПИСАНИЯ ───────────────────────────────────────────────────────
    if action == 'analyze':
        description = body.get('description', '').strip()
        if not description:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Нужно описание'})}

        has_key = bool(os.environ.get('OPENAI_API_KEY'))

        if not has_key:
            # Fallback без GPT — базовый анализ по ключевым словам
            genre = 'Экшн'
            for kw, g in [('платформер','Платформер'),('rpg','RPG'),('шутер','Шутер'),
                          ('стратег','Стратегия'),('хоррор','Хоррор'),('гонк','Гонки'),
                          ('головоломка','Головоломка'),('симул','Симулятор')]:
                if kw in description.lower():
                    genre = g
                    break
            return {
                'statusCode': 200, 'headers': CORS,
                'body': json.dumps({
                    'genre': genre,
                    'difficulty': 'Средняя',
                    'mechanics': ['Движение персонажа', 'Система очков', 'Враги и препятствия'],
                    'ai_features': ['Адаптивная сложность', 'ИИ-противники', 'Подсказки игроку'],
                    'tech_stack': ['Godot 4', 'GDScript', 'HTML5 Export'],
                    'description_enhanced': description,
                    'architecture': {
                        'core_loop': 'Исследование → Бой → Прогресс',
                        'player_progression': 'Уровни + Очки опыта',
                        'ai_system': 'Поведенческое дерево решений',
                    },
                    'estimated_time': '2-4 недели',
                    'ai_powered': False,
                })
            }

        prompt = f"""Ты — эксперт по геймдизайну. Проанализируй описание игры и верни JSON.

Описание: {description}

Верни СТРОГО JSON без пояснений:
{{
  "genre": "жанр игры на русском",
  "difficulty": "Лёгкая|Средняя|Сложная|Хардкор",
  "mechanics": ["механика 1", "механика 2", "механика 3", "механика 4", "механика 5"],
  "ai_features": ["ИИ-функция 1", "ИИ-функция 2", "ИИ-функция 3"],
  "tech_stack": ["технология 1", "технология 2", "технология 3"],
  "description_enhanced": "улучшенное развёрнутое описание игры на русском (3-4 предложения)",
  "architecture": {{
    "core_loop": "основной игровой цикл",
    "player_progression": "система прогресса игрока",
    "ai_system": "описание ИИ-системы в игре"
  }},
  "estimated_time": "оценка времени разработки",
  "monetization": "рекомендуемая монетизация",
  "unique_feature": "уникальная фишка этой игры"
}}"""

        raw = gpt([{'role': 'user', 'content': prompt}])
        analysis = json.loads(raw)
        analysis['ai_powered'] = True

        return {
            'statusCode': 200, 'headers': CORS,
            'body': json.dumps(analysis)
        }

    # ─── ГЕНЕРАЦИЯ ПОЛНОЙ СТРУКТУРЫ + СОХРАНЕНИЕ В БД ─────────────────────────
    if action == 'generate':
        conn = get_conn()
        cur = conn.cursor()
        user = get_user(cur, token)
        if not user:
            conn.close()
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

        user_id, username = user
        description = body.get('description', '').strip()
        analysis = body.get('analysis', {})
        engine = body.get('engine', 'Godot')
        platform = body.get('platform', 'Все')
        graphics = body.get('graphics', '2D Пиксель')

        title = description[:60] if description else 'Моя игра'

        has_key = bool(os.environ.get('OPENAI_API_KEY'))
        game_doc = None

        if has_key and description:
            genre = analysis.get('genre', 'Экшн')
            mechanics = ', '.join(analysis.get('mechanics', []))

            doc_prompt = f"""Создай детальный геймдизайн-документ для игры.

Описание: {description}
Жанр: {genre}
Движок: {engine}
Платформа: {platform}
Механики: {mechanics}

Верни JSON:
{{
  "title": "название игры",
  "tagline": "слоган игры",
  "story": "краткий сюжет (2-3 предложения)",
  "characters": [
    {{"name": "имя", "role": "роль", "description": "описание", "abilities": ["способность 1", "способность 2"]}}
  ],
  "levels": [
    {{"name": "название уровня", "description": "описание", "enemies": ["враг 1"], "boss": "босс или null"}}
  ],
  "ai_behavior": {{
    "enemy_ai": "как работает ИИ врагов",
    "adaptive_difficulty": "как ИИ адаптирует сложность",
    "player_coach": "как ИИ-тренер помогает игроку",
    "learning_algorithm": "алгоритм обучения (Q-learning/NEAT/PPO)"
  }},
  "code_structure": {{
    "main_script": "// Основной скрипт на GDScript\\nextends Node\\n\\nvar score = 0\\n\\nfunc _ready():\\n\\tstart_game()",
    "player_script": "// Скрипт игрока",
    "ai_script": "// ИИ-агент"
  }},
  "monetization_plan": "план монетизации",
  "development_phases": ["Фаза 1: прототип", "Фаза 2: контент", "Фаза 3: полировка"]
}}"""
            raw = gpt([{'role': 'user', 'content': doc_prompt}], max_tokens=2000)
            game_doc = json.loads(raw)
            title = game_doc.get('title', title)

        # Сохраняем в БД
        cur.execute(
            f"""INSERT INTO {SCHEMA}.game_projects
                (user_id, title, description, genre, engine, platform, graphics_style,
                 status, progress, ai_analysis, ai_mechanics, ai_genre, ai_difficulty)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'draft', 5,
                        %s::jsonb, %s, %s, %s)
                RETURNING id""",
            (
                user_id, title, description,
                analysis.get('genre', ''), engine, platform, graphics,
                json.dumps(game_doc or analysis),
                analysis.get('mechanics', []),
                analysis.get('genre', ''),
                analysis.get('difficulty', 'Средняя'),
            )
        )
        project_id = cur.fetchone()[0]

        # Создаём ИИ-агента для этого проекта
        cur.execute(
            f"""INSERT INTO {SCHEMA}.ai_agents
                (project_id, agent_name, generation, games_played, best_score,
                 weights, fitness_history)
                VALUES (%s, %s, 0, 0, 0, %s::jsonb, '[]'::jsonb)
                RETURNING id""",
            (project_id, f'NEXUS-AI-{project_id}',
             json.dumps({'initialized': True, 'layers': [8, 16, 8, 4]}))
        )
        agent_id = cur.fetchone()[0]
        conn.commit()
        conn.close()

        return {
            'statusCode': 200, 'headers': CORS,
            'body': json.dumps({
                'project_id': project_id,
                'agent_id': agent_id,
                'title': title,
                'game_doc': game_doc,
                'analysis': analysis,
            })
        }

    # ─── ЧАТ С ИИ-ПОМОЩНИКОМ (редактор кода + курс языков) ───────────────────
    if action == 'chat':
        question = body.get('question', '').strip()
        context_data = body.get('context', {})
        mode = body.get('mode', 'game')  # 'game' | 'course'

        if not question:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Нет вопроса'})}

        has_key = bool(os.environ.get('OPENAI_API_KEY'))

        if not has_key:
            # Локальные ответы-заглушки
            fallbacks = {
                'платформер': 'Для платформера: переменная jump_force ≈ 400–600, применяй через velocity.y. Двойной прыжок — счётчик jump_count.',
                'шутер': 'В шутере добавь пул объектов для пуль — не создавай новые каждый раз. Camera shake при выстреле через Tween.',
                'rpg': 'В RPG храни диалоги в JSON/словарях. Система квестов — паттерн State Machine.',
                'враг': 'ИИ врага: состояния Idle → Patrol → Chase → Attack. В Godot используй NavigationAgent2D для pathfinding.',
                'очк': 'Счёт храни в синглтоне (Autoload). Сигнал score_changed уведомит все сцены автоматически.',
                'прыж': 'Прыжок: velocity.y = -jump_force при нажатии. Проверяй is_on_floor() перед прыжком.',
                'цикл': 'for i in range(count): — перебор числового диапазона. for item in array: — перебор массива.',
                'класс': 'Класс — шаблон объекта. class Enemy: def __init__(self): self.hp = 100. Создай: e = Enemy()',
                'функц': 'Функция — переиспользуемый блок кода. def shoot(): ... — объявление. shoot() — вызов.',
            }
            genre = context_data.get('genre', '').lower()
            q_lower = question.lower()
            answer = next((v for k, v in fallbacks.items() if k in q_lower or k in genre), 
                         f'По вопросу "{question}": начни с минимального рабочего прототипа, затем усложняй. Декомпозируй задачу на маленькие шаги.')
            return {
                'statusCode': 200, 'headers': CORS,
                'body': json.dumps({'answer': answer, 'ai_powered': False})
            }

        # Системный промпт зависит от режима
        if mode == 'course':
            lang = context_data.get('engine', 'Python')
            lesson = context_data.get('description', '')
            system = f"""Ты — NEXUS AI, опытный преподаватель программирования.
Студент изучает {lang} для разработки игр.
Текущий урок: {lesson}

Правила ответов:
- Отвечай на русском, дружелюбно и понятно
- Объяснения простые, без академического жаргона
- Обязательно давай пример кода на {lang}
- Связывай примеры с разработкой игр (враги, очки, движение, прыжок)
- Если вопрос про ошибку — покажи исправленный код
- Длина ответа: 3-6 предложений + пример кода"""
        else:
            proj_title = context_data.get('description', '')[:80]
            engine = context_data.get('engine', '')
            genre = context_data.get('genre', '')
            system = f"""Ты — NEXUS AI, эксперт-разработчик игр.
Проект: {proj_title}
Движок: {engine} | Жанр: {genre}

Правила ответов:
- Отвечай на русском, конкретно и по делу
- Давай готовый код под движок {engine} если нужно
- Учитывай контекст проекта в каждом ответе
- Предлагай лучшие практики геймдизайна
- Длина: 2-4 предложения + код при необходимости"""

        raw = gpt([
            {'role': 'system', 'content': system},
            {'role': 'user', 'content': question}
        ], max_tokens=600, json_mode=False)

        return {
            'statusCode': 200, 'headers': CORS,
            'body': json.dumps({'answer': raw or 'Не удалось получить ответ', 'ai_powered': True})
        }

    return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Укажи action: analyze|generate|chat'})}