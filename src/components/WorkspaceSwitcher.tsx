"use client";
import { useState, useEffect } from "react";
import { getMyWorkspaces } from "@/lib/actions/workspaces";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export function WorkspaceSwitcher({ currentWorkspaceId }: { currentWorkspaceId?: string }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getMyWorkspaces().then(setWorkspaces).catch(() => {});
  }, []);

  if (workspaces.length <= 1) return null;

  const current = workspaces.find((w) => w.id === currentWorkspaceId) || workspaces[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all"
        style={{ background: "rgba(255,255,255,0.05)", color: "var(--foreground-dim)", border: "1px solid var(--border)" }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-green)" }} />
        {current?.name || "Default"}
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute top-full mt-1 left-0 z-50 rounded-lg overflow-hidden shadow-xl"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", minWidth: 180 }}
        >
          {workspaces.map((w) => (
            <button
              key={w.id}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-all hover:brightness-110"
              style={{
                background: w.id === current?.id ? "rgba(6,214,214,0.06)" : "transparent",
                color: w.id === current?.id ? "var(--accent-cyan)" : "var(--foreground)",
              }}
              onClick={() => setOpen(false)}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: w.id === current?.id ? "var(--accent-cyan)" : "var(--foreground-dim)" }} />
              {w.name}
              <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--foreground-dim)" }}>{w.role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
