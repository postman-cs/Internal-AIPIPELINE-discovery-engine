"use client";

import { useState, useTransition, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { saveServiceTemplate, removeServiceTemplate, fetchTemplateFromUrl } from "@/lib/actions/projects";

const TEMPLATE_TYPES = [
  { value: "openapi", label: "OpenAPI / Swagger", ext: ".yaml, .yml, .json" },
  { value: "postman-collection", label: "Postman Collection", ext: ".json" },
  { value: "docker-compose", label: "Docker Compose", ext: ".yaml, .yml" },
  { value: "github-actions", label: "GitHub Actions Workflow", ext: ".yaml, .yml" },
  { value: "terraform", label: "Terraform", ext: ".tf, .json" },
  { value: "custom", label: "Other / Custom", ext: "any" },
] as const;

function validateTemplate(content: string, templateType: string): string | null {
  if (!content.trim() || templateType === "custom") return null;
  const c = content.slice(0, 2000);
  switch (templateType) {
    case "openapi":
      if (!/openapi\s*:|swagger\s*:|"openapi"|"swagger"/i.test(c))
        return "Content doesn\u2019t appear to be a valid OpenAPI/Swagger spec \u2014 missing openapi: or swagger: declaration";
      break;
    case "postman-collection":
      if (!/"info"/.test(c) || !/"item"/.test(c))
        return "Content doesn\u2019t appear to be a Postman Collection \u2014 missing \"info\" or \"item\" keys";
      break;
    case "docker-compose":
      if (!/services\s*:|"services"/.test(c))
        return "Content doesn\u2019t appear to be a Docker Compose file \u2014 missing services: declaration";
      break;
    case "terraform":
      if (!/\b(resource|provider|terraform)\b/.test(c))
        return "Content doesn\u2019t appear to be Terraform config \u2014 missing resource, provider, or terraform blocks";
      break;
    case "github-actions":
      if (!(/on\s*:/.test(c) && /jobs\s*:/.test(c)) && !(/"on"/.test(c) && /"jobs"/.test(c)))
        return "Content doesn\u2019t appear to be a GitHub Actions workflow \u2014 missing on: and jobs: declarations";
      break;
  }
  return null;
}

function extractPreview(content: string, templateType: string): { label: string; items: string[] } | null {
  if (!content.trim()) return null;
  switch (templateType) {
    case "openapi": {
      const items: string[] = [];
      const pathMatches = content.matchAll(/^\s{0,4}(\/[^\s:]+)\s*:/gm);
      for (const m of pathMatches) {
        const path = m[1];
        const idx = m.index! + m[0].length;
        const slice = content.slice(idx, idx + 300);
        const methods = [...slice.matchAll(/^\s+(get|post|put|patch|delete|options|head)\s*:/gim)]
          .map((mm) => mm[1].toUpperCase());
        items.push(methods.length > 0 ? `${methods.join(", ")} ${path}` : path);
      }
      return items.length > 0 ? { label: "Endpoints", items: items.slice(0, 30) } : null;
    }
    case "postman-collection": {
      const items: string[] = [];
      const nameMatches = content.matchAll(/"name"\s*:\s*"([^"]+)"/g);
      for (const m of nameMatches) items.push(m[1]);
      return items.length > 0 ? { label: "Requests / Folders", items: items.slice(0, 30) } : null;
    }
    case "docker-compose": {
      const items: string[] = [];
      const servicesIdx = content.search(/services\s*:/);
      if (servicesIdx >= 0) {
        const after = content.slice(servicesIdx + 9);
        const svcMatches = after.matchAll(/^\s{2}(\w[\w-]*)\s*:/gm);
        for (const m of svcMatches) {
          if (["version", "networks", "volumes", "configs", "secrets"].includes(m[1])) continue;
          items.push(m[1]);
        }
      }
      return items.length > 0 ? { label: "Services", items: items.slice(0, 30) } : null;
    }
    default:
      return null;
  }
}

function computeDiffSummary(oldContent: string, newContent: string): { added: number; removed: number } | null {
  if (!oldContent || !newContent || oldContent === newContent) return null;
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);
  let added = 0;
  let removed = 0;
  for (const line of newLines) {
    if (!oldSet.has(line)) added++;
  }
  for (const line of oldLines) {
    if (!newSet.has(line)) removed++;
  }
  if (added === 0 && removed === 0) return null;
  return { added, removed };
}

interface Props {
  projectId: string;
  existing: {
    content: string | null;
    type: string | null;
    fileName: string | null;
    notes: string | null;
  } | null;
}

export function ServiceTemplateInput({ projectId, existing }: Props) {
  const [expanded, setExpanded] = useState(!!existing?.content);
  const [content, setContent] = useState(existing?.content ?? "");
  const [type, setType] = useState(existing?.type ?? "openapi");
  const [fileName, setFileName] = useState(existing?.fileName ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, startSave] = useTransition();
  const [removing, startRemove] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [fetchUrl, setFetchUrl] = useState("");
  const [fetching, startFetch] = useTransition();
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (["yaml", "yml"].includes(ext) && !type) setType("openapi");
    else if (ext === "json" && file.name.includes("postman")) setType("postman-collection");
    else if (ext === "tf") setType("terraform");

    const reader = new FileReader();
    reader.onload = (ev) => {
      setContent((ev.target?.result as string) ?? "");
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [type]);

  function handleSave() {
    setMsg(null);
    startSave(async () => {
      const res = await saveServiceTemplate(projectId, { content, type, fileName, notes });
      if (res.error) {
        setMsg({ ok: false, text: res.error });
      } else {
        setMsg({ ok: true, text: "Service template saved" });
        window.dispatchEvent(new CustomEvent("discovery-ingest", {
          detail: { text: content, sourceType: "SERVICE_TEMPLATE" },
        }));
        setTimeout(() => setMsg(null), 3000);
        router.refresh();
      }
    });
  }

  function handleRemove() {
    if (!confirm("Remove the service template from this project?")) return;
    startRemove(async () => {
      await removeServiceTemplate(projectId);
      setContent("");
      setFileName("");
      setNotes("");
      setType("openapi");
      setMsg({ ok: true, text: "Template removed" });
      setTimeout(() => setMsg(null), 3000);
      router.refresh();
    });
  }

  function handleFetchUrl() {
    if (!fetchUrl.trim()) return;
    setMsg(null);
    startFetch(async () => {
      const res = await fetchTemplateFromUrl(fetchUrl.trim());
      if (res.error) {
        setMsg({ ok: false, text: res.error });
      } else if (res.content) {
        setContent(res.content);
        const urlFileName = fetchUrl.split("/").pop()?.split("?")[0] || "";
        if (urlFileName) setFileName(urlFileName);
        setMsg({ ok: true, text: "Fetched from URL" });
        setTimeout(() => setMsg(null), 3000);
      }
    });
  }

  const hasContent = content.trim().length > 0;
  const lineCount = content.split("\n").length;
  const charCount = content.length;
  const validationWarning = useMemo(() => validateTemplate(content, type), [content, type]);
  const preview = useMemo(() => extractPreview(content, type), [content, type]);
  const diffSummary = useMemo(
    () => existing?.content ? computeDiffSummary(existing.content, content) : null,
    [existing?.content, content],
  );

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors hover:opacity-90"
        style={{ background: hasContent ? "rgba(6,214,214,0.04)" : "transparent" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
            background: hasContent ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${hasContent ? "rgba(16,185,129,0.2)" : "var(--border)"}`,
          }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={hasContent ? "#34d399" : "currentColor"} strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              Service Template
            </p>
            <p className="text-[11px]" style={{ color: "var(--foreground-dim)" }}>
              {hasContent
                ? `${fileName || "Template"} · ${TEMPLATE_TYPES.find(t => t.value === type)?.label ?? type} · ${lineCount} lines`
                : "Upload or paste the customer\u2019s service spec (OpenAPI, Postman Collection, etc.)"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasContent && (
            <span className="text-[9px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.1)", color: "#34d399" }}>
              LOADED
            </span>
          )}
          <svg
            className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            style={{ color: "var(--foreground-dim)" }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Type selector */}
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider block mb-1" style={{ color: "var(--foreground-dim)" }}>
                Template Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-md px-2.5 py-1.5 text-sm border outline-none"
                style={{ background: "var(--background-secondary)", borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                {TEMPLATE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* File name */}
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider block mb-1" style={{ color: "var(--foreground-dim)" }}>
                File Name
              </label>
              <input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="e.g. heatmap-service.yaml"
                className="w-full rounded-md px-2.5 py-1.5 text-sm border outline-none"
                style={{ background: "var(--background-secondary)", borderColor: "var(--border)", color: "var(--foreground)" }}
              />
            </div>

            {/* Upload button */}
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider block mb-1" style={{ color: "var(--foreground-dim)" }}>
                Upload File
              </label>
              <input ref={fileRef} type="file" accept=".yaml,.yml,.json,.tf,.toml,.xml" onChange={handleFileUpload} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-md px-2.5 py-1.5 text-sm border transition-colors flex items-center justify-center gap-1.5"
                style={{ background: "rgba(6,214,214,0.04)", borderColor: "rgba(6,214,214,0.15)", color: "var(--accent-cyan)" }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Choose File
              </button>
            </div>
          </div>

          {/* URL import */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-medium uppercase tracking-wider block mb-1" style={{ color: "var(--foreground-dim)" }}>
                Fetch from URL
              </label>
              <div className="flex gap-2">
                <input
                  value={fetchUrl}
                  onChange={(e) => setFetchUrl(e.target.value)}
                  placeholder="https://raw.githubusercontent.com/…/openapi.yaml"
                  className="flex-1 rounded-md px-2.5 py-1.5 text-sm border outline-none"
                  style={{ background: "var(--background-secondary)", borderColor: "var(--border)", color: "var(--foreground)" }}
                  onKeyDown={(e) => e.key === "Enter" && handleFetchUrl()}
                />
                <button
                  onClick={handleFetchUrl}
                  disabled={fetching || !fetchUrl.trim()}
                  className="rounded-md px-3 py-1.5 text-sm border transition-colors flex items-center gap-1.5"
                  style={{
                    background: fetchUrl.trim() ? "rgba(6,214,214,0.04)" : "transparent",
                    borderColor: fetchUrl.trim() ? "rgba(6,214,214,0.15)" : "var(--border)",
                    color: fetchUrl.trim() ? "var(--accent-cyan)" : "var(--foreground-dim)",
                    opacity: fetching ? 0.6 : 1,
                  }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                  {fetching ? "Fetching\u2026" : "Fetch"}
                </button>
              </div>
            </div>
          </div>

          {/* Content editor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>
                Template Content
              </label>
              {hasContent && (
                <span className="text-[9px] tabular-nums" style={{ color: "var(--foreground-dim)" }}>
                  {lineCount.toLocaleString()} lines · {charCount.toLocaleString()} chars
                </span>
              )}
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Paste or upload the customer's service template here...\n\nExamples:\n  • OpenAPI spec (YAML/JSON)\n  • Postman Collection export\n  • Docker Compose file\n  • GitHub Actions workflow\n  • Any service configuration`}
              className="w-full rounded-lg px-3 py-2.5 text-xs font-mono border outline-none focus:ring-1 resize-y"
              style={{
                background: "var(--background)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
                minHeight: hasContent ? "300px" : "160px",
                maxHeight: "600px",
                lineHeight: 1.6,
              }}
              spellCheck={false}
            />
            {validationWarning && (
              <p className="mt-1.5 text-[11px]" style={{ color: "#f59e0b" }}>
                \u26A0 {validationWarning}
              </p>
            )}
            {diffSummary && (
              <div className="mt-2 px-3 py-2 rounded-md text-[11px]" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", color: "#f59e0b" }}>
                Template changed from saved version: {diffSummary.added} line{diffSummary.added !== 1 ? "s" : ""} added, {diffSummary.removed} line{diffSummary.removed !== 1 ? "s" : ""} removed
              </div>
            )}
          </div>

          {preview && hasContent && (
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <button
                onClick={() => setPreviewOpen(!previewOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors hover:opacity-90"
                style={{ background: "rgba(6,214,214,0.03)" }}
              >
                <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--foreground-dim)" }}>
                  Preview \u2014 {preview.label} ({preview.items.length})
                </span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${previewOpen ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  style={{ color: "var(--foreground-dim)" }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {previewOpen && (
                <div className="px-3 pb-2.5 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
                  <ul className="space-y-0.5">
                    {preview.items.map((item, i) => (
                      <li key={i} className="text-[11px] font-mono truncate" style={{ color: "var(--foreground-dim)" }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-[10px] font-medium uppercase tracking-wider block mb-1" style={{ color: "var(--foreground-dim)" }}>
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes about this template — e.g., which service this covers, known gaps, what was discussed with customer..."
              className="w-full rounded-lg px-3 py-2 text-sm border outline-none focus:ring-1 resize-y"
              style={{ background: "var(--background-secondary)", borderColor: "var(--border)", color: "var(--foreground)", minHeight: "60px" }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              {msg && (
                <span className="text-xs font-medium" style={{ color: msg.ok ? "#34d399" : "#f87171" }}>
                  {msg.text}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasContent && existing?.content && (
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  className="text-[10px] font-medium px-3 py-1.5 rounded-md transition-colors"
                  style={{ background: "rgba(239,68,68,0.06)", color: "#f87171", border: "1px solid rgba(239,68,68,0.12)" }}
                >
                  {removing ? "Removing…" : "Remove Template"}
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !hasContent}
                className="text-[10px] font-medium px-4 py-1.5 rounded-md transition-colors"
                style={{
                  background: hasContent ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.04)",
                  color: hasContent ? "#34d399" : "var(--foreground-dim)",
                  border: `1px solid ${hasContent ? "rgba(16,185,129,0.2)" : "var(--border)"}`,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Saving…" : "Save Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
