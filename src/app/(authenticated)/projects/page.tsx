import { getProjects } from "@/lib/actions/projects";
import { CreateProjectForm } from "./CreateProjectForm";
import { ProjectList } from "./ProjectList";

export default async function ProjectsPage() {
  const projects = await getProjects();

  // Serialize dates for client component
  const serialized = projects.map((p) => ({
    id: p.id,
    name: p.name,
    primaryDomain: p.primaryDomain,
    isPinned: p.isPinned,
    updatedAt: p.updatedAt.toISOString(),
    discoveryVersion: p.discoveryArtifacts[0]?.version ?? null,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 page-animate">
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
        <div className="lg:col-span-2">
          <ProjectList projects={serialized} />
        </div>
        <div>
          <CreateProjectForm />
        </div>
      </div>
    </div>
  );
}
