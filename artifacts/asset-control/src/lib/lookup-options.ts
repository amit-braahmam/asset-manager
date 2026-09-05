import type { LookupOption } from "@workspace/api-client-react";

export const FALLBACK_INVENTORY_CATEGORIES = [
  { value: "Laptop", label: "Laptop" },
  { value: "Monitor", label: "Monitor" },
  { value: "Server", label: "Server" },
  { value: "Peripheral", label: "Peripheral" },
  { value: "Mobile", label: "Mobile" },
  { value: "Networking", label: "Networking" },
];

export const FALLBACK_INVENTORY_STATUSES = [
  { value: "available", label: "Available" },
  { value: "assigned", label: "Assigned" },
  { value: "in_repair", label: "In repair" },
  { value: "rma", label: "RMA" },
  { value: "retired", label: "Retired" },
  { value: "lost", label: "Lost" },
];

export const FALLBACK_MAINTENANCE_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "overdue", label: "Overdue" },
];

export const FALLBACK_MAINTENANCE_MODES = [
  { value: "scheduled", label: "Scheduled" },
  { value: "emergency", label: "Emergency" },
];

export const FALLBACK_MAINTENANCE_SCOPES = [
  { value: "asset", label: "Device" },
  { value: "estate", label: "Preventive" },
];

export const FALLBACK_MAINTENANCE_ACTIVITIES = [
  { value: "os_patch", label: "OS patch" },
  { value: "application_patch", label: "Application patch" },
  { value: "lan", label: "LAN update" },
  { value: "firewall", label: "Firewall update" },
  { value: "other", label: "Other" },
];

export const FALLBACK_MAINTENANCE_PRIORITIES = [
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];

const FALLBACKS: Record<string, { value: string; label: string }[]> = {
  inventory_category: FALLBACK_INVENTORY_CATEGORIES,
  inventory_status: FALLBACK_INVENTORY_STATUSES,
  maintenance_status: FALLBACK_MAINTENANCE_STATUSES,
  maintenance_mode: FALLBACK_MAINTENANCE_MODES,
  maintenance_scope: FALLBACK_MAINTENANCE_SCOPES,
  maintenance_activity: FALLBACK_MAINTENANCE_ACTIVITIES,
  maintenance_priority: FALLBACK_MAINTENANCE_PRIORITIES,
};

export function catalogRows(rows: LookupOption[] | undefined, group: string): LookupOption[] {
  const byValue = new Map<string, LookupOption>();
  for (const [index, option] of (FALLBACKS[group] ?? []).entries()) {
    byValue.set(option.value, {
      id: `system-${group}-${option.value}`,
      group: group as LookupOption["group"],
      value: option.value,
      label: option.label,
      sortOrder: (index + 1) * 10,
      active: true,
      system: true,
      usageCount: 0,
    });
  }
  for (const row of rows ?? []) {
    if (row.group !== group) continue;
    const fallback = byValue.get(row.value);
    const system = row.system || Boolean(fallback);
    byValue.set(row.value, {
      ...row,
      system,
      active: system ? true : row.active,
      label: row.label || fallback?.label || row.value,
      sortOrder: row.sortOrder || fallback?.sortOrder || 100,
    });
  }
  return [...byValue.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
}

export function lookupOptions(
  rows: LookupOption[] | undefined,
  group: string,
  extraValues: string[] = [],
) {
  const byValue = new Map(catalogRows(rows, group).map((row) => [row.value, row]));
  for (const value of extraValues) {
    if (value && !byValue.has(value)) {
      byValue.set(value, {
        id: `extra-${group}-${value}`,
        group: group as LookupOption["group"],
        value,
        label: value,
        sortOrder: 999,
        active: true,
        system: false,
        usageCount: 0,
      });
    }
  }
  return [...byValue.values()]
    .filter((row) => row.active || row.system || extraValues.includes(row.value))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
    .map((row) => ({ value: row.value, label: row.label }));
}

export function lookupLabel(rows: LookupOption[] | undefined, group: string, value: string, fallback?: string) {
  return catalogRows(rows, group).find((row) => row.value === value)?.label ?? fallback ?? value;
}
