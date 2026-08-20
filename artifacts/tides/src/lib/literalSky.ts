/**
 * THE CONFIGURATION, SAID LITERALLY.
 *
 * Owner, 2026-08-20, on full astro mode: "I want to see what the logic behind
 * this is... anytime the user selects full astro, we should give the literal
 * language first, and then minimal interpretation behind it."
 *
 * Compass composes an interpretive sentence for every testimony — "Venus
 * strikes sparks with your sense of yourself" — and at `medium` that is the
 * right register, because the reader has said they do not want the jargon.
 * At `full` they have said the opposite, and the interpretation was still
 * arriving first with the actual aspect nowhere on the page. Somebody who
 * asked for the sky's own words was being handed a paraphrase of them.
 *
 * So this renders the fact: "Venus trine Sun · 0.7° applying". The
 * interpretation still follows, because the two answer different questions
 * and the second one is why anybody reads the first.
 *
 * IT RETURNS NULL RATHER THAN GUESSING. A testimony whose facts do not name a
 * configuration — a sect statement, a bare hour — has no literal form beyond
 * what its own sentence already says, and inventing one would be worse than
 * the paraphrase it replaced.
 */

import type { LeadTestimony } from "@/lib/lead";

const GLYPH: Record<string, string> = {
  conjunction: "☌", sextile: "⚹", square: "□", trine: "△", opposition: "☍",
};

export function literalOf(t: LeadTestimony): string | null {
  const f = t.facts;
  if (!f) return null;

  // An aspect between two bodies — the case with a real literal form.
  if (f.aspect && f.planet && f.partner) {
    const orb = typeof f.orbDeg === "number" ? `${f.orbDeg.toFixed(1)}°` : null;
    const motion = f.applying === true ? "applying" : f.applying === false ? "separating" : null;
    const tail = [orb, motion].filter(Boolean).join(" ");
    return `${f.planet} ${GLYPH[f.aspect] ?? ""} ${f.partner}${tail ? ` · ${tail}` : ""}`;
  }

  // The Moon in a sign, and the phase, both have plain statements.
  if (f.kind === "moonSign" && f.sign) return `Moon in ${f.sign}`;
  if (f.kind === "phase" && f.phaseName) {
    return `${f.phaseName}${f.waxing === true ? " · waxing" : f.waxing === false ? " · waning" : ""}`;
  }
  if (f.kind === "voc") return "Moon void of course";

  // Sect, hour and day-ruler are already literal in their own sentences —
  // "the Saturn hour" IS the fact. Adding a second version would be noise.
  return null;
}

/**
 * The interpretation, without the configuration it restates.
 *
 * A composed note is `{planet} {verb} {partner} ({orb} {motion}) — {reading}`,
 * so prepending the literal form produced the configuration twice in one
 * line: "Moon △ Jupiter · 5.4° applying — Moon flows to Jupiter (5.4°
 * applying) — flow toward growth". Literal-first means the fact REPLACES the
 * paraphrase of itself, not that it queues in front of it.
 *
 * Splits on the em dash the composer uses between the two halves. A note with
 * no dash is already all interpretation and comes back whole.
 */
export function interpretationOf(note: string): string {
  const i = note.indexOf(" — ");
  return i === -1 ? note : note.slice(i + 3);
}
