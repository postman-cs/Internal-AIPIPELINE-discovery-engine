/**
 * GET /api/projects/[projectId]/updates
 *
 * Returns the full cascade state: snapshots, dirty phases, proposals, jobs.
 */

import { NextRequest } from "next/server";
import { requireProjectAccess, rbacErrorResponse } from "@/lib/rbac";
import { getCascadeState } from "@/lib/actions/cascade";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    await requireProjectAccess(projectId);

    const state = await getCascadeState(projectId);
    return Response.json(state);
  } catch (error) {
    return rbacErrorResponse(error);
  }
}
