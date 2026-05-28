import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";

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

export default function DemoGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const keysRef = useRef<Set<string>>(new Set());
  const animRef = useRef<number>(0);
  const [uiScore, setUiScore] = useState(0);
  const [uiLives, setUiLives] = useState(3);
  const [uiWave, setUiWave] = useState(1);
  const [gameStatus, setGameStatus] = useState<"idle" | "running" | "over" | "won">("idle");

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

  const startGame = () => {
    stateRef.current = createInitialState();
    stateRef.current.running = true;
    spawnEnemyWave(1);
    setGameStatus("running");
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
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

      // Input
      if ((keys.has("ArrowLeft") || keys.has("KeyA")) && s.playerX > 24) s.playerX -= PLAYER_SPEED;
      if ((keys.has("ArrowRight") || keys.has("KeyD")) && s.playerX < CANVAS_W - 24) s.playerX += PLAYER_SPEED;
      if ((keys.has("ArrowUp") || keys.has("KeyW")) && s.playerY > 60) s.playerY -= PLAYER_SPEED;
      if ((keys.has("ArrowDown") || keys.has("KeyS")) && s.playerY < CANVAS_H - 24) s.playerY += PLAYER_SPEED;

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
        if (s.wave > 10) { s.won = true; s.running = false; setGameStatus("won"); }
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
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Touch controls
  const handleTouch = (dir: string, pressed: boolean) => {
    if (pressed) keysRef.current.add(dir);
    else keysRef.current.delete(dir);
  };

  return (
    <div className="flex flex-col items-center gap-4">
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
        <div className="flex gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Icon key={i} name="Heart" size={16}
              style={{ color: i < uiLives ? "#ff00aa" : "rgba(255,255,255,0.15)", filter: i < uiLives ? "drop-shadow(0 0 4px #ff00aa)" : "none" }} />
          ))}
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
          <div className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ background: "rgba(5,8,15,0.92)", backdropFilter: "blur(4px)" }}>
            <div className="font-orbitron font-black text-3xl mb-2 tracking-wider"
              style={{ color: "#ff00aa", textShadow: "0 0 30px #ff00aa" }}>GAME OVER</div>
            <div className="font-mono text-white/40 text-sm mb-2">Счёт: <span className="text-white font-bold">{uiScore.toLocaleString()}</span></div>
            <div className="font-mono text-white/30 text-xs mb-8">Волна: {uiWave}</div>
            <button onClick={startGame}
              className="neon-btn-violet px-8 py-3 rounded-xl font-orbitron font-bold text-sm tracking-widest flex items-center gap-2">
              <Icon name="RotateCcw" size={16} />ЗАНОВО
            </button>
          </div>
        )}

        {/* Overlay: Won */}
        {gameStatus === "won" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ background: "rgba(5,8,15,0.92)", backdropFilter: "blur(4px)" }}>
            <div className="font-orbitron font-black text-3xl mb-2 tracking-wider neon-text-green">ПОБЕДА!</div>
            <div className="font-mono text-white/40 text-sm mb-2">Счёт: <span className="text-white font-bold">{uiScore.toLocaleString()}</span></div>
            <div className="font-mono text-white/30 text-xs mb-8">Все 10 волн пройдены!</div>
            <button onClick={startGame}
              className="neon-btn-cyan px-8 py-3 rounded-xl font-orbitron font-bold text-sm tracking-widest flex items-center gap-2">
              <Icon name="RotateCcw" size={16} />ИГРАТЬ СНОВА
            </button>
          </div>
        )}
      </div>

      {/* Mobile controls */}
      <div className="flex gap-4 mt-2 md:hidden">
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

      <div className="text-center text-xs font-mono text-white/20 mt-1">
        Это демо — ИИ сгенерировал полноценный геймплей. <span className="neon-text-cyan">Создай свою игру →</span>
      </div>
    </div>
  );
}
