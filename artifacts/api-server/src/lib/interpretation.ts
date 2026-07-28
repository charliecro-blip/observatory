/**
 * Interpretation layer for the email/card content engine (owner 2026-07-20).
 *
 * The reports are interpretation-first, not a data dump: every astrological
 * fact must earn its place with a "so what — do this". This module turns the
 * raw sky (moon sign, planetary day, phase, VoC, transits) into actionable
 * guidance — suggested activities, what to ease off, and the plain meaning of
 * a transit — reusing the app's canonical voice:
 *   • sign guidance ported from the frontend SIGN_MYTHOS (mythos.ts)
 *   • activity suggestions REVERSE-looked-up from activityCorrespondences.ts
 *   • transit-to-natal read from a compact theme × domain grammar
 *
 * Rule of thumb baked in here: the Moon (fast, personal, today) leads a daily;
 * the slow outer transits are the long weather — a footnote, never a headline.
 */
import { ACTIVITIES, type ActivityCorrespondence } from "./activityCorrespondences.js";

// ── Moon-sign guidance (condensed from tides/src/lib/mythos.ts SIGN_MYTHOS) ──
export interface SignGuide {
  element: "fire" | "earth" | "air" | "water";
  feel: string;      // the day's weather in one clause
  favors: string[];  // concrete things the day is good for
  ease: string;      // the one thing to ease off / the shadow to watch
}
export const SIGN_GUIDE: Record<string, SignGuide> = {
  Aries: { element: "fire", feel: "quick, initiating fire — appetite for the direct move",
    favors: ["start the thing you've been circling", "hard training", "the direct ask", "decisive errands"],
    ease: "finishing and fine detail — Aries starts more than it closes" },
  Taurus: { element: "earth", feel: "slow, settled ground that rewards staying put",
    favors: ["finish and polish", "cook well and provision", "tend money slowly", "the body and its pleasures"],
    ease: "rushing or pivoting — Taurus resents being hurried" },
  Gemini: { element: "air", feel: "bright, darting air — a hundred small currents",
    favors: ["write and edit", "calls, errands, emails", "learn something quick", "pair work and good talk"],
    ease: "deep solo focus — the day scatters attention" },
  Cancer: { element: "water", feel: "deep familiar water — everything felt is felt more",
    favors: ["tend home and kitchen", "family and chosen family", "journal from feeling", "rest that restores"],
    ease: "cold public performance — the day wants the inner shore" },
  Leo: { element: "fire", feel: "sunlit, generous fire that wants witnesses",
    favors: ["perform, present, publish", "creative play", "host generously", "romance and delight"],
    ease: "quiet background work — the day asks to be seen" },
  Virgo: { element: "earth", feel: "clear, exacting water where every detail shows",
    favors: ["edit and refine", "organize the system", "health routines and checkups", "repair small things"],
    ease: "big vague launches — the day is for precision, not scope" },
  Libra: { element: "air", feel: "mirror-still air that shows you the other side",
    favors: ["negotiate and mediate", "partner on the work", "aesthetic decisions", "host, match, introduce"],
    ease: "going it alone or forcing a call — the day decides best with someone" },
  Scorpio: { element: "water", feel: "deep, still water of unknown depth",
    favors: ["sealed-off focus", "research and investigation", "the honest hard conversation", "ending what needs ending"],
    ease: "light small talk and scattered multitasking — the day wants the descent" },
  Sagittarius: { element: "fire", feel: "open-ocean fire — the far shore matters most",
    favors: ["plan the journey", "study the big idea", "teach", "go far on foot", "publish the thesis"],
    ease: "fussy detail and staying in — the day is built for range" },
  Capricorn: { element: "earth", feel: "cold, disciplined water running exactly in its channel",
    favors: ["the unglamorous right thing", "long-term structure", "the career move", "prune what wastes time"],
    ease: "spontaneity and play — the day rewards the patient climb" },
  Aquarius: { element: "air", feel: "high, thin air — everything visible, nothing close",
    favors: ["systems thinking", "the unconventional approach", "community and collective work", "tools and tech"],
    ease: "intimacy and hand-holding — the day thinks in patterns, not people" },
  Pisces: { element: "water", feel: "warm fog on slack water — edges soften, time gets generous",
    favors: ["make art from feeling", "meditate and drift", "music and poetry", "sleep and dream generously"],
    ease: "hard logic and firm deadlines — the day blurs the plan productively" },
};

// ── Moon phase → what the point in the cycle is for ──────────────────────────
export const PHASE_GUIDE: Record<string, { thrust: string; do: string }> = {
  "New Moon":         { thrust: "the seed point", do: "name one intention and begin it small — plant, don't harvest" },
  "Waxing Crescent":  { thrust: "first momentum", do: "take the first real step; protect the young thing" },
  "First Quarter":    { thrust: "the push", do: "act through the first resistance — this is where things get built" },
  "Waxing Gibbous":   { thrust: "refinement", do: "adjust and polish toward the goal; almost there" },
  "Full Moon":        { thrust: "culmination", do: "harvest, celebrate, or release — what's ripe comes to light" },
  "Waning Gibbous":   { thrust: "sharing out", do: "give it away, teach it, digest what the peak revealed" },
  "Last Quarter":     { thrust: "the turn", do: "let go of what didn't work; clear the ground" },
  "Balsamic":         { thrust: "the dark before the seed", do: "rest, reflect, and empty out before the next cycle" },
};

// ── Planetary day: what the weekday's ruler underwrites ──────────────────────
export const DAY_RULER = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
export const DAY_RULER_GIFT: Record<string, string> = {
  Sun: "vitality, creative work, and wholehearted decisions",
  Moon: "tending, feeling, and the domestic rhythms",
  Mars: "effort, training, and the decisive cut",
  Mercury: "writing, sorting, errands, and conversation",
  Jupiter: "growth, teaching, and the bigger frame",
  Venus: "relating, refining, money, and pleasure",
  Saturn: "commitment and the unglamorous foundation",
};

// ── Suggested activities — REVERSE lookup over the correspondence table ───────
// Given today's sky, score every activity for fit and return the strongest.
// This is the "so what — do this" layer: concrete things, in the app's voice.
export interface DaySky {
  moonSign: string;
  dayRuler: string;      // the weekday's planetary ruler
  waxing: boolean;
  phaseKey: "new" | "waxing" | "full" | "waning";
  voc: boolean;
  mercuryRx: boolean;
}

function fitScore(a: ActivityCorrespondence, sky: DaySky): number {
  let s = 0;
  if (a.signs[sky.moonSign]) s += 2.2;                       // Moon-sign affinity
  if (a.hourRulers.includes(sky.dayRuler)) s += 1.4;         // it's this planet's day
  if (a.planets[sky.dayRuler]) s += 0.8;                     // day ruler is a significator
  if (a.element === SIGN_GUIDE[sky.moonSign]?.element) s += 0.9;
  if (a.phase === sky.phaseKey) s += 1.1;                    // right point in the cycle
  if (a.phase === "waxing" && sky.waxing) s += 0.5;
  if (a.phase === "waning" && !sky.waxing) s += 0.5;
  if (a.voc === "favor" && sky.voc) s += 1.0;
  if (a.voc === "avoid" && sky.voc) s -= 1.6;                // don't suggest launches into the void
  if (a.mercuryRx === "favor" && sky.mercuryRx) s += 0.8;
  if (a.mercuryRx === "hard" && sky.mercuryRx) s -= 1.8;
  return s;
}

function scoredActivities(sky: DaySky): { a: ActivityCorrespondence; s: number }[] {
  return ACTIVITIES.map(a => ({ a, s: fitScore(a, sky) })).sort((x, y) => y.s - x.s);
}

/** Top activities the day genuinely supports, with their one-line gloss. */
export function favoredActivities(sky: DaySky, n = 3): { label: string; gloss: string; key: string; category: string }[] {
  return scoredActivities(sky)
    .filter(x => x.s >= 2.5)
    .slice(0, n)
    .map(x => ({ label: x.a.label, gloss: x.a.gloss, key: x.a.key, category: x.a.category }));
}

/** The best-fitting activity within a set of categories, with its raw score —
 * lets the weekly name "best day for deep focus / people / rest" concretely. */
export function bestFor(sky: DaySky, categories: string[]): { label: string; key: string; score: number } | null {
  const hit = scoredActivities(sky).find(x => categories.includes(x.a.category));
  return hit && hit.s >= 2 ? { label: hit.a.label, key: hit.a.key, score: hit.s } : null;
}

/** The one or two things to ease off today, framed as guidance not scolding. */
export function easeOff(sky: DaySky): string[] {
  const out: string[] = [];
  if (sky.voc) out.push("launching, buying, or publishing — the Moon is void; begin nothing you want to last");
  if (sky.mercuryRx) out.push("signing and shipping the final version — Mercury retrograde favors the redraft, not the release");
  if (!out.length) {
    const ease = SIGN_GUIDE[sky.moonSign]?.ease;
    if (ease) out.push(ease);
  }
  return out.slice(0, 2);
}

// ── Transit-to-natal, in plain language (the long-weather footnote) ──────────
const TRANSIT_THEME: Record<string, string> = {
  Saturn: "a season of testing and consolidating",
  Uranus: "a stretch of restlessness and sudden change",
  Neptune: "a haze that softens and idealizes",
  Pluto: "a slow, compelling pressure to transform",
  Jupiter: "an opening, a chance to grow",
  Chiron: "an old tenderness reopening to heal",
  Sun: "a passing spotlight", Mercury: "a passing thought", Venus: "a passing sweetness",
  Mars: "a passing spur", Moon: "a passing mood",
};
// Self-contained phrases — each reads correctly after "… in ".
const NATAL_DOMAIN: Record<string, string> = {
  Sun: "your sense of self and vitality", Moon: "your inner emotional weather",
  Mercury: "your thinking and speech", Venus: "what and whom you value",
  Mars: "your drive and assertion", Jupiter: "your sense of possibility",
  Saturn: "your structures and commitments", Uranus: "your need for freedom",
  Neptune: "your dreams and ideals", Pluto: "your deepest drives", Chiron: "an old wound",
  Ascendant: "how you meet the world", Midheaven: "your public path and calling",
};
const SOFT = new Set(["trine", "sextile"]);
const HARD = new Set(["square", "opposition"]);

/** One honest sentence for a transit — the meaning, not the geometry. */
export function transitMeaning(transitPlanet: string, aspect: string, natalPlanet: string): string {
  const theme = TRANSIT_THEME[transitPlanet] ?? "a passing influence";
  const domain = NATAL_DOMAIN[natalPlanet] ?? "your chart";
  const a = aspect.toLowerCase();
  const tone = a === "conjunction" ? "sits right on"
    : SOFT.has(a) ? "flows easily to"
    : HARD.has(a) ? "presses on"
    : "touches";
  return `${transitPlanet} ${tone} your natal ${natalPlanet} — ${theme} in ${domain}.`;
}

/** Rank transits so the footnote shows the one that matters most, not six. */
export function rankTransits<T extends { transitPlanet: string; aspect: string; orb?: number }>(ts: T[]): T[] {
  const OUTER_WEIGHT: Record<string, number> = { Pluto: 5, Neptune: 5, Uranus: 5, Saturn: 4, Chiron: 4, Jupiter: 3 };
  return [...ts].sort((x, y) => {
    const wx = OUTER_WEIGHT[x.transitPlanet] ?? 1, wy = OUTER_WEIGHT[y.transitPlanet] ?? 1;
    if (wx !== wy) return wy - wx;
    const hx = HARD.has(x.aspect.toLowerCase()) ? 1 : 0, hy = HARD.has(y.aspect.toLowerCase()) ? 1 : 0;
    if (hx !== hy) return hy - hx;                        // hard aspects are louder weather
    return (x.orb ?? 9) - (y.orb ?? 9);
  });
}
