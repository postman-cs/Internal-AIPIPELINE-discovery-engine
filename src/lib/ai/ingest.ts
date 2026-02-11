/**
 * AI Ingestion Pipeline (Idempotent)
 *
 * Responsibilities:
 * 1. Compute content hash for dedup — skip unchanged documents
 * 2. Store raw text in SourceDocument (with contentHash + externalId)
 * 3. Chunk text (800–1200 tokens, 200 overlap)
 * 4. Generate embeddings via OpenAI
 * 5. Store chunks + embeddings in DocumentChunk
 * 6. Assign deterministic evidence labels per project: EVIDENCE-1, EVIDENCE-2, ...
 *
 * Idempotency:
 * - external_id + content_hash dedupe
 * - If a document with the same contentHash exists for a project, skip entirely
 * - If externalId matches but content changed, create a new version (new doc)
 */

import { prisma } from "@/lib/prisma";
import { generateEmbeddings } from "./openai";
import { chunkText } from "./chunker";
import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";

export interface IngestDocumentInput {
  projectId: string;
  sourceType: string;
  title?: string;
  rawText: string;
  metadata?: Record<string, unknown>;
  externalId?: string;
}

export interface IngestResult {
  documentId: string;
  chunkCount: number;
  evidenceLabels: string[];
  skipped: boolean;
  skipReason?: string;
}

/**
 * Compute SHA-256 content hash for dedup.
 */
function computeContentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Get the next evidence label number for a project.
 * Evidence labels are globally sequential per project: EVIDENCE-1, EVIDENCE-2, ...
 */
async function getNextEvidenceNumber(projectId: string): Promise<number> {
  const result = await prisma.documentChunk.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: { evidenceLabel: true },
  });

  if (!result) return 1;

  const match = result.evidenceLabel.match(/EVIDENCE-(\d+)/);
  return match ? parseInt(match[1], 10) + 1 : 1;
}

/**
 * Ingest a single document with idempotency checks.
 *
 * Dedup logic:
 * 1. Compute contentHash from rawText
 * 2. Check if a document with same (projectId, contentHash) already exists → skip
 * 3. If externalId provided, check if same externalId exists with different hash → allow (content update)
 * 4. If all checks pass, proceed with ingestion
 */
export async function ingestDocument(
  input: IngestDocumentInput
): Promise<IngestResult> {
  const { projectId, sourceType, title, rawText, metadata, externalId } = input;

  // 1. Content hash for dedup
  const contentHash = computeContentHash(rawText);

  // 2. Check for exact content duplicate
  const existing = await prisma.sourceDocument.findFirst({
    where: { projectId, contentHash },
    select: { id: true },
  });

  if (existing) {
    return {
      documentId: existing.id,
      chunkCount: 0,
      evidenceLabels: [],
      skipped: true,
      skipReason: `Duplicate content (hash: ${contentHash.slice(0, 12)}...)`,
    };
  }

  // 3. Store raw document with hash
  const doc = await prisma.sourceDocument.create({
    data: {
      projectId,
      sourceType,
      externalId: externalId || null,
      contentHash,
      title: title || null,
      rawText,
      metadataJson: (metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });

  // 4. Chunk text
  const chunks = chunkText(rawText);
  if (chunks.length === 0) {
    return { documentId: doc.id, chunkCount: 0, evidenceLabels: [], skipped: false };
  }

  // 5. Generate embeddings (batch)
  const embeddings = await generateEmbeddings(chunks.map((c) => c.content));

  // 6. Assign evidence labels
  let nextEvNum = await getNextEvidenceNumber(projectId);
  const evidenceLabels: string[] = [];

  // 7. Insert chunks with embeddings using raw SQL (pgvector)
  for (let i = 0; i < chunks.length; i++) {
    const label = `EVIDENCE-${nextEvNum}`;
    evidenceLabels.push(label);
    nextEvNum++;

    const embeddingStr = `[${embeddings[i].join(",")}]`;

    await prisma.$executeRaw`
      INSERT INTO "DocumentChunk" (
        "id", "documentId", "projectId", "content", "embedding",
        "tokenCount", "evidenceLabel", "createdAt"
      ) VALUES (
        ${doc.id + "-" + i},
        ${doc.id},
        ${projectId},
        ${chunks[i].content},
        ${embeddingStr}::vector,
        ${chunks[i].tokenCount},
        ${label},
        NOW()
      )
    `;
  }

  return {
    documentId: doc.id,
    chunkCount: chunks.length,
    evidenceLabels,
    skipped: false,
  };
}

/**
 * Batch-ingest multiple documents for a project.
 * Returns results for each, indicating which were skipped (dedup).
 */
export async function ingestDocuments(
  inputs: IngestDocumentInput[]
): Promise<IngestResult[]> {
  const results: IngestResult[] = [];
  for (const input of inputs) {
    results.push(await ingestDocument(input));
  }
  return results;
}
