"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { ENGAGEMENT_STAGES } from "@/lib/engagement";
import type { BuildLogData } from "@/lib/engagement";

function safeArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string" && x.trim());
  if (typeof v === "string" && v.trim()) return v.split("\n").map((l) => l.replace(/^[-*•]\s*/, "").trim()).filter(Boolean);
  return [];
}

export interface CaseStudy {
  markdown: string;
  projectName: string;
  generatedAt: string;
}

export async function generateCaseStudy(projectId: string): Promise<CaseStudy | { error: string }> {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: {
      name: true,
      primaryDomain: true,
      engagementStage: true,
      customerContactName: true,
      createdAt: true,
      completedAt: true,
      owner: { select: { name: true } },
    },
  });

  if (!project) return { error: "Project not found" };

  const [discoveryArtifact, buildLogArtifact, blockers, assumptions, aiRuns] = await Promise.all([
    prisma.discoveryArtifact.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
      select: {
        industry: true,
        maturityLevel: true,
        maturityJustification: true,
        hypothesis: true,
        recommendedApproach: true,
        generatedBriefMarkdown: true,
      },
    }),
    prisma.phaseArtifact.findFirst({
      where: { projectId, phase: "BUILD_LOG" },
      orderBy: { version: "desc" },
      select: { contentJson: true },
    }),
    prisma.blocker.findMany({
      where: { projectId },
      select: { title: true, severity: true, status: true, impactScore: true },
      orderBy: { impactScore: "desc" },
    }),
    prisma.assumption.findMany({
      where: { projectId },
      select: { claim: true, status: true, category: true },
    }),
    prisma.aIRun.count({ where: { projectId } }),
  ]);

  const buildLog = (buildLogArtifact?.contentJson ?? {}) as Partial<BuildLogData>;
  const stage = ENGAGEMENT_STAGES[Math.min(project.engagementStage, 6)] ?? ENGAGEMENT_STAGES[0];

  const resolvedBlockers = blockers.filter(b => b.status === "NEUTRALIZED" || b.status === "ACCEPTED");
  const activeBlockers = blockers.filter(b => !["NEUTRALIZED", "ACCEPTED", "DORMANT"].includes(b.status));
  const verifiedAssumptions = assumptions.filter(a => a.status === "VERIFIED" || a.status === "AUTO_VERIFIED");

  const lines: string[] = [];

  lines.push(`# ${project.name} — Executive Summary`);
  lines.push("");
  lines.push(`**Prepared by:** ${project.owner?.name ?? "Unknown"}  `);
  lines.push(`**Customer Contact:** ${project.customerContactName || "N/A"}  `);
  lines.push(`**Domain:** ${project.primaryDomain || "N/A"}  `);
  lines.push(`**Engagement Stage:** ${stage.name} (S${stage.stage})  `);
  lines.push(`**Date:** ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}  `);
  lines.push("");
  lines.push("---");
  lines.push("");

  lines.push("## Engagement Hypothesis");
  lines.push("");
  if (discoveryArtifact?.hypothesis) {
    lines.push(discoveryArtifact.hypothesis);
  } else {
    lines.push("*Discovery pipeline has not yet generated a hypothesis for this engagement.*");
  }
  lines.push("");
  if (discoveryArtifact?.recommendedApproach) {
    lines.push(`**Recommended Approach:** ${discoveryArtifact.recommendedApproach}`);
    lines.push("");
  }
  if (discoveryArtifact?.maturityLevel) {
    lines.push(`**API Maturity Level:** ${discoveryArtifact.maturityLevel}${discoveryArtifact.maturityJustification ? ` — ${discoveryArtifact.maturityJustification}` : ""}`);
    lines.push("");
  }

  lines.push("## What We Built");
  lines.push("");
  const whatWeBuilt = safeArray(buildLog.whatWeBuilt);
  if (whatWeBuilt.length > 0) {
    for (const item of whatWeBuilt) {
      lines.push(`- ${item}`);
    }
  } else {
    lines.push("*Build log not yet populated.*");
  }
  lines.push("");

  lines.push("## Value Delivered");
  lines.push("");
  const valueUnlocked = safeArray(buildLog.valueUnlocked);
  if (valueUnlocked.length > 0) {
    for (const item of valueUnlocked) {
      lines.push(`- ${item}`);
    }
  } else {
    lines.push("*Value outcomes not yet documented.*");
  }
  lines.push("");

  lines.push("## Success Criteria");
  lines.push("");
  const successCriteria = safeArray(buildLog.successCriteria);
  if (successCriteria.length > 0) {
    for (const item of successCriteria) {
      lines.push(`- [ ] ${item}`);
    }
  } else {
    lines.push("*Success criteria not yet defined.*");
  }
  lines.push("");

  if (buildLog.environmentBaseline) {
    const env = buildLog.environmentBaseline;
    const labelMap: Record<string, string> = {
      scm: "Source Control",
      ciCd: "CI/CD Platform",
      gateway: "API Gateway",
      cloud: "Cloud Provider",
      devPortal: "Developer Portal",
      secretsManagement: "Secrets Management",
      currentPostmanUsage: "Current Postman Usage",
      version: "Postman Version",
    };
    const rows: [string, string][] = [];
    for (const [key, label] of Object.entries(labelMap)) {
      const raw = (env as Record<string, unknown>)[key];
      if (typeof raw !== "string" || !raw.trim()) continue;
      // Truncate long values — environment entries should be tech names, not paragraphs
      const value = raw.trim().length > 80 ? raw.trim().slice(0, 77) + "..." : raw.trim();
      rows.push([label, value]);
    }
    if (rows.length > 0) {
      lines.push("## Customer Environment");
      lines.push("");
      lines.push("| Component | Detail |");
      lines.push("|-----------|--------|");
      for (const [label, value] of rows) {
        lines.push(`| ${label} | ${value} |`);
      }
      lines.push("");
    }
  }

  lines.push("## Challenges & Blockers");
  lines.push("");
  if (blockers.length > 0) {
    lines.push(`*${resolvedBlockers.length} resolved, ${activeBlockers.length} active out of ${blockers.length} total*`);
    lines.push("");
    if (resolvedBlockers.length > 0) {
      lines.push("### Resolved");
      lines.push("");
      for (const b of resolvedBlockers.slice(0, 10)) {
        lines.push(`- **${b.title}** (${b.severity}) — Impact: ${b.impactScore}`);
      }
      lines.push("");
    }
    if (activeBlockers.length > 0) {
      lines.push("### Active (Requiring Attention)");
      lines.push("");
      for (const b of activeBlockers.slice(0, 10)) {
        lines.push(`- **${b.title}** (${b.severity}) — Impact: ${b.impactScore}`);
      }
      lines.push("");
    }
  } else {
    lines.push("*No blockers identified.*");
    lines.push("");
  }

  lines.push("## Repeatable Implementation Kit");
  lines.push("");
  const reusablePatterns = safeArray(buildLog.reusablePatterns);
  if (reusablePatterns.length > 0) {
    lines.push("The following patterns have been documented for customer self-service or ProServ handoff:");
    lines.push("");
    for (const item of reusablePatterns) {
      lines.push(`- ${item}`);
    }
  } else {
    lines.push("*Reusable patterns not yet documented.*");
  }
  lines.push("");

  const productGaps = safeArray(buildLog.productGapsRisks);
  if (productGaps.length > 0) {
    lines.push("## Product Gaps & Risks Surfaced");
    lines.push("");
    for (const item of productGaps) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  lines.push("## Next Steps");
  lines.push("");
  const nextSteps = safeArray(buildLog.nextSteps);
  if (nextSteps.length > 0) {
    for (const item of nextSteps) {
      lines.push(`- ${item}`);
    }
  } else {
    lines.push("*Next steps not yet defined.*");
  }
  lines.push("");

  lines.push("## Engagement Metrics");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| AI Analysis Runs | ${aiRuns} |`);
  lines.push(`| Assumptions Verified | ${verifiedAssumptions.length} / ${assumptions.length} |`);
  lines.push(`| Blockers Resolved | ${resolvedBlockers.length} / ${blockers.length} |`);
  lines.push(`| Engagement Duration | ${formatDuration(project.createdAt, project.completedAt || new Date())} |`);
  lines.push("");

  lines.push("---");
  lines.push("");
  lines.push(`*Generated by CortexLab on ${new Date().toISOString().slice(0, 10)}*`);

  // XP: award points for generating a case study
  import("@/lib/gamification/xp-engine").then(({ awardXp, XP_ACTIONS }) => {
    awardXp(session.userId, XP_ACTIONS.CASE_STUDY.action, XP_ACTIONS.CASE_STUDY.points, projectId).catch(() => {});
  }).catch(() => {});

  return {
    markdown: lines.join("\n"),
    projectName: project.name,
    generatedAt: new Date().toISOString(),
  };
}

function formatDuration(start: Date, end: Date): string {
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 7) return `${days} day${days !== 1 ? "s" : ""}`;
  const weeks = Math.floor(days / 7);
  const remainDays = days % 7;
  if (remainDays === 0) return `${weeks} week${weeks !== 1 ? "s" : ""}`;
  return `${weeks} week${weeks !== 1 ? "s" : ""}, ${remainDays} day${remainDays !== 1 ? "s" : ""}`;
}
