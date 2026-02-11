import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen mesh-bg" style={{ background: "var(--background)" }}>
      <TopNav userName={session.name} />
      <Breadcrumbs />
      <main>{children}</main>
    </div>
  );
}
