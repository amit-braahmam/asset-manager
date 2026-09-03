import { Resend } from "resend";
import { logger } from "./logger";

export type EmailContent = {
  subject: string;
  text: string;
  html: string;
};

export type OutboundEmail = EmailContent & { to: string };

export type SendResult = { skipped: boolean };

export function emailEnabled(): boolean {
  if (process.env.EMAIL_ENABLED === "false") return false;
  return Boolean(process.env.RESEND_API_KEY);
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
}

export function appHref(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${appUrl()}${suffix}`;
}

export async function sendEmail(message: OutboundEmail): Promise<SendResult> {
  if (!emailEnabled()) {
    logger.info({ to: message.to, subject: message.subject }, "email skipped (disabled or no RESEND_API_KEY)");
    return { skipped: true };
  }
  const from = process.env.EMAIL_FROM?.trim();
  if (!from) {
    logger.warn({ to: message.to }, "email skipped (EMAIL_FROM missing)");
    return { skipped: true };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  if (error) {
    throw new Error(error.message);
  }
  return { skipped: false };
}
