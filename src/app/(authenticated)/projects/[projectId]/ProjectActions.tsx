"use client";

import { useState, useTransition } from "react";
import { toggleProjectPin, exportProjectData } from "@/lib/actions/notes";
import { buildEngagementPackage } from "@/lib/actions/export-package";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

export function ProjectActions({ projectId, isPinned }: { projectId: string; isPinned: boolean }) {
  const [pinned, setPinned] = useState(isPinned);
  const [isPending, startTransition] = useTransition();
  const [showExportMenu, setShowExportMenu] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const handlePin = () => {
    startTransition(async () => {
      const result = await toggleProjectPin(projectId);
      if (result.success) {
        setPinned(result.isPinned);
        toast.info(result.isPinned ? "Project pinned" : "Project unpinned");
        router.refresh();
      }
    });
  };

  const handleExportJSON = () => {
    setShowExportMenu(false);
    startTransition(async () => {
      const data = await exportProjectData(projectId);
      if (!data) {
        toast.error("Export failed");
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `project-export-${projectId.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported", "Project data downloaded as JSON");
    });
  };

  const handleExportPackage = () => {
    setShowExportMenu(false);
    startTransition(async () => {
      toast.info("Building package", "Assembling collections, configs, and documentation...");
      const pkg = await buildEngagementPackage(projectId);
      if (!pkg) {
        toast.error("Package build failed", "Could not assemble the engagement package");
        return;
      }
      const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `engagement-package-${projectId.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Engagement Package Ready", `${pkg.summary.totalFiles} artifacts assembled and downloaded`);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePin}
        disabled={isPending}
        className="btn-ghost text-sm px-2"
        title={pinned ? "Unpin project" : "Pin project"}
        aria-label={pinned ? "Unpin project" : "Pin project"}
      >
        {pinned ? "⊛ Pinned" : "⊙ Pin"}
      </button>
      <div className="relative">
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          disabled={isPending}
          className="btn-ghost text-sm px-2"
          title="Export options"
          aria-label="Export options"
          aria-expanded={showExportMenu}
        >
          {isPending ? "Exporting..." : "↓ Export"}
        </button>
        {showExportMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
            <div
              className="absolute right-0 top-full mt-1 w-52 rounded-lg shadow-xl z-20 py-1 animate-in"
              style={{ background: "var(--surface)", border: "1px solid var(--border-bright)" }}
            >
              <button
                onClick={handleExportJSON}
                className="w-full text-left px-3 py-2 text-xs transition-colors"
                style={{ color: "var(--foreground-muted)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; e.currentTarget.style.color = "var(--foreground)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--foreground-muted)"; }}
              >
                <span className="block font-medium">Export as JSON</span>
                <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>Raw project data</span>
              </button>
              <button
                onClick={handleExportPackage}
                className="w-full text-left px-3 py-2 text-xs transition-colors"
                style={{ color: "var(--foreground-muted)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; e.currentTarget.style.color = "var(--foreground)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--foreground-muted)"; }}
              >
                <span className="block font-medium" style={{ color: "var(--accent-green)" }}>Engagement Package</span>
                <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>Collections, CI/CD configs, IaC, docs</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
