// Reading back a saved Planner draft.
//
// Split out of the component because the interesting part is a product rule,
// not plumbing: a saved LIST keeps its value indefinitely, but a saved
// SCHEDULE does not. A weave names specific future moments, so once those have
// passed the proposal describes a sky that has moved on. Restoring it would be
// the one thing this app must never do — present stale timing as current
// (BACKLOG §10, the whole of it).
//
// So the list comes back and the schedule doesn't, and the user is told which.

export interface PlannerDraftShape {
  horizon?: string;
  rawList?: string;
  cards?: unknown[] | null;
  result?: { planned?: { startAt?: string }[] } | null;
  dropped?: number[];
  savedAt?: string;
}

export interface RestoredDraft {
  draft: PlannerDraftShape | null;
  /** True when a schedule was present but dropped for being in the past. */
  staleWeave: boolean;
}

/**
 * `raw` is whatever localStorage held — possibly nothing, possibly corrupt.
 * `nowMs` is passed in so tests compute their own expectation.
 */
export function restorePlannerDraft(raw: string | null, nowMs: number): RestoredDraft {
  if (!raw) return { draft: null, staleWeave: false };

  let parsed: PlannerDraftShape;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // A corrupt draft is not worth crashing the Planner over.
    return { draft: null, staleWeave: false };
  }
  if (!parsed || typeof parsed !== "object") return { draft: null, staleWeave: false };

  const planned = parsed.result?.planned;
  if (!planned?.length) return { draft: { ...parsed, result: parsed.result ?? null }, staleWeave: false };

  // The EARLIEST block decides. If the first thing the plan asks of you has
  // already come and gone, the shape of the day it assumed is wrong — not just
  // that one row.
  const earliest = planned
    .map((p) => (p.startAt ? new Date(p.startAt).getTime() : NaN))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)[0];

  if (earliest !== undefined && earliest < nowMs) {
    return { draft: { ...parsed, result: null }, staleWeave: true };
  }
  return { draft: parsed, staleWeave: false };
}
