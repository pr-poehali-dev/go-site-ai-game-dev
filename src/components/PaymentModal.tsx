import { useState } from "react";
import Icon from "@/components/ui/icon";

const PLANS = [
  { key: "starter", name: "STARTER", price: 990, color: "#00f5ff", features: ["5 проектов", "Базовый ИИ", "Демо-режим"] },
  { key: "pro", name: "PRO", price: 2990, color: "#bf00ff", popular: true, features: ["Безлимитные проекты", "Полный ИИ", "Конвертация платформ", "Тест игр"] },
  { key: "studio", name: "STUDIO", price: 7990, color: "#00ff88", features: ["Всё из PRO", "Командный доступ", "API", "Персональный менеджер"] },
];

const GATEWAYS = [
  { key: "yukassa", name: "ЮKassa", desc: "Карты РФ, SberPay, ЮMoney", icon: "CreditCard", color: "#00f5ff" },
  { key: "robokassa", name: "Robokassa", desc: "Карты, эл. кошельки, терминалы", icon: "Wallet", color: "#00ff88" },
  { key: "stripe", name: "Stripe", desc: "Международные карты Visa/MC", icon: "Globe", color: "#bf00ff" },
];

interface PaymentModalProps {
  paymentUrl: string;
  onClose: () => void;
  onCreatePayment: (plan: string, gateway: string) => Promise<{ payment_url?: string; error?: string }>;
  initialPlan?: string;
}

export default function PaymentModal({ onClose, onCreatePayment, initialPlan }: PaymentModalProps) {
  const [selectedPlan, setSelectedPlan] = useState(initialPlan || "pro");
  const [selectedGateway, setSelectedGateway] = useState("yukassa");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"plan" | "gateway">("plan");

  const handlePay = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await onCreatePayment(selectedPlan, selectedGateway);
      if (res.error) {
        setError(res.error);
      } else if (res.payment_url) {
        window.location.href = res.payment_url;
      }
    } catch {
      setError("Ошибка подключения к платёжному шлюзу");
    } finally {
      setLoading(false);
    }
  };

  const plan = PLANS.find(p => p.key === selectedPlan)!;
  const gateway = GATEWAYS.find(g => g.key === selectedGateway)!;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="glass-card rounded-2xl w-full max-w-lg border animate-fade-in overflow-hidden"
        style={{ borderColor: "rgba(0,245,255,0.2)", boxShadow: "0 0 60px rgba(0,245,255,0.07)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div>
            <div className="font-orbitron font-black text-base neon-text-cyan tracking-widest">ОФОРМИТЬ ПОДПИСКУ</div>
            <div className="text-xs font-mono text-white/30 mt-0.5">Деньги идут напрямую на твой счёт</div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-6 py-3 gap-2">
          {["Тариф", "Оплата"].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-orbitron font-bold"
                  style={{
                    background: (i === 0 && step === "plan") || (i === 1 && step === "gateway") ? "rgba(0,245,255,0.2)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${(i === 0 && step === "plan") || (i === 1 && step === "gateway") ? "#00f5ff" : "rgba(255,255,255,0.1)"}`,
                    color: (i === 0 && step === "plan") || (i === 1 && step === "gateway") ? "#00f5ff" : "rgba(255,255,255,0.3)"
                  }}>
                  {i + 1}
                </div>
                <span className="text-xs font-mono"
                  style={{ color: (i === 0 && step === "plan") || (i === 1 && step === "gateway") ? "#00f5ff" : "rgba(255,255,255,0.3)" }}>
                  {label}
                </span>
              </div>
              {i === 0 && <Icon name="ChevronRight" size={12} style={{ color: "rgba(255,255,255,0.2)" }} />}
            </div>
          ))}
        </div>

        <div className="px-6 pb-6">
          {/* STEP 1: Choose plan */}
          {step === "plan" && (
            <div className="space-y-3">
              {PLANS.map(p => (
                <button key={p.key} onClick={() => setSelectedPlan(p.key)}
                  className="w-full p-4 rounded-xl border text-left transition-all relative overflow-hidden"
                  style={{
                    borderColor: selectedPlan === p.key ? p.color : "rgba(255,255,255,0.07)",
                    background: selectedPlan === p.key ? p.color + "10" : "rgba(255,255,255,0.02)",
                    boxShadow: selectedPlan === p.key ? `0 0 15px ${p.color}20` : "none"
                  }}>
                  {p.popular && (
                    <span className="absolute top-2 right-2 text-xs font-orbitron font-bold px-2 py-0.5 rounded-full"
                      style={{ background: p.color, color: "#000" }}>ХИТ</span>
                  )}
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-orbitron font-black text-sm" style={{ color: p.color }}>{p.name}</span>
                    <span className="font-orbitron font-black text-lg" style={{ color: p.color }}>
                      {p.price.toLocaleString()} <span className="text-xs text-white/40 font-mono">₽/мес</span>
                    </span>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    {p.features.map(f => (
                      <span key={f} className="text-xs text-white/40 flex items-center gap-1">
                        <Icon name="Check" size={10} style={{ color: p.color }} />{f}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
              <button onClick={() => setStep("gateway")}
                className="w-full py-3.5 rounded-xl font-orbitron font-bold text-sm tracking-widest flex items-center justify-center gap-2 mt-2"
                style={{ background: "rgba(0,245,255,0.15)", border: "1px solid rgba(0,245,255,0.4)", color: "#00f5ff" }}>
                ВЫБРАТЬ СПОСОБ ОПЛАТЫ <Icon name="ChevronRight" size={16} />
              </button>
            </div>
          )}

          {/* STEP 2: Choose gateway */}
          {step === "gateway" && (
            <div className="space-y-3">
              <div className="glass-card rounded-xl p-3 border mb-4"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40 font-mono">Выбранный тариф:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-orbitron font-bold text-sm" style={{ color: plan.color }}>{plan.name}</span>
                    <span className="font-orbitron text-sm text-white/70">{plan.price.toLocaleString()} ₽/мес</span>
                    <button onClick={() => setStep("plan")} className="text-xs text-white/30 hover:text-white/60 transition-colors ml-1">
                      <Icon name="Edit2" size={12} />
                    </button>
                  </div>
                </div>
              </div>

              {GATEWAYS.map(gw => (
                <button key={gw.key} onClick={() => setSelectedGateway(gw.key)}
                  className="w-full p-4 rounded-xl border text-left transition-all flex items-center gap-4"
                  style={{
                    borderColor: selectedGateway === gw.key ? gw.color : "rgba(255,255,255,0.07)",
                    background: selectedGateway === gw.key ? gw.color + "10" : "rgba(255,255,255,0.02)",
                  }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border"
                    style={{ borderColor: gw.color + "40", background: gw.color + "10" }}>
                    <Icon name={gw.icon as "CreditCard"} size={18} style={{ color: gw.color }} />
                  </div>
                  <div className="flex-1">
                    <div className="font-orbitron font-bold text-sm" style={{ color: gw.color }}>{gw.name}</div>
                    <div className="text-xs text-white/35 mt-0.5">{gw.desc}</div>
                  </div>
                  {selectedGateway === gw.key && (
                    <Icon name="CheckCircle" size={18} style={{ color: gw.color }} />
                  )}
                </button>
              ))}

              {error && (
                <div className="text-xs font-mono px-3 py-2 rounded border"
                  style={{ borderColor: "rgba(255,0,0,0.3)", background: "rgba(255,0,0,0.05)", color: "#ff4444" }}>
                  ⚠ {error}
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button onClick={() => setStep("plan")}
                  className="flex-1 py-3 rounded-xl font-orbitron text-xs tracking-wider text-white/40 border border-white/10 hover:border-white/30 transition-all">
                  НАЗАД
                </button>
                <button onClick={handlePay} disabled={loading}
                  className="flex-[2] py-3.5 rounded-xl font-orbitron font-bold text-sm tracking-widest flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: gateway ? gateway.color + "20" : "rgba(0,245,255,0.15)",
                    border: `1px solid ${gateway ? gateway.color + "60" : "rgba(0,245,255,0.4)"}`,
                    color: gateway ? gateway.color : "#00f5ff",
                    opacity: loading ? 0.6 : 1
                  }}>
                  {loading
                    ? <><Icon name="Loader" size={16} className="animate-spin" /> ПЕРЕНАПРАВЛЕНИЕ...</>
                    : <><Icon name="CreditCard" size={16} />ОПЛАТИТЬ {plan.price.toLocaleString()} ₽</>
                  }
                </button>
              </div>

              <div className="text-center text-xs text-white/20 font-mono mt-2">
                🔒 Безопасный платёж · Отмена в любой момент
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
