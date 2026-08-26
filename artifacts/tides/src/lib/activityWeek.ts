/**
 * TIME FRAMES, NOT SINGLE MOMENTS.
 *
 * "The Week For" drew each window as its start clock and threw the end away,
 * so a five-hour Friday and a sixty-seven-minute one were the same small chip
 * ("I think we might see time frames for these activities, not just single
 * moments. it's a function that needs more space." — owner, 2026-08-25).
 *
 * The spans were always in the payload. What was missing was room to draw
 * them, which is why the layout went from seven columns to seven rows: a
 * column sixty pixels wide cannot hold "8:44 AM – 1:44 PM", and it cannot hold
 * a bar whose length means anything either.
 *
 * The windows OVERLAP — a real Friday reads 8:44–1:44 with 10:50–11:57 and
 * 11:57–1:03 sitting inside it — so they need lanes. Drawing them on one line
 * would hide the short ones underneath the long one and quietly under-report
 * the week.
 */

export interface Span { startClock: string; endClock: string; allDay?: boolean }

/**
 * "6 AM" / "6:24 AM" / "12:30 PM" to minutes after midnight, or null.
 *
 * Null rather than 0 for anything unparseable: a window silently drawn at
 * midnight is worse than a window not drawn, because it looks like a fact.
 */
export function parseClock(s: string | undefined | null): number | null {
  if (!s) return null;
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*([AaPp])\.?[Mm]\.?\s*$/.exec(s);
  if (m) {
    let h = Number(m[1]);
    const min = m[2] ? Number(m[2]) : 0;
    if (h < 1 || h > 12 || min > 59) return null;
    const pm = m[3].toLowerCase() === "p";
    if (h === 12) h = 0;
    return (h + (pm ? 12 : 0)) * 60 + min;
  }
  // 24-hour, for a caller running with that preference.
  const m24 = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(s);
  if (m24) {
    const h = Number(m24[1]), min = Number(m24[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  }
  return null;
}

export interface Placed<T> { win: T; lane: number; startMin: number; endMin: number; }

/**
 * Minutes for a window, clipped to the civil day it is drawn on.
 *
 * A window that ends at or before it starts has run past midnight, so it is
 * drawn to the end of the day rather than backwards — the next day's row owns
 * the remainder.
 */
export function minutesOf(w: Span): { startMin: number; endMin: number } | null {
  const startMin = parseClock(w.startClock);
  if (startMin === null) return null;
  const raw = parseClock(w.endClock);
  const endMin = raw === null || raw <= startMin ? 24 * 60 : raw;
  return { startMin, endMin };
}

/**
 * Assign each window the first lane it fits in, so nothing is drawn on top of
 * anything else. Sorted by start, then by length descending, so the containing
 * window takes the top lane and the ones inside it stack beneath — which reads
 * as nesting rather than as a collision.
 *
 * Windows that cannot be parsed are dropped rather than placed at a guessed
 * time, and the caller can see the count fall.
 */
export function layoutLanes<T extends Span>(wins: T[]): { placed: Placed<T>[]; lanes: number } {
  const sized = wins
    .map(win => { const m = minutesOf(win); return m ? { win, ...m } : null; })
    .filter((x): x is { win: T; startMin: number; endMin: number } => x !== null)
    .sort((a, b) => a.startMin - b.startMin || (b.endMin - b.startMin) - (a.endMin - a.startMin));

  const laneEnds: number[] = [];
  const placed: Placed<T>[] = sized.map(s => {
    let lane = laneEnds.findIndex(end => end <= s.startMin);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(s.endMin); }
    else laneEnds[lane] = s.endMin;
    return { ...s, lane };
  });
  return { placed, lanes: Math.max(1, laneEnds.length) };
}

/**
 * "6:24 – 7:31 AM" when both ends share a meridiem, "8:44 AM – 1:44 PM" when
 * they do not. Repeating AM twice in one span is noise, and the whole point of
 * this change is that the span has to fit somewhere it can be read.
 */
export function spanLabel(startClock: string, endClock: string): string {
  const a = /([AaPp])\.?[Mm]\.?\s*$/.exec(startClock ?? "");
  const b = /([AaPp])\.?[Mm]\.?\s*$/.exec(endClock ?? "");
  if (a && b && a[1].toLowerCase() === b[1].toLowerCase()) {
    return `${startClock.replace(/\s*[AaPp]\.?[Mm]\.?\s*$/, "")}–${endClock}`;
  }
  return `${startClock}–${endClock}`;
}

/** How long the window runs, in plain words. Empty when it cannot be read. */
export function durationLabel(w: Span): string {
  const m = minutesOf(w);
  if (!m) return "";
  const mins = m.endMin - m.startMin;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), rest = mins % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}
