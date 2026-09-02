import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { User as DbUser, UserRole } from "@workspace/db/schema";

export type AppUser = DbUser & { role: UserRole };

/** Synthetic id prefix for users onboarded (by email) before their first sign-in. */
export const PENDING_USER_PREFIX = "pending:";

export const MANAGER_GRANTABLE_ROLES: UserRole[] = ["technician", "viewer"];

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      appUser?: AppUser;
    }
  }
}

/** Whether `actor` may grant `role` when onboarding a user. */
export function canOnboardRole(actor: UserRole, role: UserRole): boolean {
  if (actor === "admin") return true;
  if (actor === "manager") return MANAGER_GRANTABLE_ROLES.includes(role);
  return false;
}

/** True when demoting this user would leave the tenant with zero Admins. */
export function isLastAdminDemotion(
  currentRole: UserRole,
  nextRole: UserRole,
  otherAdminCount: number,
): boolean {
  return currentRole === "admin" && nextRole !== "admin" && otherAdminCount === 0;
}

/** Route guard: only allow the listed roles. */
export function requireRoles(...allowed: UserRole[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.appUser?.role;
    if (!role || !allowed.includes(role)) {
      res.status(403).json({ error: "Forbidden: insufficient role" });
      return;
    }
    next();
  };
}

export function hasRole(req: Request, ...allowed: UserRole[]): boolean {
  const role = req.appUser?.role;
  return !!role && allowed.includes(role);
}

/** Display label for the acting user, used in audit/history entries. */
export function actorLabel(req: Request): string {
  const user = req.appUser;
  if (!user) return "System";
  return user.name || user.email || user.id;
}
