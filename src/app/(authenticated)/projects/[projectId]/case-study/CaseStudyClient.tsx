"use client";

import { useState, useCallback } from "react";
import { CaseStudyView } from "./CaseStudyView";

interface Props {
  projectId: string;
  projectName: string;
  engagementStage: number;
  userLevel: number;
  missionCount: number;
  metrics: {
    aiRuns: number;
    blockersResolved: number;
    assumptionsVerified: number;
    sectionsWritten: number;
  };
  initialCaseStudyGenerated: boolean;
}

export default function CaseStudyClient({
  projectId,
  projectName,
  metrics,
  initialCaseStudyGenerated,
}: Props) {
  const [generated, setGenerated] = useState(initialCaseStudyGenerated);

  const handleGenerated = useCallback(() => {
    setGenerated(true);
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div
        className="rounded-xl p-6 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(6,10,20,0.9), rgba(15,23,42,0.95))",
          border: `1px solid ${generated ? "rgba(16,185,129,0.2)" : "rgba(99,102,241,0.15)"}`,
        }}
      >
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        <div className="relative flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              {projectName} — Case Study
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--foreground-dim)" }}>
              {generated
                ? "Case study generated from engagement data"
                : "Generate a case study from the build log and engagement history"
              }
            </p>
          </div>

          <div className="flex items-center gap-4">
            <MetricPill value={metrics.aiRuns} label="AI Runs" />
            <MetricPill value={metrics.sectionsWritten} label="Sections" />

            {generated && (
              <div
                className="px-4 py-2 rounded-lg text-xs font-semibold tracking-wide"
                style={{
                  background: "rgba(16,185,129,0.1)",
                  color: "#10b981",
                  border: "1px solid rgba(16,185,129,0.2)",
                }}
              >
                GENERATED
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Case Study Content */}
      <CaseStudyView
        projectId={projectId}
        projectName={projectName}
        onGenerated={handleGenerated}
      />
    </div>
  );
}

function MetricPill({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold tabular-nums" style={{ color: "var(--foreground)" }}>{value}</p>
      <p className="text-[9px]" style={{ color: "var(--foreground-dim)" }}>{label}</p>
    </div>
  );
}
