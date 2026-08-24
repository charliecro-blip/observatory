/**
 * WHAT A PIECE OF FEEDBACK IS ALLOWED TO CARRY.
 *
 * Separated from the route because it is the part worth testing and the route
 * cannot be imported without a database — a contract nobody can exercise is a
 * contract that drifts.
 */

/** The five doors. Anything else is a client bug, not a new category. */
export const KINDS = ["confusing", "wrong", "broken", "delightful", "idea"] as const;
export type Kind = (typeof KINDS)[number];

/**
 * Every context key the server will keep, and the reason this is an ALLOWLIST
 * rather than a passthrough: a client that grows a habit of attaching more
 * state cannot quietly start posting a journal line or a birth chart into an
 * analytics table. Anything new has to be added here on purpose.
 */
export const CONTEXT_KEYS = [
  "view",             // which page they were on
  "surface",          // the specific component, when the caller knows it
  "viewport",         // "1280x900" — layout bugs are usually size-shaped
  "rhythm",           // campaign | route | field | read
  "astroDetail",      // how much astrology they had asked to see
  "build",            // bundle/commit identifier, when the client has one
  "recommendationId", // what the engine had claimed, for "wrong"
] as const;

export const NOTE_MAX = 1000;
const VALUE_MAX = 200;

export function cleanContext(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const k of CONTEXT_KEYS) {
    const v = src[k];
    if (v == null) continue;
    // Stringified and capped: context is for reading in a list, not a payload.
    const s = String(v).slice(0, VALUE_MAX);
    if (s) out[k] = s;
  }
  return out;
}

export const isKind = (k: unknown): k is Kind =>
  typeof k === "string" && (KINDS as readonly string[]).includes(k);
