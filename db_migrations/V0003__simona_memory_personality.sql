-- Память Симоны: профиль пользователя
CREATE TABLE IF NOT EXISTS t_p81816167_go_site_ai_game_dev.simona_users (
    id SERIAL PRIMARY KEY,
    user_key VARCHAR(64) UNIQUE NOT NULL,  -- localStorage uid
    name VARCHAR(100),                      -- как зовут пользователя
    trust_level INTEGER DEFAULT 0,          -- 0-100: уровень доверия
    messages_count INTEGER DEFAULT 0,       -- всего сообщений
    projects_count INTEGER DEFAULT 0,       -- создано проектов
    preferences JSONB DEFAULT '{}',         -- предпочтения (жанры, стили)
    mood VARCHAR(20) DEFAULT 'neutral',     -- текущее настроение симоны
    last_seen TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- История разговоров (последние N сообщений на пользователя)
CREATE TABLE IF NOT EXISTS t_p81816167_go_site_ai_game_dev.simona_memory (
    id SERIAL PRIMARY KEY,
    user_key VARCHAR(64) NOT NULL,
    role VARCHAR(10) NOT NULL,   -- user | assistant
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_simona_memory_user_key
    ON t_p81816167_go_site_ai_game_dev.simona_memory(user_key, created_at DESC);

-- Факты о пользователе (имя, интересы, упомянутые проекты)
CREATE TABLE IF NOT EXISTS t_p81816167_go_site_ai_game_dev.simona_facts (
    id SERIAL PRIMARY KEY,
    user_key VARCHAR(64) NOT NULL,
    fact_type VARCHAR(40) NOT NULL,  -- name | interest | project | hobby
    fact_value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
