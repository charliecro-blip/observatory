/**
 * WHAT A STARSWELL LOG ENTRY IS ALLOWED TO BE.
 *
 * The /today page lets a person mark a card "did it", "noticed it" or "not for
 * me". Until now that lived only in the browser that tapped it. These rules
 * are what the server accepts when the page saves a mark to the person's
 * Compass account (their tester id), kept apart from the route so they can be
 * tested without a database, the same split as feedbackContext.
 *
 * A key is `<local date>|<hour start ms>|<card>`, as the page builds it. The
 * value is one of three marks, or null to take a mark back. The server keeps
 * every write and answers with the latest per key, so a mark undone on the
 * phone is undone on the laptop too.
 */

export const LOG_VALUES = ["did", "noticed", "skip"] as const;
export type LogValue = (typeof LOG_VALUES)[number];

export const KEY_MAX = 120;
/** date | hour start | card id, where the card id is letters, digits and dashes. */
const KEY_SHAPE = /^\d{2}\/\d{2}\/\d{4}\|\d{10,14}\|[a-z][a-z0-9-]{0,60}$/i;

export function cleanEntry(body: unknown): { key: string; value: LogValue | null } | null {
  if (!body || typeof body !== "object") return null;
  const { key, value } = body as { key?: unknown; value?: unknown };
  if (typeof key !== "string" || key.length > KEY_MAX || !KEY_SHAPE.test(key)) return null;
  if (value === null) return { key, value: null };
  if (typeof value !== "string" || !(LOG_VALUES as readonly string[]).includes(value)) return null;
  return { key, value: value as LogValue };
}

/** Rows oldest first in, latest mark per key out; a null takes the key away. */
export function latestMarks(rows: { props: Record<string, unknown> | null }[]): Record<string, LogValue> {
  const out: Record<string, LogValue> = {};
  for (const r of rows) {
    const e = cleanEntry(r.props);
    if (!e) continue;
    if (e.value === null) delete out[e.key];
    else out[e.key] = e.value;
  }
  return out;
}
