"use server";

/**
 * CI/CD Playbook Server Action
 *
 * Aggregates CI/CD-relevant outputs from multiple phase artifacts
 * into a unified data structure for the Playbook UI.
 */

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { Phase } from "@prisma/client";
import type { z } from "zod";
import type {
  craftSolutionOutputSchema,
  testDesignOutputSchema,
  deploymentPlanOutputSchema,
  infrastructureOutputSchema,
} from "@/lib/ai/agents/topologyTypes";

// ---------------------------------------------------------------------------
// Types for the playbook data
// ---------------------------------------------------------------------------

type CraftSolutionOutput = z.infer<typeof craftSolutionOutputSchema>;
type TestDesignOutput = z.infer<typeof testDesignOutputSchema>;
type DeploymentPlanOutput = z.infer<typeof deploymentPlanOutputSchema>;
type InfrastructureOutput = z.infer<typeof infrastructureOutputSchema>;

export interface CiCdPlaybookData {
  projectName: string;

  // From CRAFT_SOLUTION
  postmanCollections: NonNullable<CraftSolutionOutput["postmanCollections"]>;
  newmanRunConfigs: NonNullable<CraftSolutionOutput["newmanRunConfigs"]>;
  ciCdPipelines: NonNullable<CraftSolutionOutput["ciCdPipelines"]>;
  ciCdNotes: string[];

  // From TEST_DESIGN
  testCases: Array<{
    name: string;
    testType: string;
    targetComponentId: string;
    postmanTestScript?: string;
    newmanCommand?: string;
  }>;

  // From DEPLOYMENT_PLAN
  ciCdStages: NonNullable<DeploymentPlanOutput["ciCdStages"]>;
  environmentPromotionGates: NonNullable<DeploymentPlanOutput["environmentPromotionGates"]>;

  // From INFRASTRUCTURE (Feature #9)
  cloudResources: NonNullable<InfrastructureOutput["cloudResources"]>;
  iacSnippets: NonNullable<InfrastructureOutput["iacSnippets"]>;
  containerManifests: NonNullable<InfrastructureOutput["containerManifests"]>;
  secretsBlueprint: NonNullable<InfrastructureOutput["secretsBlueprint"]>;

  // Metadata
  phaseVersions: Record<string, number>;
  hasData: boolean;
}

// ---------------------------------------------------------------------------
// Data fetcher
// ---------------------------------------------------------------------------

export async function getCiCdPlaybookData(projectId: string): Promise<CiCdPlaybookData> {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { name: true },
  });

  if (!project) {
    return emptyPlaybook("Unknown Project");
  }

  const phases: Phase[] = ["CRAFT_SOLUTION", "TEST_DESIGN", "DEPLOYMENT_PLAN", "BUILD_LOG", "INFRASTRUCTURE"];

  const artifacts = await prisma.phaseArtifact.findMany({
    where: {
      projectId,
      phase: { in: phases },
      project: { ownerUserId: session.userId },
    },
    select: {
      phase: true,
      version: true,
      contentJson: true,
    },
    distinct: ["phase"],
    orderBy: { version: "desc" },
  });

  const phaseMap = new Map<string, { version: number; content: Record<string, unknown> }>();
  for (const a of artifacts) {
    if (a.contentJson) {
      try {
        const content = typeof a.contentJson === "string"
          ? JSON.parse(a.contentJson)
          : a.contentJson;
        phaseMap.set(a.phase, { version: a.version, content });
      } catch {
        // Skip malformed JSON
      }
    }
  }

  const craft = phaseMap.get("CRAFT_SOLUTION");
  const test = phaseMap.get("TEST_DESIGN");
  const deploy = phaseMap.get("DEPLOYMENT_PLAN");
  const infra = phaseMap.get("INFRASTRUCTURE");

  const craftContent = craft?.content as Partial<CraftSolutionOutput> | undefined;
  const testContent = test?.content as Partial<TestDesignOutput> | undefined;
  const deployContent = deploy?.content as Partial<DeploymentPlanOutput> | undefined;
  const infraContent = infra?.content as Partial<InfrastructureOutput> | undefined;

  const phaseVersions: Record<string, number> = {};
  for (const [phase, data] of phaseMap) {
    phaseVersions[phase] = data.version;
  }

  const hasData = !!(
    craftContent?.postmanCollections?.length ||
    craftContent?.ciCdPipelines?.length ||
    craftContent?.newmanRunConfigs?.length ||
    testContent?.testCases?.some((t) => t.postmanTestScript) ||
    deployContent?.ciCdStages?.length ||
    deployContent?.environmentPromotionGates?.length ||
    infraContent?.cloudResources?.length ||
    infraContent?.iacSnippets?.length
  );

  // Normalize pipelines for backward compat (old artifacts may use configYaml, lack platformLabel)
  const rawPipelines = craftContent?.ciCdPipelines ?? [];
  const normalizedPipelines = rawPipelines.map((p) => normalizePipeline(p as Record<string, unknown>));

  const rawStages = deployContent?.ciCdStages ?? [];
  const normalizedStages = rawStages.map((s) => normalizeStage(s as Record<string, unknown>));

  return {
    projectName: project.name,
    postmanCollections: craftContent?.postmanCollections ?? [],
    newmanRunConfigs: craftContent?.newmanRunConfigs ?? [],
    ciCdPipelines: normalizedPipelines,
    ciCdNotes: craftContent?.ciCdNotes ?? [],
    testCases: (testContent?.testCases ?? [])
      .filter((t) => t.postmanTestScript || t.newmanCommand)
      .map((t) => ({
        name: t.name,
        testType: t.testType,
        targetComponentId: t.targetComponentId,
        postmanTestScript: t.postmanTestScript,
        newmanCommand: t.newmanCommand,
      })),
    ciCdStages: normalizedStages,
    environmentPromotionGates: deployContent?.environmentPromotionGates ?? [],
    cloudResources: infraContent?.cloudResources ?? [],
    iacSnippets: infraContent?.iacSnippets ?? [],
    containerManifests: infraContent?.containerManifests ?? [],
    secretsBlueprint: infraContent?.secretsBlueprint ?? [],
    phaseVersions,
    hasData,
  };
}

function emptyPlaybook(projectName: string): CiCdPlaybookData {
  return {
    projectName,
    postmanCollections: [],
    newmanRunConfigs: [],
    ciCdPipelines: [],
    ciCdNotes: [],
    testCases: [],
    ciCdStages: [],
    environmentPromotionGates: [],
    cloudResources: [],
    iacSnippets: [],
    containerManifests: [],
    secretsBlueprint: [],
    phaseVersions: {},
    hasData: false,
  };
}

// ---------------------------------------------------------------------------
// Backward-compat normalizers
//
// Old artifacts may store "configYaml" instead of "configContent" and lack
// "platformLabel" / "configLanguage". These helpers patch old shapes into
// the current schema so the UI always gets well-formed data.
// ---------------------------------------------------------------------------

const LEGACY_PLATFORM_LABELS: Record<string, string> = {
  github_actions: "GitHub Actions",
  gitlab_ci: "GitLab CI",
  jenkins: "Jenkins",
};

function inferConfigLanguage(platform: string): string {
  if (platform === "jenkins") return "groovy";
  if (platform.includes("terraform") || platform.includes("hcl")) return "hcl";
  return "yaml";
}

function normalizePipeline(raw: Record<string, unknown>): CraftSolutionOutput["ciCdPipelines"] extends (infer U)[] | undefined ? U : never {
  const platform = (raw.platform as string) || "unknown";
  return {
    platform,
    platformLabel: (raw.platformLabel as string) || LEGACY_PLATFORM_LABELS[platform] || platform.replace(/_/g, " "),
    configLanguage: (raw.configLanguage as string) || inferConfigLanguage(platform),
    filename: (raw.filename as string) || "",
    description: (raw.description as string) || "",
    configContent: (raw.configContent as string) || (raw.configYaml as string) || "",
  };
}

function normalizeStage(raw: Record<string, unknown>): DeploymentPlanOutput["ciCdStages"] extends (infer U)[] | undefined ? U : never {
  const platform = (raw.platform as string) || "unknown";
  return {
    stageName: (raw.stageName as string) || "",
    platform,
    platformLabel: (raw.platformLabel as string) || LEGACY_PLATFORM_LABELS[platform] || platform.replace(/_/g, " "),
    configLanguage: (raw.configLanguage as string) || inferConfigLanguage(platform),
    triggerCondition: (raw.triggerCondition as string) || "",
    configSnippet: (raw.configSnippet as string) || "",
    gateChecks: (raw.gateChecks as string[]) || [],
  };
}
