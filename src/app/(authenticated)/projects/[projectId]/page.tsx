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
import { ProjectDetailsEditor } from "./ProjectDetailsEditor";
import { ENGAGEMENT_STAGES, suggestEngagementStage } from "@/lib/engagement";
import { EngagementStageUpdateButton } from "./EngagementStageUpdateButton";
import { NextStepGuide } from "./NextStepGuide";
import { RunCascadeButton } from "./RunCascadeButton";
import { PocDeliverablesTracker } from "./PocDeliverables";
import type { PocDeliverable } from "@/lib/poc-deliverables-types";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const session = await requireAuth();
  const jiraInfo = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      jiraIssueKey: true,
      jiraIssueId: true,
      owner: { select: { jiraBaseUrl: true } },
    },
  });

  const pocProject = await prisma.project.findUnique({
    where: { id: projectId },
    select: { pocDeliverablesJson: true },
  });
  const pocDeliverables = (pocProject?.pocDeliverablesJson as unknown as PocDeliverable[] | null) ?? null;

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
    totalPhases: 10, // 9 cascade phases + BUILD_LOG
    lastUpdatedAt: project.updatedAt,
    lastIngestAt: null,
    pendingProposalCount: 0,
    acceptedProposalCount: 0,
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
              {project.name}
            </h1>
            {jiraInfo?.jiraIssueKey && jiraInfo.owner?.jiraBaseUrl && (
              <a
                href={`${jiraInfo.owner.jiraBaseUrl}/browse/${jiraInfo.jiraIssueKey}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all duration-200 hover:brightness-110"
                style={{
                  background: "rgba(96, 165, 250, 0.1)",
                  color: "#60a5fa",
                  border: "1px solid rgba(96, 165, 250, 0.2)",
                }}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                {jiraInfo.jiraIssueKey}
              </a>
            )}
          </div>
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

      {/* Engagement Stage Tracker */}
      <EngagementStageTracker
        projectId={projectId}
        stage={project.engagementStage ?? 0}
        suggestedStage={suggestEngagementStage({
          hasDiscoveryArtifact: phaseArtifacts.some((a) => a.phase === "DISCOVERY" && (a.status === "CLEAN" || a.status === "CLEAN_WITH_EXCEPTIONS")),
          hasSolutionDesign: phaseArtifacts.some((a) => a.phase === "SOLUTION_DESIGN" && (a.status === "CLEAN" || a.status === "CLEAN_WITH_EXCEPTIONS")),
          repoInitialized: !!project.gitRepoName,
          craftSolutionClean: phaseArtifacts.some((a) => a.phase === "CRAFT_SOLUTION" && (a.status === "CLEAN" || a.status === "CLEAN_WITH_EXCEPTIONS")),
          buildLogComplete: phaseArtifacts.some((a) => a.phase === "BUILD_LOG" && a.version >= 1),
          allDeliveryGatesPassed: !!project.serviceTemplateContent && !!project.gitRepoName && !!project.lastRepoPushAt && phaseArtifacts.some((a) => a.phase === "BUILD_LOG" && a.version >= 1),
        })}
      />

      {/* Delivery Readiness */}
      <DeliveryReadiness
        projectId={projectId}
        serviceTemplateLoaded={!!project.serviceTemplateContent}
        discoveryClean={phaseArtifacts.some((a) => a.phase === "DISCOVERY" && (a.status === "CLEAN" || a.status === "CLEAN_WITH_EXCEPTIONS"))}
        cascadeComplete={
          ["DISCOVERY", "CURRENT_TOPOLOGY", "DESIRED_FUTURE_STATE", "SOLUTION_DESIGN", "INFRASTRUCTURE", "TEST_DESIGN", "CRAFT_SOLUTION", "TEST_SOLUTION", "DEPLOYMENT_PLAN"].every(
            (p) => phaseArtifacts.some((a) => a.phase === p && (a.status === "CLEAN" || a.status === "CLEAN_WITH_EXCEPTIONS"))
          )
        }
        repoInitialized={!!project.gitRepoName}
        artifactsPushed={!!project.lastRepoPushAt}
        buildLogComplete={phaseArtifacts.some((a) => a.phase === "BUILD_LOG" && a.version >= 1)}
        engagementStage={project.engagementStage ?? 0}
        pocDeliverablesComplete={pocDeliverables ? pocDeliverables.every((d) => d.completed) : false}
      />

      {/* POC Deliverables */}
      <PocDeliverablesTracker projectId={projectId} initialDeliverables={pocDeliverables} />

      {/* Run Cascade CTA — shown once service template + discovery are done */}
      {!!project.serviceTemplateContent &&
        phaseArtifacts.some((a) => a.phase === "DISCOVERY" && (a.status === "CLEAN" || a.status === "CLEAN_WITH_EXCEPTIONS")) && (
        <div
          className="rounded-xl p-5 mb-6 flex items-center justify-between"
          style={{
            background: "linear-gradient(135deg, rgba(59,130,246,0.06), rgba(139,92,246,0.06))",
            border: "1px solid rgba(59,130,246,0.15)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "rgba(59,130,246,0.12)" }}
            >
              <svg className="w-5 h-5" style={{ color: "#60a5fa" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M9.172 14.828a4 4 0 010-5.656m5.656 0a4 4 0 010 5.656M12 12h.008v.008H12V12z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                Ready to run the AI Cascade
              </p>
              <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>
                Service template loaded and discovery complete — generate all 9 pipeline phases
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href={`/projects/${projectId}/updates`}
              className="text-xs"
              style={{ color: "var(--foreground-dim)" }}
            >
              Advanced options →
            </Link>
            <RunCascadeButton projectId={projectId} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Metadata — editable */}
        <ProjectDetailsEditor
          project={{
            id: project.id,
            name: project.name,
            primaryDomain: project.primaryDomain,
            apiDomain: project.apiDomain,
            publicWorkspaceUrl: project.publicWorkspaceUrl,
            customerContactName: project.customerContactName,
            customerContactEmail: project.customerContactEmail,
            jiraProjectKey: project.jiraProjectKey,
            postmanWorkspaceId: project.postmanWorkspaceId,
            postmanApiKey: project.postmanApiKey ? "••••••••" : null,
            gitProvider: project.gitProvider,
            gitRepoOwner: project.gitRepoOwner,
            gitRepoName: project.gitRepoName,
            gitToken: project.gitToken ? "••••••••" : null,
            gitBaseBranch: project.gitBaseBranch,
            createdAt: project.createdAt,
          }}
          evidenceSummary={`${evidenceStats.docCount} docs, ${evidenceStats.chunkCount} chunks`}
        />

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

      <NextStepGuide
        projectId={projectId}
        cascade={{
          phaseStatuses: Object.fromEntries(phaseArtifacts.map((a) => [a.phase, a.status])),
          hasServiceTemplate: !!project.serviceTemplateContent,
          hasDiscovery: phaseArtifacts.some((a) => a.phase === "DISCOVERY" && (a.status === "CLEAN" || a.status === "CLEAN_WITH_EXCEPTIONS")),
          repoInitialized: !!project.gitRepoName,
          artifactsPushed: !!project.lastRepoPushAt,
          buildLogComplete: phaseArtifacts.some((a) => a.phase === "BUILD_LOG" && a.version >= 1),
          pendingAssumptions: assumptionStats.pending,
          activeBlockers: blockerStats.active,
          dirtyPhaseCount: phaseArtifacts.filter((a) => a.status === "DIRTY").length,
        }}
      />
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

function EngagementStageTracker({ stage, suggestedStage, projectId }: { stage: number; suggestedStage?: number; projectId: string }) {
  const current = ENGAGEMENT_STAGES[stage] ?? ENGAGEMENT_STAGES[0];
  const showSuggestion = suggestedStage !== undefined && suggestedStage > stage;
  return (
    <div className="rounded-xl p-5 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          Engagement Lifecycle
        </h3>
        <div className="flex items-center gap-2">
          {showSuggestion && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: "rgba(139,92,246,0.08)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.15)" }}>
                Data suggests Stage {suggestedStage}
              </span>
              <EngagementStageUpdateButton projectId={projectId} suggestedStage={suggestedStage!} />
            </div>
          )}
          <span className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: `${current.color}15`, color: current.color, border: `1px solid ${current.color}25` }}>
            Stage {stage}: {current.name}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 mb-2">
        {ENGAGEMENT_STAGES.map((s) => (
          <div
            key={s.stage}
            className="flex-1 h-3 rounded-sm transition-all"
            title={`S${s.stage}: ${s.name} — ${s.definition}`}
            style={{
              background: s.stage <= stage
                ? `linear-gradient(to right, ${s.color}cc, ${s.color})`
                : "rgba(255,255,255,0.04)",
              opacity: s.stage <= stage ? 1 : 0.5,
              boxShadow: s.stage === stage ? `0 0 8px ${s.color}40` : "none",
            }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {ENGAGEMENT_STAGES.map((s) => (
            <span key={s.stage} className="text-[8px] font-medium" style={{ color: s.stage <= stage ? s.color : "var(--foreground-dim)", opacity: s.stage <= stage ? 1 : 0.4 }}>
              {s.shortName}
            </span>
          ))}
        </div>
        {stage < 6 && (
          <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
            Next: {current.triggerToAdvance}
          </span>
        )}
      </div>
      {stage < 6 && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-[10px] font-medium mb-1.5" style={{ color: "var(--foreground-muted)" }}>
            Stage Gate Requirements
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ENGAGEMENT_STAGES[stage + 1]?.gateRequirements.map((req, i) => (
              <span key={i} className="text-[9px] px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.03)", color: "var(--foreground-dim)", border: "1px solid var(--border)" }}>
                {req}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DeliveryReadiness({
  projectId,
  serviceTemplateLoaded,
  discoveryClean,
  cascadeComplete,
  repoInitialized,
  artifactsPushed,
  buildLogComplete,
  engagementStage,
  pocDeliverablesComplete,
}: {
  projectId: string;
  serviceTemplateLoaded: boolean;
  discoveryClean: boolean;
  cascadeComplete: boolean;
  repoInitialized: boolean;
  artifactsPushed: boolean;
  buildLogComplete: boolean;
  engagementStage: number;
  pocDeliverablesComplete: boolean;
}) {
  const items = [
    { label: "Service template loaded", done: serviceTemplateLoaded, href: `/projects/${projectId}/discovery` },
    { label: "Discovery complete", done: discoveryClean, href: `/projects/${projectId}/discovery` },
    { label: "AI cascade complete (9 phases)", done: cascadeComplete, href: `/projects/${projectId}/updates` },
    { label: "POC deliverables complete", done: pocDeliverablesComplete, href: null },
    { label: "Repo initialized", done: repoInitialized, href: `/projects/${projectId}/repo` },
    { label: "Artifacts pushed to repo", done: artifactsPushed, href: `/projects/${projectId}/repo` },
    { label: "Build log completed", done: buildLogComplete, href: `/projects/${projectId}/buildlog` },
    { label: "Engagement stage >= POV (5)", done: engagementStage >= 5, href: null },
  ];

  const completed = items.filter((i) => i.done).length;
  const pct = Math.round((completed / items.length) * 100);
  const allDone = completed === items.length;

  return (
    <div className="rounded-xl p-5 mb-6" style={{ background: "var(--surface)", border: `1px solid ${allDone ? "rgba(16,185,129,0.3)" : "var(--border)"}` }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Delivery Readiness</h3>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{
          background: allDone ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)",
          color: allDone ? "#34d399" : "var(--foreground-dim)",
          border: `1px solid ${allDone ? "rgba(16,185,129,0.2)" : "var(--border)"}`,
        }}>
          {pct}% — {completed}/{items.length}
        </span>
      </div>

      <div className="h-2 rounded-full mb-4 overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: allDone ? "linear-gradient(to right, #10b981, #34d399)" : "linear-gradient(to right, #06b6d4, #22c55e)" }} />
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{
              background: item.done ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.03)",
              border: `1.5px solid ${item.done ? "#34d399" : "var(--border)"}`,
            }}>
              {item.done && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="#34d399" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            {item.href ? (
              <Link href={item.href} className="text-xs hover:underline" style={{ color: item.done ? "#34d399" : "var(--foreground-muted)" }}>
                {item.label}
              </Link>
            ) : (
              <span className="text-xs" style={{ color: item.done ? "#34d399" : "var(--foreground-muted)" }}>{item.label}</span>
            )}
          </div>
        ))}
      </div>

      {allDone && (
        <div className="mt-4 pt-3 text-center" style={{ borderTop: "1px solid rgba(16,185,129,0.15)" }}>
          <p className="text-sm font-semibold" style={{ color: "#34d399" }}>Ready for Handoff</p>
          <p className="text-[10px] mt-1" style={{ color: "var(--foreground-dim)" }}>All delivery gates passed. Complete the project from the Build Log page.</p>
        </div>
      )}
    </div>
  );
}

