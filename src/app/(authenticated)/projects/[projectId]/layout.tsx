import { ProjectSubNav } from "./ProjectSubNav";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { PHASE_GRAPH } from "@/lib/cascade/phases";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await requireAuth();

  const artifacts = await prisma.phaseArtifact.findMany({
    where: { projectId, project: { ownerUserId: session.userId } },
    select: { phase: true, status: true },
    distinct: ["phase"],
    orderBy: { version: "desc" },
  });

  const phaseStatuses: Record<string, string> = {};
  for (const a of artifacts) {
    phaseStatuses[a.phase] = a.status;
  }

  const upstreamDirtyPhases: string[] = [];
  for (const node of PHASE_GRAPH) {
    if (node.dependencies.some((d) => phaseStatuses[d] === "DIRTY" || phaseStatuses[d] === "STALE")) {
      upstreamDirtyPhases.push(node.phase);
    }
  }

  return (
    <>
      <ProjectSubNav
        projectId={projectId}
        phaseStatuses={phaseStatuses}
        upstreamDirtyPhases={upstreamDirtyPhases}
      />
      {children}
    </>
  );
}
