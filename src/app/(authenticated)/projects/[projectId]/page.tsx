import Link from "next/link";
import { getProject } from "@/lib/actions/projects";
import { getNotes } from "@/lib/actions/notes";
import { getProjectEvidenceStats } from "@/lib/actions/discovery";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { computeProjectHealth, countDiscoveryFields } from "@/lib/gamification/scoring";
import { ProgressRing, PhaseProgressBar } from "@/components/ProgressRing";
import { ProjectActions } from "./ProjectActions";
import { QuickNotesSection } from "./QuickNotes";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const session = await requireAuth();
  const [evidenceStats, notes, phaseArtifacts, recentAIRuns, assumptionCounts, blockerCounts] = await Promise.all([
    getProjectEvidenceStats(projectId),
    getNotes(projectId),
    prisma.phaseArtifact.findMany({
      where: { projectId, project: { ownerUserId: session.userId } },
      select: { phase: true, version: true, status: true, lastComputedAt: true },
      distinct: ["phase"],
      orderBy: { version: "desc" },
    }),
    prisma.aIRun.findMany({
      where: { projectId, project: { ownerUserId: session.userId } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, agentType: true, status: true, durationMs: true, createdAt: true },
    }),
    prisma.assumption.groupBy({
      by: ["status"],
      where: { projectId },
      _count: true,
    }),
    prisma.blocker.groupBy({
      by: ["status"],
      where: { projectId },
      _count: true,
    }),
  ]);

  const assumptionStats = {
    total: assumptionCounts.reduce((s, g) => s + g._count, 0),
    pending: assumptionCounts.find((g) => g.status === "PENDING")?._count ?? 0,
    verified: assumptionCounts.find((g) => g.status === "VERIFIED")?._count ?? 0,
    corrected: assumptionCounts.find((g) => g.status === "CORRECTED")?._count ?? 0,
    rejected: assumptionCounts.find((g) => g.status === "REJECTED")?._count ?? 0,
  };

  const blockerStats = {
    total: blockerCounts.reduce((s, g) => s + g._count, 0),
    active: blockerCounts.filter((g) => !["NEUTRALIZED", "ACCEPTED", "DORMANT"].includes(g.status)).reduce((s, g) => s + g._count, 0),
    neutralized: blockerCounts.find((g) => g.status === "NEUTRALIZED")?._count ?? 0,
  };

  const latestArtifact = project.discoveryArtifacts[0];
  const fields = countDiscoveryFields(latestArtifact as unknown as Record<string, unknown>);

  const health = computeProjectHealth({
    hasDiscoveryArtifact: !!latestArtifact,
    discoveryVersion: latestArtifact?.version || 0,
    isAIGenerated: latestArtifact?.aiGenerated || false,
    filledFieldCount: fields.filled,
    totalFieldCount: fields.total,
    sourceDocCount: evidenceStats.docCount,
    chunkCount: evidenceStats.chunkCount,
    phaseArtifactCount: phaseArtifacts.length,
    totalPhases: 10,
    lastUpdatedAt: project.updatedAt,
    lastIngestAt: null,
    pendingProposalCount: 0,
    acceptedProposalCount: 0,
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            {project.name}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
            Project Overview
          </p>
        </div>
        <ProjectActions projectId={projectId} isPinned={project.isPinned} />
      </div>

      {/* Health Score Banner */}
      <div
        className="rounded-xl p-5 mb-6 flex items-center gap-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <ProgressRing value={health.overall} size={72} strokeWidth={4} label="Health" />
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MiniStat label="Discovery" value={health.discoveryCompleteness} />
          <MiniStat label="Evidence" value={health.evidenceDensity} />
          <MiniStat label="Phases" value={health.phaseProgress} />
          <MiniStat label="Freshness" value={health.freshness} />
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--foreground-dim)" }}>
            {health.level}
          </p>
          <PhaseProgressBar completed={health.completedPhases} total={health.totalPhases} className="mt-2 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Metadata */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Details
          </h2>
          <dl className="space-y-3">
            <DetailRow label="Primary Domain" value={project.primaryDomain || "—"} />
            <DetailRow label="API Domain" value={project.apiDomain || "—"} />
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>
                Public Workspace URL
              </dt>
              <dd className="text-sm mt-0.5" style={{ color: "var(--foreground)" }}>
                {project.publicWorkspaceUrl ? (
                  <a href={project.publicWorkspaceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-cyan)" }}>
                    {project.publicWorkspaceUrl}
                  </a>
                ) : "—"}
              </dd>
            </div>
            <DetailRow label="Created" value={project.createdAt.toLocaleDateString()} />
            <DetailRow label="Evidence" value={`${evidenceStats.docCount} docs, ${evidenceStats.chunkCount} chunks`} />
          </dl>
        </div>

        {/* Discovery Status */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Discovery
          </h2>
          {latestArtifact ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Version</span>
                <span className="badge-success">v{latestArtifact.version}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Maturity</span>
                <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  {latestArtifact.maturityLevel ? `Level ${latestArtifact.maturityLevel}` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Fields</span>
                <span className="text-sm" style={{ color: "var(--foreground-dim)" }}>
                  {fields.filled}/{fields.total} filled
                </span>
              </div>
              <div className="flex gap-2 pt-2">
                <Link href={`/projects/${project.id}/discovery`} className="btn-primary text-sm flex-1 text-center">
                  Edit Discovery
                </Link>
                <Link href={`/projects/${project.id}/discovery/brief`} className="btn-secondary text-sm flex-1 text-center">
                  View Brief
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>No discovery artifact yet</p>
              <Link href={`/projects/${project.id}/discovery`} className="btn-primary text-sm inline-block">
                Start Discovery
              </Link>
            </div>
          )}
        </div>

        {/* Assumption Verification Health */}
        <Link href={`/projects/${project.id}/assumptions`} className="card group transition-all duration-200 hover:border-[var(--accent-cyan)]">
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Assumption Verification
          </h2>
          {assumptionStats.total > 0 ? (
            <>
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="text-center">
                  <p className="text-lg font-bold tabular-nums" style={{ color: assumptionStats.pending > 0 ? "#fbbf24" : "var(--foreground-dim)" }}>{assumptionStats.pending}</p>
                  <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Pending</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold tabular-nums" style={{ color: "#34d399" }}>{assumptionStats.verified}</p>
                  <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Verified</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold tabular-nums" style={{ color: "#60a5fa" }}>{assumptionStats.corrected}</p>
                  <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Corrected</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold tabular-nums" style={{ color: "#f87171" }}>{assumptionStats.rejected}</p>
                  <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Rejected</p>
                </div>
              </div>
              {/* Health bar */}
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.round(((assumptionStats.verified + assumptionStats.corrected) / assumptionStats.total) * 100)}%`,
                    background: "linear-gradient(90deg, #34d399, #06d6d6)",
                  }}
                />
              </div>
              <p className="text-[10px] text-right mt-1" style={{ color: "var(--foreground-dim)" }}>
                {Math.round(((assumptionStats.verified + assumptionStats.corrected) / assumptionStats.total) * 100)}% verified
              </p>
            </>
          ) : (
            <p className="text-sm" style={{ color: "var(--foreground-dim)" }}>No assumptions generated yet. Run the AI pipeline to get started.</p>
          )}
        </Link>

        {/* Blocker Status */}
        <Link href={`/projects/${project.id}/blockers`} className="card group transition-all duration-200 hover:border-[var(--accent-cyan)]">
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Blocker Status
          </h2>
          {blockerStats.total > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center">
                  <p className="text-lg font-bold tabular-nums" style={{ color: "var(--foreground)" }}>{blockerStats.total}</p>
                  <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Total</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold tabular-nums" style={{ color: blockerStats.active > 0 ? "#f59e0b" : "var(--foreground-dim)" }}>{blockerStats.active}</p>
                  <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Active</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold tabular-nums" style={{ color: "#34d399" }}>{blockerStats.neutralized}</p>
                  <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Neutralized</p>
                </div>
              </div>
              {/* Neutralization bar */}
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${blockerStats.total > 0 ? Math.round((blockerStats.neutralized / blockerStats.total) * 100) : 0}%`,
                    background: "linear-gradient(90deg, #34d399, #06d6d6)",
                  }}
                />
              </div>
              <p className="text-[10px] text-right mt-1" style={{ color: "var(--foreground-dim)" }}>
                {blockerStats.total > 0 ? Math.round((blockerStats.neutralized / blockerStats.total) * 100) : 0}% neutralized
              </p>
            </>
          ) : (
            <p className="text-sm" style={{ color: "var(--foreground-dim)" }}>No blockers detected. The pipeline is clear.</p>
          )}
        </Link>

        {/* Recent Activity */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Recent Activity
          </h2>
          {recentAIRuns.length > 0 ? (
            <div className="space-y-2">
              {recentAIRuns.map((run) => (
                <div key={run.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${run.status === "SUCCESS" ? "bg-green-500" : run.status === "FAILED" ? "bg-red-500" : "bg-yellow-500"}`} />
                    <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                      {run.agentType}
                    </span>
                  </div>
                  <span className="text-[10px] tabular-nums" style={{ color: "var(--foreground-dim)" }}>
                    {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"} · {run.createdAt.toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--foreground-dim)" }}>No AI activity yet</p>
          )}
          {phaseArtifacts.length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--foreground-muted)" }}>
                Phase Artifacts
              </p>
              <div className="flex flex-wrap gap-1.5">
                {phaseArtifacts.map((pa) => (
                  <span
                    key={pa.phase}
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: pa.status === "CLEAN" ? "rgba(16,185,129,0.1)" : pa.status === "DIRTY" ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.04)",
                      color: pa.status === "CLEAN" ? "var(--accent-green)" : pa.status === "DIRTY" ? "var(--accent-yellow)" : "var(--foreground-dim)",
                      border: `1px solid ${pa.status === "CLEAN" ? "rgba(16,185,129,0.15)" : pa.status === "DIRTY" ? "rgba(245,158,11,0.15)" : "var(--border)"}`,
                    }}
                  >
                    {pa.phase.replace(/_/g, " ")} v{pa.version}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick Notes */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Notes
          </h2>
          <QuickNotesSection projectId={projectId} initialNotes={notes} />
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>{label}</dt>
      <dd className="text-sm mt-0.5" style={{ color: "var(--foreground)" }}>{value}</dd>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  const color = value >= 60 ? "var(--accent-green)" : value >= 30 ? "var(--accent-yellow)" : "var(--foreground-dim)";
  return (
    <div className="text-center">
      <p className="text-lg font-bold tabular-nums" style={{ color }}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>{label}</p>
    </div>
  );
}

