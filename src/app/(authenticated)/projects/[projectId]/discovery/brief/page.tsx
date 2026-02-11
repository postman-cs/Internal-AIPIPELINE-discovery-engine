import { getProject } from "@/lib/actions/projects";
import { getLatestDiscoveryArtifact } from "@/lib/actions/discovery";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BriefView } from "./BriefView";

export default async function BriefPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const artifact = await getLatestDiscoveryArtifact(projectId);

  if (!artifact || !artifact.generatedBriefMarkdown) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="card text-center py-12">
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>No Discovery Brief Yet</h2>
          <p className="text-sm mb-4" style={{ color: "var(--foreground-muted)" }}>Complete the discovery process to generate a brief.</p>
          <Link href={`/projects/${projectId}/discovery`} className="btn-primary inline-block">Start Discovery</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Discovery Brief</h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
            {project.name} &middot; Version {artifact.version} &middot; {artifact.createdAt.toLocaleDateString()}
          </p>
        </div>
        <Link href={`/projects/${projectId}/discovery`} className="btn-secondary text-sm">Edit Discovery</Link>
      </div>
      <BriefView markdown={artifact.generatedBriefMarkdown} json={artifact.generatedBriefJson || "{}"} projectName={project.name} version={artifact.version} />
    </div>
  );
}
