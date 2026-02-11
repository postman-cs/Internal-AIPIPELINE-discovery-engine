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

const AGENT_COLORS: Record<string, string> = {
  ReconSynthesizer: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  SignalClassifier: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  MaturityScorer: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  HypothesisGenerator: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
  BriefGenerator: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400",
};

const STATUS_COLORS: Record<string, string> = {
  SUCCESS: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  FAILED: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  RUNNING: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 animate-pulse",
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
        <FilterButton
          label="All"
          active={filter === "ALL"}
          onClick={() => setFilter("ALL")}
          count={runs.length}
        />
        <FilterButton
          label="Failed"
          active={filter === "FAILED"}
          onClick={() => setFilter("FAILED")}
          count={runs.filter((r) => r.status === "FAILED").length}
          color="text-red-600"
        />
        {agentTypes.map((at) => (
          <FilterButton
            key={at}
            label={at}
            active={filter === at}
            onClick={() => setFilter(at)}
            count={runs.filter((r) => r.agentType === at).length}
          />
        ))}
      </div>

      {/* Table */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-left">
                <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Agent
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Project
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Tokens
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Prompt Hash
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredRuns.map((run) => (
                <TableRow
                  key={run.id}
                  run={run}
                  isExpanded={expandedId === run.id}
                  onToggle={() =>
                    setExpandedId(expandedId === run.id ? null : run.id)
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
        {filteredRuns.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-500">
            No runs match this filter.
          </div>
        )}
      </div>
    </div>
  );
}

function TableRow({
  run,
  isExpanded,
  onToggle,
}: {
  run: AIRunRow;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const tokens = run.tokenUsage as {
    prompt?: number;
    completion?: number;
    total?: number;
  } | null;

  return (
    <>
      <tr
        className="hover:bg-gray-50 dark:hover:bg-gray-900/30 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              AGENT_COLORS[run.agentType] ||
              "bg-gray-100 dark:bg-gray-800 text-gray-600"
            }`}
          >
            {run.agentType}
          </span>
        </td>
        <td className="px-4 py-3">
          {run.project ? (
            <Link
              href={`/projects/${run.project.id}`}
              className="text-[#ff6c37] hover:underline text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              {run.project.name}
            </Link>
          ) : (
            <span className="text-gray-400 text-xs">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              STATUS_COLORS[run.status] || "bg-gray-100 text-gray-600"
            }`}
          >
            {run.status}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 font-mono">
          {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}
        </td>
        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 font-mono">
          {tokens?.total ?? "—"}
        </td>
        <td className="px-4 py-3 text-xs text-gray-400 font-mono truncate max-w-[120px]">
          {run.promptHash.slice(0, 12)}...
        </td>
        <td className="px-4 py-3 text-xs text-gray-400">
          {new Date(run.createdAt).toLocaleString()}
        </td>
      </tr>

      {/* Expanded Detail Panel */}
      {isExpanded && (
        <tr>
          <td colSpan={7} className="bg-gray-50 dark:bg-gray-900/50 px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Input */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Input Summary
                </h4>
                <pre className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-[11px] overflow-x-auto max-h-64 overflow-y-auto text-gray-700 dark:text-gray-300">
                  {JSON.stringify(run.inputJson, null, 2)}
                </pre>
              </div>

              {/* Output */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Output{" "}
                  {run.status === "FAILED" && (
                    <span className="text-red-500">(Error)</span>
                  )}
                </h4>
                <pre className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3 text-[11px] overflow-x-auto max-h-64 overflow-y-auto text-gray-700 dark:text-gray-300">
                  {run.outputJson
                    ? JSON.stringify(run.outputJson, null, 2)
                    : "No output"}
                </pre>
              </div>

              {/* Token Breakdown */}
              {tokens && (
                <div className="md:col-span-2">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Token Usage
                  </h4>
                  <div className="flex gap-6 text-xs">
                    <div>
                      <span className="text-gray-500">Prompt:</span>{" "}
                      <span className="font-mono font-medium text-gray-900 dark:text-gray-100">
                        {tokens.prompt?.toLocaleString() ?? "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Completion:</span>{" "}
                      <span className="font-mono font-medium text-gray-900 dark:text-gray-100">
                        {tokens.completion?.toLocaleString() ?? "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Total:</span>{" "}
                      <span className="font-mono font-medium text-[#ff6c37]">
                        {tokens.total?.toLocaleString() ?? "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Model:</span>{" "}
                      <span className="font-mono text-gray-900 dark:text-gray-100">
                        {run.model}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Prompt Hash:</span>{" "}
                      <span className="font-mono text-gray-400">
                        {run.promptHash}
                      </span>
                    </div>
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

function FilterButton({
  label,
  active,
  onClick,
  count,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active
          ? "bg-[#ff6c37]/10 text-[#ff6c37] border border-[#ff6c37]/20"
          : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
      }`}
    >
      <span className={color || ""}>{label}</span>
      <span
        className={`${
          active ? "bg-[#ff6c37]/20" : "bg-gray-100 dark:bg-gray-800"
        } rounded-full px-1.5 py-0.5 text-[10px]`}
      >
        {count}
      </span>
    </button>
  );
}
