"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { globalSearch } from "@/lib/actions/search";

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

interface SearchResult {
  id: string;
  type: string;
  url: string;
  title: string;
  snippet?: string;
  meta?: string;
}

const SEARCH_ICONS: Record<string, { icon: string; color: string }> = {
  project: { icon: "◨", color: "var(--accent-cyan)" },
  document: { icon: "◫", color: "var(--accent-green)" },
  assumption: { icon: "✓", color: "var(--accent-yellow)" },
  blocker: { icon: "⚠", color: "var(--accent-red, #f87171)" },
};

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "rgba(6,214,214,0.2)", color: "var(--accent-cyan)", borderRadius: 2 }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const projectMatch = pathname.match(/\/projects\/([^/]+)/);
  const currentProjectId = projectMatch?.[1] ?? null;

  const commands: Command[] = [
    { id: "dashboard", label: "Go to Dashboard", section: "Navigate", icon: "◫", shortcut: "G D", action: () => router.push("/dashboard") },
    { id: "projects", label: "Go to Projects", section: "Navigate", icon: "◨", shortcut: "G P", action: () => router.push("/projects") },
    { id: "ingest", label: "Go to Data Ingest", section: "Navigate", icon: "↓", shortcut: "G I", action: () => router.push("/ingest") },
    { id: "ai-runs", label: "Go to AI Runs", section: "Navigate", icon: "⚡", action: () => router.push("/dashboard/ai-runs") },
    { id: "new-project", label: "Create New Project", section: "Actions", icon: "+", action: () => router.push("/projects") },
    { id: "run-ingest", label: "Run Data Ingest", section: "Actions", icon: "▶", action: () => router.push("/ingest") },
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

  const filteredCommands = query.trim()
    ? commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.section.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await globalSearch(query);
        const results: SearchResult[] = [];
        for (const p of data.results.projects) {
          results.push({ id: p.id, type: "project", url: p.url, title: p.name, meta: p.primaryDomain ?? undefined });
        }
        for (const d of data.results.documents) {
          results.push({ id: d.id, type: "document", url: d.url, title: d.title ?? "Untitled", snippet: d.snippet ?? undefined, meta: d.sourceType });
        }
        for (const a of data.results.assumptions) {
          results.push({ id: a.id, type: "assumption", url: a.url, title: a.claim, meta: `${a.phase} · ${a.status}` });
        }
        for (const b of data.results.blockers) {
          results.push({ id: b.id, type: "blocker", url: b.url, title: b.title, meta: `${b.severity} · ${b.status}` });
        }
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open]);

  const totalItems = filteredCommands.length + searchResults.length;

  const gKeyRef = useRef(false);
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable) {
        if (!((e.metaKey || e.ctrlKey) && e.key === "k")) return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery("");
        setSelectedIdx(0);
        setSearchResults([]);
        return;
      }

      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }

      if (!open) {
        if (e.key === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
          if (gKeyRef.current) return;
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
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const handleSelect = (cmd: Command) => {
    setOpen(false);
    cmd.action();
  };

  const handleSearchSelect = (result: SearchResult) => {
    setOpen(false);
    router.push(result.url);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(prev + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIdx < filteredCommands.length) {
        const cmd = filteredCommands[selectedIdx];
        if (cmd) handleSelect(cmd);
      } else {
        const sr = searchResults[selectedIdx - filteredCommands.length];
        if (sr) handleSearchSelect(sr);
      }
    }
  };

  if (!open) return null;

  const commandSections = new Map<string, Command[]>();
  for (const cmd of filteredCommands) {
    const group = commandSections.get(cmd.section) || [];
    group.push(cmd);
    commandSections.set(cmd.section, group);
  }

  const searchSections = new Map<string, SearchResult[]>();
  for (const sr of searchResults) {
    const label = sr.type === "project" ? "Projects" : sr.type === "document" ? "Documents" : sr.type === "assumption" ? "Assumptions" : "Blockers";
    const group = searchSections.get(label) || [];
    group.push(sr);
    searchSections.set(label, group);
  }

  let flatIdx = 0;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[15vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)" }}
        onClick={() => setOpen(false)}
      />

      <div
        className="relative w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-in"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-bright)",
          boxShadow: "0 0 60px rgba(6, 214, 214, 0.08)",
        }}
      >
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
          {searching && (
            <div className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent-cyan)", borderTopColor: "transparent" }} />
          )}
          <kbd
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: "var(--background)", color: "var(--foreground-dim)", border: "1px solid var(--border)" }}
          >
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-2" role="listbox">
          {totalItems === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: "var(--foreground-dim)" }}>
              {searching ? "Searching..." : "No results found"}
            </p>
          ) : (
            <>
              {Array.from(commandSections.entries()).map(([section, cmds]) => (
                <div key={section} role="group" aria-label={section}>
                  <p className="text-[10px] uppercase tracking-wider font-semibold px-4 py-1.5" style={{ color: "var(--foreground-dim)" }}>
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
                          <span className="w-5 text-center text-xs" style={{ color: "var(--foreground-dim)" }}>{cmd.icon}</span>
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
              ))}

              {searchResults.length > 0 && (
                <div style={{ borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 4 }}>
                  {Array.from(searchSections.entries()).map(([section, items]) => {
                    const typeKey = items[0]?.type ?? "project";
                    const icon = SEARCH_ICONS[typeKey] ?? SEARCH_ICONS.project;
                    return (
                      <div key={section} role="group" aria-label={section}>
                        <p className="text-[10px] uppercase tracking-wider font-semibold px-4 py-1.5" style={{ color: "var(--foreground-dim)" }}>
                          {section}
                        </p>
                        {items.map((sr) => {
                          const thisIdx = flatIdx++;
                          const isSelected = thisIdx === selectedIdx;
                          return (
                            <button
                              key={sr.id}
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => handleSearchSelect(sr)}
                              onMouseEnter={() => setSelectedIdx(thisIdx)}
                              className="w-full flex items-start gap-3 px-4 py-2 text-left transition-colors"
                              style={{
                                background: isSelected ? "var(--surface-hover)" : "transparent",
                              }}
                            >
                              <span className="w-5 text-center text-xs mt-0.5 shrink-0" style={{ color: icon.color }}>{icon.icon}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate" style={{ color: isSelected ? "var(--accent-cyan)" : "var(--foreground)" }}>
                                  {highlightMatch(sr.title, query)}
                                </p>
                                {sr.snippet && (
                                  <p className="text-[11px] truncate mt-0.5" style={{ color: "var(--foreground-dim)" }}>
                                    {highlightMatch(sr.snippet, query)}
                                  </p>
                                )}
                                {sr.meta && (
                                  <p className="text-[10px] mt-0.5" style={{ color: "var(--foreground-dim)" }}>{sr.meta}</p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

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
