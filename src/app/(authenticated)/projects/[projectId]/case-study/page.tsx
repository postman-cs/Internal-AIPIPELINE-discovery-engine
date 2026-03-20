import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { notFound } from "next/navigation";
import CaseStudyClient from "./CaseStudyClient";

export default async function CaseStudyPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true, name: true, engagementStage: true },
  });

  if (!project) notFound();

  const [user, aiRuns, blockers, assumptions, meetingsArtifact, sessionsArtifact, buildLogArtifact] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { xpLevel: true },
    }),
    prisma.aIRun.count({ where: { projectId } }),
    prisma.blocker.findMany({
      where: { projectId },
      select: { status: true },
    }),
    prisma.assumption.findMany({
      where: { projectId },
      select: { status: true },
    }),
    prisma.phaseArtifact.findFirst({
      where: { projectId, phase: "MEETINGS" },
      orderBy: { version: "desc" },
      select: { contentJson: true },
    }),
    prisma.phaseArtifact.findFirst({
      where: { projectId, phase: "WORKING_SESSIONS" },
      orderBy: { version: "desc" },
      select: { contentJson: true },
    }),
    prisma.phaseArtifact.findFirst({
      where: { projectId, phase: "BUILD_LOG" },
      orderBy: { version: "desc" },
      select: { contentJson: true },
    }),
  ]);

  const blockersResolved = blockers.filter(b => b.status === "NEUTRALIZED" || b.status === "ACCEPTED").length;
  const assumptionsVerified = assumptions.filter(a => a.status === "VERIFIED" || a.status === "AUTO_VERIFIED").length;

  const meetingEntries = (meetingsArtifact?.contentJson as Record<string, unknown>)?.entries;
  const sessionEntries = (sessionsArtifact?.contentJson as Record<string, unknown>)?.entries;
  const missionCount = (Array.isArray(meetingEntries) ? meetingEntries.length : 0)
    + (Array.isArray(sessionEntries) ? sessionEntries.length : 0);

  const buildLogJson = (buildLogArtifact?.contentJson ?? {}) as Record<string, unknown>;
  const sectionsWritten = ["whatWeBuilt", "valueUnlocked", "successCriteria", "reusablePatterns", "nextSteps"]
    .filter(key => {
      const v = buildLogJson[key];
      return Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim().length > 0;
    }).length;

  const initialCaseStudyGenerated = sectionsWritten >= 3;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 page-animate">
      <CaseStudyClient
        projectId={project.id}
        projectName={project.name}
        engagementStage={project.engagementStage}
        userLevel={user?.xpLevel ?? 1}
        missionCount={missionCount}
        metrics={{
          aiRuns,
          blockersResolved,
          assumptionsVerified,
          sectionsWritten,
        }}
        initialCaseStudyGenerated={initialCaseStudyGenerated}
      />
    </div>
  );
}
