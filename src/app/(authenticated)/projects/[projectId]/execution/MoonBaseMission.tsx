"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { drawEvolutionPlanet } from "@/lib/gamification/planet-draw";
import { noise } from "@/lib/gamification/planet-draw";

interface MissionEntry {
  id: string;
  title: string;
  type: "meeting" | "working_session";
  date: string;
}

export interface DeploymentStepEntry {
  index: number;
  title: string;
  executed: boolean;
}

interface MoonBaseMissionProps {
  meetings?: MissionEntry[];
  sessions?: MissionEntry[];
  deploymentSteps?: DeploymentStepEntry[];
  launchQueue?: number[];
  userLevel: number;
  projectName: string;
}

type ShipKind = "meeting" | "working_session" | "deployment";

interface Ship {
  progress: number;
  speed: number;
  type: ShipKind;
  label: string;
  trailHue: number;
  yOffset: number;
  landed: boolean;
  trail: { x: number; y: number; a: number }[];
}

interface HabModule {
  cx: number;
  cy: number;
  w: number;
  h: number;
  type: ShipKind;
  phase: number;
  label: string;
  windows: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export default function MoonBaseMission({
  meetings = [],
  sessions = [],
  deploymentSteps = [],
  launchQueue = [],
  userLevel,
  projectName,
}: MoonBaseMissionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const timeRef = useRef(0);
  const shipsRef = useRef<Ship[]>([]);
  const habsRef = useRef<HabModule[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<{ x: number; y: number; size: number; twinkle: number; hue: number }[]>([]);
  const [dimensions, setDimensions] = useState({ w: 900, h: 460 });
  const [hoveredShip, setHoveredShip] = useState<string | null>(null);
  const mouseRef = useRef({ x: -999, y: -999 });
  const processedLaunchesRef = useRef<Set<number>>(new Set());

  const executedDeploySteps = useMemo(() => deploymentSteps.filter((s) => s.executed), [deploymentSteps]);
  const totalMissions = meetings.length + sessions.length + executedDeploySteps.length;

  // Layout
  useEffect(() => {
    const { w, h } = dimensions;

    const stars: typeof starsRef.current = [];
    for (let i = 0; i < 180; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: 0.2 + Math.pow(Math.random(), 3) * 2,
        twinkle: Math.random() * Math.PI * 2,
        hue: 195 + Math.random() * 45,
      });
    }
    starsRef.current = stars;

    const moonCx = w * 0.78;
    const moonCy = h * 0.50;
    const moonR = Math.min(w, h) * 0.16;

    const ships: Ship[] = [];
    const allEntries: { title: string; type: ShipKind; date: string }[] = [
      ...meetings.map((m) => ({ ...m, type: "meeting" as ShipKind })),
      ...sessions.map((s) => ({ ...s, type: "working_session" as ShipKind })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    for (const step of executedDeploySteps) {
      allEntries.push({ title: step.title, type: "deployment", date: "" });
    }

    allEntries.forEach((entry, i) => {
      const hue = entry.type === "meeting" ? 210 : entry.type === "working_session" ? 275 : 150;
      ships.push({ progress: 1, speed: 0.0008 + noise(i, 100) * 0.0004, type: entry.type, label: entry.title, trailHue: hue, yOffset: (noise(i, 101) - 0.5) * 50, landed: true, trail: [] });
    });
    if (meetings.length > 0) ships.push({ progress: 0.3 + Math.random() * 0.4, speed: 0.0008, type: "meeting", label: "Next meeting...", trailHue: 210, yOffset: 18, landed: false, trail: [] });
    if (sessions.length > 0) ships.push({ progress: 0.1 + Math.random() * 0.3, speed: 0.001, type: "working_session", label: "Next session...", trailHue: 275, yOffset: -22, landed: false, trail: [] });
    const pendingDeploy = deploymentSteps.filter((s) => !s.executed);
    if (pendingDeploy.length > 0 && executedDeploySteps.length > 0) {
      ships.push({ progress: 0.2 + Math.random() * 0.3, speed: 0.0007, type: "deployment", label: pendingDeploy[0].title, trailHue: 150, yOffset: 8, landed: false, trail: [] });
    }
    shipsRef.current = ships;

    // Hab modules on the moon
    const habs: HabModule[] = [];
    allEntries.forEach((entry, i) => {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const angle = ((col - 2) / 3) * 0.45;
      const surfaceDist = moonR * 0.6 + row * 12;
      const cx = moonCx + Math.sin(angle) * surfaceDist + (row % 2) * 6;
      const cy = moonCy + Math.cos(angle) * surfaceDist * 0.3 + moonR * 0.35 + row * 8;
      habs.push({
        cx, cy,
        w: 14 + noise(i, 200) * 8,
        h: 7 + noise(i, 201) * 3,
        type: entry.type,
        phase: noise(i, 202) * Math.PI * 2,
        label: entry.title,
        windows: 2 + Math.floor(noise(i, 203) * 2),
      });
    });
    habsRef.current = habs;
    particlesRef.current = [];
  }, [meetings, sessions, deploymentSteps, executedDeploySteps, dimensions]);

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
      const ch = 460;
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

  // Animation
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

      // Launch queue
      for (const idx of launchQueue) {
        if (!processedLaunchesRef.current.has(idx)) {
          processedLaunchesRef.current.add(idx);
          const step = deploymentSteps.find((s) => s.index === idx);
          if (step) {
            shipsRef.current.push({ progress: 0, speed: 0.0025 + Math.random() * 0.001, type: "deployment", label: step.title, trailHue: 150, yOffset: (Math.random() - 0.5) * 50, landed: false, trail: [] });
          }
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // ===== BACKGROUND =====
      const bg = ctx.createRadialGradient(w * 0.45, h * 0.4, 0, w * 0.45, h * 0.4, w * 0.7);
      bg.addColorStop(0, "#080c1a");
      bg.addColorStop(0.6, "#050912");
      bg.addColorStop(1, "#020408");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Stars
      for (const star of starsRef.current) {
        const alpha = 0.18 + Math.sin(t * 0.011 + star.twinkle) * 0.12;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${star.hue},28%,83%,${alpha})`;
        ctx.fill();
        if (star.size > 1.4) {
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size * 2.8, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${star.hue},28%,83%,${alpha * 0.06})`;
          ctx.fill();
        }
      }

      // Nebula
      const neb = ctx.createRadialGradient(w * 0.42, h * 0.25, 0, w * 0.42, h * 0.25, w * 0.35);
      neb.addColorStop(0, "rgba(80,50,160,0.02)");
      neb.addColorStop(0.5, "rgba(40,80,180,0.015)");
      neb.addColorStop(1, "transparent");
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, w, h);

      // ===== CSE PLANET =====
      const planetCx = w * 0.16;
      const planetCy = h * 0.46;
      const planetR = Math.min(w, h) * 0.12;

      const pGlow = ctx.createRadialGradient(planetCx, planetCy, planetR, planetCx, planetCy, planetR * 2.8);
      pGlow.addColorStop(0, "rgba(6,214,214,0.06)");
      pGlow.addColorStop(1, "transparent");
      ctx.fillStyle = pGlow;
      ctx.fillRect(planetCx - planetR * 3, planetCy - planetR * 3, planetR * 6, planetR * 6);

      drawEvolutionPlanet(ctx, userLevel, planetCx, planetCy, planetR, t * 0.016);

      ctx.font = "bold 10px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(6,214,214,0.6)";
      ctx.fillText("Your World", planetCx, planetCy + planetR + 18);
      ctx.font = "8px Inter, system-ui, sans-serif";
      ctx.fillStyle = "rgba(6,214,214,0.35)";
      ctx.fillText(`Level ${userLevel}`, planetCx, planetCy + planetR + 30);

      // ===== PROJECT MOON =====
      const moonCx = w * 0.78;
      const moonCy = h * 0.50;
      const moonR = Math.min(w, h) * 0.16;

      // Moon ambient glow
      const mGlow = ctx.createRadialGradient(moonCx, moonCy, moonR * 0.85, moonCx, moonCy, moonR * 2.2);
      mGlow.addColorStop(0, "rgba(170,170,185,0.05)");
      mGlow.addColorStop(1, "transparent");
      ctx.fillStyle = mGlow;
      ctx.fillRect(moonCx - moonR * 3, moonCy - moonR * 3, moonR * 6, moonR * 6);

      // Moon body
      const moonGrad = ctx.createRadialGradient(
        moonCx - moonR * 0.25, moonCy - moonR * 0.2, moonR * 0.05,
        moonCx + moonR * 0.08, moonCy + moonR * 0.08, moonR,
      );
      moonGrad.addColorStop(0, "#ccccd4");
      moonGrad.addColorStop(0.3, "#a0a0aa");
      moonGrad.addColorStop(0.6, "#707078");
      moonGrad.addColorStop(1, "#404048");
      ctx.beginPath();
      ctx.arc(moonCx, moonCy, moonR, 0, Math.PI * 2);
      ctx.fillStyle = moonGrad;
      ctx.fill();

      // Craters
      ctx.save();
      ctx.beginPath();
      ctx.arc(moonCx, moonCy, moonR, 0, Math.PI * 2);
      ctx.clip();
      for (let i = 0; i < 14; i++) {
        const ca = noise(i, 300) * Math.PI * 2;
        const cd = noise(i, 301) * moonR * 0.8;
        const cx = moonCx + Math.cos(ca) * cd;
        const cy = moonCy + Math.sin(ca) * cd;
        const cr = 2 + noise(i, 302) * 8;
        const depth = 0.15 + noise(i, 303) * 0.18;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(45,45,52,${depth})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx - cr * 0.12, cy - cr * 0.12, cr * 0.88, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(150,150,160,${depth * 0.35})`;
        ctx.lineWidth = 0.4;
        ctx.stroke();
      }
      // Terrain ridges
      for (let i = 0; i < 4; i++) {
        const ry = moonCy - moonR * 0.4 + i * moonR * 0.25;
        ctx.beginPath();
        for (let x = -0.9; x <= 0.9; x += 0.04) {
          const nx = moonCx + x * moonR;
          const ny = ry + noise(i * 10 + Math.floor(x * 25), 350) * 3 - 1.5;
          if (x === -0.9) ctx.moveTo(nx, ny); else ctx.lineTo(nx, ny);
        }
        ctx.strokeStyle = `rgba(95,95,105,${0.04 + noise(i, 351) * 0.04})`;
        ctx.lineWidth = 0.4;
        ctx.stroke();
      }
      ctx.restore();

      // Edge highlight
      ctx.beginPath();
      ctx.arc(moonCx, moonCy, moonR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(190,190,200,0.06)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Moon label
      ctx.font = "bold 10px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(180,180,195,0.6)";
      ctx.fillText(projectName, moonCx, moonCy + moonR + 18);
      ctx.font = "8px Inter, system-ui, sans-serif";
      ctx.fillStyle = "rgba(180,180,195,0.3)";
      ctx.fillText(`${totalMissions} mission${totalMissions !== 1 ? "s" : ""}`, moonCx, moonCy + moonR + 30);

      // ===== FLIGHT PATH =====
      const pathStartX = planetCx + planetR + 12;
      const pathStartY = planetCy;
      const pathCtrlX = w * 0.47;
      const pathCtrlY = Math.min(planetCy, moonCy) - 90;
      const pathEndX = moonCx - moonR - 12;
      const pathEndY = moonCy;

      // Dashed guide path
      ctx.save();
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(pathStartX, pathStartY);
      ctx.quadraticCurveTo(pathCtrlX, pathCtrlY, pathEndX, pathEndY);
      ctx.strokeStyle = "rgba(100,140,220,0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Path waypoint markers
      for (let wp = 0.2; wp <= 0.8; wp += 0.2) {
        const wpx = (1 - wp) * (1 - wp) * pathStartX + 2 * (1 - wp) * wp * pathCtrlX + wp * wp * pathEndX;
        const wpy = (1 - wp) * (1 - wp) * pathStartY + 2 * (1 - wp) * wp * pathCtrlY + wp * wp * pathEndY;
        ctx.beginPath();
        ctx.arc(wpx, wpy, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(100,140,220,0.1)";
        ctx.fill();
      }

      // ===== HAB MODULES ON MOON =====
      const habs = habsRef.current;

      // Corridors
      for (let i = 1; i < habs.length; i++) {
        const a = habs[i - 1];
        const b = habs[i];
        const dist = Math.hypot(b.cx - a.cx, b.cy - a.cy);
        if (dist > 60) continue;
        ctx.beginPath();
        ctx.moveTo(a.cx, a.cy);
        ctx.lineTo(b.cx, b.cy);
        ctx.strokeStyle = "rgba(140,140,150,0.1)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      for (let hi = 0; hi < habs.length; hi++) {
        const hab = habs[hi];
        const pulse = 0.5 + Math.sin(t * 0.022 + hab.phase) * 0.25;
        const halfW = hab.w / 2;
        const halfH = hab.h / 2;
        const capR = halfH;
        const isMeeting = hab.type === "meeting";
        const isDeploy = hab.type === "deployment";
        const tint = isMeeting ? [75, 145, 230] : isDeploy ? [50, 185, 110] : [155, 105, 220];

        // Shadow
        ctx.save();
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = "#000";
        drawCapsule(ctx, hab.cx + 2, hab.cy + 1.5, halfW, halfH, capR);
        ctx.fill();
        ctx.restore();

        // Body gradient
        const bodyGrad = ctx.createLinearGradient(hab.cx - halfW, hab.cy - halfH, hab.cx + halfW * 0.3, hab.cy + halfH);
        bodyGrad.addColorStop(0, `rgba(${tint[0] + 40},${tint[1] + 40},${tint[2] + 20},0.5)`);
        bodyGrad.addColorStop(0.5, `rgba(${tint[0]},${tint[1]},${tint[2]},0.4)`);
        bodyGrad.addColorStop(1, `rgba(${tint[0] - 25},${tint[1] - 25},${tint[2] - 15},0.35)`);

        drawCapsule(ctx, hab.cx, hab.cy, halfW, halfH, capR);
        ctx.fillStyle = bodyGrad;
        ctx.fill();
        ctx.strokeStyle = `rgba(200,200,215,${(0.08 + pulse * 0.05).toFixed(2)})`;
        ctx.lineWidth = 0.4;
        ctx.stroke();

        // Windows
        for (let wi = 0; wi < hab.windows; wi++) {
          const winSpacing = hab.w / (hab.windows + 1);
          const wx = hab.cx - halfW + winSpacing * (wi + 1);
          const flicker = Math.sin(t * 0.032 + hab.phase + wi * 1.8) > -0.25 ? 0.55 + pulse * 0.25 : 0.12;
          ctx.fillStyle = isMeeting
            ? `rgba(130,195,255,${flicker.toFixed(2)})`
            : isDeploy ? `rgba(100,230,150,${flicker.toFixed(2)})`
            : `rgba(195,155,255,${flicker.toFixed(2)})`;
          ctx.fillRect(wx - 1.3, hab.cy - 0.8, 2.6, 1.8);

          // Light spill
          if (flicker > 0.35) {
            const spill = ctx.createRadialGradient(wx, hab.cy + halfH + 2, 0, wx, hab.cy + halfH + 2, 5);
            const sc = isMeeting ? "130,195,255" : isDeploy ? "100,230,150" : "195,155,255";
            spill.addColorStop(0, `rgba(${sc},${(flicker * 0.04).toFixed(3)})`);
            spill.addColorStop(1, "transparent");
            ctx.fillStyle = spill;
            ctx.fillRect(wx - 5, hab.cy + halfH, 10, 7);
          }
        }
      }

      // Antenna
      if (habs.length > 0) {
        const topHab = habs.reduce((a, b) => (a.cy < b.cy ? a : b));
        const antX = topHab.cx;
        const antY = topHab.cy - topHab.h / 2;

        ctx.beginPath();
        ctx.moveTo(antX, antY);
        ctx.lineTo(antX, antY - 14);
        ctx.strokeStyle = "rgba(180,180,195,0.28)";
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Dish
        const dishA = Math.sin(t * 0.004) * 0.35;
        ctx.save();
        ctx.translate(antX, antY - 14);
        ctx.rotate(dishA);
        ctx.beginPath();
        ctx.ellipse(0, 0, 4, 1.8, 0, Math.PI, 0);
        ctx.strokeStyle = "rgba(255,108,55,0.4)";
        ctx.lineWidth = 0.7;
        ctx.stroke();
        ctx.restore();

        const blink = Math.sin(t * 0.065) > 0.3;
        if (blink) {
          ctx.beginPath();
          ctx.arc(antX, antY - 15, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,60,60,0.85)";
          ctx.fill();
          const blG = ctx.createRadialGradient(antX, antY - 15, 0, antX, antY - 15, 8);
          blG.addColorStop(0, "rgba(255,60,60,0.12)");
          blG.addColorStop(1, "transparent");
          ctx.fillStyle = blG;
          ctx.beginPath();
          ctx.arc(antX, antY - 15, 8, 0, Math.PI * 2);
          ctx.fill();
        }

        // Signal waves
        if (totalMissions > 0) {
          const sigCycle = (t * 0.014) % 1;
          for (let s = 0; s < 3; s++) {
            const sp = (sigCycle + s * 0.33) % 1;
            const alpha = 0.1 * (1 - sp);
            const sr = 6 + sp * 18;
            ctx.beginPath();
            ctx.arc(antX, antY - 15, sr, -Math.PI * 0.65, -Math.PI * 0.35);
            ctx.strokeStyle = `rgba(255,108,55,${alpha.toFixed(2)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Dome
      if (habs.length >= 3) {
        const centerHab = habs[Math.floor(habs.length / 2)];
        const domeR = 8 + Math.min(habs.length, 10);
        ctx.beginPath();
        ctx.arc(centerHab.cx, centerHab.cy - centerHab.h / 2, domeR, Math.PI, 0);
        const dGrad = ctx.createRadialGradient(centerHab.cx, centerHab.cy - centerHab.h / 2 - domeR * 0.3, 0, centerHab.cx, centerHab.cy - centerHab.h / 2, domeR);
        dGrad.addColorStop(0, `rgba(100,160,240,${(0.03 + Math.sin(t * 0.014) * 0.015).toFixed(3)})`);
        dGrad.addColorStop(1, "rgba(80,120,200,0.01)");
        ctx.fillStyle = dGrad;
        ctx.fill();
        ctx.strokeStyle = "rgba(160,180,220,0.08)";
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }

      // ===== SHIPS IN FLIGHT =====
      let hovLabel: string | null = null;
      const parts = particlesRef.current;

      for (const ship of shipsRef.current) {
        if (!ship.landed) {
          ship.progress += ship.speed;
          if (ship.progress >= 1) ship.progress = 0;
        }
        if (ship.landed) continue;

        const p = ship.progress;
        const sx = (1 - p) * (1 - p) * pathStartX + 2 * (1 - p) * p * pathCtrlX + p * p * pathEndX;
        const sy = (1 - p) * (1 - p) * (pathStartY + ship.yOffset) + 2 * (1 - p) * p * (pathCtrlY + ship.yOffset) + p * p * (pathEndY + ship.yOffset * 0.3);

        const prevP = Math.max(0, p - 0.025);
        const prevX = (1 - prevP) * (1 - prevP) * pathStartX + 2 * (1 - prevP) * prevP * pathCtrlX + prevP * prevP * pathEndX;
        const prevY = (1 - prevP) * (1 - prevP) * (pathStartY + ship.yOffset) + 2 * (1 - prevP) * prevP * (pathCtrlY + ship.yOffset) + prevP * prevP * (pathEndY + ship.yOffset * 0.3);

        const angle = Math.atan2(sy - prevY, sx - prevX);

        // Trail history
        ship.trail.push({ x: sx, y: sy, a: 0.45 });
        if (ship.trail.length > 25) ship.trail.shift();
        for (const tp of ship.trail) {
          tp.a *= 0.93;
          if (tp.a < 0.015) continue;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, 0.6, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${ship.trailHue},65%,65%,${tp.a.toFixed(2)})`;
          ctx.fill();
        }

        // Engine exhaust flames (two streams)
        for (let ei = 0; ei < 2; ei++) {
          const eSpread = (ei - 0.5) * 0.25;
          const eAngle = angle + Math.PI + eSpread;
          const eLen = 10 + Math.sin(t * 0.15 + ei) * 3;
          const ex = sx + Math.cos(eAngle) * 4;
          const ey = sy + Math.sin(eAngle) * 4;
          const eex = ex + Math.cos(eAngle) * eLen;
          const eey = ey + Math.sin(eAngle) * eLen;

          const eGrad = ctx.createLinearGradient(ex, ey, eex, eey);
          eGrad.addColorStop(0, `hsla(${ship.trailHue},80%,75%,0.5)`);
          eGrad.addColorStop(0.4, `hsla(${ship.trailHue + 20},70%,60%,0.2)`);
          eGrad.addColorStop(1, "transparent");
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(eex, eey);
          ctx.strokeStyle = eGrad;
          ctx.lineWidth = 1.8 - ei * 0.4;
          ctx.stroke();
        }

        // Exhaust particles
        if (t % 3 === 0) {
          parts.push({
            x: sx - Math.cos(angle) * 5,
            y: sy - Math.sin(angle) * 5,
            vx: -Math.cos(angle) * 0.3 + (Math.random() - 0.5) * 0.2,
            vy: -Math.sin(angle) * 0.3 + (Math.random() - 0.5) * 0.2,
            life: 30 + Math.random() * 20,
            maxLife: 50,
            size: 0.5 + Math.random() * 0.8,
            hue: ship.trailHue,
          });
        }

        // Ship fuselage
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(angle);

        // Main hull
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(2, -3);
        ctx.lineTo(-5, -2.5);
        ctx.lineTo(-6, -1);
        ctx.lineTo(-6, 1);
        ctx.lineTo(-5, 2.5);
        ctx.lineTo(2, 3);
        ctx.closePath();
        ctx.fillStyle = `hsla(${ship.trailHue},30%,82%,0.85)`;
        ctx.fill();
        ctx.strokeStyle = `hsla(${ship.trailHue},40%,70%,0.3)`;
        ctx.lineWidth = 0.4;
        ctx.stroke();

        // Cockpit window
        ctx.beginPath();
        ctx.moveTo(7, 0);
        ctx.lineTo(4, -1.5);
        ctx.lineTo(4, 1.5);
        ctx.closePath();
        ctx.fillStyle = `hsla(${ship.trailHue},60%,65%,0.5)`;
        ctx.fill();

        // Wing struts
        ctx.beginPath();
        ctx.moveTo(-2, -2.5);
        ctx.lineTo(-4, -5);
        ctx.lineTo(-5, -4.5);
        ctx.lineTo(-3, -2);
        ctx.closePath();
        ctx.fillStyle = `hsla(${ship.trailHue},25%,75%,0.6)`;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-2, 2.5);
        ctx.lineTo(-4, 5);
        ctx.lineTo(-5, 4.5);
        ctx.lineTo(-3, 2);
        ctx.closePath();
        ctx.fillStyle = `hsla(${ship.trailHue},25%,75%,0.6)`;
        ctx.fill();

        // Postman orange accent stripe
        ctx.fillStyle = "rgba(255,108,55,0.35)";
        ctx.fillRect(-3, -0.6, 6, 1.2);

        ctx.restore();

        // Ship glow
        const sGlow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 14);
        sGlow.addColorStop(0, `hsla(${ship.trailHue},75%,68%,0.12)`);
        sGlow.addColorStop(1, "transparent");
        ctx.fillStyle = sGlow;
        ctx.beginPath();
        ctx.arc(sx, sy, 14, 0, Math.PI * 2);
        ctx.fill();

        // Hover
        const dist = Math.hypot(mouseRef.current.x - sx, mouseRef.current.y - sy);
        if (dist < 18) hovLabel = ship.label;
      }

      // ===== PARTICLES =====
      for (let pi = parts.length - 1; pi >= 0; pi--) {
        const p = parts[pi];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.size *= 1.01;
        p.life--;
        if (p.life <= 0) { parts.splice(pi, 1); continue; }
        const alpha = (p.life / p.maxLife) * 0.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},50%,65%,${alpha.toFixed(3)})`;
        ctx.fill();
      }

      // ===== HUD =====
      ctx.save();
      ctx.font = "bold 9px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";

      if (meetings.length > 0 || sessions.length > 0) {
        ctx.fillStyle = "rgba(75,145,230,0.5)";
        ctx.fillRect(14, h - 34, 8, 8);
        ctx.fillStyle = "rgba(200,210,225,0.4)";
        ctx.fillText(`Meetings: ${meetings.length}`, 26, h - 26);

        ctx.fillStyle = "rgba(155,105,220,0.5)";
        ctx.fillRect(14, h - 20, 8, 8);
        ctx.fillStyle = "rgba(200,210,225,0.4)";
        ctx.fillText(`Sessions: ${sessions.length}`, 26, h - 12);
      }

      if (deploymentSteps.length > 0) {
        const execCount = executedDeploySteps.length;
        const hudX = meetings.length > 0 ? 130 : 14;
        ctx.fillStyle = "rgba(50,185,110,0.5)";
        ctx.fillRect(hudX, h - 20, 8, 8);
        ctx.fillStyle = "rgba(200,210,225,0.4)";
        ctx.fillText(`Deploy: ${execCount}/${deploymentSteps.length}`, hudX + 12, h - 12);
      }

      const xpEarned = (meetings.length + sessions.length) * 50 + executedDeploySteps.length * 25;
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(200,210,225,0.25)";
      ctx.fillText(`${xpEarned} XP earned`, w - 14, h - 12);
      ctx.restore();

      if (hovLabel !== hoveredShip) setHoveredShip(hovLabel);
      animRef.current = requestAnimationFrame(frame);
    };

    animRef.current = requestAnimationFrame(frame);
    const handleVis = () => { if (document.hidden) cancelAnimationFrame(animRef.current); else animRef.current = requestAnimationFrame(frame); };
    document.addEventListener("visibilitychange", handleVis);
    return () => { cancelAnimationFrame(animRef.current); document.removeEventListener("visibilitychange", handleVis); };
  }, [dimensions, meetings, sessions, deploymentSteps, executedDeploySteps, launchQueue, totalMissions, userLevel, projectName, hoveredShip]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  return (
    <div className="relative w-full rounded-xl overflow-hidden" style={{ border: "1px solid rgba(100,150,255,0.08)" }}>
      <canvas ref={canvasRef} className="w-full cursor-crosshair" style={{ height: 460 }} onMouseMove={handleMouseMove} onMouseLeave={() => { mouseRef.current = { x: -999, y: -999 }; setHoveredShip(null); }} />
      {hoveredShip && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none rounded-lg px-3 py-1.5 z-10" style={{ background: "rgba(6,10,20,0.92)", border: "1px solid rgba(100,150,255,0.2)", backdropFilter: "blur(12px)" }}>
          <p className="text-[11px] font-medium" style={{ color: "rgba(200,210,255,0.8)" }}>{hoveredShip}</p>
        </div>
      )}
      {totalMissions === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center max-w-xs">
            <p className="text-sm font-medium" style={{ color: "rgba(200,210,255,0.6)" }}>No missions launched yet</p>
            <p className="text-xs mt-1" style={{ color: "rgba(200,210,255,0.3)" }}>
              {deploymentSteps.length > 0 ? "Execute a deployment step to launch your first ship" : "Ingest a meeting or working session transcript to send your first ship"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function drawCapsule(ctx: CanvasRenderingContext2D, cx: number, cy: number, halfW: number, halfH: number, capR: number) {
  ctx.beginPath();
  ctx.moveTo(cx - halfW, cy - halfH + capR);
  ctx.arcTo(cx - halfW, cy - halfH, cx - halfW + capR, cy - halfH, capR);
  ctx.lineTo(cx + halfW - capR, cy - halfH);
  ctx.arcTo(cx + halfW, cy - halfH, cx + halfW, cy - halfH + capR, capR);
  ctx.lineTo(cx + halfW, cy + halfH - capR);
  ctx.arcTo(cx + halfW, cy + halfH, cx + halfW - capR, cy + halfH, capR);
  ctx.lineTo(cx - halfW + capR, cy + halfH);
  ctx.arcTo(cx - halfW, cy + halfH, cx - halfW, cy + halfH - capR, capR);
  ctx.closePath();
}
