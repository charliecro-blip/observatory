/**
 * What Compass still needs before it can reserve time — asked at SCHEDULING,
 * never at capture.
 *
 * Capture stays one line with no ceremony; that is settled. But placement
 * genuinely requires a duration, and asking for one when the person opens
 * "Shape today" is not capture friction — it is the minimum information the
 * operation they just requested actually needs.
 *
 * TWO READINESS LEVELS, NOT ONE
 * ---------------------------------------------------------------------------
 *   ready for TIMING     — the activity is known. Compass can say "Tuesday
 *                          afternoon suits this" without reserving anything.
 *   ready for PLACEMENT  — activity AND duration known. Now a block can be held.
 *
 * This is why Home's "What lines up" can stay useful on a list where almost
 * nothing has an estimate, while the day weaver stays honest about what it can
 * actually reserve.
 *
 * TWO UNCERTAINTIES, ASKED SEPARATELY
 * ---------------------------------------------------------------------------
 * "No estimate, and the title does not clearly name a kind of work" folded two
 * different questions into one unanswerable sentence. They are asked apart:
 * what kind of work is this, and how much room should it get. Activity first,
 * because the answer shapes the duration chips.
 *
 * SUGGESTIONS DO NOT COMMIT
 * ---------------------------------------------------------------------------
 * The chips are proposals. Nothing is stored, and no block is reserved, until
 * the person picks one — so a suggested duration can never quietly become the
 * 45-minute block that "Renew the domain" was getting.
 */

import { rankActivities, activityByKey } from "./activityCorrespondences.js";

export interface NeedsActivity {
  id: string;
  title: string;
  /** The readings it is torn between, or the best guesses when it is unsure. */
  options: { key: string; label: string }[];
}

export interface NeedsDuration {
  id: string;
  title: string;
  activityKey: string;
  activityLabel: string;
  /** Minutes. Offered, never assumed. */
  chips: number[];
}

export interface Resolution {
  needsActivity: NeedsActivity[];
  needsDuration: NeedsDuration[];
  /** Ready to place right now. */
  ready: number;
}

/**
 * Duration chips by window type.
 *
 * A span rather than a single default, because activity kind is NOT duration:
 * "send one email", "draft a newsletter" and "write a chapter" all read as
 * Mercury, and no correspondence table can tell them apart. The chips let the
 * person answer in one tap what the engine cannot infer at all.
 */
const CHIPS: Record<string, number[]> = {
  admin: [10, 20, 30, 60],
  planning: [20, 30, 45, 90],
  deep_work: [60, 90, 120, 240],
  creative: [45, 90, 120, 180],
  study: [30, 60, 90, 120],
  social: [60, 90, 120, 180],
  relationship: [30, 60, 90, 120],
  recovery: [20, 30, 45, 90],
  launch: [30, 60, 90, 120],
  retreat: [60, 120, 180, 240],
};
const DEFAULT_CHIPS = [15, 30, 60, 120];

export interface ResolvableItem {
  id: string;
  title: string;
  estMinutes?: number | null;
  activityKey?: string | null;
}

export function needsResolution(items: ResolvableItem[]): Resolution {
  const needsActivity: NeedsActivity[] = [];
  const needsDuration: NeedsDuration[] = [];
  let ready = 0;

  for (const item of items) {
    const known = item.activityKey ? activityByKey(item.activityKey) : null;
    const ranked = known ? [] : rankActivities(item.title, 3);
    const confident = ranked[0] && ranked[0].score >= 2.0 ? ranked[0].activity : null;
    const activity = known ?? confident;

    // An UNCLASSIFIABLE item is still schedulable.
    //
    // Measured on real data: five of eight open tasks matched no activity at
    // all, and four of those had no candidates to offer either — "Reply to
    // Dana", "Renew the domain", "Book the flights". Gating the duration
    // question behind classification meant those items could never become
    // placeable, and the person was shown a question with no answers.
    //
    // They do not need an activity to be placed. Without one they simply get no
    // astrological preference — a practical first-fit slot, which is an honest
    // answer for "renew the domain" and far better than a permanent refusal.
    // So duration is asked for EVERYTHING that lacks it.
    if (item.estMinutes && item.estMinutes > 0) { ready++; }
    else {
      needsDuration.push({
        id: item.id,
        title: item.title,
        activityKey: activity?.key ?? "",
        activityLabel: activity?.label ?? "no particular kind",
        chips: activity ? (CHIPS[activity.windowType] ?? DEFAULT_CHIPS) : DEFAULT_CHIPS,
      });
    }

    // The activity question is asked only where there is a REAL choice to
    // offer. Listing an item with no candidates is a question the person cannot
    // answer, and it makes the engine look like it is stalling rather than
    // admitting it does not recognise the words.
    if (!activity && ranked.length > 0) {
      needsActivity.push({
        id: item.id,
        title: item.title,
        options: ranked.slice(0, 3).map(r => ({ key: r.activity.key, label: r.activity.label })),
      });
    }
  }

  return { needsActivity, needsDuration, ready };
}
