"use server";

/**
 * Pipeline Health Server Actions (Feature #8, #18)
 *
 * Tracks pipeline deployments, aggregates Newman test results,
 * and provides health dashboard data.
 */

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineHealthSummary {
  deployments: Array<{
    id: string;
    platform: string;
    platformLabel: string;
    repoUrl: string | null;
    filename: string | null;
    prUrl: string | null;
    lastStatus: string;
    lastRunAt: string | null;
    createdAt: string;
  }>;
  testResults: {
    recent: Array<{
      id: string;
      collectionName: string | null;
      environmentName: string | null;
      status: string;
      totalAssertions: number;
      passedAssertions: number;
      failedAssertions: number;
      totalDuration: number;
      source: string;
      createdAt: string;
    }>;
    trends: {
      totalRuns: number;
      passRate: number;
      avgDuration: number;
      last7DaysPass: number;
      last7DaysFail: number;
    };
  };
  healthMatrix: Array<{
    collection: string;
    environment: string;
    lastStatus: string;
    lastRunAt: string;
    passRate: number;
  }>;
}

// ---------------------------------------------------------------------------
// Pipeline Deployment Tracking
// ---------------------------------------------------------------------------

export async function trackPipelineDeployment(
  projectId: string,
  deployment: {
    platform: string;
    platformLabel: string;
    repoUrl?: string;
    pipelineRef?: string;
    filename?: string;
    branchName?: string;
    prUrl?: string;
  }
) {
  const session = await requireAuth();

  // Verify ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true },
  });
  if (!project) return { error: "Project not found" };

  const result = await prisma.pipelineDeployment.create({
    data: {
      projectId,
      platform: deployment.platform,
      platformLabel: deployment.platformLabel,
      repoUrl: deployment.repoUrl,
      pipelineRef: deployment.pipelineRef,
      filename: deployment.filename,
      branchName: deployment.branchName,
      prUrl: deployment.prUrl,
      lastStatus: "pending",
    },
  });

  return { success: true, deploymentId: result.id };
}

export async function updatePipelineStatus(
  deploymentId: string,
  status: string,
  lastRunAt?: Date
) {
  const session = await requireAuth();

  const deployment = await prisma.pipelineDeployment.findFirst({
    where: { id: deploymentId, project: { ownerUserId: session.userId } },
    select: { id: true },
  });
  if (!deployment) return { error: "Deployment not found" };

  await prisma.pipelineDeployment.update({
    where: { id: deploymentId },
    data: {
      lastStatus: status,
      lastRunAt: lastRunAt ?? new Date(),
    },
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Pipeline Health Dashboard Data
// ---------------------------------------------------------------------------

export async function getPipelineHealthData(
  projectId: string
): Promise<PipelineHealthSummary | null> {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true },
  });
  if (!project) return null;

  // Fetch deployments
  const deployments = await prisma.pipelineDeployment.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Fetch recent Newman test results
  const recentResults = await prisma.newmanTestResult.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Calculate trends
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const last7Days = recentResults.filter(
    (r) => r.createdAt >= sevenDaysAgo
  );

  const totalRuns = recentResults.length;
  const passCount = recentResults.filter((r) => r.status === "pass").length;
  const passRate = totalRuns > 0 ? Math.round((passCount / totalRuns) * 100) : 0;
  const avgDuration = totalRuns > 0
    ? Math.round(recentResults.reduce((sum, r) => sum + r.totalDuration, 0) / totalRuns)
    : 0;

  // Health matrix: collection x environment
  const matrixMap = new Map<string, {
    collection: string;
    environment: string;
    lastStatus: string;
    lastRunAt: string;
    passCount: number;
    totalCount: number;
  }>();

  for (const r of recentResults) {
    const key = `${r.collectionName ?? "default"}|${r.environmentName ?? "default"}`;
    const existing = matrixMap.get(key);
    if (!existing) {
      matrixMap.set(key, {
        collection: r.collectionName ?? "Default",
        environment: r.environmentName ?? "Default",
        lastStatus: r.status,
        lastRunAt: r.createdAt.toISOString(),
        passCount: r.status === "pass" ? 1 : 0,
        totalCount: 1,
      });
    } else {
      existing.totalCount++;
      if (r.status === "pass") existing.passCount++;
    }
  }

  const healthMatrix = Array.from(matrixMap.values()).map((m) => ({
    collection: m.collection,
    environment: m.environment,
    lastStatus: m.lastStatus,
    lastRunAt: m.lastRunAt,
    passRate: m.totalCount > 0 ? Math.round((m.passCount / m.totalCount) * 100) : 0,
  }));

  return {
    deployments: deployments.map((d) => ({
      id: d.id,
      platform: d.platform,
      platformLabel: d.platformLabel,
      repoUrl: d.repoUrl,
      filename: d.filename,
      prUrl: d.prUrl,
      lastStatus: d.lastStatus,
      lastRunAt: d.lastRunAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
    testResults: {
      recent: recentResults.slice(0, 20).map((r) => ({
        id: r.id,
        collectionName: r.collectionName,
        environmentName: r.environmentName,
        status: r.status,
        totalAssertions: r.totalAssertions,
        passedAssertions: r.passedAssertions,
        failedAssertions: r.failedAssertions,
        totalDuration: r.totalDuration,
        source: r.source,
        createdAt: r.createdAt.toISOString(),
      })),
      trends: {
        totalRuns,
        passRate,
        avgDuration,
        last7DaysPass: last7Days.filter((r) => r.status === "pass").length,
        last7DaysFail: last7Days.filter((r) => r.status === "fail").length,
      },
    },
    healthMatrix,
  };
}

// ---------------------------------------------------------------------------
// Newman Results Query Actions
// ---------------------------------------------------------------------------

export async function getNewmanTestResults(
  projectId: string,
  options?: { limit?: number; status?: string; collectionName?: string }
) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true },
  });
  if (!project) return [];

  const where: Prisma.NewmanTestResultWhereInput = { projectId };
  if (options?.status) where.status = options.status;
  if (options?.collectionName) where.collectionName = options.collectionName;

  return prisma.newmanTestResult.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 50,
  });
}
