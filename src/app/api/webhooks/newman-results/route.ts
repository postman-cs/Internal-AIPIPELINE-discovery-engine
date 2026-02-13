/**
 * POST /api/webhooks/newman-results — Newman Test Results Ingestion (Feature #17)
 *
 * Accepts Newman JSON reporter output or JUnit XML from CI/CD pipelines.
 * Parses results into structured format and stores for trend analysis.
 *
 * Authentication: Bearer token (WEBHOOK_SECRET env var)
 *
 * Usage in CI/CD pipeline:
 *   newman run collection.json --reporters json --reporter-json-export results.json
 *   curl -X POST https://your-instance/api/webhooks/newman-results \
 *     -H "Authorization: Bearer $WEBHOOK_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d @results.json
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { Prisma } from "@prisma/client";

const log = logger.child("webhook.newman-results");

// ---------------------------------------------------------------------------
// Input Schema
// ---------------------------------------------------------------------------

const newmanResultPayloadSchema = z.object({
  projectId: z.string().min(1),
  collectionName: z.string().optional(),
  environmentName: z.string().optional(),
  source: z.enum(["webhook", "ci", "dry-run"]).default("webhook"),

  // Newman JSON reporter format (simplified)
  run: z.object({
    stats: z.object({
      requests: z.object({ total: z.number(), failed: z.number() }).optional(),
      assertions: z.object({ total: z.number(), failed: z.number() }).optional(),
    }).optional(),
    timings: z.object({
      responseAverage: z.number().optional(),
      started: z.number().optional(),
      completed: z.number().optional(),
    }).optional(),
    failures: z.array(z.object({
      source: z.object({ name: z.string() }).optional(),
      error: z.object({ message: z.string() }).optional(),
    })).optional(),
  }).optional(),

  // Or provide summary directly
  summary: z.object({
    totalRequests: z.number(),
    totalAssertions: z.number(),
    passedAssertions: z.number(),
    failedAssertions: z.number(),
    totalDuration: z.number(), // ms
  }).optional(),
});

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // Auth
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret) {
    log.warn("WEBHOOK_SECRET not configured — newman-results endpoint disabled");
    return Response.json({ error: "Webhook endpoint not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization") || "";
  const expected = `Bearer ${webhookSecret}`;
  const authBuf = Buffer.from(authHeader);
  const expectedBuf = Buffer.from(expected);
  if (authBuf.length !== expectedBuf.length || !timingSafeEqual(authBuf, expectedBuf)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = newmanResultPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { projectId, collectionName, environmentName, source, run, summary } = parsed.data;

  // Verify project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  // Extract or use provided summary
  let totalRequests = 0;
  let totalAssertions = 0;
  let passedAssertions = 0;
  let failedAssertions = 0;
  let totalDuration = 0;

  if (summary) {
    totalRequests = summary.totalRequests;
    totalAssertions = summary.totalAssertions;
    passedAssertions = summary.passedAssertions;
    failedAssertions = summary.failedAssertions;
    totalDuration = summary.totalDuration;
  } else if (run?.stats) {
    totalRequests = run.stats.requests?.total ?? 0;
    totalAssertions = run.stats.assertions?.total ?? 0;
    failedAssertions = run.stats.assertions?.failed ?? 0;
    passedAssertions = totalAssertions - failedAssertions;
    if (run.timings?.started && run.timings?.completed) {
      totalDuration = run.timings.completed - run.timings.started;
    }
  }

  const status = failedAssertions > 0 ? "fail" : "pass";

  try {
    const result = await prisma.newmanTestResult.create({
      data: {
        projectId,
        collectionName,
        environmentName,
        totalRequests,
        totalAssertions,
        passedAssertions,
        failedAssertions,
        totalDuration,
        status,
        resultJson: parsed.data as unknown as Prisma.InputJsonValue,
        source,
      },
    });

    log.info("Newman results ingested", {
      projectId,
      resultId: result.id,
      status,
      totalAssertions,
      failedAssertions,
    });

    return Response.json({
      success: true,
      resultId: result.id,
      status,
      summary: {
        totalRequests,
        totalAssertions,
        passedAssertions,
        failedAssertions,
        totalDuration,
      },
    });
  } catch (e) {
    log.error("Newman results ingestion failed", { error: String(e), projectId });
    return Response.json({ error: "Ingestion failed" }, { status: 500 });
  }
}
