"use client";

import { useState, useTransition } from "react";
import { togglePlugin } from "./actions";

export function PluginToggleButton({
  phase,
  name,
  enabled: initialEnabled,
}: {
  phase: string;
  name: string;
  enabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      const result = await togglePlugin(phase, name, !enabled);
      if (result.success) {
        setEnabled(!enabled);
      }
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className="shrink-0 relative w-10 h-5 rounded-full transition-all duration-200"
      style={{
        background: enabled ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.08)",
        border: `1px solid ${enabled ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.1)"}`,
      }}
      title={enabled ? "Disable plugin" : "Enable plugin"}
    >
      <span
        className="absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all duration-200"
        style={{
          left: enabled ? 20 : 3,
          background: enabled ? "#34d399" : "var(--foreground-dim)",
          boxShadow: enabled ? "0 0 6px rgba(16,185,129,0.4)" : "none",
        }}
      />
    </button>
  );
}
