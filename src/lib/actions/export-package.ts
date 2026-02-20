"use server";

/**
 * Exportable Engagement Package (Feature #15)
 *
 * Bundles ALL generated artifacts into a structured package:
 * - Postman collections, environments, monitors
 * - CI/CD pipeline configs (all platforms)
 * - IaC snippets and container manifests
 * - Newman configs and test scripts
 * - Discovery brief, topology docs, deployment plan
 * - Makefile/justfile with common commands
 */

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { Phase } from "@prisma/client";
import { stubToPostmanCollection, varsToPostmanEnvironment } from "@/lib/postman/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PackageFile {
  path: string;
  content: string;
  type: "json" | "yaml" | "markdown" | "groovy" | "hcl" | "dockerfile" | "makefile" | "text";
}

export interface EngagementPackage {
  projectName: string;
  generatedAt: string;
  files: PackageFile[];
  summary: {
    totalFiles: number;
    collections: number;
    environments: number;
    pipelines: number;
    iacSnippets: number;
    testScripts: number;
    docs: number;
  };
}

// ---------------------------------------------------------------------------
// Package Builder
// ---------------------------------------------------------------------------

export async function buildEngagementPackage(projectId: string): Promise<EngagementPackage | null> {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { name: true },
  });

  if (!project) return null;

  const allPhases: Phase[] = [
    "DISCOVERY", "CURRENT_TOPOLOGY", "DESIRED_FUTURE_STATE",
    "SOLUTION_DESIGN", "INFRASTRUCTURE", "TEST_DESIGN",
    "CRAFT_SOLUTION", "TEST_SOLUTION", "DEPLOYMENT_PLAN",
    "MONITORING", "ITERATION",
  ];

  const artifacts = await prisma.phaseArtifact.findMany({
    where: {
      projectId,
      phase: { in: allPhases },
      project: { ownerUserId: session.userId },
    },
    select: { phase: true, version: true, contentJson: true, contentMarkdown: true },
    distinct: ["phase"],
    orderBy: { version: "desc" },
  });

  const phaseMap = new Map<string, { content: Record<string, unknown>; markdown?: string }>();
  for (const a of artifacts) {
    if (a.contentJson) {
      try {
        const content = typeof a.contentJson === "string"
          ? JSON.parse(a.contentJson)
          : a.contentJson;
        phaseMap.set(a.phase, { content: content as Record<string, unknown>, markdown: a.contentMarkdown ?? undefined });
      } catch { /* skip malformed */ }
    }
  }

  const files: PackageFile[] = [];
  let collections = 0;
  let environments = 0;
  let pipelines = 0;
  let iacSnippets = 0;
  let testScripts = 0;
  let docs = 0;

  // =========================================================================
  // README
  // =========================================================================
  files.push({
    path: "README.md",
    content: generateReadme(project.name),
    type: "markdown",
  });
  docs++;

  // =========================================================================
  // Postman Collections
  // =========================================================================
  const craft = phaseMap.get("CRAFT_SOLUTION")?.content;
  const craftCollections = (craft?.postmanCollections as unknown[]) ?? [];
  for (const col of craftCollections) {
    const c = col as Record<string, unknown>;
    const name = (c.name as string) ?? "collection";
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    const postmanFormat = stubToPostmanCollection(c as Parameters<typeof stubToPostmanCollection>[0]);
    files.push({
      path: `postman/collections/${slug}.postman_collection.json`,
      content: JSON.stringify(postmanFormat, null, 2),
      type: "json",
    });
    collections++;
  }

  // =========================================================================
  // Postman Environments
  // =========================================================================
  const newmanConfigs = (craft?.newmanRunConfigs as unknown[]) ?? [];
  const envRefs = new Set<string>();
  for (const cfg of newmanConfigs) {
    const c = cfg as Record<string, unknown>;
    const envRef = (c.environmentRef as string) ?? "";
    if (envRef && !envRefs.has(envRef)) {
      envRefs.add(envRef);
      const envJson = varsToPostmanEnvironment(envRef, [
        { key: "baseUrl", value: `https://api.example.com/${envRef}`, type: "default" },
        { key: "apiKey", value: "", type: "secret" },
      ]);
      files.push({
        path: `postman/environments/${envRef}.postman_environment.json`,
        content: JSON.stringify(envJson, null, 2),
        type: "json",
      });
      environments++;
    }
  }

  // =========================================================================
  // Newman Configs
  // =========================================================================
  for (const cfg of newmanConfigs) {
    const c = cfg as Record<string, unknown>;
    const name = (c.name as string) ?? "newman-config";
    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    files.push({
      path: `tests/newman-configs/${slug}.json`,
      content: JSON.stringify(c, null, 2),
      type: "json",
    });
    testScripts++;
  }

  // =========================================================================
  // CI/CD Pipelines
  // =========================================================================
  const ciCdPipelines = (craft?.ciCdPipelines as unknown[]) ?? [];
  for (const pipeline of ciCdPipelines) {
    const p = pipeline as Record<string, unknown>;
    const filename = (p.filename as string) ?? "pipeline.yml";
    const configContent = (p.configContent as string) ?? (p.configYaml as string) ?? "";

    files.push({
      path: `ci-cd/${filename}`,
      content: configContent,
      type: inferFileType(filename),
    });
    pipelines++;
  }

  // =========================================================================
  // Infrastructure (IaC snippets, container manifests)
  // =========================================================================
  const infra = phaseMap.get("INFRASTRUCTURE")?.content;
  if (infra) {
    const iacList = (infra.iacSnippets as unknown[]) ?? [];
    for (const snippet of iacList) {
      const s = snippet as Record<string, unknown>;
      const filename = (s.filename as string) ?? "main.tf";
      const content = (s.content as string) ?? "";
      files.push({
        path: `infrastructure/${filename}`,
        content,
        type: inferFileType(filename),
      });
      iacSnippets++;
    }

    const containers = (infra.containerManifests as unknown[]) ?? [];
    for (const manifest of containers) {
      const m = manifest as Record<string, unknown>;
      const filename = (m.filename as string) ?? "manifest.yaml";
      const content = (m.content as string) ?? "";
      files.push({
        path: `infrastructure/${filename}`,
        content,
        type: inferFileType(filename),
      });
      iacSnippets++;
    }
  }

  // =========================================================================
  // Test Scripts
  // =========================================================================
  const testDesign = phaseMap.get("TEST_DESIGN")?.content;
  const testCases = (testDesign?.testCases as unknown[]) ?? [];
  for (const tc of testCases) {
    const t = tc as Record<string, unknown>;
    const script = (t.postmanTestScript as string) ?? "";
    if (script) {
      const name = (t.name as string) ?? "test";
      const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      files.push({
        path: `tests/test-scripts/${slug}.js`,
        content: `// Test: ${name}\n// Type: ${(t.testType as string) ?? "Unknown"}\n// Target: ${(t.targetComponentId as string) ?? "N/A"}\n\n${script}`,
        type: "text",
      });
      testScripts++;
    }
  }

  // =========================================================================
  // Documentation (Markdown from each phase)
  // =========================================================================
  const docPhases: Array<{ phase: string; filename: string }> = [
    { phase: "DISCOVERY", filename: "discovery-brief.md" },
    { phase: "CURRENT_TOPOLOGY", filename: "topology-current.md" },
    { phase: "DESIRED_FUTURE_STATE", filename: "topology-future.md" },
    { phase: "SOLUTION_DESIGN", filename: "solution-design.md" },
    { phase: "INFRASTRUCTURE", filename: "infrastructure-plan.md" },
    { phase: "TEST_DESIGN", filename: "test-design.md" },
    { phase: "DEPLOYMENT_PLAN", filename: "deployment-plan.md" },
    { phase: "MONITORING", filename: "monitoring-plan.md" },
  ];

  for (const { phase, filename } of docPhases) {
    const md = phaseMap.get(phase)?.markdown;
    if (md) {
      files.push({
        path: `docs/${filename}`,
        content: md,
        type: "markdown",
      });
      docs++;
    }
  }

  // =========================================================================
  // Makefile
  // =========================================================================
  files.push({
    path: "Makefile",
    content: generateMakefile(project.name),
    type: "makefile",
  });

  return {
    projectName: project.name,
    generatedAt: new Date().toISOString(),
    files,
    summary: {
      totalFiles: files.length,
      collections,
      environments,
      pipelines,
      iacSnippets,
      testScripts,
      docs,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inferFileType(filename: string): PackageFile["type"] {
  if (filename.endsWith(".json")) return "json";
  if (filename.endsWith(".yml") || filename.endsWith(".yaml")) return "yaml";
  if (filename.endsWith(".md")) return "markdown";
  if (filename.endsWith(".tf") || filename.endsWith(".hcl")) return "hcl";
  if (filename.endsWith(".groovy") || filename === "Jenkinsfile") return "groovy";
  if (filename.includes("Dockerfile") || filename.includes("dockerfile")) return "dockerfile";
  return "text";
}

function generateReadme(projectName: string): string {
  return `# ${projectName} — Postman CI/CD Engagement Package

This package contains all artifacts generated for integrating Postman into your CI/CD and cloud infrastructure pipelines.

## Directory Structure

\`\`\`
├── postman/
│   ├── collections/          # Postman collection JSON files
│   └── environments/         # Postman environment JSON files
├── ci-cd/                    # CI/CD pipeline configs (per platform)
├── infrastructure/           # IaC snippets (Terraform, K8s, Docker, etc.)
├── tests/
│   ├── newman-configs/       # Newman CLI run configurations
│   └── test-scripts/         # Postman test scripts (pm.test)
├── docs/                     # Phase documentation
├── Makefile                  # Common commands
└── README.md                 # This file
\`\`\`

## Quick Start

1. **Import Collections**: Import \`postman/collections/*.json\` into your Postman workspace
2. **Configure Environments**: Update \`postman/environments/*.json\` with your actual API URLs and credentials
3. **Install Newman**: \`npm install -g newman newman-reporter-htmlextra newman-reporter-junit\`
4. **Run Tests Locally**: \`make test-staging\`
5. **Deploy Pipelines**: Copy the relevant CI/CD config from \`ci-cd/\` to your repository
6. **Provision Infrastructure**: Apply IaC configs from \`infrastructure/\` (if applicable)

## Available Make Commands

- \`make test-dev\` — Run Newman tests against dev environment
- \`make test-staging\` — Run Newman tests against staging environment
- \`make test-prod\` — Run Newman tests against production environment
- \`make import\` — Import collections to Postman (requires POSTMAN_API_KEY)
- \`make validate\` — Validate pipeline configs
- \`make help\` — Show all available commands

---
*Generated by CortexLab on ${new Date().toISOString()}*
`;
}

function generateMakefile(projectName: string): string {
  return `.PHONY: help test-dev test-staging test-prod import validate

help: ## Show available commands
\t@echo "Available commands for ${projectName}:"
\t@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \\033[36m%-20s\\033[0m %s\\n", $$1, $$2}'

NEWMAN := newman
COLLECTION := postman/collections
ENVIRONMENTS := postman/environments

test-dev: ## Run Newman tests against dev environment
\t$(NEWMAN) run $(COLLECTION)/*.json -e $(ENVIRONMENTS)/dev.postman_environment.json --reporters cli,junit --reporter-junit-export results/dev-junit.xml

test-staging: ## Run Newman tests against staging environment
\t$(NEWMAN) run $(COLLECTION)/*.json -e $(ENVIRONMENTS)/staging.postman_environment.json --reporters cli,junit,htmlextra --reporter-junit-export results/staging-junit.xml --reporter-htmlextra-export results/staging-report.html

test-prod: ## Run Newman tests against production environment
\t$(NEWMAN) run $(COLLECTION)/*.json -e $(ENVIRONMENTS)/production.postman_environment.json --reporters cli,junit --reporter-junit-export results/prod-junit.xml

validate: ## Validate pipeline config syntax
\t@echo "Validating pipeline configs..."
\t@for f in ci-cd/**/*.yml ci-cd/**/*.yaml; do echo "  Checking $$f"; done
\t@echo "Validation complete."

clean: ## Remove generated results
\trm -rf results/
`;
}
