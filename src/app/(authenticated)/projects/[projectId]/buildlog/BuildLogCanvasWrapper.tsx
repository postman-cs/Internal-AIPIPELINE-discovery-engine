"use client";

import dynamic from "next/dynamic";
import type { SectionStatus, GateStatus } from "./BuildLogCanvas";

const BuildLogCanvas = dynamic(() => import("./BuildLogCanvas"), { ssr: false });

export default function BuildLogCanvasWrapper(props: {
  sections: SectionStatus[];
  gates: GateStatus[];
  progressPct: number;
  allGatesPassed: boolean;
  projectName: string;
}) {
  return <BuildLogCanvas {...props} />;
}
