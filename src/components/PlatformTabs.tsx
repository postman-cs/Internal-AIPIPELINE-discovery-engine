"use client";

import { useState } from "react";
import { CodeSnippet } from "./CodeSnippet";

/**
 * Derive a short icon/tag from a platform slug.
 * If the platform is recognized, returns a familiar abbreviation;
 * otherwise takes the first 2 characters of the label.
 */
const KNOWN_ICONS: Record<string, string> = {
  github_actions: "GH",
  gitlab_ci: "GL",
  jenkins: "JK",
  circleci: "CI",
  azure_devops: "AZ",
  aws_codepipeline: "AWS",
  aws_codebuild: "AWS",
  bitbucket_pipelines: "BB",
  google_cloud_build: "GCB",
  tekton: "TK",
  drone: "DR",
  travis_ci: "TR",
  buildkite: "BK",
  teamcity: "TC",
  bamboo: "BA",
};

function platformIcon(platform: string, label: string): string {
  return KNOWN_ICONS[platform] ?? label.slice(0, 2).toUpperCase();
}

export interface PipelineConfig {
  platform: string;
  platformLabel: string;
  configLanguage: string;
  filename: string;
  description: string;
  configContent: string;
}

interface PlatformTabsProps {
  pipelines: PipelineConfig[];
  className?: string;
}

export function PlatformTabs({ pipelines, className }: PlatformTabsProps) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (pipelines.length === 0) return null;

  const current = pipelines[activeIdx] ?? pipelines[0];

  return (
    <div className={className}>
      {/* Tab bar */}
      <div className="flex flex-col gap-3">
        <div
          className="flex rounded-lg p-1 gap-1 flex-wrap"
          style={{ background: "rgba(6, 8, 15, 0.6)", border: "1px solid var(--border)" }}
        >
          {pipelines.map((p, idx) => {
            const isActive = idx === activeIdx;
            return (
              <button
                key={`${p.platform}-${idx}`}
                onClick={() => setActiveIdx(idx)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md transition-all duration-200 relative"
                style={{
                  background: isActive ? "var(--surface-hover)" : "transparent",
                  color: isActive ? "var(--foreground)" : "var(--foreground-dim)",
                  boxShadow: isActive
                    ? "0 0 0 1px var(--border-bright), 0 1px 3px rgba(0,0,0,0.2)"
                    : "none",
                }}
              >
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide"
                  style={{
                    background: isActive ? "rgba(6, 214, 214, 0.12)" : "rgba(255,255,255,0.04)",
                    color: isActive ? "var(--accent-cyan)" : "var(--foreground-dim)",
                    border: isActive ? "1px solid rgba(6, 214, 214, 0.15)" : "1px solid transparent",
                  }}
                >
                  {platformIcon(p.platform, p.platformLabel)}
                </span>
                <span>{p.platformLabel}</span>
                {isActive && (
                  <span
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded truncate max-w-[180px]"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      color: "var(--foreground-dim)",
                    }}
                  >
                    {p.filename}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Description row */}
        <div className="flex items-center gap-3 px-1">
          <p className="text-xs flex-1" style={{ color: "var(--foreground-dim)" }}>
            {current.description}
          </p>
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded shrink-0"
            style={{
              background: "rgba(255,255,255,0.03)",
              color: "var(--foreground-dim)",
              border: "1px solid var(--border)",
            }}
          >
            {current.configLanguage.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Code */}
      <div className="mt-3">
        <CodeSnippet
          code={current.configContent}
          language={current.configLanguage}
          filename={current.filename}
        />
      </div>
    </div>
  );
}
