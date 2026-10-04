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
import { createHmac, timingSafeEqual } from "crypto";
import { logger } from "./logger.js";

const API = "https://api.resend.com/emails";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

// Unsubscribing must work from the email itself, without signing in, and must
// not be possible for anyone who only knows a tester id (ids are public
// identity). So the link carries an HMAC of the id. The secret has to outlive
// a deploy or every link already sent breaks: UNSUBSCRIBE_SECRET if set, else
// the Resend key, which exists whenever an email can be sent at all.
function unsubscribeSecret(): string | null {
  return process.env.UNSUBSCRIBE_SECRET ?? process.env.RESEND_API_KEY ?? null;
}

export function unsubscribeToken(testerId: string): string | null {
  const secret = unsubscribeSecret();
  return secret ? createHmac("sha256", secret).update(`unsubscribe:${testerId}`).digest("base64url").slice(0, 32) : null;
}

export function verifyUnsubscribeToken(testerId: string, token: string): boolean {
  const expected = unsubscribeToken(testerId);
  if (!expected || !testerId || token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function unsubscribeUrl(base: string, testerId: string): string | null {
  const k = unsubscribeToken(testerId);
  return k ? `${base.replace(/\/$/, "")}/api/reports/unsubscribe?t=${encodeURIComponent(testerId)}&k=${k}` : null;
}

export async function sendEmail(to: string, subject: string, html: string, opts: { unsubscribeUrl?: string | null } = {}): Promise<boolean> {
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
      body: JSON.stringify({
        from, to: [to], subject, html,
        // RFC 8058 one-click: Gmail and Apple Mail show their own Unsubscribe
        // button, which POSTs to this URL.
        ...(opts.unsubscribeUrl ? { headers: {
          "List-Unsubscribe": `<${opts.unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        } } : {}),
      }),
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
