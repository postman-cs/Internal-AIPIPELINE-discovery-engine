/**
 * Canonical Phase Graph (DAG)
 *
 * Defines the ordered phases of the CSE workflow and their dependencies.
 * This is the backbone of the cascade update system — when an upstream
 * phase changes, all downstream phases become DIRTY.
 *
 * The graph is a strict DAG (no cycles). Each phase depends on the phases
 * listed in its `dependencies` array. Evidence (via EvidenceSnapshot) is
 * an implicit input to every phase.
 */

import { Phase } from "@prisma/client";

// Re-export for convenience
export { Phase };

// ---------------------------------------------------------------------------
// Phase metadata
// ---------------------------------------------------------------------------

export interface PhaseNode {
  phase: Phase;
  label: string;
  shortLabel: string;
  description: string;
  dependencies: Phase[]; // upstream phases this phase reads from
  implemented: boolean;  // whether the recompute logic exists today
  order: number;         // topological sort position (0-indexed)
}

/**
 * The canonical phase graph. Ordered topologically.
 * Discovery has no phase dependencies (only evidence).
 * Each subsequent phase depends on the phases that feed into it.
 */
export const PHASE_GRAPH: readonly PhaseNode[] = [
  {
    phase: "DISCOVERY",
    label: "Discovery",
    shortLabel: "DIS",
    description: "Evidence-backed reconnaissance, signals, maturity, and engagement hypothesis",
    dependencies: [],
    implemented: true,
    order: 0,
  },
  {
    phase: "CURRENT_TOPOLOGY",
    label: "Current Topology",
    shortLabel: "CUR",
    description: "Map of the customer's existing API architecture and integrations",
    dependencies: ["DISCOVERY"],
    implemented: true,
    order: 1,
  },
  {
    phase: "DESIRED_FUTURE_STATE",
    label: "Desired Future State",
    shortLabel: "DFS",
    description: "Target architecture after Postman adoption",
    dependencies: ["DISCOVERY", "CURRENT_TOPOLOGY"],
    implemented: true,
    order: 2,
  },
  {
    phase: "SOLUTION_DESIGN",
    label: "Solution Design",
    shortLabel: "SOL",
    description: "Detailed technical plan to move from current to desired state",
    dependencies: ["CURRENT_TOPOLOGY", "DESIRED_FUTURE_STATE"],
    implemented: true,
    order: 3,
  },
  {
    phase: "INFRASTRUCTURE",
    label: "Infrastructure",
    shortLabel: "INF",
    description: "Cloud provisioning and IaC generation for API infrastructure",
    dependencies: ["SOLUTION_DESIGN", "CURRENT_TOPOLOGY"],
    implemented: true,
    order: 4,
  },
  {
    phase: "TEST_DESIGN",
    label: "Test Design",
    shortLabel: "TST",
    description: "Test strategy and acceptance criteria for the solution",
    dependencies: ["SOLUTION_DESIGN"],
    implemented: true,
    order: 5,
  },
  {
    phase: "CRAFT_SOLUTION",
    label: "Craft Solution",
    shortLabel: "CRA",
    description: "Build the actual Postman collections, environments, and workflows",
    dependencies: ["SOLUTION_DESIGN", "TEST_DESIGN", "INFRASTRUCTURE"],
    implemented: true,
    order: 6,
  },
  {
    phase: "TEST_SOLUTION",
    label: "Test Solution",
    shortLabel: "RUN",
    description: "Execute tests against the crafted solution",
    dependencies: ["CRAFT_SOLUTION", "TEST_DESIGN"],
    implemented: true,
    order: 7,
  },
  {
    phase: "DEPLOYMENT_PLAN",
    label: "Deployment Plan",
    shortLabel: "DEP",
    description: "Rollout plan including change management and training",
    dependencies: ["TEST_SOLUTION"],
    implemented: true,
    order: 8,
  },
  {
    phase: "MONITORING",
    label: "Monitoring",
    shortLabel: "MON",
    description: "Ongoing health checks, sentiment tracking, and renewal signals",
    dependencies: ["DEPLOYMENT_PLAN"],
    implemented: true,
    order: 9,
  },
  {
    phase: "ITERATION",
    label: "Iteration",
    shortLabel: "ITR",
    description: "Continuous improvement based on monitoring insights",
    dependencies: ["MONITORING", "DISCOVERY"],
    implemented: true,
    order: 10,
  },
] as const;

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

const PHASE_MAP = new Map<Phase, PhaseNode>(
  PHASE_GRAPH.map((node) => [node.phase, node])
);

/** Get metadata for a single phase */
export function getPhaseNode(phase: Phase): PhaseNode {
  const node = PHASE_MAP.get(phase);
  if (!node) throw new Error(`Unknown phase: ${phase}`);
  return node;
}

/** Get all direct dependencies (upstream) for a phase */
export function getDependencies(phase: Phase): Phase[] {
  return getPhaseNode(phase).dependencies;
}

/**
 * Get all downstream phases (transitive) that depend on the given phase.
 * If Discovery changes, this returns everything downstream of Discovery.
 */
export function getDownstream(phase: Phase): Phase[] {
  const downstream: Phase[] = [];
  const visited = new Set<Phase>();

  function walk(p: Phase) {
    for (const node of PHASE_GRAPH) {
      if (node.dependencies.includes(p) && !visited.has(node.phase)) {
        visited.add(node.phase);
        downstream.push(node.phase);
        walk(node.phase); // continue transitively
      }
    }
  }

  walk(phase);
  return downstream.sort(
    (a, b) => getPhaseNode(a).order - getPhaseNode(b).order
  );
}

/**
 * Get all phases in topological order.
 */
export function getAllPhasesOrdered(): Phase[] {
  return PHASE_GRAPH.map((n) => n.phase);
}

/**
 * Check if phase A is upstream of phase B (directly or transitively).
 */
export function isUpstreamOf(a: Phase, b: Phase): boolean {
  const deps = getDependencies(b);
  if (deps.includes(a)) return true;
  return deps.some((dep) => isUpstreamOf(a, dep));
}
