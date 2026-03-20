/**
 * Jira Ticket Enrichment — Labels, Priority, Comments, Progress Bars
 *
 * Points 1-5 (metadata), 12-14 (description enrichment & activity comments)
 */
import type { JiraCredentials } from "./client";
import { ENGAGEMENT_STAGES } from "@/lib/engagement";
import { PHASE_GRAPH } from "@/lib/cascade/phases";
import { prisma } from "@/lib/prisma";

// ─── Low-level Jira REST helpers ─────────────────────────────────────────────

async function jiraFetch(
  creds: JiraCredentials,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const encoded = Buffer.from(`${creds.email}:${creds.apiToken}`).toString("base64");
  return fetch(`${creds.baseUrl}/rest/api/3${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${encoded}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
}

// ─── Point 2: Engagement Stage Labels ────────────────────────────────────────

function stageLabel(stage: number): string {
  const s = ENGAGEMENT_STAGES[stage];
  return s ? `S${stage}-${s.shortName}` : `S${stage}`;
}

export async function syncLabels(
  creds: JiraCredentials,
  issueId: string,
  currentStage: number,
): Promise<void> {
  const allStageLabels = ENGAGEMENT_STAGES.map((_, i) => stageLabel(i));
  const targetLabel = stageLabel(currentStage);

  const removeLabels = allStageLabels
    .filter((l) => l !== targetLabel)
    .map((l) => ({ remove: l }));

  const res = await jiraFetch(creds, `/issue/${issueId}`, {
    method: "PUT",
    body: JSON.stringify({
      update: {
        labels: [...removeLabels, { add: targetLabel }, { add: "CortexLab" }],
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn(`[jira-enrich] Label sync failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

// ─── Point 3: Priority Auto-Sync ────────────────────────────────────────────

const BLOCKER_SEVERITY_TO_JIRA_PRIORITY: Record<string, string> = {
  CRITICAL: "Highest",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export async function syncPriority(
  creds: JiraCredentials,
  issueId: string,
  projectId: string,
): Promise<void> {
  const blockers = await prisma.blocker.findMany({
    where: { projectId, status: { notIn: ["NEUTRALIZED", "ACCEPTED", "DORMANT"] } },
    select: { severity: true },
  });

  let jiraPriority = "Medium";
  if (blockers.some((b) => b.severity === "CRITICAL")) jiraPriority = "Highest";
  else if (blockers.some((b) => b.severity === "HIGH")) jiraPriority = "High";
  else if (blockers.length === 0) jiraPriority = "Low";

  const res = await jiraFetch(creds, `/issue/${issueId}`, {
    method: "PUT",
    body: JSON.stringify({ fields: { priority: { name: jiraPriority } } }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn(`[jira-enrich] Priority sync failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

// ─── Point 4: Due Date Estimation ────────────────────────────────────────────

export async function syncDueDate(
  creds: JiraCredentials,
  issueId: string,
  currentStage: number,
  createdAt: Date,
): Promise<void> {
  const remainingStages = 7 - currentStage;
  if (remainingStages <= 0) return;

  const daysPerStage = 14;
  const elapsedMs = Date.now() - createdAt.getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  const pastStages = Math.max(1, currentStage);
  const velocityDaysPerStage = elapsedDays / pastStages;

  const estDaysRemaining = Math.ceil(
    remainingStages * Math.min(velocityDaysPerStage, daysPerStage * 2),
  );

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + estDaysRemaining);
  const dueDateStr = dueDate.toISOString().split("T")[0];

  const res = await jiraFetch(creds, `/issue/${issueId}`, {
    method: "PUT",
    body: JSON.stringify({ fields: { duedate: dueDateStr } }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn(`[jira-enrich] Due date sync failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

// ─── Point 5: Component Tagging ──────────────────────────────────────────────

export async function syncComponents(
  creds: JiraCredentials,
  issueId: string,
  jiraProjectKey: string,
  projectId: string,
): Promise<void> {
  const phases = await prisma.phaseArtifact.findMany({
    where: { projectId },
    distinct: ["phase"],
    select: { phase: true, status: true },
  });

  const activePhases = phases
    .filter((p) => p.status === "CLEAN" || p.status === "CLEAN_WITH_EXCEPTIONS")
    .map((p) => {
      const node = PHASE_GRAPH.find((n) => n.phase === p.phase);
      return node?.label ?? p.phase;
    });

  if (activePhases.length === 0) return;

  for (const name of activePhases) {
    await jiraFetch(creds, `/issue/${issueId}`, {
      method: "PUT",
      body: JSON.stringify({
        update: { components: [{ add: { name } }] },
      }),
    }).catch(() => {});
  }
}

// ─── Point 12: Progress Bar in Description Header ────────────────────────────

export function buildProgressBar(
  completedPhases: number,
  totalPhases: number,
  deliveryPct: number,
): string {
  const filled = Math.round((completedPhases / totalPhases) * 10);
  const empty = 10 - filled;
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);
  return `[${bar}] ${completedPhases}/${totalPhases} phases | ${deliveryPct}% delivery`;
}

// ─── Point 13: Assumption Health Summary ─────────────────────────────────────

export async function getAssumptionSummaryLine(projectId: string): Promise<string> {
  const groups = await prisma.assumption.groupBy({
    by: ["status"],
    where: { projectId },
    _count: true,
  });

  const get = (status: string) => groups.find((g) => g.status === status)?._count ?? 0;
  const verified = get("VERIFIED") + get("AUTO_VERIFIED");
  const pending = get("PENDING");
  const corrected = get("CORRECTED");
  const rejected = get("REJECTED");

  return `\u2705 ${verified} verified | \u26A0\uFE0F ${pending} pending | \uD83D\uDD04 ${corrected} corrected | \u274C ${rejected} rejected`;
}

// ─── Point 14: Activity Log Comments ─────────────────────────────────────────

export async function postActivityComment(
  creds: JiraCredentials,
  issueId: string,
  message: string,
): Promise<void> {
  const body = {
    body: {
      version: 1,
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: `[CortexLab] ${message}` },
          ],
        },
      ],
    },
  };

  const res = await jiraFetch(creds, `/issue/${issueId}/comment`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn(`[jira-enrich] Comment post failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

// ─── Point 15: Fetch Jira comments for bidirectional sync ────────────────────

interface JiraComment {
  id: string;
  body: unknown;
  author: { displayName: string; emailAddress?: string };
  created: string;
}

export async function getIssueComments(
  creds: JiraCredentials,
  issueId: string,
  maxResults = 20,
): Promise<JiraComment[]> {
  const res = await jiraFetch(
    creds,
    `/issue/${issueId}/comment?maxResults=${maxResults}&orderBy=-created`,
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { comments: JiraComment[] };
  return data.comments ?? [];
}

export function extractPlainText(adfBody: unknown): string {
  if (!adfBody || typeof adfBody !== "object") return "";
  const doc = adfBody as { content?: Array<{ content?: Array<{ text?: string }> }> };
  return (
    doc.content
      ?.flatMap((block) => block.content?.map((inline) => inline.text ?? "") ?? [])
      .join(" ")
      .trim() ?? ""
  );
}

// ─── Orchestrator: Full ticket enrichment ────────────────────────────────────

export async function enrichJiraTicket(
  projectId: string,
  userId: string,
  event?: string,
): Promise<void> {
  const { getJiraCredentials } = await import("./client");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      jiraIssueId: true,
      jiraIssueKey: true,
      jiraProjectKey: true,
      engagementStage: true,
      name: true,
      primaryDomain: true,
      createdAt: true,
      owner: { select: { name: true } },
    },
  });

  if (!project?.jiraIssueId) return;

  const creds = await getJiraCredentials(userId);
  if (!creds) return;

  const issueId = project.jiraIssueId;

  try {
    await Promise.allSettled([
      syncLabels(creds, issueId, project.engagementStage),
      syncPriority(creds, issueId, projectId),
      syncDueDate(creds, issueId, project.engagementStage, project.createdAt),
      project.jiraProjectKey
        ? syncComponents(creds, issueId, project.jiraProjectKey, projectId)
        : Promise.resolve(),
    ]);

    if (event) {
      await postActivityComment(creds, issueId, event).catch(() => {});
    }
  } catch (err) {
    console.warn("[jira-enrich] Enrichment failed:", err);
  }
}
