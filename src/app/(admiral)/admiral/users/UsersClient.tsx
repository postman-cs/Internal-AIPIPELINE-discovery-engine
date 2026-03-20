"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { createUser, deleteCseAndReassign } from "@/lib/actions/admin";
import { AdminFormWrapper, FormField, StatusBadge } from "../AdminTable";

type UserRow = {
  id: string; email: string; name: string; isAdmin: boolean; role: string;
  createdAt: Date; updatedAt: Date;
  _count: { projects: number; ingestRuns: number };
};

export function UsersClient({ users }: { users: UserRow[] }) {
  const [state, action, pending] = useActionState(createUser, null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [reassignTo, setReassignTo] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const cses = users.filter((u) => u.role === "CSE");

  function handleDelete(targetId?: string) {
    if (!deleting) return;
    const target = targetId || reassignTo || undefined;
    if (deleting._count.projects > 0 && !target) return;
    setError("");
    startTransition(async () => {
      const res = await deleteCseAndReassign(deleting.id, target);
      if (res?.error) {
        setError(res.error);
      } else {
        setDeleting(null);
        setReassignTo("");
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>CSE Roster</h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>{users.length} total crew members</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Role</th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Projects</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <Link href={`/admiral/cse/${r.id}`} className="font-medium hover:underline" style={{ color: "var(--foreground)" }}>
                        {r.name}
                      </Link>
                      <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>{r.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {(r.role === "ADMIRAL" || r.role === "ADMIN")
                        ? <StatusBadge status="Admin" map={{ Admin: "badge-info" }} />
                        : <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>CSE</span>}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--foreground)" }}>{r._count.projects}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {r.role === "CSE" && (
                          <Link href={`/admiral/cse/${r.id}`}
                            className="text-xs px-2.5 py-1 rounded transition-colors"
                            style={{ background: "rgba(201,162,39,0.08)", color: "#c9a227", border: "1px solid rgba(201,162,39,0.15)" }}>
                            Manage
                          </Link>
                        )}
                        {r.role === "CSE" && (
                          <button
                            onClick={() => { setDeleting(r); setReassignTo(""); setError(""); }}
                            className="text-xs px-2 py-1 rounded transition-colors"
                            style={{ color: "#ef4444", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}>
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-sm" style={{ color: "var(--foreground-dim)" }}>No crew members yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <AdminFormWrapper title="Add Crew Member" action={action} state={state} pending={pending}>
            <FormField label="Name" name="name" required placeholder="John Doe" />
            <FormField label="Email" name="email" type="email" required placeholder="user@postman.com" />
            <FormField label="Password" name="password" type="password" required placeholder="Min 6 characters" />
            <FormField label="Role" name="role" type="select" options={[
              { value: "CSE", label: "CSE" },
              { value: "ADMIN", label: "Admin" },
            ]} />
          </AdminFormWrapper>
        </div>
      </div>

      {/* Delete + Reassign Modal */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="rounded-lg p-6 w-full max-w-md" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
            <h3 className="text-lg font-bold mb-1" style={{ color: "var(--foreground)" }}>Remove {deleting.name}</h3>
            <p className="text-sm mb-4" style={{ color: "var(--foreground-dim)" }}>
              {deleting._count.projects > 0
                ? `${deleting.name} has ${deleting._count.projects} project${deleting._count.projects !== 1 ? "s" : ""}. Choose a CSE to reassign them to before removal.`
                : `${deleting.name} has no projects. They will be removed from the roster.`}
            </p>

            {deleting._count.projects > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--foreground-dim)" }}>
                  Reassign projects to
                </label>
                <select
                  value={reassignTo}
                  onChange={(e) => setReassignTo(e.target.value)}
                  className="w-full text-sm rounded px-3 py-2"
                  style={{ background: "var(--background-secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                >
                  <option value="">Select a CSE…</option>
                  {cses.filter((c) => c.id !== deleting.id).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c._count.projects} projects)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <p className="text-xs mb-3 px-3 py-2 rounded" style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>{error}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setDeleting(null); setError(""); }}
                className="text-sm px-4 py-2 rounded"
                style={{ color: "var(--foreground-dim)", border: "1px solid var(--border)" }}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete()}
                disabled={isPending || (deleting._count.projects > 0 && !reassignTo)}
                className="text-sm px-4 py-2 rounded font-medium disabled:opacity-40"
                style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                {isPending ? "Removing…" : `Remove ${deleting.name}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
