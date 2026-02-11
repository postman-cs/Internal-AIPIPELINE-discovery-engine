import { getProject } from "@/lib/actions/projects";
import {
  getLatestDiscoveryArtifact,
  getProjectEvidenceStats,
} from "@/lib/actions/discovery";
import { notFound } from "next/navigation";
import { DiscoveryForm } from "./DiscoveryForm";
import { AIPipelinePanel } from "./AIPipelinePanel";
import { DiscoveryArtifactInput } from "@/lib/schemas";

export default async function DiscoveryPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  if (!project) notFound();

  const [artifact, evidenceStats] = await Promise.all([
    getLatestDiscoveryArtifact(projectId),
    getProjectEvidenceStats(projectId),
  ]);

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
    <div className="max-w-5xl mx-auto px-6 py-8">
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

      <AIPipelinePanel
        projectId={projectId}
        evidenceStats={evidenceStats}
        hasArtifact={!!artifact}
        latestVersion={artifact?.version || 0}
      />

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
