"use client";

import { useEffect, useRef } from "react";
import { getActionLabel, LEVELS } from "@/lib/gamification/xp-constants";
import type { LevelInfo } from "@/lib/gamification/xp-constants";
import dynamic from "next/dynamic";

const PlanetEvolution = dynamic(() => import("@/app/(authenticated)/dashboard/PlanetEvolution"), { ssr: false });

interface LeaderboardEntry {
  id: string;
  name: string;
  email: string;
  xp: number;
  xpLevel: number;
  xpStreak: number;
  levelInfo: LevelInfo;
  projectCount: number;
}

interface XpEvent {
  id: string;
  action: string;
  points: number;
  createdAt: string;
  projectName: string | null;
  userName: string | null;
}

interface XpLeaderboardProps {
  leaderboard: LeaderboardEntry[];
  recentEvents: XpEvent[];
  totalTeamXp: number;
}

const RANK_COLORS = ["#fbbf24", "#c0c0c0", "#cd7f32"] as const;

// ─── Background Particles ───────────────────────────────────────────────────

function LeaderboardParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      ctx.scale(2, 2);
    };
    resize();

    const W = () => canvas.offsetWidth;
    const H = () => canvas.offsetHeight;

    const particles = Array.from({ length: 25 }, () => ({
      x: Math.random() * W(),
      y: Math.random() * H(),
      vx: (Math.random() - 0.5) * 0.2,
      vy: -0.1 - Math.random() * 0.3,
      r: 0.5 + Math.random() * 1.5,
      alpha: 0.1 + Math.random() * 0.3,
      color: Math.random() > 0.5 ? "rgba(251, 191, 36," : "rgba(6, 214, 214,",
    }));

    let raf: number;
    const animate = () => {
      ctx.clearRect(0, 0, W(), H());
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -5) { p.y = H() + 5; p.x = Math.random() * W(); }
        if (p.x < 0 || p.x > W()) p.vx *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.alpha})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none opacity-50"
    />
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function XpLeaderboard({ leaderboard, recentEvents, totalTeamXp }: XpLeaderboardProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Leaderboard */}
      <div className="lg:col-span-2 card-glow relative overflow-hidden">
        <LeaderboardParticles />
        <div className="relative z-[5]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold" style={{ color: "#fbbf24" }}>
              ⚡ CSE XP Leaderboard
            </h2>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(251, 191, 36, 0.08)", border: "1px solid rgba(251, 191, 36, 0.15)" }}>
              <span className="text-xs" style={{ color: "var(--foreground-muted)" }}>Team Total</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: "#fbbf24" }}>
                {totalTeamXp.toLocaleString()} XP
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {leaderboard.map((entry, rank) => {
              const levelColor = entry.levelInfo.color;
              const isTop3 = rank < 3;
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200"
                  style={{
                    background: isTop3 ? `rgba(251, 191, 36, ${0.04 - rank * 0.01})` : "rgba(17, 21, 36, 0.5)",
                    border: `1px solid ${isTop3 ? `${RANK_COLORS[rank]}30` : "var(--border)"}`,
                    boxShadow: isTop3 ? `0 0 20px ${RANK_COLORS[rank]}15` : "none",
                    animation: `fade-in 0.3s ease-out ${rank * 0.06}s both`,
                  }}
                >
                  {/* Rank */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{
                      background: isTop3 ? `${RANK_COLORS[rank]}20` : "var(--surface)",
                      color: isTop3 ? RANK_COLORS[rank] : "var(--foreground-dim)",
                      border: isTop3 ? `1px solid ${RANK_COLORS[rank]}40` : "1px solid var(--border)",
                    }}
                  >
                    {rank + 1}
                  </div>

                  {/* Mini Planet */}
                  <div className="shrink-0" style={{ filter: `drop-shadow(0 0 6px ${levelColor}44)` }}>
                    <PlanetEvolution level={entry.xpLevel} size={40} />
                  </div>

                  {/* Name & Title */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                        {entry.name}
                      </span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: `${levelColor}15`, color: levelColor }}>
                        {entry.levelInfo.title}
                      </span>
                      {entry.xpStreak > 0 && (
                        <span className="text-xs" title={`${entry.xpStreak} day streak`}>
                          🔥{entry.xpStreak}
                        </span>
                      )}
                    </div>
                    {/* Mini XP bar */}
                    <div className="flex items-center gap-2 mt-1">
                      <div
                        className="h-1.5 flex-1 rounded-full overflow-hidden"
                        style={{ background: "var(--background-secondary)", maxWidth: 200 }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${entry.levelInfo.progress * 100}%`,
                            background: `linear-gradient(90deg, ${levelColor}, ${levelColor}88)`,
                            boxShadow: `0 0 6px ${levelColor}44`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums" style={{ color: "var(--foreground-dim)" }}>
                        {entry.projectCount} project{entry.projectCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  {/* XP total */}
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold tabular-nums" style={{ color: isTop3 ? RANK_COLORS[rank] : "var(--foreground)" }}>
                      {entry.xp.toLocaleString()}
                    </span>
                    <span className="text-[10px] ml-0.5" style={{ color: "var(--foreground-dim)" }}>XP</span>
                  </div>
                </div>
              );
            })}

            {leaderboard.length === 0 && (
              <p className="text-sm text-center py-6" style={{ color: "var(--foreground-muted)" }}>
                No CSEs have earned XP yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Level Distribution + Activity Feed */}
      <div className="space-y-6">
        {/* Planet Evolution Chart */}
        <div className="card-glow">
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
            Planet Evolution
          </h3>
          <div className="space-y-1.5">
            {[...LEVELS].reverse().map((lvl) => {
              const count = leaderboard.filter((e) => e.xpLevel === lvl.level).length;
              return (
                <div key={lvl.level} className="flex items-center gap-2">
                  <div className="shrink-0">
                    <PlanetEvolution level={lvl.level} size={20} animate={false} />
                  </div>
                  <span className="text-[10px] w-20 truncate" style={{ color: `${lvl.color}cc` }}>
                    {lvl.title}
                  </span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--background-secondary)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: leaderboard.length > 0 ? `${(count / leaderboard.length) * 100}%` : "0%",
                        background: lvl.color,
                        boxShadow: count > 0 ? `0 0 8px ${lvl.color}44` : "none",
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono w-4 text-right" style={{ color: "var(--foreground-dim)" }}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="card-glow">
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--foreground)" }}>
            Recent Activity
          </h3>
          {recentEvents.length > 0 ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {recentEvents.map((evt, i) => (
                <div
                  key={evt.id}
                  className="flex items-start gap-2 py-1.5 text-xs"
                  style={{
                    animation: `fade-in 0.3s ease-out ${i * 0.05}s both`,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span className="font-bold tabular-nums shrink-0" style={{ color: "#fbbf24" }}>
                    +{evt.points}
                  </span>
                  <div className="min-w-0">
                    <span style={{ color: "var(--foreground)" }}>
                      {evt.userName ?? "Unknown"}
                    </span>
                    <span style={{ color: "var(--foreground-muted)" }}>
                      {" "}· {getActionLabel(evt.action)}
                    </span>
                    {evt.projectName && (
                      <span className="block truncate" style={{ color: "var(--foreground-dim)" }}>
                        {evt.projectName}
                      </span>
                    )}
                  </div>
                  <span className="ml-auto shrink-0 tabular-nums" style={{ color: "var(--foreground-dim)" }}>
                    {formatTimeAgo(new Date(evt.createdAt))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-center py-4" style={{ color: "var(--foreground-muted)" }}>
              No XP events yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}
