/**
 * PACKING OVERLAPPING SPANS INTO PARALLEL LANES.
 *
 * Two things happening at once have to be drawn beside each other. Drawn on top
 * of each other they do not merely look bad — they hide each other, so the
 * picture under-reports the day.
 *
 * Extracted because a second surface needed it. The Almanac's week view packed
 * lanes; the plan's week picture did not, and every block there was laid out
 * full-width at its own start time, so a stacked Tuesday came back as
 * overlapping labels clipped mid-word (owner, 2026-08-31: "the immediate
 * visualization handed back is awful"). Writing the packing a second time is
 * how the two would have drifted into disagreeing about what "overlapping"
 * means.
 */

export interface Span { startMin: number; endMin: number }
export interface Packed<T> { of: T; lane: number; startMin: number; endMin: number }

/**
 * Assign each span the first lane it fits in, and report how many lanes it took.
 *
 * Sorted by start, then by length descending, so a span that CONTAINS others
 * takes the leftmost lane and the ones inside it stack beside it — which reads
 * as nesting rather than as a collision.
 *
 * A lane is free again the moment the previous span in it ends: touching spans
 * (one ending exactly as the next begins) share a lane, because they do not
 * overlap and separating them would invent crowding that is not there.
 */
export function packLanes<T>(spans: Array<Span & { of: T }>): { packed: Packed<T>[]; lanes: number } {
  const sorted = [...spans].sort(
    (a, b) => a.startMin - b.startMin || (b.endMin - b.startMin) - (a.endMin - a.startMin),
  );
  const laneEnds: number[] = [];
  const packed: Packed<T>[] = sorted.map(s => {
    let lane = laneEnds.findIndex(end => end <= s.startMin);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(s.endMin); }
    else laneEnds[lane] = s.endMin;
    return { of: s.of, lane, startMin: s.startMin, endMin: s.endMin };
  });
  return { packed, lanes: Math.max(1, laneEnds.length) };
}
