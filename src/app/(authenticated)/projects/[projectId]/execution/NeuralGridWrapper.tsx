"use client";

import dynamic from "next/dynamic";
import { LazyCanvas } from "@/components/LazyCanvas";

const NeuralFiringGrid = dynamic(() => import("./NeuralFiringGrid"), { ssr: false });

interface ExecutionPhase {
  phase: string;
  label: string;
  status: string;
  color: string;
  itemCount: number;
  version: number;
}

export function NeuralGridWrapper({
  phases,
  hasData,
}: {
  phases: ExecutionPhase[];
  hasData: boolean;
}) {
  return (
    <LazyCanvas>
      <NeuralFiringGrid phases={phases} hasData={hasData} />
    </LazyCanvas>
  );
}
