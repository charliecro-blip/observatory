import { Router } from "express";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { db } from "@workspace/db";
import { googleCalTokens } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

// ── OAuth state ──────────────────────────────────────────────────────────────
// The state parameter was an UNSIGNED base64 of {testerId}: anyone could mint
// one, so a victim could be walked through a flow that attached the attacker's
// Google account to their profile (or the reverse). It is now HMAC-signed with
// a server secret and expires, so only we can issue it and only briefly.
const STATE_SECRET = process.env["OAUTH_STATE_SECRET"]
  ?? process.env["GOOGLE_CLIENT_SECRET"]   // already a server-only secret
  ?? randomBytes(32).toString("hex");      // last resort: valid for this boot only
const STATE_TTL_MS = 10 * 60 * 1000;

function signState(testerId: string): string {
  const body = Buffer.from(JSON.stringify({ testerId, ts: Date.now(), n: randomBytes(8).toString("hex") })).toString("base64url");
  const sig = createHmac("sha256", STATE_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyState(state: string): string | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", STATE_SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { testerId, ts } = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof testerId !== "string" || !testerId) return null;
    if (!Number.isFinite(ts) || Date.now() - ts > STATE_TTL_MS) return null;  // replay window
    return testerId;
  } catch { return null; }
}

/** Our own origin — the only place the popup may postMessage to. */
function appOrigin(req: { headers: Record<string, any>; protocol?: string }): string {
  const env = process.env["PUBLIC_BASE_URL"];
  if (env) return env.replace(/\/$/, "");
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  const proto = req.headers["x-forwarded-proto"] ?? req.protocol ?? "https";
  return host ? `${proto}://${host}` : "https://compass.day";
}

const CLIENT_ID     = process.env["GOOGLE_CLIENT_ID"]     ?? "";
const CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"] ?? "";
const REDIRECT_URI  = process.env["GOOGLE_CAL_REDIRECT_URI"] ?? "http://localhost:3000/api/integrations/google-cal/callback";

const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

function isConfigured(): boolean {
  return !!CLIENT_ID && !!CLIENT_SECRET;
}

async function refreshAccessToken(row: typeof googleCalTokens.$inferSelect): Promise<string | null> {
  if (!row.refreshToken) return null;
  if (row.expiresAt && row.expiresAt > new Date(Date.now() + 60000)) {
    return row.accessToken;
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: row.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as any;
  const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);
  await db.update(googleCalTokens)
    .set({ accessToken: data.access_token, expiresAt, updatedAt: new Date() })
    .where(eq(googleCalTokens.testerId, row.testerId));
  return data.access_token as string;
}

// GET /api/integrations/google-cal/status
router.get("/integrations/google-cal/status", async (req, res) => {
  if (!isConfigured()) {
    res.json({ connected: false, configured: false });
    return;
  }
  const testerId = req.headers["x-tester-id"] as string | undefined;
  if (!testerId) { res.json({ connected: false }); return; }
  const [row] = await db.select().from(googleCalTokens).where(eq(googleCalTokens.testerId, testerId)).limit(1);
  if (!row) { res.json({ connected: false }); return; }
  res.json({ connected: true, email: row.calendarEmail });
});

// GET /api/integrations/google-cal/auth  — initiate OAuth
router.get("/integrations/google-cal/auth", (req, res) => {
  if (!isConfigured()) { res.status(503).json({ error: "Google Calendar not configured" }); return; }
  const testerId = req.query.testerId as string | undefined;
  const state = testerId ? signState(testerId) : "";
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  if (state) url.searchParams.set("state", state);
  res.redirect(url.toString());
});

// GET /api/integrations/google-cal/callback
router.get("/integrations/google-cal/callback", async (req, res) => {
  const code  = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  if (!code) { res.status(400).send("Missing code"); return; }

  let testerId: string | null = null;
  if (state) {
    // Signed + time-limited: an unsigned state let anyone forge the identity
    // this callback attaches a Google account to.
    testerId = verifyState(state);
    if (!testerId) { res.status(400).send("This sign-in link has expired or is invalid. Please try connecting again."); return; }
  }

  // Exchange code for tokens
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) { res.status(500).send("Token exchange failed"); return; }
  const tokens = await tokenRes.json() as any;

  // Fetch email
  let email: string | null = null;
  try {
    const ui = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (ui.ok) { const u = await ui.json() as any; email = u.email ?? null; }
  } catch {}

  if (testerId) {
    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);
    await db.insert(googleCalTokens).values({
      testerId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt,
      calendarEmail: email,
    }).onConflictDoUpdate({
      target: googleCalTokens.testerId,
      set: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt,
        calendarEmail: email,
        updatedAt: new Date(),
      },
    });
  }

  // Close popup and signal parent. The target origin is OURS, not '*' — a
  // wildcard broadcasts the connected email to whatever page happens to have
  // opened this window.
  const origin = appOrigin(req as any);
  res.send(`<!DOCTYPE html><html><body><script>
    if (window.opener) {
      window.opener.postMessage({ type: 'google-cal-connected', email: ${JSON.stringify(email)} }, ${JSON.stringify(origin)});
      window.close();
    } else {
      window.location.href = '/';
    }
  </script><p>Connected${email ? ` as ${email}` : ""}. You can close this window.</p></body></html>`);
});

// GET /api/integrations/google-cal/events?start=ISO&end=ISO
router.get("/integrations/google-cal/events", async (req, res) => {
  const testerId = req.headers["x-tester-id"] as string | undefined;
  if (!testerId) { res.json({ events: [] }); return; }

  const [row] = await db.select().from(googleCalTokens).where(eq(googleCalTokens.testerId, testerId)).limit(1);
  if (!row) { res.json({ events: [] }); return; }

  const accessToken = await refreshAccessToken(row);
  if (!accessToken) { res.json({ events: [], error: "token_refresh_failed" }); return; }

  const start = req.query.start as string ?? new Date().toISOString();
  const end   = req.query.end   as string ?? new Date(Date.now() + 90 * 86400000).toISOString();

  const url = new URL(EVENTS_URL);
  url.searchParams.set("timeMin", start);
  url.searchParams.set("timeMax", end);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "500");

  const evRes = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!evRes.ok) { res.json({ events: [], error: "fetch_failed" }); return; }

  const data = await evRes.json() as any;
  const events = (data.items ?? []).map((item: any) => ({
    id: item.id as string,
    title: (item.summary ?? "(no title)") as string,
    start: (item.start?.dateTime ?? item.start?.date) as string,
    end:   (item.end?.dateTime   ?? item.end?.date)   as string,
    allDay: !item.start?.dateTime,
    color: item.colorId ? GCAL_COLORS[item.colorId] : null,
    htmlLink: item.htmlLink as string,
    location: item.location as string | undefined,
    description: item.description as string | undefined,
    organizer: item.organizer?.email as string | undefined,
    calendarName: row.calendarEmail,
  }));

  res.json({ events });
});

// DELETE /api/integrations/google-cal/disconnect
router.delete("/integrations/google-cal/disconnect", async (req, res) => {
  const testerId = req.headers["x-tester-id"] as string | undefined;
  if (!testerId) { res.status(400).json({ error: "testerId required" }); return; }
  await db.delete(googleCalTokens).where(eq(googleCalTokens.testerId, testerId));
  res.json({ ok: true });
});

// Google Calendar color IDs → hex
const GCAL_COLORS: Record<string, string> = {
  "1":"#a4bdfc","2":"#7ae7bf","3":"#dbadff","4":"#ff887c",
  "5":"#fbd75b","6":"#ffb878","7":"#46d6db","8":"#e1e1e1",
  "9":"#5484ed","10":"#51b749","11":"#dc2127",
};

export default router;
