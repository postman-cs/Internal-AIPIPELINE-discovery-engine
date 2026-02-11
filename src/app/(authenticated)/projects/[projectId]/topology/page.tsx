import { prisma } from "@/lib/prisma";
import { getProject } from "@/lib/actions/projects";
import { requireAuth } from "@/lib/session";
import { notFound } from "next/navigation";
import TopologyTabs from "./TopologyTabs";

export default async function TopologyPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await requireAuth();
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  // Get latest CURRENT_TOPOLOGY PhaseArtifact
  const artifact = await prisma.phaseArtifact.findFirst({
    where: { projectId, phase: "CURRENT_TOPOLOGY" },
    orderBy: { version: "desc" },
  });

  const content = artifact?.contentJson as Record<string, unknown> | null;
  const nodes = (content?.nodes as Array<Record<string, unknown>>) ?? [];
  const edges = (content?.edges as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="px-6 py-3 border-b border-gray-800 bg-gray-950 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-100">
            Topology: {project.name}
          </h1>
          <p className="text-xs text-gray-500">
            {artifact
              ? `v${artifact.version} — ${artifact.status} — ${nodes.length} nodes, ${edges.length} edges`
              : "No topology artifact yet. Run a cascade update to generate one."}
          </p>
        </div>
        {artifact && (
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
              artifact.status === "CLEAN"
                ? "bg-green-900/30 text-green-400"
                : artifact.status === "DIRTY"
                ? "bg-yellow-900/30 text-yellow-400"
                : "bg-blue-900/30 text-blue-400"
            }`}
          >
            {artifact.status}
          </span>
        )}
      </div>

      {nodes.length > 0 ? (
        <TopologyTabs
          nodes={nodes}
          edges={edges}
          projectId={projectId}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-950">
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-2">
              No topology data available.
            </p>
            <p className="text-gray-500 text-xs">
              Ingest evidence, run a cascade update through Discovery, then
              accept the Discovery proposal to unlock topology generation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
