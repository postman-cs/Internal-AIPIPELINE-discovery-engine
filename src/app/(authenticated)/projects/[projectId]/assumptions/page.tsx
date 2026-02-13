import { getProjectAssumptions } from "@/lib/actions/assumptions";
import { AssumptionsPanel } from "./AssumptionsPanel";

export default async function AssumptionsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const data = await getProjectAssumptions(projectId);

  return <AssumptionsPanel projectId={projectId} initialData={data} />;
}
