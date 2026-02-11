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
  const [configValues, setConfigValues] = useState<Record<string, string>>(
    () => {
      if (config?.configJson) {
        try {
          return JSON.parse(config.configJson);
        } catch {
          return {};
        }
      }
      return {};
    }
  );

  const isConnected = config?.enabled === true;

  const flashMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleConnect = () => {
    startTransition(async () => {
      const configStr =
        Object.keys(configValues).length > 0
          ? JSON.stringify(configValues)
          : undefined;
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
      if (result.success) {
        flashMessage(`Synced ${result.itemCount} items`);
      }
    });
  };

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        isConnected
          ? "border-green-200 dark:border-green-800/50 bg-white dark:bg-gray-900"
          : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 opacity-80"
      }`}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div
          className={`w-10 h-10 rounded-lg ${meta.bgColor} flex items-center justify-center text-xl shrink-0`}
        >
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              {meta.label}
            </h3>
            {isConnected ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500">
                Not connected
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
            {meta.description}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {stats && (
            <div className="text-right mr-2 hidden sm:block">
              <p className="text-xs text-gray-400">
                {stats.total} total &middot;{" "}
                <span className="text-[#ff6c37] font-medium">
                  {stats.unconsumed} new
                </span>
              </p>
            </div>
          )}
          {isConnected && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSync();
              }}
              disabled={isPending}
              className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
              title="Sync now"
            >
              {isPending ? "..." : "Sync"}
            </button>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {/* Message toast */}
      {message && (
        <div className="px-4 pb-2">
          <p className="text-xs font-medium text-green-600 dark:text-green-400">
            {message}
          </p>
        </div>
      )}

      {/* Expanded body */}
      {isExpanded && (
        <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-4">
          {/* Setup instructions */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              {meta.setupInstructions}
            </p>
          </div>

          {/* Sync info */}
          {isConnected && config && (
            <div className="flex flex-wrap gap-4 text-xs">
              <div>
                <span className="text-gray-500">Last sync:</span>{" "}
                <span className="text-gray-700 dark:text-gray-300">
                  {config.lastSyncAt
                    ? new Date(config.lastSyncAt).toLocaleString()
                    : "Never"}
                </span>
              </div>
              {config.lastSyncStatus && (
                <div>
                  <span className="text-gray-500">Status:</span>{" "}
                  <span
                    className={
                      config.lastSyncStatus === "SUCCESS"
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    {config.lastSyncStatus}
                  </span>
                </div>
              )}
              {config.lastSyncItemCount != null && (
                <div>
                  <span className="text-gray-500">Items:</span>{" "}
                  <span className="text-gray-700 dark:text-gray-300">
                    {config.lastSyncItemCount}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Config form */}
          {meta.configFields.length > 0 && (isConfiguring || !isConnected) && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Configuration
              </h4>
              {meta.configFields.map((field: SourceConfigField) => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {field.label}
                    {field.required && (
                      <span className="text-red-500 ml-0.5">*</span>
                    )}
                  </label>
                  {field.type === "select" ? (
                    <select
                      value={configValues[field.key] || ""}
                      onChange={(e) =>
                        setConfigValues((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                      className="input-field text-xs"
                    >
                      <option value="">Select...</option>
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      value={configValues[field.key] || ""}
                      onChange={(e) =>
                        setConfigValues((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                      className="input-field text-xs resize-y"
                      style={{ minHeight: "60px" }}
                      placeholder={field.placeholder}
                    />
                  ) : (
                    <input
                      type="text"
                      value={configValues[field.key] || ""}
                      onChange={(e) =>
                        setConfigValues((prev) => ({
                          ...prev,
                          [field.key]: e.target.value,
                        }))
                      }
                      className="input-field text-xs"
                      placeholder={field.placeholder}
                    />
                  )}
                  {field.helpText && (
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {field.helpText}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            {!isConnected ? (
              <button
                onClick={handleConnect}
                disabled={isPending}
                className="btn-primary text-xs disabled:opacity-50"
              >
                {isPending ? "Connecting..." : "Connect & Enable"}
              </button>
            ) : (
              <>
                {!isConfiguring ? (
                  <>
                    {meta.configFields.length > 0 && (
                      <button
                        onClick={() => setIsConfiguring(true)}
                        className="btn-secondary text-xs"
                      >
                        Edit Settings
                      </button>
                    )}
                    <button
                      onClick={handleDisconnect}
                      disabled={isPending}
                      className="btn-ghost text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      {isPending ? "..." : "Disconnect"}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleSaveConfig}
                      disabled={isPending}
                      className="btn-primary text-xs disabled:opacity-50"
                    >
                      {isPending ? "Saving..." : "Save Settings"}
                    </button>
                    <button
                      onClick={() => setIsConfiguring(false)}
                      className="btn-ghost text-xs"
                    >
                      Cancel
                    </button>
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
