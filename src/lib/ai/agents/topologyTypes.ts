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
});

export const testDesignOutputSchema = z.object({
  testCases: z.array(testCaseSchema),
  coverageSummary: z.string(),
});

export type TestDesignOutput = z.infer<typeof testDesignOutputSchema>;

// ---------------------------------------------------------------------------
// 5. Craft Solution
// ---------------------------------------------------------------------------

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

  return `# Test Design

## Test Cases
| Name | Type | Target | Objective |
|------|------|--------|-----------|
${caseRows}

## Coverage Summary
${output.coverageSummary}
`;
}

export function craftSolutionToMarkdown(output: CraftSolutionOutput): string {
  const steps = output.implementationPlan
    .map((s) => `### Step ${s.step}: ${s.title}\n${s.description}\n- Components: ${s.targetComponents.join(", ")}`)
    .join("\n\n");

  return `# Craft Solution

## Implementation Plan
${steps}

## Migration Steps
${output.migrationSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## CI/CD Notes
${output.ciCdNotes.map((n) => `- ${n}`).join("\n")}

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

  return `# Deployment Plan

## Deployment Steps
| Phase | Title | Duration | Evidence |
|-------|-------|----------|----------|
${stepRows}

## Change Management
${output.changeManagementNotes.map((n) => `- ${n}`).join("\n")}

## Training Requirements
${output.trainingRequirements.map((t) => `- **${t.audience}**: ${t.topic} (${t.format})`).join("\n")}

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

  return `# Monitoring Plan

## Monitors
| Name | Type | Target | Frequency | Confidence |
|------|------|--------|-----------|------------|
${monitorRows}

## SLO Definitions
${output.sloDefinitions.map((s) => `- **${s.name}**: ${s.metric} target ${s.target} over ${s.window} for ${s.targetComponentId}`).join("\n")}

## Alert Rules
${output.alertRules.map((a) => `- **${a.severity}** ${a.name}: ${a.condition} → ${a.action}`).join("\n")}

## Renewal Signals
${output.renewalSignals.map((r) => `- [${r.indicator}] ${r.signal}: ${r.description}`).join("\n")}
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
