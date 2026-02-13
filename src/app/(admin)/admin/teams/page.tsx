import { getAdminTeams, getAdminProjects, getAdminWaves } from "@/lib/actions/admin";
import { TeamsClient } from "./TeamsClient";

export default async function AdminTeamsPage() {
  const [teams, projects, waves] = await Promise.all([
    getAdminTeams(),
    getAdminProjects(),
    getAdminWaves(),
  ]);
  return <TeamsClient teams={teams} projects={projects} waves={waves} />;
}
