"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "", label: "Overview", icon: "overview", shortLabel: "Overview" },
  { href: "/discovery", label: "Discovery", icon: "discovery", shortLabel: "Discover" },
  { href: "/assumptions", label: "Assumptions", icon: "assumptions", shortLabel: "Verify" },
  { href: "/topology", label: "Topology", icon: "topology", shortLabel: "Topology" },
  { href: "/cicd", label: "CI/CD Playbook", icon: "cicd", shortLabel: "CI/CD" },
  { href: "/blockers", label: "Blockers", icon: "blockers", shortLabel: "Blockers" },
  { href: "/updates", label: "Cascade Updates", icon: "updates", shortLabel: "Updates" },
  { href: "/execution", label: "Execution", icon: "execution", shortLabel: "Execute" },
];

function TabIcon({ icon, active }: { icon: string; active: boolean }) {
  const color = active ? "var(--accent-cyan)" : "var(--foreground-dim)";
  const cn = "w-4 h-4";
  switch (icon) {
    case "overview":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>;
    case "discovery":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>;
    case "topology":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>;
    case "cicd":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg>;
    case "assumptions":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case "blockers":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>;
    case "updates":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>;
    case "execution":
      return <svg className={cn} fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" /></svg>;
    default:
      return null;
  }
}

export function ProjectSubNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const basePath = `/projects/${projectId}`;

  return (
    <nav
      className="relative z-10 border-b"
      style={{
        background: "rgba(6, 8, 15, 0.6)",
        borderColor: "var(--border)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        <div className="flex items-center py-1">
          {TABS.map((tab, idx) => {
            const fullHref = `${basePath}${tab.href}`;
            const isActive = tab.href === ""
              ? pathname === basePath
              : pathname.startsWith(fullHref);

            const activeIndex = TABS.findIndex((t) => {
              const fp = `${basePath}${t.href}`;
              return t.href === "" ? pathname === basePath : pathname.startsWith(fp);
            });
            const isCompleted = activeIndex > idx;
            const isLast = idx === TABS.length - 1;

            return (
              <div key={tab.href} className="flex items-center min-w-0">
                <Link
                  href={fullHref}
                  className="flex items-center gap-1.5 px-1.5 sm:px-2 py-2 rounded-lg transition-all duration-200 relative min-w-0"
                  style={{
                    background: isActive ? "rgba(6, 214, 214, 0.06)" : "transparent",
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 transition-all duration-200"
                    style={{
                      background: isActive
                        ? "rgba(6, 214, 214, 0.15)"
                        : isCompleted
                        ? "rgba(16, 185, 129, 0.12)"
                        : "rgba(255, 255, 255, 0.04)",
                      border: `1.5px solid ${
                        isActive ? "var(--accent-cyan)"
                        : isCompleted ? "var(--accent-green)"
                        : "var(--border-bright)"
                      }`,
                      color: isActive
                        ? "var(--accent-cyan)"
                        : isCompleted
                        ? "var(--accent-green)"
                        : "var(--foreground-dim)",
                    }}
                  >
                    {isCompleted ? (
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      idx + 1
                    )}
                  </div>

                  <span
                    className="text-[11px] font-medium whitespace-nowrap truncate"
                    style={{
                      color: isActive ? "var(--accent-cyan)" : isCompleted ? "var(--accent-green)" : "var(--foreground-muted)",
                    }}
                  >
                    {tab.shortLabel}
                  </span>

                  {isActive && (
                    <div
                      className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                      style={{ background: "var(--accent-cyan)" }}
                    />
                  )}
                </Link>

                {!isLast && (
                  <div
                    className="w-3 h-px shrink-0"
                    style={{
                      background: isCompleted
                        ? "var(--accent-green)"
                        : "var(--border-bright)",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
