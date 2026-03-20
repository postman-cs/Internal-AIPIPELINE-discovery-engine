"use client";

import { useState, useEffect } from "react";

interface ArtifactVersion {
  version: number;
  status: string;
  lastComputedAt: string | null;
  createdAt: string;
}

interface ArtifactVersionSelectorProps {
  projectId: string;
  phase: string;
  versions: ArtifactVersion[];
  currentVersion: number;
  onVersionChange?: (version: number) => void;
}

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  CLEAN: { bg: "rgba(16,185,129,0.1)", text: "#34d399" },
  CLEAN_WITH_EXCEPTIONS: { bg: "rgba(16,185,129,0.1)", text: "#34d399" },
  DIRTY: { bg: "rgba(245,158,11,0.1)", text: "#fbbf24" },
  STALE: { bg: "rgba(255,255,255,0.04)", text: "var(--foreground-dim)" },
  NEEDS_REVIEW: { bg: "rgba(96,165,250,0.1)", text: "#60a5fa" },
};

export function ArtifactVersionSelector({
  projectId: _projectId,
  phase,
  versions,
  currentVersion,
  onVersionChange,
}: ArtifactVersionSelectorProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(currentVersion);

  useEffect(() => {
    setSelected(currentVersion);
  }, [currentVersion]);

  if (versions.length <= 1) {
    const v = versions[0];
    if (!v) return null;
    const badge = STATUS_BADGE[v.status] ?? STATUS_BADGE.STALE;
    return (
      <span
        className="text-[10px] font-medium px-2 py-0.5 rounded-full"
        style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.text}20` }}
      >
        v{v.version} · {v.status.replace(/_/g, " ")}
      </span>
    );
  }

  const current = versions.find((v) => v.version === selected) ?? versions[0];
  const currentBadge = STATUS_BADGE[current.status] ?? STATUS_BADGE.STALE;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full transition-all hover:brightness-110"
        style={{ background: currentBadge.bg, color: currentBadge.text, border: `1px solid ${currentBadge.text}20` }}
      >
        v{current.version}
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={open ? "M4.5 15.75l7.5-7.5 7.5 7.5" : "M19.5 8.25l-7.5 7.5-7.5-7.5"} />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full mt-1 right-0 z-50 rounded-xl overflow-hidden shadow-xl"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            minWidth: 220,
            backdropFilter: "blur(16px)",
          }}
        >
          <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--foreground-dim)" }}>
              {phase.replace(/_/g, " ")} — {versions.length} versions
            </p>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {versions.map((v) => {
              const badge = STATUS_BADGE[v.status] ?? STATUS_BADGE.STALE;
              const isSelected = v.version === selected;
              return (
                <button
                  key={v.version}
                  className="w-full flex items-center justify-between px-3 py-2 text-left transition-all"
                  style={{
                    background: isSelected ? "rgba(6, 214, 214, 0.06)" : "transparent",
                    borderBottom: "1px solid var(--border)",
                  }}
                  onClick={() => {
                    setSelected(v.version);
                    setOpen(false);
                    onVersionChange?.(v.version);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: badge.text }}
                    />
                    <span className="text-xs font-medium" style={{ color: isSelected ? "var(--accent-cyan)" : "var(--foreground)" }}>
                      v{v.version}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px]" style={{ color: badge.text }}>
                      {v.status.replace(/_/g, " ")}
                    </span>
                    {v.lastComputedAt && (
                      <span className="text-[9px]" style={{ color: "var(--foreground-dim)" }}>
                        {new Date(v.lastComputedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
