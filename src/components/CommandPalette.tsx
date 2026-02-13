"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Command {
  id: string;
  label: string;
  section: string;
  icon?: string;
  shortcut?: string;
  action: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Extract current projectId from URL if on a project page
  const projectMatch = pathname.match(/\/projects\/([^/]+)/);
  const currentProjectId = projectMatch?.[1] ?? null;

  // Commands — base navigation + contextual project commands
  const commands: Command[] = [
    { id: "dashboard", label: "Go to Dashboard", section: "Navigate", icon: "◫", shortcut: "G D", action: () => router.push("/dashboard") },
    { id: "projects", label: "Go to Projects", section: "Navigate", icon: "◨", shortcut: "G P", action: () => router.push("/projects") },
    { id: "ingest", label: "Go to Data Ingest", section: "Navigate", icon: "↓", shortcut: "G I", action: () => router.push("/ingest") },
    { id: "ai-runs", label: "Go to AI Runs", section: "Navigate", icon: "⚡", action: () => router.push("/dashboard/ai-runs") },
    { id: "new-project", label: "Create New Project", section: "Actions", icon: "+", action: () => router.push("/projects") },
    { id: "run-ingest", label: "Run Data Ingest", section: "Actions", icon: "▶", action: () => router.push("/ingest") },
    // Project-context commands (only shown when inside a project)
    ...(currentProjectId
      ? [
          { id: "proj-overview", label: "Project Overview", section: "Project", icon: "◉", action: () => router.push(`/projects/${currentProjectId}`) },
          { id: "proj-discovery", label: "Discovery", section: "Project", icon: "🔍", action: () => router.push(`/projects/${currentProjectId}/discovery`) },
          { id: "proj-assumptions", label: "Assumptions", section: "Project", icon: "✓", action: () => router.push(`/projects/${currentProjectId}/assumptions`) },
          { id: "proj-topology", label: "Topology", section: "Project", icon: "◎", action: () => router.push(`/projects/${currentProjectId}/topology`) },
          { id: "proj-cicd", label: "CI/CD Playbook", section: "Project", icon: "⚙", action: () => router.push(`/projects/${currentProjectId}/cicd`) },
          { id: "proj-blockers", label: "Blockers", section: "Project", icon: "⚠", action: () => router.push(`/projects/${currentProjectId}/blockers`) },
          { id: "proj-updates", label: "Cascade Updates", section: "Project", icon: "↻", action: () => router.push(`/projects/${currentProjectId}/updates`) },
          { id: "proj-brief", label: "View Discovery Brief", section: "Project", icon: "📄", action: () => router.push(`/projects/${currentProjectId}/discovery/brief`) },
        ]
      : []),
  ];

  const filtered = query.trim()
    ? commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.section.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  // Keyboard handler — supports Cmd+K, Escape, and G+key vim-style shortcuts
  const gKeyRef = useRef(false);
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable) {
        // Allow Cmd+K even in inputs
        if (!((e.metaKey || e.ctrlKey) && e.key === "k")) return;
      }

      // Open: Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        setSelectedIdx(0);
        return;
      }

      // Escape to close
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }

      // Vim-style G+key shortcuts (only when palette is closed)
      if (!open) {
        if (e.key === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
          if (gKeyRef.current) return; // already waiting
          gKeyRef.current = true;
          if (gTimerRef.current) clearTimeout(gTimerRef.current);
          gTimerRef.current = setTimeout(() => { gKeyRef.current = false; }, 500);
          return;
        }

        if (gKeyRef.current) {
          gKeyRef.current = false;
          if (gTimerRef.current) clearTimeout(gTimerRef.current);
          const key = e.key.toLowerCase();
          if (key === "d") { e.preventDefault(); router.push("/dashboard"); }
          else if (key === "p") { e.preventDefault(); router.push("/projects"); }
          else if (key === "i") { e.preventDefault(); router.push("/ingest"); }
          else if (key === "a" && currentProjectId) { e.preventDefault(); router.push(`/projects/${currentProjectId}/assumptions`); }
          else if (key === "b" && currentProjectId) { e.preventDefault(); router.push(`/projects/${currentProjectId}/blockers`); }
          else if (key === "c" && currentProjectId) { e.preventDefault(); router.push(`/projects/${currentProjectId}/cicd`); }
          else if (key === "u" && currentProjectId) { e.preventDefault(); router.push(`/projects/${currentProjectId}/updates`); }
        }
      }
    },
    [open, router, currentProjectId]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const handleSelect = (cmd: Command) => {
    setOpen(false);
    cmd.action();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIdx]) {
      e.preventDefault();
      handleSelect(filtered[selectedIdx]);
    }
  };

  if (!open) return null;

  // Group by section
  const sections = new Map<string, Command[]>();
  for (const cmd of filtered) {
    const group = sections.get(cmd.section) || [];
    group.push(cmd);
    sections.set(cmd.section, group);
  }

  let flatIdx = 0;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[15vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)" }}
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div
        className="relative w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-bright)",
          boxShadow: "0 0 60px rgba(6, 214, 214, 0.08)",
        }}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="var(--foreground-dim)" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleInputKeyDown}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--foreground)" }}
            aria-label="Search commands"
          />
          <kbd
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{
              background: "var(--background)",
              color: "var(--foreground-dim)",
              border: "1px solid var(--border)",
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto py-2" role="listbox">
          {filtered.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: "var(--foreground-dim)" }}>
              No results found
            </p>
          ) : (
            Array.from(sections.entries()).map(([section, cmds]) => (
              <div key={section} role="group" aria-label={section}>
                <p
                  className="text-[10px] uppercase tracking-wider font-semibold px-4 py-1.5"
                  style={{ color: "var(--foreground-dim)" }}
                >
                  {section}
                </p>
                {cmds.map((cmd) => {
                  const thisIdx = flatIdx++;
                  const isSelected = thisIdx === selectedIdx;
                  return (
                    <button
                      key={cmd.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(cmd)}
                      onMouseEnter={() => setSelectedIdx(thisIdx)}
                      className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors"
                      style={{
                        background: isSelected ? "var(--surface-hover)" : "transparent",
                        color: isSelected ? "var(--accent-cyan)" : "var(--foreground)",
                      }}
                    >
                      {cmd.icon && (
                        <span className="w-5 text-center text-xs" style={{ color: "var(--foreground-dim)" }}>
                          {cmd.icon}
                        </span>
                      )}
                      <span className="flex-1">{cmd.label}</span>
                      {cmd.shortcut && (
                        <kbd className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--background)", color: "var(--foreground-dim)", border: "1px solid var(--border)" }}>
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="px-4 py-2 flex items-center gap-4" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
            <kbd className="px-1 py-0.5 rounded" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>↑↓</kbd> navigate
          </span>
          <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
            <kbd className="px-1 py-0.5 rounded" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>↵</kbd> select
          </span>
          <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
            <kbd className="px-1 py-0.5 rounded" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>G</kbd> + key for quick nav
          </span>
        </div>
      </div>
    </div>
  );
}
