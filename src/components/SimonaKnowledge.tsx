import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import Icon from "@/components/ui/icon";

interface KnowledgeItem {
  cat: string;
  key: string;
  value: string;
  conf: number;
  uses: number;
  at: string;
}

const AVATAR = "https://cdn.poehali.dev/projects/525cd767-a619-4b4b-a667-a1ccdebc1647/files/b020858b-34ca-4cb0-9f0e-682dcff2c229.jpg";

const CAT_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  tech:         { label: "Технологии",   color: "#00f5ff", icon: "Code2" },
  fact:         { label: "Факты",        color: "#a855f7", icon: "Lightbulb" },
  trend:        { label: "Тренды",       color: "#f97316", icon: "TrendingUp" },
  learned:      { label: "Изученное",    color: "#4ade80", icon: "GraduationCap" },
  search_cache: { label: "Поиск",        color: "#facc15", icon: "Search" },
  preference:   { label: "Предпочтения", color: "#f472b6", icon: "Heart" },
};

const ALL_CATS = ["all", ...Object.keys(CAT_LABELS)];

export default function SimonaKnowledge() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total: number; avgConf: number; todayLearned: number } | null>(null);

  useEffect(() => {
    loadKnowledge();
    loadStats();
  }, []);

  const loadKnowledge = async (cat?: string) => {
    setLoading(true);
    try {
      const data = await api.assistantProfile();
      // грузим знания через отдельный запрос
      const userKey = api.getUserKey();
      const res = await fetch(
        "https://functions.poehali.dev/1b9b6f10-bfb6-4337-9bee-f2feed595c2b",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-Key": userKey },
          body: JSON.stringify({ action: "get_knowledge", limit: 100, ...(cat && cat !== "all" ? { category: cat } : {}) }),
        }
      );
      const d = await res.json();
      setItems(d.items || []);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await api.assistantProfile();
      if (data.knowledge) {
        setStats({
          total: data.knowledge.total_facts,
          avgConf: data.knowledge.avg_confidence,
          todayLearned: data.knowledge.learned_today,
        });
      }
    } catch (_e) { /* ignore */ }
  };

  const handleFilter = (cat: string) => {
    setFilter(cat);
    loadKnowledge(cat === "all" ? undefined : cat);
  };

  const filtered = items.filter(item => {
    if (search) {
      const s = search.toLowerCase();
      return item.key.toLowerCase().includes(s) || item.value.toLowerCase().includes(s);
    }
    return true;
  });

  const confColor = (conf: number) => {
    if (conf >= 0.85) return "#4ade80";
    if (conf >= 0.65) return "#facc15";
    return "#f97316";
  };

  const timeAgo = (dateStr: string) => {
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const h = Math.floor(diff / 3600000);
      if (h < 1) return "только что";
      if (h < 24) return `${h}ч назад`;
      const d = Math.floor(h / 24);
      if (d < 30) return `${d}д назад`;
      return `${Math.floor(d / 30)}мес назад`;
    } catch { return ""; }
  };

  return (
    <div style={{ fontFamily: "'Exo 2', Arial, sans-serif" }}>
      {/* Хедер */}
      <div style={{
        display: "flex", alignItems: "center", gap: "20px",
        marginBottom: "32px", flexWrap: "wrap",
      }}>
        <div style={{ position: "relative" }}>
          <img src={AVATAR} alt="Симона" style={{
            width: 72, height: 72, borderRadius: "50%",
            border: "3px solid rgba(0,245,255,0.6)",
            objectFit: "cover",
            boxShadow: "0 0 20px rgba(0,245,255,0.3)",
          }} />
          <div style={{
            position: "absolute", bottom: 2, right: 2,
            width: 14, height: 14, borderRadius: "50%",
            background: "#4ade80", border: "2px solid #050810",
          }} />
        </div>
        <div>
          <div style={{ color: "#00f5ff", fontWeight: 800, fontSize: "22px", letterSpacing: "0.05em" }}>
            БАЗА ЗНАНИЙ СИМОНЫ
          </div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", marginTop: "2px" }}>
            Самообучающийся ИИ-ассистент · знания растут из каждого разговора
          </div>
        </div>

        {stats && (
          <div style={{ marginLeft: "auto", display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {[
              { label: "фактов", value: stats.total, color: "#00f5ff" },
              { label: "уверенность", value: `${Math.round(stats.avgConf * 100)}%`, color: "#a855f7" },
              { label: "сегодня", value: `+${stats.todayLearned}`, color: "#4ade80" },
            ].map(s => (
              <div key={s.label} style={{
                textAlign: "center", padding: "10px 16px",
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${s.color}30`,
                borderRadius: "10px",
              }}>
                <div style={{ color: s.color, fontWeight: 800, fontSize: "20px" }}>{s.value}</div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "10px", marginTop: "2px" }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Поиск */}
      <div style={{
        display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap",
      }}>
        <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
          <Icon name="Search" size={14} style={{
            position: "absolute", left: "12px", top: "50%",
            transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)",
          }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по базе знаний..."
            style={{
              width: "100%", padding: "10px 12px 10px 34px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(0,245,255,0.2)",
              borderRadius: "8px", color: "white",
              fontSize: "13px", outline: "none",
              fontFamily: "'Exo 2', Arial, sans-serif",
              boxSizing: "border-box",
            }}
          />
        </div>
        <button
          onClick={() => loadKnowledge(filter === "all" ? undefined : filter)}
          style={{
            padding: "10px 16px", background: "rgba(0,245,255,0.1)",
            border: "1px solid rgba(0,245,255,0.3)", borderRadius: "8px",
            color: "#00f5ff", cursor: "pointer", fontSize: "12px",
            fontFamily: "'Exo 2', Arial, sans-serif", display: "flex",
            alignItems: "center", gap: "6px",
          }}
        >
          <Icon name="RefreshCw" size={12} />
          Обновить
        </button>
      </div>

      {/* Фильтры */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
        {ALL_CATS.map(cat => {
          const info = cat === "all" ? { label: "Все", color: "rgba(255,255,255,0.6)", icon: "Grid3x3" } : CAT_LABELS[cat];
          if (!info) return null;
          const active = filter === cat;
          return (
            <button key={cat} onClick={() => handleFilter(cat)} style={{
              padding: "6px 14px",
              background: active ? `${info.color}20` : "rgba(255,255,255,0.04)",
              border: `1px solid ${active ? info.color : "rgba(255,255,255,0.1)"}`,
              borderRadius: "20px", cursor: "pointer",
              color: active ? info.color : "rgba(255,255,255,0.4)",
              fontSize: "12px", fontFamily: "'Exo 2', Arial, sans-serif",
              display: "flex", alignItems: "center", gap: "5px",
              transition: "all 0.2s",
            }}>
              <Icon name={info.icon as "Code2"} size={11} />
              {info.label}
            </button>
          );
        })}
      </div>

      {/* Список знаний */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.3)" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginBottom: "12px" }}>
            {[0,1,2].map(n => (
              <div key={n} style={{
                width: 8, height: 8, borderRadius: "50%", background: "#00f5ff",
                animation: `pulse 1.2s ease-in-out ${n*0.2}s infinite`, opacity: 0.6,
              }} />
            ))}
          </div>
          Загружаю базу знаний...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.3)" }}>
          <Icon name="Brain" size={32} style={{ marginBottom: "12px", opacity: 0.3 }} />
          <div>Знаний пока нет. Поговори с Симоной — она научится!</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {filtered.map((item, i) => {
            const catInfo = CAT_LABELS[item.cat] || { label: item.cat, color: "#ffffff", icon: "Circle" };
            const isExp = expanded === `${item.cat}-${item.key}`;
            return (
              <div
                key={i}
                onClick={() => setExpanded(isExp ? null : `${item.cat}-${item.key}`)}
                style={{
                  padding: "14px 16px",
                  background: isExp ? "rgba(0,245,255,0.04)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isExp ? catInfo.color + "40" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: "10px", cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {/* Категория */}
                  <div style={{
                    padding: "3px 8px", borderRadius: "12px", fontSize: "10px", fontWeight: 700,
                    background: `${catInfo.color}15`, color: catInfo.color,
                    border: `1px solid ${catInfo.color}30`, whiteSpace: "nowrap",
                    display: "flex", alignItems: "center", gap: "4px",
                  }}>
                    <Icon name={catInfo.icon as "Code2"} size={9} />
                    {catInfo.label}
                  </div>

                  {/* Ключ */}
                  <div style={{
                    flex: 1, color: "rgba(255,255,255,0.85)", fontSize: "13px", fontWeight: 600,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {item.key}
                  </div>

                  {/* Уверенность */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                    <div style={{
                      width: 32, height: 4, borderRadius: 2,
                      background: "rgba(255,255,255,0.1)", overflow: "hidden",
                    }}>
                      <div style={{
                        width: `${item.conf * 100}%`, height: "100%",
                        background: confColor(item.conf), borderRadius: 2,
                      }} />
                    </div>
                    <span style={{ color: confColor(item.conf), fontSize: "11px", fontWeight: 700, width: "32px" }}>
                      {Math.round(item.conf * 100)}%
                    </span>
                  </div>

                  {/* Использований */}
                  <div style={{
                    color: "rgba(255,255,255,0.25)", fontSize: "10px",
                    display: "flex", alignItems: "center", gap: "3px", flexShrink: 0,
                  }}>
                    <Icon name="BarChart2" size={9} />
                    {item.uses}
                  </div>

                  {/* Время */}
                  <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px", flexShrink: 0 }}>
                    {timeAgo(item.at)}
                  </div>

                  <Icon name={isExp ? "ChevronUp" : "ChevronDown"} size={12}
                    style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
                </div>

                {/* Раскрытый текст */}
                {isExp && (
                  <div style={{
                    marginTop: "12px", paddingTop: "12px",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.65)", fontSize: "12px",
                    lineHeight: "1.7",
                  }}>
                    {item.value}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Подсказка */}
      {!loading && filtered.length > 0 && (
        <div style={{
          marginTop: "20px", padding: "12px 16px",
          background: "rgba(0,245,255,0.03)",
          border: "1px solid rgba(0,245,255,0.1)",
          borderRadius: "8px", color: "rgba(255,255,255,0.3)",
          fontSize: "11px", display: "flex", alignItems: "center", gap: "8px",
        }}>
          <Icon name="Info" size={12} style={{ color: "#00f5ff", flexShrink: 0 }} />
          Симона учится из каждого разговора и веб-поиска. Чем больше общаешься — тем умнее она становится!
        </div>
      )}
    </div>
  );
}