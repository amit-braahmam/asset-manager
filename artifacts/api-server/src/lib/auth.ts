import type { Request, RequestHandler } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { and, eq, like, not } from "drizzle-orm";
import { db, usersTable, DEFAULT_USER_ROLE, type UserRole } from "@workspace/db";
import { PENDING_USER_PREFIX, type AppUser } from "./auth-roles";

export type { AppUser } from "./auth-roles";
export {
  PENDING_USER_PREFIX,
  MANAGER_GRANTABLE_ROLES,
  canOnboardRole,
  isLastAdminDemotion,
  isLastAdminDeletion,
  requireRoles,
  hasRole,
  actorLabel,
} from "./auth-roles";

function getClerkUserId(req: Request): string | null {
  const auth = getAuth(req);
  return (auth?.sessionClaims?.userId as string | undefined) || auth?.userId || null;
}

/**
 * Resolve the current app user from the Clerk session, lazily provisioning a
 * row on first sight. The very first user to sign in becomes an Admin; everyone
 * else defaults to Viewer until an Admin (or Manager, for technician/viewer)
 * changes their role.
 */
export async function resolveAppUser(req: Request): Promise<AppUser | null> {
  const userId = getClerkUserId(req);
  if (!userId) return null;

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(usersTable)
      .set({ lastSeenAt: new Date() })
      .where(eq(usersTable.id, userId));
    return existing[0] as AppUser;
  }

  // Pending invitations must not block first-user Admin bootstrapping.
  const signedInUsers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(not(like(usersTable.id, `${PENDING_USER_PREFIX}%`)))
    .limit(1);
  const isFirstUser = signedInUsers.length === 0;
  const now = new Date();

  let email = "";
  let name = "";
  try {
    const clerkUser = await clerkClient.users.getUser(userId);
    email =
      clerkUser.primaryEmailAddress?.emailAddress ??
      clerkUser.emailAddresses?.[0]?.emailAddress ??
      "";
    name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      clerkUser.username ||
      "";
  } catch {
    const auth = getAuth(req);
    email = (auth?.sessionClaims?.email as string | undefined) ?? "";
  }

  // Claim a pending invitation created (by email) before this user signed in,
  // carrying over the assigned role and inviter.
  if (email) {
    const pending = await db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.email, email),
          like(usersTable.id, `${PENDING_USER_PREFIX}%`),
        ),
      )
      .limit(1);
    if (pending.length > 0) {
      const invite = pending[0];
      await db.delete(usersTable).where(eq(usersTable.id, invite.id));
      const claimed = {
        id: userId,
        email,
        name: name || invite.name,
        role: invite.role as UserRole,
        invitedBy: invite.invitedBy,
        createdAt: invite.createdAt,
        lastSeenAt: now,
      };
      await db.insert(usersTable).values(claimed).onConflictDoNothing();
      return claimed as AppUser;
    }
  }

  const row = {
    id: userId,
    email,
    name,
    role: (isFirstUser ? "admin" : DEFAULT_USER_ROLE) as UserRole,
    invitedBy: null,
    createdAt: now,
    lastSeenAt: now,
  };
  await db.insert(usersTable).values(row).onConflictDoNothing();

  const inserted = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return (inserted[0] as AppUser) ?? (row as AppUser);
}

/**
 * Express middleware: require a signed-in Clerk user, resolve/attach the app
 * user (with role), and 401 if unauthenticated.
 */
export const attachAppUser: RequestHandler = async (req, res, next) => {
  try {
    const user = await resolveAppUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.appUser = user;
    next();
  } catch (err) {
    next(err);
  }
};
