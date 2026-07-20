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
import { db, natalCharts, planningWindows, goals } from "@workspace/db";
import { and, eq, gte, lte } from "drizzle-orm";
import { requireTesterId } from "../middlewares/testerId.js";
import {
  julianDay, moonPhase, voidOfCourse, getDailyElementEmphasis,
  getPlanetaryHour, getMajorAspects, getPlanetPositions,
} from "../lib/astro.js";
import { computeNatalChart, computeTransitAspects, computeTransitForecast } from "../lib/natal.js";

const router: IRouter = Router();

const DAY_RULERS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
const GLYPH: Record<string, string> = { Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂", Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇" };
const ASPECT_SYM: Record<string, string> = { conjunction: "☌", opposition: "☍", square: "□", trine: "△", sextile: "⚹" };
const ELEMENT_WORD: Record<string, string> = {
  fire: "a fire day — bold, initiating energy",
  earth: "an earth day — steady, practical ground",
  air: "an air day — words, ideas, connection",
  water: "a water day — feeling, depth, absorption",
  spirit: "a liminal day — the Moon runs void; finish and rest rather than launch",
};
const DAY_RULER_NOTE: Record<string, string> = {
  Sun: "visibility and leading", Moon: "tending and listening inward", Mars: "effort and decisive cuts",
  Mercury: "writing, sorting, conversation", Jupiter: "growth and the bigger frame",
  Venus: "relating, refining, enjoying", Saturn: "commitment and the unglamorous foundation",
};

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

/** Compose the day's quality the same way the week endpoint scores it. */
function dayQuality(jd: number): { element: string; label: string } {
  const elem = getDailyElementEmphasis(jd);
  const planets = getPlanetPositions(jd);
  const retro = planets.filter((p) => p.retrograde).length;
  let score = 5;
  if (elem.voidOfCourse) score -= 1;
  if (retro >= 2) score -= 1;
  if (elem.element === "fire" || elem.element === "air") score += 1;
  const label = score >= 7 ? "excellent" : score >= 5 ? "good" : score >= 2 ? "workable" : "mixed";
  return { element: elem.element, label };
}

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

async function composeDay(testerId: string, tz: number, lat: number, lon: number) {
  const now = new Date();
  const jd = julianDay(now);
  const local = localDate(tz);
  const { name: phaseName, fraction } = moonPhase(jd);
  const elem = getDailyElementEmphasis(jd);
  const { voc } = voidOfCourse(jd);
  const q = dayQuality(jd);
  const dayRuler = DAY_RULERS[local.getUTCDay()];
  const hour = getPlanetaryHour(now, lat, lon);

  const blocks: Block[] = [];

  blocks.push({
    lines: [
      `${cap(ELEMENT_WORD[elem.element] ?? elem.element)} — ${q.label} conditions overall.`,
      `Moon ${phaseName.replace(/_/g, " ")} (${Math.round(fraction * 100)}% lit) in ${elem.moonSign}${voc ? " · void of course — slack water; finish and rest rather than begin" : ""}.`,
      `${GLYPH[dayRuler]} ${dayRuler}'s day — good for ${DAY_RULER_NOTE[dayRuler]}. Right now: the ${hour.ruler} hour.`,
    ],
  });

  // On deck — today's scheduled windows
  const dayStart = new Date(local.toISOString().slice(0, 10) + "T00:00:00Z");
  const wins = await db.select().from(planningWindows).where(and(
    eq(planningWindows.testerId, testerId),
    gte(planningWindows.startTime, new Date(dayStart.getTime() + tz * 60000)),
    lte(planningWindows.startTime, new Date(dayStart.getTime() + tz * 60000 + 86400000)),
  )).orderBy(planningWindows.startTime);
  if (wins.length) {
    blocks.push({
      heading: "On deck today",
      lines: wins.slice(0, 6).map((w) => {
        const t = new Date(new Date(w.startTime).getTime() - tz * 60000);
        return `${t.toISOString().slice(11, 16)} — ${w.title}`;
      }),
    });
  }

  // The big sky — top 2 defining aspects, station-honest
  const sky = getMajorAspects(jd)
    .filter((a) => a.planet1 !== "Moon" && a.planet2 !== "Moon")
    .sort((a, b) => a.orb - b.orb)
    .slice(0, 2)
    .map((a) => {
      const status = a.stationsBeforeExact ? "closing, but a station turns it back before exact"
        : a.neverPerfected ? "separating — never perfected; a station turned it back"
        : a.applying ? `applying, ${a.orb.toFixed(1)}° to exact` : `separating, ${a.orb.toFixed(1)}° past`;
      return `${GLYPH[a.planet1]}${ASPECT_SYM[a.aspect] ?? "·"}${GLYPH[a.planet2]} ${a.planet1} ${a.aspect} ${a.planet2} — ${status}.`;
    });
  if (sky.length) blocks.push({ heading: "The big sky", lines: sky });

  // Your sky — personal transits, if a chart exists
  const natal = await natalFor(testerId);
  if (natal) {
    const personal = computeTransitAspects(natal.computed)
      .filter((t) => (t.severity === "strong" || t.severity === "major") && (natal.timeKnown || t.natalPlanet !== "Ascendant"))
      .slice(0, 3)
      .map((t) => `${GLYPH[t.transitPlanet]} ${t.transitPlanet} ${t.aspect.toLowerCase()} your natal ${t.natalPlanet}${t.exact ? " — exact now" : ` (${t.orb.toFixed(1)}°)`}.`);
    if (personal.length) blocks.push({ heading: "Landing on your chart", lines: personal });
  }

  // Your stars — a quiet closing nudge
  const stars = await db.select().from(goals).where(and(eq(goals.testerId, testerId), eq(goals.status, "active")));
  const closing = stars.length
    ? `One thing toward “${stars[0].title}” counts double on a day like this.`
    : "A day is a tide: catch it where it's high.";
  blocks.push({ lines: [closing] });

  const subject = `Today's weather — ${cap(elem.element)} · ${q.label}${voc ? " · Moon void" : ""}`;
  return { title: fmtDay(local), subject, blocks };
}

async function composeWeek(testerId: string, tz: number, _lat: number, _lon: number) {
  const blocks: Block[] = [];

  // The seven days — element + quality, one line each
  const dayLines: string[] = [];
  for (let d = 0; d < 7; d++) {
    const local = localDate(tz, d);
    const noon = new Date(Date.now() + d * 86400000); noon.setUTCHours(12 + Math.round(tz / 60), 0, 0, 0);
    const q = dayQuality(julianDay(noon));
    const elem = getDailyElementEmphasis(julianDay(noon));
    dayLines.push(`${fmtShort(local)} — ${elem.moonSign} Moon · ${q.element} · ${q.label}`);
  }
  blocks.push({ heading: "The shape of the week", lines: dayLines });

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

  // Transits perfecting this week
  const natal = await natalFor(testerId);
  if (natal) {
    let fc = computeTransitForecast(natal.computed, 7);
    if (!natal.timeKnown) fc = fc.filter((t) => t.natalPlanet !== "Ascendant");
    const lines = fc.slice(0, 6).map((t) => {
      const when = t.dayOffset === 0 ? "today" : t.dayOffset === 1 ? "tomorrow" : fmtShort(new Date(Date.parse(t.peakDate) - tz * 60000));
      return `${when} — ${GLYPH[t.transitPlanet]} ${t.transitPlanet} ${t.aspect.toLowerCase()} your ${t.natalPlanet}${t.exact ? " (exact)" : ""}.`;
    });
    if (lines.length) blocks.push({ heading: "Landing on your chart this week", lines });
  }

  blocks.push({ lines: ["Plan the deep work into the good days; keep the mixed ones light."] });
  const subject = "Your week ahead — the shape of the next seven days";
  return { title: `Week of ${fmtDay(localDate(tz))}`, subject, blocks };
}

async function composeMonth(testerId: string, tz: number, _lat: number, _lon: number) {
  const blocks: Block[] = [];

  // Lunation dates — the month's anchor points
  const lunations: string[] = [];
  let lastName = moonPhase(julianDay(new Date())).name;
  for (let d = 1; d <= 30; d++) {
    const dt = new Date(Date.now() + d * 86400000);
    const { name } = moonPhase(julianDay(dt));
    if (name !== lastName && (name === "New Moon" || name === "Full Moon")) {
      lunations.push(`${fmtShort(localDate(tz, d))} — ${name === "New Moon" ? "New Moon (begin quietly)" : "Full Moon (culminate, release)"}`);
    }
    lastName = name;
  }
  if (lunations.length) blocks.push({ heading: "The month's anchor points", lines: lunations });

  // Transits perfecting this month, week by week
  const natal = await natalFor(testerId);
  if (natal) {
    let fc = computeTransitForecast(natal.computed, 30);
    if (!natal.timeKnown) fc = fc.filter((t) => t.natalPlanet !== "Ascendant");
    const weeks: string[][] = [[], [], [], [], []];
    for (const t of fc) weeks[Math.min(4, Math.floor(t.dayOffset / 7))].push(
      `${GLYPH[t.transitPlanet]} ${t.transitPlanet} ${t.aspect.toLowerCase()} your ${t.natalPlanet} (${fmtShort(new Date(Date.parse(t.peakDate) - tz * 60000))})`
    );
    weeks.forEach((w, i) => {
      if (w.length) blocks.push({ heading: i === 0 ? "This week" : `Week of ${fmtShort(localDate(tz, i * 7))}`, lines: w.slice(0, 5) });
    });
  } else {
    blocks.push({ lines: ["Add your birth chart in Settings and this report gains the personal layer — the transits landing on your chart, dated."] });
  }

  blocks.push({ lines: ["A month is a tide too — the lunations are its high and low water. Aim the big beginnings just after the New Moon."] });
  const subject = "Your month ahead — lunations and the transits that matter";
  return { title: `The month from ${fmtDay(localDate(tz))}`, subject, blocks };
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderHtml(title: string, subject: string, blocks: Block[]): string {
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
  return [`TIDES — ${title}`, "", ...blocks.flatMap((b) => [
    ...(b.heading ? [b.heading.toUpperCase()] : [""]),
    ...b.lines.map((l) => `  ${l.replace(/<[^>]+>/g, "")}`),
  ])].join("\n");
}

router.get("/reports/preview", requireTesterId, async (req, res) => {
  const testerId = res.locals.testerId as string;
  const span = ["day", "week", "month"].includes(String(req.query.span)) ? String(req.query.span) : "day";
  const tz = Number.isFinite(parseInt(String(req.query.tz), 10)) ? parseInt(String(req.query.tz), 10) : 0;
  const lat = parseFloat(String(req.query.lat ?? "40.7"));
  const lon = parseFloat(String(req.query.lon ?? "-74.0"));

  const composed = span === "week" ? await composeWeek(testerId, tz, lat, lon)
    : span === "month" ? await composeMonth(testerId, tz, lat, lon)
    : await composeDay(testerId, tz, lat, lon);

  if (req.query.format === "json") {
    res.json({ span, subject: composed.subject, title: composed.title, blocks: composed.blocks, text: renderText(composed.title, composed.blocks) });
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(renderHtml(composed.title, composed.subject, composed.blocks));
});

export default router;
