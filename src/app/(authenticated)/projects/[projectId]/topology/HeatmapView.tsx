"use client";

import { useState, useMemo, useCallback } from "react";
import {
  computeRiskScores,
  heatmapToMarkdown,
  type TopoNode,
  type TopoEdge,
  type NodeScore,
} from "@/lib/topology/riskScoring";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = "table" | "matrix";
type SortKey = "nodeName" | "nodeType" | "riskScore" | "opportunityScore" | "confidence";
type SortDir = "asc" | "desc";

const RISK_BUCKETS = ["0-20", "21-40", "41-60", "61-80", "81-100"] as const;

function bucketIndex(score: number): number {
  if (score <= 20) return 0;
  if (score <= 40) return 1;
  if (score <= 60) return 2;
  if (score <= 80) return 3;
  return 4;
}

const BUCKET_COLORS = [
  "bg-green-900/40 text-green-300 border-green-800/40",
  "bg-lime-900/30 text-lime-300 border-lime-800/40",
  "bg-yellow-900/30 text-yellow-300 border-yellow-800/40",
  "bg-orange-900/30 text-orange-300 border-orange-800/40",
  "bg-red-900/30 text-red-300 border-red-800/40",
];

const CONF_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HeatmapView({
  nodes,
  edges,
}: {
  nodes: TopoNode[];
  edges: TopoEdge[];
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [sortKey, setSortKey] = useState<SortKey>("riskScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [drillNode, setDrillNode] = useState<NodeScore | null>(null);
  const [matrixDrill, setMatrixDrill] = useState<{ type: string; bucket: number } | null>(null);

  const scores = useMemo(() => computeRiskScores(nodes, edges), [nodes, edges]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...scores];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "confidence") {
        cmp = (CONF_ORDER[a.confidence] ?? 3) - (CONF_ORDER[b.confidence] ?? 3);
      } else if (sortKey === "nodeName" || sortKey === "nodeType") {
        cmp = a[sortKey].localeCompare(b[sortKey]);
      } else {
        cmp = a[sortKey] - b[sortKey];
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [scores, sortKey, sortDir]);

  // Matrix data
  const matrixData = useMemo(() => {
    const types = Array.from(new Set(scores.map((s) => s.nodeType))).sort();
    const matrix: Record<string, number[]> = {};
    for (const t of types) matrix[t] = [0, 0, 0, 0, 0];
    for (const s of scores) {
      const bi = bucketIndex(s.riskScore);
      matrix[s.nodeType][bi]++;
    }
    return { types, matrix };
  }, [scores]);

  // Matrix drill nodes
  const matrixDrillNodes = useMemo(() => {
    if (!matrixDrill) return [];
    return scores.filter(
      (s) =>
        s.nodeType === matrixDrill.type &&
        bucketIndex(s.riskScore) === matrixDrill.bucket
    );
  }, [matrixDrill, scores]);

  // Handlers
  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else {
        setSortKey(key);
        setSortDir("desc");
      }
    },
    [sortKey]
  );

  const handleExportMarkdown = useCallback(() => {
    const md = heatmapToMarkdown(scores);
    navigator.clipboard.writeText(md);
  }, [scores]);

  const handleExportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(scores, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "heatmap.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [scores]);

  // Recommended action template (deterministic, no LLM)
  function getRecommendation(s: NodeScore): string {
    if (s.riskScore >= 60) {
      return `High risk component. Recommend: 1) Validate with customer, 2) Document current auth/dependency model, 3) Propose risk mitigation in Solution Design.`;
    }
    if (s.opportunityScore >= 60) {
      return `High opportunity component. Recommend: 1) Include in Postman workspace demo, 2) Propose governance/contract-first approach, 3) Use as conversation starter in customer workshop.`;
    }
    return `Moderate profile. Monitor during implementation. Include in topology validation session.`;
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      <span className="ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>
    ) : null;

  return (
    <div className="flex flex-1 min-h-0 bg-gray-950">
      {/* Main content */}
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-100">Risk Heatmap</h2>
            <p className="text-xs text-gray-500">
              Deterministic scoring across {scores.length} components
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex bg-gray-800 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  viewMode === "table"
                    ? "bg-gray-700 text-white"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Table
              </button>
              <button
                onClick={() => setViewMode("matrix")}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  viewMode === "matrix"
                    ? "bg-gray-700 text-white"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Matrix
              </button>
            </div>

            {/* Export */}
            <button
              onClick={handleExportMarkdown}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
            >
              Copy Markdown
            </button>
            <button
              onClick={handleExportJson}
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
            >
              Download JSON
            </button>
          </div>
        </div>

        {/* Table view */}
        {viewMode === "table" && (
          <div className="border border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-900/80 border-b border-gray-800">
                  {([
                    ["nodeName", "Node"],
                    ["nodeType", "Type"],
                    ["riskScore", "Risk"],
                    ["opportunityScore", "Opportunity"],
                    ["confidence", "Confidence"],
                  ] as [SortKey, string][]).map(([key, label]) => (
                    <th
                      key={key}
                      onClick={() => toggleSort(key)}
                      className="text-left px-3 py-2 text-gray-400 font-medium cursor-pointer hover:text-gray-200 select-none"
                    >
                      {label}
                      <SortIcon k={key} />
                    </th>
                  ))}
                  <th className="px-3 py-2 text-gray-400 font-medium text-left">Drivers</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => (
                  <tr
                    key={s.nodeId}
                    onClick={() => setDrillNode(s)}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2 text-gray-200 font-medium">{s.nodeName}</td>
                    <td className="px-3 py-2 text-gray-400">{s.nodeType.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2">
                      <ScoreBadge score={s.riskScore} high="bad" />
                    </td>
                    <td className="px-3 py-2">
                      <ScoreBadge score={s.opportunityScore} high="good" />
                    </td>
                    <td className="px-3 py-2">
                      <ConfidenceBadge confidence={s.confidence} />
                    </td>
                    <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">
                      {s.drivers.map((d) => d.type).join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Matrix view */}
        {viewMode === "matrix" && (
          <div className="border border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-900/80 border-b border-gray-800">
                  <th className="text-left px-3 py-2 text-gray-400 font-medium">Node Type</th>
                  {RISK_BUCKETS.map((b) => (
                    <th key={b} className="text-center px-3 py-2 text-gray-400 font-medium">
                      {b}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixData.types.map((type) => (
                  <tr key={type} className="border-b border-gray-800/50">
                    <td className="px-3 py-2 text-gray-300 font-medium">
                      {type.replace(/_/g, " ")}
                    </td>
                    {matrixData.matrix[type].map((count, bi) => (
                      <td key={bi} className="text-center px-3 py-2">
                        {count > 0 ? (
                          <button
                            onClick={() => setMatrixDrill({ type, bucket: bi })}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border text-sm font-semibold transition-transform hover:scale-110 ${BUCKET_COLORS[bi]}`}
                          >
                            {count}
                          </button>
                        ) : (
                          <span className="text-gray-700">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Matrix drill-down */}
            {matrixDrill && matrixDrillNodes.length > 0 && (
              <div className="border-t border-gray-800 bg-gray-900/50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-300">
                    {matrixDrill.type.replace(/_/g, " ")} — Risk {RISK_BUCKETS[matrixDrill.bucket]}
                  </span>
                  <button
                    onClick={() => setMatrixDrill(null)}
                    className="text-xs text-gray-500 hover:text-gray-300"
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-2">
                  {matrixDrillNodes.map((s) => (
                    <button
                      key={s.nodeId}
                      onClick={() => setDrillNode(s)}
                      className="w-full text-left bg-gray-800/50 rounded-lg p-3 hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-200">{s.nodeName}</span>
                        <div className="flex gap-2">
                          <ScoreBadge score={s.riskScore} high="bad" />
                          <ScoreBadge score={s.opportunityScore} high="good" />
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">
                        {s.drivers.map((d) => d.note).join("; ") || "No specific drivers"}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drill-down panel */}
      {drillNode && (
        <div className="w-[380px] bg-gray-900 border-l border-gray-800 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-100">{drillNode.nodeName}</h3>
            <button onClick={() => setDrillNode(null)} className="text-gray-500 hover:text-gray-300 text-xs">
              Close
            </button>
          </div>

          <div className="flex gap-4">
            <div className="flex-1 bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Risk</div>
              <div className={`text-2xl font-bold ${drillNode.riskScore >= 60 ? "text-red-400" : drillNode.riskScore >= 30 ? "text-yellow-400" : "text-green-400"}`}>
                {drillNode.riskScore}
              </div>
            </div>
            <div className="flex-1 bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Opportunity</div>
              <div className={`text-2xl font-bold ${drillNode.opportunityScore >= 60 ? "text-emerald-400" : drillNode.opportunityScore >= 30 ? "text-blue-400" : "text-gray-400"}`}>
                {drillNode.opportunityScore}
              </div>
            </div>
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-wider text-gray-500 block mb-1">Type</span>
            <span className="text-sm text-gray-300">{drillNode.nodeType.replace(/_/g, " ")}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-wider text-gray-500 block mb-1">Confidence</span>
            <ConfidenceBadge confidence={drillNode.confidence} />
          </div>

          {/* Drivers */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-gray-500 block mb-2">Risk & Opportunity Drivers</span>
            {drillNode.drivers.length === 0 ? (
              <p className="text-xs text-gray-600">No specific drivers identified.</p>
            ) : (
              <div className="space-y-2">
                {drillNode.drivers.map((d, i) => (
                  <div key={i} className="bg-gray-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold text-gray-400 bg-gray-700 rounded px-1.5 py-0.5">
                        {d.type}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300">{d.note}</p>
                    {d.evidenceIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {d.evidenceIds.map((eid) => (
                          <span key={eid} className="text-[9px] bg-blue-900/20 text-blue-400 px-1 py-0.5 rounded">
                            {eid}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recommendation */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-gray-500 block mb-1">Recommended Next Action</span>
            <p className="text-xs text-gray-300 bg-blue-900/10 border border-blue-800/20 rounded-lg p-3">
              {getRecommendation(drillNode)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function ScoreBadge({ score, high }: { score: number; high: "good" | "bad" }) {
  let colorClass: string;
  if (high === "bad") {
    colorClass =
      score >= 60 ? "bg-red-900/30 text-red-300" :
      score >= 30 ? "bg-yellow-900/30 text-yellow-300" :
      "bg-green-900/30 text-green-300";
  } else {
    colorClass =
      score >= 60 ? "bg-emerald-900/30 text-emerald-300" :
      score >= 30 ? "bg-blue-900/30 text-blue-300" :
      "bg-gray-800 text-gray-400";
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${colorClass}`}>
      {score}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const cls =
    confidence === "High" ? "bg-green-900/30 text-green-300" :
    confidence === "Medium" ? "bg-yellow-900/30 text-yellow-300" :
    "bg-red-900/30 text-red-300";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls}`}>
      {confidence}
    </span>
  );
}
