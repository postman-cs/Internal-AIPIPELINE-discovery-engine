import { vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    project: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    aIRun: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    assumption: { create: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
    blocker: { create: vi.fn(), findMany: vi.fn() },
    phaseArtifact: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    proposal: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    recomputeJob: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    recomputeTask: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    documentChunk: { count: vi.fn(), findMany: vi.fn() },
    sourceDocument: { create: vi.fn(), findMany: vi.fn() },
    evidenceSnapshot: { create: vi.fn(), findFirst: vi.fn() },
    discoveryArtifact: { findFirst: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn(), findFirst: vi.fn() },
    notification: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    modelQualityScore: { upsert: vi.fn(), findMany: vi.fn() },
    agentEvalResult: { create: vi.fn() },
    secretRotation: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/session", () => ({
  getSession: vi.fn().mockResolvedValue({ userId: "test-user", email: "test@test.com", name: "Test", isAdmin: false, role: "CSE" }),
  requireAuth: vi.fn().mockResolvedValue({ userId: "test-user", email: "test@test.com", name: "Test", isAdmin: false, role: "CSE" }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}));
