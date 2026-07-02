import { db } from "@workspace/db";
import { pushSubscriptions } from "@workspace/db/schema";
import { julianDay, getPlanetaryHour, voidOfCourse, moonPhase } from "../lib/astro.js";
import { sendPushToTester } from "../routes/push";
import { logger } from "./logger";

// Track what we've already notified this session to avoid duplicates
const notified = new Set<string>();

function dedup(key: string): boolean {
  if (notified.has(key)) return false;
  notified.add(key);
  // Expire keys after 2 hours
  setTimeout(() => notified.delete(key), 2 * 60 * 60 * 1000);
  return true;
}

async function tick() {
  const vapidPublic = process.env["VAPID_PUBLIC_KEY"];
  if (!vapidPublic) return; // Push not configured

  const subs = await db.select().from(pushSubscriptions).catch(() => []);
  if (subs.length === 0) return;

  const now = new Date();
  const jd = julianDay(now);

  // --- Planetary hour shift (per subscriber lat/lon) ---
  try {
    // Use first subscriber's location (or NYC fallback) for the hour calculation;
    // hour shifts are time-of-day based so nearby users share the same tick
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
        const icon = ICONS[ph.ruler] ?? "○";
        const payload = {
          title: `${icon} ${ph.ruler} hour`,
          body: `Planetary hour shifted to ${ph.ruler}. ${ph.isDayHour ? "Day" : "Night"} hour #${ph.hourNumber}.`,
          tag: "hour-shift",
        };
        for (const sub of subs) {
          await sendPushToTester(sub.testerId, payload);
        }
      }
    }
  } catch (e) {
    logger.warn({ e }, "notifier: hour shift check failed");
  }

  // --- VOC start ---
  try {
    const { voc } = voidOfCourse(jd);
    if (voc) {
      const key = `voc-${now.toISOString().slice(0, 13)}`;
      if (dedup(key)) {
        const payload = {
          title: "☽ Moon is Void of Course",
          body: "Hold off on starting new ventures. Good for rest and completion.",
          tag: "voc",
        };
        for (const sub of subs) {
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
    const isSignificant = phase.name === "new_moon" || phase.name === "full_moon";
    if (isSignificant) {
      const key = `phase-${now.toISOString().slice(0, 10)}-${phase.name}`;
      if (dedup(key)) {
        const emoji = phase.name === "new_moon" ? "🌑" : "🌕";
        const payload = {
          title: `${emoji} ${phase.name === "new_moon" ? "New Moon" : "Full Moon"}`,
          body: `The moon is ${phase.name === "new_moon" ? "new" : "full"} today. ${phase.name === "new_moon" ? "Set intentions." : "Celebrate and release."}`,
          tag: "moon-phase",
        };
        for (const sub of subs) {
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
  logger.info("Notifier: started (60s interval)");
}
