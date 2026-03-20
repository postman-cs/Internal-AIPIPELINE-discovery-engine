import { prisma } from "@/lib/prisma";

const SOURCE_RELIABILITY: Record<string, number> = {
  KEPLER: 90,
  OPENAPI: 85,
  POSTMAN: 80,
  GITHUB: 75,
  DNS: 70,
  HEADERS: 65,
  GMAIL: 60,
  MANUAL: 50,
  UPLOAD: 40,
  SLACK: 55,
};

export function computeFreshnessScore(doc: { sourceType: string; createdAt: Date; lastVerifiedAt: Date | null }): number {
  const now = Date.now();
  const ageMs = now - doc.createdAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  const baseReliability = SOURCE_RELIABILITY[doc.sourceType] ?? 50;

  const agePenalty = Math.min(ageDays, 60);

  let verificationBonus = 0;
  if (doc.lastVerifiedAt) {
    const sinceVerified = (now - doc.lastVerifiedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (sinceVerified < 7) verificationBonus = 20;
    else if (sinceVerified < 30) verificationBonus = 10;
  }

  return Math.max(0, Math.min(100, Math.round(baseReliability - agePenalty + verificationBonus)));
}

export async function refreshFreshnessScores(projectId: string) {
  const docs = await prisma.sourceDocument.findMany({
    where: { projectId },
    select: { id: true, sourceType: true, createdAt: true, lastVerifiedAt: true },
  });

  for (const doc of docs) {
    const score = computeFreshnessScore(doc);
    await prisma.sourceDocument.update({
      where: { id: doc.id },
      data: { freshnessScore: score },
    });
  }

  const staleCount = await prisma.sourceDocument.count({
    where: { projectId, freshnessScore: { lt: 40 } },
  });

  return { totalDocs: docs.length, staleCount };
}
