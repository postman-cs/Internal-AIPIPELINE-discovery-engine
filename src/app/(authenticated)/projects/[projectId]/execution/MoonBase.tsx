"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { noise } from "@/lib/gamification/planet-draw";

interface MissionEntry {
  id: string;
  title: string;
  type: "meeting" | "working_session";
  date: string;
}

interface MoonBaseProps {
  meetings: MissionEntry[];
  sessions: MissionEntry[];
  projectName: string;
}

interface HabModule {
  cx: number;
  cy: number;
  w: number;
  h: number;
  type: "meeting" | "working_session";
  phase: number;
  label: string;
  windowCount: number;
  hasSolarPanel: boolean;
  hasAirlock: boolean;
}

interface Rover {
  fromIdx: number;
  toIdx: number;
  progress: number;
  speed: number;
  wheelPhase: number;
}

interface Astronaut {
  fromIdx: number;
  toIdx: number;
  progress: number;
  speed: number;
  bounce: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind: "dust" | "vent";
}

const SUN_ANGLE = -Math.PI * 0.3;
const SUN_DX = Math.cos(SUN_ANGLE);
const SUN_DY = Math.sin(SUN_ANGLE);

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export default function MoonBase({ meetings, sessions, projectName }: MoonBaseProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const timeRef = useRef(0);
  const habsRef = useRef<HabModule[]>([]);
  const roversRef = useRef<Rover[]>([]);
  const astronautsRef = useRef<Astronaut[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<{ x: number; y: number; size: number; twinkle: number; hue: number }[]>([]);
  const [dimensions, setDimensions] = useState({ w: 900, h: 500 });
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const mouseRef = useRef({ x: -999, y: -999 });

  const allMissions = useMemo(() => [
    ...meetings.map((m) => ({ ...m, mtype: "meeting" as const })),
    ...sessions.map((s) => ({ ...s, mtype: "working_session" as const })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [meetings, sessions]);

  const totalMissions = allMissions.length;

  // Layout
  useEffect(() => {
    const { w, h } = dimensions;

    const stars: typeof starsRef.current = [];
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h * 0.65,
        size: 0.2 + Math.pow(Math.random(), 3) * 2,
        twinkle: Math.random() * Math.PI * 2,
        hue: 200 + Math.random() * 40,
      });
    }
    starsRef.current = stars;

    const moonCx = w * 0.5;
    const moonR = Math.min(w, h) * 0.32;
    const surfaceY = h * 0.52;

    const habs: HabModule[] = [];
    const spacing = Math.min(38, (w * 0.6) / Math.max(allMissions.length, 1));

    allMissions.forEach((entry, i) => {
      const col = i % 7;
      const row = Math.floor(i / 7);
      const xOff = (col - Math.min(allMissions.length - 1, 6) / 2) * spacing;
      const yOff = row * 22;

      const arcX = moonCx + xOff + (row % 2 === 1 ? spacing * 0.4 : 0);
      const distFromCenter = Math.abs(xOff) / moonR;
      const arcDip = distFromCenter * distFromCenter * 8;

      habs.push({
        cx: arcX,
        cy: surfaceY + arcDip + yOff,
        w: 20 + noise(i, 200) * 10,
        h: 10 + noise(i, 201) * 4,
        type: entry.mtype,
        phase: noise(i, 202) * Math.PI * 2,
        label: entry.title,
        windowCount: 2 + Math.floor(noise(i, 203) * 3),
        hasSolarPanel: noise(i, 204) > 0.4,
        hasAirlock: noise(i, 205) > 0.6,
      });
    });
    habsRef.current = habs;

    const rovers: Rover[] = [];
    if (habs.length >= 2) {
      const count = Math.min(Math.floor(habs.length / 2), 3);
      for (let i = 0; i < count; i++) {
        rovers.push({
          fromIdx: (i * 2) % habs.length,
          toIdx: (i * 2 + 1) % habs.length,
          progress: noise(i, 410),
          speed: 0.0012 + noise(i, 411) * 0.001,
          wheelPhase: 0,
        });
      }
    }
    roversRef.current = rovers;

    const astros: Astronaut[] = [];
    if (habs.length >= 2) {
      const count = Math.min(habs.length - 1, 4);
      for (let i = 0; i < count; i++) {
        astros.push({
          fromIdx: i % habs.length,
          toIdx: (i + 1) % habs.length,
          progress: noise(i, 420),
          speed: 0.0006 + noise(i, 421) * 0.0004,
          bounce: noise(i, 422) * Math.PI * 2,
        });
      }
    }
    astronautsRef.current = astros;
    particlesRef.current = [];
  }, [allMissions, dimensions]);

  // Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const cw = rect.width;
      const ch = 500;
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      setDimensions({ w: cw, h: ch });
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const frame = () => {
      const dpr = window.devicePixelRatio || 1;
      const { w, h } = dimensions;
      timeRef.current++;
      const t = timeRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // ===== SKY =====
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#020408");
      sky.addColorStop(0.45, "#060a14");
      sky.addColorStop(1, "#0c1018");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Stars with color temperature
      for (const star of starsRef.current) {
        const alpha = 0.2 + Math.sin(t * 0.012 + star.twinkle) * 0.15;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${star.hue},30%,85%,${alpha})`;
        ctx.fill();
        if (star.size > 1.4) {
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${star.hue},30%,85%,${alpha * 0.08})`;
          ctx.fill();
        }
      }

      // Earth in the sky
      const earthX = w * 0.82;
      const earthY = h * 0.12;
      const earthR = 14;
      ctx.save();
      const earthGlow = ctx.createRadialGradient(earthX, earthY, earthR, earthX, earthY, earthR * 3);
      earthGlow.addColorStop(0, "rgba(70,130,220,0.06)");
      earthGlow.addColorStop(1, "transparent");
      ctx.fillStyle = earthGlow;
      ctx.fillRect(earthX - earthR * 4, earthY - earthR * 4, earthR * 8, earthR * 8);
      ctx.beginPath();
      ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2);
      const eGrad = ctx.createRadialGradient(earthX - 4, earthY - 3, 1, earthX, earthY, earthR);
      eGrad.addColorStop(0, "#5590d0");
      eGrad.addColorStop(0.4, "#3070b0");
      eGrad.addColorStop(0.7, "#205898");
      eGrad.addColorStop(1, "#103060");
      ctx.fillStyle = eGrad;
      ctx.fill();
      // Continents hint
      ctx.beginPath();
      ctx.arc(earthX + 2, earthY - 3, 5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(80,160,80,0.15)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(earthX - 4, earthY + 2, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(80,160,80,0.12)";
      ctx.fill();
      // Atmosphere rim
      ctx.beginPath();
      ctx.arc(earthX, earthY, earthR + 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(100,180,255,0.15)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // ===== MOON SURFACE =====
      const moonCx = w * 0.5;
      const moonR = Math.min(w, h) * 0.32;
      const surfaceY = h * 0.52;

      // Horizon glow from sun
      const horizonGlow = ctx.createLinearGradient(0, surfaceY - moonR * 0.15, 0, surfaceY + 10);
      horizonGlow.addColorStop(0, "transparent");
      horizonGlow.addColorStop(0.5, "rgba(220,210,190,0.03)");
      horizonGlow.addColorStop(1, "transparent");
      ctx.fillStyle = horizonGlow;
      ctx.fillRect(0, surfaceY - moonR * 0.15, w, moonR * 0.3);

      // Lunar surface (curved horizon)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, surfaceY);
      ctx.quadraticCurveTo(moonCx, surfaceY - 20, w, surfaceY);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.clip();

      // Surface gradient with regolith texture
      const surfGrad = ctx.createLinearGradient(0, surfaceY - 20, 0, h);
      surfGrad.addColorStop(0, "#8a8890");
      surfGrad.addColorStop(0.15, "#6a686e");
      surfGrad.addColorStop(0.5, "#505058");
      surfGrad.addColorStop(1, "#383840");
      ctx.fillStyle = surfGrad;
      ctx.fillRect(0, surfaceY - 25, w, h - surfaceY + 30);

      // Regolith grain texture
      for (let i = 0; i < 300; i++) {
        const gx = noise(i, 600) * w;
        const gy = surfaceY + noise(i, 601) * (h - surfaceY);
        const gs = 0.3 + noise(i, 602) * 0.8;
        const ga = 0.04 + noise(i, 603) * 0.06;
        ctx.beginPath();
        ctx.arc(gx, gy, gs, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(140,138,145,${ga})`;
        ctx.fill();
      }

      // Small surface rocks
      for (let i = 0; i < 12; i++) {
        const rx = noise(i, 610) * w;
        const ry = surfaceY + 5 + noise(i, 611) * (h - surfaceY - 30);
        const rw = 1.5 + noise(i, 612) * 4;
        const rh = 0.8 + noise(i, 613) * 2;
        ctx.fillStyle = `rgba(90,88,95,${0.2 + noise(i, 614) * 0.15})`;
        ctx.beginPath();
        ctx.ellipse(rx, ry, rw, rh, 0, 0, Math.PI * 2);
        ctx.fill();
        // Rock shadow
        ctx.fillStyle = "rgba(30,28,35,0.08)";
        ctx.beginPath();
        ctx.ellipse(rx + rw * 0.5, ry + rh * 0.3, rw * 0.8, rh * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Surface craters
      for (let i = 0; i < 8; i++) {
        const ccx = noise(i, 620) * w;
        const ccy = surfaceY + 15 + noise(i, 621) * (h - surfaceY - 50);
        const cr = 5 + noise(i, 622) * 20;
        // Shadow side
        ctx.beginPath();
        ctx.arc(ccx, ccy, cr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(45,43,50,${0.08 + noise(i, 623) * 0.08})`;
        ctx.fill();
        // Lit rim
        ctx.beginPath();
        ctx.arc(ccx - cr * 0.1, ccy - cr * 0.1, cr * 0.92, -Math.PI * 0.8, Math.PI * 0.3);
        ctx.strokeStyle = `rgba(150,148,155,${0.06 + noise(i, 624) * 0.06})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Rover tracks near the base
      if (totalMissions > 0) {
        ctx.beginPath();
        const trackY = surfaceY + 18;
        ctx.moveTo(moonCx - 80, trackY);
        for (let x = -80; x <= 80; x += 2) {
          ctx.lineTo(moonCx + x, trackY + noise(Math.floor(x), 630) * 2 - 1);
        }
        ctx.strokeStyle = "rgba(100,98,105,0.08)";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.restore();

      // ===== CORRIDORS (pressurized tubes) =====
      const habs = habsRef.current;
      for (let i = 1; i < habs.length; i++) {
        const a = habs[i - 1];
        const b = habs[i];
        const dx = b.cx - a.cx;
        const dy = b.cy - a.cy;
        const len = Math.hypot(dx, dy);
        if (len > 120) continue;

        const nx = -dy / len;
        const ny = dx / len;
        const tubeW = 1.8;

        ctx.beginPath();
        ctx.moveTo(a.cx + nx * tubeW, a.cy + ny * tubeW);
        ctx.lineTo(b.cx + nx * tubeW, b.cy + ny * tubeW);
        ctx.lineTo(b.cx - nx * tubeW, b.cy - ny * tubeW);
        ctx.lineTo(a.cx - nx * tubeW, a.cy - ny * tubeW);
        ctx.closePath();
        ctx.fillStyle = "rgba(120,118,125,0.25)";
        ctx.fill();
        ctx.strokeStyle = "rgba(180,178,185,0.1)";
        ctx.lineWidth = 0.4;
        ctx.stroke();

        // Segment rings on corridor
        const segments = Math.floor(len / 8);
        for (let s = 1; s < segments; s++) {
          const sp = s / segments;
          const sx = lerp(a.cx, b.cx, sp);
          const sy = lerp(a.cy, b.cy, sp);
          ctx.beginPath();
          ctx.moveTo(sx + nx * tubeW * 1.2, sy + ny * tubeW * 1.2);
          ctx.lineTo(sx - nx * tubeW * 1.2, sy - ny * tubeW * 1.2);
          ctx.strokeStyle = "rgba(160,158,165,0.08)";
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      // ===== HAB MODULES =====
      let hovLabel: string | null = null;

      for (let hi = 0; hi < habs.length; hi++) {
        const hab = habs[hi];
        const pulse = 0.5 + Math.sin(t * 0.02 + hab.phase) * 0.25;
        const isMeeting = hab.type === "meeting";
        const halfW = hab.w / 2;
        const halfH = hab.h / 2;
        const capR = halfH;

        // Cast shadow on the surface
        const shadowOffX = 4;
        const shadowOffY = 3;
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.moveTo(hab.cx - halfW + shadowOffX, hab.cy - halfH + capR + shadowOffY);
        ctx.arcTo(hab.cx - halfW + shadowOffX, hab.cy - halfH + shadowOffY, hab.cx - halfW + capR + shadowOffX, hab.cy - halfH + shadowOffY, capR);
        ctx.lineTo(hab.cx + halfW - capR + shadowOffX, hab.cy - halfH + shadowOffY);
        ctx.arcTo(hab.cx + halfW + shadowOffX, hab.cy - halfH + shadowOffY, hab.cx + halfW + shadowOffX, hab.cy - halfH + capR + shadowOffY, capR);
        ctx.lineTo(hab.cx + halfW + shadowOffX, hab.cy + halfH - capR + shadowOffY);
        ctx.arcTo(hab.cx + halfW + shadowOffX, hab.cy + halfH + shadowOffY, hab.cx + halfW - capR + shadowOffX, hab.cy + halfH + shadowOffY, capR);
        ctx.lineTo(hab.cx - halfW + capR + shadowOffX, hab.cy + halfH + shadowOffY);
        ctx.arcTo(hab.cx - halfW + shadowOffX, hab.cy + halfH + shadowOffY, hab.cx - halfW + shadowOffX, hab.cy + halfH - capR + shadowOffY, capR);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Hab body (rounded capsule shape)
        const bodyGrad = ctx.createLinearGradient(
          hab.cx - halfW, hab.cy - halfH,
          hab.cx + halfW * 0.3, hab.cy + halfH,
        );
        const tint = isMeeting ? [85, 140, 220] : [145, 100, 210];
        bodyGrad.addColorStop(0, `rgba(${tint[0] + 40},${tint[1] + 40},${tint[2] + 20},0.55)`);
        bodyGrad.addColorStop(0.5, `rgba(${tint[0]},${tint[1]},${tint[2]},0.45)`);
        bodyGrad.addColorStop(1, `rgba(${tint[0] - 30},${tint[1] - 30},${tint[2] - 20},0.4)`);

        ctx.beginPath();
        ctx.moveTo(hab.cx - halfW, hab.cy - halfH + capR);
        ctx.arcTo(hab.cx - halfW, hab.cy - halfH, hab.cx - halfW + capR, hab.cy - halfH, capR);
        ctx.lineTo(hab.cx + halfW - capR, hab.cy - halfH);
        ctx.arcTo(hab.cx + halfW, hab.cy - halfH, hab.cx + halfW, hab.cy - halfH + capR, capR);
        ctx.lineTo(hab.cx + halfW, hab.cy + halfH - capR);
        ctx.arcTo(hab.cx + halfW, hab.cy + halfH, hab.cx + halfW - capR, hab.cy + halfH, capR);
        ctx.lineTo(hab.cx - halfW + capR, hab.cy + halfH);
        ctx.arcTo(hab.cx - halfW, hab.cy + halfH, hab.cx - halfW, hab.cy + halfH - capR, capR);
        ctx.closePath();
        ctx.fillStyle = bodyGrad;
        ctx.fill();

        // Hull panels
        ctx.strokeStyle = `rgba(200,200,210,${(0.08 + pulse * 0.06).toFixed(2)})`;
        ctx.lineWidth = 0.4;
        ctx.stroke();

        // Panel seam lines
        for (let pi = 1; pi < 3; pi++) {
          const px = hab.cx - halfW + (hab.w / 3) * pi;
          ctx.beginPath();
          ctx.moveTo(px, hab.cy - halfH + 2);
          ctx.lineTo(px, hab.cy + halfH - 2);
          ctx.strokeStyle = "rgba(200,200,210,0.05)";
          ctx.lineWidth = 0.3;
          ctx.stroke();
        }

        // Windows with interior light spill
        for (let wi = 0; wi < hab.windowCount; wi++) {
          const winSpacing = hab.w / (hab.windowCount + 1);
          const wx = hab.cx - halfW + winSpacing * (wi + 1);
          const wy = hab.cy - 1;
          const ww = 3;
          const wh = 2.5;

          const flicker = Math.sin(t * 0.035 + hab.phase + wi * 1.7);
          const brightness = flicker > -0.3 ? 0.6 + flicker * 0.2 : 0.15;
          const wColor = isMeeting
            ? `rgba(140,200,255,${brightness.toFixed(2)})`
            : `rgba(200,160,255,${brightness.toFixed(2)})`;

          // Window frame
          ctx.fillStyle = "rgba(50,50,60,0.4)";
          ctx.fillRect(wx - ww / 2 - 0.5, wy - wh / 2 - 0.5, ww + 1, wh + 1);

          // Window glass
          ctx.fillStyle = wColor;
          ctx.fillRect(wx - ww / 2, wy - wh / 2, ww, wh);

          // Light spill onto regolith below
          if (brightness > 0.4) {
            const spillGlow = ctx.createRadialGradient(
              wx, hab.cy + halfH + 3, 0,
              wx, hab.cy + halfH + 3, 8,
            );
            const spillColor = isMeeting ? "140,200,255" : "200,160,255";
            spillGlow.addColorStop(0, `rgba(${spillColor},${(brightness * 0.06).toFixed(3)})`);
            spillGlow.addColorStop(1, "transparent");
            ctx.fillStyle = spillGlow;
            ctx.fillRect(wx - 8, hab.cy + halfH, 16, 10);
          }
        }

        // Solar panels
        if (hab.hasSolarPanel) {
          const panelAngle = Math.sin(t * 0.003 + hab.phase) * 0.15;
          const panelX = hab.cx + halfW + 3;
          const panelY = hab.cy - halfH + 2;

          // Mast
          ctx.beginPath();
          ctx.moveTo(hab.cx + halfW, hab.cy - halfH + halfH * 0.5);
          ctx.lineTo(panelX, panelY + 2);
          ctx.strokeStyle = "rgba(160,160,170,0.3)";
          ctx.lineWidth = 0.6;
          ctx.stroke();

          // Panel
          ctx.save();
          ctx.translate(panelX, panelY);
          ctx.rotate(panelAngle);
          ctx.fillStyle = "rgba(30,40,80,0.5)";
          ctx.fillRect(-1, -4, 8, 8);
          ctx.strokeStyle = "rgba(100,120,180,0.25)";
          ctx.lineWidth = 0.4;
          ctx.strokeRect(-1, -4, 8, 8);
          // Grid lines
          ctx.strokeStyle = "rgba(100,120,180,0.12)";
          ctx.beginPath();
          ctx.moveTo(3, -4);
          ctx.lineTo(3, 4);
          ctx.moveTo(-1, 0);
          ctx.lineTo(7, 0);
          ctx.stroke();
          // Reflection glint
          const glint = Math.sin(t * 0.01 + hab.phase) * 0.5 + 0.5;
          ctx.fillStyle = `rgba(180,200,255,${(glint * 0.08).toFixed(3)})`;
          ctx.fillRect(-1, -4, 8, 8);
          ctx.restore();
        }

        // Airlock indicator
        if (hab.hasAirlock) {
          const alX = hab.cx - halfW - 1;
          const alY = hab.cy;
          ctx.fillStyle = "rgba(120,120,130,0.3)";
          ctx.fillRect(alX - 3, alY - 2.5, 3, 5);
          ctx.strokeStyle = "rgba(180,180,190,0.15)";
          ctx.lineWidth = 0.4;
          ctx.strokeRect(alX - 3, alY - 2.5, 3, 5);
          // Status LED
          const airlockCycling = Math.sin(t * 0.05 + hi) > 0.8;
          ctx.beginPath();
          ctx.arc(alX - 1.5, alY - 3.5, 0.8, 0, Math.PI * 2);
          ctx.fillStyle = airlockCycling ? "rgba(255,200,50,0.8)" : "rgba(50,200,80,0.6)";
          ctx.fill();
        }

        // Life support venting (periodic gas release)
        if (hi % 3 === 0 && t % 180 < 40) {
          const ventX = hab.cx + halfW * 0.3;
          const ventY = hab.cy - halfH;
          if (t % 4 === 0) {
            for (let v = 0; v < 2; v++) {
              particlesRef.current.push({
                x: ventX + (Math.random() - 0.5) * 3,
                y: ventY,
                vx: (Math.random() - 0.5) * 0.3,
                vy: -0.15 - Math.random() * 0.2,
                life: 50 + Math.random() * 30,
                maxLife: 80,
                size: 0.8 + Math.random() * 1.2,
                kind: "vent",
              });
            }
          }
        }

        // Hover detection
        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;
        if (mx >= hab.cx - halfW - 2 && mx <= hab.cx + halfW + 2 && my >= hab.cy - halfH - 2 && my <= hab.cy + halfH + 2) {
          hovLabel = hab.label;
          ctx.strokeStyle = "rgba(255,220,140,0.4)";
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      // ===== MAIN ANTENNA =====
      if (habs.length > 0) {
        const topHab = habs.reduce((a, b) => (a.cy < b.cy ? a : b));
        const antX = topHab.cx;
        const antY = topHab.cy - topHab.h / 2;

        // Mast
        ctx.beginPath();
        ctx.moveTo(antX, antY);
        ctx.lineTo(antX, antY - 22);
        ctx.strokeStyle = "rgba(180,180,190,0.3)";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Cross brace
        ctx.beginPath();
        ctx.moveTo(antX - 2, antY - 8);
        ctx.lineTo(antX + 2, antY - 14);
        ctx.moveTo(antX + 2, antY - 8);
        ctx.lineTo(antX - 2, antY - 14);
        ctx.strokeStyle = "rgba(180,180,190,0.15)";
        ctx.lineWidth = 0.4;
        ctx.stroke();

        // Dish (slowly rotating)
        const dishAngle = Math.sin(t * 0.004) * 0.4;
        ctx.save();
        ctx.translate(antX, antY - 22);
        ctx.rotate(dishAngle);
        ctx.beginPath();
        ctx.ellipse(0, 0, 6, 2.5, 0, Math.PI, 0);
        ctx.strokeStyle = "rgba(255,108,55,0.45)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "rgba(255,108,55,0.08)";
        ctx.fill();
        // Feed horn
        ctx.beginPath();
        ctx.moveTo(0, -1);
        ctx.lineTo(0, -5);
        ctx.strokeStyle = "rgba(200,200,210,0.25)";
        ctx.lineWidth = 0.6;
        ctx.stroke();
        ctx.restore();

        // Beacon light
        const blink = Math.sin(t * 0.06) > 0.3;
        if (blink) {
          ctx.beginPath();
          ctx.arc(antX, antY - 22, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,60,60,0.9)";
          ctx.fill();
          const blGlow = ctx.createRadialGradient(antX, antY - 22, 0, antX, antY - 22, 10);
          blGlow.addColorStop(0, "rgba(255,60,60,0.15)");
          blGlow.addColorStop(1, "transparent");
          ctx.fillStyle = blGlow;
          ctx.beginPath();
          ctx.arc(antX, antY - 22, 10, 0, Math.PI * 2);
          ctx.fill();
        }

        // Signal waves
        const sigCycle = (t * 0.015) % 1;
        for (let s = 0; s < 3; s++) {
          const sp = (sigCycle + s * 0.33) % 1;
          const alpha = 0.12 * (1 - sp);
          const sr = 8 + sp * 25;
          ctx.beginPath();
          ctx.arc(antX, antY - 22, sr, -Math.PI * 0.65, -Math.PI * 0.35);
          ctx.strokeStyle = `rgba(255,108,55,${alpha.toFixed(2)})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }

      // ===== LANDING PAD =====
      if (habs.length > 0) {
        const padX = habs[0].cx;
        const padY = habs[0].cy + habs[0].h / 2 + 12;
        const padR = 14;

        ctx.beginPath();
        ctx.arc(padX, padY, padR, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(90,88,95,0.15)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,108,55,0.2)";
        ctx.lineWidth = 0.6;
        ctx.setLineDash([2, 2]);
        ctx.stroke();
        ctx.setLineDash([]);

        // H marking
        ctx.strokeStyle = "rgba(255,108,55,0.3)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(padX - 4, padY - 4);
        ctx.lineTo(padX - 4, padY + 4);
        ctx.moveTo(padX + 4, padY - 4);
        ctx.lineTo(padX + 4, padY + 4);
        ctx.moveTo(padX - 4, padY);
        ctx.lineTo(padX + 4, padY);
        ctx.stroke();

        // Corner beacons
        const beaconOn = Math.sin(t * 0.05) > 0;
        if (beaconOn) {
          for (let b = 0; b < 4; b++) {
            const ba = (b / 4) * Math.PI * 2 + Math.PI / 4;
            const bx = padX + Math.cos(ba) * (padR - 2);
            const by = padY + Math.sin(ba) * (padR - 2);
            ctx.beginPath();
            ctx.arc(bx, by, 1, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255,108,55,0.7)";
            ctx.fill();
          }
        }
      }

      // ===== ROVERS =====
      const rovers = roversRef.current;

      for (const rover of rovers) {
        if (habs.length < 2) break;
        rover.progress += rover.speed;
        rover.wheelPhase += rover.speed * 80;
        if (rover.progress >= 1) {
          rover.progress = 0;
          rover.fromIdx = rover.toIdx;
          rover.toIdx = (rover.toIdx + 1 + Math.floor(Math.random() * 2)) % habs.length;
        }

        const from = habs[rover.fromIdx];
        const to = habs[rover.toIdx];
        if (!from || !to) continue;

        const rx = lerp(from.cx, to.cx, rover.progress);
        const rySurface = lerp(from.cy + from.h / 2 + 4, to.cy + to.h / 2 + 4, rover.progress);
        const ry = rySurface + Math.sin(rover.wheelPhase * 0.3) * 0.4;

        // Chassis
        ctx.fillStyle = "rgba(160,158,165,0.5)";
        ctx.fillRect(rx - 4, ry - 2, 8, 3);
        // Cabin
        ctx.fillStyle = "rgba(255,108,55,0.4)";
        ctx.fillRect(rx - 2, ry - 4, 4, 2);
        // Windshield
        ctx.fillStyle = "rgba(140,200,255,0.3)";
        ctx.fillRect(rx + 0.5, ry - 3.5, 1.5, 1.2);

        // Wheels
        for (const wxOff of [-3.5, 3.5]) {
          ctx.beginPath();
          ctx.arc(rx + wxOff, ry + 1.5, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(80,78,85,0.6)";
          ctx.fill();
          // Wheel spoke
          ctx.beginPath();
          ctx.moveTo(rx + wxOff, ry + 0.5);
          ctx.lineTo(rx + wxOff + Math.cos(rover.wheelPhase) * 1, ry + 1.5 + Math.sin(rover.wheelPhase) * 1);
          ctx.strokeStyle = "rgba(120,118,125,0.3)";
          ctx.lineWidth = 0.3;
          ctx.stroke();
        }

        // Headlight beam
        const dir = to.cx > from.cx ? 1 : -1;
        const hlGlow = ctx.createRadialGradient(rx + dir * 5, ry - 1, 0, rx + dir * 5, ry - 1, 12);
        hlGlow.addColorStop(0, "rgba(255,240,200,0.06)");
        hlGlow.addColorStop(1, "transparent");
        ctx.fillStyle = hlGlow;
        ctx.fillRect(rx - 12, ry - 12, 24, 24);

        // Dust trail
        if (t % 5 === 0) {
          for (let d = 0; d < 3; d++) {
            particlesRef.current.push({
              x: rx - dir * 3 + (Math.random() - 0.5) * 2,
              y: ry + 2.5,
              vx: -dir * (0.1 + Math.random() * 0.2),
              vy: -0.06 - Math.random() * 0.08,
              life: 60 + Math.random() * 40,
              maxLife: 100,
              size: 0.4 + Math.random() * 0.8,
              kind: "dust",
            });
          }
        }
      }

      // ===== ASTRONAUTS =====
      const astros = astronautsRef.current;

      for (const astro of astros) {
        if (habs.length < 2) break;
        astro.progress += astro.speed;
        astro.bounce += 0.06;
        if (astro.progress >= 1) {
          astro.progress = 0;
          astro.fromIdx = astro.toIdx;
          astro.toIdx = (astro.toIdx + 1) % habs.length;
        }

        const from = habs[astro.fromIdx];
        const to = habs[astro.toIdx];
        if (!from || !to) continue;

        const ax = lerp(from.cx, to.cx, astro.progress);
        const aySurface = lerp(from.cy + from.h / 2 + 2, to.cy + to.h / 2 + 2, astro.progress);
        // Low-gravity bounce
        const bounceH = Math.abs(Math.sin(astro.bounce)) * 2.5;
        const ay = aySurface - bounceH;

        // Legs (spread during bounce)
        const legSpread = bounceH > 0.5 ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(ax, ay + 2);
        ctx.lineTo(ax - legSpread, ay + 4);
        ctx.moveTo(ax, ay + 2);
        ctx.lineTo(ax + legSpread, ay + 4);
        ctx.strokeStyle = "rgba(220,220,230,0.5)";
        ctx.lineWidth = 0.6;
        ctx.stroke();

        // Body
        ctx.fillStyle = "rgba(220,220,230,0.5)";
        ctx.fillRect(ax - 1, ay - 0.5, 2, 3);

        // Helmet
        ctx.beginPath();
        ctx.arc(ax, ay - 1.5, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(220,220,230,0.55)";
        ctx.fill();
        // Visor
        ctx.beginPath();
        ctx.arc(ax + 0.3, ay - 1.5, 0.9, -Math.PI * 0.4, Math.PI * 0.4);
        ctx.fillStyle = "rgba(255,180,60,0.4)";
        ctx.fill();

        // Backpack (life support)
        ctx.fillStyle = "rgba(180,180,190,0.35)";
        ctx.fillRect(ax - 1.8, ay - 0.5, 0.8, 2.5);

        // Footprints in regolith
        if (bounceH < 0.3 && t % 20 === 0) {
          ctx.fillStyle = "rgba(70,68,75,0.05)";
          ctx.fillRect(ax - 0.5, aySurface + 0.5, 1, 0.4);
        }
      }

      // ===== PARTICLES =====
      const parts = particlesRef.current;
      for (let pi = parts.length - 1; pi >= 0; pi--) {
        const p = parts[pi];
        p.x += p.vx;
        p.y += p.vy;
        if (p.kind === "dust") {
          p.vy += 0.0008;
          p.vx *= 0.998;
        } else {
          p.vy -= 0.0003;
          p.size *= 1.005;
        }
        p.life--;
        if (p.life <= 0) { parts.splice(pi, 1); continue; }

        const alpha = (p.life / p.maxLife) * (p.kind === "dust" ? 0.2 : 0.12);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.kind === "dust"
          ? `rgba(150,148,140,${alpha.toFixed(3)})`
          : `rgba(200,220,255,${alpha.toFixed(3)})`;
        ctx.fill();
      }

      // ===== SUPPLY SHUTTLE =====
      if (totalMissions > 0) {
        const sa = t * 0.006;
        const orbitR = 60;
        const sx = w * 0.5 + Math.cos(sa) * orbitR;
        const sy = surfaceY - 65 + Math.sin(sa * 0.8) * 12;

        if (Math.cos(sa) > -0.6) {
          const alpha = 0.35 + Math.cos(sa) * 0.25;
          const ma = sa + Math.PI / 2;

          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(ma);
          // Fuselage
          ctx.fillStyle = `rgba(200,200,210,${alpha.toFixed(2)})`;
          ctx.beginPath();
          ctx.moveTo(7, 0);
          ctx.lineTo(-4, -3);
          ctx.lineTo(-3, 0);
          ctx.lineTo(-4, 3);
          ctx.closePath();
          ctx.fill();
          // Postman orange accent
          ctx.fillStyle = `rgba(255,108,55,${(alpha * 0.6).toFixed(2)})`;
          ctx.fillRect(-2, -0.8, 5, 1.6);
          ctx.restore();

          // Engine trail
          const prevA = sa - 0.08;
          const prevX = w * 0.5 + Math.cos(prevA) * orbitR;
          const prevY = surfaceY - 65 + Math.sin(prevA * 0.8) * 12;
          const trailGrad = ctx.createLinearGradient(sx, sy, prevX, prevY);
          trailGrad.addColorStop(0, `rgba(255,108,55,${(alpha * 0.3).toFixed(2)})`);
          trailGrad.addColorStop(1, "transparent");
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(prevX, prevY);
          ctx.strokeStyle = trailGrad;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // ===== HUD =====
      ctx.save();
      ctx.font = "bold 9px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";

      ctx.fillStyle = "rgba(85,140,220,0.5)";
      ctx.fillRect(14, h - 34, 8, 8);
      ctx.fillStyle = "rgba(200,210,225,0.45)";
      ctx.fillText(`Meetings: ${meetings.length}`, 26, h - 26);

      ctx.fillStyle = "rgba(145,100,210,0.5)";
      ctx.fillRect(14, h - 20, 8, 8);
      ctx.fillStyle = "rgba(200,210,225,0.45)";
      ctx.fillText(`Sessions: ${sessions.length}`, 26, h - 12);

      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,108,55,0.35)";
      ctx.fillText(`${totalMissions * 50} XP`, w - 14, h - 12);
      const baseStatus = totalMissions === 0 ? "AWAITING FIRST MISSION"
        : totalMissions < 3 ? "OUTPOST" : totalMissions < 6 ? "SETTLEMENT"
        : totalMissions < 10 ? "COLONY" : "COMMAND CENTER";
      ctx.fillStyle = "rgba(255,108,55,0.3)";
      ctx.fillText(baseStatus, w - 14, h - 26);
      ctx.restore();

      if (hovLabel !== hoveredModule) setHoveredModule(hovLabel);
      animRef.current = requestAnimationFrame(frame);
    };

    animRef.current = requestAnimationFrame(frame);
    const handleVis = () => {
      if (document.hidden) cancelAnimationFrame(animRef.current);
      else animRef.current = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", handleVis);
    return () => { cancelAnimationFrame(animRef.current); document.removeEventListener("visibilitychange", handleVis); };
  }, [dimensions, allMissions, totalMissions, meetings.length, sessions.length, projectName, hoveredModule]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  return (
    <div className="relative w-full rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,108,55,0.08)" }}>
      <canvas
        ref={canvasRef}
        className="w-full cursor-crosshair"
        style={{ height: 500 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { mouseRef.current = { x: -999, y: -999 }; setHoveredModule(null); }}
      />
      {hoveredModule && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none rounded-lg px-3 py-1.5 z-10"
          style={{ background: "rgba(6,10,20,0.92)", border: "1px solid rgba(255,108,55,0.25)", backdropFilter: "blur(12px)" }}
        >
          <p className="text-[11px] font-medium" style={{ color: "rgba(255,200,160,0.85)" }}>{hoveredModule}</p>
        </div>
      )}
      {totalMissions === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center max-w-xs">
            <p className="text-sm font-medium" style={{ color: "rgba(255,200,160,0.6)" }}>Base site ready</p>
            <p className="text-xs mt-1" style={{ color: "rgba(200,210,255,0.3)" }}>Ingest a meeting or working session transcript to start building</p>
          </div>
        </div>
      )}
    </div>
  );
}
