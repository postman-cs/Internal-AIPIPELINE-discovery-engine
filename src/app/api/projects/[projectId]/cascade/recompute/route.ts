/**
 * POST /api/projects/[projectId]/cascade/recompute
 *
 * Force recompute for DIRTY phases. Creates snapshot, runs impact analysis,
 * and executes recompute job inline.
 */

import { NextRequest } from "next/server";
import { requireProjectAccess, rbacErrorResponse } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { createEvidenceSnapshot } from "@/lib/cascade/snapshot";
import { runImpactAnalysis } from "@/lib/cascade/impact";
import { executeRecomputeJob } from "@/lib/cascade/recompute";

export const maxDuration = 800; // Vercel Pro: 15 min for full cascade

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    await requireProjectAccess(projectId);

    // Check evidence exists
    const chunkCount = await prisma.documentChunk.count({ where: { projectId } });
    if (chunkCount === 0) {
      return Response.json({ error: "No evidence ingested yet" }, { status: 400 });
    }

    // Create snapshot
    const snapshot = await createEvidenceSnapshot(projectId);

    // Impact analysis
    const impact = await runImpactAnalysis(projectId, snapshot.snapshotId, "MANUAL");

    // Execute recompute — autoAccept so phases become CLEAN and downstream can proceed
    const result = await executeRecomputeJob(impact.jobId, { autoAccept: true });

    return Response.json({
      success: true,
      snapshotId: snapshot.snapshotId,
      jobId: impact.jobId,
      impactedPhases: impact.impactedPhases,
      completedTasks: result.completedTasks,
      proposals: result.proposals.length,
      errors: result.errors,
      skipped: result.skipped,
    });
  } catch (error) {
    return rbacErrorResponse(error);
  }
}
