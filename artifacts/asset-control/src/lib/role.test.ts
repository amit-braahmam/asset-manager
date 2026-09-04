import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALL_ROLES,
  canCompleteMaintenance,
  canEditReports,
  canManageAssets,
  canManageDirectory,
  canDeleteAssets,
  canDeleteDirectory,
  canDeleteTeamMembers,
  canDeleteReports,
  canManageMaintenance,
  canManageRoles,
  canOnboardUsers,
  canUpdateAssetStatus,
  canViewReports,
  canViewTeam,
  grantableRoles,
  type Role,
} from "./role.tsx";

const ROLES: Role[] = [...ALL_ROLES];

function allowed(fn: (role: Role | null) => boolean): Role[] {
  return ROLES.filter((role) => fn(role));
}

describe("UI permission helpers match the API role matrix", () => {
  it("asset create/edit/assign is Admin + Manager", () => {
    assert.deepEqual(allowed(canManageAssets), ["admin", "manager"]);
  });

  it("asset status is Admin + Manager + Technician", () => {
    assert.deepEqual(allowed(canUpdateAssetStatus), [
      "admin",
      "manager",
      "technician",
    ]);
  });

  it("maintenance schedule/delete is Admin + Manager", () => {
    assert.deepEqual(allowed(canManageMaintenance), ["admin", "manager"]);
  });

  it("maintenance complete is Admin + Manager + Technician", () => {
    assert.deepEqual(allowed(canCompleteMaintenance), [
      "admin",
      "manager",
      "technician",
    ]);
  });

  it("directory mutations are Admin + Manager", () => {
    assert.deepEqual(allowed(canManageDirectory), ["admin", "manager"]);
    assert.deepEqual(allowed(canDeleteAssets), ["admin", "manager"]);
    assert.deepEqual(allowed(canDeleteDirectory), ["admin", "manager"]);
  });

  it("Team is Admin + Manager; role changes and team/report deletes are Admin only", () => {
    assert.deepEqual(allowed(canViewTeam), ["admin", "manager"]);
    assert.deepEqual(allowed(canOnboardUsers), ["admin", "manager"]);
    assert.deepEqual(allowed(canManageRoles), ["admin"]);
    assert.deepEqual(allowed(canDeleteTeamMembers), ["admin"]);
    assert.deepEqual(allowed(canDeleteReports), ["admin"]);
  });

  it("reports and audit are Admin + Auditor", () => {
    assert.deepEqual(allowed(canViewReports), ["admin", "auditor"]);
    assert.deepEqual(allowed(canEditReports), ["admin", "auditor"]);
  });

  it("Viewer cannot mutate or open Team/Reports", () => {
    assert.equal(canManageAssets("viewer"), false);
    assert.equal(canUpdateAssetStatus("viewer"), false);
    assert.equal(canViewTeam("viewer"), false);
    assert.equal(canViewReports("viewer"), false);
    assert.deepEqual(grantableRoles("viewer"), []);
  });

  it("onboarding grants match API rules", () => {
    assert.deepEqual(grantableRoles("admin"), ALL_ROLES);
    assert.deepEqual(grantableRoles("manager"), ["technician", "viewer"]);
    assert.deepEqual(grantableRoles("auditor"), []);
  });
});
