import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import { privacyHandler } from "./routes/privacy";

const app: Express = express();

// Railway sits in front of this server as a reverse proxy — without this,
// every request's req.ip resolves to Railway's proxy address, not the real
// client. That silently merged every anonymous request (no x-tester-id
// header: health checks, and any endpoint hit before a tester profile
// exists) into ONE shared rate-limit bucket, so one busy anonymous client
// could 429 everyone else (audit finding).
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
/**
 * CORS, restricted to origins that are actually ours — not wildcard.
 *
 * `x-tester-id` is a custom header, which means every request carrying it
 * triggers a CORS preflight, and a wildcard `cors()` answers that preflight
 * "yes, any origin may read this response." Since `x-tester-id` is already
 * the app's de facto bearer credential (no session, no cookie — the audit's
 * own finding), a wildcard here meant a malicious page, anywhere, could run
 * `fetch("https://compass.day/api/...", {headers: {"x-tester-id": leakedId}})`
 * from a visitor's browser and read the personal response back into its own
 * JS. Restricting the origin doesn't touch server-to-server callers (the
 * external Engine API, `curl`, another backend) — CORS is enforced by
 * browsers against browser-initiated JS, never against a non-browser HTTP
 * client, so `/engine/*`'s bearer-token consumers are unaffected either way.
 */
const ALLOWED_ORIGINS = [
  "https://compass.day",
  "https://www.compass.day",
];
app.use(cors({
  origin(origin, callback) {
    // No Origin header at all — a server-to-server call, curl, or a same-origin
    // request a browser doesn't bother sending one for. Always allowed; CORS
    // exists to restrict cross-origin BROWSER reads, and there is no browser
    // read to restrict here.
    if (!origin) { callback(null, true); return; }
    if (ALLOWED_ORIGINS.includes(origin)) { callback(null, true); return; }
    // Any localhost/127.0.0.1 port, for the Vite dev server talking to the API
    // on a different port — an allowlist of exact ports would need updating
    // every time either dev port changes.
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) { callback(null, true); return; }
    // `callback(null, false)`, not an Error — the `cors` package's own
    // documented way to deny. Throwing turned every disallowed origin into a
    // 500, which is a false server-fault signal for what is ordinary blocked
    // traffic, not a crash. This still denies correctly: the response simply
    // carries no Access-Control-Allow-Origin header, which is what actually
    // stops a browser reading it.
    callback(null, false);
  },
}));
// The security headers vercel.json used to send — and stopped sending the day
// the app moved to Railway, because that file's headers only exist on Vercel's
// edge. Express ships them itself now, so they survive the next migration too.
// Set by hand rather than via helmet: helmet's default bundle includes a CSP,
// and this app's inline styles would need a permissive one that says nothing —
// three headers we mean are better than ten we would have to disclaim.
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
// 50mb was never a real requirement — nothing in this app accepts a file
// upload; every POST body is text (a pasted task list, a journal entry, a
// settings blob). Checked against the largest legitimate body in the app
// before picking a number: `plan/parse`'s pasted list, split line by line, is
// still plain text at any realistic size. 2mb leaves generous room for an
// enormous paste while closing an easy amplification vector — `POST
// /api/events` in particular is UNAUTHENTICATED (ingest has to stay open),
// so a 50mb ceiling there was an invitation.
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

/**
 * LIMITER KEYS ARE THE IP, FULL STOP.
 *
 * These used to key on `x-tester-id` when present, and that header is
 * attacker-chosen: rotating it per request minted a fresh bucket every time
 * and walked past the AI cap, the general cap, and the 5/hour deletion cap
 * (which exists precisely to stop a leaked id being used for bulk wipes).
 *
 * And the first fix here was wrong in a way worth recording: keying on
 * `ip·testerId` reads like "IP-first" but is still one bucket PER ID —
 * measured with 40 rotated ids from one IP, `ratelimit-remaining` never
 * moved. Any key that varies with attacker-chosen input preserves the
 * bypass no matter what it is prefixed with. The cost of IP-only keys is
 * that people behind one NAT share a bucket; at 1000/15min that is
 * headroom for a floor of an office, and it is the only key the caller
 * cannot choose.
 */
const limiterKey = (req: express.Request): string => ipKeyGenerator(req.ip ?? "anon");

// AI endpoints: 30 requests per hour
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: limiterKey,
  message: { error: "Too many AI requests — please wait a while before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
  // esbuild renames the ipKeyGenerator import when bundling, which breaks
  // express-rate-limit's toString()-based static check for its usage.
  validate: false,
});

// General API: 300 requests per 15 min per tester
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // These are cheap local-compute endpoints (ephemeris, tasks) and the app
  // itself polls several of them per minute across components. 300/15min
  // (20/min) was tight enough that an active session could brush it and start
  // getting error objects back. 1000 gives real headroom; the AI limiter above
  // (30/hr) still guards the one endpoint that actually costs money.
  max: 1000,
  keyGenerator: limiterKey,
  message: { error: "Too many requests — slow down a little." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

// Deletion is irreversible and unauthenticated beyond the tester id. A handful
// per hour is far more than any real person needs and stops a leaked id from
// being used to wipe accounts in bulk.
const deleteAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: limiterKey,
  message: { error: "Too many deletion attempts — please wait a while, or email charliecro@gmail.com." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

// Account recovery is the sole "password" in a passwordless system — an
// unauthenticated, unthrottled endpoint here is a brute-forceable account
// takeover. 20/15min per IP is generous for a real user mistyping their key,
// tight for a scripted guesser.
const recoverLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many recovery attempts — please wait a while before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

app.use("/api/openai", aiLimiter);
app.use("/api/advise", aiLimiter);
app.use("/api/daemon-memory", aiLimiter);
// Every route that calls the OpenAI client, not just the three original
// ones — associate/plan/planning/chart/blueprint/body-weather all bypassed
// the cap entirely (an uncapped inference bill, audit finding).
app.use("/api/associate", aiLimiter);
app.use("/api/plan/parse", aiLimiter);
app.use("/api/plan/weave", aiLimiter);
app.use("/api/planning/breakdown", aiLimiter);
app.use("/api/chart/explicate", aiLimiter);
app.use("/api/natal-chart/blueprint/generate", aiLimiter);
app.use("/api/body-weather/regenerate", aiLimiter);
// The GET is behind the cap too: /today calls the model on a cache miss, and
// posting a check-in invalidates that cache — so alternating the two drove
// uncapped inference through the "read" route while only "regenerate" paid.
app.use("/api/body-weather/today", aiLimiter);
app.use("/api/account/recover", recoverLimiter);
// Method-scoped on purpose: /api/account/sync is called on every profile
// change, so a path-wide limiter here would throttle ordinary use.
app.delete("/api/account", deleteAccountLimiter);
app.use("/api", generalLimiter);
app.use("/api", router);

app.get("/privacy", privacyHandler);

// Serve Tides frontend as static files.
//
// Everything under /assets is CONTENT-HASHED by the build (index-eDsprgyI.js),
// so a given URL's bytes can never change — a new build produces a new name.
// Those are safe to cache forever, and `immutable` additionally tells the
// browser not to send a revalidation request on reload. They were being served
// with a 4-hour max-age, which meant a returning user re-validated the whole
// bundle every session for no possible benefit.
//
// index.html is deliberately excluded: it is the one file whose contents DO
// change in place, and it carries the pointers to the hashed assets.
const publicDir = path.join(process.cwd(), "artifacts/tides/public");
app.use("/assets", express.static(path.join(publicDir, "assets"), {
  immutable: true,
  maxAge: "1y",
}));
app.use(express.static(publicDir));

// SPA routing: serve index.html for non-API routes
app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"), (err) => {
    if (err) {
      logger.error({ err }, "Failed to serve index.html");
      res.status(404).send("Not found");
    }
  });
});

export default app;
