"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";
import Link from "next/link";

export default function LoginPage() {
  const [state, action] = useActionState(loginAction, null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <div className="w-12 h-12 rounded-xl bg-[#ff6c37] flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-lg font-bold">AI</span>
            </div>
          </Link>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Sign in to AI Pipeline
          </h1>
        </div>
        <form action={action} className="card space-y-4">
          {state?.error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg px-3 py-2">
              {state.error}
            </div>
          )}
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="input-field"
              placeholder="you@postman.com"
              defaultValue="cse@postman.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="input-field"
              placeholder="Enter password"
              defaultValue="pipeline123"
            />
          </div>
          <SubmitButton pendingText="Signing in..." className="btn-primary w-full">
            Sign In
          </SubmitButton>
          <p className="text-xs text-gray-500 text-center mt-2">
            Dev credentials: cse@postman.com / pipeline123
          </p>
        </form>
      </div>
    </div>
  );
}
