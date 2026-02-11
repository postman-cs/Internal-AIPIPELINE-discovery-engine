"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function BriefView({
  markdown,
  json,
  projectName,
  version,
}: {
  markdown: string;
  json: string;
  projectName: string;
  version: number;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"rendered" | "markdown" | "json">(
    "rendered"
  );

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadMarkdown = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, "_")}_discovery_v${version}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Actions Bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          {(["rendered", "markdown", "json"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === mode
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {mode === "rendered"
                ? "Rendered"
                : mode === "markdown"
                ? "Markdown"
                : "JSON"}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          onClick={() => copyToClipboard(markdown, "md")}
          className="btn-ghost text-xs"
        >
          {copied === "md" ? "Copied!" : "Copy Markdown"}
        </button>
        <button onClick={downloadMarkdown} className="btn-ghost text-xs">
          Download .md
        </button>
        <button
          onClick={() =>
            copyToClipboard(JSON.stringify(JSON.parse(json), null, 2), "json")
          }
          className="btn-ghost text-xs"
        >
          {copied === "json" ? "Copied!" : "Copy JSON"}
        </button>
      </div>

      {/* Content */}
      <div className="card">
        {viewMode === "rendered" && (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-table:text-sm prose-th:text-left prose-th:py-2 prose-td:py-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdown}
            </ReactMarkdown>
          </div>
        )}
        {viewMode === "markdown" && (
          <pre className="text-xs font-mono whitespace-pre-wrap text-gray-700 dark:text-gray-300 overflow-x-auto">
            {markdown}
          </pre>
        )}
        {viewMode === "json" && (
          <pre className="text-xs font-mono whitespace-pre-wrap text-gray-700 dark:text-gray-300 overflow-x-auto">
            {JSON.stringify(JSON.parse(json), null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
