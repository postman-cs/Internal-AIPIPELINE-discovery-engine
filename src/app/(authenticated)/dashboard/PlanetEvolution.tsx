"use client";

import { useEffect, useRef } from "react";
import { LEVEL_DRAW } from "@/lib/gamification/planet-draw";

interface PlanetEvolutionProps {
  level: number;
  size?: number;
  animate?: boolean;
}

export default function PlanetEvolution({ level, size = 160, animate = true }: PlanetEvolutionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.35;

    let raf: number;
    const draw = () => {
      timeRef.current += 0.012;
      const t = timeRef.current;
      ctx.clearRect(0, 0, size, size);

      const glowColor = LEVEL_DRAW[level]?.glow ?? "rgba(122,130,154,0.15)";
      const outerGlow = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.6);
      outerGlow.addColorStop(0, glowColor);
      outerGlow.addColorStop(1, "transparent");
      ctx.fillStyle = outerGlow;
      ctx.fillRect(0, 0, size, size);

      const drawFn = LEVEL_DRAW[level] ?? LEVEL_DRAW[1];
      drawFn.draw(ctx, cx, cy, r, t);

      if (animate) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [level, size, animate]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="block"
    />
  );
}
