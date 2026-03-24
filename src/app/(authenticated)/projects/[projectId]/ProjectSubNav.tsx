"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "", label: "Overview", icon: "overview", shortLabel: "Overview", phase: null },
  { href: "/discovery", label: "Discovery", icon: "discovery", shortLabel: "Discover", phase: "DISCOVERY" },
  { href: "/topology", label: "Topology", icon: "topology", shortLabel: "Topology", phase: "CURRENT_TOPOLOGY" },
  { href: "/cicd", label: "CI/CD Playbook", icon: "cicd", shortLabel: "CI/CD", phase: "CRAFT_SOLUTION" },
  { href: "/updates", label: "Cascade Updates", icon: "updates", shortLabel: "Updates", phase: null },
  { href: "/execution", label: "Execution", icon: "execution", shortLabel: "Execute", phase: "DEPLOYMENT_PLAN" },
  { href: "/execution/missions", label: "Missions", icon: "missions", shortLabel: "Missions", phase: "MEETINGS" },
  { href: "/repo", label: "Repo", icon: "repo", shortLabel: "Repo", phase: null },
  { href: "/buildlog", label: "Build Log", icon: "buildlog", shortLabel: "Build Log", phase: "BUILD_LOG" },
  { href: "/case-study", label: "Case Study", icon: "casestudy", shortLabel: "Case Study", phase: null },
] as const;

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  CLEAN: { bg: "rgba(16, 185, 129, 0.15)", border: "#34d399", text: "#34d399" },
  CLEAN_WITH_EXCEPTIONS: { bg: "rgba(16, 185, 129, 0.15)", border: "#34d399", text: "#34d399" },
  DIRTY: { bg: "rgba(245, 158, 11, 0.15)", border: "#fbbf24", text: "#fbbf24" },
  STALE: { bg: "rgba(255, 255, 255, 0.04)", border: "var(--foreground-dim)", text: "var(--foreground-dim)" },
  NEEDS_REVIEW: { bg: "rgba(96, 165, 250, 0.15)", border: "#60a5fa", text: "#60a5fa" },
};

interface ProjectSubNavProps {
  projectId: string;
  phaseStatuses?: Record<string, string>;
  upstreamDirtyPhases?: string[];
}

export function ProjectSubNav({ projectId, phaseStatuses = {}, upstreamDirtyPhases = [] }: ProjectSubNavProps) {
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
        <div className="flex items-center py-1 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: "touch" }}>
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

            const phaseStatus = tab.phase ? phaseStatuses[tab.phase] : null;
            const statusStyle = phaseStatus ? STATUS_COLORS[phaseStatus] : null;
            const hasBlockedUpstream = tab.phase ? upstreamDirtyPhases.includes(tab.phase) : false;

            const dotBg = isActive
              ? "rgba(6, 214, 214, 0.15)"
              : statusStyle ? statusStyle.bg
              : isCompleted ? "rgba(16, 185, 129, 0.12)"
              : "rgba(255, 255, 255, 0.04)";

            const dotBorder = isActive
              ? "var(--accent-cyan)"
              : statusStyle ? statusStyle.border
              : isCompleted ? "var(--accent-green)"
              : "var(--border-bright)";

            const dotColor = isActive
              ? "var(--accent-cyan)"
              : statusStyle ? statusStyle.text
              : isCompleted ? "var(--accent-green)"
              : "var(--foreground-dim)";

            return (
              <div key={tab.href} className="flex items-center min-w-0">
                <Link
                  href={fullHref}
                  className="flex items-center gap-1.5 px-1.5 sm:px-2 py-2 rounded-lg transition-all duration-200 relative min-w-0 min-h-[44px]"
                  style={{
                    background: isActive ? "rgba(6, 214, 214, 0.06)" : "transparent",
                  }}
                >
                  <div className="relative">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 transition-all duration-200"
                      style={{
                        background: dotBg,
                        border: `1.5px solid ${dotBorder}`,
                        color: dotColor,
                      }}
                    >
                      {isCompleted && !statusStyle ? (
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : phaseStatus === "CLEAN" || phaseStatus === "CLEAN_WITH_EXCEPTIONS" ? (
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        idx + 1
                      )}
                    </div>

                    {hasBlockedUpstream && (
                      <div
                        className="absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center"
                        style={{ background: "#f59e0b", border: "1.5px solid rgba(6, 8, 15, 0.8)" }}
                        title="Blocked by dirty upstream dependency"
                      >
                        <svg className="w-1.5 h-1.5" viewBox="0 0 6 6" fill="#000">
                          <rect x="2.5" y="0.5" width="1" height="3" rx="0.5" />
                          <rect x="2.5" y="4.5" width="1" height="1" rx="0.5" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <span
                    className="text-[11px] font-medium whitespace-nowrap truncate"
                    style={{
                      color: isActive ? "var(--accent-cyan)" : statusStyle ? statusStyle.text : isCompleted ? "var(--accent-green)" : "var(--foreground-muted)",
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
                      background: statusStyle
                        ? statusStyle.border
                        : isCompleted
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
