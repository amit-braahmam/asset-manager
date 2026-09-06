import { ROLE_LABELS, type Role } from "./role";

const ASSIGNEE_ROLES = new Set<Role>(["manager", "technician"]);

export function maintenanceTechnicianOptions(
  users: Array<{ id: string; name: string; email: string; role: string }> | undefined,
  current?: string,
) {
  const options: { value: string; label: string }[] = [{ value: "", label: "Select technician" }];
  const seen = new Set<string>();
  for (const user of users ?? []) {
    if (user.id.startsWith("pending:")) continue;
    if (!ASSIGNEE_ROLES.has(user.role as Role)) continue;
    const value = user.name.trim() || user.email.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({
      value,
      label: `${value} · ${ROLE_LABELS[user.role as Role] ?? user.role}`,
    });
  }
  const leftover = current?.trim() ?? "";
  if (leftover && !seen.has(leftover.toLowerCase())) {
    options.push({ value: leftover, label: `${leftover} (current)` });
  }
  return options;
}
