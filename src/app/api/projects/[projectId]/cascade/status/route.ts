import { NextRequest } from "next/server";
import { requireProjectAccess, rbacErrorResponse } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export const maxDuration = 900; // Vercel Pro: 15 min for full cascade

const POLL_INTERVAL_MS = 2_000;
const SAFETY_TIMEOUT_MS = 14 * 60 * 1_000; // 14 min (under 15 min Vercel limit)

const streamBuffer = new Map<string, string[]>();

function _pushAgentToken(jobId: string, token: string) {
  if (!streamBuffer.has(jobId)) {
    streamBuffer.set(jobId, []);
  }
  streamBuffer.get(jobId)!.push(token);
}

const TERMINAL_STATUSES = new Set([
  "COMPLETED",
  "COMPLETED_WITH_ERRORS",
  "FAILED",
  "PAUSED_FOR_VERIFICATION",
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    await requireProjectAccess(projectId);

    const jobId = request.nextUrl.searchParams.get("jobId");
    if (!jobId) {
      return Response.json({ error: "Missing jobId query parameter" }, { status: 400 });
    }

    const job = await prisma.recomputeJob.findUnique({
      where: { id: jobId },
      select: { projectId: true },
    });

    if (!job || job.projectId !== projectId) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    const encoder = new TextEncoder();
    const startTime = Date.now();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        let done = false;

        while (!done) {
          if (Date.now() - startTime > SAFETY_TIMEOUT_MS) {
            send("timeout", { message: "Stream closed after safety timeout" });
            done = true;
            break;
          }

          try {
            const current = await prisma.recomputeJob.findUnique({
              where: { id: jobId },
              include: {
                tasks: {
                  orderBy: { phase: "asc" },
                },
              },
            });

            if (!current) {
              send("error", { message: "Job not found" });
              done = true;
              break;
            }

            const totalTasks = current.tasks.length;
            const completedTasks = current.tasks.filter((t) => t.status === "COMPLETED").length;
            const failedTasks = current.tasks.filter((t) => t.status === "FAILED").length;
            const runningTask = current.tasks.find((t) => t.status === "RUNNING");
            const errors = current.tasks
              .filter((t) => t.status === "FAILED" && t.message)
              .map((t) => `${t.phase}: ${t.message}`);

            const phases = current.tasks.map((t) => ({
              phase: t.phase,
              status: t.status,
            }));

            send("progress", {
              status: current.status,
              completedTasks,
              totalTasks,
              failedTasks,
              currentPhase: runningTask?.phase ?? null,
              errors,
              phases,
            });

            const tokens = streamBuffer.get(jobId);
            if (tokens && tokens.length > 0) {
              const batch = tokens.splice(0, tokens.length);
              send("agent_token", { tokens: batch });
            }

            if (TERMINAL_STATUSES.has(current.status)) {
              const finalTokens = streamBuffer.get(jobId);
              if (finalTokens && finalTokens.length > 0) {
                send("agent_token", { tokens: finalTokens.splice(0, finalTokens.length) });
              }
              streamBuffer.delete(jobId);

              send("complete", {
                status: current.status,
                completedTasks,
                totalTasks,
                failedTasks,
                errors,
                finishedAt: current.finishedAt?.toISOString() ?? null,
              });
              done = true;
              break;
            }
          } catch (err) {
            send("error", {
              message: err instanceof Error ? err.message : "Internal polling error",
            });
            done = true;
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return rbacErrorResponse(error);
  }
}
