// The daily email's "The sky, briefly" block.
//
// Extracted from composeDay so the property that matters can be tested: a
// morning email must not say the same thing it said yesterday. The previous
// version printed `SIGN_GUIDE[moonSign].feel`, a static table entry, so every
// Pisces Moon produced the identical sentence forever — while the composer was
// already calling the synthesis engine and DISCARDING the result.
//
// Which parts of that reading to use was decided by measuring how much each
// one moves over 14 days (unique values / identical-to-yesterday):
//
//   Moon's applying aspect   11 unique   0 repeats   ← the daily signal
//   day-ruler note            7 unique   0 repeats   ← rotates by weekday
//   watch[0]                  7 unique   2 repeats
//   flavour                   6 unique   4 repeats
//   counterpoint              6 unique   4 repeats
//   convergent element        3 unique   8 repeats   ← nearly a constant
//
// Leading with the flavour — the obvious choice, it is the engine's headline
// product — printed one verbatim sentence on 6 of 8 days: the same failure as
// the static blurb, in better prose. So the order below is by how much each
// part actually changes, not by how important it sounds.

export interface ReadingLike {
  flavour?: string;
  counterpoint?: string;
  watch?: { note: string; salience: number }[];
  testimonies?: { note?: string }[];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Up to `max` sentences about today. `max` is 3 — past that the block stops
 * being a footer and starts competing with the reader's own day, which is
 * what the email rewrite cut in the first place.
 */
export function skyLines(reading: ReadingLike | null | undefined, max = 3): string[] {
  const notes = (reading?.testimonies ?? []).map((t) => String(t?.note ?? "")).filter(Boolean);
  const lines: string[] = [];
  const said: string[] = [];

  // Never say the same thing twice in three sentences — the failure that had
  // the void printed verbatim three times in a single email.
  const push = (raw?: string) => {
    const s = (raw ?? "").trim();
    if (!s || lines.length >= max) return;
    const tail = norm(s.split("—").pop() ?? s).slice(0, 28);
    if (tail.length > 8 && said.some((p) => p.includes(tail))) return;
    said.push(norm(s));
    lines.push(`${cap(s)}${/[.!?]$/.test(s) ? "" : "."}`);
  };

  push(notes.find((n) => /^Moon /.test(n)));       // where the Moon is going next
  push(notes.find((n) => /'s day —/.test(n)));     // whose day it is
  push((reading?.watch ?? []).map((w) => w?.note).find(Boolean));
  push(cleanCounterpoint(reading?.counterpoint));

  return lines;
}

/**
 * The counterpoint arrives mid-sentence, with a leading dash and a fixed tail
 * that was otherwise appearing in every single email ever sent.
 */
export function cleanCounterpoint(cp: string | undefined): string {
  return (cp ?? "")
    .replace(/^\s*—\s*though\s+/i, "Though ")
    .replace(/^\s*—\s*/, "")
    .replace(/\s*Hold the day's shape loosely there\.?\s*$/i, "")
    .trim();
}
