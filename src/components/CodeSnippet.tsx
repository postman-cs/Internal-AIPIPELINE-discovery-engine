"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";

const LANG_LABELS: Record<string, string> = {
  yaml: "YAML",
  groovy: "Groovy",
  javascript: "JavaScript",
  json: "JSON",
  bash: "Bash",
  shell: "Shell",
  typescript: "TypeScript",
  hcl: "HCL",
  toml: "TOML",
  xml: "XML",
  dockerfile: "Dockerfile",
  python: "Python",
  ruby: "Ruby",
  powershell: "PowerShell",
};

// SVG icon components for cleaner rendering
function CopyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function DownloadIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

// Lightweight regex-based syntax highlighter using platform colors
function tokenize(line: string, language: string): React.ReactNode {
  const tokens: { text: string; color?: string }[] = [];

  const rules: { pattern: RegExp; color: string }[] = (() => {
    switch (language) {
      case "json":
        return [
          { pattern: /"[^"]*"\s*(?=:)/g, color: "var(--accent-cyan)" },
          { pattern: /:\s*"[^"]*"/g, color: "#a5d6a7" },
          { pattern: /:\s*(-?\d+\.?\d*)/g, color: "#ffcc80" },
          { pattern: /:\s*(true|false|null)/g, color: "#ce93d8" },
          { pattern: /[{}[\],]/g, color: "var(--foreground-dim)" },
        ];
      case "yaml":
      case "yml":
        return [
          { pattern: /^(\s*[\w.-]+)\s*:/gm, color: "var(--accent-cyan)" },
          { pattern: /:\s*(.+)/g, color: "#a5d6a7" },
          { pattern: /^\s*#.*/gm, color: "var(--foreground-dim)" },
          { pattern: /^\s*-\s/gm, color: "#ffcc80" },
        ];
      case "bash":
      case "shell":
        return [
          { pattern: /#.*/g, color: "var(--foreground-dim)" },
          { pattern: /\b(if|then|else|fi|for|do|done|while|case|esac|function|return|export|source|alias|echo|cd|mkdir|rm|cp|mv|chmod|chown|sudo|apt|npm|npx|yarn|pip|git|docker|curl|wget)\b/g, color: "var(--accent-cyan)" },
          { pattern: /"[^"]*"|'[^']*'/g, color: "#a5d6a7" },
          { pattern: /\$[\w{}]+/g, color: "#ffcc80" },
        ];
      case "typescript":
      case "javascript":
        return [
          { pattern: /\/\/.*/g, color: "var(--foreground-dim)" },
          { pattern: /\b(const|let|var|function|return|if|else|for|while|import|export|from|class|extends|new|async|await|try|catch|throw|typeof|instanceof)\b/g, color: "var(--accent-cyan)" },
          { pattern: /"[^"]*"|'[^']*'|`[^`]*`/g, color: "#a5d6a7" },
          { pattern: /\b(\d+\.?\d*)\b/g, color: "#ffcc80" },
        ];
      case "dockerfile":
        return [
          { pattern: /#.*/g, color: "var(--foreground-dim)" },
          { pattern: /^(FROM|RUN|CMD|ENTRYPOINT|COPY|ADD|ENV|EXPOSE|WORKDIR|ARG|LABEL|VOLUME|USER|HEALTHCHECK)\b/gm, color: "var(--accent-cyan)" },
          { pattern: /"[^"]*"/g, color: "#a5d6a7" },
        ];
      case "hcl":
        return [
          { pattern: /#.*/g, color: "var(--foreground-dim)" },
          { pattern: /\b(resource|variable|output|module|provider|data|locals|terraform)\b/g, color: "var(--accent-cyan)" },
          { pattern: /"[^"]*"/g, color: "#a5d6a7" },
          { pattern: /\b(\d+)\b/g, color: "#ffcc80" },
        ];
      case "groovy":
        return [
          { pattern: /\/\/.*/g, color: "var(--foreground-dim)" },
          { pattern: /\b(pipeline|agent|stages|stage|steps|post|environment|when|script|def|node|any|none)\b/g, color: "var(--accent-cyan)" },
          { pattern: /'[^']*'|"[^"]*"/g, color: "#a5d6a7" },
        ];
      default:
        return [
          { pattern: /#.*/g, color: "var(--foreground-dim)" },
          { pattern: /"[^"]*"|'[^']*'/g, color: "#a5d6a7" },
        ];
    }
  })();

  // Simple approach: apply the first matching rule for each character range
  const colored: { start: number; end: number; color: string }[] = [];
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.pattern.exec(line)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const overlaps = colored.some((c) => start < c.end && end > c.start);
      if (!overlaps) colored.push({ start, end, color: rule.color });
    }
  }

  colored.sort((a, b) => a.start - b.start);

  let pos = 0;
  for (const c of colored) {
    if (c.start > pos) tokens.push({ text: line.slice(pos, c.start) });
    tokens.push({ text: line.slice(c.start, c.end), color: c.color });
    pos = c.end;
  }
  if (pos < line.length) tokens.push({ text: line.slice(pos) });
  if (tokens.length === 0) return line || "\u00A0";

  return (
    <>
      {tokens.map((t, i) =>
        t.color ? (
          <span key={i} style={{ color: t.color }}>{t.text}</span>
        ) : (
          <span key={i}>{t.text}</span>
        )
      )}
    </>
  );
}

interface CodeSnippetProps {
  code: string;
  language: string;
  filename?: string;
  className?: string;
  maxHeight?: number;
  showLineNumbers?: boolean;
}

export function CodeSnippet({
  code,
  language,
  filename,
  className,
  maxHeight = 480,
  showLineNumbers = true,
}: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const codeRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const lines = useMemo(() => code.split("\n"), [code]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = code;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleDownload = useCallback(() => {
    const ext =
      language === "yaml" ? ".yml" :
      language === "groovy" ? ".groovy" :
      language === "json" ? ".json" :
      language === "hcl" ? ".tf" :
      language === "toml" ? ".toml" :
      `.${language}`;
    const name = filename || `snippet${ext}`;
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }, [code, language, filename]);

  const lineNumWidth = lines.length >= 100 ? "w-10" : lines.length >= 10 ? "w-8" : "w-6";

  return (
    <div
      className={`rounded-lg overflow-hidden group ${className || ""}`}
      style={{ background: "rgba(6, 8, 15, 0.85)", border: "1px solid var(--border)" }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: "rgba(255,255,255,0.025)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
            style={{ background: "rgba(6, 214, 214, 0.08)", color: "var(--accent-cyan)" }}
          >
            {LANG_LABELS[language] || language}
          </span>
          {filename && (
            <span
              className="text-xs font-mono truncate"
              style={{ color: "var(--foreground-dim)" }}
              title={filename}
            >
              {filename}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-all duration-200"
            style={{
              color: copied ? "var(--accent-green)" : "var(--foreground-dim)",
              background: copied ? "rgba(16,185,129,0.08)" : "transparent",
            }}
            onMouseEnter={(e) => { if (!copied) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
            onMouseLeave={(e) => { if (!copied) e.currentTarget.style.background = "transparent"; }}
            title="Copy to clipboard"
          >
            {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
          {filename && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-all duration-200"
              style={{ color: "var(--foreground-dim)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              title="Download file"
            >
              <DownloadIcon size={12} />
              <span>Download</span>
            </button>
          )}
        </div>
      </div>

      {/* Code body with line numbers */}
      <div
        ref={codeRef}
        className="overflow-auto"
        style={{ maxHeight }}
      >
        {showLineNumbers && lines.length > 1 ? (
          <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col className={lineNumWidth} />
              <col />
            </colgroup>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="leading-relaxed">
                  <td
                    className="text-right pr-3 select-none align-top font-mono text-xs"
                    style={{
                      color: "rgba(255,255,255,0.15)",
                      borderRight: "1px solid rgba(255,255,255,0.04)",
                      paddingTop: i === 0 ? "0.75rem" : "0",
                      paddingBottom: i === lines.length - 1 ? "0.75rem" : "0",
                      userSelect: "none",
                    }}
                  >
                    {i + 1}
                  </td>
                  <td
                    className="pl-4 pr-4 font-mono text-xs whitespace-pre"
                    style={{
                      color: "var(--foreground-muted)",
                      paddingTop: i === 0 ? "0.75rem" : "0",
                      paddingBottom: i === lines.length - 1 ? "0.75rem" : "0",
                    }}
                  >
                    {tokenize(line, language)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <pre
            className="p-3 text-xs leading-relaxed font-mono whitespace-pre-wrap"
            style={{ color: "var(--foreground-muted)" }}
          >
            {lines.map((line, i) => (
              <span key={i}>{tokenize(line, language)}{i < lines.length - 1 ? "\n" : ""}</span>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}
