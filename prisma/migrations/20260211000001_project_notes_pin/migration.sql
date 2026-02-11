-- Add isPinned to Project
ALTER TABLE "Project" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;

-- Create ProjectNote table
CREATE TABLE "ProjectNote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectNote_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "ProjectNote_projectId_idx" ON "ProjectNote"("projectId");
CREATE INDEX "ProjectNote_userId_idx" ON "ProjectNote"("userId");

-- Foreign keys
ALTER TABLE "ProjectNote" ADD CONSTRAINT "ProjectNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
