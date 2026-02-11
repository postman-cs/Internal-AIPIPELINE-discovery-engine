import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MOCK_TITLES: Record<string, string[]> = {
  GMAIL: ["Re: API Gateway discussion", "Follow-up: Security review"],
  SLACK: ["#engineering: deployment question", "#api-design: schema changes"],
  NOTION: ["API Strategy Doc"],
  GCAL: ["Weekly Sync - Engineering"],
  GITHUB: ["PR #142: Add rate limiting", "Issue #89: OAuth2 flow broken"],
  CALL_TRANSCRIPTS: ["Discovery Call - automated"],
  MANUAL_UPLOAD: ["Architecture diagram.pdf"],
};

export async function POST(request: NextRequest) {
  // Require CRON_SECRET — no fallback default
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET environment variable is not set — cron endpoint disabled");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find any user to attribute the cron run to
  const user = await prisma.user.findFirst();
  if (!user) {
    return NextResponse.json(
      { error: "No users found. Seed the database first." },
      { status: 500 }
    );
  }

  // Only sync enabled sources for this user
  const enabledConfigs = await prisma.ingestSourceConfig.findMany({
    where: { userId: user.id, enabled: true },
  });

  // Fall back to all sources if none connected yet
  const sourcesToSync =
    enabledConfigs.length > 0
      ? enabledConfigs.map((c) => c.source)
      : Object.keys(MOCK_TITLES);

  const run = await prisma.ingestRun.create({
    data: {
      userId: user.id,
      status: "RUNNING",
      trigger: "CRON",
      sourcesFilter: JSON.stringify(sourcesToSync),
    },
  });

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

  for (const source of sourcesToSync) {
    const titles = MOCK_TITLES[source] || ["Item from " + source];
    const count = Math.floor(Math.random() * titles.length) + 1;
    for (let i = 0; i < count; i++) {
      items.push({
        ingestRunId: run.id,
        source,
        externalId: `cron-${source.toLowerCase()}-${Date.now()}-${i}`,
        title: titles[i % titles.length],
        timestamp: new Date(),
        url: null,
        rawText: `Cron-ingested content from ${source}`,
        metadataJson: JSON.stringify({ source, cronGenerated: true }),
      });
    }
  }

  await prisma.ingestItem.createMany({ data: items });

  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.source] = (counts[item.source] || 0) + 1;
  }

  await prisma.ingestRun.update({
    where: { id: run.id },
    data: {
      status: "SUCCESS",
      finishedAt: new Date(),
      summary: `Cron: Ingested ${items.length} items from ${sourcesToSync.length} source(s)`,
      countsJson: JSON.stringify(counts),
    },
  });

  // Update lastSync on source configs
  for (const source of sourcesToSync) {
    await prisma.ingestSourceConfig
      .update({
        where: {
          userId_source: { userId: user.id, source },
        },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: "SUCCESS",
          lastSyncItemCount: counts[source] || 0,
        },
      })
      .catch((err: unknown) => {
        console.warn(`[cron] Failed to update sync status for ${source}:`, err);
      });
  }

  return NextResponse.json({
    success: true,
    runId: run.id,
    itemCount: items.length,
    sources: sourcesToSync,
    counts,
  });
}
