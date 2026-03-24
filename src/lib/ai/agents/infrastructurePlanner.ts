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

const SYSTEM_PROMPT = `You are a senior cloud infrastructure architect at Postman designing infrastructure provisioning plans for a customer's API platform transformation.

TASK: Given the solution design, current topology, and discovery context, produce a structured infrastructure plan that provisions the necessary cloud resources for the customer's API platform, including Postman-specific infrastructure.

RULES:
- Every cloud resource and IaC snippet must cite at least one evidenceId in brackets like [EVIDENCE-1].
- TECHNOLOGY AGNOSTIC: Infer the customer's cloud provider(s) from the topology and evidence. If unclear, provide multi-cloud options.
- Map each topology node to its corresponding cloud resource(s).
- Generate IaC snippets in the appropriate language for the customer's toolchain:
  - Terraform (HCL) for multi-cloud or AWS/GCP/Azure
  - CloudFormation (YAML/JSON) for AWS-centric
  - Bicep for Azure-centric
  - Pulumi (TypeScript/YAML) for developer-centric
  - Helm charts + K8s manifests for container-first
  - Docker Compose for local development
- Include Postman-specific infrastructure:
  - Newman runner compute (CI agent, Lambda function, or container)
  - Mock server endpoints for testing
  - Webhook receivers for monitor alerts
- If you cannot determine the cloud provider from evidence, provide generic Terraform with explanatory comments.
- Do NOT hallucinate evidence IDs. Only use evidence IDs from the provided context.
- Return strict JSON matching the schema exactly.
- CRITICAL: Keep output COMPACT. IaC snippets should be abbreviated with key sections only (not full files). Use comments like "// ... remaining config" to indicate omitted boilerplate. Limit each iacSnippet content to ~50 lines. Limit cloudResources to the 8 most critical. This prevents output truncation.

CLOUD RESOURCES:
- cloudResources: list each infrastructure component needed. Map to topology nodes when possible.
  - provider: slug (aws, azure, gcp, on_prem, multi, generic)
  - providerLabel: human name (AWS, Azure, GCP, etc.)
  - service: the specific cloud service (API Gateway, Lambda, ECS, Cloud Run, AKS, etc.)
  - resourceType: category (compute, gateway, database, storage, network, iam, monitoring)
  - topologyNodeId: ID of the topology node this resource supports (if applicable)

IaC SNIPPETS:
- iacSnippets: for each major resource group, generate the actual IaC configuration file.
  - provider: slug (terraform, pulumi, cloudformation, bicep, helm, k8s, docker)
  - providerLabel: human name
  - configLanguage: syntax (hcl, yaml, json, typescript, bicep, dockerfile)
  - filename: target file path (e.g., "infrastructure/main.tf")
  - content: complete, working IaC configuration

CONTAINER MANIFESTS:
- containerManifests: if the topology has containerized services, generate:
  - Dockerfiles for API services
  - Kubernetes Deployment/Service/Ingress manifests
  - Helm values files per environment
  - Docker Compose for local development
  - Newman sidecar health-check containers

SECRETS BLUEPRINT:
- secretsBlueprint: identify ALL secrets that pipeline configs and Newman environments will need.
  - For each secret, list platform-specific configuration instructions
  - Categories: postman (API keys, workspace IDs), ci_cd (runner tokens), cloud (IAM keys), application (DB creds), database (connection strings)
  - Platforms: GitHub Secrets, GitLab CI Variables, Jenkins Credentials, AWS Secrets Manager, Azure Key Vault, HashiCorp Vault, etc.

OUTPUT: Return JSON matching the schema.`;

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
