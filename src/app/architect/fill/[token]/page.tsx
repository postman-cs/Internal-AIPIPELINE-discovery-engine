import { notFound } from "next/navigation";
import { getProjectByShareToken } from "@/lib/actions/architect-share";
import { PublicArchitectForm } from "./PublicArchitectForm";

export default async function PublicArchitectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const project = await getProjectByShareToken(token);
  if (!project) notFound();

  const prefill = (project.architectShareData as Record<string, unknown>) ?? {};

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--background, #0a0a0a)", color: "var(--foreground, #ededed)" }}
    >
      <PublicArchitectForm
        token={token}
        projectName={project.name}
        prefill={prefill}
      />
    </div>
  );
}
