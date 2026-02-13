import { ProjectSubNav } from "./ProjectSubNav";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <>
      <ProjectSubNav projectId={projectId} />
      {children}
    </>
  );
}
