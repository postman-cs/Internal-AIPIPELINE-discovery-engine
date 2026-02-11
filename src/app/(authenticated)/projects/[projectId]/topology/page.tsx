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
      <div
        className="px-6 py-3 flex items-center justify-between shrink-0"
        style={{
          background: "var(--background-secondary)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
            Topology: {project.name}
          </h1>
          <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>
            {artifact
              ? `v${artifact.version} — ${artifact.status} — ${nodes.length} nodes, ${edges.length} edges`
              : "No topology artifact yet. Run a cascade update to generate one."}
          </p>
        </div>
        {artifact && (
          <span
            className="text-[10px] font-semibold px-2.5 py-1 rounded-md"
            style={{
              background: artifact.status === "CLEAN"
                ? "rgba(16,185,129,0.1)"
                : artifact.status === "DIRTY"
                ? "rgba(245,158,11,0.1)"
                : "rgba(59,130,246,0.1)",
              color: artifact.status === "CLEAN"
                ? "#34d399"
                : artifact.status === "DIRTY"
                ? "#fbbf24"
                : "#60a5fa",
              border: `1px solid ${artifact.status === "CLEAN" ? "rgba(16,185,129,0.15)" : artifact.status === "DIRTY" ? "rgba(245,158,11,0.15)" : "rgba(59,130,246,0.15)"}`,
            }}
          >
            {artifact.status}
          </span>
        )}
      </div>

      {nodes.length > 0 ? (
        <TopologyTabs nodes={nodes} edges={edges} projectId={projectId} />
      ) : (
        <div className="flex-1 flex items-center justify-center" style={{ background: "var(--background)" }}>
          <div className="text-center">
            <p className="text-sm mb-2" style={{ color: "var(--foreground-muted)" }}>No topology data available.</p>
            <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>
              Ingest evidence, run a cascade update through Discovery, then accept the Discovery proposal to unlock topology generation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
