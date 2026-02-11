"use client";

import { useState } from "react";
import type { SourceMeta } from "@/lib/ingest-sources";
import { SourceCard } from "./SourceCard";
import { ItemsBrowser } from "./ItemsBrowser";
import { ManualUpload } from "./ManualUpload";

type SourceConfig = {
  id: string;
  source: string;
  enabled: boolean;
  configJson: string | null;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastSyncItemCount: number | null;
};

type IngestRunRow = {
  id: string;
  status: string;
  trigger: string;
  summary: string | null;
  sourcesFilter: string | null;
  startedAt: Date;
  _count: { items: number };
};

const TABS = [
  { id: "sources", label: "Sources", description: "Connect & manage your data sources" },
  { id: "items", label: "Items", description: "Browse ingested signals" },
  { id: "upload", label: "Upload", description: "Manual content upload" },
  { id: "runs", label: "Run History", description: "Past ingest runs" },
] as const;

export function IngestTabs({
  allSources,
  sourceConfigs,
  sourceStats,
  unconsumedCounts,
  runs,
}: {
  allSources: SourceMeta[];
  sourceConfigs: SourceConfig[];
  sourceStats: Record<string, { total: number; unconsumed: number }>;
  unconsumedCounts: Record<string, number>;
  runs: IngestRunRow[];
}) {
  const [activeTab, setActiveTab] = useState<string>("sources");

  const configMap: Record<string, SourceConfig> = {};
  for (const c of sourceConfigs) {
    configMap[c.source] = c;
  }

  const connectedSources = sourceConfigs.filter((c) => c.enabled);
  const totalUnconsumed = Object.values(unconsumedCounts).reduce((a, b) => a + b, 0);

  return (
    <div>
      {/* Stats bar */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5">
          <span className="text-2xl font-bold text-[#ff6c37]">
            {connectedSources.length}
          </span>
          <span className="text-xs text-gray-500 leading-tight">
            Sources
            <br />
            Connected
          </span>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5">
          <span className="text-2xl font-bold text-blue-600">
            {totalUnconsumed}
          </span>
          <span className="text-xs text-gray-500 leading-tight">
            Unconsumed
            <br />
            Items
          </span>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5">
          <span className="text-2xl font-bold text-gray-400">
            {Object.values(sourceStats).reduce((a, b) => a + b.total, 0)}
          </span>
          <span className="text-xs text-gray-500 leading-tight">
            Total
            <br />
            Items
          </span>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-2.5">
          <span className="text-2xl font-bold text-green-600">
            {runs.filter((r) => r.status === "SUCCESS").length}
          </span>
          <span className="text-xs text-gray-500 leading-tight">
            Successful
            <br />
            Runs
          </span>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-[#ff6c37] text-[#ff6c37]"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
            {tab.id === "items" && totalUnconsumed > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#ff6c37] text-white text-[10px] font-bold">
                {totalUnconsumed > 99 ? "99+" : totalUnconsumed}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Sources */}
      {activeTab === "sources" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">
              Connect your data sources to start ingesting customer signals. Each
              source generates mock data for development.
            </p>
          </div>

          {/* Onboarding progress */}
          {connectedSources.length < allSources.length && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                  Source Onboarding Progress
                </span>
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  {connectedSources.length} / {allSources.length}
                </span>
              </div>
              <div className="w-full bg-blue-100 dark:bg-blue-900/40 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${(connectedSources.length / allSources.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {allSources.map((meta) => (
            <SourceCard
              key={meta.key}
              meta={meta}
              config={configMap[meta.key] || null}
              stats={sourceStats[meta.key] || null}
            />
          ))}
        </div>
      )}

      {/* Tab: Items */}
      {activeTab === "items" && (
        <ItemsBrowser initialCounts={unconsumedCounts} />
      )}

      {/* Tab: Upload */}
      {activeTab === "upload" && (
        <div className="max-w-2xl">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
            <ManualUpload />
          </div>
        </div>
      )}

      {/* Tab: Run History */}
      {activeTab === "runs" && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Ingest Run History
          </h2>
          {runs.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">
              No ingest runs yet. Connect a source and sync to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="text-left py-2 px-2 font-medium text-gray-500">
                      Status
                    </th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">
                      Trigger
                    </th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">
                      Sources
                    </th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">
                      Items
                    </th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">
                      Summary
                    </th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">
                      Started
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => {
                    let sourcesLabel = "All";
                    if (run.sourcesFilter) {
                      try {
                        const arr = JSON.parse(run.sourcesFilter) as string[];
                        sourcesLabel =
                          arr.length <= 2
                            ? arr.join(", ")
                            : `${arr.length} sources`;
                      } catch {
                        sourcesLabel = "—";
                      }
                    }
                    return (
                      <tr
                        key={run.id}
                        className="border-b border-gray-100 dark:border-gray-800/50"
                      >
                        <td className="py-2 px-2">
                          <span
                            className={
                              run.status === "SUCCESS"
                                ? "badge-success"
                                : run.status === "FAILED"
                                ? "badge-error"
                                : run.status === "RUNNING"
                                ? "badge-warning"
                                : "badge-info"
                            }
                          >
                            {run.status}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-gray-700 dark:text-gray-300">
                          {run.trigger}
                        </td>
                        <td className="py-2 px-2 text-gray-500 text-xs">
                          {sourcesLabel}
                        </td>
                        <td className="py-2 px-2 text-gray-700 dark:text-gray-300">
                          {run._count.items}
                        </td>
                        <td className="py-2 px-2 text-gray-500 text-xs max-w-[200px] truncate">
                          {run.summary || "—"}
                        </td>
                        <td className="py-2 px-2 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(run.startedAt).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
