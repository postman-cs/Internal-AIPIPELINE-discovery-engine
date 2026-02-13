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
  outputSchema: z.ZodType<T>;
  /** Optional JSON schema for structured output mode */
  jsonSchema?: Record<string, unknown>;
  /** If true, skip injecting assumption constraints (for lightweight agents) */
  skipAssumptionInjection?: boolean;
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

ASSUMPTION VERIFICATION (IMPORTANT):
In addition to your main output, you MUST include an "assumptions" array in your JSON response.
For each significant assumption you are making about the customer's environment, technology, or
processes, surface it explicitly so a human can verify it before downstream phases build on it.

Each assumption should include:
- "category": one of: cloud_provider, ci_cd_platform, api_architecture, auth_pattern,
  deployment_model, environment_topology, team_structure, technology_stack, governance_posture,
  testing_maturity, security_requirements, integration_pattern, scale_requirements,
  migration_constraint, business_priority, other
- "claim": what you believe to be true (be specific)
- "reasoning": why you believe this based on the evidence
- "confidence": "High" | "Medium" | "Low"
- "evidenceIds": which evidence supports this
- "impact": what goes wrong in the plan if this assumption is incorrect
- "blocksPhases": which downstream pipeline phases depend on this being correct
- "suggestedVerification": how the human can quickly verify this (e.g., "Ask customer if they use AWS or GCP")

Focus on assumptions that are: (a) not explicitly stated in evidence, (b) inferred from indirect signals,
(c) critical to the accuracy of downstream phases. Aim for 3-8 assumptions per phase.

The "assumptions" array MUST be a top-level key in your JSON output alongside your other fields.

BLOCKER DETECTION (IMPORTANT):
If you detect any blockers — obstacles from the customer's environment, organization, technology
limitations, political dynamics, or processes that could prevent successful adoption of Postman
in their CI/CD and cloud infrastructure pipelines — surface them in a "detectedBlockers" array.

Each blocker should include:
- "title": short name (e.g. "Security team requires 6-month vendor evaluation")
- "description": full explanation of the blocker
- "domain": one of: technical, organizational, political, process, knowledge, security, licensing, cultural
- "severity": "low" | "medium" | "high" | "critical"
- "rootCause": why this blocker exists
- "rootCauseCategory": one of: technical_limitation, org_policy, person, budget, process, knowledge_gap, unknown
- "blockedCapabilities": what features/capabilities this blocks
- "blockedPhases": which downstream pipeline phases are affected
- "evidenceIds": evidence supporting this blocker's existence
- "suggestedMissile": a quick initial idea for a targeted intervention
- "suggestedNukeRationale": when would the nuclear option be needed for this blocker

Only surface REAL blockers backed by evidence. Do not invent problems. 0-3 blockers per phase is typical.

The "detectedBlockers" array MUST be a top-level key in your JSON output.
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

  const enhancedSystemPrompt = systemPrompt + ASSUMPTION_EXTRACTION_PROMPT + constraintBlock;
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
    let parsed: unknown;
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

    // ── Validate with Zod ───────────────────────────────────────────────
    const validated = outputSchema.parse(parsedObj);

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
        model: response.modelUsed, // Record actual model used (may differ if fallback triggered)
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

    await prisma.aIRun.update({
      where: { id: aiRun.id },
      data: {
        status: "FAILED",
        outputJson: { error: errMsg } as Prisma.InputJsonValue,
        durationMs,
      },
    });

    throw error;
  }
}
