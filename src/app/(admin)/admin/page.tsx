import Link from "next/link";
import { getAdminStats } from "@/lib/actions/admin";

export default async function AdminDashboard() {
  const stats = await getAdminStats();

  const cards = [
    { label: "Users", value: stats.userCount, href: "/admin/users", color: "#8b5cf6" },
    { label: "Projects", value: stats.projectCount, href: "/admin/projects", color: "#ff6c37" },
    { label: "Teams", value: stats.teamCount, href: "/admin/teams", color: "#06d6d6" },
    { label: "Waves", value: stats.waveCount, href: "/admin/waves", color: "#3b82f6" },
    { label: "Drip Campaigns", value: stats.campaignCount, href: "/admin/campaigns", color: "#10b981" },
    { label: "Blockers", value: stats.blockerCount, href: "/admin/blockers", color: "#ef4444" },
    { label: "Assumptions", value: stats.assumptionCount, href: "/admin/assumptions", color: "#f59e0b" },
    { label: "Milestones", value: stats.milestoneCount, href: "#", color: "#06d6d6" },
    { label: "AI Runs", value: stats.aiRunCount, href: "#", color: "#8b5cf6" },
    { label: "Documents", value: stats.docCount, href: "#", color: "#3b82f6" },
  ];

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Admin Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>System overview and management</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="card-glow flex flex-col items-start py-4 px-4 transition-all duration-200 group"
          >
            <p className="text-2xl font-bold tabular-nums" style={{ color: c.color }}>{c.value}</p>
            <p className="text-xs mt-1 uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>{c.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/admin/users" className="btn-secondary text-sm text-center">Manage Users</Link>
            <Link href="/admin/projects" className="btn-secondary text-sm text-center">Manage Projects</Link>
            <Link href="/admin/teams" className="btn-secondary text-sm text-center">Manage Teams</Link>
            <Link href="/admin/blockers" className="btn-secondary text-sm text-center">Manage Blockers</Link>
            <Link href="/dashboard" className="btn-ghost text-sm text-center col-span-2">Switch to App View</Link>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>Seeded Credentials</h2>
          <div className="space-y-3">
            <div className="p-3 rounded-lg" style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-medium mb-1" style={{ color: "#a78bfa" }}>Admin</p>
              <p className="text-sm font-mono" style={{ color: "var(--foreground)" }}>admin@postman.com / admin123</p>
            </div>
            <div className="p-3 rounded-lg" style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-medium mb-1" style={{ color: "var(--accent-cyan)" }}>CSE User</p>
              <p className="text-sm font-mono" style={{ color: "var(--foreground)" }}>cse@postman.com / pipeline123</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
