import { getProject } from "@/lib/actions/projects";
import { requireAuth } from "@/lib/session";
import { notFound } from "next/navigation";
import { AdoptionPanel } from "./AdoptionPanel";

export default async function AdoptionPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await requireAuth();
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  // ADOPTION and ITERATION phases are not yet in the Phase enum —
  // render the panel with no artifact data until the schema is extended.
  return (
    <AdoptionPanel
      projectName={project.name}
      adoptionContent={null}
      adoptionMarkdown={null}
      iterationMetrics={null}
      hasArtifact={false}
      version={0}
      status={"STALE"}
    />
  );
}
