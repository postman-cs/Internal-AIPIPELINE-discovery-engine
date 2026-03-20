"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/actions/auth";

const NAV_SECTIONS = [
  {
    title: "Command Bridge",
    items: [
      { href: "/admiral", label: "Dashboard", icon: "grid" },
      { href: "/admiral/tasks", label: "Tasks", icon: "task" },
      { href: "/admiral/notes", label: "Notes", icon: "note" },
    ],
  },
  {
    title: "Fleet Management",
    items: [
      { href: "/admiral/users", label: "CSE Roster", icon: "users" },
      { href: "/admiral/projects", label: "Engagements", icon: "folder" },
      { href: "/admiral/jira", label: "Jira KanBan", icon: "kanban" },
    ],
  },
  {
    title: "Pipeline Health",
    items: [
      { href: "/admiral/blockers", label: "Blockers", icon: "block" },
      { href: "/admiral/assumptions", label: "Assumptions", icon: "check" },
    ],
  },
];

function SidebarIcon({ icon, className }: { icon: string; className?: string }) {
  const cn = className ?? "w-4 h-4";
  switch (icon) {
    case "grid":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>;
    case "users":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>;
    case "folder":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>;
    case "team":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>;
    case "wave":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" /></svg>;
    case "mail":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>;
    case "block":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>;
    case "check":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case "task":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /></svg>;
    case "kanban":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15M4.5 4.5h15" /><rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "note":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>;
    default:
      return null;
  }
}

export function AdmiralSidebar({ userName, criticalBlockerCount = 0, openTaskCount = 0 }: { userName?: string; criticalBlockerCount?: number; openTaskCount?: number }) {
  const pathname = usePathname();

  return (
    <aside
      className="fixed top-0 left-0 h-screen w-60 flex flex-col z-40"
      style={{
        background: "rgba(8, 10, 18, 0.95)",
        borderRight: "1px solid var(--border)",
        backdropFilter: "blur(20px)",
      }}
    >
      <div className="h-14 flex items-center px-5 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <Link href="/admiral" className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #c9a227, #b8860b)", boxShadow: "0 0 16px rgba(201, 162, 39, 0.3)" }}
          >
            <span className="text-white text-[10px] font-bold">CL</span>
          </div>
          <span className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>Admiral&apos;s Bridge</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="text-[10px] uppercase tracking-widest font-semibold mb-2 px-2" style={{ color: "var(--foreground-dim)" }}>
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = item.href === "/admiral"
                  ? pathname === "/admiral"
                  : pathname.startsWith(item.href) || (item.href === "/admiral/users" && pathname.startsWith("/admiral/cse/"));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150"
                    style={{
                      background: isActive ? "rgba(201, 162, 39, 0.1)" : "transparent",
                      color: isActive ? "#e5c84c" : "var(--foreground-muted)",
                      boxShadow: isActive ? "0 0 0 1px rgba(201, 162, 39, 0.15)" : "none",
                    }}
                  >
                    <SidebarIcon icon={item.icon} />
                    <span className="flex-1">{item.label}</span>
                    {item.icon === "block" && criticalBlockerCount > 0 && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                        style={{ background: "rgba(239, 68, 68, 0.2)", color: "#ef4444" }}
                      >
                        {criticalBlockerCount}
                      </span>
                    )}
                    {item.icon === "task" && openTaskCount > 0 && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none"
                        style={{ background: "rgba(59, 130, 246, 0.2)", color: "#60a5fa" }}
                      >
                        {openTaskCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>{userName ?? "Admiral"}</p>
            <Link href="/dashboard" className="text-[10px] hover:underline" style={{ color: "var(--accent-cyan)" }}>
              Switch to App
            </Link>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="text-xs px-2 py-1 rounded" style={{ color: "var(--foreground-dim)" }}>
              Logout
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
