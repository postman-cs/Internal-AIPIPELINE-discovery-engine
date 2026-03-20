"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { noise } from "@/lib/gamification/planet-draw";

export interface SectionStatus {
  key: string;
  label: string;
  shortLabel: string;
  color: string;
  complete: boolean;
}

export interface GateStatus {
  label: string;
  passed: boolean;
}

interface BuildLogCanvasProps {
  sections: SectionStatus[];
  gates: GateStatus[];
  progressPct: number;
  allGatesPassed: boolean;
  projectName: string;
}

interface Star {
  x: number;
  y: number;
  size: number;
  twinkle: number;
  hue: number;
}

interface GateParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  hue: number;
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export default function BuildLogCanvas({
  sections,
  gates,
  progressPct,
  allGatesPassed,
  projectName,
}: BuildLogCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const timeRef = useRef(0);
  const starsRef = useRef<Star[]>([]);
  const gateParticlesRef = useRef<GateParticle[]>([]);
  const [dimensions, setDimensions] = useState({ w: 900, h: 420 });
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const mouseRef = useRef({ x: -999, y: -999 });

  // Stars
  useEffect(() => {
    const { w, h } = dimensions;
    const stars: Star[] = [];
    for (let i = 0; i < 140; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: 0.2 + Math.pow(Math.random(), 3) * 1.8,
        twinkle: Math.random() * Math.PI * 2,
        hue: 195 + Math.random() * 40,
      });
    }
    starsRef.current = stars;
  }, [dimensions]);

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
      const ch = 420;
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

    const completedCount = sections.filter((s) => s.complete).length;

    const frame = () => {
      const dpr = window.devicePixelRatio || 1;
      const { w, h } = dimensions;
      timeRef.current++;
      const t = timeRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // ===== BACKGROUND =====
      const bg = ctx.createRadialGradient(w * 0.5, h * 0.55, 0, w * 0.5, h * 0.55, w * 0.65);
      bg.addColorStop(0, "#080c1a");
      bg.addColorStop(0.6, "#050912");
      bg.addColorStop(1, "#020408");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      for (const star of starsRef.current) {
        const alpha = 0.15 + Math.sin(t * 0.01 + star.twinkle) * 0.1;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${star.hue},25%,80%,${alpha})`;
        ctx.fill();
      }

      // ===== MOON BASE SILHOUETTE (bottom) =====
      const baseY = h * 0.82;
      // Lunar horizon
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, baseY);
      ctx.quadraticCurveTo(w * 0.5, baseY - 12, w, baseY);
      ctx.lineTo(w, h);
      ctx.closePath();
      const surfGrad = ctx.createLinearGradient(0, baseY - 12, 0, h);
      surfGrad.addColorStop(0, "#606068");
      surfGrad.addColorStop(0.3, "#404048");
      surfGrad.addColorStop(1, "#252530");
      ctx.fillStyle = surfGrad;
      ctx.fill();

      // Base structures silhouette
      const baseCx = w * 0.5;
      // Hab modules
      for (let i = 0; i < 5; i++) {
        const bx = baseCx + (i - 2) * 22;
        const by = baseY - 4 - noise(i, 900) * 6;
        const bw = 12 + noise(i, 901) * 6;
        const bh = 5 + noise(i, 902) * 3;
        ctx.fillStyle = `rgba(80,80,90,${0.4 + noise(i, 903) * 0.2})`;
        ctx.fillRect(bx - bw / 2, by - bh, bw, bh);
        // Window glow
        const wFlicker = Math.sin(t * 0.03 + i * 1.7) > -0.2 ? 0.4 : 0.1;
        ctx.fillStyle = `rgba(255,180,100,${wFlicker})`;
        ctx.fillRect(bx - 1, by - bh + 1.5, 2, 1.5);
      }
      // Antenna
      ctx.beginPath();
      ctx.moveTo(baseCx, baseY - 10);
      ctx.lineTo(baseCx, baseY - 24);
      ctx.strokeStyle = "rgba(160,160,175,0.2)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      const antBlink = Math.sin(t * 0.06) > 0.3;
      if (antBlink) {
        ctx.beginPath();
        ctx.arc(baseCx, baseY - 24, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,60,60,0.7)";
        ctx.fill();
      }

      // ===== HOLOGRAM PROJECTION =====
      const holoCx = w * 0.5;
      const holoCy = h * 0.38;
      const holoRx = Math.min(w * 0.32, 280);
      const holoRy = holoRx * 0.35;

      // Projection beam from base to hologram
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(baseCx - 15, baseY - 20);
      ctx.lineTo(holoCx - holoRx * 0.6, holoCy + holoRy + 20);
      ctx.lineTo(holoCx + holoRx * 0.6, holoCy + holoRy + 20);
      ctx.lineTo(baseCx + 15, baseY - 20);
      ctx.closePath();
      const beamGrad = ctx.createLinearGradient(0, baseY - 20, 0, holoCy + holoRy + 20);
      const beamHue = allGatesPassed ? "80,255,160" : "100,180,255";
      beamGrad.addColorStop(0, `rgba(${beamHue},0.06)`);
      beamGrad.addColorStop(0.5, `rgba(${beamHue},0.02)`);
      beamGrad.addColorStop(1, `rgba(${beamHue},0.005)`);
      ctx.fillStyle = beamGrad;
      ctx.fill();
      ctx.restore();

      // Hologram base ellipse (table)
      ctx.beginPath();
      ctx.ellipse(holoCx, holoCy + holoRy + 15, holoRx * 0.65, 6, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${beamHue},0.12)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Scan line sweeping across hologram
      const scanY = holoCy - holoRy + ((t * 0.5) % (holoRy * 2 + 30));
      if (scanY >= holoCy - holoRy && scanY <= holoCy + holoRy) {
        ctx.beginPath();
        const scanW = holoRx * 1.3 * (1 - Math.abs(scanY - holoCy) / (holoRy * 1.2));
        ctx.moveTo(holoCx - scanW, scanY);
        ctx.lineTo(holoCx + scanW, scanY);
        ctx.strokeStyle = `rgba(${beamHue},0.06)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // ===== PROGRESS RING =====
      const ringR = holoRx * 0.85;
      const ringStartAngle = -Math.PI / 2;
      const ringFullAngle = Math.PI * 2;

      // Background ring
      ctx.beginPath();
      ctx.ellipse(holoCx, holoCy, ringR, ringR * 0.38, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(100,100,120,0.06)";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Filled progress arc
      if (progressPct > 0) {
        const endAngle = ringStartAngle + ringFullAngle * (progressPct / 100);
        ctx.beginPath();
        ctx.ellipse(holoCx, holoCy, ringR, ringR * 0.38, 0, ringStartAngle, endAngle);
        const progColor = allGatesPassed ? "rgba(16,185,129,0.4)" : `rgba(245,158,11,${0.25 + Math.sin(t * 0.02) * 0.05})`;
        ctx.strokeStyle = progColor;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Progress tip glow
        const tipX = holoCx + Math.cos(endAngle) * ringR;
        const tipY = holoCy + Math.sin(endAngle) * ringR * 0.38;
        const tipGlow = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 8);
        tipGlow.addColorStop(0, allGatesPassed ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.2)");
        tipGlow.addColorStop(1, "transparent");
        ctx.fillStyle = tipGlow;
        ctx.beginPath();
        ctx.arc(tipX, tipY, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Progress label
      ctx.font = "bold 16px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = allGatesPassed ? "rgba(52,211,153,0.7)" : "rgba(251,191,36,0.6)";
      ctx.fillText(`${progressPct}%`, holoCx, holoCy + 5);
      ctx.font = "8px Inter, system-ui, sans-serif";
      ctx.fillStyle = "rgba(200,210,225,0.3)";
      ctx.fillText("MISSION DEBRIEF", holoCx, holoCy + 18);

      // ===== SECTION PANELS orbiting the hologram =====
      let hovLabel: string | null = null;
      const panelCount = sections.length;

      for (let si = 0; si < panelCount; si++) {
        const sec = sections[si];
        const baseAngle = (si / panelCount) * Math.PI * 2 - Math.PI / 2;
        const orbitAngle = baseAngle + t * 0.001;

        const panelOrbitRx = holoRx * 1.1;
        const panelOrbitRy = holoRx * 0.42;
        const px = holoCx + Math.cos(orbitAngle) * panelOrbitRx;
        const py = holoCy + Math.sin(orbitAngle) * panelOrbitRy;

        // Depth (panels behind the hologram are dimmer)
        const depth = Math.sin(orbitAngle);
        const depthAlpha = 0.4 + depth * 0.3;
        const panelScale = 0.7 + depth * 0.15;

        // Only draw panels that are "in front" or partially visible
        if (depthAlpha < 0.15) continue;

        const panelW = 36 * panelScale;
        const panelH = 22 * panelScale;

        // Parse the hex color to get RGB
        const hexColor = sec.color;
        const cr = parseInt(hexColor.slice(1, 3), 16) || 100;
        const cg = parseInt(hexColor.slice(3, 5), 16) || 150;
        const cb = parseInt(hexColor.slice(5, 7), 16) || 200;

        // Panel background
        const panelAlpha = sec.complete ? 0.2 * depthAlpha : 0.06 * depthAlpha;
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${panelAlpha.toFixed(3)})`;
        ctx.fillRect(px - panelW / 2, py - panelH / 2, panelW, panelH);

        // Panel border
        const borderAlpha = sec.complete ? 0.35 * depthAlpha : 0.1 * depthAlpha;
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${borderAlpha.toFixed(3)})`;
        ctx.lineWidth = sec.complete ? 1 : 0.5;
        ctx.strokeRect(px - panelW / 2, py - panelH / 2, panelW, panelH);

        // Data lines inside panel (filled panels have content)
        if (sec.complete) {
          const lineCount = 3 + Math.floor(noise(si, 950) * 3);
          for (let li = 0; li < lineCount; li++) {
            const ly = py - panelH / 2 + 4 + li * 3;
            const baseW = (panelW - 6) * (0.4 + noise(si * 10 + li, 951) * 0.5);
            const lw = baseW * (0.6 + 0.4 * Math.abs(Math.sin((t * 0.3 + si * 20 + li * 7) / (panelW * 2) * Math.PI)));
            const lineAlpha = 0.15 * depthAlpha + Math.sin(t * 0.02 + li + si) * 0.03;
            ctx.fillStyle = `rgba(${cr},${cg},${cb},${lineAlpha.toFixed(3)})`;
            ctx.fillRect(px - panelW / 2 + 3, ly, Math.min(lw, panelW - 6), 1.5);
          }
          // Checkmark
          const ckSize = 3 * panelScale;
          ctx.beginPath();
          ctx.moveTo(px + panelW / 2 - ckSize * 2.5, py - panelH / 2 + ckSize * 1.5);
          ctx.lineTo(px + panelW / 2 - ckSize * 1.5, py - panelH / 2 + ckSize * 2.5);
          ctx.lineTo(px + panelW / 2 - ckSize * 0.5, py - panelH / 2 + ckSize * 0.5);
          ctx.strokeStyle = `rgba(52,211,153,${(0.6 * depthAlpha).toFixed(2)})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        } else {
          // Empty panel — wireframe grid
          for (let li = 0; li < 3; li++) {
            const ly = py - panelH / 2 + 5 + li * 4;
            ctx.beginPath();
            ctx.setLineDash([2, 3]);
            ctx.moveTo(px - panelW / 2 + 3, ly);
            ctx.lineTo(px + panelW / 2 - 3, ly);
            ctx.strokeStyle = `rgba(${cr},${cg},${cb},${(0.06 * depthAlpha).toFixed(3)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
            ctx.setLineDash([]);
          }
          // Amber warning dot
          const warnPulse = Math.sin(t * 0.04 + si) > 0.3 ? 0.5 : 0.2;
          ctx.beginPath();
          ctx.arc(px + panelW / 2 - 4, py - panelH / 2 + 4, 1.5 * panelScale, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(245,158,11,${(warnPulse * depthAlpha).toFixed(2)})`;
          ctx.fill();
        }

        // Section label
        ctx.font = `bold ${Math.round(7 * panelScale)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${(0.5 * depthAlpha).toFixed(2)})`;
        ctx.fillText(sec.shortLabel, px, py + panelH / 2 + 8 * panelScale);

        // Hover detection
        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;
        if (mx >= px - panelW / 2 - 4 && mx <= px + panelW / 2 + 4 && my >= py - panelH / 2 - 4 && my <= py + panelH / 2 + 8) {
          hovLabel = `${sec.label} — ${sec.complete ? "Complete" : "Needs content"}`;
          ctx.strokeStyle = `rgba(255,220,140,${(0.4 * depthAlpha).toFixed(2)})`;
          ctx.lineWidth = 1.2;
          ctx.strokeRect(px - panelW / 2 - 1, py - panelH / 2 - 1, panelW + 2, panelH + 2);
        }

        // Connection line from panel to ring
        ctx.beginPath();
        const ringPx = holoCx + Math.cos(orbitAngle) * ringR;
        const ringPy = holoCy + Math.sin(orbitAngle) * ringR * 0.38;
        ctx.moveTo(px, py);
        ctx.lineTo(ringPx, ringPy);
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${(0.04 * depthAlpha).toFixed(3)})`;
        ctx.lineWidth = 0.4;
        ctx.stroke();
      }

      // ===== DELIVERY GATE DOCKING CLAMPS =====
      const gateCount = gates.length;
      const gateArcStart = Math.PI * 0.15;
      const gateArcEnd = Math.PI * 0.85;
      const gateRadius = holoRx * 0.55;

      for (let gi = 0; gi < gateCount; gi++) {
        const gate = gates[gi];
        const ga = lerp(gateArcStart, gateArcEnd, gi / Math.max(gateCount - 1, 1));
        const gx = holoCx + Math.cos(ga) * gateRadius;
        const gy = holoCy + holoRy + 25 + Math.sin(ga) * 12;

        // Clamp structure
        const clampW = 8;
        const clampH = 5;
        ctx.fillStyle = gate.passed ? "rgba(16,185,129,0.25)" : "rgba(100,100,115,0.12)";
        ctx.fillRect(gx - clampW / 2, gy - clampH / 2, clampW, clampH);
        ctx.strokeStyle = gate.passed ? "rgba(52,211,153,0.4)" : "rgba(140,140,155,0.1)";
        ctx.lineWidth = 0.6;
        ctx.strokeRect(gx - clampW / 2, gy - clampH / 2, clampW, clampH);

        // Lock indicator
        if (gate.passed) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(52,211,153,0.7)";
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(140,140,155,0.2)";
          ctx.fill();
        }
      }

      // Gate label
      const passedGates = gates.filter((g) => g.passed).length;
      ctx.font = "7px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = allGatesPassed ? "rgba(52,211,153,0.4)" : "rgba(200,200,215,0.2)";
      ctx.fillText(`${passedGates}/${gateCount} GATES`, holoCx, holoCy + holoRy + 45);

      // ===== ALL GATES PASSED — light wave =====
      if (allGatesPassed) {
        const waveCycle = (t * 0.008) % 1;
        const waveR = ringR * 0.3 + waveCycle * ringR * 1.2;
        const waveAlpha = 0.06 * (1 - waveCycle);
        ctx.beginPath();
        ctx.ellipse(holoCx, holoCy, waveR, waveR * 0.38, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(52,211,153,${waveAlpha.toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // ===== GATE PARTICLES =====
      const gParts = gateParticlesRef.current;
      for (let pi = gParts.length - 1; pi >= 0; pi--) {
        const p = gParts[pi];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life--;
        if (p.life <= 0) { gParts.splice(pi, 1); continue; }
        const alpha = (p.life / p.maxLife) * 0.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},70%,65%,${alpha.toFixed(2)})`;
        ctx.fill();
      }

      // ===== HUD =====
      ctx.save();
      ctx.font = "bold 9px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(200,210,225,0.35)";
      ctx.fillText(projectName, 14, h - 12);

      ctx.textAlign = "right";
      ctx.fillStyle = allGatesPassed ? "rgba(52,211,153,0.45)" : "rgba(200,210,225,0.25)";
      ctx.fillText(allGatesPassed ? "READY FOR HANDOFF" : `${completedCount}/${panelCount} SECTIONS`, w - 14, h - 12);
      ctx.restore();

      if (hovLabel !== hoveredSection) setHoveredSection(hovLabel);
      animRef.current = requestAnimationFrame(frame);
    };

    animRef.current = requestAnimationFrame(frame);
    const handleVis = () => { if (document.hidden) cancelAnimationFrame(animRef.current); else animRef.current = requestAnimationFrame(frame); };
    document.addEventListener("visibilitychange", handleVis);
    return () => { cancelAnimationFrame(animRef.current); document.removeEventListener("visibilitychange", handleVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions, sections, gates, progressPct, allGatesPassed, projectName]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  return (
    <div className="relative w-full rounded-xl overflow-hidden" style={{ border: `1px solid ${allGatesPassed ? "rgba(16,185,129,0.1)" : "rgba(100,150,255,0.06)"}` }}>
      <canvas ref={canvasRef} className="w-full cursor-crosshair" style={{ height: 420 }} onMouseMove={handleMouseMove} onMouseLeave={() => { mouseRef.current = { x: -999, y: -999 }; setHoveredSection(null); }} />
      {hoveredSection && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none rounded-lg px-3 py-1.5 z-10" style={{ background: "rgba(6,10,20,0.92)", border: "1px solid rgba(100,180,255,0.2)", backdropFilter: "blur(12px)" }}>
          <p className="text-[11px] font-medium" style={{ color: "rgba(200,220,255,0.85)" }}>{hoveredSection}</p>
        </div>
      )}
    </div>
  );
}
