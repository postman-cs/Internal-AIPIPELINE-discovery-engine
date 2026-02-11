import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/TopNav";

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
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950">
      <TopNav userName={session.name} />
      <main>{children}</main>
    </div>
  );
}
