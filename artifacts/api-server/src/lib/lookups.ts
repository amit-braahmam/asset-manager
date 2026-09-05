import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import {
  DEFAULT_LOOKUP_OPTIONS,
  assetsTable,
  db,
  lookupOptionsTable,
  maintenanceTable,
  type LookupGroup,
  type LookupOption,
} from "@workspace/db";
import {
  canCreateInGroup,
  canDeactivateOption,
  deleteLookupError,
  groupFieldLabel,
  isLookupGroup,
  valueFromLabel,
} from "./lookup-rules";

export type LookupOptionView = LookupOption & { usageCount: number };

function usageKey(group: string, value: string) {
  return `${group}:${value}`;
}

async function usageCounts() {
  const [assets, maintenance] = await Promise.all([
    db.select({ category: assetsTable.category, status: assetsTable.status }).from(assetsTable),
    db.select({
      status: maintenanceTable.status,
      mode: maintenanceTable.mode,
      scope: maintenanceTable.scope,
      activityType: maintenanceTable.activityType,
      priority: maintenanceTable.priority,
    }).from(maintenanceTable),
  ]);
  const counts = new Map<string, number>();
  const bump = (group: LookupGroup, value: string) => {
    const key = usageKey(group, value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  for (const row of assets) {
    bump("inventory_category", row.category);
    bump("inventory_status", row.status);
  }
  for (const row of maintenance) {
    bump("maintenance_status", row.status);
    bump("maintenance_mode", row.mode);
    bump("maintenance_scope", row.scope);
    bump("maintenance_activity", row.activityType);
    bump("maintenance_priority", row.priority);
  }
  return counts;
}

export async function ensureLookupOptions() {
  await db.insert(lookupOptionsTable).values(
    DEFAULT_LOOKUP_OPTIONS.map((option) => ({
      ...option,
      active: true,
    })),
  ).onConflictDoUpdate({
    target: [lookupOptionsTable.group, lookupOptionsTable.value],
    set: {
      system: true,
      active: true,
    },
  });

  const [existing, liveCategories] = await Promise.all([
    db.select({ value: lookupOptionsTable.value }).from(lookupOptionsTable).where(eq(lookupOptionsTable.group, "inventory_category")),
    db.select({ category: assetsTable.category }).from(assetsTable),
  ]);
  const have = new Set(existing.map((row) => row.value.toLowerCase()));
  let sortOrder = 100;
  const seen = new Set<string>();
  for (const { category } of liveCategories) {
    const label = category.trim();
    const key = label.toLowerCase();
    if (!label || have.has(key) || seen.has(key)) continue;
    seen.add(key);
    await db.insert(lookupOptionsTable).values({
      id: `lu-${randomUUID().slice(0, 12)}`,
      group: "inventory_category",
      value: label,
      label,
      sortOrder,
      active: true,
      system: false,
    }).onConflictDoNothing({
      target: [lookupOptionsTable.group, lookupOptionsTable.value],
    });
    have.add(label.toLowerCase());
    sortOrder += 10;
  }
}

export async function listLookupOptions(group?: LookupGroup): Promise<LookupOptionView[]> {
  await ensureLookupOptions();
  const rows = await db
    .select()
    .from(lookupOptionsTable)
    .where(group ? eq(lookupOptionsTable.group, group) : undefined)
    .orderBy(asc(lookupOptionsTable.group), asc(lookupOptionsTable.sortOrder), asc(lookupOptionsTable.label));
  const counts = await usageCounts();
  return rows.map((row) => ({
    ...row,
    active: row.system ? true : row.active,
    usageCount: counts.get(usageKey(row.group, row.value)) ?? 0,
  }));
}

export async function findLookup(group: LookupGroup, value: string) {
  const rows = await db.select().from(lookupOptionsTable).where(and(
    eq(lookupOptionsTable.group, group),
    eq(lookupOptionsTable.value, value),
  )).limit(1);
  return rows[0] ?? null;
}

export async function matchLookup(group: LookupGroup, raw: string) {
  const needle = raw.trim().toLowerCase();
  if (!needle) return null;
  const rows = await db.select().from(lookupOptionsTable).where(eq(lookupOptionsTable.group, group));
  return rows.find((row) => row.value.toLowerCase() === needle || row.label.toLowerCase() === needle) ?? null;
}

export async function requireLookupValue(group: LookupGroup, value: string) {
  const row = await findLookup(group, value);
  if (!row) {
    return { ok: false as const, error: `Choose a valid ${groupFieldLabel(group)} from Directory.` };
  }
  return { ok: true as const, option: row };
}

export async function resolveOrCreateCategory(raw: string) {
  const label = raw.trim() || "Peripheral";
  await ensureLookupOptions();
  const existing = await matchLookup("inventory_category", label);
  if (existing) return existing.value;
  const created = await createLookupOption("inventory_category", label);
  if (!created.ok) return label;
  return created.option.value;
}

export async function createLookupOption(group: LookupGroup, label: string) {
  if (!canCreateInGroup(group)) {
    return { ok: false as const, status: 400, error: "Scope options cannot be added." };
  }
  const value = valueFromLabel(group, label);
  if (!value) {
    return { ok: false as const, status: 400, error: "Enter a label for this option." };
  }
  const duplicate = await matchLookup(group, value);
  if (duplicate) {
    return { ok: false as const, status: 409, error: "That option already exists." };
  }
  const option = {
    id: `lu-${randomUUID().slice(0, 12)}`,
    group,
    value,
    label: label.trim(),
    sortOrder: 100,
    active: true,
    system: false,
  };
  try {
    await db.insert(lookupOptionsTable).values(option);
  } catch {
    const raced = await matchLookup(group, value);
    if (raced) return { ok: true as const, option: { ...raced, usageCount: 0 } };
    return { ok: false as const, status: 409, error: "That option already exists." };
  }
  return { ok: true as const, option: { ...option, usageCount: 0 } };
}

export async function updateLookupOption(
  lookupId: string,
  patch: { label?: string; active?: boolean; sortOrder?: number },
) {
  const existing = await db.select().from(lookupOptionsTable).where(eq(lookupOptionsTable.id, lookupId)).limit(1);
  if (existing.length === 0) {
    return { ok: false as const, status: 404, error: "Option not found" };
  }
  const current = existing[0];
  if (patch.active === false && !canDeactivateOption(current)) {
    return { ok: false as const, status: 400, error: "System options cannot be deactivated." };
  }
  const nextLabel = patch.label === undefined ? current.label : patch.label.trim();
  if (!nextLabel) {
    return { ok: false as const, status: 400, error: "Enter a label for this option." };
  }
  const nextValue = current.group === "inventory_category" && patch.label !== undefined
    ? valueFromLabel(current.group, nextLabel)
    : current.value;
  if (nextValue !== current.value) {
    const clash = await matchLookup(current.group, nextValue);
    if (clash && clash.id !== current.id) {
      return { ok: false as const, status: 409, error: "That option already exists." };
    }
  }
  await db.update(lookupOptionsTable).set({
    label: nextLabel,
    value: nextValue,
    ...(patch.active === undefined ? {} : { active: patch.active }),
    ...(patch.sortOrder === undefined ? {} : { sortOrder: patch.sortOrder }),
  }).where(eq(lookupOptionsTable.id, lookupId));
  if (current.group === "inventory_category" && nextValue !== current.value) {
    await db.update(assetsTable).set({ category: nextValue }).where(eq(assetsTable.category, current.value));
  }
  const row = (await db.select().from(lookupOptionsTable).where(eq(lookupOptionsTable.id, lookupId)).limit(1))[0];
  const counts = await usageCounts();
  return { ok: true as const, option: { ...row, usageCount: counts.get(usageKey(row.group, row.value)) ?? 0 } };
}

export async function removeLookupOption(lookupId: string) {
  const existing = await db.select().from(lookupOptionsTable).where(eq(lookupOptionsTable.id, lookupId)).limit(1);
  if (existing.length === 0) {
    return { ok: false as const, status: 404, error: "Option not found" };
  }
  const current = existing[0];
  const counts = await usageCounts();
  const usageCount = counts.get(usageKey(current.group, current.value)) ?? 0;
  const blocked = deleteLookupError(current, usageCount);
  if (blocked) {
    return { ok: false as const, status: 409, error: blocked };
  }
  await db.delete(lookupOptionsTable).where(eq(lookupOptionsTable.id, lookupId));
  return { ok: true as const };
}

export { isLookupGroup };
