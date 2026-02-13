import { getAdminProjects, getUsers } from "@/lib/actions/admin";
import { ProjectsClient } from "./ProjectsClient";

export default async function AdminProjectsPage() {
  const [projects, users] = await Promise.all([getAdminProjects(), getUsers()]);
  return <ProjectsClient projects={projects} users={users} />;
}
