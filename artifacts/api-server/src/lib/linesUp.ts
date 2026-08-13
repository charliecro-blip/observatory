/**
 * "What lines up" — timing computed for what the person is ALREADY holding.
 *
 * Home used to show a timing engine and eight open tasks side by side with no
 * way for either to know the other existed. The join was left to the user:
 * read a task, hold it in your head, scroll up, find it again in a category
 * tree. This module performs that join, which is the product's actual claim.
 *
 * THE SOURCE OF CONTENT IS THE INVENTORY, AND ONLY THE INVENTORY.
 * ---------------------------------------------------------------------------
 * Tasks, Guiding Star steps, pinned recurring activities. A globally strong
 * Venus window with no relationship to anything this person holds must never
 * enter this feed — that is the horoscope-generator failure the product exists
 * to refuse. "Global" is allowed to mean *this timing is established without
 * needing your birth chart*; it is never allowed to mean *here is an
 * astrologically interesting activity you never said you cared about*.
 *
 * CONVERGENCE IS THE RARE LABEL, NOT THE CONTENT SOURCE.
 * ---------------------------------------------------------------------------
 * Leading with "today's convergences" would force one of two bad outcomes: a
 * usually-blank module, or a definition of convergence quietly widened until
 * there is enough to show. So the module leads with RELEVANT TIMING and lets
 * `convergent` stay an earned tier inside it. A merely supported window is
 * still useful, and Home's everyday value must not depend on a rare event.
 *
 * AMBIGUITY IS OUTPUT.
 * ---------------------------------------------------------------------------
 * "Prepare keynote" could be drafting, designing, rehearsing or presenting.
 * Silently timing the first guess manufactures false confidence in exactly the
 * place the product should be most careful. An ambiguous item becomes a
 * question instead of a recommendation, which is often the more valuable row.
 */

import { computeElections, type Evidence, type SuitabilityReason } from "./electionEngine.js";
import { rankActivities, activityByKey } from "./activityCorrespondences.js";
import type { ComputedNatalChart } from "./natal.js";

/**
 * Why the engine deferred, in words, from the structured reasons it recorded.
 *
 * Derived rather than written, so a refusal can never state a cause the engine
 * did not actually find. If the reason list is empty the phrase says only that
 * the day was judged unsuitable — which is the honest floor, and better than
 * inventing a plausible-sounding planet.
 */
function deferPhrase(reasons: SuitabilityReason[] | undefined): string {
  const named = (reasons ?? []).map(r =>
    `${r.kind.replace(/-/g, " ")}${(r as { planet?: string }).planet ? ` (${(r as { planet?: string }).planet})` : ""}`);
  return named.length
    ? `better deferred — ${named.join(", ")}`
    : "better deferred today";
}

/** Above this, the top match is trustworthy enough to time. */
const CONFIDENT_SCORE = 2.0;
/**
 * A runner-up is only a RIVAL if it is plausible on its own terms.
 *
 * Measured: "Finish the Q3 positioning memo and circulate it…" scores
 * "Finish & ship the last 10%" at 2.25 — the right answer — with
 * "Meditate / pray" second at 1.38 on incidental keyword overlap. A pure
 * margin rule turned a correct match into the question *"Finish & ship, or
 * meditate?"*, which is worse than either timing it or saying nothing: it
 * makes the engine look like it cannot read.
 *
 * So ask only when two readings are BOTH credible and close.
 */
const RIVAL_SCORE = 2.0;
/** …and within this of each other. */
const DECISIVE_MARGIN = 1.0;

/**
 * How many held items get priced. Each one is a full election computation, so
 * this is a real cost, not a display limit — and the caller is told what was
 * dropped rather than being handed a silently truncated list.
 */
const MAX_PRICED = 12;

export interface HeldItem {
  id: string;
  title: string;
  /** Where it came from, so the UI can say so and link back. */
  kind: "task" | "star-step" | "pinned";
  /**
   * Set when this item already has a reserved block.
   *
   * Without it, Compass offered to find a time for work the person had already
   * committed to — the column has existed and been backfilled for days, and
   * nothing read it. An item that is already placed does not need timing; it
   * needs to be left alone.
   */
  scheduledFor?: string | null;
  /**
   * When this was started, if it was. The one fact a stateless engine cannot
   * derive from the sky.
   *
   * Flow protection used to live only in Today's own card, computed on the
   * client from a separate query — so Home's hero would cheerfully propose
   * switching you off work already underway while Today, two taps away, said
   * "keep going". Two answers to one question. The engine owns it now; both
   * surfaces read the same one.
   */
  startedAt?: string | null;
  /**
   * An activity already assigned to this item — Guiding Stars carry one from
   * the planet-diagnosis flow, and tasks can be corrected by hand.
   *
   * When present it is USED, not re-derived. Re-matching the title would throw
   * away a classification the person has already seen and can already correct,
   * and would let the keyword matcher silently overrule them.
   */
  activityKey?: string | null;
}

export interface LinesUpResult {
  held: HeldItem;
  activityKey: string;
  activityLabel: string;
  /** The runner-up, so the UI can offer a one-tap correction. */
  alternative?: { key: string; label: string };
  startClock: string;
  endClock: string;
  /** Instants, so the client can say where this sits relative to now. */
  startAt: string;
  endAt: string;
  /**
   * Where the window sits relative to NOW.
   *
   * A window is not one piece of information — "9:14 PM" read at 7am is a plan
   * and read at 9:20pm is an instruction, and the page was showing both the
   * same way. It also let a window that had already closed lead the page, which
   * is worse than saying nothing.
   */
  state: "open-now" | "ahead" | "passed";
  /**
   * True when the testimony holds for the whole day rather than naming an hour
   * — the Moon's sign, say. Rendered as "all day", never as a clock range: a
   * standing condition printed as "7 AM–11 PM" claims a precision it does not
   * have, and this module's job is to answer WHEN.
   */
  allDay: boolean;
  supportLevel: string;
  suitability: string;
  /** True when the person's own chart contributed testimony. */
  personal: boolean;
  /** The evidence receipt — drawn from the engine, not written here. */
  why: string;
  /** The same testimonies, one per line and carrying their family. */
  evidence: Evidence[];
  /** The engine's own absence claim. See `ElectionWindow.noObjections`. */
  noObjections: boolean;
}

export interface Clarification {
  held: HeldItem;
  /** The readings it is genuinely torn between. */
  candidates: { key: string; label: string }[];
}

export type QuietReason =
  | "supported-only"      // nothing convergent, but usable windows exist
  | "nothing-singled-out" // the sky says nothing in particular about these
  | "all-placed"          // everything held already has a block — nothing left to time
  | "thin-inventory";     // nothing held at all

/**
 * THE LOOP — one act, and the one after it.
 *
 * A window is not an instruction. "Finish the album · 12:45–5:45" tells you
 * when something is possible; it does not tell you what to do with the next
 * five minutes, which is the question people actually open the app holding
 * (owner, 2026-08-13: "what should I do right now — that's the central,
 * main feature").
 *
 * So the engine names the act, and names what follows it, and says plainly
 * when you are already inside something and should not be moved off it. The
 * surfaces render this; they no longer each decide it.
 */
export interface Loop {
  /** What to do with this moment. */
  now: {
    /** The held item's title — the thing itself, not a category. */
    title: string;
    /** The held item's id, so a surface can act on it. */
    heldId: string;
    /** Why now: the plain sentence, already composed. */
    why: string;
    /** When this window closes, local clock, when it has an end. */
    until: string | null;
    /** True when this is work already underway rather than a fresh pick. */
    inFlow: boolean;
    /** Minutes elapsed, when inFlow. */
    elapsedMin?: number;
  } | null;
  /** What comes after — named so the moment has a horizon, never an order. */
  then: { title: string; heldId: string; startClock: string } | null;
}

export interface LinesUp {
  results: LinesUpResult[];
  clarify: Clarification[];
  quiet: QuietReason | null;
  /** The one-act loop, composed from the same results the list shows. */
  loop: Loop;
  /** At most one. The full horizon belongs in the Compass, not on Home. */
  nextOpening: { activityLabel: string; date: string; startClock: string } | null;
  /** Held items that already hold a block, so they were not timed. */
  alreadyScheduled: HeldItem[];
  /**
   * Items the engine timed and then WITHHELD, each with the reason.
   *
   * These were four bare `continue`s. Every one is a defensible editorial
   * judgment — a deferred matter is not a recommendation, an hour-only case is
   * not news — but the item then vanished from the surface entirely, and a task
   * showing no timing line is indistinguishable from a task Compass never
   * looked at. That is precisely the confusion the whole module is built to
   * prevent, reappearing one level down.
   *
   * The house rule is that gaps and refusals are output, with reasons, never
   * silent drops. A refusal that carries its reason is often the more useful
   * row: "no window today" is an answer.
   */
  heldBack: { item: HeldItem; reason: string }[];
  /** Held items not priced because of MAX_PRICED. Never silently dropped. */
  notPriced: number;
  /**
   * How many election computations this call actually ran.
   *
   * Elections are memoised per ACTIVITY, so ten tasks that all read as deep
   * work cost one run rather than ten — the difference between a six-second
   * Home load and a fast one. Reporting it makes that property directly
   * observable instead of inferable from a stopwatch, which is what a test in a
   * parallel suite cannot measure reliably.
   */
  electionsComputed: number;
  chartAvailable: boolean;
}

export interface LinesUpOpts {
  held: HeldItem[];
  lat: number;
  lon: number;
  tzOffsetMin: number;
  /** The viewer's IANA zone. Optional; corrects the day boundary on the rare
   *  day it's actually a DST transition — `tzOffsetMin` alone is a snapshot. */
  timeZone?: string;
  natal: ComputedNatalChart | null;
  timeKnown: boolean;
  locationKnown: boolean;
}

const RANK: Record<string, number> = { convergent: 0, supported: 1 };
const SUIT: Record<string, number> = { clear: 0, qualified: 1, defer: 2 };

/** The subset of an ElectionWindow the picker actually looks at. */
export interface PickableWindow {
  startAt: string; endAt: string; allDay?: boolean;
  supportLevel: string; suitability: string; score?: number;
}

/**
 * The one item this list of windows will surface: ACTIONABLE before strong.
 *
 * Extracted to a pure function so the ordering can be tested against
 * constructed windows rather than the live sky. The bug this exists to
 * prevent is specifically about TIME — "does a passed window ever beat an
 * actionable one" — and the real ephemeris changes what it answers every
 * time the suite runs, which is exactly the wrong foundation for a test
 * whose entire claim is about temporal ordering.
 *
 * Actionability used to be decided AFTER the pick — the sort ran on
 * supportLevel/suitability/score alone, and only once a window was chosen
 * did anything ask whether it had already happened. So a convergent window
 * that closed at noon could beat a merely-supported window still open this
 * evening, and the noon window — unusable — is what the item carried onto
 * the page. An item is only allowed to surface a passed window when EVERY
 * window it has is passed, and even then only because saying so plainly is
 * more honest than the item vanishing.
 */
/**
 * Does this task belong in a WEAVE at all?
 *
 * `shape-day` and `shape-week` build their item list straight from the tasks
 * table and never checked `planningWindowId` — the exact field `linesUp`
 * already reads to keep an already-scheduled task out of its own feed
 * (`alreadyScheduled`). So a task with a reserved block could still be handed
 * to the weaver and placed a SECOND time, displacing or duplicating the slot
 * it already holds. `done` was already excluded here; this is the same
 * exclusion for "already placed", pulled out as a pure predicate so both
 * routes share one answer and it can be tested without a database.
 */
export function needsWeaving(t: { done: string | null; planningWindowId: number | null | undefined }): boolean {
  return t.done !== "true" && t.planningWindowId == null;
}

export function pickBestWindow<T extends PickableWindow>(windows: T[], nowMs: number): T | undefined {
  const isPassed = (x: T) => !x.allDay && nowMs >= Date.parse(x.endAt);
  return [...windows].sort((a, b) =>
    (isPassed(a) ? 1 : 0) - (isPassed(b) ? 1 : 0) ||
    (RANK[a.supportLevel] ?? 9) - (RANK[b.supportLevel] ?? 9) ||
    (SUIT[a.suitability] ?? 9) - (SUIT[b.suitability] ?? 9) ||
    // A BOUNDED window beats an all-day one at equal strength. Both are real
    // testimony, but only one of them answers the question — "the Moon is in
    // Taurus, which suits finishing" is true from 7 AM to 11 PM and tells you
    // nothing about which hour to pick.
    (a.allDay ? 1 : 0) - (b.allDay ? 1 : 0) ||
    (b.score ?? 0) - (a.score ?? 0))[0];
}

/**
 * Is there anything here beyond the ever-present planetary hour?
 *
 * Mirrors the engine's own convergence contract one tier down: convergence
 * needs establishing families, and a headline needs at least something that
 * is not the family which fires almost every hour of every day.
 */
function hasRealTestimony(w: { establishingFamilies?: string[]; reinforcingFamilies?: string[]; families?: string[] }): boolean {
  if ((w.establishingFamilies ?? []).length > 0) return true;
  return (w.families ?? []).some(f => f !== "planetary-time");
}

export function linesUp(opts: LinesUpOpts): LinesUp {
  const { held, lat, lon, tzOffsetMin, timeZone, natal, timeKnown, locationKnown } = opts;

  // Thin inventory is its own state, not an empty list. A new account has no
  // basis for a computed answer and should be told so directly rather than
  // shown a blank module.
  if (held.length === 0) {
    return { results: [], clarify: [], alreadyScheduled: [], heldBack: [], quiet: "thin-inventory", loop: { now: null, then: null }, nextOpening: null, notPriced: 0, electionsComputed: 0, chartAvailable: !!natal };
  }

  const clarify: Clarification[] = [];
  const alreadyScheduled: HeldItem[] = [];
  const heldBack: { item: HeldItem; reason: string }[] = [];
  const timeable: { item: HeldItem; key: string; label: string; alt?: { key: string; label: string } }[] = [];

  for (const item of held) {
    // Already placed → not a timing question. Reported so the UI can say
    // "already scheduled at 3:00 PM" rather than offering a window for it.
    if (item.scheduledFor) { alreadyScheduled.push(item); continue; }
    if (item.activityKey) {
      const known = activityByKey(item.activityKey);
      if (known) { timeable.push({ item, key: known.key, label: known.label }); continue; }
      // An assigned key that no longer exists is stale, not authoritative —
      // fall through and match, rather than dropping the item silently.
    }
    const ranked = rankActivities(item.title, 3);
    if (!ranked.length) continue;                     // nothing to say; not an error
    const [best, runner] = ranked;
    if (best.score < CONFIDENT_SCORE) continue;   // nothing credible; stay silent
    const contested = !!runner && runner.score >= RIVAL_SCORE &&
      best.score - runner.score < DECISIVE_MARGIN;
    if (contested) {
      // Two readings the engine genuinely cannot choose between. Asking is the
      // honest move and often the more valuable row — it improves the person's
      // activity palette instead of manufacturing confidence.
      clarify.push({
        held: item,
        candidates: [best, runner].map(r => ({ key: r.activity.key, label: r.activity.label })),
      });
      continue;
    }
    timeable.push({
      item, key: best.activity.key, label: best.activity.label,
      alt: runner ? { key: runner.activity.key, label: runner.activity.label } : undefined,
    });
  }

  const priced = timeable.slice(0, MAX_PRICED);
  const notPriced = timeable.length - priced.length;

  const results: LinesUpResult[] = [];
  let sawSupported = false;

  // Memoised per activity, not per held item. The election for an activity on
  // a given day is the same computation no matter which task asked for it, and
  // people hold several tasks that read as the same activity — ten "deep work"
  // items were costing ten full ephemeris runs. Measured at ~600ms each, so a
  // Home load with ten open tasks took six seconds before this.
  const byActivity = new Map<string, ReturnType<typeof computeElections>>();
  const electFor = (key: string) => {
    if (!byActivity.has(key)) {
      byActivity.set(key, computeElections({
        activityKey: key, span: "day", lat, lon, tzOffsetMin, timeZone, natal, timeKnown, locationKnown,
      }));
    }
    return byActivity.get(key)!;
  };

  for (const t of priced) {
    const out = electFor(t.key);
    if (!out?.windows?.length) { heldBack.push({ item: t.item, reason: "no window today" }); continue; }
    // Best window for THIS item. See `pickBestWindow` — actionable before
    // strong, so a passed convergent window can no longer beat a merely
    // supported window still open this evening.
    const w = pickBestWindow(out.windows, Date.now()) as any;
    if (!w) { heldBack.push({ item: t.item, reason: "no window today" }); continue; }
    // "defer" is the engine saying the matter itself is not suited now. It is
    // an honest answer but not a recommendation, so it stays out of the feed —
    // but it is REPORTED, because "today is not the day, and here is why" is
    // more use than the row disappearing.
    if (w.suitability === "defer") {
      heldBack.push({ item: t.item, reason: deferPhrase(w.suitabilityReasons) });
      continue;
    }
    // A window whose ENTIRE case is "there is a Mercury hour" is not news.
    // The census put `planetary-time` at 99% frequency — it is the one family
    // barred from establishing convergence precisely because it is always
    // there. Headlining it would give every held item a row every day, and a
    // module that says the same thing daily is one people stop reading. This
    // is the floor that keeps "supported" meaning something.
    if (!hasRealTestimony(w)) {
      heldBack.push({ item: t.item, reason: "only a planetary hour today — not enough to single it out" });
      continue;
    }
    if (w.supportLevel === "supported") sawSupported = true;
    const startMs = Date.parse(w.startAt);
    const endMs = Date.parse(w.endAt);
    const nowMs = Date.now();
    const state: LinesUpResult["state"] =
      w.allDay ? "open-now"
      : nowMs >= startMs && nowMs < endMs ? "open-now"
      : nowMs < startMs ? "ahead"
      : "passed";
    results.push({
      held: t.item, activityKey: t.key, activityLabel: t.label, alternative: t.alt,
      startClock: w.startClock, endClock: w.endClock, allDay: !!w.allDay,
      startAt: w.startAt, endAt: w.endAt, state,
      supportLevel: w.supportLevel, suitability: w.suitability,
      personal: !!w.personal,
      why: typeof w.why === "string" ? w.why : "",
      // The fallback keeps the family honest rather than convenient: a window
      // that predates structured evidence gets `unattributed`, not a guessed
      // family. A wrong label on a testimony is worse than an unlabelled one.
      evidence: Array.isArray(w.evidence) ? w.evidence
        : (typeof w.why === "string" && w.why ? [{ family: "unattributed", text: w.why }] : []),
      noObjections: w.noObjections === true,
    });
  }

  // THE MOMENT ORDERS BEFORE THE STRENGTH.
  //
  // A convergent window that closed at noon is not the answer to "what should I
  // do now" at four o'clock, however strong it was — and it was leading the
  // page. Open now first, then what is still ahead, then what has passed; only
  // within a group does support level decide.
  const WHEN: Record<LinesUpResult["state"], number> = { "open-now": 0, ahead: 1, passed: 2 };
  results.sort((a, b) =>
    WHEN[a.state] - WHEN[b.state] ||
    (RANK[a.supportLevel] ?? 9) - (RANK[b.supportLevel] ?? 9) ||
    (SUIT[a.suitability] ?? 9) - (SUIT[b.suitability] ?? 9) ||
    Number(b.personal) - Number(a.personal) ||
    Date.parse(a.startAt) - Date.parse(b.startAt));

  const top = results.slice(0, 3);
  const anyConvergent = top.some(r => r.supportLevel === "convergent");

  // The quiet states are distinct because they mean different things and want
  // different responses from the reader.
  let quiet: QuietReason | null = null;
  if (!top.length) {
    // "NOTHING TO TIME" IS NOT "NOTHING ON YOUR LIST".
    //
    // `timeable` excludes everything already holding a block, so a person
    // whose whole list was woven onto the calendar hit the thin-inventory
    // branch and Home told them "Compass times the things on your list.
    // There's nothing on it yet" — with the list sitting one panel below,
    // fully scheduled (owner, 2026-08-13). Those are opposite facts, and
    // the cold-start doors it opens are the wrong offer entirely.
    //
    // Thin inventory now means what it says: nothing held at all. Holding
    // work that is already placed is its own state.
    quiet = timeable.length ? "nothing-singled-out"
      : (alreadyScheduled.length || clarify.length || heldBack.length) ? "all-placed"
      : "thin-inventory";
  }
  else if (!anyConvergent && sawSupported) quiet = "supported-only";

  return {
    results: top,
    clarify: clarify.slice(0, 2),
    alreadyScheduled,
    heldBack,
    quiet,
    loop: composeLoop(top, held, opts),
    nextOpening: quiet ? nextOpeningFor(priced, opts) : null,
    notPriced,
    electionsComputed: byActivity.size,
    chartAvailable: !!natal,
  };
}

/**
 * The next convergent window among THEIR activities, looking forward.
 *
 * Exactly one, and only in a quiet state. It gives the absence temporal shape —
 * the engine is working and today's quiet is a result rather than missing data.
 * More than one and Home becomes a week forecast, which is the Compass's job.
 */
/**
 * How long a start stamp keeps counting, in minutes.
 *
 * Ported deliberately, not re-invented: the same two hours the client used,
 * for the same reasons (longer than a planetary hour so a sitting is never
 * cut off mid-way, short enough that a forgotten stamp expires within the
 * same part of the day). Erring short is correct — failing to say "keep
 * going" costs a nudge, while wrongly insisting you are mid-flow contradicts
 * what the reader can plainly see.
 */
const IN_PROGRESS_CEILING_MIN = 120;

const sameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** The held item currently underway, or null. Most recent start wins. */
function inFlowItem(held: HeldItem[], at: Date): { item: HeldItem; minutes: number } | null {
  let best: { item: HeldItem; minutes: number } | null = null;
  for (const item of held) {
    if (!item.startedAt) continue;
    const began = new Date(item.startedAt);
    if (Number.isNaN(began.getTime())) continue;
    const minutes = Math.floor((at.getTime() - began.getTime()) / 60000);
    if (minutes < 0 || minutes > IN_PROGRESS_CEILING_MIN) continue;
    if (!sameLocalDay(began, at)) continue;
    if (!best || minutes < best.minutes) best = { item, minutes };
  }
  return best;
}

/**
 * Compose the loop from results already computed — never a second judgment.
 *
 * Flow protection OVERRIDES the sky on purpose. A better-fitting hour is not
 * a reason to interrupt someone mid-task: the cost of the switch is real and
 * immediate, the gain marginal and speculative.
 */
function composeLoop(top: LinesUpResult[], held: HeldItem[], opts: LinesUpOpts): Loop {
  const now = new Date();
  const running = inFlowItem(held, now);

  if (running) {
    return {
      now: {
        title: running.item.title,
        heldId: running.item.id,
        why: "You're already in this. Compass won't move you off it — finish, or stop on purpose.",
        until: null,
        inFlow: true,
        elapsedMin: running.minutes,
      },
      // Nothing is offered as "next" while someone is inside something: a
      // queue shown mid-task is a second thing to think about, which is the
      // interruption this branch exists to prevent.
      then: null,
    };
  }

  const open = top.find(r => r.state === "open-now") ?? top.find(r => r.state === "ahead") ?? null;
  if (!open) return { now: null, then: null };

  // Different IDENTITY is not enough — two held items can carry the same
  // words (a star and the task named after it, or a duplicate star), and
  // "now: Finish the album / then: Finish the album" reads as a bug even
  // though both rows are real. The loop's job is to name two different
  // things, so it compares what the reader actually sees.
  const sameThing = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const after = top.find(r =>
    r !== open && r.state !== "passed" && !sameThing(r.held.title, open.held.title)) ?? null;
  return {
    now: {
      title: open.held.title,
      heldId: open.held.id,
      why: open.supportLevel === "convergent"
        ? "Several things line up for this right now."
        : open.personal
          ? "This suits the hour, and your chart agrees."
          : "This is what the hour suits.",
      until: open.state === "open-now" ? open.endClock ?? null : open.startClock ?? null,
      inFlow: false,
    },
    then: after ? { title: after.held.title, heldId: after.held.id, startClock: after.startClock ?? "" } : null,
  };
}

function nextOpeningFor(
  priced: { key: string; label: string }[],
  opts: LinesUpOpts,
): LinesUp["nextOpening"] {
  const { lat, lon, tzOffsetMin, timeZone, natal, timeKnown, locationKnown } = opts;
  let best: { activityLabel: string; date: string; startClock: string } | null = null;
  // DISTINCT activities, not held items. Twelve tasks that all read as deep
  // work would otherwise run the same week-long computation twelve times — the
  // week span is several times the cost of a day, so this was the larger half
  // of the six-second Home load.
  const distinct = [...new Map(priced.map(t => [t.key, t])).values()];
  for (const t of distinct.slice(0, 4)) {   // bounded: this runs on every Home load
    const out = computeElections({
      activityKey: t.key, span: "week", lat, lon, tzOffsetMin, timeZone, natal, timeKnown, locationKnown,
    });
    const hit = (out?.windows ?? []).find((w: any) => w.supportLevel === "convergent" && w.suitability !== "defer");
    if (!hit) continue;
    if (!best || (hit as any).date < best.date) {
      best = { activityLabel: t.label, date: (hit as any).date, startClock: (hit as any).startClock };
    }
  }
  return best;
}
