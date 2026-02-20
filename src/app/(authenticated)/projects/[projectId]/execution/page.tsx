import { prisma } from "@/lib/prisma";
import { getProject } from "@/lib/actions/projects";
import { requireAuth } from "@/lib/session";
import { notFound } from "next/navigation";
import { DeploymentPlanView } from "./DeploymentPlanView";
import { MonitoringDashboardView } from "./MonitoringDashboardView";
import { IterationPlanView } from "./IterationPlanView";

const EXECUTION_PHASES = [
  {
    phase: "DEPLOYMENT_PLAN" as const,
    label: "Deployment Plan",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
      </svg>
    ),
    color: "#22c55e",
    glowColor: "rgba(34,197,94,0.15)",
    description: "Rollout strategy, CI/CD stages, environment gates",
  },
  {
    phase: "MONITORING" as const,
    label: "Monitoring",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.007H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
    color: "#06d6d6",
    glowColor: "rgba(6,214,214,0.15)",
    description: "Monitors, SLOs, alerts, dashboards, renewal signals",
  },
  {
    phase: "ITERATION" as const,
    label: "Iteration",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M21.015 4.356v4.992" />
      </svg>
    ),
    color: "#34d399",
    glowColor: "rgba(52,211,153,0.15)",
    description: "Backlog, priority matrix, drift analysis, next cycle",
  },
];

export default async function ExecutionPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await requireAuth();
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const artifacts = await prisma.phaseArtifact.findMany({
    where: {
      projectId,
      phase: { in: ["DEPLOYMENT_PLAN", "MONITORING", "ITERATION"] },
    },
    orderBy: [{ phase: "asc" }, { version: "desc" }],
  });

  const phaseMap = new Map<string, (typeof artifacts)[number]>();
  for (const a of artifacts) {
    if (!phaseMap.has(a.phase)) phaseMap.set(a.phase, a);
  }

  const hasAnyData = phaseMap.size > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 page-animate">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(6,214,214,0.15))",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="var(--foreground)" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
              Execution
            </h1>
            <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>
              Deployment, monitoring, and iteration plans for {project.name}
            </p>
          </div>
          {hasAnyData && (
            <span
              className="text-[10px] font-medium px-2.5 py-1 rounded-full ml-auto"
              style={{
                background: phaseMap.size === 3
                  ? "rgba(16,185,129,0.08)"
                  : "rgba(245,158,11,0.08)",
                color: phaseMap.size === 3 ? "#34d399" : "#fbbf24",
                border: `1px solid ${phaseMap.size === 3 ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)"}`,
              }}
            >
              {phaseMap.size}/{EXECUTION_PHASES.length} phases generated
            </span>
          )}
        </div>
      </div>

      {/* Phase navigation cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {EXECUTION_PHASES.map(({ phase, label, icon, color, glowColor, description }) => {
          const artifact = phaseMap.get(phase);
          return (
            <a
              key={phase}
              href={`#${phase.toLowerCase()}`}
              className="rounded-xl p-4 transition-all duration-300 group relative overflow-hidden"
              style={{
                background: artifact ? `${color}04` : "var(--surface)",
                border: `1px solid ${artifact ? `${color}20` : "var(--border)"}`,
              }}
            >
              {artifact && (
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: `radial-gradient(circle at 50% 0%, ${glowColor}, transparent 70%)`,
                  }}
                />
              )}
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300"
                    style={{
                      background: artifact ? `${color}12` : "rgba(255,255,255,0.03)",
                      color: artifact ? color : "var(--foreground-dim)",
                      boxShadow: artifact ? `0 0 12px ${color}15` : "none",
                    }}
                  >
                    {icon}
                  </div>
                  {artifact ? (
                    <StatusBadge status={artifact.status} />
                  ) : (
                    <span
                      className="text-[9px] px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(255,255,255,0.03)", color: "var(--foreground-dim)" }}
                    >
                      PENDING
                    </span>
                  )}
                </div>
                <h3
                  className="text-sm font-semibold mb-0.5"
                  style={{ color: artifact ? color : "var(--foreground-dim)" }}
                >
                  {label}
                </h3>
                <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
                  {artifact ? description : "Not generated yet"}
                </p>
                {artifact && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[9px]" style={{ color: "var(--foreground-dim)" }}>
                      v{artifact.version}
                    </span>
                    <span className="text-[9px]" style={{ color: "var(--foreground-dim)" }}>
                      {artifact.lastComputedAt?.toLocaleDateString() ?? ""}
                    </span>
                  </div>
                )}
              </div>
            </a>
          );
        })}
      </div>

      {/* Content */}
      {!hasAnyData ? (
        <EmptyState />
      ) : (
        <div className="space-y-10">
          {EXECUTION_PHASES.map(({ phase, label, icon, color, glowColor }) => {
            const artifact = phaseMap.get(phase);
            if (!artifact) return null;

            const contentJson = (artifact.contentJson ?? {}) as Record<string, unknown>;

            return (
              <section
                key={phase}
                id={phase.toLowerCase()}
                className="rounded-xl overflow-hidden relative"
                style={{ border: `1px solid ${color}15` }}
              >
                {/* Top glow line */}
                <div
                  className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: `linear-gradient(to right, ${color}60, ${color}20, transparent)` }}
                />

                {/* Header */}
                <div
                  className="flex items-center justify-between px-5 py-3"
                  style={{
                    background: `${color}04`,
                    borderBottom: `1px solid ${color}10`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center"
                      style={{ background: `${color}12`, color, boxShadow: `0 0 10px ${color}20` }}
                    >
                      {icon}
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold" style={{ color }}>{label}</h2>
                    </div>
                    <StatusBadge status={artifact.status} />
                  </div>
                  <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
                    v{artifact.version} · {artifact.lastComputedAt?.toLocaleDateString() ?? "—"}
                  </span>
                </div>

                {/* Body */}
                <div className="px-5 py-5" style={{ background: "var(--background)" }}>
                  {phase === "DEPLOYMENT_PLAN" && <DeploymentPlanView data={contentJson} />}
                  {phase === "MONITORING" && <MonitoringDashboardView data={contentJson} />}
                  {phase === "ITERATION" && <IterationPlanView data={contentJson} />}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; border: string; glow?: string }> = {
    CLEAN: { bg: "rgba(16,185,129,0.1)", text: "#34d399", border: "rgba(16,185,129,0.18)", glow: "0 0 8px rgba(16,185,129,0.15)" },
    DIRTY: { bg: "rgba(245,158,11,0.1)", text: "#fbbf24", border: "rgba(245,158,11,0.18)" },
    NEEDS_REVIEW: { bg: "rgba(59,130,246,0.1)", text: "#60a5fa", border: "rgba(59,130,246,0.18)" },
    STALE: { bg: "rgba(255,255,255,0.04)", text: "var(--foreground-dim)", border: "var(--border)" },
  };
  const s = styles[status] ?? styles.STALE;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}`, boxShadow: s.glow }}
    >
      {status === "CLEAN" && (
        <svg className="w-2.5 h-2.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      )}
      {status.replace(/_/g, " ")}
    </span>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-xl p-16 text-center relative overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 50% 30%, rgba(6,214,214,0.03), transparent 70%)",
        }}
      />
      <div className="relative">
        <div
          className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(6,214,214,0.08))",
            border: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="var(--foreground-dim)" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
          </svg>
        </div>
        <p className="text-sm font-medium mb-2" style={{ color: "var(--foreground-muted)" }}>
          No execution artifacts yet
        </p>
        <p className="text-xs max-w-md mx-auto" style={{ color: "var(--foreground-dim)" }}>
          Run a cascade update and accept upstream proposals
          (Discovery → Topology → Solution Design → Test)
          to generate execution plans.
        </p>
      </div>
    </div>
  );
}
