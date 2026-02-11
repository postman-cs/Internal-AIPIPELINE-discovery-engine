import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Seed not available in production" },
      { status: 403 }
    );
  }

  const passwordHash = await bcrypt.hash("pipeline123", 10);
  const user = await prisma.user.upsert({
    where: { email: "cse@postman.com" },
    update: {},
    create: {
      email: "cse@postman.com",
      name: "CSE Demo User",
      passwordHash,
    },
  });

  await prisma.project.upsert({
    where: { id: "seed-project-1" },
    update: {},
    create: {
      id: "seed-project-1",
      name: "Acme Corp",
      primaryDomain: "acme.com",
      apiDomain: "api.acme.com",
      publicWorkspaceUrl:
        "https://www.postman.com/acme/workspace/acme-public-api",
      ownerUserId: user.id,
    },
  });

  await prisma.project.upsert({
    where: { id: "seed-project-2" },
    update: {},
    create: {
      id: "seed-project-2",
      name: "TechStart Inc",
      primaryDomain: "techstart.io",
      ownerUserId: user.id,
    },
  });

  return NextResponse.json({
    success: true,
    user: { id: user.id, email: user.email },
    projects: ["Acme Corp", "TechStart Inc"],
  });
}
