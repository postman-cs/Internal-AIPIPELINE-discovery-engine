/**
 * Deterministic Risk & Opportunity Scoring Engine
 *
 * No LLM dependency. Pure heuristic computation from topology graph structure.
 * Every score is explainable via its drivers array.
 */

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

export interface RiskDriver {
  type: "Auth" | "ChangeRisk" | "Dependency" | "Friction" | "Governance" | "Observability";
  note: string;
  evidenceIds: string[];
}

export interface NodeScore {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  riskScore: number;    // 0–100
  opportunityScore: number; // 0–100
  drivers: RiskDriver[];
  confidence: "High" | "Medium" | "Low";
}

// ---------------------------------------------------------------------------
// Scoring engine
// ---------------------------------------------------------------------------

export function computeRiskScores(
  nodes: TopoNode[],
  edges: TopoEdge[]
): NodeScore[] {
  // Pre-compute degree maps
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  const authEdges = new Map<string, TopoEdge[]>();
  const allEdgesForNode = new Map<string, TopoEdge[]>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    outDegree.set(n.id, 0);
    authEdges.set(n.id, []);
    allEdgesForNode.set(n.id, []);
  }

  for (const e of edges) {
    outDegree.set(e.from, (outDegree.get(e.from) ?? 0) + 1);
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);

    if (e.type === "AUTHENTICATES_WITH" || e.type === "ROUTES_THROUGH") {
      authEdges.get(e.from)?.push(e);
      authEdges.get(e.to)?.push(e);
    }

    allEdgesForNode.get(e.from)?.push(e);
    allEdgesForNode.get(e.to)?.push(e);
  }

  const totalDegree = (id: string) => (inDegree.get(id) ?? 0) + (outDegree.get(id) ?? 0);
  const avgDegree = nodes.length > 0
    ? nodes.reduce((sum, n) => sum + totalDegree(n.id), 0) / nodes.length
    : 1;
  const highDegreeThreshold = Math.max(avgDegree * 1.5, 3);

  return nodes.map((node) => {
    const drivers: RiskDriver[] = [];
    let riskScore = 0;
    let opportunityScore = 0;

    const nIn = inDegree.get(node.id) ?? 0;
    const nOut = outDegree.get(node.id) ?? 0;
    const degree = nIn + nOut;
    const nodeAuthEdges = authEdges.get(node.id) ?? [];
    const evidenceIds = node.evidenceIds ?? [];

    // ----- RISK DRIVERS -----

    // 1. Auth complexity
    if (nodeAuthEdges.length >= 2) {
      riskScore += 20;
      drivers.push({
        type: "Auth",
        note: `Connected to ${nodeAuthEdges.length} auth/routing edges — complex auth surface`,
        evidenceIds: nodeAuthEdges.flatMap((e) => e.evidenceIds).slice(0, 3),
      });
    } else if (nodeAuthEdges.length === 1) {
      riskScore += 5;
    }

    // 2. High dependency fan-in/out
    if (degree > highDegreeThreshold) {
      const points = Math.min(Math.round((degree / highDegreeThreshold - 1) * 25), 25);
      riskScore += points;
      drivers.push({
        type: "Dependency",
        note: `High connectivity (${degree} connections, avg ${avgDegree.toFixed(1)}) — change propagation risk`,
        evidenceIds: evidenceIds.slice(0, 2),
      });
    }

    // 3. Single point of failure
    if ((node.type === "GATEWAY" || node.type === "LOAD_BALANCER") && nIn >= 3) {
      const redundancy = (node.metadata as Record<string, unknown>)?.redundancy;
      if (!redundancy) {
        riskScore += 20;
        drivers.push({
          type: "ChangeRisk",
          note: `${node.type} with ${nIn} inbound connections and no redundancy metadata — SPOF risk`,
          evidenceIds,
        });
      }
    }

    // 4. Low confidence on critical nodes
    if (node.confidence === "Low" && (node.type === "GATEWAY" || node.type === "DATABASE" || node.type === "IDENTITY_PROVIDER")) {
      riskScore += 15;
      drivers.push({
        type: "Governance",
        note: `Low confidence on critical ${node.type} — needs validation`,
        evidenceIds,
      });
    }

    // 5. Observability gap proxy
    const hasMonitoring = (node.metadata as Record<string, unknown>)?.monitoring;
    if (!hasMonitoring && degree >= 3) {
      riskScore += 10;
      drivers.push({
        type: "Observability",
        note: "No monitoring metadata on a well-connected node",
        evidenceIds: [],
      });
    }

    // ----- OPPORTUNITY DRIVERS -----

    // 1. Reusable API candidate (high fan-out, type API)
    if (node.type === "API" && nOut >= 2) {
      opportunityScore += 25;
      drivers.push({
        type: "Governance",
        note: `API with ${nOut} consumers — candidate for standardization/governance`,
        evidenceIds,
      });
    }

    // 2. Standardization target (API with auth but no governance)
    if (node.type === "API" && nodeAuthEdges.length >= 1) {
      const governance = (node.metadata as Record<string, unknown>)?.governance;
      if (!governance) {
        opportunityScore += 20;
        drivers.push({
          type: "Governance",
          note: "API with auth but no governance metadata — Postman governance opportunity",
          evidenceIds,
        });
      }
    }

    // 3. High-centrality service (good workshop/demo target)
    if (node.type === "SERVICE" && degree >= highDegreeThreshold) {
      opportunityScore += 15;
      drivers.push({
        type: "Friction",
        note: `High-centrality service — good candidate for Postman workspace demo`,
        evidenceIds,
      });
    }

    // 4. Gateway consolidation opportunity
    if (node.type === "GATEWAY" && nIn >= 4) {
      opportunityScore += 15;
      drivers.push({
        type: "Governance",
        note: `Gateway handling ${nIn} routes — consolidation/contract-first opportunity`,
        evidenceIds,
      });
    }

    // Clamp scores
    riskScore = Math.min(riskScore, 100);
    opportunityScore = Math.min(opportunityScore, 100);

    // Confidence mapping
    const confidence: "High" | "Medium" | "Low" =
      node.confidence === "High" ? "High" :
      node.confidence === "Medium" ? "Medium" : "Low";

    return {
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      riskScore,
      opportunityScore,
      drivers,
      confidence,
    };
  });
}

// ---------------------------------------------------------------------------
// Summary helpers
// ---------------------------------------------------------------------------

export function heatmapToMarkdown(scores: NodeScore[]): string {
  const sorted = [...scores].sort((a, b) => b.riskScore - a.riskScore);
  const rows = sorted
    .map((s) => `| ${s.nodeName} | ${s.nodeType} | ${s.riskScore} | ${s.opportunityScore} | ${s.confidence} |`)
    .join("\n");

  return `# Topology Risk Heatmap

| Node | Type | Risk | Opportunity | Confidence |
|------|------|------|-------------|------------|
${rows}

## Top Risks
${sorted.slice(0, 3).map((s, i) => `${i + 1}. **${s.nodeName}** (Risk: ${s.riskScore}) — ${s.drivers.map((d) => d.note).join("; ")}`).join("\n")}
`;
}
