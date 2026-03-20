import DataLoader from "dataloader";
import { prisma } from "@/lib/prisma";

export function createProjectLoader() {
  return new DataLoader<string, unknown[]>(async (userIds) => {
    const projects = await prisma.project.findMany({
      where: { ownerUserId: { in: [...userIds] } },
    });
    return userIds.map((uid) => projects.filter((p) => p.ownerUserId === uid));
  });
}

export function createPhaseArtifactLoader() {
  return new DataLoader<string, unknown[]>(async (projectIds) => {
    const artifacts = await prisma.phaseArtifact.findMany({
      where: { projectId: { in: [...projectIds] } },
    });
    return projectIds.map((pid) => artifacts.filter((a) => a.projectId === pid));
  });
}

export function createAssumptionLoader() {
  return new DataLoader<string, unknown[]>(async (projectIds) => {
    const assumptions = await prisma.assumption.findMany({
      where: { projectId: { in: [...projectIds] } },
    });
    return projectIds.map((pid) => assumptions.filter((a) => a.projectId === pid));
  });
}

export function createBlockerLoader() {
  return new DataLoader<string, unknown[]>(async (projectIds) => {
    const blockers = await prisma.blocker.findMany({
      where: { projectId: { in: [...projectIds] } },
    });
    return projectIds.map((pid) => blockers.filter((b) => b.projectId === pid));
  });
}

export function createRequestScopedLoaders() {
  return {
    projects: createProjectLoader(),
    phaseArtifacts: createPhaseArtifactLoader(),
    assumptions: createAssumptionLoader(),
    blockers: createBlockerLoader(),
  };
}
