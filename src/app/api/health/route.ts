/**
 * GET /api/health — Health check endpoint for load balancers / k8s probes
 *
 * Returns 200 if the app is running and the database is reachable.
 * Returns 503 if the database connection fails.
 */

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  const checks: Record<string, { status: string; latencyMs?: number }> = {};

  // Database check
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch {
    checks.database = { status: "error" };
    return NextResponse.json(
      {
        status: "unhealthy",
        uptime: process.uptime(),
        checks,
        totalMs: Date.now() - start,
      },
      { status: 503 }
    );
  }

  // In production, return minimal info to avoid reconnaissance
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    return NextResponse.json({ status: "healthy" });
  }

  return NextResponse.json(
    {
      status: "healthy",
      version: process.env.npm_package_version || "0.1.0",
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      checks,
      totalMs: Date.now() - start,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      },
    }
  );
}
