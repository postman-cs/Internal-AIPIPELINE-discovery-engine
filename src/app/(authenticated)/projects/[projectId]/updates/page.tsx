import { getCascadeState } from "@/lib/actions/cascade";
import { getProject } from "@/lib/actions/projects";
import { notFound } from "next/navigation";
import { CascadeUpdatesPanel } from "./CascadeUpdatesPanel";

export default async function UpdatesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const cascadeState = await getCascadeState(projectId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Cascade Updates
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
          Evidence-driven update proposals. New evidence triggers impact analysis and proposals for your review.
        </p>
      </div>

      <CascadeUpdatesPanel projectId={projectId} cascadeState={cascadeState} />
    </div>
  );
}
