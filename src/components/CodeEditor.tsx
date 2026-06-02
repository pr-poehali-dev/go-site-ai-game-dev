import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";

interface CodeEditorProps {
  project: {
    id: number;
    title: string;
    genre?: string;
    engine?: string;
    platform?: string;
    description?: string;
    ai_mechanics?: string[];
    progress?: number;
    status?: string;
  };
  onClose: () => void;
}

const STARTER_CODE: Record<string, string> = {
  "Godot": `extends Node2D

# === NEXUS AI — Стартовый шаблон ===
# Движок: Godot 4 | GDScript

var score: int = 0
var lives: int = 3
var speed: float = 200.0

func _ready() -> void:
\tprint("Игра запущена!")
\tstart_game()

func _process(delta: float) -> void:
\tif Input.is_action_pressed("ui_right"):
\t\tposition.x += speed * delta
\tif Input.is_action_pressed("ui_left"):
\t\tposition.x -= speed * delta

func start_game() -> void:
\tscore = 0
\tlives = 3
\t# TODO: инициализировать уровень

func add_score(points: int) -> void:
\tscore += points
\tprint("Счёт: ", score)

func take_damage() -> void:
\tlives -= 1
\tif lives <= 0:
\t\tgame_over()

func game_over() -> void:
\tprint("Игра окончена! Итог: ", score)
\t# TODO: показать экран game over
`,
  "Unity": `using UnityEngine;

// === NEXUS AI — Стартовый шаблон ===
// Движок: Unity | C#

public class PlayerController : MonoBehaviour
{
    public float speed = 5f;
    public int lives = 3;
    private int score = 0;

    void Start()
    {
        Debug.Log("Игра запущена!");
    }

    void Update()
    {
        float h = Input.GetAxis("Horizontal");
        float v = Input.GetAxis("Vertical");
        
        Vector3 move = new Vector3(h, 0, v) * speed * Time.deltaTime;
        transform.Translate(move);

        if (Input.GetKeyDown(KeyCode.Space))
            Shoot();
    }

    void Shoot()
    {
        // TODO: создать пулю
        Debug.Log("Выстрел!");
    }

    public void AddScore(int points)
    {
        score += points;
        Debug.Log("Счёт: " + score);
    }

    public void TakeDamage()
    {
        lives--;
        if (lives <= 0)
            GameOver();
    }

    void GameOver()
    {
        Debug.Log("Игра окончена! Итог: " + score);
        // TODO: показать экран game over
    }
}
`,
  "Unreal": `// === NEXUS AI — Стартовый шаблон ===
// Движок: Unreal Engine | C++
// AMyCharacter.h

#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "AMyCharacter.generated.h"

UCLASS()
class MYGAME_API AMyCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    AMyCharacter();

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float MoveSpeed = 500.f;

    UPROPERTY(BlueprintReadOnly)
    int32 Score = 0;

    UPROPERTY(BlueprintReadOnly)
    int32 Lives = 3;

protected:
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaTime) override;
    virtual void SetupPlayerInputComponent(
        class UInputComponent* InputComp) override;

    void MoveForward(float Value);
    void MoveRight(float Value);
    void Shoot();

public:
    UFUNCTION(BlueprintCallable)
    void AddScore(int32 Points);

    UFUNCTION(BlueprintCallable)
    void TakeDamage(int32 Damage);
};
`,
};

const DEFAULT_CODE = `// === NEXUS AI — Стартовый шаблон ===
// Язык: JavaScript / TypeScript

class Game {
  constructor() {
    this.score = 0;
    this.lives = 3;
    this.running = false;
  }

  start() {
    this.running = true;
    console.log("Игра запущена!");
    this.gameLoop();
  }

  gameLoop() {
    if (!this.running) return;
    this.update();
    requestAnimationFrame(() => this.gameLoop());
  }

  update() {
    // TODO: основная логика игры
  }

  addScore(points) {
    this.score += points;
    console.log(\`Счёт: \${this.score}\`);
  }

  takeDamage() {
    this.lives--;
    if (this.lives <= 0) this.gameOver();
  }

  gameOver() {
    this.running = false;
    console.log(\`Игра окончена! Итог: \${this.score}\`);
  }
}

const game = new Game();
game.start();
`;

const KEYWORDS = ["var", "func", "if", "else", "return", "for", "while", "class", "extends",
  "void", "int", "float", "string", "bool", "public", "private", "const", "let",
  "new", "this", "null", "true", "false", "override", "virtual", "static",
  "function", "import", "export", "from", "async", "await", "=>"];

function highlight(code: string): string {
  return code
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/(#[^\n]*|\/\/[^\n]*)/g, '<span style="color:#5c6773">$1</span>')
    .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, '<span style="color:#b8cc52">$1</span>')
    .replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#ffcc66">$1</span>')
    .replace(new RegExp(`\\b(${KEYWORDS.join("|")})\\b`, "g"), '<span style="color:#e06c75">$1</span>')
    .replace(/\b([A-Z][a-zA-Z0-9_]*)\b/g, '<span style="color:#e5c07b">$1</span>')
    .replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g, '<span style="color:#61afef">$1</span>');
}

export default function CodeEditor({ project, onClose }: CodeEditorProps) {
  const engine = project.engine || "Custom";
  const [code, setCode] = useState(STARTER_CODE[engine] || DEFAULT_CODE);
  const [activeFile, setActiveFile] = useState("main");
  const [output, setOutput] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<"code" | "console" | "ai">(  "code");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const files = [
    { id: "main", name: engine === "Godot" ? "player.gd" : engine === "Unity" ? "PlayerController.cs" : engine === "Unreal" ? "AMyCharacter.h" : "game.js", icon: "FileCode" },
    { id: "ai", name: "ai_agent.js", icon: "Brain" },
    { id: "config", name: "game.config.json", icon: "Settings" },
  ];

  const configCode = `{
  "title": "${project.title}",
  "engine": "${engine}",
  "platform": "${project.platform || "all"}",
  "version": "0.1.0",
  "ai_enabled": true,
  "mechanics": ${JSON.stringify(project.ai_mechanics || [], null, 2)},
  "settings": {
    "max_fps": 60,
    "resolution": [1920, 1080],
    "fullscreen": false,
    "sound_volume": 0.8
  }
}`;

  const aiAgentCode = `// === NEXUS AI — Самообучающийся агент ===

class NexusAgent {
  constructor() {
    this.generation = 0;
    this.gamesPlayed = 0;
    this.bestScore = 0;
    // Веса нейросети [входы: 8, скрытый: 16, выходы: 4]
    this.weights = this.initWeights([8, 16, 4]);
  }

  initWeights(layers) {
    return layers.slice(0, -1).map((size, i) => ({
      W: Array.from({length: size}, () =>
        Array.from({length: layers[i+1]}, () =>
          (Math.random() - 0.5) * 0.5)),
      b: Array(layers[i+1]).fill(0)
    }));
  }

  // Прямой проход нейросети
  forward(input) {
    let current = input;
    for (const layer of this.weights) {
      current = layer.W[0].map((_, j) =>
        Math.max(0, // ReLU
          current.reduce((s, x, i) => s + x * layer.W[i][j], layer.b[j])
        )
      );
    }
    return current; // [влево, вправо, вверх, стрелять]
  }

  // Мутация после каждой игры
  evolve(score) {
    if (score > this.bestScore) {
      this.bestScore = score;
    }
    this.generation++;
    this.gamesPlayed++;
    // Мутируем веса с адаптивной силой
    const rate = score < 100 ? 0.15 : 0.05;
    this.mutateWeights(rate);
    console.log(\`Gen \${this.generation} | Лучший: \${this.bestScore}\`);
  }

  mutateWeights(rate) {
    this.weights.forEach(layer => {
      layer.W.forEach(row =>
        row.forEach((_, j) => {
          if (Math.random() < rate)
            row[j] += (Math.random() - 0.5) * 0.3;
        })
      );
    });
  }
}

export const agent = new NexusAgent();
`;

  const getFileCode = (fileId: string) => {
    if (fileId === "config") return configCode;
    if (fileId === "ai") return aiAgentCode;
    return code;
  };

  const currentCode = activeFile === "config" ? configCode : activeFile === "ai" ? aiAgentCode : code;

  const syncScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const handleRun = () => {
    setRunning(true);
    setTab("console");
    setOutput([]);
    const lines = [
      `[${new Date().toLocaleTimeString()}] > Компиляция ${project.title}...`,
      `[${new Date().toLocaleTimeString()}] ✓ Синтаксис корректен`,
      `[${new Date().toLocaleTimeString()}] > Запуск в среде ${engine}...`,
      `[${new Date().toLocaleTimeString()}] ✓ Инициализация сцены`,
      `[${new Date().toLocaleTimeString()}] Игра запущена!`,
      `[${new Date().toLocaleTimeString()}] > Счёт: 0 | Жизни: 3`,
    ];
    lines.forEach((line, i) => {
      setTimeout(() => {
        setOutput(prev => [...prev, line]);
        if (i === lines.length - 1) setRunning(false);
      }, i * 300);
    });
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAI = async () => {
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    setAiAnswer("");
    const q = aiQuestion;
    setAiQuestion("");

    const res = await api.chatWithAI(q, {
      description: project.description || project.title,
      engine: engine,
      genre: project.genre || "",
    }, "game").catch(() => null);

    setAiAnswer(res?.answer || "Не удалось получить ответ. Проверь подключение к ИИ.");
    setAiLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#0a0d16" }}>
      {/* Топбар */}
      <div className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
        style={{ borderColor: "rgba(255,107,0,0.2)", background: "rgba(255,107,0,0.05)" }}>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full cursor-pointer hover:opacity-80" style={{ background: "#ff5f56" }} onClick={onClose} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#ffbd2e" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#27c93f" }} />
          </div>
          <div className="font-mono text-xs text-white/30">
            nexus-ide ~/projects/<span style={{ color: "#ff6b00" }}>{project.title.toLowerCase().replace(/\s+/g, "-")}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2 py-1 rounded"
            style={{ background: "rgba(255,107,0,0.1)", color: "#ff6b00", border: "1px solid rgba(255,107,0,0.2)" }}>
            {engine}
          </span>
          <button onClick={handleSave}
            className="px-3 py-1.5 rounded text-xs font-orbitron font-bold flex items-center gap-1.5 transition-all"
            style={{ background: saved ? "rgba(0,255,136,0.15)" : "rgba(255,255,255,0.05)", color: saved ? "#00ff88" : "rgba(255,255,255,0.5)", border: `1px solid ${saved ? "rgba(0,255,136,0.3)" : "rgba(255,255,255,0.1)"}` }}>
            <Icon name={saved ? "CheckCircle" : "Save"} size={12} />
            {saved ? "СОХРАНЕНО" : "СОХРАНИТЬ"}
          </button>
          <button onClick={handleRun}
            className="px-3 py-1.5 rounded text-xs font-orbitron font-bold flex items-center gap-1.5"
            style={{ background: "rgba(0,245,255,0.15)", color: "#00f5ff", border: "1px solid rgba(0,245,255,0.3)" }}>
            <Icon name={running ? "Loader" : "Play"} size={12} className={running ? "animate-spin" : ""} />
            ЗАПУСТИТЬ
          </button>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors ml-2">
            <Icon name="X" size={18} />
          </button>
        </div>
      </div>

      {/* Основная область */}
      <div className="flex flex-1 overflow-hidden">
        {/* Сайдбар — файлы */}
        <div className="w-44 border-r flex-shrink-0 flex flex-col"
          style={{ borderColor: "rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.3)" }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <div className="text-xs font-mono text-white/25 tracking-widest">ФАЙЛЫ</div>
          </div>
          <div className="py-2">
            {files.map(f => (
              <button key={f.id} onClick={() => { setActiveFile(f.id); setTab("code"); }}
                className="w-full text-left px-3 py-2 flex items-center gap-2 text-xs font-mono transition-all"
                style={{
                  background: activeFile === f.id ? "rgba(255,107,0,0.1)" : "transparent",
                  color: activeFile === f.id ? "#ff6b00" : "rgba(255,255,255,0.4)",
                  borderLeft: activeFile === f.id ? "2px solid #ff6b00" : "2px solid transparent",
                }}>
                <Icon name={f.icon as "FileCode"} size={12} />
                {f.name}
              </button>
            ))}
          </div>

          {/* Инфо проекта */}
          <div className="mt-auto p-3 border-t space-y-2" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <div className="text-xs font-mono text-white/20">ПРОЕКТ</div>
            <div className="text-xs text-white/50 truncate">{project.title}</div>
            {project.genre && <div className="text-xs font-mono" style={{ color: "rgba(255,107,0,0.6)" }}>{project.genre}</div>}
            <div className="mt-1">
              <div className="text-xs text-white/20 mb-1">{project.progress || 5}%</div>
              <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                <div className="h-1 rounded-full" style={{ width: `${project.progress || 5}%`, background: "#ff6b00", boxShadow: "0 0 4px #ff6b00" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Центр — редактор / консоль / ИИ */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Табы */}
          <div className="flex items-center border-b px-4" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            {[
              { id: "code", label: "КОД", icon: "Code" },
              { id: "console", label: "КОНСОЛЬ", icon: "Terminal" },
              { id: "ai", label: "ИИ-ПОМОЩНИК", icon: "Bot" },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
                className="px-4 py-2.5 text-xs font-orbitron font-bold flex items-center gap-1.5 border-b-2 transition-all"
                style={{
                  borderColor: tab === t.id ? "#ff6b00" : "transparent",
                  color: tab === t.id ? "#ff6b00" : "rgba(255,255,255,0.3)",
                }}>
                <Icon name={t.icon as "Code"} size={12} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Редактор кода */}
          {tab === "code" && (
            <div className="flex-1 overflow-hidden relative" style={{ fontFamily: "monospace" }}>
              {/* Подсветка синтаксиса (позади textarea) */}
              <div
                ref={highlightRef}
                aria-hidden
                className="absolute inset-0 overflow-auto pointer-events-none p-4 text-sm leading-6 whitespace-pre"
                style={{ color: "transparent", zIndex: 1 }}
                dangerouslySetInnerHTML={{ __html: highlight(currentCode) + "\n" }}
              />
              {/* Реальная textarea поверх */}
              <textarea
                ref={textareaRef}
                value={activeFile === "main" ? code : currentCode}
                readOnly={activeFile !== "main"}
                onChange={e => activeFile === "main" && setCode(e.target.value)}
                onScroll={syncScroll}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                className="absolute inset-0 w-full h-full p-4 text-sm leading-6 resize-none outline-none bg-transparent whitespace-pre overflow-auto"
                style={{
                  color: activeFile === "main" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.5)",
                  caretColor: "#ff6b00",
                  zIndex: 2,
                  fontFamily: "'Courier New', 'Consolas', monospace",
                  letterSpacing: "0 !important" as string,
                  wordSpacing: "0px",
                  tabSize: 2,
                }}
              />
            </div>
          )}

          {/* Консоль */}
          {tab === "console" && (
            <div className="flex-1 overflow-auto p-4" style={{ background: "#050810" }}>
              <div className="font-mono text-xs space-y-1">
                {output.length === 0 && (
                  <div className="text-white/25">// Нажми ЗАПУСТИТЬ чтобы увидеть вывод...</div>
                )}
                {output.map((line, i) => (
                  <div key={i} style={{
                    color: line.includes("✓") ? "#00ff88" : line.includes("Игра") ? "#00f5ff" : "rgba(255,255,255,0.6)"
                  }}>{line}</div>
                ))}
                {running && <div className="text-white/40 animate-pulse">▋</div>}
              </div>
            </div>
          )}

          {/* ИИ-помощник */}
          {tab === "ai" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-auto p-4 space-y-3">
                <div className="rounded-lg p-3 border text-sm"
                  style={{ borderColor: "rgba(191,0,255,0.2)", background: "rgba(191,0,255,0.05)", color: "rgba(255,255,255,0.7)" }}>
                  <div className="flex items-center gap-2 mb-2 text-xs font-orbitron" style={{ color: "#bf00ff" }}>
                    <Icon name="Bot" size={12} /> NEXUS AI · ПОМОЩНИК РАЗРАБОТЧИКА
                  </div>
                  Я знаю всё о проекте «{project.title}». Спроси меня: как сделать врагов, прыжок, систему счёта, уровни или что-то ещё.
                </div>
                {aiAnswer && (
                  <div className="rounded-lg p-3 border text-sm"
                    style={{ borderColor: "rgba(0,245,255,0.15)", background: "rgba(0,245,255,0.04)", color: "rgba(255,255,255,0.8)" }}>
                    <div className="flex items-center gap-2 mb-2 text-xs font-orbitron neon-text-cyan">
                      <Icon name="Brain" size={12} /> ОТВЕТ
                    </div>
                    {aiAnswer}
                  </div>
                )}
              </div>
              <div className="p-4 border-t flex gap-2" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <input
                  value={aiQuestion}
                  onChange={e => setAiQuestion(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAI()}
                  placeholder="Как сделать врагов? Как добавить прыжок?..."
                  className="flex-1 bg-black/30 border rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/25 outline-none"
                  style={{ borderColor: "rgba(191,0,255,0.2)" }}
                />
                <button onClick={handleAI} disabled={aiLoading}
                  className="px-4 py-2 rounded-lg font-orbitron font-bold text-xs flex items-center gap-1.5 flex-shrink-0"
                  style={{ background: "rgba(191,0,255,0.15)", color: "#bf00ff", border: "1px solid rgba(191,0,255,0.3)" }}>
                  <Icon name={aiLoading ? "Loader" : "Send"} size={12} className={aiLoading ? "animate-spin" : ""} />
                  {aiLoading ? "..." : "СПРОСИТЬ"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}