import { useState } from "react";
import GameEngine from "@/components/GameEngine";
import type { GameConfig } from "@/components/GameEngine";
import Icon from "@/components/ui/icon";

const SHOWCASE_GAMES: Array<{
  id: string;
  title: string;
  desc: string;
  tag: string;
  color: string;
  config: GameConfig;
}> = [
  {
    id: "shooter",
    title: "Space Shooter",
    desc: "Классический космический шутер. Уничтожай врагов, собирай бонусы, переживай волны.",
    tag: "🚀 Шутер",
    color: "#00f5ff",
    config: { genre: "shooter", title: "Space Shooter", colorTheme: "neon" },
  },
  {
    id: "platformer",
    title: "Neon Platformer",
    desc: "Прыгай по платформам, собирай монеты, избегай шипов. Собери все монеты — победа!",
    tag: "🏃 Платформер",
    color: "#a855f7",
    config: { genre: "platformer", title: "Neon Platformer", colorTheme: "neon" },
  },
  {
    id: "snake",
    title: "Pixel Snake",
    desc: "Классическая змейка в неоновом стиле. Ешь еду, расти, не врезайся в себя.",
    tag: "🐍 Аркада",
    color: "#4ade80",
    config: { genre: "arcade", title: "Pixel Snake", colorTheme: "neon" },
  },
  {
    id: "runner",
    title: "Endless Runner",
    desc: "Бесконечный бег с препятствиями. Скорость растёт — реакция решает всё.",
    tag: "💨 Раннер",
    color: "#f97316",
    config: { genre: "runner", title: "Endless Runner", colorTheme: "retro" },
  },
  {
    id: "puzzle",
    title: "Match-3 Puzzle",
    desc: "Головоломка: совмести 3 шара одного цвета. Набери 300 очков за 20 ходов.",
    tag: "🔮 Головоломка",
    color: "#f472b6",
    config: { genre: "puzzle", title: "Match-3 Puzzle", colorTheme: "dark" },
  },
];

export default function GameShowcase() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeGame = SHOWCASE_GAMES.find(g => g.id === activeId);

  return (
    <section id="projects" className="py-24 px-4 relative">
      <div className="section-divider mb-24" />
      <div className="max-w-6xl mx-auto">

        {/* Заголовок */}
        <div className="text-center mb-16">
          <div className="font-mono text-xs mb-3 tracking-widest" style={{ color: "#a855f7" }}>
            // ИГРОВЫЕ ПРОЕКТЫ
          </div>
          <h2 className="font-orbitron font-black text-3xl md:text-4xl mb-4" style={{ color: "white" }}>
            ИГРАЙ ПРЯМО СЕЙЧАС
          </h2>
          <p className="text-white/40 max-w-xl mx-auto text-sm">
            Все игры созданы Симоной — нажми «Играть» и запускай прямо в браузере без скачивания
          </p>
        </div>

        {/* Активная игра */}
        {activeGame && (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: activeGame.color }} />
              <span className="font-mono text-xs tracking-widest" style={{ color: activeGame.color }}>
                СЕЙЧАС ЗАПУЩЕНО
              </span>
              <span className="text-white/60 text-sm font-bold">{activeGame.title}</span>
              <button
                onClick={() => setActiveId(null)}
                className="ml-auto flex items-center gap-1 text-xs px-3 py-1 rounded"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <Icon name="X" size={11} /> Закрыть
              </button>
            </div>
            <GameEngine
              config={activeGame.config}
              onClose={() => setActiveId(null)}
            />
          </div>
        )}

        {/* Сетка карточек */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "16px",
        }}>
          {SHOWCASE_GAMES.map(game => {
            const isActive = activeId === game.id;
            return (
              <div
                key={game.id}
                style={{
                  background: isActive ? `${game.color}10` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isActive ? game.color + "50" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: "14px",
                  overflow: "hidden",
                  transition: "all 0.2s",
                  cursor: "pointer",
                  fontFamily: "'Exo 2', Arial, sans-serif",
                }}
                onClick={() => setActiveId(isActive ? null : game.id)}
              >
                {/* Превью — цветной баннер */}
                <div style={{
                  height: "90px",
                  background: `linear-gradient(135deg, ${game.color}18, ${game.color}05)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "36px",
                  borderBottom: `1px solid ${game.color}20`,
                  position: "relative",
                }}>
                  {game.tag.split(" ")[0]}
                  {isActive && (
                    <div style={{
                      position: "absolute", top: 8, right: 8,
                      background: game.color, color: "#050810",
                      fontSize: "9px", fontWeight: 800, padding: "2px 7px",
                      borderRadius: "10px", letterSpacing: "0.05em",
                    }}>ИГРАЕТ</div>
                  )}
                </div>

                {/* Инфо */}
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ color: "white", fontWeight: 700, fontSize: "13px" }}>{game.title}</span>
                  </div>
                  <span style={{
                    display: "inline-block", fontSize: "10px", fontWeight: 700,
                    padding: "2px 8px", borderRadius: "10px", marginBottom: "8px",
                    background: `${game.color}15`, color: game.color,
                    border: `1px solid ${game.color}30`,
                  }}>{game.tag}</span>
                  <p style={{ color: "rgba(255,255,255,0.38)", fontSize: "11px", lineHeight: "1.5", marginBottom: "12px" }}>
                    {game.desc}
                  </p>
                  <button
                    style={{
                      width: "100%", padding: "8px",
                      background: isActive ? `${game.color}25` : `${game.color}15`,
                      border: `1px solid ${game.color}40`,
                      borderRadius: "8px", color: game.color,
                      fontWeight: 700, fontSize: "12px", cursor: "pointer",
                      fontFamily: "'Exo 2', Arial, sans-serif",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                      transition: "all 0.2s",
                    }}
                  >
                    <Icon name={isActive ? "Square" : "Play"} size={12} />
                    {isActive ? "ОСТАНОВИТЬ" : "ИГРАТЬ"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Подсказка */}
        <div className="text-center mt-10">
          <p className="text-white/25 text-xs">
            Скажи Симоне «хочу создать игру» — она соберёт твою игру и запустит прямо в чате
          </p>
        </div>
      </div>
    </section>
  );
}
