import { getJiraKanbanData, getWeeklyDigest, getUsers } from "@/lib/actions/admin";
import { JiraKanbanClient } from "./JiraKanbanClient";

export default async function AdmiralJiraPage() {
  const [projects, digest, users] = await Promise.all([
    getJiraKanbanData(),
    getWeeklyDigest(),
    getUsers(),
  ]);

  const cses = users
    .filter((u) => u.role === "CSE")
    .map((u) => ({ id: u.id, name: u.name }));

  return <JiraKanbanClient projects={projects} digest={digest} cses={cses} />;
}
