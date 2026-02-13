"use server";

/**
 * Playbook Customization Wizard Server Actions (Feature #16)
 *
 * Provides a step-by-step wizard for customizing CI/CD playbook generation.
 * Users select platforms, environments, test strategy, and deployment strategy
 * before triggering AI generation with constrained parameters.
 */

import { z } from "zod";
import { requireAuth } from "@/lib/session";

// ---------------------------------------------------------------------------
// Wizard Step Schemas
// ---------------------------------------------------------------------------

export const wizardPlatformStepSchema = z.object({
  selectedPlatforms: z.array(z.object({
    platform: z.string(),
    label: z.string(),
    enabled: z.boolean(),
  })),
});

export const wizardEnvironmentStepSchema = z.object({
  environments: z.array(z.object({
    name: z.string(),
    label: z.string(),
    baseUrl: z.string().optional(),
    isProduction: z.boolean().default(false),
  })),
  promotionRules: z.array(z.object({
    from: z.string(),
    to: z.string(),
    requiresApproval: z.boolean(),
    requiredChecks: z.array(z.string()),
  })),
});

export const wizardTestStrategyStepSchema = z.object({
  testTypes: z.object({
    smoke: z.boolean().default(true),
    contract: z.boolean().default(true),
    integration: z.boolean().default(true),
    load: z.boolean().default(false),
  }),
  coverageTarget: z.number().min(0).max(100).default(80),
  bailOnFailure: z.boolean().default(true),
  reporters: z.array(z.string()).default(["cli", "junit"]),
});

export const wizardDeploymentStepSchema = z.object({
  rolloutPattern: z.enum(["blue-green", "canary", "rolling", "recreate"]).default("rolling"),
  approvalGates: z.object({
    staging: z.boolean().default(false),
    production: z.boolean().default(true),
  }),
  rollbackEnabled: z.boolean().default(true),
  monitorAsGate: z.boolean().default(true),
  monitorCheckInterval: z.number().default(5), // minutes
  monitorSuccessThreshold: z.number().default(3), // consecutive successes
});

export const fullWizardConfigSchema = z.object({
  platforms: wizardPlatformStepSchema,
  environments: wizardEnvironmentStepSchema,
  testStrategy: wizardTestStrategyStepSchema,
  deployment: wizardDeploymentStepSchema,
});

export type WizardConfig = z.infer<typeof fullWizardConfigSchema>;

// ---------------------------------------------------------------------------
// Default Configs
// ---------------------------------------------------------------------------

const DEFAULT_PLATFORMS = [
  { platform: "github_actions", label: "GitHub Actions", enabled: true },
  { platform: "gitlab_ci", label: "GitLab CI", enabled: true },
  { platform: "jenkins", label: "Jenkins", enabled: true },
  { platform: "circleci", label: "CircleCI", enabled: false },
  { platform: "azure_devops", label: "Azure DevOps", enabled: false },
  { platform: "aws_codebuild", label: "AWS CodeBuild", enabled: false },
  { platform: "bitbucket_pipelines", label: "Bitbucket Pipelines", enabled: false },
  { platform: "google_cloud_build", label: "Google Cloud Build", enabled: false },
  { platform: "tekton", label: "Tekton", enabled: false },
  { platform: "drone_ci", label: "Drone CI", enabled: false },
  { platform: "travis_ci", label: "Travis CI", enabled: false },
  { platform: "buildkite", label: "Buildkite", enabled: false },
];

const DEFAULT_ENVIRONMENTS = [
  { name: "dev", label: "Development", baseUrl: "", isProduction: false },
  { name: "staging", label: "Staging", baseUrl: "", isProduction: false },
  { name: "production", label: "Production", baseUrl: "", isProduction: true },
];

const DEFAULT_PROMOTION_RULES = [
  { from: "dev", to: "staging", requiresApproval: false, requiredChecks: ["smoke-tests", "contract-tests"] },
  { from: "staging", to: "production", requiresApproval: true, requiredChecks: ["full-test-suite", "monitor-green", "manual-approval"] },
];

export async function getWizardDefaults(): Promise<WizardConfig> {
  await requireAuth();
  return {
    platforms: {
      selectedPlatforms: DEFAULT_PLATFORMS,
    },
    environments: {
      environments: DEFAULT_ENVIRONMENTS,
      promotionRules: DEFAULT_PROMOTION_RULES,
    },
    testStrategy: {
      testTypes: {
        smoke: true,
        contract: true,
        integration: true,
        load: false,
      },
      coverageTarget: 80,
      bailOnFailure: true,
      reporters: ["cli", "junit"],
    },
    deployment: {
      rolloutPattern: "rolling",
      approvalGates: {
        staging: false,
        production: true,
      },
      rollbackEnabled: true,
      monitorAsGate: true,
      monitorCheckInterval: 5,
      monitorSuccessThreshold: 3,
    },
  };
}

/**
 * Validate and save wizard configuration for a project.
 */
export async function validateWizardConfig(
  config: unknown
): Promise<{ valid: boolean; config?: WizardConfig; errors?: string[] }> {
  await requireAuth();
  const result = fullWizardConfigSchema.safeParse(config);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
    };
  }

  return { valid: true, config: result.data };
}

/**
 * Generate a wizard-constrained prompt supplement for the AI agents.
 * This is injected into the craftSolution and deploymentPlanner prompts.
 */
export function wizardConfigToPromptConstraints(config: WizardConfig): string {
  const enabledPlatforms = config.platforms.selectedPlatforms
    .filter((p) => p.enabled)
    .map((p) => `${p.label} (${p.platform})`);

  const envNames = config.environments.environments.map((e) => e.label);
  const promotionFlow = config.environments.promotionRules
    .map((r) => `${r.from} -> ${r.to} (approval: ${r.requiresApproval ? "yes" : "no"}, checks: ${r.requiredChecks.join(", ")})`)
    .join("\n  ");

  const testTypes = Object.entries(config.testStrategy.testTypes)
    .filter(([, enabled]) => enabled)
    .map(([type]) => type);

  return `
WIZARD CONSTRAINTS (user-configured):
- CI/CD Platforms: ${enabledPlatforms.join(", ")}
- Environments: ${envNames.join(" -> ")}
- Promotion Flow:
  ${promotionFlow}
- Test Types: ${testTypes.join(", ")}
- Coverage Target: ${config.testStrategy.coverageTarget}%
- Bail on Failure: ${config.testStrategy.bailOnFailure}
- Reporters: ${config.testStrategy.reporters.join(", ")}
- Rollout Pattern: ${config.deployment.rolloutPattern}
- Production Approval: ${config.deployment.approvalGates.production ? "required" : "not required"}
- Rollback Enabled: ${config.deployment.rollbackEnabled}
- Monitor as Gate: ${config.deployment.monitorAsGate} (check every ${config.deployment.monitorCheckInterval}min, require ${config.deployment.monitorSuccessThreshold} consecutive successes)

Generate artifacts ONLY for the specified platforms and environments.
`;
}
