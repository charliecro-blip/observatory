/**
 * Email reports — the day / week / month ahead, composed as an email.
 *
 *   GET /api/reports/preview?span=day|week|month&tz=&lat=&lon=&format=html|json
 *
 * Phase 1 (this): the CONTENT — real data composed into subject + HTML + text,
 * previewable in a browser tab so the voice can be tuned before any sending
 * infrastructure exists. Phase 2 wires a sender (e.g. Resend) + a morning cron
 * on Railway + a Settings opt-in with an email address. Push/text notifications
 * are a later phase still (owner call, 2026-07-05).
 *
 * Voice rules (see artifacts/tides/EMAIL-REPORTS.md): describe conditions,
 * never promise outcomes; weather register; short enough to read at the
 * kitchen counter; the reader's own aims lead, the sky supports.
 */
import { Router, type IRouter } from "express";
import { db, natalCharts, planningWindows, goals, emailSubscriptions } from "@workspace/db";
import { and, eq, gte, lte } from "drizzle-orm";
import { requireTesterId } from "../middlewares/testerId.js";
import { sendEmail, emailConfigured } from "../lib/email.js";
import { bustEmailSubscriptionCache } from "../lib/notifier.js";
import {
  julianDay, moonPhase, voidOfCourse, getDailyElementEmphasis, getPlanetPositions,
} from "../lib/astro.js";
import { computeNatalChart, computeTransitAspects, computeTransitForecast } from "../lib/natal.js";
import { computeElections } from "../lib/electionEngine.js";
import { dayReading } from "../lib/synthesis.js";
import { domicileLord } from "../lib/dignity.js";
import {
  SIGN_GUIDE, PHASE_GUIDE, DAY_RULER, DAY_RULER_GIFT, favoredActivities, bestFor,
  easeOff, transitMeaning, rankTransits, type DaySky,
} from "../lib/interpretation.js";

const router: IRouter = Router();

// Point in the lunar cycle, from the phase name, for activity-fit scoring.
function phaseKeyOf(name: string): DaySky["phaseKey"] {
  if (name === "New Moon") return "new";
  if (name === "Full Moon") return "full";
  return /wan|last quarter|balsamic/i.test(name) ? "waning" : "waxing";
}
// Julian day at LOCAL noon of the day `d` offsets from today — one clean
// reference so the week's moon signs match the daily card (no tz double-count).
function localNoonJd(tz: number, d: number): number {
  const dayLocal = new Date(Date.now() - tz * 60000 + d * 86400000);
  const utcMs = Date.UTC(dayLocal.getUTCFullYear(), dayLocal.getUTCMonth(), dayLocal.getUTCDate(), 12, 0, 0) + tz * 60000;
  return julianDay(new Date(utcMs));
}
async function activeStars(testerId: string) {
  return db.select().from(goals).where(and(eq(goals.testerId, testerId), eq(goals.status, "active")));
}

function localDate(tz: number, offsetDays = 0): Date {
  return new Date(Date.now() - tz * 60000 + offsetDays * 86400000);
}
function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}
function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Block { heading?: string; lines: string[] }

async function natalFor(testerId: string) {
  const stored = (await db.select().from(natalCharts).where(eq(natalCharts.testerId, testerId)).limit(1))[0] ?? null;
  if (!stored) return null;
  return {
    stored,
    computed: computeNatalChart(stored.birthDate, stored.birthTime, stored.birthLat, stored.birthLon, stored.utcOffset),
    timeKnown: stored.timeKnown !== false,
  };
}

// ── Span composers ────────────────────────────────────────────────────────────
// Exported so the notifier can compose + send the same reports on its cron.

export async function composeDay(testerId: string, tz: number, lat: number, lon: number) {
  const now = new Date();
  const jd = julianDay(now);
  const local = localDate(tz);
  const { name: phaseName, fraction } = moonPhase(jd);
  const elem = getDailyElementEmphasis(jd);
  const { voc } = voidOfCourse(jd);
  const mercuryRx = getPlanetPositions(jd).some((p) => p.planet === "Mercury" && p.retrograde);
  const moonSign = elem.moonSign;
  const dayRuler = DAY_RULER[local.getUTCDay()];
  const phaseKey = phaseKeyOf(phaseName);
  const sky: DaySky = { moonSign, dayRuler, waxing: phaseKey === "new" || phaseKey === "waxing", phaseKey, voc, mercuryRx };
  const sg = SIGN_GUIDE[moonSign];
  const weekday = local.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

  const blocks: Block[] = [];

  // The woven reading (synthesis engine) — day scope, so the rotating hour
  // doesn't carry an all-day email. Natal fetched early for the asc-ruler.
  const natal = await natalFor(testerId);
  const ascRuler = natal?.timeKnown ? domicileLord(natal.computed.ascendant.longitude) : undefined;
  const reading = dayReading(now, lat, lon, { tzOffsetMin: tz, ascRuler, scope: "day" });

  // 1) The day in plain language — the woven flavour leads; then the parts.
  const lead = [cap(reading.flavour)];
  lead.push(`A ${moonSign} Moon on ${weekday} — ${sg?.feel ?? `an ${elem.element} day`}. It's a ${dayRuler} day — the hours favor ${DAY_RULER_GIFT[dayRuler]}.`);
  const pg = PHASE_GUIDE[phaseName];
  if (pg) lead.push(`Moon ${phaseName.toLowerCase()} (${Math.round(fraction * 100)}% lit) — ${pg.thrust}: ${pg.do}.`);
  if (reading.counterpoint) lead.push(cap(reading.counterpoint.replace(/^—\s*/, "")));
  blocks.push({ lines: lead });

  // 1b) Named shapes in the sky — plain-language readings, no jargon.
  if (reading.patterns.length) {
    blocks.push({ heading: "In the sky's shape", lines: reading.patterns.slice(0, 3).map((p) => p.reading) });
  }

  // 2) Lean into / ease off — concrete activities from the correspondence table.
  const fav = favoredActivities(sky, 3);
  if (fav.length) blocks.push({ heading: "Lean into", lines: fav.map((f) => `${f.label} — ${f.gloss}`) });
  const ease = easeOff(sky);
  if (ease.length) blocks.push({ heading: "Ease off", lines: ease });

  // 3) Key moments — scheduled windows + the best clock window for today's top activity.
  const moments: string[] = [];
  const dayStart = new Date(local.toISOString().slice(0, 10) + "T00:00:00Z");
  const wins = await db.select().from(planningWindows).where(and(
    eq(planningWindows.testerId, testerId),
    gte(planningWindows.startTime, new Date(dayStart.getTime() + tz * 60000)),
    lte(planningWindows.startTime, new Date(dayStart.getTime() + tz * 60000 + 86400000)),
  )).orderBy(planningWindows.startTime);
  for (const w of wins.slice(0, 3)) {
    const t = new Date(new Date(w.startTime).getTime() - tz * 60000);
    moments.push(`${t.toISOString().slice(11, 16)} — ${w.title} (on your calendar).`);
  }
  if (fav[0]) {
    const el = computeElections({ activityKey: fav[0].key, span: "day", lat, lon, tzOffsetMin: tz, natal: natal?.computed ?? null, startAt: now });
    const w = el?.windows?.find((x) => !x.allDay);
    if (w) moments.push(`Best window — ${w.startClock}–${w.endClock} for ${fav[0].label.toLowerCase()} (${w.why.split(" · ")[0]}).`);
  }
  if (voc) moments.push("The Moon goes void of course today — slack water. Finish and tidy; save what you want to last for tomorrow.");
  if (moments.length) blocks.push({ heading: "Key moments today", lines: moments });

  // 4) Toward your stars — match an active star's element to the day's current.
  const stars = await activeStars(testerId);
  if (stars.length) {
    const dayEl = sg?.element;
    const match = stars.find((s) => s.element === dayEl);
    if (match) {
      blocks.push({ heading: "Toward your stars", lines: [
        `Today's ${dayEl} current suits “${match.title}.”${fav[0] ? ` A window for ${fav[0].label.toLowerCase()} moves it forward — one step counts double.` : " One step toward it counts double today."}`,
      ] });
    } else {
      blocks.push({ heading: "Toward your stars", lines: [
        `“${stars[0].title}” runs on ${stars[0].element ?? "its own"} energy; today leans ${dayEl}. A lighter supporting step fits better than a hard push.`,
      ] });
    }
  }

  // 5) The long weather — a FOOTNOTE: the single loudest transit, interpreted.
  if (natal) {
    const ts = rankTransits(
      computeTransitAspects(natal.computed)
        .filter((t) => (t.severity === "strong" || t.severity === "major") && (natal.timeKnown || t.natalPlanet !== "Ascendant"))
    );
    if (ts[0]) blocks.push({ heading: "The long weather", lines: [
      `${transitMeaning(ts[0].transitPlanet, ts[0].aspect, ts[0].natalPlanet)} A slow background — not today's task.`,
    ] });
  }

  const subject = `${moonSign} Moon — ${(sg?.favors ?? []).slice(0, 2).join(", ") || `an ${elem.element} day`}`;
  return { title: fmtDay(local), subject, blocks };
}

export async function composeWeek(testerId: string, tz: number, _lat: number, _lon: number) {
  const blocks: Block[] = [];
  const dname = (d: number) => fmtShort(localDate(tz, d)).replace(/,.*$/, "");

  // Per-day: concrete guidance from the sign, not just element/quality.
  const perDay: { d: number; voc: boolean; sky: DaySky }[] = [];
  const dayLines: string[] = [];
  for (let d = 0; d < 7; d++) {
    const jd = localNoonJd(tz, d);
    const local = localDate(tz, d);
    const moonSign = getDailyElementEmphasis(jd).moonSign;
    const phaseKey = phaseKeyOf(moonPhase(jd).name);
    const dayRuler = DAY_RULER[local.getUTCDay()];
    const vocDay = voidOfCourse(jd).voc;
    const rxDay = getPlanetPositions(jd).some((p) => p.planet === "Mercury" && p.retrograde);
    const sky: DaySky = { moonSign, dayRuler, waxing: phaseKey === "new" || phaseKey === "waxing", phaseKey, voc: vocDay, mercuryRx: rxDay };
    const sg = SIGN_GUIDE[moonSign];
    // Day-specific, not just the (multi-day) Moon sign: the planetary day and
    // per-day activity fit differ even when the Moon holds the same sign.
    const fav = favoredActivities(sky, 2);
    const favText = fav.length ? fav.map((f) => f.label.toLowerCase()).join(", ") : (sg?.favors ?? []).slice(0, 2).join(", ");
    dayLines.push(`${fmtShort(local)} — ${moonSign} Moon, ${dayRuler} day: ${favText}.${vocDay ? " Void spell — keep it light." : ""}`);
    perDay.push({ d, voc: vocDay, sky });
  }
  blocks.push({ heading: "Day by day", lines: dayLines });

  // Standout days — best for focus / people / rest, by concrete activity fit.
  const pick = (cats: string[]) => {
    let best: { d: number; label: string; score: number } | null = null;
    for (const p of perDay) { const b = bestFor(p.sky, cats); if (b && (!best || b.score > best.score)) best = { d: p.d, label: b.label, score: b.score }; }
    return best;
  };
  const focus = pick(["craft", "mind"]);
  const people = pick(["love", "social"]);
  const restDay = perDay.find((p) => p.voc) ?? perDay[0];
  const stand: string[] = [];
  if (focus) stand.push(`Deep focus — ${dname(focus.d)}: best for ${focus.label.toLowerCase()}.`);
  if (people) stand.push(`People & connection — ${dname(people.d)}: best for ${people.label.toLowerCase()}.`);
  if (restDay) stand.push(`Keep light / rest — ${dname(restDay.d)}${restDay.voc ? " (Moon void)" : ""}.`);
  if (stand.length) blocks.push({ heading: "The standout days", lines: stand });

  // Scheduled windows this week
  const wins = await db.select().from(planningWindows).where(and(
    eq(planningWindows.testerId, testerId),
    gte(planningWindows.startTime, new Date()),
    lte(planningWindows.startTime, new Date(Date.now() + 7 * 86400000)),
  )).orderBy(planningWindows.startTime);
  if (wins.length) {
    blocks.push({
      heading: "Already on your calendar",
      lines: wins.slice(0, 8).map((w) => {
        const t = new Date(new Date(w.startTime).getTime() - tz * 60000);
        return `${fmtShort(t)} ${t.toISOString().slice(11, 16)} — ${w.title}`;
      }),
    });
  }

  // The long weather this week — footnote: top 2 transits, dated + interpreted.
  const natal = await natalFor(testerId);
  if (natal) {
    let fc = computeTransitForecast(natal.computed, 7);
    if (!natal.timeKnown) fc = fc.filter((t) => t.natalPlanet !== "Ascendant");
    const lines = rankTransits(fc).slice(0, 2).map((t) => {
      const when = t.dayOffset === 0 ? "now" : dname(t.dayOffset);
      return `${when} — ${transitMeaning(t.transitPlanet, t.aspect, t.natalPlanet)}`;
    });
    if (lines.length) blocks.push({ heading: "The long weather this week", lines });
  }

  blocks.push({ lines: ["Plan the deep work into the strong days; keep the void spells light."] });
  const subject = focus && people
    ? `Your week — focus ${dname(focus.d)}, people ${dname(people.d)}`
    : "Your week ahead — the shape of the next seven days";
  return { title: `Week of ${fmtDay(localDate(tz))}`, subject, blocks };
}

async function composeMonth(testerId: string, tz: number, _lat: number, _lon: number) {
  const blocks: Block[] = [];

  // Lunation anchors — named by sign, with what the cycle turn is for.
  const lunations: string[] = [];
  let lastName = moonPhase(julianDay(new Date())).name;
  for (let d = 1; d <= 30; d++) {
    const jd = localNoonJd(tz, d);
    const { name } = moonPhase(jd);
    if (name !== lastName && (name === "New Moon" || name === "Full Moon")) {
      const sign = getDailyElementEmphasis(jd).moonSign;
      const sg = SIGN_GUIDE[sign];
      lunations.push(name === "New Moon"
        ? `${fmtShort(localDate(tz, d))} — New Moon in ${sign}: begin quietly. A cycle for ${sg?.favors[0] ?? "planting"}.`
        : `${fmtShort(localDate(tz, d))} — Full Moon in ${sign}: culminate and release what's ripe.`);
    }
    lastName = name;
  }
  if (lunations.length) blocks.push({ heading: "The month's anchor points", lines: lunations });

  // Transits, week by week — the top 1–2 that matter, interpreted (not listed).
  const natal = await natalFor(testerId);
  if (natal) {
    let fc = computeTransitForecast(natal.computed, 30);
    if (!natal.timeKnown) fc = fc.filter((t) => t.natalPlanet !== "Ascendant");
    const weeks: typeof fc[] = [[], [], [], []];
    for (const t of fc) weeks[Math.min(3, Math.floor(t.dayOffset / 7))].push(t);
    weeks.forEach((w, i) => {
      const top = rankTransits(w).slice(0, 2).map((t) =>
        `${fmtShort(new Date(Date.parse(t.peakDate) - tz * 60000)).replace(/,.*$/, "")} — ${transitMeaning(t.transitPlanet, t.aspect, t.natalPlanet)}`);
      if (top.length) blocks.push({ heading: i === 0 ? "This week" : `Week of ${fmtShort(localDate(tz, i * 7)).replace(/,.*$/, "")}`, lines: top });
    });
  } else {
    blocks.push({ lines: ["Add your birth chart in Settings and this report gains the personal layer — the transits landing on your chart, dated and read."] });
  }

  blocks.push({ lines: ["A month is a tide too — the lunations are its high and low water. Aim the big beginnings just after the New Moon."] });
  const subject = "Your month ahead — the lunations and what lands on your chart";
  return { title: `The month from ${fmtDay(localDate(tz))}`, subject, blocks };
}

export async function composeNewMoon(testerId: string, tz: number, _lat: number, _lon: number) {
  const blocks: Block[] = [];

  // The next New Moon (or today's, if we're on it). Scan by phase name.
  let nmDay = 0;
  for (let d = 0; d <= 32; d++) {
    if (moonPhase(localNoonJd(tz, d)).name === "New Moon") { nmDay = d; break; }
  }
  const nmDate = localDate(tz, nmDay);
  const sign = getDailyElementEmphasis(localNoonJd(tz, nmDay)).moonSign;
  const sg = SIGN_GUIDE[sign];

  // 1) The reset — plain, grounded, not a wall of questions.
  blocks.push({ lines: [
    `The Moon goes new in ${sign} ${nmDay === 0 ? "today" : `on ${fmtDay(nmDate)}`} — the start of a fresh ~29-day cycle.`,
    `New Moons are for planting, not harvesting. ${sg ? `${cap(sg.feel)}.` : ""} Name one intention and begin it small.`,
  ] });

  // 2) What this cycle is genuinely for — concrete, from the sign.
  if (sg) blocks.push({ heading: `A ${sign} cycle favors`, lines: sg.favors.slice(0, 4).map((f) => cap(f)) });

  // 3) The cycle's shape — the dates that mark its arc.
  const shape: string[] = [`${fmtShort(localDate(tz, nmDay + 7))} — First Quarter: act through the first resistance.`];
  for (let d = nmDay + 11; d <= nmDay + 18; d++) {
    if (moonPhase(localNoonJd(tz, d)).name === "Full Moon") {
      const fSign = getDailyElementEmphasis(localNoonJd(tz, d)).moonSign;
      shape.push(`${fmtShort(localDate(tz, d))} — Full Moon in ${fSign}: what you planted comes to light.`);
      break;
    }
  }
  shape.push(`${fmtShort(localDate(tz, nmDay + 22))} — Last Quarter: let go of what didn't take.`);
  blocks.push({ heading: "The cycle's shape", lines: shape });

  // 4) Toward your stars — seed one now; it rides the whole cycle.
  const stars = await activeStars(testerId);
  if (stars.length) {
    const match = stars.find((s) => s.element === sg?.element) ?? stars[0];
    blocks.push({ heading: "Toward your stars", lines: [
      `Seed an intention toward “${match.title}” now — a ${sign} cycle ${sg ? `favors ${sg.favors[0]}` : "suits it"}, and what you set at the dark Moon rides the whole month's tide.`,
    ] });
  }

  // 5) Landing on your chart — a single transit near the cycle's start.
  const natal = await natalFor(testerId);
  if (natal) {
    const ts = rankTransits(
      computeTransitForecast(natal.computed, Math.max(1, nmDay + 4))
        .filter((t) => Math.abs(t.dayOffset - nmDay) <= 3 && (natal.timeKnown || t.natalPlanet !== "Ascendant"))
    );
    if (ts[0]) blocks.push({ heading: "As the cycle opens", lines: [
      `${transitMeaning(ts[0].transitPlanet, ts[0].aspect, ts[0].natalPlanet)} Begin with that in mind.`,
    ] });
  }

  blocks.push({ lines: ["→ Set your intention in Compass — it will carry it to the Full Moon and check in."] });
  const subject = `New Moon in ${sign} — a fresh cycle begins`;
  return { title: `New Moon · ${fmtDay(nmDate)}`, subject, blocks };
}

// ── Rendering ─────────────────────────────────────────────────────────────────

export function renderHtml(title: string, subject: string, blocks: Block[]): string {
  const blockHtml = blocks.map((b) => `
    ${b.heading ? `<div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#a89a88;margin:22px 0 8px;">${b.heading}</div>` : `<div style="height:14px"></div>`}
    ${b.lines.map((l) => `<div style="font-size:14px;line-height:1.7;color:#2b2820;margin-bottom:4px;">${l}</div>`).join("")}
  `).join("");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#efe9dc;">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px;font-family:Georgia,'Times New Roman',serif;">
    <div style="background:#f7f2e6;border:1px solid #ddd2ba;border-radius:14px;padding:26px 28px;">
      <div style="font-size:20px;color:#1b1a17;letter-spacing:0.3px;margin-bottom:2px;">Compass</div>
      <div style="font-size:12px;color:#8a8278;margin-bottom:18px;">${title}</div>
      <div style="font-size:16px;color:#1b1a17;font-style:italic;border-left:3px solid #c8b06a;padding-left:12px;margin-bottom:6px;">${subject.replace(/^[^—]*— /, "")}</div>
      ${blockHtml}
      <div style="border-top:1px solid #e3d9c2;margin-top:24px;padding-top:12px;font-size:11px;color:#a89a88;line-height:1.6;">
        Conditions, not fate — the sky describes the weather; you steer.<br/>
        Open Compass · adjust what lands in this report in Settings.
      </div>
    </div>
  </div></body></html>`;
}

function renderText(title: string, blocks: Block[]): string {
  return [`COMPASS — ${title}`, "", ...blocks.flatMap((b) => [
    ...(b.heading ? [b.heading.toUpperCase()] : [""]),
    ...b.lines.map((l) => `  ${l.replace(/<[^>]+>/g, "")}`),
  ])].join("\n");
}

router.get("/reports/preview", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const span = ["day", "week", "month", "newmoon"].includes(String(req.query.span)) ? String(req.query.span) : "day";
  const tz = Number.isFinite(parseInt(String(req.query.tz), 10)) ? parseInt(String(req.query.tz), 10) : 0;
  const lat = parseFloat(String(req.query.lat ?? "40.7"));
  const lon = parseFloat(String(req.query.lon ?? "-74.0"));

  const composed = span === "week" ? await composeWeek(testerId, tz, lat, lon)
    : span === "month" ? await composeMonth(testerId, tz, lat, lon)
    : span === "newmoon" ? await composeNewMoon(testerId, tz, lat, lon)
    : await composeDay(testerId, tz, lat, lon);

  if (req.query.format === "json") {
    res.json({ span, subject: composed.subject, title: composed.title, blocks: composed.blocks, text: renderText(composed.title, composed.blocks) });
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(renderHtml(composed.title, composed.subject, composed.blocks));
});

// ── Email subscription (the Settings opt-in) ─────────────────────────────────

router.get("/reports/email-subscription", requireTesterId, async (_req, res) => {
  const testerId = res.locals.testerId as string;
  const row = (await db.select().from(emailSubscriptions).where(eq(emailSubscriptions.testerId, testerId)).limit(1))[0] ?? null;
  res.json({ subscription: row, senderConfigured: emailConfigured() });
});

router.post("/reports/email-subscription", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const { email, spans, sendHour, enabled, lat, lon } = req.body ?? {};
  if (!email || typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    res.status(400).json({ error: "a valid email is required" });
    return;
  }
  const clean = {
    email: email.trim(),
    spans: Array.isArray(spans) && spans.length ? spans.filter((s: string) => ["day", "week", "newmoon"].includes(s)) : ["day"],
    sendHour: Number.isInteger(sendHour) && sendHour >= 4 && sendHour <= 12 ? sendHour : 7,
    enabled: enabled === false ? "false" : "true",
    lat: lat != null ? String(lat) : null,
    lon: lon != null ? String(lon) : null,
    updatedAt: new Date(),
  };
  const existing = (await db.select().from(emailSubscriptions).where(eq(emailSubscriptions.testerId, testerId)).limit(1))[0];
  if (existing) await db.update(emailSubscriptions).set(clean).where(eq(emailSubscriptions.testerId, testerId));
  else await db.insert(emailSubscriptions).values({ testerId, ...clean });
  bustEmailSubscriptionCache(); // the notifier's hourly cache shouldn't delay a new opt-in
  res.json({ ok: true });
});

// Send the day report NOW to the stored address — the "send me a test" button.
router.post("/reports/email-test", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const sub = (await db.select().from(emailSubscriptions).where(eq(emailSubscriptions.testerId, testerId)).limit(1))[0];
  if (!sub) { res.status(404).json({ error: "no subscription saved yet" }); return; }
  const tz = Number.isFinite(parseInt(String(req.query.tz), 10)) ? parseInt(String(req.query.tz), 10) : 0;
  const lat = parseFloat(sub.lat ?? "40.7"), lon = parseFloat(sub.lon ?? "-74.0");
  const d = await composeDay(testerId, tz, lat, lon);
  const sent = await sendEmail(sub.email, d.subject, renderHtml(d.title, d.subject, d.blocks));
  res.json({ sent, senderConfigured: emailConfigured() });
});

export default router;
