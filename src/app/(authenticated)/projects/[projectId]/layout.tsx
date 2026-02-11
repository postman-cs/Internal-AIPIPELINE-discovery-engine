import { getProject } from "@/lib/actions/projects";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { notFound } from "next/navigation";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await getProject(projectId);

  if (!project) {
    notFound();
  }

  return (
    <div className="flex">
      <ProjectSidebar projectId={project.id} projectName={project.name} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
