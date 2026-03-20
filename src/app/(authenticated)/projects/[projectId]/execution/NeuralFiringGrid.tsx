"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface ExecutionPhase {
  phase: string;
  label: string;
  status: string;
  color: string;
  itemCount: number;
  version: number;
}

interface NeuralFiringGridProps {
  phases: ExecutionPhase[];
  hasData: boolean;
}

interface Neuron {
  x: number;
  y: number;
  radius: number;
  label: string;
  phase: string;
  color: string;
  status: string;
  connections: number[];
  firePhase: number;
  firing: boolean;
  fireIntensity: number;
  itemCount: number;
  version: number;
  layer: number;
}

interface Synapse {
  from: number;
  to: number;
  signal: number;
  active: boolean;
}

interface FiringEvent {
  neuronIdx: number;
  progress: number;
  color: string;
}

interface BackgroundNeuron {
  x: number;
  y: number;
  size: number;
  alpha: number;
  pulseSpeed: number;
  phase: number;
}

export default function NeuralFiringGrid({ phases, hasData }: NeuralFiringGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const neuronsRef = useRef<Neuron[]>([]);
  const synapsesRef = useRef<Synapse[]>([]);
  const firingRef = useRef<FiringEvent[]>([]);
  const bgNeuronsRef = useRef<BackgroundNeuron[]>([]);
  const timeRef = useRef(0);
  const mouseRef = useRef({ x: -999, y: -999 });
  const [hoveredNeuron, setHoveredNeuron] = useState<Neuron | null>(null);
  const [dimensions, setDimensions] = useState({ w: 900, h: 520 });

  useEffect(() => {
    const { w, h } = dimensions;
    const neurons: Neuron[] = [];
    const synapses: Synapse[] = [];

    const centerX = w / 2;
    const centerY = h / 2;

    if (phases.length === 0) {
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const ring = i < 4 ? 0.25 : i < 8 ? 0.45 : 0.65;
        neurons.push({
          x: centerX + Math.cos(angle + (i % 3) * 0.3) * (h * ring),
          y: centerY + Math.sin(angle + (i % 3) * 0.3) * (h * ring * 0.7),
          radius: 18,
          label: `N-${i + 1}`,
          phase: "IDLE",
          color: "rgba(255,255,255,0.15)",
          status: "STALE",
          connections: [],
          firePhase: Math.random() * Math.PI * 2,
          firing: false,
          fireIntensity: 0,
          itemCount: 0,
          version: 0,
          layer: Math.floor(i / 4),
        });
      }
    } else {
      const mainPhases = phases.filter((p) =>
        ["DEPLOYMENT_PLAN", "BUILD_LOG"].includes(p.phase),
      );
      const allPhases = phases;

      allPhases.forEach((p, i) => {
        const total = allPhases.length;
        const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
        const isMain = mainPhases.includes(p);
        const ring = isMain ? 0.32 : 0.55;
        const radius = isMain ? 32 : 22;

        neurons.push({
          x: centerX + Math.cos(angle) * (h * ring),
          y: centerY + Math.sin(angle) * (h * ring * 0.7),
          radius,
          label: p.label,
          phase: p.phase,
          color: p.color,
          status: p.status,
          connections: [],
          firePhase: Math.random() * Math.PI * 2,
          firing: p.status === "CLEAN",
          fireIntensity: p.status === "CLEAN" ? 1 : p.status === "DIRTY" ? 0.4 : 0.1,
          itemCount: p.itemCount,
          version: p.version,
          layer: isMain ? 0 : 1,
        });
      });
    }

    for (let i = 0; i < neurons.length; i++) {
      for (let j = i + 1; j < neurons.length; j++) {
        const dist = Math.hypot(neurons[i].x - neurons[j].x, neurons[i].y - neurons[j].y);
        if (dist < h * 0.5) {
          neurons[i].connections.push(j);
          neurons[j].connections.push(i);
          synapses.push({
            from: i,
            to: j,
            signal: 0,
            active: neurons[i].firing && neurons[j].firing,
          });
        }
      }
    }

    neuronsRef.current = neurons;
    synapsesRef.current = synapses;

    const bgN: BackgroundNeuron[] = [];
    for (let i = 0; i < 80; i++) {
      bgN.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: 0.5 + Math.random() * 2,
        alpha: 0.05 + Math.random() * 0.15,
        pulseSpeed: 0.001 + Math.random() * 0.003,
        phase: Math.random() * Math.PI * 2,
      });
    }
    bgNeuronsRef.current = bgN;
  }, [phases, dimensions]);

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

    const drawSynapse = (ctx: CanvasRenderingContext2D, syn: Synapse, neurons: Neuron[], t: number) => {
      const from = neurons[syn.from];
      const to = neurons[syn.to];
      if (!from || !to) return;

      ctx.save();

      const baseAlpha = syn.active ? 0.12 : 0.025;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = `rgba(255,255,255,${baseAlpha})`;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      if (syn.active || syn.signal > 0) {
        const signalPos = (t * 0.005 + syn.from * 0.2) % 1;
        const sx = from.x + (to.x - from.x) * signalPos;
        const sy = from.y + (to.y - from.y) * signalPos;

        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 8);
        const signalColor = from.firing ? from.color : to.color;
        glow.addColorStop(0, `${signalColor}40`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, sy, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fillStyle = signalColor;
        ctx.globalAlpha = 0.8;
        ctx.fill();
      }

      ctx.restore();
    };

    const drawNeuron = (ctx: CanvasRenderingContext2D, neuron: Neuron, t: number, hovered: boolean) => {
      const pulse = Math.sin(t * 0.004 + neuron.firePhase) * 0.2 + 0.8;
      const intensity = neuron.fireIntensity * pulse;
      const r = neuron.radius * (hovered ? 1.15 : 1);

      ctx.save();

      if (intensity > 0.2) {
        const outerGlow = ctx.createRadialGradient(
          neuron.x, neuron.y, 0,
          neuron.x, neuron.y, r * 3,
        );
        outerGlow.addColorStop(0, `${neuron.color}${Math.round(intensity * 20).toString(16).padStart(2, "0")}`);
        outerGlow.addColorStop(0.5, `${neuron.color}${Math.round(intensity * 6).toString(16).padStart(2, "0")}`);
        outerGlow.addColorStop(1, "transparent");
        ctx.fillStyle = outerGlow;
        ctx.beginPath();
        ctx.arc(neuron.x, neuron.y, r * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      const bodyGrad = ctx.createRadialGradient(
        neuron.x, neuron.y, 0,
        neuron.x, neuron.y, r,
      );
      bodyGrad.addColorStop(0, `${neuron.color}${Math.round(intensity * 25).toString(16).padStart(2, "0")}`);
      bodyGrad.addColorStop(0.7, `${neuron.color}${Math.round(intensity * 10).toString(16).padStart(2, "0")}`);
      bodyGrad.addColorStop(1, `${neuron.color}05`);
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(neuron.x, neuron.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(neuron.x, neuron.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = `${neuron.color}${Math.round(intensity * 50 + 10).toString(16).padStart(2, "0")}`;
      ctx.lineWidth = hovered ? 2 : 1;
      ctx.stroke();

      if (neuron.firing) {
        const fireFlash = Math.sin(t * 0.02 + neuron.firePhase) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.arc(neuron.x, neuron.y, 3 + fireFlash * 3, 0, Math.PI * 2);
        ctx.fillStyle = neuron.color;
        ctx.globalAlpha = 0.6 + fireFlash * 0.4;
        ctx.fill();
        ctx.globalAlpha = 1;

        const ringR = r * (0.6 + (t * 0.01 + neuron.firePhase) % 1 * 0.4);
        ctx.beginPath();
        ctx.arc(neuron.x, neuron.y, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `${neuron.color}10`;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(neuron.x, neuron.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fill();
      }

      ctx.font = "9px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(255,255,255,${0.4 + intensity * 0.4})`;
      ctx.fillText(neuron.label, neuron.x, neuron.y + r + 14);

      if (neuron.version > 0) {
        ctx.font = "bold 7px Inter, system-ui, sans-serif";
        ctx.fillStyle = neuron.color;
        ctx.globalAlpha = 0.6;
        ctx.fillText(`v${neuron.version}`, neuron.x, neuron.y + r + 23);
        ctx.globalAlpha = 1;
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

      ctx.fillStyle = "#060a14";
      ctx.fillRect(0, 0, w, h);

      const bgN = bgNeuronsRef.current;
      for (const bn of bgN) {
        const alpha = bn.alpha * (0.5 + Math.sin(t * bn.pulseSpeed + bn.phase) * 0.5);
        ctx.save();
        ctx.beginPath();
        ctx.arc(bn.x, bn.y, bn.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139, 92, 246, ${alpha})`;
        ctx.fill();
        ctx.restore();
      }

      for (let i = 0; i < bgN.length - 1; i++) {
        const a = bgN[i];
        const b = bgN[i + 1];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < 100) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(139, 92, 246, ${0.02 * (1 - dist / 100)})`;
          ctx.lineWidth = 0.3;
          ctx.stroke();
          ctx.restore();
        }
      }

      const neurons = neuronsRef.current;
      const synapses = synapsesRef.current;

      for (const syn of synapses) {
        drawSynapse(ctx, syn, neurons, t);
      }

      let foundHover: Neuron | null = null;
      for (const neuron of neurons) {
        const dist = Math.hypot(mouseRef.current.x - neuron.x, mouseRef.current.y - neuron.y);
        const hovered = dist < neuron.radius * 1.3;
        if (hovered) foundHover = neuron;
        drawNeuron(ctx, neuron, t, hovered);
      }

      if (foundHover !== hoveredNeuron) {
        setHoveredNeuron(foundHover);
      }

      const firing = firingRef.current;
      for (let i = firing.length - 1; i >= 0; i--) {
        firing[i].progress += 0.015;
        if (firing[i].progress > 1) {
          firing.splice(i, 1);
          continue;
        }
        const ev = firing[i];
        const n = neurons[ev.neuronIdx];
        if (!n) continue;

        const rippleR = n.radius * (1 + ev.progress * 4);
        const alpha = (1 - ev.progress) * 0.3;
        ctx.save();
        ctx.beginPath();
        ctx.arc(n.x, n.y, rippleR, 0, Math.PI * 2);
        ctx.strokeStyle = `${ev.color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
        ctx.lineWidth = 2 * (1 - ev.progress);
        ctx.stroke();
        ctx.restore();
      }

      if (t % 120 === 0 && hasData) {
        const firingNeurons = neurons.filter((n) => n.firing);
        if (firingNeurons.length > 0) {
          const idx = neurons.indexOf(firingNeurons[Math.floor(Math.random() * firingNeurons.length)]);
          firingRef.current.push({
            neuronIdx: idx,
            progress: 0,
            color: neurons[idx].color,
          });
        }
      }

      ctx.save();
      ctx.font = "bold 10px Inter, system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.textAlign = "center";
      const activeCount = neurons.filter((n) => n.firing).length;
      ctx.fillText(
        `${activeCount}/${neurons.length} ACTIVE`,
        w / 2, h - 16,
      );
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
  }, [dimensions, hasData, hoveredNeuron]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  return (
    <div className="relative w-full rounded-xl overflow-hidden" style={{ border: "1px solid rgba(139,92,246,0.1)" }}>
      <canvas
        ref={canvasRef}
        className="w-full cursor-crosshair"
        style={{ height: 520 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { mouseRef.current = { x: -999, y: -999 }; setHoveredNeuron(null); }}
      />
      {hoveredNeuron && (
        <div
          className="absolute pointer-events-none rounded-lg px-3 py-2 z-10"
          style={{
            left: Math.min(hoveredNeuron.x + 20, dimensions.w - 220),
            top: Math.max(10, hoveredNeuron.y - 70),
            background: "rgba(6, 10, 20, 0.95)",
            border: `1px solid ${hoveredNeuron.color}30`,
            backdropFilter: "blur(12px)",
          }}
        >
          <p className="text-[11px] font-bold" style={{ color: hoveredNeuron.color }}>
            {hoveredNeuron.label}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-[9px] px-1.5 py-0.5 rounded font-medium"
              style={{
                background: hoveredNeuron.firing ? `${hoveredNeuron.color}15` : "rgba(255,255,255,0.05)",
                color: hoveredNeuron.firing ? hoveredNeuron.color : "rgba(255,255,255,0.4)",
              }}
            >
              {hoveredNeuron.status}
            </span>
            {hoveredNeuron.version > 0 && (
              <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                v{hoveredNeuron.version}
              </span>
            )}
          </div>
          {hoveredNeuron.itemCount > 0 && (
            <p className="text-[9px] mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              {hoveredNeuron.itemCount} items
            </p>
          )}
          <p className="text-[8px] mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
            {hoveredNeuron.connections.length} connections
          </p>
        </div>
      )}
      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>Neural grid dormant</p>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>Run the pipeline to activate execution neurons</p>
          </div>
        </div>
      )}
    </div>
  );
}
