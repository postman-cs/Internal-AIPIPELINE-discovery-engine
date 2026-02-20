import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="text-center max-w-md px-6">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <span className="text-3xl font-bold tabular-nums" style={{ color: "var(--foreground-dim)" }}>
            404
          </span>
        </div>

        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--foreground)" }}>
          Page not found
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--foreground-muted)" }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="text-sm px-5 py-2.5 rounded-lg font-medium transition-all"
            style={{
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
              color: "white",
              boxShadow: "0 0 20px rgba(34, 197, 94, 0.2)",
            }}
          >
            Go to Dashboard
          </Link>
          <Link
            href="/projects"
            className="text-sm px-5 py-2.5 rounded-lg transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "var(--foreground-muted)",
              border: "1px solid var(--border)",
            }}
          >
            View Projects
          </Link>
        </div>
      </div>
    </div>
  );
}
