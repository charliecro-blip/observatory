/**
 * The gate the tester id never had.
 *
 * Sits on /api ahead of every router. When a request presents an identity
 * (x-tester-id) for an account that has been CLAIMED, it must also present
 * the session token that claim minted — or the request ends here with a 401,
 * before any route's own header-reading logic can trust it. Requests with no
 * identity pass through untouched: public routes (the sky, the almanac,
 * healthz, the iCal feed with its own scoped token) never presented one, and
 * the per-route guards still enforce presence where identity is required.
 *
 * Unclaimed accounts pass too, but only until the TOFU deadline — the bare id
 * works until the account's own client claims it, and no later than that date.
 * Without the deadline the rollout never ended: an account nobody opens never
 * claims, so it stays open forever (measured 2026-08-19: 19 of 20 profiles).
 * See lib/accountAuth.ts for the deadline and why recovery stays open past it.
 */
import { type Request, type Response, type NextFunction } from "express";
import { verifySession } from "../lib/accountAuth.js";

/** Paths that must work while holding an identity but no session yet. */
const EXEMPT = new Set([
  "/account/claim",     // this is how a token is obtained
  "/account/recover",   // carries no identity, but exempt defensively
]);

export async function requireValidSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const raw = req.headers["x-tester-id"];
  const testerId = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!testerId || EXEMPT.has(req.path)) { next(); return; }

  const token = (() => {
    const t = req.headers["x-session-token"];
    const v = (Array.isArray(t) ? t[0] : t)?.trim();
    return v || null;
  })();

  try {
    const verdict = await verifySession(testerId, token);
    if (verdict.state === "invalid") {
      // One named reason, so the client can tell "restore your session" apart
      // from every other 401-shaped failure without parsing prose. The reason
      // distinguishes a dead/absent token from an account whose trust-on-first-
      // use window simply ran out — different stories, same repair, and the
      // second one is what every dormant account meets on its first boot back.
      res.status(401).json({
        error: "session_required",
        reason: verdict.reason === "window-closed" ? "claim-window-closed" : "invalid-or-missing-session",
      });
      return;
    }
    next();
  } catch (err) {
    // The gate failing OPEN would silently disable auth on a database blip;
    // failing CLOSED turns a blip into a full outage. Closed is correct for a
    // security gate — and the client's outage states already say "couldn't
    // reach Compass" honestly rather than showing an empty life.
    req.log?.error({ err }, "session verification failed");
    res.status(503).json({ error: "auth_unavailable" });
  }
}
