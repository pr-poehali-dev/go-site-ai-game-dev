"""
Симона — живой ИИ-ассистент с памятью, личностью и развитием.
Свободно общается, запоминает пользователя, создаёт проекты по запросу.
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
# НАМЕРЕНИЯ — только явные запросы на создание
# ══════════════════════════════════════════════════════════════════════════════

# Явный запрос создать проект (только если пользователь ХОЧЕТ создать)
CREATE_INTENT = [
    r'хочу\s+(создать|сделать|разработать|написать)',
    r'создай\s+(мне|нам)?',
    r'сделай\s+(мне|нам)?',
    r'разработай',
    r'напиши\s+(мне|нам)?\s+(бот|сайт|игр)',
    r'помоги\s+(создать|сделать)',
    r'нужен\s+(сайт|бот|магазин|лендинг)',
    r'нужна\s+(игра|платформа|crm)',
    r'хочу\s+(игру|сайт|бота|магазин|лендинг|платформу)',
    r'придумай\s+(игру|сайт|бота)',
    r'генерир',
]

# Тип проекта — только если есть явный create_intent рядом
PROJECT_TYPE = {
    'game': [r'игр[уаыей]', r'game', r'шутер', r'платформер', r'аркад', r'rpg',
             r'стратег', r'головоломк', r'гонк', r'файтинг', r'тетрис', r'змейк',
             r'пазл', r'tower defense', r'survival', r'геймплей'],
    'site': [r'сайт', r'лендинг', r'магазин', r'портфолио', r'визитк', r'блог',
             r'сервис', r'маркетплейс', r'каталог', r'crm', r'корпоративн'],
    'bot':  [r'бота?', r'telegram', r'телеграм', r'discord', r'whatsapp', r'чат.бот'],
}

GENRE_PATTERNS = {
    'Шутер':        [r'шутер', r'стрелялк', r'fps'],
    'Платформер':   [r'платформер', r'прыгалк'],
    'RPG':          [r'\brpg\b', r'ролевая', r'прокачк'],
    'Стратегия':    [r'стратег', r'rts'],
    'Аркада':       [r'аркад', r'тетрис', r'змейк', r'casual'],
    'Головоломка':  [r'головоломк', r'puzzle'],
    'Гонки':        [r'гонк', r'racing'],
    'Tower Defense':[r'tower defense'],
    'Survival':     [r'survival', r'выживан'],
}

PLATFORM_PATTERNS = {
    'Браузер':   [r'браузер', r'web', r'онлайн', r'html5'],
    'Мобильный': [r'мобильн', r'телефон', r'android', r'ios'],
    'ПК':        [r'\bпк\b', r'компьютер', r'десктоп', r'windows'],
}

SITE_TYPE_PATTERNS = {
    'Интернет-магазин': [r'магазин', r'shop', r'продаж', r'товар'],
    'Лендинг':          [r'лендинг', r'landing', r'визитк'],
    'Портфолио':        [r'портфолио', r'работы', r'услуги'],
    'Блог':             [r'блог', r'статьи'],
    'Сервис':           [r'сервис', r'маркетплейс'],
    'CRM':              [r'crm', r'dashboard', r'аналитик'],
    'Корпоративный':    [r'корпоратив', r'компани'],
}

BOT_TYPE_PATTERNS = {
    'Telegram-бот':     [r'telegram', r'телеграм'],
    'Discord-бот':      [r'discord'],
    'WhatsApp-бот':     [r'whatsapp', r'вотсап'],
}

FEATURE_PATTERNS = {
    'авторизация': [r'авториз', r'регистраци', r'аккаунт', r'вход'],
    'оплата':      [r'оплат', r'платёж', r'покупк', r'корзин'],
    'мультиплеер': [r'мультиплеер', r'multiplayer'],
    'лидерборд':   [r'лидерборд', r'рейтинг', r'таблица рекордов'],
    'уведомления': [r'уведомлен', r'рассылк', r'push'],
    'аналитика':   [r'аналитик', r'статистик'],
    'чат':         [r'\bчат\b', r'переписк'],
    'карта':       [r'\bкарт[аы]\b', r'геолокац'],
}

# Уточнения к существующему проекту
REFINE_INTENT = [
    r'добавь', r'убери', r'измени', r'поменяй', r'сделай\s+(его|её|это)',
    r'хочу\s+(чтобы|добавить)', r'ещё\s+(нужно|хочу)', r'также', r'плюс\s+к',
    r'дополни', r'улучши', r'ещё\s+добавь',
]

# Свободные темы для обычного разговора
FREE_TOPICS = {
    'greeting':  [r'^привет', r'^здравствуй', r'^хай', r'^добрый', r'^hello', r'^хелло'],
    'how_are':   [r'как дела', r'как ты', r'как живёш', r'что нового', r'как жизнь', r'как настроен'],
    'who_are':   [r'кто ты', r'что ты', r'расскажи о себе', r'ты робот', r'ты ии', r'что умееш'],
    'thanks':    [r'спасибо', r'благодар', r'thanks', r'сенкс'],
    'joke':      [r'расскажи.*анекдот', r'пошути', r'анекдот', r'смешн.*рассказ'],
    'name_tell': [r'меня зовут', r'зови меня', r'моё имя', r'я\s+[а-яёА-ЯЁ]{3,}\b.*зовут'],
    'weather':   [r'погод[аы]', r'температур', r'идёт дождь', r'солнечно'],
    'bored':     [r'скучн', r'нечего делать', r'развлек', r'поболтаем'],
    'compliment':[r'ты красив', r'ты умн', r'ты классн', r'ты лучш', r'нравишься', r'ты супер'],
    'angry':     [r'ты тупая', r'не работает', r'бесишь', r'ужасн', r'плохо работ'],
    'game_cmd':  [r'запусти.*игр', r'начни.*игр', r'поиграем', r'старт.*игр'],
    'cool':      [r'^круто', r'^классно', r'^отлично', r'^супер', r'^огонь', r'^пушка', r'^вау'],
    'bye':       [r'^пока', r'^до свидан', r'^bye', r'^до встречи', r'^покеда'],
    'yes':       [r'^да$', r'^ок$', r'^окей', r'^угу', r'^ага', r'^конечно', r'^давай$'],
    'no':        [r'^нет$', r'^не надо', r'^не хочу', r'^отмени'],
    'what_can':  [r'что ты умееш', r'что можешь', r'твои возможност', r'помоги мне', r'чем помож'],
}

NAME_RE = re.compile(
    r'меня зовут\s+([а-яёА-ЯЁa-zA-Z]+)|зови меня\s+([а-яёА-ЯЁa-zA-Z]+)|моё имя\s+([а-яёА-ЯЁa-zA-Z]+)',
    re.IGNORECASE
)


def has_create_intent(text):
    t = text.lower()
    return any(re.search(p, t) for p in CREATE_INTENT)

def has_refine_intent(text):
    t = text.lower()
    return any(re.search(p, t) for p in REFINE_INTENT)

def detect_project_type(text):
    t = text.lower()
    for ptype, pats in PROJECT_TYPE.items():
        for p in pats:
            if re.search(p, t):
                return ptype
    return None

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
    cur.execute(
        f"SELECT id, name, trust_level, messages_count, projects_count, preferences, mood "
        f"FROM {SCHEMA}.simona_users WHERE user_key = %s", (user_key,))
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
    cur.execute(
        f"INSERT INTO {SCHEMA}.simona_memory (user_key, role, content) VALUES (%s, %s, %s)",
        (user_key, role, content[:2000]))
    cur.execute(f"""DELETE FROM {SCHEMA}.simona_memory WHERE user_key = %s AND id NOT IN (
        SELECT id FROM {SCHEMA}.simona_memory WHERE user_key = %s ORDER BY created_at DESC LIMIT 40
    )""", (user_key, user_key))

def get_memory(cur, user_key, limit=10):
    cur.execute(
        f"SELECT role, content FROM {SCHEMA}.simona_memory "
        f"WHERE user_key = %s ORDER BY created_at DESC LIMIT %s", (user_key, limit))
    rows = cur.fetchall()
    return [{'role': r[0], 'content': r[1]} for r in reversed(rows)]

def save_fact(cur, user_key, fact_type, fact_value):
    cur.execute(
        f"SELECT id FROM {SCHEMA}.simona_facts WHERE user_key = %s AND fact_type = %s",
        (user_key, fact_type))
    if cur.fetchone():
        cur.execute(
            f"UPDATE {SCHEMA}.simona_facts SET fact_value = %s WHERE user_key = %s AND fact_type = %s",
            (fact_value, user_key, fact_type))
    else:
        cur.execute(
            f"INSERT INTO {SCHEMA}.simona_facts (user_key, fact_type, fact_value) VALUES (%s, %s, %s)",
            (user_key, fact_type, fact_value))

def get_facts(cur, user_key):
    cur.execute(f"SELECT fact_type, fact_value FROM {SCHEMA}.simona_facts WHERE user_key = %s", (user_key,))
    return {r[0]: r[1] for r in cur.fetchall()}

# ══════════════════════════════════════════════════════════════════════════════
# ЛИЧНОСТЬ
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

def styled(text, p):
    emojis = [' 😊', ' 💪', ' 🚀', ' 😄', ' 🔥', ' 😎', '']
    ends = ('!', '?', ')', '😊', '🚀', '💪', '😄', '🔥', '😎', '💫', '😂', '🤝')
    if random.random() < p['emoji'] and not any(text.endswith(e) for e in ends):
        return text + pick(emojis)
    return text

# ══════════════════════════════════════════════════════════════════════════════
# СВОБОДНЫЙ РАЗГОВОР
# ══════════════════════════════════════════════════════════════════════════════

def free_chat(topic, user, facts, p, msg):
    name = user.get('name') or facts.get('name')
    ns = f", {name}" if name else ""
    warmth = p['warmth']

    if topic == 'greeting':
        if user['messages'] == 0:
            return pick([
                "Привет! Я Симона — ИИ-разработчик 😊 Могу создать игру, сайт или бота. Как тебя зовут?",
                "Привет! Меня зовут Симона. Разрабатываю проекты и просто общаюсь. А ты кто?",
            ])
        add = ' Рада снова!' if warmth in ('warm', 'bestfriend') else ''
        return pick([f"Привет{ns}!{add}", f"О, снова ты{ns}! 😊", f"Привет{ns}! Чем занимаешься?"])

    if topic == 'how_are':
        if warmth == 'formal':
            return "В рабочем режиме, спасибо. Чем могу помочь?"
        if warmth == 'bestfriend':
            return pick([f"Отлично{ns}! 🚀 А у тебя как дела?",
                         f"Прекрасно{ns}! Жду интересных идей 😄"])
        return pick([f"Хорошо, спасибо{ns}! А ты как?",
                     "Нормально, спасибо что спросил! Чем занимаешься?"])

    if topic == 'who_are':
        if warmth == 'formal':
            return ("Я Симона — ИИ-ассистент. Помогаю создавать игры, сайты и ботов. "
                    "Также просто общаюсь 😊 Чем могу помочь?")
        return pick([
            "Я Симона! Рыженькая, с зелёными глазами 😄 ИИ-разработчик с характером. "
            "Создаю игры, сайты, ботов — и помню всё о тебе. Чем занимаешься?",
            f"Симона — это я 😎 ИИ с памятью и характером{ns}. "
            "Могу разработать проект или просто поболтать. Что хочешь?",
        ])

    if topic == 'what_can':
        return pick([
            "Умею создавать игры, сайты и Telegram-ботов 🚀 Просто скажи «хочу создать» и опиши идею. "
            "Ещё запоминаю тебя, общаюсь на любые темы и управляю демо-игрой. Что интересует?",
            "Создаю проекты по описанию: игры, сайты, боты. "
            "Скажи «хочу создать игру про зомби» — и поехали! Ещё просто общаюсь 😊",
        ])

    if topic == 'thanks':
        return pick([f"Пожалуйста{ns}! 😊", "Всегда рада!", f"Обращайся{ns} 🚀",
                     "Рада помочь! 💪"])

    if topic == 'cool':
        return pick([f"Рада что нравится{ns}! 😄", "Стараюсь! 🔥",
                     f"Это только начало{ns} 🚀"])

    if topic == 'joke':
        return pick([
            "Почему программисты не смотрят в окно? Снаружи — null pointer exception 😄",
            "Заходит разработчик в бар. Заказывает 1 пиво. Заказывает 0 пив. 999999999 пив 😂",
            "— Баги есть? — Нет, это фичи! — А вот это?! — ...Очень редкая фича.",
            "SELECT * FROM жизнь WHERE смысл IS NOT NULL — 0 rows 😅",
        ])

    if topic == 'name_tell':
        found = extract_name(msg)
        if found:
            return f"Запомнила — {found}! 😊 Приятно познакомиться. Чем занимаешься?"
        return f"Как тебя зовут{ns}? Расскажи — буду обращаться по имени!"

    if topic == 'weather':
        return pick(["Погоды не чувствую 😄 Зато могу сделать сайт с виджетом погоды!",
                     "Метеорологией не занимаюсь, но погодный Telegram-бот — это я могу 😎"])

    if topic == 'bored':
        return pick([f"Скучно{ns}? Давай поговорим или создадим что-нибудь классное! 🚀",
                     "Я здесь! Расскажи как дела или придумаем новый проект 😊"])

    if topic == 'compliment':
        return pick(["Ой, спасибо! Краснею... хотя я ИИ 😄",
                     f"Ну ты льстишь{ns} 😊 Мне приятно!"])

    if topic == 'angry':
        return pick(["Слышу что что-то не так. Расскажи подробнее — разберёмся 🤝",
                     "Понимаю. Что именно пошло не так? Постараюсь помочь!"])

    if topic == 'bye':
        return pick([f"Пока{ns}! Буду ждать 😊", f"До встречи{ns}! 🚀",
                     "Удачи! Обращайся когда понадоблюсь 😊"])

    if topic == 'yes':
        return pick(["Отлично! Расскажи подробнее.",
                     "Хорошо! Что именно делаем?", "Понял! Давай 🚀"])

    if topic == 'no':
        return pick(["Ок, не вопрос! Чем ещё могу помочь?",
                     "Хорошо, отменяю. Что тогда делаем?"])

    if topic == 'game_cmd':
        return "__GAME_CMD__:start"

    return None

# ══════════════════════════════════════════════════════════════════════════════
# ГЕНЕРАЦИЯ ПРОЕКТА — сразу выдаёт готовое описание
# ══════════════════════════════════════════════════════════════════════════════

def build_project(msg, p, user, facts):
    """Из одного сообщения сразу строит готовый проект."""
    name = user.get('name') or facts.get('name')
    ns = f", {name}" if name else ""

    ptype = detect_project_type(msg)
    genre = detect_first(msg, GENRE_PATTERNS)
    platform = detect_first(msg, PLATFORM_PATTERNS)
    site_type = detect_first(msg, SITE_TYPE_PATTERNS)
    bot_type = detect_first(msg, BOT_TYPE_PATTERNS)
    features = detect_all(msg, FEATURE_PATTERNS)

    if ptype == 'game':
        g = genre or "Аркада"
        pl = platform or "Браузер"
        feat_str = ", ".join(features) if features else "таблица рекордов, система жизней, бонусы"
        desc = (
            f"{g} игра для {pl}. "
            f"Механики: управление персонажем, прогрессия сложности, система очков. "
            f"Особенности: {feat_str}. "
            f"Графика: 2D пиксельная. Технологии: HTML5 Canvas + JavaScript. "
            f"Адаптивное управление: клавиатура, мышь, тач."
        )
        title = f"{g} игра"
        reply = styled(pick([
            f"Отлично{ns}! Создаю {g.lower()} для {pl.lower()} — жми «Создать проект» и поехали!",
            f"Готово{ns}! {g} для {pl.lower()} с нуля. Нажимай кнопку!",
        ]), p)
        return reply, {"type": "game", "title": title, "description": desc, "ready": True}

    elif ptype == 'site':
        st = site_type or "Сайт"
        feat_str = ", ".join(features) if features else "адаптивный дизайн, SEO-оптимизация, форма обратной связи"
        desc = (
            f"{st} с современным дизайном. "
            f"Функции: {feat_str}. "
            f"Стек: React + TypeScript (фронтенд), Python (бэкенд), PostgreSQL (база). "
            f"Полностью адаптивный под мобильные. Панель администратора."
        )
        title = st
        reply = styled(pick([
            f"Готово{ns}! {st} с нуля — нажимай «Создать проект»!",
            f"Понял задачу{ns}! Создаю {st.lower()} — жми кнопку!",
        ]), p)
        return reply, {"type": "site", "title": title, "description": desc, "ready": True}

    elif ptype == 'bot':
        bt = bot_type or "Telegram-бот"
        feat_str = ", ".join(features) if features else "команды, меню с кнопками, автоответы"
        desc = (
            f"{bt} с функциями: {feat_str}. "
            f"База данных для пользователей и истории. "
            f"Работа 24/7 на сервере. Python + aiogram."
        )
        title = bt
        reply = styled(pick([
            f"Готово{ns}! {bt} с нужными функциями — жми «Создать проект»!",
            f"Отлично{ns}! Собрала ТЗ для {bt.lower()} — создаём?",
        ]), p)
        return reply, {"type": "bot", "title": title, "description": desc, "ready": True}

    else:
        # Тип не распознан — уточняем
        reply = pick([
            f"Понял, хочешь создать{ns}! Уточни: это игра, сайт или Telegram-бот?",
            f"Отлично{ns}! Расскажи подробнее — что именно: игра, сайт или бот?",
        ])
        return styled(reply, p), None


def refine_project(msg, last_project, p, user, facts):
    """Дорабатывает существующий проект по новому запросу."""
    name = user.get('name') or facts.get('name')
    ns = f", {name}" if name else ""

    new_features = detect_all(msg, FEATURE_PATTERNS)
    existing_desc = last_project.get('description', '')
    existing_title = last_project.get('title', '')
    ptype = last_project.get('type', 'game')

    # Добавляем новые фичи в описание
    if new_features:
        feat_str = ", ".join(new_features)
        updated_desc = existing_desc + f" Дополнительно добавить: {feat_str}."
    else:
        # Берём текст запроса как доработку
        updated_desc = existing_desc + f" Доработка: {msg.strip()}."

    reply = styled(pick([
        f"Добавила{ns}! Обновила описание проекта — нажимай «Создать проект»",
        f"Готово{ns}! Учла пожелания — жми кнопку для создания",
    ]), p)

    return reply, {
        "type": ptype,
        "title": existing_title,
        "description": updated_desc,
        "ready": True,
    }

# ══════════════════════════════════════════════════════════════════════════════
# ГЛАВНЫЙ ОБРАБОТЧИК
# ══════════════════════════════════════════════════════════════════════════════

def handler(event: dict, context) -> dict:
    """Симона — живой ИИ-ассистент с памятью, свободным общением и созданием проектов."""
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
            level = ('новичок' if t < 10 else 'знакомый' if t < 30
                     else 'друг' if t < 60 else 'лучший друг')
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
                'name': user['name'] or facts.get('name'),
                'trust': t, 'messages': user['messages'],
                'projects': user['projects'], 'level': level,
            })}

        if action == 'reset_memory':
            cur.execute(f"DELETE FROM {SCHEMA}.simona_memory WHERE user_key = %s", (user_key,))
            cur.execute(f"DELETE FROM {SCHEMA}.simona_facts WHERE user_key = %s", (user_key,))
            cur.execute(
                f"UPDATE {SCHEMA}.simona_users SET trust_level=0,messages_count=0,name=NULL "
                f"WHERE user_key=%s", (user_key,))
            conn.commit()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

        if action != 'chat':
            return {'statusCode': 400, 'headers': CORS,
                    'body': json.dumps({'error': 'Неизвестный action'})}

        user_message = body.get('message', '').strip()
        if not user_message:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Нет сообщения'})}

        # Загружаем профиль
        user = get_or_create_user(cur, user_key)
        facts = get_facts(cur, user_key)
        memory = get_memory(cur, user_key, limit=10)
        personality = get_personality(user['trust'])

        # Запоминаем имя если назвал
        name_found = extract_name(user_message)
        if name_found and len(name_found) > 1:
            save_fact(cur, user_key, 'name', name_found)
            user['name'] = name_found

        reply_text = None
        project_ready = None
        game_cmd = None
        trust_delta = 1

        # ── 1. Сначала проверяем свободные темы ──────────────────────────────
        topic = detect_topic(user_message)
        if topic:
            reply_text = free_chat(topic, user, facts, personality, user_message)
            if reply_text and reply_text.startswith('__GAME_CMD__:'):
                game_cmd = reply_text.split(':')[1]
                reply_text = styled("Запускаю! Управление: ← → ↑ ↓ + Пробел. Удачи", personality)
            if reply_text:
                trust_delta = 2

        # ── 2. Явный запрос создать проект ───────────────────────────────────
        if not reply_text and has_create_intent(user_message):
            reply_text, project_ready = build_project(user_message, personality, user, facts)
            trust_delta = 3

        # ── 3. Доработка существующего проекта ───────────────────────────────
        if not reply_text and has_refine_intent(user_message):
            # Ищем последний project_ready в памяти (сохранён как факт)
            last_proj_json = facts.get('last_project')
            if last_proj_json:
                try:
                    last_proj = json.loads(last_proj_json)
                    reply_text, project_ready = refine_project(
                        user_message, last_proj, personality, user, facts)
                    trust_delta = 3
                except Exception:
                    pass

        # ── 4. Fallback — просто отвечаем дружелюбно ─────────────────────────
        if not reply_text:
            name = user.get('name') or facts.get('name')
            ns = f", {name}" if name else ""
            if user['messages'] == 0:
                reply_text = ("Привет! Я Симона 😊 Помогаю создавать игры, сайты и Telegram-ботов. "
                              "Просто скажи «хочу создать...» и я всё сделаю! Или просто поболтаем. Как тебя зовут?")
            else:
                reply_text = styled(pick([
                    f"Расскажи{ns} — что на уме?",
                    f"Интересно{ns}! Продолжай.",
                    f"Слушаю{ns}! Что хочешь сделать?",
                    f"Ха, понятно{ns}. А что дальше?",
                ]), personality)

        # Сохраняем последний проект как факт
        if project_ready:
            save_fact(cur, user_key, 'last_project', json.dumps(project_ready, ensure_ascii=False))

        # Сохраняем в память
        save_message(cur, user_key, 'user', user_message)
        save_message(cur, user_key, 'assistant', reply_text)
        update_user(cur, user_key, name=name_found, trust_delta=trust_delta,
                    project_added=bool(project_ready),
                    prefs={'last_type': detect_project_type(user_message)} if has_create_intent(user_message) else None)
        conn.commit()

        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
            'reply': reply_text,
            'project_ready': project_ready,
            'game_cmd': game_cmd,
            'demo': False,
            'trust': user['trust'] + trust_delta,
        })}

    finally:
        cur.close()
        conn.close()
