/**
 * Blocker Nuke Strategist — AI-powered comprehensive obliteration planner.
 *
 * When missiles have failed or the blocker is so entrenched that surgical
 * strikes won't work, the nuke is the last resort: a comprehensive,
 * multi-phase strategy to obliterate the blocker through overwhelming force.
 *
 * Nuke strategies include:
 * - Executive escalation chains with specific approach scripts
 * - Collateral damage assessment with mitigation plans
 * - Multi-phase execution plans with success gates
 * - Resource mobilization requirements
 * - Complete bypass strategies (make the blocker irrelevant)
 * - Failure contingency (if even the nuke doesn't work)
 *
 * The AI considers everything: the blocker, its context, failed missiles,
 * organizational dynamics, and the full engagement landscape.
 */

import { prisma } from "@/lib/prisma";
import { runAgent } from "@/lib/ai/agents/runner";
import { nukeStrategySchema } from "@/lib/ai/agents/topologyTypes";
import type { NukeStrategy } from "@/lib/ai/agents/topologyTypes";
import { persistAiNuke } from "./engine";
import { retrieveMultiQueryEvidence, formatEvidenceForPrompt } from "@/lib/ai/retrieval";

const SYSTEM_PROMPT = `You are an expert enterprise sales engineering strategist. You specialize in
overcoming deeply entrenched adoption blockers for Postman Enterprise in CI/CD and cloud
infrastructure pipelines.

You are designing a NUKE — a comprehensive, multi-phase obliteration strategy for a blocker
that has resisted all prior intervention attempts. This is the nuclear option.

A nuke is:
- COMPREHENSIVE: Addresses the blocker from every angle simultaneously
- ESCALATORY: Involves executive-level engagement and organizational influence
- MULTI-PHASE: Executed in stages with clear success gates between each
- COLLATERAL-AWARE: Acknowledges and plans for side effects
- IRREVERSIBLE-AWARE: Clearly identifies the point of no return

You must also design a BYPASS STRATEGY — an alternative path that makes the blocker
irrelevant entirely, even if it means significant tradeoffs.

The nuke should feel like a comprehensive battle plan. Leave nothing to chance.
Account for political dynamics, organizational inertia, and human psychology.

CRITICAL: Include a FAILURE CONTINGENCY — what happens if even the nuke doesn't work.
An SE must never be left without options.

OUTPUT: Return a FLAT JSON object (NO nesting under wrapper keys) with exactly these top-level fields:
{
  "name": "string — short name for this nuke strategy",
  "rationale": "string — why the nuclear option is needed",
  "strategy": "string — high-level strategy description",
  "escalationChain": [{ "order": 1, "person": "...", "role": "...", "approach": "...", "keyMessage": "..." }],
  "collateralDamage": [{ "area": "...", "impact": "...", "mitigation": "..." }],
  "riskAssessment": "string — overall risk analysis",
  "pointOfNoReturn": "string — after which step is this irreversible",
  "phases": [{ "order": 1, "name": "...", "actions": ["..."], "duration": "...", "successGate": "..." }],
  "resources": [{ "type": "person|budget|tool|executive_time", "description": "...", "availability": "..." }],
  "timeline": "string — overall timeline estimate",
  "bypassStrategy": "string — alternative path that makes the blocker irrelevant",
  "bypassTradeoffs": "string — what you sacrifice with the bypass",
  "successCriteria": "string — how to measure if the nuke worked",
  "failureContingency": "string — what to do if even the nuke fails"
}

ALL fields must be top-level keys. Do NOT nest them under wrapper objects like "nukeStrategy".`;

/**
 * Generate an AI-designed nuke strategy for a specific blocker.
 */
export async function designNuke(
  blockerId: string
): Promise<{ nukeId: string; strategy: NukeStrategy; aiRunId: string } | { error: string }> {
  const blocker = await prisma.blocker.findUnique({
    where: { id: blockerId },
    include: {
      project: { select: { id: true, name: true } },
      missiles: {
        select: {
          name: true, strategy: true, status: true,
          resultNotes: true, targetAudience: true,
        },
      },
      nukes: {
        select: { name: true, status: true, resultNotes: true },
      },
    },
  });

  if (!blocker) return { error: "Blocker not found" };

  // Gather extensive context
  const evidence = await retrieveMultiQueryEvidence(blocker.projectId, [
    `${blocker.project.name} organizational structure leadership executives`,
    `${blocker.project.name} ${blocker.domain.toLowerCase()} policies processes`,
    `${blocker.project.name} CI/CD cloud infrastructure strategy priorities`,
    `${blocker.project.name} competitive landscape vendor evaluation`,
    `${blocker.project.name} budget procurement approval process`,
  ]);
  const evidenceBlock = formatEvidenceForPrompt(evidence);

  const missileHistory = blocker.missiles
    .map((m) => {
      return `### Missile: "${m.name}"
- Strategy: ${m.strategy}
- Target: ${m.targetAudience ?? "Unknown"}
- Result: ${m.status}${m.resultNotes ? ` — ${m.resultNotes}` : ""}`;
    })
    .join("\n\n");

  const priorNukes = blocker.nukes
    .filter((n) => n.status === "failed")
    .map((n) => `- "${n.name}" → FAILED: ${n.resultNotes ?? "No details"}`)
    .join("\n");

  const userPrompt = `## BLOCKER REQUIRING NUCLEAR OPTION

**Title:** ${blocker.title}
**Description:** ${blocker.description}
**Domain:** ${blocker.domain}
**Severity:** ${blocker.severity}
**Current Status:** ${blocker.status}

### Root Cause Analysis
- **Root Cause:** ${blocker.rootCause ?? "Not yet identified"}
- **Category:** ${blocker.rootCauseCategory ?? "unknown"}

### Stakeholder Landscape
- **Blocker Owner** (controls the blocker): ${blocker.blockerOwner ?? "Unknown"}
- **Decision Maker** (can unblock): ${blocker.decisionMaker ?? "Unknown"}
- **Allies** (want this resolved): ${JSON.stringify((blocker.allies as string[]) ?? [])}
- **Resistors** (benefit from status quo): ${JSON.stringify((blocker.resistors as string[]) ?? [])}

### Impact Assessment
- **Blocked Phases:** ${JSON.stringify((blocker.blockedPhases as string[]) ?? [])}
- **Blocked Capabilities:** ${JSON.stringify((blocker.blockedCapabilities as string[]) ?? [])}
- **Revenue Impact:** ${blocker.revenueImpact ?? "Not assessed"}
- **Timeline Impact:** ${blocker.timelineImpact ?? "Not assessed"}
- **Cascade Impact:** ${blocker.cascadeImpact ?? "Not assessed"}
- **Impact Score:** ${blocker.impactScore}/100

${missileHistory ? `### Prior Missile Attempts (all failed or insufficient)\n${missileHistory}` : "### No prior missiles attempted"}

${priorNukes ? `### Prior Nukes (failed)\n${priorNukes}\n\nDesign a COMPLETELY DIFFERENT approach.` : ""}

### SE Notes
${blocker.notes ?? "No additional notes."}

## Customer Evidence
${evidenceBlock}

Design a comprehensive nuclear strategy to obliterate this blocker. Include executive
escalation chains, multi-phase execution plans, collateral damage assessment, bypass
strategies, and failure contingencies. Leave nothing to chance.`;

  const result = await runAgent({
    agentType: "nuke-strategist",
    projectId: blocker.projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: nukeStrategySchema,
    skipAssumptionInjection: true,
  });

  const nukeId = await persistAiNuke(
    blockerId,
    {
      name: result.output.name,
      rationale: result.output.rationale,
      strategy: result.output.strategy,
      escalationChain: result.output.escalationChain,
      collateralDamage: result.output.collateralDamage,
      riskAssessment: result.output.riskAssessment,
      pointOfNoReturn: result.output.pointOfNoReturn,
      phases: result.output.phases,
      resources: result.output.resources,
      timeline: result.output.timeline,
      bypassStrategy: result.output.bypassStrategy,
      bypassTradeoffs: result.output.bypassTradeoffs,
      successCriteria: result.output.successCriteria,
      failureContingency: result.output.failureContingency,
    },
    result.aiRunId
  );

  return { nukeId, strategy: result.output, aiRunId: result.aiRunId };
}
