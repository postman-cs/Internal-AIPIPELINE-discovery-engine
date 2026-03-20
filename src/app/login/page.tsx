"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { loginAction } from "@/lib/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";
import Link from "next/link";

const QUICK_ACCOUNTS = [
  { label: "Admin", email: "jared@postman.com", password: "admiral123", color: "#c9a227", role: "Admin" },
  { label: "Daniel", email: "daniel@postman.com", password: "pipeline123", color: "#22c55e", role: "CSE" },
];

function Orb({ size, x, y, color, delay }: { size: number; x: string; y: string; color: string; delay: number }) {
  return (
    <div
      className="absolute rounded-full blur-3xl animate-pulse-glow pointer-events-none"
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
        background: color,
        animationDelay: `${delay}s`,
        animationDuration: "5s",
      }}
    />
  );
}

function StarField() {
  const [stars, setStars] = useState<{ x: number; y: number; size: number; delay: number; opacity: number }[]>([]);
  useEffect(() => {
    setStars(
      Array.from({ length: 80 }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 0.5,
        delay: Math.random() * 4,
        opacity: Math.random() * 0.5 + 0.15,
      }))
    );
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-pulse-glow"
          style={{
            width: s.size,
            height: s.size,
            left: `${s.x}%`,
            top: `${s.y}%`,
            background: "#fff",
            opacity: s.opacity,
            animationDelay: `${s.delay}s`,
            animationDuration: "3s",
          }}
        />
      ))}
    </div>
  );
}

export default function LoginPage() {
  const [state, action] = useActionState(loginAction, null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  function quickLogin(email: string, password: string) {
    setSelected(email);
    if (emailRef.current) emailRef.current.value = email;
    if (passwordRef.current) passwordRef.current.value = password;
    setTimeout(() => formRef.current?.requestSubmit(), 10);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Layered background */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 120% 80% at 50% 40%, #0d1117 0%, #010409 100%)" }} />
      <StarField />
      <Orb size={500} x="15%" y="20%" color="rgba(34,197,94,0.04)" delay={0} />
      <Orb size={400} x="65%" y="55%" color="rgba(6,214,214,0.035)" delay={1.5} />
      <Orb size={350} x="40%" y="10%" color="rgba(139,92,246,0.03)" delay={3} />

      {/* Accent line */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 h-px"
        style={{
          width: "min(600px, 80vw)",
          background: "linear-gradient(90deg, transparent, rgba(34,197,94,0.4), transparent)",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo + Brand */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-block animate-float">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 relative"
              style={{
                background: "linear-gradient(135deg, #22c55e, #16a34a)",
                boxShadow: "0 0 50px rgba(34, 197, 94, 0.3), 0 0 100px rgba(34, 197, 94, 0.08)",
              }}
            >
              <span className="text-white text-2xl font-bold tracking-tight">CL</span>
              <div
                className="absolute -inset-1 rounded-2xl animate-pulse-glow"
                style={{
                  border: "1px solid rgba(34,197,94,0.15)",
                  animationDuration: "4s",
                }}
              />
            </div>
          </Link>
          <h1
            className="text-4xl font-bold tracking-tight mb-1"
            style={{
              background: "linear-gradient(135deg, #f0fdf4, #86efac, #22c55e)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            CortexLab
          </h1>
          <p className="text-sm" style={{ color: "var(--foreground-dim)" }}>
            CSE Engagement Intelligence
          </p>
        </div>

        {/* Quick Login Grid */}
        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-center mb-3" style={{ color: "var(--foreground-dim)" }}>
            Select identity
          </p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => quickLogin(acc.email, acc.password)}
                disabled={selected === acc.email}
                className="relative rounded-xl py-3.5 px-2 text-center transition-all duration-300 group cursor-pointer"
                style={{
                  background: selected === acc.email
                    ? `${acc.color}18`
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${selected === acc.email ? `${acc.color}50` : "rgba(255,255,255,0.06)"}`,
                  boxShadow: selected === acc.email ? `0 0 30px ${acc.color}15` : "none",
                }}
                onMouseEnter={(e) => {
                  if (selected !== acc.email) {
                    e.currentTarget.style.borderColor = `${acc.color}40`;
                    e.currentTarget.style.background = `${acc.color}08`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (selected !== acc.email) {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                  }
                }}
              >
                <div
                  className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-xs font-bold"
                  style={{
                    background: `${acc.color}18`,
                    color: acc.color,
                    border: `1px solid ${acc.color}30`,
                  }}
                >
                  {acc.label.charAt(0)}
                </div>
                <p className="text-xs font-semibold truncate" style={{ color: acc.color }}>{acc.label}</p>
                <p className="text-[9px] mt-0.5" style={{ color: "var(--foreground-dim)" }}>{acc.role}</p>
                {selected === acc.email && (
                  <div className="absolute inset-0 rounded-xl flex items-center justify-center" style={{ background: `${acc.color}10` }}>
                    <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${acc.color}60`, borderTopColor: "transparent" }} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-5">
          <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.08))" }} />
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="text-[10px] uppercase tracking-widest transition-colors"
            style={{ color: "var(--foreground-dim)" }}
          >
            {showForm ? "Hide form" : "Manual login"}
          </button>
          <div className="flex-1 h-px" style={{ background: "linear-gradient(to left, transparent, rgba(255,255,255,0.08))" }} />
        </div>

        {/* Collapsible Form */}
        <div
          className="overflow-hidden transition-all duration-500 ease-in-out"
          style={{ maxHeight: showForm ? 400 : 0, opacity: showForm ? 1 : 0 }}
        >
          <form
            ref={formRef}
            action={action}
            className="rounded-2xl p-6 space-y-4"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(20px)",
            }}
          >
            {state?.error && (
              <div
                className="text-sm rounded-lg px-3 py-2"
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.15)",
                  color: "#f87171",
                }}
              >
                {state.error}
              </div>
            )}
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input
                ref={emailRef}
                id="email" name="email" type="email" required
                className="input-field" placeholder="you@postman.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="label">Password</label>
              <input
                ref={passwordRef}
                id="password" name="password" type="password" required
                className="input-field" placeholder="Enter password"
              />
            </div>
            <SubmitButton pendingText="Signing in..." className="btn-primary w-full py-2.5">
              Sign In
            </SubmitButton>
          </form>
        </div>

        {/* Hidden form for quick login submission */}
        {!showForm && (
          <form ref={formRef} action={action} className="hidden">
            <input ref={emailRef} name="email" type="hidden" />
            <input ref={passwordRef} name="password" type="hidden" />
          </form>
        )}

        {/* Footer link */}
        <div className="text-center mt-8">
          <Link
            href="/about"
            className="text-[11px] transition-colors"
            style={{ color: "var(--foreground-dim)" }}
          >
            About CortexLab
          </Link>
        </div>
      </div>

      {/* Bottom accent */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px"
        style={{
          width: "min(400px, 60vw)",
          background: "linear-gradient(90deg, transparent, rgba(6,214,214,0.2), transparent)",
        }}
      />
    </div>
  );
}
