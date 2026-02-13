import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Starfield } from "@/components/Starfield";
import { PianoAmbience } from "@/components/PianoAmbience";

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
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <Starfield />
      <TopNav userName={session.name} isAdmin={session.isAdmin} />
      <Breadcrumbs />
      <main className="relative z-10">{children}</main>
      <PianoAmbience />
    </div>
  );
}
