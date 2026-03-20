"use client";

import { useRef, useEffect, useCallback } from "react";
import { useSound } from "@/lib/gamification/use-sound";

interface BlackHoleProps {
  evidenceCounts: Record<string, number>;
  totalChunks: number;
}

interface Star {
  x: number;
  y: number;
  r: number;
  brightness: number;
  speed: number;
}

interface DiskParticle {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  hue: number;
  brightness: number;
  trail: number;
}

interface TextParticle {
  text: string;
  x: number;
  y: number;
  angle: number;
  radius: number;
  speed: number;
  opacity: number;
  scale: number;
  hue: number;
  life: number;
  maxLife: number;
}

interface DataOrbit {
  label: string;
  count: number;
  angle: number;
  speed: number;
}

const EVENT_HORIZON_RATIO = 0.08;
const DISK_INNER = 0.1;
const DISK_OUTER = 0.35;
const STAR_COUNT = 120;
const DISK_PARTICLE_COUNT = 200;

export default function BlackHole({ evidenceCounts, totalChunks }: BlackHoleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef(0);
  const tRef = useRef(0);
  const sizeRef = useRef({ w: 800, h: 400 });
  const starsRef = useRef<Star[]>([]);
  const diskRef = useRef<DiskParticle[]>([]);
  const textParticlesRef = useRef<TextParticle[]>([]);
  const orbitsRef = useRef<DataOrbit[]>([]);
  const pulseRef = useRef(0);
  const mouseRef = useRef({ x: -1, y: -1 });
  const { play } = useSound();

  const initStars = useCallback((w: number, h: number) => {
    starsRef.current = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.5 + 0.3,
      brightness: Math.random() * 0.6 + 0.4,
      speed: Math.random() * 0.3 + 0.1,
    }));
  }, []);

  const initDisk = useCallback(() => {
    diskRef.current = Array.from({ length: DISK_PARTICLE_COUNT }, () => {
      const r = DISK_INNER + Math.random() * (DISK_OUTER - DISK_INNER);
      return {
        angle: Math.random() * Math.PI * 2,
        radius: r,
        speed: (0.4 + Math.random() * 0.6) / (r * 4),
        size: Math.random() * 2 + 0.5,
        hue: 180 + (1 - (r - DISK_INNER) / (DISK_OUTER - DISK_INNER)) * 100,
        brightness: Math.random() * 0.5 + 0.5,
        trail: Math.random() * 0.3 + 0.1,
      };
    });
  }, []);

  const updateOrbits = useCallback((counts: Record<string, number>) => {
    const entries = Object.entries(counts).filter(([, c]) => c > 0);
    orbitsRef.current = entries.map(([label, count], i) => ({
      label: label.length > 8 ? label.slice(0, 7) + "." : label,
      count,
      angle: (i / Math.max(entries.length, 1)) * Math.PI * 2,
      speed: 0.08 + i * 0.015,
    }));
  }, []);

  useEffect(() => {
    updateOrbits(evidenceCounts);
  }, [evidenceCounts, updateOrbits]);

  const spawnIngestParticles = useCallback((text: string, sourceType: string) => {
    const words = text.replace(/[^\w\s]/g, "").split(/\s+/).filter(w => w.length > 2);
    const selected: string[] = [];
    const count = Math.min(Math.max(words.length, 1), 12);
    for (let i = 0; i < count; i++) {
      selected.push(words[Math.floor(Math.random() * words.length)] || sourceType);
    }

    const { w, h } = sizeRef.current;
    const cx = w / 2;
    const cy = h / 2;

    selected.forEach((word, i) => {
      const spawnAngle = Math.random() * Math.PI * 2;
      const spawnRadius = Math.max(w, h) * 0.45;
      textParticlesRef.current.push({
        text: word.slice(0, 12),
        x: cx + Math.cos(spawnAngle) * spawnRadius,
        y: cy + Math.sin(spawnAngle) * spawnRadius,
        angle: spawnAngle + Math.PI,
        radius: spawnRadius,
        speed: 0.6 + Math.random() * 0.4,
        opacity: 1,
        scale: 1,
        hue: 190 + i * 8,
        life: 0,
        maxLife: 120 + Math.random() * 60,
      });
    });

    pulseRef.current = 1;
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.text && detail?.sourceType) {
        spawnIngestParticles(detail.text, detail.sourceType);
        try { play("xp-gain"); } catch { /* noop */ }
      }
    };
    window.addEventListener("discovery-ingest", handler);
    return () => window.removeEventListener("discovery-ingest", handler);
  }, [spawnIngestParticles, play]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      sizeRef.current = { w: rect.width, h: rect.height };
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initStars(rect.width, rect.height);
    };
    resize();
    initDisk();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleMouseLeave = () => {
      mouseRef.current = { x: -1, y: -1 };
    };
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    let last = performance.now();
    const render = (now: number) => {
      const dt = Math.min(now - last, 50) / 16.667;
      last = now;
      tRef.current += dt;
      const t = tRef.current;
      const { w, h } = sizeRef.current;
      const cx = w / 2;
      const cy = h / 2;
      const minDim = Math.min(w, h);
      const ehRadius = minDim * EVENT_HORIZON_RATIO;
      const pulse = pulseRef.current;

      ctx.clearRect(0, 0, w, h);

      // -- Background gradient --
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, minDim * 0.5);
      bg.addColorStop(0, "rgba(10, 5, 20, 1)");
      bg.addColorStop(0.5, "rgba(5, 2, 15, 1)");
      bg.addColorStop(1, "rgba(2, 1, 8, 1)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // -- Stars with gravitational lensing --
      for (const star of starsRef.current) {
        const dx = star.x - cx;
        const dy = star.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const lensStrength = Math.max(0, 1 - dist / (minDim * 0.4));
        const warp = lensStrength * lensStrength * 20;
        const angle = Math.atan2(dy, dx);
        const sx = star.x + Math.cos(angle + Math.PI / 2) * warp;
        const sy = star.y + Math.sin(angle + Math.PI / 2) * warp;

        const flicker = star.brightness * (0.8 + Math.sin(t * star.speed * 0.5) * 0.2);
        ctx.globalAlpha = flicker * (dist < ehRadius * 2 ? Math.max(0, (dist - ehRadius) / ehRadius) : 1);
        ctx.fillStyle = "#e2e8f0";
        ctx.beginPath();
        ctx.arc(sx, sy, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // -- Gravitational glow --
      const glowSize = minDim * (0.25 + pulse * 0.05);
      const glow = ctx.createRadialGradient(cx, cy, ehRadius * 0.5, cx, cy, glowSize);
      glow.addColorStop(0, `rgba(139, 92, 246, ${0.08 + pulse * 0.12})`);
      glow.addColorStop(0.3, `rgba(6, 182, 212, ${0.04 + pulse * 0.06})`);
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, glowSize, 0, Math.PI * 2);
      ctx.fill();

      // -- Accretion disk --
      for (const p of diskRef.current) {
        p.angle += p.speed * dt;
        const wobble = Math.sin(t * 0.3 + p.angle * 3) * 0.005;
        const r = (p.radius + wobble) * minDim;
        const px = cx + Math.cos(p.angle) * r;
        const py = cy + Math.sin(p.angle) * r * 0.35;

        const trailAngle = p.angle - p.trail;
        const trx = cx + Math.cos(trailAngle) * r;
        const _try = cy + Math.sin(trailAngle) * r * 0.35;

        const alpha = p.brightness * (0.4 + pulse * 0.3);
        ctx.strokeStyle = `hsla(${p.hue}, 80%, ${60 + pulse * 15}%, ${alpha})`;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(trx, _try);
        ctx.lineTo(px, py);
        ctx.stroke();

        ctx.fillStyle = `hsla(${p.hue}, 90%, ${70 + pulse * 15}%, ${alpha * 1.2})`;
        ctx.beginPath();
        ctx.arc(px, py, p.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // -- Event horizon --
      const ehGrad = ctx.createRadialGradient(cx, cy, ehRadius * 0.3, cx, cy, ehRadius * 1.8);
      ehGrad.addColorStop(0, "rgba(0, 0, 0, 1)");
      ehGrad.addColorStop(0.6, "rgba(0, 0, 0, 0.95)");
      ehGrad.addColorStop(0.85, `rgba(139, 92, 246, ${0.15 + pulse * 0.2})`);
      ehGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = ehGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, ehRadius * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // -- Photon ring --
      ctx.strokeStyle = `rgba(200, 180, 255, ${0.12 + pulse * 0.15})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, ehRadius * 1.15, 0, Math.PI * 2);
      ctx.stroke();

      // -- Text particles (ingest animation) --
      const toRemove: number[] = [];
      for (let i = 0; i < textParticlesRef.current.length; i++) {
        const tp = textParticlesRef.current[i];
        tp.life += dt;
        const progress = tp.life / tp.maxLife;

        const dx = cx - tp.x;
        const dy = cy - tp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const pullAngle = Math.atan2(dy, dx);

        const spiralAngle = pullAngle + Math.PI * 0.3;
        const accel = tp.speed * (1 + progress * 3);
        tp.x += Math.cos(spiralAngle) * accel * dt;
        tp.y += Math.sin(spiralAngle) * accel * dt;

        tp.opacity = Math.max(0, 1 - progress * 1.2);
        tp.scale = Math.max(0.1, 1 - progress * 0.8);
        tp.hue = 190 - progress * 160;

        if (dist < ehRadius * 1.5 || tp.life >= tp.maxLife) {
          // Flash at event horizon
          if (dist < ehRadius * 2) {
            ctx.globalAlpha = 0.6;
            const flash = ctx.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, 8);
            flash.addColorStop(0, "rgba(255, 255, 255, 0.8)");
            flash.addColorStop(1, "rgba(255, 255, 255, 0)");
            ctx.fillStyle = flash;
            ctx.beginPath();
            ctx.arc(tp.x, tp.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
          toRemove.push(i);
          continue;
        }

        ctx.save();
        ctx.translate(tp.x, tp.y);
        ctx.scale(tp.scale, tp.scale);
        ctx.globalAlpha = tp.opacity;
        ctx.font = "11px monospace";
        ctx.fillStyle = `hsl(${Math.max(0, tp.hue)}, 80%, ${55 + (1 - progress) * 20}%)`;
        ctx.fillText(tp.text, 0, 0);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      for (let i = toRemove.length - 1; i >= 0; i--) {
        textParticlesRef.current.splice(toRemove[i], 1);
      }

      // -- Orbiting data labels --
      const orbitRadius = minDim * 0.42;
      for (const orb of orbitsRef.current) {
        orb.angle += orb.speed * dt * 0.01;
        const ox = cx + Math.cos(orb.angle) * orbitRadius;
        const oy = cy + Math.sin(orb.angle) * orbitRadius * 0.5;

        ctx.fillStyle = "rgba(6, 214, 214, 0.6)";
        ctx.beginPath();
        ctx.arc(ox, oy, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "9px monospace";
        ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
        ctx.fillText(`${orb.label} x${orb.count}`, ox + 6, oy + 3);
      }

      // -- Total chunks counter --
      if (totalChunks > 0) {
        ctx.font = "bold 11px monospace";
        ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
        ctx.textAlign = "center";
        ctx.fillText(`${totalChunks} evidence chunks absorbed`, cx, h - 16);
        ctx.textAlign = "start";
      }

      // -- Mouse gravitational pull indicator --
      if (mouseRef.current.x > 0) {
        const mdx = mouseRef.current.x - cx;
        const mdy = mouseRef.current.y - cy;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < minDim * 0.4 && mdist > ehRadius * 2) {
          ctx.globalAlpha = 0.15;
          ctx.strokeStyle = "#8b5cf6";
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(mouseRef.current.x, mouseRef.current.y);
          ctx.lineTo(cx, cy);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      // -- Decay pulse --
      if (pulseRef.current > 0) {
        pulseRef.current = Math.max(0, pulseRef.current - 0.015 * dt);
      }

      animRef.current = requestAnimationFrame(render);
    };
    animRef.current = requestAnimationFrame(render);

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animRef.current);
      } else {
        last = performance.now();
        animRef.current = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [initStars, initDisk, totalChunks, play]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl overflow-hidden relative"
      style={{
        height: 400,
        background: "rgba(2, 1, 8, 1)",
        border: "1px solid rgba(139, 92, 246, 0.1)",
      }}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
      <div
        className="absolute top-3 left-4 flex items-center gap-2"
        style={{ pointerEvents: "none" }}
      >
        <span className="text-[9px] uppercase tracking-widest font-medium" style={{ color: "rgba(139, 92, 246, 0.5)" }}>
          Evidence Singularity
        </span>
      </div>
    </div>
  );
}
