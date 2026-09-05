import { LOOKUP_GROUPS, type LookupGroup } from "@workspace/db/lookups";

export { LOOKUP_GROUPS, type LookupGroup };

const CLOSED_GROUPS = new Set<LookupGroup>(["maintenance_scope"]);

export function isLookupGroup(value: string): value is LookupGroup {
  return (LOOKUP_GROUPS as readonly string[]).includes(value);
}

export function slugifyLookupValue(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return slug || "option";
}

export function valueFromLabel(group: LookupGroup, label: string): string {
  const trimmed = label.trim();
  if (group === "inventory_category") return trimmed;
  return slugifyLookupValue(trimmed);
}

export function canCreateInGroup(group: LookupGroup): boolean {
  return !CLOSED_GROUPS.has(group);
}

export function canDeactivateOption(option: { system: boolean }): boolean {
  return !option.system;
}

export function deleteLookupError(option: { system: boolean; group: LookupGroup }, usageCount: number): string | null {
  if (option.system) return "System options cannot be deleted.";
  if (CLOSED_GROUPS.has(option.group)) return "Scope options cannot be deleted.";
  if (usageCount > 0) return "This option is still in use.";
  return null;
}

export function groupFieldLabel(group: LookupGroup): string {
  switch (group) {
    case "inventory_category":
      return "category";
    case "inventory_status":
    case "maintenance_status":
      return "status";
    case "maintenance_mode":
      return "mode";
    case "maintenance_scope":
      return "scope";
    case "maintenance_activity":
      return "activity";
    case "maintenance_priority":
      return "priority";
    default: {
      const exhaustive: never = group;
      return exhaustive;
    }
  }
}
