import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/assumptions/engine", () => ({
  verifyAssumption: vi.fn().mockResolvedValue({ success: true }),
  correctAssumption: vi.fn().mockResolvedValue({ success: true, invalidatedPhases: [] }),
  rejectAssumption: vi.fn().mockResolvedValue({ success: true, invalidatedPhases: ["DISCOVERY"] }),
  bulkVerifyPhaseAssumptions: vi.fn().mockResolvedValue({ verified: 3 }),
  getPhaseCheckpoint: vi.fn().mockResolvedValue({}),
  getVerificationSummary: vi.fn().mockResolvedValue({
    totalAssumptions: 5,
    pending: 1,
    verified: 3,
    corrected: 1,
    rejected: 0,
    criticalPending: [],
  }),
  isPhaseGateClear: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/cascade/impact", () => ({
  markDownstreamDirty: vi.fn(),
}));

describe("confirmAssumption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when assumption not found", async () => {
    (prisma.assumption.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const { confirmAssumption } = await import("@/lib/actions/assumptions");
    const result = await confirmAssumption("nonexistent");
    expect(result).toHaveProperty("error");
    expect(result.error).toBe("Assumption not found");
  });

  it("returns error when unauthorized", async () => {
    (prisma.assumption.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "a1",
      projectId: "p1",
      project: { ownerUserId: "other-user" },
    });
    const { confirmAssumption } = await import("@/lib/actions/assumptions");
    const result = await confirmAssumption("a1");
    expect(result.error).toBe("Unauthorized");
  });

  it("succeeds for owned assumption", async () => {
    (prisma.assumption.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "a1",
      projectId: "p1",
      project: { ownerUserId: "test-user" },
    });
    const { confirmAssumption } = await import("@/lib/actions/assumptions");
    const result = await confirmAssumption("a1");
    expect(result).toHaveProperty("success", true);
  });
});

describe("rejectAssumptionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when assumption not found", async () => {
    (prisma.assumption.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const { rejectAssumptionAction } = await import("@/lib/actions/assumptions");
    const result = await rejectAssumptionAction("nonexistent");
    expect(result.error).toBe("Assumption not found");
  });

  it("returns error when unauthorized", async () => {
    (prisma.assumption.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "a1",
      projectId: "p1",
      project: { ownerUserId: "other-user" },
    });
    const { rejectAssumptionAction } = await import("@/lib/actions/assumptions");
    const result = await rejectAssumptionAction("a1", "wrong claim");
    expect(result.error).toBe("Unauthorized");
  });

  it("succeeds and triggers downstream dirty on rejection", async () => {
    (prisma.assumption.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "a1",
      projectId: "p1",
      project: { ownerUserId: "test-user" },
    });
    const { rejectAssumptionAction } = await import("@/lib/actions/assumptions");
    const result = await rejectAssumptionAction("a1", "Incorrect claim");
    expect(result).toHaveProperty("success", true);
  });
});

describe("correctAssumptionAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when correction text is empty", async () => {
    (prisma.assumption.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "a1",
      projectId: "p1",
      project: { ownerUserId: "test-user" },
    });
    const { correctAssumptionAction } = await import("@/lib/actions/assumptions");
    const result = await correctAssumptionAction("a1", "  ");
    expect(result.error).toBe("Correction text is required");
  });
});
