"use client";

import { useTransition } from "react";
import { updateProjectEngagementStage } from "@/lib/actions/projects";
import { useToast } from "@/components/Toast";

export function EngagementStageUpdateButton({
  projectId,
  suggestedStage,
}: {
  projectId: string;
  suggestedStage: number;
}) {
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function handleAdvance() {
    startTransition(async () => {
      const result = await updateProjectEngagementStage(projectId, suggestedStage);
      if (result.success) {
        toast.success("Stage updated", `Engagement moved to stage ${suggestedStage}`);
      } else {
        toast.error("Update failed", result.error ?? "Unknown error");
      }
    });
  }

  return (
    <button
      onClick={handleAdvance}
      disabled={isPending}
      className="text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all hover:brightness-110"
      style={{
        background: "rgba(139, 92, 246, 0.12)",
        color: "#a78bfa",
        border: "1px solid rgba(139, 92, 246, 0.25)",
      }}
    >
      {isPending ? "Updating..." : `Advance to Stage ${suggestedStage}`}
    </button>
  );
}
