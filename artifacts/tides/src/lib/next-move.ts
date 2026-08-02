// "Strongest fit right now" — the one thing to do next, and why.
//
// Named for exactly what it computes. It is NOT "best": Compass picks from the
// tasks it has been told about, and cannot see what you're already mid-way
// through, how much capacity you have today, what's blocked, or who else is
// waiting. Claiming a global optimum over facts it doesn't hold is how a
// useful recommendation turns into one the user learns to distrust.
//
// This is the app's whole promise reduced to a single line: you already know
// what your work is; Compass says which piece of it this hour actually suits.
// It is DELIBERATELY deterministic — no LLM, no scoring soup. A recommendation
// the user can't reconstruct from the reading above it is a recommendation they
// can't trust, and this one has to be trustworthy: acting on it is the beta's
// activation event (STRATEGY-CONVERSATION 2026-08-01, beta pass §5).
//
// The rules, in strict priority order, are in `pickNextMove` below. Every
// branch produces a `why` that names the sky fact it used, so the claim is
// always checkable against the rail two inches away.

export interface NextMoveTask {
  id: number;
  title: string;
  /** Auto-diagnosed ruling planet — what drives its timing. */
  planet?: string | null;
  /** Element of the Guiding Star it hangs from, when it hangs from one. */
  element?: string | null;
  estMinutes?: number | null;
}

export interface NextMoveStar {
  id: number;
  title: string;
  planet?: string | null;
  element?: string | null;
}

export interface NextMoveInput {
  /** Current planetary hour; `began`/`ends` are local "HH:MM" strings. */
  currentHour?: { planet: string; began: string; ends: string } | null;
  /** The hours after this one, soonest first. */
  upcomingHours?: { planet: string; time: string }[];
  /** Open tasks only — the caller filters out anything already done. */
  tasks: NextMoveTask[];
  stars: NextMoveStar[];
  /** The day's synthesised element, as the hero names it. */
  dayElement?: string | null;
  /** Moon void of course — a caveat on beginnings, never a veto on doing. */
  voc?: boolean;
  /** Injected so the caller (and tests) control "now" rather than the clock. */
  now: Date;
}

export interface NextMove {
  kind: "task" | "star" | "empty";
  title: string;
  /** The sky fact this pick rests on, in plain words. */
  why: string;
  /** How long the supporting window lasts, or when it opens. */
  when: string;
  /** Present when the Moon is void — an honest qualifier, not a refusal. */
  caveat?: string;
  taskId?: number;
  starId?: number;
}

/** "14:32" on the same local day as `ref`. Rolls to tomorrow when the clock
 *  wraps past midnight, so the last planetary hour of the night doesn't come
 *  back as a negative remainder. */
function atClock(hhmm: string, ref: Date): Date | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return null;
  const d = new Date(ref);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

/** Minutes from `now` until the local clock time `hhmm`, wrapping past
 *  midnight. Null when the string isn't a time. */
export function minutesUntil(hhmm: string, now: Date): number | null {
  const target = atClock(hhmm, now);
  if (!target) return null;
  let diff = (target.getTime() - now.getTime()) / 60000;
  // More than half a day behind means the clock wrapped — it's tomorrow.
  if (diff < -720) diff += 1440;
  return Math.round(diff);
}

function humanMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** "38 min left in the Jupiter hour" — the honest shape of the window. */
function hourRemaining(input: NextMoveInput): string {
  const { currentHour, now } = input;
  if (!currentHour) return "";
  const left = minutesUntil(currentHour.ends, now);
  if (left == null || left <= 0) return `in the ${currentHour.planet} hour`;
  return `${humanMinutes(left)} left in the ${currentHour.planet} hour`;
}

export function pickNextMove(input: NextMoveInput): NextMove {
  const { currentHour, upcomingHours = [], tasks, stars, dayElement, voc, now } = input;
  const caveat = voc
    ? "The Moon is void of course — fine for finishing and refining, thin for starting something you want to last."
    : undefined;

  // 1. This hour's ruler IS what an open task runs on. The strongest claim the
  //    app can make, and the one a user can check against the rail.
  if (currentHour) {
    const match = tasks.find(t => t.planet && t.planet === currentHour.planet);
    if (match) {
      return {
        kind: "task", taskId: match.id, title: match.title, caveat,
        why: `This hour runs on ${currentHour.planet}, and so does this — the timing is already right.`,
        when: hourRemaining(input),
      };
    }
  }

  // 2. Same claim for a Guiding Star with no task under it yet: the hour suits
  //    the direction, so the move is to give the direction a piece of itself.
  if (currentHour) {
    const star = stars.find(s => s.planet && s.planet === currentHour.planet);
    if (star) {
      return {
        kind: "star", starId: star.id, title: star.title, caveat,
        why: `This hour runs on ${currentHour.planet} — the planet ${star.title} is timed to. Nothing of it is on today's list; put one piece of it here.`,
        when: hourRemaining(input),
      };
    }
  }

  // 3. Nothing fits NOW, but something fits soon — say when rather than
  //    inventing a reason to act this minute. Two hours out at most; past that
  //    it stops being a next move.
  for (const h of upcomingHours.slice(0, 2)) {
    const match = tasks.find(t => t.planet && t.planet === h.planet);
    if (match) {
      const mins = minutesUntil(h.time, now);
      return {
        kind: "task", taskId: match.id, title: match.title, caveat,
        why: `The ${h.planet} hour is what this needs, and it opens at ${h.time}.`,
        when: mins != null && mins > 0 ? `in ${humanMinutes(mins)}` : `at ${h.time}`,
      };
    }
  }

  // 4. No hour match at all — fall back to the day's own current. Weaker, and
  //    the wording says so.
  if (dayElement) {
    const match = tasks.find(t => t.element && t.element === dayElement);
    if (match) {
      return {
        kind: "task", taskId: match.id, title: match.title, caveat,
        why: `No hour singles anything out, but today's current is ${dayElement} — and so is this.`,
        when: hourRemaining(input),
      };
    }
  }

  // 5. There's work but the sky is neutral about it. Say that plainly instead
  //    of dressing up the first item as destiny.
  if (tasks.length > 0) {
    const first = tasks[0];
    return {
      kind: "task", taskId: first.id, title: first.title, caveat,
      why: "Nothing in the sky singles this out — it's simply next, and the hour is as good as any.",
      when: hourRemaining(input),
    };
  }

  // 6. Nothing to pick from. The move is to give the day something.
  const star = stars[0];
  return {
    kind: "empty", caveat,
    title: star ? `One piece of “${star.title}”` : "Name one thing for today",
    why: star
      ? "Nothing is on today's list. The next move is to put one piece of a Guiding Star on it."
      : "Nothing is on today's list yet — and with nothing to place, the sky has nothing to time.",
    when: hourRemaining(input),
  };
}
