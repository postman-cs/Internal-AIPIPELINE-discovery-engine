"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

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

  // Commands
  const commands: Command[] = [
    { id: "dashboard", label: "Go to Dashboard", section: "Navigate", icon: "◫", action: () => router.push("/dashboard") },
    { id: "projects", label: "Go to Projects", section: "Navigate", icon: "◨", action: () => router.push("/projects") },
    { id: "ingest", label: "Go to Data Ingest", section: "Navigate", icon: "↓", action: () => router.push("/ingest") },
    { id: "ai-runs", label: "Go to AI Runs", section: "Navigate", icon: "⚡", action: () => router.push("/dashboard/ai-runs") },
    { id: "new-project", label: "Create New Project", section: "Actions", icon: "+", action: () => router.push("/projects") },
    { id: "run-ingest", label: "Run Data Ingest", section: "Actions", icon: "▶", action: () => router.push("/ingest") },
  ];

  const filtered = query.trim()
    ? commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.section.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  // Keyboard handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
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
      }
    },
    [open]
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
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[15vh]">
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
          <span style={{ color: "var(--foreground-dim)" }}>⌘</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleInputKeyDown}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--foreground)" }}
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
        <div className="max-h-64 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: "var(--foreground-dim)" }}>
              No results found
            </p>
          ) : (
            Array.from(sections.entries()).map(([section, cmds]) => (
              <div key={section}>
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
                      onClick={() => handleSelect(cmd)}
                      onMouseEnter={() => setSelectedIdx(thisIdx)}
                      className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors"
                      style={{
                        background: isSelected ? "var(--surface-hover)" : "transparent",
                        color: isSelected ? "var(--accent-cyan)" : "var(--foreground)",
                      }}
                    >
                      {cmd.icon && (
                        <span className="w-5 text-center" style={{ color: "var(--foreground-dim)" }}>
                          {cmd.icon}
                        </span>
                      )}
                      <span className="flex-1">{cmd.label}</span>
                      {cmd.shortcut && (
                        <kbd className="text-[10px] px-1 py-0.5 rounded" style={{ background: "var(--background)", color: "var(--foreground-dim)", border: "1px solid var(--border)" }}>
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
      </div>
    </div>
  );
}
