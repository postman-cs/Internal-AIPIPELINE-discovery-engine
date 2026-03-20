// Shared planet-evolution draw routines — usable from any canvas context.
// Each level renders a progressively more evolved planet.

export interface LevelDraw {
  glow: string;
  draw: (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: number) => void;
}

export function noise(x: number, y: number, seed = 0): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 43758.5453) * 43758.5453;
  return n - Math.floor(n);
}

export function fbm(x: number, y: number, octaves = 4, seed = 0): number {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * noise(x * freq, y * freq, seed + i * 13.37);
    amp *= 0.5;
    freq *= 2;
  }
  return val;
}

export const LEVEL_DRAW: Record<number, LevelDraw> = {
  // L1: Stardust — swirling particles, no solid body
  1: {
    glow: "rgba(122,130,154,0.12)",
    draw(ctx, cx, cy, r, t) {
      for (let i = 0; i < 80; i++) {
        const angle = (i / 80) * Math.PI * 2 + t * 0.3 + noise(i, 0) * 3;
        const dist = r * (0.2 + noise(i, 1) * 0.9);
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist * 0.7;
        const sz = 0.5 + noise(i, 2) * 1.5;
        const alpha = 0.3 + noise(i, 3) * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, sz, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,190,210,${alpha})`;
        ctx.fill();
      }
    },
  },

  // L2: Molten — glowing red/orange sphere with flowing lava
  2: {
    glow: "rgba(239,68,68,0.2)",
    draw(ctx, cx, cy, r, t) {
      const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r);
      grad.addColorStop(0, "#ff6b35");
      grad.addColorStop(0.5, "#cc2200");
      grad.addColorStop(1, "#660000");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + t * 0.15;
        const x1 = cx + Math.cos(angle) * r * 0.3;
        const y1 = cy + Math.sin(angle) * r * 0.3;
        const x2 = cx + Math.cos(angle + 0.5) * r * 0.85;
        const y2 = cy + Math.sin(angle + 0.5) * r * 0.85;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(
          cx + Math.cos(angle + 0.25 + Math.sin(t + i) * 0.1) * r * 0.6,
          cy + Math.sin(angle + 0.25 + Math.sin(t + i) * 0.1) * r * 0.6,
          x2, y2
        );
        ctx.strokeStyle = `rgba(255,${150 + Math.sin(t * 2 + i) * 50},0,0.6)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      for (let i = 0; i < 5; i++) {
        const a = noise(i, 10) * Math.PI * 2 + t * 0.08;
        const d = noise(i, 11) * r * 0.6;
        const px = cx + Math.cos(a) * d;
        const py = cy + Math.sin(a) * d;
        const glow = ctx.createRadialGradient(px, py, 0, px, py, r * 0.15);
        glow.addColorStop(0, "rgba(255,200,50,0.6)");
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(px - r * 0.15, py - r * 0.15, r * 0.3, r * 0.3);
      }
    },
  },

  // L3: Cratered
  3: {
    glow: "rgba(161,161,170,0.12)",
    draw(ctx, cx, cy, r, t) {
      void t;
      const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      grad.addColorStop(0, "#b0b0b8");
      grad.addColorStop(0.6, "#808088");
      grad.addColorStop(1, "#484850");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      for (let i = 0; i < 14; i++) {
        const ca = noise(i, 20) * Math.PI * 2;
        const cd = noise(i, 21) * r * 0.8;
        const px = cx + Math.cos(ca) * cd;
        const py = cy + Math.sin(ca) * cd;
        const cr = 3 + noise(i, 22) * 8;
        ctx.beginPath();
        ctx.arc(px, py, cr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(60,60,68,${0.3 + noise(i, 23) * 0.4})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px - 1, py - 1, cr * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(90,90,100,0.2)";
        ctx.fill();
      }
      ctx.restore();
    },
  },

  // L4: Tidebreak
  4: {
    glow: "rgba(59,130,246,0.18)",
    draw(ctx, cx, cy, r, t) {
      const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r);
      grad.addColorStop(0, "#4d9fef");
      grad.addColorStop(0.7, "#1e6bbf");
      grad.addColorStop(1, "#0c3d6e");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      for (let i = 0; i < 5; i++) {
        const la = noise(i, 30) * Math.PI * 2 + t * 0.02;
        const ld = noise(i, 31) * r * 0.5;
        const lx = cx + Math.cos(la) * ld;
        const ly = cy + Math.sin(la) * ld;
        ctx.beginPath();
        for (let j = 0; j < 8; j++) {
          const ba = (j / 8) * Math.PI * 2;
          const br = (8 + noise(i * 10 + j, 32) * 14);
          const bx = lx + Math.cos(ba) * br;
          const by = ly + Math.sin(ba) * br;
          if (j === 0) ctx.moveTo(bx, by); else ctx.lineTo(bx, by);
        }
        ctx.closePath();
        ctx.fillStyle = `rgba(139,115,85,${0.6 + noise(i, 33) * 0.3})`;
        ctx.fill();
      }
      ctx.restore();

      const spec = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 0, cx - r * 0.3, cy - r * 0.35, r * 0.5);
      spec.addColorStop(0, "rgba(255,255,255,0.15)");
      spec.addColorStop(1, "transparent");
      ctx.fillStyle = spec;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    },
  },

  // L5: Veil
  5: {
    glow: "rgba(139,92,246,0.18)",
    draw(ctx, cx, cy, r, t) {
      LEVEL_DRAW[4].draw(ctx, cx, cy, r, t);

      for (let i = 0; i < 3; i++) {
        const haze = ctx.createRadialGradient(cx, cy, r * (0.85 + i * 0.05), cx, cy, r * (1.1 + i * 0.08));
        const alpha = 0.08 + Math.sin(t + i) * 0.03;
        haze.addColorStop(0, `rgba(139,92,246,${alpha})`);
        haze.addColorStop(0.5, `rgba(100,140,255,${alpha * 0.7})`);
        haze.addColorStop(1, "transparent");
        ctx.fillStyle = haze;
        ctx.fillRect(cx - r * 1.2, cy - r * 1.2, r * 2.4, r * 2.4);
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.02, 0, Math.PI * 2);
      ctx.clip();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + t * 0.05;
        const y = cy - r * 0.5 + noise(i, 40) * r;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * r * 0.3, y, r * 0.4, 3, a * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.08 + Math.sin(t + i) * 0.04})`;
        ctx.fill();
      }
      ctx.restore();
    },
  },

  // L6: Spark
  6: {
    glow: "rgba(34,197,94,0.18)",
    draw(ctx, cx, cy, r, t) {
      LEVEL_DRAW[5].draw(ctx, cx, cy, r, t);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      for (let i = 0; i < 10; i++) {
        const a = noise(i, 50) * Math.PI * 2;
        const d = noise(i, 51) * r * 0.7;
        const px = cx + Math.cos(a) * d;
        const py = cy + Math.sin(a) * d;
        const pulse = 0.4 + Math.sin(t * 2 + i * 1.3) * 0.3;
        const glow = ctx.createRadialGradient(px, py, 0, px, py, 4 + noise(i, 52) * 4);
        glow.addColorStop(0, `rgba(80,255,120,${pulse})`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(px - 10, py - 10, 20, 20);
      }
      ctx.restore();
    },
  },

  // L7: Bloom
  7: {
    glow: "rgba(16,185,129,0.2)",
    draw(ctx, cx, cy, r, t) {
      const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r);
      grad.addColorStop(0, "#4d9fef");
      grad.addColorStop(0.7, "#1e6bbf");
      grad.addColorStop(1, "#0c3d6e");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      for (let i = 0; i < 5; i++) {
        const la = noise(i, 30) * Math.PI * 2 + t * 0.015;
        const ld = noise(i, 31) * r * 0.5;
        const lx = cx + Math.cos(la) * ld;
        const ly = cy + Math.sin(la) * ld;
        ctx.beginPath();
        for (let j = 0; j < 10; j++) {
          const ba = (j / 10) * Math.PI * 2;
          const br = (10 + noise(i * 10 + j, 32) * 16);
          const bx = lx + Math.cos(ba) * br;
          const by = ly + Math.sin(ba) * br;
          if (j === 0) ctx.moveTo(bx, by); else ctx.lineTo(bx, by);
        }
        ctx.closePath();
        ctx.fillStyle = `rgba(34,${140 + noise(i, 60) * 60},${60 + noise(i, 61) * 30},0.8)`;
        ctx.fill();
      }
      ctx.restore();

      const haze = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.1);
      haze.addColorStop(0, "rgba(100,200,255,0.06)");
      haze.addColorStop(1, "transparent");
      ctx.fillStyle = haze;
      ctx.fillRect(cx - r * 1.2, cy - r * 1.2, r * 2.4, r * 2.4);
    },
  },

  // L8: Wilds
  8: {
    glow: "rgba(245,158,11,0.18)",
    draw(ctx, cx, cy, r, t) {
      LEVEL_DRAW[7].draw(ctx, cx, cy, r, t);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      ctx.ellipse(cx, cy - r * 0.85, r * 0.35, r * 0.12, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(220,230,255,0.5)";
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.88, r * 0.25, r * 0.1, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(220,230,255,0.4)";
      ctx.fill();

      for (let i = 0; i < 3; i++) {
        const a = noise(i, 70) * Math.PI * 2;
        const d = noise(i, 71) * r * 0.4;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 6 + noise(i, 72) * 8, 4 + noise(i, 73) * 5, a, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(210,180,120,0.5)";
        ctx.fill();
      }
      ctx.restore();
    },
  },

  // L9: Ascent
  9: {
    glow: "rgba(6,214,214,0.2)",
    draw(ctx, cx, cy, r, t) {
      LEVEL_DRAW[8].draw(ctx, cx, cy, r, t);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      const shadow = ctx.createLinearGradient(cx - r, cy, cx + r * 0.3, cy);
      shadow.addColorStop(0, "transparent");
      shadow.addColorStop(0.6, "transparent");
      shadow.addColorStop(1, "rgba(0,0,20,0.5)");
      ctx.fillStyle = shadow;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

      for (let i = 0; i < 20; i++) {
        const a = noise(i, 80) * Math.PI * 2;
        const d = noise(i, 81) * r * 0.75;
        const px = cx + Math.cos(a) * d;
        const py = cy + Math.sin(a) * d;
        if (px > cx + r * 0.1) {
          const pulse = 0.4 + Math.sin(t * 3 + i * 2) * 0.3;
          ctx.beginPath();
          ctx.arc(px, py, 1 + noise(i, 82) * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,220,100,${pulse})`;
          ctx.fill();
        }
      }
      ctx.restore();
    },
  },

  // L10: Forge
  10: {
    glow: "rgba(249,115,22,0.2)",
    draw(ctx, cx, cy, r, t) {
      LEVEL_DRAW[9].draw(ctx, cx, cy, r, t);

      ctx.save();
      ctx.strokeStyle = "rgba(249,180,100,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.3, r * 0.15, t * 0.1, 0, Math.PI * 2);
      ctx.stroke();

      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + t * 0.1;
        const px = cx + Math.cos(a) * r * 1.3;
        const py = cy + Math.sin(a) * r * 0.15;
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,200,120,${0.3 + Math.sin(t + i) * 0.2})`;
        ctx.fill();
      }
      ctx.restore();
    },
  },

  // L11: Starbound
  11: {
    glow: "rgba(236,72,153,0.2)",
    draw(ctx, cx, cy, r, t) {
      LEVEL_DRAW[10].draw(ctx, cx, cy, r, t);

      for (let i = 0; i < 3; i++) {
        const shipAngle = (i / 3) * Math.PI * 2 + t * 0.2;
        const shipDist = r * 1.1 + Math.sin(t * 0.5 + i * 2) * r * 0.3;
        const sx = cx + Math.cos(shipAngle) * shipDist;
        const sy = cy + Math.sin(shipAngle) * shipDist * 0.4;

        const trailLen = 8 + Math.sin(t * 3 + i) * 3;
        const tg = ctx.createLinearGradient(
          sx, sy,
          sx - Math.cos(shipAngle) * trailLen,
          sy - Math.sin(shipAngle) * trailLen * 0.4,
        );
        tg.addColorStop(0, "rgba(100,200,255,0.6)");
        tg.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(
          sx - Math.cos(shipAngle) * trailLen,
          sy - Math.sin(shipAngle) * trailLen * 0.4,
        );
        ctx.strokeStyle = tg as unknown as string;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(200,230,255,0.9)";
        ctx.fill();
      }
    },
  },

  // L12: Constellation
  12: {
    glow: "rgba(251,191,36,0.25)",
    draw(ctx, cx, cy, r, t) {
      const mainR = r * 0.65;
      LEVEL_DRAW[10].draw(ctx, cx, cy, mainR, t);

      const satellites = [
        { dist: r * 1.4, angle: t * 0.08,     planetR: r * 0.18, color: "#ef4444" },
        { dist: r * 1.2, angle: t * 0.12 + 2,  planetR: r * 0.14, color: "#3b82f6" },
        { dist: r * 1.5, angle: t * 0.06 + 4,  planetR: r * 0.12, color: "#22c55e" },
      ];

      for (const sat of satellites) {
        const sx = cx + Math.cos(sat.angle) * sat.dist;
        const sy = cy + Math.sin(sat.angle) * sat.dist * 0.35;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(sx, sy);
        ctx.strokeStyle = "rgba(251,191,36,0.15)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      for (const sat of satellites) {
        const sx = cx + Math.cos(sat.angle) * sat.dist;
        const sy = cy + Math.sin(sat.angle) * sat.dist * 0.35;
        const g = ctx.createRadialGradient(sx - sat.planetR * 0.3, sy - sat.planetR * 0.3, 0, sx, sy, sat.planetR);
        g.addColorStop(0, sat.color + "cc");
        g.addColorStop(1, sat.color + "44");
        ctx.beginPath();
        ctx.arc(sx, sy, sat.planetR, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();

        const mg = ctx.createRadialGradient(sx, sy, sat.planetR * 0.5, sx, sy, sat.planetR * 2);
        mg.addColorStop(0, sat.color + "20");
        mg.addColorStop(1, "transparent");
        ctx.fillStyle = mg;
        ctx.fillRect(sx - sat.planetR * 2, sy - sat.planetR * 2, sat.planetR * 4, sat.planetR * 4);
      }

      for (let i = 0; i < 4; i++) {
        const progress = ((t * 0.15 + i * 0.25) % 1);
        const sat = satellites[i % satellites.length];
        const sx = cx + Math.cos(sat.angle) * sat.dist;
        const sy = cy + Math.sin(sat.angle) * sat.dist * 0.35;
        const shipX = cx + (sx - cx) * progress;
        const shipY = cy + (sy - cy) * progress;
        ctx.beginPath();
        ctx.arc(shipX, shipY, 1, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(251,191,36,0.7)";
        ctx.fill();
      }
    },
  },
};

/** Draw the planet for a given XP level at (cx, cy) with radius r. */
export function drawEvolutionPlanet(
  ctx: CanvasRenderingContext2D,
  level: number,
  cx: number, cy: number,
  r: number, t: number,
) {
  const entry = LEVEL_DRAW[level] ?? LEVEL_DRAW[1];
  entry.draw(ctx, cx, cy, r, t);
}
