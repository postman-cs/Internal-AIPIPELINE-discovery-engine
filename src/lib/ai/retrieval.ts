/**
 * Hybrid Retrieval Engine
 *
 * Performs vector similarity search over DocumentChunks
 * scoped to a specific project, using pgvector cosine distance.
 */

import { prisma } from "@/lib/prisma";
import { generateEmbeddings } from "./openai";

export interface EvidenceResult {
  evidenceId: string;
  evidenceLabel: string;
  content: string;
  sourceType: string;
  documentTitle: string | null;
  score: number;
}

/**
 * Retrieve the most relevant evidence chunks for a query within a project.
 *
 * Steps:
 * 1. Generate query embedding
 * 2. Filter by projectId
 * 3. Cosine similarity search via pgvector
 * 4. Join with SourceDocument for sourceType
 * 5. Return structured, scored results
 */
export async function retrieveEvidence(
  projectId: string,
  query: string,
  topK: number = 10
): Promise<EvidenceResult[]> {
  // 1. Embed the query
  const [queryEmbedding] = await generateEmbeddings([query]);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  // 2. Vector similarity search with cosine distance
  //    pgvector <=> operator = cosine distance; similarity = 1 - distance
  const results = await prisma.$queryRaw<
    Array<{
      id: string;
      evidenceLabel: string;
      content: string;
      sourceType: string;
      title: string | null;
      score: number;
    }>
  >`
    SELECT
      dc."id",
      dc."evidenceLabel",
      dc."content",
      sd."sourceType",
      sd."title",
      (1 - (dc."embedding" <=> ${embeddingStr}::vector)) AS score
    FROM "DocumentChunk" dc
    JOIN "SourceDocument" sd ON sd."id" = dc."documentId"
    WHERE dc."projectId" = ${projectId}
    ORDER BY dc."embedding" <=> ${embeddingStr}::vector ASC
    LIMIT ${topK}
  `;

  return results.map((r) => ({
    evidenceId: r.id,
    evidenceLabel: r.evidenceLabel,
    content: r.content,
    sourceType: r.sourceType,
    documentTitle: r.title,
    score: Number(r.score),
  }));
}

/**
 * Retrieve evidence for multiple queries and deduplicate results.
 * Useful for agents that need context from several angles.
 */
export async function retrieveMultiQueryEvidence(
  projectId: string,
  queries: string[],
  topKPerQuery: number = 5
): Promise<EvidenceResult[]> {
  const allResults: EvidenceResult[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    const results = await retrieveEvidence(projectId, query, topKPerQuery);
    for (const r of results) {
      if (!seen.has(r.evidenceId)) {
        seen.add(r.evidenceId);
        allResults.push(r);
      }
    }
  }

  // Sort by score descending
  return allResults.sort((a, b) => b.score - a.score);
}

/**
 * Format evidence results into a string block for agent prompts.
 * Each piece of evidence gets a citation tag: [EVIDENCE-N]
 */
export function formatEvidenceForPrompt(evidence: EvidenceResult[]): string {
  if (evidence.length === 0) return "No evidence available.";

  return evidence
    .map(
      (e) =>
        `[${e.evidenceLabel}] (${e.sourceType}${e.documentTitle ? ": " + e.documentTitle : ""}, relevance: ${(e.score * 100).toFixed(0)}%)\n${e.content}`
    )
    .join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// Evidence ID Validation (Phase 9)
// ---------------------------------------------------------------------------

/**
 * Retrieve ALL valid evidence labels for a project.
 * Used to validate agent outputs — reject hallucinated evidence IDs.
 */
export async function getValidEvidenceLabels(
  projectId: string
): Promise<Set<string>> {
  const chunks = await prisma.$queryRaw<Array<{ evidenceLabel: string }>>`
    SELECT DISTINCT "evidenceLabel"
    FROM "DocumentChunk"
    WHERE "projectId" = ${projectId}
  `;
  return new Set(chunks.map((c) => c.evidenceLabel));
}

/**
 * Validate that all evidence IDs in an agent's output actually exist
 * in the project's DocumentChunks. Throws if any are hallucinated.
 */
export function validateEvidenceIds(
  referencedIds: string[],
  validLabels: Set<string>,
  agentType: string
): void {
  const invalid = referencedIds.filter((id) => !validLabels.has(id));
  if (invalid.length > 0) {
    throw new Error(
      `${agentType}: Hallucinated evidence IDs detected: ${invalid.join(", ")}. ` +
        `Valid labels: ${Array.from(validLabels).slice(0, 10).join(", ")}${validLabels.size > 10 ? "..." : ""}`
    );
  }
}

/**
 * Retrieve evidence chunks by their labels for the Evidence Appendix.
 */
export async function getEvidenceByLabels(
  projectId: string,
  labels: string[]
): Promise<
  Array<{
    evidenceLabel: string;
    sourceType: string;
    title: string;
    excerpt: string;
  }>
> {
  if (labels.length === 0) return [];

  const results = await prisma.$queryRaw<
    Array<{
      evidenceLabel: string;
      sourceType: string;
      title: string | null;
      content: string;
    }>
  >`
    SELECT dc."evidenceLabel", sd."sourceType", sd."title", dc."content"
    FROM "DocumentChunk" dc
    JOIN "SourceDocument" sd ON sd."id" = dc."documentId"
    WHERE dc."projectId" = ${projectId}
      AND dc."evidenceLabel" = ANY(${labels})
    ORDER BY dc."evidenceLabel" ASC
  `;

  return results.map((r) => ({
    evidenceLabel: r.evidenceLabel,
    sourceType: r.sourceType,
    title: r.title || "Untitled",
    excerpt: r.content.length > 300 ? r.content.slice(0, 300) + "..." : r.content,
  }));
}
