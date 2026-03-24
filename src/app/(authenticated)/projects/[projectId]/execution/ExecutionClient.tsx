"use client";

import { useState, useCallback, useTransition } from "react";
import { DeploymentPlanView } from "./DeploymentPlanView";
import { executeDeploymentStep } from "@/lib/actions/deployment";

interface DeploymentStep {
  phase?: string;
  title?: string;
  name?: string;
  description?: string;
  estimatedDuration?: string;
}

interface ExecutionClientProps {
  projectId: string;
  projectName: string;
  userLevel: number;
  contentJson: Record<string, unknown>;
  initialExecutedSteps: number[];
}

export function ExecutionClient({
  projectId,
  projectName,
  contentJson,
  initialExecutedSteps,
}: ExecutionClientProps) {
  const [executedSteps, setExecutedSteps] = useState<number[]>(initialExecutedSteps);
  const [executingStep, setExecutingStep] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const steps = (contentJson.deploymentSteps ?? contentJson.rolloutTimeline ?? contentJson.steps ?? contentJson.timeline ?? []) as DeploymentStep[];

  const handleExecuteStep = useCallback((stepIndex: number, stepTitle: string) => {
    setExecutingStep(stepIndex);
    startTransition(async () => {
      const result = await executeDeploymentStep(projectId, stepIndex, stepTitle);
      if (result.success) {
        setExecutedSteps((prev) => [...prev, stepIndex]);
      }
      setExecutingStep(null);
    });
  }, [projectId]);

  const completedCount = executedSteps.length;
  const totalCount = steps.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isComplete = completedCount === totalCount && totalCount > 0;

  return (
    <div className="space-y-8">
      {/* Execution Status Header */}
      <div
        className="rounded-xl p-6 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(6,10,20,0.9), rgba(15,23,42,0.95))",
          border: `1px solid ${isComplete ? "rgba(16,185,129,0.25)" : "rgba(99,102,241,0.2)"}`,
        }}
      >
        {/* Subtle grid background */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-5">
            {/* Progress ring */}
            <div className="relative w-16 h-16">
              <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="2.5"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={isComplete ? "#10b981" : "#6366f1"}
                  strokeWidth="2.5"
                  strokeDasharray={`${progress}, 100`}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dasharray 0.5s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold tabular-nums" style={{ color: isComplete ? "#10b981" : "#a5b4fc" }}>
                  {Math.round(progress)}%
                </span>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                {projectName}
              </h2>
              <p className="text-sm mt-0.5" style={{ color: "var(--foreground-dim)" }}>
                {isComplete
                  ? "All deployment steps executed"
                  : `${completedCount} of ${totalCount} deployment steps completed`
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status indicators */}
            <div className="flex items-center gap-4 text-xs" style={{ color: "var(--foreground-dim)" }}>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: "#10b981" }} />
                <span>{completedCount} Complete</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
                <span>{totalCount - completedCount} Remaining</span>
              </div>
            </div>

            {isComplete && (
              <div
                className="px-4 py-2 rounded-lg text-xs font-semibold tracking-wide"
                style={{
                  background: "rgba(16,185,129,0.1)",
                  color: "#10b981",
                  border: "1px solid rgba(16,185,129,0.2)",
                }}
              >
                DEPLOYMENT COMPLETE
              </div>
            )}
          </div>
        </div>

        {/* Timeline bar */}
        {totalCount > 0 && (
          <div className="mt-5 relative">
            <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-1 rounded-full transition-all duration-700"
                style={{
                  width: `${progress}%`,
                  background: isComplete
                    ? "linear-gradient(90deg, #10b981, #06d6a0)"
                    : "linear-gradient(90deg, #6366f1, #818cf8)",
                }}
              />
            </div>
            <div className="flex justify-between mt-2">
              {steps.map((step, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center"
                  style={{ width: `${100 / totalCount}%` }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full border-2 transition-all duration-300"
                    style={{
                      background: executedSteps.includes(i) ? (isComplete ? "#10b981" : "#6366f1") : "transparent",
                      borderColor: executedSteps.includes(i) ? (isComplete ? "#10b981" : "#6366f1") : "rgba(255,255,255,0.15)",
                    }}
                  />
                  <span
                    className="text-[8px] mt-1 text-center leading-tight max-w-[60px] truncate"
                    style={{ color: executedSteps.includes(i) ? "var(--foreground-muted)" : "var(--foreground-dim)" }}
                  >
                    {step.title || step.name || `Step ${i + 1}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Deployment Plan View */}
      <DeploymentPlanView
        data={contentJson}
        onExecuteStep={handleExecuteStep}
        executingStep={executingStep}
        executedSteps={executedSteps}
      />
    </div>
  );
}
