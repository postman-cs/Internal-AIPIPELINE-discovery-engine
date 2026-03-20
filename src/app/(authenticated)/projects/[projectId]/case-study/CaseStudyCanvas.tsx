"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { noise } from "@/lib/gamification/planet-draw";
import { drawEvolutionPlanet } from "@/lib/gamification/planet-draw";

interface CaseStudyCanvasProps {
  projectName: string;
  engagementStage: number;
  userLevel: number;
  missionCount: number;
  metrics: {
    aiRuns: number;
    blockersResolved: number;
    assumptionsVerified: number;
    sectionsWritten: number;
  };
  caseStudyGenerated: boolean;
}

interface EvangelistShip {
  angle: number;
  distance: number;
  speed: number;
  maxDist: number;
  hue: number;
  size: number;
  label: string;
  trail: { x: number; y: number; alpha: number }[];
}

interface Star {
  x: number;
  y: number;
  size: number;
  twinkle: number;
  hue: number;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export default function CaseStudyCanvas({
  projectName,
  engagementStage,
  userLevel,
  missionCount,
  metrics,
  caseStudyGenerated,
}: CaseStudyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const timeRef = useRef(0);
  const starsRef = useRef<Star[]>([]);
  const shipsRef = useRef<EvangelistShip[]>([]);
  const [dimensions, setDimensions] = useState({ w: 900, h: 520 });
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const mouseRef = useRef({ x: -999, y: -999 });

  const baseOrbitProgress = useMemo(() => Math.min(engagementStage / 6, 1), [engagementStage]);
  const targetOrbitProgress = caseStudyGenerated ? Math.min(baseOrbitProgress + 0.35, 1) : baseOrbitProgress;
  const currentOrbitRef = useRef(baseOrbitProgress);

  // Build ships from metrics
  const shipSources = useMemo(() => {
    const sources: { label: string; hue: number }[] = [];
    if (metrics.aiRuns > 0) sources.push({ label: `${metrics.aiRuns} AI Runs`, hue: 200 });
    if (metrics.blockersResolved > 0) sources.push({ label: `${metrics.blockersResolved} Blockers Resolved`, hue: 145 });
    if (metrics.assumptionsVerified > 0) sources.push({ label: `${metrics.assumptionsVerified} Assumptions Verified`, hue: 280 });
    if (missionCount > 0) sources.push({ label: `${missionCount} Missions`, hue: 30 });
    if (metrics.sectionsWritten > 0) sources.push({ label: `${metrics.sectionsWritten} Case Study Sections`, hue: 50 });
    if (caseStudyGenerated) sources.push({ label: "Case Study Published", hue: 42 });
    return sources;
  }, [metrics, missionCount, caseStudyGenerated]);

  // Layout
  useEffect(() => {
    const { w, h } = dimensions;

    const stars: Star[] = [];
    for (let i = 0; i < 220; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: 0.2 + Math.pow(Math.random(), 3) * 2,
        twinkle: Math.random() * Math.PI * 2,
        hue: 190 + Math.random() * 50,
      });
    }
    starsRef.current = stars;

    // Build evangelist ships
    const ships: EvangelistShip[] = [];
    shipSources.forEach((src, i) => {
      const baseAngle = (i / Math.max(shipSources.length, 1)) * Math.PI * 2 - Math.PI / 2;
      ships.push({
        angle: baseAngle + (noise(i, 700) - 0.5) * 0.4,
        distance: 20 + noise(i, 701) * 30,
        speed: 0.15 + noise(i, 702) * 0.1,
        maxDist: 80 + noise(i, 703) * 60,
        hue: src.hue,
        size: 3 + noise(i, 704) * 2,
        label: src.label,
        trail: [],
      });
    });
    // Always have some cosmetic ships flying even with no data
    if (ships.length < 3) {
      for (let i = ships.length; i < 3; i++) {
        ships.push({
          angle: (i / 3) * Math.PI * 2 + noise(i, 710),
          distance: noise(i, 711) * 40,
          speed: 0.08 + noise(i, 712) * 0.06,
          maxDist: 60 + noise(i, 713) * 40,
          hue: 30,
          size: 2,
          label: "",
          trail: [],
        });
      }
    }
    shipsRef.current = ships;
  }, [dimensions, shipSources]);

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
      const ch = 520;
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

      // Smoothly animate orbit progress toward target
      const diff = targetOrbitProgress - currentOrbitRef.current;
      if (Math.abs(diff) > 0.0005) {
        currentOrbitRef.current += diff * 0.008;
      } else {
        currentOrbitRef.current = targetOrbitProgress;
      }
      const orbitProgress = currentOrbitRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // ===== DEEP SPACE BACKGROUND =====
      const sky = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.7);
      sky.addColorStop(0, "#080c18");
      sky.addColorStop(0.6, "#040812");
      sky.addColorStop(1, "#020408");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Stars
      for (const star of starsRef.current) {
        const alpha = 0.18 + Math.sin(t * 0.01 + star.twinkle) * 0.12;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${star.hue},25%,82%,${alpha})`;
        ctx.fill();
        if (star.size > 1.5) {
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${star.hue},25%,82%,${alpha * 0.05})`;
          ctx.fill();
        }
      }

      // ===== ADMIRAL STAR (destination) =====
      const starX = w * 0.88;
      const starY = h * 0.22;
      const starPulse = 0.8 + Math.sin(t * 0.012) * 0.2;

      // Outer corona
      const corona = ctx.createRadialGradient(starX, starY, 0, starX, starY, 70);
      corona.addColorStop(0, `rgba(255,215,80,${(0.06 * starPulse).toFixed(3)})`);
      corona.addColorStop(0.3, `rgba(255,180,50,${(0.03 * starPulse).toFixed(3)})`);
      corona.addColorStop(1, "transparent");
      ctx.fillStyle = corona;
      ctx.fillRect(starX - 80, starY - 80, 160, 160);

      // Star rays
      ctx.save();
      ctx.translate(starX, starY);
      for (let r = 0; r < 6; r++) {
        const rayAngle = (r / 6) * Math.PI * 2 + t * 0.002;
        const rayLen = 18 + Math.sin(t * 0.03 + r * 1.5) * 6;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const rx = Math.cos(rayAngle) * rayLen;
        const ry = Math.sin(rayAngle) * rayLen;
        ctx.lineTo(rx, ry);
        ctx.strokeStyle = `rgba(255,220,100,${(0.12 * starPulse).toFixed(2)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();

      // Star body
      const starGrad = ctx.createRadialGradient(starX, starY, 0, starX, starY, 12);
      starGrad.addColorStop(0, "#fffbe8");
      starGrad.addColorStop(0.3, "#ffd84a");
      starGrad.addColorStop(0.6, "#e8a820");
      starGrad.addColorStop(1, "rgba(200,140,20,0)");
      ctx.beginPath();
      ctx.arc(starX, starY, 12, 0, Math.PI * 2);
      ctx.fillStyle = starGrad;
      ctx.fill();

      // Star label
      ctx.font = "bold 9px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,220,120,0.5)";
      ctx.fillText("ADMIN", starX, starY + 20);

      // ===== CSE PLANET (origin) =====
      const planetX = w * 0.1;
      const planetY = h * 0.72;
      const planetR = Math.min(w, h) * 0.07;

      // Planet glow
      const pGlow = ctx.createRadialGradient(planetX, planetY, planetR, planetX, planetY, planetR * 2.5);
      pGlow.addColorStop(0, "rgba(6,214,214,0.05)");
      pGlow.addColorStop(1, "transparent");
      ctx.fillStyle = pGlow;
      ctx.fillRect(planetX - planetR * 3, planetY - planetR * 3, planetR * 6, planetR * 6);

      drawEvolutionPlanet(ctx, userLevel, planetX, planetY, planetR, t * 0.016);

      ctx.font = "8px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(6,214,214,0.4)";
      ctx.fillText("CSE", planetX, planetY + planetR + 12);

      // ===== ORBITAL PATH =====
      // Elliptical arc from planet region to admiral star region
      const orbitCx = w * 0.5;
      const orbitCy = h * 0.55;
      const orbitRx = w * 0.38;
      const orbitRy = h * 0.32;
      const orbitStartAngle = Math.PI * 0.7;
      const orbitEndAngle = -Math.PI * 0.25;

      // Draw the orbital path (dashed)
      ctx.save();
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      const pathSteps = 80;
      for (let i = 0; i <= pathSteps; i++) {
        const p = i / pathSteps;
        const angle = lerp(orbitStartAngle, orbitEndAngle, p);
        const px = orbitCx + Math.cos(angle) * orbitRx;
        const py = orbitCy + Math.sin(angle) * orbitRy;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "rgba(255,200,80,0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Traveled portion (solid, glowing)
      if (orbitProgress > 0) {
        ctx.beginPath();
        const travelSteps = Math.floor(pathSteps * orbitProgress);
        for (let i = 0; i <= travelSteps; i++) {
          const p = i / pathSteps;
          const angle = lerp(orbitStartAngle, orbitEndAngle, p);
          const px = orbitCx + Math.cos(angle) * orbitRx;
          const py = orbitCy + Math.sin(angle) * orbitRy;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = "rgba(255,180,50,0.15)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Stage markers along the path
      for (let s = 0; s <= 6; s++) {
        const p = s / 6;
        const angle = lerp(orbitStartAngle, orbitEndAngle, p);
        const mx = orbitCx + Math.cos(angle) * orbitRx;
        const my = orbitCy + Math.sin(angle) * orbitRy;
        const isPast = s <= engagementStage;
        const isCurrent = s === engagementStage;

        ctx.beginPath();
        ctx.arc(mx, my, isCurrent ? 4 : 2.5, 0, Math.PI * 2);
        ctx.fillStyle = isPast
          ? `rgba(255,200,80,${isCurrent ? 0.8 : 0.35})`
          : "rgba(255,200,80,0.1)";
        ctx.fill();

        if (isCurrent) {
          const markerGlow = ctx.createRadialGradient(mx, my, 0, mx, my, 12);
          markerGlow.addColorStop(0, "rgba(255,200,80,0.12)");
          markerGlow.addColorStop(1, "transparent");
          ctx.fillStyle = markerGlow;
          ctx.beginPath();
          ctx.arc(mx, my, 12, 0, Math.PI * 2);
          ctx.fill();
        }

        // Stage number
        ctx.font = "7px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = isPast ? "rgba(255,200,80,0.35)" : "rgba(255,200,80,0.12)";
        ctx.fillText(`S${s}`, mx, my + 12);
      }

      // ===== PROJECT MOON =====
      const moonAngle = lerp(orbitStartAngle, orbitEndAngle, orbitProgress);
      const moonX = orbitCx + Math.cos(moonAngle) * orbitRx;
      const moonY = orbitCy + Math.sin(moonAngle) * orbitRy;
      const moonR = 22;

      // Moon glow
      const mGlow = ctx.createRadialGradient(moonX, moonY, moonR, moonX, moonY, moonR * 2.5);
      mGlow.addColorStop(0, "rgba(180,180,195,0.06)");
      mGlow.addColorStop(1, "transparent");
      ctx.fillStyle = mGlow;
      ctx.fillRect(moonX - moonR * 3, moonY - moonR * 3, moonR * 6, moonR * 6);

      // Moon body
      const moonGrad = ctx.createRadialGradient(
        moonX - moonR * 0.25, moonY - moonR * 0.2, moonR * 0.05,
        moonX + moonR * 0.1, moonY + moonR * 0.1, moonR,
      );
      moonGrad.addColorStop(0, "#c8c8d0");
      moonGrad.addColorStop(0.4, "#9898a2");
      moonGrad.addColorStop(0.7, "#686870");
      moonGrad.addColorStop(1, "#404048");
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
      ctx.fillStyle = moonGrad;
      ctx.fill();

      // Craters
      ctx.save();
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
      ctx.clip();
      for (let i = 0; i < 8; i++) {
        const ca = noise(i, 800) * Math.PI * 2;
        const cd = noise(i, 801) * moonR * 0.7;
        const cx = moonX + Math.cos(ca) * cd;
        const cy = moonY + Math.sin(ca) * cd;
        const cr = 1.5 + noise(i, 802) * 4;
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(50,50,58,${0.2 + noise(i, 803) * 0.2})`;
        ctx.fill();
      }
      ctx.restore();

      // Mini base on the moon
      if (missionCount > 0) {
        const baseModules = Math.min(missionCount, 8);
        for (let bi = 0; bi < baseModules; bi++) {
          const ba = (bi / baseModules) * Math.PI * 0.8 + Math.PI * 0.6;
          const bd = moonR * 0.55 + noise(bi, 810) * moonR * 0.15;
          const bx = moonX + Math.cos(ba) * bd;
          const by = moonY + Math.sin(ba) * bd;
          const bw = 4 + noise(bi, 811) * 3;
          const bh = 2.5 + noise(bi, 812) * 1.5;
          const bPulse = Math.sin(t * 0.03 + bi * 1.5) * 0.3 + 0.5;

          ctx.fillStyle = `rgba(255,108,55,${(0.3 + bPulse * 0.2).toFixed(2)})`;
          ctx.fillRect(bx - bw / 2, by - bh / 2, bw, bh);
          // Window
          ctx.fillStyle = `rgba(255,200,100,${(bPulse * 0.5).toFixed(2)})`;
          ctx.fillRect(bx - 0.5, by - 0.5, 1, 1);
        }

        // Tiny antenna
        const antX = moonX - moonR * 0.2;
        const antY = moonY - moonR * 0.75;
        ctx.beginPath();
        ctx.moveTo(antX, moonY - moonR * 0.55);
        ctx.lineTo(antX, antY);
        ctx.strokeStyle = "rgba(200,200,210,0.25)";
        ctx.lineWidth = 0.6;
        ctx.stroke();
        const antBlink = Math.sin(t * 0.07) > 0.3;
        if (antBlink) {
          ctx.beginPath();
          ctx.arc(antX, antY, 1, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,60,60,0.8)";
          ctx.fill();
        }
      }

      // Moon label
      ctx.font = "bold 10px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(200,200,215,0.6)";
      ctx.fillText(projectName, moonX, moonY + moonR + 14);

      // Engine thrust trail behind the moon (shows it's propelling itself)
      if (orbitProgress > 0 && orbitProgress < 1) {
        const behindAngle = moonAngle + Math.PI;
        const thrustLen = 12 + Math.sin(t * 0.08) * 4;
        for (let ti = 0; ti < 3; ti++) {
          const tSpread = (ti - 1) * 0.15;
          const tAngle = behindAngle + tSpread;
          const tx = moonX + Math.cos(tAngle) * (moonR + 2);
          const ty = moonY + Math.sin(tAngle) * (moonR + 2);
          const tex = moonX + Math.cos(tAngle) * (moonR + 2 + thrustLen - ti * 3);
          const tey = moonY + Math.sin(tAngle) * (moonR + 2 + thrustLen - ti * 3);

          const thrustGrad = ctx.createLinearGradient(tx, ty, tex, tey);
          thrustGrad.addColorStop(0, `rgba(255,140,40,${(0.3 - ti * 0.08).toFixed(2)})`);
          thrustGrad.addColorStop(0.5, `rgba(255,80,20,${(0.15 - ti * 0.04).toFixed(2)})`);
          thrustGrad.addColorStop(1, "transparent");
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(tex, tey);
          ctx.strokeStyle = thrustGrad;
          ctx.lineWidth = 2 - ti * 0.5;
          ctx.stroke();
        }

        // Engine glow
        const engX = moonX + Math.cos(behindAngle) * (moonR + 2);
        const engY = moonY + Math.sin(behindAngle) * (moonR + 2);
        const engGlow = ctx.createRadialGradient(engX, engY, 0, engX, engY, 10);
        engGlow.addColorStop(0, `rgba(255,140,40,${(0.12 + Math.sin(t * 0.1) * 0.05).toFixed(2)})`);
        engGlow.addColorStop(1, "transparent");
        ctx.fillStyle = engGlow;
        ctx.beginPath();
        ctx.arc(engX, engY, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      // Arrival corona when at admiral star
      if (orbitProgress >= 1) {
        const arrivalPulse = Math.sin(t * 0.02) * 0.5 + 0.5;
        const arrGlow = ctx.createRadialGradient(moonX, moonY, moonR, moonX, moonY, moonR * 2.5);
        arrGlow.addColorStop(0, `rgba(255,215,80,${(0.06 * arrivalPulse).toFixed(3)})`);
        arrGlow.addColorStop(1, "transparent");
        ctx.fillStyle = arrGlow;
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonR * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // ===== EVANGELIST SHIPS =====
      let hovLabel: string | null = null;
      const ships = shipsRef.current;

      for (const ship of ships) {
        ship.distance += ship.speed;
        if (ship.distance > ship.maxDist) {
          ship.distance = 15;
          ship.angle += 0.3 + Math.random() * 0.5;
          ship.trail = [];
        }

        const sx = moonX + Math.cos(ship.angle) * ship.distance;
        const sy = moonY + Math.sin(ship.angle) * ship.distance;

        // Trail
        ship.trail.push({ x: sx, y: sy, alpha: 0.5 });
        if (ship.trail.length > 20) ship.trail.shift();
        for (let ti = 0; ti < ship.trail.length - 1; ti++) {
          const tp = ship.trail[ti];
          tp.alpha *= 0.92;
          if (tp.alpha < 0.02) continue;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, 0.8, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${ship.hue},70%,65%,${tp.alpha.toFixed(2)})`;
          ctx.fill();
        }

        // Ship body
        const flyAngle = ship.angle;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(flyAngle);
        ctx.beginPath();
        ctx.moveTo(ship.size, 0);
        ctx.lineTo(-ship.size * 0.6, -ship.size * 0.5);
        ctx.lineTo(-ship.size * 0.4, 0);
        ctx.lineTo(-ship.size * 0.6, ship.size * 0.5);
        ctx.closePath();
        ctx.fillStyle = `hsla(${ship.hue},60%,78%,0.8)`;
        ctx.fill();
        ctx.restore();

        // Ship glow
        const shipGlow = ctx.createRadialGradient(sx, sy, 0, sx, sy, ship.size * 3);
        shipGlow.addColorStop(0, `hsla(${ship.hue},70%,65%,0.1)`);
        shipGlow.addColorStop(1, "transparent");
        ctx.fillStyle = shipGlow;
        ctx.beginPath();
        ctx.arc(sx, sy, ship.size * 3, 0, Math.PI * 2);
        ctx.fill();

        // Engine micro-trail
        const engTx = sx - Math.cos(flyAngle) * (ship.size + 2);
        const engTy = sy - Math.sin(flyAngle) * (ship.size + 2);
        const engTrail = ctx.createLinearGradient(sx, sy, engTx, engTy);
        engTrail.addColorStop(0, `hsla(${ship.hue},80%,70%,0.4)`);
        engTrail.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(engTx, engTy);
        ctx.strokeStyle = engTrail;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Hover detection
        if (ship.label) {
          const dist = Math.hypot(mouseRef.current.x - sx, mouseRef.current.y - sy);
          if (dist < 15) hovLabel = ship.label;
        }
      }

      // ===== HUD =====
      ctx.save();
      ctx.font = "bold 9px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";

      ctx.fillStyle = "rgba(255,180,50,0.5)";
      ctx.fillText(`Stage ${engagementStage}/6`, 14, h - 28);
      ctx.fillStyle = "rgba(200,210,225,0.35)";
      ctx.font = "8px Inter, system-ui, sans-serif";

      const stageNames = ["Discovery", "Solution Design", "Internal Proof", "Implementation", "Pilot Validation", "Transition"];
      ctx.fillText(stageNames[engagementStage] ?? "", 14, h - 16);

      ctx.textAlign = "right";
      ctx.font = "bold 9px Inter, system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,108,55,0.4)";
      ctx.fillText(`${shipSources.length} evangelist vectors`, w - 14, h - 28);
      ctx.fillStyle = caseStudyGenerated ? "rgba(34,197,94,0.5)" : "rgba(200,210,225,0.25)";
      ctx.font = "8px Inter, system-ui, sans-serif";
      ctx.fillText(caseStudyGenerated ? "CASE STUDY PUBLISHED" : "CASE STUDY PENDING", w - 14, h - 16);
      ctx.restore();

      if (hovLabel !== hoveredLabel) setHoveredLabel(hovLabel);
      animRef.current = requestAnimationFrame(frame);
    };

    animRef.current = requestAnimationFrame(frame);
    const handleVis = () => {
      if (document.hidden) cancelAnimationFrame(animRef.current);
      else animRef.current = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", handleVis);
    return () => { cancelAnimationFrame(animRef.current); document.removeEventListener("visibilitychange", handleVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions, targetOrbitProgress, engagementStage, projectName, userLevel, missionCount, shipSources, caseStudyGenerated]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  return (
    <div className="relative w-full rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,180,50,0.08)" }}>
      <canvas
        ref={canvasRef}
        className="w-full cursor-crosshair"
        style={{ height: 520 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { mouseRef.current = { x: -999, y: -999 }; setHoveredLabel(null); }}
      />
      {hoveredLabel && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none rounded-lg px-3 py-1.5 z-10"
          style={{ background: "rgba(6,10,20,0.92)", border: "1px solid rgba(255,180,50,0.25)", backdropFilter: "blur(12px)" }}
        >
          <p className="text-[11px] font-medium" style={{ color: "rgba(255,220,160,0.85)" }}>{hoveredLabel}</p>
        </div>
      )}
    </div>
  );
}
