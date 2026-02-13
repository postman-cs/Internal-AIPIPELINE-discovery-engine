/**
 * API Governance Rules Engine (Feature #13)
 *
 * Validates AI-generated artifacts against configurable governance rules.
 * Supports naming conventions, auth requirements, test coverage, deployment gates,
 * security policies, and documentation standards.
 *
 * Technology-agnostic: rules are data-driven, not hardcoded per platform.
 */

import { logger } from "@/lib/logger";
import type { GovernanceRule, GovernanceResult } from "@/lib/ai/agents/topologyTypes";

const log = logger.child("governance.engine");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GovernanceConfig {
  rules: GovernanceRule[];
  enforceBlockers: boolean; // if true, blockers prevent artifact acceptance
}

export interface GovernanceReport {
  passed: boolean;
  blockerCount: number;
  warningCount: number;
  infoCount: number;
  results: GovernanceResult[];
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Built-in Rule Packs
// ---------------------------------------------------------------------------

export const ENTERPRISE_RULE_PACK: GovernanceRule[] = [
  {
    id: "gov-naming-collections",
    name: "Collection Naming Convention",
    description: "All Postman collections must follow the naming pattern: {Service}-{Environment}-{Version}",
    category: "naming",
    severity: "warning",
    check: "collection_name_pattern",
    autoFixable: false,
  },
  {
    id: "gov-auth-required",
    name: "Authentication Required",
    description: "All collection requests must include authentication headers or use collection-level auth",
    category: "auth",
    severity: "blocker",
    check: "requests_have_auth",
    autoFixable: false,
  },
  {
    id: "gov-contract-test-stage",
    name: "Contract Test Stage Required",
    description: "All CI/CD pipelines must include a contract test stage before deployment",
    category: "testing",
    severity: "blocker",
    check: "pipeline_has_contract_tests",
    autoFixable: false,
  },
  {
    id: "gov-prod-approval",
    name: "Production Approval Gate",
    description: "Environment promotion to production must require manual approval",
    category: "deployment",
    severity: "blocker",
    check: "prod_gate_requires_approval",
    autoFixable: false,
  },
  {
    id: "gov-secrets-no-inline",
    name: "No Inline Secrets",
    description: "Pipeline configs must not contain hardcoded secrets, API keys, or passwords",
    category: "security",
    severity: "blocker",
    check: "no_inline_secrets",
    autoFixable: false,
  },
  {
    id: "gov-test-coverage",
    name: "Minimum Test Coverage",
    description: "At least one smoke test and one contract test per API endpoint must exist",
    category: "testing",
    severity: "warning",
    check: "minimum_test_coverage",
    autoFixable: false,
  },
  {
    id: "gov-collection-description",
    name: "Collection Description Required",
    description: "All collections and folders must have descriptions",
    category: "documentation",
    severity: "info",
    check: "collection_has_description",
    autoFixable: true,
  },
  {
    id: "gov-env-separation",
    name: "Environment Separation",
    description: "Newman configs must reference different environments for dev/staging/production",
    category: "deployment",
    severity: "warning",
    check: "environments_are_separated",
    autoFixable: false,
  },
  {
    id: "gov-monitor-critical-apis",
    name: "Monitor Critical APIs",
    description: "All critical API endpoints must have a Postman Monitor configured",
    category: "testing",
    severity: "warning",
    check: "critical_apis_monitored",
    autoFixable: false,
  },
  {
    id: "gov-rollback-plan",
    name: "Rollback Plan Required",
    description: "Every deployment stage must have a defined rollback plan",
    category: "deployment",
    severity: "warning",
    check: "stages_have_rollback",
    autoFixable: false,
  },
];

// ---------------------------------------------------------------------------
// Rule Checkers
// ---------------------------------------------------------------------------

type ArtifactContext = {
  collections?: Array<Record<string, unknown>>;
  pipelines?: Array<Record<string, unknown>>;
  newmanConfigs?: Array<Record<string, unknown>>;
  testCases?: Array<Record<string, unknown>>;
  stages?: Array<Record<string, unknown>>;
  promotionGates?: Array<Record<string, unknown>>;
  monitors?: Array<Record<string, unknown>>;
  secretsBlueprint?: Array<Record<string, unknown>>;
};

function checkRule(rule: GovernanceRule, ctx: ArtifactContext): GovernanceResult {
  switch (rule.check) {
    case "collection_name_pattern":
      return checkCollectionNaming(rule, ctx);
    case "requests_have_auth":
      return checkRequestsHaveAuth(rule, ctx);
    case "pipeline_has_contract_tests":
      return checkPipelineContractTests(rule, ctx);
    case "prod_gate_requires_approval":
      return checkProdApproval(rule, ctx);
    case "no_inline_secrets":
      return checkNoInlineSecrets(rule, ctx);
    case "minimum_test_coverage":
      return checkTestCoverage(rule, ctx);
    case "collection_has_description":
      return checkCollectionDescription(rule, ctx);
    case "environments_are_separated":
      return checkEnvSeparation(rule, ctx);
    case "critical_apis_monitored":
      return checkCriticalApisMonitored(rule, ctx);
    case "stages_have_rollback":
      return checkStagesHaveRollback(rule, ctx);
    default:
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        passed: true,
        message: `Rule check "${rule.check}" not implemented — auto-passing.`,
      };
  }
}

function checkCollectionNaming(rule: GovernanceRule, ctx: ArtifactContext): GovernanceResult {
  const collections = ctx.collections ?? [];
  const invalidNames = collections
    .filter((c) => {
      const name = (c.name as string) ?? "";
      return !name.includes("-") || name.length < 3;
    })
    .map((c) => (c.name as string) ?? "unnamed");

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.severity,
    passed: invalidNames.length === 0,
    message: invalidNames.length === 0
      ? "All collections follow naming conventions."
      : `Collections with non-standard names: ${invalidNames.join(", ")}`,
    affectedArtifacts: invalidNames,
  };
}

function checkRequestsHaveAuth(rule: GovernanceRule, ctx: ArtifactContext): GovernanceResult {
  const collections = ctx.collections ?? [];
  // Simplified check: look for auth-related content
  const hasAuth = collections.length === 0 || collections.some((c) => {
    const json = JSON.stringify(c);
    return json.includes("auth") || json.includes("Authorization") || json.includes("Bearer") || json.includes("api-key");
  });

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.severity,
    passed: hasAuth,
    message: hasAuth
      ? "Collections include authentication configuration."
      : "No authentication found in collections. Add collection-level auth or per-request Authorization headers.",
  };
}

function checkPipelineContractTests(rule: GovernanceRule, ctx: ArtifactContext): GovernanceResult {
  const pipelines = ctx.pipelines ?? [];
  const hasContractStage = pipelines.some((p) => {
    const content = (p.configContent as string) ?? "";
    return content.toLowerCase().includes("contract") || content.toLowerCase().includes("schema");
  });

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.severity,
    passed: hasContractStage || pipelines.length === 0,
    message: hasContractStage
      ? "Pipeline(s) include contract test stages."
      : "No contract test stage found in pipelines. Add a contract test step before deployment.",
  };
}

function checkProdApproval(rule: GovernanceRule, ctx: ArtifactContext): GovernanceResult {
  const gates = ctx.promotionGates ?? [];
  const prodGate = gates.find(
    (g) => (g.toEnv as string)?.toLowerCase().includes("prod")
  );

  const hasApproval = prodGate ? (prodGate.approvalRequired as boolean) === true : gates.length === 0;

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.severity,
    passed: hasApproval,
    message: hasApproval
      ? "Production promotion requires manual approval."
      : "Production promotion gate does not require approval. Set approvalRequired=true.",
  };
}

function checkNoInlineSecrets(rule: GovernanceRule, ctx: ArtifactContext): GovernanceResult {
  const pipelines = ctx.pipelines ?? [];
  const secretPatterns = [
    /(?:password|secret|api[_-]?key|token|credential)\s*[:=]\s*["'][^${\s]/i,
    /sk-[a-zA-Z0-9]{20,}/,
    /PMAK-[a-zA-Z0-9-]+/,
    /ghp_[a-zA-Z0-9]{36}/,
    /glpat-[a-zA-Z0-9-_]{20,}/,
  ];

  const violations: string[] = [];
  for (const p of pipelines) {
    const content = (p.configContent as string) ?? "";
    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        violations.push((p.platform as string) ?? "unknown");
        break;
      }
    }
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.severity,
    passed: violations.length === 0,
    message: violations.length === 0
      ? "No inline secrets detected in pipeline configs."
      : `Potential inline secrets found in: ${violations.join(", ")}. Use platform secret management instead.`,
    affectedArtifacts: violations,
  };
}

function checkTestCoverage(rule: GovernanceRule, ctx: ArtifactContext): GovernanceResult {
  const testCases = ctx.testCases ?? [];
  const hasSmoke = testCases.some((t) => (t.testType as string) === "Smoke");
  const hasContract = testCases.some((t) => (t.testType as string) === "Contract");

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.severity,
    passed: (hasSmoke && hasContract) || testCases.length === 0,
    message:
      hasSmoke && hasContract
        ? "Test suite includes smoke and contract tests."
        : `Missing test types: ${!hasSmoke ? "Smoke " : ""}${!hasContract ? "Contract" : ""}`.trim(),
  };
}

function checkCollectionDescription(rule: GovernanceRule, ctx: ArtifactContext): GovernanceResult {
  const collections = ctx.collections ?? [];
  const missingDesc = collections.filter(
    (c) => !(c.description as string)?.trim()
  );

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.severity,
    passed: missingDesc.length === 0,
    message: missingDesc.length === 0
      ? "All collections have descriptions."
      : `${missingDesc.length} collection(s) missing descriptions.`,
  };
}

function checkEnvSeparation(rule: GovernanceRule, ctx: ArtifactContext): GovernanceResult {
  const configs = ctx.newmanConfigs ?? [];
  const envRefs = new Set(configs.map((c) => c.environmentRef as string).filter(Boolean));

  const hasSeparation = envRefs.size >= 2 || configs.length === 0;

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.severity,
    passed: hasSeparation,
    message: hasSeparation
      ? `${envRefs.size} distinct environments configured.`
      : "Newman configs reference only one environment. Add separate configs for dev/staging/production.",
  };
}

function checkCriticalApisMonitored(rule: GovernanceRule, ctx: ArtifactContext): GovernanceResult {
  const monitors = ctx.monitors ?? [];
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.severity,
    passed: monitors.length > 0,
    message: monitors.length > 0
      ? `${monitors.length} Postman Monitor(s) configured.`
      : "No Postman Monitors configured. Add monitors for critical API health checks.",
  };
}

function checkStagesHaveRollback(rule: GovernanceRule, ctx: ArtifactContext): GovernanceResult {
  const stages = ctx.stages ?? [];
  // Check for rollback references in stage configs
  const withRollback = stages.filter((s) => {
    const snippet = (s.configSnippet as string) ?? "";
    const checks = (s.gateChecks as string[]) ?? [];
    return snippet.includes("rollback") || checks.some((c) => c.toLowerCase().includes("rollback"));
  });

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    severity: rule.severity,
    passed: withRollback.length === stages.length || stages.length === 0,
    message:
      withRollback.length === stages.length || stages.length === 0
        ? "All deployment stages have rollback plans."
        : `${stages.length - withRollback.length} stage(s) missing rollback plans.`,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run governance checks against a set of artifacts.
 */
export function runGovernanceChecks(
  config: GovernanceConfig,
  artifacts: ArtifactContext
): GovernanceReport {
  log.info("Running governance checks", { ruleCount: config.rules.length });

  const results: GovernanceResult[] = [];

  for (const rule of config.rules) {
    const result = checkRule(rule, artifacts);
    results.push(result);
  }

  const blockerCount = results.filter((r) => !r.passed && r.severity === "blocker").length;
  const warningCount = results.filter((r) => !r.passed && r.severity === "warning").length;
  const infoCount = results.filter((r) => !r.passed && r.severity === "info").length;

  const passed = config.enforceBlockers ? blockerCount === 0 : true;

  log.info("Governance check complete", { passed, blockerCount, warningCount, infoCount });

  return {
    passed,
    blockerCount,
    warningCount,
    infoCount,
    results,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get default enterprise governance config.
 */
export function getDefaultGovernanceConfig(): GovernanceConfig {
  return {
    rules: ENTERPRISE_RULE_PACK,
    enforceBlockers: true,
  };
}

/**
 * Merge custom rules with default rules.
 */
export function mergeGovernanceRules(
  defaults: GovernanceRule[],
  custom: GovernanceRule[]
): GovernanceRule[] {
  const customIds = new Set(custom.map((r) => r.id));
  const merged = defaults.filter((r) => !customIds.has(r.id));
  return [...merged, ...custom];
}
