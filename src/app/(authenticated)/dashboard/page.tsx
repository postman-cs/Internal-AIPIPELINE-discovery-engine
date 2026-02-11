import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { computeProjectHealth, countDiscoveryFields, classifyFreshness } from "@/lib/gamification/scoring";
import { ProgressRing, PhaseProgressBar } from "@/components/ProgressRing";

export default async function DashboardPage() {
  const session = await requireAuth();
  const userId = session.userId;

  const [recentProjects, latestRun, totalDocs, totalChunks, totalAIRuns, phaseArtifacts] = await Promise.all([
    prisma.project.findMany({
      where: { ownerUserId: userId },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      take: 6,
      include: {
        discoveryArtifacts: { orderBy: { version: "desc" }, take: 1 },
        sourceDocuments: { select: { id: true } },
        _count: { select: { sourceDocuments: true, phaseArtifacts: true } },
      },
    }),
    prisma.ingestRun.findFirst({
      where: { userId },
      orderBy: { startedAt: "desc" },
      include: { _count: { select: { items: true } } },
    }),
    prisma.sourceDocument.count({ where: { project: { ownerUserId: userId } } }),
    prisma.documentChunk.count({ where: { document: { project: { ownerUserId: userId } } } }),
    prisma.aIRun.count({ where: { project: { ownerUserId: userId } } }),
    prisma.phaseArtifact.findMany({
      where: { project: { ownerUserId: userId } },
      select: { projectId: true, phase: true },
      distinct: ["projectId", "phase"],
    }),
  ]);

  // Compute per-project phase counts
  const phaseCountByProject = new Map<string, number>();
  for (const pa of phaseArtifacts) {
    phaseCountByProject.set(pa.projectId, (phaseCountByProject.get(pa.projectId) || 0) + 1);
  }

  // Compute health scores
  const projectScores = recentProjects.map((project) => {
    const artifact = project.discoveryArtifacts[0];
    const fields = countDiscoveryFields(artifact as unknown as Record<string, unknown>);
    const health = computeProjectHealth({
      hasDiscoveryArtifact: !!artifact,
      discoveryVersion: artifact?.version || 0,
      isAIGenerated: artifact?.aiGenerated || false,
      filledFieldCount: fields.filled,
      totalFieldCount: fields.total,
      sourceDocCount: project._count.sourceDocuments,
      chunkCount: 0,
      phaseArtifactCount: phaseCountByProject.get(project.id) || 0,
      totalPhases: 10,
      lastUpdatedAt: project.updatedAt,
      lastIngestAt: null,
      pendingProposalCount: 0,
      acceptedProposalCount: 0,
    });
    return { project, health, artifact, freshness: classifyFreshness(project.updatedAt) };
  });

  const MOMENTUM_ICONS = { rising: "↑", steady: "→", cooling: "↓" };
  const MOMENTUM_COLORS = { rising: "var(--accent-green)", steady: "var(--accent-cyan)", cooling: "var(--foreground-dim)" };
  const FRESHNESS_COLORS = { new: "var(--accent-green)", recent: "var(--accent-cyan)", aging: "var(--accent-yellow)", stale: "var(--foreground-dim)" };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
          Welcome back{session.name ? `, ${session.name}` : ""}
        </p>
      </div>

      {/* Quick Stats — gamified */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard value={recentProjects.length} label="Projects" icon="◨" color="var(--accent-orange)" />
        <StatCard value={totalDocs} label="Evidence Docs" icon="◉" color="var(--accent-cyan)" />
        <StatCard value={totalChunks} label="Evidence Chunks" icon="◈" color="var(--accent-blue)" />
        <StatCard value={totalAIRuns} label="AI Runs" icon="⚡" color="var(--accent-purple)" />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 mb-8 flex-wrap">
        <Link href="/ingest" className="btn-primary text-sm">
          Run Ingest
        </Link>
        <Link href="/projects" className="btn-secondary text-sm">
          Create Project
        </Link>
        <span className="text-xs self-center" style={{ color: "var(--foreground-dim)" }}>
          ⌘K to search &amp; navigate
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Projects — with health scores */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              Projects
            </h2>
            <Link href="/projects" className="text-sm transition-colors" style={{ color: "var(--accent-cyan)" }}>
              View all →
            </Link>
          </div>
          {projectScores.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-3xl mb-2">◨</p>
              <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>No projects yet</p>
              <Link href="/projects" className="btn-primary text-sm inline-block">
                Create Your First Project
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {projectScores.map(({ project, health, artifact, freshness }) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-4 p-3 rounded-lg transition-all duration-200 group hover-card"
                >
                  {/* Health Ring */}
                  <ProgressRing value={health.overall} size={42} strokeWidth={3} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                        {project.isPinned && <span className="mr-1" title="Pinned">⊛</span>}
                        {project.name}
                      </p>
                      {/* Momentum indicator */}
                      <span
                        className="text-xs font-bold"
                        style={{ color: MOMENTUM_COLORS[health.momentum] }}
                        title={`Momentum: ${health.momentum}`}
                      >
                        {MOMENTUM_ICONS[health.momentum]}
                      </span>
                    </div>
                    <PhaseProgressBar completed={health.completedPhases} total={health.totalPhases} className="mt-1 max-w-[200px]" />
                  </div>

                  {/* Right side */}
                  <div className="text-right shrink-0 flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full" style={{ background: FRESHNESS_COLORS[freshness] }} title={freshness} />
                    {artifact ? (
                      <span className="badge-success text-xs">v{artifact.version}</span>
                    ) : (
                      <span className="badge-warning text-xs">No discovery</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Latest Ingest Run */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
              Latest Ingest
            </h2>
            {latestRun ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Status</span>
                  <span className={`badge-${latestRun.status === "SUCCESS" ? "success" : "warning"} text-xs`}>
                    {latestRun.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>Items</span>
                  <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{latestRun._count.items}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>When</span>
                  <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>
                    {latestRun.startedAt.toLocaleDateString()}
                  </span>
                </div>
                <Link href="/ingest" className="text-sm block mt-2" style={{ color: "var(--accent-cyan)" }}>
                  View all runs →
                </Link>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>No ingest runs yet</p>
                <Link href="/ingest" className="btn-primary text-sm mt-3 inline-block">
                  Run First Ingest
                </Link>
              </div>
            )}
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="card">
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
              Keyboard Shortcuts
            </h2>
            <div className="space-y-2">
              {[
                { key: "⌘K", label: "Command palette" },
                { key: "G D", label: "Go to Dashboard" },
                { key: "G P", label: "Go to Projects" },
                { key: "G I", label: "Go to Ingest" },
              ].map((s) => (
                <div key={s.key} className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>{s.label}</span>
                  <kbd className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--background)", color: "var(--foreground-dim)", border: "1px solid var(--border)" }}>
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ value, label, icon, color }: { value: number; label: string; icon: string; color: string }) {
  return (
    <div className="card-glow flex items-center gap-3 py-3 px-4">
      <span className="text-xl" style={{ color }}>{icon}</span>
      <div>
        <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
        <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>{label}</p>
      </div>
    </div>
  );
}
