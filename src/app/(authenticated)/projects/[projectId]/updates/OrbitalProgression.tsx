"use client";

import { useRef, useEffect, useState, useCallback } from "react";

/* ─── data shapes (mirrored from CascadeUpdatesPanel) ─── */
interface PhaseState {
  phase: string;
  label: string;
  shortLabel: string;
  dependencies: string[];
  latestVersion: number;
  status: string;
  hasArtifact: boolean;
  lastComputedAt: string | null;
  order: number;
  implemented: boolean;
}

interface ProposalInfo {
  id: string;
  phase: string;
  baseVersion: number;
  status: string;
  patchOps: number;
  createdAt: string;
}

interface JobInfo {
  id: string;
  status: string;
  completedTasks: number;
  taskCount: number;
  failedTasks: number;
  startedAt: string;
}

interface OrbitalProps {
  phaseGraph: PhaseState[];
  proposals: ProposalInfo[];
  jobs: JobInfo[];
  onPhaseSelect?: (phase: string | null) => void;
}

/* ─── internal types ─── */
interface Planet {
  phase: string;
  label: string;
  shortLabel: string;
  x: number;
  y: number;
  orbitRadius: number;
  angle: number;
  baseAngle: number;
  planetRadius: number;
  color: string;
  glowColor: string;
  status: string;
  version: number;
  hasArtifact: boolean;
  implemented: boolean;
  dependencies: string[];
  pulsePhase: number;
  orbitSpeed: number;
  lastComputed: string | null;
}

interface GravLink {
  fromIdx: number;
  toIdx: number;
}

interface TransferArc {
  fromIdx: number;
  toIdx: number;
  progress: number;
  color: string;
  patchOps: number;
  proposalStatus: string;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  color: string;
}

interface OrbitalDust {
  angle: number;
  orbitR: number;
  size: number;
  alpha: number;
  speed: number;
  phase: number;
}

/* ─── palette ─── */
const STATUS_COLORS: Record<string, { fill: string; glow: string }> = {
  CLEAN: { fill: "#34d399", glow: "rgba(52, 211, 153, 0.2)" },
  DIRTY: { fill: "#fbbf24", glow: "rgba(251, 191, 36, 0.15)" },
  STALE: { fill: "#6b7280", glow: "rgba(107, 114, 128, 0.08)" },
  NEEDS_REVIEW: { fill: "#60a5fa", glow: "rgba(96, 165, 250, 0.15)" },
  CLEAN_WITH_EXCEPTIONS: { fill: "#fb923c", glow: "rgba(251, 146, 60, 0.15)" },
};

const PHASE_HUES: Record<string, string> = {
  DISCOVERY: "#22c55e",
  CURRENT_TOPOLOGY: "#06d6d6",
  DESIRED_FUTURE_STATE: "#8b5cf6",
  SOLUTION_DESIGN: "#3b82f6",
  INFRASTRUCTURE: "#f59e0b",
  TEST_DESIGN: "#ec4899",
  CRAFT_SOLUTION: "#14b8a6",
  TEST_SOLUTION: "#f97316",
  DEPLOYMENT_PLAN: "#22c55e",
  BUILD_LOG: "#10b981",
};

export default function OrbitalProgression({
  phaseGraph,
  proposals,
  jobs,
  onPhaseSelect,
}: OrbitalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const planetsRef = useRef<Planet[]>([]);
  const linksRef = useRef<GravLink[]>([]);
  const arcsRef = useRef<TransferArc[]>([]);
  const ripplesRef = useRef<Ripple[]>([]);
  const dustRef = useRef<OrbitalDust[]>([]);
  const timeRef = useRef(0);
  const mouseRef = useRef({ x: -999, y: -999 });
  const [hoveredPlanet, setHoveredPlanet] = useState<Planet | null>(null);
  const [dims, setDims] = useState({ w: 900, h: 560 });

  /* ─── Build orbital system ─── */
  useEffect(() => {
    const { w, h } = dims;
    const cx = w / 2;
    const cy = h / 2;

    const sorted = [...phaseGraph].sort((a, b) => a.order - b.order);
    const count = sorted.length;

    const planets: Planet[] = sorted.map((p, i) => {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const orbitR = Math.min(w, h) * 0.32 + (p.latestVersion > 3 ? 15 : 0);
      const phaseColor = PHASE_HUES[p.phase] ?? "#60a5fa";
      const statusC = STATUS_COLORS[p.status] ?? STATUS_COLORS.STALE;
      const planetR = p.hasArtifact ? 14 + Math.min(p.latestVersion * 1.5, 10) : 10;

      return {
        phase: p.phase,
        label: p.label,
        shortLabel: p.shortLabel,
        x: cx + Math.cos(angle) * orbitR,
        y: cy + Math.sin(angle) * orbitR * 0.72,
        orbitRadius: orbitR,
        angle,
        baseAngle: angle,
        planetRadius: planetR,
        color: statusC.fill,
        glowColor: phaseColor,
        status: p.status,
        version: p.latestVersion,
        hasArtifact: p.hasArtifact,
        implemented: p.implemented,
        dependencies: p.dependencies,
        pulsePhase: Math.random() * Math.PI * 2,
        orbitSpeed: 0.00008 + (i * 0.000005),
        lastComputed: p.lastComputedAt,
      };
    });

    const phaseIdx = new Map<string, number>();
    planets.forEach((p, i) => phaseIdx.set(p.phase, i));

    const links: GravLink[] = [];
    for (const planet of planets) {
      for (const dep of planet.dependencies) {
        const fi = phaseIdx.get(dep);
        const ti = phaseIdx.get(planet.phase);
        if (fi !== undefined && ti !== undefined) {
          links.push({ fromIdx: fi, toIdx: ti });
        }
      }
    }

    const arcs: TransferArc[] = proposals
      .filter((p) => p.status === "PENDING" || p.status === "ACCEPTED")
      .slice(0, 8)
      .map((p) => {
        const ti = phaseIdx.get(p.phase) ?? 0;
        const depPhase = planets[ti]?.dependencies[0];
        const fi = depPhase ? (phaseIdx.get(depPhase) ?? 0) : Math.max(0, ti - 1);
        return {
          fromIdx: fi,
          toIdx: ti,
          progress: p.status === "ACCEPTED" ? 1 : 0,
          color: p.status === "ACCEPTED" ? "#34d399" : "#60a5fa",
          patchOps: p.patchOps,
          proposalStatus: p.status,
        };
      });

    const dust: OrbitalDust[] = [];
    for (let i = 0; i < 120; i++) {
      const orbitR = Math.min(w, h) * (0.2 + Math.random() * 0.25);
      dust.push({
        angle: Math.random() * Math.PI * 2,
        orbitR,
        size: 0.3 + Math.random() * 1,
        alpha: 0.04 + Math.random() * 0.08,
        speed: 0.0002 + Math.random() * 0.0005,
        phase: Math.random() * Math.PI * 2,
      });
    }

    planetsRef.current = planets;
    linksRef.current = links;
    arcsRef.current = arcs;
    dustRef.current = dust;

    // Recent job → ripple
    if (jobs.length > 0) {
      const latest = jobs[0];
      if (latest.status === "COMPLETED" || latest.status === "COMPLETED_WITH_ERRORS") {
        ripplesRef.current.push({
          x: cx, y: cy,
          radius: 10,
          maxRadius: Math.min(w, h) * 0.5,
          life: 0,
          color: latest.failedTasks > 0 ? "#f59e0b" : "#22c55e",
        });
      }
    }
  }, [phaseGraph, proposals, jobs, dims]);

  /* ─── Resize ─── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = Math.max(500, Math.min(600, rect.height || 560));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      setDims({ w, h });
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  /* ─── Animation loop ─── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawOrbitRings = (ctx: CanvasRenderingContext2D, cx: number, cy: number, planets: Planet[]) => {
      const radii = new Set(planets.map((p) => Math.round(p.orbitRadius)));
      for (const r of radii) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * 0.72, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.018)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.restore();
      }
    };

    const drawGravLink = (ctx: CanvasRenderingContext2D, from: Planet, to: Planet, t: number) => {
      ctx.save();
      const cp1x = from.x + (to.x - from.x) * 0.3;
      const cp1y = from.y - 20;
      const cp2x = from.x + (to.x - from.x) * 0.7;
      const cp2y = to.y + 20;

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, to.x, to.y);
      ctx.strokeStyle = "rgba(255,255,255,0.025)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Flowing particle along link
      const flowT = ((t * 0.002) % 1);
      const mt = flowT;
      const mt2 = mt * mt;
      const mt3 = mt2 * mt;
      const imt = 1 - mt;
      const imt2 = imt * imt;
      const imt3 = imt2 * imt;
      const px = imt3 * from.x + 3 * imt2 * mt * cp1x + 3 * imt * mt2 * cp2x + mt3 * to.x;
      const py = imt3 * from.y + 3 * imt2 * mt * cp1y + 3 * imt * mt2 * cp2y + mt3 * to.y;

      const glow = ctx.createRadialGradient(px, py, 0, px, py, 4);
      glow.addColorStop(0, "rgba(34,197,94,0.15)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawPlanet = (ctx: CanvasRenderingContext2D, planet: Planet, t: number, hovered: boolean) => {
      const pulse = Math.sin(t * 0.003 + planet.pulsePhase) * 0.15 + 0.85;
      const r = planet.planetRadius * (hovered ? 1.2 : 1);
      const gIntensity = planet.hasArtifact ? 1 : 0.3;

      ctx.save();

      // Outer atmosphere glow
      if (planet.hasArtifact) {
        const atmo = ctx.createRadialGradient(planet.x, planet.y, 0, planet.x, planet.y, r * 3.5);
        atmo.addColorStop(0, `${planet.glowColor}${Math.round(pulse * gIntensity * 18).toString(16).padStart(2, "0")}`);
        atmo.addColorStop(0.5, `${planet.glowColor}${Math.round(pulse * gIntensity * 6).toString(16).padStart(2, "0")}`);
        atmo.addColorStop(1, "transparent");
        ctx.fillStyle = atmo;
        ctx.beginPath();
        ctx.arc(planet.x, planet.y, r * 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Planet body
      const body = ctx.createRadialGradient(
        planet.x - r * 0.2, planet.y - r * 0.2, 0,
        planet.x, planet.y, r,
      );
      body.addColorStop(0, `${planet.color}${Math.round(pulse * 200).toString(16).padStart(2, "0")}`);
      body.addColorStop(0.6, `${planet.color}${Math.round(pulse * 120).toString(16).padStart(2, "0")}`);
      body.addColorStop(1, `${planet.color}30`);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(planet.x, planet.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Surface highlight
      ctx.beginPath();
      ctx.arc(planet.x - r * 0.25, planet.y - r * 0.25, r * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${pulse * 0.2})`;
      ctx.fill();

      // Rim
      ctx.beginPath();
      ctx.arc(planet.x, planet.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = `${planet.color}${Math.round(pulse * 60).toString(16).padStart(2, "0")}`;
      ctx.lineWidth = hovered ? 2 : 1;
      ctx.stroke();

      // Version ring (small orbit around the planet)
      if (planet.version > 0) {
        const vr = r + 5 + Math.min(planet.version, 8) * 1.5;
        ctx.beginPath();
        ctx.arc(planet.x, planet.y, vr, 0, Math.PI * 2);
        ctx.strokeStyle = `${planet.color}12`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Version dot orbiting the planet
        const vAngle = t * 0.008 + planet.pulsePhase;
        const vx = planet.x + Math.cos(vAngle) * vr;
        const vy = planet.y + Math.sin(vAngle) * vr;
        ctx.beginPath();
        ctx.arc(vx, vy, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `${planet.color}60`;
        ctx.fill();
      }

      // Not implemented = dashed ring (asteroid)
      if (!planet.implemented) {
        ctx.beginPath();
        ctx.arc(planet.x, planet.y, r + 3, 0, Math.PI * 2);
        ctx.setLineDash([2, 3]);
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Label
      ctx.font = "bold 8px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = `${planet.color}90`;
      ctx.fillText(planet.shortLabel, planet.x, planet.y + r + 14);

      ctx.font = "7px Inter, system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillText(planet.label, planet.x, planet.y + r + 23);

      if (planet.version > 0) {
        ctx.font = "bold 7px Inter, system-ui, sans-serif";
        ctx.fillStyle = `${planet.color}50`;
        ctx.fillText(`v${planet.version}`, planet.x, planet.y + r + 32);
      }

      ctx.restore();
    };

    const drawTransferArc = (ctx: CanvasRenderingContext2D, arc: TransferArc, planets: Planet[], t: number) => {
      const from = planets[arc.fromIdx];
      const to = planets[arc.toIdx];
      if (!from || !to) return;

      const prog = arc.proposalStatus === "PENDING"
        ? ((t * 0.003) % 1)
        : Math.min(arc.progress, 1);

      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const mx = from.x + dx * 0.5;
      const my = from.y + dy * 0.5 - 40;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(mx, my, to.x, to.y);
      ctx.strokeStyle = `${arc.color}15`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Animated transfer particle
      const pt = prog;
      const ipt = 1 - pt;
      const px = ipt * ipt * from.x + 2 * ipt * pt * mx + pt * pt * to.x;
      const py = ipt * ipt * from.y + 2 * ipt * pt * my + pt * pt * to.y;

      const glow = ctx.createRadialGradient(px, py, 0, px, py, 8);
      glow.addColorStop(0, `${arc.color}50`);
      glow.addColorStop(0.5, `${arc.color}18`);
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fillStyle = arc.color;
      ctx.fill();

      ctx.restore();
    };

    const drawRipple = (ctx: CanvasRenderingContext2D, rip: Ripple) => {
      const progress = rip.radius / rip.maxRadius;
      const alpha = (1 - progress) * 0.2;

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(rip.x, rip.y, rip.radius, rip.radius * 0.72, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `${rip.color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
      ctx.lineWidth = 1.5 * (1 - progress);
      ctx.stroke();
      ctx.restore();
    };

    const frame = () => {
      const dpr = window.devicePixelRatio || 1;
      const { w, h } = dims;
      const cx = w / 2;
      const cy = h / 2;
      timeRef.current++;
      const t = timeRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Deep space
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.6);
      bgGrad.addColorStop(0, "#0a0e1a");
      bgGrad.addColorStop(0.6, "#060a14");
      bgGrad.addColorStop(1, "#040610");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Background stars
      ctx.save();
      for (let i = 0; i < 150; i++) {
        const sx = ((i * 7919) % w);
        const sy = ((i * 104729) % h);
        const sz = 0.3 + ((i * 31) % 10) / 10;
        const sa = 0.08 + Math.sin(t * 0.001 + i) * 0.04;
        ctx.beginPath();
        ctx.arc(sx, sy, sz, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 200, 255, ${sa})`;
        ctx.fill();
      }
      ctx.restore();

      // Orbital dust
      for (const d of dustRef.current) {
        d.angle += d.speed;
        const dx = cx + Math.cos(d.angle) * d.orbitR;
        const dy = cy + Math.sin(d.angle) * d.orbitR * 0.72;
        const da = d.alpha * (0.5 + Math.sin(t * 0.002 + d.phase) * 0.5);
        ctx.save();
        ctx.beginPath();
        ctx.arc(dx, dy, d.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(140, 160, 200, ${da})`;
        ctx.fill();
        ctx.restore();
      }

      // Orbit rings
      const planets = planetsRef.current;
      drawOrbitRings(ctx, cx, cy, planets);

      // Central body (sun = project core)
      const sunPulse = Math.sin(t * 0.002) * 0.15 + 0.85;
      const sunGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30);
      sunGrad.addColorStop(0, `rgba(34, 197, 94, ${sunPulse * 0.2})`);
      sunGrad.addColorStop(0.5, `rgba(34, 197, 94, ${sunPulse * 0.06})`);
      sunGrad.addColorStop(1, "transparent");
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(34, 197, 94, ${sunPulse * 0.6})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${sunPulse * 0.5})`;
      ctx.fill();

      // Gravitational links
      for (const link of linksRef.current) {
        const from = planets[link.fromIdx];
        const to = planets[link.toIdx];
        if (from && to) drawGravLink(ctx, from, to, t);
      }

      // Slowly orbit planets
      for (const planet of planets) {
        planet.angle = planet.baseAngle + Math.sin(t * planet.orbitSpeed) * 0.02;
        planet.x = cx + Math.cos(planet.angle) * planet.orbitRadius;
        planet.y = cy + Math.sin(planet.angle) * planet.orbitRadius * 0.72;
      }

      // Transfer arcs (proposals)
      for (const arc of arcsRef.current) {
        drawTransferArc(ctx, arc, planets, t);
      }

      // Planets
      let foundHover: Planet | null = null;
      for (const planet of planets) {
        const dist = Math.hypot(mouseRef.current.x - planet.x, mouseRef.current.y - planet.y);
        const isHovered = dist < planet.planetRadius * 2.5;
        if (isHovered) foundHover = planet;
        drawPlanet(ctx, planet, t, isHovered);
      }

      if (foundHover !== hoveredPlanet) {
        setHoveredPlanet(foundHover);
      }

      // Ripples
      const ripples = ripplesRef.current;
      for (let i = ripples.length - 1; i >= 0; i--) {
        ripples[i].radius += 1.5;
        ripples[i].life++;
        if (ripples[i].radius > ripples[i].maxRadius) {
          ripples.splice(i, 1);
          continue;
        }
        drawRipple(ctx, ripples[i]);
      }

      // Periodic ambient ripple from center
      if (t % 400 === 0) {
        ripplesRef.current.push({
          x: cx, y: cy,
          radius: 5,
          maxRadius: Math.min(w, h) * 0.35,
          life: 0,
          color: "#22c55e",
        });
      }

      // Stats footer
      ctx.save();
      ctx.font = "bold 9px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      const clean = planets.filter((p) => p.status === "CLEAN").length;
      const dirty = planets.filter((p) => p.status === "DIRTY").length;
      const total = planets.length;
      ctx.fillText(`${clean} CLEAN · ${dirty} DIRTY · ${total} BODIES`, cx, h - 12);
      ctx.restore();

      animRef.current = requestAnimationFrame(frame);
    };

    animRef.current = requestAnimationFrame(frame);

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animRef.current);
      } else {
        animRef.current = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelAnimationFrame(animRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [dims, hoveredPlanet]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const clicked = planetsRef.current.find(
      (p) => Math.hypot(mx - p.x, my - p.y) < p.planetRadius * 2.5,
    );
    onPhaseSelect?.(clicked?.phase ?? null);
  }, [onPhaseSelect]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden" style={{ border: "1px solid rgba(34,197,94,0.1)" }}>
      <canvas
        ref={canvasRef}
        className="w-full cursor-crosshair"
        style={{ height: 560 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { mouseRef.current = { x: -999, y: -999 }; setHoveredPlanet(null); }}
        onClick={handleClick}
      />

      {/* Hover tooltip */}
      {hoveredPlanet && (
        <div
          className="absolute pointer-events-none rounded-lg px-3 py-2.5 z-10 max-w-[240px]"
          style={{
            left: Math.min(hoveredPlanet.x + 20, dims.w - 260),
            top: Math.max(10, hoveredPlanet.y - 90),
            background: "rgba(8, 12, 24, 0.95)",
            border: `1px solid ${hoveredPlanet.color}30`,
            backdropFilter: "blur(12px)",
          }}
        >
          <p className="text-[11px] font-bold" style={{ color: hoveredPlanet.glowColor }}>
            {hoveredPlanet.label}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-[9px] px-1.5 py-0.5 rounded font-medium"
              style={{ background: `${hoveredPlanet.color}15`, color: hoveredPlanet.color }}
            >
              {hoveredPlanet.status.replace(/_/g, " ")}
            </span>
            {hoveredPlanet.version > 0 && (
              <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                v{hoveredPlanet.version}
              </span>
            )}
          </div>
          {hoveredPlanet.dependencies.length > 0 && (
            <p className="text-[8px] mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
              Orbits: {hoveredPlanet.dependencies.map((d) => d.replace(/_/g, " ")).join(", ")}
            </p>
          )}
          {hoveredPlanet.lastComputed && (
            <p className="text-[8px] mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>
              Last computed: {new Date(hoveredPlanet.lastComputed).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {phaseGraph.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
              Orbital system empty
            </p>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
              Run a cascade to populate the phase orbits
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
