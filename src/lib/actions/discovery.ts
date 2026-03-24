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

  // XP: award 10 points per newly filled discovery field
  const DISCOVERY_FIELDS = [
    "industry", "engineeringSize", "publicApiPresence",
    "dnsFindings", "publicFootprint", "cloudGatewaySignals",
    "developerFrictionSignals", "authForensics",
    "maturityLevel", "maturityJustification",
    "hypothesis", "recommendedApproach", "conversationAngle",
  ];
  const isFilled = (v: unknown) => v !== null && v !== undefined && v !== "" && v !== "[]";
  const prevFieldCount = latest
    ? DISCOVERY_FIELDS.filter((k) => isFilled((latest as Record<string, unknown>)[k])).length
    : 0;
  const newFieldCount = DISCOVERY_FIELDS.filter((k) => isFilled((data as Record<string, unknown>)[k])).length;
  const prevTechCount = latest ? (JSON.parse((latest as Record<string, unknown>).technicalLandscapeJson as string || "[]") as unknown[]).length : 0;
  const prevStakeholderCount = latest ? (JSON.parse((latest as Record<string, unknown>).stakeholderTargetsJson as string || "[]") as unknown[]).length : 0;
  const entriesToAward =
    Math.max(0, newFieldCount - prevFieldCount)
    + Math.max(0, (data.technicalLandscape?.length ?? 0) - prevTechCount)
    + Math.max(0, (data.stakeholderTargets?.length ?? 0) - prevStakeholderCount);

  if (entriesToAward > 0) {
    import("@/lib/gamification/xp-engine").then(({ awardXp, XP_ACTIONS }) => {
      const pts = entriesToAward * XP_ACTIONS.DISCOVERY_ENTRY.points;
      awardXp(session.userId, XP_ACTIONS.DISCOVERY_ENTRY.action, pts, projectId, { fields: entriesToAward }).catch(() => {});
    }).catch(() => {});
  }

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

    // Surface dedup skips so the UI can show a meaningful message
    if (result.skipped) {
      revalidatePath(`/projects/${projectId}/discovery`);
      return {
        success: true,
        documentId: result.documentId,
        chunkCount: 0,
        evidenceLabels: [],
        skipped: true,
        skipReason: result.skipReason,
      };
    }

    // --- Cascade: Create EvidenceSnapshot + Impact Analysis ---
    let snapshotId: string | null = null;
    let impactedPhases: string[] = [];
    try {
      const snapshot = await createEvidenceSnapshot(projectId);
      snapshotId = snapshot.snapshotId;

      const impact = await runImpactAnalysis(projectId, snapshot.snapshotId, "INGEST");
      impactedPhases = impact.impactedPhases;
    } catch (cascadeErr) {
      // Non-fatal: cascade runs separately; don't block ingest — but log it
      console.warn("[discovery] Cascade snapshot/impact failed (non-fatal):", cascadeErr);
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
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[discovery] Ingestion error:", msg, error);
    return { error: `Ingestion failed: ${msg}` };
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
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[discovery] AI pipeline error:", msg, error);
    return { error: `AI discovery pipeline failed: ${msg}` };
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getLatestDiscoveryArtifact(projectId: string) {
  const session = await requireAuth();
  // Verify project ownership before returning data
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true },
  });
  if (!project) return null;

  return prisma.discoveryArtifact.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
  });
}

export async function getDiscoveryArtifact(projectId: string, version?: number) {
  const session = await requireAuth();
  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true },
  });
  if (!project) return null;

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
  const session = await requireAuth();
  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true },
  });
  if (!project) return { docCount: 0, chunkCount: 0 };

  const [docCount, chunkCount] = await Promise.all([
    prisma.sourceDocument.count({ where: { projectId } }),
    prisma.documentChunk.count({ where: { projectId } }),
  ]);
  return { docCount, chunkCount };
}

export async function getProjectAIRuns(projectId: string) {
  const session = await requireAuth();
  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true },
  });
  if (!project) return [];

  return prisma.aIRun.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

/**
 * Get all AI runs across projects the user owns (for observability).
 */
export async function getAllAIRuns(limit: number = 50) {
  const session = await requireAuth();
  const safeLimit = Math.min(Math.max(limit, 1), 200); // Cap at 200

  // Only return runs from projects the user owns
  const userProjects = await prisma.project.findMany({
    where: { ownerUserId: session.userId },
    select: { id: true },
  });
  const projectIds = userProjects.map((p) => p.id);

  return prisma.aIRun.findMany({
    where: { projectId: { in: projectIds } },
    orderBy: { createdAt: "desc" },
    take: safeLimit,
    include: {
      project: { select: { id: true, name: true } },
    },
  });
}

/**
 * Cursor-based paginated AI runs for the AI Runs page.
 */
export async function getPaginatedAIRuns(pageSize: number = 25, cursor?: string) {
  const session = await requireAuth();
  const safePage = Math.min(Math.max(pageSize, 10), 100);

  const userProjects = await prisma.project.findMany({
    where: { ownerUserId: session.userId },
    select: { id: true },
  });
  const projectIds = userProjects.map((p) => p.id);

  const runs = await prisma.aIRun.findMany({
    where: { projectId: { in: projectIds } },
    orderBy: { createdAt: "desc" },
    take: safePage + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      project: { select: { id: true, name: true } },
    },
  });

  const hasMore = runs.length > safePage;
  const items = hasMore ? runs.slice(0, safePage) : runs;
  const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

  return { items, nextCursor, hasMore };
}

/**
 * Get aggregate AI run statistics for the authenticated user's projects.
 */
export async function getAIRunStats() {
  const session = await requireAuth();

  // Only aggregate from the user's own projects
  const userProjects = await prisma.project.findMany({
    where: { ownerUserId: session.userId },
    select: { id: true },
  });
  const projectIds = userProjects.map((p) => p.id);
  const projectFilter = { projectId: { in: projectIds } };

  const [total, success, failed, running] = await Promise.all([
    prisma.aIRun.count({ where: projectFilter }),
    prisma.aIRun.count({ where: { ...projectFilter, status: "SUCCESS" } }),
    prisma.aIRun.count({ where: { ...projectFilter, status: "FAILED" } }),
    prisma.aIRun.count({ where: { ...projectFilter, status: "RUNNING" } }),
  ]);

  // Aggregate token usage from successful runs (only user's projects)
  const tokenAgg = await prisma.$queryRaw<
    Array<{ totalPrompt: bigint; totalCompletion: bigint; totalTokens: bigint }>
  >`
    SELECT
      COALESCE(SUM(("tokenUsage"->>'prompt')::int), 0) as "totalPrompt",
      COALESCE(SUM(("tokenUsage"->>'completion')::int), 0) as "totalCompletion",
      COALESCE(SUM(("tokenUsage"->>'total')::int), 0) as "totalTokens"
    FROM "AIRun"
    WHERE "status" = 'SUCCESS'
      AND "tokenUsage" IS NOT NULL
      AND "projectId" = ANY(${projectIds})
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
