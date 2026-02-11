/**
 * Project-level RBAC
 *
 * Verifies that the authenticated user owns the project.
 * Used by API route handlers and server actions.
 */

import { prisma } from "@/lib/prisma";
import { requireAuth, type SessionData } from "@/lib/session";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Require authenticated user and verify project ownership.
 * Returns session + project for the caller to use.
 * Throws ForbiddenError if user doesn't own the project.
 */
export async function requireProjectAccess(projectId: string): Promise<{
  session: SessionData & { userId: string };
  project: { id: string; name: string; ownerUserId: string };
}> {
  const session = await requireAuth();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, ownerUserId: true },
  });

  if (!project) {
    throw new NotFoundError("Project not found");
  }

  if (project.ownerUserId !== session.userId) {
    throw new ForbiddenError("You do not have access to this project");
  }

  return { session, project };
}

/**
 * Build a JSON error response from RBAC/auth exceptions.
 */
export function rbacErrorResponse(error: unknown): Response {
  if (error instanceof ForbiddenError) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof NotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof Error && error.message === "Unauthorized") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const msg = error instanceof Error ? error.message : "Internal error";
  return Response.json({ error: msg }, { status: 500 });
}
