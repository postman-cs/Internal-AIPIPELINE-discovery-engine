"use server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import crypto from "crypto";

export async function importPostmanCollection(projectId: string, collectionUid: string) {
  const session = await requireAuth();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
  });
  if (!project) return { error: "Project not found" };
  if (!project.postmanApiKey) return { error: "No Postman API key configured for this project" };

  try {
    const response = await fetch(
      `https://api.getpostman.com/collections/${collectionUid}`,
      { headers: { "X-API-Key": project.postmanApiKey } }
    );
    if (!response.ok) return { error: `Postman API returned ${response.status}` };

    const data = await response.json();
    const collection = data.collection;
    if (!collection) return { error: "Invalid collection response" };

    const endpoints: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function extractItems(items: any[], prefix = "") {
      for (const item of items || []) {
        if (item.item) {
          extractItems(item.item, `${prefix}${item.name}/`);
        } else if (item.request) {
          const method = item.request.method || "GET";
          const url = typeof item.request.url === "string" ? item.request.url : item.request.url?.raw || "";
          endpoints.push(`${method} ${prefix}${item.name}: ${url}`);
        }
      }
    }
    extractItems(collection.item);

    const rawText = [
      `Postman Collection: ${collection.info?.name || collectionUid}`,
      `Description: ${collection.info?.description || "N/A"}`,
      `Endpoints (${endpoints.length}):`,
      ...endpoints.map((e: string) => `  - ${e}`),
      "",
      `Raw collection schema: ${collection.info?.schema || "v2.1.0"}`,
    ].join("\n");

    const contentHash = crypto.createHash("sha256").update(rawText).digest("hex");

    await prisma.sourceDocument.upsert({
      where: { projectId_contentHash: { projectId, contentHash } },
      update: { rawText, title: `Postman: ${collection.info?.name}`, lastVerifiedAt: new Date() },
      create: {
        projectId,
        sourceType: "POSTMAN",
        title: `Postman: ${collection.info?.name || collectionUid}`,
        rawText,
        contentHash,
        metadataJson: { collectionUid, endpointCount: endpoints.length, schema: collection.info?.schema },
        freshnessScore: 100,
        lastVerifiedAt: new Date(),
      },
    });

    return { success: true, endpointCount: endpoints.length, name: collection.info?.name };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to import collection" };
  }
}
