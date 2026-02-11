import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { ALL_SOURCES, SOURCE_REGISTRY } from "@/lib/ingest-sources";
import { IngestActions } from "./IngestActions";
import { IngestTabs } from "./IngestTabs";

export default async function IngestPage() {
  const session = await getSession();
  const userId = session.userId!;

  const [sourceConfigs, runs, totalBySource, unconsumedBySource] =
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
    ]);

  // Build stats
  const sourceStats: Record<string, { total: number; unconsumed: number }> = {};
  for (const item of totalBySource) {
    sourceStats[item.source] = { total: item._count.id, unconsumed: 0 };
  }
  for (const item of unconsumedBySource) {
    if (sourceStats[item.source]) {
      sourceStats[item.source].unconsumed = item._count.id;
    } else {
      sourceStats[item.source] = {
        total: item._count.id,
        unconsumed: item._count.id,
      };
    }
  }

  // Unconsumed counts
  const unconsumedCounts: Record<string, number> = {};
  for (const item of unconsumedBySource) {
    unconsumedCounts[item.source] = item._count.id;
  }

  const connectedCount = sourceConfigs.filter((c) => c.enabled).length;
  const allSourceMeta = ALL_SOURCES.map((s) => SOURCE_REGISTRY[s]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Data Ingest
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Connect sources, ingest customer signals, and manage your
            intelligence pipeline
          </p>
        </div>
        <IngestActions connectedCount={connectedCount} />
      </div>

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
