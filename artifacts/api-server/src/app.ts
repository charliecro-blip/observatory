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
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// AI endpoints: 30 requests per hour per IP
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => (req.headers["x-tester-id"] as string) ?? ipKeyGenerator(req.ip ?? "anon"),
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
  keyGenerator: (req) => (req.headers["x-tester-id"] as string) ?? ipKeyGenerator(req.ip ?? "anon"),
  message: { error: "Too many requests — slow down a little." },
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
app.use("/api/account/recover", recoverLimiter);
app.use("/api", generalLimiter);
app.use("/api", router);

app.get("/privacy", privacyHandler);

// Serve Tides frontend as static files
const publicDir = path.join(process.cwd(), "artifacts/tides/public");
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
