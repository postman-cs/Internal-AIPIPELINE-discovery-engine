-- CreateEnum TopologyNodeType
CREATE TYPE "TopologyNodeType" AS ENUM (
  'SERVICE',
  'API',
  'GATEWAY',
  'DATABASE',
  'IDENTITY_PROVIDER',
  'CDN',
  'LOAD_BALANCER',
  'CLIENT',
  'EXTERNAL_SYSTEM',
  'QUEUE',
  'STORAGE'
);

-- CreateEnum TopologyEdgeType
CREATE TYPE "TopologyEdgeType" AS ENUM (
  'CALLS',
  'AUTHENTICATES_WITH',
  'ROUTES_THROUGH',
  'READS_FROM',
  'WRITES_TO',
  'DEPENDS_ON'
);

-- CreateTable TopologyNode
CREATE TABLE "TopologyNode" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "TopologyNodeType" NOT NULL,
    "name" TEXT NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopologyNode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TopologyNode_projectId_idx" ON "TopologyNode"("projectId");

-- CreateTable TopologyEdge
CREATE TABLE "TopologyEdge" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "type" "TopologyEdgeType" NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopologyEdge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TopologyEdge_projectId_idx" ON "TopologyEdge"("projectId");

-- CreateTable TopologySnapshot
CREATE TABLE "TopologySnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "nodeIdsJson" JSONB NOT NULL,
    "edgeIdsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopologySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TopologySnapshot_projectId_idx" ON "TopologySnapshot"("projectId");

-- AddForeignKey
ALTER TABLE "TopologyNode" ADD CONSTRAINT "TopologyNode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TopologyEdge" ADD CONSTRAINT "TopologyEdge_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TopologySnapshot" ADD CONSTRAINT "TopologySnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
