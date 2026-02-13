import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { AdminSidebar } from "./admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId) redirect("/login");
  if (!session.isAdmin) redirect("/dashboard");

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <AdminSidebar userName={session.name} />
      <main className="ml-60 min-h-screen">
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
