"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { TopoNode, TopoEdge } from "@/lib/topology/riskScoring";

const ConstellationView = dynamic(() => import("./ConstellationView"), { ssr: false });
const HeatmapView = dynamic(() => import("./HeatmapView"), { ssr: false });

type Tab = "constellation" | "heatmap";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "constellation", label: "Constellation", icon: "✦" },
  { id: "heatmap", label: "Heatmap", icon: "▦" },
];

export default function TopologyTabs({
  nodes,
  edges,
}: {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("constellation");

  const typedNodes = nodes as unknown as TopoNode[];
  const typedEdges = edges as unknown as TopoEdge[];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tab bar */}
      <div
        className="flex items-center px-4 shrink-0"
        style={{
          background: "var(--background-secondary)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all duration-200"
            style={{
              borderBottom: `2px solid ${activeTab === tab.id ? "var(--accent-cyan)" : "transparent"}`,
              color: activeTab === tab.id ? "var(--accent-cyan)" : "var(--foreground-dim)",
            }}
          >
            <span className="text-[10px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === "constellation" && (
          <ConstellationView nodes={typedNodes} edges={typedEdges} />
        )}
        {activeTab === "heatmap" && (
          <HeatmapView nodes={typedNodes} edges={typedEdges} />
        )}
      </div>
    </div>
  );
}
