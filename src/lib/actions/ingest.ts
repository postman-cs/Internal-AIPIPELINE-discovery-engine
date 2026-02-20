"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { ALL_SOURCES, SourceKey } from "@/lib/ingest-sources";

// ---------------------------------------------------------------------------
// Source config management
// ---------------------------------------------------------------------------

export async function getSourceConfigs() {
  const session = await requireAuth();
  return prisma.ingestSourceConfig.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
  });
}

const MAX_CONFIG_JSON_LENGTH = 10_000; // 10KB limit for config JSON

export async function connectSource(source: SourceKey, configJson?: string) {
  const session = await requireAuth();

  // Validate configJson size and format
  if (configJson) {
    if (configJson.length > MAX_CONFIG_JSON_LENGTH) {
      return { error: "Configuration too large" };
    }
    try {
      JSON.parse(configJson);
    } catch {
      return { error: "Invalid JSON configuration" };
    }
  }

  const config = await prisma.ingestSourceConfig.upsert({
    where: {
      userId_source: { userId: session.userId, source },
    },
    update: {
      enabled: true,
      configJson: configJson || null,
    },
    create: {
      userId: session.userId,
      source,
      enabled: true,
      configJson: configJson || null,
    },
  });

  revalidatePath("/ingest");
  return { success: true, configId: config.id };
}

export async function updateSourceConfig(source: SourceKey, configJson: string) {
  const session = await requireAuth();

  // Validate configJson size and format
  if (configJson.length > MAX_CONFIG_JSON_LENGTH) {
    return { error: "Configuration too large" };
  }
  try {
    JSON.parse(configJson);
  } catch {
    return { error: "Invalid JSON configuration" };
  }

  await prisma.ingestSourceConfig.update({
    where: {
      userId_source: { userId: session.userId, source },
    },
    data: { configJson },
  });

  revalidatePath("/ingest");
  return { success: true };
}

export async function disconnectSource(source: SourceKey) {
  const session = await requireAuth();

  await prisma.ingestSourceConfig.upsert({
    where: {
      userId_source: { userId: session.userId, source },
    },
    update: { enabled: false },
    create: { userId: session.userId, source, enabled: false },
  });

  revalidatePath("/ingest");
  return { success: true };
}

export async function toggleSource(source: SourceKey, enabled: boolean) {
  const session = await requireAuth();

  await prisma.ingestSourceConfig.upsert({
    where: {
      userId_source: { userId: session.userId, source },
    },
    update: { enabled },
    create: { userId: session.userId, source, enabled },
  });

  revalidatePath("/ingest");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Mock data generation
// ---------------------------------------------------------------------------

const MOCK_TITLES: Record<string, string[]> = {
  GMAIL: [
    "Re: API Gateway discussion with platform team",
    "Follow-up: Security review findings",
    "Meeting notes: Architecture sync - API strategy",
    "Fwd: SDK feedback from developer community",
  ],
  SLACK: [
    "#engineering: deployment question about API versioning",
    "#api-design: breaking changes in v3 schema",
    "DM: Quick question on OAuth flow for mobile",
    "#cse-internal: Account update - new stakeholder identified",
  ],
  NOTION: [
    "API Strategy Doc - Q1 2026",
    "Q1 Engineering Roadmap & Priorities",
    "Account Plan: Technical Engagement Track",
  ],
  GCAL: [
    "Weekly Sync - Engineering Leadership",
    "API Review Meeting - Schema Changes",
    "Discovery Call: Platform Team",
  ],
  GITHUB: [
    "PR #142: Add rate limiting to public API",
    "Issue #89: OAuth2 PKCE flow broken on mobile",
    "PR #155: Update SDK docs for v3",
    "Discussion: API versioning strategy",
  ],
  CALL_TRANSCRIPTS: [
    "Discovery Call - Platform Architecture Review",
    "Technical Deep Dive - Auth & Security Patterns",
    "Executive Briefing - API Program Maturity",
  ],
  MANUAL_UPLOAD: [
    "Architecture diagram - current state",
    "Competitive landscape notes",
    "Customer feedback summary - developer portal",
  ],
};

function generateMockItemsForSources(
  ingestRunId: string,
  sources: SourceKey[]
) {
  const items: Array<{
    ingestRunId: string;
    source: string;
    externalId: string;
    title: string;
    timestamp: Date;
    url: string | null;
    rawText: string | null;
    metadataJson: string | null;
  }> = [];

  for (const source of sources) {
    const titles = MOCK_TITLES[source] || [];
    const count = Math.min(
      Math.floor(Math.random() * 3) + 1,
      titles.length
    );
    for (let i = 0; i < count; i++) {
      items.push({
        ingestRunId,
        source,
        externalId: `${source.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: titles[i % titles.length],
        timestamp: new Date(
          Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
        ),
        url:
          source === "GITHUB"
            ? `https://github.com/example/repo/pull/${100 + i}`
            : source === "NOTION"
            ? `https://notion.so/page-${Date.now()}`
            : null,
        rawText: `Mock content from ${source}: ${titles[i % titles.length]}\n\nThis is simulated content that would normally come from the ${source} connector. In production, this would contain the full email body, Slack message, Notion page content, calendar event details, etc.`,
        metadataJson: JSON.stringify({
          source,
          mockGenerated: true,
          generatedAt: new Date().toISOString(),
        }),
      });
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Gmail real ingest helper
// ---------------------------------------------------------------------------

async function runGmailIngestForUser(
  userId: string,
  runId: string,
): Promise<{ itemCount: number; errors: string[] }> {
  const { ingestGmailForProject } = await import("@/lib/gmail/ingest");

  const projects = await prisma.project.findMany({
    where: { ownerUserId: userId, gmailLabelId: { not: null } },
    select: { id: true, name: true },
  });

  let totalItems = 0;
  const errors: string[] = [];

  for (const project of projects) {
    try {
      const result = await ingestGmailForProject(project.id, userId);
      totalItems += result.documentsIngested + result.attachmentsProcessed;
      if (result.errors.length > 0) {
        errors.push(...result.errors.map((e) => `[${project.name}] ${e}`));
      }

      for (let i = 0; i < result.documentsIngested; i++) {
        await prisma.ingestItem.create({
          data: {
            ingestRunId: runId,
            source: "GMAIL",
            externalId: `gmail-real-${project.id}-${Date.now()}-${i}`,
            title: `Gmail thread from ${project.name}`,
            rawText: null,
            metadataJson: JSON.stringify({ realGmail: true, projectId: project.id }),
          },
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[${project.name}] ${msg}`);
    }
  }

  return { itemCount: totalItems, errors };
}

// ---------------------------------------------------------------------------
// Ingest run execution
// ---------------------------------------------------------------------------

export async function runIngestAction(sourcesFilter?: SourceKey[]) {
  const session = await requireAuth();

  // If no filter, use all enabled sources
  let sources = sourcesFilter;
  if (!sources || sources.length === 0) {
    const configs = await prisma.ingestSourceConfig.findMany({
      where: { userId: session.userId, enabled: true },
    });
    sources = configs.map((c) => c.source as SourceKey);
    if (sources.length === 0) {
      sources = [...ALL_SOURCES];
    }
  }

  const run = await prisma.ingestRun.create({
    data: {
      userId: session.userId,
      status: "RUNNING",
      trigger: "MANUAL",
      sourcesFilter: JSON.stringify(sources),
    },
  });

  const counts: Record<string, number> = {};
  let totalItemCount = 0;

  // Separate real Gmail from mock sources
  const gmailRequested = sources.includes("GMAIL");
  const mockSources = sources.filter((s) => s !== "GMAIL");

  // Real Gmail ingest
  if (gmailRequested) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { googleRefreshToken: true },
    });

    if (user?.googleRefreshToken) {
      const gmailResult = await runGmailIngestForUser(session.userId, run.id);
      counts["GMAIL"] = gmailResult.itemCount;
      totalItemCount += gmailResult.itemCount;
    } else {
      const mockItems = generateMockItemsForSources(run.id, ["GMAIL"]);
      await prisma.ingestItem.createMany({ data: mockItems });
      counts["GMAIL"] = mockItems.length;
      totalItemCount += mockItems.length;
    }
  }

  // Mock data for other sources
  if (mockSources.length > 0) {
    const mockItems = generateMockItemsForSources(run.id, mockSources);
    await prisma.ingestItem.createMany({ data: mockItems });
    for (const item of mockItems) {
      counts[item.source] = (counts[item.source] || 0) + 1;
    }
    totalItemCount += mockItems.length;
  }

  await prisma.ingestRun.update({
    where: { id: run.id },
    data: {
      status: "SUCCESS",
      finishedAt: new Date(),
      summary: `Ingested ${totalItemCount} items from ${sources.length} source${sources.length > 1 ? "s" : ""}: ${sources.join(", ")}`,
      countsJson: JSON.stringify(counts),
    },
  });

  for (const source of sources) {
    await prisma.ingestSourceConfig
      .update({
        where: {
          userId_source: { userId: session.userId, source },
        },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: "SUCCESS",
          lastSyncItemCount: counts[source] || 0,
        },
      })
      .catch((err: unknown) => {
        console.warn(`[ingest] Failed to update sync status for ${source}:`, err);
      });
  }

  revalidatePath("/ingest");
  revalidatePath("/dashboard");
  return { success: true, runId: run.id, itemCount: totalItemCount };
}

export async function runSingleSourceIngest(source: SourceKey) {
  return runIngestAction([source]);
}

export async function runGmailIngestForProjectAction(projectId: string) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true, gmailLabelId: true, name: true },
  });

  if (!project) return { error: "Project not found" };
  if (!project.gmailLabelId)
    return { error: "No Gmail label configured for this project" };

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { googleRefreshToken: true },
  });
  if (!user?.googleRefreshToken) return { error: "Gmail not connected" };

  const { ingestGmailForProject } = await import("@/lib/gmail/ingest");
  const result = await ingestGmailForProject(projectId, session.userId);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/ingest");
  revalidatePath("/dashboard");

  return {
    success: true,
    threadsFound: result.threadsFound,
    documentsIngested: result.documentsIngested,
    attachmentsProcessed: result.attachmentsProcessed,
    errors: result.errors,
  };
}

// ---------------------------------------------------------------------------
// Manual upload
// ---------------------------------------------------------------------------

const MAX_UPLOAD_TITLE_LENGTH = 500;
const MAX_UPLOAD_CONTENT_LENGTH = 200_000; // 200KB
const MAX_UPLOAD_URL_LENGTH = 2048;

export async function manualUploadAction(data: {
  title: string;
  content: string;
  url?: string;
}) {
  const session = await requireAuth();

  if (!data.title?.trim() || !data.content?.trim()) {
    return { error: "Title and content are required" };
  }
  if (data.title.length > MAX_UPLOAD_TITLE_LENGTH) {
    return { error: `Title must be under ${MAX_UPLOAD_TITLE_LENGTH} characters` };
  }
  if (data.content.length > MAX_UPLOAD_CONTENT_LENGTH) {
    return { error: `Content must be under ${MAX_UPLOAD_CONTENT_LENGTH} characters` };
  }
  if (data.url && data.url.length > MAX_UPLOAD_URL_LENGTH) {
    return { error: `URL must be under ${MAX_UPLOAD_URL_LENGTH} characters` };
  }

  // Create a run for this upload
  const run = await prisma.ingestRun.create({
    data: {
      userId: session.userId,
      status: "SUCCESS",
      trigger: "MANUAL",
      sourcesFilter: JSON.stringify(["MANUAL_UPLOAD"]),
      finishedAt: new Date(),
      summary: `Manual upload: ${data.title}`,
      countsJson: JSON.stringify({ MANUAL_UPLOAD: 1 }),
    },
  });

  await prisma.ingestItem.create({
    data: {
      ingestRunId: run.id,
      source: "MANUAL_UPLOAD",
      externalId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: data.title.trim(),
      rawText: data.content.trim(),
      url: data.url?.trim() || null,
      metadataJson: JSON.stringify({
        source: "MANUAL_UPLOAD",
        manualUpload: true,
        uploadedAt: new Date().toISOString(),
      }),
    },
  });

  // Update manual upload config sync time
  await prisma.ingestSourceConfig
    .update({
      where: {
        userId_source: { userId: session.userId, source: "MANUAL_UPLOAD" },
      },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: "SUCCESS",
        lastSyncItemCount: 1,
      },
    })
    .catch((err: unknown) => {
      console.warn("[ingest] Failed to update manual upload sync status:", err);
    });

  revalidatePath("/ingest");
  revalidatePath("/dashboard");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Consume items
// ---------------------------------------------------------------------------

export async function consumeItemsAction(source?: string) {
  const session = await requireAuth();

  // Scope to items belonging to the authenticated user's ingest runs
  const where: Record<string, unknown> = {
    consumedAt: null,
    ingestRun: { userId: session.userId },
  };
  if (source) where.source = source;

  const result = await prisma.ingestItem.updateMany({
    where,
    data: { consumedAt: new Date() },
  });

  revalidatePath("/ingest");
  return { success: true, count: result.count };
}

export async function consumeSingleItem(itemId: string) {
  const session = await requireAuth();

  // Verify the item belongs to the authenticated user
  const item = await prisma.ingestItem.findFirst({
    where: { id: itemId, ingestRun: { userId: session.userId } },
    select: { id: true },
  });
  if (!item) return { error: "Item not found" };

  await prisma.ingestItem.update({
    where: { id: itemId },
    data: { consumedAt: new Date() },
  });

  revalidatePath("/ingest");
  return { success: true };
}

export async function unconsumeSingleItem(itemId: string) {
  const session = await requireAuth();

  // Verify the item belongs to the authenticated user
  const item = await prisma.ingestItem.findFirst({
    where: { id: itemId, ingestRun: { userId: session.userId } },
    select: { id: true },
  });
  if (!item) return { error: "Item not found" };

  await prisma.ingestItem.update({
    where: { id: itemId },
    data: { consumedAt: null },
  });

  revalidatePath("/ingest");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getIngestRuns(limit = 10) {
  const session = await requireAuth();
  const safeLimit = Math.min(Math.max(limit, 1), 100); // Cap at 100
  return prisma.ingestRun.findMany({
    where: { userId: session.userId },
    orderBy: { startedAt: "desc" },
    take: safeLimit,
    include: { _count: { select: { items: true } } },
  });
}

export async function getUnconsumedCounts() {
  const session = await requireAuth();
  const items = await prisma.ingestItem.groupBy({
    by: ["source"],
    where: { consumedAt: null, ingestRun: { userId: session.userId } },
    _count: { id: true },
  });
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.source] = item._count.id;
  }
  return counts;
}

export async function getIngestItems(opts: {
  source?: string;
  consumed?: boolean;
  limit?: number;
  offset?: number;
}) {
  const session = await requireAuth();

  const where: Record<string, unknown> = {
    ingestRun: { userId: session.userId },
  };
  if (opts.source) where.source = opts.source;
  if (opts.consumed === true) where.consumedAt = { not: null };
  if (opts.consumed === false) where.consumedAt = null;

  const safeLimit = Math.min(Math.max(opts.limit || 25, 1), 200); // Cap at 200

  const [items, total] = await Promise.all([
    prisma.ingestItem.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: safeLimit,
      skip: opts.offset || 0,
      include: {
        ingestRun: { select: { trigger: true } },
      },
    }),
    prisma.ingestItem.count({ where }),
  ]);

  return { items, total };
}

export async function getSourceStats() {
  const session = await requireAuth();

  const userFilter = { ingestRun: { userId: session.userId } };

  const [totalBySource, unconsumedBySource] = await Promise.all([
    prisma.ingestItem.groupBy({
      by: ["source"],
      where: userFilter,
      _count: { id: true },
    }),
    prisma.ingestItem.groupBy({
      by: ["source"],
      where: { ...userFilter, consumedAt: null },
      _count: { id: true },
    }),
  ]);

  const stats: Record<
    string,
    { total: number; unconsumed: number }
  > = {};
  for (const item of totalBySource) {
    stats[item.source] = { total: item._count.id, unconsumed: 0 };
  }
  for (const item of unconsumedBySource) {
    if (stats[item.source]) {
      stats[item.source].unconsumed = item._count.id;
    } else {
      stats[item.source] = { total: item._count.id, unconsumed: item._count.id };
    }
  }
  return stats;
}
