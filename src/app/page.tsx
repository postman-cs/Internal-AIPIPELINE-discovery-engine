import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Mesh gradient background */}
      <div className="absolute inset-0 mesh-bg grid-bg" />

      {/* Animated orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: "1.5s" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-500/5 rounded-full blur-3xl" />

      <div className="text-center max-w-2xl px-4 relative z-10">
        {/* Logo */}
        <div className="animate-float mb-10">
          <div className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center relative"
               style={{
                 background: "linear-gradient(135deg, #22c55e, #16a34a)",
                 boxShadow: "0 0 40px rgba(34, 197, 94, 0.3), 0 0 80px rgba(34, 197, 94, 0.1)"
               }}>
            <span className="text-white text-3xl font-bold tracking-tight">CL</span>
          </div>
        </div>

        <h1 className="text-5xl font-bold tracking-tight mb-4"
            style={{
              background: "linear-gradient(135deg, #f8fafc, #94a3b8)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
          CortexLab
        </h1>
        <p className="text-lg mb-2" style={{ color: "var(--accent-cyan)" }}>
          Postman CSE Discovery & Intelligence Workflow
        </p>
        <p className="text-sm max-w-md mx-auto mb-10" style={{ color: "var(--foreground-muted)" }}>
          Ingest signals, build customer intelligence, and generate structured
          discovery briefs to accelerate your CSE engagements.
        </p>

        <Link
          href="/login"
          className="btn-primary inline-block text-base px-10 py-3.5 text-lg font-semibold"
        >
          Get Started
        </Link>

        {/* Tech badges */}
        <div className="flex items-center justify-center gap-3 mt-12 flex-wrap">
          {["RAG Engine", "5-Agent Pipeline", "Evidence-Cited", "Topology Mapping", "Cascade Updates"].map((tag) => (
            <span
              key={tag}
              className="text-[11px] font-medium px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "var(--foreground-dim)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <footer className="absolute bottom-6 text-xs" style={{ color: "var(--foreground-dim)" }}>
        Internal tool &middot; Postman CSE Team
      </footer>
    </div>
  );
}
