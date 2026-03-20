"use client";

import dynamic from "next/dynamic";
import { LazyCanvas } from "@/components/LazyCanvas";

const BlackHole = dynamic(() => import("./BlackHole"), { ssr: false });

export function BlackHoleWrapper({
  evidenceCounts,
  totalChunks,
}: {
  evidenceCounts: Record<string, number>;
  totalChunks: number;
}) {
  return (
    <LazyCanvas
      fallback={
        <div
          className="w-full rounded-xl flex items-center justify-center"
          style={{
            height: 400,
            background: "rgba(2, 1, 8, 1)",
            border: "1px solid rgba(139, 92, 246, 0.1)",
          }}
        >
          <p className="text-sm animate-pulse" style={{ color: "rgba(139, 92, 246, 0.4)" }}>
            Initializing Singularity...
          </p>
        </div>
      }
    >
      <BlackHole evidenceCounts={evidenceCounts} totalChunks={totalChunks} />
    </LazyCanvas>
  );
}
