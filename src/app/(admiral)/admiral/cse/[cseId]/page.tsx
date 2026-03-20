import { getCseDetail, getCseList, getAdmiralTasks, getAdmiralNotes } from "@/lib/actions/admin";
import { redirect } from "next/navigation";
import { CseDetailClient } from "./CseDetailClient";

export default async function CseDetailPage({ params }: { params: Promise<{ cseId: string }> }) {
  const { cseId } = await params;
  const [cse, cseList, tasks, notes] = await Promise.all([
    getCseDetail(cseId),
    getCseList(),
    getAdmiralTasks({ assigneeId: cseId }),
    getAdmiralNotes({ cseUserId: cseId }),
  ]);

  if (!cse) redirect("/admiral");

  return (
    <CseDetailClient
      cse={cse}
      cseList={cseList}
      tasks={tasks}
      notes={notes}
    />
  );
}
