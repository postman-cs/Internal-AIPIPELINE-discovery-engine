import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { generatePatch, applyPatch, generateDiffSummary } from "@/lib/cascade/patch";

const jsonPrimitive = fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null));
const jsonValue: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  prim: jsonPrimitive,
  arr: fc.array(tie("value"), { maxLength: 4 }),
  obj: fc.dictionary(fc.string({ maxLength: 8 }), tie("value"), { maxKeys: 4 }),
  value: fc.oneof(tie("prim"), tie("arr"), tie("obj")),
})).value;

describe("generatePatch property-based", () => {
  it("identical objects produce empty patch", () => {
    fc.assert(fc.property(jsonValue, (obj) => {
      const cloned = JSON.parse(JSON.stringify(obj));
      expect(generatePatch(cloned, cloned)).toEqual([]);
    }));
  });

  it("patch is deterministic", () => {
    fc.assert(fc.property(jsonValue, jsonValue, (a, b) => {
      const patch1 = generatePatch(a, b);
      const patch2 = generatePatch(a, b);
      expect(patch1).toEqual(patch2);
    }));
  });

  it("round-trip: base + patch = proposed for flat objects", () => {
    const flatObj = fc.dictionary(fc.string({ maxLength: 8 }), jsonPrimitive, { maxKeys: 6 });
    fc.assert(fc.property(flatObj, flatObj, (base, proposed) => {
      const ops = generatePatch(base, proposed);
      const result = applyPatch(base, ops);
      expect(result).toEqual(proposed);
    }));
  });
});

describe("generateDiffSummary property-based", () => {
  it("empty patch produces 'No changes' message", () => {
    expect(generateDiffSummary([])).toBe("No changes detected.");
  });

  it("summary is a non-empty string for any non-empty patch", () => {
    const flatObj = fc.dictionary(fc.string({ minLength: 1, maxLength: 8 }), jsonPrimitive, { minKeys: 1, maxKeys: 4 });
    fc.assert(fc.property(flatObj, flatObj, (a, b) => {
      const ops = generatePatch(a, b);
      if (ops.length > 0) {
        const summary = generateDiffSummary(ops);
        expect(summary.length).toBeGreaterThan(0);
        expect(summary).not.toBe("No changes detected.");
      }
    }));
  });
});
