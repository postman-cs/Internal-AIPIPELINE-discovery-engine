import Link from "next/link";

const LIFECYCLE_STAGES = [
  { stage: 1, name: "Discovery", color: "#f59e0b" },
  { stage: 2, name: "Scoping", color: "#3b82f6" },
  { stage: 3, name: "Proof", color: "#8b5cf6" },
  { stage: 4, name: "Implementation", color: "#06b6d4" },
  { stage: 5, name: "Validation", color: "#22c55e" },
  { stage: 6, name: "Transition", color: "#10b981" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 mesh-bg grid-bg" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: "1.5s" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-green-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 text-center max-w-3xl">
        <div className="animate-float mb-8">
          <div
            className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center relative"
            style={{
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
              boxShadow: "0 0 40px rgba(34, 197, 94, 0.3), 0 0 80px rgba(34, 197, 94, 0.1)",
            }}
          >
            <span className="text-white text-3xl font-bold tracking-tight">CL</span>
          </div>
        </div>

        <h1
          className="text-5xl sm:text-6xl font-bold tracking-tight mb-4"
          style={{
            background: "linear-gradient(135deg, #f8fafc, #94a3b8)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          CortexLab
        </h1>
        <p className="text-lg sm:text-xl mb-2" style={{ color: "var(--accent-cyan)" }}>
          CSE Engagement Tracking & Intelligence Platform
        </p>
        <p className="text-sm max-w-lg mx-auto mb-10" style={{ color: "var(--foreground-muted)" }}>
          Manage the full CSE use case activation lifecycle — from discovery through pilot validation to transition.
          AI-powered discovery, cascade-driven pipeline automation, and fleet-wide command visibility.
        </p>

        <div className="flex items-center justify-center gap-4 mb-14">
          <Link
            href="/login"
            className="btn-primary inline-block text-base px-10 py-3.5 font-semibold"
          >
            Sign In
          </Link>
          <Link
            href="/about"
            className="inline-block text-sm px-6 py-3 rounded-lg font-medium transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--foreground-muted)",
            }}
          >
            Learn More
          </Link>
        </div>

        {/* Engagement Stage Pipeline Preview */}
        <div
          className="max-w-lg mx-auto rounded-xl p-4"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "var(--foreground-dim)" }}>
            Engagement Lifecycle
          </p>
          <div className="flex items-center gap-1">
            {LIFECYCLE_STAGES.map((s) => (
              <div key={s.stage} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full h-2.5 rounded-sm"
                  style={{ background: `linear-gradient(to right, ${s.color}cc, ${s.color})` }}
                />
                <span className="text-[8px] font-medium" style={{ color: s.color }}>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="absolute bottom-0 left-0 right-0 z-10 py-6 text-center">
        <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>
          CortexLab &middot; Postman CSE Team &middot; Internal Platform
        </p>
      </footer>
    </div>
  );
}
