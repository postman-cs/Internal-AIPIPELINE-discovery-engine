import { getAdminWaves, getAdminProjects } from "@/lib/actions/admin";
import { WavesClient } from "./WavesClient";

export default async function AdminWavesPage() {
  const [waves, projects] = await Promise.all([getAdminWaves(), getAdminProjects()]);
  return <WavesClient waves={waves} projects={projects} />;
}
