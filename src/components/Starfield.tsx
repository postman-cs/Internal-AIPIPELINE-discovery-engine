"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Starfield — immersive outer-space background
 *
 * Layers:
 *  1. Deep-space static stars (tiny, many, slow twinkle)
 *  2. Bright foreground stars (fewer, larger, faster twinkle)
 *  3. Nebula clouds (soft radial gradients, slow drift)
 *  4. Shooting stars (rare, fast streaks)
 */

interface Star {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  hue: number; // 0-360 for subtle color tinting
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  length: number;
}

interface Nebula {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  hue: number;
  alpha: number;
  driftX: number;
  driftY: number;
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const starsRef = useRef<Star[]>([]);
  const shootingRef = useRef<ShootingStar[]>([]);
  const nebulaeRef = useRef<Nebula[]>([]);
  const lastShootRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  const initStars = useCallback((w: number, h: number) => {
    const area = w * h;
    const density = 0.00025; // stars per pixel
    const count = Math.floor(area * density);
    const stars: Star[] = [];

    for (let i = 0; i < count; i++) {
      const isBright = Math.random() < 0.08;
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        radius: isBright ? 0.8 + Math.random() * 1.2 : 0.3 + Math.random() * 0.7,
        baseAlpha: isBright ? 0.6 + Math.random() * 0.4 : 0.15 + Math.random() * 0.35,
        twinkleSpeed: 0.3 + Math.random() * 1.5,
        twinklePhase: Math.random() * Math.PI * 2,
        hue: Math.random() < 0.3 ? 180 + Math.random() * 40 : // cyan-ish
             Math.random() < 0.5 ? 30 + Math.random() * 20 :  // warm
             220 + Math.random() * 60,                          // blue-purple
      });
    }
    starsRef.current = stars;
  }, []);

  const initNebulae = useCallback((w: number, h: number) => {
    const nebulae: Nebula[] = [
      {
        x: w * 0.15, y: h * 0.3,
        radiusX: w * 0.25, radiusY: h * 0.2,
        hue: 185, alpha: 0.025,
        driftX: 0.08, driftY: 0.03,
      },
      {
        x: w * 0.75, y: h * 0.15,
        radiusX: w * 0.2, radiusY: h * 0.15,
        hue: 270, alpha: 0.02,
        driftX: -0.05, driftY: 0.04,
      },
      {
        x: w * 0.5, y: h * 0.75,
        radiusX: w * 0.3, radiusY: h * 0.18,
        hue: 20, alpha: 0.015,
        driftX: 0.06, driftY: -0.03,
      },
    ];
    nebulaeRef.current = nebulae;
  }, []);

  const spawnShootingStar = useCallback((w: number, h: number) => {
    const startX = Math.random() * w;
    const startY = Math.random() * h * 0.5;
    const angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.2;
    const speed = 4 + Math.random() * 6;
    shootingRef.current.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 40 + Math.random() * 30,
      length: 60 + Math.random() * 80,
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);
      sizeRef.current = { w, h };
      initStars(w, h);
      initNebulae(w, h);
    };

    resize();
    window.addEventListener("resize", resize);

    let time = 0;
    const draw = () => {
      const { w, h } = sizeRef.current;
      const dpr = Math.min(window.devicePixelRatio, 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      time += 0.016; // ~60fps

      // --- Nebulae ---
      for (const neb of nebulaeRef.current) {
        const nx = neb.x + Math.sin(time * neb.driftX) * 40;
        const ny = neb.y + Math.cos(time * neb.driftY) * 30;
        const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, Math.max(neb.radiusX, neb.radiusY));
        grad.addColorStop(0, `hsla(${neb.hue}, 60%, 50%, ${neb.alpha})`);
        grad.addColorStop(0.5, `hsla(${neb.hue}, 50%, 40%, ${neb.alpha * 0.4})`);
        grad.addColorStop(1, `hsla(${neb.hue}, 40%, 30%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(nx, ny, neb.radiusX, neb.radiusY, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- Stars ---
      for (const star of starsRef.current) {
        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinklePhase);
        const alpha = star.baseAlpha * (0.5 + 0.5 * twinkle);
        if (alpha < 0.03) continue; // skip invisible stars

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);

        if (star.radius > 1) {
          // Bright stars get a glow
          ctx.fillStyle = `hsla(${star.hue}, 30%, 90%, ${alpha * 0.3})`;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.radius * 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = `hsla(${star.hue}, 20%, 95%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- Shooting stars ---
      if (time - lastShootRef.current > 3 + Math.random() * 5) {
        lastShootRef.current = time;
        if (Math.random() < 0.6) spawnShootingStar(w, h);
      }

      shootingRef.current = shootingRef.current.filter((s) => {
        s.x += s.vx;
        s.y += s.vy;
        s.life++;
        if (s.life > s.maxLife) return false;

        const progress = s.life / s.maxLife;
        const fadeIn = Math.min(progress * 4, 1);
        const fadeOut = Math.max(1 - (progress - 0.6) / 0.4, 0);
        const alpha = fadeIn * fadeOut * 0.8;

        const tailX = s.x - (s.vx / Math.sqrt(s.vx * s.vx + s.vy * s.vy)) * s.length * fadeIn;
        const tailY = s.y - (s.vy / Math.sqrt(s.vx * s.vx + s.vy * s.vy)) * s.length * fadeIn;

        const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
        grad.addColorStop(0, `rgba(255, 255, 255, 0)`);
        grad.addColorStop(0.7, `rgba(180, 220, 255, ${alpha * 0.4})`);
        grad.addColorStop(1, `rgba(255, 255, 255, ${alpha})`);

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();

        // Head glow
        ctx.fillStyle = `rgba(200, 230, 255, ${alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
        ctx.fill();

        return true;
      });

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [initStars, initNebulae, spawnShootingStar]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
