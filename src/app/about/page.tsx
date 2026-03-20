import Link from "next/link";

const LIFECYCLE_STAGES = [
  { stage: 1, name: "Technical Discovery", desc: "Current state, future state, and simplest path to proving value mapped out. Workflow change, systems, and success signals defined.", color: "#f59e0b" },
  { stage: 2, name: "Buy-in & Pilot Scoping", desc: "Technical hypothesis converted into customer-approved pilot — narrow enough to execute in <90 days, meaningful enough to prove value.", color: "#3b82f6" },
  { stage: 3, name: "Internal Proof & Asset Prep", desc: "Concept proven internally first. Scripts, templates, collections, rulesets prepared and cataloged for reuse.", color: "#8b5cf6" },
  { stage: 4, name: "Customer Implementation", desc: "Customer implements the proven pattern in their own environment with CSE guidance. Measurable usage increases tracked.", color: "#06b6d4" },
  { stage: 5, name: "Pilot Validation & Pattern Creation", desc: "Use case confirmed working as expected. Implementation kit and case study documented for scale.", color: "#22c55e" },
  { stage: 6, name: "Transition / Redeploy", desc: "Use case no longer needs day-to-day CSE involvement. Assets transferred, next motion scheduled, CSE capacity freed.", color: "#10b981" },
];

const CAPABILITIES = [
  {
    title: "Engagement Lifecycle",
    desc: "Track every CSE use case activation through 6 stages — from technical discovery through pilot validation to transition and redeployment.",
    color: "#22c55e",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    title: "AI Discovery Pipeline",
    desc: "10-phase cascade from Discovery through Build Log — AI-driven reconnaissance, topology mapping, and solution design.",
    color: "#06d6d6",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
  },
  {
    title: "Fleet Command Map",
    desc: "Real-time canvas visualization — CSE planets, project moons, health rings, risk glow, and the Admiral's command star.",
    color: "#c9a227",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
      </svg>
    ),
  },
  {
    title: "Build Logs",
    desc: "Structured use case activation documentation — use case, success criteria, environment baseline, internal proof, implementation kit, case study, and reusable patterns.",
    color: "#10b981",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    title: "Blocker Warfare",
    desc: "Map blockers, design surgical missiles, and arm nuclear options — complete stakeholder mapping and escalation chains.",
    color: "#ef4444",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    title: "Admiral's Bridge",
    desc: "Fleet-wide command dashboard — CSE workload tracking, engagement stage pipeline, tasks, notes, and project reassignment.",
    color: "#8b5cf6",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
  {
    title: "XP & Gamification",
    desc: "Planet evolution system — CSEs earn XP for discovery, cascade runs, blocker resolution, and pilot validation. Leaderboard and streaks.",
    color: "#fbbf24",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 01-2.77.895m0 0A6.023 6.023 0 0112 10.622m0 0a6.023 6.023 0 01-1.5.105" />
      </svg>
    ),
  },
  {
    title: "Jira Integration",
    desc: "Automatic issue creation, stage-synced status transitions, leadership Kanban board, and weekly digest reports.",
    color: "#60a5fa",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-1.125l4.5-4.5a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
  },
];

const CASCADE_PHASES = [
  "Discovery", "Current Topology", "Future State", "Solution Design",
  "Infrastructure", "Test Design", "Craft Solution", "Test Solution",
  "Deployment Plan", "Build Log",
];

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 mesh-bg grid-bg" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: "1.5s" }} />

      {/* Sticky Nav */}
      <nav className="sticky top-0 z-30 backdrop-blur-xl" style={{ background: "rgba(1,4,9,0.8)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
            >
              <span className="text-white text-xs font-bold">CL</span>
            </div>
            <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>CortexLab</span>
          </Link>
          <Link
            href="/login"
            className="text-xs font-medium px-4 py-1.5 rounded-lg transition-all"
            style={{
              background: "rgba(34,197,94,0.1)",
              color: "#22c55e",
              border: "1px solid rgba(34,197,94,0.2)",
            }}
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 pt-20 pb-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
            style={{
              background: "linear-gradient(135deg, #f8fafc, #94a3b8)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            About CortexLab
          </h1>
          <p className="text-lg mb-2" style={{ color: "var(--accent-cyan)" }}>
            CSE Engagement Tracking & Intelligence Platform
          </p>
          <p className="text-sm max-w-lg mx-auto" style={{ color: "var(--foreground-muted)" }}>
            Manage the full CSE use case activation lifecycle — from technical discovery through pilot validation to transition.
            AI-powered discovery, cascade-driven pipeline automation, and fleet-wide command visibility.
          </p>
        </div>
      </section>

      {/* Engagement Lifecycle */}
      <section className="relative z-10 px-4 pb-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-8" style={{ color: "var(--foreground)" }}>
            Engagement Lifecycle
          </h2>
          <div className="relative">
            {/* Connecting line */}
            <div
              className="hidden lg:block absolute top-8 left-0 right-0 h-0.5"
              style={{ background: "linear-gradient(to right, #64748b, #f59e0b, #3b82f6, #8b5cf6, #06b6d4, #22c55e, #10b981)" }}
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {LIFECYCLE_STAGES.map((s) => (
                <div key={s.stage} className="flex flex-col items-center text-center">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold mb-2 relative z-10"
                    style={{
                      background: `${s.color}15`,
                      color: s.color,
                      border: `2px solid ${s.color}40`,
                      boxShadow: `0 0 20px ${s.color}10`,
                    }}
                  >
                    S{s.stage}
                  </div>
                  <p className="text-xs font-semibold mb-1" style={{ color: s.color }}>{s.name}</p>
                  <p className="text-[10px] leading-relaxed" style={{ color: "var(--foreground-dim)" }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Grid */}
      <section className="relative z-10 px-4 pb-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-center mb-2" style={{ color: "var(--foreground)" }}>
            Platform Capabilities
          </h2>
          <p className="text-sm text-center mb-10" style={{ color: "var(--foreground-dim)" }}>
            Everything a CSE team needs to run structured, repeatable engagements at scale.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CAPABILITIES.map((cap) => (
              <div
                key={cap.title}
                className="rounded-xl p-5 relative overflow-hidden group transition-all duration-300"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <div
                  className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: `linear-gradient(to right, ${cap.color}60, ${cap.color}15, transparent)` }}
                />
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: `${cap.color}12`, color: cap.color }}
                >
                  {cap.icon}
                </div>
                <h3 className="text-sm font-semibold mb-1.5" style={{ color: "var(--foreground)" }}>
                  {cap.title}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--foreground-dim)" }}>
                  {cap.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Cascade Pipeline */}
      <section className="relative z-10 px-4 pb-16">
        <div className="max-w-4xl mx-auto">
          <div
            className="rounded-xl p-6"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--foreground)" }}>
              10-Phase AI Cascade Pipeline
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {CASCADE_PHASES.map((phase, i) => {
                const isLast = i === CASCADE_PHASES.length - 1;
                const hue = 140 + i * 20;
                const color = isLast ? "#10b981" : `hsl(${hue}, 60%, 55%)`;
                return (
                  <div
                    key={phase}
                    className="rounded-lg p-3 text-center transition-all"
                    style={{
                      background: `${color}08`,
                      border: `1px solid ${color}20`,
                    }}
                  >
                    <p className="text-lg font-bold tabular-nums mb-0.5" style={{ color }}>{i + 1}</p>
                    <p className="text-[10px] font-medium" style={{ color: "var(--foreground-dim)" }}>{phase}</p>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] mt-4 text-center" style={{ color: "var(--foreground-dim)" }}>
              Each phase is automatically invalidated and recomputed when upstream evidence changes.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-4 pb-20">
        <div className="max-w-md mx-auto text-center">
          <Link
            href="/login"
            className="btn-primary inline-block text-base px-10 py-3.5 font-semibold"
          >
            Sign In
          </Link>
        </div>
      </section>

      <footer className="relative z-10 py-6 text-center">
        <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>
          CortexLab &middot; Postman CSE Team &middot; Internal Platform
        </p>
      </footer>
    </div>
  );
}
