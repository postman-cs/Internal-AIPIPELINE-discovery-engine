/**
 * Agent 5: BriefGenerator
 *
 * Produces the final Discovery Brief in both Markdown and structured JSON
 * from all prior agent outputs. Every claim must be evidence-cited.
 * Includes an Evidence Appendix at the bottom with excerpts.
 */

import { runAgent } from "./runner";
import {
  briefGeneratorOutputSchema,
  BriefGeneratorOutput,
  ReconSynthesizerOutput,
  SignalClassifierOutput,
  MaturityScorerOutput,
  HypothesisGeneratorOutput,
  EvidenceAppendixEntry,
} from "./types";
import type { AssumptionItem, BlockerDetection } from "./topologyTypes";

const SYSTEM_PROMPT = `You are a discovery brief writer for a Postman CSE team.

Your job is to compile all prior analysis into a polished, evidence-backed Discovery Brief.

TEMPLATE (you must follow this exact Markdown structure):

# Discovery Brief: {Project Name}

## Company Snapshot
- **Industry**: {industry}
- **Engineering Size** (estimate): {size}
- **Public API Presence**: Yes / No / Partial

## Technical Landscape
| Signal | Finding | Confidence | Evidence |
|--------|---------|------------|----------|
| Primary Cloud | {finding} | High / Medium / Low | [EVIDENCE-N] |
| CDN / Edge | ... | ... | [EVIDENCE-N] |
| Auth Pattern | ... | ... | [EVIDENCE-N] |
| Backend Tech | ... | ... | [EVIDENCE-N] |

## API Maturity Assessment
- **Level**: {1/2/3}
- **Justification**: {with [EVIDENCE-N] citations}

## Public Footprint
### Postman Network
{findings with [EVIDENCE-N] citations}
### Developer Portal
{findings with [EVIDENCE-N] citations}
### GitHub / Engineering Presence
{findings with [EVIDENCE-N] citations}

## Hypothesis
{2-3 sentences with [EVIDENCE-N] citations}

## Recommended Approach
- **Start with Path A Phase**: {approach}
- **Initial Conversation Angle**: {angle}

## Stakeholder Targets
| Role | Why Target | First Meeting Goal |
|------|------------|-------------------|
{rows}

### First Meeting Agenda (30 min)
{numbered list with time blocks}

## Evidence Appendix
{For each evidence ID cited above, include:}
| Evidence ID | Source | Excerpt |
|-------------|--------|---------|
| [EVIDENCE-1] | {source type}: {title} | "{first 200 chars of content}..." |

RULES:
- Every factual claim MUST have an [EVIDENCE-N] citation.
- ONLY reference evidence IDs that are provided in the EVIDENCE APPENDIX DATA below. NEVER invent evidence IDs.
- Use only information from the provided inputs. Do not fabricate.
- The Markdown must be clean and properly formatted.
- The JSON structure must mirror the Markdown content.
- The Evidence Appendix MUST be the last section of the brief.

OUTPUT: Return JSON:
{
  "briefMarkdown": "full markdown string including Evidence Appendix section",
  "briefJson": {
    "projectName": "...",
    "companySnapshot": {...},
    "technicalLandscape": [...],
    "maturity": {...},
    "publicFootprint": {...},
    "hypothesis": "...",
    "recommendedApproach": {...},
    "stakeholderTargets": [...],
    "firstMeetingAgenda": [...],
    "evidenceAppendix": [ { "evidenceLabel": "...", "sourceType": "...", "title": "...", "excerpt": "..." } ]
  },
  "allCitations": [ { "evidenceLabel": "...", "sourceType": "...", "relevance": "..." } ]
}`;

export async function runBriefGenerator(
  projectId: string,
  projectName: string,
  reconOutput: ReconSynthesizerOutput,
  signalOutput: SignalClassifierOutput,
  maturityOutput: MaturityScorerOutput,
  hypothesisOutput: HypothesisGeneratorOutput,
  evidenceAppendix: EvidenceAppendixEntry[]
): Promise<{ output: BriefGeneratorOutput; aiRunId: string; assumptions: AssumptionItem[]; detectedBlockers: BlockerDetection[] }> {
  const appendixBlock = evidenceAppendix.length > 0
    ? evidenceAppendix
        .map(
          (e) =>
            `[${e.evidenceLabel}] Source: ${e.sourceType}: ${e.title}\nExcerpt: "${e.excerpt}"`
        )
        .join("\n\n")
    : "No evidence available.";

  const availableLabels = evidenceAppendix.map((e) => e.evidenceLabel).join(", ");

  const userPrompt = `Compile the Discovery Brief for project "${projectName}".

AVAILABLE EVIDENCE LABELS (use ONLY these): ${availableLabels}

=== RECON SYNTHESIS ===
${JSON.stringify(reconOutput, null, 2)}

=== SIGNAL CLASSIFICATION ===
${JSON.stringify(signalOutput, null, 2)}

=== MATURITY ASSESSMENT ===
${JSON.stringify(maturityOutput, null, 2)}

=== HYPOTHESIS & ENGAGEMENT ===
${JSON.stringify(hypothesisOutput, null, 2)}

=== EVIDENCE APPENDIX DATA ===
${appendixBlock}
=== END EVIDENCE APPENDIX DATA ===

Produce the final Discovery Brief as JSON with briefMarkdown (including Evidence Appendix) and briefJson fields.
Only reference evidence IDs from the list above.`;

  const result = await runAgent({
    agentType: "BriefGenerator",
    projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: briefGeneratorOutputSchema,
  });

  return { output: result.output, aiRunId: result.aiRunId, assumptions: result.assumptions, detectedBlockers: result.detectedBlockers };
}
