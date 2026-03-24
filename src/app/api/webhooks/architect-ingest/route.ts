import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

/**
 * POST /api/webhooks/architect-ingest
 *
 * Accepts architect mapping data from the external architechtMapping app.
 * If a project with the given name exists (owned by the default user), it updates it.
 * If no project exists, it creates one.
 *
 * Authentication: Bearer token (WEBHOOK_SECRET env var) — optional in dev.
 *
 * Body: { projectName, primaryDomain?, data }
 * Returns: { success, projectId, created }
 */
export async function POST(req: NextRequest) {
  // Auth check — use WEBHOOK_SECRET if set
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (webhookSecret) {
    const auth = req.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token || token !== webhookSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { projectName, primaryDomain, ownerEmail, data } = await req.json();
  if (!projectName || !data) {
    return NextResponse.json({ error: "projectName and data are required" }, { status: 400 });
  }

  // Resolve owner: by email if provided, otherwise fall back to first user
  let ownerUserId: string;
  if (ownerEmail) {
    const user = await prisma.user.findFirst({ where: { email: ownerEmail }, select: { id: true } });
    if (!user) {
      return NextResponse.json({ error: `No user found with email: ${ownerEmail}` }, { status: 400 });
    }
    ownerUserId = user.id;
  } else {
    const firstUser = await prisma.user.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } });
    if (firstUser) {
      ownerUserId = firstUser.id;
    } else {
      return NextResponse.json({ error: "No users exist in the pipeline. Log in first to create a user." }, { status: 400 });
    }
  }

  // Find existing project by name
  let project = await prisma.project.findFirst({
    where: { name: projectName, ownerUserId },
    select: { id: true, architectShareToken: true },
  });

  let created = false;

  if (!project) {
    // Create the project with a share token
    const token = randomUUID();
    project = await prisma.project.create({
      data: {
        name: projectName,
        primaryDomain: primaryDomain || null,
        ownerUserId,
        engagementStage: 2,
        architectShareToken: token,
        architectShareData: data as Prisma.InputJsonValue,
        customerContactName: (data as Record<string, unknown>).contactName as string || null,
        customerContactEmail: (data as Record<string, unknown>).contactEmail as string || null,
      },
      select: { id: true, architectShareToken: true },
    });
    created = true;
  } else {
    // Update existing project with the new data
    await prisma.project.update({
      where: { id: project.id },
      data: {
        architectShareData: data as Prisma.InputJsonValue,
        primaryDomain: primaryDomain || undefined,
        customerContactName: (data as Record<string, unknown>).contactName as string || undefined,
        customerContactEmail: (data as Record<string, unknown>).contactEmail as string || undefined,
      },
    });
  }

  return NextResponse.json({
    success: true,
    projectId: project.id,
    created,
    architectShareToken: project.architectShareToken,
  });
}
