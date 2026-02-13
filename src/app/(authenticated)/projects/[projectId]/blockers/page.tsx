import { getBlockerDashboardAction } from "@/lib/actions/blockers";
import { BlockersPanel } from "./BlockersPanel";

export default async function BlockersPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const data = await getBlockerDashboardAction(projectId);

  return <BlockersPanel projectId={projectId} initialData={data} />;
}
