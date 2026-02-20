/**
 * Git Provider Abstraction (Feature #5)
 *
 * Technology-agnostic interface for pushing pipeline configs to source control.
 * Supports GitHub, GitLab, Bitbucket, and any git platform via pluggable providers.
 */

import { logger } from "@/lib/logger";

const log = logger.child("git.provider");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GitProviderType = "github" | "gitlab" | "bitbucket" | "generic";

export interface GitProviderConfig {
  type: GitProviderType;
  token: string;             // PAT or OAuth token
  repoOwner: string;         // org or user
  repoName: string;
  baseBranch?: string;       // default: "main"
  apiUrl?: string;           // for self-hosted instances
}

export interface FileCommit {
  path: string;              // e.g., ".github/workflows/postman-tests.yml"
  content: string;           // file content
  encoding?: "utf-8" | "base64";
}

export interface PullRequestResult {
  id: number;
  url: string;               // web URL to the PR/MR
  number: number;
  title: string;
  branch: string;
  status: "open" | "merged" | "closed";
}

export interface GitProvider {
  type: GitProviderType;
  createBranch(branchName: string): Promise<{ sha: string }>;
  commitFiles(branchName: string, files: FileCommit[], message: string): Promise<{ sha: string }>;
  createPullRequest(branchName: string, title: string, body: string): Promise<PullRequestResult>;
  getPullRequest(prNumber: number): Promise<PullRequestResult>;
}

// ---------------------------------------------------------------------------
// GitHub Provider
// ---------------------------------------------------------------------------

class GitHubProvider implements GitProvider {
  type: GitProviderType = "github";
  private token: string;
  private owner: string;
  private repo: string;
  private baseBranch: string;
  private apiUrl: string;

  constructor(config: GitProviderConfig) {
    this.token = config.token;
    this.owner = config.repoOwner;
    this.repo = config.repoName;
    this.baseBranch = config.baseBranch ?? "main";
    this.apiUrl = config.apiUrl ?? "https://api.github.com";
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const url = `${this.apiUrl}${path}`;
    const resp = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`GitHub API ${resp.status}: ${text}`);
    }

    return resp.json();
  }

  async createBranch(branchName: string): Promise<{ sha: string }> {
    // Get base branch SHA
    const ref = (await this.request(
      "GET",
      `/repos/${this.owner}/${this.repo}/git/ref/heads/${this.baseBranch}`
    )) as { object: { sha: string } };

    // Create new branch
    await this.request("POST", `/repos/${this.owner}/${this.repo}/git/refs`, {
      ref: `refs/heads/${branchName}`,
      sha: ref.object.sha,
    });

    return { sha: ref.object.sha };
  }

  async commitFiles(branchName: string, files: FileCommit[], message: string): Promise<{ sha: string }> {
    // For each file, create or update via Contents API
    let lastSha = "";
    for (const file of files) {
      const result = (await this.request(
        "PUT",
        `/repos/${this.owner}/${this.repo}/contents/${file.path}`,
        {
          message,
          content: Buffer.from(file.content, "utf-8").toString("base64"),
          branch: branchName,
        }
      )) as { commit: { sha: string } };
      lastSha = result.commit.sha;
    }

    return { sha: lastSha };
  }

  async createPullRequest(branchName: string, title: string, body: string): Promise<PullRequestResult> {
    const pr = (await this.request("POST", `/repos/${this.owner}/${this.repo}/pulls`, {
      title,
      body,
      head: branchName,
      base: this.baseBranch,
    })) as { number: number; html_url: string; id: number; title: string; state: string };

    return {
      id: pr.id,
      url: pr.html_url,
      number: pr.number,
      title: pr.title,
      branch: branchName,
      status: pr.state === "open" ? "open" : "closed",
    };
  }

  async getPullRequest(prNumber: number): Promise<PullRequestResult> {
    const pr = (await this.request(
      "GET",
      `/repos/${this.owner}/${this.repo}/pulls/${prNumber}`
    )) as { id: number; html_url: string; number: number; title: string; state: string; merged: boolean; head: { ref: string } };

    return {
      id: pr.id,
      url: pr.html_url,
      number: pr.number,
      title: pr.title,
      branch: pr.head.ref,
      status: pr.merged ? "merged" : pr.state === "open" ? "open" : "closed",
    };
  }
}

// ---------------------------------------------------------------------------
// GitLab Provider
// ---------------------------------------------------------------------------

class GitLabProvider implements GitProvider {
  type: GitProviderType = "gitlab";
  private token: string;
  private projectPath: string; // owner/repo URL-encoded
  private baseBranch: string;
  private apiUrl: string;

  constructor(config: GitProviderConfig) {
    this.token = config.token;
    this.projectPath = encodeURIComponent(`${config.repoOwner}/${config.repoName}`);
    this.baseBranch = config.baseBranch ?? "main";
    this.apiUrl = config.apiUrl ?? "https://gitlab.com/api/v4";
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const url = `${this.apiUrl}${path}`;
    const resp = await fetch(url, {
      method,
      headers: {
        "PRIVATE-TOKEN": this.token,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`GitLab API ${resp.status}: ${text}`);
    }

    return resp.json();
  }

  async createBranch(branchName: string): Promise<{ sha: string }> {
    const result = (await this.request(
      "POST",
      `/projects/${this.projectPath}/repository/branches`,
      { branch: branchName, ref: this.baseBranch }
    )) as { commit: { id: string } };

    return { sha: result.commit.id };
  }

  async commitFiles(branchName: string, files: FileCommit[], message: string): Promise<{ sha: string }> {
    const actions = files.map((f) => ({
      action: "create" as const,
      file_path: f.path,
      content: f.content,
    }));

    const result = (await this.request(
      "POST",
      `/projects/${this.projectPath}/repository/commits`,
      {
        branch: branchName,
        commit_message: message,
        actions,
      }
    )) as { id: string };

    return { sha: result.id };
  }

  async createPullRequest(branchName: string, title: string, body: string): Promise<PullRequestResult> {
    const mr = (await this.request(
      "POST",
      `/projects/${this.projectPath}/merge_requests`,
      {
        source_branch: branchName,
        target_branch: this.baseBranch,
        title,
        description: body,
      }
    )) as { iid: number; web_url: string; id: number; title: string; state: string };

    return {
      id: mr.id,
      url: mr.web_url,
      number: mr.iid,
      title: mr.title,
      branch: branchName,
      status: mr.state === "opened" ? "open" : mr.state === "merged" ? "merged" : "closed",
    };
  }

  async getPullRequest(mrIid: number): Promise<PullRequestResult> {
    const mr = (await this.request(
      "GET",
      `/projects/${this.projectPath}/merge_requests/${mrIid}`
    )) as { id: number; web_url: string; iid: number; title: string; state: string; source_branch: string };

    return {
      id: mr.id,
      url: mr.web_url,
      number: mr.iid,
      title: mr.title,
      branch: mr.source_branch,
      status: mr.state === "opened" ? "open" : mr.state === "merged" ? "merged" : "closed",
    };
  }
}

// ---------------------------------------------------------------------------
// Bitbucket Provider
// ---------------------------------------------------------------------------

class BitbucketProvider implements GitProvider {
  type: GitProviderType = "bitbucket";
  private token: string;
  private owner: string;
  private repo: string;
  private baseBranch: string;
  private apiUrl: string;

  constructor(config: GitProviderConfig) {
    this.token = config.token;
    this.owner = config.repoOwner;
    this.repo = config.repoName;
    this.baseBranch = config.baseBranch ?? "main";
    this.apiUrl = config.apiUrl ?? "https://api.bitbucket.org/2.0";
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const url = `${this.apiUrl}${path}`;
    const resp = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Bitbucket API ${resp.status}: ${text}`);
    }

    return resp.json();
  }

  async createBranch(branchName: string): Promise<{ sha: string }> {
    const result = (await this.request(
      "POST",
      `/repositories/${this.owner}/${this.repo}/refs/branches`,
      { name: branchName, target: { hash: this.baseBranch } }
    )) as { target: { hash: string } };

    return { sha: result.target.hash };
  }

  async commitFiles(branchName: string, files: FileCommit[], message: string): Promise<{ sha: string }> {
    // Bitbucket uses form-data for src endpoint, simplified here
    for (const file of files) {
      await this.request(
        "POST",
        `/repositories/${this.owner}/${this.repo}/src`,
        {
          message,
          branch: branchName,
          [file.path]: file.content,
        }
      );
    }
    return { sha: "committed" };
  }

  async createPullRequest(branchName: string, title: string, body: string): Promise<PullRequestResult> {
    const pr = (await this.request(
      "POST",
      `/repositories/${this.owner}/${this.repo}/pullrequests`,
      {
        title,
        description: body,
        source: { branch: { name: branchName } },
        destination: { branch: { name: this.baseBranch } },
      }
    )) as { id: number; links: { html: { href: string } }; title: string; state: string };

    return {
      id: pr.id,
      url: pr.links.html.href,
      number: pr.id,
      title: pr.title,
      branch: branchName,
      status: pr.state === "OPEN" ? "open" : pr.state === "MERGED" ? "merged" : "closed",
    };
  }

  async getPullRequest(prId: number): Promise<PullRequestResult> {
    const pr = (await this.request(
      "GET",
      `/repositories/${this.owner}/${this.repo}/pullrequests/${prId}`
    )) as { id: number; links: { html: { href: string } }; title: string; state: string; source: { branch: { name: string } } };

    return {
      id: pr.id,
      url: pr.links.html.href,
      number: pr.id,
      title: pr.title,
      branch: pr.source.branch.name,
      status: pr.state === "OPEN" ? "open" : pr.state === "MERGED" ? "merged" : "closed",
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGitProvider(config: GitProviderConfig): GitProvider {
  log.info("Creating git provider", { type: config.type, owner: config.repoOwner, repo: config.repoName });

  switch (config.type) {
    case "github":
      return new GitHubProvider(config);
    case "gitlab":
      return new GitLabProvider(config);
    case "bitbucket":
      return new BitbucketProvider(config);
    default:
      throw new Error(`Unsupported git provider: ${config.type}. Supported: github, gitlab, bitbucket`);
  }
}

/**
 * Push pipeline configs to a git repository and create a PR.
 */
export async function pushPipelineConfigs(
  config: GitProviderConfig,
  pipelines: Array<{ filename: string; configContent: string; platformLabel: string }>,
  branchSuffix?: string
): Promise<PullRequestResult> {
  const provider = createGitProvider(config);
  const branch = `postman-cicd-${branchSuffix ?? Date.now()}`;

  log.info("Pushing pipeline configs", { branch, fileCount: pipelines.length });

  // 1. Create branch
  await provider.createBranch(branch);

  // 2. Commit files
  const files: FileCommit[] = pipelines.map((p) => ({
    path: p.filename,
    content: p.configContent,
  }));

  await provider.commitFiles(branch, files, "feat: add Postman CI/CD pipeline configs\n\nGenerated by CortexLab — includes Newman test stages,\nenvironment promotion gates, and Postman monitor checks.");

  // 3. Create PR
  const fileList = pipelines.map((p) => `- \`${p.filename}\` (${p.platformLabel})`).join("\n");

  const prBody = `## Postman CI/CD Pipeline Integration

This PR adds auto-generated CI/CD pipeline configurations for running Postman/Newman
tests as part of your deployment workflow.

### Files Added
${fileList}

### What This Does
- Installs Node.js and Newman in CI
- Runs Postman collections with environment-specific variables
- Uploads JUnit test reports as build artifacts
- Fails the build if critical API tests fail
- Includes environment promotion gates

### Next Steps
1. Review the pipeline configs for your specific needs
2. Add required secrets (e.g., \`POSTMAN_API_KEY\`) to your CI platform
3. Merge and trigger a pipeline run

---
*Generated by CortexLab*`;

  const pr = await provider.createPullRequest(
    branch,
    "feat: Add Postman CI/CD pipeline integration",
    prBody
  );

  log.info("PR created", { url: pr.url, number: pr.number });
  return pr;
}
