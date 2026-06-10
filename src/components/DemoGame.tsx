import { useEffect, useRef, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { api } from "@/lib/api";

interface GameState {
  playerX: number;
  playerY: number;
  bullets: Array<{ x: number; y: number; id: number }>;
  enemies: Array<{ x: number; y: number; id: number; hp: number; type: number }>;
  particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; color: string; id: number }>;
  stars: Array<{ x: number; y: number; speed: number; size: number }>;
  score: number;
  wave: number;
  lives: number;
  gameOver: boolean;
  won: boolean;
  running: boolean;
  bulletCooldown: number;
  enemySpawnTimer: number;
  shieldActive: boolean;
  shieldTimer: number;
  powerups: Array<{ x: number; y: number; id: number; type: "shield" | "rapid" }>;
  rapidFire: boolean;
  rapidTimer: number;
}

let idCounter = 0;
const nextId = () => ++idCounter;

const CANVAS_W = 480;
const CANVAS_H = 600;
const PLAYER_SPEED = 5;
const BULLET_SPEED = 9;
const ENEMY_SPEED_BASE = 1.2;

function createInitialState(): GameState {
  const stars = Array.from({ length: 80 }, () => ({
    x: Math.random() * CANVAS_W,
    y: Math.random() * CANVAS_H,
    speed: 0.5 + Math.random() * 1.5,
    size: Math.random() * 2,
  }));
  return {
    playerX: CANVAS_W / 2,
    playerY: CANVAS_H - 70,
    bullets: [],
    enemies: [],
    particles: [],
    stars,
    score: 0,
    wave: 1,
    lives: 3,
    gameOver: false,
    won: false,
    running: false,
    bulletCooldown: 0,
    enemySpawnTimer: 0,
    shieldActive: false,
    shieldTimer: 0,
    powerups: [],
    rapidFire: false,
    rapidTimer: 0,
  };
}

// ── Нейросеть прямо в браузере ────────────────────────────────────────────────
function sigmoid(x: number) { return 1 / (1 + Math.exp(-x)); }

function nnForward(weights: { W: number[][][]; b: number[][] }, input: number[]): number[] {
  let current = input;
  for (let l = 0; l < weights.W.length; l++) {
    const next: number[] = [];
    for (let j = 0; j < weights.W[l][0].length; j++) {
      let sum = weights.b[l][j];
      for (let i = 0; i < current.length; i++) sum += current[i] * weights.W[l][i][j];
      next.push(l < weights.W.length - 1 ? Math.max(0, sum) : sigmoid(sum)); // ReLU hidden, sigmoid output
    }
    current = next;
  }
  return current;
}

function getAIInput(s: GameState): number[] {
  // 8 входов: [px_norm, py_norm, nearest_ex, nearest_ey, dist_norm, has_shield, rapid_fire, score_norm]
  const nearestEnemy = s.enemies.reduce((best, en) => {
    const d = Math.hypot(en.x - s.playerX, en.y - s.playerY);
    return d < best.d ? { d, x: en.x, y: en.y } : best;
  }, { d: 9999, x: CANVAS_W / 2, y: 0 });
  return [
    s.playerX / CANVAS_W,
    s.playerY / CANVAS_H,
    nearestEnemy.x / CANVAS_W,
    nearestEnemy.y / CANVAS_H,
    Math.min(nearestEnemy.d / 300, 1),
    s.shieldActive ? 1 : 0,
    s.rapidFire ? 1 : 0,
    Math.min(s.score / 1000, 1),
  ];
}

interface DemoGameProps {
  onCommand?: (handler: (cmd: string) => void) => void;
}

export default function DemoGame({ onCommand }: DemoGameProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const keysRef = useRef<Set<string>>(new Set());
  const animRef = useRef<number>(0);
  const [uiScore, setUiScore] = useState(0);
  const [uiLives, setUiLives] = useState(3);
  const [uiWave, setUiWave] = useState(1);
  const [gameStatus, setGameStatus] = useState<"idle" | "running" | "over" | "won">("idle");

  // ИИ-агент
  const [aiAgent, setAiAgent] = useState<{
    agent_id: number; agent_name: string; generation: number;
    games_played: number; best_score: number; avg_score: number;
    weights: { W: number[][][]; b: number[][] } | null; status: string;
  } | null>(null);
  const aiWeightsRef = useRef<{ W: number[][][]; b: number[][] } | null>(null);
  const [aiMode, setAiMode] = useState(false); // ИИ играет сам
  const aiActionsRef = useRef(0);
  const sessionStartRef = useRef(Date.now());

  // Лидерборд и советы
  const [leaderboard, setLeaderboard] = useState<Array<{ name: string; type: string; score: number; waves: number }>>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [tip, setTip] = useState<{ type: string; text: string } | null>(null);
  const [aiEvolved, setAiEvolved] = useState<string | null>(null);

  const spawnEnemyWave = (wave: number) => {
    const s = stateRef.current;
    const count = 3 + wave * 2;
    const types = [0, 1, 2];
    for (let i = 0; i < count; i++) {
      s.enemies.push({
        id: nextId(),
        x: 40 + Math.random() * (CANVAS_W - 80),
        y: -30 - i * 40,
        hp: wave >= 3 ? 2 : 1,
        type: types[Math.floor(Math.random() * types.length)],
      });
    }
  };

  const spawnParticles = (x: number, y: number, color: string, count = 8) => {
    const s = stateRef.current;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 1.5 + Math.random() * 3;
      s.particles.push({
        id: nextId(),
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color,
      });
    }
  };

  // Загружаем ИИ-агента при монтировании
  useEffect(() => {
    api.getAIAgent().then(data => {
      if (data.agent_id) {
        setAiAgent(data);
        if (data.weights) aiWeightsRef.current = data.weights;
      }
    }).catch(() => {});
    api.getLeaderboard().then(data => {
      if (data.leaderboard) setLeaderboard(data.leaderboard);
    }).catch(() => {});
  }, []);

  const loadLeaderboard = useCallback(async () => {
    const data = await api.getLeaderboard().catch(() => ({}));
    if (data.leaderboard) setLeaderboard(data.leaderboard);
  }, []);

  // Сохраняем результат после игры
  const onGameEnd = useCallback(async (score: number, wave: number) => {
    const survivalTime = Math.floor((Date.now() - sessionStartRef.current) / 1000);

    // Сохраняем счёт человека
    api.saveScore(score, wave).catch(() => {});

    // Обновляем ИИ-агента
    if (aiAgent?.agent_id) {
      const result = await api.saveAISession(
        aiAgent.agent_id, score, wave, survivalTime, aiActionsRef.current
      ).catch(() => ({}));
      if (result.evolved) {
        setAiEvolved(result.message || 'ИИ эволюционировал!');
        if (result.new_weights) {
          aiWeightsRef.current = result.new_weights;
          setAiAgent(prev => prev ? { ...prev, generation: result.generation, games_played: result.games_played } : prev);
        }
        setTimeout(() => setAiEvolved(null), 4000);
      }
      // Обновляем лучший счёт агента
      if (score > (aiAgent.best_score || 0)) {
        setAiAgent(prev => prev ? { ...prev, best_score: score } : prev);
      }
    }
    await loadLeaderboard();
  }, [aiAgent, loadLeaderboard]);

  const startGame = () => {
    stateRef.current = createInitialState();
    stateRef.current.running = true;
    spawnEnemyWave(1);
    aiActionsRef.current = 0;
    sessionStartRef.current = Date.now();
    setTip(null);
    setGameStatus("running");

    // Советы от ИИ-тренера через 5 секунд
    setTimeout(() => {
      if (aiAgent?.agent_id) {
        api.getAITips(aiAgent.agent_id, 0, 1, 3).then(d => {
          if (d.tips?.[0]) setTip(d.tips[0]);
        }).catch(() => {});
      }
    }, 5000);
  };

  // Команды от Симоны
  useEffect(() => {
    if (!onCommand) return;
    onCommand((cmd: string) => {
      if (cmd === "start") { setAiMode(false); startGame(); }
      else if (cmd === "ai") { setAiMode(true); startGame(); }
      else if (cmd === "restart") startGame();
    });
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      keysRef.current.add(e.code);
      if (["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.code)) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const drawShip = (x: number, y: number, shielded: boolean) => {
      ctx.save();
      ctx.translate(x, y);
      // Glow
      ctx.shadowColor = "#00f5ff";
      ctx.shadowBlur = shielded ? 20 : 10;
      // Body
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(14, 12);
      ctx.lineTo(6, 6);
      ctx.lineTo(0, 10);
      ctx.lineTo(-6, 6);
      ctx.lineTo(-14, 12);
      ctx.closePath();
      ctx.fillStyle = shielded ? "#00ffcc" : "#00f5ff";
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.stroke();
      // Engine glow
      ctx.shadowColor = "#bf00ff";
      ctx.shadowBlur = 15;
      ctx.fillStyle = "#bf00ff";
      ctx.fillRect(-4, 10, 8, 6);
      if (shielded) {
        ctx.shadowColor = "#00ffcc";
        ctx.shadowBlur = 25;
        ctx.strokeStyle = "rgba(0,255,204,0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawEnemy = (x: number, y: number, type: number, hp: number) => {
      ctx.save();
      ctx.translate(x, y);
      const colors = ["#ff00aa", "#ff6b00", "#bf00ff"];
      const color = colors[type % 3];
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      if (type === 0) {
        ctx.beginPath();
        ctx.moveTo(0, 20);
        ctx.lineTo(16, -8);
        ctx.lineTo(6, -2);
        ctx.lineTo(0, -14);
        ctx.lineTo(-6, -2);
        ctx.lineTo(-16, -8);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      } else if (type === 1) {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
          ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 16);
          const a2 = ((i + 0.5) * Math.PI * 2) / 5 - Math.PI / 2;
          ctx.lineTo(Math.cos(a2) * 7, Math.sin(a2) * 7);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if (hp > 1) {
        ctx.fillStyle = "#00ff88";
        ctx.fillRect(-10, -22, 20, 4);
        ctx.fillStyle = "#00ff88";
        ctx.shadowColor = "#00ff88";
        ctx.fillRect(-10, -22, hp * 10, 4);
      }
      ctx.restore();
    };

    const loop = () => {
      const s = stateRef.current;
      const keys = keysRef.current;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Background
      ctx.fillStyle = "#05080f";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Stars
      s.stars.forEach(star => {
        star.y += star.speed;
        if (star.y > CANVAS_H) { star.y = 0; star.x = Math.random() * CANVAS_W; }
        ctx.fillStyle = `rgba(255,255,255,${0.3 + star.size * 0.3})`;
        ctx.fillRect(star.x, star.y, star.size + 0.5, star.size + 0.5);
      });

      if (!s.running) {
        animRef.current = requestAnimationFrame(loop);
        return;
      }

      // ── ИИ-агент управляет персонажем ──────────────────────────────────────
      const weights = aiWeightsRef.current;
      if (aiMode && weights && s.enemies.length > 0) {
        const input = getAIInput(s);
        const output = nnForward(weights, input);
        // [влево, вправо, вверх, стрелять]
        if (output[0] > 0.55 && s.playerX > 24) s.playerX -= PLAYER_SPEED;
        if (output[1] > 0.55 && s.playerX < CANVAS_W - 24) s.playerX += PLAYER_SPEED;
        if (output[2] > 0.55 && s.playerY > 80) s.playerY -= PLAYER_SPEED * 0.7;
        else if (s.playerY < CANVAS_H - 60) s.playerY += PLAYER_SPEED * 0.3;
        if (output[3] > 0.4) keys.add("Space");
        else keys.delete("Space");
        aiActionsRef.current++;

        // Нарисуем ИИ-индикатор на канвасе
        ctx.save();
        ctx.fillStyle = "rgba(0,245,255,0.08)";
        ctx.fillRect(0, 0, CANVAS_W, 18);
        ctx.font = "10px monospace";
        ctx.fillStyle = "#00f5ff";
        ctx.fillText(`🤖 NEXUS-AI  ← ${output[0].toFixed(2)}  → ${output[1].toFixed(2)}  ↑ ${output[2].toFixed(2)}  🔫 ${output[3].toFixed(2)}`, 6, 13);
        ctx.restore();
      } else {
        // Игрок управляет
        if ((keys.has("ArrowLeft") || keys.has("KeyA")) && s.playerX > 24) s.playerX -= PLAYER_SPEED;
        if ((keys.has("ArrowRight") || keys.has("KeyD")) && s.playerX < CANVAS_W - 24) s.playerX += PLAYER_SPEED;
        if ((keys.has("ArrowUp") || keys.has("KeyW")) && s.playerY > 60) s.playerY -= PLAYER_SPEED;
        if ((keys.has("ArrowDown") || keys.has("KeyS")) && s.playerY < CANVAS_H - 24) s.playerY += PLAYER_SPEED;
      }

      // Shoot
      s.bulletCooldown = Math.max(0, s.bulletCooldown - 1);
      const cooldown = s.rapidFire ? 5 : 14;
      if ((keys.has("Space") || keys.has("KeyZ")) && s.bulletCooldown === 0) {
        s.bullets.push({ id: nextId(), x: s.playerX, y: s.playerY - 20 });
        if (s.rapidFire) {
          s.bullets.push({ id: nextId(), x: s.playerX - 10, y: s.playerY - 10 });
          s.bullets.push({ id: nextId(), x: s.playerX + 10, y: s.playerY - 10 });
        }
        s.bulletCooldown = cooldown;
      }

      // Bullets
      s.bullets = s.bullets.filter(b => b.y > -10);
      s.bullets.forEach(b => {
        b.y -= BULLET_SPEED;
        ctx.save();
        ctx.shadowColor = "#00ff88";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "#00ff88";
        ctx.fillRect(b.x - 2, b.y - 8, 4, 12);
        ctx.restore();
      });

      // Enemies
      const enemySpeed = ENEMY_SPEED_BASE + s.wave * 0.3;
      s.enemies.forEach(en => {
        en.y += enemySpeed;
        // Bullet hits enemy
        s.bullets = s.bullets.filter(b => {
          const hit = Math.abs(b.x - en.x) < 18 && Math.abs(b.y - en.y) < 18;
          if (hit) {
            en.hp -= 1;
            spawnParticles(en.x, en.y, ["#ff00aa", "#ff6b00", "#bf00ff"][en.type % 3], 5);
          }
          return !hit;
        });
        drawEnemy(en.x, en.y, en.type, en.hp);
      });

      // Remove dead enemies
      const killed = s.enemies.filter(en => en.hp <= 0);
      killed.forEach(en => {
        spawnParticles(en.x, en.y, ["#ff00aa", "#ff6b00", "#bf00ff"][en.type % 3], 12);
        s.score += 10 * s.wave;
        if (Math.random() < 0.15) {
          s.powerups.push({
            id: nextId(), x: en.x, y: en.y,
            type: Math.random() < 0.5 ? "shield" : "rapid"
          });
        }
      });
      s.enemies = s.enemies.filter(en => en.hp > 0);

      // Enemy reaches bottom
      const fallen = s.enemies.filter(en => en.y > CANVAS_H + 20);
      if (fallen.length > 0 && !s.shieldActive) {
        s.lives -= fallen.length;
        fallen.forEach(() => spawnParticles(s.playerX, s.playerY, "#ff4444", 15));
      }
      s.enemies = s.enemies.filter(en => en.y <= CANVAS_H + 20);

      // Enemy touches player
      s.enemies.forEach(en => {
        if (Math.abs(en.x - s.playerX) < 22 && Math.abs(en.y - s.playerY) < 22 && !s.shieldActive) {
          s.lives -= 1;
          spawnParticles(s.playerX, s.playerY, "#ff4444", 20);
          en.hp = 0;
        }
      });

      // Powerups
      s.powerups = s.powerups.filter(p => p.y < CANVAS_H + 30);
      s.powerups.forEach(p => {
        p.y += 1.5;
        const pColor = p.type === "shield" ? "#00f5ff" : "#ffdd00";
        ctx.save();
        ctx.shadowColor = pColor;
        ctx.shadowBlur = 14;
        ctx.fillStyle = pColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(p.type === "shield" ? "S" : "R", p.x, p.y + 3);
        ctx.restore();
        if (Math.abs(p.x - s.playerX) < 24 && Math.abs(p.y - s.playerY) < 24) {
          if (p.type === "shield") { s.shieldActive = true; s.shieldTimer = 180; }
          else { s.rapidFire = true; s.rapidTimer = 300; }
          p.y = CANVAS_H + 100;
        }
      });

      // Timers
      if (s.shieldActive) {
        s.shieldTimer--;
        if (s.shieldTimer <= 0) s.shieldActive = false;
      }
      if (s.rapidFire) {
        s.rapidTimer--;
        if (s.rapidTimer <= 0) s.rapidFire = false;
      }

      // Spawn enemies
      s.enemySpawnTimer++;
      if (s.enemies.length === 0 && s.enemySpawnTimer > 60) {
        s.wave++;
        spawnEnemyWave(s.wave);
        s.enemySpawnTimer = 0;
        if (s.wave > 10) {
        s.won = true; s.running = false;
        setGameStatus("won");
        onGameEnd(s.score, s.wave);
      }
      }

      // Particles
      s.particles = s.particles.filter(p => p.life > 0);
      s.particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.92; p.vy *= 0.92;
        p.life -= 0.04;
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Draw player
      drawShip(s.playerX, s.playerY, s.shieldActive);

      // UI
      setUiScore(s.score);
      setUiLives(s.lives);
      setUiWave(s.wave);

      if (s.lives <= 0) {
        s.running = false;
        s.gameOver = true;
        setGameStatus("over");
        onGameEnd(s.score, s.wave);
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [onGameEnd, aiMode]);  

  // Touch controls
  const handleTouch = (dir: string, pressed: boolean) => {
    if (pressed) keysRef.current.add(dir);
    else keysRef.current.delete(dir);
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* ИИ-эволюция уведомление */}
      {aiEvolved && (
        <div className="w-full max-w-[480px] px-3 py-2 rounded-lg border text-xs font-mono flex items-center gap-2 animate-fade-in"
          style={{ borderColor: "rgba(191,0,255,0.4)", background: "rgba(191,0,255,0.08)", color: "#bf00ff" }}>
          <Icon name="Zap" size={12} />
          🧬 {aiEvolved}
        </div>
      )}

      {/* Совет от ИИ-тренера */}
      {tip && gameStatus === "running" && (
        <div className="w-full max-w-[480px] px-3 py-2 rounded-lg border text-xs font-exo flex items-center gap-2"
          style={{ borderColor: "rgba(0,255,136,0.25)", background: "rgba(0,255,136,0.05)", color: "rgba(255,255,255,0.7)" }}>
          <Icon name="Bot" size={12} style={{ color: "#00ff88", flexShrink: 0 }} />
          {tip.text}
          <button onClick={() => setTip(null)} className="ml-auto text-white/20 hover:text-white/50 transition-colors flex-shrink-0">
            <Icon name="X" size={10} />
          </button>
        </div>
      )}

      {/* HUD */}
      <div className="flex items-center justify-between w-full max-w-[480px] px-2">
        <div className="flex items-center gap-4">
          <div className="font-orbitron text-xs neon-text-cyan">
            СЧЁТ: <span className="font-black text-base">{uiScore.toLocaleString()}</span>
          </div>
          <div className="font-orbitron text-xs" style={{ color: "#00ff88" }}>
            ВОЛНА: <span className="font-black">{uiWave}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Переключатель ИИ-режима */}
          <button onClick={() => setAiMode(v => !v)}
            className="px-2 py-1 rounded text-xs font-orbitron transition-all flex items-center gap-1"
            style={{
              background: aiMode ? "rgba(191,0,255,0.2)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${aiMode ? "rgba(191,0,255,0.5)" : "rgba(255,255,255,0.1)"}`,
              color: aiMode ? "#bf00ff" : "rgba(255,255,255,0.3)"
            }}>
            <Icon name="Bot" size={11} />
            {aiMode ? "ИИ" : "ИИ"}
          </button>
          <div className="flex gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Icon key={i} name="Heart" size={16}
                style={{ color: i < uiLives ? "#ff00aa" : "rgba(255,255,255,0.15)", filter: i < uiLives ? "drop-shadow(0 0 4px #ff00aa)" : "none" }} />
            ))}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative rounded-xl overflow-hidden border"
        style={{ borderColor: "rgba(0,245,255,0.25)", boxShadow: "0 0 30px rgba(0,245,255,0.1)" }}>
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H}
          style={{ display: "block", maxWidth: "100%", imageRendering: "pixelated" }} />

        {/* Overlay: Idle */}
        {gameStatus === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ background: "rgba(5,8,15,0.88)", backdropFilter: "blur(4px)" }}>
            <div className="font-orbitron font-black text-2xl neon-text-cyan mb-2 tracking-widest">COSMIC RAIDERS</div>
            <div className="font-mono text-xs text-white/40 mb-8 text-center px-6">
              Демо-игра сгенерированная ИИ · Управление: ← → ↑ ↓ + ПРОБЕЛ
            </div>
            <div className="space-y-2 text-xs font-mono text-white/30 text-center mb-8">
              <div><span className="neon-text-cyan">S</span> = Щит &nbsp; <span style={{ color: "#ffdd00" }}>R</span> = Rapid Fire</div>
              <div>Выживи 10 волн врагов!</div>
            </div>
            <button onClick={startGame}
              className="neon-btn-cyan px-10 py-4 rounded-xl font-orbitron font-black text-sm tracking-widest flex items-center gap-3">
              <Icon name="Play" size={18} />ИГРАТЬ
            </button>
          </div>
        )}

        {/* Overlay: Game Over */}
        {gameStatus === "over" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6"
            style={{ background: "rgba(5,8,15,0.93)", backdropFilter: "blur(4px)" }}>
            <div className="font-orbitron font-black text-3xl mb-1 tracking-wider"
              style={{ color: "#ff00aa", textShadow: "0 0 30px #ff00aa" }}>GAME OVER</div>
            <div className="font-mono text-white/50 text-sm mb-1">
              Счёт: <span className="text-white font-bold">{uiScore.toLocaleString()}</span>
              &nbsp;·&nbsp; Волна: <span className="text-white font-bold">{uiWave}</span>
            </div>
            {aiAgent && (
              <div className="text-xs font-mono mb-4" style={{ color: "#bf00ff" }}>
                Рекорд ИИ-агента: {aiAgent.best_score.toLocaleString()} · Поколение {aiAgent.generation}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={startGame}
                className="neon-btn-violet px-6 py-2.5 rounded-xl font-orbitron font-bold text-xs tracking-widest flex items-center gap-2">
                <Icon name="RotateCcw" size={14} />ЗАНОВО
              </button>
              <button onClick={() => setShowLeaderboard(true)}
                className="px-6 py-2.5 rounded-xl font-orbitron font-bold text-xs tracking-widest flex items-center gap-2 border border-white/10 text-white/40 hover:text-white/70 transition-all">
                <Icon name="Trophy" size={14} />РЕЙТИНГ
              </button>
            </div>
          </div>
        )}

        {/* Overlay: Won */}
        {gameStatus === "won" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6"
            style={{ background: "rgba(5,8,15,0.93)", backdropFilter: "blur(4px)" }}>
            <div className="font-orbitron font-black text-3xl mb-1 tracking-wider neon-text-green">ПОБЕДА!</div>
            <div className="font-mono text-white/50 text-sm mb-1">
              Счёт: <span className="text-white font-bold">{uiScore.toLocaleString()}</span>
              &nbsp;·&nbsp; Все 10 волн!
            </div>
            {aiAgent && (
              <div className="text-xs font-mono mb-4" style={{ color: "#00ff88" }}>
                ИИ-агент обновил рекорд · Поколение {aiAgent.generation}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={startGame}
                className="neon-btn-cyan px-6 py-2.5 rounded-xl font-orbitron font-bold text-xs tracking-widest flex items-center gap-2">
                <Icon name="RotateCcw" size={14} />ЕЩЁ РАЗ
              </button>
              <button onClick={() => setShowLeaderboard(true)}
                className="px-6 py-2.5 rounded-xl font-orbitron font-bold text-xs tracking-widest flex items-center gap-2 border border-white/10 text-white/40 hover:text-white/70 transition-all">
                <Icon name="Trophy" size={14} />РЕЙТИНГ
              </button>
            </div>
          </div>
        )}

        {/* Overlay: Idle */}
        {gameStatus === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6"
            style={{ background: "rgba(5,8,15,0.88)", backdropFilter: "blur(4px)" }}>
            <div className="font-orbitron font-black text-2xl neon-text-cyan mb-1 tracking-widest">COSMIC RAIDERS</div>
            <div className="font-mono text-xs text-white/30 mb-4 text-center">
              ← → ↑ ↓ + ПРОБЕЛ &nbsp;|&nbsp; <span className="neon-text-cyan">S</span>=Щит &nbsp; <span style={{ color: "#ffdd00" }}>R</span>=Rapid
            </div>
            {aiAgent && (
              <div className="mb-4 px-4 py-2 rounded-lg border text-center"
                style={{ borderColor: "rgba(191,0,255,0.3)", background: "rgba(191,0,255,0.07)" }}>
                <div className="text-xs font-orbitron mb-1" style={{ color: "#bf00ff" }}>
                  🤖 {aiAgent.agent_name} · {aiAgent.status}
                </div>
                <div className="text-xs font-mono text-white/40">
                  Поколение {aiAgent.generation} · {aiAgent.games_played} игр · рекорд {aiAgent.best_score.toLocaleString()}
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setAiMode(false); startGame(); }}
                className="neon-btn-cyan px-8 py-3 rounded-xl font-orbitron font-black text-sm tracking-widest flex items-center gap-2">
                <Icon name="Play" size={16} />ИГРАТЬ
              </button>
              {aiAgent && (
                <button onClick={() => { setAiMode(true); startGame(); }}
                  className="px-6 py-3 rounded-xl font-orbitron font-bold text-sm tracking-widest flex items-center gap-2"
                  style={{ background: "rgba(191,0,255,0.15)", border: "1px solid rgba(191,0,255,0.4)", color: "#bf00ff" }}>
                  <Icon name="Bot" size={16} />ИИ ИГРАЕТ
                </button>
              )}
            </div>
          </div>
        )}

        {/* Лидерборд оверлей */}
        {showLeaderboard && (
          <div className="absolute inset-0 flex flex-col"
            style={{ background: "rgba(5,8,15,0.96)", backdropFilter: "blur(4px)" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(0,245,255,0.1)" }}>
              <div className="font-orbitron font-black text-sm neon-text-cyan tracking-widest flex items-center gap-2">
                <Icon name="Trophy" size={14} /> РЕЙТИНГ
              </div>
              <button onClick={() => setShowLeaderboard(false)} className="text-white/30 hover:text-white transition-colors">
                <Icon name="X" size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
              {leaderboard.length === 0 && (
                <div className="text-center text-white/25 font-mono text-xs py-8">Пока нет результатов — будь первым!</div>
              )}
              {leaderboard.map((entry, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                  style={{ background: i === 0 ? "rgba(255,215,0,0.07)" : "rgba(255,255,255,0.02)" }}>
                  <div className="w-6 text-center font-orbitron font-black text-xs"
                    style={{ color: i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "rgba(255,255,255,0.3)" }}>
                    {i + 1}
                  </div>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-xs" style={{ color: entry.type === "ai" ? "#bf00ff" : "#00f5ff" }}>
                      {entry.type === "ai" ? "🤖" : "👤"}
                    </span>
                    <span className="font-exo text-sm text-white/70 truncate">{entry.name}</span>
                  </div>
                  <div className="font-orbitron font-black text-sm" style={{ color: entry.type === "ai" ? "#bf00ff" : "#00f5ff" }}>
                    {entry.score.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <button onClick={() => { setShowLeaderboard(false); startGame(); }}
                className="w-full py-2.5 rounded-lg font-orbitron font-bold text-xs tracking-widest neon-btn-cyan flex items-center justify-center gap-2">
                <Icon name="Play" size={14} />ИГРАТЬ СНОВА
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Панель ИИ-агента под канвасом */}
      {aiAgent && (
        <div className="w-full max-w-[480px] rounded-xl border p-3"
          style={{ borderColor: "rgba(191,0,255,0.2)", background: "rgba(191,0,255,0.04)" }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 font-orbitron text-xs tracking-widest" style={{ color: "#bf00ff" }}>
              <Icon name="Brain" size={13} />
              {aiAgent.agent_name}
              <span className="text-white/30 font-mono text-xs">gen.{aiAgent.generation}</span>
            </div>
            <span className="text-xs font-mono" style={{ color: "#bf00ff" }}>{aiAgent.status}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Рекорд", value: aiAgent.best_score.toLocaleString(), color: "#00ff88" },
              { label: "Игр", value: aiAgent.games_played, color: "#00f5ff" },
              { label: "Ср. счёт", value: Math.round(aiAgent.avg_score || 0), color: "#bf00ff" },
            ].map(s => (
              <div key={s.label} className="rounded-lg px-2 py-1.5" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="font-orbitron font-black text-sm" style={{ color: s.color }}>{s.value}</div>
                <div className="text-white/30 text-xs font-mono">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2 text-xs font-mono text-white/30 items-center">
            <Icon name="Activity" size={10} style={{ color: "#bf00ff" }} />
            Нейросеть: {aiAgent.generation > 0 ? `эволюционировала ${aiAgent.generation} раз` : "только создана, начинает обучение"}
            &nbsp;·&nbsp;
            <button onClick={() => setShowLeaderboard(true)} className="neon-text-cyan hover:underline">рейтинг</button>
          </div>
        </div>
      )}

      {/* Mobile controls */}
      <div className="flex gap-4 mt-1 md:hidden">
        <div className="grid grid-cols-3 gap-1">
          <div />
          <button onPointerDown={() => handleTouch("ArrowUp", true)} onPointerUp={() => handleTouch("ArrowUp", false)}
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white/60 border border-white/10 active:border-cyan-400 active:text-cyan-400">
            <Icon name="ChevronUp" size={20} />
          </button>
          <div />
          <button onPointerDown={() => handleTouch("ArrowLeft", true)} onPointerUp={() => handleTouch("ArrowLeft", false)}
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white/60 border border-white/10 active:border-cyan-400 active:text-cyan-400">
            <Icon name="ChevronLeft" size={20} />
          </button>
          <button onPointerDown={() => handleTouch("ArrowDown", true)} onPointerUp={() => handleTouch("ArrowDown", false)}
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white/60 border border-white/10 active:border-cyan-400 active:text-cyan-400">
            <Icon name="ChevronDown" size={20} />
          </button>
          <button onPointerDown={() => handleTouch("ArrowRight", true)} onPointerUp={() => handleTouch("ArrowRight", false)}
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white/60 border border-white/10 active:border-cyan-400 active:text-cyan-400">
            <Icon name="ChevronRight" size={20} />
          </button>
        </div>
        <button onPointerDown={() => handleTouch("Space", true)} onPointerUp={() => handleTouch("Space", false)}
          className="w-20 h-20 self-center rounded-xl font-orbitron font-black text-xs tracking-wider flex items-center justify-center"
          style={{ background: "rgba(0,245,255,0.15)", border: "1px solid rgba(0,245,255,0.4)", color: "#00f5ff" }}>
          ОГОНЬ
        </button>
      </div>
    </div>
  );
}