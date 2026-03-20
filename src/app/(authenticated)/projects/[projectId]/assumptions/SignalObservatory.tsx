"use client";

import { useRef, useEffect, useState, useCallback } from "react";

/* ─── data shape from AssumptionsPanel ─── */
interface Assumption {
  id: string;
  phase: string;
  category: string;
  claim: string;
  confidence: string;
  status: string;
  evidenceIds: string[];
  blocksPhases: string[];
}

interface ObservatoryProps {
  assumptions: Assumption[];
  onSelect?: (id: string | null) => void;
  selectedId?: string | null;
  verifyTargetId?: string | null;
  onVerifyAnimComplete?: () => void;
}

/* ─── internal types ─── */
interface Star {
  id: string;
  x: number;
  y: number;
  radius: number;
  haloRadius: number;
  color: string;
  haloColor: string;
  brightness: number;
  phase: string;
  category: string;
  claim: string;
  confidence: string;
  status: string;
  evidenceCount: number;
  blocksCount: number;
  pulsePhase: number;
  twinkleSpeed: number;
  validated: boolean;
  rejected: boolean;
  collapseProgress: number;
  dysonProgress: number;
  dysonActive: boolean;
}

interface EvidenceBeam {
  fromX: number;
  fromY: number;
  toStarIdx: number;
  progress: number;
  alpha: number;
  color: string;
}

interface BackgroundStar {
  x: number;
  y: number;
  size: number;
  alpha: number;
  speed: number;
  phase: number;
}

interface Nebula {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rotation: number;
  color: string;
  alpha: number;
}

/* ─── constants ─── */
const STATUS_COLORS: Record<string, string> = {
  PENDING: "#fbbf24",
  VERIFIED: "#34d399",
  CORRECTED: "#60a5fa",
  REJECTED: "#f87171",
  AUTO_VERIFIED: "#a78bfa",
};

const CONFIDENCE_BRIGHTNESS: Record<string, number> = {
  High: 1.0,
  Medium: 0.6,
  Low: 0.3,
};

const PHASE_COLORS: Record<string, string> = {
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

export default function SignalObservatory({
  assumptions,
  onSelect,
  selectedId,
  verifyTargetId,
  onVerifyAnimComplete,
}: ObservatoryProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const starsRef = useRef<Star[]>([]);
  const beamsRef = useRef<EvidenceBeam[]>([]);
  const bgStarsRef = useRef<BackgroundStar[]>([]);
  const nebulaeRef = useRef<Nebula[]>([]);
  const timeRef = useRef(0);
  const mouseRef = useRef({ x: -999, y: -999 });
  const [hoveredStar, setHoveredStar] = useState<Star | null>(null);
  const [dims, setDims] = useState({ w: 900, h: 560 });
  const prevVerifyRef = useRef<string | null>(null);

  /* ─── Build star field from assumptions ─── */
  useEffect(() => {
    const { w, h } = dims;
    if (assumptions.length === 0) {
      starsRef.current = [];
      return;
    }

    const phaseSet = [...new Set(assumptions.map((a) => a.phase))];
    const phaseAngle = new Map<string, number>();
    phaseSet.forEach((p, i) => {
      phaseAngle.set(p, (i / phaseSet.length) * Math.PI * 2 - Math.PI / 2);
    });

    const cx = w / 2;
    const cy = h / 2;

    const stars: Star[] = assumptions.map((a, i) => {
      const baseAngle = phaseAngle.get(a.phase) ?? 0;
      const jitter = (i * 137.508 * Math.PI) / 180; // golden angle spread
      const ring = 0.25 + (i % 3) * 0.12 + Math.random() * 0.08;
      const angle = baseAngle + (jitter % (Math.PI * 0.4)) - Math.PI * 0.2;

      const brightness = CONFIDENCE_BRIGHTNESS[a.confidence] ?? 0.5;
      const isValidated = a.status === "VERIFIED" || a.status === "AUTO_VERIFIED";
      const isRejected = a.status === "REJECTED";
      const color = STATUS_COLORS[a.status] ?? "#fbbf24";
      const phaseColor = PHASE_COLORS[a.phase] ?? "#60a5fa";

      const baseRadius = brightness * 4 + 2;
      const haloRadius = baseRadius * (isValidated ? 5 : 3.5) + a.evidenceIds.length * 1.5;

      return {
        id: a.id,
        x: cx + Math.cos(angle) * (h * ring),
        y: cy + Math.sin(angle) * (h * ring * 0.75),
        radius: baseRadius,
        haloRadius,
        color,
        haloColor: phaseColor,
        brightness,
        phase: a.phase,
        category: a.category,
        claim: a.claim,
        confidence: a.confidence,
        status: a.status,
        evidenceCount: a.evidenceIds.length,
        blocksCount: a.blocksPhases.length,
        pulsePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.002 + Math.random() * 0.003,
        validated: isValidated,
        rejected: isRejected,
        collapseProgress: isRejected ? 1 : 0,
        dysonProgress: isValidated ? 1 : 0,
        dysonActive: false,
      };
    });

    starsRef.current = stars;

    // Background star field
    const bg: BackgroundStar[] = [];
    for (let i = 0; i < 200; i++) {
      bg.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: 0.3 + Math.random() * 1.2,
        alpha: 0.05 + Math.random() * 0.2,
        speed: 0.001 + Math.random() * 0.002,
        phase: Math.random() * Math.PI * 2,
      });
    }
    bgStarsRef.current = bg;

    // Nebulae (phase clusters)
    const neb: Nebula[] = phaseSet.map((p, i) => {
      const a = phaseAngle.get(p) ?? 0;
      const r = h * 0.35;
      return {
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r * 0.75,
        rx: 80 + Math.random() * 40,
        ry: 50 + Math.random() * 30,
        rotation: Math.random() * Math.PI,
        color: PHASE_COLORS[p] ?? "#60a5fa",
        alpha: 0.02 + (i % 2) * 0.01,
      };
    });
    nebulaeRef.current = neb;
  }, [assumptions, dims]);

  /* ─── Trigger Dyson sphere on verify ─── */
  useEffect(() => {
    if (verifyTargetId && verifyTargetId !== prevVerifyRef.current) {
      const star = starsRef.current.find((s) => s.id === verifyTargetId);
      if (star) {
        star.dysonActive = true;
        star.dysonProgress = 0;
      }
    }
    prevVerifyRef.current = verifyTargetId ?? null;
  }, [verifyTargetId]);

  /* ─── Canvas resize ─── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = Math.max(500, Math.min(620, rect.height || 560));
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

    const drawNebula = (ctx: CanvasRenderingContext2D, n: Nebula, t: number) => {
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.rotate(n.rotation + t * 0.0001);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, n.rx);
      grad.addColorStop(0, `${n.color}${Math.round(n.alpha * 255).toString(16).padStart(2, "0")}`);
      grad.addColorStop(0.5, `${n.color}${Math.round(n.alpha * 128).toString(16).padStart(2, "0")}`);
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, n.rx, n.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawStar = (
      ctx: CanvasRenderingContext2D,
      star: Star,
      t: number,
      hovered: boolean,
      selected: boolean,
    ) => {
      const twinkle = Math.sin(t * star.twinkleSpeed + star.pulsePhase);
      const effectiveBrightness = star.brightness * (0.8 + twinkle * 0.2);
      const r = star.radius * (hovered ? 1.3 : 1);

      // Collapse animation for rejected stars
      if (star.rejected) {
        const flicker = Math.sin(t * 0.03 + star.pulsePhase) * 0.5 + 0.5;
        const dimFactor = 0.15 + flicker * 0.15;
        drawStarBody(ctx, star, r * 0.6, dimFactor, hovered, selected);
        return;
      }

      // Confidence halo — grows with validation
      const haloR = star.haloRadius * (star.validated ? 1 + twinkle * 0.08 : 0.8 + twinkle * 0.05);
      const haloAlpha = effectiveBrightness * (star.validated ? 0.12 : 0.06) * (hovered ? 1.8 : 1);

      ctx.save();
      const haloGrad = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, haloR);
      haloGrad.addColorStop(0, `${star.haloColor}${Math.round(haloAlpha * 255).toString(16).padStart(2, "0")}`);
      haloGrad.addColorStop(0.4, `${star.haloColor}${Math.round(haloAlpha * 128).toString(16).padStart(2, "0")}`);
      haloGrad.addColorStop(1, "transparent");
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(star.x, star.y, haloR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Validated: sharper, brighter concentric rings
      if (star.validated) {
        for (let ring = 1; ring <= 2; ring++) {
          const ringR = r * (2 + ring * 1.5);
          ctx.save();
          ctx.beginPath();
          ctx.arc(star.x, star.y, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = `${star.color}${Math.round(effectiveBrightness * 15).toString(16).padStart(2, "0")}`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
          ctx.restore();
        }
      }

      drawStarBody(ctx, star, r, effectiveBrightness, hovered, selected);
    };

    const drawStarBody = (
      ctx: CanvasRenderingContext2D,
      star: Star,
      r: number,
      brightness: number,
      hovered: boolean,
      selected: boolean,
    ) => {
      ctx.save();

      // Outer glow
      const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, r * 2.5);
      glow.addColorStop(0, `${star.color}${Math.round(brightness * 40).toString(16).padStart(2, "0")}`);
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(star.x, star.y, r * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Core body
      const body = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, r);
      body.addColorStop(0, `${star.color}${Math.round(brightness * 220).toString(16).padStart(2, "0")}`);
      body.addColorStop(0.6, `${star.color}${Math.round(brightness * 120).toString(16).padStart(2, "0")}`);
      body.addColorStop(1, `${star.color}20`);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(star.x, star.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Bright center
      ctx.beginPath();
      ctx.arc(star.x, star.y, r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${brightness * 0.7})`;
      ctx.fill();

      // Selection ring
      if (selected || hovered) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, r + 6, 0, Math.PI * 2);
        ctx.strokeStyle = `${star.color}50`;
        ctx.lineWidth = selected ? 2 : 1;
        ctx.setLineDash(selected ? [] : [3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Cross-hair spikes for high confidence
      if (star.confidence === "High" && brightness > 0.5) {
        const spikeLen = r * 3;
        ctx.globalAlpha = brightness * 0.15;
        ctx.strokeStyle = star.color;
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(star.x + Math.cos(angle) * r * 1.2, star.y + Math.sin(angle) * r * 1.2);
          ctx.lineTo(star.x + Math.cos(angle) * spikeLen, star.y + Math.sin(angle) * spikeLen);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Label
      ctx.font = "8px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0.2, brightness * 0.5)})`;
      ctx.fillText(star.category.replace(/_/g, " "), star.x, star.y + r + 12);

      ctx.restore();
    };

    const drawDysonSphere = (
      ctx: CanvasRenderingContext2D,
      star: Star,
      t: number,
    ) => {
      const p = star.dysonProgress;
      if (p <= 0) return;

      const baseR = star.radius * 3.5 + 4;
      const ringCount = 3;
      const panelsPerRing = 8;
      // Construction phase: arcs grow; Activation phase: panels glow
      const constructPct = Math.min(p / 0.7, 1);
      const activatePct = p > 0.7 ? (p - 0.7) / 0.3 : 0;

      ctx.save();
      ctx.translate(star.x, star.y);

      for (let ri = 0; ri < ringCount; ri++) {
        const tilt = (ri / ringCount) * Math.PI;
        const rotSpeed = 0.003 + ri * 0.001;
        const ringRot = t * rotSpeed * (ri % 2 === 0 ? 1 : -1);
        const ringR = baseR + ri * 3;

        // How much of this ring is built
        const ringBuildDelay = ri * 0.2;
        const ringPct = Math.max(0, Math.min(1, (constructPct - ringBuildDelay) / (1 - ringBuildDelay)));
        if (ringPct <= 0) continue;

        const visiblePanels = Math.ceil(panelsPerRing * ringPct);

        for (let pi = 0; pi < visiblePanels; pi++) {
          const panelAngle = ringRot + (pi / panelsPerRing) * Math.PI * 2;
          const arcLen = (1 / panelsPerRing) * Math.PI * 2 * 0.75;

          // Project the 3D ring onto 2D using tilt
          const px1 = Math.cos(panelAngle) * ringR;
          const py1 = Math.sin(panelAngle) * ringR * Math.cos(tilt);
          const px2 = Math.cos(panelAngle + arcLen) * ringR;
          const py2 = Math.sin(panelAngle + arcLen) * ringR * Math.cos(tilt);

          // Depth factor for this panel (panels behind the star are dimmer)
          const depth = Math.sin(panelAngle) * Math.sin(tilt);
          const depthAlpha = 0.3 + (depth + 1) * 0.35;

          // Panel arc
          ctx.beginPath();
          const startA = panelAngle;
          const endA = panelAngle + arcLen;
          // Draw as elliptical arc
          ctx.ellipse(0, 0, ringR, ringR * Math.abs(Math.cos(tilt)), 0, startA, endA);

          // Panel color: structural gray during construction, green energy glow when activated
          const structAlpha = depthAlpha * (0.3 + activatePct * 0.4);
          if (activatePct > 0) {
            const energyPulse = Math.sin(t * 0.015 + pi * 0.8 + ri * 2) * 0.15 + 0.85;
            ctx.strokeStyle = `rgba(52,211,153,${(structAlpha * energyPulse).toFixed(3)})`;
            ctx.lineWidth = 2.5;
          } else {
            ctx.strokeStyle = `rgba(160,170,190,${structAlpha.toFixed(3)})`;
            ctx.lineWidth = 1.5;
          }
          ctx.stroke();

          // Panel surface (thin filled area along arc)
          if (activatePct > 0) {
            ctx.beginPath();
            ctx.ellipse(0, 0, ringR - 1, (ringR - 1) * Math.abs(Math.cos(tilt)), 0, startA, endA);
            ctx.ellipse(0, 0, ringR + 1, (ringR + 1) * Math.abs(Math.cos(tilt)), 0, endA, startA, true);
            ctx.closePath();
            const panelFill = `rgba(52,211,153,${(depthAlpha * activatePct * 0.1).toFixed(3)})`;
            ctx.fillStyle = panelFill;
            ctx.fill();
          }

          // Construction sparks during building phase
          if (constructPct < 1 && pi === visiblePanels - 1) {
            const sparkX = px2;
            const sparkY = py2;
            const sparkFlicker = Math.sin(t * 0.15 + ri) > 0;
            if (sparkFlicker) {
              ctx.beginPath();
              ctx.arc(sparkX, sparkY, 1.5, 0, Math.PI * 2);
              ctx.fillStyle = "rgba(255,220,100,0.7)";
              ctx.fill();
              // Spark glow
              const sg = ctx.createRadialGradient(sparkX, sparkY, 0, sparkX, sparkY, 6);
              sg.addColorStop(0, "rgba(255,220,100,0.2)");
              sg.addColorStop(1, "transparent");
              ctx.fillStyle = sg;
              ctx.beginPath();
              ctx.arc(sparkX, sparkY, 6, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Structural nodes at panel junctions
          if (activatePct > 0.5) {
            ctx.beginPath();
            ctx.arc(px1, py1, 1, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(52,211,153,${(depthAlpha * 0.5).toFixed(2)})`;
            ctx.fill();
          }
        }
      }

      // Energy collection glow between sphere and star (when activated)
      if (activatePct > 0) {
        const energyR = baseR * 0.8;
        const energyPulse = 0.5 + Math.sin(t * 0.01) * 0.2;
        const eg = ctx.createRadialGradient(0, 0, star.radius, 0, 0, energyR);
        eg.addColorStop(0, `rgba(52,211,153,${(activatePct * 0.06 * energyPulse).toFixed(3)})`);
        eg.addColorStop(0.5, `rgba(52,211,153,${(activatePct * 0.03 * energyPulse).toFixed(3)})`);
        eg.addColorStop(1, "transparent");
        ctx.fillStyle = eg;
        ctx.beginPath();
        ctx.arc(0, 0, energyR, 0, Math.PI * 2);
        ctx.fill();
      }

      // "HARNESSED" label when complete
      if (p >= 1) {
        ctx.font = "bold 6px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(52,211,153,${0.3 + Math.sin(t * 0.01) * 0.1})`;
        ctx.fillText("HARNESSED", 0, baseR + 14);
      }

      ctx.restore();
    };

    const drawEvidenceBeam = (ctx: CanvasRenderingContext2D, beam: EvidenceBeam, stars: Star[]) => {
      const target = stars[beam.toStarIdx];
      if (!target) return;

      const dx = target.x - beam.fromX;
      const dy = target.y - beam.fromY;
      const currentX = beam.fromX + dx * beam.progress;
      const currentY = beam.fromY + dy * beam.progress;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(beam.fromX, beam.fromY);
      ctx.lineTo(currentX, currentY);
      const grad = ctx.createLinearGradient(beam.fromX, beam.fromY, currentX, currentY);
      grad.addColorStop(0, "transparent");
      grad.addColorStop(0.8, `${beam.color}${Math.round(beam.alpha * 80).toString(16).padStart(2, "0")}`);
      grad.addColorStop(1, `${beam.color}${Math.round(beam.alpha * 160).toString(16).padStart(2, "0")}`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Beam tip glow
      const tipGlow = ctx.createRadialGradient(currentX, currentY, 0, currentX, currentY, 6);
      tipGlow.addColorStop(0, `${beam.color}${Math.round(beam.alpha * 200).toString(16).padStart(2, "0")}`);
      tipGlow.addColorStop(1, "transparent");
      ctx.fillStyle = tipGlow;
      ctx.beginPath();
      ctx.arc(currentX, currentY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const frame = () => {
      const dpr = window.devicePixelRatio || 1;
      const { w, h } = dims;
      timeRef.current++;
      const t = timeRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Deep space background
      const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
      bgGrad.addColorStop(0, "#080c18");
      bgGrad.addColorStop(0.5, "#060a14");
      bgGrad.addColorStop(1, "#040610");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Background stars (twinkling)
      for (const bs of bgStarsRef.current) {
        const alpha = bs.alpha * (0.5 + Math.sin(t * bs.speed + bs.phase) * 0.5);
        ctx.save();
        ctx.beginPath();
        ctx.arc(bs.x, bs.y, bs.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 210, 255, ${alpha})`;
        ctx.fill();
        ctx.restore();
      }

      // Nebulae
      for (const neb of nebulaeRef.current) {
        drawNebula(ctx, neb, t);
      }

      // Telescope aperture ring (subtle)
      const aperR = Math.min(w, h) * 0.46;
      ctx.save();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, aperR, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.02)";
      ctx.lineWidth = 1;
      ctx.stroke();
      // Crosshair
      ctx.beginPath();
      ctx.moveTo(w / 2 - aperR * 0.15, h / 2);
      ctx.lineTo(w / 2 + aperR * 0.15, h / 2);
      ctx.moveTo(w / 2, h / 2 - aperR * 0.15);
      ctx.lineTo(w / 2, h / 2 + aperR * 0.15);
      ctx.strokeStyle = "rgba(255,255,255,0.015)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.restore();

      // Phase cluster labels (around perimeter)
      const phases = [...new Set(starsRef.current.map((s) => s.phase))];
      ctx.save();
      ctx.font = "bold 8px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      for (let i = 0; i < phases.length; i++) {
        const angle = (i / phases.length) * Math.PI * 2 - Math.PI / 2;
        const labelR = Math.min(w, h) * 0.47;
        const lx = w / 2 + Math.cos(angle) * labelR;
        const ly = h / 2 + Math.sin(angle) * labelR * 0.75;
        const phaseColor = PHASE_COLORS[phases[i]] ?? "#60a5fa";
        ctx.fillStyle = `${phaseColor}60`;
        ctx.fillText(
          phases[i].replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
          lx,
          ly,
        );
      }
      ctx.restore();

      // Evidence beams
      const beams = beamsRef.current;
      for (let i = beams.length - 1; i >= 0; i--) {
        beams[i].progress += 0.015;
        beams[i].alpha = Math.max(0, 1 - beams[i].progress * 0.8);
        if (beams[i].progress > 1.3) {
          beams.splice(i, 1);
          continue;
        }
        drawEvidenceBeam(ctx, beams[i], starsRef.current);
      }

      // Spawn new beams periodically
      if (t % 90 === 0 && starsRef.current.length > 0) {
        const starsWithEvidence = starsRef.current
          .map((s, i) => ({ s, i }))
          .filter((x) => x.s.evidenceCount > 0 && !x.s.rejected);
        if (starsWithEvidence.length > 0) {
          const target = starsWithEvidence[Math.floor(Math.random() * starsWithEvidence.length)];
          const edge = Math.floor(Math.random() * 4);
          let fx: number, fy: number;
          switch (edge) {
            case 0: fx = Math.random() * w; fy = 0; break;
            case 1: fx = w; fy = Math.random() * h; break;
            case 2: fx = Math.random() * w; fy = h; break;
            default: fx = 0; fy = Math.random() * h; break;
          }
          beamsRef.current.push({
            fromX: fx,
            fromY: fy,
            toStarIdx: target.i,
            progress: 0,
            alpha: 1,
            color: target.s.haloColor,
          });
        }
      }

      // Stars
      const stars = starsRef.current;
      let foundHover: Star | null = null;
      for (const star of stars) {
        // Advance Dyson sphere construction
        if (star.dysonActive && star.dysonProgress < 1) {
          star.dysonProgress = Math.min(1, star.dysonProgress + 0.004);
          if (star.dysonProgress >= 1) {
            star.dysonActive = false;
            star.validated = true;
            onVerifyAnimComplete?.();
          }
        }

        const dist = Math.hypot(mouseRef.current.x - star.x, mouseRef.current.y - star.y);
        const isHovered = dist < star.radius * 4;
        const isSelected = star.id === selectedId;
        if (isHovered) foundHover = star;
        drawStar(ctx, star, t, isHovered, isSelected);

        // Draw Dyson sphere on top of the star
        if (star.dysonProgress > 0) {
          drawDysonSphere(ctx, star, t);
        }
      }

      if (foundHover !== hoveredStar) {
        setHoveredStar(foundHover);
      }

      // Validation pulse (periodically on verified stars)
      if (t % 200 === 0) {
        const verified = stars.filter((s) => s.validated);
        if (verified.length > 0) {
          const s = verified[Math.floor(Math.random() * verified.length)];
          // Temporary brightness spike handled by twinkle
          s.pulsePhase = t * s.twinkleSpeed;
        }
      }

      // Legend
      ctx.save();
      ctx.font = "8px Inter, system-ui, sans-serif";
      const legendItems = [
        { label: "PENDING", color: STATUS_COLORS.PENDING },
        { label: "VERIFIED", color: STATUS_COLORS.VERIFIED },
        { label: "CORRECTED", color: STATUS_COLORS.CORRECTED },
        { label: "REJECTED", color: STATUS_COLORS.REJECTED },
        { label: "AUTO", color: STATUS_COLORS.AUTO_VERIFIED },
      ];
      let lx = 12;
      for (const item of legendItems) {
        ctx.beginPath();
        ctx.arc(lx + 4, h - 14, 3, 0, Math.PI * 2);
        ctx.fillStyle = item.color;
        ctx.fill();
        ctx.fillStyle = `${item.color}80`;
        ctx.fillText(item.label, lx + 10, h - 11);
        lx += ctx.measureText(item.label).width + 20;
      }
      ctx.restore();

      // Stats
      ctx.save();
      ctx.font = "bold 9px Inter, system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      const verified = stars.filter((s) => s.validated).length;
      const pending = stars.filter((s) => s.status === "PENDING").length;
      ctx.fillText(`${verified} VERIFIED · ${pending} PENDING · ${stars.length} TOTAL`, w - 12, h - 12);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims, selectedId, onVerifyAnimComplete]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const clicked = starsRef.current.find(
        (s) => Math.hypot(mx - s.x, my - s.y) < s.radius * 4,
      );
      onSelect?.(clicked?.id ?? null);
    },
    [onSelect],
  );

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden"
      style={{ border: "1px solid rgba(139, 92, 246, 0.1)" }}
    >
      <canvas
        ref={canvasRef}
        className="w-full cursor-crosshair"
        style={{ height: 560 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          mouseRef.current = { x: -999, y: -999 };
          setHoveredStar(null);
        }}
        onClick={handleClick}
      />

      {/* Hover tooltip */}
      {hoveredStar && (
        <div
          className="absolute pointer-events-none rounded-lg px-3 py-2.5 z-10 max-w-[260px]"
          style={{
            left: Math.min(hoveredStar.x + 20, dims.w - 280),
            top: Math.max(10, hoveredStar.y - 90),
            background: "rgba(8, 12, 24, 0.95)",
            border: `1px solid ${hoveredStar.color}30`,
            backdropFilter: "blur(12px)",
          }}
        >
          <p
            className="text-[11px] font-bold leading-snug"
            style={{ color: hoveredStar.color }}
          >
            {hoveredStar.claim.length > 80
              ? hoveredStar.claim.slice(0, 78) + "…"
              : hoveredStar.claim}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className="text-[9px] px-1.5 py-0.5 rounded font-medium"
              style={{
                background: `${hoveredStar.color}15`,
                color: hoveredStar.color,
              }}
            >
              {hoveredStar.status}
            </span>
            <span
              className="text-[9px]"
              style={{ color: `${hoveredStar.haloColor}90` }}
            >
              {hoveredStar.phase.replace(/_/g, " ")}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[8px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              {hoveredStar.category.replace(/_/g, " ")}
            </span>
            <span
              className="text-[8px] font-medium"
              style={{
                color:
                  hoveredStar.confidence === "High"
                    ? "#34d399"
                    : hoveredStar.confidence === "Medium"
                      ? "#fbbf24"
                      : "rgba(255,255,255,0.3)",
              }}
            >
              {hoveredStar.confidence} confidence
            </span>
          </div>
          {hoveredStar.evidenceCount > 0 && (
            <p
              className="text-[8px] mt-1"
              style={{ color: "rgba(255,255,255,0.25)" }}
            >
              {hoveredStar.evidenceCount} evidence signal
              {hoveredStar.evidenceCount > 1 ? "s" : ""}
            </p>
          )}
          {hoveredStar.blocksCount > 0 && (
            <p
              className="text-[8px]"
              style={{ color: "rgba(239,68,68,0.5)" }}
            >
              Blocks {hoveredStar.blocksCount} downstream phase
              {hoveredStar.blocksCount > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {assumptions.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p
              className="text-sm font-medium"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              Observatory quiet
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: "rgba(255,255,255,0.25)" }}
            >
              Run the pipeline to detect assumption signals
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
