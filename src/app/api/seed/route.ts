import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";

const FLEET = [
  { email: "jared@postman.com", name: "Jared", role: "ADMIN" as const, password: "admiral123" },
  { email: "daniel@postman.com", name: "Daniel", role: "CSE" as const, password: "pipeline123" },
];

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const seedToken = process.env.SEED_TOKEN;
  if (seedToken) {
    const authHeader = request.headers.get("authorization") ?? "";
    const expected = `Bearer ${seedToken}`;
    const isValid = authHeader.length === expected.length && timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
    if (!isValid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const seeded = [];

  for (const member of FLEET) {
    const hash = await bcrypt.hash(member.password, 10);
    await prisma.user.upsert({
      where: { email: member.email },
      update: { role: member.role, isAdmin: member.role === "ADMIN", name: member.name },
      create: {
        email: member.email,
        name: member.name,
        passwordHash: hash,
        role: member.role,
        isAdmin: member.role === "ADMIN",
      },
    });
    seeded.push({ email: member.email, password: member.password, role: member.role });
  }

  // Also update legacy admin/cse accounts if they exist
  const legacyAdmin = await prisma.user.findUnique({ where: { email: "admin@postman.com" } });
  if (legacyAdmin) {
    await prisma.user.update({ where: { id: legacyAdmin.id }, data: { role: "ADMIN", isAdmin: true } });
  }
  const legacyCse = await prisma.user.findUnique({ where: { email: "cse@postman.com" } });
  if (legacyCse) {
    await prisma.user.update({ where: { id: legacyCse.id }, data: { role: "CSE" } });
  }

  return NextResponse.json({
    success: true,
    message: "Fleet seeded",
    fleet: seeded,
  });
}
