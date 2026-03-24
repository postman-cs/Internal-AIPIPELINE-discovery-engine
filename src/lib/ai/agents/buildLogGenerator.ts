/**
 * BUILD_LOG AI Agent
 *
 * Generates a comprehensive Build Log document by synthesizing
 * upstream artifact summaries from all prior pipeline phases.
 */

import { z } from "zod";
import { runAgent } from "./runner";

// Accept string, object, or array — coerce non-strings to JSON strings
const flexString = z.union([
  z.string(),
  z.array(z.unknown()).transform((v) => JSON.stringify(v)),
  z.record(z.unknown()).transform((v) => JSON.stringify(v)),
]);

export const buildLogOutputSchema = z.object({
  context: flexString,
  useCase: flexString,
  useCaseOneSentence: flexString.optional().default(""),
  successCriteria: flexString,
  environmentBaseline: flexString,
  internalProof: flexString,
  whatWeBuilt: flexString,
  valueUnlocked: flexString,
  reusablePatterns: flexString,
  implementationKit: flexString.optional().default(""),
  productGapsRisks: flexString.optional().default(""),
  caseStudySummary: flexString.optional().default(""),
  nextMotion: flexString.optional().default(""),
  nextSteps: flexString.optional().default(""),
});

export type BuildLogOutput = z.infer<typeof buildLogOutputSchema>;

const SYSTEM_PROMPT = `You are a technical writer generating a comprehensive Build Log document for a Postman Customer Success Engineering engagement.

Your task: Synthesize the upstream artifacts from all prior pipeline phases into a cohesive, professional delivery document that captures the full story of the use case activated, internal proof, customer implementation, value delivered, and the path to scale.

RULES:
- Reference concrete details from the provided upstream artifacts.
- Every section should be substantive (3-10 paragraphs/bullet points).
- Cite evidence where possible using [EVIDENCE-N] labels.
- Write in professional technical documentation style.
- Output valid JSON matching the schema exactly.

SECTIONS:
- context: Executive summary of the customer environment, key stakeholders (SE/CSE, executive sponsor, technical lead), and pilot timeline.
- useCase: The advanced use case being activated — what workflow Postman is being embedded into and what the customer expects to achieve.
- useCaseOneSentence: The use case in one sentence, including the workflow being changed.
- successCriteria: Measurable outcomes that define success for this use case activation.
- environmentBaseline: Technical baseline (topology, tools, maturity, secrets management, IDP).
- internalProof: What was proven internally before customer implementation.
- whatWeBuilt: Detailed description of what was implemented, configured, and delivered.
- valueUnlocked: Quantifiable and qualitative value the customer gains.
- reusablePatterns: Patterns, templates, and approaches that can be reused for future engagements.
- implementationKit: Scripts, templates, setup steps, architecture guidance, guardrails, and rollout notes for scaling.
- productGapsRisks: Product gaps encountered, workarounds applied, and residual risks.
- caseStudySummary: Clear story: what changed, how the use case was implemented, what value it delivered, and why it matters.
- nextMotion: Who owns the next phase — customer self-service, PS, partner rollout, new CSE engagement, or transition back to Sales.
- nextSteps: Recommended next actions and scheduled handoffs.`;

export async function runBuildLogGenerator(
  projectId: string,
  projectName: string,
  upstreamSummaries: Record<string, unknown>,
  existingBuildLog?: Record<string, unknown>,
) {
  const userPrompt = `## Project: ${projectName}

## Upstream Artifact Summaries
${JSON.stringify(upstreamSummaries, null, 2)}

${existingBuildLog ? `## Existing Build Log Content (enhance/update this)\n${JSON.stringify(existingBuildLog, null, 2)}` : ""}

Generate a comprehensive Build Log synthesizing all the above artifacts.`;

  return runAgent({
    agentType: "BuildLogGenerator",
    projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: buildLogOutputSchema,
  });
}

export function buildLogToMarkdown(output: BuildLogOutput): string {
  return `# Build Log

## Context
${output.context}

## Use Case
**Summary:** ${output.useCaseOneSentence}

${output.useCase}

## Success Criteria
${output.successCriteria}

## Environment Baseline
${output.environmentBaseline}

## Internal Proof
${output.internalProof}

## What We Built
${output.whatWeBuilt}

## Value Unlocked
${output.valueUnlocked}

## Reusable Patterns
${output.reusablePatterns}

## Implementation Kit
${output.implementationKit}

## Product Gaps & Risks
${output.productGapsRisks}

## Case Study Summary
${output.caseStudySummary}

## Next Motion
${output.nextMotion}

## Next Steps
${output.nextSteps}
`;
}
