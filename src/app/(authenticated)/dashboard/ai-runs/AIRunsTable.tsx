"use client";

import { useState } from "react";
import Link from "next/link";

type AIRunRow = {
  id: string;
  projectId: string | null;
  project: { id: string; name: string } | null;
  agentType: string;
  model: string;
  promptHash: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputJson: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  outputJson: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokenUsage: any;
  durationMs: number | null;
  status: string;
  createdAt: Date;
};

const AGENT_COLORS: Record<string, { bg: string; text: string }> = {
  ReconSynthesizer: { bg: "rgba(59,130,246,0.1)", text: "#60a5fa" },
  SignalClassifier: { bg: "rgba(139,92,246,0.1)", text: "#a78bfa" },
  MaturityScorer: { bg: "rgba(245,158,11,0.1)", text: "#fbbf24" },
  HypothesisGenerator: { bg: "rgba(16,185,129,0.1)", text: "#34d399" },
  BriefGenerator: { bg: "rgba(244,63,94,0.1)", text: "#fb7185" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string; pulse?: boolean }> = {
  SUCCESS: { bg: "rgba(16,185,129,0.1)", text: "#34d399" },
  FAILED: { bg: "rgba(239,68,68,0.1)", text: "#f87171" },
  RUNNING: { bg: "rgba(245,158,11,0.1)", text: "#fbbf24", pulse: true },
};

export function AIRunsTable({ runs }: { runs: AIRunRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("ALL");

  const filteredRuns =
    filter === "ALL"
      ? runs
      : filter === "FAILED"
      ? runs.filter((r) => r.status === "FAILED")
      : runs.filter((r) => r.agentType === filter);

  const agentTypes = Array.from(new Set(runs.map((r) => r.agentType)));

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <FilterButton label="All" active={filter === "ALL"} onClick={() => setFilter("ALL")} count={runs.length} />
        <FilterButton label="Failed" active={filter === "FAILED"} onClick={() => setFilter("FAILED")} count={runs.filter((r) => r.status === "FAILED").length} isError />
        {agentTypes.map((at) => (
          <FilterButton key={at} label={at} active={filter === at} onClick={() => setFilter(at)} count={runs.filter((r) => r.agentType === at).length} />
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface)" }}>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Agent</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Project</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Duration</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Tokens</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Prompt Hash</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredRuns.map((run) => (
                <TableRow key={run.id} run={run} isExpanded={expandedId === run.id} onToggle={() => setExpandedId(expandedId === run.id ? null : run.id)} />
              ))}
            </tbody>
          </table>
        </div>
        {filteredRuns.length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: "var(--foreground-muted)" }}>
            No runs match this filter.
          </div>
        )}
      </div>
    </div>
  );
}

function TableRow({ run, isExpanded, onToggle }: { run: AIRunRow; isExpanded: boolean; onToggle: () => void }) {
  const tokens = run.tokenUsage as { prompt?: number; completion?: number; total?: number } | null;
  const agentColor = AGENT_COLORS[run.agentType] || { bg: "rgba(255,255,255,0.05)", text: "var(--foreground-muted)" };
  const statusColor = STATUS_COLORS[run.status] || { bg: "rgba(255,255,255,0.05)", text: "var(--foreground-muted)" };

  return (
    <>
      <tr
        className="cursor-pointer transition-colors duration-150"
        onClick={onToggle}
        style={{ borderBottom: "1px solid var(--border)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <td className="px-4 py-3">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            style={{ background: agentColor.bg, color: agentColor.text }}
          >
            {run.agentType}
          </span>
        </td>
        <td className="px-4 py-3">
          {run.project ? (
            <Link href={`/projects/${run.project.id}`} className="text-xs" style={{ color: "var(--accent-cyan)" }} onClick={(e) => e.stopPropagation()}>
              {run.project.name}
            </Link>
          ) : (
            <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor.pulse ? "animate-pulse" : ""}`}
            style={{ background: statusColor.bg, color: statusColor.text }}
          >
            {run.status}
          </span>
        </td>
        <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--foreground-muted)" }}>
          {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}
        </td>
        <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--foreground-muted)" }}>
          {tokens?.total ?? "—"}
        </td>
        <td className="px-4 py-3 text-xs font-mono truncate max-w-[120px]" style={{ color: "var(--foreground-dim)" }}>
          {run.promptHash.slice(0, 12)}...
        </td>
        <td className="px-4 py-3 text-xs" style={{ color: "var(--foreground-dim)" }}>
          {new Date(run.createdAt).toLocaleString()}
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={7} style={{ background: "var(--surface)", padding: "1rem" }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--foreground-dim)" }}>
                  Input Summary
                </h4>
                <pre
                  className="rounded-lg p-3 text-[11px] overflow-x-auto max-h-64 overflow-y-auto"
                  style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground-muted)" }}
                >
                  {JSON.stringify(run.inputJson, null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--foreground-dim)" }}>
                  Output {run.status === "FAILED" && <span style={{ color: "var(--accent-red)" }}>(Error)</span>}
                </h4>
                <pre
                  className="rounded-lg p-3 text-[11px] overflow-x-auto max-h-64 overflow-y-auto"
                  style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground-muted)" }}
                >
                  {run.outputJson ? JSON.stringify(run.outputJson, null, 2) : "No output"}
                </pre>
              </div>
              {tokens && (
                <div className="md:col-span-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--foreground-dim)" }}>
                    Token Usage
                  </h4>
                  <div className="flex gap-6 text-xs">
                    <div><span style={{ color: "var(--foreground-dim)" }}>Prompt:</span>{" "}<span className="font-mono font-medium" style={{ color: "var(--foreground)" }}>{tokens.prompt?.toLocaleString() ?? "—"}</span></div>
                    <div><span style={{ color: "var(--foreground-dim)" }}>Completion:</span>{" "}<span className="font-mono font-medium" style={{ color: "var(--foreground)" }}>{tokens.completion?.toLocaleString() ?? "—"}</span></div>
                    <div><span style={{ color: "var(--foreground-dim)" }}>Total:</span>{" "}<span className="font-mono font-medium" style={{ color: "var(--accent-green)" }}>{tokens.total?.toLocaleString() ?? "—"}</span></div>
                    <div><span style={{ color: "var(--foreground-dim)" }}>Model:</span>{" "}<span className="font-mono" style={{ color: "var(--foreground)" }}>{run.model}</span></div>
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function FilterButton({ label, active, onClick, count, isError }: { label: string; active: boolean; onClick: () => void; count: number; isError?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
      style={{
        background: active ? "rgba(6, 214, 214, 0.08)" : "var(--surface)",
        color: active ? "var(--accent-cyan)" : isError ? "var(--accent-red)" : "var(--foreground-muted)",
        border: `1px solid ${active ? "rgba(6, 214, 214, 0.15)" : "var(--border)"}`,
      }}
    >
      <span>{label}</span>
      <span
        className="rounded-full px-1.5 py-0.5 text-[10px]"
        style={{ background: active ? "rgba(6, 214, 214, 0.12)" : "rgba(255,255,255,0.04)" }}
      >
        {count}
      </span>
    </button>
  );
}
