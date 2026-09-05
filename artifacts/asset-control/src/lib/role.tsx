import { createContext, useContext, type ReactNode } from "react";
import { useGetCurrentUser } from "@workspace/api-client-react";
import type { CurrentUser } from "@workspace/api-client-react";

export type Role = CurrentUser["role"];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  auditor: "Auditor",
  manager: "Manager",
  technician: "Technician",
  viewer: "Viewer",
};

export const ALL_ROLES: Role[] = ["admin", "auditor", "manager", "technician", "viewer"];

type RoleContextValue = {
  user: CurrentUser | null;
  role: Role | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

const RoleContext = createContext<RoleContextValue>({
  user: null,
  role: null,
  isLoading: true,
  isError: false,
  refetch: () => {},
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const me = useGetCurrentUser();
  const value: RoleContextValue = {
    user: me.data ?? null,
    role: me.data?.role ?? null,
    isLoading: me.isLoading,
    isError: me.isError,
    refetch: () => {
      void me.refetch();
    },
  };
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}

// --- Permission helpers (single source of truth for UI gating) ---
// Mirror the server-side RBAC guards so the UI never offers actions the API
// would reject.
export const canManageAssets = (role: Role | null) =>
  role === "admin" || role === "manager";
export const canUpdateAssetStatus = (role: Role | null) =>
  role === "admin" || role === "manager" || role === "technician";
export const canManageMaintenance = (role: Role | null) =>
  role === "admin" || role === "manager";
export const canCompleteMaintenance = (role: Role | null) =>
  role === "admin" || role === "manager" || role === "technician";
export const canManageDirectory = (role: Role | null) =>
  role === "admin" || role === "manager";
export const canDeleteAssets = (role: Role | null) =>
  role === "admin" || role === "manager";
export const canDeleteDirectory = (role: Role | null) =>
  role === "admin" || role === "manager";
export const canDeleteTeamMembers = (role: Role | null) => role === "admin";
export const canDeleteReports = (role: Role | null) => role === "admin";
export const canViewTeam = (role: Role | null) =>
  role === "admin" || role === "manager";
export const canOnboardUsers = (role: Role | null) =>
  role === "admin" || role === "manager";
export const canManageRoles = (role: Role | null) => role === "admin";
export const canManageLookups = (role: Role | null) => role === "admin";
export const canViewReports = (role: Role | null) =>
  role === "admin" || role === "auditor";
export const canEditReports = (role: Role | null) =>
  role === "admin" || role === "auditor";
export const canViewCustody = (role: Role | null) =>
  role === "admin" || role === "auditor" || role === "manager";
export const canManageCustody = (role: Role | null) =>
  role === "admin" || role === "auditor";

/** Roles a given actor is allowed to grant when onboarding a new user. */
export function grantableRoles(actor: Role | null): Role[] {
  if (actor === "admin") return ALL_ROLES;
  if (actor === "manager") return ["technician", "viewer"];
  return [];
}
