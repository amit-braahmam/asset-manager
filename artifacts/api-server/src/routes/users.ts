import { Router, type IRouter, type Request } from "express";
import { asc, eq, ne, and } from "drizzle-orm";
import {
  CreateUserBody,
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
  isLastAdminDemotion,
} from "../lib/auth";
import { notify } from "../lib/notify";

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

router.get("/users", requireRoles("admin", "manager"), async (_req, res) => {
  const rows = await db.select().from(usersTable).orderBy(asc(usersTable.createdAt));
  res.json(rows.map(toUser));
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

export default router;
