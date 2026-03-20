"use client";

import dynamic from "next/dynamic";
import { LazyCanvas } from "@/components/LazyCanvas";

const MoonBase = dynamic(() => import("./MoonBase"), { ssr: false });

interface MissionEntry {
  id: string;
  title: string;
  type: "meeting" | "working_session";
  date: string;
}

export function MoonBaseWrapper({
  meetings,
  sessions,
  projectName,
}: {
  meetings: MissionEntry[];
  sessions: MissionEntry[];
  projectName: string;
}) {
  return (
    <LazyCanvas>
      <MoonBase
        meetings={meetings}
        sessions={sessions}
        projectName={projectName}
      />
    </LazyCanvas>
  );
}
