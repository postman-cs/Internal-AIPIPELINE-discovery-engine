import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const OPENAPI_PATHS = [
  "/openapi.json",
  "/swagger.json",
  "/v2/api-docs",
  "/api/v1/openapi.yaml",
  "/.well-known/openapi",
  "/api-docs",
  "/swagger/v1/swagger.json",
  "/api/openapi.json",
];

export default async function openapiAutoDiscover(_payload: unknown, _helpers: unknown) {
  const projects = await prisma.project.findMany({
    where: { apiDomain: { not: null }, status: "active" },
    select: { id: true, apiDomain: true, name: true },
  });

  for (const project of projects) {
    if (!project.apiDomain) continue;

    for (const path of OPENAPI_PATHS) {
      const url = `https://${project.apiDomain}${path}`;
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(5000),
          headers: { Accept: "application/json, application/yaml, text/yaml" },
        });

        if (!response.ok) continue;

        const text = await response.text();

        if (!text.includes("openapi") && !text.includes("swagger") && !text.includes("paths")) {
          continue;
        }

        const contentHash = crypto.createHash("sha256").update(text).digest("hex");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let parsed: any;
        try { parsed = JSON.parse(text); } catch { continue; }

        const endpointCount = parsed.paths ? Object.keys(parsed.paths as object).length : 0;
        const title = parsed.info?.title || `OpenAPI from ${project.apiDomain}`;
        const version = parsed.info?.version || parsed.openapi || parsed.swagger || "unknown";

        await prisma.sourceDocument.upsert({
          where: { projectId_contentHash: { projectId: project.id, contentHash } },
          update: { rawText: text, lastVerifiedAt: new Date(), freshnessScore: 100 },
          create: {
            projectId: project.id,
            sourceType: "OPENAPI",
            title: `OpenAPI: ${title} (v${version})`,
            rawText: text.slice(0, 100000),
            contentHash,
            metadataJson: {
              url,
              version,
              endpointCount,
              discoveredAt: new Date().toISOString(),
            },
            freshnessScore: 100,
            lastVerifiedAt: new Date(),
          },
        });

        console.log(`[openapi-discovery] Found spec at ${url} for ${project.name}: ${endpointCount} endpoints`);
        break;
      } catch {
        continue;
      }
    }
  }
}
