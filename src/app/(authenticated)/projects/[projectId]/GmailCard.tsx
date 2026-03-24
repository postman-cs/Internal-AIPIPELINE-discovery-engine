"use client";

import { useState, useTransition } from "react";
import {
  syncProjectGmail,
  setupGmailForProject,
  removeGmailFromProject,
} from "@/lib/actions/gmail-sync";

interface GmailCardProps {
  projectId: string;
  googleConnected: boolean;
  googleEmail: string | null;
  gmailConfigured: boolean;
  lastSyncAt: string | null; // ISO string from server
  projectDomain: string | null;
}

export function GmailCard({
  projectId,
  googleConnected,
  googleEmail,
  gmailConfigured,
  lastSyncAt,
  projectDomain,
}: GmailCardProps) {
  const [isPending, startTransition] = useTransition();
  const [syncResult, setSyncResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleSync = () => {
    setSyncResult(null);
    startTransition(async () => {
      const result = await syncProjectGmail(projectId);
      if (result.success) {
        setSyncResult({
          type: "success",
          message: `Synced ${result.synced} email${result.synced !== 1 ? "s" : ""}${result.skipped ? `, ${result.skipped} skipped` : ""}`,
        });
      } else {
        setSyncResult({ type: "error", message: result.error || "Sync failed" });
      }
    });
  };

  const handleSetup = () => {
    setSyncResult(null);
    startTransition(async () => {
      const result = await setupGmailForProject(projectId);
      if (result.success) {
        setSyncResult({
          type: "success",
          message: `Gmail filter created: ${result.labelName}`,
        });
      } else {
        setSyncResult({ type: "error", message: result.error || "Setup failed" });
      }
    });
  };

  const handleRemove = () => {
    if (!confirm("Remove Gmail integration? The label and filter will be deleted from your Gmail.")) return;
    setSyncResult(null);
    startTransition(async () => {
      const result = await removeGmailFromProject(projectId);
      if (result.success) {
        setSyncResult({ type: "success", message: "Gmail integration removed" });
      } else {
        setSyncResult({ type: "error", message: result.error || "Failed to remove" });
      }
    });
  };

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(239, 68, 68, 0.08)" }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          Gmail Integration
        </h2>
      </div>

      {/* Feedback */}
      {syncResult && (
        <div
          className="text-xs rounded-lg px-3 py-2 mb-3"
          style={{
            background: syncResult.type === "success" ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
            border: `1px solid ${syncResult.type === "success" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}`,
            color: syncResult.type === "success" ? "#34d399" : "#f87171",
          }}
        >
          {syncResult.message}
        </div>
      )}

      {/* State: Google not connected */}
      {!googleConnected && (
        <div className="space-y-3">
          <p className="text-sm" style={{ color: "var(--foreground-dim)" }}>
            Connect your Google account to automatically create Gmail filters and sync customer emails into the evidence pipeline.
          </p>
          <a
            href="/api/auth/google"
            className="btn-primary text-sm inline-flex items-center gap-2 py-2 px-4"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Connect Google Account
          </a>
        </div>
      )}

      {/* State: Google connected but Gmail not configured for this project */}
      {googleConnected && !gmailConfigured && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--foreground-dim)" }}>
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            Connected as <span className="font-medium" style={{ color: "var(--foreground)" }}>{googleEmail}</span>
          </div>
          {projectDomain ? (
            <>
              <p className="text-sm" style={{ color: "var(--foreground-dim)" }}>
                Create a Gmail label and filter to capture emails from <span className="font-medium" style={{ color: "var(--foreground)" }}>@{projectDomain}</span>
              </p>
              <button
                onClick={handleSetup}
                disabled={isPending}
                className="btn-primary text-sm py-2 px-4"
              >
                {isPending ? "Setting up..." : "Create Gmail Filter"}
              </button>
            </>
          ) : (
            <p className="text-sm" style={{ color: "var(--foreground-dim)" }}>
              Add a <span className="font-medium">Primary Domain</span> to this project to enable automatic Gmail filtering.
            </p>
          )}
        </div>
      )}

      {/* State: Gmail fully configured */}
      {googleConnected && gmailConfigured && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--foreground-dim)" }}>
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            Connected as <span className="font-medium" style={{ color: "var(--foreground)" }}>{googleEmail}</span>
          </div>

          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
            style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.1)" }}
          >
            <svg className="w-4 h-4 shrink-0" style={{ color: "#34d399" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                Gmail filter active
              </p>
              <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
                Emails from @{projectDomain} are being labeled automatically
              </p>
            </div>
          </div>

          {lastSyncAt && (
            <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
              Last synced: {new Date(lastSyncAt).toLocaleString()}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSync}
              disabled={isPending}
              className="btn-primary text-sm py-2 px-4 flex-1"
            >
              {isPending ? "Syncing..." : "Sync Now"}
            </button>
            <button
              onClick={handleRemove}
              disabled={isPending}
              className="btn-ghost text-sm py-2 px-3 text-red-400 hover:text-red-300"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
