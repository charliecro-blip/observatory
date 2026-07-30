import { type Request, type Response, type NextFunction } from "express";

/**
 * Extracts the x-tester-id header and places it on res.locals.testerId.
 * Returns 400 if the header is absent or blank.
 *
 * Apply to every route that reads or writes personal data.
 */
export function requireTesterId(req: Request, res: Response, next: NextFunction): void {
  const raw = req.headers["x-tester-id"];
  const fromHeader = (Array.isArray(raw) ? raw[0] : raw)?.trim();

  // NO query-param fallback. It was added for streaming voice endpoints that
  // no longer exist (nothing in the client passes ?testerId= to a middleware-
  // guarded route), and it made every leaked URL a working credential: a
  // calendar-feed link alone returned the personal logbook and, via
  // /account/sync, the recovery code. Routes that genuinely need a query id
  // (iCal export, the Google OAuth hand-off) read it themselves and are
  // scoped accordingly.
  const testerId = fromHeader;

  if (!testerId) {
    res.status(400).json({
      error: "Missing x-tester-id header. Please create or select a tester profile in the app.",
    });
    return;
  }

  res.locals.testerId = testerId;
  next();
}
