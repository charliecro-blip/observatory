/**
 * THE ONE BOX'S ROUTING RULE (plan Part A, Phase 3), shared by the client's
 * box and by Ask on the server, so the two cannot disagree about what counts
 * as a question or as asking WHEN. Deliberately dependency-free: the client
 * bundles this file.
 */

/** Asks WHEN: the words that make a question a timing question. */
export const ASKS_WHEN = /\b(?:when|what time|best time|good time|right time|good day|best day|which day|what day|elect|election|schedule|timing|times? for|should i\b.*\b(?:today|tonight|tomorrow|this|next|weekend|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i;

/** A question in the ordinary sense: it ends with "?" or opens like one. */
export function isQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /\?$/.test(t) || /^(?:why|what|how|should|is|are|am|can|could|do|does|did|will|would|which|who|where|tell me|help me|explain)\b/.test(t);
}

/** The interpreter's own default when no time was named. */
export const DEFAULT_HORIZON_NOTE = "Looking from now through the next seven calendar days.";

/**
 * Whether the box should answer with Ask rather than a search: a question,
 * unless the interpreter found an activity AND the words ask about time (a
 * "when", a named day or span, or a span long enough for a report).
 */
export function routeToAsk(text: string, interp: { state: string; assumptions?: string[]; report?: unknown }): boolean {
  if (!isQuestion(text)) return false;
  if (interp.state !== "resolved") return true;
  const namedTime = !!interp.report || !(interp.assumptions ?? []).includes(DEFAULT_HORIZON_NOTE);
  return !(namedTime || ASKS_WHEN.test(text));
}
