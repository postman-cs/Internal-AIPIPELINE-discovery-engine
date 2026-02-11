import Link from "next/link";
import { getProjects } from "@/lib/actions/projects";
import { CreateProjectForm } from "./CreateProjectForm";

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Projects
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your customer engagements
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project List */}
        <div className="lg:col-span-2">
          {projects.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500 mb-4">No projects yet</p>
              <p className="text-sm text-gray-400">
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
                    className="card block hover:border-[#ff6c37]/30 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          {project.name}
                        </h3>
                        {project.primaryDomain && (
                          <p className="text-sm text-gray-500 mt-0.5">
                            {project.primaryDomain}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
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
