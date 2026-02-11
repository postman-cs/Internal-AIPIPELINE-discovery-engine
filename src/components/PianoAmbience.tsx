"use client";

import { useEffect, useRef, useCallback, useState } from "react";

/**
 * PianoAmbience — Relaxing piano tones on click interactions
 *
 * Uses the Web Audio API to synthesize soft piano-like sounds.
 * Notes are drawn from pentatonic scales in different octaves,
 * with gentle attack/decay for a warm, ambient feel.
 *
 * Features:
 *  - Random note selection from curated relaxing scales
 *  - Occasional two-note harmonies
 *  - Gentle reverb via convolution
 *  - Volume randomization for natural dynamics
 *  - Mute toggle persisted to localStorage
 */

// Pentatonic scale frequencies across multiple octaves (C major pentatonic: C D E G A)
// These combinations always sound pleasant together
const SCALE_POOLS = [
  // Dreamy / ethereal (higher register)
  [523.25, 587.33, 659.26, 783.99, 880.00, 1046.50, 1174.66],
  // Warm / grounded (mid register)
  [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33],
  // Deep / contemplative (lower register)
  [130.81, 146.83, 164.81, 196.00, 220.00, 261.63, 293.66],
];

// Chord intervals that sound nice over a root (in semitone offsets)
const HARMONY_INTERVALS = [3, 4, 5, 7, 12]; // minor 3rd, major 3rd, 4th, 5th, octave

function freqToSemitoneShift(freq: number, semitones: number): number {
  return freq * Math.pow(2, semitones / 12);
}

export function PianoAmbience() {
  const ctxRef = useRef<AudioContext | null>(null);
  const reverbRef = useRef<ConvolverNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const lastNoteRef = useRef(0);
  const lastPoolRef = useRef(0);
  const noteCountRef = useRef(0);
  const [muted, setMuted] = useState(true); // start muted until user opts in
  const [initialized, setInitialized] = useState(false);

  // Create a simple impulse response for reverb
  const createReverb = useCallback((ctx: AudioContext): ConvolverNode => {
    const convolver = ctx.createConvolver();
    const rate = ctx.sampleRate;
    const length = rate * 2.5; // 2.5 second reverb tail
    const impulse = ctx.createBuffer(2, length, rate);

    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Exponential decay with slight randomization for natural room feel
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
      }
    }
    convolver.buffer = impulse;
    return convolver;
  }, []);

  const initAudio = useCallback(() => {
    if (ctxRef.current) return;
    try {
      const ctx = new AudioContext();
      const masterGain = ctx.createGain();
      masterGain.gain.value = 0.12; // Keep it subtle
      const reverb = createReverb(ctx);
      const reverbGain = ctx.createGain();
      reverbGain.gain.value = 0.35; // Wet mix

      // Dry path
      masterGain.connect(ctx.destination);
      // Wet path (through reverb)
      masterGain.connect(reverb);
      reverb.connect(reverbGain);
      reverbGain.connect(ctx.destination);

      ctxRef.current = ctx;
      reverbRef.current = reverb;
      gainRef.current = masterGain;
      setInitialized(true);
    } catch {
      // Web Audio not available
    }
  }, [createReverb]);

  const playNote = useCallback((freq: number, velocity: number, delay: number = 0) => {
    const ctx = ctxRef.current;
    const master = gainRef.current;
    if (!ctx || !master) return;

    const now = ctx.currentTime + delay;

    // Oscillator — use a combination for richer piano-like tone
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();

    // Fundamental (triangle for warmth)
    osc1.type = "triangle";
    osc1.frequency.value = freq;

    // Soft sine an octave up (adds brightness)
    osc2.type = "sine";
    osc2.frequency.value = freq * 2;

    // Very faint sine two octaves up (shimmer)
    osc3.type = "sine";
    osc3.frequency.value = freq * 4;

    // Individual gains for mixing
    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();
    const gain3 = ctx.createGain();

    gain1.gain.value = velocity * 0.5;
    gain2.gain.value = velocity * 0.15;
    gain3.gain.value = velocity * 0.05;

    osc1.connect(gain1);
    osc2.connect(gain2);
    osc3.connect(gain3);

    // Envelope node
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, now);

    // Soft attack
    const attackTime = 0.01 + Math.random() * 0.02;
    envelope.gain.linearRampToValueAtTime(1, now + attackTime);

    // Quick initial decay to sustain level
    const decayTime = 0.15 + Math.random() * 0.1;
    const sustainLevel = 0.3 + Math.random() * 0.15;
    envelope.gain.exponentialRampToValueAtTime(sustainLevel, now + attackTime + decayTime);

    // Long gentle release
    const releaseTime = 1.5 + Math.random() * 2.0;
    envelope.gain.exponentialRampToValueAtTime(0.001, now + attackTime + decayTime + releaseTime);

    gain1.connect(envelope);
    gain2.connect(envelope);
    gain3.connect(envelope);
    envelope.connect(master);

    const stopTime = now + attackTime + decayTime + releaseTime + 0.1;
    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    osc1.stop(stopTime);
    osc2.stop(stopTime);
    osc3.stop(stopTime);
  }, []);

  const handleClick = useCallback(() => {
    if (!ctxRef.current || muted) return;

    // Resume audio context if suspended (browser policy)
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }

    // Throttle — don't play notes faster than every 120ms
    const now = Date.now();
    if (now - lastNoteRef.current < 120) return;
    lastNoteRef.current = now;

    // Cycle through scale pools with some randomness for variety
    noteCountRef.current++;
    if (noteCountRef.current % 8 === 0 || Math.random() < 0.15) {
      lastPoolRef.current = Math.floor(Math.random() * SCALE_POOLS.length);
    }

    const pool = SCALE_POOLS[lastPoolRef.current];
    const freq = pool[Math.floor(Math.random() * pool.length)];
    const velocity = 0.3 + Math.random() * 0.5;

    playNote(freq, velocity);

    // Occasionally add a harmony note (20% chance)
    if (Math.random() < 0.2) {
      const interval = HARMONY_INTERVALS[Math.floor(Math.random() * HARMONY_INTERVALS.length)];
      const harmonyFreq = freqToSemitoneShift(freq, interval);
      playNote(harmonyFreq, velocity * 0.4, 0.05 + Math.random() * 0.08);
    }

    // Rarely play a gentle two-note descending motif (8% chance)
    if (Math.random() < 0.08) {
      const secondNote = pool[Math.floor(Math.random() * pool.length)];
      playNote(secondNote, velocity * 0.35, 0.2 + Math.random() * 0.15);
    }
  }, [muted, playNote]);

  // Attach click listener to the whole document
  useEffect(() => {
    document.addEventListener("click", handleClick, { passive: true });
    return () => document.removeEventListener("click", handleClick);
  }, [handleClick]);

  // Load mute preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("piano-ambience-muted");
    if (saved === "false") {
      setMuted(false);
      initAudio();
    }
  }, [initAudio]);

  const toggleMute = useCallback(() => {
    if (!initialized) initAudio();
    const next = !muted;
    setMuted(next);
    localStorage.setItem("piano-ambience-muted", String(next));
    if (!next && ctxRef.current?.state === "suspended") {
      ctxRef.current.resume();
    }
  }, [muted, initialized, initAudio]);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation(); // Don't trigger a note for the mute toggle itself
        toggleMute();
      }}
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium transition-all duration-300"
      style={{
        background: muted ? "rgba(17, 21, 36, 0.8)" : "rgba(6, 214, 214, 0.08)",
        border: `1px solid ${muted ? "var(--border)" : "rgba(6, 214, 214, 0.2)"}`,
        color: muted ? "var(--foreground-dim)" : "var(--accent-cyan)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      title={muted ? "Enable ambient piano sounds" : "Mute ambient piano sounds"}
      aria-label={muted ? "Enable ambient piano sounds" : "Mute ambient piano sounds"}
    >
      {muted ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
          <span>Sound Off</span>
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <span>Piano</span>
        </>
      )}
    </button>
  );
}
