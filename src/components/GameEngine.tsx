/**
 * GameEngine — универсальный браузерный движок.
 * По описанию проекта от Симоны собирает готовую играбельную игру на Canvas.
 * Жанры: shooter, platformer, arcade, puzzle, runner
 */
import { useEffect, useRef, useState, useCallback } from "react";
import Icon from "@/components/ui/icon";

// ─── Типы ────────────────────────────────────────────────────────────────────

export interface GameConfig {
  genre: "shooter" | "platformer" | "arcade" | "puzzle" | "runner";
  title: string;
  description?: string;
  colorTheme?: "neon" | "retro" | "dark" | "nature";
}

interface GameEngineProps {
  config: GameConfig;
  onClose?: () => void;
  onScore?: (score: number) => void;
}

// ─── Определяем жанр из описания ────────────────────────────────────────────

export function detectGenre(desc: string): GameConfig["genre"] {
  const d = desc.toLowerCase();
  if (/платформер|прыгалк|прыжк|platform/.test(d)) return "platformer";
  if (/шутер|стрелялк|shooter|fps|космос|alien|враги/.test(d)) return "shooter";
  if (/змейк|snake|аркад|arcade|тетрис/.test(d)) return "arcade";
  if (/головоломк|puzzle|логик|матч/.test(d)) return "puzzle";
  if (/бегун|runner|бесконечн|obstacle/.test(d)) return "runner";
  return "shooter";
}

export function detectTheme(desc: string): GameConfig["colorTheme"] {
  const d = desc.toLowerCase();
  if (/ретро|пиксел|8-бит|retro/.test(d)) return "retro";
  if (/природ|лес|зелен|jungle/.test(d)) return "nature";
  if (/тёмн|dark|мрачн|хоррор/.test(d)) return "dark";
  return "neon";
}

// ─── Палитры ─────────────────────────────────────────────────────────────────

const THEMES = {
  neon:    { bg: "#050810", player: "#00f5ff", enemy: "#f97316", bullet: "#a855f7", platform: "#1e293b", text: "#00f5ff", accent: "#7c3aed" },
  retro:   { bg: "#1a1a2e", player: "#e2b714", enemy: "#e74c3c", bullet: "#f0f0f0", platform: "#16213e", text: "#e2b714", accent: "#e74c3c" },
  dark:    { bg: "#0a0a0a", player: "#dc2626", enemy: "#7f1d1d", bullet: "#ef4444", platform: "#111827", text: "#ef4444", accent: "#b91c1c" },
  nature:  { bg: "#0f2b0f", player: "#4ade80", enemy: "#b45309", bullet: "#86efac", platform: "#14532d", text: "#4ade80", accent: "#16a34a" },
};

const W = 480, H = 540;
let UID = 0;
const uid = () => ++UID;

// ─────────────────────────────────────────────────────────────────────────────
// ШУТЕР
// ─────────────────────────────────────────────────────────────────────────────

function runShooter(canvas: HTMLCanvasElement, theme: typeof THEMES.neon, onScore: (s: number) => void) {
  const ctx = canvas.getContext("2d")!;
  let animId = 0;
  let running = true;

  const state = {
    px: W / 2, py: H - 70,
    bullets: [] as { x: number; y: number; id: number }[],
    enemies: [] as { x: number; y: number; vx: number; vy: number; hp: number; id: number; type: number }[],
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string }[],
    stars: Array.from({ length: 60 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 0.5 + Math.random() * 2, spd: 0.5 + Math.random() })),
    powerups: [] as { x: number; y: number; type: "shield" | "rapid"; id: number }[],
    score: 0, wave: 1, lives: 3,
    dead: false, won: false,
    bCooldown: 0, spawnTimer: 0,
    shield: false, shieldTimer: 0,
    rapid: false, rapidTimer: 0,
    keys: {} as Record<string, boolean>,
    touch: { left: false, right: false, fire: false },
  };

  const shoot = () => {
    if (state.bCooldown > 0) return;
    state.bullets.push({ x: state.px, y: state.py - 20, id: uid() });
    if (state.rapid) state.bullets.push({ x: state.px - 12, y: state.py - 10, id: uid() });
    state.bCooldown = state.rapid ? 4 : 10;
  };

  const spawnEnemy = () => {
    const type = Math.floor(Math.random() * 3);
    const spd = 0.8 + state.wave * 0.2;
    state.enemies.push({
      x: 30 + Math.random() * (W - 60), y: -30,
      vx: (Math.random() - 0.5) * 2, vy: spd,
      hp: type === 2 ? 3 : 1, id: uid(), type,
    });
  };

  const explode = (x: number, y: number, color: string, n = 8) => {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const v = 1 + Math.random() * 3;
      state.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 30 + Math.random() * 20, color });
    }
  };

  const onKey = (e: KeyboardEvent) => { state.keys[e.key] = e.type === "keydown"; if (e.type === "keydown" && e.key === " ") shoot(); };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);

  function drawRoundRect(x: number, y: number, w: number, h: number, r: number, fill: string) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  }

  function loop() {
    if (!running) return;
    animId = requestAnimationFrame(loop);
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, W, H);

    // stars
    for (const s of state.stars) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + s.s * 0.2})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.s * 0.6, 0, Math.PI * 2); ctx.fill();
      s.y += s.spd;
      if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    }

    if (state.dead || state.won) {
      ctx.fillStyle = state.won ? theme.accent : "#ef4444";
      ctx.font = "bold 32px 'Exo 2', Arial";
      ctx.textAlign = "center";
      ctx.fillText(state.won ? "ПОБЕДА! 🎉" : "GAME OVER", W / 2, H / 2 - 20);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "16px 'Exo 2', Arial";
      ctx.fillText(`Счёт: ${state.score}`, W / 2, H / 2 + 20);
      ctx.fillText("Нажми Пробел для рестарта", W / 2, H / 2 + 50);
      if (state.keys[" "] || state.touch.fire) Object.assign(state, { dead: false, won: false, score: 0, lives: 3, wave: 1, enemies: [], bullets: [], particles: [] });
      return;
    }

    // движение игрока
    if (state.keys["ArrowLeft"] || state.keys["a"] || state.touch.left) state.px = Math.max(24, state.px - 5);
    if (state.keys["ArrowRight"] || state.keys["d"] || state.touch.right) state.px = Math.min(W - 24, state.px + 5);
    if (state.keys[" "] || state.touch.fire) shoot();
    if (state.bCooldown > 0) state.bCooldown--;

    // таймеры
    if (state.shield) { state.shieldTimer--; if (state.shieldTimer <= 0) state.shield = false; }
    if (state.rapid) { state.rapidTimer--; if (state.rapidTimer <= 0) state.rapid = false; }

    // спаун врагов
    state.spawnTimer++;
    const spawnRate = Math.max(40, 90 - state.wave * 8);
    if (state.spawnTimer >= spawnRate) { spawnEnemy(); state.spawnTimer = 0; }

    // пули
    state.bullets = state.bullets.filter(b => b.y > -10);
    for (const b of state.bullets) b.y -= 9;

    // враги
    for (const e of state.enemies) {
      e.x += e.vx + (e.type === 1 ? Math.sin(e.y * 0.05) * 1.5 : 0);
      e.y += e.vy;
      if (e.x < 20 || e.x > W - 20) e.vx *= -1;
    }

    // коллизии пули-враги
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      for (let j = state.enemies.length - 1; j >= 0; j--) {
        const e = state.enemies[j];
        if (Math.abs(b.x - e.x) < 18 && Math.abs(b.y - e.y) < 18) {
          state.bullets.splice(i, 1);
          e.hp--;
          explode(e.x, e.y, theme.enemy, 5);
          if (e.hp <= 0) {
            state.enemies.splice(j, 1);
            state.score += e.type === 2 ? 30 : 10;
            onScore(state.score);
            explode(e.x, e.y, theme.enemy, 12);
            if (Math.random() < 0.2) state.powerups.push({ x: e.x, y: e.y, type: Math.random() < 0.5 ? "shield" : "rapid", id: uid() });
            if (state.score >= 200 + state.wave * 150) { state.wave++; }
          }
          break;
        }
      }
    }

    // враг достиг дна / столкновение с игроком
    for (let j = state.enemies.length - 1; j >= 0; j--) {
      const e = state.enemies[j];
      if (e.y > H + 20) { state.enemies.splice(j, 1); if (!state.shield) { state.lives--; if (state.lives <= 0) state.dead = true; } continue; }
      if (Math.abs(e.x - state.px) < 28 && Math.abs(e.y - state.py) < 28) {
        state.enemies.splice(j, 1);
        if (!state.shield) { state.lives--; explode(state.px, state.py, "#ef4444", 15); if (state.lives <= 0) state.dead = true; }
      }
    }

    // powerups
    for (let i = state.powerups.length - 1; i >= 0; i--) {
      const p = state.powerups[i];
      p.y += 1.5;
      if (Math.abs(p.x - state.px) < 24 && Math.abs(p.y - state.py) < 24) {
        state.powerups.splice(i, 1);
        if (p.type === "shield") { state.shield = true; state.shieldTimer = 300; }
        else { state.rapid = true; state.rapidTimer = 300; }
      } else if (p.y > H) state.powerups.splice(i, 1);
    }

    // частицы
    state.particles = state.particles.filter(p => p.life > 0);
    for (const p of state.particles) {
      ctx.fillStyle = p.color + Math.floor((p.life / 50) * 255).toString(16).padStart(2, "0");
      ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
      p.x += p.vx; p.y += p.vy; p.life--;
    }

    // рисуем powerups
    for (const p of state.powerups) {
      ctx.fillStyle = p.type === "shield" ? "#60a5fa" : "#facc15";
      ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "white"; ctx.font = "10px Arial"; ctx.textAlign = "center";
      ctx.fillText(p.type === "shield" ? "🛡" : "⚡", p.x, p.y + 4);
    }

    // рисуем врагов
    for (const e of state.enemies) {
      const colors = [theme.enemy, "#ec4899", "#f97316"];
      ctx.fillStyle = colors[e.type] || theme.enemy;
      if (e.type === 0) {
        ctx.beginPath(); ctx.moveTo(e.x, e.y - 14); ctx.lineTo(e.x + 14, e.y + 10); ctx.lineTo(e.x - 14, e.y + 10); ctx.closePath(); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(e.x, e.y, 14, 0, Math.PI * 2); ctx.fill();
      }
      if (e.hp > 1) {
        ctx.fillStyle = "#4ade80";
        ctx.fillRect(e.x - 12, e.y - 20, 24 * (e.hp / 3), 3);
      }
    }

    // рисуем пули
    for (const b of state.bullets) {
      ctx.fillStyle = theme.bullet;
      ctx.shadowColor = theme.bullet; ctx.shadowBlur = 8;
      ctx.fillRect(b.x - 2, b.y - 8, 4, 14);
      ctx.shadowBlur = 0;
    }

    // рисуем игрока
    ctx.save();
    ctx.translate(state.px, state.py);
    if (state.shield) {
      ctx.strokeStyle = "#60a5fa"; ctx.lineWidth = 2; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = theme.player;
    ctx.shadowColor = theme.player; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(16, 14); ctx.lineTo(-16, 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = theme.bg;
    ctx.beginPath(); ctx.arc(0, 2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // HUD
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, W, 36);
    ctx.fillStyle = theme.text; ctx.font = "bold 14px 'Exo 2', Arial"; ctx.textAlign = "left";
    ctx.fillText(`⚡ ${state.score}`, 12, 22);
    ctx.textAlign = "center"; ctx.fillText(`ВОЛНА ${state.wave}`, W / 2, 22);
    ctx.textAlign = "right";
    const hearts = "❤️".repeat(state.lives);
    ctx.fillText(hearts, W - 10, 22);
    if (state.rapid) { ctx.fillStyle = "#facc15"; ctx.fillText("⚡RAPID", W - 80, 22); }

    // тач-кнопки
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    drawRoundRect(8, H - 56, 70, 44, 8, "rgba(0,245,255,0.1)");
    drawRoundRect(86, H - 56, 70, 44, 8, "rgba(0,245,255,0.1)");
    drawRoundRect(W - 86, H - 56, 76, 44, 8, "rgba(168,85,247,0.15)");
    ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "18px Arial"; ctx.textAlign = "center";
    ctx.fillText("◀", 43, H - 26);
    ctx.fillText("▶", 121, H - 26);
    ctx.fillStyle = theme.bullet; ctx.font = "bold 14px 'Exo 2',Arial";
    ctx.fillText("ОГОНЬ", W - 48, H - 26);
  }

  // тач
  const onTouch = (e: TouchEvent, down: boolean) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    for (const t of Array.from(e.changedTouches)) {
      const x = (t.clientX - rect.left) * scaleX;
      const y = (t.clientY - rect.top) * (H / rect.height);
      if (y > H - 60) {
        if (x < 80) state.touch.left = down;
        else if (x < 160) state.touch.right = down;
        else if (x > W - 90) { state.touch.fire = down; if (down) shoot(); }
      }
    }
  };
  canvas.addEventListener("touchstart", onTouch as EventListener, { passive: false });
  canvas.addEventListener("touchend", onTouch as EventListener, { passive: false });

  loop();
  return () => {
    running = false;
    cancelAnimationFrame(animId);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("keyup", onKey);
    canvas.removeEventListener("touchstart", onTouch as EventListener);
    canvas.removeEventListener("touchend", onTouch as EventListener);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ПЛАТФОРМЕР
// ─────────────────────────────────────────────────────────────────────────────

function runPlatformer(canvas: HTMLCanvasElement, theme: typeof THEMES.neon, onScore: (s: number) => void) {
  const ctx = canvas.getContext("2d")!;
  let animId = 0;
  let running = true;

  const platforms = [
    { x: 0, y: H - 20, w: W, h: 20 },
    { x: 60, y: 400, w: 120, h: 14 },
    { x: 260, y: 340, w: 100, h: 14 },
    { x: 80, y: 280, w: 130, h: 14 },
    { x: 240, y: 220, w: 110, h: 14 },
    { x: 50, y: 160, w: 120, h: 14 },
    { x: 280, y: 110, w: 140, h: 14 },
  ];
  const coins = platforms.slice(1).map(p => ({ x: p.x + p.w / 2, y: p.y - 24, taken: false, id: uid() }));
  const spikes = [
    { x: 130, y: H - 30, w: 50 },
    { x: 320, y: H - 30, w: 40 },
  ];

  const state = {
    px: 60, py: H - 80,
    vx: 0, vy: 0,
    onGround: false,
    score: 0, lives: 3,
    dead: false, won: false,
    keys: {} as Record<string, boolean>,
    touch: { left: false, right: false, jump: false },
    coyote: 0, jumpBuf: 0,
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number }[],
    deathTimer: 0,
  };

  const respawn = () => { state.px = 60; state.py = H - 80; state.vx = 0; state.vy = 0; state.deathTimer = 60; };

  const onKey = (e: KeyboardEvent) => {
    state.keys[e.key] = e.type === "keydown";
    if (e.type === "keydown" && (e.key === " " || e.key === "ArrowUp" || e.key === "w")) state.jumpBuf = 12;
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);

  function loop() {
    if (!running) return;
    animId = requestAnimationFrame(loop);
    ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, W, H);

    if (state.dead) {
      ctx.fillStyle = "#ef4444"; ctx.font = "bold 28px 'Exo 2',Arial"; ctx.textAlign = "center";
      ctx.fillText("GAME OVER", W / 2, H / 2);
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "14px 'Exo 2',Arial";
      ctx.fillText(`Монет собрано: ${state.score}`, W / 2, H / 2 + 36);
      ctx.fillText("Пробел — рестарт", W / 2, H / 2 + 62);
      if (state.keys[" "] || state.touch.jump) Object.assign(state, { dead: false, score: 0, lives: 3, deathTimer: 0 }, { px: 60, py: H - 80, vx: 0, vy: 0 });
      coins.forEach(c => c.taken = false);
      return;
    }
    if (state.won) {
      ctx.fillStyle = theme.accent; ctx.font = "bold 28px 'Exo 2',Arial"; ctx.textAlign = "center";
      ctx.fillText("ПОБЕДА! 🎉", W / 2, H / 2);
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "14px 'Exo 2',Arial";
      ctx.fillText(`Счёт: ${state.score}`, W / 2, H / 2 + 36);
      return;
    }

    if (state.deathTimer > 0) { state.deathTimer--; }

    // движение
    const spd = 3.5;
    if (state.keys["ArrowLeft"] || state.keys["a"] || state.touch.left) state.vx = -spd;
    else if (state.keys["ArrowRight"] || state.keys["d"] || state.touch.right) state.vx = spd;
    else state.vx *= 0.8;
    state.px = Math.max(16, Math.min(W - 16, state.px + state.vx));

    if ((state.keys["ArrowUp"] || state.keys["w"] || state.keys[" "] || state.touch.jump) && state.coyote > 0 && state.jumpBuf > 0) {
      state.vy = -10; state.coyote = 0; state.jumpBuf = 0;
      for (let i = 0; i < 8; i++) state.particles.push({ x: state.px, y: state.py + 16, vx: (Math.random() - 0.5) * 4, vy: Math.random() * 3, life: 15 });
    }
    if (state.jumpBuf > 0) state.jumpBuf--;
    state.vy = Math.min(state.vy + 0.5, 14);
    state.py += state.vy;
    state.onGround = false;

    for (const p of platforms) {
      if (state.px + 14 > p.x && state.px - 14 < p.x + p.w && state.py + 18 > p.y && state.py + 18 < p.y + 18 && state.vy >= 0) {
        state.py = p.y - 18; state.vy = 0; state.onGround = true; state.coyote = 8;
      }
    }
    if (!state.onGround && state.coyote > 0) state.coyote--;
    if (state.py > H + 50 && state.deathTimer === 0) { state.lives--; if (state.lives <= 0) state.dead = true; else respawn(); }

    // шипы
    for (const s of spikes) {
      if (state.px + 10 > s.x && state.px - 10 < s.x + s.w && state.py + 18 > H - 36 && state.deathTimer === 0) {
        state.lives--; if (state.lives <= 0) state.dead = true; else respawn();
      }
    }

    // монеты
    for (const c of coins) {
      if (!c.taken && Math.abs(state.px - c.x) < 20 && Math.abs(state.py - c.y) < 20) {
        c.taken = true; state.score++; onScore(state.score);
        for (let i = 0; i < 10; i++) state.particles.push({ x: c.x, y: c.y, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4, life: 25 });
      }
    }
    if (coins.every(c => c.taken)) state.won = true;

    // рисуем платформы
    for (const p of platforms) {
      ctx.fillStyle = theme.platform;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = theme.player + "40";
      ctx.fillRect(p.x, p.y, p.w, 3);
    }

    // шипы
    for (const s of spikes) {
      ctx.fillStyle = "#ef4444";
      for (let i = 0; i < Math.floor(s.w / 10); i++) {
        ctx.beginPath(); ctx.moveTo(s.x + i * 10, H - 20);
        ctx.lineTo(s.x + i * 10 + 5, H - 36);
        ctx.lineTo(s.x + i * 10 + 10, H - 20); ctx.closePath(); ctx.fill();
      }
    }

    // монеты
    for (const c of coins) {
      if (c.taken) continue;
      ctx.fillStyle = "#facc15";
      ctx.shadowColor = "#facc15"; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(c.x, c.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fef08a"; ctx.font = "9px Arial"; ctx.textAlign = "center";
      ctx.fillText("✦", c.x, c.y + 3);
    }

    // частицы
    state.particles = state.particles.filter(p => p.life > 0);
    for (const p of state.particles) {
      ctx.fillStyle = `rgba(250,204,21,${p.life / 25})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
      p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life--;
    }

    // игрок
    ctx.fillStyle = theme.player;
    ctx.shadowColor = theme.player; ctx.shadowBlur = 10;
    ctx.fillRect(state.px - 14, state.py - 16, 28, 32);
    ctx.fillStyle = theme.bg;
    ctx.fillRect(state.px - 7, state.py - 10, 5, 6);
    ctx.fillRect(state.px + 2, state.py - 10, 5, 6);
    ctx.shadowBlur = 0;

    // HUD
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, W, 36);
    ctx.fillStyle = theme.text; ctx.font = "bold 13px 'Exo 2',Arial"; ctx.textAlign = "left";
    ctx.fillText(`🪙 ${state.score}/${coins.length}`, 12, 22);
    ctx.textAlign = "right"; ctx.fillText("❤️".repeat(state.lives), W - 10, 22);

    // тач кнопки
    const btnStyle = "rgba(0,245,255,0.08)";
    ctx.fillStyle = btnStyle; ctx.beginPath(); ctx.roundRect(8, H - 56, 66, 44, 8); ctx.fill();
    ctx.fillStyle = btnStyle; ctx.beginPath(); ctx.roundRect(82, H - 56, 66, 44, 8); ctx.fill();
    ctx.fillStyle = btnStyle; ctx.beginPath(); ctx.roundRect(W - 82, H - 56, 74, 44, 8); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "18px Arial"; ctx.textAlign = "center";
    ctx.fillText("◀", 41, H - 26); ctx.fillText("▶", 115, H - 26);
    ctx.fillStyle = theme.accent; ctx.font = "bold 13px 'Exo 2',Arial";
    ctx.fillText("ПРЫЖОК", W - 45, H - 26);
  }

  const onTouch = (e: TouchEvent, down: boolean) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    for (const t of Array.from(e.changedTouches)) {
      const x = (t.clientX - rect.left) * (W / rect.width);
      const y = (t.clientY - rect.top) * (H / rect.height);
      if (y > H - 60) {
        if (x < 80) state.touch.left = down;
        else if (x < 155) state.touch.right = down;
        else if (x > W - 85) { state.touch.jump = down; if (down) state.jumpBuf = 12; }
      }
    }
  };
  canvas.addEventListener("touchstart", onTouch as EventListener, { passive: false });
  canvas.addEventListener("touchend", onTouch as EventListener, { passive: false });

  loop();
  return () => {
    running = false;
    cancelAnimationFrame(animId);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("keyup", onKey);
    canvas.removeEventListener("touchstart", onTouch as EventListener);
    canvas.removeEventListener("touchend", onTouch as EventListener);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// АРКАДА — Змейка
// ─────────────────────────────────────────────────────────────────────────────

function runArcade(canvas: HTMLCanvasElement, theme: typeof THEMES.neon, onScore: (s: number) => void) {
  const ctx = canvas.getContext("2d")!;
  let animId = 0;
  let running = true;
  const CELL = 20, COLS = Math.floor(W / CELL), ROWS = Math.floor((H - 60) / CELL);
  const OFF_Y = 40;

  const rndCell = () => ({ x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) });

  const state = {
    snake: [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }],
    dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 },
    food: rndCell(),
    bonus: null as { x: number; y: number } | null,
    bonusTimer: 0,
    score: 0, dead: false,
    moveTimer: 0, moveDelay: 10,
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number }[],
    keys: {} as Record<string, boolean>,
  };

  const onKey = (e: KeyboardEvent) => {
    state.keys[e.key] = e.type === "keydown";
    if (e.type !== "keydown") return;
    if ((e.key === "ArrowUp" || e.key === "w") && state.dir.y !== 1) state.nextDir = { x: 0, y: -1 };
    if ((e.key === "ArrowDown" || e.key === "s") && state.dir.y !== -1) state.nextDir = { x: 0, y: 1 };
    if ((e.key === "ArrowLeft" || e.key === "a") && state.dir.x !== 1) state.nextDir = { x: -1, y: 0 };
    if ((e.key === "ArrowRight" || e.key === "d") && state.dir.x !== -1) state.nextDir = { x: 1, y: 0 };
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);

  // свайп
  let touchStart = { x: 0, y: 0 };
  const onTouchStart = (e: TouchEvent) => { touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 20 && state.dir.x !== -1) state.nextDir = { x: 1, y: 0 };
      if (dx < -20 && state.dir.x !== 1) state.nextDir = { x: -1, y: 0 };
    } else {
      if (dy > 20 && state.dir.y !== -1) state.nextDir = { x: 0, y: 1 };
      if (dy < -20 && state.dir.y !== 1) state.nextDir = { x: 0, y: -1 };
    }
  };
  canvas.addEventListener("touchstart", onTouchStart);
  canvas.addEventListener("touchend", onTouchEnd);

  function loop() {
    if (!running) return;
    animId = requestAnimationFrame(loop);
    ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, W, H);

    if (state.dead) {
      ctx.fillStyle = "#ef4444"; ctx.font = "bold 28px 'Exo 2',Arial"; ctx.textAlign = "center";
      ctx.fillText("GAME OVER", W / 2, H / 2);
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "14px 'Exo 2',Arial";
      ctx.fillText(`Длина: ${state.snake.length} | Счёт: ${state.score}`, W / 2, H / 2 + 36);
      ctx.fillText("Нажми стрелку для рестарта", W / 2, H / 2 + 62);
      const anyKey = Object.values(state.keys).some(Boolean);
      if (anyKey) Object.assign(state, {
        snake: [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }],
        dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 }, score: 0, dead: false,
        food: rndCell(), bonus: null, bonusTimer: 0,
      });
      return;
    }

    // обновление
    state.moveTimer++;
    if (state.moveTimer >= state.moveDelay) {
      state.moveTimer = 0;
      state.dir = state.nextDir;
      const head = { x: state.snake[0].x + state.dir.x, y: state.snake[0].y + state.dir.y };
      if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS || state.snake.some(s => s.x === head.x && s.y === head.y)) {
        state.dead = true; return;
      }
      state.snake.unshift(head);
      if (head.x === state.food.x && head.y === state.food.y) {
        state.score += 10; onScore(state.score);
        for (let i = 0; i < 8; i++) state.particles.push({ x: head.x * CELL + CELL / 2, y: head.y * CELL + OFF_Y + CELL / 2, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4, life: 20 });
        state.food = rndCell();
        state.moveDelay = Math.max(5, state.moveDelay - 0.3);
        if (!state.bonus && Math.random() < 0.3) { state.bonus = rndCell(); state.bonusTimer = 120; }
      } else if (state.bonus && head.x === state.bonus.x && head.y === state.bonus.y) {
        state.score += 30; onScore(state.score); state.bonus = null;
        for (let i = 0; i < 12; i++) state.particles.push({ x: head.x * CELL + CELL / 2, y: head.y * CELL + OFF_Y + CELL / 2, vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 5, life: 25 });
      } else {
        state.snake.pop();
      }
      if (state.bonus) { state.bonusTimer--; if (state.bonusTimer <= 0) state.bonus = null; }
    }

    // сетка
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    for (let x = 0; x < COLS; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, OFF_Y); ctx.lineTo(x * CELL, H); ctx.stroke(); }
    for (let y = 0; y < ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL + OFF_Y); ctx.lineTo(W, y * CELL + OFF_Y); ctx.stroke(); }

    // змейка
    state.snake.forEach((seg, i) => {
      const alpha = 1 - i / state.snake.length * 0.5;
      ctx.fillStyle = i === 0 ? theme.player : theme.player + Math.floor(alpha * 200).toString(16).padStart(2, "0");
      ctx.shadowColor = theme.player; ctx.shadowBlur = i === 0 ? 10 : 4;
      ctx.fillRect(seg.x * CELL + 2, seg.y * CELL + OFF_Y + 2, CELL - 4, CELL - 4);
    });
    ctx.shadowBlur = 0;

    // еда
    ctx.fillStyle = "#ef4444"; ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(state.food.x * CELL + CELL / 2, state.food.y * CELL + OFF_Y + CELL / 2, 7, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // бонус
    if (state.bonus) {
      const alpha = (state.bonusTimer / 120);
      ctx.fillStyle = `rgba(250,204,21,${alpha})`; ctx.shadowColor = "#facc15"; ctx.shadowBlur = 15;
      ctx.font = "18px Arial"; ctx.textAlign = "center";
      ctx.fillText("⭐", state.bonus.x * CELL + CELL / 2, state.bonus.y * CELL + OFF_Y + CELL / 2 + 6);
      ctx.shadowBlur = 0;
    }

    // частицы
    state.particles = state.particles.filter(p => p.life > 0);
    for (const p of state.particles) {
      ctx.fillStyle = `rgba(250,204,21,${p.life / 25})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--;
    }

    // HUD
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, W, 36);
    ctx.fillStyle = theme.text; ctx.font = "bold 13px 'Exo 2',Arial"; ctx.textAlign = "left";
    ctx.fillText(`🍎 ${state.score}`, 12, 22);
    ctx.textAlign = "center"; ctx.fillText(`Длина: ${state.snake.length}`, W / 2, 22);
    ctx.textAlign = "right"; ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.font = "11px Arial";
    ctx.fillText("← ↑ → ↓ | свайп", W - 10, 22);
  }

  loop();
  return () => {
    running = false;
    cancelAnimationFrame(animId);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("keyup", onKey);
    canvas.removeEventListener("touchstart", onTouchStart);
    canvas.removeEventListener("touchend", onTouchEnd);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RUNNER — бесконечный бегун
// ─────────────────────────────────────────────────────────────────────────────

function runRunner(canvas: HTMLCanvasElement, theme: typeof THEMES.neon, onScore: (s: number) => void) {
  const ctx = canvas.getContext("2d")!;
  let animId = 0;
  let running = true;
  const GND = H - 80;

  const state = {
    px: 80, py: GND,
    vy: 0, onGround: true,
    obstacles: [] as { x: number; w: number; h: number }[],
    clouds: Array.from({ length: 5 }, () => ({ x: Math.random() * W, y: 60 + Math.random() * 120, w: 60 + Math.random() * 80 })),
    score: 0, dist: 0,
    dead: false, spd: 4,
    spawnTimer: 0, spawnDelay: 80,
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number }[],
    keys: {} as Record<string, boolean>,
    tapped: false,
  };

  const jump = () => { if (state.onGround) { state.vy = -12; state.onGround = false; for (let i = 0; i < 6; i++) state.particles.push({ x: state.px, y: GND + 18, vx: (Math.random() - 0.5) * 4, vy: Math.random() * 2, life: 12 }); } };
  const onKey = (e: KeyboardEvent) => { state.keys[e.key] = e.type === "keydown"; if (e.type === "keydown" && (e.key === " " || e.key === "ArrowUp")) jump(); };
  const onTap = () => jump();
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  canvas.addEventListener("touchstart", onTap);
  canvas.addEventListener("click", onTap);

  function loop() {
    if (!running) return;
    animId = requestAnimationFrame(loop);
    ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, W, H);

    if (state.dead) {
      ctx.fillStyle = "#ef4444"; ctx.font = "bold 28px 'Exo 2',Arial"; ctx.textAlign = "center";
      ctx.fillText("GAME OVER", W / 2, H / 2 - 20);
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "14px 'Exo 2',Arial";
      ctx.fillText(`Дистанция: ${state.score}м`, W / 2, H / 2 + 20);
      ctx.fillText("Нажми / тапни — рестарт", W / 2, H / 2 + 50);
      if (state.keys[" "] || state.keys["ArrowUp"]) Object.assign(state, { dead: false, score: 0, dist: 0, spd: 4, obstacles: [], vy: 0, py: GND, onGround: true, spawnDelay: 80 });
      return;
    }

    state.dist++;
    state.score = Math.floor(state.dist / 6);
    onScore(state.score);
    state.spd = 4 + state.score * 0.01;

    // облака
    for (const c of state.clouds) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.beginPath(); ctx.ellipse(c.x, c.y, c.w / 2, 16, 0, 0, Math.PI * 2); ctx.fill();
      c.x -= 0.5;
      if (c.x < -c.w) c.x = W + c.w;
    }

    // земля
    ctx.fillStyle = theme.platform;
    ctx.fillRect(0, GND + 20, W, H - GND - 20);
    ctx.fillStyle = theme.player + "40";
    ctx.fillRect(0, GND + 20, W, 3);

    // прыжок
    state.vy += 0.55;
    state.py += state.vy;
    if (state.py >= GND) { state.py = GND; state.vy = 0; state.onGround = true; }

    // препятствия
    state.spawnTimer++;
    if (state.spawnTimer >= state.spawnDelay) {
      const h = 24 + Math.random() * 30;
      state.obstacles.push({ x: W + 10, w: 18 + Math.random() * 14, h });
      state.spawnTimer = 0;
      state.spawnDelay = Math.max(45, 80 - state.score * 0.2);
    }
    state.obstacles = state.obstacles.filter(o => o.x > -30);
    for (const o of state.obstacles) {
      o.x -= state.spd;
      ctx.fillStyle = theme.enemy;
      ctx.shadowColor = theme.enemy; ctx.shadowBlur = 6;
      ctx.fillRect(o.x, GND + 20 - o.h, o.w, o.h);
      ctx.shadowBlur = 0;
      if (state.px + 14 > o.x + 3 && state.px - 14 < o.x + o.w - 3 && state.py + 18 > GND + 20 - o.h) {
        state.dead = true;
        for (let i = 0; i < 15; i++) state.particles.push({ x: state.px, y: state.py, vx: (Math.random() - 0.5) * 8, vy: -Math.random() * 6, life: 30 });
      }
    }

    // частицы
    state.particles = state.particles.filter(p => p.life > 0);
    for (const p of state.particles) {
      ctx.fillStyle = `rgba(0,245,255,${p.life / 30})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
      p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life--;
    }

    // игрок
    ctx.fillStyle = theme.player;
    ctx.shadowColor = theme.player; ctx.shadowBlur = 10;
    ctx.fillRect(state.px - 14, state.py - 14, 28, 34);
    ctx.fillStyle = theme.bg;
    ctx.fillRect(state.px - 7, state.py - 8, 5, 6);
    ctx.fillRect(state.px + 2, state.py - 8, 5, 6);
    ctx.shadowBlur = 0;

    // HUD
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, W, 36);
    ctx.fillStyle = theme.text; ctx.font = "bold 13px 'Exo 2',Arial"; ctx.textAlign = "left";
    ctx.fillText(`📏 ${state.score}м`, 12, 22);
    ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.font = "11px Arial";
    ctx.fillText("Пробел / тап — прыжок", W / 2, 22);
  }

  loop();
  return () => {
    running = false;
    cancelAnimationFrame(animId);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("keyup", onKey);
    canvas.removeEventListener("touchstart", onTap);
    canvas.removeEventListener("click", onTap);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUZZLE — матч-3
// ─────────────────────────────────────────────────────────────────────────────

function runPuzzle(canvas: HTMLCanvasElement, theme: typeof THEMES.neon, onScore: (s: number) => void) {
  const ctx = canvas.getContext("2d")!;
  let animId = 0;
  let running = true;
  const COLS = 7, ROWS = 7, SZ = 56, OX = (W - COLS * SZ) / 2, OY = 60;
  const COLORS = [theme.player, theme.enemy, theme.accent, "#facc15", "#4ade80", "#f472b6"];

  const mkBoard = () => Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => Math.floor(Math.random() * COLORS.length)));
  const state = {
    board: mkBoard(),
    selected: null as { r: number; c: number } | null,
    score: 0, moves: 20,
    animating: false, won: false, lost: false,
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string }[],
  };

  const findMatches = () => {
    const marks = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS - 2; c++) {
      if (state.board[r][c] === state.board[r][c+1] && state.board[r][c] === state.board[r][c+2])
        marks[r][c] = marks[r][c+1] = marks[r][c+2] = true;
    }
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS - 2; r++) {
      if (state.board[r][c] === state.board[r+1][c] && state.board[r][c] === state.board[r+2][c])
        marks[r][c] = marks[r+1][c] = marks[r+2][c] = true;
    }
    return marks;
  };

  const removeMatches = () => {
    const marks = findMatches();
    let count = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (marks[r][c]) {
      state.particles.push({ x: OX + c * SZ + SZ / 2, y: OY + r * SZ + SZ / 2, vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 5, life: 25, color: COLORS[state.board[r][c]] });
      state.board[r][c] = -1; count++;
    }
    if (count > 0) {
      state.score += count * 10; onScore(state.score);
      for (let c = 0; c < COLS; c++) {
        let empty = ROWS - 1;
        for (let r = ROWS - 1; r >= 0; r--) if (state.board[r][c] !== -1) { state.board[empty][c] = state.board[r][c]; if (empty !== r) state.board[r][c] = -1; empty--; }
        for (let r = empty; r >= 0; r--) state.board[r][c] = Math.floor(Math.random() * COLORS.length);
      }
    }
    return count;
  };

  const swap = (r1: number, c1: number, r2: number, c2: number) => {
    const tmp = state.board[r1][c1]; state.board[r1][c1] = state.board[r2][c2]; state.board[r2][c2] = tmp;
  };

  const onCanvasClick = (e: MouseEvent | TouchEvent) => {
    if (state.animating || state.won || state.lost) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]?.clientX : (e as MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY : (e as MouseEvent).clientY;
    if (!clientX || !clientY) return;
    const mx = (clientX - rect.left) * (W / rect.width);
    const my = (clientY - rect.top) * (H / rect.height);
    const c = Math.floor((mx - OX) / SZ), r = Math.floor((my - OY) / SZ);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;

    if (!state.selected) { state.selected = { r, c }; return; }
    const dr = Math.abs(r - state.selected.r), dc = Math.abs(c - state.selected.c);
    if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
      swap(r, c, state.selected.r, state.selected.c);
      const matched = removeMatches();
      if (!matched) swap(r, c, state.selected.r, state.selected.c);
      else { state.moves--; if (state.moves <= 0) state.lost = true; }
    }
    state.selected = null;
    if (state.score >= 300) state.won = true;
  };

  canvas.addEventListener("click", onCanvasClick);
  canvas.addEventListener("touchstart", onCanvasClick as EventListener, { passive: false });

  function loop() {
    if (!running) return;
    animId = requestAnimationFrame(loop);
    ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, W, H);

    if (state.won || state.lost) {
      ctx.fillStyle = state.won ? theme.accent : "#ef4444";
      ctx.font = "bold 28px 'Exo 2',Arial"; ctx.textAlign = "center";
      ctx.fillText(state.won ? "ПОБЕДА! 🎉" : "GAME OVER", W / 2, H / 2 - 10);
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "14px 'Exo 2',Arial";
      ctx.fillText(`Счёт: ${state.score}`, W / 2, H / 2 + 30);
      ctx.fillText("Нажми для новой игры", W / 2, H / 2 + 58);
      return;
    }

    // доска
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const x = OX + c * SZ, y = OY + r * SZ;
      const isSelected = state.selected?.r === r && state.selected?.c === c;
      ctx.fillStyle = isSelected ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.04)";
      ctx.beginPath(); ctx.roundRect(x + 2, y + 2, SZ - 4, SZ - 4, 8); ctx.fill();
      if (state.board[r][c] >= 0) {
        ctx.fillStyle = COLORS[state.board[r][c]];
        ctx.shadowColor = COLORS[state.board[r][c]]; ctx.shadowBlur = isSelected ? 16 : 6;
        ctx.beginPath(); ctx.arc(x + SZ / 2, y + SZ / 2, isSelected ? 20 : 17, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        if (isSelected) {
          ctx.strokeStyle = "white"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x + SZ / 2, y + SZ / 2, 22, 0, Math.PI * 2); ctx.stroke();
        }
      }
    }

    // частицы
    state.particles = state.particles.filter(p => p.life > 0);
    for (const p of state.particles) {
      ctx.fillStyle = p.color + Math.floor((p.life / 25) * 255).toString(16).padStart(2, "0");
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
      p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life--;
    }

    // HUD
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, W, 50);
    ctx.fillStyle = theme.text; ctx.font = "bold 14px 'Exo 2',Arial"; ctx.textAlign = "left";
    ctx.fillText(`⭐ ${state.score}/300`, 12, 24);
    ctx.textAlign = "right"; ctx.fillStyle = state.moves <= 5 ? "#ef4444" : "white";
    ctx.fillText(`Ходы: ${state.moves}`, W - 12, 24);
    ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.font = "10px Arial";
    ctx.fillText("Выбери 2 соседних шара → матч-3", W / 2, 42);
  }

  loop();
  return () => {
    running = false;
    cancelAnimationFrame(animId);
    canvas.removeEventListener("click", onCanvasClick);
    canvas.removeEventListener("touchstart", onCanvasClick as EventListener);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// КОМПОНЕНТ
// ─────────────────────────────────────────────────────────────────────────────

const GENRE_LABELS: Record<string, string> = {
  shooter: "🚀 Шутер",
  platformer: "🏃 Платформер",
  arcade: "🐍 Аркада (Змейка)",
  puzzle: "🔮 Головоломка",
  runner: "💨 Бесконечный бегун",
};

const CONTROLS: Record<string, string> = {
  shooter: "← → перемещение • Пробел огонь • тач-кнопки",
  platformer: "← → движение • ↑ / Пробел прыжок • тач-кнопки",
  arcade: "← ↑ → ↓ управление • свайп на телефоне",
  runner: "Пробел / тап — прыжок",
  puzzle: "Нажми на шар, потом на соседний — матч-3",
};

export default function GameEngine({ config, onClose, onScore }: GameEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const theme = THEMES[config.colorTheme || "neon"];

  const handleScore = useCallback((s: number) => {
    setScore(s);
    onScore?.(s);
  }, [onScore]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    canvas.focus();

    const runners: Record<GameConfig["genre"], typeof runShooter> = {
      shooter: runShooter,
      platformer: runPlatformer,
      arcade: runArcade,
      runner: runRunner,
      puzzle: runPuzzle as typeof runShooter,
    };

    const cleanup = runners[config.genre](canvas, theme, handleScore);
    return cleanup;
  }, [config.genre, config.colorTheme]);

  return (
    <div style={{
      background: "#050810",
      border: "1px solid rgba(0,245,255,0.2)",
      borderRadius: "16px",
      overflow: "hidden",
      width: "100%",
      maxWidth: fullscreen ? "100vw" : "500px",
      margin: "0 auto",
      boxShadow: "0 0 40px rgba(0,245,255,0.1)",
      fontFamily: "'Exo 2', Arial, sans-serif",
    }}>
      {/* Хедер */}
      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "10px 14px",
        background: "rgba(0,0,0,0.4)",
        borderBottom: "1px solid rgba(0,245,255,0.1)",
      }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80" }} />
        <div style={{ flex: 1 }}>
          <div style={{ color: "#00f5ff", fontWeight: 700, fontSize: "13px" }}>{config.title}</div>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "10px" }}>{GENRE_LABELS[config.genre]}</div>
        </div>
        <div style={{ color: "#facc15", fontWeight: 700, fontSize: "14px", marginRight: "8px" }}>
          {score.toLocaleString()}
        </div>
        <button onClick={() => setFullscreen(f => !f)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: "4px" }}>
          <Icon name={fullscreen ? "Minimize2" : "Maximize2"} size={14} />
        </button>
        {onClose && (
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: "4px" }}>
            <Icon name="X" size={14} />
          </button>
        )}
      </div>

      {/* Canvas */}
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          tabIndex={0}
          style={{
            display: "block",
            width: "100%",
            height: "auto",
            cursor: config.genre === "puzzle" ? "pointer" : "default",
            outline: "none",
          }}
        />
      </div>

      {/* Подсказка управления */}
      <div style={{
        padding: "8px 14px",
        background: "rgba(0,0,0,0.3)",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        color: "rgba(255,255,255,0.25)",
        fontSize: "10px",
        textAlign: "center",
      }}>
        {CONTROLS[config.genre]}
      </div>
    </div>
  );
}
