"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  ingest: "Data Ingest",
  "ai-runs": "AI Runs",
  discovery: "Discovery",
  topology: "Topology",
  updates: "Cascade Updates",
  brief: "Brief",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) return null; // Don't show on top-level pages

  const crumbs: Array<{ label: string; href: string }> = [];

  let href = "";
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    // Skip group segments like (authenticated) — don't add to href
    if (seg.startsWith("(")) continue;

    href += `/${seg}`;

    // Check if this is a dynamic ID segment (CUIDs are ~25 chars)
    const isId = seg.length > 15 && !ROUTE_LABELS[seg];

    const label = ROUTE_LABELS[seg] || (isId ? "..." : seg);
    crumbs.push({ label, href });
  }

  if (crumbs.length <= 1) return null;

  return (
    <nav className="relative z-10 flex items-center gap-1.5 text-xs px-4 sm:px-6 lg:px-8 pt-3 pb-0 max-w-7xl mx-auto">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && (
              <span style={{ color: "var(--foreground-dim)" }}>/</span>
            )}
            {isLast ? (
              <span style={{ color: "var(--foreground-muted)" }}>{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="transition-colors duration-200"
                style={{ color: "var(--foreground-dim)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-cyan)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-dim)")}
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
