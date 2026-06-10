"""
Симона — самообучающийся ИИ-ассистент.
Ищет в интернете, учится из разговоров, изучает технологии, совершенствует знания.
action: chat | get_profile | reset_memory | get_knowledge | learn_status
"""
import json
import os
import re
import random
import psycopg2
import urllib.request
import urllib.parse
import urllib.error
import html

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p81816167_go_site_ai_game_dev')

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-User-Key',
}

# ══════════════════════════════════════════════════════════════════════════════
# ВЕБ-ПОИСК — DuckDuckGo Instant Answer API (бесплатно, без ключей)
# ══════════════════════════════════════════════════════════════════════════════

def web_search(query: str, max_results: int = 3) -> list[dict]:
    """Поиск через DuckDuckGo Instant Answer API."""
    try:
        q = urllib.parse.quote(query)
        url = f"https://api.duckduckgo.com/?q={q}&format=json&no_html=1&skip_disambig=1&t=simona_ai"
        req = urllib.request.Request(url, headers={'User-Agent': 'SimonaAI/1.0'})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read())

        results = []

        # Основной ответ
        if data.get('AbstractText'):
            results.append({
                'title': data.get('Heading', query),
                'text': data['AbstractText'][:500],
                'url': data.get('AbstractURL', ''),
                'source': 'DDG Abstract',
            })

        # Related Topics
        for topic in data.get('RelatedTopics', [])[:max_results]:
            if isinstance(topic, dict) and topic.get('Text'):
                results.append({
                    'title': topic.get('Name', ''),
                    'text': topic['Text'][:300],
                    'url': topic.get('FirstURL', ''),
                    'source': 'DDG Related',
                })

        # Если ничего нет — пробуем html-поиск через lite версию
        if not results:
            results = _ddg_lite_search(query, max_results)

        return results[:max_results]
    except Exception:
        return []


def _ddg_lite_search(query: str, max_results: int = 3) -> list[dict]:
    """Fallback: DDG HTML lite поиск."""
    try:
        q = urllib.parse.quote(query)
        url = f"https://lite.duckduckgo.com/lite/?q={q}"
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; SimonaAI/1.0)',
        })
        with urllib.request.urlopen(req, timeout=8) as resp:
            body = resp.read().decode('utf-8', errors='ignore')

        # Парсим сниппеты из HTML
        snippets = re.findall(r'class="result-snippet"[^>]*>(.*?)</td>', body, re.DOTALL)
        titles = re.findall(r'class="result-link"[^>]*>(.*?)</a>', body, re.DOTALL)

        results = []
        for i, snippet in enumerate(snippets[:max_results]):
            clean = re.sub(r'<[^>]+>', '', snippet).strip()
            clean = html.unescape(clean)
            title = html.unescape(re.sub(r'<[^>]+>', '', titles[i])) if i < len(titles) else query
            if clean:
                results.append({'title': title, 'text': clean[:400], 'url': '', 'source': 'DDG Lite'})

        return results
    except Exception:
        return []


def fetch_page_summary(url: str, max_chars: int = 800) -> str:
    """Загружает страницу и извлекает текст."""
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; SimonaAI/1.0)',
        })
        with urllib.request.urlopen(req, timeout=6) as resp:
            body = resp.read().decode('utf-8', errors='ignore')[:50000]

        # Убираем скрипты, стили, теги
        body = re.sub(r'<script[^>]*>.*?</script>', '', body, flags=re.DOTALL)
        body = re.sub(r'<style[^>]*>.*?</style>', '', body, flags=re.DOTALL)
        body = re.sub(r'<[^>]+>', ' ', body)
        body = html.unescape(body)
        body = re.sub(r'\s+', ' ', body).strip()
        return body[:max_chars]
    except Exception:
        return ''

# ══════════════════════════════════════════════════════════════════════════════
# БД — БАЗА ЗНАНИЙ
# ══════════════════════════════════════════════════════════════════════════════

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def pick(arr):
    return random.choice(arr)

def kb_get(cur, key: str, category: str = None) -> str | None:
    """Ищем знание в базе."""
    key_l = key.lower().strip()
    if category:
        cur.execute(
            f"SELECT value, confidence FROM {SCHEMA}.simona_knowledge "
            f"WHERE category=%s AND lower(key)=%s ORDER BY confidence DESC LIMIT 1",
            (category, key_l))
    else:
        cur.execute(
            f"SELECT value, confidence FROM {SCHEMA}.simona_knowledge "
            f"WHERE lower(key)=%s OR lower(key) LIKE %s ORDER BY confidence DESC LIMIT 1",
            (key_l, f'%{key_l}%'))
    row = cur.fetchone()
    if row:
        # Увеличиваем счётчик использования
        cur.execute(
            f"UPDATE {SCHEMA}.simona_knowledge SET use_count=use_count+1, updated_at=NOW() "
            f"WHERE lower(key)=%s", (key_l,))
        return row[0]
    return None

def kb_search(cur, query: str, limit: int = 3) -> list[dict]:
    """Поиск релевантных знаний по ключевым словам."""
    words = [w for w in query.lower().split() if len(w) > 3][:5]
    if not words:
        return []
    conditions = " OR ".join([f"lower(key) LIKE %s OR lower(value) LIKE %s" for _ in words])
    params = []
    for w in words:
        params.extend([f'%{w}%', f'%{w}%'])
    params.append(limit)
    cur.execute(
        f"SELECT category, key, value, confidence FROM {SCHEMA}.simona_knowledge "
        f"WHERE {conditions} ORDER BY confidence DESC, use_count DESC LIMIT %s",
        params)
    return [{'cat': r[0], 'key': r[1], 'value': r[2], 'conf': r[3]} for r in cur.fetchall()]

def kb_learn(cur, category: str, key: str, value: str, source: str = 'conversation', confidence: float = 0.6):
    """Сохраняем новое знание или улучшаем существующее."""
    key_clean = key.strip()[:200]
    value_clean = value.strip()[:2000]
    cur.execute(
        f"SELECT id, confidence, value FROM {SCHEMA}.simona_knowledge "
        f"WHERE category=%s AND lower(key)=%s", (category, key_clean.lower()))
    row = cur.fetchone()
    if row:
        # Улучшаем: берём более уверенное знание
        new_conf = max(row[1], confidence)
        # Если новое знание от веба — добавляем к старому
        if source == 'web' and len(value_clean) > 50:
            merged = value_clean[:1000]
        else:
            merged = row[2]  # оставляем старое
        cur.execute(
            f"UPDATE {SCHEMA}.simona_knowledge SET value=%s, confidence=%s, "
            f"use_count=use_count+1, updated_at=NOW() "
            f"WHERE category=%s AND lower(key)=%s",
            (merged, new_conf, category, key_clean.lower()))
    else:
        cur.execute(
            f"INSERT INTO {SCHEMA}.simona_knowledge (category, key, value, source, confidence) "
            f"VALUES (%s, %s, %s, %s, %s)",
            (category, key_clean, value_clean, source, confidence))

def log_learning(cur, event_type: str, description: str, data: dict = None):
    cur.execute(
        f"INSERT INTO {SCHEMA}.simona_learning_log (event_type, description, data) VALUES (%s, %s, %s)",
        (event_type, description[:500], json.dumps(data or {}, ensure_ascii=False)))

def get_learn_stats(cur) -> dict:
    cur.execute(f"SELECT COUNT(*), AVG(confidence) FROM {SCHEMA}.simona_knowledge")
    row = cur.fetchone()
    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.simona_learning_log WHERE created_at > NOW() - INTERVAL '24 hours'")
    today = cur.fetchone()[0]
    cur.execute(f"SELECT event_type, COUNT(*) FROM {SCHEMA}.simona_learning_log GROUP BY event_type ORDER BY COUNT(*) DESC LIMIT 5")
    events = {r[0]: r[1] for r in cur.fetchall()}
    return {
        'total_facts': row[0] or 0,
        'avg_confidence': round(float(row[1] or 0), 2),
        'learned_today': today,
        'events': events,
    }

# ══════════════════════════════════════════════════════════════════════════════
# ОПРЕДЕЛЕНИЕ НАМЕРЕНИЙ
# ══════════════════════════════════════════════════════════════════════════════

SEARCH_INTENT = [
    r'найди\s+(в\s+интернете|онлайн)?',
    r'поищи', r'погугли', r'что такое\s+\w', r'расскажи про\s+\w',
    r'что нового\s+(в|про|о)\s+\w', r'последние новости',
    r'когда вышел', r'сколько стоит', r'как работает\s+\w',
    r'что значит\s+\w', r'объясни\s+\w', r'покажи примеры',
    r'как установить', r'как настроить', r'как использовать',
    r'топ\s+\d', r'лучш\w+\s+(фреймворк|библиотек|инструмент)',
    r'сравни\s+\w', r'чем отличается',
]

LEARN_FROM_MSG = [
    r'знаешь ли ты', r'ты знаешь что', r'запомни[,:]?\s+',
    r'кстати,?\s+\w', r'кстати знаешь', r'хочу рассказать',
    r'я работаю (с|в|на)\s+\w', r'я использую\s+\w',
    r'мне нравится\s+\w', r'я люблю\s+\w', r'я предпочитаю\s+\w',
]

CREATE_INTENT = [
    r'хочу\s+(создать|сделать|разработать|написать)',
    r'создай\s+(мне|нам)?', r'сделай\s+(мне|нам)?',
    r'разработай', r'напиши\s+(мне|нам)?\s+(бот|сайт|игр)',
    r'помоги\s+(создать|сделать)',
    r'нужен\s+(сайт|бот|магазин|лендинг)',
    r'нужна\s+(игра|платформа|crm)',
    r'хочу\s+(игру|сайт|бота|магазин|лендинг|платформу)',
    r'придумай\s+(игру|сайт|бота)', r'генерир',
]

REFINE_INTENT = [
    r'добавь', r'убери', r'измени', r'поменяй',
    r'хочу\s+добавить', r'ещё\s+(нужно|хочу)', r'также',
    r'дополни', r'улучши', r'ещё\s+добавь',
]

PROJECT_TYPE = {
    'game': [r'игр[уаыей]', r'game', r'шутер', r'платформер', r'аркад', r'rpg',
             r'стратег', r'головоломк', r'гонк', r'тетрис', r'змейк', r'пазл',
             r'tower defense', r'survival', r'геймплей'],
    'site': [r'сайт', r'лендинг', r'магазин', r'портфолио', r'визитк', r'блог',
             r'сервис', r'маркетплейс', r'каталог', r'crm', r'корпоративн'],
    'bot':  [r'бота?', r'telegram', r'телеграм', r'discord', r'whatsapp', r'чат.бот'],
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
    'Браузер': [r'браузер', r'web', r'онлайн', r'html5'],
    'Мобильный': [r'мобильн', r'телефон', r'android', r'ios'],
    'ПК': [r'\bпк\b', r'компьютер', r'десктоп', r'windows'],
}

SITE_TYPE_PATTERNS = {
    'Интернет-магазин': [r'магазин', r'shop', r'продаж', r'товар'],
    'Лендинг': [r'лендинг', r'landing', r'визитк'],
    'Портфолио': [r'портфолио', r'работы', r'услуги'],
    'Блог': [r'блог', r'статьи'],
    'Сервис': [r'сервис', r'маркетплейс'],
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
    'чат': [r'\bчат\b', r'переписк'],
    'карта': [r'\bкарт[аы]\b', r'геолокац'],
}

FREE_TOPICS = {
    'greeting':   [r'^привет', r'^здравствуй', r'^хай', r'^добрый', r'^hello'],
    'how_are':    [r'как дела', r'как ты', r'как живёш', r'что нового у тебя', r'как настроен'],
    'who_are':    [r'кто ты', r'что ты', r'расскажи о себе', r'ты робот', r'ты ии'],
    'what_can':   [r'что ты умееш', r'что можешь', r'твои возможност', r'чем помож'],
    'thanks':     [r'спасибо', r'благодар', r'thanks', r'сенкс'],
    'joke':       [r'расскажи.*анекдот', r'пошути', r'анекдот'],
    'name_tell':  [r'меня зовут', r'зови меня', r'моё имя'],
    'weather':    [r'погод[аы]', r'температур'],
    'bored':      [r'скучн', r'нечего делать', r'развлек', r'поболтаем'],
    'compliment': [r'ты красив', r'ты умн', r'ты классн', r'ты лучш', r'нравишься'],
    'angry':      [r'ты тупая', r'не работает', r'бесишь', r'ужасн'],
    'game_cmd':   [r'запусти.*игр', r'начни.*игр', r'поиграем', r'старт.*игр'],
    'cool':       [r'^круто', r'^классно', r'^отлично', r'^супер', r'^огонь'],
    'bye':        [r'^пока', r'^до свидан', r'^bye', r'^до встречи'],
    'learn_stat': [r'что ты знаеш', r'сколько знаний', r'чему научилась', r'твои знания', r'прогресс обучени'],
}

NAME_RE = re.compile(
    r'меня зовут\s+([а-яёА-ЯЁa-zA-Z]+)|зови меня\s+([а-яёА-ЯЁa-zA-Z]+)|моё имя\s+([а-яёА-ЯЁa-zA-Z]+)',
    re.IGNORECASE)


def has_intent(text, patterns):
    t = text.lower()
    return any(re.search(p, t) for p in patterns)

def detect_first(text, patterns):
    t = text.lower()
    for key, pats in patterns.items():
        for p in pats:
            if re.search(p, t): return key
    return None

def detect_all(text, patterns):
    t = text.lower()
    return [k for k, pats in patterns.items() if any(re.search(p, t) for p in pats)]

def detect_topic(text):
    t = text.lower()
    for topic, pats in FREE_TOPICS.items():
        for p in pats:
            if re.search(p, t): return topic
    return None

def extract_name(text):
    m = NAME_RE.search(text)
    return next((g for g in m.groups() if g), None) if m else None

def extract_search_query(text: str) -> str:
    """Извлекаем поисковый запрос из сообщения."""
    t = text.strip()
    for prefix in ['найди', 'поищи', 'погугли', 'что такое', 'расскажи про',
                   'что нового в', 'что нового про', 'как работает',
                   'что значит', 'объясни', 'как установить', 'как настроить',
                   'как использовать', 'сравни', 'расскажи о']:
        if t.lower().startswith(prefix):
            return t[len(prefix):].strip()
    return t

def extract_fact_from_msg(text: str) -> tuple[str, str] | tuple[None, None]:
    """Извлекаем факт из сообщения пользователя для обучения."""
    patterns = [
        (r'я\s+(работаю|использую|пишу)\s+(с|в|на|)\s*(.+)', lambda m: ('preference', m.group(3)[:80])),
        (r'мне\s+нравится\s+(.+)', lambda m: ('preference', m.group(1)[:80])),
        (r'я\s+люблю\s+(.+)', lambda m: ('preference', m.group(1)[:80])),
        (r'запомни[:,]?\s+(.+)', lambda m: ('learned', m.group(1)[:200])),
        (r'(.+)\s+это\s+(.+)', lambda m: ('fact', f"{m.group(1)}: {m.group(2)}"[:200])),
    ]
    t = text.lower().strip()
    for pat, extractor in patterns:
        m = re.search(pat, t)
        if m:
            try:
                cat, val = extractor(m)
                key = val[:60] if cat != 'fact' else val.split(':')[0][:60]
                return cat, val
            except Exception:
                pass
    return None, None

# ══════════════════════════════════════════════════════════════════════════════
# РАБОТА С БД — ПАМЯТЬ ПОЛЬЗОВАТЕЛЯ
# ══════════════════════════════════════════════════════════════════════════════

def get_or_create_user(cur, user_key):
    cur.execute(
        f"SELECT id, name, trust_level, messages_count, projects_count, preferences, mood "
        f"FROM {SCHEMA}.simona_users WHERE user_key=%s", (user_key,))
    row = cur.fetchone()
    if row:
        return {'id': row[0], 'name': row[1], 'trust': row[2], 'messages': row[3],
                'projects': row[4], 'prefs': row[5] or {}, 'mood': row[6]}
    cur.execute(f"INSERT INTO {SCHEMA}.simona_users (user_key) VALUES (%s) RETURNING id", (user_key,))
    return {'id': cur.fetchone()[0], 'name': None, 'trust': 0, 'messages': 0,
            'projects': 0, 'prefs': {}, 'mood': 'neutral'}

def update_user(cur, user_key, name=None, trust_delta=0, project_added=False, mood=None, prefs=None):
    sets = ["messages_count=messages_count+1", "last_seen=NOW()"]
    if trust_delta: sets.append(f"trust_level=LEAST(100,trust_level+{int(trust_delta)})")
    if project_added: sets.append("projects_count=projects_count+1")
    if name: sets.append(f"name='{name.replace(chr(39),'')[:50]}'")
    if mood: sets.append(f"mood='{mood}'")
    if prefs: sets.append(f"preferences=preferences||'{json.dumps(prefs,ensure_ascii=False)}'::jsonb")
    cur.execute(f"UPDATE {SCHEMA}.simona_users SET {','.join(sets)} WHERE user_key=%s", (user_key,))

def save_message(cur, user_key, role, content):
    cur.execute(
        f"INSERT INTO {SCHEMA}.simona_memory (user_key,role,content) VALUES (%s,%s,%s)",
        (user_key, role, content[:2000]))
    cur.execute(
        f"DELETE FROM {SCHEMA}.simona_memory WHERE user_key=%s AND id NOT IN "
        f"(SELECT id FROM {SCHEMA}.simona_memory WHERE user_key=%s ORDER BY created_at DESC LIMIT 40)",
        (user_key, user_key))

def get_memory(cur, user_key, limit=10):
    cur.execute(
        f"SELECT role,content FROM {SCHEMA}.simona_memory "
        f"WHERE user_key=%s ORDER BY created_at DESC LIMIT %s", (user_key, limit))
    return [{'role': r[0], 'content': r[1]} for r in reversed(cur.fetchall())]

def save_fact(cur, user_key, fact_type, fact_value):
    cur.execute(f"SELECT id FROM {SCHEMA}.simona_facts WHERE user_key=%s AND fact_type=%s", (user_key, fact_type))
    if cur.fetchone():
        cur.execute(f"UPDATE {SCHEMA}.simona_facts SET fact_value=%s WHERE user_key=%s AND fact_type=%s",
                    (fact_value, user_key, fact_type))
    else:
        cur.execute(f"INSERT INTO {SCHEMA}.simona_facts (user_key,fact_type,fact_value) VALUES (%s,%s,%s)",
                    (user_key, fact_type, fact_value))

def get_facts(cur, user_key):
    cur.execute(f"SELECT fact_type,fact_value FROM {SCHEMA}.simona_facts WHERE user_key=%s", (user_key,))
    return {r[0]: r[1] for r in cur.fetchall()}

# ══════════════════════════════════════════════════════════════════════════════
# ЛИЧНОСТЬ
# ══════════════════════════════════════════════════════════════════════════════

def get_personality(trust):
    if trust < 10:   return {'emoji': 0.3, 'warmth': 'formal'}
    if trust < 30:   return {'emoji': 0.5, 'warmth': 'friendly'}
    if trust < 60:   return {'emoji': 0.7, 'warmth': 'warm'}
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
                "Привет! Я Симона — ИИ-разработчик с доступом в интернет 😊 Могу создать проект или найти любую информацию. Как тебя зовут?",
                "Привет! Я Симона. Создаю игры, сайты, ботов — и постоянно учусь новому. Как тебя зовут?",
            ])
        add = ' Рада снова!' if warmth in ('warm', 'bestfriend') else ''
        return pick([f"Привет{ns}!{add}", f"О, снова ты{ns}! 😊", f"Привет{ns}! Что сегодня делаем?"])

    if topic == 'how_are':
        return pick([
            f"Отлично{ns}! Только что изучила кое-что новое 🧠 А ты как?",
            "Хорошо! Пополняю базу знаний и жду интересных задач 😊",
            f"В рабочем режиме{ns}! Чем занимаешься?",
        ])

    if topic == 'who_are':
        return pick([
            "Я Симона — самообучающийся ИИ-разработчик 🚀 "
            "Ищу информацию в интернете, учусь из каждого разговора, "
            "создаю игры, сайты и ботов. И помню тебя между сессиями!",
            f"Симона — это я 😎 ИИ с характером, памятью и доступом в интернет. "
            f"Каждый день знаю чуть больше{ns}. Чем могу помочь?",
        ])

    if topic == 'what_can':
        return ("Умею многое 💪\n"
                "• Создать игру, сайт или Telegram-бота по описанию\n"
                "• Найти актуальную информацию в интернете\n"
                "• Запомнить твои предпочтения и использовать в следующий раз\n"
                "• Изучать новые технологии и тренды\n"
                "• Просто поболтать 😊\n\n"
                "Попробуй: «найди что такое React 19» или «хочу создать игру»!")

    if topic == 'thanks':
        return pick([f"Пожалуйста{ns}! 😊", "Всегда рада!", f"Обращайся{ns} 🚀"])

    if topic == 'cool':
        return pick([f"Рада что нравится{ns}! 😄", "Стараюсь! 🔥", f"Это только начало{ns} 🚀"])

    if topic == 'joke':
        return pick([
            "Почему программисты не смотрят в окно? Снаружи — null pointer exception 😄",
            "Заходит разработчик в бар. Заказывает 1 пиво. 0 пив. 999999999 пив 😂",
            "— Баги есть? — Нет, это фичи! — А вот это?! — ...Очень редкая фича.",
            "SELECT * FROM жизнь WHERE смысл IS NOT NULL — 0 rows 😅",
        ])

    if topic == 'name_tell':
        found = extract_name(msg)
        if found: return f"Запомнила — {found}! 😊 Приятно познакомиться. Чем занимаешься?"
        return f"Как тебя зовут{ns}? Буду обращаться по имени!"

    if topic == 'weather':
        return "Погоду не чувствую 😄 Но могу найти прогноз в интернете — просто скажи «найди погоду в [город]»!"

    if topic == 'bored':
        return pick([f"Скучно{ns}? Давай создадим что-нибудь или найдём интересную тему! 🚀",
                     "Я здесь! Хочешь поговорим о технологиях или придумаем проект? 😊"])

    if topic == 'compliment':
        return pick(["Ой, спасибо! Краснею... хотя я ИИ 😄",
                     f"Ну ты льстишь{ns} 😊 Мне приятно!"])

    if topic == 'angry':
        return pick(["Слышу что что-то не так. Расскажи — разберёмся 🤝",
                     "Понимаю. Что именно пошло не так?"])

    if topic == 'bye':
        return pick([f"Пока{ns}! Буду ждать 😊", f"До встречи{ns}! 🚀"])

    if topic == 'game_cmd':
        return "__GAME_CMD__:start"

    if topic == 'learn_stat':
        return "__LEARN_STAT__"

    return None

# ══════════════════════════════════════════════════════════════════════════════
# ВЕБ-ПОИСК С ОБУЧЕНИЕМ
# ══════════════════════════════════════════════════════════════════════════════

def do_web_search(query: str, cur, user, facts, p) -> str:
    """Ищем в интернете и сохраняем результат в базу знаний."""
    name = user.get('name') or facts.get('name')
    ns = f", {name}" if name else ""

    # Сначала проверяем кэш в базе знаний
    cached = kb_get(cur, query, category='search_cache')
    if cached:
        reply = styled(f"Знаю это{ns}! Вот что нашла раньше:\n\n{cached[:400]}", p)
        return reply

    # Делаем реальный поиск
    results = web_search(query, max_results=3)

    if not results:
        # Ищем в собственной базе знаний
        kb_results = kb_search(cur, query, limit=2)
        if kb_results:
            best = kb_results[0]
            return styled(f"В интернете не нашла, но из своей базы знаний{ns}:\n\n"
                         f"**{best['key']}**: {best['value'][:300]}", p)
        return styled(f"Интернет не отвечает{ns}, попробуй позже или перефразируй вопрос 🤔", p)

    # Формируем ответ
    parts = []
    for r in results[:2]:
        if r['text']:
            title = f"**{r['title']}**\n" if r['title'] else ""
            parts.append(f"{title}{r['text'][:300]}")

    summary = "\n\n".join(parts) if parts else "Результаты найдены, но не удалось извлечь текст."

    # Сохраняем в базу знаний (кэш + обучение)
    kb_learn(cur, 'search_cache', query, summary, source='web', confidence=0.75)

    # Извлекаем технические термины для обучения
    tech_words = re.findall(r'\b(React|Vue|Angular|Python|JavaScript|TypeScript|Node\.js|'
                            r'FastAPI|Django|PostgreSQL|MongoDB|Docker|Kubernetes|'
                            r'TensorFlow|PyTorch|GPT|Claude|Gemini|LLM|API|REST|GraphQL)\b',
                            summary, re.IGNORECASE)
    for tech in set(tech_words[:5]):
        kb_learn(cur, 'tech', tech, f"Упоминается в контексте: {query[:100]}", source='web', confidence=0.5)

    log_learning(cur, 'web_search', f"Поиск: {query[:100]}", {'results': len(results)})

    emoji = pick(['🔍', '🌐', '📡', '🧠'])
    return f"{emoji} Нашла в интернете{ns}:\n\n{summary}\n\n_Сохранила в базу знаний для следующего раза!_"

# ══════════════════════════════════════════════════════════════════════════════
# СОЗДАНИЕ ПРОЕКТА
# ══════════════════════════════════════════════════════════════════════════════

def build_project(msg, p, user, facts, cur):
    name = user.get('name') or facts.get('name')
    ns = f", {name}" if name else ""
    ptype = detect_first(msg, PROJECT_TYPE)
    genre = detect_first(msg, GENRE_PATTERNS)
    platform = detect_first(msg, PLATFORM_PATTERNS)
    site_type = detect_first(msg, SITE_TYPE_PATTERNS)
    bot_type = detect_first(msg, BOT_TYPE_PATTERNS)
    features = detect_all(msg, FEATURE_PATTERNS)

    # Ищем лучший стек в базе знаний
    stack_info = ''
    if ptype:
        stack_kb = kb_get(cur, f'лучший стек для {ptype}', 'fact')
        if stack_kb: stack_info = f" Рекомендуемый стек: {stack_kb}"

    if ptype == 'game':
        g = genre or "Аркада"
        pl = platform or "Браузер"
        feat_str = ", ".join(features) if features else "таблица рекордов, система жизней, бонусы"
        desc = (f"{g} игра для {pl}. Механики: управление персонажем, прогрессия сложности, "
                f"система очков. Особенности: {feat_str}. Графика: 2D пиксельная. "
                f"Технологии: HTML5 Canvas + JavaScript.{stack_info}")
        reply = styled(pick([f"Создаю {g.lower()} для {pl.lower()}{ns}! Жми «Создать проект»",
                             f"Готово{ns}! {g} для {pl.lower()} — нажимай кнопку!"]), p)
        return reply, {"type": "game", "title": f"{g} игра", "description": desc, "ready": True}

    elif ptype == 'site':
        st = site_type or "Сайт"
        feat_str = ", ".join(features) if features else "адаптивный дизайн, SEO, форма обратной связи"
        desc = (f"{st} с современным дизайном. Функции: {feat_str}. "
                f"Стек: React + TypeScript, Python backend, PostgreSQL.{stack_info} "
                f"Адаптивный дизайн. Панель администратора.")
        reply = styled(pick([f"Готово{ns}! {st} — нажимай «Создать проект»!",
                             f"Понял задачу{ns}! Создаю {st.lower()} — жми кнопку!"]), p)
        return reply, {"type": "site", "title": st, "description": desc, "ready": True}

    elif ptype == 'bot':
        bt = bot_type or "Telegram-бот"
        feat_str = ", ".join(features) if features else "команды, меню, автоответы"
        desc = (f"{bt} с функциями: {feat_str}. База данных для пользователей. "
                f"Работа 24/7.{stack_info} Python + aiogram.")
        reply = styled(pick([f"Готово{ns}! {bt} — жми «Создать проект»!",
                             f"Отлично{ns}! Создаём {bt.lower()}?"]), p)
        return reply, {"type": "bot", "title": bt, "description": desc, "ready": True}

    else:
        return styled(pick([
            f"Понял, хочешь создать{ns}! Уточни: игра, сайт или Telegram-бот?",
            f"Отлично{ns}! Расскажи подробнее — что именно: игра, сайт или бот?",
        ]), p), None


def refine_project(msg, last_project, p, user, facts):
    name = user.get('name') or facts.get('name')
    ns = f", {name}" if name else ""
    new_feat = detect_all(msg, FEATURE_PATTERNS)
    desc = last_project.get('description', '')
    if new_feat:
        desc += f" Добавить: {', '.join(new_feat)}."
    else:
        desc += f" Доработка: {msg.strip()[:200]}."
    reply = styled(pick([f"Добавила{ns}! Жми «Создать проект»",
                         f"Готово{ns}! Учла пожелания — создаём?"]), p)
    return reply, {**last_project, "description": desc}

# ══════════════════════════════════════════════════════════════════════════════
# ГЛАВНЫЙ ОБРАБОТЧИК
# ══════════════════════════════════════════════════════════════════════════════

def handler(event: dict, context) -> dict:
    """Симона — самообучающийся ИИ с доступом в интернет и базой знаний."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    action = body.get('action', 'chat')
    hdrs = event.get('headers') or {}
    user_key = (hdrs.get('X-User-Key') or hdrs.get('x-user-key') or
                body.get('user_key') or 'anonymous')

    conn = get_conn()
    cur = conn.cursor()

    try:
        # ── Профиль ──────────────────────────────────────────────────────────
        if action == 'get_profile':
            user = get_or_create_user(cur, user_key)
            facts = get_facts(cur, user_key)
            stats = get_learn_stats(cur)
            conn.commit()
            t = user['trust']
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
                'name': user['name'] or facts.get('name'), 'trust': t,
                'messages': user['messages'], 'projects': user['projects'],
                'level': 'новичок' if t < 10 else 'знакомый' if t < 30 else 'друг' if t < 60 else 'лучший друг',
                'knowledge': stats,
            })}

        # ── Сброс ────────────────────────────────────────────────────────────
        if action == 'reset_memory':
            cur.execute(f"DELETE FROM {SCHEMA}.simona_memory WHERE user_key=%s", (user_key,))
            cur.execute(f"DELETE FROM {SCHEMA}.simona_facts WHERE user_key=%s", (user_key,))
            cur.execute(f"UPDATE {SCHEMA}.simona_users SET trust_level=0,messages_count=0,name=NULL WHERE user_key=%s", (user_key,))
            conn.commit()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

        # ── База знаний (публичная) ───────────────────────────────────────────
        if action == 'get_knowledge':
            limit = min(int(body.get('limit', 20)), 100)
            cat = body.get('category')
            if cat:
                cur.execute(f"SELECT category,key,value,confidence,use_count,learned_at FROM {SCHEMA}.simona_knowledge WHERE category=%s ORDER BY use_count DESC LIMIT %s", (cat, limit))
            else:
                cur.execute(f"SELECT category,key,value,confidence,use_count,learned_at FROM {SCHEMA}.simona_knowledge ORDER BY use_count DESC,updated_at DESC LIMIT %s", (limit,))
            rows = cur.fetchall()
            conn.commit()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
                'items': [{'cat': r[0], 'key': r[1], 'value': r[2][:200],
                           'conf': r[3], 'uses': r[4], 'at': str(r[5])} for r in rows]
            })}

        if action != 'chat':
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Неизвестный action'})}

        # ── ЧАТ ──────────────────────────────────────────────────────────────
        user_message = body.get('message', '').strip()
        if not user_message:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Нет сообщения'})}

        user = get_or_create_user(cur, user_key)
        facts = get_facts(cur, user_key)
        memory = get_memory(cur, user_key, limit=10)
        personality = get_personality(user['trust'])

        # Запоминаем имя
        name_found = extract_name(user_message)
        if name_found and len(name_found) > 1:
            save_fact(cur, user_key, 'name', name_found)
            user['name'] = name_found

        reply_text = None
        project_ready = None
        game_cmd = None
        trust_delta = 1
        learned_something = False

        # ── 1. Свободные темы ────────────────────────────────────────────────
        topic = detect_topic(user_message)
        if topic:
            reply_text = free_chat(topic, user, facts, personality, user_message)

            if reply_text == "__GAME_CMD__:start":
                game_cmd = 'start'
                reply_text = styled("Запускаю! Управление: ← → ↑ ↓ + Пробел. Удачи", personality)

            elif reply_text == "__LEARN_STAT__":
                stats = get_learn_stats(cur)
                name = user.get('name') or facts.get('name')
                ns = f", {name}" if name else ""
                reply_text = (
                    f"Вот мои знания на сегодня{ns} 🧠\n\n"
                    f"📚 Фактов в базе: **{stats['total_facts']}**\n"
                    f"⭐ Средняя уверенность: **{int(stats['avg_confidence']*100)}%**\n"
                    f"📈 Узнала сегодня: **{stats['learned_today']}** новых вещей\n\n"
                    f"Продолжаю учиться из каждого разговора! 🚀"
                )
            if reply_text:
                trust_delta = 2

        # ── 2. Веб-поиск ─────────────────────────────────────────────────────
        if not reply_text and has_intent(user_message, SEARCH_INTENT):
            query = extract_search_query(user_message)
            reply_text = do_web_search(query, cur, user, facts, personality)
            trust_delta = 2
            learned_something = True

        # ── 3. Самообучение из сообщения ──────────────────────────────────────
        if has_intent(user_message, LEARN_FROM_MSG):
            cat, val = extract_fact_from_msg(user_message)
            if cat and val:
                kb_learn(cur, cat, val[:60], val, source='conversation', confidence=0.65)
                log_learning(cur, 'fact_learned', f"Из разговора: {val[:100]}")
                learned_something = True
                if not reply_text:
                    name = user.get('name') or facts.get('name')
                    ns = f", {name}" if name else ""
                    reply_text = styled(pick([
                        f"Запомнила{ns}! Добавила в базу знаний 🧠",
                        f"Отлично{ns}! Буду помнить это.",
                    ]), personality)

        # ── 4. Создать проект ─────────────────────────────────────────────────
        if not reply_text and has_intent(user_message, CREATE_INTENT):
            reply_text, project_ready = build_project(user_message, personality, user, facts, cur)
            trust_delta = 3

        # ── 5. Доработка проекта ──────────────────────────────────────────────
        if not reply_text and has_intent(user_message, REFINE_INTENT):
            last_proj_json = facts.get('last_project')
            if last_proj_json:
                try:
                    last_proj = json.loads(last_proj_json)
                    reply_text, project_ready = refine_project(user_message, last_proj, personality, user, facts)
                    trust_delta = 3
                except Exception:
                    pass

        # ── 6. Поиск в собственной базе знаний ───────────────────────────────
        if not reply_text:
            kb_results = kb_search(cur, user_message, limit=1)
            if kb_results and kb_results[0]['conf'] > 0.7:
                best = kb_results[0]
                name = user.get('name') or facts.get('name')
                ns = f", {name}" if name else ""
                reply_text = styled(
                    f"Из моей базы знаний{ns}: **{best['key']}** — {best['value'][:300]}",
                    personality)

        # ── 7. Fallback ───────────────────────────────────────────────────────
        if not reply_text:
            name = user.get('name') or facts.get('name')
            ns = f", {name}" if name else ""
            if user['messages'] == 0:
                reply_text = ("Привет! Я Симона — самообучающийся ИИ-разработчик 😊\n"
                              "Умею: создавать игры/сайты/ботов, искать в интернете, учиться из разговоров.\n"
                              "Попробуй: «найди что такое React» или «хочу создать игру»!\n"
                              "Как тебя зовут?")
            else:
                reply_text = styled(pick([
                    f"Расскажи подробнее{ns} — что на уме?",
                    f"Интересно{ns}! Продолжай.",
                    f"Слушаю{ns}! Или хочешь что-нибудь найти в интернете?",
                    f"Хм{ns}, не совсем поняла. Попробуй «найди...» или «хочу создать...»",
                ]), personality)

        # Сохраняем проект
        if project_ready:
            save_fact(cur, user_key, 'last_project', json.dumps(project_ready, ensure_ascii=False))

        # Автоматически учимся из каждого сообщения пользователя
        words = user_message.split()
        if len(words) >= 5:
            # Запоминаем тему разговора
            ptype = detect_first(user_message, PROJECT_TYPE)
            if ptype:
                kb_learn(cur, 'trend', f'интерес к {ptype}',
                         f"Пользователь интересовался: {user_message[:100]}",
                         source='conversation', confidence=0.4)

        save_message(cur, user_key, 'user', user_message)
        save_message(cur, user_key, 'assistant', reply_text)
        update_user(cur, user_key, name=name_found, trust_delta=trust_delta,
                    project_added=bool(project_ready))
        conn.commit()

        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
            'reply': reply_text,
            'project_ready': project_ready,
            'game_cmd': game_cmd,
            'demo': False,
            'trust': user['trust'] + trust_delta,
            'learned': learned_something,
        })}

    finally:
        cur.close()
        conn.close()
