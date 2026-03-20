"use client";

import dynamic from "next/dynamic";
import type { ProjectCluster } from "./CommandConstellation";

const CommandConstellation = dynamic(
  () => import("./CommandConstellation"),
  { ssr: false },
);

export function CommandConstellationWrapper({
  projects,
  stats,
}: {
  projects: ProjectCluster[];
  stats: { docs: number; chunks: number; aiRuns: number };
}) {
  return (
    <div role="img" aria-label={`Command constellation showing ${projects.length} projects with ${stats.docs} documents, ${stats.chunks} chunks, and ${stats.aiRuns} AI runs`}>
      <CommandConstellation projects={projects} stats={stats} />
      <div className="sr-only">
        Dashboard visualization: {projects.length} project{projects.length !== 1 ? "s" : ""} mapped.
        Total documents: {stats.docs}. Total chunks: {stats.chunks}. Total AI runs: {stats.aiRuns}.
        {projects.map((p) => `Project: ${p.name}.`).join(" ")}
      </div>
    </div>
  );
}
