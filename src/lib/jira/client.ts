import { prisma } from "@/lib/prisma";
import { PHASE_GRAPH } from "@/lib/cascade/phases";

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

export interface JiraCredentials {
  baseUrl: string;
  email: string;
  apiToken: string;
}

interface JiraIssueResponse {
  id: string;
  key: string;
  self: string;
}

// -------------------------------------------------------------------------
// Client helpers
// -------------------------------------------------------------------------

export async function getJiraCredentials(
  userId: string,
): Promise<JiraCredentials | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { jiraBaseUrl: true, jiraEmail: true, jiraApiToken: true },
  });

  if (!user?.jiraBaseUrl || !user?.jiraEmail || !user?.jiraApiToken) {
    return null;
  }

  return {
    baseUrl: user.jiraBaseUrl.replace(/\/+$/, ""),
    email: user.jiraEmail,
    apiToken: user.jiraApiToken,
  };
}

function authHeader(creds: JiraCredentials): string {
  const encoded = Buffer.from(`${creds.email}:${creds.apiToken}`).toString(
    "base64",
  );
  return `Basic ${encoded}`;
}

async function jiraFetch(
  creds: JiraCredentials,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = `${creds.baseUrl}/rest/api/3${path}`;
  return fetch(url, {
    ...options,
    headers: {
      Authorization: authHeader(creds),
      "Content-Type": "application/json",
      Accept: "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
}

// -------------------------------------------------------------------------
// Test connection
// -------------------------------------------------------------------------

export async function testJiraConnection(
  creds: JiraCredentials,
): Promise<{ ok: boolean; displayName?: string; error?: string }> {
  try {
    const res = await jiraFetch(creds, "/myself");
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as { displayName?: string };
    return { ok: true, displayName: data.displayName };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// -------------------------------------------------------------------------
// Create issue
// -------------------------------------------------------------------------

export async function createIssue(
  creds: JiraCredentials,
  projectKey: string,
  summary: string,
  descriptionAdf: unknown,
  issueTypeName = "Task",
  extraFields?: Record<string, unknown>,
): Promise<{ issueKey: string; issueId: string }> {
  const body = {
    fields: {
      project: { key: projectKey },
      summary,
      description: descriptionAdf,
      issuetype: { name: issueTypeName },
      ...extraFields,
    },
  };

  const res = await jiraFetch(creds, "/issue", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira create issue failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as JiraIssueResponse;
  return { issueKey: data.key, issueId: data.id };
}

// -------------------------------------------------------------------------
// Update issue description
// -------------------------------------------------------------------------

export async function updateIssueDescription(
  creds: JiraCredentials,
  issueId: string,
  descriptionAdf: unknown,
): Promise<void> {
  const res = await jiraFetch(creds, `/issue/${issueId}`, {
    method: "PUT",
    body: JSON.stringify({ fields: { description: descriptionAdf } }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Jira update description failed (${res.status}): ${text}`,
    );
  }
}

// -------------------------------------------------------------------------
// ADF (Atlassian Document Format) builders
// -------------------------------------------------------------------------

function adfDoc(...content: unknown[]) {
  return { version: 1, type: "doc", content };
}

function adfHeading(level: number, text: string) {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

function adfParagraph(...inlines: unknown[]) {
  return { type: "paragraph", content: inlines };
}

function adfText(text: string, marks?: unknown[]) {
  const node: Record<string, unknown> = { type: "text", text };
  if (marks) node.marks = marks;
  return node;
}

function adfLink(text: string, href: string) {
  return adfText(text, [{ type: "link", attrs: { href } }]);
}

function adfBold(text: string) {
  return adfText(text, [{ type: "strong" }]);
}

function adfRule() {
  return { type: "rule" };
}

function adfTable(headers: string[], rows: string[][]) {
  const headerRow = {
    type: "tableRow",
    content: headers.map((h) => ({
      type: "tableHeader",
      content: [adfParagraph(adfBold(h))],
    })),
  };

  const dataRows = rows.map((cells) => ({
    type: "tableRow",
    content: cells.map((c) => ({
      type: "tableCell",
      content: [adfParagraph(adfText(c))],
    })),
  }));

  return {
    type: "table",
    attrs: { isNumberColumnEnabled: false, layout: "default" },
    content: [headerRow, ...dataRows],
  };
}

function statusEmoji(status: string): string {
  switch (status) {
    case "CLEAN":
      return "\u2705";
    case "DIRTY":
      return "\uD83D\uDFE1";
    case "NEEDS_REVIEW":
      return "\uD83D\uDD35";
    case "STALE":
      return "\u26AA";
    case "CLEAN_WITH_EXCEPTIONS":
      return "\u2705\u26A0\uFE0F";
    default:
      return "\u2B1C";
  }
}

// -------------------------------------------------------------------------
// Build structured description for a project
// -------------------------------------------------------------------------

export async function buildProjectDescription(
  projectId: string,
  appBaseUrl = "http://localhost:3000",
): Promise<unknown> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { id: true, name: true, primaryDomain: true },
  });

  const [phaseArtifacts, proposals, discoveryArtifact] = await Promise.all([
    prisma.phaseArtifact.findMany({
      where: { projectId },
      distinct: ["phase"],
      orderBy: { version: "desc" },
      select: { phase: true, version: true, status: true, lastComputedAt: true },
    }),
    prisma.proposal.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        phase: true,
        status: true,
        diffSummary: true,
        createdAt: true,
      },
    }),
    prisma.phaseArtifact.findFirst({
      where: { projectId, phase: "DISCOVERY" },
      orderBy: { version: "desc" },
      select: { contentJson: true },
    }),
  ]);

  const projectUrl = `${appBaseUrl}/projects/${project.id}`;
  const content: unknown[] = [];

  // Header
  content.push(adfHeading(2, `CortexLab: ${project.name}`));
  content.push(
    adfParagraph(
      adfLink("Open in CortexLab Tool", projectUrl),
      adfText(project.primaryDomain ? ` | Domain: ${project.primaryDomain}` : ""),
    ),
  );

  // Discovery brief summary
  if (discoveryArtifact?.contentJson) {
    const disc = discoveryArtifact.contentJson as Record<string, unknown>;
    const hyp = disc.hypothesis as Record<string, unknown> | undefined;
    const maturity = disc.maturity as Record<string, unknown> | undefined;

    content.push(adfRule());
    content.push(adfHeading(3, "Discovery Summary"));

    if (hyp?.text) {
      content.push(adfParagraph(adfBold("Hypothesis: "), adfText(String(hyp.text))));
    }
    if (hyp?.recommendedApproach) {
      content.push(
        adfParagraph(
          adfBold("Approach: "),
          adfText(String(hyp.recommendedApproach)),
        ),
      );
    }
    if (maturity?.level) {
      content.push(
        adfParagraph(
          adfBold("Maturity Level: "),
          adfText(String(maturity.level)),
          adfText(maturity.justification ? ` — ${maturity.justification}` : ""),
        ),
      );
    }
  }

  // Phase status table
  content.push(adfRule());
  content.push(adfHeading(3, "Phase Status"));

  const artifactMap = new Map(phaseArtifacts.map((a) => [a.phase, a]));
  const phaseRows = PHASE_GRAPH.map((node) => {
    const a = artifactMap.get(node.phase);
    const status = a?.status ?? "STALE";
    const version = a ? `v${a.version}` : "—";
    return [
      `${statusEmoji(status)} ${node.label}`,
      status.replace(/_/g, " "),
      version,
    ];
  });
  content.push(adfTable(["Phase", "Status", "Version"], phaseRows));

  // Proposals summary
  const pending = proposals.filter((p) => p.status === "PENDING");
  const accepted = proposals.filter((p) => p.status === "ACCEPTED");
  const rejected = proposals.filter((p) => p.status === "REJECTED");

  if (proposals.length > 0) {
    content.push(adfRule());
    content.push(adfHeading(3, "Proposals"));
    content.push(
      adfParagraph(
        adfText(
          `${pending.length} pending | ${accepted.length} accepted | ${rejected.length} rejected`,
        ),
      ),
    );

    if (pending.length > 0) {
      const recentPending = pending.slice(0, 5);
      for (const p of recentPending) {
        const phaseName =
          PHASE_GRAPH.find((n) => n.phase === p.phase)?.label ?? p.phase;
        const summary = p.diffSummary?.slice(0, 120) ?? "No summary";
        content.push(
          adfParagraph(
            adfBold(`[${phaseName}] `),
            adfText(summary),
          ),
        );
      }
    }
  }

  // Footer
  content.push(adfRule());
  content.push(
    adfParagraph(
      adfText(`Last synced: ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`),
    ),
  );

  return adfDoc(...content);
}

// -------------------------------------------------------------------------
// Initial description (for project creation, before any discovery)
// -------------------------------------------------------------------------

export function buildInitialDescription(
  projectName: string,
  domain: string | null,
  projectUrl: string,
): unknown {
  return adfDoc(
    adfHeading(2, `CortexLab: ${projectName}`),
    adfParagraph(
      adfLink("Open in CortexLab Tool", projectUrl),
      adfText(domain ? ` | Domain: ${domain}` : ""),
    ),
    adfRule(),
    adfParagraph(
      adfText("Discovery pending. Run the CortexLab to populate this ticket with insights."),
    ),
  );
}

// -------------------------------------------------------------------------
// High-level sync function
// -------------------------------------------------------------------------

export async function syncJiraDescription(
  projectId: string,
  userId: string,
): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { jiraIssueId: true },
  });

  if (!project?.jiraIssueId) return;

  const creds = await getJiraCredentials(userId);
  if (!creds) return;

  try {
    const description = await buildProjectDescription(projectId);
    await updateIssueDescription(creds, project.jiraIssueId, description);
  } catch (err) {
    console.warn("[jira] Description sync failed (non-blocking):", err);
  }
}
