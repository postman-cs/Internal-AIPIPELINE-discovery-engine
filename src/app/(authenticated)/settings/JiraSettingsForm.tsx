"use client";

import { useState, useTransition, useMemo } from "react";
import { saveJiraSettings, disconnectJira } from "@/lib/actions/settings";

interface JiraSettingsFormProps {
  initialValues: {
    jiraBaseUrl: string;
    jiraEmail: string;
    jiraApiToken: string;
    jiraDefaultProject: string;
    jiraIssueType: string;
  };
  isConfigured: boolean;
}

function validateUrl(val: string): string | null {
  if (!val) return "Jira Cloud URL is required";
  if (!/^https?:\/\/.+/.test(val)) return "Must be a valid URL starting with https://";
  if (!/atlassian\.net/.test(val) && !/jira/.test(val)) return "Expected a Jira URL (e.g. https://company.atlassian.net)";
  return null;
}

function validateEmail(val: string): string | null {
  if (!val) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "Invalid email address";
  return null;
}

function validateToken(val: string): string | null {
  if (!val) return "API token is required";
  if (val.length < 10) return "Token seems too short";
  return null;
}

const errorStyle = { color: "#f87171", fontSize: "11px", marginTop: 4 } as const;

export function JiraSettingsForm({
  initialValues,
  isConfigured,
}: JiraSettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState(initialValues);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    displayName?: string;
    error?: string;
  } | null>(null);

  const validationErrors = useMemo(() => ({
    jiraBaseUrl: validateUrl(values.jiraBaseUrl),
    jiraEmail: validateEmail(values.jiraEmail),
    jiraApiToken: validateToken(values.jiraApiToken),
  }), [values.jiraBaseUrl, values.jiraEmail, values.jiraApiToken]);

  const markTouched = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  const flash = (type: "success" | "error" | "info", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveJiraSettings(values);
      if (result.error) {
        flash("error", result.error);
      } else {
        flash("success", "Jira settings saved");
      }
    });
  };

  const handleTest = async () => {
    setTestResult(null);
    setMessage({ type: "info", text: "Testing connection..." });

    try {
      const res = await fetch("/api/jira/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: values.jiraBaseUrl,
          email: values.jiraEmail,
          apiToken: values.jiraApiToken,
        }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.ok) {
        flash("success", `Connected as ${data.displayName}`);
      } else {
        flash("error", data.error || "Connection failed");
      }
    } catch {
      flash("error", "Network error — could not reach test endpoint");
    }
  };

  const handleDisconnect = () => {
    startTransition(async () => {
      await disconnectJira();
      setValues({
        jiraBaseUrl: "",
        jiraEmail: "",
        jiraApiToken: "",
        jiraDefaultProject: "",
        jiraIssueType: "Task",
      });
      setTestResult(null);
      flash("info", "Jira disconnected");
    });
  };

  const hasAllFields =
    values.jiraBaseUrl && values.jiraEmail && values.jiraApiToken;

  return (
    <div
      className="card"
      style={{
        border: isConfigured
          ? "1px solid rgba(16,185,129,0.15)"
          : "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#60a5fa"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              Jira Integration
            </h2>
            <p
              className="text-xs"
              style={{ color: "var(--foreground-dim)" }}
            >
              Auto-create and update Jira tickets from your CortexLab projects
            </p>
          </div>
        </div>
        {isConfigured && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{
              background: "rgba(16,185,129,0.1)",
              color: "#34d399",
              border: "1px solid rgba(16,185,129,0.15)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#34d399" }}
            />
            Connected
          </span>
        )}
      </div>

      {message && (
        <div
          className="text-sm rounded-lg px-3 py-2 mb-4"
          style={{
            background:
              message.type === "success"
                ? "rgba(16,185,129,0.08)"
                : message.type === "error"
                  ? "rgba(239,68,68,0.08)"
                  : "rgba(59,130,246,0.08)",
            border: `1px solid ${
              message.type === "success"
                ? "rgba(16,185,129,0.15)"
                : message.type === "error"
                  ? "rgba(239,68,68,0.15)"
                  : "rgba(59,130,246,0.15)"
            }`,
            color:
              message.type === "success"
                ? "#34d399"
                : message.type === "error"
                  ? "#f87171"
                  : "#60a5fa",
          }}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="label">Jira Cloud URL *</label>
          <input
            type="text"
            className="input-field text-sm"
            placeholder="https://yourcompany.atlassian.net"
            value={values.jiraBaseUrl}
            onChange={(e) =>
              setValues((v) => ({ ...v, jiraBaseUrl: e.target.value }))
            }
            onBlur={() => markTouched("jiraBaseUrl")}
            style={touched.jiraBaseUrl && validationErrors.jiraBaseUrl ? { borderColor: "#f87171" } : undefined}
          />
          {touched.jiraBaseUrl && validationErrors.jiraBaseUrl && (
            <p style={errorStyle}>{validationErrors.jiraBaseUrl}</p>
          )}
        </div>
        <div>
          <label className="label">Jira Account Email *</label>
          <input
            type="email"
            className="input-field text-sm"
            placeholder="you@company.com"
            value={values.jiraEmail}
            onChange={(e) =>
              setValues((v) => ({ ...v, jiraEmail: e.target.value }))
            }
            onBlur={() => markTouched("jiraEmail")}
            style={touched.jiraEmail && validationErrors.jiraEmail ? { borderColor: "#f87171" } : undefined}
          />
          {touched.jiraEmail && validationErrors.jiraEmail && (
            <p style={errorStyle}>{validationErrors.jiraEmail}</p>
          )}
        </div>
        <div>
          <label className="label">API Token *</label>
          <input
            type="password"
            className="input-field text-sm"
            placeholder="Paste your Jira API token"
            value={values.jiraApiToken}
            onChange={(e) =>
              setValues((v) => ({ ...v, jiraApiToken: e.target.value }))
            }
            onBlur={() => markTouched("jiraApiToken")}
            style={touched.jiraApiToken && validationErrors.jiraApiToken ? { borderColor: "#f87171" } : undefined}
          />
          {touched.jiraApiToken && validationErrors.jiraApiToken && (
            <p style={errorStyle}>{validationErrors.jiraApiToken}</p>
          )}
          <p
            className="text-[11px] mt-1"
            style={{ color: "var(--foreground-dim)" }}
          >
            Create one at{" "}
            <a
              href="https://id.atlassian.com/manage-profile/security/api-tokens"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent-cyan)" }}
            >
              id.atlassian.com/manage-profile/security/api-tokens
            </a>
          </p>
        </div>
        <div>
          <label className="label">Default Jira Project Key</label>
          <input
            type="text"
            className="input-field text-sm uppercase"
            placeholder="e.g. CSEBOOT"
            value={values.jiraDefaultProject}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                jiraDefaultProject: e.target.value,
              }))
            }
          />
          <p
            className="text-[11px] mt-1"
            style={{ color: "var(--foreground-dim)" }}
          >
            Tickets will be created in this project by default. Can be
            overridden per-project.
          </p>
        </div>
        <div>
          <label className="label">Issue Type</label>
          <input
            type="text"
            className="input-field text-sm"
            placeholder="Task"
            value={values.jiraIssueType}
            onChange={(e) =>
              setValues((v) => ({ ...v, jiraIssueType: e.target.value }))
            }
          />
          <p
            className="text-[11px] mt-1"
            style={{ color: "var(--foreground-dim)" }}
          >
            The Jira issue type to create (e.g. Task, Story, Bug). Must
            exist in your target project.
          </p>
        </div>

        {testResult && (
          <div
            className="rounded-lg p-3 text-xs"
            style={{
              background: testResult.ok
                ? "rgba(16,185,129,0.08)"
                : "rgba(239,68,68,0.08)",
              border: `1px solid ${testResult.ok ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}`,
              color: testResult.ok ? "#34d399" : "#f87171",
            }}
          >
            {testResult.ok
              ? `Connected as ${testResult.displayName}`
              : `Failed: ${testResult.error}`}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={isPending || !hasAllFields}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save Settings"}
          </button>
          <button
            onClick={handleTest}
            disabled={!hasAllFields}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            Test Connection
          </button>
          {isConfigured && (
            <button
              onClick={handleDisconnect}
              disabled={isPending}
              className="btn-ghost text-xs ml-auto"
              style={{ color: "var(--accent-red)" }}
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
