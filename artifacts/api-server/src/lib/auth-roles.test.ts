import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request, Response } from "express";
import type { UserRole } from "@workspace/db/schema";
import {
  actorLabel,
  canOnboardRole,
  hasRole,
  isLastAdminDemotion,
  isLastAdminDeletion,
  requireRoles,
  type AppUser,
} from "./auth-roles";

const ROLES: UserRole[] = ["admin", "auditor", "manager", "technician", "viewer"];

function user(role: UserRole): AppUser {
  return {
    id: `user-${role}`,
    email: `${role}@example.com`,
    name: role,
    role,
    invitedBy: null,
    createdAt: new Date(),
    lastSeenAt: new Date(),
  };
}

function invoke(allowed: UserRole[], actor: UserRole | null) {
  const req = {
    appUser: actor ? user(actor) : undefined,
  } as Request;
  let status = 200;
  let body: unknown;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  } as unknown as Response;
  let nextCalled = false;
  requireRoles(...allowed)(req, res, () => {
    nextCalled = true;
  });
  return { status, body, nextCalled };
}

describe("canOnboardRole", () => {
  it("lets Admin grant every role", () => {
    for (const role of ROLES) {
      assert.equal(canOnboardRole("admin", role), true);
    }
  });

  it("lets Manager grant only technician and viewer", () => {
    assert.equal(canOnboardRole("manager", "technician"), true);
    assert.equal(canOnboardRole("manager", "viewer"), true);
    assert.equal(canOnboardRole("manager", "admin"), false);
    assert.equal(canOnboardRole("manager", "auditor"), false);
    assert.equal(canOnboardRole("manager", "manager"), false);
  });

  it("blocks Auditor, Technician, and Viewer from onboarding", () => {
    for (const actor of ["auditor", "technician", "viewer"] as const) {
      for (const role of ROLES) {
        assert.equal(canOnboardRole(actor, role), false);
      }
    }
  });
});

describe("isLastAdminDemotion", () => {
  it("blocks demoting the only Admin", () => {
    assert.equal(isLastAdminDemotion("admin", "viewer", 0), true);
  });

  it("allows demoting an Admin when another remains", () => {
    assert.equal(isLastAdminDemotion("admin", "manager", 1), false);
  });

  it("blocks deleting the only Admin", () => {
    assert.equal(isLastAdminDeletion("admin", 0), true);
  });

  it("allows deleting an Admin when another remains", () => {
    assert.equal(isLastAdminDeletion("admin", 1), false);
  });
});

describe("requireRoles", () => {
  const matrix: Array<{ allowed: UserRole[]; path: string }> = [
    { allowed: ["admin", "manager"], path: "create/assign/return asset" },
    { allowed: ["admin", "manager", "technician"], path: "update asset status" },
    { allowed: ["admin", "auditor"], path: "reports and audit logs" },
    { allowed: ["admin", "auditor", "manager"], path: "list custody checks" },
    { allowed: ["admin", "auditor"], path: "start or send custody checks" },
    { allowed: ["admin"], path: "change user role" },
    { allowed: ["admin"], path: "edit Directory dropdown options" },
    { allowed: ["admin"], path: "delete team member or compliance report" },
  ];

  for (const { allowed, path } of matrix) {
    for (const actor of ROLES) {
      it(`${actor} ${allowed.includes(actor) ? "can" : "cannot"} access ${path}`, () => {
        const result = invoke(allowed, actor);
        if (allowed.includes(actor)) {
          assert.equal(result.nextCalled, true);
          assert.equal(result.status, 200);
        } else {
          assert.equal(result.nextCalled, false);
          assert.equal(result.status, 403);
        }
      });
    }
  }

  it("rejects a missing app user", () => {
    const result = invoke(["admin"], null);
    assert.equal(result.nextCalled, false);
    assert.equal(result.status, 403);
  });
});

describe("hasRole / actorLabel", () => {
  it("hasRole matches the attached user", () => {
    const req = { appUser: user("technician") } as Request;
    assert.equal(hasRole(req, "admin", "manager", "technician"), true);
    assert.equal(hasRole(req, "admin"), false);
  });

  it("actorLabel prefers name, then email, then System", () => {
    const named = { appUser: user("admin") } as Request;
    assert.equal(actorLabel(named), "admin");
    const unnamed = {
      appUser: { ...user("viewer"), name: "" },
    } as Request;
    assert.equal(actorLabel(unnamed), "viewer@example.com");
    assert.equal(actorLabel({} as Request), "System");
  });
});
