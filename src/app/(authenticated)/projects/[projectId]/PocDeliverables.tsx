"use client";

import { useState, useTransition, useCallback } from "react";
import type { PocDeliverable } from "@/lib/poc-deliverables-types";
import { DEFAULT_POC_DELIVERABLES } from "@/lib/poc-deliverables-types";
import {
  togglePocDeliverable,
  updatePocDeliverableNotes,
  initPocDeliverables,
} from "@/lib/actions/poc-deliverables";

const POSTMAN_ORANGE = "#FF6C37";

interface Props {
  projectId: string;
  initialDeliverables: PocDeliverable[] | null;
}

export function PocDeliverablesTracker({
  projectId,
  initialDeliverables,
}: Props) {
  const [deliverables, setDeliverables] = useState<PocDeliverable[] | null>(
    initialDeliverables,
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [xpToast, setXpToast] = useState<string | null>(null);

  const handleInit = useCallback(() => {
    startTransition(async () => {
      const res = await initPocDeliverables(projectId);
      if (res.success) {
        setDeliverables([...DEFAULT_POC_DELIVERABLES]);
      }
    });
  }, [projectId]);

  const handleToggle = useCallback(
    (id: string, completed: boolean) => {
      setDeliverables(
        (prev) =>
          prev?.map((d) =>
            d.id === id
              ? {
                  ...d,
                  completed,
                  completedAt: completed ? new Date().toISOString() : null,
                }
              : d,
          ) ?? null,
      );

      if (completed) {
        const title = deliverables?.find((d) => d.id === id)?.title ?? "";
        setXpToast(`+75 XP — ${title}`);
        setTimeout(() => setXpToast(null), 3000);
      }

      startTransition(async () => {
        await togglePocDeliverable(projectId, id, completed);
      });
    },
    [projectId, deliverables],
  );

  const handleSaveNotes = useCallback(
    (id: string, notes: string, evidenceUrl: string) => {
      setDeliverables(
        (prev) =>
          prev?.map((d) =>
            d.id === id ? { ...d, notes, evidenceUrl } : d,
          ) ?? null,
      );

      startTransition(async () => {
        await updatePocDeliverableNotes(
          projectId,
          id,
          notes,
          evidenceUrl || undefined,
        );
      });
    },
    [projectId],
  );

  if (!deliverables) {
    return (
      <div
        className="rounded-xl p-5 mb-6"
        style={{
          background: `linear-gradient(135deg, ${POSTMAN_ORANGE}06, rgba(139,92,246,0.04))`,
          border: `1px solid ${POSTMAN_ORANGE}20`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${POSTMAN_ORANGE}12` }}
            >
              <svg
                className="w-5 h-5"
                style={{ color: POSTMAN_ORANGE }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                POC Deliverables
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--foreground-dim)" }}
              >
                Track the four key outputs your customer needs from this
                engagement
              </p>
            </div>
          </div>
          <button
            onClick={handleInit}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:brightness-110"
            style={{
              background: POSTMAN_ORANGE,
              color: "#fff",
            }}
          >
            Initialize Deliverables
          </button>
        </div>
      </div>
    );
  }

  const completedCount = deliverables.filter((d) => d.completed).length;
  const totalCount = deliverables.length;
  const pct = Math.round((completedCount / totalCount) * 100);
  const allDone = completedCount === totalCount;

  return (
    <div
      className="rounded-xl p-5 mb-6 relative"
      style={{
        background: "var(--surface)",
        border: `1px solid ${allDone ? "rgba(16,185,129,0.3)" : "var(--border)"}`,
      }}
    >
      {/* XP toast */}
      {xpToast && (
        <div
          className="absolute top-3 right-3 px-3 py-1.5 rounded-lg text-xs font-bold animate-bounce z-10"
          style={{
            background: "rgba(34,197,94,0.15)",
            color: "#22c55e",
            border: "1px solid rgba(34,197,94,0.3)",
          }}
        >
          {xpToast}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: allDone
                ? "rgba(16,185,129,0.12)"
                : `${POSTMAN_ORANGE}10`,
            }}
          >
            {allDone ? (
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="#34d399"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                style={{ color: POSTMAN_ORANGE }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75"
                />
              </svg>
            )}
          </div>
          <div>
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              POC Deliverables
            </h3>
            <p
              className="text-[10px]"
              style={{ color: "var(--foreground-dim)" }}
            >
              {allDone
                ? "All deliverables complete — ready for customer handoff"
                : `${completedCount}/${totalCount} complete — 75 XP per deliverable`}
            </p>
          </div>
        </div>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            background: allDone
              ? "rgba(16,185,129,0.1)"
              : "rgba(255,255,255,0.04)",
            color: allDone ? "#34d399" : "var(--foreground-dim)",
            border: `1px solid ${allDone ? "rgba(16,185,129,0.2)" : "var(--border)"}`,
          }}
        >
          {pct}%
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-2 rounded-full mb-5 overflow-hidden"
        style={{ background: "rgba(255,255,255,0.04)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: allDone
              ? "linear-gradient(to right, #10b981, #34d399)"
              : `linear-gradient(to right, ${POSTMAN_ORANGE}, ${POSTMAN_ORANGE}cc)`,
          }}
        />
      </div>

      {/* Deliverable items */}
      <div className="space-y-2">
        {deliverables.map((d) => {
          const isExpanded = expandedId === d.id;
          return (
            <div
              key={d.id}
              className="rounded-lg transition-all"
              style={{
                background: d.completed
                  ? "rgba(16,185,129,0.04)"
                  : "rgba(255,255,255,0.02)",
                border: `1px solid ${d.completed ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <div className="flex items-start gap-3 p-3">
                <button
                  onClick={() => handleToggle(d.id, !d.completed)}
                  className="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all"
                  style={{
                    background: d.completed
                      ? "rgba(16,185,129,0.15)"
                      : "rgba(255,255,255,0.03)",
                    border: `1.5px solid ${d.completed ? "#34d399" : "rgba(255,255,255,0.12)"}`,
                  }}
                >
                  {d.completed && (
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="#34d399"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium"
                    style={{
                      color: d.completed
                        ? "#34d399"
                        : "var(--foreground)",
                      textDecorationLine: d.completed
                        ? "line-through"
                        : "none",
                      opacity: d.completed ? 0.85 : 1,
                    }}
                  >
                    {d.title}
                  </p>
                  <p
                    className="text-[11px] mt-0.5"
                    style={{ color: "var(--foreground-dim)" }}
                  >
                    {d.description}
                  </p>
                  {d.notes && !isExpanded && (
                    <p
                      className="text-[10px] mt-1 truncate"
                      style={{ color: "var(--foreground-muted)" }}
                    >
                      Note: {d.notes}
                    </p>
                  )}
                </div>

                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : d.id)
                  }
                  className="mt-0.5 p-1 rounded transition-colors"
                  style={{ color: "var(--foreground-dim)" }}
                  title={isExpanded ? "Collapse" : "Add notes / evidence"}
                >
                  <svg
                    className="w-4 h-4 transition-transform"
                    style={{
                      transform: isExpanded
                        ? "rotate(180deg)"
                        : "rotate(0deg)",
                    }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </div>

              {isExpanded && (
                <DeliverableDetails
                  deliverable={d}
                  onSave={(notes, evidenceUrl) =>
                    handleSaveNotes(d.id, notes, evidenceUrl)
                  }
                />
              )}
            </div>
          );
        })}
      </div>

      {allDone && (
        <div
          className="mt-4 pt-3 text-center"
          style={{ borderTop: "1px solid rgba(16,185,129,0.15)" }}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: "#34d399" }}
          >
            All POC Deliverables Complete
          </p>
          <p
            className="text-[10px] mt-1"
            style={{ color: "var(--foreground-dim)" }}
          >
            Customer has everything needed to present integration
            internally and move to production rollout.
          </p>
        </div>
      )}
    </div>
  );
}

function DeliverableDetails({
  deliverable,
  onSave,
}: {
  deliverable: PocDeliverable;
  onSave: (notes: string, evidenceUrl: string) => void;
}) {
  const [notes, setNotes] = useState(deliverable.notes ?? "");
  const [evidenceUrl, setEvidenceUrl] = useState(
    deliverable.evidenceUrl ?? "",
  );

  return (
    <div
      className="px-3 pb-3 pt-1 space-y-2"
      style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
    >
      <div>
        <label
          className="text-[10px] font-medium block mb-1"
          style={{ color: "var(--foreground-dim)" }}
        >
          Evidence URL (PR, workspace link, etc.)
        </label>
        <input
          type="url"
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
          placeholder="https://github.com/org/repo/pull/1"
          className="w-full px-3 py-1.5 rounded-lg text-xs"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--foreground)",
          }}
        />
      </div>
      <div>
        <label
          className="text-[10px] font-medium block mb-1"
          style={{ color: "var(--foreground-dim)" }}
        >
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Implementation details, customer feedback, blockers..."
          rows={2}
          className="w-full px-3 py-1.5 rounded-lg text-xs resize-none"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--foreground)",
          }}
        />
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => onSave(notes, evidenceUrl)}
          className="px-3 py-1 rounded-md text-[11px] font-medium transition-all hover:brightness-110"
          style={{
            background: `${POSTMAN_ORANGE}15`,
            color: POSTMAN_ORANGE,
            border: `1px solid ${POSTMAN_ORANGE}30`,
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
