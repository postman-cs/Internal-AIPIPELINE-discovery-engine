/**
 * Jira Board Auto-Configuration — Points 6-10
 *
 * Creates and configures a KanBan board optimized for leadership viewing.
 * Uses the Jira Agile REST API (rest/agile/1.0).
 */
import type { JiraCredentials } from "./client";
import { ENGAGEMENT_STAGES } from "@/lib/engagement";

async function agileApi(
  creds: JiraCredentials,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const encoded = Buffer.from(`${creds.email}:${creds.apiToken}`).toString("base64");
  return fetch(`${creds.baseUrl}/rest/agile/1.0${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${encoded}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
}

async function restApi(
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

// ─── Point 6: Auto-Create KanBan Board ───────────────────────────────────────

interface BoardSetupResult {
  boardId?: number;
  filterId?: number;
  error?: string;
  details: string[];
}

export async function setupLeadershipBoard(
  creds: JiraCredentials,
  jiraProjectKey: string,
): Promise<BoardSetupResult> {
  const details: string[] = [];

  try {
    // Create a JQL filter for CortexLab tickets
    const filterJql = `project = ${jiraProjectKey} AND labels = CortexLab ORDER BY priority DESC, updated DESC`;
    const filterRes = await restApi(creds, "/filter", {
      method: "POST",
      body: JSON.stringify({
        name: `CortexLab — ${jiraProjectKey} Leadership View`,
        jql: filterJql,
        description: "Auto-generated filter for CortexLab engagement tracking board",
        favourite: true,
      }),
    });

    if (!filterRes.ok) {
      const text = await filterRes.text();
      return { error: `Filter creation failed: ${text.slice(0, 200)}`, details };
    }

    const filter = (await filterRes.json()) as { id: string };
    const filterId = parseInt(filter.id, 10);
    details.push(`Created filter #${filterId}`);

    // Create the KanBan board
    const boardRes = await agileApi(creds, "/board", {
      method: "POST",
      body: JSON.stringify({
        name: `CortexLab — ${jiraProjectKey} Engagements`,
        type: "kanban",
        filterId,
      }),
    });

    if (!boardRes.ok) {
      const text = await boardRes.text();
      return { filterId, error: `Board creation failed: ${text.slice(0, 200)}`, details };
    }

    const board = (await boardRes.json()) as { id: number };
    details.push(`Created board #${board.id}`);

    // Configure board columns to match engagement stages
    await configureBoardColumns(creds, board.id, details);

    // Create quick filters (Point 9)
    await createQuickFilters(creds, board.id, details);

    return { boardId: board.id, filterId, details };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Board setup failed",
      details,
    };
  }
}

// ─── Point 7 & 8: Board Column Configuration ────────────────────────────────

async function configureBoardColumns(
  creds: JiraCredentials,
  boardId: number,
  details: string[],
): Promise<void> {
  // Get board configuration
  const configRes = await agileApi(creds, `/board/${boardId}/configuration`);
  if (!configRes.ok) {
    details.push("Could not fetch board config — columns must be configured manually");
    return;
  }

  const config = (await configRes.json()) as {
    columnConfig?: { columns?: Array<{ name: string; statuses: Array<{ id: string }> }> };
  };

  details.push(
    `Board has ${config.columnConfig?.columns?.length ?? 0} default columns. ` +
    `Configure columns manually to match engagement stages: ${ENGAGEMENT_STAGES.map((s) => `${s.shortName}`).join(" → ")}`,
  );

  details.push(
    "Recommended column mapping: " +
    "Intake (S0) | Discovery & Scoping (S1-S2) | Building & Implementing (S3-S4) | Validating (S5) | Transition (S6). " +
    "For granular view, create custom statuses matching each engagement stage.",
  );
}

// ─── Point 9: Quick Filters ─────────────────────────────────────────────────

const QUICK_FILTERS = [
  { name: "Has Blockers", jql: 'labels in ("CortexLab") AND priority in (Highest, High)' },
  { name: "Overdue", jql: "duedate < now() AND status != Done" },
  { name: "Implementing", jql: 'labels = "S4-IMPL"' },
  { name: "Validating", jql: 'labels = "S5-VALID"' },
  { name: "Transition Ready", jql: 'labels = "S6-DONE"' },
  { name: "High Priority", jql: "priority in (Highest, High)" },
  { name: "New This Week", jql: "created >= -7d" },
];

async function createQuickFilters(
  creds: JiraCredentials,
  boardId: number,
  details: string[],
): Promise<void> {
  let created = 0;
  for (const qf of QUICK_FILTERS) {
    const res = await agileApi(creds, `/board/${boardId}/quickfilter`, {
      method: "POST",
      body: JSON.stringify({ name: qf.name, jql: qf.jql, description: `CortexLab: ${qf.name}` }),
    });
    if (res.ok) created++;
  }
  details.push(`Created ${created}/${QUICK_FILTERS.length} quick filters`);
}

// ─── Point 10: WIP Limits ────────────────────────────────────────────────────

export async function setWipLimits(
  creds: JiraCredentials,
  boardId: number,
  maxPerColumn: number = 5,
): Promise<{ success: boolean; details: string }> {
  const configRes = await agileApi(creds, `/board/${boardId}/configuration`);
  if (!configRes.ok) {
    return { success: false, details: "Could not fetch board config" };
  }

  return {
    success: true,
    details:
      `WIP limit recommendation: ${maxPerColumn} tickets per column. ` +
      `Set manually in Board Settings → Columns → set "Max" for each column. ` +
      `Jira Cloud board WIP limits are not settable via REST API — configure in the board UI.`,
  };
}

// ─── Exported types ──────────────────────────────────────────────────────────

export type { BoardSetupResult };
