/**
 * OpenTelemetry Tracing
 *
 * Wraps key operations with spans for distributed tracing.
 * Exports to OTLP if OTEL_EXPORTER_OTLP_ENDPOINT is set,
 * otherwise logs to console in development.
 */

import { trace, SpanStatusCode, type Span } from "@opentelemetry/api";

const TRACER_NAME = "ai-pipeline";

/**
 * Get or create the application tracer.
 */
export function getTracer() {
  return trace.getTracer(TRACER_NAME);
}

/**
 * Wrap an async function in an OpenTelemetry span.
 * Automatically captures errors and sets span status.
 */
export async function withSpan<T>(
  spanName: string,
  attributes: Record<string, string | number | boolean>,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(spanName, async (span) => {
    try {
      // Set initial attributes
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }

      const result = await fn(span);

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Pre-built span wrappers for common operations.
 */
export const spans = {
  ingest: (projectId: string, fn: (span: Span) => Promise<unknown>) =>
    withSpan("ingest.document", { "project.id": projectId }, fn),

  snapshot: (projectId: string, fn: (span: Span) => Promise<unknown>) =>
    withSpan("snapshot.create", { "project.id": projectId }, fn),

  cascade: (projectId: string, fn: (span: Span) => Promise<unknown>) =>
    withSpan("cascade.recompute", { "project.id": projectId }, fn),

  agent: (agentType: string, projectId: string, fn: (span: Span) => Promise<unknown>) =>
    withSpan(`agent.${agentType}`, { "agent.type": agentType, "project.id": projectId }, fn),

  proposal: (action: "accept" | "reject", proposalId: string, fn: (span: Span) => Promise<unknown>) =>
    withSpan(`proposal.${action}`, { "proposal.id": proposalId, "proposal.action": action }, fn),
};
