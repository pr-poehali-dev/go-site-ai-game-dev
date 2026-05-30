"""
Самообучающийся ИИ-агент для игры.
Хранит веса нейросети, тренирует между сессиями, ведёт лидерборд.
action: get_agent | save_session | get_leaderboard | save_score | evolve
"""
import json
import os
import math
import random
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
            WHERE s.token = %s AND s.expires_at > NOW()""", (token,)
    )
    return cur.fetchone()

# ── Простая нейросеть (веса в JSON) ──────────────────────────────────────────
def init_weights(layers: list) -> dict:
    """Инициализация случайных весов нейросети."""
    weights = {'layers': layers, 'W': [], 'b': []}
    for i in range(len(layers) - 1):
        W = [[random.gauss(0, 0.5) for _ in range(layers[i+1])]
             for _ in range(layers[i])]
        b = [random.gauss(0, 0.1) for _ in range(layers[i+1])]
        weights['W'].append(W)
        weights['b'].append(b)
    return weights

def mutate_weights(weights: dict, mutation_rate=0.1, mutation_strength=0.3) -> dict:
    """Мутация весов (эволюционный алгоритм)."""
    import copy
    new_w = copy.deepcopy(weights)
    for layer_W in new_w['W']:
        for row in layer_W:
            for j in range(len(row)):
                if random.random() < mutation_rate:
                    row[j] += random.gauss(0, mutation_strength)
                    row[j] = max(-3.0, min(3.0, row[j]))
    for layer_b in new_w['b']:
        for j in range(len(layer_b)):
            if random.random() < mutation_rate:
                layer_b[j] += random.gauss(0, mutation_strength * 0.5)
    return new_w

def crossover(w1: dict, w2: dict) -> dict:
    """Скрещивание двух нейросетей."""
    import copy
    child = copy.deepcopy(w1)
    for li in range(len(child['W'])):
        for i in range(len(child['W'][li])):
            if random.random() < 0.5:
                child['W'][li][i] = w2['W'][li][i][:]
    return child

def compute_fitness(score: int, waves: int, survival_time: int) -> float:
    """Функция приспособленности агента."""
    return score * 1.0 + waves * 50.0 + survival_time * 0.1

def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    token = get_token(event)
    action = body.get('action', 'get_agent')

    conn = get_conn()
    cur = conn.cursor()

    # ─── ПОЛУЧИТЬ / СОЗДАТЬ АГЕНТА ────────────────────────────────────────────
    if action == 'get_agent':
        agent_id = body.get('agent_id')
        mode = body.get('mode', 'demo')  # demo | project

        if agent_id:
            cur.execute(
                f"""SELECT id, agent_name, generation, games_played, best_score,
                           avg_score, win_rate, weights, fitness_history
                    FROM {SCHEMA}.ai_agents WHERE id = %s""",
                (agent_id,)
            )
        else:
            # Глобальный демо-агент
            cur.execute(
                f"""SELECT id, agent_name, generation, games_played, best_score,
                           avg_score, win_rate, weights, fitness_history
                    FROM {SCHEMA}.ai_agents WHERE project_id IS NULL
                    ORDER BY best_score DESC LIMIT 1"""
            )

        row = cur.fetchone()
        if not row:
            # Создаём демо-агента
            layers = [8, 24, 16, 4]
            weights = init_weights(layers)
            cur.execute(
                f"""INSERT INTO {SCHEMA}.ai_agents
                    (agent_name, generation, games_played, best_score, weights, fitness_history)
                    VALUES ('NEXUS-DEMO-AI', 0, 0, 0, %s::jsonb, '[]'::jsonb)
                    RETURNING id""",
                (json.dumps(weights),)
            )
            agent_id_new = cur.fetchone()[0]
            conn.commit()
            conn.close()
            return {
                'statusCode': 200, 'headers': CORS,
                'body': json.dumps({
                    'agent_id': agent_id_new,
                    'agent_name': 'NEXUS-DEMO-AI',
                    'generation': 0,
                    'games_played': 0,
                    'best_score': 0,
                    'weights': weights,
                    'status': 'новорождённый',
                    'message': 'ИИ только что создан и начинает обучение!'
                })
            }

        aid, name, gen, played, best, avg, wr, weights, history = row
        # Определяем уровень мастерства
        if best < 100:
            status = 'Новичок 🌱'
        elif best < 500:
            status = 'Обучается 📈'
        elif best < 2000:
            status = 'Опытный ⚡'
        elif best < 5000:
            status = 'Мастер 🏆'
        else:
            status = 'Легенда 👑'

        conn.close()
        return {
            'statusCode': 200, 'headers': CORS,
            'body': json.dumps({
                'agent_id': aid,
                'agent_name': name,
                'generation': gen,
                'games_played': played,
                'best_score': best,
                'avg_score': round(avg or 0, 1),
                'win_rate': round(wr or 0, 3),
                'weights': weights,
                'fitness_history': history or [],
                'status': status,
            })
        }

    # ─── СОХРАНИТЬ СЕССИЮ + ЭВОЛЮЦИЯ ─────────────────────────────────────────
    if action == 'save_session':
        agent_id = body.get('agent_id')
        score = body.get('score', 0)
        waves = body.get('waves', 0)
        survival_time = body.get('survival_time', 0)
        actions_taken = body.get('actions_taken', 0)

        if not agent_id:
            conn.close()
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Нужен agent_id'})}

        fitness = compute_fitness(score, waves, survival_time)
        reward = fitness / 100.0

        # Логируем сессию
        cur.execute(
            f"""INSERT INTO {SCHEMA}.ai_sessions
                (agent_id, score, waves_reached, survival_time, actions_taken, reward)
                VALUES (%s, %s, %s, %s, %s, %s)""",
            (agent_id, score, waves, survival_time, actions_taken, reward)
        )

        # Получаем текущего агента
        cur.execute(
            f"""SELECT generation, games_played, best_score, avg_score, win_rate,
                       weights, fitness_history
                FROM {SCHEMA}.ai_agents WHERE id = %s""",
            (agent_id,)
        )
        row = cur.fetchone()
        if not row:
            conn.close()
            return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Агент не найден'})}

        gen, played, best, avg_sc, wr, weights, history = row
        played_new = played + 1
        best_new = max(best or 0, score)
        avg_new = ((avg_sc or 0) * played + score) / played_new

        # Обновляем историю фитнеса
        hist = history if isinstance(history, list) else []
        hist.append(round(fitness, 2))
        if len(hist) > 100:
            hist = hist[-100:]

        # Эволюция: мутируем веса если сыграно достаточно партий
        evolved = False
        new_weights = weights
        mutation_rate = 0.05
        mutation_strength = 0.2

        if played_new % 3 == 0 and weights:  # Эволюция каждые 3 игры
            gen_new = (gen or 0) + 1
            # Адаптивная мутация: если улучшился — слабее, если нет — сильнее
            if score > (avg_sc or 0):
                mutation_rate = 0.03
                mutation_strength = 0.1
            else:
                mutation_rate = 0.12
                mutation_strength = 0.4

            new_weights = mutate_weights(weights, mutation_rate, mutation_strength)
            evolved = True
        else:
            gen_new = gen or 0

        cur.execute(
            f"""UPDATE {SCHEMA}.ai_agents SET
                generation = %s, games_played = %s, best_score = %s,
                avg_score = %s, weights = %s::jsonb, fitness_history = %s::jsonb,
                last_trained_at = NOW()
                WHERE id = %s""",
            (gen_new, played_new, best_new, avg_new,
             json.dumps(new_weights), json.dumps(hist), agent_id)
        )
        conn.commit()
        conn.close()

        return {
            'statusCode': 200, 'headers': CORS,
            'body': json.dumps({
                'ok': True,
                'evolved': evolved,
                'generation': gen_new,
                'games_played': played_new,
                'best_score': best_new,
                'avg_score': round(avg_new, 1),
                'fitness': round(fitness, 2),
                'new_weights': new_weights if evolved else None,
                'mutation_rate': mutation_rate if evolved else None,
                'message': f'Поколение {gen_new} — мутация {mutation_rate:.0%}' if evolved else 'Сессия сохранена'
            })
        }

    # ─── ЛИДЕРБОРД ────────────────────────────────────────────────────────────
    if action == 'get_leaderboard':
        cur.execute(
            f"""SELECT player_name, player_type, score, waves, created_at
                FROM {SCHEMA}.leaderboard
                ORDER BY score DESC LIMIT 20"""
        )
        rows = cur.fetchall()

        # Также добавляем ИИ-агентов в лидерборд
        cur.execute(
            f"""SELECT agent_name, best_score, generation, games_played
                FROM {SCHEMA}.ai_agents
                WHERE best_score > 0
                ORDER BY best_score DESC LIMIT 5"""
        )
        ai_rows = cur.fetchall()

        leaderboard = []
        for r in rows:
            leaderboard.append({
                'name': r[0],
                'type': r[1],
                'score': r[2],
                'waves': r[3],
                'date': r[4].strftime('%d.%m') if r[4] else '',
            })
        for r in ai_rows:
            leaderboard.append({
                'name': f'{r[0]} (gen.{r[2]})',
                'type': 'ai',
                'score': r[1],
                'waves': r[2],
                'date': f'{r[3]} игр',
            })

        leaderboard.sort(key=lambda x: x['score'], reverse=True)
        conn.close()
        return {
            'statusCode': 200, 'headers': CORS,
            'body': json.dumps({'leaderboard': leaderboard[:20]})
        }

    # ─── СОХРАНИТЬ СЧЁТ ЧЕЛОВЕКА ──────────────────────────────────────────────
    if action == 'save_score':
        user = get_user(cur, token)
        player_name = user[1] if user else body.get('player_name', 'Аноним')
        score = body.get('score', 0)
        waves = body.get('waves', 0)

        cur.execute(
            f"""INSERT INTO {SCHEMA}.leaderboard (player_name, player_type, score, waves)
                VALUES (%s, 'human', %s, %s)""",
            (player_name, score, waves)
        )
        conn.commit()

        # Ранг игрока
        cur.execute(
            f"SELECT COUNT(*) FROM {SCHEMA}.leaderboard WHERE score > %s", (score,)
        )
        rank = cur.fetchone()[0] + 1
        conn.close()

        return {
            'statusCode': 200, 'headers': CORS,
            'body': json.dumps({'ok': True, 'rank': rank, 'player_name': player_name})
        }

    # ─── СОВЕТЫ ИИ-ТРЕНЕРА ────────────────────────────────────────────────────
    if action == 'get_tips':
        agent_id = body.get('agent_id')
        score = body.get('score', 0)
        wave = body.get('wave', 1)
        lives = body.get('lives', 3)

        tips = []

        if lives == 1:
            tips.append({'type': 'danger', 'text': '⚠️ Последняя жизнь! Держись подальше от врагов.'})
        if wave >= 3 and score < wave * 100:
            tips.append({'type': 'strategy', 'text': '📊 Враги стали быстрее. Стреляй заранее, опережай их движение.'})
        if wave >= 5:
            tips.append({'type': 'powerup', 'text': '⚡ Собирай бонусы S (щит) и R (скорострельность) — они появляются у убитых врагов.'})
        if score > 500:
            tips.append({'type': 'achievement', 'text': f'🏆 Отличный результат {score}! Попробуй побить рекорд ИИ-агента.'})
        if not tips:
            default_tips = [
                {'type': 'tip', 'text': '🎯 Стреляй непрерывно — держи ПРОБЕЛ зажатым.'},
                {'type': 'tip', 'text': '🚀 Двигайся зигзагом — так сложнее окружить.'},
                {'type': 'tip', 'text': '⭐ Убивай врагов сверху вниз — не давай им дойти.'},
            ]
            import random as rnd
            tips = [rnd.choice(default_tips)]

        conn.close()
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'tips': tips})}

    conn.close()
    return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Неизвестный action'})}
