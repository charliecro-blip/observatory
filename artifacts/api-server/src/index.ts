import app from "./app";
import { logger } from "./lib/logger";
import { startNotifier } from "./lib/notifier";
import { vocSpansBetween } from "./lib/dayarc";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startNotifier();
  // The calendar's 90-day void spans are a pure function of the sky and
  // memoized per UTC range; the first computation is ~2s of synchronous
  // work (measured 2026-08-21). Paid here, once, after the port is open —
  // not by whoever opens the Calendar first.
  setTimeout(() => {
    try {
      const n = new Date();
      const t0 = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
      vocSpansBetween(t0, t0 + 90 * 86400000);
    } catch (err) { logger.warn({ err }, "void-span warm failed"); }
  }, 1500);
});
