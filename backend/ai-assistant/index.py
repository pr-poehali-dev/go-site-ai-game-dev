"""
ИИ-ассистент Симона — умная встроенная логика без внешних API.
Распознаёт намерения, ведёт диалог, генерирует описания проектов.
action: chat
"""
import json
import os
import re
import random

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
}

# ── Паттерны распознавания ─────────────────────────────────────────────────

PATTERNS = {
    'game': [
        r'игр[уаыей]', r'game', r'шутер', r'платформер', r'аркад', r'rpg', r'стратег',
        r'головоломк', r'гонк', r'файтинг', r'квест', r'minecraft', r'terraria',
        r'clash', r'тетрис', r'змейк', r'пазл', r'tower defense', r'survival',
        r'мобильн.*игр', r'браузерн.*игр', r'многопользовательск', r'геймплей',
    ],
    'site': [
        r'сайт', r'лендинг', r'магазин', r'интернет.магазин', r'портфолио',
        r'визитк', r'блог', r'форум', r'сервис', r'платформ', r'маркетплейс',
        r'каталог', r'агрегатор', r'доска объявлений', r'веб.приложен',
        r'crm', r'erp', r'dashboard', r'личный кабинет', r'корпоративн',
    ],
    'bot': [
        r'бот', r'bot', r'telegram', r'телеграм', r'discord', r'whatsapp',
        r'автоответ', r'чат.бот', r'воронк', r'рассылк', r'уведомлен.*telegram',
    ],
}

GENRE_PATTERNS = {
    'Шутер':        [r'шутер', r'стрелялк', r'shooter', r'fps', r'tps'],
    'Платформер':   [r'платформер', r'platformer', r'прыгалк', r'mario'],
    'RPG':          [r'\brpg\b', r'ролевая', r'прокачк', r'уровн.*персонаж'],
    'Стратегия':    [r'стратег', r'strategy', r'rts', r'строительств'],
    'Аркада':       [r'аркад', r'arcade', r'тетрис', r'змейк', r'casual'],
    'Головоломка':  [r'головоломк', r'puzzle', r'логик.*игр'],
    'Гонки':        [r'гонк', r'racing', r'машин.*игр'],
    'Tower Defense':[r'tower defense', r'защит.*башн'],
    'Файтинг':      [r'файтинг', r'fighting', r'бои', r'драки'],
    'Survival':     [r'survival', r'выживан', r'крафт'],
}

PLATFORM_PATTERNS = {
    'Браузер':          [r'браузер', r'web', r'онлайн', r'html5'],
    'Мобильный':        [r'мобильн', r'телефон', r'android', r'ios', r'смартфон'],
    'ПК':               [r'\bпк\b', r'компьютер', r'десктоп', r'windows'],
    'Мультиплатформа':  [r'все платформ', r'везде', r'мультиплатформ'],
}

STYLE_PATTERNS = {
    'Пиксельная': [r'пиксел', r'pixel', r'ретро', r'8.?бит', r'16.?бит'],
    '2D':         [r'\b2d\b', r'двумерн'],
    '3D':         [r'\b3d\b', r'трёхмерн', r'объёмн'],
    'Мультяшная': [r'мультяшн', r'cartoon', r'аниме'],
}

SITE_TYPE_PATTERNS = {
    'Интернет-магазин': [r'магазин', r'shop', r'store', r'продаж', r'товар'],
    'Лендинг':          [r'лендинг', r'landing', r'одностраничн', r'визитк'],
    'Портфолио':        [r'портфолио', r'portfolio', r'работы', r'услуги'],
    'Блог':             [r'блог', r'blog', r'статьи', r'публикаци'],
    'Сервис':           [r'сервис', r'платформ', r'маркетплейс', r'агрегатор'],
    'CRM/Dashboard':    [r'crm', r'dashboard', r'панель', r'аналитик'],
    'Корпоративный':    [r'корпоратив', r'компани', r'бизнес.*сайт'],
}

BOT_TYPE_PATTERNS = {
    'Telegram-бот':     [r'telegram', r'телеграм'],
    'Discord-бот':      [r'discord', r'дискорд'],
    'WhatsApp-бот':     [r'whatsapp', r'вотсап'],
    'Чат-бот для сайта':[r'чат.бот', r'для сайта', r'виджет'],
}

FEATURE_PATTERNS = {
    'авторизация':   [r'авториз', r'регистраци', r'вход', r'аккаунт'],
    'оплата':        [r'оплат', r'платёж', r'покупк', r'корзин'],
    'база данных':   [r'база', r'сохранен', r'история', r'профил'],
    'мультиплеер':   [r'мультиплеер', r'multiplayer', r'несколько игроков'],
    'ИИ-противники': [r'ии.против', r'умные враги', r'нейросет'],
    'лидерборд':     [r'лидерборд', r'рейтинг', r'таблица рекордов'],
    'уведомления':   [r'уведомлен', r'push', r'рассылк'],
    'каталог':       [r'каталог', r'список товар', r'фильтр'],
    'аналитика':     [r'аналитик', r'статистик', r'отчёт'],
}


def detect(text: str, patterns: dict) -> list:
    text_l = text.lower()
    found = []
    for key, pats in patterns.items():
        for p in pats:
            if re.search(p, text_l):
                found.append(key)
                break
    return found


def detect_first(text: str, patterns: dict):
    res = detect(text, patterns)
    return res[0] if res else None


def pick(arr: list) -> str:
    return random.choice(arr)


def extract_context(history: list) -> dict:
    full_text = ' '.join(m.get('content', '') for m in history if m.get('role') == 'user')
    return {
        'type':      detect_first(full_text, PATTERNS),
        'genre':     detect_first(full_text, GENRE_PATTERNS),
        'platform':  detect_first(full_text, PLATFORM_PATTERNS),
        'style':     detect_first(full_text, STYLE_PATTERNS),
        'site_type': detect_first(full_text, SITE_TYPE_PATTERNS),
        'bot_type':  detect_first(full_text, BOT_TYPE_PATTERNS),
        'features':  detect(full_text, FEATURE_PATTERNS),
        'raw':       full_text,
    }


# ── Генераторы ответов ─────────────────────────────────────────────────────

def reply_game(ctx, turn):
    genre = ctx.get('genre')
    platform = ctx.get('platform')
    style = ctx.get('style')
    features = ctx.get('features', [])

    if turn == 1:
        if genre:
            return pick([
                f"Отличный выбор — {genre}! Для какой платформы делаем: браузер, мобильный или ПК?",
                f"{genre} — моя любимая тема 😄 Это будет одиночная игра или с мультиплеером?",
                f"{genre} — огонь! В каком стиле графика: пиксельная, 2D мультяшная или 3D?",
            ]), None
        return pick([
            "Игра — это моё! Какой жанр нравится: шутер, платформер, RPG, стратегия или аркада?",
            "Интересно! Это экшн, головоломка, гонки или что-то своё придумал?",
            "Классно! Ориентируемся на казуальных игроков или хардкор?",
        ]), None

    if turn == 2:
        if not platform:
            return pick([
                "Понял! Теперь про платформу — браузер, мобильный (Android/iOS) или ПК?",
                "А где будут играть — в браузере, на телефоне или на компьютере?",
            ]), None
        if not style:
            return pick([
                f"Для {platform} отлично! Стиль графики — пиксельный ретро, 2D мультяшный или 3D?",
                "Последнее — стиль: пиксельная, 2D, 3D или реалистичная графика?",
            ]), None

    g = genre or "Аркада"
    p = platform or "Браузер"
    s = style or "2D"
    feat = ", ".join(features) if features else "таблица рекордов, система бонусов"
    title = f"{g}: {s} игра для {p}"
    desc = (
        f"{s} игра в жанре {g} для платформы {p}. "
        f"Механики: управление персонажем, прогрессия сложности, система очков. "
        f"Дополнительно: {feat}. "
        f"Технологии: HTML5 Canvas + JavaScript для браузера, React Native для мобильного. "
        f"Адаптивное управление под мышь, клавиатуру и тач."
    )
    return pick([
        f"Всё ясно — делаем {s.lower()} {g.lower()} для {p.lower()}! Жми «Создать проект» 🚀",
        f"Отлично, план готов! {g} с {s.lower()} графикой для {p.lower()} — создаём?",
        f"Супер, данных хватает! Нажимай кнопку — погнали!",
    ]), {"type": "game", "title": title, "description": desc, "ready": True}


def reply_site(ctx, turn):
    site_type = ctx.get('site_type')
    features = ctx.get('features', [])

    if turn == 1:
        if site_type:
            return pick([
                f"{site_type} — хороший выбор! Для какой тематики или ниши?",
                f"Понятно, {site_type.lower()}. Нужны особые функции — авторизация, оплата, личный кабинет?",
            ]), None
        return pick([
            "Сайт — отлично! Это лендинг, интернет-магазин, портфолио, блог или сервис?",
            "Какой тип сайта: продающий, информационный или полноценный веб-сервис?",
        ]), None

    if turn == 2:
        return pick([
            "Понятно! Нужна ли авторизация пользователей и онлайн-оплата?",
            "Хорошо! Кто целевая аудитория — бизнес (B2B) или обычные люди (B2C)?",
            "Отлично! Нужен ли мобильный дизайн и многоязычность?",
        ]), None

    st = site_type or "Сайт"
    feat = ", ".join(features) if features else "адаптивный дизайн, SEO-оптимизация"
    desc = (
        f"{st} с современным дизайном. "
        f"Функции: {feat}. "
        f"Стек: React + TypeScript (фронтенд), Python (бэкенд), PostgreSQL (база данных). "
        f"Полностью адаптивный под мобильные. "
        f"Панель администратора для управления контентом."
    )
    return pick([
        f"Готово! Собрала всё для {st.lower()}. Жми «Создать проект»! 💪",
        f"Отлично, план готов! {st} со всеми нужными функциями — создаём?",
        f"Всё понятно — нажимай кнопку, запускаю генерацию!",
    ]), {"type": "site", "title": st, "description": desc, "ready": True}


def reply_bot(ctx, turn):
    bot_type = ctx.get('bot_type')
    features = ctx.get('features', [])

    if turn == 1:
        if bot_type:
            return pick([
                f"{bot_type} — знаю такие! Что должен делать: отвечать на вопросы, принимать заявки или делать рассылки?",
                f"Отлично, {bot_type.lower()}! Для какой задачи — поддержка, продажи или автоматизация?",
            ]), None
        return pick([
            "Бот — хорошо! Для какой платформы: Telegram, Discord или WhatsApp?",
            "Это Telegram-бот, Discord или встроенный чат-бот для сайта?",
        ]), None

    if turn == 2:
        return pick([
            "Понял! Нужна ли база данных для хранения пользователей и истории диалогов?",
            "Хорошо! Бот будет работать 24/7 на сервере или только по расписанию?",
        ]), None

    bt = bot_type or "Telegram-бот"
    feat = ", ".join(features) if features else "команды, кнопки-меню, ответы на запросы"
    desc = (
        f"{bt} с функциями: {feat}. "
        f"База данных для пользователей и сессий. "
        f"Административная панель управления. "
        f"Деплой на сервер, работа 24/7. "
        f"Python + aiogram (для Telegram) или discord.py (для Discord)."
    )
    return pick([
        f"Готово! {bt} со всем нужным — жми «Создать проект» 🤖",
        f"Отлично, собрала полное ТЗ для {bt.lower()} — создаём?",
    ]), {"type": "bot", "title": bt, "description": desc, "ready": True}


# ── Главный обработчик ─────────────────────────────────────────────────────

GREETING_RE = [r'привет', r'здравствуй', r'хай', r'добрый', r'hello']
THANKS_RE = [r'спасибо', r'благодар', r'thanks', r'супер', r'отлично', r'круто']

GREETING_REPLIES = [
    "Привет! Я Симона — твой личный ИИ-разработчик 😊 Что хочешь создать: игру, сайт или бота?",
    "Привет-привет! Симона на связи. Игра, сайт или бот — что делаем?",
    "Привет! Готова к работе. Описывай идею — разберёмся!",
]
THANKS_REPLIES = [
    "Пожалуйста! Если что — я здесь 😊",
    "Всегда рада! Есть ещё идеи?",
    "Обращайся! Симона на связи 🚀",
]
UNKNOWN_REPLIES = [
    "Расскажи подробнее — это игра, сайт или Telegram-бот?",
    "Интересно! Уточни — что именно хочешь создать?",
    "Не совсем поняла 😅 Опиши идею своими словами — разберёмся вместе!",
    "Звучит интригующе! Это ближе к игре, сайту или боту?",
]


def handler(event: dict, context) -> dict:
    """Симона — умный локальный ИИ-ассистент без внешних API."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    if body.get('action', 'chat') != 'chat':
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Неизвестный action'})}

    history = body.get('history', [])
    user_message = body.get('message', '').strip()
    if not user_message:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Нет сообщения'})}

    msg_l = user_message.lower()

    # Приветствие в начале диалога
    if len(history) == 0 and any(re.search(p, msg_l) for p in GREETING_RE):
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(
            {'reply': pick(GREETING_REPLIES), 'project_ready': None, 'demo': False}
        )}

    # Благодарность
    if any(re.search(p, msg_l) for p in THANKS_RE):
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(
            {'reply': pick(THANKS_REPLIES), 'project_ready': None, 'demo': False}
        )}

    # Контекст всего диалога
    full_history = history + [{'role': 'user', 'content': user_message}]
    ctx = extract_context(full_history)
    project_type = ctx.get('type')

    # Номер хода (сколько ответов Симоны уже было)
    turn = sum(1 for m in history if m.get('role') == 'assistant') + 1

    reply, project_ready = None, None

    if project_type == 'game':
        reply, project_ready = reply_game(ctx, turn)
    elif project_type == 'site':
        reply, project_ready = reply_site(ctx, turn)
    elif project_type == 'bot':
        reply, project_ready = reply_bot(ctx, turn)
    else:
        reply = pick(GREETING_REPLIES if len(history) == 0 else UNKNOWN_REPLIES)

    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
        'reply': reply,
        'project_ready': project_ready,
        'demo': False,
    })}
