import { getAssignableProjects } from "@/lib/actions/architect";
import { ArchitectClient } from "./ArchitectClient";

export const metadata = {
  title: "Architecture Mapper — CortexLab",
};

export default async function ArchitectPage() {
  const projects = await getAssignableProjects();
  return <ArchitectClient projects={projects} />;
}
