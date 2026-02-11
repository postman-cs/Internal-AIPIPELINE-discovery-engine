-- Add idempotent ingestion fields to SourceDocument
ALTER TABLE "SourceDocument" ADD COLUMN "externalId" TEXT;
ALTER TABLE "SourceDocument" ADD COLUMN "contentHash" TEXT;

-- Unique constraint on projectId + contentHash for dedup
CREATE UNIQUE INDEX "SourceDocument_projectId_contentHash_key" ON "SourceDocument"("projectId", "contentHash");

-- Index for external ID lookups
CREATE INDEX "SourceDocument_projectId_externalId_idx" ON "SourceDocument"("projectId", "externalId");

-- Add snapshotId to AIRun for observability tracing
ALTER TABLE "AIRun" ADD COLUMN "snapshotId" TEXT;

-- Additional indexes for AIRun
CREATE INDEX "AIRun_agentType_idx" ON "AIRun"("agentType");
CREATE INDEX "AIRun_createdAt_idx" ON "AIRun"("createdAt");
