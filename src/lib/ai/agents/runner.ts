/**
 * Shared agent runner: wraps every agent call with:
 * - AIRun audit logging
 * - Prompt hashing
 * - Duration tracking
 * - Zod output validation
 * - Token usage capture
 */

import { prisma } from "@/lib/prisma";
import { openai, LLM_MODEL, hashPrompt } from "@/lib/ai/openai";
import { z } from "zod";
import { Prisma } from "@prisma/client";

interface AgentRunConfig<T> {
  agentType: string;
  projectId: string;
  systemPrompt: string;
  userPrompt: string;
  outputSchema: z.ZodType<T>;
  /** Optional JSON schema for OpenAI structured output mode */
  jsonSchema?: Record<string, unknown>;
}

interface AgentRunResult<T> {
  output: T;
  aiRunId: string;
  tokenUsage: { prompt: number; completion: number; total: number };
  durationMs: number;
}

export async function runAgent<T>(
  config: AgentRunConfig<T>
): Promise<AgentRunResult<T>> {
  const { agentType, projectId, systemPrompt, userPrompt, outputSchema } =
    config;

  const fullPrompt = systemPrompt + "\n\n" + userPrompt;
  const pHash = hashPrompt(fullPrompt);

  // Create AIRun record (RUNNING)
  const aiRun = await prisma.aIRun.create({
    data: {
      projectId,
      agentType,
      model: LLM_MODEL,
      promptHash: pHash,
      inputJson: {
        systemPrompt: systemPrompt.slice(0, 500) + "...",
        userPromptLength: userPrompt.length,
      },
      status: "RUNNING",
    },
  });

  const start = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1, // Low temperature for deterministic output
    });

    const durationMs = Date.now() - start;

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error(`${agentType}: Empty response from LLM`);
    }

    // Parse JSON from response
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      throw new Error(
        `${agentType}: Failed to parse JSON from LLM response: ${rawContent.slice(0, 200)}`
      );
    }

    // Validate with Zod
    const validated = outputSchema.parse(parsed);

    const tokenUsage = {
      prompt: response.usage?.prompt_tokens ?? 0,
      completion: response.usage?.completion_tokens ?? 0,
      total: response.usage?.total_tokens ?? 0,
    };

    // Update AIRun with success
    await prisma.aIRun.update({
      where: { id: aiRun.id },
      data: {
        status: "SUCCESS",
        outputJson: parsed as Prisma.InputJsonValue,
        tokenUsage: tokenUsage as Prisma.InputJsonValue,
        durationMs,
      },
    });

    return {
      output: validated,
      aiRunId: aiRun.id,
      tokenUsage,
      durationMs,
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
