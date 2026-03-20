"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { drawEvolutionPlanet } from "@/lib/gamification/planet-draw";

// ─── Data Interfaces ───────────────────────────────────────────────────────────

export interface FleetProject {
  id: string;
  name: string;
  domain: string;
  engagementStage: number;
  phaseCount: number;
  blockerCount: number;
  assumptionCount: number;
  lastUpdated: number;
}

export interface FleetCSE {
  id: string;
  name: string;
  email: string;
  projectCount: number;
  activeBlockers: number;
  pendingAssumptions: number;
  totalPhases: number;
  ingestCount: number;
  xpLevel: number;
  projects: FleetProject[];
}

interface Props {
  fleet: FleetCSE[];
  admiralName: string;
  stats: { totalProjects: number; totalBlockers: number; totalCSEs: number };
}

// ─── Internal Types ────────────────────────────────────────────────────────────

interface Planet {
  cse: FleetCSE;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  size: number;
  health: number;
  risk: number;
  velocity: number;
  color: string;
  rgb: RGB;
  hullPulse: number;
  moons: Moon[];
  orbitAngle: number;
  rotationSpeed: number;
  tilt: number;
  rings: boolean;
  bandSeed: number;
  xpLevel: number;
}

interface Moon {
  project: FleetProject;
  lx: number;
  ly: number;
  r: number;
  health: number;
  stalled: boolean;
  oAngle: number;
  oDist: number;
  oSpeed: number;
  driftOff: number;
  color: string;
  phase: number;
  completed: boolean;
  starX: number;
  starY: number;
  starOrbitAngle: number;
  starOrbitDist: number;
  starOrbitSpeed: number;
  parentColor: string;
}

interface Pt { x: number; y: number; vx: number; vy: number; r: number; a: number }
type RGB = { r: number; g: number; b: number };

// ─── Constants ─────────────────────────────────────────────────────────────────

const COLORS = ["#06d6d6", "#22c55e", "#a855f7", "#f59e0b", "#3b82f6", "#ec4899", "#14b8a6", "#f97316"];
const GOLD = "#c9a227";
const GOLD_RGB: RGB = { r: 201, g: 162, b: 39 };
const STALE = 7 * 24 * 3600_000;
const STAR_SIZE = 42;

function hex2rgb(hex: string): RGB {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 128, g: 128, b: 128 };
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rad: number) {
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

// ─── Star Evolution Stages ──────────────────────────────────────────────────

interface StarStageConfig {
  name: string;
  minDelivered: number;
  sizeMult: number;
  // Core body gradient (center → limb)
  core: string[];
  // Granulation bright/dark
  granBright: string;
  granDark: string;
  // Corona colors
  coronaInner: string;
  coronaMid: string;
  coronaOuter: string;
  coronaIntensity: number;
  // Chromosphere / prominence tint
  chromoColor: string;
  prominenceColor: string;
  streamerCount: number;
  prominenceCount: number;
  spiculeCount: number;
  spikeIntensity: number;
  // Limb darkening tint
  limbColor: string;
  // Special effects
  hasJets: boolean;
  hasPulse: boolean;
  hasFieldLines: boolean;
  labelColor: string;
}

const STAR_STAGES: StarStageConfig[] = [
  {
    name: "Red Dwarf",
    minDelivered: 0,
    sizeMult: 0.85,
    core: ["rgba(255,200,180,1)", "rgba(240,140,100,1)", "rgba(210,90,50,1)", "rgba(170,55,25,1)", "rgba(130,30,10,1)"],
    granBright: "rgba(255,200,170,1)", granDark: "rgba(120,40,15,1)",
    coronaInner: "rgba(255,150,100,", coronaMid: "rgba(200,80,40,", coronaOuter: "rgba(140,50,20,",
    coronaIntensity: 0.6,
    chromoColor: "rgba(200,50,15,", prominenceColor: "rgba(220,80,30,",
    streamerCount: 6, prominenceCount: 3, spiculeCount: 24, spikeIntensity: 0.02,
    limbColor: "rgba(100,20,5,", hasJets: false, hasPulse: false, hasFieldLines: false,
    labelColor: "#e07050",
  },
  {
    name: "Orange Star",
    minDelivered: 2,
    sizeMult: 0.92,
    core: ["rgba(255,230,200,1)", "rgba(255,190,130,1)", "rgba(240,150,80,1)", "rgba(210,110,45,1)", "rgba(175,75,25,1)"],
    granBright: "rgba(255,230,200,1)", granDark: "rgba(170,90,30,1)",
    coronaInner: "rgba(255,200,140,", coronaMid: "rgba(230,140,70,", coronaOuter: "rgba(180,100,40,",
    coronaIntensity: 0.8,
    chromoColor: "rgba(240,90,30,", prominenceColor: "rgba(245,120,50,",
    streamerCount: 9, prominenceCount: 4, spiculeCount: 32, spikeIntensity: 0.03,
    limbColor: "rgba(130,55,12,", hasJets: false, hasPulse: false, hasFieldLines: false,
    labelColor: "#f0a040",
  },
  {
    name: "Yellow Dwarf",
    minDelivered: 5,
    sizeMult: 1.0,
    core: ["rgba(255,255,255,1)", "rgba(255,248,230,1)", "rgba(255,235,195,1)", "rgba(255,215,150,1)", "rgba(210,140,60,1)"],
    granBright: "rgba(255,255,240,1)", granDark: "rgba(180,110,40,1)",
    coronaInner: "rgba(255,245,220,", coronaMid: "rgba(255,225,170,", coronaOuter: "rgba(255,190,110,",
    coronaIntensity: 1.0,
    chromoColor: "rgba(255,80,30,", prominenceColor: "rgba(255,140,60,",
    streamerCount: 12, prominenceCount: 5, spiculeCount: 40, spikeIntensity: 0.04,
    limbColor: "rgba(140,70,15,", hasJets: false, hasPulse: false, hasFieldLines: false,
    labelColor: "#f5d060",
  },
  {
    name: "White Star",
    minDelivered: 10,
    sizeMult: 1.08,
    core: ["rgba(255,255,255,1)", "rgba(250,252,255,1)", "rgba(235,240,255,1)", "rgba(210,225,255,1)", "rgba(180,200,240,1)"],
    granBright: "rgba(245,250,255,1)", granDark: "rgba(160,175,210,1)",
    coronaInner: "rgba(235,245,255,", coronaMid: "rgba(200,220,255,", coronaOuter: "rgba(160,185,240,",
    coronaIntensity: 1.2,
    chromoColor: "rgba(180,200,255,", prominenceColor: "rgba(200,210,255,",
    streamerCount: 14, prominenceCount: 6, spiculeCount: 48, spikeIntensity: 0.05,
    limbColor: "rgba(80,100,160,", hasJets: false, hasPulse: false, hasFieldLines: false,
    labelColor: "#d0e0ff",
  },
  {
    name: "Blue Star",
    minDelivered: 16,
    sizeMult: 1.16,
    core: ["rgba(255,255,255,1)", "rgba(220,235,255,1)", "rgba(160,200,255,1)", "rgba(100,160,240,1)", "rgba(60,110,210,1)"],
    granBright: "rgba(200,225,255,1)", granDark: "rgba(60,100,180,1)",
    coronaInner: "rgba(180,215,255,", coronaMid: "rgba(120,170,255,", coronaOuter: "rgba(60,120,220,",
    coronaIntensity: 1.4,
    chromoColor: "rgba(80,140,255,", prominenceColor: "rgba(100,160,255,",
    streamerCount: 16, prominenceCount: 7, spiculeCount: 50, spikeIntensity: 0.06,
    limbColor: "rgba(30,50,130,", hasJets: false, hasPulse: false, hasFieldLines: false,
    labelColor: "#70a8ff",
  },
  {
    name: "Blue Giant",
    minDelivered: 22,
    sizeMult: 1.28,
    core: ["rgba(255,255,255,1)", "rgba(200,225,255,1)", "rgba(130,180,255,1)", "rgba(70,130,245,1)", "rgba(40,80,200,1)"],
    granBright: "rgba(180,210,255,1)", granDark: "rgba(40,75,160,1)",
    coronaInner: "rgba(150,200,255,", coronaMid: "rgba(90,150,255,", coronaOuter: "rgba(40,90,210,",
    coronaIntensity: 1.6,
    chromoColor: "rgba(60,120,255,", prominenceColor: "rgba(80,140,255,",
    streamerCount: 18, prominenceCount: 8, spiculeCount: 56, spikeIntensity: 0.07,
    limbColor: "rgba(20,35,110,", hasJets: false, hasPulse: false, hasFieldLines: false,
    labelColor: "#5090ff",
  },
  {
    name: "Supergiant",
    minDelivered: 30,
    sizeMult: 1.4,
    core: ["rgba(255,255,255,1)", "rgba(210,230,255,1)", "rgba(140,190,255,1)", "rgba(80,140,240,1)", "rgba(50,90,200,1)"],
    granBright: "rgba(200,225,255,1)", granDark: "rgba(50,80,170,1)",
    coronaInner: "rgba(160,210,255,", coronaMid: "rgba(100,160,255,", coronaOuter: "rgba(50,100,220,",
    coronaIntensity: 1.9,
    chromoColor: "rgba(70,130,255,", prominenceColor: "rgba(90,160,255,",
    streamerCount: 20, prominenceCount: 9, spiculeCount: 60, spikeIntensity: 0.08,
    limbColor: "rgba(25,40,120,", hasJets: false, hasPulse: true, hasFieldLines: true,
    labelColor: "#4080ff",
  },
  {
    name: "Neutron Star",
    minDelivered: 40,
    sizeMult: 1.0,
    core: ["rgba(255,255,255,1)", "rgba(230,240,255,1)", "rgba(180,210,255,1)", "rgba(120,170,255,1)", "rgba(80,130,250,1)"],
    granBright: "rgba(220,240,255,1)", granDark: "rgba(80,120,200,1)",
    coronaInner: "rgba(200,230,255,", coronaMid: "rgba(140,190,255,", coronaOuter: "rgba(80,140,250,",
    coronaIntensity: 2.4,
    chromoColor: "rgba(100,170,255,", prominenceColor: "rgba(130,190,255,",
    streamerCount: 24, prominenceCount: 10, spiculeCount: 64, spikeIntensity: 0.10,
    limbColor: "rgba(30,50,140,", hasJets: true, hasPulse: true, hasFieldLines: true,
    labelColor: "#90c0ff",
  },
  {
    name: "Quasar",
    minDelivered: 55,
    sizeMult: 1.15,
    core: ["rgba(255,255,255,1)", "rgba(240,245,255,1)", "rgba(200,220,255,1)", "rgba(150,190,255,1)", "rgba(100,155,250,1)"],
    granBright: "rgba(240,250,255,1)", granDark: "rgba(100,140,220,1)",
    coronaInner: "rgba(220,240,255,", coronaMid: "rgba(170,210,255,", coronaOuter: "rgba(120,170,255,",
    coronaIntensity: 3.0,
    chromoColor: "rgba(130,190,255,", prominenceColor: "rgba(160,210,255,",
    streamerCount: 28, prominenceCount: 12, spiculeCount: 72, spikeIntensity: 0.14,
    limbColor: "rgba(35,55,150,", hasJets: true, hasPulse: true, hasFieldLines: true,
    labelColor: "#b0d4ff",
  },
];

function getStarStage(deliveredCount: number): StarStageConfig {
  let stage = STAR_STAGES[0];
  for (const s of STAR_STAGES) {
    if (deliveredCount >= s.minDelivered) stage = s;
  }
  return stage;
}

// ─── Star (Central Command) ─────────────────────────────────────────────────

function pseudoNoise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.1) * 43758.5453;
  return n - Math.floor(n);
}

function fbm(px: number, py: number, t: number, octaves: number): number {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * pseudoNoise(px * freq, py * freq, t * 0.0001 + i * 7.3);
    freq *= 2.1;
    amp *= 0.48;
  }
  return val;
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, s: number,
  t: number, health: number,
  stage: StarStageConfig,
) {
  const R = s * 0.55 * stage.sizeMult;
  const ci = stage.coronaIntensity;

  // ── 1. Coronal streamers ──
  ctx.save();
  for (let i = 0; i < stage.streamerCount; i++) {
    const baseA = (Math.PI * 2 * i) / stage.streamerCount + t * 0.00008;
    const wobble = Math.sin(t * 0.0006 + i * 2.7) * 0.18;
    const len = R * (2.2 + 1.2 * Math.sin(t * 0.0009 + i * 1.3));
    const w = R * (0.06 + 0.03 * Math.sin(t * 0.002 + i));

    const sx1 = x + Math.cos(baseA - w / R) * R * 0.95;
    const sy1 = y + Math.sin(baseA - w / R) * R * 0.95;
    const sx2 = x + Math.cos(baseA + w / R) * R * 0.95;
    const sy2 = y + Math.sin(baseA + w / R) * R * 0.95;
    const cx1 = x + Math.cos(baseA + wobble) * len;
    const cy1 = y + Math.sin(baseA + wobble) * len;

    const grad = ctx.createRadialGradient(x, y, R * 0.8, x, y, len);
    grad.addColorStop(0, `${stage.coronaInner}${(0.18 * ci).toFixed(2)})`);
    grad.addColorStop(0.4, `${stage.coronaMid}${(0.06 * ci).toFixed(2)})`);
    grad.addColorStop(1, "transparent");

    ctx.globalAlpha = 0.25 + 0.12 * Math.sin(t * 0.0015 + i);
    ctx.beginPath();
    ctx.moveTo(sx1, sy1);
    ctx.quadraticCurveTo(cx1, cy1, sx2, sy2);
    ctx.fillStyle = grad;
    ctx.fill();
  }
  ctx.restore();

  // ── 2. Outer corona ──
  ctx.save();
  const cR1 = R * 6;
  const g1 = ctx.createRadialGradient(x, y, R * 0.5, x, y, cR1);
  const cPulse = (0.035 + 0.012 * Math.sin(t * 0.0005)) * ci;
  g1.addColorStop(0, `${stage.coronaInner}${(cPulse * 2).toFixed(3)})`);
  g1.addColorStop(0.12, `${stage.coronaMid}${cPulse.toFixed(3)})`);
  g1.addColorStop(0.35, `${stage.coronaOuter}${(cPulse * 0.35).toFixed(3)})`);
  g1.addColorStop(0.65, `${stage.coronaOuter}${(cPulse * 0.08).toFixed(3)})`);
  g1.addColorStop(1, "transparent");
  ctx.fillStyle = g1;
  ctx.beginPath();
  ctx.arc(x, y, cR1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── 3. Inner corona ──
  ctx.save();
  const cR2 = R * 2.8;
  const g2 = ctx.createRadialGradient(x, y, R * 0.45, x, y, cR2);
  const kPulse = (0.22 + 0.06 * Math.sin(t * 0.001)) * ci;
  g2.addColorStop(0, `${stage.coronaInner}${kPulse.toFixed(3)})`);
  g2.addColorStop(0.2, `${stage.coronaMid}${(kPulse * 0.55).toFixed(3)})`);
  g2.addColorStop(0.5, `${stage.coronaOuter}${(kPulse * 0.15).toFixed(3)})`);
  g2.addColorStop(1, "transparent");
  ctx.fillStyle = g2;
  ctx.beginPath();
  ctx.arc(x, y, cR2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── Polar jets (Neutron Star / Quasar only) ──
  if (stage.hasJets) {
    ctx.save();
    const jetLen = R * (4.5 + 1.5 * Math.sin(t * 0.0008));
    const jetW = R * 0.3;
    for (const dir of [-1, 1]) {
      const jg = ctx.createLinearGradient(x, y, x, y + dir * jetLen);
      jg.addColorStop(0, `${stage.coronaInner}0.25)`);
      jg.addColorStop(0.2, `${stage.coronaMid}0.12)`);
      jg.addColorStop(0.6, `${stage.coronaOuter}0.04)`);
      jg.addColorStop(1, "transparent");
      ctx.fillStyle = jg;
      ctx.beginPath();
      ctx.moveTo(x - jetW * 0.5, y);
      ctx.lineTo(x + jetW * 0.5, y);
      ctx.lineTo(x + jetW * 0.1, y + dir * jetLen);
      ctx.lineTo(x - jetW * 0.1, y + dir * jetLen);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // ── Magnetic field lines (Supergiant+) ──
  if (stage.hasFieldLines) {
    ctx.save();
    ctx.globalAlpha = 0.04 + 0.02 * Math.sin(t * 0.0006);
    ctx.strokeStyle = stage.labelColor;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 8; i++) {
      const a0 = (Math.PI * 2 * i) / 8 + t * 0.00005;
      ctx.beginPath();
      for (let j = 0; j <= 20; j++) {
        const frac = j / 20;
        const d = R * (1.3 + 1.5 * Math.sin(frac * Math.PI));
        const angle = a0 + frac * 0.8;
        const fx = x + Math.cos(angle) * d;
        const fy = y + Math.sin(angle) * d;
        if (j === 0) ctx.moveTo(fx, fy); else ctx.lineTo(fx, fy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── 4. Prominences ──
  ctx.save();
  for (let i = 0; i < stage.prominenceCount; i++) {
    const aBase = (Math.PI * 2 * i) / stage.prominenceCount + t * 0.00006 + i * 1.1;
    const active = (Math.sin(t * 0.0004 + i * 3.1) + 1) * 0.5;
    if (active < 0.3) continue;

    const arcH = R * (0.5 + 0.4 * active);
    const footSpread = 0.22 + 0.08 * Math.sin(i * 2.3);
    const a1 = aBase - footSpread;
    const a2 = aBase + footSpread;
    const fx1 = x + Math.cos(a1) * R;
    const fy1 = y + Math.sin(a1) * R;
    const fx2 = x + Math.cos(a2) * R;
    const fy2 = y + Math.sin(a2) * R;
    const cpx = x + Math.cos(aBase) * (R + arcH);
    const cpy = y + Math.sin(aBase) * (R + arcH);

    ctx.globalAlpha = 0.12 * active;
    ctx.beginPath();
    ctx.moveTo(fx1, fy1);
    ctx.quadraticCurveTo(cpx, cpy, fx2, fy2);
    ctx.strokeStyle = `${stage.prominenceColor}${(0.6 * active).toFixed(2)})`;
    ctx.lineWidth = R * 0.04 * (1 + active);
    ctx.stroke();

    ctx.globalAlpha = 0.06 * active;
    ctx.lineWidth = R * 0.12 * active;
    ctx.strokeStyle = `${stage.prominenceColor}0.3)`;
    ctx.stroke();
  }
  ctx.restore();

  // ── 5. Chromosphere ──
  ctx.save();
  ctx.globalAlpha = 0.12 + 0.04 * Math.sin(t * 0.0012);
  ctx.beginPath();
  ctx.arc(x, y, R * 1.05, 0, Math.PI * 2);
  const chromoGrad = ctx.createRadialGradient(x, y, R * 0.95, x, y, R * 1.12);
  chromoGrad.addColorStop(0, `${stage.chromoColor}0.5)`);
  chromoGrad.addColorStop(0.5, `${stage.chromoColor}0.25)`);
  chromoGrad.addColorStop(1, "transparent");
  ctx.fillStyle = chromoGrad;
  ctx.fill();
  ctx.restore();

  // ── 6. Spicules ──
  ctx.save();
  for (let i = 0; i < stage.spiculeCount; i++) {
    const a = (Math.PI * 2 * i) / stage.spiculeCount + t * 0.0001;
    const h = R * (0.04 + 0.06 * pseudoNoise(i, t * 0.001, 0));
    const bx = x + Math.cos(a) * R;
    const by = y + Math.sin(a) * R;
    const tx = x + Math.cos(a) * (R + h);
    const ty = y + Math.sin(a) * (R + h);
    ctx.globalAlpha = 0.07 + 0.04 * pseudoNoise(i, t * 0.002, 1);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = `${stage.chromoColor}0.6)`;
    ctx.lineWidth = R * 0.015;
    ctx.stroke();
  }
  ctx.restore();

  // ── Pulse ring (Supergiant+) ──
  if (stage.hasPulse) {
    ctx.save();
    const pulsePhase = (t * 0.0004) % (Math.PI * 2);
    const pulseR = R * (1.1 + 1.2 * ((pulsePhase / (Math.PI * 2))));
    const pulseA = Math.max(0, 1 - (pulsePhase / (Math.PI * 2))) * 0.12;
    ctx.globalAlpha = pulseA;
    ctx.beginPath();
    ctx.arc(x, y, pulseR, 0, Math.PI * 2);
    ctx.strokeStyle = stage.labelColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  // ── 7. Photosphere ──
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.clip();

  const bodyG = ctx.createRadialGradient(x, y, 0, x, y, R);
  const coreStops = [0, 0.15, 0.4, 0.7, 1.0];
  stage.core.forEach((color, ci2) => {
    bodyG.addColorStop(coreStops[ci2] ?? 1, color);
  });
  ctx.fillStyle = bodyG;
  ctx.fillRect(x - R, y - R, R * 2, R * 2);

  // ── 8. Granulation ──
  const cellSize = R * 0.12;
  const gridN = Math.ceil((R * 2) / cellSize);
  for (let gx = 0; gx < gridN; gx++) {
    for (let gy = 0; gy < gridN; gy++) {
      const px2 = x - R + gx * cellSize + cellSize * 0.5;
      const py2 = y - R + gy * cellSize + cellSize * 0.5;
      const dx = px2 - x, dy = py2 - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > R) continue;

      const n = fbm(gx * 0.7, gy * 0.7, t, 3);
      const brightness = (n - 0.5) * 0.4;
      const limbFactor = 1 - (dist / R);

      if (brightness > 0) {
        ctx.globalAlpha = brightness * limbFactor * 0.5;
        ctx.fillStyle = stage.granBright;
      } else {
        ctx.globalAlpha = Math.abs(brightness) * limbFactor * 0.35;
        ctx.fillStyle = stage.granDark;
      }
      ctx.fillRect(px2 - cellSize * 0.5, py2 - cellSize * 0.5, cellSize, cellSize);
    }
  }

  // ── 9. Sunspots ──
  const spotSeeds = [0.3, 1.7, 3.9, 5.2, 7.6];
  for (let i = 0; i < spotSeeds.length; i++) {
    const phase = spotSeeds[i] + t * 0.000012;
    const active = (Math.sin(phase * 2.1) + 1) * 0.5;
    if (active < 0.4) continue;

    const sa2 = phase * 1.3 + i * 1.26;
    const sd = R * (0.2 + 0.3 * pseudoNoise(i, 0, 42));
    const sx2 = x + Math.cos(sa2) * sd;
    const sy2 = y + Math.sin(sa2) * sd;
    const sr = R * (0.035 + 0.025 * active);

    ctx.globalAlpha = 0.3 * active;
    const pen = ctx.createRadialGradient(sx2, sy2, sr * 0.4, sx2, sy2, sr * 1.8);
    pen.addColorStop(0, "rgba(20,10,5,0.9)");
    pen.addColorStop(0.5, "rgba(50,30,15,0.5)");
    pen.addColorStop(1, "transparent");
    ctx.fillStyle = pen;
    ctx.beginPath();
    ctx.arc(sx2, sy2, sr * 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.5 * active;
    ctx.fillStyle = "rgba(10,5,2,0.9)";
    ctx.beginPath();
    ctx.arc(sx2, sy2, sr * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 10. Limb darkening ──
  ctx.globalAlpha = 1;
  const limbG = ctx.createRadialGradient(x, y, R * 0.3, x, y, R * 1.02);
  limbG.addColorStop(0, "transparent");
  limbG.addColorStop(0.5, "transparent");
  limbG.addColorStop(0.7, `${stage.limbColor}0.1)`);
  limbG.addColorStop(0.85, `${stage.limbColor}0.25)`);
  limbG.addColorStop(0.95, `${stage.limbColor}0.45)`);
  limbG.addColorStop(1, `${stage.limbColor}0.7)`);
  ctx.fillStyle = limbG;
  ctx.fillRect(x - R, y - R, R * 2, R * 2);

  ctx.restore();

  // ── 11. Diffraction spikes ──
  ctx.save();
  ctx.globalAlpha = stage.spikeIntensity + 0.015 * Math.sin(t * 0.0007);
  const spikeLen = R * 4;
  const spikeCount = stage.hasJets ? 6 : 4;
  for (let i = 0; i < spikeCount; i++) {
    const a = (Math.PI * i) / spikeCount + 0.1;
    const grad = ctx.createLinearGradient(
      x - Math.cos(a) * spikeLen, y - Math.sin(a) * spikeLen,
      x + Math.cos(a) * spikeLen, y + Math.sin(a) * spikeLen,
    );
    grad.addColorStop(0, "transparent");
    grad.addColorStop(0.35, `${stage.coronaInner}0.5)`);
    grad.addColorStop(0.5, `${stage.coronaInner}1)`);
    grad.addColorStop(0.65, `${stage.coronaInner}0.5)`);
    grad.addColorStop(1, "transparent");
    ctx.strokeStyle = grad;
    ctx.lineWidth = R * 0.02;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * spikeLen, y - Math.sin(a) * spikeLen);
    ctx.lineTo(x + Math.cos(a) * spikeLen, y + Math.sin(a) * spikeLen);
    ctx.stroke();
  }
  ctx.restore();

  // Health ring
  const ringR = s * 1.5 * stage.sizeMult;
  ctx.beginPath();
  ctx.arc(x, y, ringR, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * health);
  ctx.strokeStyle = health > 0.7 ? "#22c55e" : health > 0.4 ? "#f59e0b" : "#ef4444";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.lineCap = "butt";
}

// ─── Planet Drawing (CSE) ────────────────────────────────────────────────────
// Planets are now drawn using the XP evolution stages from planet-draw.ts
// via drawEvolutionPlanet() imported at the top.

// ─── Moon Drawing (Project) ────────────────────────────────────────────────────

function drawMoon(
  ctx: CanvasRenderingContext2D,
  mx: number, my: number, mr: number,
  c: RGB, stalled: boolean, phase: number,
) {
  ctx.save();
  if (stalled) ctx.globalAlpha = 0.4;

  // Tiny glow
  const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 2.5);
  mg.addColorStop(0, `rgba(${c.r},${c.g},${c.b},0.12)`);
  mg.addColorStop(1, "transparent");
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.arc(mx, my, mr * 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Shadow
  ctx.beginPath();
  ctx.ellipse(mx + mr * 0.1, my + mr * 0.15, mr * 0.9, mr * 0.25, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fill();

  // Moon body
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  const bg = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 0, mx + mr * 0.15, my + mr * 0.15, mr);
  bg.addColorStop(0, `rgb(${Math.min(255, c.r + 60)},${Math.min(255, c.g + 60)},${Math.min(255, c.b + 60)})`);
  bg.addColorStop(0.5, `rgb(${c.r},${c.g},${c.b})`);
  bg.addColorStop(1, `rgb(${Math.floor(c.r * 0.3)},${Math.floor(c.g * 0.3)},${Math.floor(c.b * 0.3)})`);
  ctx.fillStyle = bg;
  ctx.fill();

  // Craters (from phase seed)
  if (mr > 3) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 3; i++) {
      const cx2 = mx + Math.cos(phase + i * 2.1) * mr * 0.4;
      const cy2 = my + Math.sin(phase + i * 2.1) * mr * 0.3;
      const cr = mr * (0.12 + (i % 2) * 0.08);
      ctx.beginPath();
      ctx.arc(cx2, cy2, cr, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fill();
    }
    ctx.restore();
  }

  // Specular
  ctx.beginPath();
  ctx.arc(mx - mr * 0.25, my - mr * 0.25, mr * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fill();

  ctx.restore();
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function FleetCommandMap({ fleet, admiralName, stats }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const animRef = useRef(0);
  const router = useRouter();

  const planetsRef = useRef<Planet[]>([]);
  const starsRef = useRef<Pt[]>([]);
  const expRef = useRef<number | null>(null);
  const eTRef = useRef(0);
  const scanRef = useRef(0);
  const tRef = useRef(0);
  const hitKeyRef = useRef("");

  const msHealth = fleet.length > 0
    ? fleet.reduce((s, f) => s + Math.max(0, 1 - f.activeBlockers / (f.totalPhases + f.activeBlockers + 1)), 0) / fleet.length
    : 1;

  const [tip, setTip] = useState<{
    x: number; y: number;
    type: "mothership" | "planet" | "moon";
    cse?: FleetCSE; project?: FleetProject;
    health: number; risk: number;
  } | null>(null);

  /* ── Init ──────────────────────────────────────────────────────── */

  const init = useCallback((w: number, h: number) => {
    const cx = w / 2;
    const cy = h * 0.47;
    const now = Date.now();
    const maxBl = Math.max(...fleet.map((f) => f.activeBlockers), 1);
    const orbitR = Math.min(w * 0.42, h * 0.38);

    const planets: Planet[] = fleet.map((cse, i) => {
      const n = fleet.length;
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const jitter = (i % 2 === 0 ? 1 : -1) * 10;
      const x = cx + Math.cos(angle) * (orbitR + jitter);
      const y = cy + Math.sin(angle) * (orbitR * 0.72 + jitter * 0.3);

      const health = Math.max(0, Math.min(1, 1 - cse.activeBlockers / (cse.totalPhases + cse.activeBlockers + 1)));
      const risk = cse.activeBlockers / maxBl;
      const avgF = cse.projects.length > 0
        ? cse.projects.reduce((s, p) => s + Math.max(0, 1 - (now - p.lastUpdated) / STALE), 0) / cse.projects.length
        : 0;
      const velocity = Math.max(0, Math.min(1, avgF));

      const color = COLORS[i % COLORS.length];
      const rgb = hex2rgb(color);
      const size = 16 + Math.min(cse.projectCount, 12) * 1.8;

      const moons: Moon[] = cse.projects.map((proj, pi) => {
        const va = (Math.PI * 2 * pi) / (cse.projects.length || 1);
        const od = size * 2.5 + (pi % 3) * 14;
        const stalled = now - proj.lastUpdated > STALE;
        const ph = Math.max(0, Math.min(1, 1 - proj.blockerCount / (proj.phaseCount + proj.blockerCount + 1)));
        const isCompleted = (proj.engagementStage ?? 0) >= 6;
        return {
          project: proj, lx: Math.cos(va) * od, ly: Math.sin(va) * od * 0.55,
          r: 3 + Math.min(proj.phaseCount, 10) * 0.4,
          health: ph, stalled: isCompleted ? false : stalled,
          oAngle: va, oDist: od, oSpeed: 0.0003 + Math.random() * 0.0005,
          driftOff: stalled && !isCompleted ? 20 + Math.random() * 25 : 0,
          color: isCompleted ? "#fbbf24" : stalled ? "#64748b" : ph > 0.7 ? color : ph > 0.4 ? "#f59e0b" : "#ef4444",
          phase: pi * 1.3,
          completed: isCompleted,
          starX: cx, starY: cy,
          starOrbitAngle: va + i * 1.1 + pi * 0.7,
          starOrbitDist: STAR_SIZE * 2.2 + pi * 10 + i * 8,
          starOrbitSpeed: 0.00015 + Math.random() * 0.0002,
          parentColor: color,
        };
      });

      return {
        cse, x, y, targetX: x, targetY: y, size, health, risk, velocity,
        color, rgb, hullPulse: Math.random() * Math.PI * 2,
        moons, orbitAngle: angle,
        rotationSpeed: 0.0001 + Math.random() * 0.0002,
        tilt: 0.25 + Math.random() * 0.3,
        rings: i % 3 === 0,
        bandSeed: i * 7 + 3,
        xpLevel: cse.xpLevel ?? 1,
      };
    });

    planetsRef.current = planets;
    starsRef.current = Array.from({ length: 120 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: -0.02 - Math.random() * 0.04, vy: 0,
      r: 0.3 + Math.random() * 1.2, a: 0.08 + Math.random() * 0.35,
    }));
  }, [fleet]);

  /* ── Canvas + loop ─────────────────────────────────────────────── */

  useEffect(() => {
    const cv = canvasRef.current;
    const bx = boxRef.current;
    if (!cv || !bx) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const r = bx.getBoundingClientRect();
      cv.width = r.width * dpr;
      cv.height = r.height * dpr;
      cv.style.width = `${r.width}px`;
      cv.style.height = `${r.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      init(r.width, r.height);
    };
    resize();
    window.addEventListener("resize", resize);

    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(now - last, 50);
      last = now;
      tRef.current += dt;
      const dpr = window.devicePixelRatio || 1;
      const w = cv.width / dpr;
      const h = cv.height / dpr;
      tick(dt, w, h);
      draw(ctx, w, h);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animRef.current);
      } else {
        last = performance.now();
        animRef.current = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
      cancelAnimationFrame(animRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [init]);

  /* ── Tick ───────────────────────────────────────────────────────── */

  function tick(dt: number, w: number, h: number) {
    const t = tRef.current;
    scanRef.current += dt * 0.0002;
    const target = expRef.current !== null ? 1 : 0;
    eTRef.current += (target - eTRef.current) * 0.04;

    const planets = planetsRef.current;
    const exp = expRef.current;
    const cx = w / 2;
    const cy = h * 0.47;
    const n = planets.length;
    const orbitR = Math.min(w * 0.42, h * 0.38);

    planets.forEach((pl, i) => {
      pl.hullPulse += dt * 0.002;

      if (exp !== null && exp >= 0) {
        if (i === exp) {
          pl.targetX = w * 0.2;
          pl.targetY = h * 0.4;
        } else {
          const oi = i < exp ? i : i - 1;
          pl.targetX = w * 0.05;
          pl.targetY = h * 0.1 + ((h * 0.8) / (n - 1 || 1)) * oi;
        }
      } else if (exp === -1) {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        pl.targetX = cx + Math.cos(angle) * (orbitR * 1.15);
        pl.targetY = cy + Math.sin(angle) * (orbitR * 0.8);
      } else {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const jitter = (i % 2 === 0 ? 1 : -1) * 10;
        pl.targetX = cx + Math.cos(angle) * (orbitR + jitter);
        pl.targetY = cy + Math.sin(angle) * (orbitR * 0.72 + jitter * 0.3);
      }

      pl.x += (pl.targetX - pl.x) * 0.03;
      pl.y += (pl.targetY - pl.y) * 0.03;

      const ef = exp === i ? 1 + eTRef.current * 0.7 : 1;
      pl.moons.forEach((m) => {
        if (m.completed) {
          m.starOrbitAngle += m.starOrbitSpeed * dt;
          m.starX = cx + Math.cos(m.starOrbitAngle) * m.starOrbitDist;
          m.starY = cy + Math.sin(m.starOrbitAngle) * m.starOrbitDist * 0.6;
          m.lx = m.starX - pl.x;
          m.ly = m.starY - pl.y;
        } else {
          m.oAngle += m.oSpeed * dt;
          const d = (m.oDist + (m.stalled ? m.driftOff + Math.sin(t * 0.001 + m.oAngle) * 4 : 0)) * ef;
          m.lx = Math.cos(m.oAngle) * d;
          m.ly = Math.sin(m.oAngle) * d * 0.55;
        }
      });
    });

    starsRef.current.forEach((p) => {
      p.x += p.vx;
      if (p.x < -5) p.x = w + 5;
      // Twinkle
      p.a = Math.max(0.05, p.a + (Math.random() - 0.5) * 0.01);
    });
  }

  /* ── Draw ───────────────────────────────────────────────────────── */

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const t = tRef.current;
    const exp = expRef.current;
    const eT = eTRef.current;
    const cx = w / 2;
    const cy = h * 0.47;

    // Deep space background
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
    bg.addColorStop(0, "#0a0e1f");
    bg.addColorStop(0.4, "#070a18");
    bg.addColorStop(1, "#030510");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Faint nebula wash
    ctx.save();
    ctx.globalAlpha = 0.03;
    const neb = ctx.createRadialGradient(w * 0.7, h * 0.3, 0, w * 0.7, h * 0.3, w * 0.5);
    neb.addColorStop(0, "#3b82f6");
    neb.addColorStop(0.5, "#8b5cf6");
    neb.addColorStop(1, "transparent");
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Stars
    starsRef.current.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,220,255,${p.a})`;
      ctx.fill();
    });

    // Scan sweep
    ctx.save();
    ctx.globalAlpha = 0.025;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const sa = scanRef.current;
    ctx.arc(cx, cy, Math.max(w, h) * 0.7, sa, sa + 0.15);
    ctx.closePath();
    const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
    sg.addColorStop(0, GOLD);
    sg.addColorStop(1, "transparent");
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.restore();

    // ── Command Star ──
    const allPlanets = planetsRef.current;
    const completedCount = allPlanets.reduce((s, pl) => s + pl.moons.filter(m => m.completed).length, 0);
    const starStage = getStarStage(completedCount);
    const starR = STAR_SIZE * starStage.sizeMult;

    const msAlpha = exp !== null && exp >= 0 ? 0.25 + 0.75 * (1 - eT) : 1;
    ctx.save();
    ctx.globalAlpha = msAlpha;

    drawStar(ctx, cx, cy, STAR_SIZE, t, msHealth, starStage);

    ctx.font = "bold 13px system-ui";
    ctx.fillStyle = GOLD;
    ctx.textAlign = "center";
    ctx.fillText(`ADM ${admiralName}`, cx, cy + starR * 1.55 + 12);

    // Star stage name
    ctx.font = "bold 8px system-ui";
    ctx.fillStyle = starStage.labelColor;
    ctx.fillText(`✦ ${starStage.name.toUpperCase()}`, cx, cy + starR * 1.55 + 23);

    ctx.font = "9px system-ui";
    ctx.fillStyle = "rgba(201,162,39,0.55)";
    const completedLabel = completedCount > 0 ? `  ·  ${completedCount} delivered` : "";
    ctx.fillText(`${stats.totalCSEs} planets · ${stats.totalProjects} projects${completedLabel}`, cx, cy + starR * 1.55 + 35);
    ctx.restore();

    // ── Completed moon orbit rings around star ──
    if (exp === null || exp === -1) {
      const completedMoons: { moon: Moon; planet: Planet }[] = [];
      allPlanets.forEach((pl) => {
        pl.moons.forEach((m) => {
          if (m.completed) completedMoons.push({ moon: m, planet: pl });
        });
      });

      // Orbit trail rings for completed moons
      const seenDists = new Set<number>();
      completedMoons.forEach(({ moon }) => {
        const dKey = Math.round(moon.starOrbitDist);
        if (seenDists.has(dKey)) return;
        seenDists.add(dKey);
        ctx.beginPath();
        ctx.ellipse(cx, cy, moon.starOrbitDist, moon.starOrbitDist * 0.6, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(251,191,36,0.06)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });

      // Draw completed moons near the star
      completedMoons.forEach(({ moon, planet }) => {
        const mx = moon.starX;
        const my = moon.starY;
        const mr = moon.r * 1.2;
        const mc = hex2rgb(moon.color);

        // Golden completion glow
        const glow = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 4);
        glow.addColorStop(0, "rgba(251,191,36,0.15)");
        glow.addColorStop(0.5, "rgba(251,191,36,0.04)");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(mx, my, mr * 4, 0, Math.PI * 2);
        ctx.fill();

        drawMoon(ctx, mx, my, mr, mc, false, moon.phase);

        // Completion ring
        ctx.beginPath();
        ctx.arc(mx, my, mr + 2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(251,191,36,${0.3 + 0.15 * Math.sin(t * 0.002 + moon.phase)})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Label
        ctx.font = "7px system-ui";
        ctx.fillStyle = "rgba(251,191,36,0.7)";
        ctx.textAlign = "center";
        const name = moon.project.name.length > 12 ? moon.project.name.slice(0, 11) + "…" : moon.project.name;
        ctx.fillText(name, mx, my + mr + 10);

        // Tiny CSE attribution
        ctx.font = "6px system-ui";
        ctx.fillStyle = `rgba(${planet.rgb.r},${planet.rgb.g},${planet.rgb.b},0.45)`;
        ctx.fillText(planet.cse.name, mx, my + mr + 18);
      });
    }

    // ── Orbital paths (star to planets) ──
    if (exp === null || exp === -1) {
      ctx.save();
      ctx.globalAlpha = 0.04;
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 10]);
      planetsRef.current.forEach((pl) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(pl.x, pl.y);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ── Planets ──
    const planets = planetsRef.current;
    planets.forEach((pl, i) => {
      const isExp = exp === i;
      const isOther = exp !== null && exp >= 0 && !isExp;
      const scale = isOther ? 0.4 + 0.6 * (1 - eT) : 1;
      const alpha = isOther ? 0.2 + 0.8 * (1 - eT) : 1;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Moon orbit trails (elliptical) — skip completed moons (they orbit the star)
      if (!isOther || eT < 0.5) {
        pl.moons.forEach((m) => {
          if (m.completed) return;
          const d = m.oDist * scale;
          ctx.beginPath();
          ctx.ellipse(pl.x, pl.y, d, d * 0.55, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${pl.rgb.r},${pl.rgb.g},${pl.rgb.b},0.04)`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        });
      }

      // Moons — skip completed (drawn around star)
      if (!isOther || eT < 0.5) {
        pl.moons.forEach((m, mi) => {
          if (m.completed) return;
          const mx = pl.x + m.lx * scale;
          const my = pl.y + m.ly * scale;
          const mr = m.r * scale;
          const mc = hex2rgb(m.color);

          drawMoon(ctx, mx, my, mr, mc, m.stalled, m.phase);

          if (m.stalled) {
            ctx.save();
            ctx.strokeStyle = `rgba(239,68,68,${0.15 + 0.1 * Math.sin(t * 0.003 + mi)})`;
            ctx.lineWidth = 0.6;
            ctx.setLineDash([2, 3]);
            ctx.beginPath();
            ctx.arc(mx, my, mr + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
          }

          if (isExp && eT > 0.7) {
            ctx.font = `${8 * scale}px system-ui`;
            ctx.fillStyle = `rgba(200,220,240,${eT * 0.7})`;
            ctx.textAlign = "center";
            ctx.fillText(m.project.name.length > 14 ? m.project.name.slice(0, 13) + "…" : m.project.name, mx, my + mr + 11);
          }
        });
      }

      // Risk corona
      if (pl.risk > 0.08) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.0025);
        ctx.beginPath();
        ctx.arc(pl.x, pl.y, pl.size * 3 * scale, 0, Math.PI * 2);
        const rg = ctx.createRadialGradient(pl.x, pl.y, pl.size * scale, pl.x, pl.y, pl.size * 3 * scale);
        rg.addColorStop(0, `rgba(239,68,68,${pl.risk * 0.2 * pulse})`);
        rg.addColorStop(1, "transparent");
        ctx.fillStyle = rg;
        ctx.fill();
      }

      // Planet — drawn using XP evolution stage
      ctx.save();
      ctx.translate(pl.x, pl.y);
      ctx.scale(scale, scale);
      drawEvolutionPlanet(ctx, pl.xpLevel, 0, 0, pl.size, t * 0.001);
      ctx.restore();

      // Health ring
      const ringR = pl.size * 1.5 * scale;
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 2.5 * scale;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pl.health);
      ctx.strokeStyle = pl.health > 0.7 ? "#22c55e" : pl.health > 0.4 ? "#f59e0b" : "#ef4444";
      ctx.lineWidth = 2.5 * scale;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.lineCap = "butt";

      if (pl.health < 0.5) {
        ctx.beginPath();
        ctx.arc(pl.x, pl.y, ringR + 3, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239,68,68,${Math.abs(0.1 * Math.sin(pl.hullPulse) * (1 - pl.health))})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Labels
      ctx.font = `bold ${(isOther ? 9 : 11) * scale}px system-ui`;
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "center";
      ctx.fillText(pl.cse.name, pl.x, pl.y + pl.size * 1.5 * scale + 14 * scale);
      if (!isOther) {
        ctx.font = `${8 * scale}px system-ui`;
        ctx.fillStyle = `rgba(${pl.rgb.r},${pl.rgb.g},${pl.rgb.b},0.6)`;
        ctx.fillText(`${pl.cse.projectCount} project${pl.cse.projectCount !== 1 ? "s" : ""}`, pl.x, pl.y + pl.size * 1.5 * scale + 25 * scale);
      }

      ctx.restore();
    });

    // Detail panels
    if (exp !== null && exp >= 0 && eT > 0.4) {
      renderPanel(ctx, w, h, planets[exp], eT);
    }
    if (exp === -1 && eT > 0.4) {
      renderMotherPanel(ctx, w, h, eT);
    }

    drawHUD(ctx, w, h);
  }

  /* ── Planet detail panel ─────────────────────────────────────── */

  function renderPanel(ctx: CanvasRenderingContext2D, w: number, h: number, pl: Planet, eT: number) {
    const px = w * 0.36, py = h * 0.05, pw = w * 0.6, ph = h * 0.9;
    const alpha = Math.max(0, (eT - 0.4) / 0.6);
    ctx.save();
    ctx.globalAlpha = alpha;

    rr(ctx, px, py, pw, ph, 8);
    ctx.fillStyle = "rgba(8,14,28,0.92)";
    ctx.fill();
    ctx.strokeStyle = `rgba(${pl.rgb.r},${pl.rgb.g},${pl.rgb.b},0.15)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = "bold 15px system-ui";
    ctx.fillStyle = pl.color;
    ctx.textAlign = "left";
    ctx.fillText(`${pl.cse.name}'s System`, px + 20, py + 30);
    ctx.font = "10px system-ui";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(pl.cse.email, px + 20, py + 46);

    const sy = py + 64;
    const mets = [
      { l: "Projects", v: String(pl.cse.projectCount), c: pl.color },
      { l: "Risk", v: `${Math.round(pl.risk * 100)}%`, c: pl.risk > 0.5 ? "#ef4444" : pl.risk > 0.2 ? "#f59e0b" : "#22c55e" },
      { l: "Activity", v: `${Math.round(pl.velocity * 100)}%`, c: pl.velocity > 0.5 ? "#22c55e" : "#f59e0b" },
      { l: "Confidence", v: `${Math.round((1 - pl.cse.pendingAssumptions / (pl.cse.totalPhases + 1)) * 100)}%`, c: "#a855f7" },
      { l: "Blockers", v: String(pl.cse.activeBlockers), c: pl.cse.activeBlockers > 0 ? "#ef4444" : "#22c55e" },
    ];
    const sw = (pw - 40) / mets.length;
    mets.forEach((m, mi) => {
      const mx = px + 20 + mi * sw;
      rr(ctx, mx, sy, sw - 6, 44, 4);
      ctx.fillStyle = "rgba(255,255,255,0.02)";
      ctx.fill();
      ctx.font = "bold 14px system-ui";
      ctx.fillStyle = m.c;
      ctx.textAlign = "center";
      ctx.fillText(m.v, mx + (sw - 6) / 2, sy + 21);
      ctx.font = "7px system-ui";
      ctx.fillStyle = "#64748b";
      ctx.fillText(m.l.toUpperCase(), mx + (sw - 6) / 2, sy + 36);
    });

    const ly = sy + 58;
    ctx.font = "bold 9px system-ui";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "left";
    ctx.fillText("ORBITING PROJECTS", px + 20, ly);

    const maxRows = Math.floor((py + ph - ly - 35) / 44);
    pl.moons.slice(0, maxRows).forEach((m, vi) => {
      const ry = ly + 14 + vi * 44;
      rr(ctx, px + 16, ry, pw - 32, 38, 4);
      ctx.fillStyle = "rgba(255,255,255,0.012)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px + 30, ry + 19, 4, 0, Math.PI * 2);
      ctx.fillStyle = m.completed ? "#fbbf24" : m.stalled ? "#64748b" : m.color;
      ctx.fill();

      ctx.font = "11px system-ui";
      ctx.fillStyle = m.completed ? "#fbbf24" : m.stalled ? "#64748b" : "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText(m.project.name.length > 26 ? m.project.name.slice(0, 25) + "…" : m.project.name, px + 42, ry + 16);
      ctx.font = "8px system-ui";
      ctx.fillStyle = "#475569";
      ctx.fillText(m.project.domain, px + 42, ry + 30);

      const stgColors = ["#64748b", "#f59e0b", "#3b82f6", "#8b5cf6", "#06b6d4", "#22c55e", "#10b981"];
      const stgIdx = Math.min(m.project.engagementStage ?? 0, 6);
      const barW = 48, barH = 3, barX = px + 42, barY = ry + 33;
      for (let si = 0; si < 7; si++) {
        ctx.fillStyle = si <= stgIdx ? (stgColors[si] || "#10b981") : "rgba(255,255,255,0.06)";
        rr(ctx, barX + si * (barW / 7 + 0.5), barY, barW / 7 - 0.5, barH, 1);
        ctx.fill();
      }

      const rx = px + pw - 22;
      ctx.textAlign = "right";
      ctx.font = "9px system-ui";
      ctx.fillStyle = "#64748b";
      ctx.fillText(`${m.project.phaseCount} ph`, rx, ry + 14);
      ctx.fillStyle = m.project.blockerCount > 0 ? "#ef4444" : "#475569";
      ctx.fillText(`${m.project.blockerCount} bl`, rx, ry + 28);
      ctx.font = "bold 7px system-ui";
      ctx.fillStyle = stgColors[stgIdx] || "#c9a227";
      ctx.fillText(`S${stgIdx}`, rx, ry + 37);
      if (m.completed) {
        ctx.font = "bold 7px system-ui";
        ctx.fillStyle = "#fbbf24";
        ctx.fillText("★ ORBITING STAR", rx - 60, ry + 14);
      } else if (m.stalled) {
        ctx.font = "bold 7px system-ui";
        ctx.fillStyle = "#f59e0b";
        ctx.fillText("DRIFTING", rx - 60, ry + 14);
      }
    });
    if (pl.moons.length > maxRows) {
      ctx.font = "8px system-ui";
      ctx.fillStyle = "#475569";
      ctx.textAlign = "center";
      ctx.fillText(`+${pl.moons.length - maxRows} more`, px + pw / 2, py + ph - 24);
    }
    ctx.font = "8px system-ui";
    ctx.fillStyle = "#475569";
    ctx.textAlign = "left";
    ctx.fillText("← Click to return", px + 20, py + ph - 10);
    ctx.restore();
  }

  /* ── Star detail panel ────────────────────────────────────────── */

  function renderMotherPanel(ctx: CanvasRenderingContext2D, w: number, h: number, eT: number) {
    const px = w * 0.3, py = h * 0.05, pw = w * 0.45, ph = h * 0.9;
    const alpha = Math.max(0, (eT - 0.4) / 0.6);
    ctx.save();
    ctx.globalAlpha = alpha;

    rr(ctx, px, py, pw, ph, 8);
    ctx.fillStyle = "rgba(8,14,28,0.92)";
    ctx.fill();
    ctx.strokeStyle = `rgba(${GOLD_RGB.r},${GOLD_RGB.g},${GOLD_RGB.b},0.15)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    const totalDelivered = planetsRef.current.reduce((s, pl) => s + pl.moons.filter(m => m.completed).length, 0);
    const panelStarStage = getStarStage(totalDelivered);
    const panelNextStage = STAR_STAGES.find(st => st.minDelivered > totalDelivered);

    ctx.font = "bold 16px system-ui";
    ctx.fillStyle = GOLD;
    ctx.textAlign = "left";
    ctx.fillText(`Admiral ${admiralName} — Command Center`, px + 20, py + 28);
    ctx.font = "bold 10px system-ui";
    ctx.fillStyle = panelStarStage.labelColor;
    ctx.fillText(`✦ ${panelStarStage.name}${panelNextStage ? `  ·  Next: ${panelNextStage.name} (${panelNextStage.minDelivered - totalDelivered} more deliveries)` : "  ·  MAX EVOLUTION"}`, px + 20, py + 44);

    const sy = py + 60;
    const mets = [
      { l: "Planets", v: String(stats.totalCSEs), c: "#22c55e" },
      { l: "Projects", v: String(stats.totalProjects), c: "#06d6d6" },
      { l: "Delivered", v: String(totalDelivered), c: "#fbbf24" },
      { l: "Health", v: `${Math.round(msHealth * 100)}%`, c: msHealth > 0.7 ? "#22c55e" : msHealth > 0.4 ? "#f59e0b" : "#ef4444" },
    ];
    const sw = (pw - 40) / mets.length;
    mets.forEach((m, mi) => {
      const mx = px + 20 + mi * sw;
      rr(ctx, mx, sy, sw - 6, 48, 4);
      ctx.fillStyle = "rgba(255,255,255,0.02)";
      ctx.fill();
      ctx.font = "bold 16px system-ui";
      ctx.fillStyle = m.c;
      ctx.textAlign = "center";
      ctx.fillText(m.v, mx + (sw - 6) / 2, sy + 24);
      ctx.font = "7px system-ui";
      ctx.fillStyle = "#64748b";
      ctx.fillText(m.l.toUpperCase(), mx + (sw - 6) / 2, sy + 40);
    });

    const ly = sy + 66;
    ctx.font = "bold 9px system-ui";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "left";
    ctx.fillText("PLANETARY SYSTEMS", px + 20, ly);

    const planets = planetsRef.current;
    planets.forEach((pl, fi) => {
      const ry = ly + 14 + fi * 52;
      if (ry + 48 > py + ph - 30) return;

      rr(ctx, px + 16, ry, pw - 32, 46, 4);
      ctx.fillStyle = "rgba(255,255,255,0.012)";
      ctx.fill();

      ctx.save();
      drawEvolutionPlanet(ctx, pl.xpLevel, px + 30, ry + 23, 8, tRef.current * 0.001);
      ctx.restore();

      ctx.font = "bold 12px system-ui";
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText(pl.cse.name, px + 44, ry + 18);
      ctx.font = "9px system-ui";
      ctx.fillStyle = "#64748b";
      ctx.fillText(`${pl.cse.projectCount} projects  ·  ${pl.cse.totalPhases} phases  ·  ${pl.cse.activeBlockers} blockers`, px + 44, ry + 34);

      const barX = px + pw - 90;
      const barW = 60;
      rr(ctx, barX, ry + 18, barW, 6, 3);
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fill();
      rr(ctx, barX, ry + 18, barW * pl.health, 6, 3);
      ctx.fillStyle = pl.health > 0.7 ? "#22c55e" : pl.health > 0.4 ? "#f59e0b" : "#ef4444";
      ctx.fill();
    });

    ctx.font = "8px system-ui";
    ctx.fillStyle = "#475569";
    ctx.textAlign = "left";
    ctx.fillText("← Click to return", px + 20, py + ph - 10);
    ctx.restore();
  }

  /* ── HUD ────────────────────────────────────────────────────────── */

  function drawHUD(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.save();
    ctx.fillStyle = "rgba(6,10,20,0.5)";
    ctx.fillRect(0, 0, w, 32);
    ctx.strokeStyle = "rgba(201,162,39,0.08)";
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, 32); ctx.lineTo(w, 32); ctx.stroke();

    ctx.font = "bold 11px system-ui";
    ctx.fillStyle = GOLD;
    ctx.textAlign = "left";
    ctx.fillText("✦  SYSTEM COMMAND MAP", 12, 21);
    ctx.font = "10px system-ui";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "right";
    ctx.fillText(`${stats.totalCSEs} planets  ·  ${stats.totalProjects} projects  ·  ${stats.totalBlockers} threats`, w - 12, 21);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "rgba(6,10,20,0.4)";
    ctx.fillRect(0, h - 24, w, 24);
    ctx.strokeStyle = "rgba(201,162,39,0.05)";
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, h - 24); ctx.lineTo(w, h - 24); ctx.stroke();
    ctx.font = "8px system-ui";
    ctx.fillStyle = "#475569";
    ctx.textAlign = "left";
    ctx.fillText("CLICK STAR OR PLANET TO INSPECT  ·  CLICK PROJECT TO NAVIGATE", 12, h - 8);
    ctx.textAlign = "right";
    ctx.fillText(`LIVE  ·  ${new Date().toLocaleTimeString()}`, w - 12, h - 8);
    ctx.restore();
  }

  /* ── Hit test ───────────────────────────────────────────────────── */

  function hitTest(mx: number, my: number, w: number, h: number) {
    const planets = planetsRef.current;
    const exp = expRef.current;
    const cx = w / 2;
    const cy = h * 0.47;

    if (exp !== null && exp >= 0) {
      const pl = planets[exp];
      const px = w * 0.36, py = h * 0.05, pw = w * 0.6;
      const ly = py + 64 + 44 + 14 + 14;
      const maxRows = Math.floor((py + h * 0.9 - ly - 35) / 44);
      for (let vi = 0; vi < Math.min(pl.moons.length, maxRows); vi++) {
        const ry = ly + vi * 44;
        if (mx > px + 16 && mx < px + pw - 16 && my > ry && my < ry + 38) {
          return { type: "moon" as const, idx: exp, vi };
        }
      }
      if (Math.hypot(mx - pl.x, my - pl.y) < pl.size * 1.6) {
        return { type: "planet" as const, idx: exp };
      }
      return null;
    }
    if (exp === -1) {
      return null;
    }

    if (Math.hypot(mx - cx, my - cy) < 50) {
      return { type: "mothership" as const, idx: -1 };
    }

    for (let i = 0; i < planets.length; i++) {
      const pl = planets[i];
      for (let vi = 0; vi < pl.moons.length; vi++) {
        const m = pl.moons[vi];
        if (Math.hypot(mx - (pl.x + m.lx), my - (pl.y + m.ly)) < m.r + 5) {
          return { type: "moon" as const, idx: i, vi };
        }
      }
      if (Math.hypot(mx - pl.x, my - pl.y) < pl.size * 1.8) {
        return { type: "planet" as const, idx: i };
      }
    }
    return null;
  }

  /* ── Mouse ──────────────────────────────────────────────────────── */

  const onMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const hit = hitTest(mx, my, r.width, r.height);
    const key = hit ? `${hit.type}-${hit.idx}-${"vi" in hit ? hit.vi : ""}` : "";
    if (key === hitKeyRef.current) return;
    hitKeyRef.current = key;

    if (!hit) { cv.style.cursor = "default"; setTip(null); return; }
    cv.style.cursor = "pointer";
    const planets = planetsRef.current;

    if (hit.type === "mothership") {
      setTip({ x: mx, y: my, type: "mothership", health: msHealth, risk: 0 });
    } else if (hit.type === "planet") {
      const pl = planets[hit.idx];
      setTip({ x: mx, y: my, type: "planet", cse: pl.cse, health: pl.health, risk: pl.risk });
    } else if ("vi" in hit && hit.vi !== undefined) {
      const m = planets[hit.idx].moons[hit.vi];
      setTip({ x: mx, y: my, type: "moon", project: m.project, health: m.health, risk: 0 });
    }
  }, [msHealth]);

  const onClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const hit = hitTest(mx, my, r.width, r.height);

    if (expRef.current !== null) {
      if (hit?.type === "moon" && "vi" in hit && hit.vi !== undefined) {
        router.push(`/projects/${planetsRef.current[hit.idx].moons[hit.vi].project.id}`);
        return;
      }
      expRef.current = null;
      setTip(null); hitKeyRef.current = "";
      return;
    }
    if (hit?.type === "mothership") {
      expRef.current = -1;
      setTip(null); hitKeyRef.current = "";
      return;
    }
    if (hit?.type === "planet") {
      expRef.current = hit.idx;
      setTip(null); hitKeyRef.current = "";
      return;
    }
    if (hit?.type === "moon" && "vi" in hit && hit.vi !== undefined) {
      router.push(`/projects/${planetsRef.current[hit.idx].moons[hit.vi].project.id}`);
    }
  }, [router]);

  /* ── JSX ────────────────────────────────────────────────────────── */

  if (fleet.length === 0) {
    return (
      <div className="w-full h-[900px] rounded-lg flex items-center justify-center"
        style={{ background: "#080c18", border: "1px solid rgba(201,162,39,0.1)" }}>
        <p className="text-sm" style={{ color: "#64748b" }}>No systems deployed</p>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative w-full h-[900px] rounded-lg overflow-hidden"
      style={{ border: "1px solid rgba(201,162,39,0.12)" }}>
      <canvas ref={canvasRef} onMouseMove={onMove} onClick={onClick}
        onMouseLeave={() => { setTip(null); hitKeyRef.current = ""; }} />

      {tip && (
        <div className="absolute pointer-events-none z-50"
          style={{ left: Math.min(tip.x + 16, (boxRef.current?.clientWidth ?? 400) - 270), top: tip.y - 10, maxWidth: 260 }}>
          <div className="rounded-lg p-3 text-xs shadow-xl"
            style={{ background: "rgba(8,14,28,0.95)", border: "1px solid rgba(201,162,39,0.15)", backdropFilter: "blur(12px)" }}>
            {tip.type === "mothership" && (() => {
              const delivered = fleet.reduce((s, f) => s + f.projects.filter(p => (p.engagementStage ?? 0) >= 6).length, 0);
              const tipStage = getStarStage(delivered);
              const nextStage = STAR_STAGES.find(st => st.minDelivered > delivered);
              return (
                <>
                  <p className="font-bold text-sm" style={{ color: GOLD }}>Admiral {admiralName}</p>
                  <p className="mt-0.5 font-semibold" style={{ color: tipStage.labelColor }}>✦ {tipStage.name}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                    <span style={{ color: "#94a3b8" }}>System Health</span>
                    <span style={{ color: tip.health > 0.7 ? "#22c55e" : "#f59e0b" }}>{Math.round(tip.health * 100)}%</span>
                    <span style={{ color: "#94a3b8" }}>Planets</span>
                    <span style={{ color: "#e2e8f0" }}>{stats.totalCSEs}</span>
                    <span style={{ color: "#94a3b8" }}>Delivered</span>
                    <span style={{ color: "#fbbf24" }}>{delivered}</span>
                    <span style={{ color: "#94a3b8" }}>Threats</span>
                    <span style={{ color: stats.totalBlockers > 0 ? "#ef4444" : "#22c55e" }}>{stats.totalBlockers}</span>
                  </div>
                  {nextStage && (
                    <p className="mt-1.5 text-[9px]" style={{ color: "#475569" }}>
                      Next: {nextStage.name} at {nextStage.minDelivered} delivered
                    </p>
                  )}
                  <p className="mt-1 text-[10px]" style={{ color: "#475569" }}>Click to inspect command</p>
                </>
              );
            })()}
            {tip.type === "planet" && tip.cse && (
              <>
                <p className="font-bold text-sm" style={{ color: "#e2e8f0" }}>{tip.cse.name}</p>
                <p className="mt-0.5" style={{ color: "#64748b" }}>{tip.cse.email}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                  <span style={{ color: "#94a3b8" }}>System Health</span>
                  <span style={{ color: tip.health > 0.7 ? "#22c55e" : tip.health > 0.4 ? "#f59e0b" : "#ef4444" }}>{Math.round(tip.health * 100)}%</span>
                  <span style={{ color: "#94a3b8" }}>Projects</span>
                  <span style={{ color: "#e2e8f0" }}>{tip.cse.projectCount}</span>
                  <span style={{ color: "#94a3b8" }}>Blockers</span>
                  <span style={{ color: tip.cse.activeBlockers > 0 ? "#ef4444" : "#22c55e" }}>{tip.cse.activeBlockers}</span>
                </div>
                <p className="mt-2 text-[10px]" style={{ color: "#475569" }}>Click to explore system</p>
              </>
            )}
            {tip.type === "moon" && tip.project && (() => {
              const stageNames = ["Intake", "Discovery", "Scoping", "Proof", "Implementation", "Validation", "Transition"];
              const stageColors = ["#64748b", "#f59e0b", "#3b82f6", "#8b5cf6", "#06b6d4", "#22c55e", "#10b981"];
              const sIdx = Math.min(tip.project.engagementStage ?? 0, 6);
              return (
                <>
                  <p className="font-bold text-sm" style={{ color: "#e2e8f0" }}>{tip.project.name}</p>
                  <p className="mt-0.5" style={{ color: "#64748b" }}>{tip.project.domain}</p>
                  <div className="flex items-center gap-0.5 mt-2 mb-1">
                    {stageNames.map((_, i) => (
                      <div key={i} className="h-1.5 flex-1 rounded-sm" style={{ background: i <= sIdx ? stageColors[i] : "rgba(255,255,255,0.08)" }} />
                    ))}
                  </div>
                  <p className="text-[10px] font-medium mb-2" style={{ color: stageColors[sIdx] || "#10b981" }}>
                    S{sIdx}: {stageNames[sIdx] || "Transition"}
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span style={{ color: "#94a3b8" }}>Health</span>
                    <span style={{ color: tip.health > 0.7 ? "#22c55e" : tip.health > 0.4 ? "#f59e0b" : "#ef4444" }}>{Math.round(tip.health * 100)}%</span>
                    <span style={{ color: "#94a3b8" }}>Phases</span>
                    <span style={{ color: "#06d6d6" }}>{tip.project.phaseCount}</span>
                    <span style={{ color: "#94a3b8" }}>Blockers</span>
                    <span style={{ color: tip.project.blockerCount > 0 ? "#ef4444" : "#22c55e" }}>{tip.project.blockerCount}</span>
                  </div>
                  <p className="mt-2 text-[10px]" style={{ color: "#475569" }}>Click to navigate</p>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
