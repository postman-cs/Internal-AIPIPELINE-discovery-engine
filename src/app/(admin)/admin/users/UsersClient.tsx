"use client";

import { useActionState } from "react";
import { createUser, deleteUser } from "@/lib/actions/admin";
import { AdminTable, AdminFormWrapper, FormField, StatusBadge } from "../AdminTable";

type UserRow = {
  id: string; email: string; name: string; isAdmin: boolean;
  createdAt: Date; updatedAt: Date;
  _count: { projects: number; ingestRuns: number };
};

export function UsersClient({ users }: { users: UserRow[] }) {
  const [state, action, pending] = useActionState(createUser, null);

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>Users</h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>{users.length} total users</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AdminTable
            columns={[
              { key: "name", label: "Name", render: (r) => (
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>{r.email}</p>
                </div>
              )},
              { key: "role", label: "Role", render: (r) => r.isAdmin ? <StatusBadge status="Admin" map={{ Admin: "badge-info" }} /> : <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>User</span> },
              { key: "projects", label: "Projects", render: (r) => r._count.projects },
              { key: "runs", label: "Ingest Runs", render: (r) => r._count.ingestRuns },
              { key: "created", label: "Created", render: (r) => (
                <span className="text-xs" style={{ color: "var(--foreground-dim)" }}>{r.createdAt.toLocaleDateString()}</span>
              )},
            ]}
            rows={users}
            getRowId={(r) => r.id}
            onDelete={deleteUser}
            emptyMessage="No users yet"
          />
        </div>

        <div>
          <AdminFormWrapper title="Create User" action={action} state={state} pending={pending}>
            <FormField label="Name" name="name" required placeholder="John Doe" />
            <FormField label="Email" name="email" type="email" required placeholder="user@postman.com" />
            <FormField label="Password" name="password" type="password" required placeholder="Min 6 characters" />
            <FormField label="Admin" name="isAdmin" type="checkbox" />
          </AdminFormWrapper>
        </div>
      </div>
    </>
  );
}
