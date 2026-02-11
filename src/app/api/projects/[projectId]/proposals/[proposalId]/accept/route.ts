/**
 * POST /api/projects/[projectId]/proposals/[proposalId]/accept
 *
 * Accept a proposal: creates new PhaseArtifact version, marks CLEAN,
 * cascades DIRTY downstream.
 */

import { NextRequest } from "next/server";
import { requireProjectAccess, rbacErrorResponse } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { acceptProposal } from "@/lib/actions/cascade";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; proposalId: string }> }
) {
  try {
    const { projectId, proposalId } = await params;
    await requireProjectAccess(projectId);

    // Verify proposal belongs to project
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: { projectId: true },
    });

    if (!proposal || proposal.projectId !== projectId) {
      return Response.json({ error: "Proposal not found" }, { status: 404 });
    }

    const result = await acceptProposal(proposalId);

    if (result.error) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json(result);
  } catch (error) {
    return rbacErrorResponse(error);
  }
}
