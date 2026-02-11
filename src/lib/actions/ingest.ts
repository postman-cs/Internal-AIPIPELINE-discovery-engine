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

export async function connectSource(source: SourceKey, configJson?: string) {
  const session = await requireAuth();

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

  await prisma.ingestSourceConfig.update({
    where: {
      userId_source: { userId: session.userId, source },
    },
    data: { enabled: false },
  });

  revalidatePath("/ingest");
  return { success: true };
}

export async function toggleSource(source: SourceKey, enabled: boolean) {
  const session = await requireAuth();

  await prisma.ingestSourceConfig.update({
    where: {
      userId_source: { userId: session.userId, source },
    },
    data: { enabled },
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
    // If nothing connected, ingest all as demo
    if (sources.length === 0) {
      sources = [...ALL_SOURCES];
    }
  }

  // Create the run
  const run = await prisma.ingestRun.create({
    data: {
      userId: session.userId,
      status: "RUNNING",
      trigger: "MANUAL",
      sourcesFilter: JSON.stringify(sources),
    },
  });

  // Generate mock items
  const mockItems = generateMockItemsForSources(run.id, sources);
  await prisma.ingestItem.createMany({ data: mockItems });

  // Compute counts
  const counts: Record<string, number> = {};
  for (const item of mockItems) {
    counts[item.source] = (counts[item.source] || 0) + 1;
  }

  // Finish the run
  await prisma.ingestRun.update({
    where: { id: run.id },
    data: {
      status: "SUCCESS",
      finishedAt: new Date(),
      summary: `Ingested ${mockItems.length} items from ${sources.length} source${sources.length > 1 ? "s" : ""}: ${sources.join(", ")}`,
      countsJson: JSON.stringify(counts),
    },
  });

  // Update lastSync on source configs
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
      .catch(() => {
        /* config might not exist yet for this source */
      });
  }

  revalidatePath("/ingest");
  revalidatePath("/dashboard");
  return { success: true, runId: run.id, itemCount: mockItems.length };
}

export async function runSingleSourceIngest(source: SourceKey) {
  return runIngestAction([source]);
}

// ---------------------------------------------------------------------------
// Manual upload
// ---------------------------------------------------------------------------

export async function manualUploadAction(data: {
  title: string;
  content: string;
  url?: string;
}) {
  const session = await requireAuth();

  if (!data.title.trim() || !data.content.trim()) {
    return { error: "Title and content are required" };
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
    .catch(() => {});

  revalidatePath("/ingest");
  revalidatePath("/dashboard");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Consume items
// ---------------------------------------------------------------------------

export async function consumeItemsAction(source?: string) {
  await requireAuth();

  const where = source ? { source, consumedAt: null } : { consumedAt: null };

  const result = await prisma.ingestItem.updateMany({
    where,
    data: { consumedAt: new Date() },
  });

  revalidatePath("/ingest");
  return { success: true, count: result.count };
}

export async function consumeSingleItem(itemId: string) {
  await requireAuth();

  await prisma.ingestItem.update({
    where: { id: itemId },
    data: { consumedAt: new Date() },
  });

  revalidatePath("/ingest");
  return { success: true };
}

export async function unconsumeSingleItem(itemId: string) {
  await requireAuth();

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
  await requireAuth();
  return prisma.ingestRun.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
    include: { _count: { select: { items: true } } },
  });
}

export async function getUnconsumedCounts() {
  await requireAuth();
  const items = await prisma.ingestItem.groupBy({
    by: ["source"],
    where: { consumedAt: null },
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
  await requireAuth();

  const where: Record<string, unknown> = {};
  if (opts.source) where.source = opts.source;
  if (opts.consumed === true) where.consumedAt = { not: null };
  if (opts.consumed === false) where.consumedAt = null;

  const [items, total] = await Promise.all([
    prisma.ingestItem.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: opts.limit || 25,
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
  await requireAuth();

  const [totalBySource, unconsumedBySource] = await Promise.all([
    prisma.ingestItem.groupBy({
      by: ["source"],
      _count: { id: true },
    }),
    prisma.ingestItem.groupBy({
      by: ["source"],
      where: { consumedAt: null },
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
