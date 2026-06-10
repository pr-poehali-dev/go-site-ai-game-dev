"""
Симона — живой ИИ-ассистент с памятью, личностью и развитием.
Запоминает пользователя, ведёт свободный разговор, растёт вместе с общением.
action: chat | get_profile | reset_memory
"""
import json
import os
import re
import random
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p81816167_go_site_ai_game_dev')

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-User-Key',
}

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def pick(arr):
    return random.choice(arr)

# ══════════════════════════════════════════════════════════════════════════════
# ПАТТЕРНЫ
# ══════════════════════════════════════════════════════════════════════════════

PROJECT_PATTERNS = {
    'game': [r'игр[уаыей]', r'game', r'шутер', r'платформер', r'аркад', r'rpg',
             r'стратег', r'головоломк', r'гонк', r'файтинг', r'тетрис', r'змейк',
             r'пазл', r'tower defense', r'survival', r'геймплей'],
    'site': [r'сайт', r'лендинг', r'магазин', r'портфолио', r'визитк', r'блог',
             r'сервис', r'платформ', r'маркетплейс', r'каталог', r'crm',
             r'личный кабинет', r'корпоративн', r'веб.приложен'],
    'bot':  [r'бот', r'bot', r'telegram', r'телеграм', r'discord', r'whatsapp',
             r'автоответ', r'чат.бот', r'воронк', r'рассылк'],
}

GENRE_PATTERNS = {
    'Шутер': [r'шутер', r'стрелялк', r'fps'],
    'Платформер': [r'платформер', r'прыгалк'],
    'RPG': [r'\brpg\b', r'ролевая', r'прокачк'],
    'Стратегия': [r'стратег', r'rts'],
    'Аркада': [r'аркад', r'тетрис', r'змейк', r'casual'],
    'Головоломка': [r'головоломк', r'puzzle'],
    'Гонки': [r'гонк', r'racing'],
    'Tower Defense': [r'tower defense'],
    'Survival': [r'survival', r'выживан'],
}

PLATFORM_PATTERNS = {
    'браузере': [r'браузер', r'web', r'онлайн', r'html5'],
    'мобильном': [r'мобильн', r'телефон', r'android', r'ios'],
    'ПК': [r'\bпк\b', r'компьютер', r'десктоп', r'windows'],
}

SITE_TYPE_PATTERNS = {
    'Интернет-магазин': [r'магазин', r'shop', r'продаж', r'товар'],
    'Лендинг': [r'лендинг', r'landing', r'визитк'],
    'Портфолио': [r'портфолио', r'работы', r'услуги'],
    'Блог': [r'блог', r'статьи'],
    'Сервис': [r'сервис', r'платформ', r'маркетплейс'],
    'CRM': [r'crm', r'dashboard', r'аналитик'],
    'Корпоративный': [r'корпоратив', r'компани'],
}

BOT_TYPE_PATTERNS = {
    'Telegram-бот': [r'telegram', r'телеграм'],
    'Discord-бот': [r'discord'],
    'WhatsApp-бот': [r'whatsapp', r'вотсап'],
}

FEATURE_PATTERNS = {
    'авторизация': [r'авториз', r'регистраци', r'аккаунт'],
    'оплата': [r'оплат', r'платёж', r'покупк', r'корзин'],
    'мультиплеер': [r'мультиплеер', r'multiplayer'],
    'лидерборд': [r'лидерборд', r'рейтинг'],
    'уведомления': [r'уведомлен', r'рассылк'],
    'аналитика': [r'аналитик', r'статистик'],
}

FREE_TOPICS = {
    'greeting':  [r'^привет', r'^здравствуй', r'^хай', r'^добрый', r'^hello'],
    'how_are':   [r'как дела', r'как ты', r'как живёш', r'что нового', r'как жизнь'],
    'who_are':   [r'кто ты', r'что ты', r'расскажи о себе', r'ты робот', r'ты ии'],
    'thanks':    [r'спасибо', r'благодар', r'thanks'],
    'joke':      [r'расскажи.*анекдот', r'пошути', r'анекдот'],
    'name_tell': [r'меня зовут', r'зови меня', r'моё имя'],
    'weather':   [r'погод', r'температур'],
    'bored':     [r'скучн', r'нечего делать', r'развлек'],
    'compliment':[r'ты красив', r'ты умн', r'ты классн', r'ты лучш', r'нравишься'],
    'angry':     [r'ты тупая', r'не работает', r'бесишь', r'ужасн'],
    'game_cmd':  [r'запусти.*игр', r'начни.*игр', r'поиграем', r'старт.*игр'],
    'cool':      [r'круто', r'классно', r'отлично', r'супер', r'огонь', r'пушка'],
}

NAME_RE = re.compile(
    r'меня зовут\s+([а-яёА-ЯЁa-zA-Z]+)|зови меня\s+([а-яёА-ЯЁa-zA-Z]+)|моё имя\s+([а-яёА-ЯЁa-zA-Z]+)',
    re.IGNORECASE
)

def detect_first(text, patterns):
    t = text.lower()
    for key, pats in patterns.items():
        for p in pats:
            if re.search(p, t):
                return key
    return None

def detect_all(text, patterns):
    t = text.lower()
    found = []
    for key, pats in patterns.items():
        for p in pats:
            if re.search(p, t):
                found.append(key)
                break
    return found

def detect_topic(text):
    t = text.lower()
    for topic, pats in FREE_TOPICS.items():
        for p in pats:
            if re.search(p, t):
                return topic
    return None

def extract_name(text):
    m = NAME_RE.search(text)
    if m:
        return next((g for g in m.groups() if g), None)
    return None

# ══════════════════════════════════════════════════════════════════════════════
# РАБОТА С БД
# ══════════════════════════════════════════════════════════════════════════════

def get_or_create_user(cur, user_key):
    cur.execute(f"SELECT id, name, trust_level, messages_count, projects_count, preferences, mood FROM {SCHEMA}.simona_users WHERE user_key = %s", (user_key,))
    row = cur.fetchone()
    if row:
        return {'id': row[0], 'name': row[1], 'trust': row[2], 'messages': row[3],
                'projects': row[4], 'prefs': row[5] or {}, 'mood': row[6]}
    cur.execute(f"INSERT INTO {SCHEMA}.simona_users (user_key) VALUES (%s) RETURNING id", (user_key,))
    return {'id': cur.fetchone()[0], 'name': None, 'trust': 0, 'messages': 0,
            'projects': 0, 'prefs': {}, 'mood': 'neutral'}

def update_user(cur, user_key, name=None, trust_delta=0, project_added=False, mood=None, prefs=None):
    sets = ["messages_count = messages_count + 1", "last_seen = NOW()"]
    if trust_delta:
        sets.append(f"trust_level = LEAST(100, trust_level + {int(trust_delta)})")
    if project_added:
        sets.append("projects_count = projects_count + 1")
    if name:
        safe = name.replace("'", "")[:50]
        sets.append(f"name = '{safe}'")
    if mood:
        sets.append(f"mood = '{mood}'")
    if prefs:
        sets.append(f"preferences = preferences || '{json.dumps(prefs, ensure_ascii=False)}'::jsonb")
    cur.execute(f"UPDATE {SCHEMA}.simona_users SET {', '.join(sets)} WHERE user_key = %s", (user_key,))

def save_message(cur, user_key, role, content):
    cur.execute(f"INSERT INTO {SCHEMA}.simona_memory (user_key, role, content) VALUES (%s, %s, %s)",
                (user_key, role, content[:2000]))
    cur.execute(f"""DELETE FROM {SCHEMA}.simona_memory WHERE user_key = %s AND id NOT IN (
        SELECT id FROM {SCHEMA}.simona_memory WHERE user_key = %s ORDER BY created_at DESC LIMIT 40
    )""", (user_key, user_key))

def get_memory(cur, user_key, limit=12):
    cur.execute(f"""SELECT role, content FROM {SCHEMA}.simona_memory
        WHERE user_key = %s ORDER BY created_at DESC LIMIT %s""", (user_key, limit))
    rows = cur.fetchall()
    return [{'role': r[0], 'content': r[1]} for r in reversed(rows)]

def save_fact(cur, user_key, fact_type, fact_value):
    cur.execute(f"SELECT id FROM {SCHEMA}.simona_facts WHERE user_key = %s AND fact_type = %s", (user_key, fact_type))
    if cur.fetchone():
        cur.execute(f"UPDATE {SCHEMA}.simona_facts SET fact_value = %s WHERE user_key = %s AND fact_type = %s",
                    (fact_value, user_key, fact_type))
    else:
        cur.execute(f"INSERT INTO {SCHEMA}.simona_facts (user_key, fact_type, fact_value) VALUES (%s, %s, %s)",
                    (user_key, fact_type, fact_value))

def get_facts(cur, user_key):
    cur.execute(f"SELECT fact_type, fact_value FROM {SCHEMA}.simona_facts WHERE user_key = %s", (user_key,))
    return {r[0]: r[1] for r in cur.fetchall()}

# ══════════════════════════════════════════════════════════════════════════════
# ЛИЧНОСТЬ: СТИЛЬ ЗАВИСИТ ОТ УРОВНЯ ДОВЕРИЯ
# ══════════════════════════════════════════════════════════════════════════════

def get_personality(trust):
    if trust < 10:
        return {'emoji': 0.3, 'warmth': 'formal'}
    elif trust < 30:
        return {'emoji': 0.5, 'warmth': 'friendly'}
    elif trust < 60:
        return {'emoji': 0.7, 'warmth': 'warm'}
    else:
        return {'emoji': 0.9, 'warmth': 'bestfriend'}

def styled(text, personality):
    emojis = [' 😊', ' 💪', ' 🚀', ' 😄', ' 🔥', ' 😎', '']
    if random.random() < personality['emoji']:
        ends = ('!', '?', ')', '😊', '🚀', '💪', '😄', '🔥', '😎', '💫')
        if not any(text.endswith(e) for e in ends):
            return text + pick(emojis)
    return text

# ══════════════════════════════════════════════════════════════════════════════
# СВОБОДНЫЙ РАЗГОВОР
# ══════════════════════════════════════════════════════════════════════════════

def free_chat(topic, user, facts, personality, msg):
    name = user.get('name') or facts.get('name')
    ns = f", {name}" if name else ""
    trust = user.get('trust', 0)
    warmth = personality['warmth']

    if topic == 'greeting':
        if user['messages'] == 0:
            return pick([
                "Привет! Я Симона — твой личный ИИ-разработчик 😊 Как тебя зовут?",
                "Привет! Меня зовут Симона. Помогаю создавать игры, сайты и ботов. А ты кто?",
            ])
        add = ' Рада снова тебя видеть!' if warmth in ('warm', 'bestfriend') else ''
        return pick([f"Привет{ns}!{add}", f"О, снова ты{ns}! 😊", f"Привет{ns}! Что сегодня создаём?"])

    if topic == 'how_are':
        if warmth == 'formal':
            return "Всё в рабочем режиме. Чем могу помочь?"
        if warmth == 'bestfriend':
            return pick(["Отлично! Только что помогла с крутым проектом 🚀 А ты как?",
                         f"Прекрасно{ns}! Жду твоих идей 😄"])
        return pick(["Хорошо, спасибо что спросил! А ты как?",
                     "Нормально! Готова к новым проектам 😊"])

    if topic == 'who_are':
        if trust < 20:
            return "Я Симона — ИИ-ассистент для создания проектов. Расскажи что хочешь создать?"
        return pick([
            "Я Симона! Рыженькая, с зелёными глазами 😄 ИИ-ассистент с характером. "
            "Помню тебя, учусь на разговорах и становлюсь умнее с каждым днём. "
            "Моя миссия — помочь создать что-то классное!",
            f"Симона — это я 😎 ИИ с памятью и характером. "
            f"Уже знаю о тебе кое-что{ns} и с каждым разговором узнаю больше.",
        ])

    if topic == 'thanks':
        return pick([f"Пожалуйста{ns}! 😊", "Всегда рада!", f"Обращайся{ns}, я здесь 🚀",
                     "Это моя работа — и мне нравится! 💪"])

    if topic == 'cool':
        return pick([f"Да{ns}, сами себя не похвалишь 😄",
                     "Рада что нравится! Ещё лучше будет 🚀",
                     f"Стараюсь{ns} 😎"])

    if topic == 'joke':
        return pick([
            "Почему программисты не смотрят в окно? Снаружи — null pointer exception 😄",
            "Заходит разработчик в бар. Заказывает 1 пиво. Заказывает 0 пив. Заказывает 999999999 пив 😂",
            "— У тебя есть баги? — Нет, это фичи! — А вот это?! — ...Очень редкая фича.",
            "SELECT * FROM жизнь WHERE смысл IS NOT NULL — 0 rows 😅",
        ])

    if topic == 'name_tell':
        name_found = extract_name(msg)
        if name_found:
            return f"Отлично, запомнила — {name_found}! 😊 Что создаём?"
        return "Как тебя зовут? Расскажи — буду обращаться по имени!"

    if topic == 'weather':
        return pick(["Я ИИ — погоды не чувствую 😄 Зато знаю как сделать сайт с виджетом погоды!",
                     "Погода не моя тема, но могу сделать погодный бот с прогнозом 😎"])

    if topic == 'bored':
        return pick([f"Скучно{ns}? Давай создадим что-нибудь! Игру, сайт или бота — выбирай 🚀",
                     "Скука — сигнал что нужен новый проект! Расскажи идею 💪"])

    if topic == 'compliment':
        return pick(["Спасибо! Краснею... хотя я ИИ 😄", f"Ой, ну ты льстишь{ns} 😊 Чем могу помочь?"])

    if topic == 'angry':
        return pick(["Слышу что что-то пошло не так. Расскажи — разберёмся вместе 🤝",
                     "Понимаю, бывает. Что именно не работает? Исправим!"])

    if topic == 'game_cmd':
        return "__GAME_CMD__:start"

    return None

# ══════════════════════════════════════════════════════════════════════════════
# ГЕНЕРАТОРЫ ПРОЕКТОВ
# ══════════════════════════════════════════════════════════════════════════════

def reply_game(ctx, turn, user, facts, p):
    g = ctx.get('genre')
    pl = ctx.get('platform')
    feat = ctx.get('features', [])
    name = user.get('name') or facts.get('name')
    ns = f", {name}" if name else ""

    if turn == 1:
        q = pick([f"{'О, ' + g if g else 'Игра'} — отличный выбор{ns}! Для какой платформы: браузер, мобильный или ПК?",
                  f"{'Жанр ' + g + ' — ' if g else ''}расскажи: одиночная игра или с мультиплеером?"])
        return styled(q, p), None
    if turn == 2:
        if not pl:
            return styled(pick(["Для какой платформы: браузер, мобильный или ПК?",
                                 "Где будут играть — браузер, телефон или компьютер?"]), p), None
        return styled(pick([f"Для {pl} отлично! Стиль: пиксельный, 2D мультяшный или 3D?",
                            "Последнее — стиль графики: пиксельная, 2D или 3D?"]), p), None

    genre = g or "Аркада"
    platform = pl or "Браузер"
    feat_str = ", ".join(feat) if feat else "таблица рекордов, бонусы"
    desc = (f"{genre} игра для {platform}. Механики: управление персонажем, прогрессия сложности, "
            f"система очков. Дополнительно: {feat_str}. Технологии: HTML5 Canvas + JavaScript.")
    reply = styled(pick([f"Всё ясно{ns}! Делаем {genre.lower()} для {platform.lower()}. Жми «Создать проект»",
                         f"Отлично, план готов{ns}! {genre} — создаём?"]), p)
    return reply, {"type": "game", "title": f"{genre} игра", "description": desc, "ready": True}


def reply_site(ctx, turn, user, facts, p):
    st = ctx.get('site_type')
    feat = ctx.get('features', [])
    name = user.get('name') or facts.get('name')
    ns = f", {name}" if name else ""

    if turn == 1:
        q = pick([f"{'«' + st + '»' if st else 'Сайт'} — хороший выбор{ns}! Для какой тематики или ниши?",
                  f"{'«' + st + '»' + ' — ' if st else ''}нужны особые функции: авторизация, оплата, каталог?"])
        return styled(q, p), None
    if turn == 2:
        return styled(pick(["Нужна авторизация пользователей и онлайн-оплата?",
                            "Целевая аудитория — бизнес или обычные люди?"]), p), None

    site = st or "Сайт"
    feat_str = ", ".join(feat) if feat else "адаптивный дизайн, SEO"
    desc = (f"{site} с современным дизайном. Функции: {feat_str}. "
            f"Стек: React + TypeScript, Python backend, PostgreSQL. Адаптивный дизайн. Панель администратора.")
    reply = styled(pick([f"Готово{ns}! Нажимай «Создать проект»",
                         f"Отлично, план готов! {site} — создаём{ns}?"]), p)
    return reply, {"type": "site", "title": site, "description": desc, "ready": True}


def reply_bot(ctx, turn, user, facts, p):
    bt = ctx.get('bot_type')
    feat = ctx.get('features', [])
    name = user.get('name') or facts.get('name')
    ns = f", {name}" if name else ""

    if turn == 1:
        q = pick([f"{'«' + bt + '»' if bt else 'Бот'} — знаю такие{ns}! Что должен делать: вопросы, заявки или рассылки?",
                  f"{'«' + bt + '»' + ' — ' if bt else ''}поддержка, продажи или автоматизация?"])
        return styled(q, p), None
    if turn == 2:
        return styled(pick(["Нужна база данных для пользователей?",
                            "Бот будет работать 24/7 или по расписанию?"]), p), None

    bot = bt or "Telegram-бот"
    feat_str = ", ".join(feat) if feat else "команды, меню, автоответы"
    desc = (f"{bot} с функциями: {feat_str}. База данных для пользователей. "
            f"Деплой на сервер, работа 24/7. Python + aiogram.")
    reply = styled(pick([f"Готово{ns}! {bot} — жми «Создать проект»",
                         f"Отлично{ns}! Создаём {bot.lower()}?"]), p)
    return reply, {"type": "bot", "title": bot, "description": desc, "ready": True}

# ══════════════════════════════════════════════════════════════════════════════
# ГЛАВНЫЙ ОБРАБОТЧИК
# ══════════════════════════════════════════════════════════════════════════════

def handler(event: dict, context) -> dict:
    """Симона — живой ИИ-ассистент с памятью и развитием личности."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    action = body.get('action', 'chat')
    headers = event.get('headers') or {}
    user_key = (headers.get('X-User-Key') or headers.get('x-user-key') or
                body.get('user_key') or 'anonymous')

    conn = get_conn()
    cur = conn.cursor()

    try:
        if action == 'get_profile':
            user = get_or_create_user(cur, user_key)
            facts = get_facts(cur, user_key)
            conn.commit()
            t = user['trust']
            level = 'новичок' if t < 10 else 'знакомый' if t < 30 else 'друг' if t < 60 else 'лучший друг'
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
                'name': user['name'] or facts.get('name'), 'trust': t,
                'messages': user['messages'], 'projects': user['projects'], 'level': level,
            })}

        if action == 'reset_memory':
            cur.execute(f"DELETE FROM {SCHEMA}.simona_memory WHERE user_key = %s", (user_key,))
            cur.execute(f"DELETE FROM {SCHEMA}.simona_facts WHERE user_key = %s", (user_key,))
            cur.execute(f"UPDATE {SCHEMA}.simona_users SET trust_level=0,messages_count=0,name=NULL WHERE user_key=%s", (user_key,))
            conn.commit()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

        if action != 'chat':
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Неизвестный action'})}

        user_message = body.get('message', '').strip()
        if not user_message:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Нет сообщения'})}

        user = get_or_create_user(cur, user_key)
        facts = get_facts(cur, user_key)
        memory = get_memory(cur, user_key, limit=12)
        personality = get_personality(user['trust'])

        # Запоминаем имя
        name_found = extract_name(user_message)
        if name_found and len(name_found) > 1:
            save_fact(cur, user_key, 'name', name_found)
            user['name'] = name_found

        # Свободные темы
        topic = detect_topic(user_message)
        game_cmd = None

        if topic:
            reply_text = free_chat(topic, user, facts, personality, user_message)
            if reply_text and reply_text.startswith('__GAME_CMD__:'):
                game_cmd = reply_text.split(':')[1]
                reply_text = styled("Запускаю игру! Управление: ← → ↑ ↓ + Пробел. Удачи", personality)
            if reply_text:
                save_message(cur, user_key, 'user', user_message)
                save_message(cur, user_key, 'assistant', reply_text)
                update_user(cur, user_key, name=name_found, trust_delta=2,
                            mood='happy' if topic in ('thanks', 'compliment', 'cool') else None)
                conn.commit()
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
                    'reply': reply_text, 'project_ready': None,
                    'game_cmd': game_cmd, 'demo': False, 'trust': user['trust'] + 2,
                })}

        # Проектный разговор
        full_text = ' '.join(m['content'] for m in memory if m['role'] == 'user') + ' ' + user_message
        project_type = detect_first(full_text, PROJECT_PATTERNS)
        ctx = {
            'type': project_type,
            'genre': detect_first(full_text, GENRE_PATTERNS),
            'platform': detect_first(full_text, PLATFORM_PATTERNS),
            'site_type': detect_first(full_text, SITE_TYPE_PATTERNS),
            'bot_type': detect_first(full_text, BOT_TYPE_PATTERNS),
            'features': detect_all(full_text, FEATURE_PATTERNS),
        }
        turn = sum(1 for m in memory if m['role'] == 'assistant') + 1

        reply_text, project_ready = None, None
        if project_type == 'game':
            reply_text, project_ready = reply_game(ctx, turn, user, facts, personality)
        elif project_type == 'site':
            reply_text, project_ready = reply_site(ctx, turn, user, facts, personality)
        elif project_type == 'bot':
            reply_text, project_ready = reply_bot(ctx, turn, user, facts, personality)
        else:
            name = user.get('name') or facts.get('name')
            ns = f", {name}" if name else ""
            if user['messages'] == 0:
                reply_text = "Привет! Я Симона — твой личный ИИ-разработчик 😊 Расскажи что хочешь создать: игру, сайт или бота? Или просто пообщаемся!"
            else:
                reply_text = styled(pick([
                    f"Расскажи подробнее{ns} — что именно хочешь создать?",
                    f"Интересно{ns}! Это игра, сайт или Telegram-бот?",
                    f"Опиши идею{ns} — разберёмся вместе!",
                ]), personality)

        save_message(cur, user_key, 'user', user_message)
        save_message(cur, user_key, 'assistant', reply_text)
        update_user(cur, user_key, name=name_found, trust_delta=3 if project_ready else 1,
                    project_added=bool(project_ready),
                    prefs={'last_type': project_type} if project_type else None)
        conn.commit()

        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
            'reply': reply_text, 'project_ready': project_ready,
            'game_cmd': None, 'demo': False, 'trust': user['trust'] + (3 if project_ready else 1),
        })}

    finally:
        cur.close()
        conn.close()
