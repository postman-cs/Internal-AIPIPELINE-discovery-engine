"use server";

/**
 * Repo Scaffold — One Service = One Workspace = One Repo
 *
 * Creates a GitHub/GitLab repo and populates it with the full
 * CSE deliverable structure based on cascade artifacts:
 * - API specs, collections, environments
 * - CI/CD pipeline configs
 * - Governance rules (Spectral)
 * - Provisioning automation
 * - README with onboarding guide
 */

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { stringify as toYaml } from "yaml";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RepoFile {
  path: string;
  content: string;
}

interface ScaffoldResult {
  success?: boolean;
  error?: string;
  repoUrl?: string;
  filesCreated?: number;
  postmanWorkspaceUrl?: string;
  postmanErrors?: string[];
}

// ---------------------------------------------------------------------------
// Postman API helpers
// ---------------------------------------------------------------------------

async function postmanApi(
  endpoint: string,
  token: string,
  options?: { method?: string; body?: unknown }
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(`https://api.getpostman.com${endpoint}`, {
    method: options?.method ?? "GET",
    headers: {
      "X-Api-Key": token,
      "Content-Type": "application/json",
      "Accept": "application/vnd.api.v10+json",
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: data as Record<string, unknown> };
}

interface PostmanProvisionResult {
  workspaceId?: string;
  workspaceUrl?: string;
  collectionIds?: string[];
  environmentIds?: string[];
  errors: string[];
}

async function provisionPostmanWorkspace(
  projectName: string,
  domain: string,
  services: string[],
  specYaml: string,
  token: string,
): Promise<PostmanProvisionResult> {
  const errors: string[] = [];
  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // 1. Create workspace
  const wsRes = await postmanApi("/workspaces", token, {
    method: "POST",
    body: {
      workspace: {
        name: `${slug}-api-service`,
        type: "team",
        description: `${projectName} — One Service = One Workspace = One Repo. Auto-provisioned by CSE AI Pipeline.`,
      },
    },
  });

  if (!wsRes.ok) {
    errors.push(`Workspace creation failed: ${JSON.stringify(wsRes.data)}`);
    return { errors };
  }
  const workspaceId = (wsRes.data.workspace as Record<string, unknown>)?.id as string;
  const workspaceUrl = `https://go.postman.co/workspace/${workspaceId}`;

  // 2. Push spec to Spec Hub (v12 /specs endpoint — no API Builder needed)
  const collectionIds: string[] = [];
  let specId: string | undefined;

  const specRes = await postmanApi(`/specs?workspaceId=${workspaceId}`, token, {
    method: "POST",
    body: {
      name: `${projectName} API`,
      type: "OPENAPI:3.0",
      files: [{ path: "openapi.yaml", content: specYaml }],
    },
  });

  if (specRes.ok) {
    specId = specRes.data.id as string;
  } else {
    errors.push(`Spec Hub push failed: ${JSON.stringify(specRes.data)}`);
  }

  // 3. Derive collection from spec via import/openapi (into the same workspace)
  const importRes = await postmanApi(`/import/openapi?workspace=${workspaceId}`, token, {
    method: "POST",
    body: { type: "string", input: specYaml },
  });

  if (importRes.ok) {
    const cols = (importRes.data.collections as Array<{ id: string }>) ?? [];
    for (const col of cols) {
      if (col.id) collectionIds.push(col.id);
    }
  } else {
    errors.push(`Collection generation failed: ${JSON.stringify(importRes.data)}`);
  }

  // 4. Create environments (dev, qa, staging, prod)
  const environmentIds: string[] = [];
  for (const env of ["dev", "qa", "staging", "prod"]) {
    const baseUrl = env === "prod" ? `https://api.${domain}` : `https://api-${env}.${domain}`;
    const envRes = await postmanApi("/environments", token, {
      method: "POST",
      body: {
        environment: {
          name: `${slug}-${env}`,
          values: [
            { key: "baseUrl", value: baseUrl, enabled: true },
            { key: "environment", value: env, enabled: true },
            { key: "apiKey", value: "{{vault:api-key}}", enabled: true, type: "secret" },
          ],
        },
      },
    });
    if (envRes.ok) {
      const envId = (envRes.data.environment as Record<string, unknown>)?.id as string;
      if (envId) environmentIds.push(envId);
    } else {
      errors.push(`Environment ${env} failed: ${JSON.stringify(envRes.data)}`);
    }
  }

  return { workspaceId, workspaceUrl, collectionIds, environmentIds, errors };
}

// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

async function githubApi(
  endpoint: string,
  token: string,
  options?: { method?: string; body?: unknown }
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    method: options?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: data as Record<string, unknown> };
}

// ---------------------------------------------------------------------------
// GitLab API helpers
// ---------------------------------------------------------------------------

async function gitlabApi(
  endpoint: string,
  token: string,
  options?: { method?: string; body?: unknown }
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(`https://gitlab.com/api/v4${endpoint}`, {
    method: options?.method ?? "GET",
    headers: {
      "PRIVATE-TOKEN": token,
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: data as Record<string, unknown> };
}

async function createGitLabRepo(
  namespace: string,
  name: string,
  description: string,
  token: string,
): Promise<{ ok: boolean; url?: string; projectId?: number; error?: string }> {
  // Try to find the namespace ID
  const nsRes = await gitlabApi(`/namespaces?search=${encodeURIComponent(namespace)}`, token);
  const ns = nsRes.ok ? (nsRes.data as unknown as Array<{ id: number; full_path: string }>)
    ?.find((n: { full_path: string }) => n.full_path === namespace) : null;

  const body: Record<string, unknown> = {
    name,
    description,
    visibility: "private",
    initialize_with_readme: true,
  };
  if (ns) body.namespace_id = ns.id;

  let res = await gitlabApi("/projects", token, { method: "POST", body });

  // If name is taken (pending deletion), retry with a suffix
  if (!res.ok && res.status === 400) {
    const errStr = JSON.stringify(res.data);
    if (errStr.includes("has already been taken")) {
      body.name = `${name}-${Date.now().toString(36).slice(-4)}`;
      body.path = body.name;
      res = await gitlabApi("/projects", token, { method: "POST", body });
    }
  }

  if (res.ok) {
    return {
      ok: true,
      url: res.data.web_url as string,
      projectId: res.data.id as number,
    };
  }
  const errDetail = typeof res.data.message === "string"
    ? res.data.message
    : JSON.stringify(res.data.message ?? res.data.error ?? res.status);
  return { ok: false, error: `GitLab (${res.status}): ${errDetail}` };
}

async function pushFilesToGitLab(
  projectId: number,
  files: RepoFile[],
  token: string,
  message = "Initial scaffold — CSE deliverables",
  branch = "main"
): Promise<{ ok: boolean; error?: string }> {
  // GitLab commits API accepts multiple file actions in one commit
  // Use "update" for README.md (auto-created by init), "create" for everything else
  const actions = files.map((f) => ({
    action: (f.path === "README.md" ? "update" : "create") as "create" | "update",
    file_path: f.path,
    content: f.content,
  }));

  const res = await gitlabApi(`/projects/${projectId}/repository/commits`, token, {
    method: "POST",
    body: { branch, commit_message: message, actions },
  });

  if (res.ok) return { ok: true };
  const commitErr = typeof res.data.message === "string" ? res.data.message : JSON.stringify(res.data.message ?? res.status);
  return { ok: false, error: `GitLab commit (${res.status}): ${commitErr}` };
}

// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

async function createGitHubRepo(
  org: string,
  name: string,
  description: string,
  token: string,
  isPrivate = true
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const res = await githubApi(`/orgs/${org}/repos`, token, {
    method: "POST",
    body: { name, description, private: isPrivate, auto_init: true },
  });

  if (res.ok) return { ok: true, url: res.data.html_url as string };

  // Fallback: try creating under user account
  const userRes = await githubApi("/user/repos", token, {
    method: "POST",
    body: { name, description, private: isPrivate, auto_init: true },
  });

  if (userRes.ok) return { ok: true, url: userRes.data.html_url as string };
  return { ok: false, error: `GitHub: ${userRes.data.message ?? userRes.status}` };
}

async function pushFilesToGitHub(
  owner: string,
  repo: string,
  files: RepoFile[],
  token: string,
  message = "Initial scaffold — CSE deliverables"
): Promise<{ ok: boolean; error?: string }> {
  // Get the SHA of the default branch's latest commit
  const refRes = await githubApi(`/repos/${owner}/${repo}/git/ref/heads/main`, token);
  if (!refRes.ok) return { ok: false, error: "Failed to get main branch ref" };
  const latestSha = (refRes.data.object as Record<string, unknown>).sha as string;

  // Get the tree SHA
  const commitRes = await githubApi(`/repos/${owner}/${repo}/git/commits/${latestSha}`, token);
  if (!commitRes.ok) return { ok: false, error: "Failed to get latest commit" };
  const baseTreeSha = (commitRes.data.tree as Record<string, unknown>).sha as string;

  // Create blobs for each file
  const tree: Array<{ path: string; mode: string; type: string; sha: string }> = [];
  for (const file of files) {
    const blobRes = await githubApi(`/repos/${owner}/${repo}/git/blobs`, token, {
      method: "POST",
      body: { content: file.content, encoding: "utf-8" },
    });
    if (!blobRes.ok) continue;
    tree.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha: blobRes.data.sha as string,
    });
  }

  // Create tree
  const treeRes = await githubApi(`/repos/${owner}/${repo}/git/trees`, token, {
    method: "POST",
    body: { base_tree: baseTreeSha, tree },
  });
  if (!treeRes.ok) return { ok: false, error: "Failed to create tree" };

  // Create commit
  const newCommitRes = await githubApi(`/repos/${owner}/${repo}/git/commits`, token, {
    method: "POST",
    body: {
      message,
      tree: treeRes.data.sha,
      parents: [latestSha],
    },
  });
  if (!newCommitRes.ok) return { ok: false, error: "Failed to create commit" };

  // Update ref
  const updateRes = await githubApi(`/repos/${owner}/${repo}/git/refs/heads/main`, token, {
    method: "PATCH",
    body: { sha: newCommitRes.data.sha },
  });
  if (!updateRes.ok) return { ok: false, error: "Failed to update branch" };

  return { ok: true };
}

// ---------------------------------------------------------------------------
// File generators
// ---------------------------------------------------------------------------

function generateReadme(
  projectName: string,
  domain: string,
  services: string[],
  ciPlatform: string,
  customInstructions?: string,
): string {
  return `# ${projectName} — API Platform

> Auto-generated by CSE AI Pipeline. One Service = One Workspace = One Repo.

## Architecture

| Layer | Maps To |
|-------|---------|
| Git repository | One microservice or API |
| Postman workspace | One service |
| API Catalog entry | One service |
| Environment | One deployment target (dev/QA/staging/prod) |

## Services

${services.map((s) => `- \`${s}\``).join("\n")}

## Workspace Contents (per service)

| Artifact | Purpose |
|----------|---------|
| API Spec (OpenAPI) | Source of truth for the contract |
| Baseline collection | Registered endpoints with documentation |
| Smoke test collection | Validates endpoints return expected status |
| Contract test collection | Validates response schemas match spec |
| Environments (dev/QA/staging/prod) | Variables per deployment target |
| Pre-request scripts | Secret resolution from vault |
| Monitor (smoke tests) | 24/7 health checking |

## CI/CD

Platform: **${ciPlatform}**

\`\`\`bash
# Run smoke tests
npx postman-cli run collections/smoke-tests.json -e environments/${domain}-dev.json

# Run contract tests
npx postman-cli run collections/contract-tests.json -e environments/${domain}-dev.json
\`\`\`

## Environments

| Environment | Purpose |
|-------------|---------|
| \`${domain}-dev\` | Development |
| \`${domain}-qa\` | QA / Integration testing |
| \`${domain}-staging\` | Pre-production |
| \`${domain}-prod\` | Production |

## Governance

Spectral rules in \`.spectral.yml\` enforce:
- OpenAPI 3.x compliance
- Naming conventions
- Security scheme requirements
- Response schema validation

## Getting Started

1. Clone this repo
2. Install Postman CLI: \`npm install -g @postman/cli\`
3. Import the workspace: \`postman-cli import --workspace . \`
4. Run tests: \`postman-cli run collections/smoke-tests.json -e environments/${domain}-dev.json\`
${customInstructions ? `\n## Custom Instructions\n\n${customInstructions}\n` : ""}`;
}

function generateOpenApiSpec(projectName: string, domain: string, services: string[]): string {
  const paths: Record<string, unknown> = {};
  for (const svc of services.slice(0, 5)) {
    const slug = svc.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    paths[`/${slug}/health`] = {
      get: {
        summary: `Health check for ${svc}`,
        operationId: `get${svc.replace(/[^a-zA-Z0-9]/g, "")}Health`,
        tags: [svc],
        responses: { "200": { description: "OK" } },
      },
    };
    paths[`/${slug}`] = {
      get: {
        summary: `List ${svc} resources`,
        operationId: `list${svc.replace(/[^a-zA-Z0-9]/g, "")}`,
        tags: [svc],
        responses: { "200": { description: "Success" } },
      },
    };
  }

  return toYaml({
    openapi: "3.0.3",
    info: {
      title: `${projectName} API`,
      version: "1.0.0",
      description: `API specification for ${projectName}. Auto-generated from CSE discovery.`,
    },
    servers: [
      { url: `https://api.${domain}`, description: "Production" },
      { url: `https://api-staging.${domain}`, description: "Staging" },
      { url: `https://api-dev.${domain}`, description: "Development" },
    ],
    paths,
  });
}

function generateGitHubActionsCI(domain: string): string {
  return `name: API Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours

jobs:
  smoke-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install -g @postman/cli
      - run: postman-cli login --with-api-key \${{ secrets.POSTMAN_API_KEY }}
      - name: Run Smoke Tests (Dev)
        run: postman-cli run collections/smoke-tests.json -e environments/${domain}-dev.json --reporters cli,json --reporter-json-export results/smoke-dev.json
      - name: Upload Results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: results/

  contract-tests:
    runs-on: ubuntu-latest
    needs: smoke-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install -g @postman/cli
      - run: postman-cli login --with-api-key \${{ secrets.POSTMAN_API_KEY }}
      - name: Run Contract Tests
        run: postman-cli run collections/contract-tests.json -e environments/${domain}-dev.json --reporters cli,json
`;
}

function generateGitLabCI(domain: string): string {
  return `stages:
  - smoke
  - contract

smoke-tests:
  stage: smoke
  image: node:20
  before_script:
    - npm install -g @postman/cli
    - postman-cli login --with-api-key $POSTMAN_API_KEY
  script:
    - postman-cli run collections/smoke-tests.json -e environments/${domain}-dev.json --reporters cli,json
  artifacts:
    paths:
      - results/

contract-tests:
  stage: contract
  image: node:20
  needs: [smoke-tests]
  before_script:
    - npm install -g @postman/cli
    - postman-cli login --with-api-key $POSTMAN_API_KEY
  script:
    - postman-cli run collections/contract-tests.json -e environments/${domain}-dev.json --reporters cli,json
`;
}

function generateEnvironment(serviceName: string, env: string, domain: string): string {
  return JSON.stringify({
    id: `${serviceName}-${env}`,
    name: `${serviceName}-${env}`,
    values: [
      { key: "baseUrl", value: env === "prod" ? `https://api.${domain}` : `https://api-${env}.${domain}`, enabled: true },
      { key: "environment", value: env, enabled: true },
      { key: "apiKey", value: "{{vault:api-key}}", enabled: true, type: "secret" },
    ],
  }, null, 2);
}

function generateSpectralRules(): string {
  return `extends:
  - spectral:oas

rules:
  # Naming
  operation-operationId-valid-in-url:
    severity: error
  paths-kebab-case:
    severity: warn
    given: "$.paths[*]~"
    then:
      function: pattern
      functionOptions:
        match: "^/[a-z0-9\\-/{}]+$"

  # Security
  oas3-api-servers:
    severity: error
  operation-security-defined:
    severity: warn

  # Response
  operation-success-response:
    severity: error
  oas3-valid-schema-example:
    severity: warn

  # Documentation
  operation-description:
    severity: warn
  info-description:
    severity: error
  info-contact:
    severity: warn
`;
}

function generateSmokeTestCollection(projectName: string, services: string[]): string {
  const items = services.slice(0, 5).map((svc) => {
    const slug = svc.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return {
      name: `${svc} Health Check`,
      request: {
        method: "GET",
        url: { raw: `{{baseUrl}}/${slug}/health`, host: ["{{baseUrl}}"], path: [slug, "health"] },
      },
      event: [{
        listen: "test",
        script: {
          exec: [
            `pm.test("${svc} returns 200", function() {`,
            "  pm.response.to.have.status(200);",
            "});",
          ],
        },
      }],
    };
  });

  return JSON.stringify({
    info: { name: `${projectName} Smoke Tests`, schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
    item: items,
  }, null, 2);
}

function generateContractTestCollection(projectName: string, services: string[]): string {
  const items = services.slice(0, 5).map((svc) => {
    const slug = svc.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return {
      name: `${svc} Contract Validation`,
      request: {
        method: "GET",
        url: { raw: `{{baseUrl}}/${slug}`, host: ["{{baseUrl}}"], path: [slug] },
      },
      event: [{
        listen: "test",
        script: {
          exec: [
            `pm.test("${svc} response matches schema", function() {`,
            "  pm.response.to.have.status(200);",
            "  pm.response.to.have.header('Content-Type');",
            "  const json = pm.response.json();",
            "  pm.expect(json).to.be.an('object');",
            "});",
          ],
        },
      }],
    };
  });

  return JSON.stringify({
    info: { name: `${projectName} Contract Tests`, schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
    item: items,
  }, null, 2);
}

// ---------------------------------------------------------------------------
// Main scaffold action
// ---------------------------------------------------------------------------

export async function scaffoldProjectRepo(projectId: string, customInstructions?: string): Promise<ScaffoldResult> {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: {
      id: true,
      name: true,
      primaryDomain: true,
      gitProvider: true,
      gitRepoOwner: true,
      gitRepoName: true,
      gitToken: true,
      gitBaseBranch: true,
    },
  });
  if (!project) return { error: "Project not found" };

  // Determine domain
  const domain = project.primaryDomain?.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!domain) return { error: "No primary domain configured. Set it in project settings." };

  // Get cascade artifacts
  const artifacts = await prisma.phaseArtifact.findMany({
    where: {
      projectId,
      phase: { in: ["CURRENT_TOPOLOGY", "DESIRED_FUTURE_STATE", "CRAFT_SOLUTION", "DEPLOYMENT_PLAN", "INFRASTRUCTURE"] },
    },
    orderBy: { version: "desc" },
    distinct: ["phase"],
    select: { phase: true, contentJson: true },
  });

  const artifactMap = new Map<string, Record<string, unknown>>();
  for (const a of artifacts) {
    if (a.contentJson) {
      const content = typeof a.contentJson === "string" ? JSON.parse(a.contentJson) : a.contentJson;
      artifactMap.set(a.phase, content as Record<string, unknown>);
    }
  }

  // Extract services from topology
  const topology = artifactMap.get("CURRENT_TOPOLOGY") ?? {};
  const futureState = artifactMap.get("DESIRED_FUTURE_STATE") ?? {};
  const craftSolution = artifactMap.get("CRAFT_SOLUTION") ?? {};
  const deploymentPlan = artifactMap.get("DEPLOYMENT_PLAN") ?? {};
  const infrastructure = artifactMap.get("INFRASTRUCTURE") ?? {};

  // Get service names from topology nodes
  const nodes = (topology.nodes ?? futureState.targetNodes ?? []) as Array<{ name?: string; type?: string }>;
  const services = nodes
    .filter((n) => n.type === "SERVICE" || n.type === "API" || n.type === "GATEWAY")
    .map((n) => n.name ?? "Unknown Service")
    .slice(0, 10);

  if (services.length === 0) {
    services.push(`${project.name} API`);
  }

  // Detect customer's CI/CD platform from deployment plan (for generated configs)
  const ciCdStages = (deploymentPlan.ciCdStages ?? craftSolution.ciCdPipelines ?? []) as Array<{ platform?: string }>;
  const customerCiPlatform = ciCdStages[0]?.platform ?? "github_actions";
  const customerUsesGitLab = customerCiPlatform.includes("gitlab");
  const ciPlatformLabel = customerUsesGitLab ? "GitLab CI" : "GitHub Actions";

  // Determine git token based on platform
  const gitToken = project.gitToken
    || (customerUsesGitLab ? process.env.GITLAB_TOKEN : process.env.GITHUB_TOKEN)
    || process.env.GITHUB_TOKEN
    || process.env.GITLAB_TOKEN;
  if (!gitToken) return { error: "No Git token configured. Set gitToken on the project or GITHUB_TOKEN/GITLAB_TOKEN env var." };

  // Repo naming
  const repoSlug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const repoName = project.gitRepoName || `${repoSlug}-api-platform`;

  // Generate OpenAPI spec as YAML
  const specYaml = generateOpenApiSpec(project.name, domain, services);

  // --- Postman Provisioning (Spec Hub + Workspace + Environments) ---
  let postmanResult: PostmanProvisionResult | null = null;
  const postmanApiKey = process.env.POSTMAN_API_KEY;
  if (postmanApiKey) {
    postmanResult = await provisionPostmanWorkspace(
      project.name,
      domain,
      services,
      specYaml,
      postmanApiKey,
    );
    if (postmanResult.errors.length > 0) {
      console.warn("[scaffold] Postman provisioning warnings:", postmanResult.errors);
    }
  }

  // Generate files (shared between GitHub and GitLab)
  const files: RepoFile[] = [
    { path: "README.md", content: generateReadme(project.name, domain, services, ciPlatformLabel, customInstructions) },
    { path: "specs/openapi.yaml", content: specYaml },
    { path: ".spectral.yml", content: generateSpectralRules() },
    { path: "collections/smoke-tests.json", content: generateSmokeTestCollection(project.name, services) },
    { path: "collections/contract-tests.json", content: generateContractTestCollection(project.name, services) },
    // CI config matches customer's platform
    ...(customerUsesGitLab
      ? [{ path: ".gitlab-ci.yml", content: generateGitLabCI(domain) }]
      : [{ path: ".github/workflows/api-tests.yml", content: generateGitHubActionsCI(domain) }]
    ),
  ];

  // Generate environments
  for (const env of ["dev", "qa", "staging", "prod"]) {
    files.push({
      path: `environments/${domain}-${env}.json`,
      content: generateEnvironment(repoSlug, env, domain),
    });
  }

  // --- Route to correct platform ---
  if (customerUsesGitLab) {
    // GitLab: create repo under the configured namespace
    const gitlabNamespace = project.gitRepoOwner || "dshive";
    const createResult = await createGitLabRepo(
      gitlabNamespace,
      repoName,
      `${project.name} — CSE API Platform. Auto-scaffolded.`,
      gitToken,
    );
    if (!createResult.ok) return { error: createResult.error ?? "Failed to create GitLab repo" };

    const pushResult = await pushFilesToGitLab(createResult.projectId!, files, gitToken);
    if (!pushResult.ok) return { error: `Repo created but file push failed: ${pushResult.error}` };

    await prisma.project.update({
      where: { id: projectId },
      data: {
        gitProvider: "gitlab",
        gitRepoOwner: gitlabNamespace,
        gitRepoName: repoName,
        lastRepoPushAt: new Date(),
      },
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/repo`);
    revalidatePath(`/projects/${projectId}/execution`);

    return {
      success: true,
      repoUrl: createResult.url!,
      filesCreated: files.length,
      postmanWorkspaceUrl: postmanResult?.workspaceUrl,
      postmanErrors: postmanResult?.errors,
    };
  } else {
    // GitHub: create repo under the configured org
    const repoOrg = project.gitRepoOwner || "danielshively-source";
    const createResult = await createGitHubRepo(
      repoOrg,
      repoName,
      `${project.name} — CSE API Platform. Auto-scaffolded.`,
      gitToken,
    );
    if (!createResult.ok) return { error: createResult.error ?? "Failed to create GitHub repo" };

    const owner = createResult.url!.split("/").slice(-2, -1)[0] || repoOrg;
    const pushResult = await pushFilesToGitHub(owner, repoName, files, gitToken);
    if (!pushResult.ok) return { error: `Repo created but file push failed: ${pushResult.error}` };

    await prisma.project.update({
      where: { id: projectId },
      data: {
        gitProvider: "github",
        gitRepoOwner: owner,
        gitRepoName: repoName,
        lastRepoPushAt: new Date(),
      },
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/repo`);
    revalidatePath(`/projects/${projectId}/execution`);

    return {
      success: true,
      repoUrl: createResult.url!,
      filesCreated: files.length,
      postmanWorkspaceUrl: postmanResult?.workspaceUrl,
      postmanErrors: postmanResult?.errors,
    };
  }
}
