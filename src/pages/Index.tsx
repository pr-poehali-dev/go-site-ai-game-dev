import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { api } from "@/lib/api";
import DemoGame from "@/components/DemoGame";
import PaymentModal from "@/components/PaymentModal";

const NAV_ITEMS = [
  { id: "home", label: "Главная" },
  { id: "generator", label: "Генератор" },
  { id: "demo", label: "Демо" },
  { id: "portfolio", label: "Портфолио" },
  { id: "docs", label: "Документация" },
  { id: "community", label: "Сообщество" },
  { id: "subscription", label: "Подписка" },
  { id: "contacts", label: "Контакты" },
];

const LANGUAGES = [
  { name: "Python", color: "#00f5ff", desc: "ИИ, ML, логика" },
  { name: "C++", color: "#bf00ff", desc: "Движки, производительность" },
  { name: "C#", color: "#00ff88", desc: "Unity, серверная логика" },
  { name: "JavaScript", color: "#ff6b00", desc: "Веб-игры, Three.js" },
  { name: "Rust", color: "#ff00aa", desc: "Системное программирование" },
  { name: "GDScript", color: "#00f5ff", desc: "Godot Engine" },
  { name: "Lua", color: "#bf00ff", desc: "Roblox, встраиваемые игры" },
  { name: "Java", color: "#00ff88", desc: "Android, Minecraft моды" },
  { name: "Swift", color: "#ff6b00", desc: "iOS/macOS игры" },
  { name: "Kotlin", color: "#ff00aa", desc: "Кроссплатформенные игры" },
  { name: "Go", color: "#00f5ff", desc: "Сетевые игры, серверы" },
  { name: "TypeScript", color: "#bf00ff", desc: "Phaser, PixiJS" },
];

const PORTFOLIO_GAMES = [
  { title: "Cosmic Raiders", genre: "Шутер", engine: "Unity", status: "Готово", color: "#00f5ff", desc: "3D космический шутер с ИИ-противниками" },
  { title: "Dragon Quest AI", genre: "RPG", engine: "Unreal", status: "Бета", color: "#bf00ff", desc: "Процедурная RPG с нейросетевым геймплеем" },
  { title: "Neon Runner", genre: "Платформер", engine: "Godot", status: "Готово", color: "#00ff88", desc: "Киберпанк платформер с адаптивной сложностью" },
  { title: "Strategy Zero", genre: "Стратегия", engine: "Custom", status: "Альфа", color: "#ff6b00", desc: "Пошаговая стратегия с ИИ-советником" },
  { title: "Horror Maze", genre: "Хоррор", engine: "Unity", status: "Демо", color: "#ff00aa", desc: "Процедурные лабиринты с поведенческим ИИ" },
  { title: "Space Colony", genre: "Симулятор", engine: "Godot", status: "Готово", color: "#00f5ff", desc: "Симулятор колонии с экономическим ИИ" },
];

const DRAFT_PROJECTS = [
  { title: "Medieval Wars", progress: 34, engine: "Unity", lastEdit: "2 часа назад", color: "#bf00ff" },
  { title: "Alien Escape", progress: 67, engine: "Godot", lastEdit: "1 день назад", color: "#00f5ff" },
  { title: "Cyber City", progress: 12, engine: "Unreal", lastEdit: "5 дней назад", color: "#00ff88" },
];

const SUBSCRIPTION_PLANS = [
  {
    name: "STARTER",
    price: "990",
    color: "#00f5ff",
    features: ["5 игровых проектов", "Базовый генератор ИИ", "Демо-режим", "Базовая документация", "Поддержка сообщества"],
  },
  {
    name: "PRO",
    price: "2 990",
    color: "#bf00ff",
    popular: true,
    features: ["Безлимитные проекты", "Полный ИИ-генератор", "Конвертация ПК↔Мобайл", "Тестирование игр", "Все языки программирования", "Приоритетная поддержка"],
  },
  {
    name: "STUDIO",
    price: "7 990",
    color: "#00ff88",
    features: ["Всё из PRO", "Командный доступ", "Белый лейбл", "API доступ", "Дедикейтед сервер", "Персональный менеджер"],
  },
];

const DOCS_SECTIONS = [
  { icon: "BookOpen", title: "Быстрый старт", desc: "Создай первую игру за 10 минут без кода" },
  { icon: "Cpu", title: "ИИ Генератор", desc: "Как работает нейросеть для создания игр" },
  { icon: "Code", title: "Языки программирования", desc: "Руководства по всем поддерживаемым языкам" },
  { icon: "Smartphone", title: "Конвертация платформ", desc: "ПК в мобайл и обратно — пошаговый гайд" },
  { icon: "TestTube", title: "Тестирование игр", desc: "Автотесты и ИИ-тестировщик" },
  { icon: "DollarSign", title: "API & Интеграции", desc: "Подключение к внешним сервисам" },
];

const AI_FEATURES = [
  { icon: "Wand2", title: "ИИ-программист", desc: "Генерирует 100% кода игры по описанию на русском языке", color: "#00f5ff" },
  { icon: "Palette", title: "ИИ-дизайнер", desc: "Создаёт персонажей, окружение и UI автоматически", color: "#bf00ff" },
  { icon: "FlaskConical", title: "ИИ-тестировщик", desc: "Находит и исправляет баги в реальном времени", color: "#00ff88" },
  { icon: "Smartphone", title: "Конвертер платформ", desc: "Переносит игры с ПК на мобайл и обратно за 1 клик", color: "#ff6b00" },
  { icon: "Music", title: "ИИ-саундтрек", desc: "Генерирует уникальную музыку и звуки для игры", color: "#ff00aa" },
  { icon: "Globe", title: "Мультиязычность", desc: "Автоматический перевод игры на 50+ языков", color: "#00f5ff" },
];

function TypewriterText({ texts }: { texts: string[] }) {
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = texts[index];
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (displayed.length < current.length) {
          setDisplayed(current.slice(0, displayed.length + 1));
        } else {
          setTimeout(() => setIsDeleting(true), 1500);
        }
      } else {
        if (displayed.length > 0) {
          setDisplayed(displayed.slice(0, -1));
        } else {
          setIsDeleting(false);
          setIndex((i) => (i + 1) % texts.length);
        }
      }
    }, isDeleting ? 40 : 80);
    return () => clearTimeout(timeout);
  }, [displayed, isDeleting, index, texts]);

  return (
    <span className="terminal-text text-xl md:text-2xl">
      {displayed}
      <span className="animate-blink">█</span>
    </span>
  );
}

function ParticleField() {
  const particles = [
    { w: 2.5, h: 2.5, c: "#00f5ff", l: 12, t: 23, s: 6, d: 0.5 },
    { w: 1.8, h: 1.8, c: "#bf00ff", l: 34, t: 67, s: 8, d: 1.2 },
    { w: 3.0, h: 3.0, c: "#00ff88", l: 56, t: 12, s: 5, d: 2.1 },
    { w: 1.5, h: 1.5, c: "#00f5ff", l: 78, t: 45, s: 7, d: 0.8 },
    { w: 2.2, h: 2.2, c: "#ff00aa", l: 23, t: 89, s: 4, d: 3.0 },
    { w: 2.8, h: 2.8, c: "#bf00ff", l: 89, t: 34, s: 6, d: 1.5 },
    { w: 1.6, h: 1.6, c: "#00ff88", l: 45, t: 56, s: 9, d: 0.3 },
    { w: 2.1, h: 2.1, c: "#00f5ff", l: 67, t: 78, s: 5, d: 2.7 },
    { w: 3.2, h: 3.2, c: "#ff6b00", l: 90, t: 20, s: 7, d: 1.0 },
    { w: 1.9, h: 1.9, c: "#ff00aa", l: 10, t: 60, s: 6, d: 3.5 },
  ];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full opacity-20"
          style={{
            width: p.w + "px",
            height: p.h + "px",
            background: p.c,
            left: p.l + "%",
            top: p.t + "%",
            boxShadow: `0 0 ${p.s}px ${p.c}`,
            animation: `float ${4 + p.d}s ease-in-out infinite`,
            animationDelay: `${p.d}s`,
          }}
        />
      ))}
    </div>
  );
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
      <div
        className="h-2 rounded-full"
        style={{
          width: `${value}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
    </div>
  );
}

export default function Index() {
  const [activeSection, setActiveSection] = useState("home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [generatorInput, setGeneratorInput] = useState("");
  const [generatorStep, setGeneratorStep] = useState(0);
  const [generatorEngine, setGeneratorEngine] = useState("");
  const [generatorPlatform, setGeneratorPlatform] = useState("");
  const [generatorGraphics, setGeneratorGraphics] = useState("");
  const [generatorRunning, setGeneratorRunning] = useState(false);
  const [generatorDone, setGeneratorDone] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<{
    genre?: string; difficulty?: string; mechanics?: string[];
    ai_features?: string[]; tech_stack?: string[]; description_enhanced?: string;
    architecture?: { core_loop?: string; ai_system?: string };
    unique_feature?: string; estimated_time?: string; ai_powered?: boolean;
  } | null>(null);
  const [adminTab, setAdminTab] = useState("dashboard");

  // Payment modal
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; plan: string }>({ open: false, plan: "pro" });
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Auth
  const [user, setUser] = useState<{ id: number; email: string; username: string; role: string } | null>(null);
  const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Projects
  const [userProjects, setUserProjects] = useState<Array<{
    id: number; title: string; genre: string; engine: string;
    status: string; progress: number; updated_at: string;
  }>>([]);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  // Wallet
  const [walletData, setWalletData] = useState<{
    balance: number;
    subscription: { plan: string; expires_at: string } | null;
    transactions: Array<{ amount: number; description: string; created_at: string }>;
  } | null>(null);

  // Load user on mount
  useEffect(() => {
    const local = api.getLocalUser();
    if (local) setUser(local);
    if (api.isLoggedIn()) {
      api.me().then(u => { if (u) setUser(u); });
    }
  }, []);

  const loadProjects = useCallback(async () => {
    if (!api.isLoggedIn()) return;
    const projects = await api.getProjects();
    setUserProjects(projects);
  }, []);

  const loadWallet = useCallback(async () => {
    if (!api.isLoggedIn()) return;
    const data = await api.getWallet();
    if (!data.error) setWalletData(data);
  }, []);

  useEffect(() => {
    if (user) {
      loadProjects();
      loadWallet();
    }
  }, [user, loadProjects, loadWallet]);

  // Проверяем ?payment=success после редиректа от платёжного шлюза
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      setPaymentSuccess(true);
      setAdminTab("wallet");
      scrollTo("subscription");
      if (user) loadWallet();
      // Убираем параметры из URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [user]); // eslint-disable-line

  const handleCreatePayment = async (plan: string, gateway: string) => {
    if (!user) { setAuthModal("register"); return { error: "Необходима авторизация" }; }
    return api.createPayment(plan, gateway);
  };

  const handleAuth = async () => {
    setAuthError("");
    setAuthLoading(true);
    try {
      const data = authModal === "register"
        ? await api.register(authEmail, authPassword, authUsername)
        : await api.login(authEmail, authPassword);
      if (data.error) {
        setAuthError(data.error);
      } else {
        setUser(data.user);
        setAuthModal(null);
        setAuthEmail(""); setAuthPassword(""); setAuthUsername("");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setUserProjects([]);
    setWalletData(null);
  };

  const handleCreateProject = async () => {
    if (!newProjectTitle.trim() || !user) return;
    setCreatingProject(true);
    const data = await api.createProject({ title: newProjectTitle, description: generatorInput });
    if (data.project) {
      setNewProjectTitle("");
      setGeneratorInput("");
      setGeneratorStep(0);
      loadProjects();
    }
    setCreatingProject(false);
  };

  const scrollTo = (id: string) => {
    setActiveSection(id);
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-exo">
      <div className="scanline" />
      <div className="fixed inset-0 grid-bg opacity-50 pointer-events-none z-0" />
      <div className="fixed top-1/4 left-1/4 w-96 h-96 rounded-full opacity-5 blur-3xl pointer-events-none z-0"
        style={{ background: "radial-gradient(circle, #00f5ff, transparent)" }} />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-5 blur-3xl pointer-events-none z-0"
        style={{ background: "radial-gradient(circle, #bf00ff, transparent)" }} />

      {/* ═══ PAYMENT MODAL ═══ */}
      {paymentModal.open && (
        <PaymentModal
          paymentUrl=""
          initialPlan={paymentModal.plan}
          onClose={() => setPaymentModal({ open: false, plan: "pro" })}
          onCreatePayment={handleCreatePayment}
        />
      )}

      {/* ═══ PAYMENT SUCCESS TOAST ═══ */}
      {paymentSuccess && (
        <div className="fixed bottom-6 right-6 z-[300] animate-fade-in">
          <div className="glass-card rounded-xl px-5 py-4 border flex items-center gap-3"
            style={{ borderColor: "rgba(0,255,136,0.4)", boxShadow: "0 0 30px rgba(0,255,136,0.2)" }}>
            <Icon name="CheckCircle" size={20} style={{ color: "#00ff88", flexShrink: 0 }} />
            <div>
              <div className="font-orbitron font-bold text-sm neon-text-green">Оплата прошла!</div>
              <div className="text-xs text-white/50 font-mono">Подписка активирована</div>
            </div>
            <button onClick={() => setPaymentSuccess(false)} className="text-white/30 hover:text-white ml-2 transition-colors">
              <Icon name="X" size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ═══ AUTH MODAL ═══ */}
      {authModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setAuthModal(null); }}>
          <div className="glass-card rounded-2xl p-8 w-full max-w-md border animate-fade-in"
            style={{ borderColor: "rgba(0,245,255,0.25)", boxShadow: "0 0 60px rgba(0,245,255,0.08)" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-orbitron font-black text-lg neon-text-cyan">
                {authModal === "login" ? "ВХОД В СИСТЕМУ" : "РЕГИСТРАЦИЯ"}
              </h2>
              <button onClick={() => setAuthModal(null)} className="text-white/30 hover:text-white transition-colors">
                <Icon name="X" size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {authModal === "register" && (
                <div>
                  <label className="text-xs font-mono neon-text-green mb-1.5 block tracking-wider">&gt; ИМЯ ПОЛЬЗОВАТЕЛЯ</label>
                  <input
                    value={authUsername}
                    onChange={e => setAuthUsername(e.target.value)}
                    placeholder="GameDev_Pro"
                    className="w-full bg-black/40 border rounded-lg p-3 text-sm text-white/80 placeholder-white/20 outline-none"
                    style={{ borderColor: "rgba(0,245,255,0.2)" }}
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-mono neon-text-green mb-1.5 block tracking-wider">&gt; EMAIL</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-black/40 border rounded-lg p-3 text-sm text-white/80 placeholder-white/20 outline-none"
                  style={{ borderColor: "rgba(0,245,255,0.2)" }}
                  onKeyDown={e => e.key === "Enter" && handleAuth()}
                />
              </div>
              <div>
                <label className="text-xs font-mono neon-text-green mb-1.5 block tracking-wider">&gt; ПАРОЛЬ</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-black/40 border rounded-lg p-3 text-sm text-white/80 placeholder-white/20 outline-none"
                  style={{ borderColor: "rgba(0,245,255,0.2)" }}
                  onKeyDown={e => e.key === "Enter" && handleAuth()}
                />
              </div>

              {authError && (
                <div className="text-xs font-mono px-3 py-2 rounded border"
                  style={{ borderColor: "rgba(255,0,0,0.3)", background: "rgba(255,0,0,0.05)", color: "#ff4444" }}>
                  ⚠ {authError}
                </div>
              )}

              <button onClick={handleAuth} disabled={authLoading}
                className="w-full py-3.5 rounded-xl font-orbitron font-bold text-sm tracking-widest flex items-center justify-center gap-2 transition-all"
                style={{ background: "rgba(0,245,255,0.15)", border: "1px solid rgba(0,245,255,0.4)", color: "#00f5ff", opacity: authLoading ? 0.6 : 1 }}>
                {authLoading ? (
                  <><Icon name="Loader" size={16} className="animate-spin" /> ОБРАБОТКА...</>
                ) : (
                  <><Icon name="LogIn" size={16} />{authModal === "login" ? "ВОЙТИ" : "СОЗДАТЬ АККАУНТ"}</>
                )}
              </button>

              <div className="text-center text-xs text-white/30 font-mono">
                {authModal === "login" ? (
                  <span>Нет аккаунта?{" "}
                    <button onClick={() => { setAuthModal("register"); setAuthError(""); }}
                      className="neon-text-cyan hover:underline">Зарегистрироваться</button>
                  </span>
                ) : (
                  <span>Уже есть аккаунт?{" "}
                    <button onClick={() => { setAuthModal("login"); setAuthError(""); }}
                      className="neon-text-cyan hover:underline">Войти</button>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b"
        style={{ background: "rgba(5, 8, 15, 0.92)", backdropFilter: "blur(20px)", borderColor: "rgba(0, 245, 255, 0.15)" }}>
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
          <button onClick={() => scrollTo("home")} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded border flex items-center justify-center"
              style={{ borderColor: "#00f5ff", boxShadow: "0 0 10px #00f5ff" }}>
              <span className="text-sm font-orbitron font-black neon-text-cyan">N</span>
            </div>
            <span className="font-orbitron font-bold text-sm neon-text-cyan tracking-widest hidden sm:block">
              NEXUS<span className="text-white/30 mx-1">·</span>GAME<span className="text-white/30 mx-1">·</span>AI
            </span>
          </button>

          <div className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <button key={item.id} onClick={() => scrollTo(item.id)}
                className="px-3 py-2 text-xs font-exo font-medium tracking-widest uppercase transition-all rounded"
                style={{ color: activeSection === item.id ? "#00f5ff" : "rgba(255,255,255,0.45)" }}>
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <button onClick={() => scrollTo("subscription")}
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded text-xs neon-btn-cyan font-mono">
                  <Icon name="Wallet" size={14} />
                  <span>{walletData ? `${walletData.balance.toLocaleString()} ₽` : "..."}</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="hidden sm:block text-xs font-mono text-white/40">{user.username}</span>
                  <button onClick={handleLogout}
                    className="px-3 py-1.5 rounded text-xs font-orbitron tracking-wider text-white/40 border border-white/10 hover:border-red-500/50 hover:text-red-400 transition-all">
                    ВЫЙТИ
                  </button>
                </div>
              </>
            ) : (
              <>
                <button onClick={() => setAuthModal("login")}
                  className="neon-btn-cyan px-4 py-1.5 rounded text-xs font-orbitron tracking-wider">
                  ВОЙТИ
                </button>
                <button onClick={() => setAuthModal("register")}
                  className="neon-btn-violet px-4 py-1.5 rounded text-xs font-orbitron tracking-wider hidden sm:block">
                  РЕГИСТРАЦИЯ
                </button>
              </>
            )}
            <button className="lg:hidden text-white/70" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <Icon name={mobileMenuOpen ? "X" : "Menu"} size={20} />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t px-4 py-3 flex flex-col gap-1"
            style={{ borderColor: "rgba(0,245,255,0.1)", background: "rgba(5,8,15,0.98)" }}>
            {NAV_ITEMS.map((item) => (
              <button key={item.id} onClick={() => scrollTo(item.id)}
                className="text-left py-2 px-3 text-sm text-white/60 hover:text-white rounded hover:bg-white/5 transition-all">
                {item.label}
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* ═══ HERO ═══ */}
      <section id="home" className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        <ParticleField />
        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-8 text-xs font-mono"
            style={{ borderColor: "rgba(0,245,255,0.3)", background: "rgba(0,245,255,0.05)", color: "#00f5ff" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: "#00ff88", boxShadow: "0 0 6px #00ff88", animation: "neon-pulse 2s infinite" }} />
            ИИ СИСТЕМА ОНЛАЙН · v3.7.1 · 2847 игр создано сегодня
          </div>

          <h1 className="font-orbitron font-black text-4xl md:text-6xl lg:text-7xl mb-6 leading-tight">
            <span className="gradient-text">СОЗДАВАЙ ИГРЫ</span>
            <br />
            <span className="text-white/90">С ПОМОЩЬЮ</span>
            <br />
            <span className="neon-text-violet">ИСКУССТВЕННОГО</span>
            <br />
            <span className="neon-text-cyan">ИНТЕЛЛЕКТА</span>
          </h1>

          <div className="mb-8 h-10 flex items-center justify-center">
            <TypewriterText texts={[
              "_ ОПИШИ ИДЕЮ → ИИ СОЗДАСТ ИГРУ",
              "_ БЕЗ ПРОГРАММИСТОВ И ДИЗАЙНЕРОВ",
              "_ ПК, МОБАЙЛ, БРАУЗЕР — ВЕЗДЕ",
              "_ ГОТОВО ЗА МИНУТЫ, НЕ ЗА МЕСЯЦЫ",
            ]} />
          </div>

          <p className="text-white/50 text-lg mb-10 max-w-2xl mx-auto font-light">
            Платформа нового поколения, где ИИ заменяет всю команду разработки.
            Генерация кода, дизайна, тестирования и публикации — одним запросом.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button onClick={() => scrollTo("generator")}
              className="neon-btn-cyan px-8 py-4 rounded font-orbitron font-bold text-sm tracking-widest flex items-center gap-3">
              <Icon name="Zap" size={18} />
              СОЗДАТЬ ИГРУ — БЕСПЛАТНО
            </button>
            <button onClick={() => scrollTo("demo")}
              className="px-8 py-4 rounded text-sm tracking-wider border transition-all flex items-center gap-3 font-orbitron font-bold tracking-widest"
              style={{ borderColor: "rgba(0,255,136,0.4)", color: "#00ff88", background: "rgba(0,255,136,0.08)" }}>
              <Icon name="Gamepad2" size={18} />
              ИГРАТЬ ДЕМО
            </button>
          </div>

          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { val: "50 000+", label: "Разработчиков", color: "#00f5ff" },
              { val: "180 000+", label: "Игр создано", color: "#bf00ff" },
              { val: "12", label: "Языков кода", color: "#00ff88" },
              { val: "99.7%", label: "Uptime ИИ", color: "#ff6b00" },
            ].map((stat) => (
              <div key={stat.label} className="glass-card rounded-lg p-4 border card-hover"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="font-orbitron font-black text-2xl md:text-3xl mb-1"
                  style={{ color: stat.color, textShadow: `0 0 15px ${stat.color}` }}>
                  {stat.val}
                </div>
                <div className="text-white/40 text-xs tracking-wider uppercase">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ИИ ВОЗМОЖНОСТИ ═══ */}
      <section className="py-24 px-4 relative">
        <div className="section-divider mb-24" />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="font-mono text-xs neon-text-green mb-3 tracking-widest">// AI_MODULES_ACTIVE</div>
            <h2 className="font-orbitron font-black text-3xl md:text-5xl mb-4">
              <span className="gradient-text">ИИ ЗАМЕНЯЕТ</span>{" "}
              <span className="text-white/90">ВСЕХ</span>
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">Нейросети берут на себя всю команду разработки игры</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {AI_FEATURES.map((feat) => (
              <div key={feat.title} className="glass-card rounded-xl p-6 border card-hover relative overflow-hidden"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-5 blur-2xl"
                  style={{ background: feat.color, transform: "translate(30%, -30%)" }} />
                <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 border"
                  style={{ borderColor: feat.color + "40", background: feat.color + "10" }}>
                  <Icon name={feat.icon as "Wand2"} size={22} style={{ color: feat.color, filter: `drop-shadow(0 0 6px ${feat.color})` }} />
                </div>
                <h3 className="font-orbitron font-bold text-sm mb-2" style={{ color: feat.color }}>{feat.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ГЕНЕРАТОР ═══ */}
      <section id="generator" className="py-24 px-4 relative">
        <div className="section-divider mb-24" />
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="font-mono text-xs neon-text-cyan mb-3 tracking-widest">// NEXUS_GENERATOR_v3</div>
            <h2 className="font-orbitron font-black text-3xl md:text-5xl mb-4 text-white">
              ИИ <span className="neon-text-cyan">ГЕНЕРАТОР</span> ИГР
            </h2>
            <p className="text-white/40">Опиши свою игру на русском — ИИ сделает всё остальное</p>
          </div>

          <div className="glass-card rounded-2xl p-8 border"
            style={{ borderColor: "rgba(0,245,255,0.2)", boxShadow: "0 0 40px rgba(0,245,255,0.05)", letterSpacing: "normal" }}>
            <div className="flex items-center gap-2 mb-6 pb-4 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <div className="w-3 h-3 rounded-full" style={{ background: "#ff5f56" }} />
              <div className="w-3 h-3 rounded-full" style={{ background: "#ffbd2e" }} />
              <div className="w-3 h-3 rounded-full" style={{ background: "#27c93f" }} />
              <span className="ml-4 font-mono text-xs text-white/30">nexus-generator ~/workspace $</span>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-xs font-mono neon-text-green mb-2 block tracking-wider">&gt; ОПИСАНИЕ ИГРЫ</label>
                <textarea
                  value={generatorInput}
                  onChange={(e) => setGeneratorInput(e.target.value)}
                  placeholder="Например: 2D платформер в стиле киберпанк с роботом-героем, лазерами и процедурными уровнями. Мобайл + ПК версия..."
                  rows={4}
                  className="w-full bg-black/30 border rounded-lg p-4 text-sm text-white/80 placeholder-white/20 outline-none resize-none font-exo"
                  style={{ borderColor: "rgba(0,245,255,0.2)", letterSpacing: "normal", wordSpacing: "normal", fontFamily: "'Exo 2', sans-serif" }}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {["Платформер", "RPG", "Шутер", "Стратегия", "Хоррор", "Гонки", "Головоломка", "Симулятор"].map((genre) => (
                  <button key={genre}
                    onClick={() => setGeneratorInput(prev => prev ? prev + ", " + genre : genre)}
                    className="py-2 px-3 text-xs rounded border text-white/50 hover:text-[#00f5ff] hover:border-[#00f5ff] transition-all"
                    style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                    {genre}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <select
                  value={generatorEngine}
                  onChange={e => setGeneratorEngine(e.target.value)}
                  className="bg-black/30 border rounded p-2.5 text-xs text-white/60 outline-none font-exo"
                  style={{ borderColor: "rgba(0,245,255,0.15)", letterSpacing: "normal" }}>
                  <option value="">Движок</option>
                  {["Unity", "Godot", "Unreal", "Custom ИИ"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select
                  value={generatorPlatform}
                  onChange={e => setGeneratorPlatform(e.target.value)}
                  className="bg-black/30 border rounded p-2.5 text-xs text-white/60 outline-none font-exo"
                  style={{ borderColor: "rgba(0,245,255,0.15)", letterSpacing: "normal" }}>
                  <option value="">Платформа</option>
                  {["ПК", "Мобайл", "Браузер", "Все"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select
                  value={generatorGraphics}
                  onChange={e => setGeneratorGraphics(e.target.value)}
                  className="bg-black/30 border rounded p-2.5 text-xs text-white/60 outline-none font-exo"
                  style={{ borderColor: "rgba(0,245,255,0.15)", letterSpacing: "normal" }}>
                  <option value="">Графика</option>
                  {["2D Пиксель", "2D Вектор", "3D Реализм", "3D Стиль"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              {/* Прогресс генерации */}
              {generatorStep > 0 && (
                <div className="rounded-lg p-4 border" style={{ borderColor: "rgba(0,255,136,0.2)", background: "rgba(0,255,136,0.03)" }}>
                  <div className="font-mono text-xs space-y-2">
                    {[
                      { step: 1, label: "Отправляю описание в ИИ..." },
                      { step: 2, label: "ИИ определяет жанр и механики..." },
                      { step: 3, label: "Генерирую архитектуру и ИИ-систему..." },
                      { step: 4, label: "Сохраняю проект и создаю ИИ-агента..." },
                    ].map(({ step, label }) => (
                      <div key={step} className="flex items-center gap-2"
                        style={{ color: generatorStep > step ? "#00ff88" : generatorStep === step ? "#00f5ff" : "rgba(255,255,255,0.2)" }}>
                        <Icon name={generatorStep > step ? "CheckCircle" : generatorStep === step ? "Loader" : "Circle"} size={12}
                          className={generatorStep === step && generatorRunning ? "animate-spin" : ""} />
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Результат ИИ-анализа */}
              {aiAnalysis && generatorDone && (
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "rgba(0,245,255,0.2)", background: "rgba(0,245,255,0.03)" }}>
                  <div className="px-4 py-3 border-b flex items-center justify-between"
                    style={{ borderColor: "rgba(0,245,255,0.1)", background: "rgba(0,245,255,0.05)" }}>
                    <div className="flex items-center gap-2 font-orbitron text-xs neon-text-cyan tracking-widest">
                      <Icon name="Brain" size={14} />
                      NEXUS AI АНАЛИЗ
                      {aiAnalysis.ai_powered && <span className="text-white/30 font-mono text-xs">· GPT-4o</span>}
                    </div>
                    <button onClick={() => { setAiAnalysis(null); setGeneratorDone(false); setGeneratorStep(0); }}
                      className="text-white/30 hover:text-white/60 transition-colors">
                      <Icon name="X" size={14} />
                    </button>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Жанр + сложность */}
                    <div className="flex gap-3 flex-wrap">
                      {aiAnalysis.genre && (
                        <span className="px-3 py-1 rounded-full text-xs font-orbitron font-bold"
                          style={{ background: "rgba(0,245,255,0.15)", color: "#00f5ff", border: "1px solid rgba(0,245,255,0.3)" }}>
                          {aiAnalysis.genre}
                        </span>
                      )}
                      {aiAnalysis.difficulty && (
                        <span className="px-3 py-1 rounded-full text-xs font-orbitron font-bold"
                          style={{ background: "rgba(191,0,255,0.15)", color: "#bf00ff", border: "1px solid rgba(191,0,255,0.3)" }}>
                          {aiAnalysis.difficulty}
                        </span>
                      )}
                      {aiAnalysis.estimated_time && (
                        <span className="px-3 py-1 rounded-full text-xs font-mono text-white/40 border border-white/10">
                          ⏱ {aiAnalysis.estimated_time}
                        </span>
                      )}
                    </div>

                    {/* Уникальная фишка */}
                    {aiAnalysis.unique_feature && (
                      <div className="rounded-lg p-3 border" style={{ borderColor: "rgba(255,107,0,0.2)", background: "rgba(255,107,0,0.05)" }}>
                        <div className="text-xs font-orbitron mb-1" style={{ color: "#ff6b00" }}>⚡ УНИКАЛЬНАЯ ФИШКА</div>
                        <div className="text-sm text-white/70">{aiAnalysis.unique_feature}</div>
                      </div>
                    )}

                    {/* Механики */}
                    {aiAnalysis.mechanics && aiAnalysis.mechanics.length > 0 && (
                      <div>
                        <div className="text-xs font-orbitron neon-text-green mb-2 tracking-wider">МЕХАНИКИ</div>
                        <div className="flex flex-wrap gap-2">
                          {aiAnalysis.mechanics.map((m, i) => (
                            <span key={i} className="px-2 py-1 rounded text-xs text-white/60 border border-white/10 font-exo">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ИИ-функции в игре */}
                    {aiAnalysis.ai_features && aiAnalysis.ai_features.length > 0 && (
                      <div>
                        <div className="text-xs font-orbitron mb-2 tracking-wider" style={{ color: "#bf00ff" }}>🤖 ИИ В ИГРЕ</div>
                        <div className="space-y-1">
                          {aiAnalysis.ai_features.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-white/60">
                              <Icon name="Bot" size={10} style={{ color: "#bf00ff", flexShrink: 0 }} />
                              {f}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ИИ-система */}
                    {aiAnalysis.architecture?.ai_system && (
                      <div className="rounded-lg p-3 border" style={{ borderColor: "rgba(0,255,136,0.15)", background: "rgba(0,255,136,0.03)" }}>
                        <div className="text-xs font-orbitron neon-text-green mb-1">🧠 ИИ-СИСТЕМА</div>
                        <div className="text-xs text-white/60 font-exo">{aiAnalysis.architecture.ai_system}</div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t neon-text-cyan text-xs font-mono"
                      style={{ borderColor: "rgba(0,245,255,0.1)" }}>
                      <Icon name="CheckCircle" size={12} />
                      Проект создан с ИИ-агентом! Смотри в «Черновые проекты» ↓
                    </div>
                  </div>
                </div>
              )}

              <button
                disabled={generatorRunning}
                onClick={async () => {
                  if (!generatorInput.trim()) return;
                  if (!user) { setAuthModal("register"); return; }
                  if (generatorRunning) return;

                  setGeneratorRunning(true);
                  setGeneratorDone(false);
                  setAiAnalysis(null);
                  setGeneratorStep(1);

                  // Шаг 1-2: ИИ анализирует описание
                  const analysis = await api.analyzeGame(generatorInput);
                  setGeneratorStep(2);
                  await new Promise(r => setTimeout(r, 600));

                  setGeneratorStep(3);
                  // Шаг 3-4: генерируем проект в БД с ИИ-структурой
                  const res = await api.generateGame(
                    generatorInput, analysis,
                    generatorEngine || "Godot",
                    generatorPlatform || "Все",
                    generatorGraphics || "2D Пиксель"
                  );
                  setGeneratorStep(4);
                  await new Promise(r => setTimeout(r, 500));

                  if (!res.error) {
                    setAiAnalysis(analysis);
                    await loadProjects();
                    setGeneratorDone(true);
                    setGeneratorInput("");
                    setGeneratorEngine("");
                    setGeneratorPlatform("");
                    setGeneratorGraphics("");
                  }
                  setGeneratorRunning(false);
                }}
                className="w-full py-4 rounded-xl font-orbitron font-bold text-sm tracking-widest flex items-center justify-center gap-3 transition-all text-white"
                style={{
                  background: "linear-gradient(135deg, rgba(0,245,255,0.2), rgba(191,0,255,0.2))",
                  border: "1px solid rgba(0,245,255,0.4)",
                  boxShadow: "0 0 20px rgba(0,245,255,0.1)",
                  opacity: generatorRunning ? 0.7 : 1
                }}>
                <Icon name={generatorRunning ? "Loader" : "Brain"} size={18}
                  style={{ color: "#00f5ff" }}
                  className={generatorRunning ? "animate-spin" : ""} />
                {!user ? "ВОЙТИ И СОЗДАТЬ ИГРУ" : generatorRunning ? "ИИ АНАЛИЗИРУЕТ..." : "ЗАПУСТИТЬ ИИ ГЕНЕРАЦИЮ"}
                {!generatorRunning && <Icon name="ChevronRight" size={18} />}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ ЯЗЫКИ ═══ */}
      <section className="py-24 px-4 relative">
        <div className="section-divider mb-24" />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="font-mono text-xs neon-text-violet mb-3 tracking-widest">// LANGUAGES_SUPPORTED</div>
            <h2 className="font-orbitron font-black text-3xl md:text-5xl mb-4">
              <span className="text-white/90">ВСЕ</span>{" "}
              <span className="neon-text-violet">ЯЗЫКИ</span>{" "}
              <span className="text-white/90">ПРОГРАММИРОВАНИЯ</span>
            </h2>
            <p className="text-white/40">Изучай и создавай на любом языке — ИИ обучит и поможет</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {LANGUAGES.map((lang) => (
              <div key={lang.name} className="glass-card rounded-xl p-5 border card-hover cursor-pointer"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: lang.color, boxShadow: `0 0 8px ${lang.color}` }} />
                  <span className="font-orbitron font-bold text-sm" style={{ color: lang.color }}>{lang.name}</span>
                </div>
                <p className="text-white/40 text-xs mb-3">{lang.desc}</p>
                <span className="text-xs font-mono tracking-wider" style={{ color: lang.color + "80" }}>НАЧАТЬ КУРС →</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ЧЕРНОВИКИ ═══ */}
      <section className="py-24 px-4 relative">
        <div className="section-divider mb-24" />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="font-mono text-xs mb-3 tracking-widest" style={{ color: "#ff6b00" }}>// DRAFT_PROJECTS</div>
            <h2 className="font-orbitron font-black text-3xl md:text-5xl mb-4">
              <span className="text-white/90">ЧЕРНОВЫЕ</span>{" "}
              <span style={{ color: "#ff6b00", textShadow: "0 0 20px #ff6b00" }}>ПРОЕКТЫ</span>
            </h2>
            {!user && (
              <p className="text-white/30 text-sm font-mono mt-2">
                <button onClick={() => setAuthModal("register")} className="neon-text-cyan hover:underline">Зарегистрируйся</button>
                {" "}чтобы сохранять свои игровые проекты
              </p>
            )}
          </div>

          {/* Форма создания нового проекта (если залогинен) */}
          {user && (
            <div className="glass-card rounded-xl p-5 border mb-6 flex gap-3"
              style={{ borderColor: "rgba(255,107,0,0.2)" }}>
              <input
                value={newProjectTitle}
                onChange={e => setNewProjectTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleCreateProject()}
                placeholder="Название нового проекта..."
                className="flex-1 bg-black/30 border rounded-lg px-4 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none"
                style={{ borderColor: "rgba(255,107,0,0.2)" }}
              />
              <button onClick={handleCreateProject} disabled={creatingProject || !newProjectTitle.trim()}
                className="px-5 py-2.5 rounded-lg font-orbitron text-xs tracking-wider transition-all flex items-center gap-2"
                style={{ background: "rgba(255,107,0,0.2)", border: "1px solid rgba(255,107,0,0.4)", color: "#ff6b00", opacity: creatingProject ? 0.6 : 1 }}>
                <Icon name={creatingProject ? "Loader" : "Plus"} size={14} />
                {creatingProject ? "..." : "СОЗДАТЬ"}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {user && userProjects.length > 0 ? (
              userProjects.map((proj, i) => {
                const colors = ["#bf00ff", "#00f5ff", "#00ff88", "#ff6b00", "#ff00aa"];
                const color = colors[i % colors.length];
                return (
                  <div key={proj.id} className="glass-card rounded-xl p-6 border card-hover"
                    style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-orbitron font-bold text-sm text-white/90 truncate mr-2">{proj.title}</h3>
                      <span className="text-xs font-mono px-2 py-1 rounded flex-shrink-0"
                        style={{ background: color + "15", color, border: `1px solid ${color}30` }}>
                        {proj.status}
                      </span>
                    </div>
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-white/40 mb-2 font-mono">
                        <span>Прогресс</span>
                        <span style={{ color }}>{proj.progress}%</span>
                      </div>
                      <ProgressBar value={proj.progress} color={color} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-white/30 font-mono">
                      <span>{proj.genre || "Жанр не задан"}</span>
                      <button className="hover:text-white transition-colors flex items-center gap-1">
                        <Icon name="Play" size={12} /> ОТКРЫТЬ
                      </button>
                    </div>
                  </div>
                );
              })
            ) : user ? (
              <div className="col-span-3 text-center py-12 text-white/25 font-mono text-sm">
                У тебя пока нет проектов — создай первый выше ↑
              </div>
            ) : (
              DRAFT_PROJECTS.map((proj) => (
                <div key={proj.title} className="glass-card rounded-xl p-6 border card-hover"
                  style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-orbitron font-bold text-sm text-white/90">{proj.title}</h3>
                    <span className="text-xs font-mono px-2 py-1 rounded"
                      style={{ background: proj.color + "15", color: proj.color, border: `1px solid ${proj.color}30` }}>
                      {proj.engine}
                    </span>
                  </div>
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-white/40 mb-2 font-mono">
                      <span>Прогресс</span>
                      <span style={{ color: proj.color }}>{proj.progress}%</span>
                    </div>
                    <ProgressBar value={proj.progress} color={proj.color} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/30 font-mono">
                    <span>{proj.lastEdit}</span>
                    <button onClick={() => setAuthModal("login")} className="hover:text-white transition-colors flex items-center gap-1">
                      <Icon name="Lock" size={12} /> ВОЙТИ
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {!user && (
            <div className="mt-6 text-center">
              <button onClick={() => setAuthModal("register")}
                className="neon-btn-cyan px-6 py-3 rounded-lg font-orbitron text-xs tracking-widest inline-flex items-center gap-2">
                <Icon name="Plus" size={16} />СОЗДАТЬ АККАУНТ И НАЧАТЬ
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ═══ ТЕСТИРОВАНИЕ + КОНВЕРТАЦИЯ ═══ */}
      <section className="py-24 px-4 relative">
        <div className="section-divider mb-24" />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="font-mono text-xs neon-text-green mb-3 tracking-widest">// GAME_TESTING_AI</div>
            <h2 className="font-orbitron font-black text-3xl md:text-5xl mb-4">
              <span className="neon-text-green">ТЕСТ</span>{" "}
              <span className="text-white/90">& КОНВЕРТАЦИЯ</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass-card rounded-xl p-8 border" style={{ borderColor: "rgba(0,255,136,0.2)" }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.3)" }}>
                  <Icon name="Bot" size={20} style={{ color: "#00ff88" }} />
                </div>
                <h3 className="font-orbitron font-bold text-sm neon-text-green">ИИ-ТЕСТИРОВЩИК</h3>
              </div>
              <ul className="space-y-3">
                {["Автоматическое нахождение багов", "Тестирование геймплея 24/7", "Нагрузочное тестирование", "Совместимость платформ", "Отчёт об ошибках в реальном времени"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/60">
                    <Icon name="CheckCircle" size={16} style={{ color: "#00ff88", flexShrink: 0 }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="glass-card rounded-xl p-8 border" style={{ borderColor: "rgba(191,0,255,0.2)" }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(191,0,255,0.1)", border: "1px solid rgba(191,0,255,0.3)" }}>
                  <Icon name="ArrowLeftRight" size={20} style={{ color: "#bf00ff" }} />
                </div>
                <h3 className="font-orbitron font-bold text-sm neon-text-violet">КОНВЕРТАЦИЯ ПЛАТФОРМ</h3>
              </div>
              <div className="flex items-center justify-center gap-8 my-6">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-2 border"
                    style={{ background: "rgba(0,245,255,0.1)", borderColor: "rgba(0,245,255,0.3)" }}>
                    <Icon name="Monitor" size={30} style={{ color: "#00f5ff" }} />
                  </div>
                  <span className="text-xs font-mono neon-text-cyan">ПК</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <Icon name="ArrowLeftRight" size={24} style={{ color: "#bf00ff" }} />
                  <span className="text-xs font-mono text-white/30">1 клик</span>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-2 border"
                    style={{ background: "rgba(191,0,255,0.1)", borderColor: "rgba(191,0,255,0.3)" }}>
                    <Icon name="Smartphone" size={30} style={{ color: "#bf00ff" }} />
                  </div>
                  <span className="text-xs font-mono neon-text-violet">МОБАЙЛ</span>
                </div>
              </div>
              <p className="text-white/40 text-sm text-center">ИИ автоматически адаптирует управление, интерфейс и производительность</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ ДЕМО ИГРА ═══ */}
      <section id="demo" className="py-24 px-4 relative">
        <div className="section-divider mb-24" />
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="font-mono text-xs neon-text-green mb-3 tracking-widest">// LIVE_DEMO</div>
            <h2 className="font-orbitron font-black text-3xl md:text-5xl mb-4">
              <span className="neon-text-green">ДЕМО</span>{" "}
              <span className="text-white/90">ИГРА</span>
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              Это реальная игра, сгенерированная ИИ прямо здесь. Управление: <span className="font-mono text-white/60">← → ↑ ↓</span> для движения, <span className="font-mono text-white/60">ПРОБЕЛ</span> для стрельбы
            </p>
          </div>
          <DemoGame />
          <div className="mt-10 text-center">
            <p className="text-white/30 text-sm font-exo mb-4">
              Хочешь такую же, но свою — с твоими героями, механиками и стилем?
            </p>
            <button onClick={() => scrollTo("generator")}
              className="neon-btn-cyan px-8 py-3.5 rounded-xl font-orbitron font-bold text-sm tracking-widest inline-flex items-center gap-2">
              <Icon name="Wand2" size={16} />СОЗДАТЬ СВОЮ ИГРУ
            </button>
          </div>
        </div>
      </section>

      {/* ═══ ПОРТФОЛИО ═══ */}
      <section id="portfolio" className="py-24 px-4 relative">
        <div className="section-divider mb-24" />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="font-mono text-xs neon-text-cyan mb-3 tracking-widest">// GAME_PORTFOLIO</div>
            <h2 className="font-orbitron font-black text-3xl md:text-5xl mb-4">
              <span className="neon-text-cyan">ПОРТФОЛИО</span>{" "}
              <span className="text-white/90">ИГР</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PORTFOLIO_GAMES.map((game) => (
              <div key={game.title} className="glass-card rounded-xl overflow-hidden border card-hover group"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="h-40 relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${game.color}15, transparent, rgba(0,0,0,0.5))` }}>
                  <div className="absolute inset-0 hex-pattern opacity-30" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="font-orbitron font-black text-5xl opacity-10" style={{ color: game.color }}>
                      {game.title[0]}
                    </div>
                  </div>
                  <div className="absolute top-3 right-3">
                    <span className="text-xs font-mono px-2 py-1 rounded-full"
                      style={{ background: game.color + "20", color: game.color, border: `1px solid ${game.color}40` }}>
                      {game.status}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => scrollTo("demo")}
                      className="text-xs font-mono flex items-center gap-1 px-3 py-1.5 rounded"
                      style={{ background: game.color + "20", color: game.color, border: `1px solid ${game.color}` }}>
                      <Icon name="Play" size={12} /> ИГРАТЬ
                    </button>
                    <button onClick={() => { if (!user) { setAuthModal("register"); } else { setPaymentModal({ open: true, plan: "pro" }); } }}
                      className="text-xs font-mono flex items-center gap-1 px-2 py-1.5 rounded"
                      style={{ background: "rgba(0,0,0,0.5)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}>
                      <Icon name="Download" size={12} /> КОПИРОВАТЬ
                    </button>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-orbitron font-bold text-sm" style={{ color: game.color }}>{game.title}</h3>
                    <span className="text-xs text-white/30 font-mono">{game.engine}</span>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{ background: game.color + "10", color: game.color + "aa" }}>{game.genre}</span>
                  <p className="text-white/40 text-xs mt-2">{game.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ДОКУМЕНТАЦИЯ ═══ */}
      <section id="docs" className="py-24 px-4 relative">
        <div className="section-divider mb-24" />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="font-mono text-xs neon-text-green mb-3 tracking-widest">// DOCUMENTATION</div>
            <h2 className="font-orbitron font-black text-3xl md:text-5xl mb-4 text-white/90">ДОКУМЕНТАЦИЯ</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DOCS_SECTIONS.map((doc, i) => {
              const colors = ["#00f5ff", "#bf00ff", "#00ff88", "#ff6b00", "#ff00aa", "#00f5ff"];
              const color = colors[i % colors.length];
              return (
                <button key={doc.title} className="glass-card rounded-xl p-6 border card-hover text-left"
                  style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 border"
                    style={{ borderColor: color + "40", background: color + "10" }}>
                    <Icon name={doc.icon as "BookOpen"} size={20} style={{ color }} />
                  </div>
                  <h3 className="font-orbitron font-bold text-sm mb-2" style={{ color }}>{doc.title}</h3>
                  <p className="text-white/40 text-sm">{doc.desc}</p>
                  <div className="mt-4 text-xs font-mono flex items-center gap-1" style={{ color: color + "70" }}>
                    ЧИТАТЬ <Icon name="ArrowRight" size={12} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ СООБЩЕСТВО ═══ */}
      <section id="community" className="py-24 px-4 relative">
        <div className="section-divider mb-24" />
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="font-mono text-xs neon-text-violet mb-3 tracking-widest">// COMMUNITY_HUB</div>
            <h2 className="font-orbitron font-black text-3xl md:text-5xl mb-4 neon-text-violet">СООБЩЕСТВО</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {[
              { icon: "MessageSquare", title: "Форум разработчиков", count: "12 847", label: "тем", color: "#bf00ff" },
              { icon: "Users", title: "Discord сервер", count: "34 521", label: "участников", color: "#00f5ff" },
              { icon: "Youtube", title: "YouTube канал", count: "8 200+", label: "подписчиков", color: "#ff00aa" },
            ].map((item) => (
              <div key={item.title} className="glass-card rounded-xl p-6 border card-hover text-center"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 border"
                  style={{ borderColor: item.color + "40", background: item.color + "10" }}>
                  <Icon name={item.icon as "MessageSquare"} size={26} style={{ color: item.color }} />
                </div>
                <div className="font-orbitron font-black text-2xl mb-1" style={{ color: item.color }}>{item.count}</div>
                <div className="text-white/30 text-xs font-mono mb-2">{item.label}</div>
                <h3 className="text-white/70 text-sm">{item.title}</h3>
              </div>
            ))}
          </div>

          <div className="glass-card rounded-xl border overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="px-6 py-4 border-b flex items-center gap-3" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <Icon name="TrendingUp" size={16} style={{ color: "#bf00ff" }} />
              <span className="font-orbitron text-xs tracking-widest text-white/60">ГОРЯЧИЕ ТЕМЫ</span>
            </div>
            {[
              { user: "CyberDev_83", title: "Создал MMO за 3 дня с NEXUS AI — делюсь опытом", time: "2 мин назад", replies: 47 },
              { user: "GameMaker_RU", title: "Лучшие промпты для генерации RPG систем", time: "15 мин назад", replies: 23 },
              { user: "PixelWizard", title: "Конвертировал Unity проект на мобайл — подробный гайд", time: "1 час назад", replies: 89 },
            ].map((post) => (
              <div key={post.title} className="px-6 py-4 border-b flex items-center justify-between hover:bg-white/2 transition-all cursor-pointer"
                style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                <div>
                  <div className="text-sm text-white/70 mb-1">{post.title}</div>
                  <div className="text-xs text-white/30 font-mono">{post.user} · {post.time}</div>
                </div>
                <div className="text-xs font-mono flex items-center gap-1 text-white/30 ml-4 flex-shrink-0">
                  <Icon name="MessageCircle" size={12} />{post.replies}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ПОДПИСКА ═══ */}
      <section id="subscription" className="py-24 px-4 relative">
        <div className="section-divider mb-24" />
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="font-mono text-xs neon-text-cyan mb-3 tracking-widest">// SUBSCRIPTION_PLANS</div>
            <h2 className="font-orbitron font-black text-3xl md:text-5xl mb-4 text-white/90">
              ВЫБЕРИ <span className="neon-text-cyan">ПЛАН</span>
            </h2>
            <p className="text-white/40">Оплата помесячно · Отмена в любой момент</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {SUBSCRIPTION_PLANS.map((plan) => (
              <div key={plan.name}
                className={`glass-card rounded-2xl p-8 border relative card-hover ${plan.popular ? "md:-mt-4 md:mb-4" : ""}`}
                style={{ borderColor: plan.popular ? plan.color : "rgba(255,255,255,0.06)", boxShadow: plan.popular ? `0 0 30px ${plan.color}20` : "none" }}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-orbitron font-bold whitespace-nowrap"
                    style={{ background: plan.color, color: "#000" }}>
                    ПОПУЛЯРНЫЙ
                  </div>
                )}
                <div className="text-center mb-6">
                  <div className="font-orbitron font-black text-lg mb-3" style={{ color: plan.color }}>{plan.name}</div>
                  <div className="flex items-end justify-center gap-1">
                    <span className="font-orbitron font-black text-4xl"
                      style={{ color: plan.color, textShadow: `0 0 20px ${plan.color}` }}>{plan.price}</span>
                    <span className="text-white/30 text-sm mb-1 font-mono">₽/мес</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm text-white/60">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: plan.color + "20" }}>
                        <Icon name="Check" size={10} style={{ color: plan.color }} />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    if (!user) { setAuthModal("register"); return; }
                    setPaymentModal({ open: true, plan: plan.name.toLowerCase() });
                  }}
                  className="w-full py-3 rounded-xl font-orbitron font-bold text-sm tracking-wider transition-all flex items-center justify-center gap-2"
                  style={{
                    background: plan.popular ? plan.color : "transparent",
                    color: plan.popular ? "#000" : plan.color,
                    border: `1px solid ${plan.color}`,
                    boxShadow: plan.popular ? `0 0 20px ${plan.color}40` : "none"
                  }}>
                  <Icon name="CreditCard" size={14} />
                  {user ? "ОПЛАТИТЬ" : "ВОЙТИ И ОПЛАТИТЬ"}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-white/30 text-xs font-mono mb-4 tracking-wider">СПОСОБЫ ОПЛАТЫ</p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              {["Карта РФ", "SberPay", "ЮMoney", "Криптовалюта", "QR-код"].map((method) => (
                <div key={method} className="px-4 py-2 rounded border text-xs font-mono text-white/40"
                  style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  {method}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ КОШЕЛЁК / АДМИН ═══ */}
      <section className="py-24 px-4 relative">
        <div className="section-divider mb-24" />
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="font-mono text-xs mb-3 tracking-widest" style={{ color: "#ff6b00" }}>// ADMIN_WALLET</div>
            <h2 className="font-orbitron font-black text-3xl md:text-5xl mb-4">
              <span style={{ color: "#ff6b00", textShadow: "0 0 20px #ff6b00" }}>КОШЕЛЁК</span>{" "}
              <span className="text-white/90">& ПАНЕЛЬ</span>
            </h2>
          </div>

          <div className="flex gap-2 mb-8 border-b pb-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            {[
              { key: "dashboard", label: "Обзор" },
              { key: "wallet", label: "Кошелёк" },
              { key: "users", label: "Пользователи" },
              { key: "analytics", label: "Аналитика" },
            ].map((tab) => (
              <button key={tab.key} onClick={() => setAdminTab(tab.key)}
                className="px-4 py-2 text-xs font-orbitron tracking-wider rounded transition-all uppercase"
                style={{
                  color: adminTab === tab.key ? "#ff6b00" : "rgba(255,255,255,0.3)",
                  background: adminTab === tab.key ? "rgba(255,107,0,0.1)" : "transparent",
                  border: adminTab === tab.key ? "1px solid rgba(255,107,0,0.3)" : "1px solid transparent"
                }}>
                {tab.label}
              </button>
            ))}
          </div>

          {adminTab === "dashboard" && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Баланс", value: "₽ 184 290", color: "#ff6b00", icon: "Wallet" },
                { label: "Подписок", value: "3 847", color: "#00f5ff", icon: "Users" },
                { label: "Доход сегодня", value: "₽ 12 450", color: "#00ff88", icon: "TrendingUp" },
                { label: "Новых игр", value: "247", color: "#bf00ff", icon: "Gamepad2" },
              ].map((item) => (
                <div key={item.label} className="glass-card rounded-xl p-5 border" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-white/30 font-mono">{item.label}</span>
                    <Icon name={item.icon as "Wallet"} size={16} style={{ color: item.color }} />
                  </div>
                  <div className="font-orbitron font-black text-xl" style={{ color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}

          {adminTab === "wallet" && (
            <div className="space-y-4">
              {!user ? (
                <div className="glass-card rounded-xl p-12 border text-center"
                  style={{ borderColor: "rgba(255,107,0,0.2)" }}>
                  <Icon name="Lock" size={32} style={{ color: "#ff6b00", margin: "0 auto 16px" }} />
                  <p className="text-white/40 font-mono text-sm mb-4">Войдите, чтобы увидеть свой кошелёк</p>
                  <button onClick={() => setAuthModal("login")}
                    className="px-6 py-2.5 rounded-lg font-orbitron text-xs tracking-wider"
                    style={{ background: "rgba(255,107,0,0.2)", border: "1px solid rgba(255,107,0,0.4)", color: "#ff6b00" }}>
                    ВОЙТИ
                  </button>
                </div>
              ) : (
                <>
                  <div className="glass-card rounded-xl p-8 border text-center"
                    style={{ borderColor: "rgba(255,107,0,0.2)", boxShadow: "0 0 30px rgba(255,107,0,0.05)" }}>
                    <div className="font-mono text-xs text-white/30 mb-2 tracking-widest">ТЕКУЩИЙ БАЛАНС</div>
                    <div className="font-orbitron font-black text-5xl mb-2"
                      style={{ color: "#ff6b00", textShadow: "0 0 30px #ff6b00" }}>
                      ₽ {walletData ? walletData.balance.toLocaleString() : "0"}
                    </div>
                    {walletData?.subscription && (
                      <div className="text-xs font-mono mb-4" style={{ color: "#bf00ff" }}>
                        Подписка {walletData.subscription.plan.toUpperCase()} · до {new Date(walletData.subscription.expires_at).toLocaleDateString("ru")}
                      </div>
                    )}
                    <div className="flex gap-4 justify-center mt-4">
                      <button onClick={() => scrollTo("subscription")}
                        className="px-6 py-2.5 rounded-lg font-orbitron text-xs tracking-wider"
                        style={{ background: "rgba(255,107,0,0.2)", border: "1px solid rgba(255,107,0,0.4)", color: "#ff6b00" }}>
                        ПОДПИСКА
                      </button>
                      <button onClick={loadWallet}
                        className="px-6 py-2.5 rounded-lg font-orbitron text-xs tracking-wider text-white/40 border border-white/10 hover:border-white/30 hover:text-white/70 transition-all">
                        ОБНОВИТЬ
                      </button>
                    </div>
                  </div>
                  <div className="glass-card rounded-xl border overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <div className="px-6 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                      <span className="font-mono text-xs text-white/40 tracking-wider">ИСТОРИЯ ТРАНЗАКЦИЙ</span>
                    </div>
                    {walletData?.transactions && walletData.transactions.length > 0 ? walletData.transactions.map((tx, i) => (
                      <div key={i} className="px-6 py-4 border-b flex justify-between items-center"
                        style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                        <div>
                          <div className="text-sm text-white/60">{tx.description}</div>
                          <div className="text-xs text-white/25 font-mono">
                            {new Date(tx.created_at).toLocaleString("ru")}
                          </div>
                        </div>
                        <span className="font-orbitron font-bold text-sm"
                          style={{ color: tx.amount > 0 ? "#00ff88" : "#ff6b00" }}>
                          {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()} ₽
                        </span>
                      </div>
                    )) : (
                      <div className="px-6 py-8 text-center text-white/25 font-mono text-xs">
                        Транзакций пока нет
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}



          {adminTab === "users" && (
            <div className="glass-card rounded-xl border overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="px-6 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <span className="font-mono text-xs text-white/40 tracking-wider">ПОЛЬЗОВАТЕЛИ</span>
                <span className="font-mono text-xs neon-text-cyan">3 847 активных</span>
              </div>
              {[
                { name: "CyberDev Pro", plan: "STUDIO", games: 34, joined: "Янв 2024" },
                { name: "GameMaker_RU", plan: "PRO", games: 12, joined: "Фев 2024" },
                { name: "PixelWizard", plan: "PRO", games: 8, joined: "Март 2024" },
                { name: "AlphaGamer", plan: "STARTER", games: 3, joined: "Апр 2024" },
              ].map((user) => (
                <div key={user.name} className="px-6 py-4 border-b flex items-center justify-between"
                  style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center font-orbitron text-xs font-bold"
                      style={{ background: "rgba(0,245,255,0.1)", border: "1px solid rgba(0,245,255,0.2)", color: "#00f5ff" }}>
                      {user.name[0]}
                    </div>
                    <div>
                      <div className="text-sm text-white/70">{user.name}</div>
                      <div className="text-xs text-white/25 font-mono">С {user.joined}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono text-white/30">{user.games} игр</span>
                    <span className="text-xs font-mono px-2 py-1 rounded"
                      style={{
                        background: user.plan === "STUDIO" ? "rgba(0,255,136,0.1)" : user.plan === "PRO" ? "rgba(191,0,255,0.1)" : "rgba(0,245,255,0.1)",
                        color: user.plan === "STUDIO" ? "#00ff88" : user.plan === "PRO" ? "#bf00ff" : "#00f5ff"
                      }}>
                      {user.plan}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {adminTab === "analytics" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { label: "Конверсия в подписку", value: "23.4%", delta: "+2.1%", color: "#00ff88" },
                { label: "Средний чек", value: "₽ 3 420", delta: "+₽240", color: "#00f5ff" },
                { label: "Retention 30 дней", value: "78.9%", delta: "+5.3%", color: "#bf00ff" },
                { label: "NPS индекс", value: "87", delta: "+3", color: "#ff6b00" },
              ].map((metric) => (
                <div key={metric.label} className="glass-card rounded-xl p-6 border" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <div className="text-xs text-white/30 font-mono mb-3 tracking-wider">{metric.label}</div>
                  <div className="flex items-end gap-3">
                    <span className="font-orbitron font-black text-3xl" style={{ color: metric.color }}>{metric.value}</span>
                    <span className="text-xs font-mono neon-text-green mb-1">{metric.delta}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ═══ КОНТАКТЫ ═══ */}
      <section id="contacts" className="py-24 px-4 relative">
        <div className="section-divider mb-24" />
        <div className="max-w-3xl mx-auto text-center">
          <div className="font-mono text-xs mb-3 tracking-widest" style={{ color: "#ff00aa" }}>// CONTACT_MODULE</div>
          <h2 className="font-orbitron font-black text-3xl md:text-5xl mb-6 text-white/90">
            СВЯЗАТЬСЯ С <span style={{ color: "#ff00aa", textShadow: "0 0 20px #ff00aa" }}>НАМИ</span>
          </h2>
          <div className="glass-card rounded-2xl p-8 border" style={{ borderColor: "rgba(255,0,170,0.15)" }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <input placeholder="Ваше имя" className="w-full bg-black/30 border rounded-lg p-3.5 text-sm text-white/80 placeholder-white/20 outline-none"
                style={{ borderColor: "rgba(255,0,170,0.2)" }} />
              <input placeholder="Email" className="w-full bg-black/30 border rounded-lg p-3.5 text-sm text-white/80 placeholder-white/20 outline-none"
                style={{ borderColor: "rgba(255,0,170,0.2)" }} />
            </div>
            <textarea placeholder="Ваше сообщение..." rows={4}
              className="w-full bg-black/30 border rounded-lg p-3.5 text-sm text-white/80 placeholder-white/20 outline-none resize-none mb-4"
              style={{ borderColor: "rgba(255,0,170,0.2)" }} />
            <button className="w-full py-3.5 rounded-xl font-orbitron font-bold text-sm tracking-widest flex items-center justify-center gap-2"
              style={{ background: "rgba(255,0,170,0.15)", border: "1px solid rgba(255,0,170,0.4)", color: "#ff00aa", boxShadow: "0 0 20px rgba(255,0,170,0.1)" }}>
              <Icon name="Send" size={16} />
              ОТПРАВИТЬ СООБЩЕНИЕ
            </button>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t py-12 px-4" style={{ borderColor: "rgba(0,245,255,0.08)", background: "rgba(0,0,0,0.4)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="font-orbitron font-black text-lg neon-text-cyan mb-4 tracking-widest">NEXUS GAME AI</div>
              <p className="text-white/30 text-sm leading-relaxed">ИИ-платформа нового поколения для создания игр без команды разработки.</p>
            </div>
            {[
              { title: "ПЛАТФОРМА", links: ["Генератор", "Портфолио", "Тестирование", "Конвертация"] },
              { title: "ОБУЧЕНИЕ", links: ["Python", "C#", "JavaScript", "GDScript"] },
              { title: "КОМПАНИЯ", links: ["О нас", "Документация", "Сообщество", "Контакты"] },
            ].map((col) => (
              <div key={col.title}>
                <div className="font-orbitron text-xs tracking-widest text-white/40 mb-4">{col.title}</div>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <button className="text-white/30 hover:text-white/70 text-sm transition-colors">{link}</button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="section-divider mb-6" />
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/20 text-xs font-mono">© 2025 NEXUS GAME AI · Все права защищены</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: "#00ff88", boxShadow: "0 0 6px #00ff88" }} />
              <span className="text-white/20 text-xs font-mono">ВСЕ СИСТЕМЫ РАБОТАЮТ</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}