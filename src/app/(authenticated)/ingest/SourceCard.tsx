"use client";

import { useState, useTransition } from "react";
import type { SourceMeta, SourceConfigField } from "@/lib/ingest-sources";
import {
  connectSource,
  disconnectSource,
  updateSourceConfig,
  runSingleSourceIngest,
} from "@/lib/actions/ingest";
import type { SourceKey } from "@/lib/ingest-sources";

interface SourceConfig {
  id: string;
  source: string;
  enabled: boolean;
  configJson: string | null;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastSyncItemCount: number | null;
}

interface SourceCardProps {
  meta: SourceMeta;
  config: SourceConfig | null;
  stats: { total: number; unconsumed: number } | null;
}

export function SourceCard({ meta, config, stats }: SourceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>(() => {
    if (config?.configJson) {
      try { return JSON.parse(config.configJson); } catch { return {}; }
    }
    return {};
  });

  const isConnected = config?.enabled === true;

  const flashMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleConnect = () => {
    startTransition(async () => {
      const configStr = Object.keys(configValues).length > 0 ? JSON.stringify(configValues) : undefined;
      await connectSource(meta.key, configStr);
      flashMessage("Connected!");
      setIsConfiguring(false);
    });
  };

  const handleDisconnect = () => {
    startTransition(async () => {
      await disconnectSource(meta.key);
      flashMessage("Disconnected");
    });
  };

  const handleSaveConfig = () => {
    startTransition(async () => {
      await updateSourceConfig(meta.key, JSON.stringify(configValues));
      flashMessage("Settings saved");
      setIsConfiguring(false);
    });
  };

  const handleSync = () => {
    startTransition(async () => {
      const result = await runSingleSourceIngest(meta.key as SourceKey);
      if (result.success) flashMessage(`Synced ${result.itemCount} items`);
    });
  };

  return (
    <div
      className="rounded-xl transition-all duration-200"
      style={{
        background: "var(--surface)",
        border: `1px solid ${isConnected ? "rgba(16, 185, 129, 0.15)" : "var(--border)"}`,
        opacity: isConnected ? 1 : 0.8,
      }}
    >
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={`w-10 h-10 rounded-lg ${meta.bgColor} flex items-center justify-center text-xl shrink-0`}>
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>{meta.label}</h3>
            {isConnected ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.15)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#34d399" }} />
                Connected
              </span>
            ) : (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: "rgba(255,255,255,0.04)", color: "var(--foreground-dim)" }}
              >
                Not connected
              </span>
            )}
          </div>
          <p className="text-xs line-clamp-1" style={{ color: "var(--foreground-dim)" }}>{meta.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {stats && (
            <div className="text-right mr-2 hidden sm:block">
              <p className="text-xs" style={{ color: "var(--foreground-dim)" }}>
                {stats.total} total &middot; <span style={{ color: "var(--accent-orange)" }} className="font-medium">{stats.unconsumed} new</span>
              </p>
            </div>
          )}
          {isConnected && (
            <button onClick={(e) => { e.stopPropagation(); handleSync(); }} disabled={isPending} className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50">
              {isPending ? "..." : "Sync"}
            </button>
          )}
          <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} style={{ color: "var(--foreground-dim)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {message && (
        <div className="px-4 pb-2">
          <p className="text-xs font-medium" style={{ color: "var(--accent-green)" }}>{message}</p>
        </div>
      )}

      {isExpanded && (
        <div className="p-4 space-y-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="rounded-lg p-3" style={{ background: "var(--background-secondary)" }}>
            <p className="text-xs leading-relaxed" style={{ color: "var(--foreground-muted)" }}>{meta.setupInstructions}</p>
          </div>

          {isConnected && config && (
            <div className="flex flex-wrap gap-4 text-xs">
              <div><span style={{ color: "var(--foreground-dim)" }}>Last sync:</span> <span style={{ color: "var(--foreground)" }}>{config.lastSyncAt ? new Date(config.lastSyncAt).toLocaleString() : "Never"}</span></div>
              {config.lastSyncStatus && <div><span style={{ color: "var(--foreground-dim)" }}>Status:</span> <span style={{ color: config.lastSyncStatus === "SUCCESS" ? "var(--accent-green)" : "var(--accent-red)" }}>{config.lastSyncStatus}</span></div>}
              {config.lastSyncItemCount != null && <div><span style={{ color: "var(--foreground-dim)" }}>Items:</span> <span style={{ color: "var(--foreground)" }}>{config.lastSyncItemCount}</span></div>}
            </div>
          )}

          {meta.configFields.length > 0 && (isConfiguring || !isConnected) && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>Configuration</h4>
              {meta.configFields.map((field: SourceConfigField) => (
                <div key={field.key}>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--foreground-muted)" }}>
                    {field.label}{field.required && <span style={{ color: "var(--accent-red)" }} className="ml-0.5">*</span>}
                  </label>
                  {field.type === "select" ? (
                    <select value={configValues[field.key] || ""} onChange={(e) => setConfigValues((prev) => ({ ...prev, [field.key]: e.target.value }))} className="input-field text-xs">
                      <option value="">Select...</option>
                      {field.options?.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea value={configValues[field.key] || ""} onChange={(e) => setConfigValues((prev) => ({ ...prev, [field.key]: e.target.value }))} className="input-field text-xs resize-y" style={{ minHeight: "60px" }} placeholder={field.placeholder} />
                  ) : (
                    <input type="text" value={configValues[field.key] || ""} onChange={(e) => setConfigValues((prev) => ({ ...prev, [field.key]: e.target.value }))} className="input-field text-xs" placeholder={field.placeholder} />
                  )}
                  {field.helpText && <p className="text-[11px] mt-0.5" style={{ color: "var(--foreground-dim)" }}>{field.helpText}</p>}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            {!isConnected ? (
              <button onClick={handleConnect} disabled={isPending} className="btn-primary text-xs disabled:opacity-50">
                {isPending ? "Connecting..." : "Connect & Enable"}
              </button>
            ) : (
              <>
                {!isConfiguring ? (
                  <>
                    {meta.configFields.length > 0 && (
                      <button onClick={() => setIsConfiguring(true)} className="btn-secondary text-xs">Edit Settings</button>
                    )}
                    <button onClick={handleDisconnect} disabled={isPending} className="btn-ghost text-xs" style={{ color: "var(--accent-red)" }}>
                      {isPending ? "..." : "Disconnect"}
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={handleSaveConfig} disabled={isPending} className="btn-primary text-xs disabled:opacity-50">{isPending ? "Saving..." : "Save Settings"}</button>
                    <button onClick={() => setIsConfiguring(false)} className="btn-ghost text-xs">Cancel</button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
