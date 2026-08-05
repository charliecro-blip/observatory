/**
 * The pre-session map: what a long block's internal arc looks like.
 *
 * Step 3. Rendered ONCE, before the session starts. The temptation this file
 * exists to resist is turning each planetary hour into an instruction —
 * "Sun hour: outline. Venus hour: beautify. Mercury hour: edit." That reads
 * elegantly and would push someone to change cognitive mode every time the
 * ruler changes, including at the moment they finally reach flow. Astrology
 * driven interruption is a product failure. The engine should not ring a bell
 * seven times because the sky changed labels.
 *
 * NO MANUFACTURED CELLS
 * ---------------------------------------------------------------------------
 * A verb per planet × position is 21 cells, and most of them would be invented
 * to fill the matrix rather than because the tradition says anything. So the
 * narration is assembled only from facts already established elsewhere:
 *
 *   · the actual local hour sequence (from longSession's arc)
 *   · which of those rulers this activity actually wants (hourRulers)
 *   · where the anchor falls, if there is one
 *   · real transitions riding along inside (void, ingress)
 *
 * When none of those say anything about a stretch, the narration says so —
 * "the Venus hour doesn't change this much; hold course" — rather than
 * inventing a register for it. Neutral narration is a legitimate output.
 *
 * A BREAK IS SUGGESTED ONLY WHERE ONE IS INDICATED
 * ---------------------------------------------------------------------------
 * Not at every hour boundary. Only where an hour change happens to land near
 * the midpoint of a long session, which is where a break was ergonomically due
 * anyway — the sky is choosing between two equally good minutes, not creating
 * the need.
 */

import type { SessionCandidate } from "./longSession.js";
import { clockIn } from "./localClock.js";

export interface SessionNarration {
  /** "Sun → Venus → Mercury → Moon", or null when hours are withheld. */
  arcLine: string | null;
  /** One paragraph. Never a list of per-hour instructions. */
  map: string;
  /** Concrete notes: the anchor, real transitions, a break if indicated. */
  notes: string[];
  /** Present only when an hour boundary sits near the ergonomic midpoint. */
  suggestedBreakAt: Date | null;
}

// Clock formatting lives in lib/localClock — the same fix was needed in the
// advisor's prompts, so it is one helper rather than two copies drifting.
/** A break is only worth suggesting in a session long enough to need one. */
const BREAK_MIN_SESSION = 150;
/** …and only if an hour boundary lands within this of the midpoint. */
const BREAK_WINDOW_MIN = 20;

export function narrateSession(c: SessionCandidate, tzOffsetMin = 0): SessionNarration {
  const clock = (d: Date) => clockIn(d, tzOffsetMin);
  const notes: string[] = [];

  // Hours withheld (guessed location, or polar day/night) — say what is true
  // without the arc rather than pretending to one.
  if (!c.arc.length) {
    for (const n of transitionNotes(c, tzOffsetMin)) notes.push(n);
    if (anchorIsInside(c)) notes.push(anchorNote(c, tzOffsetMin));
    return {
      arcLine: null,
      map: `${clock(c.startAt)}–${clock(c.endAt)}, ${Math.round(c.durationMinutes / 60 * 10) / 10} hours, unbroken.`,
      notes,
      suggestedBreakAt: null,
    };
  }

  const arcLine = c.arc.map(a => a.ruler).join(" → ");
  const preferred = c.arc.filter(a => a.preferred);

  const parts: string[] = [
    `${clock(c.startAt)}–${clock(c.endAt)}, ${Math.round(c.durationMinutes / 60 * 10) / 10} hours, unbroken.`,
  ];

  // The only claim made about the sequence itself: which stretch this activity
  // actually wants. Everything else about "what a Venus hour is like" belongs
  // to the hour's own copy, not to a session map.
  if (preferred.length) {
    const longest = [...preferred].sort((a, b) => b.minutes - a.minutes)[0];
    // The CLOCK SPAN, not a placement word. Saying "Mercury rules at the start"
    // above an arc line reading "Venus → Mercury → …" made the two disagree:
    // Mercury fell inside the opening third but was plainly not first, and the
    // reader can see that. A time cannot be misread the way a vague position
    // can.
    const until = new Date(longest.startAt.getTime() + longest.minutes * 60000);
    parts.push(
      `${longest.ruler} rules ${clock(longest.startAt)}–${clock(until)}, the hour this activity wants — ` +
      `if one stretch is going to carry the session, it is that one.`);
  } else {
    // Honest: no preferred ruler in this block. That is a real fact about it,
    // and hiding it would make every session sound equally endorsed.
    parts.push(
      `None of these hours is one this activity particularly wants. That does not make the block bad — ` +
      `it makes it ordinary, and the rest of the timing is why it was chosen.`);
  }

  parts.push("You do not need to change tasks when the ruler changes.");

  if (anchorIsInside(c)) notes.push(anchorNote(c, tzOffsetMin));
  for (const n of transitionNotes(c, tzOffsetMin)) notes.push(n);

  // A break, only where one was ergonomically due anyway.
  let suggestedBreakAt: Date | null = null;
  if (c.durationMinutes >= BREAK_MIN_SESSION) {
    const mid = new Date(c.startAt.getTime() + (c.durationMinutes / 2) * 60000);
    const near = c.arc
      .map(a => a.startAt)
      .filter(t => t > c.startAt && t < c.endAt)
      .map(t => ({ t, gap: Math.abs(t.getTime() - mid.getTime()) / 60000 }))
      .filter(x => x.gap <= BREAK_WINDOW_MIN)
      .sort((a, b) => a.gap - b.gap)[0];
    if (near) {
      suggestedBreakAt = near.t;
      notes.push(`An hour turns at ${clock(near.t)}, near the midpoint — a natural place to stop for a few minutes if you want one.`);
    }
  }

  return { arcLine, map: parts.join(" "), notes, suggestedBreakAt };
}

/**
 * An exactitude sitting on the block's own edge is not an anchor.
 *
 * A perfection at 11:00 in a block that ends at 11:00 was being reported as
 * "toward the end of the block" — it is not in the block in any useful sense,
 * and building a session around it would put the moment you care about at the
 * instant you stop.
 */
const EDGE_MIN = 10;
function anchorIsInside(c: SessionCandidate): boolean {
  if (!c.anchor) return false;
  const fromStart = (c.anchor.at.getTime() - c.startAt.getTime()) / 60000;
  const toEnd = (c.endAt.getTime() - c.anchor.at.getTime()) / 60000;
  return fromStart >= EDGE_MIN && toEnd >= EDGE_MIN;
}

function anchorNote(c: SessionCandidate, tzOffsetMin: number): string {
  const clock = (d: Date) => clockIn(d, tzOffsetMin);
  const where = c.anchor!.placement === "middle" ? "near the middle"
    : c.anchor!.placement === "opening" ? "early on" : "toward the end";
  return `${c.anchor!.label} perfects at ${clock(c.anchor!.at)}, ${where} of the block.`;
}

/**
 * Real transitions riding along inside. Reported, not obeyed — a void starting
 * mid-session qualifies what the block suits, it does not end it.
 */
function transitionNotes(c: SessionCandidate, tzOffsetMin: number): string[] {
  const clock = (d: Date) => clockIn(d, tzOffsetMin);
  const out: string[] = [];
  for (const t of c.transitions) {
    if (t.kind === "void-begins") {
      out.push(`The Moon goes void at ${clock(t.at)}. The block still runs — finishing and refining are unaffected; it is beginnings meant to last that thin out.`);
    } else if (t.kind === "moon-ingress") {
      out.push(`The Moon changes sign at ${clock(t.at)} — the texture shifts under you, but the block is still the block.`);
    }
  }
  return out;
}
