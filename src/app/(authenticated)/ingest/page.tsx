import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { ALL_SOURCES, SOURCE_REGISTRY } from "@/lib/ingest-sources";
import { IngestActions } from "./IngestActions";
import { IngestTabs } from "./IngestTabs";
import { GmailConnectBanner } from "./GmailConnectBanner";

export default async function IngestPage() {
  const session = await getSession();
  const userId = session.userId!;

  const [sourceConfigs, runs, totalBySource, unconsumedBySource, user] =
    await Promise.all([
      prisma.ingestSourceConfig.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.ingestRun.findMany({
        where: { userId },
        orderBy: { startedAt: "desc" },
        take: 20,
        include: { _count: { select: { items: true } } },
      }),
      prisma.ingestItem.groupBy({
        by: ["source"],
        _count: { id: true },
      }),
      prisma.ingestItem.groupBy({
        by: ["source"],
        where: { consumedAt: null },
        _count: { id: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { googleRefreshToken: true, googleEmail: true },
      }),
    ]);

  const sourceStats: Record<string, { total: number; unconsumed: number }> = {};
  for (const item of totalBySource) {
    sourceStats[item.source] = { total: item._count.id, unconsumed: 0 };
  }
  for (const item of unconsumedBySource) {
    if (sourceStats[item.source]) {
      sourceStats[item.source].unconsumed = item._count.id;
    } else {
      sourceStats[item.source] = { total: item._count.id, unconsumed: item._count.id };
    }
  }

  const unconsumedCounts: Record<string, number> = {};
  for (const item of unconsumedBySource) {
    unconsumedCounts[item.source] = item._count.id;
  }

  const connectedCount = sourceConfigs.filter((c) => c.enabled).length;
  const allSourceMeta = ALL_SOURCES.map((s) => SOURCE_REGISTRY[s]);

  const gmailConnected = !!user?.googleRefreshToken;
  const oauthConfigured = !!(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Data Ingest
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
            Connect sources, ingest customer signals, and manage your intelligence pipeline
          </p>
        </div>
        <IngestActions connectedCount={connectedCount} />
      </div>

      <GmailConnectBanner
        isConnected={gmailConnected}
        googleEmail={user?.googleEmail ?? null}
        oauthConfigured={oauthConfigured}
      />

      <IngestTabs
        allSources={allSourceMeta}
        sourceConfigs={sourceConfigs}
        sourceStats={sourceStats}
        unconsumedCounts={unconsumedCounts}
        runs={runs}
      />
    </div>
  );
}
