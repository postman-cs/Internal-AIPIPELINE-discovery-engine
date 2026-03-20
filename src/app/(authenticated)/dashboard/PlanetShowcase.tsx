"use client";

import dynamic from "next/dynamic";

const PlanetEvolution = dynamic(() => import("./PlanetEvolution"), { ssr: false });

interface PlanetShowcaseProps {
  level: number;
  title: string;
  description: string;
  color: string;
}

export default function PlanetShowcase({ level, title, description, color }: PlanetShowcaseProps) {
  return (
    <div className="flex flex-col items-center text-center gap-3">
      <div
        style={{
          filter: `drop-shadow(0 0 18px ${color}55)`,
        }}
      >
        <PlanetEvolution level={level} size={140} />
      </div>
      <div>
        <p className="text-base font-bold tracking-wide" style={{ color }}>
          {title}
        </p>
        <p className="text-[11px] mt-0.5 max-w-[200px] leading-relaxed" style={{ color: "var(--foreground-dim)" }}>
          {description}
        </p>
      </div>
    </div>
  );
}
