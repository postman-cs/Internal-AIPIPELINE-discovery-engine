"use client";

import dynamic from "next/dynamic";
import type { FleetCSE } from "./FleetCommandMap";

const FleetCommandMap = dynamic(() => import("./FleetCommandMap"), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-[700px] rounded-lg flex items-center justify-center"
      style={{
        background: "#080c18",
        border: "1px solid rgba(201,162,39,0.1)",
      }}
    >
      <p className="text-sm animate-pulse" style={{ color: "#64748b" }}>
        Initializing Fleet Command…
      </p>
    </div>
  ),
});

export type { FleetCSE };

export function FleetCommandMapWrapper({
  fleet,
  admiralName,
  stats,
}: {
  fleet: FleetCSE[];
  admiralName: string;
  stats: { totalProjects: number; totalBlockers: number; totalCSEs: number };
}) {
  return (
    <div role="img" aria-label={`System command map for ${admiralName} showing ${stats.totalCSEs} planets, ${stats.totalProjects} moons, and ${stats.totalBlockers} blockers`}>
      <FleetCommandMap fleet={fleet} admiralName={admiralName} stats={stats} />
      <div className="sr-only">
        System command overview for Admiral {admiralName}.
        {stats.totalCSEs} planet{stats.totalCSEs !== 1 ? "s" : ""} (CSEs), {stats.totalProjects} moon{stats.totalProjects !== 1 ? "s" : ""} (projects), {stats.totalBlockers} blocker{stats.totalBlockers !== 1 ? "s" : ""}.
        {fleet.map((cse) => `${cse.name}: ${cse.projects?.length ?? 0} moons.`).join(" ")}
      </div>
    </div>
  );
}
