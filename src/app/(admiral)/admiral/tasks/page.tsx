import { getAdmiralTasks } from "@/lib/actions/admin";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { TasksClient } from "./TasksClient";

export default async function AdmiralTasksPage() {
  await requireAuth();

  const [tasks, users, projects] = await Promise.all([
    getAdmiralTasks(),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true },
    }),
  ]);

  return <TasksClient tasks={tasks} users={users} projects={projects} />;
}
