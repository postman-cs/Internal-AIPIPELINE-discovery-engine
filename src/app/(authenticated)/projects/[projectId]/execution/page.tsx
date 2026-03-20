import { prisma } from "@/lib/prisma";
import { getProject } from "@/lib/actions/projects";
import { requireAuth } from "@/lib/session";
import { notFound } from "next/navigation";
import { ExecutionClient } from "./ExecutionClient";

export default async function ExecutionPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await requireAuth();
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const [artifact, user] = await Promise.all([
    prisma.phaseArtifact.findFirst({
      where: { projectId, phase: "DEPLOYMENT_PLAN" },
      orderBy: { version: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { xpLevel: true },
    }),
  ]);

  const contentJson = (artifact?.contentJson ?? {}) as Record<string, unknown>;
  const executedSteps = (contentJson.executedSteps as number[] | undefined) ?? [];
  const userLevel = user?.xpLevel ?? 1;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 page-animate">
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
              Deployment plan for {project.name}
            </p>
          </div>
          {artifact && (
            <StatusBadge status={artifact.status} />
          )}
        </div>
      </div>

      {!artifact ? (
        <EmptyState />
      ) : (
        <ExecutionClient
          projectId={projectId}
          projectName={project.name}
          userLevel={userLevel}
          contentJson={contentJson}
          initialExecutedSteps={executedSteps}
        />
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
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold ml-auto"
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
      className="rounded-xl p-20 text-center relative overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(34,197,94,0.04), transparent 60%)" }} />
      <div className="relative flex flex-col items-center">
        <div className="relative w-20 h-20 mb-6">
          <div
            className="absolute inset-0 rounded-2xl animate-spin"
            style={{ background: "conic-gradient(from 0deg, transparent, rgba(34,197,94,0.25), rgba(6,214,214,0.25), transparent)", animationDuration: "4s" }}
          />
          <div className="absolute inset-[2px] rounded-2xl flex items-center justify-center" style={{ background: "var(--surface)" }}>
            <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="#34d399" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
          </div>
        </div>
        <p className="text-base font-semibold mb-2" style={{ color: "var(--foreground-muted)" }}>
          Deployment plan not generated yet
        </p>
        <p className="text-xs max-w-sm mx-auto leading-relaxed" style={{ color: "var(--foreground-dim)" }}>
          Complete the upstream pipeline phases then run a cascade to generate the deployment plan.
        </p>
      </div>
    </div>
  );
}
