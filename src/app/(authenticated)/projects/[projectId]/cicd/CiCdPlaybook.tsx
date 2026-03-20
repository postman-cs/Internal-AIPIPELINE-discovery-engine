"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CodeSnippet } from "@/components/CodeSnippet";
import { PlatformTabs } from "@/components/PlatformTabs";
import type { CiCdPlaybookData } from "@/lib/actions/cicd";

import { LazyCanvas } from "@/components/LazyCanvas";

const PulseStreamView = dynamic(() => import("./PulseStreamView"), { ssr: false });

interface CiCdPlaybookProps {
  data: CiCdPlaybookData;
  projectId: string;
}

// ---------------------------------------------------------------------------
// Shared SVG Icons
// ---------------------------------------------------------------------------

function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`${className || "w-4 h-4"} transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CollectionIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function TestIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5" />
    </svg>
  );
}

function PipelineIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function DeployIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  );
}

function GateIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V7.125C3 6.504 3.504 6 4.125 6h3.375" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Stats summary bar
// ---------------------------------------------------------------------------

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  if (value === 0) return null;
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}
    >
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
        style={{ background: "rgba(6, 214, 214, 0.06)", color: "var(--accent-cyan)" }}
      >
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold tabular-nums leading-none" style={{ color: "var(--foreground)" }}>
          {value}
        </p>
        <p className="text-[10px] mt-0.5 leading-none" style={{ color: "var(--foreground-dim)" }}>
          {label}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

function Section({
  id,
  title,
  description,
  badge,
  icon,
  defaultOpen = true,
  children,
}: {
  id: string;
  title: string;
  description: string;
  badge?: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
      id={id}
    >
      {/* Clickable header */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors duration-150"
        style={{ background: open ? "transparent" : "transparent" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.015)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "rgba(6, 214, 214, 0.06)", color: "var(--accent-cyan)" }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {title}
            </h2>
            {badge && (
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: "rgba(6, 214, 214, 0.08)", color: "var(--accent-cyan)" }}
              >
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--foreground-dim)" }}>
            {description}
          </p>
        </div>
        <ChevronIcon open={open} className="w-4 h-4 shrink-0" />
      </button>

      {/* Content */}
      {open && (
        <div className="px-5 pb-5" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty phase card
// ---------------------------------------------------------------------------

function EmptyPhaseCard({ phase, projectId }: { phase: string; projectId: string }) {
  return (
    <div
      className="rounded-lg p-5 text-center"
      style={{ background: "rgba(255,255,255,0.015)", border: "1px dashed var(--border)" }}
    >
      <p className="text-sm mb-1" style={{ color: "var(--foreground-muted)" }}>
        No data generated yet
      </p>
      <p className="text-xs mb-3" style={{ color: "var(--foreground-dim)" }}>
        Run the <span className="font-medium">{phase.replace(/_/g, " ")}</span> phase to generate this content.
      </p>
      <Link
        href={`/projects/${projectId}/updates`}
        className="btn-secondary text-xs inline-block py-1.5 px-3"
      >
        Run Cascade Updates
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HTTP method color helper
// ---------------------------------------------------------------------------

const METHOD_STYLES: Record<string, { bg: string; color: string }> = {
  GET:     { bg: "rgba(16,185,129,0.1)",  color: "#34d399" },
  POST:    { bg: "rgba(59,130,246,0.1)",  color: "#60a5fa" },
  PUT:     { bg: "rgba(245,158,11,0.1)",  color: "#fbbf24" },
  PATCH:   { bg: "rgba(168,85,247,0.1)",  color: "#a78bfa" },
  DELETE:  { bg: "rgba(239,68,68,0.1)",   color: "#f87171" },
  HEAD:    { bg: "rgba(6,214,214,0.08)",  color: "#06d6d6" },
  OPTIONS: { bg: "rgba(255,255,255,0.04)", color: "var(--foreground-dim)" },
};

// ---------------------------------------------------------------------------
// Collection card
// ---------------------------------------------------------------------------

function CollectionCard({ collection }: { collection: CiCdPlaybookData["postmanCollections"][0] }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const collectionJson = useMemo(() => JSON.stringify({
    info: {
      name: collection.name,
      description: collection.description,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: collection.folders.map((f) => ({
      name: f.name,
      item: f.requests.map((r) => ({
        name: r.name,
        request: {
          method: r.method,
          url: { raw: r.urlPattern },
          description: r.description,
        },
      })),
    })),
  }, null, 2), [collection]);

  const totalRequests = collection.folders.reduce((sum, f) => sum + f.requests.length, 0);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(collectionJson);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = collectionJson;
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
  }, [collectionJson]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([collectionJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${collection.name.replace(/\s+/g, "-").toLowerCase()}.postman_collection.json`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }, [collectionJson, collection.name]);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => setExpanded((p) => !p)} className="shrink-0">
            <ChevronIcon open={expanded} className="w-3.5 h-3.5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>
                {collection.name}
              </h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: "rgba(255,255,255,0.04)", color: "var(--foreground-dim)" }}>
                {collection.folders.length} folder{collection.folders.length !== 1 ? "s" : ""} / {totalRequests} request{totalRequests !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--foreground-dim)" }}>
              {collection.description}
            </p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0 ml-2">
          <button
            onClick={handleCopy}
            className="text-[11px] px-2.5 py-1.5 rounded-md transition-all duration-200 font-medium"
            style={{
              color: copied ? "var(--accent-green)" : "var(--foreground-dim)",
              background: copied ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.03)",
              border: "1px solid " + (copied ? "rgba(16,185,129,0.15)" : "var(--border)"),
            }}
          >
            {copied ? "Copied!" : "Copy JSON"}
          </button>
          <button
            onClick={handleDownload}
            className="text-[11px] px-2.5 py-1.5 rounded-md transition-all duration-200 font-medium"
            style={{
              color: "var(--accent-cyan)",
              background: "rgba(6, 214, 214, 0.04)",
              border: "1px solid rgba(6, 214, 214, 0.1)",
            }}
          >
            Import to Postman
          </button>
        </div>
      </div>

      {/* Folder tree */}
      {expanded && (
        <div
          className="px-4 pb-3 space-y-2"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="pt-3">
            {collection.folders.map((folder) => (
              <div key={folder.name} className="mb-2 last:mb-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--foreground-dim)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                  <span className="text-xs font-medium" style={{ color: "var(--foreground-muted)" }}>
                    {folder.name}
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
                    ({folder.requests.length})
                  </span>
                </div>
                <div className="ml-5 space-y-0.5">
                  {folder.requests.map((req) => {
                    const ms = METHOD_STYLES[req.method] ?? METHOD_STYLES.OPTIONS;
                    return (
                      <div key={`${req.method}-${req.name}`} className="flex items-center gap-2 text-xs py-0.5">
                        <span
                          className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded w-14 text-center shrink-0"
                          style={{ background: ms.bg, color: ms.color }}
                        >
                          {req.method}
                        </span>
                        <span className="font-medium" style={{ color: "var(--foreground)" }}>{req.name}</span>
                        <span className="font-mono truncate" style={{ color: "var(--foreground-dim)" }}>
                          {req.urlPattern}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Test type badge color helper
// ---------------------------------------------------------------------------

const TEST_TYPE_STYLES: Record<string, { bg: string; color: string }> = {
  Smoke:       { bg: "rgba(16,185,129,0.1)",  color: "#34d399" },
  Contract:    { bg: "rgba(168,85,247,0.1)",  color: "#a78bfa" },
  Integration: { bg: "rgba(59,130,246,0.1)",  color: "#60a5fa" },
  Load:        { bg: "rgba(245,158,11,0.1)",  color: "#fbbf24" },
};

// ---------------------------------------------------------------------------
// Main Playbook
// ---------------------------------------------------------------------------

export function CiCdPlaybook({ data, projectId }: CiCdPlaybookProps) {
  const [testTypeFilter, setTestTypeFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");

  // Unique test types and platform labels for filters
  const testTypes = useMemo(() => [...new Set(data.testCases.map((t) => t.testType))], [data.testCases]);
  const stagePlatforms = useMemo(() => [...new Set(data.ciCdStages.map((s) => s.platformLabel))], [data.ciCdStages]);

  const filteredTests = useMemo(
    () => testTypeFilter === "all" ? data.testCases : data.testCases.filter((t) => t.testType === testTypeFilter),
    [data.testCases, testTypeFilter],
  );
  const filteredStages = useMemo(
    () => stageFilter === "all" ? data.ciCdStages : data.ciCdStages.filter((s) => s.platformLabel === stageFilter),
    [data.ciCdStages, stageFilter],
  );

  if (!data.hasData) {
    return (
      <div
        className="rounded-xl p-10 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: "rgba(6, 214, 214, 0.06)", border: "1px solid rgba(6, 214, 214, 0.1)" }}
        >
          <PipelineIcon />
        </div>
        <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
          No CI/CD Data Yet
        </h2>
        <p className="text-sm mb-5 max-w-lg mx-auto leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
          Run the AI pipeline through the Cascade Updates page to generate Postman collections,
          Newman configurations, and CI/CD pipeline definitions for your customer&apos;s infrastructure.
        </p>
        <Link href={`/projects/${projectId}/updates`} className="btn-primary text-sm inline-block">
          Run Cascade Updates
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ---------- Pulse Stream Visualization ---------- */}
      <LazyCanvas>
        <PulseStreamView
          stages={data.ciCdStages}
          gates={data.environmentPromotionGates}
          monitors={[]}
          pipelines={data.ciCdPipelines}
          hasData={data.hasData}
        />
      </LazyCanvas>

      {/* ---------- Stats Summary ---------- */}
      <div className="flex flex-wrap gap-2">
        <StatCard label="Collections" value={data.postmanCollections.length} icon={<CollectionIcon />} />
        <StatCard label="Newman Configs" value={data.newmanRunConfigs.length} icon={<TerminalIcon />} />
        <StatCard label="Test Scripts" value={data.testCases.length} icon={<TestIcon />} />
        <StatCard label="Pipelines" value={data.ciCdPipelines.length} icon={<PipelineIcon />} />
        <StatCard label="Deploy Stages" value={data.ciCdStages.length} icon={<DeployIcon />} />
        <StatCard label="Promotion Gates" value={data.environmentPromotionGates.length} icon={<GateIcon />} />
        <StatCard label="Monitors" value={0} icon={<MonitorIcon />} />
      </div>

      {/* ---------- Phase version pills ---------- */}
      {Object.keys(data.phaseVersions).length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          <span className="text-[10px] font-medium mr-1 self-center" style={{ color: "var(--foreground-dim)" }}>
            Data from:
          </span>
          {Object.entries(data.phaseVersions).map(([phase, version]) => (
            <span
              key={phase}
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                background: "rgba(16,185,129,0.06)",
                color: "var(--accent-green)",
                border: "1px solid rgba(16,185,129,0.12)",
              }}
            >
              {phase.replace(/_/g, " ")} v{version}
            </span>
          ))}
        </div>
      )}

      {/* ---------- 1. Postman Collections ---------- */}
      <Section
        id="collections"
        title="Postman Collections"
        description="Collection stubs ready to import into Postman. Download as JSON or copy to clipboard."
        badge={data.postmanCollections.length ? `${data.postmanCollections.length}` : undefined}
        icon={<CollectionIcon />}
      >
        {data.postmanCollections.length > 0 ? (
          <div className="space-y-3">
            {data.postmanCollections.map((c) => (
              <CollectionCard key={c.name} collection={c} />
            ))}
          </div>
        ) : (
          <EmptyPhaseCard phase="CRAFT_SOLUTION" projectId={projectId} />
        )}
      </Section>

      {/* ---------- 2. Newman Configurations ---------- */}
      <Section
        id="newman"
        title="Newman Run Configurations"
        description="Newman CLI commands for running collections in CI/CD across environments."
        badge={data.newmanRunConfigs.length ? `${data.newmanRunConfigs.length}` : undefined}
        icon={<TerminalIcon />}
      >
        {data.newmanRunConfigs.length > 0 ? (
          <div className="space-y-4">
            {data.newmanRunConfigs.map((config) => {
              const parts = [
                `newman run ${config.collectionRef.replace(/\s+/g, "-").toLowerCase()}.postman_collection.json`,
                `-e ${config.environmentRef}.postman_environment.json`,
                `--reporters ${config.reporters.join(",")}`,
              ];
              if (config.reporters.includes("junit")) {
                parts.push(`--reporter-junit-export results/${config.environmentRef}-results.xml`);
              }
              if (config.bailOnFailure) {
                parts.push("--bail");
              }
              const cmd = parts.join(" \\\n  ");

              return (
                <div key={config.name}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                      {config.name}
                    </h3>
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(245,158,11,0.08)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.12)" }}
                    >
                      {config.environmentRef}
                    </span>
                    {config.bailOnFailure && (
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(239,68,68,0.06)", color: "#f87171", border: "1px solid rgba(239,68,68,0.1)" }}
                      >
                        bail on failure
                      </span>
                    )}
                    <span className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
                      Reporters: {config.reporters.join(", ")}
                    </span>
                  </div>
                  <p className="text-xs mb-2" style={{ color: "var(--foreground-dim)" }}>
                    {config.description}
                  </p>
                  <CodeSnippet code={cmd} language="bash" showLineNumbers={false} />
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyPhaseCard phase="CRAFT_SOLUTION" projectId={projectId} />
        )}
      </Section>

      {/* ---------- 3. Test Scripts ---------- */}
      {data.testCases.length > 0 && (
        <Section
          id="tests"
          title="Postman Test Scripts"
          description="pm.test() assertion snippets. Copy into Postman's Tests tab."
          badge={`${data.testCases.length}`}
          icon={<TestIcon />}
        >
          {/* Filter bar */}
          {testTypes.length > 1 && (
            <div className="flex items-center gap-1.5 mb-4">
              <span className="text-[10px] font-medium mr-1" style={{ color: "var(--foreground-dim)" }}>
                Filter:
              </span>
              <button
                onClick={() => setTestTypeFilter("all")}
                className="text-[10px] px-2 py-1 rounded-md font-medium transition-colors"
                style={{
                  background: testTypeFilter === "all" ? "rgba(6,214,214,0.08)" : "rgba(255,255,255,0.02)",
                  color: testTypeFilter === "all" ? "var(--accent-cyan)" : "var(--foreground-dim)",
                  border: testTypeFilter === "all" ? "1px solid rgba(6,214,214,0.12)" : "1px solid var(--border)",
                }}
              >
                All ({data.testCases.length})
              </button>
              {testTypes.map((type) => {
                const ts = TEST_TYPE_STYLES[type] ?? TEST_TYPE_STYLES.Load;
                const count = data.testCases.filter((t) => t.testType === type).length;
                const active = testTypeFilter === type;
                return (
                  <button
                    key={type}
                    onClick={() => setTestTypeFilter(active ? "all" : type)}
                    className="text-[10px] px-2 py-1 rounded-md font-medium transition-colors"
                    style={{
                      background: active ? ts.bg : "rgba(255,255,255,0.02)",
                      color: active ? ts.color : "var(--foreground-dim)",
                      border: `1px solid ${active ? ts.color + "25" : "var(--border)"}`,
                    }}
                  >
                    {type} ({count})
                  </button>
                );
              })}
            </div>
          )}

          <div className="space-y-4">
            {filteredTests.map((tc) => {
              const ts = TEST_TYPE_STYLES[tc.testType] ?? TEST_TYPE_STYLES.Load;
              return (
                <div key={tc.name}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                      {tc.name}
                    </h3>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{ background: ts.bg, color: ts.color }}
                    >
                      {tc.testType}
                    </span>
                    <span className="text-[10px] font-mono" style={{ color: "var(--foreground-dim)" }}>
                      {tc.targetComponentId}
                    </span>
                  </div>
                  {tc.postmanTestScript && (
                    <CodeSnippet code={tc.postmanTestScript} language="javascript" className="mb-2" />
                  )}
                  {tc.newmanCommand && (
                    <CodeSnippet code={tc.newmanCommand} language="bash" showLineNumbers={false} />
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ---------- 4. CI/CD Pipelines ---------- */}
      <Section
        id="pipelines"
        title="CI/CD Pipeline Configs"
        description="Complete, copy-paste-ready pipeline files for each platform."
        badge={data.ciCdPipelines.length ? `${data.ciCdPipelines.length}` : undefined}
        icon={<PipelineIcon />}
      >
        {data.ciCdPipelines.length > 0 ? (
          <PlatformTabs pipelines={data.ciCdPipelines} />
        ) : (
          <EmptyPhaseCard phase="CRAFT_SOLUTION" projectId={projectId} />
        )}
      </Section>

      {/* ---------- 5. Deployment Stages ---------- */}
      {data.ciCdStages.length > 0 && (
        <Section
          id="stages"
          title="Deployment Stages"
          description="Pipeline stage definitions for deployment workflows."
          badge={`${data.ciCdStages.length}`}
          icon={<DeployIcon />}
        >
          {/* Platform filter */}
          {stagePlatforms.length > 1 && (
            <div className="flex items-center gap-1.5 mb-4">
              <span className="text-[10px] font-medium mr-1" style={{ color: "var(--foreground-dim)" }}>
                Platform:
              </span>
              <button
                onClick={() => setStageFilter("all")}
                className="text-[10px] px-2 py-1 rounded-md font-medium transition-colors"
                style={{
                  background: stageFilter === "all" ? "rgba(6,214,214,0.08)" : "rgba(255,255,255,0.02)",
                  color: stageFilter === "all" ? "var(--accent-cyan)" : "var(--foreground-dim)",
                  border: stageFilter === "all" ? "1px solid rgba(6,214,214,0.12)" : "1px solid var(--border)",
                }}
              >
                All
              </button>
              {stagePlatforms.map((p) => {
                const active = stageFilter === p;
                return (
                  <button
                    key={p}
                    onClick={() => setStageFilter(active ? "all" : p)}
                    className="text-[10px] px-2 py-1 rounded-md font-medium transition-colors"
                    style={{
                      background: active ? "rgba(6,214,214,0.08)" : "rgba(255,255,255,0.02)",
                      color: active ? "var(--accent-cyan)" : "var(--foreground-dim)",
                      border: active ? "1px solid rgba(6,214,214,0.12)" : "1px solid var(--border)",
                    }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          )}

          <div className="space-y-4">
            {filteredStages.map((stage, i) => (
              <div key={`${stage.stageName}-${i}`}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    {stage.stageName}
                  </h3>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    style={{ background: "rgba(6, 214, 214, 0.06)", color: "var(--accent-cyan)", border: "1px solid rgba(6,214,214,0.1)" }}
                  >
                    {stage.platformLabel}
                  </span>
                </div>
                <div className="flex items-center gap-4 mb-2 text-xs" style={{ color: "var(--foreground-dim)" }}>
                  <span><span className="font-medium" style={{ color: "var(--foreground-muted)" }}>Trigger:</span> {stage.triggerCondition}</span>
                  <span><span className="font-medium" style={{ color: "var(--foreground-muted)" }}>Gates:</span> {stage.gateChecks.join(", ")}</span>
                </div>
                <CodeSnippet code={stage.configSnippet} language={stage.configLanguage} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ---------- 6. Environment Promotion Gates ---------- */}
      {data.environmentPromotionGates.length > 0 && (
        <Section
          id="gates"
          title="Environment Promotion Gates"
          description="Rules governing promotion between environments."
          icon={<GateIcon />}
        >
          {/* Visual pipeline flow */}
          <div className="space-y-3">
            {data.environmentPromotionGates.map((gate, i) => (
              <div
                key={i}
                className="flex items-stretch rounded-lg overflow-hidden"
                style={{ border: "1px solid var(--border)" }}
              >
                {/* From env */}
                <div
                  className="flex items-center justify-center px-4 py-3 shrink-0"
                  style={{ background: "rgba(255,255,255,0.02)", minWidth: "100px" }}
                >
                  <span className="text-xs font-bold" style={{ color: "var(--foreground)" }}>
                    {gate.fromEnv}
                  </span>
                </div>

                {/* Arrow + checks */}
                <div
                  className="flex-1 flex items-center gap-3 px-4 py-3"
                  style={{ background: "rgba(255,255,255,0.01)" }}
                >
                  <svg className="w-5 h-5 shrink-0" style={{ color: "var(--accent-cyan)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-1 mb-1">
                      {gate.requiredChecks.map((check, ci) => (
                        <span
                          key={ci}
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: "rgba(255,255,255,0.03)", color: "var(--foreground-dim)", border: "1px solid var(--border)" }}
                        >
                          {check}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{
                          background: gate.approvalRequired ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.06)",
                          color: gate.approvalRequired ? "#fbbf24" : "#34d399",
                          border: `1px solid ${gate.approvalRequired ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.1)"}`,
                        }}
                      >
                        {gate.approvalRequired ? "Manual Approval" : "Auto-promote"}
                      </span>
                      {gate.newmanSuiteRef && (
                        <span className="text-[10px] font-mono" style={{ color: "var(--foreground-dim)" }}>
                          Newman: {gate.newmanSuiteRef}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* To env */}
                <div
                  className="flex items-center justify-center px-4 py-3 shrink-0"
                  style={{ background: "rgba(6, 214, 214, 0.03)", minWidth: "100px" }}
                >
                  <span className="text-xs font-bold" style={{ color: "var(--accent-cyan)" }}>
                    {gate.toEnv}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Monitors section removed — monitoring phase deprecated */}

      {/* ---------- Notes ---------- */}
      {data.ciCdNotes.length > 0 && (
        <Section
          id="notes"
          title="Additional Notes"
          description="Free-form CI/CD guidance and considerations."
          icon={<NoteIcon />}
          defaultOpen={false}
        >
          <ul className="space-y-2">
            {data.ciCdNotes.map((note, i) => (
              <li
                key={i}
                className="text-sm flex items-start gap-2.5 px-3 py-2 rounded-lg"
                style={{ background: "rgba(255,255,255,0.015)", color: "var(--foreground-muted)" }}
              >
                <span className="mt-0.5 shrink-0" style={{ color: "var(--accent-cyan)" }}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" />
                  </svg>
                </span>
                {note}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
