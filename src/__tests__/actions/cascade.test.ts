import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/cascade/snapshot", () => ({
  createEvidenceSnapshot: vi.fn().mockResolvedValue({ snapshotId: "snap1" }),
}));
vi.mock("@/lib/cascade/impact", () => ({
  runImpactAnalysis: vi.fn().mockResolvedValue({ jobId: "job1", impactedPhases: ["DISCOVERY"] }),
  runSelectiveImpactAnalysis: vi.fn(),
  markDownstreamDirty: vi.fn(),
}));
vi.mock("@/lib/cascade/recompute", () => ({
  executeRecomputeJob: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/assumptions/engine", () => ({
  getVerificationSummary: vi.fn(),
  buildConstraintPromptBlock: vi.fn().mockResolvedValue(""),
}));
vi.mock("@/lib/jira/client", () => ({
  syncJiraDescription: vi.fn(),
}));

describe("triggerCascadeUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns error when project not found", async () => {
    (prisma.project.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const { triggerCascadeUpdate } = await import("@/lib/actions/cascade");
    const result = await triggerCascadeUpdate("nonexistent");
    expect(result).toHaveProperty("error");
  });

  it("returns error when no evidence ingested", async () => {
    (prisma.project.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1", ownerUserId: "test-user" });
    (prisma.documentChunk.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    const { triggerCascadeUpdate } = await import("@/lib/actions/cascade");
    const result = await triggerCascadeUpdate("p1");
    expect(result.error).toContain("No evidence");
  });

  it("returns jobId and impactedPhases on success", async () => {
    (prisma.project.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1", ownerUserId: "test-user" });
    (prisma.documentChunk.count as ReturnType<typeof vi.fn>).mockResolvedValue(10);

    const { triggerCascadeUpdate } = await import("@/lib/actions/cascade");
    const result = await triggerCascadeUpdate("p1");
    expect(result).toHaveProperty("jobId");
  });
});
