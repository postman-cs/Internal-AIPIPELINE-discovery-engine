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
  { id: "sources", label: "Sources" },
  { id: "items", label: "Items" },
  { id: "upload", label: "Upload" },
  { id: "runs", label: "Run History" },
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
  for (const c of sourceConfigs) configMap[c.source] = c;

  const connectedSources = sourceConfigs.filter((c) => c.enabled);
  const totalUnconsumed = Object.values(unconsumedCounts).reduce((a, b) => a + b, 0);

  return (
    <div>
      {/* Stats bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <StatPill value={connectedSources.length} label="Sources Connected" color="var(--accent-orange)" />
        <StatPill value={totalUnconsumed} label="Unconsumed Items" color="var(--accent-blue)" />
        <StatPill
          value={Object.values(sourceStats).reduce((a, b) => a + b.total, 0)}
          label="Total Items"
          color="var(--foreground-muted)"
        />
        <StatPill
          value={runs.filter((r) => r.status === "SUCCESS").length}
          label="Successful Runs"
          color="var(--accent-green)"
        />
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-6 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200"
            style={{
              borderBottom: `2px solid ${activeTab === tab.id ? "var(--accent-cyan)" : "transparent"}`,
              color: activeTab === tab.id ? "var(--accent-cyan)" : "var(--foreground-muted)",
            }}
          >
            {tab.label}
            {tab.id === "items" && totalUnconsumed > 0 && (
              <span
                className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold"
                style={{ background: "var(--accent-orange)" }}
              >
                {totalUnconsumed > 99 ? "99+" : totalUnconsumed}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "sources" && (
        <div className="space-y-3">
          <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>
            Connect your data sources to start ingesting customer signals.
          </p>

          {connectedSources.length < allSources.length && (
            <div className="rounded-xl p-3 mb-4" style={{ background: "rgba(6, 214, 214, 0.04)", border: "1px solid rgba(6, 214, 214, 0.1)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: "var(--accent-cyan)" }}>
                  Source Onboarding Progress
                </span>
                <span className="text-xs" style={{ color: "var(--accent-cyan)" }}>
                  {connectedSources.length} / {allSources.length}
                </span>
              </div>
              <div className="w-full rounded-full h-1.5" style={{ background: "rgba(6, 214, 214, 0.1)" }}>
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${(connectedSources.length / allSources.length) * 100}%`,
                    background: "linear-gradient(90deg, var(--accent-cyan), var(--accent-blue))",
                  }}
                />
              </div>
            </div>
          )}

          {allSources.map((meta) => (
            <SourceCard key={meta.key} meta={meta} config={configMap[meta.key] || null} stats={sourceStats[meta.key] || null} />
          ))}
        </div>
      )}

      {activeTab === "items" && <ItemsBrowser initialCounts={unconsumedCounts} />}

      {activeTab === "upload" && (
        <div className="max-w-2xl">
          <div className="card"><ManualUpload /></div>
        </div>
      )}

      {activeTab === "runs" && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            Ingest Run History
          </h2>
          {runs.length === 0 ? (
            <p className="text-sm py-4" style={{ color: "var(--foreground-muted)" }}>
              No ingest runs yet. Connect a source and sync to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="text-left py-2 px-2 font-semibold text-xs uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Status</th>
                    <th className="text-left py-2 px-2 font-semibold text-xs uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Trigger</th>
                    <th className="text-left py-2 px-2 font-semibold text-xs uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Sources</th>
                    <th className="text-left py-2 px-2 font-semibold text-xs uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Items</th>
                    <th className="text-left py-2 px-2 font-semibold text-xs uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Summary</th>
                    <th className="text-left py-2 px-2 font-semibold text-xs uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => {
                    let sourcesLabel = "All";
                    if (run.sourcesFilter) {
                      try {
                        const arr = JSON.parse(run.sourcesFilter) as string[];
                        sourcesLabel = arr.length <= 2 ? arr.join(", ") : `${arr.length} sources`;
                      } catch { sourcesLabel = "—"; }
                    }
                    return (
                      <tr key={run.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="py-2 px-2">
                          <span className={run.status === "SUCCESS" ? "badge-success" : run.status === "FAILED" ? "badge-error" : run.status === "RUNNING" ? "badge-warning" : "badge-info"}>
                            {run.status}
                          </span>
                        </td>
                        <td className="py-2 px-2" style={{ color: "var(--foreground)" }}>{run.trigger}</td>
                        <td className="py-2 px-2 text-xs" style={{ color: "var(--foreground-dim)" }}>{sourcesLabel}</td>
                        <td className="py-2 px-2" style={{ color: "var(--foreground)" }}>{run._count.items}</td>
                        <td className="py-2 px-2 text-xs max-w-[200px] truncate" style={{ color: "var(--foreground-dim)" }}>{run.summary || "—"}</td>
                        <td className="py-2 px-2 text-xs whitespace-nowrap" style={{ color: "var(--foreground-dim)" }}>{new Date(run.startedAt).toLocaleString()}</td>
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

function StatPill({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl px-4 py-2.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <span className="text-2xl font-bold" style={{ color }}>{value}</span>
      <span className="text-xs leading-tight" style={{ color: "var(--foreground-dim)" }}>
        {label.split(" ").map((w, i) => <span key={i}>{w}<br /></span>)}
      </span>
    </div>
  );
}
