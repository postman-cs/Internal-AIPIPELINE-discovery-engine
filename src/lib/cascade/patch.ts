/**
 * JSON Patch Engine
 *
 * Deterministic server-side diff between two JSON objects.
 * Produces RFC6902-style patch operations and human-readable summaries.
 * No LLM dependency — pure structural comparison.
 */

// ---------------------------------------------------------------------------
// Patch operation types (RFC6902-inspired)
// ---------------------------------------------------------------------------

export interface PatchOp {
  op: "add" | "remove" | "replace";
  path: string;   // JSON Pointer path (e.g. "/signals/0/finding")
  value?: unknown; // new value (for add/replace)
  oldValue?: unknown; // previous value (for replace — extra, not in RFC6902)
}

// ---------------------------------------------------------------------------
// Diff engine
// ---------------------------------------------------------------------------

/**
 * Generate a list of patch operations to transform `base` into `proposed`.
 * Deep recursive comparison with JSON Pointer paths.
 */
export function generatePatch(
  base: unknown,
  proposed: unknown,
  path: string = ""
): PatchOp[] {
  const ops: PatchOp[] = [];

  // Both null/undefined
  if (base === proposed) return ops;

  // Type mismatch or one is null
  if (
    base === null ||
    base === undefined ||
    proposed === null ||
    proposed === undefined ||
    typeof base !== typeof proposed
  ) {
    if (base === null || base === undefined) {
      ops.push({ op: "add", path: path || "/", value: proposed });
    } else if (proposed === null || proposed === undefined) {
      ops.push({ op: "remove", path: path || "/", oldValue: base });
    } else {
      ops.push({ op: "replace", path: path || "/", value: proposed, oldValue: base });
    }
    return ops;
  }

  // Primitives (string, number, boolean)
  if (typeof base !== "object") {
    if (base !== proposed) {
      ops.push({ op: "replace", path: path || "/", value: proposed, oldValue: base });
    }
    return ops;
  }

  // Arrays
  if (Array.isArray(base) && Array.isArray(proposed)) {
    return diffArrays(base, proposed, path);
  }

  // Objects
  if (
    typeof base === "object" &&
    typeof proposed === "object" &&
    !Array.isArray(base) &&
    !Array.isArray(proposed)
  ) {
    const baseObj = base as Record<string, unknown>;
    const propObj = proposed as Record<string, unknown>;

    // Removed keys
    for (const key of Object.keys(baseObj)) {
      if (!(key in propObj)) {
        ops.push({
          op: "remove",
          path: `${path}/${escapeJsonPointer(key)}`,
          oldValue: baseObj[key],
        });
      }
    }

    // Added or changed keys
    for (const key of Object.keys(propObj)) {
      const childPath = `${path}/${escapeJsonPointer(key)}`;
      if (!(key in baseObj)) {
        ops.push({
          op: "add",
          path: childPath,
          value: propObj[key],
        });
      } else {
        ops.push(...generatePatch(baseObj[key], propObj[key], childPath));
      }
    }

    return ops;
  }

  // Fallback
  if (base !== proposed) {
    ops.push({ op: "replace", path: path || "/", value: proposed, oldValue: base });
  }

  return ops;
}

/**
 * Diff two arrays. Uses index-based comparison.
 * For arrays of objects with identifying keys, a smarter match could be added later.
 */
function diffArrays(
  base: unknown[],
  proposed: unknown[],
  path: string
): PatchOp[] {
  const ops: PatchOp[] = [];
  const maxLen = Math.max(base.length, proposed.length);

  for (let i = 0; i < maxLen; i++) {
    const itemPath = `${path}/${i}`;
    if (i >= base.length) {
      ops.push({ op: "add", path: `${path}/-`, value: proposed[i] });
    } else if (i >= proposed.length) {
      ops.push({ op: "remove", path: itemPath, oldValue: base[i] });
    } else {
      ops.push(...generatePatch(base[i], proposed[i], itemPath));
    }
  }

  return ops;
}

/**
 * Escape special characters in JSON Pointer segments (RFC6901).
 */
function escapeJsonPointer(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

// ---------------------------------------------------------------------------
// Apply patch to base (for verification)
// ---------------------------------------------------------------------------

/**
 * Apply a patch to a base object to produce the proposed object.
 * Used to verify that base + patch = proposed.
 */
export function applyPatch(
  base: unknown,
  ops: PatchOp[]
): unknown {
  let result = structuredClone(base);

  for (const op of ops) {
    result = applyOp(result, op);
  }

  return result;
}

function applyOp(obj: unknown, op: PatchOp): unknown {
  const segments = parsePointer(op.path);

  if (segments.length === 0 || (segments.length === 1 && segments[0] === "")) {
    // Root-level operation
    if (op.op === "replace" || op.op === "add") return op.value;
    if (op.op === "remove") return undefined;
    return obj;
  }

  const result = structuredClone(obj) as Record<string, unknown>;
  let current: unknown = result;

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (Array.isArray(current)) {
      current = current[parseInt(seg, 10)];
    } else if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[seg];
    }
  }

  const lastSeg = segments[segments.length - 1];

  if (Array.isArray(current)) {
    if (lastSeg === "-") {
      if (op.op === "add") current.push(op.value);
    } else {
      const idx = parseInt(lastSeg, 10);
      if (op.op === "add") current.splice(idx, 0, op.value);
      else if (op.op === "remove") current.splice(idx, 1);
      else if (op.op === "replace") current[idx] = op.value;
    }
  } else if (current && typeof current === "object") {
    const obj = current as Record<string, unknown>;
    if (op.op === "add" || op.op === "replace") obj[lastSeg] = op.value;
    else if (op.op === "remove") delete obj[lastSeg];
  }

  return result;
}

function parsePointer(pointer: string): string[] {
  if (!pointer || pointer === "/") return [""];
  return pointer
    .split("/")
    .slice(1) // remove leading empty string from leading /
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
}

// ---------------------------------------------------------------------------
// Human-readable diff summary
// ---------------------------------------------------------------------------

/**
 * Generate a concise human-readable summary of patch operations.
 * Groups by top-level field and summarizes changes.
 */
export function generateDiffSummary(ops: PatchOp[]): string {
  if (ops.length === 0) return "No changes detected.";

  const lines: string[] = [];
  const byTopField = new Map<string, PatchOp[]>();

  for (const op of ops) {
    const segments = parsePointer(op.path);
    const topField = segments[0] || "(root)";
    if (!byTopField.has(topField)) byTopField.set(topField, []);
    byTopField.get(topField)!.push(op);
  }

  for (const [field, fieldOps] of byTopField) {
    const adds = fieldOps.filter((o) => o.op === "add").length;
    const removes = fieldOps.filter((o) => o.op === "remove").length;
    const replaces = fieldOps.filter((o) => o.op === "replace").length;

    const parts: string[] = [];
    if (replaces > 0) parts.push(`${replaces} updated`);
    if (adds > 0) parts.push(`${adds} added`);
    if (removes > 0) parts.push(`${removes} removed`);

    lines.push(`**${formatFieldName(field)}**: ${parts.join(", ")}`);

    // Show specific changes for replace ops on leaf values
    for (const op of fieldOps) {
      if (op.op === "replace" && isPrimitive(op.value) && isPrimitive(op.oldValue)) {
        const shortPath = parsePointer(op.path).slice(1).join(" > ") || field;
        lines.push(
          `  - ${shortPath}: \`${truncate(String(op.oldValue), 60)}\` → \`${truncate(String(op.value), 60)}\``
        );
      }
    }
  }

  return lines.join("\n");
}

function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function isPrimitive(v: unknown): v is string | number | boolean {
  return typeof v === "string" || typeof v === "number" || typeof v === "boolean";
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "..." : s;
}
