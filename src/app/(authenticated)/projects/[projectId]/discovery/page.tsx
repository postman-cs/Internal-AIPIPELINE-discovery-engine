import Link from "next/link";
import { getProject } from "@/lib/actions/projects";
import {
  getLatestDiscoveryArtifact,
  getProjectEvidenceStats,
} from "@/lib/actions/discovery";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DiscoveryForm } from "./DiscoveryForm";
import { AIPipelinePanel } from "./AIPipelinePanel";
import { ServiceTemplateInput } from "./ServiceTemplateInput";
import { DiscoveryArtifactInput } from "@/lib/schemas";
import { getServiceTemplate } from "@/lib/actions/projects";
import { RunCascadeButton } from "../RunCascadeButton";
import { BlackHoleWrapper } from "./BlackHoleWrapper";

export default async function DiscoveryPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  if (!project) notFound();

  const [artifact, evidenceStats, assumptionCount, recentRuns, serviceTemplate, cascadePhases, evidenceBySource] = await Promise.all([
    getLatestDiscoveryArtifact(projectId),
    getProjectEvidenceStats(projectId),
    prisma.assumption.count({ where: { projectId, status: "PENDING" } }),
    prisma.aIRun.findMany({
      where: { projectId, agentType: { in: ["recon_synthesis", "signal_classification", "maturity_scoring", "hypothesis_generation", "brief_generation"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { agentType: true, status: true, durationMs: true, createdAt: true, model: true },
    }),
    getServiceTemplate(projectId),
    prisma.phaseArtifact.findMany({
      where: { projectId },
      select: { phase: true, status: true },
      distinct: ["phase"],
    }),
    prisma.sourceDocument.groupBy({
      by: ["sourceType"],
      where: { projectId },
      _count: true,
    }),
  ]);

  const evidenceCounts: Record<string, number> = {};
  for (const row of evidenceBySource) {
    evidenceCounts[row.sourceType] = row._count;
  }

  const hasCascadeRun = cascadePhases.some(
    (a) => a.status === "CLEAN" || a.status === "CLEAN_WITH_EXCEPTIONS",
  );
  const hasServiceTemplate = !!serviceTemplate?.serviceTemplateContent;
  const hasDiscovery = !!artifact;
  const cascadeReady = hasServiceTemplate && hasDiscovery;

  const defaults: DiscoveryArtifactInput | undefined = artifact
    ? {
        keplerPaste: artifact.keplerPaste || "",
        dnsFindings: artifact.dnsFindings || "",
        headerFindings: artifact.headerFindings || "",
        publicFootprint: artifact.publicFootprint || "",
        authForensics: artifact.authForensics || "",
        cloudGatewaySignals: artifact.cloudGatewaySignals || "",
        developerFrictionSignals: artifact.developerFrictionSignals || "",
        evidenceLinks: artifact.evidenceLinksJson ? JSON.parse(artifact.evidenceLinksJson) : [],
        industry: artifact.industry || "",
        engineeringSize: artifact.engineeringSize || "",
        publicApiPresence: (artifact.publicApiPresence || "") as "" | "Yes" | "No" | "Partial",
        technicalLandscape: artifact.technicalLandscapeJson
          ? JSON.parse(artifact.technicalLandscapeJson)
          : [
              { signal: "Primary Cloud", finding: "", evidence: "", confidence: "" as const },
              { signal: "CDN / Edge", finding: "", evidence: "", confidence: "" as const },
              { signal: "Auth Pattern", finding: "", evidence: "", confidence: "" as const },
              { signal: "Backend Tech", finding: "", evidence: "", confidence: "" as const },
            ],
        maturityLevel: artifact.maturityLevel || undefined,
        maturityJustification: artifact.maturityJustification || "",
        hypothesis: artifact.hypothesis || "",
        recommendedApproach: artifact.recommendedApproach || "",
        conversationAngle: artifact.conversationAngle || "",
        stakeholderTargets: artifact.stakeholderTargetsJson ? JSON.parse(artifact.stakeholderTargetsJson) : [],
        firstMeetingAgenda: artifact.firstMeetingAgendaJson
          ? JSON.parse(artifact.firstMeetingAgendaJson)
          : [
              { timeBlock: "5 min", topic: "Validate assumptions", detail: "" },
              { timeBlock: "10 min", topic: "Pain point mapping", detail: "" },
              { timeBlock: "10 min", topic: "Quick win identification", detail: "" },
              { timeBlock: "5 min", topic: "Next steps", detail: "" },
            ],
      }
    : undefined;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 page-animate">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Discovery: {project.name}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
          {artifact
            ? artifact.aiGenerated
              ? `AI-generated v${artifact.version} — ${(artifact.evidenceCitations as Array<unknown>)?.length || 0} evidence citations`
              : `Manual v${artifact.version} — saving will create v${artifact.version + 1}`
            : "Ingest evidence, then run the AI pipeline or complete manually"}
        </p>
      </div>

      {/* Info cascade flow indicator */}
      <div className="rounded-xl p-4 mb-6" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "var(--foreground-dim)" }}>
          Information Cascade Flow
        </p>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {[
            { label: "Evidence", done: evidenceStats.chunkCount > 0, color: "#22c55e", count: evidenceStats.chunkCount },
            { label: "Service Template", done: !!serviceTemplate?.serviceTemplateContent, color: "#a78bfa", count: null },
            { label: "CortexLab", done: !!artifact?.aiGenerated, color: "#06d6d6", count: recentRuns.filter((r) => r.status === "SUCCESS").length },
            { label: "Discovery Brief", done: !!artifact, color: "#34d399", count: artifact?.version ?? 0 },
            { label: "Cascade", done: hasCascadeRun, color: hasCascadeRun ? "#3b82f6" : cascadeReady ? "#60a5fa" : "var(--foreground-dim)", count: cascadePhases.length > 0 ? cascadePhases.length : null },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center shrink-0">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background: step.done ? `${step.color}18` : "rgba(255,255,255,0.03)",
                    border: `1.5px solid ${step.done ? step.color : "var(--border)"}`,
                    color: step.done ? step.color : "var(--foreground-dim)",
                  }}
                >
                  {step.done ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span className="text-[9px] leading-tight text-center w-16" style={{ color: step.done ? step.color : "var(--foreground-dim)" }}>
                  {step.label}
                  {step.count !== null && <span className="block text-[8px] font-normal opacity-70">{step.count > 0 ? (step.label === "Assumptions" ? `${step.count} pending` : `${step.count}`) : ""}</span>}
                </span>
              </div>
              {i < arr.length - 1 && (
                <div className="w-8 h-px mx-1 mt-[-14px]" style={{ background: step.done ? step.color : "var(--border)" }} />
              )}
            </div>
          ))}
        </div>
      </div>


      {/* Black Hole — Evidence Singularity */}
      <div className="mb-6">
        <BlackHoleWrapper
          evidenceCounts={evidenceCounts}
          totalChunks={evidenceStats.chunkCount}
        />
      </div>

      <ServiceTemplateInput
        projectId={projectId}
        existing={serviceTemplate ? {
          content: serviceTemplate.serviceTemplateContent,
          type: serviceTemplate.serviceTemplateType,
          fileName: serviceTemplate.serviceTemplateFileName,
          notes: serviceTemplate.serviceTemplateNotes,
        } : null}
      />

      <div className="mt-6">
        <AIPipelinePanel
          projectId={projectId}
          evidenceStats={evidenceStats}
          hasArtifact={!!artifact}
          latestVersion={artifact?.version || 0}
        />
      </div>

      {/* Recent AI runs from discovery agents */}
      {recentRuns.length > 0 && (
        <div className="mt-6 rounded-xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--foreground-dim)" }}>Recent Discovery Runs</p>
          <div className="space-y-1.5">
            {recentRuns.map((run, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${run.status === "SUCCESS" ? "bg-green-500" : run.status === "FAILED" ? "bg-red-500" : "bg-yellow-500"}`} />
                  <span className="text-xs" style={{ color: "var(--foreground)" }}>{run.agentType.replace(/_/g, " ")}</span>
                  {run.model && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "var(--foreground-dim)" }}>
                      {run.model}
                    </span>
                  )}
                </div>
                <span className="text-[10px] tabular-nums" style={{ color: "var(--foreground-dim)" }}>
                  {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"} · {run.createdAt.toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Run Cascade CTA — visible after service template + discovery */}
      {cascadeReady && (
        <div
          className="mt-6 rounded-xl p-5 flex items-center justify-between"
          style={{
            background: hasCascadeRun
              ? "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(59,130,246,0.06))"
              : "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))",
            border: `1px solid ${hasCascadeRun ? "rgba(16,185,129,0.2)" : "rgba(59,130,246,0.2)"}`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: hasCascadeRun ? "rgba(16,185,129,0.12)" : "rgba(59,130,246,0.12)",
              }}
            >
              <svg
                className="w-5 h-5"
                style={{ color: hasCascadeRun ? "#34d399" : "#60a5fa" }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M9.172 14.828a4 4 0 010-5.656m5.656 0a4 4 0 010 5.656M12 12h.008v.008H12V12z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                {hasCascadeRun
                  ? `Cascade complete — ${cascadePhases.length} phases generated`
                  : "Ready to run the AI Cascade"}
              </p>
              <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>
                {hasCascadeRun
                  ? "Re-run to regenerate phases with latest discovery data"
                  : "Service template and discovery are ready — generate all 9 pipeline phases"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href={`/projects/${projectId}/updates`}
              className="text-xs"
              style={{ color: "var(--foreground-dim)" }}
            >
              View phases →
            </Link>
            <RunCascadeButton projectId={projectId} />
          </div>
        </div>
      )}

      <div className="mt-8">
        <details className="group">
          <summary
            className="cursor-pointer text-sm font-medium flex items-center gap-2"
            style={{ color: "var(--foreground-muted)" }}
          >
            <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Manual Discovery Form (fill fields directly without AI)
          </summary>
          <div className="mt-4">
            <DiscoveryForm projectId={projectId} defaults={defaults} />
          </div>
        </details>
      </div>
    </div>
  );
}
