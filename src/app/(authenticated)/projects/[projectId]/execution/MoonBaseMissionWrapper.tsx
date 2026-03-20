"use client";

import dynamic from "next/dynamic";
import { LazyCanvas } from "@/components/LazyCanvas";
import type { DeploymentStepEntry } from "./MoonBaseMission";

const MoonBaseMission = dynamic(() => import("./MoonBaseMission"), { ssr: false });

interface MissionEntry {
  id: string;
  title: string;
  type: "meeting" | "working_session";
  date: string;
}

interface MoonBaseMissionWrapperProps {
  meetings?: MissionEntry[];
  sessions?: MissionEntry[];
  deploymentSteps?: DeploymentStepEntry[];
  launchQueue?: number[];
  userLevel: number;
  projectName: string;
}

export function MoonBaseMissionWrapper({
  meetings = [],
  sessions = [],
  deploymentSteps = [],
  launchQueue = [],
  userLevel,
  projectName,
}: MoonBaseMissionWrapperProps) {
  return (
    <LazyCanvas>
      <MoonBaseMission
        meetings={meetings}
        sessions={sessions}
        deploymentSteps={deploymentSteps}
        launchQueue={launchQueue}
        userLevel={userLevel}
        projectName={projectName}
      />
    </LazyCanvas>
  );
}
