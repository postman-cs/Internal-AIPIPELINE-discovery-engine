"use client";

import { useCallback, useRef } from "react";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.15,
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, startTime);
  g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(g).connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function playXpGain() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;
  playTone(ctx, 880, t, 0.08, "sine", 0.12);
  playTone(ctx, 1320, t + 0.06, 0.12, "sine", 0.1);
}

function playLevelUp() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
  notes.forEach((freq, i) => {
    playTone(ctx, freq, t + i * 0.12, 0.25, "sine", 0.12);
  });
  playTone(ctx, 1046.5, t + notes.length * 0.12, 0.5, "triangle", 0.08);
}

function playMilestone() {
  const ctx = getAudioContext();
  const t = ctx.currentTime;
  [261.63, 329.63, 392.0, 523.25].forEach((freq, i) => {
    playTone(ctx, freq, t + i * 0.08, 0.4, "sine", 0.1);
    playTone(ctx, freq * 1.5, t + i * 0.08, 0.35, "triangle", 0.06);
  });
}

type SoundName = "xp-gain" | "level-up" | "milestone";

const soundMap: Record<SoundName, () => void> = {
  "xp-gain": playXpGain,
  "level-up": playLevelUp,
  milestone: playMilestone,
};

export function useSound() {
  const enabled = useRef(true);

  const play = useCallback((name: SoundName) => {
    if (!enabled.current) return;
    try {
      soundMap[name]();
    } catch {
      // Web Audio not available in this environment
    }
  }, []);

  const toggle = useCallback(() => {
    enabled.current = !enabled.current;
    return enabled.current;
  }, []);

  return { play, toggle, enabled };
}
