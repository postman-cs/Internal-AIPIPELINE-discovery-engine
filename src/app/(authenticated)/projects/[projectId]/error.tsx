"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Project Error]", error);
  }, [error]);

  return (
    <div className="max-w-md mx-auto px-6 py-16 text-center relative z-10">
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-5"
        style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.2)" }}
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.67-5.67m5.67 5.67l5.67-5.67m-5.67 5.67V4.5" />
        </svg>
      </div>

      <h2 className="text-lg font-bold mb-2" style={{ color: "var(--foreground)" }}>
        Failed to load project data
      </h2>
      <p className="text-xs mb-5" style={{ color: "var(--foreground-muted)" }}>
        {error.message || "Could not load this section. The data might be unavailable or there was a server error."}
      </p>

      <div className="flex items-center justify-center gap-2">
        <button
          onClick={reset}
          className="text-xs px-4 py-2 rounded-lg font-medium transition-all"
          style={{
            background: "rgba(6, 214, 214, 0.1)",
            color: "var(--accent-cyan)",
            border: "1px solid rgba(6, 214, 214, 0.2)",
          }}
        >
          Retry
        </button>
        <Link
          href="/projects"
          className="text-xs px-4 py-2 rounded-lg transition-all"
          style={{
            background: "rgba(255,255,255,0.04)",
            color: "var(--foreground-muted)",
            border: "1px solid var(--border)",
          }}
        >
          All Projects
        </Link>
      </div>
    </div>
  );
}
