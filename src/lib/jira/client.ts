import { prisma } from "@/lib/prisma";
import { PHASE_GRAPH } from "@/lib/cascade/phases";
import { ENGAGEMENT_STAGES } from "@/lib/engagement";

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
// User lookup & assignee
// -------------------------------------------------------------------------

export async function findJiraAccountId(
  creds: JiraCredentials,
  email: string,
): Promise<string | null> {
  const res = await jiraFetch(
    creds,
    `/user/search?query=${encodeURIComponent(email)}`,
  );
  if (!res.ok) return null;
  const users = (await res.json()) as Array<{ accountId: string; emailAddress?: string; active?: boolean }>;
  const match = users.find(
    (u) => u.active !== false && (u.emailAddress?.toLowerCase() === email.toLowerCase()),
  ) ?? users[0];
  return match?.accountId ?? null;
}

export async function assignIssue(
  creds: JiraCredentials,
  issueId: string,
  accountId: string,
): Promise<void> {
  const res = await jiraFetch(creds, `/issue/${issueId}/assignee`, {
    method: "PUT",
    body: JSON.stringify({ accountId }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn(`[jira] Assign issue failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

export async function syncJiraAssignee(
  projectId: string,
  ownerUserId: string,
): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { jiraIssueId: true },
  });
  if (!project?.jiraIssueId) return;

  const creds = await getJiraCredentials(ownerUserId);
  if (!creds) return;

  const owner = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: { jiraEmail: true, email: true },
  });
  const ownerEmail = owner?.jiraEmail || owner?.email;
  if (!ownerEmail) return;

  try {
    const accountId = await findJiraAccountId(creds, ownerEmail);
    if (accountId) {
      await assignIssue(creds, project.jiraIssueId, accountId);
    }
  } catch (err) {
    console.warn("[jira] Assignee sync failed (non-blocking):", err);
  }
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

  const [phaseArtifacts, proposals, discoveryArtifact, blockers, executionArtifacts] = await Promise.all([
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
    prisma.blocker.findMany({
      where: { projectId },
      orderBy: { impactScore: "desc" },
      include: {
        missiles: { select: { id: true, name: true, status: true } },
        nukes: { select: { id: true, name: true, status: true, strategy: true } },
      },
    }),
    prisma.phaseArtifact.findMany({
      where: {
        projectId,
        phase: { in: ["DEPLOYMENT_PLAN", "BUILD_LOG"] },
      },
      orderBy: { version: "desc" },
      distinct: ["phase"],
      select: { phase: true, version: true, status: true, contentJson: true },
    }),
  ]);

  const projectUrl = `${appBaseUrl}/projects/${project.id}`;
  const content: unknown[] = [];

  // Fetch engagement stage + assumption summary for header enrichment
  const projectMeta = await prisma.project.findUnique({
    where: { id: projectId },
    select: { engagementStage: true },
  });
  const engStage = projectMeta?.engagementStage ?? 0;
  const stageName = ENGAGEMENT_STAGES[engStage]?.name ?? `Stage ${engStage}`;

  // Point 12: Progress bar
  const completedPhases = phaseArtifacts.filter(
    (a) => a.status === "CLEAN" || a.status === "CLEAN_WITH_EXCEPTIONS",
  ).length;
  const totalPhases = PHASE_GRAPH.length;
  const filled = Math.round((completedPhases / totalPhases) * 10);
  const empty = 10 - filled;
  const progressBar = `[${"█".repeat(filled)}${"░".repeat(empty)}] ${completedPhases}/${totalPhases} phases`;

  // Point 13: Assumption summary
  const assumptionGroups = await prisma.assumption.groupBy({
    by: ["status"],
    where: { projectId },
    _count: true,
  });
  const aGet = (status: string) => assumptionGroups.find((g) => g.status === status)?._count ?? 0;
  const aVerified = aGet("VERIFIED") + aGet("AUTO_VERIFIED");
  const aPending = aGet("PENDING");
  const aCorrected = aGet("CORRECTED");
  const aRejected = aGet("REJECTED");
  const assumptionLine = `✅ ${aVerified} verified | ⚠️ ${aPending} pending | 🔄 ${aCorrected} corrected | ❌ ${aRejected} rejected`;

  // Header
  content.push(adfHeading(2, `CortexLab: ${project.name}`));
  content.push(
    adfParagraph(
      adfLink("Open in CortexLab Tool", projectUrl),
      adfText(project.primaryDomain ? ` | Domain: ${project.primaryDomain}` : ""),
    ),
  );
  content.push(
    adfParagraph(
      adfBold(`S${engStage} — ${stageName}`),
      adfText(` | ${progressBar}`),
    ),
  );
  content.push(
    adfParagraph(adfText(`Assumptions: ${assumptionLine}`)),
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

  // Blockers summary
  if (blockers.length > 0) {
    const active = blockers.filter((b) => !["ACCEPTED", "DORMANT"].includes(b.status));
    const resolved = blockers.filter((b) => b.status === "ACCEPTED");
    const totalMissiles = blockers.reduce((n, b) => n + b.missiles.length, 0);
    const totalNukes = blockers.reduce((n, b) => n + b.nukes.length, 0);

    content.push(adfRule());
    content.push(adfHeading(3, "\u26A0\uFE0F Blockers"));
    content.push(
      adfParagraph(
        adfText(`${active.length} active | ${resolved.length} resolved | ${totalMissiles} missiles | ${totalNukes} nukes`),
      ),
    );

    const blockerRows = blockers.slice(0, 10).map((b) => {
      const sevEmoji = b.severity === "CRITICAL" ? "\uD83D\uDD34" : b.severity === "HIGH" ? "\uD83D\uDFE0" : "\uD83D\uDFE1";
      const nukeInfo = b.nukes.length > 0
        ? b.nukes.map((n) => `${n.name} (${n.status})`).join(", ")
        : "—";
      const missileInfo = b.missiles.length > 0
        ? `${b.missiles.filter((m) => m.status === "hit").length}/${b.missiles.length} hit`
        : "—";
      return [
        `${sevEmoji} ${b.title}`,
        b.status.replace(/_/g, " "),
        `${b.impactScore}`,
        missileInfo,
        nukeInfo,
      ];
    });
    content.push(adfTable(["Blocker", "Status", "Impact", "Missiles", "Nukes"], blockerRows));

    // Detail top critical/high blockers with nuke strategies
    const criticalBlockers = blockers.filter(
      (b) => (b.severity === "CRITICAL" || b.severity === "HIGH") && b.nukes.length > 0,
    ).slice(0, 5);

    for (const b of criticalBlockers) {
      content.push(adfHeading(4, `\uD83D\uDCA3 ${b.title}`));
      if (b.rootCause) {
        content.push(adfParagraph(adfBold("Root Cause: "), adfText(b.rootCause)));
      }
      for (const nuke of b.nukes) {
        content.push(
          adfParagraph(
            adfBold(`Nuke: ${nuke.name} `),
            adfText(`[${nuke.status}] — ${nuke.strategy.slice(0, 200)}`),
          ),
        );
      }
    }
  }

  // Execution summary
  if (executionArtifacts.length > 0) {
    content.push(adfRule());
    content.push(adfHeading(3, "\uD83D\uDE80 Execution"));

    for (const artifact of executionArtifacts) {
      const data = (artifact.contentJson ?? {}) as Record<string, unknown>;
      const phaseLabel = artifact.phase === "DEPLOYMENT_PLAN" ? "Deployment Plan"
        : "Build Log";

      content.push(adfHeading(4, `${phaseLabel} (v${artifact.version} — ${artifact.status})`));

      if (artifact.phase === "DEPLOYMENT_PLAN") {
        const steps = Array.isArray(data.deploymentSteps) ? data.deploymentSteps : [];
        const stages = Array.isArray(data.ciCdStages) ? data.ciCdStages : [];
        const gates = Array.isArray(data.environmentPromotionGates) ? data.environmentPromotionGates : [];
        const goLive = Array.isArray(data.goLiveCriteria) ? data.goLiveCriteria : [];
        content.push(
          adfParagraph(
            adfText(`${steps.length} deploy steps | ${stages.length} CI/CD stages | ${gates.length} env gates | ${goLive.length} go-live criteria`),
          ),
        );
        if (steps.length > 0) {
          const stepRows = steps.slice(0, 8).map((s: Record<string, unknown>) => [
            String(s.title || s.name || "Step"),
            String(s.phase || "—"),
            String(s.estimatedDuration || "—"),
          ]);
          content.push(adfTable(["Step", "Phase", "Duration"], stepRows));
        }
      }

      if (artifact.phase === "BUILD_LOG") {
        const whatWeBuilt = Array.isArray(data.whatWeBuilt) ? data.whatWeBuilt : [];
        const valueUnlocked = Array.isArray(data.valueUnlocked) ? data.valueUnlocked : [];
        const reusablePatterns = Array.isArray(data.reusablePatterns) ? data.reusablePatterns : [];
        const nextSteps = Array.isArray(data.nextSteps) ? data.nextSteps : [];
        content.push(
          adfParagraph(
            adfText(`${whatWeBuilt.length} artifacts | ${valueUnlocked.length} outcomes | ${reusablePatterns.length} patterns | ${nextSteps.length} next steps`),
          ),
        );
        if (whatWeBuilt.length > 0) {
          const builtRows = whatWeBuilt.slice(0, 8).map((item: unknown) => [
            String(item),
          ]);
          content.push(adfTable(["What We Built"], builtRows));
        }
      }
    }
  }

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
  event?: string,
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

    // Points 1-5: Full ticket enrichment (labels, priority, due date, components)
    const { enrichJiraTicket } = await import("./enrichment");
    await enrichJiraTicket(projectId, userId, event).catch((err) =>
      console.warn("[jira] Enrichment failed:", err),
    );
  } catch (err) {
    console.warn("[jira] Description sync failed (non-blocking):", err);
  }
}

// -------------------------------------------------------------------------
// Jira status transitions (for engagement stage sync)
// -------------------------------------------------------------------------

// Custom stage statuses — created via the Jira workflow setup script.
// syncJiraStatusForStage tries these first, then falls back to the generic 3.
const ENGAGEMENT_STAGE_STATUS_NAMES: Record<number, string> = {
  0: "S0 - Intake Qualification",
  1: "S1 - Technical Discovery",
  2: "S2 - Buy-in & Pilot Scoping",
  3: "S3 - Internal Proof & Asset Prep",
  4: "S4 - Customer Implementation",
  5: "S5 - Pilot Validation & Pattern Creation",
  6: "S6 - Transition / Redeploy",
};

const ENGAGEMENT_STAGE_FALLBACK: Record<number, string> = {
  0: "To Do",
  1: "To Do",
  2: "To Do",
  3: "In Progress",
  4: "In Progress",
  5: "In Progress",
  6: "Done",
};

export async function getAvailableTransitions(
  creds: JiraCredentials,
  issueId: string,
): Promise<Array<{ id: string; name: string }>> {
  const res = await jiraFetch(creds, `/issue/${issueId}/transitions`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira get transitions failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { transitions: Array<{ id: string; name: string; to: { name: string } }> };
  return data.transitions.map((t) => ({ id: t.id, name: t.to.name }));
}

export async function transitionIssue(
  creds: JiraCredentials,
  issueId: string,
  transitionId: string,
): Promise<void> {
  const res = await jiraFetch(creds, `/issue/${issueId}/transitions`, {
    method: "POST",
    body: JSON.stringify({ transition: { id: transitionId } }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jira transition failed (${res.status}): ${text}`);
  }
}

export async function syncJiraStatusForStage(
  projectId: string,
  userId: string,
  newStage: number,
): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { jiraIssueId: true, engagementStage: true },
  });

  if (!project?.jiraIssueId) return;

  const creds = await getJiraCredentials(userId);
  if (!creds) return;

  const customStatus = ENGAGEMENT_STAGE_STATUS_NAMES[newStage];
  const fallbackStatus = ENGAGEMENT_STAGE_FALLBACK[newStage] ?? "In Progress";
  const stagePrefix = `s${newStage} -`;

  try {
    const transitions = await getAvailableTransitions(creds, project.jiraIssueId);

    // Try exact match first, then prefix match (S0 -, S1 -, etc.), then generic fallback
    const match =
      transitions.find((t) => t.name.toLowerCase() === customStatus?.toLowerCase()) ??
      transitions.find((t) => t.name.toLowerCase().startsWith(stagePrefix)) ??
      transitions.find((t) => t.name.toLowerCase() === fallbackStatus.toLowerCase());

    if (match) {
      await transitionIssue(creds, project.jiraIssueId, match.id);
    }

    await syncJiraDescription(projectId, userId);

    const { enrichJiraTicket } = await import("./enrichment");
    const stageName = ENGAGEMENT_STAGES[newStage]?.name ?? `Stage ${newStage}`;
    await enrichJiraTicket(
      projectId,
      userId,
      `Stage advanced to S${newStage} — ${stageName}`,
    ).catch((err) => console.warn("[jira] Enrichment failed:", err));
  } catch (err) {
    console.warn("[jira] Stage sync failed (non-blocking):", err);
  }
}
