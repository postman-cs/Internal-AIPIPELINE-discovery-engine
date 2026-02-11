/**
 * Tests for cascade phase graph and status transitions.
 * Tests the DAG structure and helper functions (no DB needed).
 */

import { describe, it, expect } from "vitest";
import {
  PHASE_GRAPH,
  getPhaseNode,
  getDependencies,
  getDownstream,
  getAllPhasesOrdered,
  isUpstreamOf,
} from "@/lib/cascade/phases";

describe("PHASE_GRAPH structure", () => {
  it("has 10 phases", () => {
    expect(PHASE_GRAPH).toHaveLength(10);
  });

  it("all phases have unique names", () => {
    const names = PHASE_GRAPH.map((p) => p.phase);
    expect(new Set(names).size).toBe(10);
  });

  it("all phases are marked as implemented", () => {
    for (const node of PHASE_GRAPH) {
      expect(node.implemented).toBe(true);
    }
  });

  it("phases are in topological order", () => {
    for (let i = 0; i < PHASE_GRAPH.length; i++) {
      expect(PHASE_GRAPH[i].order).toBe(i);
    }
  });

  it("DISCOVERY has no dependencies", () => {
    expect(getDependencies("DISCOVERY")).toEqual([]);
  });

  it("ITERATION depends on MONITORING and DISCOVERY", () => {
    const deps = getDependencies("ITERATION");
    expect(deps).toContain("MONITORING");
    expect(deps).toContain("DISCOVERY");
  });
});

describe("getPhaseNode", () => {
  it("returns correct node for DISCOVERY", () => {
    const node = getPhaseNode("DISCOVERY");
    expect(node.label).toBe("Discovery");
    expect(node.shortLabel).toBe("DIS");
    expect(node.order).toBe(0);
  });

  it("throws for unknown phase", () => {
    expect(() => getPhaseNode("NONEXISTENT" as never)).toThrow();
  });
});

describe("getDownstream", () => {
  it("DISCOVERY affects all downstream phases", () => {
    const downstream = getDownstream("DISCOVERY");
    expect(downstream.length).toBe(9); // All 9 other phases
    expect(downstream).toContain("CURRENT_TOPOLOGY");
    expect(downstream).toContain("ITERATION");
  });

  it("MONITORING only affects ITERATION", () => {
    const downstream = getDownstream("MONITORING");
    expect(downstream).toContain("ITERATION");
    expect(downstream).toHaveLength(1);
  });

  it("ITERATION has no downstream phases", () => {
    const downstream = getDownstream("ITERATION");
    expect(downstream).toHaveLength(0);
  });

  it("results are in topological order", () => {
    const downstream = getDownstream("SOLUTION_DESIGN");
    const orders = downstream.map((p) => getPhaseNode(p).order);
    for (let i = 1; i < orders.length; i++) {
      expect(orders[i]).toBeGreaterThanOrEqual(orders[i - 1]);
    }
  });
});

describe("getAllPhasesOrdered", () => {
  it("returns all 10 phases", () => {
    expect(getAllPhasesOrdered()).toHaveLength(10);
  });

  it("starts with DISCOVERY and ends with ITERATION", () => {
    const ordered = getAllPhasesOrdered();
    expect(ordered[0]).toBe("DISCOVERY");
    expect(ordered[9]).toBe("ITERATION");
  });
});

describe("isUpstreamOf", () => {
  it("DISCOVERY is upstream of everything", () => {
    expect(isUpstreamOf("DISCOVERY", "CURRENT_TOPOLOGY")).toBe(true);
    expect(isUpstreamOf("DISCOVERY", "ITERATION")).toBe(true);
  });

  it("ITERATION is upstream of nothing", () => {
    for (const phase of getAllPhasesOrdered().slice(0, -1)) {
      expect(isUpstreamOf("ITERATION", phase)).toBe(false);
    }
  });

  it("CURRENT_TOPOLOGY is upstream of SOLUTION_DESIGN (transitive)", () => {
    expect(isUpstreamOf("CURRENT_TOPOLOGY", "SOLUTION_DESIGN")).toBe(true);
  });

  it("MONITORING is not upstream of DISCOVERY", () => {
    expect(isUpstreamOf("MONITORING", "DISCOVERY")).toBe(false);
  });
});

describe("cascade status transitions", () => {
  // These test the logical rules — actual DB tests would be integration tests

  it("accepting DISCOVERY should dirty 9 downstream phases", () => {
    const downstream = getDownstream("DISCOVERY");
    expect(downstream.length).toBe(9);
  });

  it("accepting CURRENT_TOPOLOGY dirties correct phases", () => {
    const downstream = getDownstream("CURRENT_TOPOLOGY");
    expect(downstream).toContain("DESIRED_FUTURE_STATE");
    expect(downstream).toContain("SOLUTION_DESIGN");
    expect(downstream).not.toContain("DISCOVERY"); // Not upstream
  });

  it("accepting SOLUTION_DESIGN dirties TEST_DESIGN and downstream", () => {
    const downstream = getDownstream("SOLUTION_DESIGN");
    expect(downstream).toContain("TEST_DESIGN");
    expect(downstream).toContain("CRAFT_SOLUTION");
    expect(downstream).toContain("TEST_SOLUTION");
    expect(downstream).toContain("DEPLOYMENT_PLAN");
    expect(downstream).not.toContain("CURRENT_TOPOLOGY");
  });

  it("accepting DEPLOYMENT_PLAN dirties MONITORING", () => {
    const downstream = getDownstream("DEPLOYMENT_PLAN");
    expect(downstream).toContain("MONITORING");
    expect(downstream).toContain("ITERATION");
  });
});
