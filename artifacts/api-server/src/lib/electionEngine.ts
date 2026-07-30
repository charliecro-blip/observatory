/**
 * The election engine (owner 2026-07-20): pick an activity → tiered times.
 *
 * GOOD times (the sky's general weather, localized):
 *   · the activity's planetary hour (needs lat/lon — allowed here, unlike
 *     shareable cards, because this is in-app and per-user)
 *   · the swell around a Moon aspect to the activity's significators
 *   · an all-day Moon-sign affinity
 *   · for void-favoring activities (rest, clearing), the void itself
 *
 * GREAT times (the sky speaking to YOU, or to itself, about this matter):
 *   · a planetary hour and a Moon-aspect swell OVERLAPPING (stacked good)
 *   · a significator moving through one of the activity's governing houses
 *     in the user's NATAL chart (whole-sign), or the Moon crossing one today
 *   · a transiting significator in tight soft aspect to its own natal place
 *   · a standing sky aspect between two significators (≤3°, supportive)
 *
 * Honesty layer: per-activity Mercury-Rx stance (hard = classically blocked,
 * surfaced as a caution, great tier withheld), VoC avoidance drops windows
 * inside the void, phase bias nudges rather than excludes.
 */

import { ACTIVITIES, type ActivityCorrespondence } from "./activityCorrespondences.js";
import {
  julianDay, moonLongitude, sunLongitude, getPlanetaryHour, getPlanetPositions,
  getMajorAspects, isRetrograde, SIGNS, moonFinalAspectInSign, eclipseWindow,
} from "./astro.js";
import { computeDayArc } from "./dayarc.js";
import { scanMoonPerfections } from "./studioCard.js";
import { computeCusps, assignHouse } from "./houses.js";
import type { ComputedNatalChart } from "./natal.js";

const SOFT_W: Record<string, number> = { conjunction: 1.0, trine: 0.85, sextile: 0.65, quintile: 0.5, "semi-sextile": 0.35 };
const HARD_W: Record<string, number> = { square: 0.7, "semi-square": 0.4, sesquiquadrate: 0.4 };
const WEEKDAY_RULERS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"] as const;
const norm360 = (d: number) => ((d % 360) + 360) % 360;
const sep180 = (a: number, b: number) => { const d = Math.abs(norm360(a - b)); return d > 180 ? 360 - d : d; };

export interface ElectionWindow {
  date: string; dow: string;
  startAt: string; endAt: string;          // ISO instants (schedulable)
  startClock: string; endClock: string;
  allDay?: boolean;
  tier: "good" | "great";
  score: number;
  why: string;
  sources: string[];                        // hour | moon | sign | voc | natal | sky
}

export interface ElectionResult {
  activity: { key: string; label: string; gloss: string; category: string };
  span: "day" | "week" | "month";
  personalized: boolean;                    // natal chart was available
  cautions: string[];
  windows: ElectionWindow[];
}

function clockOf(ms: number, tzOffsetMin: number): string {
  const s = new Date(ms - tzOffsetMin * 60000);
  let h = s.getUTCHours(); const m = s.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return m === 0 ? `${h} ${ampm}` : `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Enumerate the local day's planetary hours (localized good-time layer).
function dayHours(dayStartMs: number, lat: number, lon: number): { ruler: string; startMs: number; endMs: number }[] {
  const out: { ruler: string; startMs: number; endMs: number }[] = [];
  let t = dayStartMs + 60000;
  const dayEnd = dayStartMs + 24 * 3600000;
  for (let i = 0; i < 30 && t < dayEnd; i++) {
    const ph = getPlanetaryHour(new Date(t), lat, lon);
    out.push({ ruler: ph.ruler, startMs: ph.startTime.getTime(), endMs: ph.endTime.getTime() });
    t = ph.endTime.getTime() + 60000;
  }
  return out;
}

export function computeElections(opts: {
  activityKey: string;
  span: "day" | "week" | "month";
  lat: number; lon: number; tzOffsetMin: number;
  natal?: ComputedNatalChart | null;
  startAt?: Date;
}): ElectionResult | null {
  const act = ACTIVITIES.find(a => a.key === opts.activityKey);
  if (!act) return null;
  const { lat, lon, tzOffsetMin } = opts;
  const days = opts.span === "day" ? 1 : opts.span === "week" ? 7 : 30;
  const start = opts.startAt ?? new Date();
  const aspectW: Record<string, number> = act.aspects === "effort" ? { ...SOFT_W, ...HARD_W } : SOFT_W;

  // Natal groundwork: whole-sign cusps from the natal Ascendant, and each
  // significator's own natal longitude (for transit-to-natal returns).
  const natal = opts.natal ?? null;
  const cusps = natal ? computeCusps("whole-sign", { ascLon: natal.ascendant.longitude, mcLon: natal.midheaven.longitude, lat, lon, jd: 0 } as any) : null;
  const natalLonOf = (p: string) => natal?.planets.find(x => x.planet === p)?.longitude ?? null;

  const cautions: string[] = [];
  const startJd = julianDay(start);
  const mercRx = isRetrograde("Mercury", startJd);

  // ── Verified electional gates (Hampar / DeLuce / March — see
  // SYNTHESIS-BOOK-NOTES.md) ─────────────────────────────────────────────────
  // 1. Eclipse window: delay elections within ±1 week of any eclipse — an
  //    unstable sky to launch in. GREAT is suppressed; the caution says why.
  const ecl = eclipseWindow(startJd);
  if (ecl.active) cautions.push(`A ${ecl.kind} eclipse falls within a week — the tradition delays elections near eclipses. Windows stay usable, but nothing gets the GREAT stamp.`);
  // 2. Retrograde significators: the matter's own planets should be direct.
  //    A retrograde significator caps the tier (success-with-revision, not GREAT).
  const sigPlanets = Object.entries(act.planets).filter(([, w]) => w >= 0.8).map(([p]) => p);
  const rxSigs = sigPlanets.filter(p => p !== "Sun" && p !== "Moon" && isRetrograde(p, startJd));
  if (rxSigs.length) cautions.push(`${rxSigs.join(" and ")} — this activity's significator${rxSigs.length > 1 ? "s are" : " is"} retrograde: doable, but expect re-work; the tradition withholds the best stamp.`);
  if (mercRx && act.mercuryRx === "hard") cautions.push("Mercury is retrograde — the tradition blocks this outright; wait for the direct station, or use the time to prepare.");
  if (mercRx && act.mercuryRx === "soft") cautions.push("Mercury is retrograde — doable, but expect revisions and follow-ups; leave slack.");
  if (mercRx && act.mercuryRx === "favor") cautions.push("Mercury is retrograde — which actually suits this: re- work runs well under it.");

  const windows: ElectionWindow[] = [];
  const finalAspectMemo = new Map<string, ReturnType<typeof moonFinalAspectInSign>>();

  for (let d = 0; d < days; d++) {
    const instant = new Date(start.getTime() + d * 86400000);
    const arc = computeDayArc(instant, lat, lon, tzOffsetMin);
    const dayStartMs = new Date(arc.dayStart).getTime();
    const local = new Date(dayStartMs - tzOffsetMin * 60000 + 12 * 3600000);
    const dateLabel = local.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    const dow = local.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    const jdNoon = julianDay(new Date(dayStartMs + 12 * 3600000));
    // Was: mercRx/ecl/rxSigs computed once at the SCAN's start date and reused
    // for every day's tier gating below — a week/month scan spanning a real
    // eclipse or a Mercury station saw it on day 0 only, so e.g. a month scan
    // crossing a total solar eclipse mid-month stamped GREAT windows straight
    // through it (audit F5). Evaluate them per-day, at this day's own jdNoon.
    const dayMercRx = isRetrograde("Mercury", jdNoon);
    const dayEcl = eclipseWindow(jdNoon);
    const dayRxSigs = sigPlanets.filter(p => p !== "Sun" && p !== "Moon" && isRetrograde(p, jdNoon));
    const moonSign = SIGNS[Math.floor(norm360(moonLongitude(jdNoon)) / 30) % 12];
    const waxing = norm360(moonLongitude(jdNoon) - sunLongitude(jdNoon)) < 180;
    const dayRuler = WEEKDAY_RULERS[local.getUTCDay()];
    const vocSpans = (arc.vocWindows ?? []).map(v => [Date.parse(v.start), Date.parse(v.end)] as [number, number]);
    const inVoc = (a: number, b: number) => vocSpans.some(([s, e]) => a < e && b > s);

    // ── Day-level GREAT signals ─────────────────────────────────────────────
    const daySources: string[] = [];
    const dayWhy: string[] = [];
    let dayBoost = 1;

    const positions = getPlanetPositions(jdNoon);
    const lonOf = (p: string): number | null => {
      if (p === "Sun") return norm360(sunLongitude(jdNoon));
      if (p === "Moon") return norm360(moonLongitude(jdNoon));
      const row = positions.find(x => x.planet === p);
      return row ? SIGNS.indexOf(row.sign) * 30 + row.degree : null;
    };

    if (natal && cusps) {
      for (const p of Object.keys(act.planets)) {
        if (p === "Moon") continue; // the dedicated Moon-crossing line below covers it
        const tl = lonOf(p);
        if (tl == null) continue;
        const house = assignHouse(tl, cusps);
        if (act.houses.includes(house)) {
          daySources.push("natal"); dayBoost *= 1.2;
          dayWhy.push(`${p} is moving through your ${house}${house === 1 ? "st" : house === 2 ? "nd" : house === 3 ? "rd" : "th"} — this matter's own house`);
          break;
        }
      }
      const moonHouse = assignHouse(norm360(moonLongitude(jdNoon)), cusps);
      if (act.houses.includes(moonHouse)) {
        daySources.push("natal"); dayBoost *= 1.15;
        dayWhy.push(`the Moon crosses your ${moonHouse}${moonHouse === 1 ? "st" : moonHouse === 2 ? "nd" : moonHouse === 3 ? "rd" : "th"} today`);
      }
      // Transit-to-natal return: a significator softly touching its own natal place.
      for (const p of Object.keys(act.planets)) {
        const tl = lonOf(p); const nl = natalLonOf(p);
        if (tl == null || nl == null) continue;
        const s = sep180(tl, nl);
        const near = [0, 60, 120].find(A => Math.abs(s - A) <= 2);
        if (near != null) {
          daySources.push("natal"); dayBoost *= 1.15;
          dayWhy.push(`${p} ${near === 0 ? "conjoins" : near === 120 ? "trines" : "sextiles"} your natal ${p}`);
          break;
        }
      }
    }

    const sigs = Object.keys(act.planets).filter(p => p !== "Moon");
    const pair = getMajorAspects(jdNoon).find(pa =>
      (SOFT_W as any)[pa.aspect] > 0 && pa.orb <= 3 &&
      sigs.includes(pa.planet1) && sigs.includes(pa.planet2) && pa.planet1 !== pa.planet2);
    if (pair) {
      daySources.push("sky"); dayBoost *= 1.2;
      dayWhy.push(`${pair.planet1}–${pair.planet2} ${pair.aspect} standing in the sky`);
    }
    const phaseMatch = act.phase === null ? null : (act.phase === "waxing" ? waxing : act.phase === "waning" ? !waxing : null);
    if (phaseMatch === true) { dayBoost *= 1.1; dayWhy.push(act.phase === "waxing" ? "waxing, as this wants" : "waning, as this wants"); }
    if (phaseMatch === false) dayBoost *= 0.9;

    const dayMatch = (act.planets[dayRuler] ?? 0) > 0;
    if (dayMatch) { dayBoost *= 1.1; dayWhy.push(`${dayRuler}'s day`); }

    // ── Candidates ──────────────────────────────────────────────────────────
    interface Cand { startMs: number; endMs: number; score: number; why: string[]; sources: string[]; allDay?: boolean }
    const cands: Cand[] = [];

    // Planetary hours (waking, matching rulers)
    const hours = dayHours(dayStartMs, lat, lon).filter(h => act.hourRulers.includes(h.ruler));
    for (const h of hours) {
      const startMs = Math.max(h.startMs, dayStartMs + 7 * 3600000);
      const endMs = Math.min(h.endMs, dayStartMs + 23 * 3600000);
      if (endMs - startMs < 30 * 60000) continue;
      cands.push({ startMs, endMs, score: 0.5, why: [`${h.ruler} hour`], sources: ["hour"] });
    }

    // Moon-aspect swells
    for (const ev of scanMoonPerfections(dayStartMs)) {
      const aw = aspectW[ev.aspect] ?? 0;
      const pw = act.planets[ev.planet] ?? 0;
      if (aw === 0 || pw === 0) continue;
      const startMs = Math.max(ev.timeMs - 2.5 * 3600000, dayStartMs + 7 * 3600000);
      const endMs = Math.min(ev.timeMs + 2.5 * 3600000, dayStartMs + 23 * 3600000);
      if (endMs - startMs < 1.5 * 3600000) continue;
      const hard = ev.aspect in HARD_W;
      cands.push({
        startMs, endMs, score: aw * pw,
        why: [`Moon ${ev.aspect} ${ev.planet} · exact ${clockOf(ev.timeMs, tzOffsetMin)}${hard ? " · raw fuel" : ""}`],
        sources: ["moon"],
      });
    }

    // Sign-day affinity
    const gloss = act.signs[moonSign];
    if (gloss) cands.push({
      startMs: dayStartMs + 7 * 3600000, endMs: dayStartMs + 23 * 3600000,
      score: 0.45, why: [`Moon in ${moonSign} · ${gloss}`], sources: ["sign"], allDay: true,
    });

    // The void: a window for void-favoring activities, a filter for avoiders
    if (act.voc === "favor") {
      for (const [s, e] of vocSpans) {
        let a = Math.max(s, dayStartMs + 7 * 3600000);
        const b = Math.min(e, dayStartMs + 23 * 3600000);
        a = Math.max(a, b - 4 * 3600000);
        if (b - a < 1.5 * 3600000) continue;
        cands.push({ startMs: a, endMs: b, score: 0.55, why: ["void of course · slack water"], sources: ["voc"] });
      }
    }

    // ── Merge overlapping hour × moon candidates → stacked GREAT ────────────
    const hoursC = cands.filter(c => c.sources.includes("hour"));
    const moons = cands.filter(c => c.sources.includes("moon"));
    for (const h of hoursC) {
      for (const m of moons) {
        const s = Math.max(h.startMs, m.startMs), e = Math.min(h.endMs, m.endMs);
        if (e - s >= 45 * 60000) {
          cands.push({ startMs: s, endMs: e, score: h.score + m.score + 0.3, why: [...m.why, ...h.why], sources: ["moon", "hour"] });
        }
      }
    }

    // A merged moon×hour row supersedes the bare hour inside it — one moment,
    // one row.
    const merged = cands.filter(c => c.sources.includes("moon") && c.sources.includes("hour"));
    const superseded = new Set(
      cands.filter(c => c.sources.length === 1 && c.sources[0] === "hour" &&
        merged.some(m => m.startMs <= c.startMs + 60000 && m.endMs >= c.endMs - 60000)));

    // ── Score, tier, emit ────────────────────────────────────────────────────
    for (const c of cands) {
      if (superseded.has(c)) continue;
      if (act.voc === "avoid" && !c.allDay && inVoc(c.startMs, c.endMs) && !c.sources.includes("voc")) continue;
      const score = c.score * dayBoost;
      // GREAT requires TWO independent signals (owner 2026-07-20: one wasn't
      // scarce enough — Venus hours recur daily and a governing house holds
      // the Moon for days). Signals: an hour×moon stack counts as one; each
      // natal firing (significator in the matter's house, Moon crossing it,
      // transit-to-natal return) and a standing sky pair count as one each.
      // Sign-affinity days stay good — they're ambient quality, not elections.
      const stacked = c.sources.includes("moon") && c.sources.includes("hour");
      const substantive = c.sources.includes("moon") || c.sources.includes("hour");
      const greatSignals = (stacked ? 1 : 0) + daySources.length;
      let tier: "good" | "great" = substantive && greatSignals >= 2 ? "great" : "good";
      if (dayMercRx && act.mercuryRx === "hard") tier = "good"; // blocked matters get no great stamp
      // Verified gates: eclipse week, retrograde significators, and the Moon's
      // FINAL aspect in this window's sign (how the matter ends) each cap GREAT.
      if (tier === "great" && (dayEcl.active || dayRxSigs.length > 0)) tier = "good";
      if (tier === "great" && !c.allDay) {
        // Memoized per sign occupancy — every window in the same Moon sign
        // shares one final aspect, and the scan isn't free.
        const cJd = julianDay(new Date(c.startMs));
        const signKey = Math.floor(norm360(moonLongitude(cJd)) / 30) + ":" + Math.floor(cJd);
        if (!finalAspectMemo.has(signKey)) finalAspectMemo.set(signKey, moonFinalAspectInSign(cJd));
        const fin = finalAspectMemo.get(signKey)!;
        if (fin && (fin.aspect === "square" || fin.aspect === "opposition") && (fin.planet === "Mars" || fin.planet === "Saturn")) {
          tier = "good"; // Hampar: a malefic hard final aspect — the ending sours; no GREAT
        }
      }
      windows.push({
        date: dateLabel, dow,
        startAt: new Date(c.startMs).toISOString(), endAt: new Date(c.endMs).toISOString(),
        startClock: clockOf(c.startMs, tzOffsetMin), endClock: clockOf(c.endMs, tzOffsetMin),
        allDay: c.allDay, tier, score: parseFloat(score.toFixed(3)),
        why: [...c.why, ...dayWhy].join(" · "),
        sources: [...new Set([...c.sources, ...daySources])],
      });
    }
  }

  // ── Span selection ───────────────────────────────────────────────────────
  // Day: everything, chronological (it's a menu of the day). Week: top 10 by
  // score, ≤3/day. Month: best window per day, top 14 days.
  let out = windows;
  if (opts.span !== "day") {
    const perDayCap = opts.span === "week" ? 3 : 1;
    const byDay: Record<string, number> = {};
    out = [];
    for (const w of [...windows].sort((a, b) => b.score - a.score)) {
      if ((byDay[w.date] ?? 0) >= perDayCap) continue;
      byDay[w.date] = (byDay[w.date] ?? 0) + 1;
      out.push(w);
      if (out.length >= (opts.span === "week" ? 10 : 14)) break;
    }
  }
  out.sort((a, b) => a.startAt.localeCompare(b.startAt));

  return {
    activity: { key: act.key, label: act.label, gloss: act.gloss, category: act.category },
    span: opts.span, personalized: !!natal, cautions, windows: out,
  };
}
