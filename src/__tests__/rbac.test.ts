/**
 * Tests for RBAC helper utilities.
 */

import { describe, it, expect } from "vitest";
import { ForbiddenError, NotFoundError, rbacErrorResponse } from "@/lib/rbac";

describe("RBAC error classes", () => {
  it("ForbiddenError has correct name and message", () => {
    const err = new ForbiddenError();
    expect(err.name).toBe("ForbiddenError");
    expect(err.message).toBe("Forbidden");
  });

  it("ForbiddenError accepts custom message", () => {
    const err = new ForbiddenError("No access to project");
    expect(err.message).toBe("No access to project");
  });

  it("NotFoundError has correct name and message", () => {
    const err = new NotFoundError();
    expect(err.name).toBe("NotFoundError");
    expect(err.message).toBe("Not found");
  });

  it("errors are instances of Error", () => {
    expect(new ForbiddenError()).toBeInstanceOf(Error);
    expect(new NotFoundError()).toBeInstanceOf(Error);
  });
});

describe("rbacErrorResponse", () => {
  it("returns 403 for ForbiddenError", async () => {
    const res = rbacErrorResponse(new ForbiddenError());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns 404 for NotFoundError", async () => {
    const res = rbacErrorResponse(new NotFoundError("Project not found"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Project not found");
  });

  it("returns 401 for Unauthorized error", async () => {
    const res = rbacErrorResponse(new Error("Unauthorized"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 500 for generic errors", async () => {
    const res = rbacErrorResponse(new Error("Something went wrong"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Something went wrong");
  });

  it("returns 500 for non-Error objects", async () => {
    const res = rbacErrorResponse("string error");
    expect(res.status).toBe(500);
  });
});
