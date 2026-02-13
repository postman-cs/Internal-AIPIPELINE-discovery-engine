/**
 * Multi-Model Router
 *
 * Intelligently routes each AI task to the optimal model (OpenAI or Anthropic)
 * based on the task type, complexity, and required capabilities.
 *
 * Model Selection Strategy:
 *
 * Claude (Anthropic) excels at:
 *   - Long, nuanced analysis and synthesis (Discovery, Briefs)
 *   - Following complex instructions precisely (governance, compliance)
 *   - Careful reasoning about organizational dynamics (blockers, resistance)
 *   - Large context windows and long-form structured output
 *
 * GPT-4.1 (OpenAI) excels at:
 *   - Structured JSON generation with strict schemas
 *   - Code generation and technical config output (CI/CD, IaC, Newman)
 *   - Fast, deterministic output for well-defined schemas
 *   - Function calling and tool use patterns
 *
 * The router can be overridden per-call or globally via env vars.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { logger } from "@/lib/logger";

const log = logger.child("model-router");

// ═══════════════════════════════════════════════════════════════════════════
// Provider clients (singletons)
// ═══════════════════════════════════════════════════════════════════════════

const globalForAI = globalThis as unknown as {
  openai?: OpenAI;
  anthropic?: Anthropic;
};

function getOpenAIClient(): OpenAI {
  if (!globalForAI.openai) {
    globalForAI.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return globalForAI.openai;
}

function getAnthropicClient(): Anthropic {
  if (!globalForAI.anthropic) {
    globalForAI.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return globalForAI.anthropic;
}

// ═══════════════════════════════════════════════════════════════════════════
// Model definitions
// ═══════════════════════════════════════════════════════════════════════════

export type Provider = "openai" | "anthropic";

export interface ModelSpec {
  provider: Provider;
  modelId: string;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  costPer1kInput: number;   // USD
  costPer1kOutput: number;  // USD
  strengths: string[];
}

export const MODELS: Record<string, ModelSpec> = {
  "gpt-4.1": {
    provider: "openai",
    modelId: "gpt-4.1",
    displayName: "GPT-4.1",
    contextWindow: 1_000_000,
    maxOutputTokens: 32_768,
    costPer1kInput: 0.002,
    costPer1kOutput: 0.008,
    strengths: ["json_generation", "code_generation", "structured_output", "speed"],
  },
  "gpt-4.1-mini": {
    provider: "openai",
    modelId: "gpt-4.1-mini",
    displayName: "GPT-4.1 Mini",
    contextWindow: 1_000_000,
    maxOutputTokens: 16_384,
    costPer1kInput: 0.0004,
    costPer1kOutput: 0.0016,
    strengths: ["speed", "cost_efficiency", "simple_tasks"],
  },
  "gpt-4.1-nano": {
    provider: "openai",
    modelId: "gpt-4.1-nano",
    displayName: "GPT-4.1 Nano",
    contextWindow: 1_000_000,
    maxOutputTokens: 16_384,
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0004,
    strengths: ["speed", "cost_efficiency", "classification", "simple_extraction"],
  },
  "claude-sonnet-4-20250514": {
    provider: "anthropic",
    modelId: "claude-sonnet-4-20250514",
    displayName: "Claude Sonnet 4",
    contextWindow: 200_000,
    maxOutputTokens: 16_000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    strengths: ["analysis", "synthesis", "nuance", "instruction_following", "long_form"],
  },
  "claude-3-5-haiku-20241022": {
    provider: "anthropic",
    modelId: "claude-3-5-haiku-20241022",
    displayName: "Claude 3.5 Haiku",
    contextWindow: 200_000,
    maxOutputTokens: 8_192,
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
    strengths: ["speed", "cost_efficiency", "classification", "extraction"],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Task → Model mapping
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Task categories that inform model selection.
 */
export type TaskCategory =
  | "discovery_analysis"     // Recon, signals, maturity — long context synthesis
  | "strategic_planning"     // Hypothesis, brief, iteration planner — nuanced reasoning
  | "technical_generation"   // Topology, solution design, IaC, CI/CD configs — structured output
  | "code_generation"        // Newman scripts, pipeline YAML, test scripts
  | "classification"         // Signal classification, maturity scoring — fast, simple
  | "creative_writing"       // Story polishing, brief generation — prose quality
  | "blocker_strategy"       // Missile design, nuke strategy — organizational reasoning
  | "adoption_planning"      // Onboarding playbooks, drip campaigns, wave strategy
  | "general";               // Fallback

/**
 * Map agent types to task categories.
 */
const AGENT_TASK_MAP: Record<string, TaskCategory> = {
  // Discovery pipeline — analysis & synthesis
  ReconSynthesizer: "discovery_analysis",
  SignalClassifier: "classification",
  MaturityScorer: "classification",
  HypothesisGenerator: "strategic_planning",
  BriefGenerator: "creative_writing",

  // Topology & architecture
  CurrentTopologyBuilder: "technical_generation",
  FutureStateDesigner: "strategic_planning",

  // Solution design & implementation
  SolutionDesigner: "technical_generation",
  CraftSolution: "code_generation",
  TestDesigner: "technical_generation",
  TestSolution: "code_generation",

  // Infrastructure & deployment
  DeploymentPlanner: "technical_generation",
  InfrastructurePlanner: "code_generation",
  MonitoringPlanner: "technical_generation",

  // Iteration
  iterationPlanner: "strategic_planning",

  // Story
  StoryPolisher: "creative_writing",

  // Blockers — organizational reasoning
  "blocker-missile-designer": "blocker_strategy",
  "blocker-nuke-strategist": "blocker_strategy",

  // Adoption — planning and enablement
  "onboarding-playbook-generator": "adoption_planning",
  "integration-blueprint-generator": "code_generation",
  "drip-campaign-designer": "adoption_planning",
  "wide-adoption-strategist": "strategic_planning",
};

/**
 * Task category → preferred model mapping.
 * This is the core intelligence of the router.
 */
const TASK_MODEL_PREFERENCE: Record<TaskCategory, string[]> = {
  // Claude excels at long-form analysis and synthesis
  discovery_analysis: ["claude-sonnet-4-20250514", "gpt-4.1"],

  // Claude excels at nuanced strategic reasoning
  strategic_planning: ["claude-sonnet-4-20250514", "gpt-4.1"],

  // GPT-4.1 excels at structured JSON and technical output
  technical_generation: ["gpt-4.1", "claude-sonnet-4-20250514"],

  // GPT-4.1 excels at code and config generation
  code_generation: ["gpt-4.1", "claude-sonnet-4-20250514"],

  // Fast classification — use smaller models
  classification: ["gpt-4.1-mini", "claude-3-5-haiku-20241022", "gpt-4.1"],

  // Claude excels at prose quality
  creative_writing: ["claude-sonnet-4-20250514", "gpt-4.1"],

  // Claude excels at reasoning about organizational dynamics
  blocker_strategy: ["claude-sonnet-4-20250514", "gpt-4.1"],

  // Mixed — Claude for strategy, GPT for structure
  adoption_planning: ["claude-sonnet-4-20250514", "gpt-4.1"],

  // Fallback
  general: ["gpt-4.1", "claude-sonnet-4-20250514"],
};

// ═══════════════════════════════════════════════════════════════════════════
// Router logic
// ═══════════════════════════════════════════════════════════════════════════

export interface RoutingDecision {
  model: ModelSpec;
  reason: string;
  fallback: ModelSpec | null;
}

/**
 * Select the best model for a given agent type.
 *
 * Selection logic:
 * 1. Check for per-agent env override (AI_MODEL_<AGENT_TYPE>)
 * 2. Check for global env override (AI_DEFAULT_MODEL)
 * 3. Check provider availability (skip if API key missing)
 * 4. Use task category mapping to pick the best available model
 */
export function selectModel(agentType: string): RoutingDecision {
  // 1. Per-agent override: AI_MODEL_ReconSynthesizer=gpt-4.1
  const agentOverrideKey = `AI_MODEL_${agentType.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const agentOverride = process.env[agentOverrideKey];
  if (agentOverride && MODELS[agentOverride]) {
    return {
      model: MODELS[agentOverride],
      reason: `Per-agent override: ${agentOverrideKey}=${agentOverride}`,
      fallback: null,
    };
  }

  // 2. Global override: AI_DEFAULT_MODEL=claude-sonnet-4-20250514
  const globalOverride = process.env.AI_DEFAULT_MODEL;
  if (globalOverride && MODELS[globalOverride]) {
    return {
      model: MODELS[globalOverride],
      reason: `Global override: AI_DEFAULT_MODEL=${globalOverride}`,
      fallback: null,
    };
  }

  // 3. Task-based routing
  const taskCategory = AGENT_TASK_MAP[agentType] ?? "general";
  const preferences = TASK_MODEL_PREFERENCE[taskCategory];

  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

  // Find first available model from preference list
  let selected: ModelSpec | null = null;
  let fallback: ModelSpec | null = null;

  for (const modelId of preferences) {
    const spec = MODELS[modelId];
    if (!spec) continue;

    const available =
      (spec.provider === "openai" && hasOpenAI) ||
      (spec.provider === "anthropic" && hasAnthropic);

    if (available) {
      if (!selected) {
        selected = spec;
      } else if (!fallback) {
        fallback = spec;
        break;
      }
    }
  }

  // Ultimate fallback: use whatever is available
  if (!selected) {
    if (hasOpenAI) {
      selected = MODELS["gpt-4.1"];
    } else if (hasAnthropic) {
      selected = MODELS["claude-sonnet-4-20250514"];
    } else {
      // No API keys configured — use OpenAI and let it fail with a clear error
      selected = MODELS["gpt-4.1"];
    }
  }

  return {
    model: selected!,
    reason: `Task category "${taskCategory}" → preferred ${selected!.displayName}`,
    fallback,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Unified completion API
// ═══════════════════════════════════════════════════════════════════════════

export interface CompletionRequest {
  model: ModelSpec;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  jsonMode?: boolean;
}

export interface CompletionResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  modelUsed: string;
  provider: Provider;
}

/**
 * Send a completion request to the appropriate provider.
 * Handles the differences between OpenAI and Anthropic APIs.
 */
export async function complete(req: CompletionRequest): Promise<CompletionResponse> {
  if (req.model.provider === "anthropic") {
    return completeAnthropic(req);
  }
  return completeOpenAI(req);
}

/**
 * Send completion with automatic fallback on failure.
 */
export async function completeWithFallback(
  req: CompletionRequest,
  fallbackModel: ModelSpec | null
): Promise<CompletionResponse> {
  try {
    return await complete(req);
  } catch (error) {
    if (!fallbackModel) throw error;

    const errMsg = error instanceof Error ? error.message : String(error);
    log.warn("Primary model failed, falling back", {
      primary: req.model.modelId,
      fallback: fallbackModel.modelId,
      error: errMsg,
    });

    return complete({ ...req, model: fallbackModel });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Provider-specific implementations
// ═══════════════════════════════════════════════════════════════════════════

async function completeOpenAI(req: CompletionRequest): Promise<CompletionResponse> {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: req.model.modelId,
    messages: [
      { role: "system", content: req.systemPrompt },
      { role: "user", content: req.userPrompt },
    ],
    response_format: req.jsonMode ? { type: "json_object" } : undefined,
    temperature: req.temperature ?? 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned empty response");

  return {
    content,
    usage: {
      promptTokens: response.usage?.prompt_tokens ?? 0,
      completionTokens: response.usage?.completion_tokens ?? 0,
      totalTokens: response.usage?.total_tokens ?? 0,
    },
    modelUsed: req.model.modelId,
    provider: "openai",
  };
}

async function completeAnthropic(req: CompletionRequest): Promise<CompletionResponse> {
  const client = getAnthropicClient();

  // Anthropic uses system as a top-level parameter, not a message role
  // For JSON mode, we add explicit instruction since Anthropic doesn't have a response_format param
  let systemPrompt = req.systemPrompt;
  if (req.jsonMode) {
    systemPrompt += "\n\nIMPORTANT: You MUST respond with ONLY valid JSON. No markdown, no code fences, no explanation text outside the JSON. Start your response with { and end with }.";
  }

  const response = await client.messages.create({
    model: req.model.modelId,
    max_tokens: req.model.maxOutputTokens,
    system: systemPrompt,
    messages: [
      { role: "user", content: req.userPrompt },
    ],
    temperature: req.temperature ?? 0.1,
  });

  // Anthropic returns content blocks
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Anthropic returned no text content");
  }

  let content = textBlock.text;

  // Clean up Anthropic's response if it wrapped JSON in markdown fences
  if (req.jsonMode) {
    content = content.trim();
    if (content.startsWith("```json")) {
      content = content.slice(7);
    } else if (content.startsWith("```")) {
      content = content.slice(3);
    }
    if (content.endsWith("```")) {
      content = content.slice(0, -3);
    }
    content = content.trim();
  }

  return {
    content,
    usage: {
      promptTokens: response.usage?.input_tokens ?? 0,
      completionTokens: response.usage?.output_tokens ?? 0,
      totalTokens: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
    },
    modelUsed: req.model.modelId,
    provider: "anthropic",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Exports for backward compatibility
// ═══════════════════════════════════════════════════════════════════════════

/** Get the OpenAI client (for embeddings and other OpenAI-only features) */
export { getOpenAIClient as getOpenAI };

/** Available model IDs */
export const MODEL_IDS = Object.keys(MODELS);
