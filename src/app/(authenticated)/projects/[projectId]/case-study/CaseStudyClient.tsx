"use client";

import { useState, useCallback } from "react";
import { CaseStudyCanvasWrapper } from "./CaseStudyCanvasWrapper";
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
  engagementStage,
  userLevel,
  missionCount,
  metrics,
  initialCaseStudyGenerated,
}: Props) {
  const [generated, setGenerated] = useState(initialCaseStudyGenerated);

  const handleGenerated = useCallback(() => {
    setGenerated(true);
  }, []);

  return (
    <div className="space-y-8">
      <CaseStudyCanvasWrapper
        projectName={projectName}
        engagementStage={engagementStage}
        userLevel={userLevel}
        missionCount={missionCount}
        metrics={metrics}
        caseStudyGenerated={generated}
      />
      <CaseStudyView
        projectId={projectId}
        projectName={projectName}
        onGenerated={handleGenerated}
      />
    </div>
  );
}
