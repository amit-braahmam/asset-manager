import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { maintenanceTechnicianOptions } from "./maintenance-technicians";

const users = [
  { id: "1", name: "Priya Nair", email: "priya@example.com", role: "technician" },
  { id: "2", name: "Alex Chen", email: "alex@example.com", role: "manager" },
  { id: "3", name: "Sam Admin", email: "sam@example.com", role: "admin" },
  { id: "pending:x", name: "Invited Tech", email: "invite@example.com", role: "technician" },
  { id: "4", name: "", email: "solo@example.com", role: "technician" },
];

describe("maintenanceTechnicianOptions", () => {
  it("lists active managers and technicians, not admins or pending invites", () => {
    const options = maintenanceTechnicianOptions(users);
    assert.deepEqual(options.map((option) => option.value), ["", "Priya Nair", "Alex Chen", "solo@example.com"]);
    assert.equal(options[1].label, "Priya Nair · Technician");
    assert.equal(options[2].label, "Alex Chen · Manager");
  });

  it("keeps a legacy free-text technician so existing work can still be saved", () => {
    const options = maintenanceTechnicianOptions(users, "IT Support Desk");
    assert.equal(options.at(-1)?.value, "IT Support Desk");
    assert.equal(options.at(-1)?.label, "IT Support Desk (current)");
  });
});
