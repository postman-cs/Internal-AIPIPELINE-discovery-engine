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

  const [artifact, discoveryArtifact] = await Promise.all([
    prisma.phaseArtifact.findFirst({
      where: { projectId, phase: "CURRENT_TOPOLOGY" },
      orderBy: { version: "desc" },
    }),
    prisma.phaseArtifact.findFirst({
      where: { projectId, phase: "DISCOVERY" },
      orderBy: { version: "desc" },
    }),
  ]);

  const content = artifact?.contentJson as Record<string, unknown> | null;
  const nodes = (content?.nodes as Array<Record<string, unknown>>) ?? [];
  const edges = (content?.edges as Array<Record<string, unknown>>) ?? [];

  const discoveryContent = discoveryArtifact?.contentJson as Record<string, unknown> | null;
  const hypothesis = discoveryContent?.hypothesis as Record<string, unknown> | null;
  const maturity = discoveryContent?.maturity as Record<string, unknown> | null;
  const problemStatement = {
    hypothesis: (hypothesis?.text as string) ?? null,
    recommendedApproach: (hypothesis?.recommendedApproach as string) ?? null,
    conversationAngle: (hypothesis?.conversationAngle as string) ?? null,
    maturityLevel: (maturity?.level as number) ?? null,
    maturityJustification: (maturity?.justification as string) ?? null,
  };

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

      {/* Problem Statement (collapsible) */}
      {problemStatement.hypothesis && (
        <details className="mx-6 mt-4 rounded-xl group" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <summary
            className="flex items-center gap-2 px-5 py-3 cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden"
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.2)" }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="#22c55e" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5.002 5.002 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>Problem Statement</h2>
            {problemStatement.maturityLevel && (
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                style={{
                  background: "rgba(6,214,214,0.08)",
                  border: "1px solid rgba(6,214,214,0.15)",
                  color: "#06d6d6",
                }}
              >
                Maturity Level {problemStatement.maturityLevel}
              </span>
            )}
            <svg
              className="w-4 h-4 ml-auto transition-transform duration-200 group-open:rotate-180 shrink-0"
              fill="none" viewBox="0 0 24 24" stroke="var(--foreground-dim)" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </summary>
          <div className="px-5 pb-5 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="text-sm leading-relaxed pt-3" style={{ color: "var(--foreground-muted)" }}>
              {problemStatement.hypothesis}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {problemStatement.recommendedApproach && (
                <div className="rounded-lg p-3" style={{ background: "var(--background-secondary)" }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--foreground-dim)" }}>Recommended Approach</p>
                  <p className="text-xs" style={{ color: "var(--foreground)" }}>{problemStatement.recommendedApproach}</p>
                </div>
              )}
              {problemStatement.conversationAngle && (
                <div className="rounded-lg p-3" style={{ background: "var(--background-secondary)" }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--foreground-dim)" }}>Conversation Angle</p>
                  <p className="text-xs" style={{ color: "var(--foreground)" }}>{problemStatement.conversationAngle}</p>
                </div>
              )}
            </div>
            {problemStatement.maturityJustification && (
              <p className="text-xs leading-relaxed pt-1" style={{ color: "var(--foreground-dim)" }}>
                {problemStatement.maturityJustification}
              </p>
            )}
          </div>
        </details>
      )}

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
