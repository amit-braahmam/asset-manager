import { toCsv } from "./import-file";

export type ImportKind = "assets" | "people";

export type AssetFieldKey =
  | "assetTag"
  | "name"
  | "description"
  | "category"
  | "manufacturer"
  | "model"
  | "serialNumber"
  | "location"
  | "status"
  | "condition"
  | "warrantyEnd"
  | "purchaseDate"
  | "purchaseCost"
  | "notes";

export type PersonFieldKey = "name" | "email" | "department";

export const ASSET_FIELDS: { key: AssetFieldKey; label: string; required?: boolean }[] = [
  { key: "assetTag", label: "Asset tag", required: true },
  { key: "name", label: "Asset name", required: true },
  { key: "description", label: "Description" },
  { key: "category", label: "Category" },
  { key: "manufacturer", label: "Manufacturer", required: true },
  { key: "model", label: "Model", required: true },
  { key: "serialNumber", label: "Serial number", required: true },
  { key: "location", label: "Location" },
  { key: "status", label: "Status" },
  { key: "condition", label: "Condition" },
  { key: "warrantyEnd", label: "Warranty end" },
  { key: "purchaseDate", label: "Purchase date" },
  { key: "purchaseCost", label: "Purchase cost" },
  { key: "notes", label: "Notes" },
];

export const PERSON_FIELDS: { key: PersonFieldKey; label: string; required?: boolean }[] = [
  { key: "name", label: "Name", required: true },
  { key: "email", label: "Email", required: true },
  { key: "department", label: "Department", required: true },
];

export type PreviewRow = {
  row: number;
  status: "ready" | "skipped";
  reason?: string;
  summary: string;
};

const STATUS_MAP: Record<string, string> = {
  available: "available",
  assigned: "assigned",
  inrepair: "in_repair",
  in_repair: "in_repair",
  rma: "rma",
  retired: "retired",
  lost: "lost",
};

const CONDITION_MAP: Record<string, string> = {
  excellent: "excellent",
  good: "good",
  fair: "fair",
  poor: "poor",
};

export function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeMatch(value: string) {
  return value.trim().toLowerCase();
}

function token(value: string) {
  return normalizeHeader(value).replaceAll(" ", "");
}

function guessAssetField(header: string): AssetFieldKey | "" {
  const key = token(header);
  if (!key || key === "srno" || key === "sno" || key === "action" || key === "brand") return "";
  if (["assettag", "assettagid", "assetid", "tag", "tagid"].includes(key)) return "assetTag";
  if (["name", "assetname", "productname"].includes(key)) return "name";
  if (key === "description") return "description";
  if (["category", "type", "assettype", "assetcategory"].includes(key)) return "category";
  if (["manufacturer", "make"].includes(key)) return "manufacturer";
  if (key === "model") return "model";
  if (["serial", "serialnumber", "serialno", "serialnum"].includes(key)) return "serialNumber";
  if (["location", "site", "officename"].includes(key)) return "location";
  if (key === "status") return "status";
  if (key === "condition") return "condition";
  if (["warranty", "warrantyend", "warrantyexpiry", "warrantydate"].includes(key)) return "warrantyEnd";
  if (["purchasedate", "buydate"].includes(key)) return "purchaseDate";
  if (["purchasecost", "cost", "price"].includes(key)) return "purchaseCost";
  if (key === "notes") return "notes";
  return "";
}

function guessPersonField(header: string): PersonFieldKey | "" {
  const key = token(header);
  if (["name", "fullname", "personname", "employeename"].includes(key)) return "name";
  if (["email", "emailaddress", "mail"].includes(key)) return "email";
  if (["department", "dept"].includes(key)) return "department";
  return "";
}

export function guessAssetMapping(headers: string[]): Record<AssetFieldKey, string> {
  const mapping = Object.fromEntries(ASSET_FIELDS.map((field) => [field.key, ""])) as Record<AssetFieldKey, string>;
  for (const header of headers) {
    const field = guessAssetField(header);
    if (field && !mapping[field]) mapping[field] = header;
  }
  return mapping;
}

export function guessPersonMapping(headers: string[]): Record<PersonFieldKey, string> {
  const mapping = Object.fromEntries(PERSON_FIELDS.map((field) => [field.key, ""])) as Record<PersonFieldKey, string>;
  for (const header of headers) {
    const field = guessPersonField(header);
    if (field && !mapping[field]) mapping[field] = header;
  }
  return mapping;
}

function read(row: Record<string, string>, header: string) {
  return (header ? row[header] ?? "" : "").trim();
}

function toDateOnly(value: string): string | null {
  if (!value) return null;
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function mapStatus(value: string) {
  if (!value) return "available";
  const key = token(value);
  const mapped = STATUS_MAP[key] ?? "available";
  return mapped === "assigned" ? "available" : mapped;
}

function mapCondition(value: string) {
  if (!value) return "good";
  return CONDITION_MAP[token(value)] ?? "good";
}

export function previewAssetRows(
  rows: Record<string, string>[],
  mapping: Record<AssetFieldKey, string>,
  locations: { id: string; name: string }[],
  existingTags: Set<string>,
  existingSerials: Set<string>,
  defaultLocationId: string,
): PreviewRow[] {
  const tags = new Set([...existingTags].map((value) => value.trim().toLowerCase()));
  const serials = new Set([...existingSerials].map((value) => value.trim().toLowerCase()));
  const locationByName = new Map(locations.map((location) => [normalizeMatch(location.name), location.id]));
  return rows.map((source, index) => {
    const row = index + 2;
    const assetTag = read(source, mapping.assetTag);
    const name = read(source, mapping.name);
    const manufacturer = read(source, mapping.manufacturer);
    const model = read(source, mapping.model);
    const serialNumber = read(source, mapping.serialNumber);
    const category = read(source, mapping.category) || "Peripheral";
    const locationName = read(source, mapping.location);
    const locationId = (locationName ? locationByName.get(normalizeMatch(locationName)) : undefined) ?? defaultLocationId;
    const summary = [assetTag, name].filter(Boolean).join(" · ") || `Row ${row}`;
    if (!assetTag || !name || !manufacturer || !model || !serialNumber) {
      return { row, status: "skipped", reason: "Asset tag, name, manufacturer, model, and serial number are required.", summary };
    }
    if (!locationId) {
      return { row, status: "skipped", reason: "Choose a default location, or map a location that matches Directory.", summary };
    }
    const tagKey = assetTag.toLowerCase();
    const serialKey = serialNumber.toLowerCase();
    if (tags.has(tagKey)) {
      return { row, status: "skipped", reason: "An asset with this tag already exists.", summary };
    }
    if (serials.has(serialKey)) {
      return { row, status: "skipped", reason: "An asset with this serial number already exists.", summary };
    }
    tags.add(tagKey);
    serials.add(serialKey);
    return { row, status: "ready", summary: `${assetTag} · ${name} · ${category}` };
  });
}

export function previewPersonRows(
  rows: Record<string, string>[],
  mapping: Record<PersonFieldKey, string>,
  departments: { id: string; name: string }[],
  existingEmails: Set<string>,
): PreviewRow[] {
  const emails = new Set([...existingEmails].map(normalizeEmail));
  const departmentByName = new Map(departments.map((department) => [normalizeMatch(department.name), department.id]));
  return rows.map((source, index) => {
    const row = index + 2;
    const name = read(source, mapping.name);
    const email = normalizeEmail(read(source, mapping.email));
    const departmentName = read(source, mapping.department);
    const summary = [name, email].filter(Boolean).join(" · ") || `Row ${row}`;
    if (!name || !email || !departmentName) {
      return { row, status: "skipped", reason: "Name, email, and department are required.", summary };
    }
    if (!departmentByName.get(normalizeMatch(departmentName))) {
      return { row, status: "skipped", reason: "Department was not found in Directory.", summary };
    }
    if (emails.has(email)) {
      return { row, status: "skipped", reason: "A person with this email already exists.", summary };
    }
    emails.add(email);
    return { row, status: "ready", summary: `${name} · ${email}` };
  });
}

export function mappedAssetPayloads(
  rows: Record<string, string>[],
  mapping: Record<AssetFieldKey, string>,
  locations: { id: string; name: string }[],
  defaultLocationId: string,
  readyRows: Set<number>,
) {
  const locationByName = new Map(locations.map((location) => [normalizeMatch(location.name), location.id]));
  return rows.flatMap((source, index) => {
    const row = index + 2;
    if (!readyRows.has(row)) return [];
    const locationName = read(source, mapping.location);
    const locationId = (locationName ? locationByName.get(normalizeMatch(locationName)) : undefined) ?? defaultLocationId;
    const cost = read(source, mapping.purchaseCost);
    const parsedCost = cost ? Number(cost.replace(/[^0-9.-]/g, "")) : NaN;
    return [{
      assetTag: read(source, mapping.assetTag),
      name: read(source, mapping.name),
      category: read(source, mapping.category) || "Peripheral",
      manufacturer: read(source, mapping.manufacturer),
      model: read(source, mapping.model),
      serialNumber: read(source, mapping.serialNumber),
      status: mapStatus(read(source, mapping.status)) as "available" | "assigned" | "in_repair" | "rma" | "retired" | "lost",
      condition: mapCondition(read(source, mapping.condition)) as "excellent" | "good" | "fair" | "poor",
      locationId,
      warrantyEnd: toDateOnly(read(source, mapping.warrantyEnd)),
      purchaseDate: toDateOnly(read(source, mapping.purchaseDate)),
      purchaseCost: Number.isFinite(parsedCost) ? parsedCost : null,
      notes: read(source, mapping.notes),
      description: read(source, mapping.description),
    }];
  });
}

export function mappedPersonPayloads(
  rows: Record<string, string>[],
  mapping: Record<PersonFieldKey, string>,
  departments: { id: string; name: string }[],
  readyRows: Set<number>,
) {
  const departmentByName = new Map(departments.map((department) => [normalizeMatch(department.name), department.id]));
  return rows.flatMap((source, index) => {
    const row = index + 2;
    if (!readyRows.has(row)) return [];
    return [{
      name: read(source, mapping.name),
      email: normalizeEmail(read(source, mapping.email)),
      departmentId: departmentByName.get(normalizeMatch(read(source, mapping.department))) ?? "",
    }];
  });
}

export function inventoryTemplateHeaders() {
  return ASSET_FIELDS.map((field) => field.label);
}

export function peopleTemplateHeaders() {
  return PERSON_FIELDS.map((field) => field.label);
}

export function inventoryTemplateSample(locationName = ""): Record<AssetFieldKey, string> {
  return {
    assetTag: "SAMPLE-001",
    name: "Sample laptop",
    description: "Replace this sample row",
    category: "Laptop",
    manufacturer: "Example",
    model: "Example-1",
    serialNumber: "SN-SAMPLE-001",
    location: locationName,
    status: "available",
    condition: "good",
    warrantyEnd: "2027-12-31",
    purchaseDate: "2026-01-15",
    purchaseCost: "1200",
    notes: "",
  };
}

export function peopleTemplateSample(departmentName = ""): Record<PersonFieldKey, string> {
  return {
    name: "Sample Person",
    email: "sample.person@example.com",
    department: departmentName,
  };
}

export function buildInventoryTemplateCsv(locationName = "") {
  const sample = inventoryTemplateSample(locationName);
  return toCsv([inventoryTemplateHeaders(), ASSET_FIELDS.map((field) => sample[field.key])]);
}

export function buildPeopleTemplateCsv(departmentName = "") {
  const sample = peopleTemplateSample(departmentName);
  return toCsv([peopleTemplateHeaders(), PERSON_FIELDS.map((field) => sample[field.key])]);
}
