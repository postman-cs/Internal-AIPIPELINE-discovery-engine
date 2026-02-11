import Link from "next/link";
import { getProject } from "@/lib/actions/projects";
import { notFound } from "next/navigation";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  const latestArtifact = project.discoveryArtifacts[0];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {project.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">Project Overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Metadata */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Details
          </h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Primary Domain
              </dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100 mt-0.5">
                {project.primaryDomain || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                API Domain
              </dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100 mt-0.5">
                {project.apiDomain || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Public Workspace URL
              </dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100 mt-0.5">
                {project.publicWorkspaceUrl ? (
                  <a
                    href={project.publicWorkspaceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#ff6c37] hover:underline"
                  >
                    {project.publicWorkspaceUrl}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </dt>
              <dd className="text-sm text-gray-900 dark:text-gray-100 mt-0.5">
                {project.createdAt.toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </div>

        {/* Discovery Status */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Discovery
          </h2>
          {latestArtifact ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Latest Version</span>
                <span className="badge-success">v{latestArtifact.version}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Maturity Level</span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {latestArtifact.maturityLevel
                    ? `Level ${latestArtifact.maturityLevel}`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Created</span>
                <span className="text-xs text-gray-500">
                  {latestArtifact.createdAt.toLocaleDateString()}
                </span>
              </div>
              <div className="flex gap-2 pt-2">
                <Link
                  href={`/projects/${project.id}/discovery`}
                  className="btn-primary text-sm flex-1 text-center"
                >
                  Edit Discovery
                </Link>
                <Link
                  href={`/projects/${project.id}/discovery/brief`}
                  className="btn-secondary text-sm flex-1 text-center"
                >
                  View Brief
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-4">
                No discovery artifact yet
              </p>
              <Link
                href={`/projects/${project.id}/discovery`}
                className="btn-primary text-sm inline-block"
              >
                Start Discovery
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
