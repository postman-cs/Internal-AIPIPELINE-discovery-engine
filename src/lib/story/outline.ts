/**
 * Deterministic Story Outline Generator
 *
 * Builds a structured narrative walkthrough from topology data + risk scores.
 * No LLM dependency — pure template-driven logic.
 */

import {
  type TopoNode,
  type TopoEdge,
  type NodeScore,
  computeRiskScores,
} from "@/lib/topology/riskScoring";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StoryBeat {
  id: string;
  headline: string;
  objective: string;
  highlight: { nodeIds: string[]; edgeIds: string[] };
  speakerNotes: string;
  evidenceIds: string[];
}

export interface StoryOutline {
  title: string;
  beats: StoryBeat[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function edgeId(e: TopoEdge): string {
  return `${e.from}->${e.to}`;
}

function confidenceSummary(nodes: TopoNode[]): string {
  const high = nodes.filter((n) => n.confidence === "High").length;
  const med = nodes.filter((n) => n.confidence === "Medium").length;
  const low = nodes.filter((n) => n.confidence === "Low").length;
  return `${high} high, ${med} medium, ${low} low confidence`;
}

function typeSummary(nodes: TopoNode[]): string {
  const counts = new Map<string, number>();
  for (const n of nodes) {
    counts.set(n.type, (counts.get(n.type) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => `${c} ${t.toLowerCase().replace(/_/g, " ")}${c > 1 ? "s" : ""}`)
    .join(", ");
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export function generateOutline(
  nodes: TopoNode[],
  edges: TopoEdge[],
  scores?: NodeScore[]
): StoryOutline {
  const riskScores = scores ?? computeRiskScores(nodes, edges);

  const authEdges = edges.filter(
    (e) => e.type === "AUTHENTICATES_WITH" || e.type === "ROUTES_THROUGH"
  );
  const authNodeIds = new Set<string>();
  for (const e of authEdges) {
    authNodeIds.add(e.from);
    authNodeIds.add(e.to);
  }

  const topRisks = [...riskScores].sort((a, b) => b.riskScore - a.riskScore).slice(0, 3);
  const topOpps = [...riskScores].sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 3);
  const lowConfNodes = nodes.filter((n) => n.confidence === "Low");

  const beats: StoryBeat[] = [];

  // Beat 1 — What we mapped
  beats.push({
    id: "beat-1-scope",
    headline: "What we mapped",
    objective: "Establish the scope and confidence of the topology we discovered.",
    highlight: {
      nodeIds: nodes.map((n) => n.id),
      edgeIds: [],
    },
    speakerNotes: `We mapped ${nodes.length} components (${typeSummary(nodes)}) connected by ${edges.length} relationships. Confidence breakdown: ${confidenceSummary(nodes)}.`,
    evidenceIds: nodes.flatMap((n) => n.evidenceIds).slice(0, 5),
  });

  // Beat 2 — How traffic/auth flows
  beats.push({
    id: "beat-2-auth-flow",
    headline: "How traffic and auth flow",
    objective: "Highlight the authentication and routing topology.",
    highlight: {
      nodeIds: Array.from(authNodeIds),
      edgeIds: authEdges.map(edgeId),
    },
    speakerNotes: authEdges.length > 0
      ? `There are ${authEdges.length} auth/routing paths involving ${authNodeIds.size} components. ${authNodeIds.size > 3 ? "The auth surface is broad, which may indicate complexity." : "The auth topology is relatively contained."}`
      : "No explicit auth/routing edges were mapped. This is either a gap in our evidence or a very simple auth story.",
    evidenceIds: authEdges.flatMap((e) => e.evidenceIds).slice(0, 5),
  });

  // Beat 3 — Top risks
  beats.push({
    id: "beat-3-risks",
    headline: "Top risks we identified",
    objective: "Walk through the highest-risk components and why they matter.",
    highlight: {
      nodeIds: topRisks.map((r) => r.nodeId),
      edgeIds: [],
    },
    speakerNotes: topRisks.length > 0
      ? topRisks
          .map((r, i) => `${i + 1}. ${r.nodeName} (risk ${r.riskScore}/100): ${r.drivers.map((d) => d.note).join("; ")}`)
          .join("\n")
      : "No significant risks identified from the current topology.",
    evidenceIds: topRisks.flatMap((r) => r.drivers.flatMap((d) => d.evidenceIds)).slice(0, 5),
  });

  // Beat 4 — Top opportunities
  beats.push({
    id: "beat-4-opportunities",
    headline: "Top opportunities",
    objective: "Highlight where Postman can add the most value.",
    highlight: {
      nodeIds: topOpps.map((o) => o.nodeId),
      edgeIds: [],
    },
    speakerNotes: topOpps.length > 0
      ? topOpps
          .map((o, i) => `${i + 1}. ${o.nodeName} (opportunity ${o.opportunityScore}/100): ${o.drivers.map((d) => d.note).join("; ")}`)
          .join("\n")
      : "Opportunity scoring is neutral across the topology.",
    evidenceIds: topOpps.flatMap((o) => o.drivers.flatMap((d) => d.evidenceIds)).slice(0, 5),
  });

  // Beat 5 — Recommended next move
  const topOpp = topOpps[0];
  const topRisk = topRisks[0];
  beats.push({
    id: "beat-5-next-move",
    headline: "Recommended next move",
    objective: "Propose a concrete first engagement step.",
    highlight: {
      nodeIds: [topOpp?.nodeId, topRisk?.nodeId].filter(Boolean) as string[],
      edgeIds: [],
    },
    speakerNotes: topOpp
      ? `Quick win: Focus on ${topOpp.nodeName} (${topOpp.nodeType}) — high opportunity score (${topOpp.opportunityScore}). ${topRisk ? `Risk mitigation: Address ${topRisk.nodeName} (risk ${topRisk.riskScore}) as a secondary priority.` : ""} Recommended: Schedule a design workshop to validate topology and explore contract-first approach.`
      : "Recommend scheduling a collaborative topology review session to fill in gaps.",
    evidenceIds: [...(topOpp?.drivers.flatMap((d) => d.evidenceIds) ?? []), ...(topRisk?.drivers.flatMap((d) => d.evidenceIds) ?? [])].slice(0, 5),
  });

  // Beat 6 — What we need to confirm
  beats.push({
    id: "beat-6-confirmation",
    headline: "What we need to confirm",
    objective: "Acknowledge gaps and formulate questions for the customer.",
    highlight: {
      nodeIds: lowConfNodes.map((n) => n.id),
      edgeIds: [],
    },
    speakerNotes: lowConfNodes.length > 0
      ? `${lowConfNodes.length} component${lowConfNodes.length > 1 ? "s have" : " has"} low confidence: ${lowConfNodes.map((n) => n.name).join(", ")}. Questions to ask: Are these components still active? What is their auth model? Are there additional dependencies we haven't captured?`
      : "All components are medium or high confidence. Validate with the customer that no major systems are missing.",
    evidenceIds: lowConfNodes.flatMap((n) => n.evidenceIds).slice(0, 5),
  });

  return {
    title: `Topology Walkthrough — ${nodes.length} Components, ${edges.length} Connections`,
    beats,
  };
}
