"use client";

import { useState, useTransition } from "react";
import { generateCaseStudy } from "@/lib/actions/case-study";

export function CaseStudyView({
  projectId,
  projectName,
  onGenerated,
}: {
  projectId: string;
  projectName: string;
  onGenerated?: () => void;
}) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, startGenerate] = useTransition();
  const [copied, setCopied] = useState(false);

  function handleGenerate() {
    setError(null);
    startGenerate(async () => {
      const result = await generateCaseStudy(projectId);
      if ("error" in result) {
        setError(result.error);
      } else {
        setMarkdown(result.markdown);
        onGenerated?.();
      }
    });
  }

  function handleCopy() {
    if (!markdown) return;
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, "-").toLowerCase()}-case-study.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
            Executive Case Study
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
            Generate a stakeholder-ready engagement summary for {projectName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {markdown && (
            <>
              <button
                onClick={handleCopy}
                className="text-xs px-3 py-1.5 rounded-md transition-colors"
                style={{
                  background: copied ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)",
                  color: copied ? "#22c55e" : "var(--foreground-muted)",
                  border: `1px solid ${copied ? "rgba(34,197,94,0.2)" : "var(--border)"}`,
                }}
              >
                {copied ? "Copied!" : "Copy Markdown"}
              </button>
              <button
                onClick={handleDownload}
                className="text-xs px-3 py-1.5 rounded-md transition-colors"
                style={{
                  background: "rgba(6,214,214,0.06)",
                  color: "var(--accent-cyan)",
                  border: "1px solid rgba(6,214,214,0.15)",
                }}
              >
                Download .md
              </button>
            </>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="text-xs px-4 py-1.5 rounded-md font-medium transition-colors"
            style={{
              background: generating ? "rgba(255,255,255,0.04)" : "rgba(201,162,39,0.12)",
              color: generating ? "var(--foreground-dim)" : "#c9a227",
              border: `1px solid ${generating ? "var(--border)" : "rgba(201,162,39,0.2)"}`,
              opacity: generating ? 0.7 : 1,
            }}
          >
            {generating ? "Generating..." : markdown ? "Regenerate" : "Generate Case Study"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.15)" }}>
          {error}
        </div>
      )}

      {!markdown && !generating && (
        <div className="card text-center py-16">
          <div className="text-4xl mb-4" style={{ color: "var(--foreground-dim)" }}>📋</div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
            Ready to Generate
          </h2>
          <p className="text-sm max-w-md mx-auto" style={{ color: "var(--foreground-dim)" }}>
            This will compile Discovery findings, Build Log data, blocker resolutions,
            and engagement metrics into an executive-ready case study document.
          </p>
        </div>
      )}

      {generating && !markdown && (
        <div className="card text-center py-16 animate-pulse">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-sm" style={{ color: "var(--foreground-dim)" }}>Compiling case study...</p>
        </div>
      )}

      {markdown && (
        <div
          className="card p-8 prose prose-invert max-w-none"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div
            className="markdown-body text-sm leading-relaxed"
            style={{ color: "var(--foreground-muted)" }}
            dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(markdown) }}
          />
        </div>
      )}
    </div>
  );
}

function renderMarkdownToHtml(md: string): string {
  let html = md;

  html = html.replace(/^### (.+)$/gm, '<h3 style="color: var(--foreground); margin-top: 1.5em; margin-bottom: 0.5em; font-size: 1.1em; font-weight: 600;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="color: var(--foreground); margin-top: 2em; margin-bottom: 0.75em; font-size: 1.25em; font-weight: 700; border-bottom: 1px solid var(--border); padding-bottom: 0.3em;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="color: var(--foreground); font-size: 1.5em; font-weight: 800; margin-bottom: 0.5em;">$1</h1>');

  html = html.replace(/^---$/gm, '<hr style="border: none; border-top: 1px solid var(--border); margin: 1.5em 0;" />');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="color: var(--foreground);">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  html = html.replace(/^\|(.+)\|$/gm, (match) => {
    const cells = match.split("|").filter(c => c.trim());
    if (cells.every(c => /^[\s-]+$/.test(c))) {
      return '<tr class="table-separator"></tr>';
    }
    const isHeader = cells.every(c => /^[\s-|]+$/.test(c));
    if (isHeader) return "";
    const tag = "td";
    const tds = cells.map(c => `<${tag} style="padding: 0.5em 1em; border: 1px solid var(--border); font-size: 0.85em;">${c.trim()}</${tag}>`).join("");
    return `<tr>${tds}</tr>`;
  });
  html = html.replace(/(<tr>.*<\/tr>\n?)+/g, (block) => {
    const rows = block.trim().split("\n").filter(r => r.includes("<tr>") && !r.includes("table-separator"));
    if (rows.length === 0) return block;
    const firstRow = rows[0].replace(/<td/g, "<th").replace(/<\/td/g, "</th");
    const rest = rows.slice(1).join("\n");
    return `<table style="width: 100%; border-collapse: collapse; margin: 1em 0;">${firstRow}${rest}</table>`;
  });

  html = html.replace(/^- \[ \] (.+)$/gm, '<li style="list-style: none; padding-left: 0;"><span style="color: var(--foreground-dim);">☐</span> $1</li>');
  html = html.replace(/^- \[x\] (.+)$/gm, '<li style="list-style: none; padding-left: 0;"><span style="color: #22c55e;">☑</span> $1</li>');
  html = html.replace(/^- (.+)$/gm, '<li style="margin: 0.25em 0; padding-left: 0.5em;">$1</li>');
  html = html.replace(/(<li.*<\/li>\n?)+/g, (block) => `<ul style="margin: 0.5em 0; padding-left: 1.5em;">${block}</ul>`);

  html = html.replace(/  $/gm, "<br />");

  html = html.replace(/\n\n/g, "</p><p style=\"margin: 0.75em 0;\">");
  html = `<p style="margin: 0.75em 0;">${html}</p>`;

  html = html.replace(/<p[^>]*>\s*<\/p>/g, "");
  html = html.replace(/<p[^>]*>\s*(<h[123])/g, "$1");
  html = html.replace(/(<\/h[123]>)\s*<\/p>/g, "$1");
  html = html.replace(/<p[^>]*>\s*(<hr)/g, "$1");
  html = html.replace(/(<\/hr>|<hr[^>]*\/>)\s*<\/p>/g, "$1");
  html = html.replace(/<p[^>]*>\s*(<table)/g, "$1");
  html = html.replace(/(<\/table>)\s*<\/p>/g, "$1");
  html = html.replace(/<p[^>]*>\s*(<ul)/g, "$1");
  html = html.replace(/(<\/ul>)\s*<\/p>/g, "$1");

  return html;
}
