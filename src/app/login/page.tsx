"use client";

import { useActionState, useRef } from "react";
import { loginAction } from "@/lib/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";
import Link from "next/link";

const QUICK_ACCOUNTS = [
  { label: "Admin", email: "admin@postman.com", password: "admin123", color: "#8b5cf6", desc: "Full system admin" },
  { label: "CSE User", email: "cse@postman.com", password: "pipeline123", color: "#06d6d6", desc: "Customer Success Engineer" },
];

export default function LoginPage() {
  const [state, action] = useActionState(loginAction, null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function quickLogin(email: string, password: string) {
    if (emailRef.current) emailRef.current.value = email;
    if (passwordRef.current) passwordRef.current.value = password;
    // Submit form after a tick so the values are set
    setTimeout(() => formRef.current?.requestSubmit(), 10);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 mesh-bg grid-bg" />
      <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-1/3 right-1/3 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: "1s" }} />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block animate-float">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-5"
              style={{
                background: "linear-gradient(135deg, #22c55e, #16a34a)",
                boxShadow: "0 0 30px rgba(34, 197, 94, 0.25)",
              }}
            >
              <span className="text-white text-xl font-bold">CL</span>
            </div>
          </Link>
          <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
            Sign in to CortexLab
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
            Enterprise CI/CD Adoption Intelligence
          </p>
        </div>

        {/* Quick Login Buttons */}
        <div className="mb-4 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-center mb-2" style={{ color: "var(--foreground-dim)" }}>Quick Login</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => quickLogin(acc.email, acc.password)}
                className="card-glow text-left transition-all duration-200 py-3 px-3 cursor-pointer"
                style={{ borderColor: "var(--border)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = acc.color;
                  e.currentTarget.style.boxShadow = `0 0 20px ${acc.color}20`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <p className="text-sm font-semibold" style={{ color: acc.color }}>{acc.label}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--foreground-dim)" }}>{acc.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>or enter credentials</span>
          <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        </div>

        <form
          ref={formRef}
          action={action}
          className="card-glass space-y-5"
          style={{
            boxShadow: "0 0 60px rgba(0,0,0,0.3), 0 0 1px rgba(255,255,255,0.06)",
          }}
        >
          {state?.error && (
            <div
              className="text-sm rounded-lg px-3 py-2"
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
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
    </div>
  );
}
