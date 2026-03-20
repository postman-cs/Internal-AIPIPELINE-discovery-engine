/**
 * Jira Portfolio Digest & Slack Notifications — Points 19-20
 */
import { prisma } from "@/lib/prisma";
import { ENGAGEMENT_STAGES } from "@/lib/engagement";
import { PHASE_GRAPH } from "@/lib/cascade/phases";
import { buildProgressBar, getAssumptionSummaryLine, postActivityComment } from "./enrichment";
import type { JiraCredentials } from "./client";

// ─── Point 19: Weekly Portfolio Digest ───────────────────────────────────────

export interface DigestData {
  generatedAt: string;
  period: string;
  totalEngagements: number;
  byStage: Array<{ stage: number; name: string; count: number; color: string }>;
  stageChanges: Array<{ project: string; from: number; to: number; changedAt: string }>;
  newBlockers: number;
  resolvedBlockers: number;
  cascadeRuns: number;
  healthScores: Array<{ project: string; phasesComplete: number; totalPhases: number; deliveryPct: number }>;
  topBlockers: Array<{ project: string; title: string; severity: string }>;
}

export async function generateWeeklyDigest(): Promise<DigestData> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const [projects, newBlockers, resolvedBlockers, cascadeJobs, auditLogs] =
    await Promise.all([
      prisma.project.findMany({
        select: {
          id: true,
          name: true,
          engagementStage: true,
          createdAt: true,
          phaseArtifacts: {
            distinct: ["phase"],
            orderBy: { version: "desc" },
            select: { phase: true, status: true },
          },
          _count: { select: { blockers: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.blocker.count({
        where: { createdAt: { gte: oneWeekAgo } },
      }),
      prisma.blocker.count({
        where: { resolvedAt: { gte: oneWeekAgo } },
      }),
      prisma.recomputeJob.count({
        where: { startedAt: { gte: oneWeekAgo } },
      }),
      prisma.auditLog.findMany({
        where: {
          action: "CASCADE_TRIGGER",
          createdAt: { gte: oneWeekAgo },
        },
        select: {
          targetId: true,
          metadataJson: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

  const byStage = ENGAGEMENT_STAGES.map((s) => ({
    stage: s.stage,
    name: s.name,
    count: projects.filter((p) => p.engagementStage === s.stage).length,
    color: s.color,
  }));

  const stageChanges = auditLogs.map((log) => {
    const meta = (log.metadataJson ?? {}) as Record<string, unknown>;
    const proj = projects.find((p) => p.id === log.targetId);
    return {
      project: proj?.name ?? String(log.targetId).slice(0, 12),
      from: (meta.fromStage as number) ?? 0,
      to: (meta.toStage as number) ?? 0,
      changedAt: log.createdAt.toISOString(),
    };
  });

  const healthScores = projects.map((p) => {
    const cleanPhases = p.phaseArtifacts.filter(
      (a) => a.status === "CLEAN" || a.status === "CLEAN_WITH_EXCEPTIONS",
    ).length;
    const totalPhases = PHASE_GRAPH.length;

    const gates = [
      cleanPhases >= totalPhases - 1,
      p.phaseArtifacts.some((a) => a.phase === "BUILD_LOG"),
    ];
    const deliveryPct = Math.round((gates.filter(Boolean).length / 7) * 100);

    return {
      project: p.name,
      phasesComplete: cleanPhases,
      totalPhases,
      deliveryPct,
    };
  });

  const topBlockers = await prisma.blocker.findMany({
    where: {
      status: { notIn: ["NEUTRALIZED", "ACCEPTED", "DORMANT"] },
    },
    orderBy: { impactScore: "desc" },
    take: 5,
    select: {
      title: true,
      severity: true,
      project: { select: { name: true } },
    },
  });

  return {
    generatedAt: new Date().toISOString(),
    period: `${oneWeekAgo.toLocaleDateString()} — ${new Date().toLocaleDateString()}`,
    totalEngagements: projects.length,
    byStage,
    stageChanges,
    newBlockers,
    resolvedBlockers,
    cascadeRuns: cascadeJobs,
    healthScores,
    topBlockers: topBlockers.map((b) => ({
      project: b.project.name,
      title: b.title,
      severity: b.severity,
    })),
  };
}

export function formatDigestAsMarkdown(d: DigestData): string {
  const lines: string[] = [];
  lines.push(`# CortexLab Weekly Digest`);
  lines.push(`**Period:** ${d.period}`);
  lines.push(`**Total Engagements:** ${d.totalEngagements}\n`);

  lines.push(`## Pipeline Distribution`);
  for (const s of d.byStage) {
    if (s.count > 0) lines.push(`- **S${s.stage} ${s.name}:** ${s.count}`);
  }

  if (d.stageChanges.length > 0) {
    lines.push(`\n## Stage Changes This Week`);
    for (const c of d.stageChanges) {
      const from = ENGAGEMENT_STAGES[c.from]?.shortName ?? `S${c.from}`;
      const to = ENGAGEMENT_STAGES[c.to]?.shortName ?? `S${c.to}`;
      lines.push(`- **${c.project}**: ${from} → ${to}`);
    }
  }

  lines.push(`\n## Activity`);
  lines.push(`- Cascade runs: **${d.cascadeRuns}**`);
  lines.push(`- New blockers: **${d.newBlockers}**`);
  lines.push(`- Resolved blockers: **${d.resolvedBlockers}**`);

  if (d.topBlockers.length > 0) {
    lines.push(`\n## Top Active Blockers`);
    for (const b of d.topBlockers) {
      const emoji = b.severity === "CRITICAL" ? "\uD83D\uDD34" : b.severity === "HIGH" ? "\uD83D\uDFE0" : "\uD83D\uDFE1";
      lines.push(`- ${emoji} **${b.project}**: ${b.title}`);
    }
  }

  lines.push(`\n## Health Snapshots`);
  for (const h of d.healthScores.slice(0, 10)) {
    lines.push(`- **${h.project}**: ${buildProgressBar(h.phasesComplete, h.totalPhases, h.deliveryPct)}`);
  }

  lines.push(`\n---\n*Generated ${new Date().toLocaleString()}*`);
  return lines.join("\n");
}

// ─── Point 20: Slack / Webhook Stage Change Alerts ───────────────────────────

export async function sendStageChangeAlert(
  projectId: string,
  projectName: string,
  fromStage: number,
  toStage: number,
  cseName: string,
): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { slackWebhookUrl: true, owner: { select: { jiraBaseUrl: true } } },
  });

  const fromLabel = ENGAGEMENT_STAGES[fromStage]?.shortName ?? `S${fromStage}`;
  const toLabel = ENGAGEMENT_STAGES[toStage]?.name ?? `S${toStage}`;

  const blockerCount = await prisma.blocker.count({
    where: {
      projectId,
      status: { notIn: ["NEUTRALIZED", "ACCEPTED", "DORMANT"] },
    },
  });

  const phases = await prisma.phaseArtifact.findMany({
    where: { projectId },
    distinct: ["phase"],
    select: { status: true },
  });
  const cleanPhases = phases.filter(
    (p) => p.status === "CLEAN" || p.status === "CLEAN_WITH_EXCEPTIONS",
  ).length;
  const healthPct = phases.length > 0 ? Math.round((cleanPhases / PHASE_GRAPH.length) * 100) : 0;

  const message =
    `[${projectName}] S${fromStage} → S${toStage} ${toLabel} | ` +
    `${blockerCount} blocker${blockerCount !== 1 ? "s" : ""} | ` +
    `Health: ${healthPct}% | CSE: ${cseName}`;

  // Slack webhook
  if (project?.slackWebhookUrl) {
    try {
      await fetch(project.slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: message,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text:
                  `:rocket: *${projectName}* stage advanced\n` +
                  `*${fromLabel}* → *S${toStage} ${toLabel}*\n` +
                  `Blockers: ${blockerCount} | Health: ${healthPct}% | CSE: ${cseName}`,
              },
            },
          ],
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      console.warn("[jira-digest] Slack alert failed:", err);
    }
  }

  // Also post as Jira comment (Point 14)
  try {
    const { getJiraCredentials } = await import("./client");
    const proj = await prisma.project.findUnique({
      where: { id: projectId },
      select: { jiraIssueId: true, ownerUserId: true },
    });
    if (proj?.jiraIssueId && proj.ownerUserId) {
      const creds = await getJiraCredentials(proj.ownerUserId);
      if (creds) {
        await postActivityComment(
          creds,
          proj.jiraIssueId,
          `Stage advanced: S${fromStage} ${fromLabel} → S${toStage} ${toLabel}. ${blockerCount} active blockers. Health: ${healthPct}%.`,
        );
      }
    }
  } catch {
    // non-blocking
  }
}
