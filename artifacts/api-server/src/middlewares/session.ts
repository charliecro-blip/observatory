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
 * Unclaimed accounts also pass — that is the rollout, not a hole: the bare
 * id works exactly until the account's own client claims it on next boot,
 * so the deploy that ships this cannot lock anyone out. See
 * lib/accountAuth.ts for the model and the TOFU window it accepts.
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
      // from every other 401-shaped failure without parsing prose.
      res.status(401).json({ error: "session_required", reason: "invalid-or-missing-session" });
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
