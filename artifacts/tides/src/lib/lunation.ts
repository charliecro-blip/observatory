/**
 * THE SHAPE OF ONE LUNATION.
 *
 * Fullness had exactly one representation in the app: a 15px disc and the
 * number beside it ("95% lit"). That says what the Moon looks like tonight and
 * nothing about where tonight sits in the month — whether the light is still
 * coming or already going, how long since the cycle opened, how long until it
 * closes ("I wonder if we want another vizualization for the lunar cycle
 * fullness", owner 2026-08-25).
 *
 * DRAWN, NOT FETCHED. Illumination is a function of the Moon's elongation from
 * the Sun and nothing else, so the whole curve follows from one number the
 * client already holds. `/tides/now` carries `moonCycle`, every surface
 * already fetches it, and this costs no request. The alternative was a 45-day
 * /tides/week pull — measured at 4.06s and 122KB — to plot a decoration.
 *
 * The formula is exact rather than a fit. Checked against the server's own
 * moonFraction at elongation 155.79°: 0.9560243 here against 0.9560354 from
 * the ephemeris, agreeing to five decimals. Worth stating because this repo
 * has been bitten three times by a comment asserting an approximation was
 * fine.
 */

/** Mean synodic month, days. */
export const SYNODIC_DAYS = 29.530588853;

/**
 * Illuminated fraction at a position in the cycle, where 0 and 1 are new and
 * 0.5 is full. Positions outside [0,1] wrap, so a caller may sample freely.
 */
export function illuminationAt(position: number): number {
  return (1 - Math.cos(2 * Math.PI * position)) / 2;
}

export interface MoonCycle {
  /** 0 at new, 0.5 at full, approaching 1 at the next new. */
  position: number;
  waxing: boolean;
  phase?: string;
  /** Local date strings from the server. */
  cycleStart?: string;
  nextCycleStart?: string;
}

export interface LunationReading {
  position: number;
  /** Illuminated fraction, 0–1. */
  lit: number;
  /** Whole days since the cycle opened, 1-based for reading ("Day 13"). */
  dayOfCycle: number;
  /** Whole days in the cycle, for "of 30". */
  cycleLength: number;
  /** Days until full. Zero when full is today; never negative. */
  daysToFull: number;
  /** Days until the next new moon. */
  daysToNew: number;
  /**
   * Set when the reader is standing on a turn rather than approaching one.
   *
   * daysToNew only counts forward, so on the morning of a new moon it reads as
   * a whole cycle away and the line offered "full in 15 days" to somebody
   * whose whole day is the new moon. The nearest turn in EITHER direction is
   * the one being lived in.
   */
  atTurn: "new" | "full" | null;
  waxing: boolean;
}

/**
 * The numbers a reader needs to place tonight in the month.
 *
 * Returns null for a missing or unusable cycle rather than defaulting to a
 * position — a drawn arc that silently means "we guessed 0.5" is the kind of
 * fabricated fallback that put a 12-hour polar day on screen once.
 */
export function readLunation(cycle: MoonCycle | undefined | null): LunationReading | null {
  if (!cycle || typeof cycle.position !== "number" || !Number.isFinite(cycle.position)) return null;
  const position = ((cycle.position % 1) + 1) % 1;

  // Distance forward to the next full and the next new. Full sits at 0.5.
  const toFull = position <= 0.5 ? (0.5 - position) : (1.5 - position);
  const toNew  = 1 - position;

  // Nearest turn in either direction, in days. Half a day either side counts
  // as being on it, which is the resolution a date-stamped cycle supports.
  const nearNew  = Math.min(position, 1 - position) * SYNODIC_DAYS;
  const nearFull = Math.abs(position - 0.5) * SYNODIC_DAYS;
  const atTurn = nearNew < 0.5 ? "new" : nearFull < 0.5 ? "full" : null;

  return {
    position,
    lit: illuminationAt(position),
    dayOfCycle: Math.floor(position * SYNODIC_DAYS) + 1,
    cycleLength: Math.round(SYNODIC_DAYS),
    daysToFull: Math.round(toFull * SYNODIC_DAYS),
    daysToNew: Math.round(toNew * SYNODIC_DAYS),
    atTurn,
    waxing: !!cycle.waxing,
  };
}

/**
 * The line under the arc: three facts, no claim about what they mean for you.
 *
 * The nearer turn leads. Before full, the reader is filling toward something
 * and the full moon is the next landmark; after it, the light is going and the
 * new moon is. Saying both every time made the line longer and told nobody
 * anything they were about to use.
 *
 * "today" rather than a count when the turn is inside a day, because "full in
 * 0 days" is how a machine says it.
 */
export function lunationLine(r: LunationReading): string {
  const pct = Math.round(r.lit * 100);
  const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
  const turn =
    r.atTurn === "new"  ? "new moon today"
    : r.atTurn === "full" ? "full today"
    : r.daysToFull <= r.daysToNew ? `full in ${days(r.daysToFull)}`
    : `new moon in ${days(r.daysToNew)}`;
  return `Day ${r.dayOfCycle} of ${r.cycleLength} · ${pct}% lit · ${turn}`;
}
