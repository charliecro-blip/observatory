import { db } from "@workspace/db";
import { pushSubscriptions, emailSubscriptions } from "@workspace/db/schema";
import { julianDay, getPlanetaryHour, voidOfCourse, moonPhase, getDailyElementEmphasis } from "../lib/astro.js";
import { sendPushToTester } from "../routes/push";
import { sendEmail, emailConfigured } from "./email.js";
import { composeDay, composeWeek, composeNewMoon, renderHtml, logEmailEvent } from "../routes/reports.js";
import { logger } from "./logger";

// ── Subscription cache ───────────────────────────────────────────────────────
// The 60s tick used to SELECT push_subscriptions on every beat, which kept the
// Neon endpoint awake 24/7 — ~180 CU-hours/month against a 100 CU-hour free
// allowance (the 2026-07 "compute at risk of suspension" email). The tick still
// runs every 60s (minute-precision ritual pings need it), but it reads this
// in-memory cache; the database is touched at most once an hour, or when a
// subscription actually changes (routes/push busts the cache), so Neon can
// scale to zero in between.
let subsCache: Awaited<ReturnType<typeof fetchSubs>> | null = null;
let subsCacheAt = 0;
const SUBS_TTL_MS = 60 * 60 * 1000;

function fetchSubs() {
  return db.select().from(pushSubscriptions);
}

export function bustSubscriptionCache() {
  subsCache = null;
  subsCacheAt = 0;
}

async function getSubs() {
  if (subsCache && Date.now() - subsCacheAt < SUBS_TTL_MS) return subsCache;
  try {
    subsCache = await fetchSubs();
    subsCacheAt = Date.now();
    return subsCache;
  } catch {
    // DB hiccup (or suspended endpoint): serve stale rather than dropping
    // pings; retry on the next tick.
    return subsCache ?? [];
  }
}

// Track what we've already notified this session to avoid duplicates
const notified = new Set<string>();

function dedup(key: string): boolean {
  if (notified.has(key)) return false;
  notified.add(key);
  // Expire keys after 26 hours (covers daily ritual keys across restarts-free days)
  setTimeout(() => notified.delete(key), 26 * 60 * 60 * 1000);
  return true;
}

// Subscriber-local clock, derived from stored longitude (15° ≈ 1 hour).
// ±1h around DST — fine for a "morning" ping, honest about its precision.
// Wall-clock parts in a real IANA zone. Longitude stays as the fallback for
// subscriptions saved before we captured the zone, but it is only ever an
// approximation — it cannot know DST, half-hour zones, or where a border runs.
function partsInZone(now: Date, timeZone: string): { hour: number; minute: number; date: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).formatToParts(now).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return { hour: parseInt(p.hour!, 10) % 24, minute: parseInt(p.minute!, 10), date: `${p.year}-${p.month}-${p.day}` };
}

/** getTimezoneOffset convention: minutes to ADD to local to reach UTC. */
function offsetMinInZone(now: Date, timeZone: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(now).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour! % 24, +p.minute!, +p.second!);
  return -Math.round((asUtc - now.getTime()) / 60000);
}

function validZone(z: string | null | undefined): string | null {
  if (!z) return null;
  try { new Intl.DateTimeFormat("en-US", { timeZone: z }); return z; } catch { return null; }
}

function localParts(now: Date, lonRaw: string | null, timeZone?: string | null): { hour: number; minute: number; date: string } {
  const zone = validZone(timeZone);
  if (zone) return partsInZone(now, zone);
  const lon = lonRaw != null ? parseFloat(lonRaw) : -74.0;
  const offsetH = Math.round((Number.isFinite(lon) ? lon : -74.0) / 15);
  const local = new Date(now.getTime() + offsetH * 3600000);
  return { hour: local.getUTCHours(), minute: local.getUTCMinutes(), date: local.toISOString().slice(0, 10) };
}

const CHARACTER: Record<string, { word: string; grain: string }> = {
  water: { word: "Deep", grain: "feel, create, tend" },
  fire: { word: "Surge", grain: "act, lead, move" },
  earth: { word: "Building", grain: "build, finish, organize" },
  air: { word: "Clear", grain: "think, write, connect" },
  spirit: { word: "Between-tides", grain: "rest, review, release" },
};

// Ritual hours (subscriber-local). Morning starts the day's loop; evening
// closes it — these two ARE the app's retention heartbeat.
const MORNING_HOUR = 8;
const EVENING_HOUR = 20;

async function tick() {
  const vapidPublic = process.env["VAPID_PUBLIC_KEY"];
  if (!vapidPublic) return; // Push not configured

  const subs = await getSubs();
  if (subs.length === 0) return;

  const now = new Date();
  const jd = julianDay(now);

  // --- Morning "Cast off" + evening "Log the day" (per subscriber-local time) ---
  try {
    const elem = getDailyElementEmphasis(jd);
    const ch = CHARACTER[elem.element] ?? CHARACTER.water;
    const phase = moonPhase(jd);
    for (const sub of subs) {
      const t = localParts(now, sub.lon, (sub as any).timeZone);
      // 60s tick + 2-minute window + daily dedupe = fires exactly once
      if (t.hour === MORNING_HOUR && t.minute < 2 && dedup(`morning-${sub.testerId}-${t.date}`)) {
        await sendPushToTester(sub.testerId, {
          title: `⛵ Cast off — a ${ch.word} day`,
          body: `${ch.grain} · ${phase.name.toLowerCase()}. Your streaks and today's three are ready.`,
          tag: "morning-brief",
        });
      }
      if (t.hour === EVENING_HOUR && t.minute < 2 && dedup(`evening-${sub.testerId}-${t.date}`)) {
        await sendPushToTester(sub.testerId, {
          title: "🌙 Log the day",
          body: "How did it feel — aligned, mixed, off? Thirty seconds keeps the record.",
          tag: "evening-review",
        });
      }
    }
  } catch (e) {
    logger.warn({ e }, "notifier: ritual pings failed");
  }

  // --- Planetary hour shift ---
  // ~24 shifts/day would be notification fatigue that drowns the ritual pings,
  // so this stays behind an env opt-in until per-user prefs sync server-side.
  if (process.env["PUSH_HOUR_SHIFTS"] === "1") {
    try {
      const firstSub = subs[0];
      const lat = firstSub?.lat ? parseFloat(firstSub.lat) : 40.7;
      const lon = firstSub?.lon ? parseFloat(firstSub.lon) : -74.0;
      const ph = getPlanetaryHour(now, lat, lon);
      const secFromStart = (now.getTime() - ph.startTime.getTime()) / 1000;
      if (secFromStart < 90) {
        const key = `hour-${ph.startTime.toISOString().slice(0, 16)}`;
        if (dedup(key)) {
          const ICONS: Record<string, string> = {
            Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀",
            Mars: "♂", Jupiter: "♃", Saturn: "♄",
          };
          const payload = {
            title: `${ICONS[ph.ruler] ?? "○"} ${ph.ruler} hour`,
            body: `Planetary hour shifted to ${ph.ruler}. ${ph.isDayHour ? "Day" : "Night"} hour #${ph.hourNumber}.`,
            tag: "hour-shift",
          };
          for (const sub of subs) {
            // Quiet hours: no hour-shift pings in the subscriber's night
            const t = localParts(now, sub.lon, (sub as any).timeZone);
            if (t.hour >= 22 || t.hour < 8) continue;
            await sendPushToTester(sub.testerId, payload);
          }
        }
      }
    } catch (e) {
      logger.warn({ e }, "notifier: hour shift check failed");
    }
  }

  // --- VOC start (max once per day — was once per HOUR of a long void) ---
  try {
    const { voc } = voidOfCourse(jd);
    if (voc) {
      const key = `voc-${now.toISOString().slice(0, 10)}`;
      if (dedup(key)) {
        const payload = {
          title: "☽ Moon is void of course",
          body: "Between statements — good for rest, review, and finishing. Hold new launches until it clears.",
          tag: "voc",
        };
        for (const sub of subs) {
          const t = localParts(now, sub.lon, (sub as any).timeZone);
          if (t.hour >= 22 || t.hour < 8) continue; // don't wake anyone for a void
          await sendPushToTester(sub.testerId, payload);
        }
      }
    }
  } catch (e) {
    logger.warn({ e }, "notifier: VOC check failed");
  }

  // --- Moon phase (new/full) ---
  try {
    const phase = moonPhase(jd);
    // moonPhase() returns display names ("New Moon"), not snake_case — the old
    // check compared against "new_moon" and never fired.
    const isSignificant = phase.name === "New Moon" || phase.name === "Full Moon";
    if (isSignificant) {
      const key = `phase-${now.toISOString().slice(0, 10)}-${phase.name}`;
      if (dedup(key)) {
        const isNew = phase.name === "New Moon";
        const payload = {
          title: `${isNew ? "🌑" : "🌕"} ${phase.name}`,
          body: isNew ? "The cycle resets today — a seed-planting day. Set the month's intention." : "Peak light — visibility, completion, release. Watch the emotional spring tide.",
          tag: "moon-phase",
        };
        for (const sub of subs) {
          const t = localParts(now, sub.lon, (sub as any).timeZone);
          if (t.hour >= 22 || t.hour < 8) continue;
          await sendPushToTester(sub.testerId, payload);
        }
      }
    }
  } catch (e) {
    logger.warn({ e }, "notifier: moon phase check failed");
  }
}

// ── Email reports cron ───────────────────────────────────────────────────────
// Same shape as push: 60s tick, subscriber-local clock from longitude,
// 2-minute window + daily dedupe, hourly DB cache. Sends the composed reports
// (routes/reports.ts) at each subscriber's chosen morning hour:
//   day — every morning · week — Sunday mornings · newmoon — New Moon mornings.
let emailSubsCache: Awaited<ReturnType<typeof fetchEmailSubs>> | null = null;
let emailSubsCacheAt = 0;
function fetchEmailSubs() { return db.select().from(emailSubscriptions); }
export function bustEmailSubscriptionCache() { emailSubsCache = null; emailSubsCacheAt = 0; }
async function getEmailSubs() {
  if (emailSubsCache && Date.now() - emailSubsCacheAt < SUBS_TTL_MS) return emailSubsCache;
  try { emailSubsCache = await fetchEmailSubs(); emailSubsCacheAt = Date.now(); return emailSubsCache; }
  catch { return emailSubsCache ?? []; }
}
// getTimezoneOffset-style minutes from a stored longitude (matches localParts).
function tzFromLon(lonRaw: string | null, timeZone?: string | null, now: Date = new Date()): number {
  const zone = validZone(timeZone);
  if (zone) return offsetMinInZone(now, zone);
  const lon = lonRaw != null ? parseFloat(lonRaw) : -74.0;
  return -Math.round((Number.isFinite(lon) ? lon : -74.0) / 15) * 60;
}

async function emailTick() {
  if (!emailConfigured()) return; // no RESEND_API_KEY — nothing to do, no DB touch
  const now = new Date();
  const subs = await getEmailSubs();
  for (const sub of subs) {
    if (sub.enabled !== "true") continue;
    const t = localParts(now, sub.lon, (sub as any).timeZone);
    if (t.hour !== (sub.sendHour ?? 7) || t.minute >= 2) continue;
    const tz = tzFromLon(sub.lon, (sub as any).timeZone, now);
    const lat = parseFloat(sub.lat ?? "40.7"), lonN = parseFloat(sub.lon ?? "-74.0");
    const spans = (sub.spans as string[] | null) ?? ["day"];
    const localDow = new Date(now.getTime() - tz * 60000).getUTCDay();
    try {
      if (spans.includes("day") && dedup(`email-day-${sub.testerId}-${t.date}`)) {
        const d = await composeDay(sub.testerId, tz, lat, lonN, (sub.detail as any) ?? "medium");
        const okD = await sendEmail(sub.email, d.subject, renderHtml(d.title, d.subject, d.blocks, { testerId: sub.testerId, span: "day" }));
        void logEmailEvent(sub.testerId, "email_sent", { span: "day", ok: okD, subject: d.subject });
      }
      if (spans.includes("week") && localDow === 0 && dedup(`email-week-${sub.testerId}-${t.date}`)) {
        const w = await composeWeek(sub.testerId, tz, lat, lonN);
        const okW = await sendEmail(sub.email, w.subject, renderHtml(w.title, w.subject, w.blocks, { testerId: sub.testerId, span: "week" }));
        void logEmailEvent(sub.testerId, "email_sent", { span: "week", ok: okW, subject: w.subject });
      }
      if (spans.includes("newmoon") && moonPhase(julianDay(now)).name === "New Moon" && dedup(`email-nm-${sub.testerId}-${t.date}`)) {
        const n = await composeNewMoon(sub.testerId, tz, lat, lonN);
        const okN = await sendEmail(sub.email, n.subject, renderHtml(n.title, n.subject, n.blocks, { testerId: sub.testerId, span: "newmoon" }));
        void logEmailEvent(sub.testerId, "email_sent", { span: "newmoon", ok: okN, subject: n.subject });
      }
    } catch (e) {
      logger.warn({ e, testerId: sub.testerId }, "notifier: email report failed");
    }
  }
}

export function startNotifier() {
  // Email cron runs regardless of push config (no-ops without RESEND_API_KEY).
  setInterval(() => { emailTick().catch(e => logger.warn({ e }, "notifier email tick error")); }, 60_000);

  if (!process.env["VAPID_PUBLIC_KEY"]) {
    logger.info("Notifier: VAPID keys not set, push disabled — email cron active");
    return;
  }
  // Run every 60 seconds
  setInterval(() => { tick().catch(e => logger.warn({ e }, "notifier tick error")); }, 60_000);
  logger.info("Notifier: started (60s tick, hourly DB cache) — ritual pings 8am/8pm local, VOC + phases in waking hours, email reports at subscriber hour");
}
