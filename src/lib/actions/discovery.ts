"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { discoveryArtifactSchema, DiscoveryArtifactInput } from "@/lib/schemas";
import { revalidatePath } from "next/cache";
import { runDiscoveryPipeline } from "@/lib/ai/orchestrator";
import { ingestDocument } from "@/lib/ai/ingest";
import { createEvidenceSnapshot } from "@/lib/cascade/snapshot";
import { runImpactAnalysis } from "@/lib/cascade/impact";

// ---------------------------------------------------------------------------
// Manual Discovery Artifact (existing workflow — user fills form)
// ---------------------------------------------------------------------------

function generateBriefMarkdown(
  projectName: string,
  data: DiscoveryArtifactInput
): string {
  const techRows = (data.technicalLandscape || [])
    .map(
      (t) =>
        `| ${t.signal} | ${t.finding || ""} | ${t.evidence || ""} | ${t.confidence || ""} |`
    )
    .join("\n");

  const stakeholderRows = (data.stakeholderTargets || [])
    .map((s) => `| ${s.role} | ${s.why} | ${s.firstMeetingGoal} |`)
    .join("\n");

  const agendaItems = (data.firstMeetingAgenda || [])
    .map((a, i) => `${i + 1}. ${a.topic} (${a.timeBlock}) - ${a.detail || "TBD"}`)
    .join("\n");

  return `# Discovery Brief: ${projectName}

## Company Snapshot
- **Industry**: ${data.industry || "Unknown"}
- **Engineering Size** (estimate): ${data.engineeringSize || "Unknown"}
- **Public API Presence**: ${data.publicApiPresence || "Unknown"}

## Technical Landscape
| Signal | Finding | Evidence | Confidence |
|--------|---------|----------|------------|
${techRows}

## API Maturity Assessment
- **Level**: ${data.maturityLevel || "Not assessed"}
- **Justification**: ${data.maturityJustification || "Not provided"}

## Public Footprint
### Postman Network
${data.publicFootprint || "Not assessed"}

### Developer Portal
${data.developerFrictionSignals || "Not assessed"}

### GitHub / Engineering Presence
${data.cloudGatewaySignals || "Not assessed"}

## Hypothesis
${data.hypothesis || "Not defined"}

## Recommended Approach
- **Start with Path A Phase**: ${data.recommendedApproach || "Not defined"}
- **Initial Conversation Angle**: ${data.conversationAngle || "Not defined"}

## Stakeholder Targets
| Role | Why Target | First Meeting Goal |
|------|------------|-------------------|
${stakeholderRows}

### First Meeting Agenda (30 min)
${agendaItems}
`;
}

function generateBriefJson(projectName: string, data: DiscoveryArtifactInput) {
  return {
    projectName,
    companySnapshot: {
      industry: data.industry || null,
      engineeringSize: data.engineeringSize || null,
      publicApiPresence: data.publicApiPresence || null,
    },
    technicalLandscape: data.technicalLandscape || [],
    maturity: {
      level: data.maturityLevel || null,
      justification: data.maturityJustification || null,
    },
    publicFootprint: {
      postmanNetwork: data.publicFootprint || null,
      developerPortal: data.developerFrictionSignals || null,
      githubPresence: data.cloudGatewaySignals || null,
    },
    hypothesis: data.hypothesis || null,
    recommendedApproach: {
      pathAPhase: data.recommendedApproach || null,
      conversationAngle: data.conversationAngle || null,
    },
    stakeholderTargets: data.stakeholderTargets || [],
    firstMeetingAgenda: data.firstMeetingAgenda || [],
  };
}

export async function saveDiscoveryArtifact(
  projectId: string,
  formData: DiscoveryArtifactInput
) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
  });
  if (!project) {
    return { error: "Project not found" };
  }

  const parsed = discoveryArtifactSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }
  const data = parsed.data;

  const latest = await prisma.discoveryArtifact.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
  });
  const nextVersion = (latest?.version || 0) + 1;

  const briefMarkdown = generateBriefMarkdown(project.name, data);
  const briefJson = generateBriefJson(project.name, data);

  const artifact = await prisma.discoveryArtifact.create({
    data: {
      projectId,
      version: nextVersion,
      keplerPaste: data.keplerPaste || null,
      dnsFindings: data.dnsFindings || null,
      headerFindings: data.headerFindings || null,
      publicFootprint: data.publicFootprint || null,
      authForensics: data.authForensics || null,
      cloudGatewaySignals: data.cloudGatewaySignals || null,
      developerFrictionSignals: data.developerFrictionSignals || null,
      evidenceLinksJson: JSON.stringify(data.evidenceLinks || []),
      industry: data.industry || null,
      engineeringSize: data.engineeringSize || null,
      publicApiPresence: data.publicApiPresence || null,
      technicalLandscapeJson: JSON.stringify(data.technicalLandscape || []),
      maturityLevel: data.maturityLevel || null,
      maturityJustification: data.maturityJustification || null,
      confidenceJson: JSON.stringify(
        Object.fromEntries(
          (data.technicalLandscape || []).map((t) => [t.signal, t.confidence])
        )
      ),
      hypothesis: data.hypothesis || null,
      recommendedApproach: data.recommendedApproach || null,
      conversationAngle: data.conversationAngle || null,
      stakeholderTargetsJson: JSON.stringify(data.stakeholderTargets || []),
      firstMeetingAgendaJson: JSON.stringify(data.firstMeetingAgenda || []),
      generatedBriefMarkdown: briefMarkdown,
      generatedBriefJson: JSON.stringify(briefJson),
      aiGenerated: false,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/discovery`);
  revalidatePath(`/projects/${projectId}/discovery/brief`);

  return { success: true, artifactId: artifact.id, version: artifact.version };
}

// ---------------------------------------------------------------------------
// AI-powered Discovery Pipeline
// ---------------------------------------------------------------------------

/**
 * Ingest a document into the AI pipeline for a project.
 * Called when user pastes Kepler data, uploads manual content, etc.
 */
export async function ingestDiscoveryDocument(
  projectId: string,
  sourceType: string,
  title: string,
  rawText: string
) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
  });
  if (!project) {
    return { error: "Project not found" };
  }

  if (!rawText.trim()) {
    return { error: "Content is required" };
  }

  try {
    const result = await ingestDocument({
      projectId,
      sourceType,
      title,
      rawText: rawText.trim(),
    });

    // --- Cascade: Create EvidenceSnapshot + Impact Analysis ---
    let snapshotId: string | null = null;
    let impactedPhases: string[] = [];
    try {
      const snapshot = await createEvidenceSnapshot(projectId);
      snapshotId = snapshot.snapshotId;

      const impact = await runImpactAnalysis(projectId, snapshot.snapshotId, "INGEST");
      impactedPhases = impact.impactedPhases;
    } catch {
      // Non-fatal: cascade runs separately; don't block ingest
    }

    revalidatePath(`/projects/${projectId}/discovery`);
    revalidatePath(`/projects/${projectId}/updates`);

    return {
      success: true,
      documentId: result.documentId,
      chunkCount: result.chunkCount,
      evidenceLabels: result.evidenceLabels,
      snapshotId,
      impactedPhases,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Ingestion failed";
    return { error: msg };
  }
}

/**
 * Run the full AI discovery pipeline for a project.
 * Creates a versioned DiscoveryArtifact from the AI output.
 */
export async function runAIDiscoveryPipeline(projectId: string) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
  });
  if (!project) {
    return { error: "Project not found" };
  }

  // Check if project has any embedded documents
  const docCount = await prisma.documentChunk.count({
    where: { projectId },
  });

  if (docCount === 0) {
    return {
      error:
        "No evidence documents found. Ingest Kepler data, reconnaissance findings, or other documents first.",
    };
  }

  try {
    const pipeline = await runDiscoveryPipeline(projectId, project.name);

    // Determine next version
    const latest = await prisma.discoveryArtifact.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
    });
    const nextVersion = (latest?.version || 0) + 1;

    // Store as versioned artifact
    const artifact = await prisma.discoveryArtifact.create({
      data: {
        projectId,
        version: nextVersion,

        // Map AI outputs into existing schema fields
        industry: pipeline.recon.companySnapshot.industry,
        engineeringSize: pipeline.recon.companySnapshot.engineeringSize,
        publicApiPresence: pipeline.recon.companySnapshot.publicApiPresence,

        dnsFindings: pipeline.signals.signals
          .map((s) => `${s.signalType}: ${s.finding} (${s.confidence}) [${s.evidenceIds.join(", ")}]`)
          .join("\n"),
        publicFootprint: pipeline.recon.publicFootprint.postmanNetwork,
        cloudGatewaySignals: pipeline.recon.publicFootprint.githubPresence,
        developerFrictionSignals: pipeline.recon.publicFootprint.developerPortal,

        technicalLandscapeJson: JSON.stringify(pipeline.signals.signals),
        maturityLevel: pipeline.maturity.maturity.level,
        maturityJustification: pipeline.maturity.maturity.justification,
        confidenceJson: JSON.stringify(pipeline.maturity.confidenceBySignal),

        hypothesis: pipeline.hypothesis.hypothesis,
        recommendedApproach: pipeline.hypothesis.recommendedApproach,
        conversationAngle: pipeline.hypothesis.conversationAngle,
        stakeholderTargetsJson: JSON.stringify(pipeline.hypothesis.stakeholderTargets),
        firstMeetingAgendaJson: JSON.stringify(pipeline.hypothesis.firstMeetingAgenda),

        generatedBriefMarkdown: pipeline.brief.briefMarkdown,
        generatedBriefJson: JSON.stringify(pipeline.brief.briefJson),

        // AI provenance
        aiGenerated: true,
        aiRunIds: pipeline.aiRunIds,
        evidenceCitations: pipeline.allCitations,
      },
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/discovery`);
    revalidatePath(`/projects/${projectId}/discovery/brief`);

    return {
      success: true,
      artifactId: artifact.id,
      version: artifact.version,
      agentRuns: pipeline.aiRunIds.length,
      citationCount: pipeline.allCitations.length,
      validatedEvidenceIds: pipeline.validatedEvidenceIds.length,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Pipeline failed";
    return { error: msg };
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getLatestDiscoveryArtifact(projectId: string) {
  await requireAuth();
  return prisma.discoveryArtifact.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
  });
}

export async function getDiscoveryArtifact(projectId: string, version?: number) {
  await requireAuth();
  if (version) {
    return prisma.discoveryArtifact.findFirst({
      where: { projectId, version },
    });
  }
  return prisma.discoveryArtifact.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
  });
}

export async function getProjectEvidenceStats(projectId: string) {
  await requireAuth();
  const [docCount, chunkCount] = await Promise.all([
    prisma.sourceDocument.count({ where: { projectId } }),
    prisma.documentChunk.count({ where: { projectId } }),
  ]);
  return { docCount, chunkCount };
}

export async function getProjectAIRuns(projectId: string) {
  await requireAuth();
  return prisma.aIRun.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

/**
 * Get all AI runs across all projects (for admin observability).
 */
export async function getAllAIRuns(limit: number = 50) {
  await requireAuth();
  return prisma.aIRun.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      project: { select: { id: true, name: true } },
    },
  });
}

/**
 * Get aggregate AI run statistics.
 */
export async function getAIRunStats() {
  await requireAuth();
  const [total, success, failed, running] = await Promise.all([
    prisma.aIRun.count(),
    prisma.aIRun.count({ where: { status: "SUCCESS" } }),
    prisma.aIRun.count({ where: { status: "FAILED" } }),
    prisma.aIRun.count({ where: { status: "RUNNING" } }),
  ]);

  // Aggregate token usage from successful runs
  const tokenAgg = await prisma.$queryRaw<
    Array<{ totalPrompt: bigint; totalCompletion: bigint; totalTokens: bigint }>
  >`
    SELECT
      COALESCE(SUM(("tokenUsage"->>'prompt')::int), 0) as "totalPrompt",
      COALESCE(SUM(("tokenUsage"->>'completion')::int), 0) as "totalCompletion",
      COALESCE(SUM(("tokenUsage"->>'total')::int), 0) as "totalTokens"
    FROM "AIRun"
    WHERE "status" = 'SUCCESS' AND "tokenUsage" IS NOT NULL
  `;

  return {
    total,
    success,
    failed,
    running,
    tokens: {
      prompt: Number(tokenAgg[0]?.totalPrompt ?? 0),
      completion: Number(tokenAgg[0]?.totalCompletion ?? 0),
      total: Number(tokenAgg[0]?.totalTokens ?? 0),
    },
  };
}
