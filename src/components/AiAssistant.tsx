import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import Icon from "@/components/ui/icon";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ProjectReady {
  type: "game" | "site" | "bot";
  title: string;
  description: string;
  ready: boolean;
}

interface AiAssistantProps {
  onProjectReady?: (project: ProjectReady) => void;
  onClose?: () => void;
  embedded?: boolean;
  onGameCommand?: (cmd: string) => void;
}

const QUICK_STARTS = [
  { label: "Создать игру", icon: "Gamepad2", text: "Хочу создать игру" },
  { label: "Создать сайт", icon: "Globe", text: "Хочу создать сайт" },
  { label: "Создать бота", icon: "Bot", text: "Хочу создать Telegram-бота" },
  { label: "Найти в сети", icon: "Search", text: "Найди что нового в разработке игр 2024" },
];

const TYPE_LABELS: Record<string, string> = {
  game: "Игра",
  site: "Сайт",
  bot: "Бот",
};

const GAME_COMMANDS: Record<string, string> = {
  "запусти демо-игру": "start",
  "запусти игру": "start",
  "начни игру": "start",
  "старт": "start",
  "включи ии режим": "ai",
  "ии играет": "ai",
  "перезапусти игру": "restart",
  "заново": "restart",
};

export default function AiAssistant({ onProjectReady, onClose, embedded = false, onGameCommand }: AiAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Привет! Я Симона, твой личный ИИ-разработчик. Расскажи — что хочешь создать? Игру, сайт или бота?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [projectReady, setProjectReady] = useState<ProjectReady | null>(null);
  const [trust, setTrust] = useState(0);
  const [profile, setProfile] = useState<{name?: string; level?: string} | null>(null);
  const [loadingHint, setLoadingHint] = useState("думаю");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    api.assistantProfile().then((d) => {
      if (d.trust !== undefined) setTrust(d.trust);
      if (d.name || d.level) setProfile({ name: d.name, level: d.level });
      if (d.name) {
        setMessages([{ role: "assistant", content: `С возвращением, ${d.name}! Рада снова тебя видеть 😊 Что создаём?` }]);
      }
    }).catch(() => {});
  }, []);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    // Локальные команды для игры
    const msgLower = msg.toLowerCase();
    const gameCmd = Object.entries(GAME_COMMANDS).find(([key]) => msgLower.includes(key));
    if (gameCmd && onGameCommand) {
      onGameCommand(gameCmd[1]);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: msg },
        { role: "assistant", content: "Запускаю! Управление: ← → ↑ ↓ + Пробел. Удачи!" },
      ]);
      return;
    }

    const userMsg: Message = { role: "user", content: msg };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    const isSearch = /найди|поищи|погугли|что такое|как работает|что нового/i.test(msg);
    setLoadingHint(isSearch ? "ищу в интернете 🌐" : "думаю 🧠");
    setLoading(true);

    try {
      const data = await api.assistantChat(msg, history);
      const reply = data.reply || "Что-то пошло не так, попробуй ещё раз.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      if (data.trust !== undefined) setTrust(data.trust);
      if (data.project_ready) setProjectReady(data.project_ready);
      if (data.game_cmd && onGameCommand) {
        onGameCommand(data.game_cmd);
      }
      if (data.learned) {
        setMessages((prev) => [...prev, {
          role: "assistant" as const,
          content: "🧠 _Сохранила в базу знаний_",
        }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Ошибка соединения. Попробуй ещё раз." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleProjectCreate = () => {
    if (projectReady && onProjectReady) {
      onProjectReady(projectReady);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: embedded ? "100%" : "600px",
        background: "rgba(0,0,0,0.85)",
        border: "1px solid rgba(0,245,255,0.2)",
        borderRadius: embedded ? "0" : "16px",
        overflow: "hidden",
        backdropFilter: "blur(20px)",
        fontFamily: "'Exo 2', Arial, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "16px 20px",
          borderBottom: "1px solid rgba(0,245,255,0.15)",
          background: "rgba(0,245,255,0.05)",
          flexShrink: 0,
        }}
      >
        <img
          src="https://cdn.poehali.dev/projects/525cd767-a619-4b4b-a667-a1ccdebc1647/files/b020858b-34ca-4cb0-9f0e-682dcff2c229.jpg"
          alt="Симона"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "2px solid rgba(0,245,255,0.5)",
            objectFit: "cover",
            flexShrink: 0,
            boxShadow: "0 0 12px rgba(0,245,255,0.3)",
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#00f5ff", fontWeight: 700, fontSize: "14px", letterSpacing: "0.05em" }}>
            СИМОНА — ИИ-разработчик
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
              <div style={{ width: `${Math.min(trust, 100)}%`, height: "100%",
                background: trust < 30 ? "#00f5ff" : trust < 60 ? "#a855f7" : "#f97316",
                transition: "width 0.5s ease", borderRadius: 2 }} />
            </div>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "10px", whiteSpace: "nowrap" }}>
              {trust < 10 ? "новичок" : trust < 30 ? "знакомый" : trust < 60 ? "друг" : "лучший друг"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80" }} />
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px" }}>онлайн</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: "4px", lineHeight: 1 }}
          >
            <Icon name="X" size={16} />
          </button>
        )}
      </div>

      {/* Quick starts — только если нет сообщений от юзера */}
      {messages.length === 1 && (
        <div style={{ display: "flex", gap: "8px", padding: "12px 16px 0", flexShrink: 0 }}>
          {QUICK_STARTS.map((q) => (
            <button
              key={q.label}
              onClick={() => send(q.text)}
              style={{
                flex: 1,
                background: "rgba(0,245,255,0.05)",
                border: "1px solid rgba(0,245,255,0.2)",
                borderRadius: "8px",
                padding: "8px 6px",
                cursor: "pointer",
                color: "rgba(255,255,255,0.7)",
                fontSize: "11px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                transition: "all 0.2s",
                fontFamily: "'Exo 2', Arial, sans-serif",
              }}
            >
              <Icon name={q.icon as "Gamepad2"} size={16} />
              {q.label}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              gap: "8px",
              alignItems: "flex-end",
            }}
          >
            {msg.role === "assistant" && (
              <img
                src="https://cdn.poehali.dev/projects/525cd767-a619-4b4b-a667-a1ccdebc1647/files/b020858b-34ca-4cb0-9f0e-682dcff2c229.jpg"
                alt="Симона"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: "1px solid rgba(0,245,255,0.4)",
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
            )}
            <div
              style={{
                maxWidth: "78%",
                padding: "10px 14px",
                borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: msg.role === "user"
                  ? "linear-gradient(135deg, rgba(0,245,255,0.2), rgba(124,58,237,0.2))"
                  : "rgba(255,255,255,0.06)",
                border: msg.role === "user"
                  ? "1px solid rgba(0,245,255,0.3)"
                  : "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.9)",
                fontSize: "13px",
                lineHeight: "1.6",
                fontFamily: "'Exo 2', Arial, sans-serif",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {msg.content.split('\n').map((line, li) => {
                // bold **text**, italic _text_, маркеры •
                const parts = line.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
                return (
                  <div key={li} style={{ marginBottom: li < msg.content.split('\n').length - 1 ? "4px" : 0 }}>
                    {parts.map((part, pi) => {
                      if (part.startsWith('**') && part.endsWith('**'))
                        return <strong key={pi} style={{ color: "#00f5ff" }}>{part.slice(2, -2)}</strong>;
                      if (part.startsWith('_') && part.endsWith('_'))
                        return <em key={pi} style={{ color: "rgba(255,255,255,0.45)", fontSize: "11px" }}>{part.slice(1, -1)}</em>;
                      return <span key={pi}>{part}</span>;
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
            <img
              src="https://cdn.poehali.dev/projects/525cd767-a619-4b4b-a667-a1ccdebc1647/files/b020858b-34ca-4cb0-9f0e-682dcff2c229.jpg"
              alt="Симона"
              style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid rgba(0,245,255,0.4)", objectFit: "cover", flexShrink: 0 }}
            />
            <div style={{ padding: "10px 14px", borderRadius: "16px 16px 16px 4px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: "4px", alignItems: "center" }}>
              {[0, 1, 2].map((n) => (
                <div
                  key={n}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#00f5ff",
                    animation: `pulse 1.2s ease-in-out ${n * 0.2}s infinite`,
                    opacity: 0.6,
                  }}
                />
              ))}
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "10px", marginLeft: "6px" }}>
                {loadingHint}
              </span>
            </div>
          </div>
        )}

        {/* Project ready card */}
        {projectReady && (
          <div
            style={{
              border: "1px solid rgba(74,222,128,0.4)",
              borderRadius: "12px",
              padding: "14px 16px",
              background: "rgba(74,222,128,0.06)",
            }}
          >
            <div style={{ color: "#4ade80", fontSize: "11px", fontWeight: 700, marginBottom: "6px", letterSpacing: "0.08em" }}>
              ✓ ПРОЕКТ ГОТОВ К СОЗДАНИЮ
            </div>
            <div style={{ color: "white", fontWeight: 700, fontSize: "14px", marginBottom: "2px" }}>
              {projectReady.title}
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px", marginBottom: "12px" }}>
              {TYPE_LABELS[projectReady.type] || projectReady.type}
            </div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "12px", lineHeight: "1.5", marginBottom: "12px" }}>
              {projectReady.description}
            </div>
            {onProjectReady && (
              <button
                onClick={handleProjectCreate}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "linear-gradient(135deg, #00f5ff, #7c3aed)",
                  border: "none",
                  borderRadius: "8px",
                  color: "black",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  fontFamily: "'Exo 2', Arial, sans-serif",
                  letterSpacing: "0.05em",
                }}
              >
                СОЗДАТЬ ПРОЕКТ →
              </button>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid rgba(0,245,255,0.1)",
          display: "flex",
          gap: "10px",
          alignItems: "flex-end",
          flexShrink: 0,
          background: "rgba(0,0,0,0.3)",
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Опиши что хочешь создать..."
          rows={1}
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(0,245,255,0.2)",
            borderRadius: "10px",
            padding: "10px 14px",
            color: "rgba(255,255,255,0.9)",
            fontSize: "13px",
            lineHeight: "1.5",
            resize: "none",
            outline: "none",
            fontFamily: "'Exo 2', Arial, sans-serif",
            maxHeight: "100px",
            overflowY: "auto",
            wordSpacing: "0.1em",
          }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 100) + "px";
          }}
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          style={{
            width: 40,
            height: 40,
            borderRadius: "10px",
            background: input.trim() && !loading
              ? "linear-gradient(135deg, #00f5ff, #7c3aed)"
              : "rgba(255,255,255,0.1)",
            border: "none",
            cursor: input.trim() && !loading ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.2s",
            color: input.trim() && !loading ? "black" : "rgba(255,255,255,0.3)",
          }}
        >
          <Icon name="Send" size={16} />
        </button>
      </div>
    </div>
  );
}