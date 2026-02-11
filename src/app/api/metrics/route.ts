/**
 * GET /api/metrics
 *
 * Prometheus-compatible metrics endpoint.
 * Public (no auth) for scraper access.
 */

import { getMetrics } from "@/lib/observability/metrics";

export async function GET() {
  const metrics = await getMetrics();
  return new Response(metrics, {
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    },
  });
}
