/**
 * Agent Evaluation Harness
 *
 * Provides a structured framework for running eval suites against AI agents.
 * Each test case defines inputs + assertions, and results are stored in
 * the AgentEvalResult table for observability.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export interface EvalTestCase {
  id: string;
  agentType: string;
  input: Record<string, unknown>;
  assertions: EvalAssertion[];
}

export interface EvalAssertion {
  type: "field_present" | "field_matches" | "confidence_above" | "string_contains";
  path: string;
  expected?: unknown;
}

export interface EvalResult {
  testCaseId: string;
  agentType: string;
  passed: boolean;
  assertions: AssertionResult[];
  durationMs: number;
  error?: string;
}

interface AssertionResult {
  type: string;
  path: string;
  passed: boolean;
  actual?: unknown;
  expected?: unknown;
}

export async function runEvalSuite(
  agentType: string,
  testCases: EvalTestCase[],
): Promise<EvalResult[]> {
  const { runAgent } = await import("@/lib/ai/agents/runner");
  const { z } = await import("zod");

  const results: EvalResult[] = [];

  for (const tc of testCases) {
    const start = Date.now();
    try {
      const outputSchema = z.record(z.unknown());
      const agentResult = await runAgent({
        agentType: tc.agentType,
        projectId: (tc.input.projectId as string) || "eval-harness",
        systemPrompt: (tc.input.systemPrompt as string) || "",
        userPrompt: (tc.input.userPrompt as string) || "",
        outputSchema,
        skipAssumptionInjection: true,
        skipAssumptionExtraction: true,
      });

      const output = agentResult.output as Record<string, unknown>;
      const assertionResults = tc.assertions.map((a) => checkAssertion(a, output));
      const passed = assertionResults.every((a) => a.passed);
      const durationMs = Date.now() - start;

      const result: EvalResult = {
        testCaseId: tc.id,
        agentType: tc.agentType,
        passed,
        assertions: assertionResults,
        durationMs,
      };

      await prisma.agentEvalResult.create({
        data: {
          agentType: tc.agentType,
          modelId: agentResult.modelUsed,
          testCaseId: tc.id,
          passed,
          assertions: assertionResults as unknown as Prisma.InputJsonValue,
          inputJson: tc.input as Prisma.InputJsonValue,
          outputJson: output as Prisma.InputJsonValue,
          durationMs,
        },
      });

      results.push(result);
    } catch (error) {
      const durationMs = Date.now() - start;
      const errMsg = error instanceof Error ? error.message : String(error);

      const result: EvalResult = {
        testCaseId: tc.id,
        agentType: tc.agentType,
        passed: false,
        assertions: [],
        durationMs,
        error: errMsg,
      };

      await prisma.agentEvalResult.create({
        data: {
          agentType: tc.agentType,
          modelId: "unknown",
          testCaseId: tc.id,
          passed: false,
          assertions: [] as Prisma.InputJsonValue,
          inputJson: tc.input as Prisma.InputJsonValue,
          durationMs,
          errorMsg: errMsg,
        },
      });

      results.push(result);
    }
  }

  return results;
}

function checkAssertion(
  assertion: EvalAssertion,
  output: Record<string, unknown>,
): AssertionResult {
  const value = getNestedValue(output, assertion.path);

  switch (assertion.type) {
    case "field_present":
      return {
        type: assertion.type,
        path: assertion.path,
        passed: value !== undefined && value !== null,
        actual: value,
      };
    case "field_matches":
      return {
        type: assertion.type,
        path: assertion.path,
        passed: JSON.stringify(value) === JSON.stringify(assertion.expected),
        actual: value,
        expected: assertion.expected,
      };
    case "confidence_above":
      return {
        type: assertion.type,
        path: assertion.path,
        passed: typeof value === "number" && value > (assertion.expected as number),
        actual: value,
        expected: assertion.expected,
      };
    case "string_contains":
      return {
        type: assertion.type,
        path: assertion.path,
        passed: typeof value === "string" && value.includes(assertion.expected as string),
        actual: typeof value === "string" ? value.slice(0, 200) : value,
        expected: assertion.expected,
      };
    default:
      return { type: assertion.type, path: assertion.path, passed: false };
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}
