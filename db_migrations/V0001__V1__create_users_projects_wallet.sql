
CREATE TABLE IF NOT EXISTS t_p81816167_go_site_ai_game_dev.users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    role VARCHAR(20) DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS t_p81816167_go_site_ai_game_dev.sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES t_p81816167_go_site_ai_game_dev.users(id),
    token VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS t_p81816167_go_site_ai_game_dev.subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES t_p81816167_go_site_ai_game_dev.users(id),
    plan VARCHAR(20) NOT NULL DEFAULT 'starter',
    status VARCHAR(20) DEFAULT 'active',
    started_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    amount INTEGER NOT NULL DEFAULT 990
);

CREATE TABLE IF NOT EXISTS t_p81816167_go_site_ai_game_dev.game_projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES t_p81816167_go_site_ai_game_dev.users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    genre VARCHAR(50),
    engine VARCHAR(50),
    platform VARCHAR(50),
    graphics_style VARCHAR(50),
    status VARCHAR(20) DEFAULT 'draft',
    progress INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p81816167_go_site_ai_game_dev.wallet (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES t_p81816167_go_site_ai_game_dev.users(id) UNIQUE,
    balance INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p81816167_go_site_ai_game_dev.wallet_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES t_p81816167_go_site_ai_game_dev.users(id),
    amount INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON t_p81816167_go_site_ai_game_dev.sessions(token);
CREATE INDEX IF NOT EXISTS idx_game_projects_user ON t_p81816167_go_site_ai_game_dev.game_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON t_p81816167_go_site_ai_game_dev.wallet_transactions(user_id);
