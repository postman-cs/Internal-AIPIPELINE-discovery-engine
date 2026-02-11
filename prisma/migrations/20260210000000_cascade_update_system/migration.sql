-- CreateEnum Phase
CREATE TYPE "Phase" AS ENUM (
  'DISCOVERY',
  'CURRENT_TOPOLOGY',
  'DESIRED_FUTURE_STATE',
  'SOLUTION_DESIGN',
  'TEST_DESIGN',
  'CRAFT_SOLUTION',
  'TEST_SOLUTION',
  'DEPLOYMENT_PLAN',
  'MONITORING',
  'ITERATION'
);

-- CreateEnum ArtifactStatus
CREATE TYPE "ArtifactStatus" AS ENUM (
  'CLEAN',
  'DIRTY',
  'STALE',
  'NEEDS_REVIEW',
  'CLEAN_WITH_EXCEPTIONS'
);

-- CreateEnum ProposalStatus
CREATE TYPE "ProposalStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'REJECTED'
);

-- CreateTable EvidenceSnapshot
CREATE TABLE "EvidenceSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "chunkIdsJson" JSONB NOT NULL,
    "countsJson" JSONB,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvidenceSnapshot_projectId_idx" ON "EvidenceSnapshot"("projectId");

-- CreateTable PhaseArtifact
CREATE TABLE "PhaseArtifact" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phase" "Phase" NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ArtifactStatus" NOT NULL DEFAULT 'DIRTY',
    "snapshotId" TEXT,
    "derivedFromJson" JSONB,
    "contentJson" JSONB NOT NULL,
    "contentMarkdown" TEXT,
    "lastComputedAt" TIMESTAMP(3),
    "ignoredSnapshotIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhaseArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhaseArtifact_projectId_phase_version_key" ON "PhaseArtifact"("projectId", "phase", "version");
CREATE INDEX "PhaseArtifact_projectId_phase_idx" ON "PhaseArtifact"("projectId", "phase");

-- CreateTable RecomputeJob
CREATE TABLE "RecomputeJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "snapshotId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "RecomputeJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecomputeJob_projectId_idx" ON "RecomputeJob"("projectId");

-- CreateTable RecomputeTask
CREATE TABLE "RecomputeTask" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "phase" "Phase" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "inputRefsJson" JSONB NOT NULL,
    "proposalId" TEXT,
    "message" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "RecomputeTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable Proposal
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phase" "Phase" NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "baseArtifactVersion" INTEGER NOT NULL,
    "patchJson" JSONB NOT NULL,
    "proposedJson" JSONB NOT NULL,
    "proposedMarkdown" TEXT,
    "diffSummary" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "aiRunIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Proposal_projectId_phase_idx" ON "Proposal"("projectId", "phase");

-- AddForeignKey
ALTER TABLE "EvidenceSnapshot" ADD CONSTRAINT "EvidenceSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseArtifact" ADD CONSTRAINT "PhaseArtifact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecomputeJob" ADD CONSTRAINT "RecomputeJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecomputeTask" ADD CONSTRAINT "RecomputeTask_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "RecomputeJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
