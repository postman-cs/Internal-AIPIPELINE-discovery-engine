"use client";

import { useActionState } from "react";
import { signupAction } from "@/lib/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";
import Link from "next/link";

export default function SignupPage() {
  const [state, action] = useActionState(signupAction, null);

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
                background: "linear-gradient(135deg, #ff6c37, #e5552a)",
                boxShadow: "0 0 30px rgba(255, 108, 55, 0.25)",
              }}
            >
              <span className="text-white text-xl font-bold">AI</span>
            </div>
          </Link>
          <h1 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
            Create your account
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
            Get started with AI Pipeline
          </p>
        </div>

        <form
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
            <label htmlFor="name" className="label">Name</label>
            <input
              id="name" name="name" type="text" required
              className="input-field" placeholder="Your full name"
            />
          </div>
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email" name="email" type="email" required
              className="input-field" placeholder="you@company.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="label">Password</label>
            <input
              id="password" name="password" type="password" required minLength={8}
              className="input-field" placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="label">Confirm Password</label>
            <input
              id="confirmPassword" name="confirmPassword" type="password" required minLength={8}
              className="input-field" placeholder="Repeat your password"
            />
          </div>
          <SubmitButton pendingText="Creating account..." className="btn-primary w-full py-2.5">
            Create Account
          </SubmitButton>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: "var(--foreground-dim)" }}>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium transition-colors"
            style={{ color: "#06d6d6" }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
