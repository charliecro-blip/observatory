// The approach layer — same quality, different way in.
//
// `PLANET_ACTIVITIES` is a flat planet → verbs map with no awareness of the
// hour, the Moon's sign, the aspects in play, or the user's own rhythm. So a
// Mars hour proposed "train hard" at 21:20, a hundred minutes before a stated
// 23:00 bedtime. The planet was right; the approach was absurd.
//
// The reframe (MULTIPLICITY-REFRAME-2026-08-02.md) is that Compass matches the
// qualities of a moment to ways of GOING ABOUT things, rather than ranking how
// much energy is on offer. That makes this the load-bearing vocabulary: the
// same Mars can mean a hard workout at 9am, the conversation you've been
// avoiding at 6pm, and cutting something loose at 10pm. One quality, three
// approaches, chosen by condition.
//
// Rules encoded here, in priority order:
//   1. VOC       — finishing, returning, revising. Never "begin", "launch".
//   2. Wind-down — inside the last stretch before sleep: nothing high-arousal
//                  or newly-begun; the quality's quiet form instead.
//   3. Day part  — morning / midday / evening registers.
// The Moon's sign then colours the phrasing without changing the suggestion.

export type DayPart = "early" | "morning" | "midday" | "evening" | "winddown" | "night";

export interface ApproachContext {
  planet: string;
  /** The moment being described — usually the start of the planetary hour. */
  at: Date;
  /** The user's own rhythm, "HH:MM". Absent → conservative daytime defaults. */
  wakeTime?: string | null;
  sleepTime?: string | null;
  /** Moon void of course over this window. */
  voc?: boolean;
  /** Moon's sign, for register only — never changes WHICH approach is picked. */
  moonSign?: string | null;
}

export interface Approach {
  /** The suggestion itself — a way of going about something. */
  text: string;
  /** Which rule chose it, so the UI can explain and tests can assert. */
  basis: "voc" | "winddown" | "daypart";
  part: DayPart;
}

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m ?? 0);
};
const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * Where this moment sits in the user's OWN day, not the wall clock's. A night
 * owl's "evening" is after midnight; anchoring to 18:00 would hand them the
 * wind-down vocabulary while they are still mid-afternoon by their own body.
 */
export function dayPartFor(at: Date, wakeTime?: string | null, sleepTime?: string | null): DayPart {
  const mins = at.getHours() * 60 + at.getMinutes();
  if (!wakeTime || !sleepTime) {
    // No rhythm on record: conservative wall-clock bands. The small hours are
    // "night" regardless, which is what keeps a 3am suggestion from ever
    // reading as an ordinary afternoon one.
    if (mins < 4 * 60) return "night";
    if (mins < 9 * 60) return "early";
    if (mins < 12 * 60) return "morning";
    if (mins < 17 * 60) return "midday";
    if (mins < 21 * 60) return "evening";
    return "winddown";
  }
  const wake = toMin(wakeTime), sleep = toMin(sleepTime);
  const awake = mod(sleep - wake, 1440) || 1440;
  const since = mod(mins - wake, 1440);
  if (since >= awake) return "night";               // asleep by their own hours
  const frac = since / awake;
  // The last TWO HOURS before sleep are wind-down, however long the day is (a
  // fraction alone would give a short sleeper an implausibly long evening).
  // Two hours rather than one: the reported case was a workout proposed at
  // 21:20 against a 23:00 bedtime — 100 minutes out, and still plainly wrong.
  // Vigorous exertion inside roughly this window is also what actually costs
  // people sleep, so the line is defensible rather than arbitrary.
  if (awake - since <= 120) return "winddown";
  if (frac < 0.12) return "early";
  if (frac < 0.35) return "morning";
  if (frac < 0.72) return "midday";
  return "evening";
}

/** Approaches for each planetary voice, by when in the day it lands. */
const BY_PART: Record<string, Partial<Record<DayPart, string[]>>> = {
  Sun: {
    early:   ["set the day's one intention", "get light on your face"],
    morning: ["make the decision as yourself", "lead the meeting"],
    midday:  ["be seen — present, publish", "claim credit honestly"],
    evening: ["say the thing you meant to say", "let something you made be seen"],
    winddown:["name one thing that went right", "put the day down deliberately"],
    night:   ["let it keep until morning"],
  },
  Moon: {
    early:   ["notice what mood you woke in", "eat something properly"],
    morning: ["tend home & body", "call your people"],
    midday:  ["cook for someone", "check in with someone who'd like it"],
    evening: ["water rituals — bathe, swim", "make the room comfortable"],
    winddown:["nap without guilt", "journal the mood", "let the day settle"],
    night:   ["rest — this is the hour for it"],
  },
  Mercury: {
    early:   ["sort the day before it starts", "write the list"],
    morning: ["write & send", "learn the skill"],
    midday:  ["run the errands", "negotiate the detail"],
    evening: ["fix the words", "reply to what's outstanding"],
    winddown:["tidy the inbox and stop", "note tomorrow's first task"],
    night:   ["read something undemanding"],
  },
  Venus: {
    early:   ["make the morning pleasant on purpose"],
    morning: ["beautify the space", "choose the pleasing option"],
    midday:  ["reconcile & connect", "tend love & friendship"],
    evening: ["enjoy something on purpose", "share a meal"],
    winddown:["something soft — music, a bath, company", "let it be enough"],
    night:   ["comfort over effort"],
  },
  Mars: {
    early:   ["train hard", "do the brave errand first"],
    morning: ["train hard", "make the cut"],
    midday:  ["have the direct conversation", "compete at something"],
    // Mars after dark is still Mars — decisive, sharp — but pointed at
    // finishing and clearing rather than at exertion before bed.
    evening: ["have the conversation you've been avoiding", "finish by force if needed"],
    winddown:["cut one thing loose", "decisive tidying, then stop"],
    night:   ["let the edge go until morning"],
  },
  Jupiter: {
    early:   ["zoom out to the larger story"],
    morning: ["apply & publish", "say yes bigger"],
    midday:  ["teach what you know", "plan the expansion"],
    evening: ["be generous first", "make the bigger ask"],
    winddown:["read something that widens the frame", "let the plan be big and unwritten"],
    night:   ["dream it larger; write it tomorrow"],
  },
  Saturn: {
    early:   ["do the boring foundation while it's quiet"],
    morning: ["keep the commitment", "build the part no one sees"],
    midday:  ["pay the debt", "prune & cancel"],
    evening: ["review the long game", "close the loop"],
    // Saturn is not only "stop". It is the boring thing, the slow thing, the
    // still thing, the thing done properly rather than quickly — several of
    // which are perfectly available late. A single absolute instruction was
    // both incomplete and easy to disagree with.
    winddown:["put one thing in order, slowly", "the unglamorous task, done properly", "set the boundary and keep it"],
    night:   ["stillness counts as the work", "one slow, small thing — or nothing"],
  },
};

/**
 * Void-of-course forms. The Moon makes no further aspects before changing
 * sign, and the tradition's whole counsel is: finish, don't begin. So these
 * are deliberately re-verbs — nothing here starts anything.
 */
const VOC_FORMS: Record<string, string[]> = {
  Sun:     ["revisit what you already put your name to", "re-read it before it goes out"],
  Moon:    ["rest, tidy, tend what's already yours", "return to something comforting"],
  Mercury: ["revise & re-send", "clear the backlog, start nothing new"],
  Venus:   ["return to someone you've been meaning to", "re-make something you already love"],
  Mars:    ["finish what's already in motion", "clear the decks, don't open a front"],
  Jupiter: ["return to the bigger plan and revise it", "re-read what you meant to learn"],
  Saturn:  ["close out an old obligation", "repair rather than rebuild"],
};

/** Stable rotation without randomness — same conditions give the same answer,
 *  which is what lets a user check the app twice and not feel gaslit. */
function pick(list: string[], at: Date): string {
  if (list.length === 1) return list[0];
  return list[(at.getHours() + at.getDate()) % list.length];
}

/**
 * EVERY approach available under these conditions, best first.
 *
 * A strong instruction ("stillness counts as the work") should be answerable
 * with "or?" — the owner's point that a confident statement needs alternatives
 * beside it. Note this is not the rotating-takes failure the audit flagged: the
 * DEFAULT is stable for given conditions, and the user advances it only by
 * asking. Stability by default, alternatives on request.
 */
export function approachOptions(ctx: ApproachContext): string[] {
  const part = dayPartFor(ctx.at, ctx.wakeTime, ctx.sleepTime);
  if (ctx.voc) {
    const voc = VOC_FORMS[ctx.planet];
    if (voc?.length) return voc;
  }
  const table = BY_PART[ctx.planet];
  if (!table) return [];
  return table[part] ?? table.midday ?? table.morning ?? [];
}

export function suggestApproach(ctx: ApproachContext): Approach | null {
  const part = dayPartFor(ctx.at, ctx.wakeTime, ctx.sleepTime);

  // 1. VOC wins outright. It is the most specific thing known about the
  //    window, and it forbids exactly the verbs the day-part lists are full of.
  if (ctx.voc) {
    const voc = VOC_FORMS[ctx.planet];
    if (voc?.length) return { text: pick(voc, ctx.at), basis: "voc", part };
  }

  const table = BY_PART[ctx.planet];
  if (!table) return null;
  const list = table[part];
  if (list?.length) {
    return { text: pick(list, ctx.at), basis: part === "winddown" || part === "night" ? "winddown" : "daypart", part };
  }
  // Fall back toward the middle of the day rather than to a random entry, so a
  // missing band never resurrects a high-arousal suggestion at midnight.
  const fallback = table.midday ?? table.morning;
  return fallback?.length ? { text: pick(fallback, ctx.at), basis: "daypart", part } : null;
}
