import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { rateLimit } from "express-rate-limit";
import path from "path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
  keyGenerator: (req) => (req.headers["x-tester-id"] as string) ?? req.ip ?? "anon",
  message: { error: "Too many AI requests — please wait a while before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API: 300 requests per 15 min per tester
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  keyGenerator: (req) => (req.headers["x-tester-id"] as string) ?? req.ip ?? "anon",
  message: { error: "Too many requests — slow down a little." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/openai", aiLimiter);
app.use("/api/advise", aiLimiter);
app.use("/api/daemon-memory", aiLimiter);
app.use("/api", generalLimiter);
app.use("/api", router);

// Serve Tides frontend as static files
const publicDir = path.resolve(__dirname, "../../../artifacts/tides/public");
app.use(express.static(publicDir));

// SPA routing: serve index.html for non-API routes
app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

export default app;
