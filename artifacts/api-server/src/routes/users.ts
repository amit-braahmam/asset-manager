import { Router, type IRouter, type Request } from "express";
import { clerkClient } from "@clerk/express";
import { asc, eq, ne, and } from "drizzle-orm";
import {
  CreateUserBody,
  DeleteUserParams,
  UpdateUserBody,
  UpdateUserParams,
  UpdateUserRoleBody,
  UpdateUserRoleParams,
  type User as ApiUser,
  type CurrentUser as ApiCurrentUser,
} from "@workspace/api-zod";
import { db, usersTable, type User as DbUser, type UserRole } from "@workspace/db";
import { randomUUID } from "node:crypto";
import {
  requireRoles,
  PENDING_USER_PREFIX,
  canOnboardRole,
  canEditPendingUserEmail,
  canEditUserProfile,
  isLastAdminDemotion,
  isLastAdminDeletion,
} from "../lib/auth";
import { notify } from "../lib/notify";
import { isMaintenanceAssignee } from "../lib/notify-recipients";

const router: IRouter = Router();

function toUser(row: DbUser): ApiUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as ApiUser["role"],
    invitedBy: row.invitedBy,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
  };
}

router.get("/me", (req: Request, res) => {
  const user = req.appUser;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const data: ApiCurrentUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
  res.json(data);
});

router.get("/users", requireRoles("admin", "manager", "technician"), async (req, res) => {
  const rows = await db.select().from(usersTable).orderBy(asc(usersTable.createdAt));
  const users = rows.map(toUser);
  if (req.appUser!.role === "technician") {
    res.json(users.filter(isMaintenanceAssignee));
    return;
  }
  res.json(users);
});

router.post("/users", requireRoles("admin", "manager"), async (req, res) => {
  const body = CreateUserBody.parse(req.body);
  const actingRole = req.appUser!.role;

  if (!canOnboardRole(actingRole, body.role)) {
    res.status(403).json({
      error: "Managers can only onboard Technician or Viewer users.",
    });
    return;
  }

  const email = body.email.toLowerCase();
  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "A user with this email already exists." });
    return;
  }

  const now = new Date();
  const row = {
    id: `${PENDING_USER_PREFIX}${randomUUID().slice(0, 12)}`,
    email,
    name: body.name ?? "",
    role: body.role,
    invitedBy: req.appUser!.id,
    createdAt: now,
    lastSeenAt: now,
  };
  await db.insert(usersTable).values(row);
  await notify({
    type: "team_invite",
    userId: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
  });
  res.status(201).json(toUser(row as DbUser));
});

router.patch("/users/:userId/role", requireRoles("admin"), async (req, res) => {
  const { userId } = UpdateUserRoleParams.parse(req.params);
  const body = UpdateUserRoleBody.parse(req.body);

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (existing.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const otherAdmins = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.role, "admin"), ne(usersTable.id, userId)));
  if (isLastAdminDemotion(existing[0].role as UserRole, body.role, otherAdmins.length)) {
    res.status(400).json({ error: "At least one Admin must remain." });
    return;
  }

  await db
    .update(usersTable)
    .set({ role: body.role })
    .where(eq(usersTable.id, userId));
  const updated = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  res.json(toUser(updated[0]));
});

async function syncClerkName(userId: string, name: string) {
  if (userId.startsWith(PENDING_USER_PREFIX)) return;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  try {
    await clerkClient.users.updateUser(userId, {
      firstName: parts[0] ?? "",
      lastName: parts.slice(1).join(" ") || "",
    });
  } catch {
    // Local profile still updates if Clerk is unreachable.
  }
}

router.patch("/users/:userId", async (req, res) => {
  const actor = req.appUser;
  if (!actor) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { userId } = UpdateUserParams.parse(req.params);
  const body = UpdateUserBody.parse(req.body);
  if (!canEditUserProfile(actor, userId)) {
    res.status(403).json({ error: "You can only edit your own profile." });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (existing.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const nextName = body.name != null ? body.name.trim() : existing[0].name;
  if (!nextName) {
    res.status(400).json({ error: "Name is required." });
    return;
  }

  let nextEmail = existing[0].email;
  if (body.email != null && body.email !== existing[0].email) {
    if (!canEditPendingUserEmail(actor, userId)) {
      res.status(403).json({ error: "Email can only be changed for pending invitations." });
      return;
    }
    nextEmail = body.email.toLowerCase();
    const clash = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(eq(usersTable.email, nextEmail), ne(usersTable.id, userId)))
      .limit(1);
    if (clash.length > 0) {
      res.status(409).json({ error: "A user with this email already exists." });
      return;
    }
  }

  await db.update(usersTable).set({ name: nextName, email: nextEmail }).where(eq(usersTable.id, userId));
  await syncClerkName(userId, nextName);
  const updated = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  res.json(toUser(updated[0]));
});

router.delete("/users/:userId", requireRoles("admin"), async (req, res) => {
  const { userId } = DeleteUserParams.parse(req.params);
  if (req.appUser!.id === userId) {
    res.status(409).json({ error: "You cannot delete your own account while signed in." });
    return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (existing.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const otherAdmins = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.role, "admin"), ne(usersTable.id, userId)));
  if (isLastAdminDeletion(existing[0].role as UserRole, otherAdmins.length)) {
    res.status(409).json({ error: "At least one Admin must remain." });
    return;
  }
  // Revoke Clerk login before dropping the app row (pending invites have no Clerk user).
  if (!userId.startsWith(PENDING_USER_PREFIX)) {
    try {
      await clerkClient.users.deleteUser(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (!/not found|Resource not found|404/i.test(message)) {
        res.status(502).json({
          error: "Could not revoke this person's Clerk login. Try again or remove them in Clerk Dashboard.",
        });
        return;
      }
    }
  }

  await db.delete(usersTable).where(eq(usersTable.id, userId));
  res.status(204).send();
});

export default router;
