"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface ProjectSidebarProps {
  projectId: string;
  projectName: string;
}

const SIDEBAR_ITEMS = (projectId: string) => [
  {
    href: `/projects/${projectId}`,
    label: "Overview",
    exact: true,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    href: `/projects/${projectId}/discovery`,
    label: "Discovery",
    exact: false,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
  },
  {
    href: `/projects/${projectId}/topology`,
    label: "Topology",
    exact: false,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
  {
    href: `/projects/${projectId}/updates`,
    label: "Cascade Updates",
    exact: false,
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
      </svg>
    ),
  },
];

export function ProjectSidebar({ projectId, projectName }: ProjectSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="w-56 shrink-0 min-h-[calc(100vh-3.5rem)]"
      style={{
        background: "var(--background-secondary)",
        borderRight: "1px solid var(--border)",
      }}
    >
      <div className="p-4">
        <Link
          href={`/projects/${projectId}`}
          className="text-sm font-semibold truncate block"
          title={projectName}
          style={{ color: "var(--foreground)" }}
        >
          {projectName}
        </Link>
        <Link
          href="/projects"
          className="text-xs mt-1 block transition-colors duration-200"
          style={{ color: "var(--foreground-dim)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-cyan)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-dim)")}
        >
          &larr; All projects
        </Link>
      </div>
      <nav className="px-2 space-y-0.5">
        {SIDEBAR_ITEMS(projectId).map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                background: isActive ? "rgba(6, 214, 214, 0.08)" : "transparent",
                color: isActive ? "var(--accent-cyan)" : "var(--foreground-muted)",
                boxShadow: isActive ? "0 0 0 1px rgba(6, 214, 214, 0.1)" : "none",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                  e.currentTarget.style.color = "var(--foreground)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--foreground-muted)";
                }
              }}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
