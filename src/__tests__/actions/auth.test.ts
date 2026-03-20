import { describe, it, expect, vi, beforeEach } from "vitest";

describe("loginAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("rejects empty email", async () => {
    const { loginAction } = await import("@/lib/actions/auth");
    const fd = new FormData();
    fd.set("email", "");
    fd.set("password", "test");
    const result = await loginAction(null, fd);
    expect(result?.error).toBeTruthy();
  });

  it("rejects wrong credentials", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const { loginAction } = await import("@/lib/actions/auth");
    const fd = new FormData();
    fd.set("email", "x@x.com");
    fd.set("password", "wrong");
    const result = await loginAction(null, fd);
    expect(result?.error).toContain("Invalid");
  });
});
