"use client";

import Link from "next/link";

interface CascadeState {
  phaseStatuses: Record<string, string>;
  hasServiceTemplate: boolean;
  hasDiscovery: boolean;
  repoInitialized: boolean;
  artifactsPushed: boolean;
  buildLogComplete: boolean;
  pendingAssumptions: number;
  activeBlockers: number;
  dirtyPhaseCount: number;
}

interface NextStepGuideProps {
  projectId: string;
  cascade: CascadeState;
}

interface RecommendedAction {
  label: string;
  description: string;
  href: string;
  priority: "high" | "medium" | "low";
  icon: "upload" | "verify" | "cascade" | "build" | "repo" | "check" | "blocker";
}

const PRIORITY_STYLES = {
  high: { bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.2)", accent: "#f87171" },
  medium: { bg: "rgba(245, 158, 11, 0.08)", border: "rgba(245, 158, 11, 0.2)", accent: "#fbbf24" },
  low: { bg: "rgba(6, 214, 214, 0.08)", border: "rgba(6, 214, 214, 0.2)", accent: "var(--accent-cyan)" },
};

function computeNextAction(projectId: string, cascade: CascadeState): RecommendedAction | null {
  if (!cascade.hasServiceTemplate) {
    return {
      label: "Upload service template",
      description: "Start by uploading a service template to seed the discovery phase",
      href: `/projects/${projectId}/discovery`,
      priority: "high",
      icon: "upload",
    };
  }

  if (!cascade.hasDiscovery) {
    return {
      label: "Complete discovery",
      description: "Run the AI discovery agent to analyze your service template",
      href: `/projects/${projectId}/discovery`,
      priority: "high",
      icon: "build",
    };
  }

  if (cascade.activeBlockers > 0) {
    return {
      label: `Resolve ${cascade.activeBlockers} blocker${cascade.activeBlockers > 1 ? "s" : ""}`,
      description: "Active blockers are preventing pipeline progress",
      href: `/projects/${projectId}/blockers`,
      priority: "high",
      icon: "blocker",
    };
  }

  if (cascade.pendingAssumptions > 0) {
    return {
      label: `Verify ${cascade.pendingAssumptions} assumption${cascade.pendingAssumptions > 1 ? "s" : ""}`,
      description: "Unverified assumptions may be blocking cascade progress",
      href: `/projects/${projectId}/assumptions`,
      priority: cascade.pendingAssumptions > 5 ? "high" : "medium",
      icon: "verify",
    };
  }

  if (cascade.dirtyPhaseCount > 0) {
    return {
      label: "Run cascade",
      description: `${cascade.dirtyPhaseCount} phase${cascade.dirtyPhaseCount > 1 ? "s" : ""} need recomputation`,
      href: `/projects/${projectId}/updates`,
      priority: "medium",
      icon: "cascade",
    };
  }

  if (!cascade.repoInitialized) {
    return {
      label: "Initialize repository",
      description: "Set up Git repo to push artifacts",
      href: `/projects/${projectId}/repo`,
      priority: "medium",
      icon: "repo",
    };
  }

  if (!cascade.artifactsPushed) {
    return {
      label: "Push artifacts to repo",
      description: "Export generated artifacts to your Git repository",
      href: `/projects/${projectId}/repo`,
      priority: "medium",
      icon: "repo",
    };
  }

  if (!cascade.buildLogComplete) {
    return {
      label: "Complete build log",
      description: "Document the use case activation for handoff",
      href: `/projects/${projectId}/buildlog`,
      priority: "low",
      icon: "build",
    };
  }

  return null;
}

const ICONS: Record<string, React.ReactNode> = {
  upload: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  ),
  verify: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  cascade: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
    </svg>
  ),
  build: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  repo: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  blocker: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
};

export function NextStepGuide({ projectId, cascade }: NextStepGuideProps) {
  const action = computeNextAction(projectId, cascade);
  if (!action) return null;

  const style = PRIORITY_STYLES[action.priority];

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in" style={{ maxWidth: 360 }}>
      <Link
        href={action.href}
        className="flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-xl"
        style={{
          background: style.bg,
          border: `1px solid ${style.border}`,
          backdropFilter: "blur(16px)",
        }}
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${style.accent}20`, color: style.accent }}
        >
          {ICONS[action.icon]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: style.accent }}>
            {action.label}
          </p>
          <p className="text-[10px] truncate" style={{ color: "var(--foreground-dim)" }}>
            {action.description}
          </p>
        </div>
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke={style.accent} strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </Link>
    </div>
  );
}
