"use client";

import { useState, useCallback, useTransition } from "react";
import { MoonBaseMissionWrapper } from "./MoonBaseMissionWrapper";
import { DeploymentPlanView } from "./DeploymentPlanView";
import { executeDeploymentStep } from "@/lib/actions/deployment";
import type { DeploymentStepEntry } from "./MoonBaseMission";

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
  userLevel,
  contentJson,
  initialExecutedSteps,
}: ExecutionClientProps) {
  const [executedSteps, setExecutedSteps] = useState<number[]>(initialExecutedSteps);
  const [launchQueue, setLaunchQueue] = useState<number[]>([]);
  const [executingStep, setExecutingStep] = useState<number | null>(null);
  const [xpToast, setXpToast] = useState<{ points: number; title: string } | null>(null);
  const [, startTransition] = useTransition();

  const steps = (contentJson.deploymentSteps ?? contentJson.rolloutTimeline ?? contentJson.steps ?? contentJson.timeline ?? []) as DeploymentStep[];

  const deploymentStepEntries: DeploymentStepEntry[] = steps.map((step, i) => ({
    index: i,
    title: step.title || step.name || `Step ${i + 1}`,
    executed: executedSteps.includes(i),
  }));

  const handleExecuteStep = useCallback((stepIndex: number, stepTitle: string) => {
    setExecutingStep(stepIndex);
    startTransition(async () => {
      const result = await executeDeploymentStep(projectId, stepIndex, stepTitle);
      if (result.success) {
        setExecutedSteps((prev) => [...prev, stepIndex]);
        setLaunchQueue((prev) => [...prev, stepIndex]);
        setXpToast({ points: result.xp!.points, title: stepTitle });
        setTimeout(() => setXpToast(null), 3000);
      }
      setExecutingStep(null);
    });
  }, [projectId]);

  return (
    <div className="space-y-10">
      {/* Moon Base Mission Canvas */}
      <div className="relative">
        <MoonBaseMissionWrapper
          deploymentSteps={deploymentStepEntries}
          launchQueue={launchQueue}
          userLevel={userLevel}
          projectName={projectName}
        />

        {/* XP Toast */}
        {xpToast && (
          <div
            className="absolute top-4 right-4 rounded-xl px-4 py-3 z-20 animate-in slide-in-from-right"
            style={{
              background: "rgba(6, 10, 20, 0.95)",
              border: "1px solid rgba(34,197,94,0.3)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 0 20px rgba(34,197,94,0.15)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: "#22c55e" }}>
                  +{xpToast.points} XP
                </p>
                <p className="text-[10px]" style={{ color: "rgba(200,210,255,0.5)" }}>
                  {xpToast.title} deployed
                </p>
              </div>
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

      {/* Progress summary */}
      {steps.length > 0 && (
        <div
          className="rounded-xl px-5 py-4 flex items-center justify-between"
          style={{
            background: "rgba(34,197,94,0.03)",
            border: "1px solid rgba(34,197,94,0.1)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: `conic-gradient(#22c55e ${(executedSteps.length / steps.length) * 360}deg, rgba(34,197,94,0.1) 0deg)`,
              }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ background: "var(--background)", color: "#22c55e" }}
              >
                {Math.round((executedSteps.length / steps.length) * 100)}%
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                {executedSteps.length} of {steps.length} steps executed
              </p>
              <p className="text-[10px]" style={{ color: "var(--foreground-dim)" }}>
                {executedSteps.length * 25} XP earned from deployments
              </p>
            </div>
          </div>
          {executedSteps.length === steps.length && (
            <span
              className="text-xs font-bold px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(34,197,94,0.15)",
                color: "#22c55e",
                border: "1px solid rgba(34,197,94,0.3)",
                boxShadow: "0 0 12px rgba(34,197,94,0.15)",
              }}
            >
              DEPLOYMENT COMPLETE
            </span>
          )}
        </div>
      )}
    </div>
  );
}
