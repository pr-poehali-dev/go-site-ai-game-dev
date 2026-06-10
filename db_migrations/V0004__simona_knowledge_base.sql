-- База знаний Симоны
CREATE TABLE IF NOT EXISTS t_p81816167_go_site_ai_game_dev.simona_knowledge (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,      -- tech | fact | trend | learned | search_cache
    key VARCHAR(200) NOT NULL,          -- термин / вопрос / тема
    value TEXT NOT NULL,                -- что Симона знает об этом
    source VARCHAR(100) DEFAULT 'conversation', -- conversation | web | docs | self
    confidence FLOAT DEFAULT 0.5,       -- уверенность 0.0-1.0
    use_count INTEGER DEFAULT 1,        -- сколько раз использовалось
    learned_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(category, key)
);

CREATE INDEX IF NOT EXISTS idx_simona_knowledge_cat
    ON t_p81816167_go_site_ai_game_dev.simona_knowledge(category, use_count DESC);

-- Лог самообучения — что Симона изучила и когда
CREATE TABLE IF NOT EXISTS t_p81816167_go_site_ai_game_dev.simona_learning_log (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(40) NOT NULL,    -- web_search | fact_learned | skill_improved
    description TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Начальная база знаний о технологиях
INSERT INTO t_p81816167_go_site_ai_game_dev.simona_knowledge
    (category, key, value, source, confidence) VALUES
('tech', 'React', 'JavaScript библиотека для UI. Актуальная версия React 19. Использует хуки, компоненты, JSX. Лучший выбор для современных SPA.', 'docs', 0.95),
('tech', 'Python', 'Язык программирования для бэкенда, ИИ, автоматизации. Версия 3.12. Популярен для FastAPI, Django, ML.', 'docs', 0.95),
('tech', 'PostgreSQL', 'Мощная реляционная БД. Поддерживает JSONB, полнотекстовый поиск, расширения. Версия 16.', 'docs', 0.95),
('tech', 'Telegram Bot API', 'API для создания ботов в Telegram. Python библиотека aiogram 3.x — самая популярная. Поддерживает inline-кнопки, FSM, middleware.', 'docs', 0.9),
('tech', 'HTML5 Canvas', '2D/3D рисование в браузере. Используется для игр, визуализаций. Работает с requestAnimationFrame для плавной анимации.', 'docs', 0.9),
('trend', 'ИИ в разработке 2024', 'Главный тренд — ИИ-ассистенты в коде (Copilot, Cursor). RAG-системы, агенты, мультимодальные модели.', 'web', 0.85),
('trend', 'Мобильные игры', 'Рынок мобильных игр $90B+. Популярны гиперказуальные игры, battle royale, idle-игры. Unity и Godot — главные движки.', 'web', 0.8),
('fact', 'лучший стек для сайта', 'React + TypeScript для фронта, FastAPI или Node.js для бэка, PostgreSQL для БД, S3 для файлов.', 'self', 0.9),
('fact', 'лучший стек для игры', 'Браузер: HTML5 Canvas + JS/TS. Мобильный: Unity (C#) или Godot (GDScript). ПК: Unity/Unreal Engine.', 'self', 0.9),
('fact', 'лучший стек для бота', 'Telegram: Python + aiogram 3.x. Discord: discord.py или discord.js. WhatsApp: через Twilio API.', 'self', 0.9)
ON CONFLICT (category, key) DO NOTHING;
