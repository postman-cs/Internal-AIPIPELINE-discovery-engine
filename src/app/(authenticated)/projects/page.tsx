import Link from "next/link";
import { getProjects } from "@/lib/actions/projects";
import { CreateProjectForm } from "./CreateProjectForm";

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Projects
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
            Manage your customer engagements
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project List */}
        <div className="lg:col-span-2">
          {projects.length === 0 ? (
            <div className="card text-center py-12">
              <p className="mb-4" style={{ color: "var(--foreground-muted)" }}>No projects yet</p>
              <p className="text-sm" style={{ color: "var(--foreground-dim)" }}>
                Create your first project using the form &rarr;
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => {
                const latestArtifact = project.discoveryArtifacts[0];
                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="card-glow block transition-all duration-200"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>
                          {project.name}
                        </h3>
                        {project.primaryDomain && (
                          <p className="text-sm mt-0.5" style={{ color: "var(--foreground-dim)" }}>
                            {project.primaryDomain}
                          </p>
                        )}
                        <p className="text-xs mt-1" style={{ color: "var(--foreground-dim)" }}>
                          Updated{" "}
                          {project.updatedAt.toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        {latestArtifact ? (
                          <span className="badge-success">
                            Discovery v{latestArtifact.version}
                          </span>
                        ) : (
                          <span className="badge-warning">No discovery</span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Create Project Form */}
        <div>
          <CreateProjectForm />
        </div>
      </div>
    </div>
  );
}
