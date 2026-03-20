"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { revalidatePath } from "next/cache";
import {
  createGitHubRepo,
  createGitProvider,
  pushFilesToRepo,
  type GitProviderConfig,
  type RepoTreeEntry,
  type RepoInfo,
  type PullRequestResult,
} from "@/lib/git/provider";
import { buildEngagementPackage } from "./export-package";

function revalidateProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/repo`);
}

async function getProjectGitConfig(projectId: string): Promise<{
  project: { id: string; name: string; gitProvider: string | null; gitRepoOwner: string | null; gitRepoName: string | null; gitToken: string | null; gitBaseBranch: string | null; lastRepoPrNumber: number | null };
} | null> {
  const session = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: {
      id: true, name: true,
      gitProvider: true, gitRepoOwner: true, gitRepoName: true, gitToken: true, gitBaseBranch: true,
      lastRepoPrNumber: true,
    },
  });
  if (!project) return null;
  return { project };
}

function buildGitConfig(project: { gitProvider: string | null; gitRepoOwner: string | null; gitRepoName: string | null; gitToken: string | null; gitBaseBranch: string | null }): GitProviderConfig {
  if (!project.gitProvider || !project.gitRepoOwner || !project.gitRepoName || !project.gitToken) {
    throw new Error("Git integration not configured. Set provider, owner, repo name, and token in project details.");
  }
  return {
    type: project.gitProvider as "github" | "gitlab" | "bitbucket",
    token: project.gitToken,
    repoOwner: project.gitRepoOwner,
    repoName: project.gitRepoName,
    baseBranch: project.gitBaseBranch ?? "main",
  };
}

/**
 * Initialize a new repo under the given org (defaults to postman-cs).
 * Supports GitHub (auto-creates), GitLab/Bitbucket (saves config; repo must already exist).
 */
export async function initializeRepo(
  projectId: string,
  repoName: string,
  org?: string,
  provider?: "github" | "gitlab" | "bitbucket"
): Promise<{ error?: string; repo?: RepoInfo }> {
  const ctx = await getProjectGitConfig(projectId);
  if (!ctx) return { error: "Project not found" };

  const token = ctx.project.gitToken;
  if (!token) return { error: "Git token (PAT) is required. Set it in project details under Integrations." };

  const targetOrg = org || "postman-cs";
  const targetProvider = provider ?? "github";
  const slug = repoName.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");

  if (targetProvider !== "github") {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        gitProvider: targetProvider,
        gitRepoOwner: targetOrg,
        gitRepoName: slug,
        gitBaseBranch: "main",
      },
    });
    revalidateProject(projectId);
    const urlBase = targetProvider === "gitlab" ? "https://gitlab.com" : "https://bitbucket.org";
    return {
      repo: {
        name: slug,
        fullName: `${targetOrg}/${slug}`,
        htmlUrl: `${urlBase}/${targetOrg}/${slug}`,
        defaultBranch: "main",
        private: false,
      },
    };
  }

  try {
    const repo = await createGitHubRepo(token, slug, `CortexLab engagement repo for ${ctx.project.name}`, targetOrg);

    await prisma.project.update({
      where: { id: projectId },
      data: {
        gitProvider: "github",
        gitRepoOwner: targetOrg,
        gitRepoName: slug,
        gitBaseBranch: repo.defaultBranch || "main",
      },
    });

    revalidateProject(projectId);
    return { repo };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create repo";
    return { error: msg };
  }
}

/**
 * Build the engagement package and push all files to the project's git repo.
 */
export async function pushArtifactsToRepo(projectId: string): Promise<{ error?: string; pr?: PullRequestResult }> {
  const ctx = await getProjectGitConfig(projectId);
  if (!ctx) return { error: "Project not found" };

  let config: GitProviderConfig;
  try {
    config = buildGitConfig(ctx.project);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Git not configured" };
  }

  try {
    const pkg = await buildEngagementPackage(projectId);
    if (!pkg || pkg.files.length === 0) return { error: "No artifacts to push. Run the cascade first." };

    const files = pkg.files.map((f) => ({ path: f.path, content: f.content }));

    const pr = await pushFilesToRepo(config, files, {
      branchSuffix: `${Date.now()}`,
      commitMessage: `feat: CortexLab delivery for ${ctx.project.name}\n\n${pkg.summary.totalFiles} files: ${pkg.summary.collections} collections, ${pkg.summary.pipelines} pipelines, ${pkg.summary.testScripts} test scripts`,
      prTitle: `CortexLab Delivery: ${ctx.project.name}`,
    });

    await prisma.project.update({
      where: { id: projectId },
      data: {
        lastRepoPushAt: new Date(),
        lastRepoPrUrl: pr.url,
        lastRepoPrNumber: pr.number,
      },
    });

    revalidateProject(projectId);
    return { pr };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Push failed";
    return { error: msg };
  }
}

/**
 * Get current repo status: info, latest PR, file tree.
 */
export async function getRepoStatus(projectId: string): Promise<{
  error?: string;
  configured: boolean;
  repoUrl?: string;
  lastPushAt?: Date | null;
  lastPrUrl?: string | null;
  prStatus?: "open" | "merged" | "closed";
}> {
  const ctx = await getProjectGitConfig(projectId);
  if (!ctx) return { error: "Project not found", configured: false };

  const p = ctx.project;
  if (!p.gitProvider || !p.gitRepoOwner || !p.gitRepoName) {
    return { configured: false };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { lastRepoPushAt: true, lastRepoPrUrl: true, lastRepoPrNumber: true },
  });

  let prStatus: "open" | "merged" | "closed" | undefined;
  if (p.gitToken && p.lastRepoPrNumber) {
    try {
      const config = buildGitConfig(p);
      const provider = createGitProvider(config);
      const pr = await provider.getPullRequest(p.lastRepoPrNumber);
      prStatus = pr.status;
    } catch {
      // non-fatal
    }
  }

  const repoUrl = p.gitProvider === "github"
    ? `https://github.com/${p.gitRepoOwner}/${p.gitRepoName}`
    : p.gitProvider === "gitlab"
      ? `https://gitlab.com/${p.gitRepoOwner}/${p.gitRepoName}`
      : `https://bitbucket.org/${p.gitRepoOwner}/${p.gitRepoName}`;

  return {
    configured: true,
    repoUrl,
    lastPushAt: project?.lastRepoPushAt,
    lastPrUrl: project?.lastRepoPrUrl,
    prStatus,
  };
}

/**
 * Fetch the file tree from the repo's default branch.
 */
export async function getRepoTree(projectId: string): Promise<{ error?: string; tree?: RepoTreeEntry[] }> {
  const ctx = await getProjectGitConfig(projectId);
  if (!ctx) return { error: "Project not found" };

  let config: GitProviderConfig;
  try {
    config = buildGitConfig(ctx.project);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Git not configured" };
  }

  try {
    const provider = createGitProvider(config);
    const tree = await provider.getRepoTree();
    return { tree };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to fetch tree";
    return { error: msg };
  }
}

// ---------------------------------------------------------------------------
// Push Preview (Point 40)
// ---------------------------------------------------------------------------

export interface PushPreview {
  summary: {
    totalFiles: number;
    collections: number;
    environments: number;
    pipelines: number;
    iacSnippets: number;
    testScripts: number;
    docs: number;
  };
  categories: {
    collections: string[];
    pipelines: string[];
    iac: string[];
    tests: string[];
    docs: string[];
  };
}

export async function previewPush(projectId: string): Promise<{ error?: string; preview?: PushPreview }> {
  const ctx = await getProjectGitConfig(projectId);
  if (!ctx) return { error: "Project not found" };

  try {
    const pkg = await buildEngagementPackage(projectId);
    if (!pkg || pkg.files.length === 0) return { error: "No artifacts to push. Run the cascade first." };

    const categories = {
      collections: pkg.files.filter(f => f.path.startsWith("postman/")).map(f => f.path),
      pipelines: pkg.files.filter(f => f.path.startsWith("ci-cd/")).map(f => f.path),
      iac: pkg.files.filter(f => f.path.startsWith("infrastructure/")).map(f => f.path),
      tests: pkg.files.filter(f => f.path.startsWith("tests/")).map(f => f.path),
      docs: pkg.files.filter(f => f.path.startsWith("docs/") || f.path === "README.md" || f.path === "Makefile").map(f => f.path),
    };

    return { preview: { summary: pkg.summary, categories } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to build preview" };
  }
}

// ---------------------------------------------------------------------------
// One-click Deliver to Repo (Point 39 + 41 + 42)
// ---------------------------------------------------------------------------

export async function deliverToRepo(
  projectId: string,
  options: {
    initRepo?: { repoName: string; org: string; provider: "github" | "gitlab" | "bitbucket" };
    selectedCategories: { collections: boolean; pipelines: boolean; iac: boolean; tests: boolean; docs: boolean };
    prTitle: string;
    prBody: string;
  }
): Promise<{ error?: string; failedStep?: string; pr?: PullRequestResult }> {
  if (options.initRepo) {
    const { repoName, org, provider } = options.initRepo;
    const initResult = await initializeRepo(projectId, repoName, org, provider);
    if (initResult.error) return { error: initResult.error, failedStep: "initialize" };
  }

  const ctx = await getProjectGitConfig(projectId);
  if (!ctx) return { error: "Project not found", failedStep: "config" };

  let config: GitProviderConfig;
  try {
    config = buildGitConfig(ctx.project);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Git not configured", failedStep: "config" };
  }

  const pkg = await buildEngagementPackage(projectId);
  if (!pkg || pkg.files.length === 0) return { error: "No artifacts available. Run the cascade first.", failedStep: "build" };

  const sel = options.selectedCategories;
  const files = pkg.files.filter(f => {
    if (f.path.startsWith("postman/")) return sel.collections;
    if (f.path.startsWith("ci-cd/")) return sel.pipelines;
    if (f.path.startsWith("infrastructure/")) return sel.iac;
    if (f.path.startsWith("tests/")) return sel.tests;
    if (f.path.startsWith("docs/") || f.path === "README.md" || f.path === "Makefile") return sel.docs;
    return true;
  });

  if (files.length === 0) return { error: "No files selected to push.", failedStep: "filter" };

  try {
    const pr = await pushFilesToRepo(config, files.map(f => ({ path: f.path, content: f.content })), {
      branchSuffix: `${Date.now()}`,
      commitMessage: `feat: CortexLab delivery for ${ctx.project.name}\n\n${files.length} files`,
      prTitle: options.prTitle,
      prBody: options.prBody,
    });

    await prisma.project.update({
      where: { id: projectId },
      data: {
        lastRepoPushAt: new Date(),
        lastRepoPrUrl: pr.url,
        lastRepoPrNumber: pr.number,
      },
    });

    revalidateProject(projectId);
    return { pr };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Push failed", failedStep: "push" };
  }
}

// ---------------------------------------------------------------------------
// Poll PR Status (Point 43)
// ---------------------------------------------------------------------------

export async function pollPrStatus(projectId: string): Promise<{
  error?: string;
  status?: "open" | "merged" | "closed";
  url?: string;
}> {
  const ctx = await getProjectGitConfig(projectId);
  if (!ctx) return { error: "Project not found" };

  const p = ctx.project;
  if (!p.lastRepoPrNumber || !p.gitToken) return { error: "No PR to check" };

  try {
    const config = buildGitConfig(p);
    const provider = createGitProvider(config);
    const pr = await provider.getPullRequest(p.lastRepoPrNumber);
    return { status: pr.status, url: pr.url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to fetch PR status" };
  }
}
