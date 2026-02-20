"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import dynamic from "next/dynamic";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

// ---------------------------------------------------------------------------
// Palette & constants
// ---------------------------------------------------------------------------

const NODE_COLORS: Record<string, string> = {
  SERVICE: "#60a5fa",
  API: "#34d399",
  GATEWAY: "#f472b6",
  DATABASE: "#fbbf24",
  IDENTITY_PROVIDER: "#a78bfa",
  CDN: "#22d3ee",
  LOAD_BALANCER: "#fb923c",
  CLIENT: "#e5e7eb",
  EXTERNAL_SYSTEM: "#94a3b8",
  QUEUE: "#c084fc",
  STORAGE: "#facc15",
};

const GLOW_STRENGTH: Record<string, number> = {
  High: 24,
  Medium: 14,
  Low: 6,
};

const GLOW_ALPHA: Record<string, number> = {
  High: 1,
  Medium: 0.6,
  Low: 0.3,
};

const HIGHLIGHT_MODES = ["Off", "Dependencies", "Auth Path", "Traffic Flow"] as const;
type HighlightMode = (typeof HIGHLIGHT_MODES)[number];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopoNode {
  id: string;
  type: string;
  name: string;
  metadata?: Record<string, unknown>;
  evidenceIds: string[];
  confidence: string;
}

export interface TopoEdge {
  from: string;
  to: string;
  type: string;
  evidenceIds: string[];
  confidence: string;
  metadata?: Record<string, unknown>;
}

interface GNode {
  id: string;
  name: string;
  type: string;
  val: number;
  color: string;
  confidence: string;
  evidenceIds: string[];
  metadata?: Record<string, unknown>;
  degree: number;
}

interface GLink {
  source: string | GNode;
  target: string | GNode;
  edgeKey: string;
  type: string;
  confidence: string;
  evidenceIds: string[];
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wider text-gray-500 block">{label}</span>
      <span className={`text-sm text-gray-200 ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ConstellationView({
  nodes,
  edges,
  externalHighlight,
}: {
  nodes: TopoNode[];
  edges: TopoEdge[];
  externalHighlight?: { nodeIds: string[]; edgeIds: string[] } | null;
}) {
  // State
  const [selectedNode, setSelectedNode] = useState<GNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GLink | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [confidenceFilter, setConfidenceFilter] = useState<Set<string>>(new Set(["High", "Medium", "Low"]));
  const [highlightMode, setHighlightMode] = useState<HighlightMode>("Off");
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Dimensions
  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Degree map for sizing
  const degreeMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of nodes) m.set(n.id, 0);
    for (const e of edges) {
      m.set(e.from, (m.get(e.from) ?? 0) + 1);
      m.set(e.to, (m.get(e.to) ?? 0) + 1);
    }
    return m;
  }, [nodes, edges]);

  // Available types
  const nodeTypes = useMemo(
    () => Array.from(new Set(nodes.map((n) => n.type))).sort(),
    [nodes]
  );

  // Build graph data with filters
  const { graphData, graphNodes, graphLinks } = useMemo(() => {
    const lowerSearch = search.toLowerCase();

    const filteredNodes = nodes.filter((n) => {
      if (typeFilter.size > 0 && !typeFilter.has(n.type)) return false;
      if (!confidenceFilter.has(n.confidence)) return false;
      if (lowerSearch && !n.name.toLowerCase().includes(lowerSearch) && !n.id.toLowerCase().includes(lowerSearch)) return false;
      return true;
    });

    const nodeIdSet = new Set(filteredNodes.map((n) => n.id));

    const gNodes: GNode[] = filteredNodes.map((n) => {
      const degree = degreeMap.get(n.id) ?? 0;
      const baseSize = 4;
      const sizeBoost = Math.min(degree * 1.2, 8);
      return {
        id: n.id,
        name: n.name,
        type: n.type,
        val: baseSize + sizeBoost,
        color: NODE_COLORS[n.type] ?? "#94a3b8",
        confidence: n.confidence,
        evidenceIds: n.evidenceIds ?? [],
        metadata: n.metadata,
        degree,
      };
    });

    const gLinks: GLink[] = edges
      .filter((e) => nodeIdSet.has(e.from) && nodeIdSet.has(e.to))
      .map((e) => ({
        source: e.from,
        target: e.to,
        edgeKey: `${e.from}->${e.to}`,
        type: e.type,
        confidence: e.confidence,
        evidenceIds: e.evidenceIds ?? [],
        metadata: e.metadata,
      }));

    return {
      graphData: { nodes: gNodes, links: gLinks },
      graphNodes: gNodes,
      graphLinks: gLinks,
    };
  }, [nodes, edges, search, typeFilter, confidenceFilter, degreeMap]);

  // Spread out the force layout so nodes don't overlap
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength(-300);
    fg.d3Force("link")?.distance(100);
    fg.d3Force("center")?.strength(0.05);
    fg.d3ReheatSimulation();
  }, [graphData]);

  // Highlight sets
  const highlightNodeIds = useMemo(() => {
    const set = new Set<string>();

    // External highlight (from story mode)
    if (externalHighlight) {
      for (const id of externalHighlight.nodeIds) set.add(id);
      return set;
    }

    if (highlightMode === "Off" && !selectedNode) return set;

    if (highlightMode === "Dependencies" && selectedNode) {
      set.add(selectedNode.id);
      for (const l of graphLinks) {
        const src = typeof l.source === "string" ? l.source : l.source.id;
        const tgt = typeof l.target === "string" ? l.target : l.target.id;
        if (src === selectedNode.id) { set.add(tgt); }
        if (tgt === selectedNode.id) { set.add(src); }
      }
    } else if (highlightMode === "Auth Path") {
      for (const l of graphLinks) {
        if (l.type === "AUTHENTICATES_WITH" || l.type === "ROUTES_THROUGH") {
          const src = typeof l.source === "string" ? l.source : l.source.id;
          const tgt = typeof l.target === "string" ? l.target : l.target.id;
          set.add(src);
          set.add(tgt);
        }
      }
    } else if (highlightMode === "Traffic Flow") {
      for (const l of graphLinks) {
        if (l.type === "CALLS") {
          const src = typeof l.source === "string" ? l.source : l.source.id;
          const tgt = typeof l.target === "string" ? l.target : l.target.id;
          set.add(src);
          set.add(tgt);
        }
      }
    }
    return set;
  }, [highlightMode, selectedNode, graphLinks, externalHighlight]);

  const highlightEdgeKeys = useMemo(() => {
    const set = new Set<string>();

    if (externalHighlight) {
      for (const ek of externalHighlight.edgeIds) set.add(ek);
      return set;
    }

    if (highlightMode === "Dependencies" && selectedNode) {
      for (const l of graphLinks) {
        const src = typeof l.source === "string" ? l.source : l.source.id;
        const tgt = typeof l.target === "string" ? l.target : l.target.id;
        if (src === selectedNode.id || tgt === selectedNode.id) set.add(l.edgeKey);
      }
    } else if (highlightMode === "Auth Path") {
      for (const l of graphLinks) {
        if (l.type === "AUTHENTICATES_WITH" || l.type === "ROUTES_THROUGH") set.add(l.edgeKey);
      }
    } else if (highlightMode === "Traffic Flow") {
      for (const l of graphLinks) {
        if (l.type === "CALLS") set.add(l.edgeKey);
      }
    }
    return set;
  }, [highlightMode, selectedNode, graphLinks, externalHighlight]);

  const isHighlighting = highlightNodeIds.size > 0 || highlightEdgeKeys.size > 0;

  // Handlers
  const handleNodeClick = useCallback((node: object) => {
    setSelectedEdge(null);
    setSelectedNode(node as GNode);
  }, []);

  const handleLinkClick = useCallback((link: object) => {
    setSelectedNode(null);
    setSelectedEdge(link as GLink);
  }, []);

  const handleBgClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const handleNodeHover = useCallback((node: object | null) => {
    setHoveredNode(node ? (node as GNode).id : null);
  }, []);

  const panelOpen = selectedNode !== null || selectedEdge !== null;

  // Starfield background particles
  const starfield = useMemo(() => {
    const stars: { x: number; y: number; r: number; a: number }[] = [];
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random() * 2000,
        y: Math.random() * 2000,
        r: Math.random() * 1.2 + 0.3,
        a: Math.random() * 0.6 + 0.1,
      });
    }
    return stars;
  }, []);

  return (
    <div className="flex flex-1 min-h-0 relative">
      {/* Controls bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center gap-2 pointer-events-none">
        {/* Search */}
        <input
          type="text"
          placeholder="Search nodes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pointer-events-auto w-48 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder:text-gray-500 outline-none focus:border-blue-500 transition-colors"
        />

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((p) => !p)}
          className="pointer-events-auto bg-gray-900/90 backdrop-blur border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 hover:text-white transition-colors"
        >
          Filters {typeFilter.size > 0 || confidenceFilter.size < 3 ? `(active)` : ""}
        </button>

        {/* Highlight mode */}
        <select
          value={highlightMode}
          onChange={(e) => setHighlightMode(e.target.value as HighlightMode)}
          className="pointer-events-auto bg-gray-900/90 backdrop-blur border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 outline-none cursor-pointer"
        >
          {HIGHLIGHT_MODES.map((m) => (
            <option key={m} value={m}>
              {m === "Off" ? "Highlight: Off" : `Highlight: ${m}`}
            </option>
          ))}
        </select>

        {/* Node count */}
        <span className="ml-auto pointer-events-none text-[10px] text-gray-500 bg-gray-900/60 rounded px-2 py-1">
          {graphNodes.length}/{nodes.length} nodes
        </span>
      </div>

      {/* Filter dropdown */}
      {showFilters && (
        <div className="absolute top-12 left-3 z-30 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-lg p-3 w-64 space-y-3">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-gray-400 mb-1 block">Node Type</span>
            <div className="flex flex-wrap gap-1">
              {nodeTypes.map((t) => (
                <button
                  key={t}
                  onClick={() =>
                    setTypeFilter((prev) => {
                      const next = new Set(prev);
                      if (next.has(t)) next.delete(t);
                      else next.add(t);
                      return next;
                    })
                  }
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                    typeFilter.has(t)
                      ? "border-blue-500 bg-blue-900/40 text-blue-300"
                      : typeFilter.size === 0
                      ? "border-gray-700 text-gray-400 hover:border-gray-500"
                      : "border-gray-700 text-gray-600 hover:border-gray-500"
                  }`}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full mr-1"
                    style={{ backgroundColor: NODE_COLORS[t] }}
                  />
                  {t.replace(/_/g, " ")}
                </button>
              ))}
              {typeFilter.size > 0 && (
                <button
                  onClick={() => setTypeFilter(new Set())}
                  className="text-[10px] text-gray-500 hover:text-gray-300 ml-1"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider text-gray-400 mb-1 block">Confidence</span>
            <div className="flex gap-2">
              {["High", "Medium", "Low"].map((c) => (
                <label key={c} className="flex items-center gap-1 text-[10px] text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confidenceFilter.has(c)}
                    onChange={() =>
                      setConfidenceFilter((prev) => {
                        const next = new Set(prev);
                        if (next.has(c)) next.delete(c);
                        else next.add(c);
                        return next;
                      })
                    }
                    className="w-3 h-3 rounded"
                  />
                  {c}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Force graph canvas */}
      <div ref={containerRef} className="flex-1 bg-gray-950 relative overflow-hidden">
        <ForceGraph2D
          ref={fgRef}
          width={dimensions.width - (panelOpen ? 340 : 0)}
          height={dimensions.height}
          graphData={graphData}
          backgroundColor="rgba(0,0,0,0)"
          onNodeClick={handleNodeClick}
          onLinkClick={handleLinkClick}
          onBackgroundClick={handleBgClick}
          onNodeHover={handleNodeHover}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={0.9}
          cooldownTicks={120}
          nodeCanvasObjectMode={() => "replace"}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const n = node as GNode & { x: number; y: number };
            const size = n.val ?? 5;
            const isHovered = hoveredNode === n.id;
            const isHighlighted = highlightNodeIds.has(n.id);
            const dimmed = isHighlighting && !isHighlighted;
            const glowBlur = GLOW_STRENGTH[n.confidence] ?? 10;
            const alpha = dimmed ? 0.15 : (GLOW_ALPHA[n.confidence] ?? 0.5);
            const fontSize = Math.max(10 / globalScale, 1.5);

            // Validate coordinates and size are finite before drawing
            if (!isFinite(n.x) || !isFinite(n.y) || !isFinite(size)) {
              return; // Skip rendering this node if coordinates are invalid
            }

            // Draw starfield behind (only once per render cycle at this node)
            // (Starfield is drawn via CSS/canvas bg)

            // Outer glow halo
            if (!dimmed) {
              const grad = ctx.createRadialGradient(n.x, n.y, size * 0.3, n.x, n.y, size * 3);
              grad.addColorStop(0, `${n.color}${Math.round(alpha * 40).toString(16).padStart(2, "0")}`);
              grad.addColorStop(1, "transparent");
              ctx.beginPath();
              ctx.arc(n.x, n.y, size * 3, 0, 2 * Math.PI);
              ctx.fillStyle = grad;
              ctx.fill();
            }

            // Core glow
            ctx.shadowColor = dimmed ? "transparent" : n.color;
            ctx.shadowBlur = isHovered ? glowBlur * 2 : glowBlur;
            ctx.globalAlpha = alpha;

            // Star shape — draw as circle with bright center
            ctx.beginPath();
            ctx.arc(n.x, n.y, size, 0, 2 * Math.PI);
            ctx.fillStyle = n.color;
            ctx.fill();

            // Bright center dot
            if (!dimmed) {
              ctx.beginPath();
              ctx.arc(n.x, n.y, size * 0.35, 0, 2 * Math.PI);
              ctx.fillStyle = "#ffffff";
              ctx.globalAlpha = alpha * 0.9;
              ctx.fill();
            }

            // Reset
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;

            // Label
            if (globalScale > 0.6 || isHovered || isHighlighted) {
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.fillStyle = dimmed ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.85)";
              ctx.font = `${isHovered ? fontSize * 1.2 : fontSize}px sans-serif`;
              ctx.fillText(n.name, n.x, n.y + size + 3);
            }

            // Hover tooltip
            if (isHovered && globalScale > 0.4) {
              const lines = [
                n.type.replace(/_/g, " "),
                `Confidence: ${n.confidence}`,
                `Evidence: ${n.evidenceIds.length}`,
                `Connections: ${n.degree}`,
              ];
              const padding = 6 / globalScale;
              const lineHeight = (fontSize + 2);
              const boxW = 120 / globalScale;
              const boxH = lines.length * lineHeight + padding * 2;
              const boxX = n.x + size + 6 / globalScale;
              const boxY = n.y - boxH / 2;

              ctx.fillStyle = "rgba(17,24,39,0.92)";
              ctx.strokeStyle = "rgba(75,85,99,0.6)";
              ctx.lineWidth = 1 / globalScale;
              ctx.beginPath();
              ctx.roundRect(boxX, boxY, boxW, boxH, 3 / globalScale);
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = "rgba(255,255,255,0.85)";
              ctx.textAlign = "left";
              ctx.textBaseline = "top";
              ctx.font = `${fontSize * 0.9}px sans-serif`;
              lines.forEach((line, i) => {
                ctx.fillText(line, boxX + padding, boxY + padding + i * lineHeight);
              });
            }
          }}
          nodePointerAreaPaint={(node, color, ctx) => {
            const n = node as GNode & { x: number; y: number };
            const size = (n.val ?? 5) + 4;
            ctx.beginPath();
            ctx.arc(n.x, n.y, size, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.fill();
          }}
          linkCanvasObject={(link, ctx) => {
            const l = link as GLink & { source: GNode & { x: number; y: number }; target: GNode & { x: number; y: number } };
            if (!l.source?.x || !l.target?.x) return;

            const isEdgeHighlighted = highlightEdgeKeys.has(l.edgeKey);
            const dimmedEdge = isHighlighting && !isEdgeHighlighted;
            const alpha = dimmedEdge ? 0.04 : isEdgeHighlighted ? 0.6 : 0.12;
            const width = dimmedEdge ? 0.3 : isEdgeHighlighted ? 2 : ((l.metadata as Record<string, unknown>)?.criticality ? 1.5 : 0.8);

            ctx.beginPath();
            ctx.moveTo(l.source.x, l.source.y);
            ctx.lineTo(l.target.x, l.target.y);
            ctx.strokeStyle = isEdgeHighlighted ? "#60a5fa" : `rgba(255,255,255,${alpha})`;
            ctx.lineWidth = width;
            ctx.stroke();

            // Arrow
            if (!dimmedEdge) {
              const dx = l.target.x - l.source.x;
              const dy = l.target.y - l.source.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              if (len > 0) {
                const arrowPos = 0.85;
                const ax = l.source.x + dx * arrowPos;
                const ay = l.source.y + dy * arrowPos;
                const angle = Math.atan2(dy, dx);
                const arrowLen = 4;
                ctx.beginPath();
                ctx.moveTo(ax, ay);
                ctx.lineTo(ax - arrowLen * Math.cos(angle - Math.PI / 6), ay - arrowLen * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(ax, ay);
                ctx.lineTo(ax - arrowLen * Math.cos(angle + Math.PI / 6), ay - arrowLen * Math.sin(angle + Math.PI / 6));
                ctx.strokeStyle = `rgba(255,255,255,${alpha * 1.5})`;
                ctx.lineWidth = width * 0.8;
                ctx.stroke();
              }
            }
          }}
          linkPointerAreaPaint={(link, color, ctx) => {
            const l = link as GLink & { source: GNode & { x: number; y: number }; target: GNode & { x: number; y: number } };
            if (!l.source?.x || !l.target?.x) return;
            ctx.beginPath();
            ctx.moveTo(l.source.x, l.source.y);
            ctx.lineTo(l.target.x, l.target.y);
            ctx.strokeStyle = color;
            ctx.lineWidth = 8;
            ctx.stroke();
          }}
          onRenderFramePre={(ctx, gScale) => {
            // Draw starfield background
            for (const s of starfield) {
              ctx.beginPath();
              ctx.arc(s.x - 1000, s.y - 1000, s.r / gScale, 0, 2 * Math.PI);
              ctx.fillStyle = `rgba(255,255,255,${s.a * 0.4})`;
              ctx.fill();
            }
          }}
        />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-gray-900/80 backdrop-blur-sm rounded-lg p-3 border border-gray-800 z-10">
          <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">
            Node Types
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(NODE_COLORS)
              .filter(([type]) => graphNodes.some((n) => n.type === type))
              .map(([type, color]) => (
                <div key={type} className="flex items-center gap-1.5 text-[10px] text-gray-300">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }} />
                  {type.replace(/_/g, " ")}
                </div>
              ))}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-800">
            <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Glow = Confidence</div>
            <div className="flex gap-3">
              {["High", "Medium", "Low"].map((c) => (
                <span key={c} className="text-[10px] text-gray-500 flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full bg-blue-400"
                    style={{ opacity: GLOW_ALPHA[c], boxShadow: `0 0 ${GLOW_STRENGTH[c]}px #60a5fa` }}
                  />
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Side panel — Node detail */}
      {selectedNode && (
        <div className="w-[340px] bg-gray-900 border-l border-gray-800 overflow-y-auto p-4 space-y-4 z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-100">{selectedNode.name}</h3>
            <button onClick={() => setSelectedNode(null)} className="text-gray-500 hover:text-gray-300 text-xs">Close</button>
          </div>

          <div className="space-y-3">
            <DetailRow label="Type" value={selectedNode.type.replace(/_/g, " ")} />
            <DetailRow label="ID" value={selectedNode.id} mono />
            <DetailRow label="Confidence" value={selectedNode.confidence} />
            <DetailRow label="Connections" value={String(selectedNode.degree)} />

            {selectedNode.evidenceIds.length > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-gray-500 block mb-1">Evidence</span>
                <div className="flex flex-wrap gap-1">
                  {selectedNode.evidenceIds.map((id) => (
                    <span key={id} className="text-[10px] bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded border border-blue-800/40">
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-gray-500 block mb-1">Metadata</span>
                <pre className="text-[10px] text-gray-400 bg-gray-800/50 rounded p-2 overflow-x-auto">
                  {JSON.stringify(selectedNode.metadata, null, 2)}
                </pre>
              </div>
            )}

            {/* Connections */}
            <div>
              <span className="text-[10px] uppercase tracking-wider text-gray-500 block mb-1">Connections</span>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {graphLinks
                  .filter((l) => {
                    const src = typeof l.source === "string" ? l.source : l.source.id;
                    const tgt = typeof l.target === "string" ? l.target : l.target.id;
                    return src === selectedNode.id || tgt === selectedNode.id;
                  })
                  .map((l, i) => {
                    const src = typeof l.source === "string" ? l.source : l.source.id;
                    const isSource = src === selectedNode.id;
                    const otherId = isSource
                      ? typeof l.target === "string" ? l.target : l.target.id
                      : src;
                    const otherNode = graphNodes.find((n) => n.id === otherId);
                    return (
                      <div key={i} className="text-[11px] text-gray-300 bg-gray-800/50 rounded px-2 py-1">
                        {isSource ? "→" : "←"}{" "}
                        <span className="font-medium">{otherNode?.name ?? otherId}</span>
                        <span className="text-gray-500 ml-1">({l.type.replace(/_/g, " ")})</span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-gray-800 space-y-1">
              <button
                onClick={() => setHighlightMode("Dependencies")}
                className="w-full text-left text-xs text-blue-400 hover:text-blue-300 py-1 px-2 rounded hover:bg-gray-800 transition-colors"
              >
                Highlight dependencies
              </button>
              <button
                onClick={() => setHighlightMode("Auth Path")}
                className="w-full text-left text-xs text-purple-400 hover:text-purple-300 py-1 px-2 rounded hover:bg-gray-800 transition-colors"
              >
                Highlight auth path
              </button>
              <button
                onClick={() => setHighlightMode("Traffic Flow")}
                className="w-full text-left text-xs text-emerald-400 hover:text-emerald-300 py-1 px-2 rounded hover:bg-gray-800 transition-colors"
              >
                Highlight traffic flow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side panel — Edge detail */}
      {selectedEdge && !selectedNode && (
        <div className="w-[340px] bg-gray-900 border-l border-gray-800 overflow-y-auto p-4 space-y-4 z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-100">Edge Detail</h3>
            <button onClick={() => setSelectedEdge(null)} className="text-gray-500 hover:text-gray-300 text-xs">Close</button>
          </div>
          <div className="space-y-3">
            <DetailRow label="Type" value={selectedEdge.type.replace(/_/g, " ")} />
            <DetailRow
              label="From"
              value={
                typeof selectedEdge.source === "string"
                  ? selectedEdge.source
                  : selectedEdge.source.name
              }
            />
            <DetailRow
              label="To"
              value={
                typeof selectedEdge.target === "string"
                  ? selectedEdge.target
                  : selectedEdge.target.name
              }
            />
            <DetailRow label="Confidence" value={selectedEdge.confidence} />
            {selectedEdge.evidenceIds.length > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-gray-500 block mb-1">Evidence</span>
                <div className="flex flex-wrap gap-1">
                  {selectedEdge.evidenceIds.map((id) => (
                    <span key={id} className="text-[10px] bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded border border-blue-800/40">
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selectedEdge.metadata && Object.keys(selectedEdge.metadata).length > 0 && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-gray-500 block mb-1">Metadata</span>
                <pre className="text-[10px] text-gray-400 bg-gray-800/50 rounded p-2 overflow-x-auto">
                  {JSON.stringify(selectedEdge.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
