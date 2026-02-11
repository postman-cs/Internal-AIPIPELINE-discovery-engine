"use client";

import { useState, useTransition } from "react";
import { toggleProjectPin, exportProjectData } from "@/lib/actions/notes";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

export function ProjectActions({ projectId, isPinned }: { projectId: string; isPinned: boolean }) {
  const [pinned, setPinned] = useState(isPinned);
  const [isPending, startTransition] = useTransition();
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

  const handleExport = () => {
    startTransition(async () => {
      const data = await exportProjectData(projectId);
      if (!data) {
        toast.error("Export failed");
        return;
      }
      // Download as JSON
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

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePin}
        disabled={isPending}
        className="btn-ghost text-sm px-2"
        title={pinned ? "Unpin project" : "Pin project"}
      >
        {pinned ? "⊛ Pinned" : "⊙ Pin"}
      </button>
      <button
        onClick={handleExport}
        disabled={isPending}
        className="btn-ghost text-sm px-2"
        title="Export project data"
      >
        ↓ Export
      </button>
    </div>
  );
}
