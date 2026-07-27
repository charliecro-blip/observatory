/**
 * Email sending — Resend, via its plain REST API (no SDK dependency).
 *
 * Configuration (Railway env):
 *   RESEND_API_KEY — from resend.com (free tier: 100/day, 3k/month)
 *   EMAIL_FROM     — verified sender, e.g. "Compass <reports@yourdomain.com>".
 *                    Until a domain is verified with Resend, use
 *                    "Compass <onboarding@resend.dev>" (delivers only to the
 *                    Resend account owner's address — fine for self-testing).
 *
 * Without RESEND_API_KEY this module no-ops loudly (logs, returns false) so
 * the notifier loop and routes behave identically in dev.
 */
import { logger } from "./logger.js";

const API = "https://api.resend.com/emails";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Compass <onboarding@resend.dev>";
  if (!key) {
    logger.info({ to, subject }, "email: RESEND_API_KEY not set — skipping send");
    return false;
  }
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn({ to, subject, status: res.status, body: body.slice(0, 300) }, "email: send failed");
      return false;
    }
    logger.info({ to, subject }, "email: sent");
    return true;
  } catch (e) {
    logger.warn({ e, to, subject }, "email: send threw");
    return false;
  }
}
