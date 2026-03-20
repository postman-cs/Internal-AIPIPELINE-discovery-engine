"use client";

import { useState, useTransition } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// Reusable Admin Table
// ═══════════════════════════════════════════════════════════════════════════

interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface AdminTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  onDelete?: (id: string) => Promise<{ success?: boolean; error?: string }>;
  emptyMessage?: string;
}

export function AdminTable<T>({
  columns, rows, getRowId, onDelete, emptyMessage = "No data",
}: AdminTableProps<T>) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (rows.length === 0) {
    return (
      <div className="card text-center py-12">
        <p style={{ color: "var(--foreground-muted)" }}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--border)", background: "rgba(17, 21, 36, 0.6)" }}>
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {columns.map((col) => (
              <th key={col.key} className={`text-left px-4 py-3 ${col.className ?? ""}`}>
                {col.label}
              </th>
            ))}
            {onDelete && <th className="text-right px-4 py-3 w-20">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = getRowId(row);
            return (
              <tr
                key={id}
                className="transition-colors duration-100"
                style={{ borderBottom: "1px solid var(--border)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-sm ${col.className ?? ""}`} style={{ color: "var(--foreground)" }}>
                    {col.render(row)}
                  </td>
                ))}
                {onDelete && (
                  <td className="px-4 py-3 text-right">
                    {deletingId === id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          className="text-xs px-2 py-1 rounded"
                          style={{ background: "rgba(239, 68, 68, 0.15)", color: "#f87171" }}
                          disabled={isPending}
                          onClick={() => {
                            startTransition(async () => {
                              await onDelete(id);
                              setDeletingId(null);
                            });
                          }}
                        >
                          {isPending ? "..." : "Confirm"}
                        </button>
                        <button
                          className="text-xs px-2 py-1 rounded"
                          style={{ color: "var(--foreground-dim)" }}
                          onClick={() => setDeletingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="text-xs px-2 py-1 rounded transition-colors"
                        style={{ color: "var(--foreground-dim)" }}
                        onClick={() => setDeletingId(id)}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-dim)")}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Reusable Admin Form
// ═══════════════════════════════════════════════════════════════════════════

export function AdminFormWrapper({
  title, children, action, state, pending,
}: {
  title: string;
  children: React.ReactNode;
  action: (formData: FormData) => void;
  state?: { error?: string; success?: boolean } | null;
  pending?: boolean;
}) {
  return (
    <div className="card">
      <h3 className="text-base font-semibold mb-4" style={{ color: "var(--foreground)" }}>{title}</h3>
      {state?.error && (
        <div className="text-sm rounded-lg px-3 py-2 mb-4" style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#f87171" }}>
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="text-sm rounded-lg px-3 py-2 mb-4" style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", color: "#34d399" }}>
          Created successfully
        </div>
      )}
      <form action={action} className="space-y-3">
        {children}
        <button type="submit" className="btn-primary text-sm w-full" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </button>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Reusable Form Fields
// ═══════════════════════════════════════════════════════════════════════════

export function FormField({ label, name, type = "text", required, defaultValue, placeholder, options }: {
  label: string; name: string; type?: string; required?: boolean; defaultValue?: string;
  placeholder?: string; options?: Array<{ value: string; label: string }>;
}) {
  if (type === "select" && options) {
    return (
      <div>
        <label htmlFor={name} className="label">{label}</label>
        <select id={name} name={name} className="input-field" defaultValue={defaultValue} required={required}>
          <option value="">Select...</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }
  if (type === "checkbox") {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" name={name} defaultChecked={defaultValue === "true"} className="w-4 h-4 rounded" style={{ accentColor: "var(--accent-purple)" }} />
        <span className="text-sm" style={{ color: "var(--foreground-muted)" }}>{label}</span>
      </label>
    );
  }
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input
        id={name} name={name} type={type} required={required}
        defaultValue={defaultValue} placeholder={placeholder}
        className="input-field"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Badge helper
// ═══════════════════════════════════════════════════════════════════════════

export function StatusBadge({ status, map }: { status: string; map?: Record<string, string> }) {
  const defaultMap: Record<string, string> = {
    PENDING: "badge-warning", VERIFIED: "badge-success", CORRECTED: "badge-info",
    REJECTED: "badge-error", IDENTIFIED: "badge-warning", MAPPED: "badge-info",
    NEUTRALIZED: "badge-success", CRITICAL: "badge-error", HIGH: "badge-error",
    MEDIUM: "badge-warning", LOW: "badge-info",
    PLANNED: "badge-info", READY: "badge-success", IN_PROGRESS: "badge-warning",
    COMPLETED: "badge-success", PAUSED: "badge-warning", SKIPPED: "badge-error",
    active: "badge-success", draft: "badge-info", paused: "badge-warning",
    completed: "badge-success",
    unaware: "badge-error", aware: "badge-warning", evaluating: "badge-info",
    piloting: "badge-warning", adopted: "badge-success", champion: "badge-success",
    none: "badge-info", low: "badge-info", medium: "badge-warning", high: "badge-error",
  };
  const cls = (map ?? defaultMap)[status] ?? "badge-info";
  return <span className={cls}>{status}</span>;
}
