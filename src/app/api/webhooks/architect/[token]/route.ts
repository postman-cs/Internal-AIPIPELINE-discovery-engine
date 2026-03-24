import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": process.env.ARCHITECT_FORM_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return NextResponse.json(null, { status: 204, headers: CORS_HEADERS });
}

// GET — validate token and return prefill data
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const project = await prisma.project.findFirst({
    where: { architectShareToken: token },
    select: {
      name: true,
      primaryDomain: true,
      architectShareData: true,
      customerContactName: true,
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404, headers: CORS_HEADERS });
  }
  return NextResponse.json({
    projectName: project.name,
    prefill: project.architectShareData ?? {},
  }, { headers: CORS_HEADERS });
}

// POST — submit form data
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const project = await prisma.project.findFirst({
    where: { architectShareToken: token },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404, headers: CORS_HEADERS });
  }

  const data = await req.json();
  await prisma.project.update({
    where: { id: project.id },
    data: { architectShareData: data as Prisma.InputJsonValue },
  });

  return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
}
