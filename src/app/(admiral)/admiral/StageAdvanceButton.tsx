"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { advanceEngagementStage, assignAndAdvanceProject } from "@/lib/actions/admin";

type CseOption = { id: string; name: string };

export function StageAdvanceButton({
  projectId,
  currentStage,
  isUnassigned,
  cseUsers,
}: {
  projectId: string;
  currentStage: number;
  isUnassigned?: boolean;
  cseUsers?: CseOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPicker]);

  if (currentStage >= 6) return null;

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (isUnassigned && cseUsers?.length) {
      setShowPicker(true);
      return;
    }

    startTransition(async () => {
      const result = await advanceEngagementStage(projectId);
      if (result && "needsAssignment" in result && result.needsAssignment && cseUsers?.length) {
        setShowPicker(true);
      }
    });
  }

  function handleAssignAndAdvance(cseId: string) {
    setShowPicker(false);
    startTransition(async () => {
      await assignAndAdvanceProject(projectId, cseId);
    });
  }

  return (
    <div className="relative" ref={pickerRef}>
      <button
        onClick={handleClick}
        disabled={isPending}
        title={isUnassigned ? "Assign CSE & advance" : `Advance to S${currentStage + 1}`}
        className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-[10px] transition-all"
        style={{
          background: isPending
            ? "rgba(255,255,255,0.05)"
            : isUnassigned
              ? "rgba(245,158,11,0.1)"
              : "rgba(34, 197, 94, 0.1)",
          color: isPending
            ? "var(--foreground-dim)"
            : isUnassigned
              ? "#f59e0b"
              : "#22c55e",
          border: `1px solid ${isUnassigned ? "rgba(245,158,11,0.2)" : "rgba(34, 197, 94, 0.2)"}`,
        }}
      >
        {isPending ? "…" : "↑"}
      </button>

      {showPicker && cseUsers && cseUsers.length > 0 && (
        <div
          className="absolute right-0 top-7 z-50 rounded-lg shadow-xl p-2 min-w-[200px]"
          style={{
            background: "var(--background-secondary, #1a1a2e)",
            border: "1px solid var(--border)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <p
            className="text-[10px] font-semibold px-2 py-1 mb-1"
            style={{ color: "#f59e0b" }}
          >
            Assign a CSE to advance
          </p>
          {cseUsers.map((u) => (
            <button
              key={u.id}
              onClick={() => handleAssignAndAdvance(u.id)}
              disabled={isPending}
              className="w-full text-left text-xs px-2 py-1.5 rounded transition-colors hover:bg-white/5"
              style={{ color: "var(--foreground)" }}
            >
              {u.name}
            </button>
          ))}
          <button
            onClick={() => setShowPicker(false)}
            className="w-full text-[10px] text-center mt-1 py-1 rounded transition-colors hover:bg-white/5"
            style={{ color: "var(--foreground-dim)" }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
