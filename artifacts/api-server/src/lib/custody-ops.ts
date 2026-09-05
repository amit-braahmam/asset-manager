import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { CustodyCheck as ApiCustodyCheck, CustodyCheckDetail, CustodySendResult, PublicCustodyView } from "@workspace/api-zod";
import {
  db,
  assetsTable,
  assetHistoryTable,
  custodyChecksTable,
  custodyItemsTable,
  custodyRecipientsTable,
  peopleTable,
  type CustodyCadence,
  type CustodyCheck,
  type CustodyItem,
  type CustodyRecipient,
} from "@workspace/db";
import { appHref } from "./email";
import { sendCustodyMail } from "./notify";
import { normalizeEmail } from "./notify-recipients";
import {
  CUSTODY_MAX_SEND_ATTEMPTS,
  CUSTODY_TOKEN_TTL_MS,
  cadenceReady,
  clampBatchSize,
  hashCustodyToken,
  newCustodyToken,
  pickQueuedRecipients,
  tokenExpired,
} from "./custody";

function id(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 12)}`;
}

function countsFor(recipients: CustodyRecipient[], items: CustodyItem[]) {
  const itemsByRecipient = new Map<string, CustodyItem[]>();
  for (const item of items) {
    const list = itemsByRecipient.get(item.recipientId) ?? [];
    list.push(item);
    itemsByRecipient.set(item.recipientId, list);
  }
  let confirmed = 0;
  let denied = 0;
  let pending = 0;
  for (const item of items) {
    if (item.response === "confirmed") confirmed += 1;
    else if (item.response === "denied") denied += 1;
    else pending += 1;
  }
  return {
    recipientCount: recipients.length,
    queuedCount: recipients.filter((row) => row.mailStatus === "queued").length,
    sentCount: recipients.filter((row) => row.mailStatus === "sent").length,
    blockedCount: recipients.filter((row) => row.mailStatus === "blocked" || row.mailStatus === "skipped_no_email").length,
    confirmedCount: confirmed,
    deniedCount: denied,
    pendingCount: pending,
    itemsByRecipient,
  };
}

function toCheck(row: CustodyCheck, recipients: CustodyRecipient[], items: CustodyItem[]): ApiCustodyCheck {
  const tally = countsFor(recipients, items);
  return {
    id: row.id,
    title: row.title,
    dueAt: row.dueAt,
    status: row.status,
    batchSize: row.batchSize,
    cadence: row.cadence,
    lastSendAt: row.lastSendAt,
    locationId: row.locationId,
    departmentId: row.departmentId,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    recipientCount: tally.recipientCount,
    queuedCount: tally.queuedCount,
    sentCount: tally.sentCount,
    confirmedCount: tally.confirmedCount,
    deniedCount: tally.deniedCount,
    pendingCount: tally.pendingCount,
    blockedCount: tally.blockedCount,
  };
}

function toItem(item: CustodyItem) {
  return {
    id: item.id,
    assetId: item.assetId,
    assetTag: item.assetTag,
    assetName: item.assetName,
    response: item.response,
    respondedAt: item.respondedAt,
    note: item.note,
  };
}

async function loadBundle(checkId: string) {
  const checks = await db.select().from(custodyChecksTable).where(eq(custodyChecksTable.id, checkId)).limit(1);
  if (checks.length === 0) return null;
  const [recipients, items] = await Promise.all([
    db.select().from(custodyRecipientsTable).where(eq(custodyRecipientsTable.checkId, checkId)).orderBy(asc(custodyRecipientsTable.personName)),
    db.select().from(custodyItemsTable).where(eq(custodyItemsTable.checkId, checkId)).orderBy(asc(custodyItemsTable.assetTag)),
  ]);
  return { check: checks[0], recipients, items };
}

export async function listCustodyChecks(): Promise<ApiCustodyCheck[]> {
  const checks = await db.select().from(custodyChecksTable).orderBy(asc(custodyChecksTable.createdAt));
  if (checks.length === 0) return [];
  const ids = checks.map((row) => row.id);
  const [recipients, items] = await Promise.all([
    db.select().from(custodyRecipientsTable).where(inArray(custodyRecipientsTable.checkId, ids)),
    db.select().from(custodyItemsTable).where(inArray(custodyItemsTable.checkId, ids)),
  ]);
  return checks.map((check) => toCheck(
    check,
    recipients.filter((row) => row.checkId === check.id),
    items.filter((row) => row.checkId === check.id),
  )).reverse();
}

export async function getCustodyCheck(checkId: string): Promise<CustodyCheckDetail | null> {
  const bundle = await loadBundle(checkId);
  if (!bundle) return null;
  const tally = countsFor(bundle.recipients, bundle.items);
  return {
    ...toCheck(bundle.check, bundle.recipients, bundle.items),
    recipients: bundle.recipients.map((row) => ({
      id: row.id,
      personId: row.personId,
      personName: row.personName,
      email: row.email,
      mailStatus: row.mailStatus,
      sendAttempts: row.sendAttempts,
      sentAt: row.sentAt,
      expiresAt: row.expiresAt,
      items: (tally.itemsByRecipient.get(row.id) ?? []).map(toItem),
    })),
  };
}

export async function createCustodyCheck(input: {
  title: string;
  dueAt: Date;
  batchSize?: number;
  cadence?: CustodyCadence;
  locationId?: string | null;
  departmentId?: string | null;
  createdBy: string;
}): Promise<{ ok: true; check: CustodyCheckDetail } | { ok: false; status: number; error: string }> {
  const assigned = await db
    .select({
      assetId: assetsTable.id,
      assetTag: assetsTable.assetTag,
      assetName: assetsTable.name,
      locationId: assetsTable.locationId,
      personId: peopleTable.id,
      personName: peopleTable.name,
      email: peopleTable.email,
      departmentId: peopleTable.departmentId,
    })
    .from(assetsTable)
    .innerJoin(peopleTable, eq(assetsTable.assigneeId, peopleTable.id))
    .where(eq(assetsTable.status, "assigned"));

  const filtered = assigned.filter((row) => {
    if (input.locationId && row.locationId !== input.locationId) return false;
    if (input.departmentId && row.departmentId !== input.departmentId) return false;
    return true;
  });
  if (filtered.length === 0) {
    return { ok: false, status: 400, error: "No assigned assets matched this check." };
  }

  const grouped = new Map<string, typeof filtered>();
  for (const row of filtered) {
    const list = grouped.get(row.personId) ?? [];
    list.push(row);
    grouped.set(row.personId, list);
  }

  const checkId = id("cc");
  const now = new Date();
  await db.insert(custodyChecksTable).values({
    id: checkId,
    title: input.title.trim(),
    dueAt: input.dueAt,
    status: "open",
    batchSize: clampBatchSize(input.batchSize),
    cadence: input.cadence ?? "hour",
    lastSendAt: null,
    locationId: input.locationId ?? null,
    departmentId: input.departmentId ?? null,
    createdBy: input.createdBy,
    createdAt: now,
  });

  for (const [personId, rows] of grouped) {
    const email = normalizeEmail(rows[0].email) ?? "";
    const recipientId = id("cr");
    await db.insert(custodyRecipientsTable).values({
      id: recipientId,
      checkId,
      personId,
      personName: rows[0].personName,
      email,
      mailStatus: email ? "queued" : "skipped_no_email",
    });
    await db.insert(custodyItemsTable).values(rows.map((row) => ({
      id: id("ci"),
      checkId,
      recipientId,
      assetId: row.assetId,
      assetTag: row.assetTag,
      assetName: row.assetName,
      response: "pending" as const,
      note: "",
    })));
  }

  const detail = await getCustodyCheck(checkId);
  return { ok: true, check: detail! };
}

export async function closeCustodyCheck(checkId: string): Promise<ApiCustodyCheck | null> {
  const bundle = await loadBundle(checkId);
  if (!bundle) return null;
  await db.update(custodyChecksTable).set({ status: "closed" }).where(eq(custodyChecksTable.id, checkId));
  const next = await loadBundle(checkId);
  return toCheck(next!.check, next!.recipients, next!.items);
}

export async function remindCustodyCheck(checkId: string): Promise<ApiCustodyCheck | null> {
  const bundle = await loadBundle(checkId);
  if (!bundle) return null;
  if (bundle.check.status !== "open") return toCheck(bundle.check, bundle.recipients, bundle.items);
  const pendingByRecipient = new Set(
    bundle.items.filter((item) => item.response === "pending").map((item) => item.recipientId),
  );
  for (const row of bundle.recipients) {
    if (!row.email || !pendingByRecipient.has(row.id)) continue;
    if (row.mailStatus === "skipped_no_email" || row.mailStatus === "blocked") continue;
    await db.update(custodyRecipientsTable).set({
      mailStatus: "queued",
      tokenHash: null,
      expiresAt: null,
    }).where(eq(custodyRecipientsTable.id, row.id));
  }
  const next = await loadBundle(checkId);
  return toCheck(next!.check, next!.recipients, next!.items);
}

export async function sendCustodyBatch(
  checkId: string,
  options: { ignoreCadence?: boolean; now?: Date } = {},
): Promise<CustodySendResult | null> {
  const now = options.now ?? new Date();
  const bundle = await loadBundle(checkId);
  if (!bundle) return null;
  if (bundle.check.status !== "open") {
    return { sent: 0, skipped: 0, blocked: 0, remaining: 0, previewLinks: [] };
  }
  if (!options.ignoreCadence && !cadenceReady(bundle.check.cadence, bundle.check.lastSendAt, now)) {
    return {
      sent: 0,
      skipped: 0,
      blocked: 0,
      remaining: bundle.recipients.filter((row) => row.mailStatus === "queued").length,
      previewLinks: [],
    };
  }

  const queued = bundle.recipients.filter((row) => row.mailStatus === "queued" && row.email);
  const batch = pickQueuedRecipients(queued, bundle.check.batchSize);
  let sent = 0;
  let skipped = 0;
  let blocked = 0;
  const previewLinks: { email: string; href: string }[] = [];
  const tally = countsFor(bundle.recipients, bundle.items);

  for (const recipient of batch) {
    const token = newCustodyToken();
    const expiresAt = new Date(now.getTime() + CUSTODY_TOKEN_TTL_MS);
    const attempts = recipient.sendAttempts + 1;
    await db.update(custodyRecipientsTable).set({
      tokenHash: hashCustodyToken(token),
      sendAttempts: attempts,
      lastAttemptAt: now,
      expiresAt,
    }).where(eq(custodyRecipientsTable.id, recipient.id));

    const items = (tally.itemsByRecipient.get(recipient.id) ?? []).filter((item) => item.response === "pending");
    const href = appHref(`/custody/${token}`);
    try {
      const result = await sendCustodyMail({
        recipientId: recipient.id,
        attempt: attempts,
        email: recipient.email,
        personName: recipient.personName,
        checkTitle: bundle.check.title,
        dueAt: bundle.check.dueAt.toISOString().slice(0, 10),
        assets: items.map((item) => ({ assetTag: item.assetTag, assetName: item.assetName })),
        href,
      });
      await db.update(custodyRecipientsTable).set({
        mailStatus: "sent",
        sentAt: now,
      }).where(eq(custodyRecipientsTable.id, recipient.id));
      if (result === "skipped") {
        skipped += 1;
        previewLinks.push({ email: recipient.email, href });
      } else {
        sent += 1;
      }
    } catch {
      if (attempts >= CUSTODY_MAX_SEND_ATTEMPTS) {
        await db.update(custodyRecipientsTable).set({ mailStatus: "blocked" }).where(eq(custodyRecipientsTable.id, recipient.id));
        blocked += 1;
      }
    }
  }

  if (batch.length > 0) {
    await db.update(custodyChecksTable).set({ lastSendAt: now }).where(eq(custodyChecksTable.id, checkId));
  }

  const remaining = (await db.select({ mailStatus: custodyRecipientsTable.mailStatus })
    .from(custodyRecipientsTable)
    .where(and(eq(custodyRecipientsTable.checkId, checkId), eq(custodyRecipientsTable.mailStatus, "queued")))).length;

  return { sent, skipped, blocked, remaining, previewLinks };
}

export async function sendDueCustodyBatches(now = new Date()) {
  const open = await db.select().from(custodyChecksTable).where(eq(custodyChecksTable.status, "open"));
  const results = [];
  for (const check of open) {
    if (!cadenceReady(check.cadence, check.lastSendAt, now)) continue;
    const result = await sendCustodyBatch(check.id, { ignoreCadence: true, now });
    if (result) results.push({ checkId: check.id, ...result });
  }
  return { processed: results.length, results };
}

function publicView(check: CustodyCheck, recipient: CustodyRecipient, items: CustodyItem[]): PublicCustodyView {
  return {
    checkTitle: check.title,
    dueAt: check.dueAt,
    personName: recipient.personName,
    items: items.map(toItem),
  };
}

async function loadByToken(token: string) {
  const tokenHash = hashCustodyToken(token);
  const recipients = await db.select().from(custodyRecipientsTable).where(eq(custodyRecipientsTable.tokenHash, tokenHash)).limit(1);
  if (recipients.length === 0) return { error: "not_found" as const };
  const recipient = recipients[0];
  const bundle = await loadBundle(recipient.checkId);
  if (!bundle) return { error: "not_found" as const };
  const items = bundle.items.filter((item) => item.recipientId === recipient.id);
  if (bundle.check.status === "closed" || tokenExpired(recipient.expiresAt)) {
    return { error: "gone" as const };
  }
  return { check: bundle.check, recipient, items };
}

export async function getPublicCustody(token: string): Promise<{ ok: true; view: PublicCustodyView } | { ok: false; status: number; error: string }> {
  const loaded = await loadByToken(token);
  if ("error" in loaded && loaded.error === "not_found") return { ok: false, status: 404, error: "This confirmation link is not valid." };
  if ("error" in loaded && loaded.error === "gone") return { ok: false, status: 410, error: "This confirmation link has expired." };
  return { ok: true, view: publicView(loaded.check, loaded.recipient, loaded.items) };
}

export async function respondPublicCustody(
  token: string,
  answers: { itemId: string; response: "confirmed" | "denied"; note?: string }[],
): Promise<{ ok: true; view: PublicCustodyView } | { ok: false; status: number; error: string }> {
  const loaded = await loadByToken(token);
  if ("error" in loaded && loaded.error === "not_found") return { ok: false, status: 404, error: "This confirmation link is not valid." };
  if ("error" in loaded && loaded.error === "gone") return { ok: false, status: 410, error: "This confirmation link has expired." };

  const byId = new Map(loaded.items.map((item) => [item.id, item]));
  const now = new Date();
  for (const answer of answers) {
    const item = byId.get(answer.itemId);
    if (!item) return { ok: false, status: 404, error: "An item on this link was not found." };
    if (item.response !== "pending") {
      return { ok: false, status: 409, error: `${item.assetTag} was already answered.` };
    }
    await db.update(custodyItemsTable).set({
      response: answer.response,
      respondedAt: now,
      note: (answer.note ?? "").trim(),
    }).where(eq(custodyItemsTable.id, item.id));
    await db.insert(assetHistoryTable).values({
      id: id("hist"),
      assetId: item.assetId,
      action: "alert",
      detail: answer.response === "confirmed"
        ? `${loaded.recipient.personName} confirmed they still have ${item.assetName} (${item.assetTag}).`
        : `${loaded.recipient.personName} reported ${item.assetName} (${item.assetTag}) as missing.`,
      actor: loaded.recipient.personName,
      createdAt: now,
    });
  }
  const next = await loadByToken(token);
  if ("error" in next) return { ok: false, status: 410, error: "This confirmation link has expired." };
  return { ok: true, view: publicView(next.check, next.recipient, next.items) };
}
