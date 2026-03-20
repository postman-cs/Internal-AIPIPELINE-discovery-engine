"use client";

import { useState, useTransition, useEffect } from "react";
import {
  getPhaseAssumptionCheckpoint,
  confirmAssumption,
  correctAssumptionAction,
  rejectAssumptionAction,
  bulkVerifyPhaseAction,
} from "@/lib/actions/assumptions";
import { useToast } from "@/components/Toast";

interface AssumptionItem {
  id: string;
  category: string;
  claim: string;
  confidence: string;
  status: string;
  humanResponse: string | null;
}

interface InlineAssumptionsProps {
  projectId: string;
  phase: string;
}

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  PENDING: { bg: "rgba(245, 158, 11, 0.08)", border: "rgba(245, 158, 11, 0.2)", text: "#fbbf24" },
  VERIFIED: { bg: "rgba(16, 185, 129, 0.08)", border: "rgba(16, 185, 129, 0.2)", text: "#34d399" },
  CORRECTED: { bg: "rgba(59, 130, 246, 0.08)", border: "rgba(59, 130, 246, 0.2)", text: "#60a5fa" },
  REJECTED: { bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.2)", text: "#f87171" },
  AUTO_VERIFIED: { bg: "rgba(139, 92, 246, 0.08)", border: "rgba(139, 92, 246, 0.2)", text: "#a78bfa" },
};

export function InlineAssumptions({ projectId, phase }: InlineAssumptionsProps) {
  const [assumptions, setAssumptions] = useState<AssumptionItem[]>([]);
  const [gateClear, setGateClear] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [correctionId, setCorrectionId] = useState<string | null>(null);
  const [correctionText, setCorrectionText] = useState("");
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await getPhaseAssumptionCheckpoint(projectId, phase as never);
      if (cancelled || "error" in result) {
        setLoading(false);
        return;
      }
      setAssumptions(
        result.checkpoint.assumptions.map((a) => ({
          id: a.id,
          category: a.category,
          claim: a.claim,
          confidence: a.confidence,
          status: a.status,
          humanResponse: a.humanResponse,
        }))
      );
      setGateClear(result.gate.clear);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [projectId, phase]);

  if (loading) return null;
  if (assumptions.length === 0) return null;

  const pendingCount = assumptions.filter((a) => a.status === "PENDING").length;

  function handleConfirm(id: string) {
    startTransition(async () => {
      const r = await confirmAssumption(id);
      if ("error" in r && r.error) toast.error("Failed", r.error);
      else {
        toast.success("Verified", "Assumption confirmed");
        setAssumptions((prev) => prev.map((a) => a.id === id ? { ...a, status: "VERIFIED" } : a));
      }
    });
  }

  function handleCorrect(id: string) {
    if (!correctionText.trim()) return;
    startTransition(async () => {
      const r = await correctAssumptionAction(id, correctionText);
      setCorrectionId(null);
      setCorrectionText("");
      if ("error" in r && r.error) toast.error("Failed", r.error);
      else {
        toast.success("Corrected", "Downstream phases marked dirty");
        setAssumptions((prev) => prev.map((a) => a.id === id ? { ...a, status: "CORRECTED", humanResponse: correctionText } : a));
      }
    });
  }

  function handleReject(id: string) {
    startTransition(async () => {
      const r = await rejectAssumptionAction(id);
      if ("error" in r && r.error) toast.error("Failed", r.error);
      else {
        toast.success("Rejected", "Assumption rejected");
        setAssumptions((prev) => prev.map((a) => a.id === id ? { ...a, status: "REJECTED" } : a));
      }
    });
  }

  function handleBulkVerify() {
    startTransition(async () => {
      const r = await bulkVerifyPhaseAction(projectId, phase as never);
      if (r.success) {
        toast.success("Bulk verified", `${r.verified} assumptions verified`);
        setAssumptions((prev) => prev.map((a) => a.status === "PENDING" ? { ...a, status: "VERIFIED" } : a));
      } else {
        toast.error("Failed", r.error ?? "Unknown error");
      }
    });
  }

  return (
    <div
      className="rounded-xl p-4 mt-4"
      style={{
        background: gateClear ? "rgba(16, 185, 129, 0.03)" : "rgba(245, 158, 11, 0.03)",
        border: `1px solid ${gateClear ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)"}`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-muted)" }}>
            Assumptions
          </h3>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{
              background: pendingCount > 0 ? "rgba(245, 158, 11, 0.1)" : "rgba(16, 185, 129, 0.1)",
              color: pendingCount > 0 ? "#fbbf24" : "#34d399",
            }}
          >
            {pendingCount > 0 ? `${pendingCount} pending` : "All verified"}
          </span>
        </div>
        {pendingCount > 0 && (
          <button
            className="text-[10px] px-2.5 py-1 rounded-lg transition-all"
            style={{ background: "rgba(6, 214, 214, 0.08)", color: "var(--accent-cyan)", border: "1px solid rgba(6, 214, 214, 0.15)" }}
            onClick={handleBulkVerify}
            disabled={isPending}
          >
            Verify All ({pendingCount})
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {assumptions.map((a) => {
          const style = STATUS_STYLES[a.status] ?? STATUS_STYLES.PENDING;
          const isCorrecting = correctionId === a.id;

          return (
            <div key={a.id}>
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2"
                style={{ background: style.bg, border: `1px solid ${style.border}` }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: style.text }}
                />
                <p className="text-xs flex-1 min-w-0 truncate" style={{ color: "var(--foreground)" }}>
                  {a.claim}
                </p>
                <span className="text-[9px] uppercase font-semibold shrink-0" style={{ color: style.text }}>
                  {a.status.replace("_", " ")}
                </span>

                {a.status === "PENDING" && (
                  <div className="flex gap-1 shrink-0 ml-1">
                    <button
                      onClick={() => handleConfirm(a.id)}
                      disabled={isPending}
                      className="text-[10px] px-1.5 py-0.5 rounded transition-all"
                      style={{ background: "rgba(16,185,129,0.15)", color: "#34d399" }}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => { setCorrectionId(isCorrecting ? null : a.id); setCorrectionText(""); }}
                      disabled={isPending}
                      className="text-[10px] px-1.5 py-0.5 rounded transition-all"
                      style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleReject(a.id)}
                      disabled={isPending}
                      className="text-[10px] px-1.5 py-0.5 rounded transition-all"
                      style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {isCorrecting && (
                <div className="mt-1 ml-4 flex gap-2">
                  <input
                    className="input-field text-xs flex-1"
                    placeholder="Provide the correct answer..."
                    value={correctionText}
                    onChange={(e) => setCorrectionText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCorrect(a.id); }}
                  />
                  <button
                    className="btn-cyan text-[10px] px-2"
                    disabled={!correctionText.trim() || isPending}
                    onClick={() => handleCorrect(a.id)}
                  >
                    Submit
                  </button>
                  <button
                    className="btn-ghost text-[10px] px-2"
                    onClick={() => { setCorrectionId(null); setCorrectionText(""); }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
