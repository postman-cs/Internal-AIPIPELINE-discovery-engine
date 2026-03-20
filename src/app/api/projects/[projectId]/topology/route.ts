/**
 * GET /api/projects/[projectId]/topology
 *
 * Returns the latest accepted CURRENT_TOPOLOGY artifact + evidence digests
 * + computed heatmap metrics from SOLUTION_DESIGN, TEST_DESIGN, and MONITORING.
 */

import { NextRequest } from "next/server";
import { requireProjectAccess, rbacErrorResponse } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { computeRiskScores } from "@/lib/topology/riskScoring";
import type { TopoNode, TopoEdge } from "@/lib/topology/riskScoring";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    await requireProjectAccess(projectId);

    // Get latest CURRENT_TOPOLOGY artifact
    const artifact = await prisma.phaseArtifact.findFirst({
      where: { projectId, phase: "CURRENT_TOPOLOGY" },
      orderBy: { version: "desc" },
    });

    if (!artifact) {
      return Response.json({
        topology: null,
        heatmap: null,
        message: "No topology artifact yet",
      });
    }

    const content = artifact.contentJson as Record<string, unknown>;
    const nodes = (content?.nodes ?? []) as TopoNode[];
    const edges = (content?.edges ?? []) as TopoEdge[];

    // Compute heatmap risk scores
    const riskScores = computeRiskScores(nodes, edges);

    // Get coverage metrics from downstream artifacts
    const [solutionArtifact, testArtifact, monitorArtifact] = await Promise.all([
      prisma.phaseArtifact.findFirst({
        where: { projectId, phase: "SOLUTION_DESIGN", status: "CLEAN" },
        orderBy: { version: "desc" },
        select: { contentJson: true },
      }),
      prisma.phaseArtifact.findFirst({
        where: { projectId, phase: "TEST_DESIGN", status: "CLEAN" },
        orderBy: { version: "desc" },
        select: { contentJson: true },
      }),
      prisma.phaseArtifact.findFirst({
        where: { projectId, phase: "BUILD_LOG", status: "CLEAN" },
        orderBy: { version: "desc" },
        select: { contentJson: true },
      }),
    ]);

    // Compute coverage per node
    const solutionContent = solutionArtifact?.contentJson as Record<string, unknown> | null;
    const testContent = testArtifact?.contentJson as Record<string, unknown> | null;
    const monitorContent = monitorArtifact?.contentJson as Record<string, unknown> | null;

    const solutionTargets = new Set(
      ((solutionContent?.refactorActions ?? []) as Array<Record<string, unknown>>)
        .map((a) => a.targetComponent as string)
    );
    const testTargets = new Set(
      ((testContent?.testCases ?? []) as Array<Record<string, unknown>>)
        .map((t) => t.targetComponentId as string)
    );
    const monitorTargets = new Set(
      ((monitorContent?.monitors ?? []) as Array<Record<string, unknown>>)
        .map((m) => m.targetComponentId as string)
    );

    const heatmapWithCoverage = riskScores.map((score) => ({
      ...score,
      hasSolutionDesign: solutionTargets.has(score.nodeId) || solutionTargets.has(score.nodeName),
      hasTestCoverage: testTargets.has(score.nodeId) || testTargets.has(score.nodeName),
      hasMonitoring: monitorTargets.has(score.nodeId) || monitorTargets.has(score.nodeName),
    }));

    return Response.json(
      {
        topology: {
          version: artifact.version,
          status: artifact.status,
          nodes,
          edges,
          reasoningSummary: content?.reasoningSummary ?? null,
        },
        heatmap: heatmapWithCoverage,
        coverage: {
          solutionDesignNodes: solutionTargets.size,
          testCoverageNodes: testTargets.size,
          monitoringNodes: monitorTargets.size,
          totalNodes: nodes.length,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    return rbacErrorResponse(error);
  }
}
