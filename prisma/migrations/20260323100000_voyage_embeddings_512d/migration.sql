-- Switch embedding dimensions from 3072 (OpenAI) to 512 (Voyage AI voyage-3-lite)
-- This drops and recreates the embedding column. Existing chunks lose their
-- embeddings and must be re-ingested, but the text content is preserved in
-- SourceDocument.rawText.

-- Drop existing chunks (they have incompatible 3072d embeddings)
DELETE FROM "DocumentChunk";

-- Alter the column type
ALTER TABLE "DocumentChunk" ALTER COLUMN "embedding" TYPE vector(512);
