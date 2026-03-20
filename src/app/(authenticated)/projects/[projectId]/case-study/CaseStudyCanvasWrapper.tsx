"use client";

import dynamic from "next/dynamic";
import { LazyCanvas } from "@/components/LazyCanvas";

const CaseStudyCanvas = dynamic(() => import("./CaseStudyCanvas"), { ssr: false });

interface CaseStudyCanvasWrapperProps {
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
  caseStudyGenerated: boolean;
}

export function CaseStudyCanvasWrapper(props: CaseStudyCanvasWrapperProps) {
  return (
    <LazyCanvas>
      <CaseStudyCanvas {...props} />
    </LazyCanvas>
  );
}
