import { appHref } from "./email";

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function layout(title: string, paragraphs: string[], cta?: { href: string; label: string }): { subject: string; text: string; html: string } {
  const text = [title, "", ...paragraphs, ...(cta ? ["", `${cta.label}: ${cta.href}`] : [])].join("\n");
  const body = paragraphs.map((p) => `<p style="line-height:1.5;margin:0 0 12px">${esc(p)}</p>`).join("");
  const button = cta
    ? `<p style="margin:20px 0 0"><a href="${esc(cta.href)}" style="display:inline-block;background:#ef8b4b;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">${esc(cta.label)}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f6f3eb;font-family:Manrope,Segoe UI,sans-serif;color:#222"><div style="max-width:560px;margin:24px auto;background:#fffdf8;border:1px solid #e6dfd2;border-radius:12px;padding:28px"><p style="margin:0 0 8px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#2a7a73">AssetControl</p><h1 style="margin:0 0 16px;font-size:22px">${esc(title)}</h1>${body}${button}</div></body></html>`;
  return { subject: title, text, html };
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  auditor: "Auditor",
  manager: "Manager",
  technician: "Technician",
  viewer: "Viewer",
};

export function teamInviteEmail(input: { name: string; role: string }) {
  const role = ROLE_LABEL[input.role] ?? input.role;
  const who = input.name.trim() || "there";
  return layout(`You're invited to AssetControl`, [
    `Hi ${who},`,
    `You have been onboarded as ${role}. Create your account with this same email to claim that role.`,
  ], { href: appHref("/sign-up"), label: "Create your account" });
}

export function assetAssignedEmail(input: { personName: string; assetName: string; assetTag: string }) {
  return layout(`Asset assigned: ${input.assetTag}`, [
    `Hi ${input.personName || "there"},`,
    `${input.assetName} (${input.assetTag}) has been assigned to you.`,
  ], { href: appHref("/inventory"), label: "Open inventory" });
}

export function assetReturnedEmail(input: { personName: string; assetName: string; assetTag: string }) {
  return layout(`Asset returned: ${input.assetTag}`, [
    `Hi ${input.personName || "there"},`,
    `${input.assetName} (${input.assetTag}) has been returned to available stock.`,
  ], { href: appHref("/inventory"), label: "Open inventory" });
}

export function maintenanceEmail(input: {
  kind: "scheduled" | "completed";
  assetName: string;
  assetTag: string;
  technician: string;
  notes?: string;
}) {
  const title =
    input.kind === "scheduled"
      ? `Maintenance scheduled: ${input.assetTag}`
      : `Maintenance completed: ${input.assetTag}`;
  const paragraphs = [
    `${input.assetName} (${input.assetTag}) — technician: ${input.technician}.`,
  ];
  if (input.notes) paragraphs.push(input.notes);
  return layout(title, paragraphs, { href: appHref("/maintenance"), label: "Open maintenance" });
}

export function reportStageEmail(input: { title: string; status: "ready_for_review" | "final" }) {
  const stage = input.status === "final" ? "Final" : "Ready for review";
  return layout(`Compliance report ${stage.toLowerCase()}: ${input.title}`, [
    `The report “${input.title}” is now ${stage}.`,
  ], { href: appHref("/reports"), label: "Open reports" });
}

export function custodyCheckEmail(input: {
  personName: string;
  checkTitle: string;
  dueAt: string;
  assets: { assetTag: string; assetName: string }[];
  href: string;
}) {
  const lines = input.assets.map((asset) => `${asset.assetName} (${asset.assetTag})`);
  const extra = lines.length > 3
    ? `${lines.slice(0, 3).join(", ")} and ${lines.length - 3} more`
    : lines.join(", ");
  return layout(`Please confirm you still have your assigned equipment`, [
    `Hi ${input.personName || "there"},`,
    `AssetControl is running “${input.checkTitle}”. Confirm you still have: ${extra || "your assigned equipment"}.`,
    `Please reply by ${input.dueAt}. If something is missing, say so on the confirmation page.`,
  ], { href: input.href, label: "Confirm equipment" });
}

export function warrantyEmail(input: {
  window: "warranty_30d" | "warranty_14d" | "warranty_7d" | "warranty_expired";
  assetName: string;
  assetTag: string;
  warrantyEnd: string;
}) {
  const headline =
    input.window === "warranty_expired"
      ? `Warranty expired: ${input.assetTag}`
      : `Warranty renewal due: ${input.assetTag}`;
  const when =
    input.window === "warranty_expired"
      ? `Warranty ended on ${input.warrantyEnd}. Renew or extend the date on the asset record.`
      : `Warranty ends on ${input.warrantyEnd}. Plan renewal before that date.`;
  return layout(headline, [`${input.assetName} (${input.assetTag}). ${when}`], {
    href: appHref("/inventory"),
    label: "Open inventory",
  });
}
