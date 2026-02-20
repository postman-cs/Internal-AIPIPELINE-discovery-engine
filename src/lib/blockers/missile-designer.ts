/**
 * Blocker Missile Designer — AI-powered precision intervention planner.
 *
 * Takes a fully mapped blocker and generates a targeted missile design:
 * specific audience, talking points with rebuttals, action steps,
 * deliverables, and fallback plans.
 *
 * The AI considers:
 * - The blocker's domain, root cause, and stakeholder landscape
 * - The customer's tech stack, org structure, and engagement context
 * - Prior evidence from the discovery pipeline
 * - What missiles have already been tried (to avoid repeating failures)
 */

import { prisma } from "@/lib/prisma";
import { runAgent } from "@/lib/ai/agents/runner";
import { missileDesignSchema } from "@/lib/ai/agents/topologyTypes";
import type { MissileDesign } from "@/lib/ai/agents/topologyTypes";
import { persistAiMissile } from "./engine";
import { retrieveMultiQueryEvidence, formatEvidenceForPrompt } from "@/lib/ai/retrieval";

const SYSTEM_PROMPT = `You are an expert enterprise sales engineering strategist specializing in
overcoming adoption blockers for Postman Enterprise in CI/CD and cloud infrastructure pipelines.

You are designing a MISSILE — a targeted, surgical intervention to neutralize a specific blocker.
A missile is precise: one audience, one message, one set of deliverables, with clear success criteria.

Your missile design must be:
- ACTIONABLE: Every step can be executed immediately
- SPECIFIC: Named audiences, specific talking points, concrete deliverables
- EVIDENCE-BACKED: Use real data and evidence from the customer's environment
- REALISTIC: Account for organizational dynamics, politics, and timing
- COMPLETE: Include fallback plan if the missile misses

You are NOT being asked to solve all problems. You are designing ONE precision strike
against ONE specific blocker. Be surgical.

OUTPUT: Return a FLAT JSON object (NO nesting under wrapper keys) with exactly these top-level fields:
{
  "name": "string — short name for this missile",
  "strategy": "string — overall approach",
  "targetAudience": "string — who to target",
  "talkingPoints": [{ "point": "...", "evidence": "...", "rebuttal": "..." }],
  "actionSteps": [{ "order": 1, "action": "...", "owner": "...", "deliverable": "...", "timeline": "..." }],
  "deliverables": [{ "type": "...", "description": "...", "effort": "..." }],
  "estimatedEffort": "string",
  "successCriteria": "string",
  "fallbackPlan": "string",
  "probabilityOfSuccess": "high|medium|low"
}

ALL fields must be top-level keys. Do NOT nest them under wrapper objects like "missileDesign".`;

/**
 * Generate an AI-designed missile for a specific blocker.
 */
export async function designMissile(
  blockerId: string
): Promise<{ missileId: string; design: MissileDesign; aiRunId: string } | { error: string }> {
  const blocker = await prisma.blocker.findUnique({
    where: { id: blockerId },
    include: {
      project: { select: { id: true, name: true } },
      missiles: { select: { name: true, status: true, resultNotes: true } },
    },
  });

  if (!blocker) return { error: "Blocker not found" };

  // Gather context
  const evidence = await retrieveMultiQueryEvidence(blocker.projectId, [
    `${blocker.project.name} ${blocker.domain.toLowerCase()} challenges obstacles`,
    `${blocker.project.name} stakeholders decision makers approvals`,
    `${blocker.project.name} CI/CD pipeline adoption requirements`,
  ]);
  const evidenceBlock = formatEvidenceForPrompt(evidence);

  const priorMissiles = blocker.missiles
    .map((m) => `- "${m.name}" → ${m.status}${m.resultNotes ? `: ${m.resultNotes}` : ""}`)
    .join("\n");

  const userPrompt = `## Blocker to Neutralize

**Title:** ${blocker.title}
**Description:** ${blocker.description}
**Domain:** ${blocker.domain}
**Severity:** ${blocker.severity}
**Root Cause:** ${blocker.rootCause ?? "Not yet identified"}
**Root Cause Category:** ${blocker.rootCauseCategory ?? "unknown"}

**Blocker Owner:** ${blocker.blockerOwner ?? "Unknown"}
**Decision Maker:** ${blocker.decisionMaker ?? "Unknown"}
**Allies:** ${JSON.stringify((blocker.allies as string[]) ?? [])}
**Resistors:** ${JSON.stringify((blocker.resistors as string[]) ?? [])}

**Blocked Phases:** ${JSON.stringify((blocker.blockedPhases as string[]) ?? [])}
**Blocked Capabilities:** ${JSON.stringify((blocker.blockedCapabilities as string[]) ?? [])}

**Revenue Impact:** ${blocker.revenueImpact ?? "Not assessed"}
**Timeline Impact:** ${blocker.timelineImpact ?? "Not assessed"}

${priorMissiles ? `## Prior Missiles Attempted\n${priorMissiles}\n\nDo NOT repeat failed approaches. Design something different.` : "## No Prior Missiles\nThis is the first intervention attempt."}

## Customer Evidence
${evidenceBlock}

Design a precision missile to neutralize this blocker. Be specific about WHO to target,
WHAT to say, WHAT to deliver, and HOW to know if it worked.`;

  const result = await runAgent({
    agentType: "missile-designer",
    projectId: blocker.projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: missileDesignSchema,
    skipAssumptionInjection: true,
  });

  const missileId = await persistAiMissile(
    blockerId,
    {
      name: result.output.name,
      strategy: result.output.strategy,
      targetAudience: result.output.targetAudience,
      talkingPoints: result.output.talkingPoints,
      actionSteps: result.output.actionSteps,
      deliverables: result.output.deliverables,
      estimatedEffort: result.output.estimatedEffort,
      successCriteria: result.output.successCriteria,
      fallbackPlan: result.output.fallbackPlan,
    },
    result.aiRunId
  );

  return { missileId, design: result.output, aiRunId: result.aiRunId };
}
