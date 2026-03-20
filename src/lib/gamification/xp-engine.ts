import { prisma } from "@/lib/prisma";
import { getLevelInfo, type LevelInfo } from "@/lib/gamification/xp-constants";

export { LEVELS, MAX_LEVEL, getLevelInfo, XP_ACTIONS, getActionLabel } from "@/lib/gamification/xp-constants";
export type { LevelInfo } from "@/lib/gamification/xp-constants";

// ─── Core Award Function ────────────────────────────────────────────────────────

export interface AwardResult {
  newXp: number;
  newLevel: number;
  previousLevel: number;
  leveledUp: boolean;
  points: number;
  action: string;
}

export async function awardXp(
  userId: string,
  action: string,
  points: number,
  projectId?: string | null,
  metadata?: Record<string, unknown>,
): Promise<AwardResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true, xpLevel: true, lastXpEventAt: true, xpStreak: true },
  });
  if (!user) throw new Error(`User ${userId} not found`);

  const previousLevel = user.xpLevel;
  const newXp = user.xp + points;
  const levelInfo = getLevelInfo(newXp);

  // Streak: if last XP event was yesterday, increment; if today, keep; otherwise reset
  let newStreak = user.xpStreak;
  if (user.lastXpEventAt) {
    const lastDay = new Date(user.lastXpEventAt).toDateString();
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400_000).toDateString();
    if (lastDay === yesterday) newStreak += 1;
    else if (lastDay !== today) newStreak = 1;
  } else {
    newStreak = 1;
  }

  await prisma.$transaction([
    prisma.xpEvent.create({
      data: {
        userId,
        projectId: projectId ?? null,
        action,
        points,
        metadata: metadata ?? undefined,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        xp: newXp,
        xpLevel: levelInfo.level,
        xpStreak: newStreak,
        lastXpEventAt: new Date(),
      },
    }),
  ]);

  return {
    newXp,
    newLevel: levelInfo.level,
    previousLevel,
    leveledUp: levelInfo.level > previousLevel,
    points,
    action,
  };
}

// ─── Queries ────────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  id: string;
  name: string;
  email: string;
  xp: number;
  xpLevel: number;
  xpStreak: number;
  levelInfo: LevelInfo;
  projectCount: number;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const users = await prisma.user.findMany({
    where: { role: "CSE" },
    select: {
      id: true, name: true, email: true,
      xp: true, xpLevel: true, xpStreak: true,
      _count: { select: { projects: true } },
    },
    orderBy: { xp: "desc" },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    xp: u.xp,
    xpLevel: u.xpLevel,
    xpStreak: u.xpStreak,
    levelInfo: getLevelInfo(u.xp),
    projectCount: u._count.projects,
  }));
}

export interface XpEventEntry {
  id: string;
  action: string;
  points: number;
  createdAt: Date;
  projectName: string | null;
  userName: string | null;
}

export async function getRecentXpEvents(
  userId?: string,
  limit = 10,
): Promise<XpEventEntry[]> {
  const events = await prisma.xpEvent.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      project: { select: { name: true } },
      user: { select: { name: true } },
    },
  });

  return events.map((e) => ({
    id: e.id,
    action: e.action,
    points: e.points,
    createdAt: e.createdAt,
    projectName: e.project?.name ?? null,
    userName: e.user?.name ?? null,
  }));
}

export async function getUserXpData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true, xpLevel: true, xpStreak: true, lastXpEventAt: true },
  });
  if (!user) return null;

  const levelInfo = getLevelInfo(user.xp);
  const recentEvents = await getRecentXpEvents(userId, 5);

  return { ...user, levelInfo, recentEvents };
}
