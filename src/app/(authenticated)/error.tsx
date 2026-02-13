"use client";

import { useEffect } from "react";

export default function AuthenticatedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App Error]", error);
  }, [error]);

  return (
    <div className="max-w-md mx-auto px-6 py-24 text-center relative z-10">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
        style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)" }}
      >
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>

      <h2 className="text-xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
        Something went wrong
      </h2>
      <p className="text-sm mb-6" style={{ color: "var(--foreground-muted)" }}>
        {error.message || "An unexpected error occurred. Please try again."}
      </p>

      {error.digest && (
        <p className="text-[10px] font-mono mb-4" style={{ color: "var(--foreground-dim)" }}>
          Error ID: {error.digest}
        </p>
      )}

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="text-sm px-5 py-2.5 rounded-lg font-medium transition-all"
          style={{
            background: "rgba(6, 214, 214, 0.1)",
            color: "var(--accent-cyan)",
            border: "1px solid rgba(6, 214, 214, 0.2)",
          }}
        >
          Try Again
        </button>
        <a
          href="/dashboard"
          className="text-sm px-5 py-2.5 rounded-lg transition-all"
          style={{
            background: "rgba(255,255,255,0.04)",
            color: "var(--foreground-muted)",
            border: "1px solid var(--border)",
          }}
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}
