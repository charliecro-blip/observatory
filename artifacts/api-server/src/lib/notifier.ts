import { db } from "@workspace/db";
import { pushSubscriptions } from "@workspace/db/schema";
import { julianDay, getPlanetaryHour, voidOfCourse, moonPhase, getDailyElementEmphasis } from "../lib/astro.js";
import { sendPushToTester } from "../routes/push";
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
function localParts(now: Date, lonRaw: string | null): { hour: number; minute: number; date: string } {
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
      const t = localParts(now, sub.lon);
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
            const t = localParts(now, sub.lon);
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
          const t = localParts(now, sub.lon);
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
          const t = localParts(now, sub.lon);
          if (t.hour >= 22 || t.hour < 8) continue;
          await sendPushToTester(sub.testerId, payload);
        }
      }
    }
  } catch (e) {
    logger.warn({ e }, "notifier: moon phase check failed");
  }
}

export function startNotifier() {
  if (!process.env["VAPID_PUBLIC_KEY"]) {
    logger.info("Notifier: VAPID keys not set, push notifications disabled");
    return;
  }
  // Run every 60 seconds
  setInterval(() => { tick().catch(e => logger.warn({ e }, "notifier tick error")); }, 60_000);
  logger.info("Notifier: started (60s tick, hourly DB cache) — ritual pings 8am/8pm local, VOC + phases in waking hours");
}
