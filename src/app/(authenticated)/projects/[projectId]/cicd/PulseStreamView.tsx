"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface CiCdStage {
  stageName?: string;
  platform?: string;
  platformLabel?: string;
  triggerCondition?: string;
  gateChecks?: string[];
  configSnippet?: string;
}

interface EnvGate {
  fromEnv?: string;
  toEnv?: string;
  requiredChecks?: string[];
  approvalRequired?: boolean;
}

interface PulseStreamProps {
  stages: CiCdStage[];
  gates: EnvGate[];
  monitors: Array<{ name?: string; schedule?: string }>;
  pipelines: Array<{ platform?: string; platformLabel?: string; description?: string }>;
  hasData: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: "commit" | "deploy" | "alert" | "monitor";
  branch: number;
}

interface GateNode {
  x: number;
  y: number;
  label: string;
  type: "stage" | "env" | "monitor";
  color: string;
  pulsePhase: number;
  checks: string[];
  failed: boolean;
}

interface Turbulence {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
}

const COLORS = {
  river: "#22c55e",
  riverGlow: "rgba(34, 197, 94, 0.12)",
  commit: "#60a5fa",
  deploy: "#8b5cf6",
  monitor: "#06d6d6",
  alert: "#f59e0b",
  fail: "#ef4444",
  gate: "#22c55e",
  bg: "#0a0e17",
  grid: "rgba(255, 255, 255, 0.015)",
  text: "rgba(255, 255, 255, 0.7)",
  textDim: "rgba(255, 255, 255, 0.35)",
};

export default function PulseStreamView({
  stages,
  gates,
  monitors,
  pipelines,
  hasData,
}: PulseStreamProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const gateNodesRef = useRef<GateNode[]>([]);
  const turbulencesRef = useRef<Turbulence[]>([]);
  const timeRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const [hoveredGate, setHoveredGate] = useState<GateNode | null>(null);
  const [dimensions, setDimensions] = useState({ w: 900, h: 500 });

  const buildGateNodes = useCallback(() => {
    const w = dimensions.w;
    const h = dimensions.h;
    const nodes: GateNode[] = [];
    const totalNodes = stages.length + gates.length + monitors.length;
    if (totalNodes === 0 && pipelines.length > 0) {
      pipelines.forEach((p, i) => {
        const x = (w * 0.15) + (i / Math.max(pipelines.length - 1, 1)) * (w * 0.7);
        nodes.push({
          x, y: h * 0.45,
          label: p.platformLabel || p.platform || `Pipeline ${i + 1}`,
          type: "stage", color: COLORS.deploy,
          pulsePhase: Math.random() * Math.PI * 2,
          checks: [], failed: false,
        });
      });
      return nodes;
    }

    stages.forEach((s, i) => {
      const x = (w * 0.1) + (i / Math.max(stages.length, 1)) * (w * 0.35);
      const y = h * 0.35 + Math.sin(i * 0.8) * (h * 0.08);
      nodes.push({
        x, y,
        label: s.stageName || `Stage ${i + 1}`,
        type: "stage", color: COLORS.gate,
        pulsePhase: Math.random() * Math.PI * 2,
        checks: s.gateChecks || [],
        failed: false,
      });
    });

    gates.forEach((g, i) => {
      const x = (w * 0.48) + (i / Math.max(gates.length, 1)) * (w * 0.25);
      const y = h * 0.55 + Math.sin(i * 1.2) * (h * 0.1);
      nodes.push({
        x, y,
        label: `${g.fromEnv || "?"} → ${g.toEnv || "?"}`,
        type: "env", color: COLORS.deploy,
        pulsePhase: Math.random() * Math.PI * 2,
        checks: g.requiredChecks || [],
        failed: false,
      });
    });

    monitors.forEach((m, i) => {
      const x = (w * 0.75) + (i / Math.max(monitors.length, 1)) * (w * 0.2);
      const y = h * 0.4 + Math.sin(i * 0.9) * (h * 0.12);
      nodes.push({
        x, y,
        label: m.name || `Monitor ${i + 1}`,
        type: "monitor", color: COLORS.monitor,
        pulsePhase: Math.random() * Math.PI * 2,
        checks: [], failed: false,
      });
    });

    return nodes;
  }, [stages, gates, monitors, pipelines, dimensions]);

  useEffect(() => {
    gateNodesRef.current = buildGateNodes();
  }, [buildGateNodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = Math.max(480, Math.min(600, rect.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      setDimensions({ w, h });
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const spawnParticle = () => {
      const { h } = dimensions;
      const types: Particle["type"][] = ["commit", "commit", "commit", "deploy", "monitor", "alert"];
      const type = types[Math.floor(Math.random() * types.length)];
      const colorMap = { commit: COLORS.commit, deploy: COLORS.deploy, monitor: COLORS.monitor, alert: COLORS.alert };
      const branch = Math.random();
      const yBase = h * 0.3 + branch * (h * 0.4);

      particlesRef.current.push({
        x: -10 + Math.random() * 20,
        y: yBase + (Math.random() - 0.5) * 40,
        vx: 0.8 + Math.random() * 1.2,
        vy: (Math.random() - 0.5) * 0.3,
        life: 0,
        maxLife: 300 + Math.random() * 200,
        size: 1.5 + Math.random() * 2.5,
        color: colorMap[type],
        type,
        branch,
      });
    };

    const drawRiver = (ctx: CanvasRenderingContext2D, t: number) => {
      const { w, h } = dimensions;
      const dpr = window.devicePixelRatio || 1;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, h * 0.25);
      for (let x = 0; x <= w; x += 4) {
        const wave = Math.sin(x * 0.008 + t * 0.002) * 15 + Math.sin(x * 0.003 + t * 0.001) * 25;
        ctx.lineTo(x, h * 0.3 + wave);
      }
      for (let x = w; x >= 0; x -= 4) {
        const wave = Math.sin(x * 0.006 + t * 0.0015) * 15 + Math.sin(x * 0.004 + t * 0.001) * 25;
        ctx.lineTo(x, h * 0.7 + wave);
      }
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, "rgba(34, 197, 94, 0.03)");
      grad.addColorStop(0.3, "rgba(34, 197, 94, 0.06)");
      grad.addColorStop(0.6, "rgba(139, 92, 246, 0.04)");
      grad.addColorStop(1, "rgba(6, 214, 214, 0.03)");
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.strokeStyle = "rgba(34, 197, 94, 0.08)";
      ctx.lineWidth = 1 / dpr;
      ctx.stroke();
      ctx.restore();

      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.beginPath();
        const yOff = h * 0.38 + i * (h * 0.08);
        for (let x = 0; x <= w; x += 3) {
          const wave = Math.sin(x * 0.01 + t * 0.003 + i * 1.5) * 8;
          if (x === 0) ctx.moveTo(x, yOff + wave);
          else ctx.lineTo(x, yOff + wave);
        }
        ctx.strokeStyle = `rgba(34, 197, 94, ${0.03 + i * 0.01})`;
        ctx.lineWidth = 0.5 / dpr;
        ctx.stroke();
        ctx.restore();
      }
    };

    const drawGateNode = (ctx: CanvasRenderingContext2D, node: GateNode, t: number, hovered: boolean) => {
      const pulse = Math.sin(t * 0.004 + node.pulsePhase) * 0.3 + 0.7;
      const baseRadius = node.type === "env" ? 28 : node.type === "monitor" ? 22 : 25;
      const r = baseRadius * (hovered ? 1.2 : 1);

      ctx.save();
      const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 2.5);
      glow.addColorStop(0, `${node.color}20`);
      glow.addColorStop(0.5, `${node.color}08`);
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(node.x - r * 3, node.y - r * 3, r * 6, r * 6);

      if (node.type === "stage") {
        ctx.beginPath();
        const hw = r * 0.7;
        ctx.moveTo(node.x, node.y - r);
        ctx.lineTo(node.x + hw, node.y);
        ctx.lineTo(node.x, node.y + r);
        ctx.lineTo(node.x - hw, node.y);
        ctx.closePath();
      } else if (node.type === "env") {
        ctx.beginPath();
        ctx.ellipse(node.x, node.y, r * 1.2, r * 0.7, 0, 0, Math.PI * 2);
      } else {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      }

      ctx.fillStyle = `${node.color}${Math.round(pulse * 15).toString(16).padStart(2, "0")}`;
      ctx.fill();
      ctx.strokeStyle = `${node.color}${Math.round(pulse * 80).toString(16).padStart(2, "0")}`;
      ctx.lineWidth = hovered ? 2 : 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(node.x, node.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.fill();

      ctx.font = "10px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = COLORS.text;
      ctx.fillText(node.label, node.x, node.y + r + 16);

      if (node.type !== "monitor") {
        const iconLabel = node.type === "stage" ? "CI" : "CD";
        ctx.font = "bold 8px Inter, system-ui, sans-serif";
        ctx.fillStyle = node.color;
        ctx.fillText(iconLabel, node.x, node.y + 3);
      }

      ctx.restore();
    };

    const drawConnections = (ctx: CanvasRenderingContext2D, nodes: GateNode[], t: number) => {
      for (let i = 0; i < nodes.length - 1; i++) {
        const a = nodes[i];
        const b = nodes[i + 1];
        if (!a || !b) continue;

        ctx.save();
        ctx.beginPath();
        const cp1x = a.x + (b.x - a.x) * 0.4;
        const cp1y = a.y;
        const cp2x = a.x + (b.x - a.x) * 0.6;
        const cp2y = b.y;
        ctx.moveTo(a.x, a.y);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, b.x, b.y);

        const flowPos = ((t * 0.003) % 1);
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(Math.max(0, flowPos - 0.1), "transparent");
        grad.addColorStop(flowPos, "rgba(34, 197, 94, 0.25)");
        grad.addColorStop(Math.min(1, flowPos + 0.1), "transparent");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, b.x, b.y);
        ctx.strokeStyle = "rgba(34, 197, 94, 0.04)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    };

    const drawTurbulence = (ctx: CanvasRenderingContext2D, turb: Turbulence) => {
      const progress = turb.life / turb.maxLife;
      const alpha = 1 - progress;
      const r = turb.radius * (0.5 + progress * 1.5);

      ctx.save();
      for (let ring = 0; ring < 3; ring++) {
        const ringR = r * (1 + ring * 0.4);
        ctx.beginPath();
        ctx.arc(turb.x, turb.y, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239, 68, 68, ${alpha * (0.3 - ring * 0.08)})`;
        ctx.lineWidth = 2 - ring * 0.5;
        ctx.stroke();
      }

      const glow = ctx.createRadialGradient(turb.x, turb.y, 0, turb.x, turb.y, r);
      glow.addColorStop(0, `rgba(239, 68, 68, ${alpha * 0.12})`);
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(turb.x, turb.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawParticle = (ctx: CanvasRenderingContext2D, p: Particle) => {
      const alpha = Math.min(1, p.life / 30) * Math.max(0, 1 - p.life / p.maxLife);
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha * 0.9;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
      glow.addColorStop(0, `${p.color}30`);
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.globalAlpha = alpha;
      ctx.fill();

      if (p.life > 5) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 8, p.y - p.vy * 8);
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = alpha * 0.3;
        ctx.lineWidth = p.size * 0.5;
        ctx.stroke();
      }
      ctx.restore();
    };

    const frame = () => {
      const dpr = window.devicePixelRatio || 1;
      const { w, h } = dimensions;
      timeRef.current++;
      const t = timeRef.current;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, w, h);

      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      drawRiver(ctx, t);

      if (t % 6 === 0 && hasData) spawnParticle();
      if (t % 12 === 0 && !hasData) spawnParticle();

      const nodes = gateNodesRef.current;
      drawConnections(ctx, nodes, t);

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const nearGate = nodes.find(
          (n) => Math.abs(p.x - n.x) < 30 && Math.abs(p.y - n.y) < 30,
        );
        if (nearGate) {
          p.vy += (nearGate.y - p.y) * 0.002;
          p.vx *= 0.98;
        }

        p.x += p.vx;
        p.y += p.vy + Math.sin(t * 0.02 + p.x * 0.01) * 0.15;
        p.vy *= 0.99;
        p.life++;

        if (p.life > p.maxLife || p.x > w + 20) {
          particles.splice(i, 1);
          continue;
        }
        drawParticle(ctx, p);
      }

      for (const node of nodes) {
        const dist = Math.hypot(mouseRef.current.x - node.x, mouseRef.current.y - node.y);
        drawGateNode(ctx, node, t, dist < 40);
      }

      const turbs = turbulencesRef.current;
      for (let i = turbs.length - 1; i >= 0; i--) {
        turbs[i].life++;
        if (turbs[i].life > turbs[i].maxLife) {
          turbs.splice(i, 1);
          continue;
        }
        drawTurbulence(ctx, turbs[i]);
      }

      if (t % 300 === 0 && hasData && nodes.length > 0) {
        const target = nodes[Math.floor(Math.random() * nodes.length)];
        turbulencesRef.current.push({
          x: target.x + (Math.random() - 0.5) * 60,
          y: target.y + (Math.random() - 0.5) * 40,
          radius: 15 + Math.random() * 20,
          life: 0,
          maxLife: 90,
        });
      }

      ctx.save();
      ctx.font = "bold 11px Inter, system-ui, sans-serif";
      ctx.fillStyle = COLORS.textDim;
      ctx.textAlign = "left";
      const labels = [
        { x: w * 0.05, label: "COMMITS" },
        { x: w * 0.3, label: "CI STAGES" },
        { x: w * 0.55, label: "CD ENVIRONMENTS" },
        { x: w * 0.8, label: "MONITORS" },
      ];
      for (const l of labels) {
        ctx.fillText(l.label, l.x, h - 16);
      }
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
  }, [dimensions, hasData]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mouseRef.current = { x, y };

    const node = gateNodesRef.current.find(
      (n) => Math.hypot(x - n.x, y - n.y) < 40,
    );
    setHoveredGate(node || null);
  }, []);

  return (
    <div className="relative w-full rounded-xl overflow-hidden" style={{ border: "1px solid rgba(34,197,94,0.1)" }}>
      <canvas
        ref={canvasRef}
        className="w-full cursor-crosshair"
        style={{ height: 500 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredGate(null)}
      />
      {hoveredGate && (
        <div
          className="absolute pointer-events-none rounded-lg px-3 py-2 z-10"
          style={{
            left: Math.min(hoveredGate.x, dimensions.w - 200),
            top: hoveredGate.y - 80,
            background: "rgba(10, 14, 23, 0.95)",
            border: `1px solid ${hoveredGate.color}30`,
            backdropFilter: "blur(12px)",
          }}
        >
          <p className="text-[11px] font-semibold" style={{ color: hoveredGate.color }}>
            {hoveredGate.label}
          </p>
          <p className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: COLORS.textDim }}>
            {hoveredGate.type === "stage" ? "CI Stage" : hoveredGate.type === "env" ? "Environment Gate" : "Monitor"}
          </p>
          {hoveredGate.checks.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {hoveredGate.checks.slice(0, 4).map((c, i) => (
                <span key={i} className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: `${hoveredGate!.color}15`, color: hoveredGate!.color }}>
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: COLORS.text }}>Awaiting pipeline data</p>
            <p className="text-xs mt-1" style={{ color: COLORS.textDim }}>Run a cascade to populate the pulse stream</p>
          </div>
        </div>
      )}
    </div>
  );
}
