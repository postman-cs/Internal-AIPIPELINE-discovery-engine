import { getProject } from "@/lib/actions/projects";
import { getCiCdPlaybookData } from "@/lib/actions/cicd";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CiCdPlaybook } from "./CiCdPlaybook";

export default async function CiCdPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  const playbookData = await getCiCdPlaybookData(projectId);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
              CI/CD Playbook
            </h1>
            {playbookData.hasData && (
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(16,185,129,0.06)",
                  color: "var(--accent-green)",
                  border: "1px solid rgba(16,185,129,0.12)",
                }}
              >
                Ready
              </span>
            )}
          </div>
          <p className="text-sm" style={{ color: "var(--foreground-dim)" }}>
            {project.name} &mdash; Pipeline configs, Postman collections, and Newman commands
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/projects/${projectId}`} className="btn-ghost text-xs py-1.5 px-3">
            Overview
          </Link>
          <Link href={`/projects/${projectId}/updates`} className="btn-secondary text-xs py-1.5 px-3">
            Cascade Updates
          </Link>
        </div>
      </div>

      <CiCdPlaybook data={playbookData} projectId={projectId} />
    </div>
  );
}
