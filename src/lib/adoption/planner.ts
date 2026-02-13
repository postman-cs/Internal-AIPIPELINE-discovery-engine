/**
 * AI Adoption Planner — generates team-specific onboarding playbooks,
 * CI/CD integration blueprints, drip campaigns, and wave strategies.
 *
 * Covers features: 14 (Onboarding Playbook), 15 (Integration Blueprint),
 * plus AI-generated drip campaigns and wave planning.
 */

import { prisma } from "@/lib/prisma";
import { runAgent } from "@/lib/ai/agents/runner";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { retrieveMultiQueryEvidence, formatEvidenceForPrompt } from "@/lib/ai/retrieval";

// ═══════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════

const onboardingPlaybookSchema = z.object({
  teamName: z.string(),
  phases: z.array(z.object({
    name: z.string(),
    duration: z.string(),
    objectives: z.array(z.string()),
    actions: z.array(z.object({
      action: z.string(),
      owner: z.string(),
      deliverable: z.string(),
    })),
    successCriteria: z.string(),
  })),
  quickWins: z.array(z.object({
    title: z.string(),
    timeToValue: z.string(),
    steps: z.array(z.string()),
  })),
  trainingPlan: z.array(z.object({
    topic: z.string(),
    format: z.string(),
    audience: z.string(),
    duration: z.string(),
  })),
  riskMitigations: z.array(z.object({
    risk: z.string(),
    mitigation: z.string(),
  })),
});

const integrationBlueprintSchema = z.object({
  teamName: z.string(),
  ciPlatform: z.string(),
  pipelineConfig: z.string(),
  setupSteps: z.array(z.object({
    order: z.number(),
    step: z.string(),
    command: z.string().optional(),
    notes: z.string().optional(),
  })),
  environmentConfig: z.object({
    environments: z.array(z.object({
      name: z.string(),
      variables: z.array(z.object({ key: z.string(), value: z.string(), secret: z.boolean() })),
    })),
  }),
  newmanConfig: z.object({
    command: z.string(),
    reporters: z.array(z.string()),
    flags: z.array(z.string()),
  }),
  advancedFeatures: z.array(z.object({
    feature: z.string(),
    description: z.string(),
    setupInstructions: z.string(),
  })),
});

const dripCampaignDesignSchema = z.object({
  name: z.string(),
  targetAudience: z.string(),
  cadence: z.string(),
  steps: z.array(z.object({
    stepNumber: z.number(),
    title: z.string(),
    channel: z.string(),
    content: z.string(),
    delayDays: z.number(),
    callToAction: z.string(),
    resources: z.array(z.string()),
  })),
  nudgeTriggers: z.array(z.object({
    event: z.string(),
    message: z.string(),
    channel: z.string(),
    urgency: z.string(),
  })),
});

const wideAdoptionStrategySchema = z.object({
  waves: z.array(z.object({
    waveNumber: z.number(),
    name: z.string(),
    description: z.string(),
    targetTeams: z.array(z.string()),
    duration: z.string(),
    goNoGoGate: z.array(z.object({
      criterion: z.string(),
      met: z.boolean(),
      evidence: z.string(),
    })),
    dripCampaignName: z.string(),
  })),
  championStrategy: z.object({
    identificationCriteria: z.array(z.string()),
    enablementPlan: z.array(z.string()),
    recognitionProgram: z.string(),
  }),
  executiveCommunicationPlan: z.array(z.object({
    cadence: z.string(),
    audience: z.string(),
    format: z.string(),
    keyMetrics: z.array(z.string()),
  })),
  competitiveDisplacementNotes: z.array(z.object({
    team: z.string(),
    currentTool: z.string(),
    strategy: z.string(),
  })),
  riskFactors: z.array(z.object({
    risk: z.string(),
    likelihood: z.string(),
    impact: z.string(),
    mitigation: z.string(),
  })),
});

// ═══════════════════════════════════════════════════════════════════════════
// 14. AI Onboarding Playbook Generator
// ═══════════════════════════════════════════════════════════════════════════

export async function generateOnboardingPlaybook(teamId: string) {
  const team = await prisma.adoptionTeam.findUnique({
    where: { id: teamId },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!team) return { error: "Team not found" };

  const evidence = await retrieveMultiQueryEvidence(team.projectId, [
    `${team.project.name} ${team.name} API testing onboarding`,
    `${team.project.name} ${team.ciPlatform ?? "CI/CD"} integration setup`,
  ]);

  const result = await runAgent({
    agentType: "onboarding-playbook-generator",
    projectId: team.projectId,
    systemPrompt: `You are an expert Postman Enterprise adoption strategist. Generate a detailed, team-specific onboarding playbook. The playbook must be immediately actionable with concrete steps, clear owners, and success criteria. Focus on quick wins first, then progressive deepening. Respond with valid JSON.`,
    userPrompt: `Generate an onboarding playbook for:
Team: ${team.name} | Department: ${team.department ?? "Unknown"} | Size: ${team.teamSize}
CI/CD: ${team.ciPlatform ?? "Unknown"} | Language: ${team.primaryLanguage ?? "Unknown"}
Current tools: ${JSON.stringify(team.existingTools ?? [])}
Complexity: ${team.integrationComplexity ?? "medium"}
Champion: ${team.championName ?? "None identified"}
Resistance: ${team.resistanceLevel} ${team.resistanceNotes ? `— ${team.resistanceNotes}` : ""}

Evidence:\n${formatEvidenceForPrompt(evidence)}`,
    outputSchema: onboardingPlaybookSchema,
    skipAssumptionInjection: true,
  });

  await prisma.adoptionTeam.update({
    where: { id: teamId },
    data: { onboardingPlaybookJson: result.output as unknown as Prisma.InputJsonValue },
  });

  return { success: true, playbook: result.output, aiRunId: result.aiRunId };
}

// ═══════════════════════════════════════════════════════════════════════════
// 15. AI Integration Blueprint Generator
// ═══════════════════════════════════════════════════════════════════════════

export async function generateIntegrationBlueprint(teamId: string) {
  const team = await prisma.adoptionTeam.findUnique({
    where: { id: teamId },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!team) return { error: "Team not found" };

  const evidence = await retrieveMultiQueryEvidence(team.projectId, [
    `${team.project.name} ${team.ciPlatform ?? "CI/CD"} pipeline configuration`,
    `${team.project.name} Newman integration ${team.ciPlatform ?? ""}`,
  ]);

  const result = await runAgent({
    agentType: "integration-blueprint-generator",
    projectId: team.projectId,
    systemPrompt: `You are a CI/CD integration expert specializing in Postman and Newman. Generate a detailed, copy-paste-ready integration blueprint for a specific team's CI/CD platform. Include actual pipeline configuration YAML/Groovy/etc, Newman commands, and environment setup. Be platform-specific and actionable. Respond with valid JSON.`,
    userPrompt: `Generate a CI/CD integration blueprint for:
Team: ${team.name} | CI Platform: ${team.ciPlatform ?? "Unknown (suggest GitHub Actions)"}
Language: ${team.primaryLanguage ?? "Unknown"} | Team Size: ${team.teamSize}
Current tools: ${JSON.stringify(team.existingTools ?? [])}
Complexity: ${team.integrationComplexity ?? "medium"}

Evidence:\n${formatEvidenceForPrompt(evidence)}`,
    outputSchema: integrationBlueprintSchema,
    skipAssumptionInjection: true,
  });

  await prisma.adoptionTeam.update({
    where: { id: teamId },
    data: { integrationBlueprintJson: result.output as unknown as Prisma.InputJsonValue },
  });

  return { success: true, blueprint: result.output, aiRunId: result.aiRunId };
}

// ═══════════════════════════════════════════════════════════════════════════
// AI Drip Campaign Designer
// ═══════════════════════════════════════════════════════════════════════════

export async function designDripCampaign(
  projectId: string,
  targetAudience: string,
  waveId?: string
) {
  const evidence = await retrieveMultiQueryEvidence(projectId, [
    `${targetAudience} API testing adoption enablement`,
    `${targetAudience} Postman training onboarding`,
  ]);

  const result = await runAgent({
    agentType: "drip-campaign-designer",
    projectId,
    systemPrompt: `You are a developer adoption marketing expert. Design a drip campaign — an automated sequence of enablement content that takes a team from unaware to fully adopted. Each step should have a specific channel, compelling content, clear call to action, and appropriate timing. Include event-based nudge triggers. Respond with valid JSON.`,
    userPrompt: `Design a drip campaign for: ${targetAudience}
Evidence:\n${formatEvidenceForPrompt(evidence)}`,
    outputSchema: dripCampaignDesignSchema,
    skipAssumptionInjection: true,
  });

  // Persist the campaign
  const campaign = await prisma.dripCampaign.create({
    data: {
      projectId,
      waveId: waveId ?? null,
      name: result.output.name,
      targetAudience: result.output.targetAudience,
      cadence: result.output.cadence,
      totalSteps: result.output.steps.length,
      stepsJson: result.output.steps as unknown as Prisma.InputJsonValue,
      nudgeTriggersJson: result.output.nudgeTriggers as unknown as Prisma.InputJsonValue,
      aiGenerated: true,
      aiRunId: result.aiRunId,
      status: "draft",
    },
  });

  return { success: true, campaignId: campaign.id, campaign: result.output, aiRunId: result.aiRunId };
}

// ═══════════════════════════════════════════════════════════════════════════
// AI Wide Adoption Strategy Generator
// ═══════════════════════════════════════════════════════════════════════════

export async function generateWideAdoptionStrategy(projectId: string) {
  const [teams, waves, evidence] = await Promise.all([
    prisma.adoptionTeam.findMany({ where: { projectId } }),
    prisma.adoptionWave.findMany({ where: { projectId }, orderBy: { waveNumber: "asc" } }),
    retrieveMultiQueryEvidence(projectId, [
      "organizational structure teams departments",
      "API adoption strategy enterprise rollout",
      "CI/CD pipeline infrastructure teams",
    ]),
  ]);

  const teamSummary = teams.map((t) =>
    `- ${t.name} (${t.department ?? "?"}, size: ${t.teamSize}, CI: ${t.ciPlatform ?? "?"}, stage: ${t.adoptionStage}, tools: ${JSON.stringify(t.existingTools ?? [])})`
  ).join("\n");

  const result = await runAgent({
    agentType: "wide-adoption-strategist",
    projectId,
    systemPrompt: `You are an expert enterprise adoption strategist specializing in Postman Enterprise rollouts across large organizations. Design a comprehensive wide adoption strategy with escalating waves, champion programs, executive communication plans, and competitive displacement strategies. Each wave should be bigger and faster than the last — building like a tide. Respond with valid JSON.`,
    userPrompt: `Design a wide adoption strategy for this organization:

Teams (${teams.length} total):
${teamSummary}

Existing waves: ${waves.length > 0 ? waves.map((w) => `Wave ${w.waveNumber}: ${w.name} (${w.status})`).join(", ") : "None planned yet"}

Evidence:\n${formatEvidenceForPrompt(evidence)}`,
    outputSchema: wideAdoptionStrategySchema,
    skipAssumptionInjection: true,
  });

  return { success: true, strategy: result.output, aiRunId: result.aiRunId };
}
