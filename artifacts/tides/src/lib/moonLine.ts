/**
 * THE MOON, IN ONE SENTENCE: sign, phase, and the aspect she perfects.
 *
 * Home and the Calendar's Agenda header both open with this (owner
 * 2026-08-22: lunar placement and aspects lead; 2026-09-30: the Agenda header
 * should match Home). One builder, so the two read the same way.
 */

export interface MoonLineInput {
  /** The Moon's sign, or the noon sign on a day she changes sign. */
  sign: string;
  /** Set when the sentence covers a day on which the Moon changes sign. */
  ingress?: { from: string; to: string; at: Date } | null;
  /** "Waning Gibbous", "Full Moon", … */
  phaseName?: string;
  /** Illuminated fraction, 0..1 (a 0..100 percentage is accepted too). */
  illumination?: number;
  /** Home only: the Moon is void now, until this clock time. */
  voidUntil?: string | null;
  /** The aspect to name. undefined while loading, null when there is none. */
  aspect?: { aspect: string; body2: string; at: Date } | null;
  /** "today" for the next one after now, "day" for a day's first. */
  scope: "today" | "day";
  fmtTime: (d: Date) => string;
}

function phaseWord(name: string): string {
  const n = name.toLowerCase();
  return n.includes("waxing") ? "waxing" : n.includes("waning") ? "waning"
    : n.includes("full") ? "full" : n.includes("new") ? "new" : "";
}

export function moonLine(i: MoonLineInput): string {
  const phase = phaseWord(i.phaseName ?? "");
  const ill = i.illumination ?? 0;
  const pct = Math.round(ill <= 1 ? ill * 100 : ill);
  const lit = phase ? `${phase} and ${pct}% lit` : "";

  const tail = i.voidUntil
    ? `void of course until it changes sign at ${i.voidUntil.replace(/(^|\s)0(\d)/, "$1$2")}`
    : i.aspect === undefined ? ""
    : i.aspect === null ? (i.scope === "today" ? "with no more exact aspects today" : "with no exact aspects that day")
    : `makes an exact ${i.aspect.aspect} to ${i.aspect.body2 === "Sun" ? "the Sun" : i.aspect.body2} at ${i.fmtTime(i.aspect.at)}`;
  const joinTail = (s: string) => !tail ? `${s}.` : tail.startsWith("with") ? `${s}, ${tail}.` : `${s}, and ${tail}.`;

  // On a sign change the sign is not one fact for the day, so the change is the
  // clause and the phase leads: "The Moon is waning and 80% lit, moves from
  // Taurus into Gemini at 12:26pm, and makes …".
  if (i.ingress) {
    const move = `moves from ${i.ingress.from} into ${i.ingress.to} at ${i.fmtTime(i.ingress.at)}`;
    if (!lit) return joinTail(`The Moon ${move}`);
    return joinTail(`The Moon is ${lit}, ${move}`).replace(", and with", ", with");
  }
  const sign = i.sign.split(" ")[0];
  return joinTail(`The Moon is in ${sign}${lit ? `, ${lit}` : ""}`);
}
