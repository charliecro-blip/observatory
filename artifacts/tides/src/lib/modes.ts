// Four zones, three temporal modes.
//
// Ritual and review were extra CARDS stacked above the dashboard, so a morning
// check-in meant reading the ritual block and then reading the same day again
// underneath it. The spec's correction: the time of day should change the MODE
// of the four zones, not add a fifth thing to look at.
//
//   Mode      READ                MOVE                       YOUR DAY
//   morning   morning conditions  choose the first move      already committed
//   ordinary  (the default)       strongest fit right now    what today holds
//   evening   how the day moved   finish, release, or carry  done & unfinished
//
// This file holds only the FRAMING — the labels and the one sentence each zone
// leads with. The data underneath is the same in every mode, which is the
// point: the day does not change because you looked at it after dinner, only
// the question worth asking about it does.
//
// The mode comes from lib/chronotype's ritualPhase, so it follows the user's
// own hours rather than the wall clock. A night owl's "evening" is after
// midnight, and framing their 1am as a morning would be worse than not
// reframing at all.

export type DayMode = "morning" | "ordinary" | "evening";

export interface ZoneFraming {
  /** Zone 2's eyebrow — what the recommendation is FOR at this hour. */
  moveLabel: string;
  /** Zone 3's title. */
  dayLabel: string;
  /** Zone 3's empty state — an empty morning and an empty evening differ. */
  dayEmpty: string;
  /** Zone 4's eyebrow. Prospective in every mode; only the horizon shifts. */
  aheadLabel: string;
}

const FRAMING: Record<DayMode, ZoneFraming> = {
  morning: {
    moveLabel: "Where to start",
    dayLabel: "Already committed",
    dayEmpty: "Nothing committed yet — the day is open.",
    aheadLabel: "Shape of the day",
  },
  ordinary: {
    moveLabel: "Strongest fit right now",
    dayLabel: "Your day",
    dayEmpty: "Nothing on today — weave your day in Plan →",
    aheadLabel: "Ahead",
  },
  evening: {
    // Not "what to start". By evening the useful question is what to do with
    // what already exists — and "carry" is offered as a real option rather
    // than a failure, because deciding to continue tomorrow is a decision.
    moveLabel: "Finish, release, or carry",
    dayLabel: "How the day went",
    dayEmpty: "Nothing was on today.",
    aheadLabel: "Tomorrow's first shift",
  },
};

export function framingFor(mode: DayMode): ZoneFraming {
  return FRAMING[mode];
}

/** `ritualPhase` returns null for the long middle of the day; that is `ordinary`. */
export function modeFrom(phase: "morning" | "evening" | null | undefined): DayMode {
  return phase ?? "ordinary";
}
