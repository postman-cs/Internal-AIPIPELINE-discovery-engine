"use server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";

export async function globalSearch(query: string) {
  const session = await requireAuth();
  if (!query || query.length < 2) return { results: { projects: [], documents: [], assumptions: [], blockers: [] } };

  const [projects, documents, assumptions, blockers] = await Promise.all([
    prisma.project.findMany({
      where: { ownerUserId: session.userId, name: { contains: query, mode: "insensitive" } },
      take: 5,
      select: { id: true, name: true, primaryDomain: true },
    }),
    prisma.sourceDocument.findMany({
      where: {
        project: { ownerUserId: session.userId },
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { rawText: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, title: true, projectId: true, sourceType: true, rawText: true },
    }),
    prisma.assumption.findMany({
      where: {
        project: { ownerUserId: session.userId },
        claim: { contains: query, mode: "insensitive" },
      },
      take: 5,
      select: { id: true, claim: true, projectId: true, phase: true, status: true },
    }),
    prisma.blocker.findMany({
      where: {
        project: { ownerUserId: session.userId },
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 5,
      select: { id: true, title: true, projectId: true, severity: true, status: true },
    }),
  ]);

  return {
    results: {
      projects: projects.map(p => ({ ...p, type: "project" as const, url: `/projects/${p.id}` })),
      documents: documents.map(d => ({ ...d, type: "document" as const, url: `/projects/${d.projectId}/discovery`, snippet: d.rawText?.slice(0, 120) })),
      assumptions: assumptions.map(a => ({ ...a, type: "assumption" as const, url: `/projects/${a.projectId}/assumptions` })),
      blockers: blockers.map(b => ({ ...b, type: "blocker" as const, url: `/projects/${b.projectId}/blockers` })),
    },
  };
}
