"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface BlockerData {
  id: string;
  title: string;
  severity: string;
  status: string;
  impactScore: number;
  domain: string;
  missileCount: number;
  nukeCount: number;
  blockedPhases: string[];
}

interface ImpactFieldProps {
  blockers: BlockerData[];
  overallRiskScore: number;
  nukeTargetId: string | null;
  onNukeComplete?: () => void;
  onShootNuke?: (blockerId: string) => void;
}

interface Asteroid {
  id: string;
  x: number;
  y: number;
  radius: number;
  rotation: number;
  rotationSpeed: number;
  shape: number[];
  severity: string;
  color: string;
  title: string;
  status: string;
  domain: string;
  impactScore: number;
  missileCount: number;
  nukeCount: number;
  blockedPhases: string[];
  wobble: number;
  destroyed: boolean;
}

interface NukeFlight {
  targetId: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  progress: number;
  phase: "launch" | "flight" | "impact" | "done";
  impactTimer: number;
}

interface Debris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  rotSpeed: number;
  life: number;
  maxLife: number;
  color: string;
}

interface ExplosionRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  twinkle: number;
  hue: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f59e0b",
  MEDIUM: "#3b82f6",
  LOW: "#10b981",
};

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function generateAsteroidShape(seed: number, vertices: number): number[] {
  const shape: number[] = [];
  for (let i = 0; i < vertices; i++) {
    shape.push(0.7 + seededRandom(seed * 13 + i * 7) * 0.6);
  }
  return shape;
}

export default function ImpactFieldView({
  blockers,
  overallRiskScore,
  nukeTargetId,
  onNukeComplete,
  onShootNuke,
}: ImpactFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const timeRef = useRef(0);
  const asteroidsRef = useRef<Asteroid[]>([]);
  const starsRef = useRef<Star[]>([]);
  const nukeRef = useRef<NukeFlight | null>(null);
  const debrisRef = useRef<Debris[]>([]);
  const ringsRef = useRef<ExplosionRing[]>([]);
  const flashRef = useRef(0);
  const [dimensions, setDimensions] = useState({ w: 900, h: 520 });
  const [hoveredAsteroid, setHoveredAsteroid] = useState<Asteroid | null>(null);
  const [siloMenuOpen, setSiloMenuOpen] = useState(false);
  const mouseRef = useRef({ x: -999, y: -999 });
  const prevNukeTarget = useRef<string | null>(null);

  const armedBlockers = blockers.filter((b) => b.status === "NUKE_ARMED" && b.nukeCount > 0);
  const siloReady = !nukeRef.current && armedBlockers.length > 0;

  // Build asteroid positions from blockers
  useEffect(() => {
    const { w, h } = dimensions;
    if (blockers.length === 0) {
      asteroidsRef.current = [];
      return;
    }

    const padding = 90;
    const siloH = 60;
    const usableH = h - padding - siloH;
    const cols = Math.ceil(Math.sqrt(blockers.length * 1.6));
    const cellW = (w - padding * 2) / cols;
    const cellH = usableH / Math.ceil(blockers.length / cols);

    const existingMap = new Map<string, Asteroid>();
    for (const a of asteroidsRef.current) existingMap.set(a.id, a);

    const asteroids: Asteroid[] = blockers.map((b, i) => {
      const existing = existingMap.get(b.id);
      if (existing) {
        existing.status = b.status;
        existing.title = b.title;
        existing.impactScore = b.impactScore;
        existing.missileCount = b.missileCount;
        existing.nukeCount = b.nukeCount;
        return existing;
      }

      const col = i % cols;
      const row = Math.floor(i / cols);
      const sevRadius = b.severity === "CRITICAL" ? 32 : b.severity === "HIGH" ? 26 : b.severity === "MEDIUM" ? 21 : 16;
      const radius = sevRadius * (0.75 + (b.impactScore / 100) * 0.5);
      const color = SEVERITY_COLORS[b.severity] || "#3b82f6";

      const seed = b.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const shape = generateAsteroidShape(seed, 10 + Math.floor(seededRandom(seed) * 4));

      return {
        id: b.id,
        x: padding + col * cellW + cellW / 2 + (seededRandom(seed + 1) - 0.5) * 30,
        y: padding * 0.6 + row * cellH + cellH / 2 + (seededRandom(seed + 2) - 0.5) * 20,
        radius,
        rotation: seededRandom(seed + 3) * Math.PI * 2,
        rotationSpeed: (seededRandom(seed + 4) - 0.5) * 0.003,
        shape,
        severity: b.severity,
        color,
        title: b.title,
        status: b.status,
        domain: b.domain,
        impactScore: b.impactScore,
        missileCount: b.missileCount,
        nukeCount: b.nukeCount,
        blockedPhases: Array.isArray(b.blockedPhases) ? b.blockedPhases : [],
        wobble: seededRandom(seed + 5) * Math.PI * 2,
        destroyed: false,
      };
    });

    asteroidsRef.current = asteroids;
  }, [blockers, dimensions]);

  // Stars
  useEffect(() => {
    const { w, h } = dimensions;
    const stars: Star[] = [];
    for (let i = 0; i < 180; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: 0.2 + Math.pow(Math.random(), 3) * 1.8,
        twinkle: Math.random() * Math.PI * 2,
        hue: 190 + Math.random() * 50,
      });
    }
    starsRef.current = stars;
  }, [dimensions]);

  // Trigger nuke on nukeTargetId change
  useEffect(() => {
    if (nukeTargetId && nukeTargetId !== prevNukeTarget.current) {
      const target = asteroidsRef.current.find((a) => a.id === nukeTargetId);
      if (target && !target.destroyed) {
        const { w, h } = dimensions;
        nukeRef.current = {
          targetId: nukeTargetId,
          x: w * 0.5,
          y: h - 30,
          targetX: target.x,
          targetY: target.y,
          progress: 0,
          phase: "launch",
          impactTimer: 0,
        };
      }
    }
    prevNukeTarget.current = nukeTargetId;
  }, [nukeTargetId, dimensions]);

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

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawAsteroid = (
      ctx: CanvasRenderingContext2D,
      a: Asteroid,
      t: number,
      hovered: boolean,
    ) => {
      if (a.destroyed) return;
      const isNeutralized = a.status === "NEUTRALIZED" || a.status === "ACCEPTED" || a.status === "DORMANT";
      const alpha = isNeutralized ? 0.2 : 1;

      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rotation);
      ctx.globalAlpha = alpha;

      // Outer glow
      if (!isNeutralized) {
        const glow = ctx.createRadialGradient(0, 0, a.radius * 0.5, 0, 0, a.radius * (hovered ? 2.8 : 2));
        glow.addColorStop(0, `${a.color}15`);
        glow.addColorStop(0.5, `${a.color}08`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, a.radius * (hovered ? 2.8 : 2), 0, Math.PI * 2);
        ctx.fill();
      }

      // Rocky body
      ctx.beginPath();
      const verts = a.shape.length;
      for (let i = 0; i <= verts; i++) {
        const angle = (i / verts) * Math.PI * 2;
        const r = a.radius * a.shape[i % verts];
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      // Gradient fill
      const bodyGrad = ctx.createRadialGradient(
        -a.radius * 0.2, -a.radius * 0.2, 0,
        a.radius * 0.1, a.radius * 0.1, a.radius,
      );
      if (isNeutralized) {
        bodyGrad.addColorStop(0, "#505058");
        bodyGrad.addColorStop(0.5, "#383840");
        bodyGrad.addColorStop(1, "#252530");
      } else {
        bodyGrad.addColorStop(0, "#706868");
        bodyGrad.addColorStop(0.3, "#504848");
        bodyGrad.addColorStop(0.7, "#383038");
        bodyGrad.addColorStop(1, "#201820");
      }
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      // Severity-colored veins/fissures
      if (!isNeutralized) {
        const fissureCount = a.severity === "CRITICAL" ? 5 : a.severity === "HIGH" ? 3 : 2;
        for (let fi = 0; fi < fissureCount; fi++) {
          const fAngle = (fi / fissureCount) * Math.PI * 2 + t * 0.0005;
          const fR1 = a.radius * 0.2;
          const fR2 = a.radius * (0.6 + seededRandom(fi * 17 + 99) * 0.3);
          ctx.beginPath();
          ctx.moveTo(Math.cos(fAngle) * fR1, Math.sin(fAngle) * fR1);
          const midA = fAngle + (seededRandom(fi * 23 + 77) - 0.5) * 0.3;
          ctx.quadraticCurveTo(
            Math.cos(midA) * fR2 * 0.7, Math.sin(midA) * fR2 * 0.7,
            Math.cos(fAngle + 0.15) * fR2, Math.sin(fAngle + 0.15) * fR2,
          );
          const pulse = 0.15 + Math.sin(t * 0.008 + fi * 2) * 0.08;
          ctx.strokeStyle = a.color;
          ctx.globalAlpha = alpha * pulse;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.globalAlpha = alpha;
        }
      }

      // Surface craters
      for (let ci = 0; ci < 4; ci++) {
        const ca = seededRandom(ci * 31 + a.shape.length) * Math.PI * 2;
        const cd = seededRandom(ci * 37 + a.shape.length) * a.radius * 0.5;
        const cr = a.radius * 0.08 + seededRandom(ci * 41 + a.shape.length) * a.radius * 0.1;
        ctx.beginPath();
        ctx.arc(Math.cos(ca) * cd, Math.sin(ca) * cd, cr, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.fill();
      }

      // Highlight rim
      ctx.beginPath();
      ctx.arc(-a.radius * 0.15, -a.radius * 0.15, a.radius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fill();

      ctx.globalAlpha = 1;

      // Hover highlight ring
      if (hovered && !isNeutralized) {
        ctx.beginPath();
        ctx.arc(0, 0, a.radius * 1.3, 0, Math.PI * 2);
        ctx.strokeStyle = `${a.color}40`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();

      // Labels below asteroid
      ctx.save();
      ctx.globalAlpha = isNeutralized ? 0.25 : 0.7;
      ctx.font = "9px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = isNeutralized ? "rgba(200,200,210,0.5)" : a.color;
      const truncTitle = a.title.length > 20 ? a.title.slice(0, 18) + "…" : a.title;
      ctx.fillText(truncTitle, a.x, a.y + a.radius + 16);
      ctx.font = "bold 7px Inter, system-ui, sans-serif";
      ctx.fillText(`${a.impactScore}`, a.x, a.y + a.radius + 26);
      ctx.globalAlpha = 1;
      ctx.restore();
    };

    const frame = () => {
      const dpr = window.devicePixelRatio || 1;
      const { w, h } = dimensions;
      timeRef.current++;
      const t = timeRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // ===== BACKGROUND =====
      const bg = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, w * 0.7);
      bg.addColorStop(0, "#0a0e1a");
      bg.addColorStop(0.5, "#060a14");
      bg.addColorStop(1, "#030508");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Stars
      for (const star of starsRef.current) {
        const a = 0.15 + Math.sin(t * 0.008 + star.twinkle) * 0.1;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${star.hue},20%,80%,${a})`;
        ctx.fill();
      }

      // ===== LAUNCH SILO at bottom =====
      const siloX = w * 0.5;
      const siloY = h - 20;
      const siloW = 24;
      const siloH = 18;

      // Silo body
      ctx.fillStyle = "rgba(80,80,95,0.3)";
      ctx.fillRect(siloX - siloW / 2, siloY - siloH, siloW, siloH);
      ctx.strokeStyle = "rgba(120,120,140,0.2)";
      ctx.lineWidth = 0.8;
      ctx.strokeRect(siloX - siloW / 2, siloY - siloH, siloW, siloH);

      // Silo opening
      ctx.fillStyle = "rgba(20,20,30,0.6)";
      ctx.fillRect(siloX - 4, siloY - siloH, 8, 3);

      // Silo label
      ctx.font = "bold 7px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(239,68,68,0.3)";
      ctx.fillText("SILO", siloX, siloY + 10);

      // Ready light
      const siloReady = !nukeRef.current;
      const blinkOn = Math.sin(t * 0.05) > 0;
      ctx.beginPath();
      ctx.arc(siloX + siloW / 2 + 6, siloY - siloH / 2, 2, 0, Math.PI * 2);
      ctx.fillStyle = siloReady
        ? (blinkOn ? "rgba(52,211,153,0.8)" : "rgba(52,211,153,0.3)")
        : "rgba(239,68,68,0.6)";
      ctx.fill();

      // ===== ASTEROIDS =====
      const asteroids = asteroidsRef.current;
      let foundHover: Asteroid | null = null;

      for (const a of asteroids) {
        // Slowly rotate and wobble
        a.rotation += a.rotationSpeed;
        a.x += Math.sin(t * 0.003 + a.wobble) * 0.08;
        a.y += Math.cos(t * 0.002 + a.wobble * 1.3) * 0.05;

        const dist = Math.hypot(mouseRef.current.x - a.x, mouseRef.current.y - a.y);
        const hovered = dist < a.radius * 1.5;
        if (hovered && !a.destroyed) foundHover = a;

        drawAsteroid(ctx, a, t, hovered);
      }

      if (foundHover !== hoveredAsteroid) setHoveredAsteroid(foundHover);

      // ===== NUKE FLIGHT =====
      const nuke = nukeRef.current;
      if (nuke) {
        if (nuke.phase === "launch") {
          nuke.progress += 0.012;
          // Eased flight path
          const eased = 1 - Math.pow(1 - nuke.progress, 3);
          nuke.x = nuke.x + (nuke.targetX - nuke.x) * 0.02;
          nuke.y = siloY - eased * (siloY - nuke.targetY);

          if (nuke.progress >= 0.15) nuke.phase = "flight";
        }

        if (nuke.phase === "flight") {
          nuke.progress += 0.012;
          const eased = 1 - Math.pow(1 - nuke.progress, 2.5);
          nuke.x = siloX + (nuke.targetX - siloX) * eased;
          nuke.y = siloY + (nuke.targetY - siloY) * eased;

          if (nuke.progress >= 1) {
            nuke.phase = "impact";
            nuke.impactTimer = 0;
            flashRef.current = 1;

            // Spawn debris
            const target = asteroids.find((a) => a.id === nuke.targetId);
            if (target) {
              target.destroyed = true;
              const chunkCount = 12 + Math.floor(Math.random() * 8);
              for (let di = 0; di < chunkCount; di++) {
                const angle = (di / chunkCount) * Math.PI * 2 + Math.random() * 0.5;
                const speed = 1.5 + Math.random() * 3;
                debrisRef.current.push({
                  x: target.x,
                  y: target.y,
                  vx: Math.cos(angle) * speed,
                  vy: Math.sin(angle) * speed,
                  size: 2 + Math.random() * 5,
                  rotation: Math.random() * Math.PI * 2,
                  rotSpeed: (Math.random() - 0.5) * 0.2,
                  life: 80 + Math.floor(Math.random() * 60),
                  maxLife: 140,
                  color: target.color,
                });
              }

              // Explosion rings
              for (let ri = 0; ri < 3; ri++) {
                ringsRef.current.push({
                  x: target.x,
                  y: target.y,
                  radius: target.radius * 0.5 + ri * 5,
                  maxRadius: target.radius * 4 + ri * 40,
                  alpha: 0.6 - ri * 0.15,
                });
              }
            }
          }
        }

        if (nuke.phase === "impact") {
          nuke.impactTimer++;
          if (nuke.impactTimer > 120) {
            nuke.phase = "done";
            onNukeComplete?.();
          }
        }

        if (nuke.phase === "done") {
          nukeRef.current = null;
        }

        // Draw nuke missile (only during launch/flight)
        if (nuke && (nuke.phase === "launch" || nuke.phase === "flight")) {
          const nx = nuke.x;
          const ny = nuke.y;
          const angle = Math.atan2(nuke.targetY - ny, nuke.targetX - nx);

          // Engine exhaust trail
          const trailLen = 15 + Math.sin(t * 0.15) * 5;
          for (let ti = 0; ti < 3; ti++) {
            const spread = (ti - 1) * 0.12;
            const ta = angle + Math.PI + spread;
            const tx1 = nx + Math.cos(ta) * 6;
            const ty1 = ny + Math.sin(ta) * 6;
            const tx2 = nx + Math.cos(ta) * (6 + trailLen - ti * 3);
            const ty2 = ny + Math.sin(ta) * (6 + trailLen - ti * 3);

            const tg = ctx.createLinearGradient(tx1, ty1, tx2, ty2);
            tg.addColorStop(0, `rgba(255,100,30,${0.7 - ti * 0.15})`);
            tg.addColorStop(0.4, `rgba(255,60,10,${0.4 - ti * 0.1})`);
            tg.addColorStop(1, "transparent");
            ctx.beginPath();
            ctx.moveTo(tx1, ty1);
            ctx.lineTo(tx2, ty2);
            ctx.strokeStyle = tg;
            ctx.lineWidth = 3 - ti * 0.8;
            ctx.stroke();
          }

          // Engine glow
          const eglow = ctx.createRadialGradient(
            nx + Math.cos(angle + Math.PI) * 6,
            ny + Math.sin(angle + Math.PI) * 6,
            0,
            nx + Math.cos(angle + Math.PI) * 6,
            ny + Math.sin(angle + Math.PI) * 6,
            12,
          );
          eglow.addColorStop(0, "rgba(255,140,40,0.4)");
          eglow.addColorStop(1, "transparent");
          ctx.fillStyle = eglow;
          ctx.beginPath();
          ctx.arc(
            nx + Math.cos(angle + Math.PI) * 6,
            ny + Math.sin(angle + Math.PI) * 6,
            12, 0, Math.PI * 2,
          );
          ctx.fill();

          // Warhead
          ctx.save();
          ctx.translate(nx, ny);
          ctx.rotate(angle);
          // Missile body
          ctx.beginPath();
          ctx.moveTo(8, 0);
          ctx.lineTo(-4, -3.5);
          ctx.lineTo(-6, -3.5);
          ctx.lineTo(-6, 3.5);
          ctx.lineTo(-4, 3.5);
          ctx.closePath();
          const mGrad = ctx.createLinearGradient(-6, 0, 8, 0);
          mGrad.addColorStop(0, "#888");
          mGrad.addColorStop(0.3, "#bbb");
          mGrad.addColorStop(0.7, "#ef4444");
          mGrad.addColorStop(1, "#dc2626");
          ctx.fillStyle = mGrad;
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.2)";
          ctx.lineWidth = 0.5;
          ctx.stroke();
          // Fins
          ctx.beginPath();
          ctx.moveTo(-5, -3.5);
          ctx.lineTo(-8, -6);
          ctx.lineTo(-6, -3.5);
          ctx.fillStyle = "#666";
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(-5, 3.5);
          ctx.lineTo(-8, 6);
          ctx.lineTo(-6, 3.5);
          ctx.fill();
          // Nuclear symbol dot
          ctx.beginPath();
          ctx.arc(1, 0, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,200,50,0.8)";
          ctx.fill();
          ctx.restore();

          // Smoke particles near silo
          if (nuke.phase === "launch") {
            for (let si = 0; si < 2; si++) {
              const sx = siloX + (Math.random() - 0.5) * 20;
              const sy = siloY - 10 - Math.random() * 10;
              ctx.beginPath();
              ctx.arc(sx, sy, 2 + Math.random() * 4, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(180,180,200,${0.05 + Math.random() * 0.05})`;
              ctx.fill();
            }
          }
        }
      }

      // ===== EXPLOSION FLASH =====
      if (flashRef.current > 0) {
        ctx.fillStyle = `rgba(255,255,240,${flashRef.current * 0.3})`;
        ctx.fillRect(0, 0, w, h);
        flashRef.current *= 0.92;
        if (flashRef.current < 0.01) flashRef.current = 0;
      }

      // ===== EXPLOSION RINGS =====
      const rings = ringsRef.current;
      for (let ri = rings.length - 1; ri >= 0; ri--) {
        const ring = rings[ri];
        ring.radius += 1.8;
        ring.alpha *= 0.975;
        if (ring.radius > ring.maxRadius || ring.alpha < 0.01) {
          rings.splice(ri, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,140,40,${ring.alpha.toFixed(3)})`;
        ctx.lineWidth = 2.5 * ring.alpha;
        ctx.stroke();
      }

      // ===== DEBRIS =====
      const debris = debrisRef.current;
      for (let di = debris.length - 1; di >= 0; di--) {
        const d = debris[di];
        d.x += d.vx;
        d.y += d.vy;
        d.vx *= 0.985;
        d.vy *= 0.985;
        d.vy += 0.01;
        d.rotation += d.rotSpeed;
        d.life--;
        if (d.life <= 0) { debris.splice(di, 1); continue; }
        const alpha = Math.min(1, d.life / (d.maxLife * 0.3));

        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.rotation);
        ctx.globalAlpha = alpha * 0.8;

        // Rocky chunk
        ctx.beginPath();
        const chunkVerts = 5;
        for (let v = 0; v <= chunkVerts; v++) {
          const a = (v / chunkVerts) * Math.PI * 2;
          const r = d.size * (0.6 + seededRandom(di * 7 + v) * 0.8);
          if (v === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fillStyle = d.life > d.maxLife * 0.5
          ? `rgba(255,${80 + Math.floor(d.life)},30,${alpha})`
          : "#484048";
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // ===== HUD =====
      ctx.save();
      ctx.font = "bold 9px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(200,210,225,0.3)";
      ctx.fillText("ASTEROID FIELD", 14, h - 12);

      ctx.textAlign = "right";
      const riskColor = overallRiskScore > 70 ? "#ef4444" : overallRiskScore > 40 ? "#f59e0b" : "#10b981";
      ctx.fillStyle = riskColor;
      ctx.globalAlpha = 0.5;
      ctx.fillText(`RISK: ${overallRiskScore}`, w - 14, h - 12);

      const activeCount = asteroids.filter((a) => !a.destroyed && a.status !== "NEUTRALIZED" && a.status !== "ACCEPTED").length;
      const destroyedCount = asteroids.filter((a) => a.destroyed).length;
      ctx.fillStyle = "rgba(200,210,225,0.25)";
      ctx.fillText(`${activeCount} active · ${destroyedCount} destroyed`, w - 14, h - 26);
      ctx.globalAlpha = 1;
      ctx.restore();

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
  }, [dimensions, overallRiskScore, onNukeComplete]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  return (
    <div className="relative w-full rounded-xl overflow-hidden" style={{ border: "1px solid rgba(239,68,68,0.1)" }}>
      <canvas
        ref={canvasRef}
        className="w-full cursor-crosshair"
        style={{ height: 520 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { mouseRef.current = { x: -999, y: -999 }; setHoveredAsteroid(null); }}
      />
      {hoveredAsteroid && (
        <div
          className="absolute pointer-events-none rounded-lg px-3 py-2.5 z-10 max-w-[240px]"
          style={{
            left: Math.min(hoveredAsteroid.x + 20, dimensions.w - 260),
            top: Math.max(10, hoveredAsteroid.y - 100),
            background: "rgba(6,10,18,0.95)",
            border: `1px solid ${hoveredAsteroid.color}30`,
            backdropFilter: "blur(12px)",
          }}
        >
          <p className="text-[11px] font-bold" style={{ color: hoveredAsteroid.color }}>
            {hoveredAsteroid.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: `${hoveredAsteroid.color}15`, color: hoveredAsteroid.color }}>
              {hoveredAsteroid.severity}
            </span>
            <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.4)" }}>
              {hoveredAsteroid.domain}
            </span>
            <span className="text-[9px] font-bold" style={{ color: hoveredAsteroid.color }}>
              Impact: {hoveredAsteroid.impactScore}
            </span>
          </div>
          <p className="text-[9px] mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
            Status: {hoveredAsteroid.status.replace(/_/g, " ")}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {hoveredAsteroid.missileCount > 0 && (
              <span className="text-[8px]" style={{ color: "#a78bfa" }}>
                {hoveredAsteroid.missileCount} missile{hoveredAsteroid.missileCount > 1 ? "s" : ""}
              </span>
            )}
            {hoveredAsteroid.nukeCount > 0 && (
              <span className="text-[8px]" style={{ color: "#f97316" }}>
                {hoveredAsteroid.nukeCount} nuke{hoveredAsteroid.nukeCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          {hoveredAsteroid.blockedPhases.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {hoveredAsteroid.blockedPhases.slice(0, 4).map((p, i) => (
                <span key={i} className="text-[8px] px-1 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.08)", color: "#f87171" }}>
                  {p.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Silo shoot button */}
      {siloReady && onShootNuke && (
        <div
          className="absolute z-20"
          style={{
            left: "50%",
            bottom: 42,
            transform: "translateX(-50%)",
          }}
        >
          {armedBlockers.length === 1 ? (
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 group"
              style={{
                background: "linear-gradient(135deg, rgba(239,68,68,0.25), rgba(220,38,38,0.3))",
                border: "1px solid rgba(239,68,68,0.5)",
                color: "#fca5a5",
                boxShadow: "0 0 20px rgba(239,68,68,0.15)",
                backdropFilter: "blur(8px)",
              }}
              onClick={() => onShootNuke(armedBlockers[0].id)}
            >
              <svg className="w-4 h-4 group-hover:animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
                <circle cx="12" cy="12" r="3" fill="currentColor" opacity={0.4} />
              </svg>
              <span className="text-xs font-bold tracking-wide uppercase">Shoot Nuke</span>
            </button>
          ) : (
            <div className="relative">
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 group"
                style={{
                  background: "linear-gradient(135deg, rgba(239,68,68,0.25), rgba(220,38,38,0.3))",
                  border: "1px solid rgba(239,68,68,0.5)",
                  color: "#fca5a5",
                  boxShadow: "0 0 20px rgba(239,68,68,0.15)",
                  backdropFilter: "blur(8px)",
                }}
                onClick={() => setSiloMenuOpen(!siloMenuOpen)}
              >
                <svg className="w-4 h-4 group-hover:animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="2" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="22" y2="12" />
                  <circle cx="12" cy="12" r="3" fill="currentColor" opacity={0.4} />
                </svg>
                <span className="text-xs font-bold tracking-wide uppercase">
                  Shoot Nuke ({armedBlockers.length})
                </span>
                <svg className={`w-3 h-3 transition-transform ${siloMenuOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              {siloMenuOpen && (
                <div
                  className="absolute bottom-full left-1/2 mb-2 rounded-lg py-1.5 min-w-[200px]"
                  style={{
                    transform: "translateX(-50%)",
                    background: "rgba(10,14,26,0.95)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <p className="text-[9px] uppercase tracking-wider font-bold px-3 py-1" style={{ color: "rgba(239,68,68,0.5)" }}>
                    Select Target
                  </p>
                  {armedBlockers.map((ab) => {
                    const sevColor = SEVERITY_COLORS[ab.severity] || "#3b82f6";
                    return (
                      <button
                        key={ab.id}
                        className="w-full text-left px-3 py-2 flex items-center gap-2 transition-colors hover:bg-white/5"
                        onClick={() => {
                          setSiloMenuOpen(false);
                          onShootNuke(ab.id);
                        }}
                      >
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: sevColor, boxShadow: `0 0 6px ${sevColor}60` }}
                        />
                        <span className="text-xs truncate" style={{ color: "#fca5a5" }}>
                          {ab.title}
                        </span>
                        <span className="text-[9px] ml-auto shrink-0 px-1 rounded" style={{ color: sevColor, background: `${sevColor}15` }}>
                          {ab.severity}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {blockers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: "#34d399" }}>Asteroid field clear</p>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>No active blockers detected</p>
          </div>
        </div>
      )}
    </div>
  );
}
