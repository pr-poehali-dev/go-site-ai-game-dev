
-- ИИ-анализ проектов (результат GPT)
ALTER TABLE t_p81816167_go_site_ai_game_dev.game_projects
  ADD COLUMN IF NOT EXISTS ai_analysis JSONB,
  ADD COLUMN IF NOT EXISTS ai_mechanics TEXT[],
  ADD COLUMN IF NOT EXISTS ai_genre VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ai_difficulty VARCHAR(20);

-- Данные самообучающегося ИИ-агента (нейросеть в браузере)
CREATE TABLE IF NOT EXISTS t_p81816167_go_site_ai_game_dev.ai_agents (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES t_p81816167_go_site_ai_game_dev.game_projects(id),
  agent_name VARCHAR(100) NOT NULL DEFAULT 'NEXUS-AI',
  generation INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  best_score INTEGER DEFAULT 0,
  avg_score FLOAT DEFAULT 0,
  win_rate FLOAT DEFAULT 0,
  weights JSONB,
  fitness_history JSONB DEFAULT '[]',
  last_trained_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Сессии обучения ИИ (логи матчей)
CREATE TABLE IF NOT EXISTS t_p81816167_go_site_ai_game_dev.ai_sessions (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER REFERENCES t_p81816167_go_site_ai_game_dev.ai_agents(id),
  score INTEGER DEFAULT 0,
  waves_reached INTEGER DEFAULT 0,
  survival_time INTEGER DEFAULT 0,
  actions_taken INTEGER DEFAULT 0,
  reward FLOAT DEFAULT 0,
  played_at TIMESTAMP DEFAULT NOW()
);

-- Глобальный лидерборд (люди + ИИ)
CREATE TABLE IF NOT EXISTS t_p81816167_go_site_ai_game_dev.leaderboard (
  id SERIAL PRIMARY KEY,
  player_name VARCHAR(100) NOT NULL,
  player_type VARCHAR(10) DEFAULT 'human',
  score INTEGER DEFAULT 0,
  waves INTEGER DEFAULT 0,
  game_mode VARCHAR(50) DEFAULT 'cosmic_raiders',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON t_p81816167_go_site_ai_game_dev.leaderboard(score DESC);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_agent ON t_p81816167_go_site_ai_game_dev.ai_sessions(agent_id);
