"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
      <h2 style={{ color: "var(--foreground)", marginBottom: 8 }}>Something went wrong</h2>
      <p style={{ color: "var(--foreground-dim)", marginBottom: 24, maxWidth: 400, margin: "0 auto 24px" }}>{error.message}</p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <button onClick={reset} className="btn-primary">Try Again</button>
        <a href="/dashboard" className="btn-ghost">Go Home</a>
      </div>
    </div>
  );
}
