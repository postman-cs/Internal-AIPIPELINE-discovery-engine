/**
 * Tests for the JSON Patch engine.
 * Covers: generatePatch, applyPatch, generateDiffSummary
 */

import { describe, it, expect } from "vitest";
import { generatePatch, applyPatch, generateDiffSummary } from "@/lib/cascade/patch";

describe("generatePatch", () => {
  it("returns empty array for identical objects", () => {
    const obj = { a: 1, b: "hello" };
    expect(generatePatch(obj, obj)).toEqual([]);
  });

  it("detects added keys", () => {
    const base = { a: 1 };
    const proposed = { a: 1, b: 2 };
    const ops = generatePatch(base, proposed);
    expect(ops).toHaveLength(1);
    expect(ops[0].op).toBe("add");
    expect(ops[0].path).toBe("/b");
    expect(ops[0].value).toBe(2);
  });

  it("detects removed keys", () => {
    const base = { a: 1, b: 2 };
    const proposed = { a: 1 };
    const ops = generatePatch(base, proposed);
    expect(ops).toHaveLength(1);
    expect(ops[0].op).toBe("remove");
    expect(ops[0].path).toBe("/b");
  });

  it("detects replaced values", () => {
    const base = { a: 1, b: "old" };
    const proposed = { a: 1, b: "new" };
    const ops = generatePatch(base, proposed);
    expect(ops).toHaveLength(1);
    expect(ops[0].op).toBe("replace");
    expect(ops[0].path).toBe("/b");
    expect(ops[0].value).toBe("new");
    expect(ops[0].oldValue).toBe("old");
  });

  it("handles nested objects", () => {
    const base = { a: { b: { c: 1 } } };
    const proposed = { a: { b: { c: 2 } } };
    const ops = generatePatch(base, proposed);
    expect(ops).toHaveLength(1);
    expect(ops[0].path).toBe("/a/b/c");
  });

  it("handles array additions", () => {
    const base = { items: [1, 2] };
    const proposed = { items: [1, 2, 3] };
    const ops = generatePatch(base, proposed);
    expect(ops.some((o) => o.op === "add")).toBe(true);
  });

  it("handles array removals", () => {
    const base = { items: [1, 2, 3] };
    const proposed = { items: [1, 2] };
    const ops = generatePatch(base, proposed);
    expect(ops.some((o) => o.op === "remove")).toBe(true);
  });

  it("handles null to value transition", () => {
    const ops = generatePatch(null, { a: 1 });
    expect(ops).toHaveLength(1);
    expect(ops[0].op).toBe("add");
  });

  it("handles value to null transition", () => {
    const ops = generatePatch({ a: 1 }, null);
    expect(ops).toHaveLength(1);
    expect(ops[0].op).toBe("remove");
  });
});

describe("applyPatch", () => {
  it("applies add operations", () => {
    const base = { a: 1 };
    const ops = [{ op: "add" as const, path: "/b", value: 2 }];
    const result = applyPatch(base, ops);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("applies remove operations", () => {
    const base = { a: 1, b: 2 };
    const ops = [{ op: "remove" as const, path: "/b" }];
    const result = applyPatch(base, ops);
    expect(result).toEqual({ a: 1 });
  });

  it("applies replace operations", () => {
    const base = { a: 1, b: "old" };
    const ops = [{ op: "replace" as const, path: "/b", value: "new" }];
    const result = applyPatch(base, ops);
    expect(result).toEqual({ a: 1, b: "new" });
  });

  it("round-trips: base + patch = proposed", () => {
    const base = {
      name: "test",
      signals: [{ type: "Auth", value: "SSO" }],
      maturity: { level: 1, gaps: ["governance"] },
    };
    const proposed = {
      name: "test-updated",
      signals: [{ type: "Auth", value: "OAuth2" }, { type: "CDN", value: "CloudFront" }],
      maturity: { level: 2, gaps: [] },
    };
    const ops = generatePatch(base, proposed);
    const result = applyPatch(base, ops);
    expect(result).toEqual(proposed);
  });

  it("handles nested patches correctly", () => {
    const base = { a: { b: { c: 1, d: 2 } } };
    const proposed = { a: { b: { c: 3, d: 2, e: 4 } } };
    const ops = generatePatch(base, proposed);
    const result = applyPatch(base, ops);
    expect(result).toEqual(proposed);
  });
});

describe("generateDiffSummary", () => {
  it("returns 'No changes' for empty ops", () => {
    expect(generateDiffSummary([])).toBe("No changes detected.");
  });

  it("groups changes by top-level field", () => {
    const ops = [
      { op: "replace" as const, path: "/name", value: "new", oldValue: "old" },
      { op: "add" as const, path: "/signals/-", value: "test" },
    ];
    const summary = generateDiffSummary(ops);
    expect(summary).toContain("Name");
    expect(summary).toContain("Signals");
  });

  it("shows add/remove/replace counts", () => {
    const ops = generatePatch(
      { a: 1, b: 2, c: 3 },
      { a: 10, b: 2, d: 4 }
    );
    const summary = generateDiffSummary(ops);
    expect(summary).toContain("updated");
    expect(summary).toContain("added");
    expect(summary).toContain("removed");
  });
});
