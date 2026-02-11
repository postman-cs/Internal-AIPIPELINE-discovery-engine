"use client";

import { useState, useTransition } from "react";
import { runIngestAction } from "@/lib/actions/ingest";

export function IngestActions({ connectedCount }: { connectedCount: number }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const handleSyncAll = () => {
    startTransition(async () => {
      setMessage(null);
      const result = await runIngestAction();
      if (result.success) {
        setMessage(`Synced ${result.itemCount} items`);
        setTimeout(() => setMessage(null), 4000);
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      {message && (
        <span className="text-sm font-medium" style={{ color: "var(--accent-green)" }}>
          {message}
        </span>
      )}
      <button
        onClick={handleSyncAll}
        disabled={isPending}
        className="btn-primary text-sm disabled:opacity-50"
      >
        {isPending
          ? "Syncing..."
          : connectedCount > 0
          ? `Sync All (${connectedCount} sources)`
          : "Run Demo Ingest"}
      </button>
    </div>
  );
}
