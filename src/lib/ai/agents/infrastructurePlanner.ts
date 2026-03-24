/**
 * Infrastructure Planner Agent (Feature #9, #10, #11, #12)
 *
 * Phase: INFRASTRUCTURE
 * Input: SOLUTION_DESIGN output, CURRENT_TOPOLOGY, DISCOVERY findings
 * Output: Cloud resources, IaC snippets, container manifests, secrets blueprint
 *
 * Technology-agnostic: generates IaC for whatever cloud/platform the customer uses.
 * Every claim must cite evidenceIds. Zod validated.
 */

import { runAgent } from "./runner";
import {
  infrastructureOutputSchema,
  type InfrastructureOutput,
  type AssumptionItem,
  type BlockerDetection,
} from "./topologyTypes";
import {
  retrieveMultiQueryEvidence,
  formatEvidenceForPrompt,
} from "@/lib/ai/retrieval";

const SYSTEM_PROMPT = `You are a cloud infrastructure architect producing a COMPACT infrastructure plan.

CRITICAL OUTPUT RULES:
- Return a FLAT JSON object with these top-level keys: cloudResources, iacSnippets, containerManifests, secretsBlueprint, provisioningOrder, estimatedMonthlyCost, notes
- Do NOT nest under wrapper keys like "infrastructurePlan" or "projectName"
- Maximum 5 cloudResources (most critical only)
- Maximum 2 iacSnippets (key config files, max 30 lines each, use "// ..." for omitted parts)
- Maximum 2 containerManifests (max 20 lines each)
- Maximum 5 secretsBlueprint items
- Keep ALL string values SHORT (1-2 sentences max)
- Cite evidence as [EVIDENCE-N]
- Do NOT hallucinate evidence IDs

cloudResources array: { name, provider (aws|azure|gcp|on_prem|generic), providerLabel, service, resourceType (compute|gateway|database|storage|network|iam|monitoring), description, topologyNodeId, evidenceIds, estimatedCost }
iacSnippets array: { provider (terraform|helm|k8s|docker), providerLabel, configLanguage (hcl|yaml|dockerfile), filename, description, content }
containerManifests array: { name, type (dockerfile|k8s_deployment|helm_values|docker_compose), filename, content }
secretsBlueprint array: { name, category (postman|ci_cd|cloud|application|database), description, platforms }
provisioningOrder: string array of resource names in deploy order
estimatedMonthlyCost: string
notes: string array (max 3)

OUTPUT: Return ONLY the flat JSON. Start with { and end with }.`;

export async function runInfrastructurePlanner(
  projectId: string,
  projectName: string,
  solutionContent: Record<string, unknown>,
  topologyContent: Record<string, unknown>,
  discoveryContent: Record<string, unknown>
): Promise<{ output: InfrastructureOutput; aiRunId: string; assumptions: AssumptionItem[]; detectedBlockers: BlockerDetection[] }> {
  const evidence = await retrieveMultiQueryEvidence(projectId, [
    "cloud infrastructure AWS Azure GCP hosting",
    "Kubernetes Docker containers orchestration",
    "Terraform Pulumi CloudFormation IaC infrastructure",
    "secrets management vault credentials API keys",
    "CI/CD deployment pipeline infrastructure",
  ]);

  const evidenceBlock = formatEvidenceForPrompt(evidence);

  const userPrompt = `## Project: ${projectName}

## Solution Design
${JSON.stringify(solutionContent, null, 2).slice(0, 3000)}

## Current Topology
${JSON.stringify(topologyContent, null, 2).slice(0, 3000)}

## Discovery Context
${JSON.stringify(discoveryContent, null, 2).slice(0, 2000)}

## Evidence
${evidenceBlock}

Produce a JSON infrastructure plan with: cloudResources (mapped to topology nodes), iacSnippets (in the customer's preferred IaC language), containerManifests (if containerized), secretsBlueprint (all needed secrets with platform-specific setup), provisioningOrder, estimatedMonthlyCost, notes.`;

  const result = await runAgent<InfrastructureOutput>({
    agentType: "infrastructurePlanner",
    projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: infrastructureOutputSchema,
  });

  return { output: result.output, aiRunId: result.aiRunId, assumptions: result.assumptions, detectedBlockers: result.detectedBlockers };
}
