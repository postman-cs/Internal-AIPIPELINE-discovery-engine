import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { AdmiralSidebar } from "./admiral/AdmiralSidebar";
import { PianoAmbience } from "@/components/PianoAmbience";
import { getCriticalBlockerCount } from "@/lib/actions/admin";
import { prisma } from "@/lib/prisma";

export default async function AdmiralLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  if (session.role !== "ADMIRAL" && session.role !== "ADMIN" && !session.isAdmin) redirect("/dashboard");

  const [criticalBlockerCount, openTaskCount] = await Promise.all([
    getCriticalBlockerCount(),
    prisma.admiralTask.count({ where: { status: { in: ["pending", "in_progress"] } } }),
  ]);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <AdmiralSidebar userName={session.name} criticalBlockerCount={criticalBlockerCount} openTaskCount={openTaskCount} />
      <main className="ml-60 min-h-screen">
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          {children}
        </div>
      </main>
      <PianoAmbience />
    </div>
  );
}
