/**
 * Shared agent runner: wraps every agent call with:
 * - Intelligent model selection (OpenAI or Anthropic, best for the task)
 * - Automatic fallback on provider failure
 * - AIRun audit logging
 * - Prompt hashing
 * - Duration tracking
 * - Zod output validation
 * - Token usage capture
 * - Human assumption verification: injects verified constraints,
 *   extracts assumptions from output
 */

import { prisma } from "@/lib/prisma";
import { hashPrompt } from "@/lib/ai/openai";
import { selectModel, completeWithFallback } from "@/lib/ai/model-router";
import type { ModelSpec } from "@/lib/ai/model-router";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { buildConstraintPromptBlock } from "@/lib/assumptions/engine";
import type { AssumptionItem, BlockerDetection } from "./topologyTypes";

interface AgentRunConfig<T> {
  agentType: string;
  projectId: string;
  systemPrompt: string;
  userPrompt: string;
  outputSchema: z.ZodType<T, z.ZodTypeDef, unknown>;
  /** Optional JSON schema for structured output mode */
  jsonSchema?: Record<string, unknown>;
  /** If true, skip injecting assumption constraints (for lightweight agents) */
  skipAssumptionInjection?: boolean;
  /** If true, skip the assumption/blocker extraction prompt (for re-runs of already-clean phases) */
  skipAssumptionExtraction?: boolean;
  /** Force a specific model (overrides routing) */
  forceModel?: string;
}

interface AgentRunResult<T> {
  output: T;
  aiRunId: string;
  tokenUsage: { prompt: number; completion: number; total: number };
  durationMs: number;
  /** Which model was actually used */
  modelUsed: string;
  /** Which provider served the request */
  provider: string;
  /** Why this model was chosen */
  routingReason: string;
  /** Assumptions surfaced by the agent for human verification */
  assumptions: AssumptionItem[];
  /** Blockers detected by the agent from the customer/external landscape */
  detectedBlockers: BlockerDetection[];
}

/**
 * Shared prompt suffix that instructs every agent to surface assumptions.
 * Appended to every system prompt so every phase contributes to verification.
 */
const ASSUMPTION_EXTRACTION_PROMPT = `

ASSUMPTION VERIFICATION:
Include an "assumptions" array in your JSON. Only surface assumptions that are HIGH confidence
and critical — things where being wrong would significantly derail the engagement.

Each assumption: { "category": one of (cloud_provider, ci_cd_platform, api_architecture,
auth_pattern, deployment_model, environment_topology, team_structure, technology_stack,
governance_posture, testing_maturity, security_requirements, integration_pattern,
scale_requirements, migration_constraint, business_priority, other),
"claim", "reasoning", "confidence": "High"|"Medium"|"Low", "evidenceIds",
"impact", "blocksPhases", "suggestedVerification" }

Be selective: 0-2 assumptions per phase. Only surface what a human MUST verify.

BLOCKER DETECTION:
Include a "detectedBlockers" array. Only surface blockers with HIGH or CRITICAL severity
that are backed by concrete evidence. Do NOT invent problems.

Each blocker: { "title", "description", "domain": one of (technical, organizational,
political, process, knowledge, security, licensing, cultural),
"severity": "low"|"medium"|"high"|"critical", "rootCause", "rootCauseCategory": one of
(technical_limitation, org_policy, person, budget, process, knowledge_gap, unknown),
"blockedCapabilities", "blockedPhases", "evidenceIds", "suggestedMissile", "suggestedNukeRationale" }

Be selective: 0-1 blockers per phase. Only real, evidence-backed obstacles.
`;

export async function runAgent<T>(
  config: AgentRunConfig<T>
): Promise<AgentRunResult<T>> {
  const { agentType, projectId, systemPrompt, userPrompt, outputSchema } =
    config;

  // ── Model selection ───────────────────────────────────────────────────
  let modelSpec: ModelSpec;
  let fallbackSpec: ModelSpec | null = null;
  let routingReason: string;

  if (config.forceModel) {
    const { MODELS } = await import("@/lib/ai/model-router");
    modelSpec = MODELS[config.forceModel] ?? MODELS["gpt-4.1"];
    routingReason = `Forced: ${config.forceModel}`;
  } else {
    const decision = selectModel(agentType);
    modelSpec = decision.model;
    fallbackSpec = decision.fallback;
    routingReason = decision.reason;
  }

  // ── Inject human-verified constraints ─────────────────────────────────
  let constraintBlock = "";
  if (!config.skipAssumptionInjection) {
    try {
      constraintBlock = await buildConstraintPromptBlock(projectId);
    } catch {
      // Non-fatal: if assumptions aren't available, proceed without them
    }
  }

  const extractionBlock = config.skipAssumptionExtraction ? "" : ASSUMPTION_EXTRACTION_PROMPT;
  const enhancedSystemPrompt = systemPrompt + extractionBlock + constraintBlock;
  const fullPrompt = enhancedSystemPrompt + "\n\n" + userPrompt;
  const pHash = hashPrompt(fullPrompt);

  // ── Create AIRun audit record ─────────────────────────────────────────
  const aiRun = await prisma.aIRun.create({
    data: {
      projectId,
      agentType,
      model: modelSpec.modelId,
      promptHash: pHash,
      inputJson: {
        systemPrompt: systemPrompt.slice(0, 500) + "...",
        userPromptLength: userPrompt.length,
        hasConstraints: constraintBlock.length > 0,
        provider: modelSpec.provider,
        routingReason,
      },
      status: "RUNNING",
    },
  });

  const start = Date.now();
  let parsed: unknown;

  try {
    // ── Call the LLM via unified completion API ─────────────────────────
    const response = await completeWithFallback(
      {
        model: modelSpec,
        systemPrompt: enhancedSystemPrompt,
        userPrompt,
        temperature: 0.1,
        jsonMode: true,
      },
      fallbackSpec
    );

    const durationMs = Date.now() - start;

    const rawContent = response.content;
    if (!rawContent) {
      throw new Error(`${agentType}: Empty response from ${response.provider}/${response.modelUsed}`);
    }

    // ── Parse JSON from response ────────────────────────────────────────
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      throw new Error(
        `${agentType}: Failed to parse JSON from ${response.provider} response: ${rawContent.slice(0, 200)}`
      );
    }

    // ── Extract assumptions ─────────────────────────────────────────────
    const parsedObj = parsed as Record<string, unknown>;
    const rawAssumptions = (parsedObj.assumptions as unknown[]) ?? [];
    const assumptions: AssumptionItem[] = [];

    const validCategories = new Set([
      "cloud_provider", "ci_cd_platform", "api_architecture", "auth_pattern",
      "deployment_model", "environment_topology", "team_structure", "technology_stack",
      "governance_posture", "testing_maturity", "security_requirements",
      "integration_pattern", "scale_requirements", "migration_constraint",
      "business_priority", "other",
    ]);
    const validConfidences = new Set(["High", "Medium", "Low"]);

    for (const raw of rawAssumptions) {
      try {
        const a = raw as Record<string, unknown>;
        const rawCat = (a.category as string) ?? "other";
        const rawConf = (a.confidence as string) ?? "Medium";
        assumptions.push({
          category: (validCategories.has(rawCat) ? rawCat : "other") as AssumptionItem["category"],
          claim: (a.claim as string) ?? "",
          reasoning: (a.reasoning as string) ?? "",
          confidence: (validConfidences.has(rawConf) ? rawConf : "Medium") as AssumptionItem["confidence"],
          evidenceIds: (a.evidenceIds as string[]) ?? [],
          impact: (a.impact as string) ?? "",
          blocksPhases: (a.blocksPhases as string[]) ?? [],
          suggestedVerification: (a.suggestedVerification as string) ?? undefined,
        });
      } catch {
        // Skip malformed assumption entries
      }
    }

    // ── Extract detected blockers ───────────────────────────────────────
    const rawBlockers = (parsedObj.detectedBlockers as unknown[]) ?? [];
    const detectedBlockers: BlockerDetection[] = [];

    const validDomains = new Set([
      "technical", "organizational", "political", "process",
      "knowledge", "security", "licensing", "cultural",
    ]);
    const validSeverities = new Set(["low", "medium", "high", "critical"]);
    const validRootCauseCategories = new Set([
      "technical_limitation", "org_policy", "person",
      "budget", "process", "knowledge_gap", "unknown",
    ]);

    for (const raw of rawBlockers) {
      try {
        const b = raw as Record<string, unknown>;
        const domain = (b.domain as string) ?? "technical";
        const severity = (b.severity as string) ?? "medium";
        const rcCat = (b.rootCauseCategory as string) ?? "unknown";
        detectedBlockers.push({
          title: (b.title as string) ?? "",
          description: (b.description as string) ?? "",
          domain: (validDomains.has(domain) ? domain : "technical") as BlockerDetection["domain"],
          severity: (validSeverities.has(severity) ? severity : "medium") as BlockerDetection["severity"],
          rootCause: (b.rootCause as string) ?? "",
          rootCauseCategory: (validRootCauseCategories.has(rcCat) ? rcCat : "unknown") as BlockerDetection["rootCauseCategory"],
          blockedCapabilities: (b.blockedCapabilities as string[]) ?? [],
          blockedPhases: (b.blockedPhases as string[]) ?? [],
          evidenceIds: (b.evidenceIds as string[]) ?? [],
          suggestedMissile: (b.suggestedMissile as string) ?? undefined,
          suggestedNukeRationale: (b.suggestedNukeRationale as string) ?? undefined,
        });
      } catch {
        // Skip malformed blocker entries
      }
    }

    // ── Remove bonus fields before Zod validation ───────────────────────
    delete parsedObj.assumptions;
    delete parsedObj.detectedBlockers;

    // ── Validate with Zod (with auto-unwrap fallback) ────────────────────
    // LLMs sometimes: (a) wrap output in a key like { "nuke_strategy": {...} },
    // (b) split fields across top-level keys and nested objects, or
    // (c) return correct keys but with extra bonus fields.
    // We try increasingly aggressive strategies until one passes.
    const validated = resilientZodParse(outputSchema, parsedObj, agentType);

    const tokenUsage = {
      prompt: response.usage.promptTokens,
      completion: response.usage.completionTokens,
      total: response.usage.totalTokens,
    };

    // ── Update AIRun with success ───────────────────────────────────────
    await prisma.aIRun.update({
      where: { id: aiRun.id },
      data: {
        status: "SUCCESS",
        model: response.modelUsed,
        outputJson: parsed as Prisma.InputJsonValue,
        tokenUsage: tokenUsage as unknown as Prisma.InputJsonValue,
        durationMs,
      },
    });

    return {
      output: validated,
      aiRunId: aiRun.id,
      tokenUsage,
      durationMs,
      modelUsed: response.modelUsed,
      provider: response.provider,
      routingReason,
      assumptions,
      detectedBlockers,
    };
  } catch (error) {
    const durationMs = Date.now() - start;
    const errMsg =
      error instanceof Error ? error.message : "Unknown error";

    // Store both the error AND the raw LLM output for debugging
    const failedOutput: Record<string, unknown> = { error: errMsg };
    if (typeof parsed === "object" && parsed !== null) {
      failedOutput.rawKeys = Object.keys(parsed as object);
      try {
        failedOutput.rawPreview = JSON.stringify(parsed).slice(0, 2000);
      } catch { /* ignore serialization errors */ }
    }

    await prisma.aIRun.update({
      where: { id: aiRun.id },
      data: {
        status: "FAILED",
        outputJson: failedOutput as Prisma.InputJsonValue,
        durationMs,
      },
    });

    throw error;
  }
}

// ---------------------------------------------------------------------------
// Resilient Zod parsing with multiple unwrapping strategies
// ---------------------------------------------------------------------------

function resilientZodParse<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  obj: Record<string, unknown>,
  agentType: string,
): T {
  // Strategy 0: direct parse
  const direct = schema.safeParse(obj);
  if (direct.success) return direct.data as T;

  const keys = Object.keys(obj);

  // Separate nested objects from primitive/array top-level values
  const nestedKeys: string[] = [];
  const flatKeys: string[] = [];
  for (const k of keys) {
    const v = obj[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      nestedKeys.push(k);
    } else {
      flatKeys.push(k);
    }
  }

  // Strategy 1: try each nested object as-is
  for (const k of nestedKeys) {
    const r = schema.safeParse(obj[k]);
    if (r.success) return r.data as T;
  }

  // Strategy 2a: merge largest nested object + top-level siblings (prefer nested values)
  if (nestedKeys.length > 0) {
    const sorted = [...nestedKeys].sort(
      (a, b) => Object.keys(obj[b] as object).length - Object.keys(obj[a] as object).length,
    );
    const best = obj[sorted[0]] as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...best };
    for (const k of keys) {
      if (k !== sorted[0] && !(k in merged)) merged[k] = obj[k];
    }
    const r = schema.safeParse(merged);
    if (r.success) return r.data as T;

    // Strategy 2b: same merge but prefer top-level siblings over nested values
    const merged2: Record<string, unknown> = { ...best };
    for (const k of keys) {
      if (k !== sorted[0]) merged2[k] = obj[k]; // overwrite
    }
    const r2 = schema.safeParse(merged2);
    if (r2.success) return r2.data as T;
  }

  // Strategy 3: deep flatten — merge ALL nested objects into one + top-level primitives
  if (nestedKeys.length > 1) {
    const flat: Record<string, unknown> = {};
    for (const k of nestedKeys) {
      Object.assign(flat, obj[k] as object);
    }
    for (const k of flatKeys) {
      flat[k] = obj[k];
    }
    const r = schema.safeParse(flat);
    if (r.success) return r.data as T;
  }

  // Strategy 4: gather all candidate values from every level into one object
  const allValues: Record<string, unknown> = { ...obj };
  for (const k of nestedKeys) {
    const inner = obj[k] as Record<string, unknown>;
    for (const ik of Object.keys(inner)) {
      if (!(ik in allValues)) allValues[ik] = inner[ik];
    }
  }
  if (Object.keys(allValues).length > keys.length) {
    const r = schema.safeParse(allValues);
    if (r.success) return r.data as T;
  }

  // Strategy 5: recursive deep flatten — collect ALL leaf values from every
  // nesting level into one flat object (handles 2+ levels of wrapping)
  const deepFlat: Record<string, unknown> = {};
  function collectLeaves(o: Record<string, unknown>) {
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        // If this key doesn't exist yet OR the existing value isn't a primitive,
        // recurse. But also keep the nested object itself in case the schema wants it.
        if (!(k in deepFlat)) deepFlat[k] = v;
        collectLeaves(v as Record<string, unknown>);
      } else {
        if (!(k in deepFlat)) deepFlat[k] = v;
      }
    }
  }
  collectLeaves(obj);
  if (Object.keys(deepFlat).length > Object.keys(allValues).length) {
    const r = schema.safeParse(deepFlat);
    if (r.success) return r.data as T;
  }

  // Strategy 5b: same recursive flatten but prefer primitives over objects for same key
  const deepFlat2: Record<string, unknown> = {};
  function collectPrimitiveFirst(o: Record<string, unknown>) {
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        collectPrimitiveFirst(v as Record<string, unknown>);
        if (!(k in deepFlat2)) deepFlat2[k] = v;
      } else {
        deepFlat2[k] = v; // always prefer primitives/arrays
      }
    }
  }
  collectPrimitiveFirst(obj);
  {
    const r = schema.safeParse(deepFlat2);
    if (r.success) return r.data as T;
  }

  // All strategies exhausted — build a detailed error message
  const zodErrors = direct.error.issues
    .slice(0, 8)
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");

  throw new Error(
    `${agentType}: Zod validation failed — ${zodErrors} (keys: ${keys.join(", ")})`
  );
}
