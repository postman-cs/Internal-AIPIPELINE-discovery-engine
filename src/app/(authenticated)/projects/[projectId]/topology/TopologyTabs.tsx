"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { TopoNode, TopoEdge } from "@/lib/topology/riskScoring";

const ConstellationView = dynamic(() => import("./ConstellationView"), { ssr: false });
const HeatmapView = dynamic(() => import("./HeatmapView"), { ssr: false });
const StoryModeView = dynamic(() => import("./StoryModeView"), { ssr: false });

type Tab = "constellation" | "heatmap" | "story";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "constellation", label: "Constellation", icon: "✦" },
  { id: "heatmap", label: "Heatmap", icon: "▦" },
  { id: "story", label: "Story Mode", icon: "▶" },
];

export default function TopologyTabs({
  nodes,
  edges,
  projectId,
}: {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  projectId: string;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("constellation");
  const [storyHighlight, setStoryHighlight] = useState<{
    nodeIds: string[];
    edgeIds: string[];
  } | null>(null);

  const typedNodes = nodes as unknown as TopoNode[];
  const typedEdges = edges as unknown as TopoEdge[];

  const handleStoryHighlight = useCallback(
    (highlight: { nodeIds: string[]; edgeIds: string[] } | null) => {
      setStoryHighlight(highlight);
      if (highlight) setActiveTab("constellation");
    },
    []
  );

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
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id !== "constellation") setStoryHighlight(null);
            }}
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
        {storyHighlight && activeTab === "constellation" && (
          <button
            onClick={() => setStoryHighlight(null)}
            className="ml-auto text-[10px] px-2 py-1 rounded"
            style={{
              background: "rgba(245,158,11,0.08)",
              color: "#fbbf24",
              border: "1px solid rgba(245,158,11,0.15)",
            }}
          >
            Clear story highlight
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === "constellation" && (
          <ConstellationView nodes={typedNodes} edges={typedEdges} externalHighlight={storyHighlight} />
        )}
        {activeTab === "heatmap" && (
          <HeatmapView nodes={typedNodes} edges={typedEdges} />
        )}
        {activeTab === "story" && (
          <StoryModeView nodes={typedNodes} edges={typedEdges} projectId={projectId} onHighlight={handleStoryHighlight} />
        )}
      </div>
    </div>
  );
}
