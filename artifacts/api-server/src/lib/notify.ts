import { and, eq, inArray, like, not } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  db,
  emailSendsTable,
  peopleTable,
  usersTable,
  type UserRole,
} from "@workspace/db";
import { PENDING_USER_PREFIX } from "./auth-roles";
import { sendEmail, type EmailContent } from "./email";
import {
  assetAssignedEmail,
  assetReturnedEmail,
  custodyCheckEmail,
  maintenanceEmail,
  reportStageEmail,
  teamInviteEmail,
  warrantyEmail,
} from "./email-templates";
import { notifySafely } from "./notify-safe";
import {
  OPERATIONAL_ROLES,
  REPORT_ROLES,
  isActiveAppUser,
  technicianMatches,
  uniqueValidEmails,
} from "./notify-recipients";

export type NotifyPayload =
  | {
      type: "team_invite";
      userId: string;
      email: string;
      name: string;
      role: string;
    }
  | {
      type: "asset_assigned" | "asset_returned";
      assetId: string;
      assetTag: string;
      assetName: string;
      personName: string;
      personEmail: string;
    }
  | {
      type: "maintenance_scheduled" | "maintenance_completed";
      maintenanceId: string;
      assetId: string;
      assetTag: string;
      assetName: string;
      technician: string;
      assigneeEmail?: string | null;
      notes?: string;
    }
  | {
      type: "report_ready_for_review" | "report_final";
      reportId: string;
      title: string;
    }
  | {
      type: "warranty";
      assetId: string;
      assetTag: string;
      assetName: string;
      warrantyEnd: string;
      window: "warranty_30d" | "warranty_14d" | "warranty_7d" | "warranty_expired";
      assigneeEmail?: string | null;
    };

async function activeUsersWithRoles(roles: UserRole[]) {
  const rows = await db
    .select()
    .from(usersTable)
    .where(and(not(like(usersTable.id, `${PENDING_USER_PREFIX}%`)), inArray(usersTable.role, roles)));
  return rows.filter((row) => isActiveAppUser(row.id));
}

async function deliver(
  event: string,
  entityId: string,
  window: string,
  recipient: string,
  message: EmailContent,
): Promise<"sent" | "skipped"> {
  const existing = await db
    .select({ id: emailSendsTable.id })
    .from(emailSendsTable)
    .where(
      and(
        eq(emailSendsTable.event, event),
        eq(emailSendsTable.entityId, entityId),
        eq(emailSendsTable.window, window),
        eq(emailSendsTable.recipient, recipient),
      ),
    )
    .limit(1);
  if (existing.length > 0) return "sent";

  const result = await sendEmail({ ...message, to: recipient });
  if (result.skipped) return "skipped";

  await db
    .insert(emailSendsTable)
    .values({
      id: `esend-${randomUUID().slice(0, 8)}`,
      event,
      entityId,
      window,
      recipient,
      sentAt: new Date(),
    })
    .onConflictDoNothing();
  return "sent";
}

async function notifyUnsafe(payload: NotifyPayload): Promise<void> {
  if (payload.type === "team_invite") {
    const to = uniqueValidEmails([payload.email])[0];
    if (!to) return;
    await deliver(payload.type, payload.userId, "default", to, teamInviteEmail(payload));
    return;
  }

  if (payload.type === "asset_assigned" || payload.type === "asset_returned") {
    const to = uniqueValidEmails([payload.personEmail])[0];
    if (!to) return;
    const message =
      payload.type === "asset_assigned"
        ? assetAssignedEmail(payload)
        : assetReturnedEmail(payload);
    await deliver(payload.type, payload.assetId, "default", to, message);
    return;
  }

  if (payload.type === "maintenance_scheduled" || payload.type === "maintenance_completed") {
    const staff = await activeUsersWithRoles(OPERATIONAL_ROLES);
    const allActive = await activeUsersWithRoles(["admin", "auditor", "manager", "technician", "viewer"]);
    const matched = allActive.filter((user) => technicianMatches(payload.technician, user));
    const recipients = uniqueValidEmails([
      ...staff.map((user) => user.email),
      ...matched.map((user) => user.email),
      payload.assigneeEmail,
    ]);
    const message = maintenanceEmail({
      kind: payload.type === "maintenance_scheduled" ? "scheduled" : "completed",
      assetName: payload.assetName,
      assetTag: payload.assetTag,
      technician: payload.technician,
      notes: payload.notes,
    });
    for (const to of recipients) {
      await deliver(payload.type, payload.maintenanceId, "default", to, message);
    }
    return;
  }

  if (payload.type === "report_ready_for_review" || payload.type === "report_final") {
    const staff = await activeUsersWithRoles(REPORT_ROLES);
    const recipients = uniqueValidEmails(staff.map((user) => user.email));
    const status = payload.type === "report_final" ? "final" : "ready_for_review";
    const message = reportStageEmail({ title: payload.title, status });
    for (const to of recipients) {
      await deliver(payload.type, payload.reportId, "default", to, message);
    }
    return;
  }

  if (payload.type === "warranty") {
    const staff = await activeUsersWithRoles(OPERATIONAL_ROLES);
    const recipients = uniqueValidEmails([
      ...staff.map((user) => user.email),
      payload.assigneeEmail,
    ]);
    const message = warrantyEmail(payload);
    for (const to of recipients) {
      await deliver("warranty", payload.assetId, payload.window, to, message);
    }
  }
}

export async function notify(payload: NotifyPayload): Promise<void> {
  await notifySafely(payload.type, () => notifyUnsafe(payload));
}

export async function sendCustodyMail(input: {
  recipientId: string;
  attempt: number;
  email: string;
  personName: string;
  checkTitle: string;
  dueAt: string;
  assets: { assetTag: string; assetName: string }[];
  href: string;
}): Promise<"sent" | "skipped"> {
  const to = uniqueValidEmails([input.email])[0];
  if (!to) return "skipped";
  return deliver(
    "custody_check",
    input.recipientId,
    `attempt-${input.attempt}`,
    to,
    custodyCheckEmail(input),
  );
}

export async function assigneeEmailFor(personId: string | null | undefined): Promise<string | null> {
  if (!personId) return null;
  const rows = await db
    .select({ email: peopleTable.email })
    .from(peopleTable)
    .where(eq(peopleTable.id, personId))
    .limit(1);
  return rows[0]?.email ?? null;
}
