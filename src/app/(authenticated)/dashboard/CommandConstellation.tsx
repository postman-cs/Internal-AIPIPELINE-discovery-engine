"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

/* ─── data shape passed from the server page ─── */
export interface ProjectCluster {
  id: string;
  name: string;
  domain: string;
  health: number;
  level: string;
  momentum: "rising" | "steady" | "cooling";
  completedPhases: number;
  totalPhases: number;
  freshness: string;
  activeBlockers: number;
  pendingAssumptions: number;
  isPinned: boolean;
}

interface Props {
  projects: ProjectCluster[];
  stats: { docs: number; chunks: number; aiRuns: number };
}

/* ─── internal types ─── */
interface Star {
  id: string;
  name: string;
  domain: string;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  radius: number;
  health: number;
  level: string;
  momentum: "rising" | "steady" | "cooling";
  completedPhases: number;
  totalPhases: number;
  freshness: string;
  activeBlockers: number;
  pendingAssumptions: number;
  isPinned: boolean;
  color: string;
  glowColor: string;
  orbitAngle: number;
  orbitSpeed: number;
  pulsePhase: number;
  anomalyPulse: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
  life: number;
  maxLife: number;
}

interface SignalLine {
  starIdx: number;
  progress: number;
  speed: number;
  alpha: number;
}

const DOMAIN_COLORS: Record<string, string> = {
  payments: "#00d4aa",
  identity: "#7c5cff",
  infrastructure: "#00b8ff",
  security: "#ff4466",
  commerce: "#ffaa00",
  analytics: "#ff66cc",
  integration: "#44ddff",
  devtools: "#88ff44",
  cloud: "#6699ff",
  api: "#00ffaa",
  default: "#22ccaa",
};

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return `#${[f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function domainColor(domain: string): string {
  const key = domain.toLowerCase().replace(/[^a-z]/g, "");
  for (const [k, v] of Object.entries(DOMAIN_COLORS)) {
    if (key.includes(k)) return v;
  }
  const hash = [...domain].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
  const hue = ((hash % 360) + 360) % 360;
  return hslToHex(hue, 70, 60);
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
  }
  return [34, 204, 170];
}

export default function CommandConstellation({ projects, stats }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<Star[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const signalsRef = useRef<SignalLine[]>([]);
  const hoveredRef = useRef<number>(-1);
  const frameRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const sizeRef = useRef({ w: 0, h: 0 });
  const router = useRouter();
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    star: Star;
  } | null>(null);

  const initStars = useCallback(
    (w: number, h: number) => {
      const cx = w / 2;
      const cy = h / 2;
      const maxOrbit = Math.min(w, h) * 0.38;
      const minOrbit = Math.min(w, h) * 0.15;

      const domainGroups = new Map<string, number[]>();
      projects.forEach((p, i) => {
        const d = p.domain || "default";
        if (!domainGroups.has(d)) domainGroups.set(d, []);
        domainGroups.get(d)!.push(i);
      });

      const domainKeys = [...domainGroups.keys()];
      const angleStep = (Math.PI * 2) / Math.max(domainKeys.length, 1);

      const stars: Star[] = [];

      domainKeys.forEach((domain, di) => {
        const baseAngle = angleStep * di - Math.PI / 2;
        const indices = domainGroups.get(domain)!;

        indices.forEach((pi, si) => {
          const p = projects[pi];
          const spreadAngle = indices.length > 1
            ? baseAngle + ((si - (indices.length - 1) / 2) * 0.25)
            : baseAngle;

          const orbitDist = minOrbit + (maxOrbit - minOrbit) * (0.4 + (p.health / 100) * 0.6);
          const jitter = (Math.random() - 0.5) * 30;
          const x = cx + Math.cos(spreadAngle) * (orbitDist + jitter);
          const y = cy + Math.sin(spreadAngle) * (orbitDist + jitter);

          const color = domainColor(domain);
          const baseRadius = 6 + (p.health / 100) * 14;

          stars.push({
            id: p.id,
            name: p.name,
            domain,
            x,
            y,
            baseX: x,
            baseY: y,
            radius: baseRadius,
            health: p.health,
            level: p.level,
            momentum: p.momentum,
            completedPhases: p.completedPhases,
            totalPhases: p.totalPhases,
            freshness: p.freshness,
            activeBlockers: p.activeBlockers,
            pendingAssumptions: p.pendingAssumptions,
            isPinned: p.isPinned,
            color,
            glowColor: color,
            orbitAngle: spreadAngle,
            orbitSpeed: 0.0002 + Math.random() * 0.0003,
            pulsePhase: Math.random() * Math.PI * 2,
            anomalyPulse: 0,
          });
        });
      });

      starsRef.current = stars;

      // Init signal lines from nexus to each star
      signalsRef.current = stars.map((_, i) => ({
        starIdx: i,
        progress: Math.random(),
        speed: 0.003 + Math.random() * 0.004,
        alpha: 0.15 + Math.random() * 0.2,
      }));
    },
    [projects],
  );

  const spawnParticle = useCallback((cx: number, cy: number) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.1 + Math.random() * 0.3;
    const maxLife = 200 + Math.random() * 300;
    particlesRef.current.push({
      x: cx + (Math.random() - 0.5) * 20,
      y: cy + (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 0.5 + Math.random() * 1.5,
      alpha: 0.3 + Math.random() * 0.5,
      color: ["#22ccaa", "#00b8ff", "#7c5cff", "#ffffff"][Math.floor(Math.random() * 4)],
      life: 0,
      maxLife,
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;

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
    window.addEventListener("resize", resize);

    const render = () => {
      const { w, h } = sizeRef.current;
      const cx = w / 2;
      const cy = h / 2;
      const t = frameRef.current++;

      ctx.clearRect(0, 0, w, h);

      // Background deep space gradient
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
      bgGrad.addColorStop(0, "rgba(8, 18, 30, 0.95)");
      bgGrad.addColorStop(0.5, "rgba(4, 10, 20, 0.98)");
      bgGrad.addColorStop(1, "rgba(2, 6, 14, 1)");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Ambient star dust
      if (t % 3 === 0) spawnParticle(cx, cy);
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        if (p.life >= p.maxLife || p.x < -10 || p.x > w + 10 || p.y < -10 || p.y > h + 10) {
          particles.splice(i, 1);
          continue;
        }
        const fade = 1 - p.life / p.maxLife;
        ctx.globalAlpha = p.alpha * fade;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Signal lines from nexus to stars
      const stars = starsRef.current;
      const signals = signalsRef.current;
      for (const sig of signals) {
        const star = stars[sig.starIdx];
        if (!star) continue;
        sig.progress += sig.speed;
        if (sig.progress > 1) sig.progress = 0;

        const dx = star.x - cx;
        const dy = star.y - cy;

        // Faint line
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(star.x, star.y);
        ctx.strokeStyle = `rgba(34, 204, 170, ${sig.alpha * 0.15})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Traveling pulse
        const px = cx + dx * sig.progress;
        const py = cy + dy * sig.progress;
        const pulseGrad = ctx.createRadialGradient(px, py, 0, px, py, 4);
        pulseGrad.addColorStop(0, `rgba(34, 204, 170, ${sig.alpha * 0.8})`);
        pulseGrad.addColorStop(1, "rgba(34, 204, 170, 0)");
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = pulseGrad;
        ctx.fill();
      }

      // ─── Command Nexus (center) ───
      const nexusPulse = 0.8 + Math.sin(t * 0.02) * 0.2;
      const avgHealth = projects.length > 0
        ? projects.reduce((s, p) => s + p.health, 0) / projects.length
        : 0;
      const nexusRadius = 18 + avgHealth * 0.12;

      // Outer rings
      for (let ring = 3; ring >= 1; ring--) {
        const ringR = nexusRadius + ring * 18;
        const ringAlpha = 0.04 + (3 - ring) * 0.02;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR * nexusPulse, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(34, 204, 170, ${ringAlpha})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Nexus glow
      const nexusGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, nexusRadius * 2.5);
      nexusGlow.addColorStop(0, `rgba(34, 204, 170, ${0.3 * nexusPulse})`);
      nexusGlow.addColorStop(0.4, `rgba(34, 204, 170, ${0.1 * nexusPulse})`);
      nexusGlow.addColorStop(1, "rgba(34, 204, 170, 0)");
      ctx.beginPath();
      ctx.arc(cx, cy, nexusRadius * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = nexusGlow;
      ctx.fill();

      // Nexus core
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, nexusRadius);
      coreGrad.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      coreGrad.addColorStop(0.3, "rgba(34, 204, 170, 0.7)");
      coreGrad.addColorStop(0.7, "rgba(34, 204, 170, 0.3)");
      coreGrad.addColorStop(1, "rgba(34, 204, 170, 0)");
      ctx.beginPath();
      ctx.arc(cx, cy, nexusRadius, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Nexus label
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.font = "bold 9px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("COMMAND", cx, cy - 3);
      ctx.fillText("NEXUS", cx, cy + 8);

      // ─── Project Stars ───
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      let newHovered = -1;

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];

        // Gentle orbital drift
        star.orbitAngle += star.orbitSpeed;
        star.x = star.baseX + Math.cos(star.orbitAngle * 3) * 2;
        star.y = star.baseY + Math.sin(star.orbitAngle * 3) * 2;

        star.pulsePhase += 0.03;
        const pulse = 0.85 + Math.sin(star.pulsePhase) * 0.15;
        const momentumMult = star.momentum === "rising" ? 1.15 : star.momentum === "cooling" ? 0.8 : 1;
        const drawRadius = star.radius * pulse * momentumMult;

        // Hit test
        const distMouse = Math.hypot(mx - star.x, my - star.y);
        const isHovered = distMouse < drawRadius + 12;
        if (isHovered) newHovered = i;

        const hoverScale = isHovered ? 1.3 : 1;

        // Phase ring
        if (star.totalPhases > 0) {
          const phaseRingR = drawRadius * hoverScale + 8;
          const phaseArc = (star.completedPhases / star.totalPhases) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(star.x, star.y, phaseRingR, -Math.PI / 2, -Math.PI / 2 + phaseArc);
          ctx.strokeStyle = `${star.color}55`;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Background ring
          ctx.beginPath();
          ctx.arc(star.x, star.y, phaseRingR, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Anomaly warning (active blockers)
        if (star.activeBlockers > 0) {
          star.anomalyPulse += 0.05;
          const anomR = drawRadius * hoverScale + 16;
          const anomAlpha = 0.15 + Math.sin(star.anomalyPulse) * 0.1;
          ctx.beginPath();
          ctx.arc(star.x, star.y, anomR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 68, 102, ${anomAlpha})`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Star glow
        const [r, g, b] = hexToRgb(star.color);
        const glowR = drawRadius * 3 * hoverScale;
        const starGlow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, glowR);
        starGlow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.35 * pulse})`);
        starGlow.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${0.08 * pulse})`);
        starGlow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.beginPath();
        ctx.arc(star.x, star.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = starGlow;
        ctx.fill();

        // Star core
        const coreR = drawRadius * hoverScale;
        const sGrad = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, coreR);
        sGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        sGrad.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.85)`);
        sGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.2)`);
        ctx.beginPath();
        ctx.arc(star.x, star.y, coreR, 0, Math.PI * 2);
        ctx.fillStyle = sGrad;
        ctx.fill();

        // Pinned indicator
        if (star.isPinned) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
          ctx.font = "8px system-ui";
          ctx.textAlign = "center";
          ctx.fillText("⊛", star.x, star.y - drawRadius * hoverScale - 10);
        }

        // Star name label
        ctx.fillStyle = isHovered ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.45)";
        ctx.font = `${isHovered ? "bold " : ""}${isHovered ? 11 : 9}px 'Inter', system-ui, sans-serif`;
        ctx.textAlign = "center";
        const labelY = star.y + drawRadius * hoverScale + 16;
        ctx.fillText(
          star.name.length > 18 ? star.name.slice(0, 16) + "…" : star.name,
          star.x,
          labelY,
        );

        // Domain tag (on hover)
        if (isHovered && star.domain) {
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
          ctx.font = "8px 'Inter', system-ui, sans-serif";
          ctx.fillText(star.domain, star.x, labelY + 13);
        }
      }

      // ─── Domain Nebula labels ───
      const domainGroupMap = new Map<string, { sx: number; sy: number; count: number }>();
      for (const star of stars) {
        const entry = domainGroupMap.get(star.domain) ?? { sx: 0, sy: 0, count: 0 };
        entry.sx += star.x;
        entry.sy += star.y;
        entry.count++;
        domainGroupMap.set(star.domain, entry);
      }

      for (const [domain, entry] of domainGroupMap) {
        if (entry.count < 1) continue;
        const dx = entry.sx / entry.count;
        const dy = entry.sy / entry.count;

        // Nebula cloud
        const [r, g, b] = hexToRgb(domainColor(domain));
        const nebR = 40 + entry.count * 20;
        const nebula = ctx.createRadialGradient(dx, dy, 0, dx, dy, nebR);
        nebula.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.04)`);
        nebula.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.beginPath();
        ctx.arc(dx, dy, nebR, 0, Math.PI * 2);
        ctx.fillStyle = nebula;
        ctx.fill();
      }

      // ─── Stats HUD overlay ───
      const hudY = h - 16;
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      ctx.font = "9px 'Inter', system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${projects.length} Projects`, 16, hudY);
      ctx.fillText(`${stats.docs} Docs`, 110, hudY);
      ctx.fillText(`${stats.aiRuns} AI Runs`, 190, hudY);

      const totalBlockers = projects.reduce((s, p) => s + p.activeBlockers, 0);
      if (totalBlockers > 0) {
        ctx.fillStyle = "rgba(255, 68, 102, 0.6)";
        ctx.fillText(`${totalBlockers} Active Anomalies`, 280, hudY);
      }

      hoveredRef.current = newHovered;
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animId);
      } else {
        animId = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [projects, stats, initStars, spawnParticle]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouseRef.current = { x, y };

      const stars = starsRef.current;
      let found = false;
      for (const star of stars) {
        const dist = Math.hypot(x - star.x, y - star.y);
        if (dist < star.radius + 14) {
          setTooltip({ x: star.x, y: star.y, star });
          found = true;
          break;
        }
      }
      if (!found) setTooltip(null);
    },
    [],
  );

  const handleClick = useCallback(() => {
    if (hoveredRef.current >= 0) {
      const star = starsRef.current[hoveredRef.current];
      if (star) router.push(`/projects/${star.id}`);
    }
  }, [router]);

  const LEVEL_LABELS: Record<string, string> = {
    nascent: "Nascent",
    developing: "Developing",
    solid: "Solid",
    strong: "Strong",
    exceptional: "Exceptional",
  };

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: 520 }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full rounded-xl cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { mouseRef.current = { x: -999, y: -999 }; setTooltip(null); }}
        onClick={handleClick}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-20 px-3 py-2 rounded-lg border backdrop-blur-md transition-all duration-150"
          style={{
            left: Math.min(tooltip.x + 18, sizeRef.current.w - 240),
            top: Math.max(tooltip.y - 70, 8),
            background: "rgba(6, 12, 24, 0.92)",
            borderColor: tooltip.star.color + "44",
            boxShadow: `0 0 20px ${tooltip.star.color}22`,
            maxWidth: 240,
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: tooltip.star.color, boxShadow: `0 0 6px ${tooltip.star.color}` }}
            />
            <span className="text-xs font-semibold text-white truncate">{tooltip.star.name}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
            <span style={{ color: "rgba(255,255,255,0.4)" }}>Health</span>
            <span className="text-right font-medium" style={{ color: tooltip.star.color }}>
              {tooltip.star.health}% · {LEVEL_LABELS[tooltip.star.level] ?? tooltip.star.level}
            </span>
            <span style={{ color: "rgba(255,255,255,0.4)" }}>Phases</span>
            <span className="text-right text-white/70">
              {tooltip.star.completedPhases}/{tooltip.star.totalPhases}
            </span>
            <span style={{ color: "rgba(255,255,255,0.4)" }}>Momentum</span>
            <span className="text-right" style={{
              color: tooltip.star.momentum === "rising" ? "#22ccaa"
                : tooltip.star.momentum === "cooling" ? "#ff4466" : "#88aacc",
            }}>
              {tooltip.star.momentum === "rising" ? "↑ Rising" : tooltip.star.momentum === "cooling" ? "↓ Cooling" : "→ Steady"}
            </span>
            {tooltip.star.activeBlockers > 0 && (
              <>
                <span style={{ color: "rgba(255, 68, 102, 0.7)" }}>Anomalies</span>
                <span className="text-right font-medium" style={{ color: "#ff4466" }}>
                  {tooltip.star.activeBlockers} blocker{tooltip.star.activeBlockers !== 1 ? "s" : ""}
                </span>
              </>
            )}
            {tooltip.star.pendingAssumptions > 0 && (
              <>
                <span style={{ color: "rgba(255, 170, 0, 0.7)" }}>Unverified</span>
                <span className="text-right font-medium" style={{ color: "#ffaa00" }}>
                  {tooltip.star.pendingAssumptions} assumption{tooltip.star.pendingAssumptions !== 1 ? "s" : ""}
                </span>
              </>
            )}
            {tooltip.star.domain && (
              <>
                <span style={{ color: "rgba(255,255,255,0.4)" }}>Domain</span>
                <span className="text-right text-white/60">{tooltip.star.domain}</span>
              </>
            )}
          </div>
          <div className="text-[9px] mt-1.5 text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
            Click to enter system
          </div>
        </div>
      )}

      {/* Corner legend */}
      <div className="absolute top-3 right-3 text-[9px] space-y-1" style={{ color: "rgba(255,255,255,0.3)" }}>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: "#22ccaa" }} />
          <span>Healthy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: "#ffaa00" }} />
          <span>Developing</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full border border-red-500/40" style={{ background: "transparent" }} />
          <span>Anomaly Detected</span>
        </div>
      </div>

      {/* Title overlay */}
      <div className="absolute top-3 left-3">
        <span className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: "rgba(34, 204, 170, 0.5)" }}>
          Galactic Command
        </span>
      </div>
    </div>
  );
}
