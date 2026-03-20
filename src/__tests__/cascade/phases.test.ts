import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { getTopologicalTiers, getDependencies, PHASE_GRAPH } from "@/lib/cascade/phases";
import { Phase } from "@prisma/client";

describe("Cascade phases", () => {
  it("topological tiers have valid dependency order", () => {
    const tiers = getTopologicalTiers();
    const phaseTier: Record<string, number> = {};
    tiers.forEach((phases, tierIdx) => {
      for (const p of phases) phaseTier[p] = tierIdx;
    });
    for (const node of PHASE_GRAPH) {
      for (const dep of node.dependencies) {
        expect(phaseTier[dep]).toBeLessThan(phaseTier[node.phase]);
      }
    }
  });

  it("all phases appear in exactly one tier", () => {
    const tiers = getTopologicalTiers();
    const allPhases = Array.from(tiers.values()).flat();
    const phaseValues = Object.values(Phase);
    expect(allPhases.sort()).toEqual(phaseValues.sort());
  });

  it("getDependencies returns consistent results (property-based)", () => {
    const phases = Object.values(Phase);
    fc.assert(fc.property(
      fc.constantFrom(...phases),
      (phase) => {
        const deps1 = getDependencies(phase);
        const deps2 = getDependencies(phase);
        expect(deps1).toEqual(deps2);
      }
    ));
  });
});
