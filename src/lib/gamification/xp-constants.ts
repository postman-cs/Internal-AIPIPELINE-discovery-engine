// Pure XP constants and utility functions — safe for client and server use.
// Levels track the evolution of a planet from dust to a multi-planet civilization.

export const LEVELS: readonly { level: number; xp: number; title: string; color: string; description: string }[] = [
  { level: 1,  xp: 0,      title: "Stardust",      color: "#7a829a", description: "Swirling cosmic dust begins to coalesce" },
  { level: 2,  xp: 300,    title: "Molten",         color: "#ef4444", description: "A molten sphere glows with primal heat" },
  { level: 3,  xp: 800,    title: "Cratered",       color: "#a1a1aa", description: "The crust cools under a bombardment of meteors" },
  { level: 4,  xp: 1600,   title: "Tidebreak",      color: "#3b82f6", description: "Oceans surge across the young surface" },
  { level: 5,  xp: 3000,   title: "Veil",           color: "#8b5cf6", description: "An atmosphere wraps the world in haze" },
  { level: 6,  xp: 5000,   title: "Spark",          color: "#22c55e", description: "First life flickers in the deep" },
  { level: 7,  xp: 8000,   title: "Bloom",          color: "#10b981", description: "Green canopy overtakes the continents" },
  { level: 8,  xp: 12000,  title: "Wilds",          color: "#f59e0b", description: "Complex ecosystems thrive across biomes" },
  { level: 9,  xp: 18000,  title: "Ascent",         color: "#06d6d6", description: "Civilization rises from the wilds" },
  { level: 10, xp: 26000,  title: "Forge",          color: "#f97316", description: "Industry reshapes the world" },
  { level: 11, xp: 38000,  title: "Starbound",      color: "#ec4899", description: "Ships pierce the atmosphere" },
  { level: 12, xp: 55000,  title: "Constellation",  color: "#fbbf24", description: "A multi-planet civilization spans the stars" },
];

export const MAX_LEVEL = LEVELS[LEVELS.length - 1].level;

export interface LevelInfo {
  level: number;
  title: string;
  color: string;
  description: string;
  currentXp: number;
  levelFloorXp: number;
  nextLevelXp: number | null;
  progress: number;
  totalXp: number;
}

export function getLevelInfo(totalXp: number): LevelInfo {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (totalXp >= l.xp) current = l;
    else break;
  }

  const nextIdx = LEVELS.findIndex((l) => l.level === current.level) + 1;
  const next = nextIdx < LEVELS.length ? LEVELS[nextIdx] : null;

  const floorXp = current.xp;
  const ceilXp = next?.xp ?? current.xp;
  const range = ceilXp - floorXp;
  const progress = range > 0 ? Math.min(1, (totalXp - floorXp) / range) : 1;

  return {
    level: current.level,
    title: current.title,
    color: current.color,
    description: current.description,
    currentXp: totalXp - floorXp,
    levelFloorXp: floorXp,
    nextLevelXp: next?.xp ?? null,
    progress,
    totalXp,
  };
}

export const XP_ACTIONS = {
  STAGE_ADVANCE: { action: "stage_advance", points: 10, label: "Stage Advance" },
  POV_DELIVERED: { action: "pov_delivered", points: 100, label: "Pilot Validated" },
  CASE_STUDY:   { action: "case_study",   points: 500, label: "Case Study" },
  CASCADE_RUN:  { action: "cascade_run",  points: 5,   label: "Cascade Run" },
  BLOCKER_RESOLVED: { action: "blocker_resolved", points: 15, label: "Blocker Resolved" },
  ASSUMPTION_VERIFIED: { action: "assumption_verified", points: 5, label: "Assumption Verified" },
  TASK_COMPLETED: { action: "task_completed", points: 20, label: "Task Completed" },
  DISCOVERY_ENTRY: { action: "discovery_entry", points: 10, label: "Discovery Entry" },
  BUILD_LOG_DELIVERED: { action: "build_log_delivered", points: 50, label: "Build Log Delivered" },
  MEETING_COMPLETED: { action: "meeting_completed", points: 50, label: "Meeting Completed" },
  WORKING_SESSION_COMPLETED: { action: "working_session_completed", points: 50, label: "Working Session Completed" },
  DEPLOYMENT_STEP_EXECUTED: { action: "deployment_step_executed", points: 25, label: "Deployment Step Executed" },
  POC_DELIVERABLE: { action: "poc_deliverable_completed", points: 75, label: "POC Deliverable Completed" },
  ARCHITECTURE_MAPPED: { action: "architecture_mapped", points: 100, label: "Architecture Mapped" },
} as const;

export function getActionLabel(action: string): string {
  const entry = Object.values(XP_ACTIONS).find((a) => a.action === action);
  return entry?.label ?? action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
