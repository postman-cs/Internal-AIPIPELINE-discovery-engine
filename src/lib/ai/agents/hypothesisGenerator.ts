/**
 * Agent 4: HypothesisGenerator
 *
 * Generates an engagement hypothesis, recommended approach,
 * stakeholder targets, and first meeting agenda based on all prior outputs.
 */

import { retrieveMultiQueryEvidence, formatEvidenceForPrompt } from "@/lib/ai/retrieval";
import { runAgent } from "./runner";
import {
  hypothesisGeneratorOutputSchema,
  HypothesisGeneratorOutput,
  ReconSynthesizerOutput,
  SignalClassifierOutput,
  MaturityScorerOutput,
} from "./types";

const SYSTEM_PROMPT = `You are a CSE engagement strategist for Postman.

Your job is to generate an engagement hypothesis, recommended approach, stakeholder targets, and first meeting agenda based on all available intelligence.

CONTEXT: You work for Postman's Customer Success Engineering team. Your engagement approaches should focus on how Postman's API platform can solve the customer's specific pain points. Consider:
- API governance and standardization
- Developer experience and onboarding
- API testing and automation
- API lifecycle management
- Collections, workspaces, mock servers, monitors
- Postman Flows, API security testing

RULES:
- Be specific to this customer. No generic platitudes.
- Cite evidence in hypothesisEvidenceIds array with labels like "EVIDENCE-1".
- ONLY reference evidence IDs that appear in the EVIDENCE block. NEVER invent evidence IDs.
- Stakeholder targets should be 2-4 roles.
- Meeting agenda should be 4 items totaling 30 minutes.
- The recommended approach should reference a specific "Path A Phase" (e.g., "0-1 API Governance", "API Testing Uplift", "Developer Portal Strategy").

OUTPUT: Return JSON:
{
  "hypothesis": "2-3 sentences with EVIDENCE-N references",
  "hypothesisEvidenceIds": ["EVIDENCE-1", "EVIDENCE-3"],
  "recommendedApproach": "Path A Phase name",
  "conversationAngle": "1-2 sentence angle for initial outreach",
  "stakeholderTargets": [
    { "role": "title", "why": "reason to engage", "firstMeetingGoal": "what to achieve" }
  ],
  "firstMeetingAgenda": [
    { "timeBlock": "5 min", "topic": "topic name", "detail": "what to cover" }
  ],
  "citations": [ { "evidenceLabel": "...", "sourceType": "...", "relevance": "..." } ]
}`;

export async function runHypothesisGenerator(
  projectId: string,
  projectName: string,
  reconOutput: ReconSynthesizerOutput,
  signalOutput: SignalClassifierOutput,
  maturityOutput: MaturityScorerOutput
): Promise<{ output: HypothesisGeneratorOutput; aiRunId: string }> {
  const evidence = await retrieveMultiQueryEvidence(projectId, [
    `${projectName} pain points challenges developer experience`,
    `${projectName} API strategy goals priorities roadmap`,
    `${projectName} stakeholders engineering leadership team structure`,
  ], 5);

  const evidenceBlock = formatEvidenceForPrompt(evidence);
  const availableLabels = evidence.map((e) => e.evidenceLabel).join(", ");

  const userPrompt = `Generate an engagement hypothesis for project "${projectName}".

AVAILABLE EVIDENCE LABELS (use ONLY these): ${availableLabels}

=== COMPANY SNAPSHOT ===
${JSON.stringify(reconOutput.companySnapshot, null, 2)}

=== TECHNICAL SIGNALS ===
${JSON.stringify(signalOutput.signals, null, 2)}

=== MATURITY ASSESSMENT ===
Level: ${maturityOutput.maturity.level}
Justification: ${maturityOutput.maturity.justification}
Strengths: ${maturityOutput.strengthAreas.join(", ")}
Gaps: ${maturityOutput.gapAreas.join(", ")}

=== PUBLIC FOOTPRINT ===
${JSON.stringify(reconOutput.publicFootprint, null, 2)}

=== EVIDENCE ===
${evidenceBlock}
=== END EVIDENCE ===

Produce the hypothesis JSON. Only reference evidence IDs from the list above.`;

  const result = await runAgent({
    agentType: "HypothesisGenerator",
    projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: hypothesisGeneratorOutputSchema,
  });

  return { output: result.output, aiRunId: result.aiRunId };
}
