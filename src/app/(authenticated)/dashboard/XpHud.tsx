"use client";

import { useEffect, useRef, useState } from "react";
import { useSound } from "@/lib/gamification/use-sound";
import { getActionLabel } from "@/lib/gamification/xp-constants";
import type { LevelInfo } from "@/lib/gamification/xp-constants";
import dynamic from "next/dynamic";

const PlanetEvolution = dynamic(() => import("./PlanetEvolution"), { ssr: false });

interface XpEvent {
  id: string;
  action: string;
  points: number;
  createdAt: string;
  projectName: string | null;
}

interface XpHudProps {
  levelInfo: LevelInfo;
  streak: number;
  recentEvents: XpEvent[];
}


// ─── Particle Burst Canvas ──────────────────────────────────────────────────

function ParticleBurst({ trigger, color }: { trigger: number; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (trigger === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    const particles: Array<{
      x: number; y: number; vx: number; vy: number;
      r: number; life: number; maxLife: number; color: string;
    }> = [];

    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4;
      const hueShift = (Math.random() - 0.5) * 40;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 1.5 + Math.random() * 2.5,
        life: 1,
        maxLife: 0.6 + Math.random() * 0.6,
        color: shiftHue(color, hueShift),
      });
    }

    let raf: number;
    const animate = () => {
      ctx.clearRect(0, 0, W, H);
      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03;
        p.life -= 0.018;
        if (p.life <= 0) continue;
        alive = true;
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (alive) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [trigger, color]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={200}
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
    />
  );
}

// ─── Floating Particle Background ───────────────────────────────────────────

function FloatingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      ctx.scale(2, 2);
    };
    resize();

    const W = () => canvas.offsetWidth;
    const H = () => canvas.offsetHeight;

    const dots = Array.from({ length: 30 }, () => ({
      x: Math.random() * W(),
      y: Math.random() * H(),
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.2,
      r: 0.5 + Math.random() * 1,
      alpha: 0.15 + Math.random() * 0.25,
    }));

    let raf: number;
    const animate = () => {
      ctx.clearRect(0, 0, W(), H());
      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0 || d.x > W()) d.vx *= -1;
        if (d.y < 0 || d.y > H()) d.vy *= -1;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(6, 214, 214, ${d.alpha})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none opacity-60"
    />
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function XpHud({ levelInfo, streak, recentEvents }: XpHudProps) {
  const { play } = useSound();
  const [burstTrigger, setBurstTrigger] = useState(0);
  const [flashVisible, setFlashVisible] = useState(false);
  const [levelBounce, setLevelBounce] = useState(false);
  const prevLevelRef = useRef(levelInfo.level);
  const prevXpRef = useRef(levelInfo.totalXp);
  const [animatedProgress, setAnimatedProgress] = useState(levelInfo.progress);

  useEffect(() => {
    const timeout = setTimeout(() => setAnimatedProgress(levelInfo.progress), 100);
    return () => clearTimeout(timeout);
  }, [levelInfo.progress]);

  useEffect(() => {
    if (prevXpRef.current < levelInfo.totalXp && prevXpRef.current > 0) {
      play("xp-gain");
    }
    prevXpRef.current = levelInfo.totalXp;
  }, [levelInfo.totalXp, play]);

  useEffect(() => {
    if (levelInfo.level > prevLevelRef.current && prevLevelRef.current > 0) {
      play("level-up");
      setBurstTrigger((t) => t + 1);
      setFlashVisible(true);
      setLevelBounce(true);
      setTimeout(() => setFlashVisible(false), 400);
      setTimeout(() => setLevelBounce(false), 600);
    }
    prevLevelRef.current = levelInfo.level;
  }, [levelInfo.level, play]);

  const levelColor = levelInfo.color;

  return (
    <div className="card-glow relative overflow-hidden">
      <FloatingParticles />

      {/* Level-up flash overlay */}
      {flashVisible && (
        <div
          className="absolute inset-0 z-20 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, ${levelColor}40 0%, transparent 70%)`,
            animation: "fade-in 0.1s ease-out",
            opacity: flashVisible ? 1 : 0,
            transition: "opacity 0.3s ease-out",
          }}
        />
      )}

      <div className="relative z-[5]">
        {/* Header Row */}
        <div className="flex items-center gap-4 mb-4">
          {/* Planet Visualization */}
          <div className="relative">
            <ParticleBurst trigger={burstTrigger} color={levelColor} />
            <div
              style={{
                transform: levelBounce ? "scale(1.15)" : "scale(1)",
                transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                filter: `drop-shadow(0 0 12px ${levelColor}66)`,
              }}
            >
              <PlanetEvolution level={levelInfo.level} size={80} />
            </div>
          </div>

          {/* Title + Description + XP Bar */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-0.5">
              <span
                className="text-lg font-bold tracking-wide"
                style={{ color: levelColor }}
              >
                {levelInfo.title}
              </span>
              <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>
                Level {levelInfo.level}
              </span>
            </div>
            <p className="text-[11px] mb-2 italic" style={{ color: "var(--foreground-dim)" }}>
              {levelInfo.description}
            </p>

            {/* XP Bar */}
            <div className="relative h-4 rounded-full overflow-hidden" style={{ background: "var(--background-secondary)", border: "1px solid var(--border)" }}>
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${animatedProgress * 100}%`,
                  background: `linear-gradient(90deg, ${levelColor}, ${shiftHue(levelColor, 30)})`,
                  boxShadow: `0 0 12px ${levelColor}66`,
                  transition: "width 0.8s ease-out",
                }}
              />
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 3s infinite linear",
                }}
              />
            </div>

            {/* XP Numbers */}
            <div className="flex justify-between mt-1">
              <span className="text-xs font-mono" style={{ color: "var(--foreground-dim)" }}>
                {levelInfo.totalXp.toLocaleString()} XP
              </span>
              <span className="text-xs font-mono" style={{ color: "var(--foreground-dim)" }}>
                {levelInfo.nextLevelXp
                  ? `${levelInfo.nextLevelXp.toLocaleString()} XP to Level ${levelInfo.level + 1}`
                  : "MAX LEVEL"}
              </span>
            </div>
          </div>

          {/* Streak */}
          {streak > 0 && (
            <div className="flex flex-col items-center px-3 py-2 rounded-xl" style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.15)" }}>
              <span className="text-xl" role="img" aria-label="streak">
                🔥
              </span>
              <span className="text-xs font-bold" style={{ color: "#fbbf24" }}>
                {streak}d
              </span>
            </div>
          )}
        </div>

        {/* Recent XP Feed */}
        {recentEvents.length > 0 && (
          <div className="space-y-1 mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--foreground-dim)" }}>
              Recent Activity
            </span>
            <div className="space-y-1">
              {recentEvents.slice(0, 5).map((evt, i) => (
                <div
                  key={evt.id}
                  className="flex items-center gap-2 text-xs py-0.5"
                  style={{
                    animation: `fade-in 0.3s ease-out ${i * 0.08}s both`,
                  }}
                >
                  <span className="font-bold tabular-nums" style={{ color: "#fbbf24" }}>
                    +{evt.points}
                  </span>
                  <span style={{ color: "var(--foreground-muted)" }}>
                    {getActionLabel(evt.action)}
                  </span>
                  {evt.projectName && (
                    <span style={{ color: "var(--foreground-dim)" }}>
                      · {evt.projectName}
                    </span>
                  )}
                  <span className="ml-auto tabular-nums" style={{ color: "var(--foreground-dim)" }}>
                    {formatTimeAgo(new Date(evt.createdAt))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function shiftHue(hex: string, shift: number): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  h = ((h * 360 + shift) % 360) / 360;
  if (h < 0) h += 1;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const rr = Math.round(hue2rgb(p, q, h + 1/3) * 255);
  const gg = Math.round(hue2rgb(p, q, h) * 255);
  const bb = Math.round(hue2rgb(p, q, h - 1/3) * 255);
  return `#${rr.toString(16).padStart(2, "0")}${gg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`;
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
