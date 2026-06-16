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

  // Fall back to query param — used by streaming voice endpoints that cannot set custom headers
  const fromQuery = typeof req.query["testerId"] === "string" ? req.query["testerId"].trim() : undefined;

  const testerId = fromHeader || fromQuery;

  if (!testerId) {
    res.status(400).json({
      error: "Missing x-tester-id header. Please create or select a tester profile in the app.",
    });
    return;
  }

  res.locals.testerId = testerId;
  next();
}
