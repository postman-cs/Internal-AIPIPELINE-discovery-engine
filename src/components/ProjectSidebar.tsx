"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface ProjectSidebarProps {
  projectId: string;
  projectName: string;
}

const SIDEBAR_ITEMS = (projectId: string) => [
  { href: `/projects/${projectId}`, label: "Overview", exact: true },
  { href: `/projects/${projectId}/discovery`, label: "Discovery", exact: false },
  { href: `/projects/${projectId}/topology`, label: "Topology", exact: false },
  { href: `/projects/${projectId}/updates`, label: "Cascade Updates", exact: false },
];

export function ProjectSidebar({ projectId, projectName }: ProjectSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50 min-h-[calc(100vh-3.5rem)]">
      <div className="p-4">
        <Link
          href={`/projects/${projectId}`}
          className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate block"
          title={projectName}
        >
          {projectName}
        </Link>
        <Link
          href="/projects"
          className="text-xs text-gray-500 hover:text-[#ff6c37] transition-colors mt-0.5 block"
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
              className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#ff6c37]/10 text-[#ff6c37]"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
