-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Project
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryDomain" TEXT,
    "apiDomain" TEXT,
    "publicWorkspaceUrl" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- IngestSourceConfig
CREATE TABLE "IngestSourceConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "configJson" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncItemCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IngestSourceConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IngestSourceConfig_userId_source_key" ON "IngestSourceConfig"("userId", "source");
ALTER TABLE "IngestSourceConfig" ADD CONSTRAINT "IngestSourceConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- IngestRun
CREATE TABLE "IngestRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "trigger" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourcesFilter" TEXT,
    "summary" TEXT,
    "countsJson" TEXT,
    CONSTRAINT "IngestRun_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "IngestRun" ADD CONSTRAINT "IngestRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- IngestItem
CREATE TABLE "IngestItem" (
    "id" TEXT NOT NULL,
    "ingestRunId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" TEXT,
    "rawText" TEXT,
    "metadataJson" TEXT,
    "consumedAt" TIMESTAMP(3),
    CONSTRAINT "IngestItem_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "IngestItem" ADD CONSTRAINT "IngestItem_ingestRunId_fkey" FOREIGN KEY ("ingestRunId") REFERENCES "IngestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- SourceDocument
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "title" TEXT,
    "rawText" TEXT NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DocumentChunk (with pgvector embedding)
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(3072) NOT NULL,
    "tokenCount" INTEGER,
    "evidenceLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DocumentChunk_projectId_idx" ON "DocumentChunk"("projectId");
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SourceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AIRun
CREATE TABLE "AIRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "agentType" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "inputJson" JSONB NOT NULL,
    "outputJson" JSONB,
    "tokenUsage" JSONB,
    "durationMs" INTEGER,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AIRun_projectId_idx" ON "AIRun"("projectId");
ALTER TABLE "AIRun" ADD CONSTRAINT "AIRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DiscoveryArtifact
CREATE TABLE "DiscoveryArtifact" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "keplerPaste" TEXT,
    "dnsFindings" TEXT,
    "headerFindings" TEXT,
    "publicFootprint" TEXT,
    "authForensics" TEXT,
    "cloudGatewaySignals" TEXT,
    "developerFrictionSignals" TEXT,
    "evidenceLinksJson" TEXT,
    "industry" TEXT,
    "engineeringSize" TEXT,
    "publicApiPresence" TEXT,
    "technicalLandscapeJson" TEXT,
    "maturityLevel" INTEGER,
    "maturityJustification" TEXT,
    "confidenceJson" TEXT,
    "hypothesis" TEXT,
    "recommendedApproach" TEXT,
    "conversationAngle" TEXT,
    "stakeholderTargetsJson" TEXT,
    "firstMeetingAgendaJson" TEXT,
    "generatedBriefMarkdown" TEXT,
    "generatedBriefJson" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiRunIds" JSONB,
    "evidenceCitations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscoveryArtifact_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DiscoveryArtifact_projectId_version_key" ON "DiscoveryArtifact"("projectId", "version");
ALTER TABLE "DiscoveryArtifact" ADD CONSTRAINT "DiscoveryArtifact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
