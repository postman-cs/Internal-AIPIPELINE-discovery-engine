import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";

export async function POST(request: NextRequest) {
  // Block in production — middleware also blocks this, but defense-in-depth
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // In non-production, require a seed token if one is configured
  const seedToken = process.env.SEED_TOKEN;
  if (seedToken) {
    const authHeader = request.headers.get("authorization") ?? "";
    const expected = `Bearer ${seedToken}`;
    const isValid = authHeader.length === expected.length && timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
    if (!isValid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const passwordHash = await bcrypt.hash("pipeline123", 10);
  const adminPasswordHash = await bcrypt.hash("admin123", 10);

  // Seed admin user
  await prisma.user.upsert({
    where: { email: "admin@postman.com" },
    update: { isAdmin: true },
    create: {
      email: "admin@postman.com",
      name: "Admin",
      passwordHash: adminPasswordHash,
      isAdmin: true,
    },
  });

  // Seed regular CSE user
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
    message: "Seed data created",
    users: [
      { email: "admin@postman.com", password: "admin123", role: "admin" },
      { email: "cse@postman.com", password: "pipeline123", role: "user" },
    ],
    projects: ["Acme Corp", "TechStart Inc"],
  });
}
