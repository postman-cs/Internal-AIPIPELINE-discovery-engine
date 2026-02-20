"use client";

import { useState, useTransition } from "react";
import { disconnectSource } from "@/lib/actions/ingest";

interface GmailConnectBannerProps {
  isConnected: boolean;
  googleEmail: string | null;
  oauthConfigured: boolean;
}

export function GmailConnectBanner({
  isConnected,
  googleEmail,
  oauthConfigured,
}: GmailConnectBannerProps) {
  const [isPending, startTransition] = useTransition();
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  if (!oauthConfigured) {
    return (
      <div
        className="rounded-xl p-4 mb-6"
        style={{
          background: "rgba(245,158,11,0.05)",
          border: "1px solid rgba(245,158,11,0.15)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-xl shrink-0">
            {"\u26A0\uFE0F"}
          </div>
          <div>
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              Gmail Integration Not Configured
            </h3>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--foreground-dim)" }}
            >
              Set <code>GOOGLE_CLIENT_ID</code> and{" "}
              <code>GOOGLE_CLIENT_SECRET</code> in your{" "}
              <code>.env</code> file, then restart the server.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div
        className="rounded-xl p-4 mb-6"
        style={{
          background: "rgba(16,185,129,0.05)",
          border: "1px solid rgba(16,185,129,0.15)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-950/30 flex items-center justify-center shrink-0">
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h3
                className="text-sm font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                Gmail Connected
              </h3>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--foreground-dim)" }}
              >
                Signed in as{" "}
                <span style={{ color: "#34d399" }} className="font-medium">
                  {googleEmail}
                </span>
                . Gmail will ingest real threads when you click Sync on the Gmail
                source card.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {showDisconnectConfirm ? (
              <>
                <span
                  className="text-xs"
                  style={{ color: "var(--foreground-dim)" }}
                >
                  Disconnect?
                </span>
                <button
                  onClick={() => {
                    startTransition(async () => {
                      await disconnectSource("GMAIL");
                      await fetch("/api/auth/google/disconnect", {
                        method: "POST",
                      });
                      window.location.reload();
                    });
                  }}
                  disabled={isPending}
                  className="btn-ghost text-xs"
                  style={{ color: "var(--accent-red)" }}
                >
                  {isPending ? "..." : "Yes"}
                </button>
                <button
                  onClick={() => setShowDisconnectConfirm(false)}
                  className="btn-ghost text-xs"
                >
                  No
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowDisconnectConfirm(true)}
                className="btn-ghost text-xs"
                style={{ color: "var(--foreground-dim)" }}
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-4 mb-6"
      style={{
        background: "rgba(6, 214, 214, 0.04)",
        border: "1px solid rgba(6, 214, 214, 0.1)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-xl shrink-0">
            {"\uD83D\uDCE7"}
          </div>
          <div>
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              Connect Gmail for Real Email Ingest
            </h3>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--foreground-dim)" }}
            >
              Link your Google account to automatically pull email threads and
              attachments from customer domains into the pipeline.
            </p>
          </div>
        </div>
        <a
          href="/api/auth/google"
          className="btn-primary text-sm whitespace-nowrap shrink-0"
        >
          Connect Gmail
        </a>
      </div>
    </div>
  );
}
