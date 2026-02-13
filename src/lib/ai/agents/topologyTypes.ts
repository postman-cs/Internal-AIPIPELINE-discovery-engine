/**
 * Zod schemas for topology and downstream phase agents.
 *
 * Phases: CURRENT_TOPOLOGY, DESIRED_FUTURE_STATE, SOLUTION_DESIGN,
 *         TEST_DESIGN, CRAFT_SOLUTION, TEST_SOLUTION
 *
 * All outputs are strict JSON validated by Zod. Every claim cites evidenceIds.
 */

import { z } from "zod";

const Confidence = z.enum(["High", "Medium", "Low"]);

// ---------------------------------------------------------------------------
// Shared topology primitives
// ---------------------------------------------------------------------------

export const TopologyNodeTypeZ = z.enum([
  "SERVICE", "API", "GATEWAY", "DATABASE", "IDENTITY_PROVIDER",
  "CDN", "LOAD_BALANCER", "CLIENT", "EXTERNAL_SYSTEM", "QUEUE", "STORAGE",
]);

export const TopologyEdgeTypeZ = z.enum([
  "CALLS", "AUTHENTICATES_WITH", "ROUTES_THROUGH",
  "READS_FROM", "WRITES_TO", "DEPENDS_ON",
]);

// ---------------------------------------------------------------------------
// 1. Current Topology Builder
// ---------------------------------------------------------------------------

export const topologyNodeSchema = z.object({
  id: z.string(),
  type: TopologyNodeTypeZ,
  name: z.string(),
  metadata: z.record(z.unknown()).optional(),
  evidenceIds: z.array(z.string()),
  confidence: Confidence,
});

export const topologyEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: TopologyEdgeTypeZ,
  evidenceIds: z.array(z.string()),
  confidence: Confidence,
});

export const currentTopologyOutputSchema = z.object({
  nodes: z.array(topologyNodeSchema),
  edges: z.array(topologyEdgeSchema),
  reasoningSummary: z.string(),
});

export type CurrentTopologyOutput = z.infer<typeof currentTopologyOutputSchema>;

// ---------------------------------------------------------------------------
// 2. Desired Future State Designer
// ---------------------------------------------------------------------------

export const futureStateOutputSchema = z.object({
  targetNodes: z.array(topologyNodeSchema),
  targetEdges: z.array(topologyEdgeSchema),
  deltaSummary: z.string(),
  recommendedPatterns: z.array(z.string()),
  evidenceIds: z.array(z.string()),
});

export type FutureStateOutput = z.infer<typeof futureStateOutputSchema>;

// ---------------------------------------------------------------------------
// 3. Solution Designer
// ---------------------------------------------------------------------------

export const refactorActionSchema = z.object({
  actionType: z.enum(["ADD", "REMOVE", "MODIFY"]),
  targetComponent: z.string(),
  description: z.string(),
  impactAnalysis: z.string(),
  evidenceIds: z.array(z.string()),
  confidence: Confidence,
});

export const solutionDesignOutputSchema = z.object({
  refactorActions: z.array(refactorActionSchema),
  rolloutPhases: z.array(z.string()),
  risks: z.array(z.string()),
});

export type SolutionDesignOutput = z.infer<typeof solutionDesignOutputSchema>;

// ---------------------------------------------------------------------------
// 3b. Infrastructure Planner (Feature #9, #10, #11, #12)
// ---------------------------------------------------------------------------

export const cloudResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),          // aws, azure, gcp, on_prem, multi, generic
  providerLabel: z.string(),     // "AWS", "Azure", "GCP", "On-Premises", "Multi-Cloud"
  service: z.string(),           // e.g. "API Gateway", "Lambda", "ECS", "Cloud Run", "AKS"
  resourceType: z.string(),      // e.g. "compute", "gateway", "database", "storage", "network", "iam"
  topologyNodeId: z.string().optional(), // maps to a topology node
  provisioningStatus: z.enum(["not_provisioned", "planned", "provisioned", "drifted"]),
  configLanguage: z.string(),    // hcl, yaml, bicep, json, etc.
  evidenceIds: z.array(z.string()),
  confidence: Confidence,
});

export const iacSnippetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  provider: z.string(),          // slug: terraform, pulumi, cloudformation, bicep, helm, k8s, docker
  providerLabel: z.string(),     // "Terraform", "Pulumi", "CloudFormation", "Bicep", "Helm", "Kubernetes", "Docker"
  configLanguage: z.string(),    // hcl, yaml, json, typescript, bicep, dockerfile
  filename: z.string(),          // e.g. "main.tf", "k8s/deployment.yaml", "Dockerfile"
  content: z.string(),           // the actual IaC config content
  targetResources: z.array(z.string()), // cloudResource IDs this manages
});

export const containerManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(["dockerfile", "k8s_manifest", "helm_values", "compose", "k8s_service", "k8s_ingress"]),
  filename: z.string(),
  content: z.string(),
  targetService: z.string().optional(), // topology node ID
});

export const secretsBlueprintItemSchema = z.object({
  secretName: z.string(),        // e.g. "POSTMAN_API_KEY", "DB_PASSWORD"
  description: z.string(),
  required: z.boolean(),
  category: z.enum(["postman", "ci_cd", "cloud", "application", "database"]),
  platforms: z.array(z.object({
    platform: z.string(),        // github_actions, gitlab_ci, aws_secrets_manager, vault, etc.
    platformLabel: z.string(),
    configPath: z.string(),      // where to configure it (e.g. "Settings > Secrets > Actions")
    configSnippet: z.string().optional(), // optional setup snippet
  })),
});

export const infrastructureOutputSchema = z.object({
  cloudResources: z.array(cloudResourceSchema),
  iacSnippets: z.array(iacSnippetSchema),
  containerManifests: z.array(containerManifestSchema).optional(),
  secretsBlueprint: z.array(secretsBlueprintItemSchema).optional(),
  provisioningOrder: z.array(z.string()),    // ordered resource IDs for provisioning
  estimatedMonthlyCost: z.string().optional(),
  notes: z.array(z.string()),
});

export type InfrastructureOutput = z.infer<typeof infrastructureOutputSchema>;

// ---------------------------------------------------------------------------
// 4. Test Designer
// ---------------------------------------------------------------------------

export const testCaseSchema = z.object({
  name: z.string(),
  objective: z.string(),
  targetComponentId: z.string(),
  testType: z.enum(["Smoke", "Integration", "Contract", "Load"]),
  steps: z.array(z.string()),
  expectedResult: z.string(),
  evidenceIds: z.array(z.string()),
  postmanTestScript: z.string().optional(),  // pm.test("...") assertion snippet
  newmanCommand: z.string().optional(),      // CLI invocation string
});

export const testDesignOutputSchema = z.object({
  testCases: z.array(testCaseSchema),
  coverageSummary: z.string(),
});

export type TestDesignOutput = z.infer<typeof testDesignOutputSchema>;

// ---------------------------------------------------------------------------
// 5. Craft Solution
// ---------------------------------------------------------------------------

// CI/CD platform identifier — open string to support any CI/CD system.
// Agents supply a slug (e.g. "github_actions", "circleci", "azure_devops"),
// a human-readable label, and the config language for rendering.
export const CiCdPlatformZ = z.string().min(1);

export const postmanCollectionStubSchema = z.object({
  name: z.string(),
  description: z.string(),
  folders: z.array(z.object({
    name: z.string(),
    requests: z.array(z.object({
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]),
      name: z.string(),
      urlPattern: z.string(),
      description: z.string(),
    })),
  })),
});

export const newmanRunConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  collectionRef: z.string(),       // references postmanCollections[].name
  environmentRef: z.string(),      // e.g. "staging", "production"
  iterationCount: z.number().optional(),
  reporters: z.array(z.string()),  // ["cli","junit","htmlextra"]
  bailOnFailure: z.boolean(),
});

export const ciCdPipelineSchema = z.object({
  platform: CiCdPlatformZ,         // slug, e.g. "github_actions", "circleci"
  platformLabel: z.string(),       // human-readable, e.g. "GitHub Actions"
  configLanguage: z.string(),      // syntax hint, e.g. "yaml", "groovy", "hcl", "toml", "json"
  filename: z.string(),            // e.g. "postman-api-tests.yml"
  description: z.string(),
  configContent: z.string(),       // the actual config file content
});

export const craftSolutionOutputSchema = z.object({
  implementationPlan: z.array(z.object({
    step: z.number(),
    title: z.string(),
    description: z.string(),
    targetComponents: z.array(z.string()),
    evidenceIds: z.array(z.string()),
  })),
  migrationSteps: z.array(z.string()),
  ciCdNotes: z.array(z.string()),
  estimatedEffort: z.string(),
  postmanCollections: z.array(postmanCollectionStubSchema).optional(),
  newmanRunConfigs: z.array(newmanRunConfigSchema).optional(),
  ciCdPipelines: z.array(ciCdPipelineSchema).optional(),
});

export type CraftSolutionOutput = z.infer<typeof craftSolutionOutputSchema>;

// ---------------------------------------------------------------------------
// 6. Test Solution
// ---------------------------------------------------------------------------

export const testSolutionOutputSchema = z.object({
  executionSequence: z.array(z.object({
    order: z.number(),
    testCaseName: z.string(),
    prerequisites: z.array(z.string()),
    estimatedDuration: z.string(),
  })),
  rollbackTriggers: z.array(z.object({
    condition: z.string(),
    action: z.string(),
    severity: z.enum(["Critical", "High", "Medium", "Low"]),
  })),
  monitoringHooks: z.array(z.object({
    metric: z.string(),
    threshold: z.string(),
    alertAction: z.string(),
  })),
  overallReadiness: z.string(),
});

export type TestSolutionOutput = z.infer<typeof testSolutionOutputSchema>;

// ---------------------------------------------------------------------------
// 7. Deployment Plan
// ---------------------------------------------------------------------------

export const deploymentStepSchema = z.object({
  phase: z.string(),
  title: z.string(),
  description: z.string(),
  targetComponents: z.array(z.string()),
  prerequisites: z.array(z.string()),
  rollbackPlan: z.string(),
  estimatedDuration: z.string(),
  evidenceIds: z.array(z.string()),
});

export const ciCdStageSchema = z.object({
  stageName: z.string(),
  platform: CiCdPlatformZ,         // slug
  platformLabel: z.string(),       // human-readable
  configLanguage: z.string(),      // syntax hint for rendering
  triggerCondition: z.string(),
  configSnippet: z.string(),       // config snippet in the platform's native syntax
  gateChecks: z.array(z.string()),
});

export const environmentPromotionGateSchema = z.object({
  fromEnv: z.string(),
  toEnv: z.string(),
  requiredChecks: z.array(z.string()),
  approvalRequired: z.boolean(),
  newmanSuiteRef: z.string().optional(),  // which newman config must pass
});

export const deploymentPlanOutputSchema = z.object({
  deploymentSteps: z.array(deploymentStepSchema),
  changeManagementNotes: z.array(z.string()),
  trainingRequirements: z.array(z.object({
    audience: z.string(),
    topic: z.string(),
    format: z.string(),
    evidenceIds: z.array(z.string()),
  })),
  communicationPlan: z.array(z.object({
    stakeholder: z.string(),
    message: z.string(),
    timing: z.string(),
  })),
  goLiveCriteria: z.array(z.string()),
  overallTimeline: z.string(),
  ciCdStages: z.array(ciCdStageSchema).optional(),
  environmentPromotionGates: z.array(environmentPromotionGateSchema).optional(),
});

export type DeploymentPlanOutput = z.infer<typeof deploymentPlanOutputSchema>;

// ---------------------------------------------------------------------------
// 8. Monitoring
// ---------------------------------------------------------------------------

export const monitorSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["SLO", "Alert", "HealthCheck", "SentimentTracker", "UsageMetric"]),
  targetComponentId: z.string(),
  description: z.string(),
  threshold: z.string().optional(),
  frequency: z.string(),
  evidenceIds: z.array(z.string()),
  confidence: Confidence,
});

export const postmanMonitorSchema = z.object({
  name: z.string(),
  collectionRef: z.string(),
  environmentRef: z.string(),
  schedule: z.string(),              // e.g. "every 5 minutes"
  regions: z.array(z.string()),      // e.g. ["us-east-1","eu-west-1"]
  alertChannels: z.array(z.string()),
  targetComponentId: z.string(),
});

export const monitoringOutputSchema = z.object({
  monitors: z.array(monitorSchema),
  sloDefinitions: z.array(z.object({
    name: z.string(),
    targetComponentId: z.string(),
    metric: z.string(),
    target: z.string(),
    window: z.string(),
    evidenceIds: z.array(z.string()),
  })),
  alertRules: z.array(z.object({
    name: z.string(),
    condition: z.string(),
    severity: z.enum(["Critical", "High", "Medium", "Low"]),
    action: z.string(),
    targetComponentId: z.string(),
  })),
  dashboardSpec: z.object({
    panels: z.array(z.object({
      title: z.string(),
      metricQuery: z.string(),
      visualizationType: z.string(),
    })),
  }),
  renewalSignals: z.array(z.object({
    signal: z.string(),
    indicator: z.enum(["Positive", "Negative", "Neutral"]),
    description: z.string(),
    evidenceIds: z.array(z.string()),
  })),
  postmanMonitors: z.array(postmanMonitorSchema).optional(),
});

export type MonitoringOutput = z.infer<typeof monitoringOutputSchema>;

// ---------------------------------------------------------------------------
// 9. Iteration
// ---------------------------------------------------------------------------

export const iterationItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["Enhancement", "BugFix", "Optimization", "NewCapability", "Deprecation", "Investigation"]),
  priority: z.enum(["Critical", "High", "Medium", "Low"]),
  description: z.string(),
  targetComponentIds: z.array(z.string()),
  triggerSource: z.enum(["MonitoringSignal", "UserFeedback", "DriftDetection", "FailureAnalysis", "ProactiveImprovement"]),
  expectedOutcome: z.string(),
  estimatedEffort: z.string(),
  evidenceIds: z.array(z.string()),
  confidence: Confidence,
});

export const iterationOutputSchema = z.object({
  backlogItems: z.array(iterationItemSchema),
  priorityMatrix: z.object({
    criticalPath: z.array(z.string()),
    quickWins: z.array(z.string()),
    strategicInvestments: z.array(z.string()),
    deferred: z.array(z.string()),
  }),
  driftAnalysis: z.object({
    driftDetected: z.boolean(),
    driftAreas: z.array(z.object({
      area: z.string(),
      description: z.string(),
      severity: z.enum(["High", "Medium", "Low"]),
      evidenceIds: z.array(z.string()),
    })),
  }),
  nextCycleRecommendation: z.string(),
});

export type IterationOutput = z.infer<typeof iterationOutputSchema>;

// ---------------------------------------------------------------------------
// Feature #13: Governance Rules Engine
// ---------------------------------------------------------------------------

export const governanceRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum([
    "naming",           // naming conventions
    "auth",             // authentication requirements
    "testing",          // test coverage requirements
    "deployment",       // deployment gate requirements
    "security",         // security policies
    "documentation",    // documentation requirements
    "versioning",       // API versioning policies
  ]),
  severity: z.enum(["blocker", "warning", "info"]),
  check: z.string(),   // what to check (e.g., "all collections must include auth headers")
  autoFixable: z.boolean().default(false),
});

export const governanceResultSchema = z.object({
  ruleId: z.string(),
  ruleName: z.string(),
  severity: z.enum(["blocker", "warning", "info"]),
  passed: z.boolean(),
  message: z.string(),
  affectedArtifacts: z.array(z.string()).optional(),
});

export type GovernanceRule = z.infer<typeof governanceRuleSchema>;
export type GovernanceResult = z.infer<typeof governanceResultSchema>;

// ---------------------------------------------------------------------------
// Feature #19: Contract Testing with OpenAPI Schema Validation
// ---------------------------------------------------------------------------

export const openApiSpecReferenceSchema = z.object({
  apiNodeId: z.string(),         // topology node ID
  specUrl: z.string().optional(), // URL to the OpenAPI spec
  specContent: z.string().optional(), // inline spec content
  specFormat: z.enum(["openapi3", "openapi2", "swagger"]).default("openapi3"),
  lastValidatedAt: z.string().optional(),
  complianceStatus: z.enum(["compliant", "drifted", "unknown"]).default("unknown"),
});

export const contractTestResultSchema = z.object({
  apiNodeId: z.string(),
  endpointPath: z.string(),
  method: z.string(),
  expectedSchema: z.string().optional(),
  actualResponse: z.string().optional(),
  compliant: z.boolean(),
  driftDetails: z.string().optional(),
});

export type OpenApiSpecReference = z.infer<typeof openApiSpecReferenceSchema>;
export type ContractTestResult = z.infer<typeof contractTestResultSchema>;

// ---------------------------------------------------------------------------
// Feature #20: Postman Monitor as Deployment Gate
// ---------------------------------------------------------------------------

export const monitorGateSchema = z.object({
  monitorRef: z.string(),        // Postman monitor UID or name
  environmentRef: z.string(),
  requiredConsecutiveSuccesses: z.number().default(3),
  timeoutMinutes: z.number().default(30),
  rollbackOnFailure: z.boolean().default(true),
  checkIntervalMinutes: z.number().default(5),
});

export type MonitorGate = z.infer<typeof monitorGateSchema>;

// ---------------------------------------------------------------------------
// Human Assumption Verification Schemas
// ---------------------------------------------------------------------------

/**
 * Categories of assumptions that agents surface for human verification.
 * These represent the critical decision points that, if wrong, cascade errors
 * through every downstream phase.
 */
export const assumptionCategoryZ = z.enum([
  "cloud_provider",         // Which cloud provider(s) the customer uses
  "ci_cd_platform",         // Which CI/CD platform(s) are in play
  "api_architecture",       // How the customer's APIs are structured
  "auth_pattern",           // Authentication approach (OAuth, API key, etc.)
  "deployment_model",       // How they deploy (K8s, serverless, VMs, etc.)
  "environment_topology",   // What environments exist (dev/staging/prod/etc.)
  "team_structure",         // How teams are organized around APIs
  "technology_stack",       // Backend tech, frameworks, languages
  "governance_posture",     // How strict their API governance is
  "testing_maturity",       // Current testing practices
  "security_requirements",  // Compliance, data residency, etc.
  "integration_pattern",    // How services communicate (REST, gRPC, events, etc.)
  "scale_requirements",     // Traffic volume, latency targets
  "migration_constraint",   // Constraints on migration (downtime tolerance, etc.)
  "business_priority",      // What the customer cares about most
  "other",                  // Catch-all
]);

export type AssumptionCategory = z.infer<typeof assumptionCategoryZ>;

/**
 * A single assumption surfaced by an AI agent for human verification.
 */
export const assumptionSchema = z.object({
  category: assumptionCategoryZ,
  claim: z.string(),                      // What the AI assumes to be true
  reasoning: z.string(),                  // Why the AI believes this
  confidence: z.enum(["High", "Medium", "Low"]),
  evidenceIds: z.array(z.string()),       // Evidence supporting this
  impact: z.string(),                     // What goes wrong if this is wrong
  blocksPhases: z.array(z.string()),      // Which downstream phases depend on this being correct
  suggestedVerification: z.string().optional(), // How the human can verify this
});

export type AssumptionItem = z.infer<typeof assumptionSchema>;

/**
 * The assumptions block that every phase agent appends to its output.
 */
export const phaseAssumptionsSchema = z.object({
  assumptions: z.array(assumptionSchema),
});

export type PhaseAssumptions = z.infer<typeof phaseAssumptionsSchema>;

/**
 * A verified assumption that gets fed back as a constraint to downstream agents.
 */
export const verifiedAssumptionConstraintSchema = z.object({
  category: assumptionCategoryZ,
  originalClaim: z.string(),
  verifiedClaim: z.string(),              // May differ if human corrected it
  status: z.enum(["verified", "corrected", "rejected"]),
  verifiedBy: z.string(),                 // userId
  phase: z.string(),                      // Which phase surfaced this
});

export type VerifiedAssumptionConstraint = z.infer<typeof verifiedAssumptionConstraintSchema>;

// ---------------------------------------------------------------------------
// Blocker System Schemas: Map → Missile → Nuke
// ---------------------------------------------------------------------------

export const blockerDomainZ = z.enum([
  "technical",
  "organizational",
  "political",
  "process",
  "knowledge",
  "security",
  "licensing",
  "cultural",
]);
export type BlockerDomainType = z.infer<typeof blockerDomainZ>;

export const blockerSeverityZ = z.enum(["low", "medium", "high", "critical"]);
export type BlockerSeverityType = z.infer<typeof blockerSeverityZ>;

/**
 * A blocker surfaced by an AI agent during phase analysis.
 */
export const blockerDetectionSchema = z.object({
  title: z.string(),
  description: z.string(),
  domain: blockerDomainZ,
  severity: blockerSeverityZ,
  rootCause: z.string(),
  rootCauseCategory: z.enum([
    "technical_limitation", "org_policy", "person",
    "budget", "process", "knowledge_gap", "unknown",
  ]),
  blockedCapabilities: z.array(z.string()),
  blockedPhases: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  suggestedMissile: z.string().optional(),  // Quick initial idea for intervention
  suggestedNukeRationale: z.string().optional(), // When would the nuke option be needed
});

export type BlockerDetection = z.infer<typeof blockerDetectionSchema>;

/**
 * AI-generated missile design for a specific blocker.
 */
export const missileDesignSchema = z.object({
  name: z.string(),
  strategy: z.string(),
  targetAudience: z.string(),
  talkingPoints: z.array(z.object({
    point: z.string(),
    supportingEvidence: z.string(),
    expectedObjection: z.string().optional(),
    rebuttal: z.string().optional(),
  })),
  actionSteps: z.array(z.object({
    order: z.number(),
    action: z.string(),
    owner: z.string(),        // Who executes this step
    deliverable: z.string().optional(),
    timeline: z.string(),
  })),
  deliverables: z.array(z.object({
    type: z.string(),         // deck, demo, POC, document, email, meeting
    description: z.string(),
    effort: z.string(),
  })),
  estimatedEffort: z.string(),
  successCriteria: z.string(),
  fallbackPlan: z.string(),
  probabilityOfSuccess: z.enum(["high", "medium", "low"]),
});

export type MissileDesign = z.infer<typeof missileDesignSchema>;

/**
 * AI-generated nuke strategy for an entrenched blocker.
 */
export const nukeStrategySchema = z.object({
  name: z.string(),
  rationale: z.string(),
  strategy: z.string(),
  escalationChain: z.array(z.object({
    order: z.number(),
    person: z.string(),       // Name or role
    role: z.string(),
    approach: z.string(),     // How to approach this person
    keyMessage: z.string(),
  })),
  collateralDamage: z.array(z.object({
    area: z.string(),
    impact: z.string(),
    mitigation: z.string(),
  })),
  riskAssessment: z.string(),
  pointOfNoReturn: z.string(),
  phases: z.array(z.object({
    order: z.number(),
    name: z.string(),
    actions: z.array(z.string()),
    duration: z.string(),
    successGate: z.string(),  // What must be true before moving to next phase
  })),
  resources: z.array(z.object({
    type: z.string(),         // person, budget, tool, executive_time
    description: z.string(),
    availability: z.string(),
  })),
  timeline: z.string(),
  bypassStrategy: z.string(),
  bypassTradeoffs: z.string(),
  successCriteria: z.string(),
  failureContingency: z.string(),
});

export type NukeStrategy = z.infer<typeof nukeStrategySchema>;

// ---------------------------------------------------------------------------
// Markdown generators for proposals
// ---------------------------------------------------------------------------

export function topologyToMarkdown(output: CurrentTopologyOutput): string {
  const nodeRows = output.nodes
    .map((n) => `| ${n.name} | ${n.type} | ${n.confidence} | ${n.evidenceIds.join(", ")} |`)
    .join("\n");
  const edgeRows = output.edges
    .map((e) => `| ${e.from} → ${e.to} | ${e.type} | ${e.confidence} | ${e.evidenceIds.join(", ")} |`)
    .join("\n");

  return `# Current Topology

## Nodes
| Name | Type | Confidence | Evidence |
|------|------|------------|----------|
${nodeRows}

## Edges
| Connection | Type | Confidence | Evidence |
|------------|------|------------|----------|
${edgeRows}

## Reasoning
${output.reasoningSummary}
`;
}

export function futureStateToMarkdown(output: FutureStateOutput): string {
  const nodeRows = output.targetNodes
    .map((n) => `| ${n.name} | ${n.type} | ${n.confidence} | ${n.evidenceIds.join(", ")} |`)
    .join("\n");

  return `# Desired Future State

## Delta Summary
${output.deltaSummary}

## Target Nodes
| Name | Type | Confidence | Evidence |
|------|------|------------|----------|
${nodeRows}

## Recommended Patterns
${output.recommendedPatterns.map((p, i) => `${i + 1}. ${p}`).join("\n")}
`;
}

export function solutionDesignToMarkdown(output: SolutionDesignOutput): string {
  const actionRows = output.refactorActions
    .map((a) => `| ${a.actionType} | ${a.targetComponent} | ${a.description} | ${a.confidence} | ${a.evidenceIds.join(", ")} |`)
    .join("\n");

  return `# Solution Design

## Refactor Actions
| Action | Target | Description | Confidence | Evidence |
|--------|--------|-------------|------------|----------|
${actionRows}

## Rollout Phases
${output.rolloutPhases.map((p, i) => `${i + 1}. ${p}`).join("\n")}

## Risks
${output.risks.map((r) => `- ${r}`).join("\n")}
`;
}

export function testDesignToMarkdown(output: TestDesignOutput): string {
  const caseRows = output.testCases
    .map((t) => `| ${t.name} | ${t.testType} | ${t.targetComponentId} | ${t.objective} |`)
    .join("\n");

  const testScripts = output.testCases
    .filter((t) => t.postmanTestScript)
    .map((t) => `### ${t.name}\n\`\`\`javascript\n${t.postmanTestScript}\n\`\`\`${t.newmanCommand ? `\n\`\`\`bash\n${t.newmanCommand}\n\`\`\`` : ""}`)
    .join("\n\n");

  return `# Test Design

## Test Cases
| Name | Type | Target | Objective |
|------|------|--------|-----------|
${caseRows}
${testScripts ? `\n## Postman Test Scripts & Newman Commands\n${testScripts}` : ""}

## Coverage Summary
${output.coverageSummary}
`;
}

export function craftSolutionToMarkdown(output: CraftSolutionOutput): string {
  const steps = output.implementationPlan
    .map((s) => `### Step ${s.step}: ${s.title}\n${s.description}\n- Components: ${s.targetComponents.join(", ")}`)
    .join("\n\n");

  const collectionsSection = output.postmanCollections?.length
    ? `\n## Postman Collections\n${output.postmanCollections.map((c) => {
        const folders = c.folders.map((f) => {
          const reqs = f.requests.map((r) => `    - **${r.method}** ${r.name}: \`${r.urlPattern}\` — ${r.description}`).join("\n");
          return `  - **${f.name}**\n${reqs}`;
        }).join("\n");
        return `### ${c.name}\n${c.description}\n${folders}`;
      }).join("\n\n")}\n`
    : "";

  const newmanSection = output.newmanRunConfigs?.length
    ? `\n## Newman Run Configurations\n${output.newmanRunConfigs.map((n) => `### ${n.name}\n${n.description}\n- Collection: ${n.collectionRef}\n- Environment: ${n.environmentRef}\n- Reporters: ${n.reporters.join(", ")}\n- Bail on failure: ${n.bailOnFailure ? "Yes" : "No"}`).join("\n\n")}\n`
    : "";

  const pipelinesSection = output.ciCdPipelines?.length
    ? `\n## CI/CD Pipeline Configs\n${output.ciCdPipelines.map((p) => {
        return `### ${p.platformLabel} — \`${p.filename}\`\n${p.description}\n\`\`\`${p.configLanguage}\n${p.configContent}\n\`\`\``;
      }).join("\n\n")}\n`
    : "";

  return `# Craft Solution

## Implementation Plan
${steps}

## Migration Steps
${output.migrationSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## CI/CD Notes
${output.ciCdNotes.map((n) => `- ${n}`).join("\n")}
${collectionsSection}${newmanSection}${pipelinesSection}
## Estimated Effort
${output.estimatedEffort}
`;
}

export function testSolutionToMarkdown(output: TestSolutionOutput): string {
  const seqRows = output.executionSequence
    .map((s) => `| ${s.order} | ${s.testCaseName} | ${s.estimatedDuration} |`)
    .join("\n");

  return `# Test Solution

## Execution Sequence
| Order | Test Case | Duration |
|-------|-----------|----------|
${seqRows}

## Rollback Triggers
${output.rollbackTriggers.map((r) => `- **${r.severity}**: ${r.condition} → ${r.action}`).join("\n")}

## Monitoring Hooks
${output.monitoringHooks.map((m) => `- ${m.metric}: threshold ${m.threshold} → ${m.alertAction}`).join("\n")}

## Overall Readiness
${output.overallReadiness}
`;
}

export function deploymentPlanToMarkdown(output: DeploymentPlanOutput): string {
  const stepRows = output.deploymentSteps
    .map((s) => `| ${s.phase} | ${s.title} | ${s.estimatedDuration} | ${s.evidenceIds.join(", ")} |`)
    .join("\n");

  const stagesSection = output.ciCdStages?.length
    ? `\n## CI/CD Pipeline Stages\n${output.ciCdStages.map((s) => {
        return `### ${s.stageName} (${s.platformLabel})\n- Trigger: ${s.triggerCondition}\n- Gate checks: ${s.gateChecks.join(", ")}\n\`\`\`${s.configLanguage}\n${s.configSnippet}\n\`\`\``;
      }).join("\n\n")}\n`
    : "";

  const gatesSection = output.environmentPromotionGates?.length
    ? `\n## Environment Promotion Gates\n| From | To | Required Checks | Approval | Newman Suite |\n|------|----|----------------|----------|-------------|\n${output.environmentPromotionGates.map((g) => `| ${g.fromEnv} | ${g.toEnv} | ${g.requiredChecks.join("; ")} | ${g.approvalRequired ? "Yes" : "No"} | ${g.newmanSuiteRef || "—"} |`).join("\n")}\n`
    : "";

  return `# Deployment Plan

## Deployment Steps
| Phase | Title | Duration | Evidence |
|-------|-------|----------|----------|
${stepRows}

## Change Management
${output.changeManagementNotes.map((n) => `- ${n}`).join("\n")}

## Training Requirements
${output.trainingRequirements.map((t) => `- **${t.audience}**: ${t.topic} (${t.format})`).join("\n")}
${stagesSection}${gatesSection}
## Go-Live Criteria
${output.goLiveCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

## Overall Timeline
${output.overallTimeline}
`;
}

export function monitoringToMarkdown(output: MonitoringOutput): string {
  const monitorRows = output.monitors
    .map((m) => `| ${m.name} | ${m.type} | ${m.targetComponentId} | ${m.frequency} | ${m.confidence} |`)
    .join("\n");

  const postmanMonitorsSection = output.postmanMonitors?.length
    ? `\n## Postman Monitors\n| Name | Collection | Environment | Schedule | Regions | Alert Channels | Target |\n|------|-----------|-------------|----------|---------|---------------|--------|\n${output.postmanMonitors.map((m) => `| ${m.name} | ${m.collectionRef} | ${m.environmentRef} | ${m.schedule} | ${m.regions.join(", ")} | ${m.alertChannels.join(", ")} | ${m.targetComponentId} |`).join("\n")}\n`
    : "";

  return `# Monitoring Plan

## Monitors
| Name | Type | Target | Frequency | Confidence |
|------|------|--------|-----------|------------|
${monitorRows}

## SLO Definitions
${output.sloDefinitions.map((s) => `- **${s.name}**: ${s.metric} target ${s.target} over ${s.window} for ${s.targetComponentId}`).join("\n")}

## Alert Rules
${output.alertRules.map((a) => `- **${a.severity}** ${a.name}: ${a.condition} → ${a.action}`).join("\n")}
${postmanMonitorsSection}
## Renewal Signals
${output.renewalSignals.map((r) => `- [${r.indicator}] ${r.signal}: ${r.description}`).join("\n")}
`;
}

export function infrastructureToMarkdown(output: InfrastructureOutput): string {
  const resourceRows = output.cloudResources
    .map((r) => `| ${r.name} | ${r.providerLabel} | ${r.service} | ${r.resourceType} | ${r.provisioningStatus} | ${r.confidence} |`)
    .join("\n");

  const iacSection = output.iacSnippets.length
    ? `\n## Infrastructure as Code Snippets\n${output.iacSnippets.map((s) => `### ${s.providerLabel} — \`${s.filename}\`\n${s.description}\n\`\`\`${s.configLanguage}\n${s.content}\n\`\`\``).join("\n\n")}\n`
    : "";

  const containerSection = output.containerManifests?.length
    ? `\n## Container Manifests\n${output.containerManifests.map((c) => `### ${c.name} — \`${c.filename}\`\n${c.description}\n\`\`\`${c.type === "dockerfile" ? "dockerfile" : "yaml"}\n${c.content}\n\`\`\``).join("\n\n")}\n`
    : "";

  const secretsSection = output.secretsBlueprint?.length
    ? `\n## Secrets Blueprint\n| Secret | Category | Required | Platforms |\n|--------|----------|----------|-----------|\n${output.secretsBlueprint.map((s) => `| ${s.secretName} | ${s.category} | ${s.required ? "Yes" : "No"} | ${s.platforms.map((p) => p.platformLabel).join(", ")} |`).join("\n")}\n`
    : "";

  return `# Infrastructure Plan

## Cloud Resources
| Name | Provider | Service | Type | Status | Confidence |
|------|----------|---------|------|--------|------------|
${resourceRows}

## Provisioning Order
${output.provisioningOrder.map((id, i) => `${i + 1}. ${id}`).join("\n")}
${iacSection}${containerSection}${secretsSection}
${output.estimatedMonthlyCost ? `## Estimated Monthly Cost\n${output.estimatedMonthlyCost}\n` : ""}
## Notes
${output.notes.map((n) => `- ${n}`).join("\n")}
`;
}

export function iterationToMarkdown(output: IterationOutput): string {
  const itemRows = output.backlogItems
    .map((i) => `| ${i.title} | ${i.type} | ${i.priority} | ${i.triggerSource} | ${i.estimatedEffort} |`)
    .join("\n");

  return `# Iteration Plan

## Backlog Items
| Title | Type | Priority | Trigger | Effort |
|-------|------|----------|---------|--------|
${itemRows}

## Priority Matrix
### Critical Path
${output.priorityMatrix.criticalPath.map((c) => `- ${c}`).join("\n") || "None"}

### Quick Wins
${output.priorityMatrix.quickWins.map((q) => `- ${q}`).join("\n") || "None"}

### Strategic Investments
${output.priorityMatrix.strategicInvestments.map((s) => `- ${s}`).join("\n") || "None"}

## Drift Analysis
${output.driftAnalysis.driftDetected ? "Drift detected:" : "No significant drift detected."}
${output.driftAnalysis.driftAreas.map((d) => `- **${d.severity}**: ${d.area} — ${d.description}`).join("\n")}

## Next Cycle Recommendation
${output.nextCycleRecommendation}
`;
}
