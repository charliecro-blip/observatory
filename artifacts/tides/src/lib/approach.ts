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
    early:   ["get light on your face", "decide what today is actually for", "set the one intention that matters"],
    morning: ["make the decision as yourself", "lead the meeting", "put your name on it", "ask for the thing directly"],
    midday:  ["be seen — present or publish", "take the credit that's yours", "back someone in public", "make the call you've been putting off"],
    evening: ["say the thing you meant to say", "let something you made be seen", "give someone your whole attention", "mark a finished thing"],
    winddown:["name one thing that went right", "put the day down on purpose", "thank someone in particular"],
    night:   ["let it keep until morning"],
  },
  Moon: {
    early:   ["notice the mood you woke in", "eat something properly", "move slowly on purpose"],
    morning: ["tend the house and the body", "call your people", "put the place back in order", "cook ahead"],
    midday:  ["cook for someone", "check in with someone who'd like it", "tend the thing you've let slide", "ask how someone actually is"],
    evening: ["water — bathe or swim", "make the room comfortable", "eat with people", "put something away properly"],
    winddown:["nap without earning it", "write the mood down", "let the day settle", "make the room soft"],
    night:   ["rest — this is the hour for it", "let the feeling pass without a verdict"],
  },
  Mercury: {
    early:   ["sort the day before it starts", "write the list", "clear the desk first", "read one thing properly"],
    morning: ["write it and send it", "learn the thing", "draft the hard message", "ask the question you've been guessing at"],
    midday:  ["run the errands", "settle the detail", "put the two options side by side on paper", "teach it to someone and find the gap", "phone rather than email"],
    evening: ["fix the wording", "reply to what's outstanding", "read back what you wrote this morning", "name tomorrow's first sentence"],
    winddown:["tidy the inbox, then stop", "note tomorrow's first task", "close the open loops in writing"],
    night:   ["read something undemanding", "stop deciding — write it down instead"],
  },
  Venus: {
    early:   ["make the morning pleasant on purpose", "choose what you actually like"],
    morning: ["make the space nicer", "take the pleasing option", "offer the small peace", "put care into how it looks"],
    midday:  ["mend a connection", "tend a friendship", "buy the thing that lasts, not the cheap one", "make it look the way it should"],
    evening: ["enjoy something on purpose", "share a meal", "say the fond thing out loud", "make a plan with someone"],
    winddown:["something soft — music, a bath, company", "let it be enough", "put beauty in the room you'll wake in"],
    night:   ["comfort over effort"],
  },
  Mars: {
    early:   ["train hard", "do the brave errand first", "take the hardest task while you're fresh"],
    morning: ["train hard", "make the cut", "start the thing you keep circling", "say the plain no"],
    midday:  ["have the direct conversation", "compete at something", "force the stuck item through", "do the physical job"],
    // Mars after dark is still Mars — decisive, sharp — but pointed at
    // finishing and clearing rather than at exertion before bed.
    evening: ["have the conversation you've dodged", "finish by force if you must", "throw something out", "settle it rather than sleep on it"],
    winddown:["cut one thing loose", "decisive tidying, then stop", "write the boundary you'll hold tomorrow"],
    night:   ["let the edge keep until morning", "spend it walking, not arguing"],
  },
  Jupiter: {
    early:   ["zoom out to the larger story", "ask what this is in service of"],
    morning: ["apply, send, put it out", "say yes a size bigger", "make the introduction", "aim one notch past comfortable"],
    midday:  ["teach what you know", "plan the bigger version", "make the generous offer", "back someone else's bigger idea"],
    evening: ["be generous first", "make the bigger ask", "widen the plan before you narrow it", "feed people"],
    winddown:["read something that widens the frame", "let the plan stay big and unwritten", "be glad about one thing on purpose"],
    night:   ["dream it larger; write it tomorrow"],
  },
  Saturn: {
    early:   ["do the dull groundwork while it's quiet", "start the thing that needs a long runway"],
    morning: ["keep the promise", "build the part no one sees", "do the unglamorous hour first", "commit only to what you can deliver"],
    midday:  ["pay the debt", "prune and cancel", "fix it properly rather than again", "put the structure under it"],
    evening: ["look at the long game", "close the loop", "decline something to protect the rest", "check the work against the standard"],
    // Saturn is not only "stop". It is the boring thing, the slow thing, the
    // still thing, the thing done properly rather than quickly.
    winddown:["put one thing in order, slowly", "the dull task, done properly", "set the boundary and keep it", "end on time, on purpose"],
    night:   ["stillness counts as the work", "one slow, small thing — or nothing"],
  },
};

/**
 * Void-of-course forms. The Moon makes no further aspects before changing
 * sign, and the tradition's whole counsel is: finish, don't begin. So these
 * are deliberately re-verbs — nothing here starts anything.
 */
// NOT ALL OF LIFE IS WORK, and a void is not an instruction to do admin.
//
// Each planet had two entries and both were office verbs, so a void hour
// read as "clear the backlog" whatever the hour's character actually was —
// jarring under a Mercury in Leo that had just been described as speaking
// with conviction (owner, 2026-08-13: "the Mercury bit seems discordant …
// they also should not just be solely work-focused"). Every planet now
// carries a wider range — the body, people, home, rest — while every entry
// still obeys the one hard rule: nothing here begins anything.
export const VOC_FORMS: Record<string, string[]> = {
  Sun:     ["revisit what you already put your name to", "read it once more before it goes out",
            "sit in the sun with something you've already made", "tell someone about a thing you finished"],
  Moon:    ["rest, tidy, tend what's already yours", "return to something that comforts",
            "cook a dish you know by heart", "call the person you always mean to call"],
  Mercury: ["revise and re-send", "clear the backlog, open nothing new",
            "re-read the book you keep meaning to finish", "go back over a conversation and say the clearer version",
            "put the notes in order — no new threads"],
  Venus:   ["get back to someone you've meant to", "re-make something you already love",
            "return to a record you haven't played in years", "tidy the room you actually sit in"],
  Mars:    ["finish what's already moving", "clear the decks, open no front",
            "walk a route you know", "put the body through something familiar"],
  // All four of these used to open on a "re-" verb — revise, re-read, return,
  // retell — which read as one idea spelled four ways (owner, 2026-08-14: "the
  // jupiter themes are all about re- verbs"). The void still means returning
  // rather than launching; only the verbs vary now.
  Jupiter: ["go back to the bigger plan and revise it", "sit with something you meant to learn",
            "spend an hour somewhere that widened you once", "tell the story to someone who wasn't there"],
  Saturn:  ["close out an old obligation", "repair rather than rebuild",
            "return to a practice you let lapse", "rest without earning it first"],
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
