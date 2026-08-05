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

import { computeElections } from "./electionEngine.js";
import { rankActivities, activityByKey } from "./activityCorrespondences.js";
import type { ComputedNatalChart } from "./natal.js";

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
  supportLevel: string;
  suitability: string;
  /** True when the person's own chart contributed testimony. */
  personal: boolean;
  /** The evidence receipt — drawn from the engine, not written here. */
  why: string;
}

export interface Clarification {
  held: HeldItem;
  /** The readings it is genuinely torn between. */
  candidates: { key: string; label: string }[];
}

export type QuietReason =
  | "supported-only"      // nothing convergent, but usable windows exist
  | "nothing-singled-out" // the sky says nothing in particular about these
  | "thin-inventory";     // not enough held to time

export interface LinesUp {
  results: LinesUpResult[];
  clarify: Clarification[];
  quiet: QuietReason | null;
  /** At most one. The full horizon belongs in the Compass, not on Home. */
  nextOpening: { activityLabel: string; date: string; startClock: string } | null;
  /** Held items not priced because of MAX_PRICED. Never silently dropped. */
  notPriced: number;
  chartAvailable: boolean;
}

export interface LinesUpOpts {
  held: HeldItem[];
  lat: number;
  lon: number;
  tzOffsetMin: number;
  natal: ComputedNatalChart | null;
  timeKnown: boolean;
  locationKnown: boolean;
}

const RANK: Record<string, number> = { convergent: 0, supported: 1 };
const SUIT: Record<string, number> = { clear: 0, qualified: 1, defer: 2 };

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
  const { held, lat, lon, tzOffsetMin, natal, timeKnown, locationKnown } = opts;

  // Thin inventory is its own state, not an empty list. A new account has no
  // basis for a computed answer and should be told so directly rather than
  // shown a blank module.
  if (held.length === 0) {
    return { results: [], clarify: [], quiet: "thin-inventory", nextOpening: null, notPriced: 0, chartAvailable: !!natal };
  }

  const clarify: Clarification[] = [];
  const timeable: { item: HeldItem; key: string; label: string; alt?: { key: string; label: string } }[] = [];

  for (const item of held) {
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
        activityKey: key, span: "day", lat, lon, tzOffsetMin, natal, timeKnown, locationKnown,
      }));
    }
    return byActivity.get(key)!;
  };

  for (const t of priced) {
    const out = electFor(t.key);
    if (!out?.windows?.length) continue;
    // Best window for THIS item: strongest support, then cleanest suitability.
    const w = [...out.windows].sort((a: any, b: any) =>
      (RANK[a.supportLevel] ?? 9) - (RANK[b.supportLevel] ?? 9) ||
      (SUIT[a.suitability] ?? 9) - (SUIT[b.suitability] ?? 9) ||
      (b.score ?? 0) - (a.score ?? 0))[0] as any;
    if (!w) continue;
    // "defer" is the engine saying the matter itself is not suited now. It is
    // an honest answer but not a recommendation, so it does not go in the feed.
    if (w.suitability === "defer") continue;
    // A window whose ENTIRE case is "there is a Mercury hour" is not news.
    // The census put `planetary-time` at 99% frequency — it is the one family
    // barred from establishing convergence precisely because it is always
    // there. Headlining it would give every held item a row every day, and a
    // module that says the same thing daily is one people stop reading. This
    // is the floor that keeps "supported" meaning something.
    if (!hasRealTestimony(w)) continue;
    if (w.supportLevel === "supported") sawSupported = true;
    results.push({
      held: t.item, activityKey: t.key, activityLabel: t.label, alternative: t.alt,
      startClock: w.startClock, endClock: w.endClock,
      supportLevel: w.supportLevel, suitability: w.suitability,
      personal: !!w.personal,
      why: typeof w.why === "string" ? w.why : "",
    });
  }

  results.sort((a, b) =>
    (RANK[a.supportLevel] ?? 9) - (RANK[b.supportLevel] ?? 9) ||
    (SUIT[a.suitability] ?? 9) - (SUIT[b.suitability] ?? 9) ||
    Number(b.personal) - Number(a.personal));

  const top = results.slice(0, 3);
  const anyConvergent = top.some(r => r.supportLevel === "convergent");

  // The quiet states are distinct because they mean different things and want
  // different responses from the reader.
  let quiet: QuietReason | null = null;
  if (!top.length) quiet = timeable.length ? "nothing-singled-out" : "thin-inventory";
  else if (!anyConvergent && sawSupported) quiet = "supported-only";

  return {
    results: top,
    clarify: clarify.slice(0, 2),
    quiet,
    nextOpening: quiet ? nextOpeningFor(priced, opts) : null,
    notPriced,
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
function nextOpeningFor(
  priced: { key: string; label: string }[],
  opts: LinesUpOpts,
): LinesUp["nextOpening"] {
  const { lat, lon, tzOffsetMin, natal, timeKnown, locationKnown } = opts;
  let best: { activityLabel: string; date: string; startClock: string } | null = null;
  // DISTINCT activities, not held items. Twelve tasks that all read as deep
  // work would otherwise run the same week-long computation twelve times — the
  // week span is several times the cost of a day, so this was the larger half
  // of the six-second Home load.
  const distinct = [...new Map(priced.map(t => [t.key, t])).values()];
  for (const t of distinct.slice(0, 4)) {   // bounded: this runs on every Home load
    const out = computeElections({
      activityKey: t.key, span: "week", lat, lon, tzOffsetMin, natal, timeKnown, locationKnown,
    });
    const hit = (out?.windows ?? []).find((w: any) => w.supportLevel === "convergent" && w.suitability !== "defer");
    if (!hit) continue;
    if (!best || (hit as any).date < best.date) {
      best = { activityLabel: t.label, date: (hit as any).date, startClock: (hit as any).startClock };
    }
  }
  return best;
}
