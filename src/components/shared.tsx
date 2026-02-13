"use client";

import { useState, type ReactNode } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// StatPill — shared stat display component
// ═══════════════════════════════════════════════════════════════════════════

export function StatPill({
  value,
  label,
  color,
  className = "",
}: {
  value: number | string;
  label: string;
  color: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-4 py-3 ${className}`}
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <span className="text-xl font-bold tabular-nums" style={{ color }}>
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wider leading-tight" style={{ color: "var(--foreground-dim)" }}>
        {label}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// StatusBadge — shared status badge
// ═══════════════════════════════════════════════════════════════════════════

const STATUS_BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  CLEAN: { bg: "rgba(16,185,129,0.1)", text: "#34d399" },
  DIRTY: { bg: "rgba(245,158,11,0.1)", text: "#fbbf24" },
  STALE: { bg: "rgba(255,255,255,0.04)", text: "var(--foreground-dim)" },
  NEEDS_REVIEW: { bg: "rgba(59,130,246,0.1)", text: "#60a5fa" },
  PENDING: { bg: "rgba(245,158,11,0.08)", text: "#fbbf24" },
  VERIFIED: { bg: "rgba(16,185,129,0.08)", text: "#34d399" },
  CORRECTED: { bg: "rgba(59,130,246,0.08)", text: "#60a5fa" },
  REJECTED: { bg: "rgba(239,68,68,0.08)", text: "#f87171" },
  AUTO_VERIFIED: { bg: "rgba(139,92,246,0.08)", text: "#a78bfa" },
  ACCEPTED: { bg: "rgba(16,185,129,0.1)", text: "#34d399" },
  SUCCESS: { bg: "rgba(16,185,129,0.1)", text: "#34d399" },
  FAILED: { bg: "rgba(239,68,68,0.1)", text: "#f87171" },
  RUNNING: { bg: "rgba(59,130,246,0.1)", text: "#60a5fa" },
  IDENTIFIED: { bg: "rgba(245,158,11,0.08)", text: "#fbbf24" },
  MAPPED: { bg: "rgba(59,130,246,0.08)", text: "#60a5fa" },
  NEUTRALIZED: { bg: "rgba(16,185,129,0.08)", text: "#34d399" },
  DORMANT: { bg: "rgba(255,255,255,0.04)", text: "var(--foreground-dim)" },
  CRITICAL: { bg: "rgba(239,68,68,0.08)", text: "#ef4444" },
  HIGH: { bg: "rgba(245,158,11,0.08)", text: "#f59e0b" },
  MEDIUM: { bg: "rgba(59,130,246,0.08)", text: "#3b82f6" },
  LOW: { bg: "rgba(255,255,255,0.04)", text: "var(--foreground-dim)" },
};

export function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  const style = STATUS_BADGE_STYLES[status] ?? { bg: "rgba(255,255,255,0.04)", text: "var(--foreground-dim)" };
  return (
    <span
      className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${className}`}
      style={{ background: style.bg, color: style.text }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// formatPhase — shared phase name formatter
// ═══════════════════════════════════════════════════════════════════════════

export function formatPhase(phase: string): string {
  return phase
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ═══════════════════════════════════════════════════════════════════════════
// ConfirmDialog — reusable confirmation dialog
// ═══════════════════════════════════════════════════════════════════════════

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const btnColors = {
    danger: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.3)", text: "#f87171" },
    warning: { bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.3)", text: "#fbbf24" },
    default: { bg: "rgba(6,214,214,0.1)", border: "rgba(6,214,214,0.2)", text: "var(--accent-cyan)" },
  };
  const colors = btnColors[variant];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onCancel} />
      <div
        className="relative w-full max-w-sm rounded-xl p-5 animate-in shadow-2xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border-bright)" }}
      >
        <h3 id="confirm-title" className="text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
          {title}
        </h3>
        <p className="text-xs mb-5" style={{ color: "var(--foreground-muted)" }}>
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="text-xs px-4 py-2 rounded-lg transition-all"
            style={{ background: "rgba(255,255,255,0.04)", color: "var(--foreground-muted)", border: "1px solid var(--border)" }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="text-xs px-4 py-2 rounded-lg transition-all font-medium"
            style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// useConfirm — hook for easy confirmation dialogs
// ═══════════════════════════════════════════════════════════════════════════

export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    variant: "danger" | "warning" | "default";
    resolve: ((confirmed: boolean) => void) | null;
  }>({ open: false, title: "", message: "", confirmLabel: "Confirm", variant: "danger", resolve: null });

  function confirm(opts: { title: string; message: string; confirmLabel?: string; variant?: "danger" | "warning" | "default" }): Promise<boolean> {
    return new Promise((resolve) => {
      setState({ open: true, title: opts.title, message: opts.message, confirmLabel: opts.confirmLabel ?? "Confirm", variant: opts.variant ?? "danger", resolve });
    });
  }

  function Dialog() {
    return (
      <ConfirmDialog
        open={state.open}
        title={state.title}
        message={state.message}
        confirmLabel={state.confirmLabel}
        variant={state.variant}
        onConfirm={() => { state.resolve?.(true); setState((s) => ({ ...s, open: false })); }}
        onCancel={() => { state.resolve?.(false); setState((s) => ({ ...s, open: false })); }}
      />
    );
  }

  return { confirm, ConfirmDialog: Dialog };
}

// ═══════════════════════════════════════════════════════════════════════════
// EmptyState — consistent empty state component
// ═══════════════════════════════════════════════════════════════════════════

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card text-center py-16">
      {icon && <div className="text-3xl mb-3" style={{ color: "var(--foreground-dim)" }}>{icon}</div>}
      <p className="text-sm font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>{title}</p>
      {description && <p className="text-xs mb-4" style={{ color: "var(--foreground-dim)" }}>{description}</p>}
      {action}
    </div>
  );
}
