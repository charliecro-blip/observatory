import type { Availability, TimingSearchResult } from "./timingSearch.js";
import { createHash } from "node:crypto";

import type {
  ActivityAssessment,
  ElectionWindow,
  SuitabilityReason,
} from "./electionEngine.js";
import type { SessionCandidate } from "./longSession.js";
type CandidateBase = {
  start: string;
  end: string;
  broad: boolean;
  suitability: "clear" | "qualified" | "defer";
  explanation: string;
  availability: Availability;
  shortfall: boolean;
};
export type TimingCandidate = CandidateBase &
  (
    | {
        kind: "ordinary";
        reasons: SuitabilityReason[];
        evidence: ElectionWindow;
      }
    | {
        kind: "comparison";
        reasons: SuitabilityReason[];
        evidence: ActivityAssessment;
      }
    | {
        kind: "session";
        reasons: string[];
        evidence: SessionCandidate & { tradeoff: string };
      }
  );
export interface TimingResponse {
  result: TimingSearchResult;
  candidates: (TimingCandidate & { id: string })[];
}

/** A JSON-safe projection; both views consume these same candidates. */
export function presentTiming(result: TimingSearchResult): TimingResponse {
  if (!("days" in result)) return { result, candidates: [] };
  const candidates = result.days
    .flatMap<TimingCandidate>((day) => {
      if (day.kind === "error") return [];
      if (day.kind === "comparison")
        return [
          {
            kind: "comparison",
            start: day.start,
            end: day.end,
            broad: day.broad,
            suitability: day.result.suitability,
            reasons: day.result.suitabilityReasons,
            evidence: day.result,
            availability: day.availability,
            shortfall: false,
            explanation:
              day.result.backgroundFit === "aligned"
                ? "The Moon’s sign matches this activity during this interval."
                : day.result.backgroundFit === "contrary"
                  ? "The Moon’s sign differs from this activity’s usual preference."
                  : "The Moon’s sign adds no preference for this activity during this interval.",
          },
        ];
      if (day.kind === "ordinary")
        return day.result.windows.map((w, i) => ({
          kind: "ordinary" as const,
          start: w.startAt,
          end: w.endAt,
          broad: !!w.allDay,
          suitability: w.suitability,
          explanation: w.evidence?.[0]?.text ?? w.why,
          reasons: w.suitabilityReasons,
          evidence: w,
          availability: day.availability[i],
          shortfall: false,
        }));
      return [
        ...day.result.options.map((o) => ({
          candidate: o.candidate,
          tradeoff: o.kind,
          shortfall: false,
        })),
        ...(day.result.shortfall?.candidate
          ? [
              {
                candidate: day.result.shortfall.candidate,
                tradeoff: "shortfall" as const,
                shortfall: true,
              },
            ]
          : []),
      ].map(({ candidate: c, tradeoff, shortfall }, i) => ({
        kind: "session" as const,
        start: c.startAt.toISOString(),
        end: c.endAt.toISOString(),
        broad: false,
        suitability: c.suitability,
        // Describe the proposed interval without promoting fallback support.
        explanation:
          c.backgroundFit === "aligned"
            ? "The Moon’s sign matches this activity during this session."
            : c.anchor
              ? `This session includes ${c.anchor.label}.`
              : "This interval fits your requested duration; the reading does not identify a particular lunar advantage.",
        reasons: c.suitabilityReasons,
        evidence: { ...c, tradeoff },
        availability: shortfall
          ? day.shortfallAvailability!
          : day.availability[i],
        shortfall,
      }));
    })
    .map((c) => ({
      ...c,
      id: createHash("sha256")
        .update(
          JSON.stringify({
            kind: c.kind,
            start: c.start,
            end: c.end,
            evidence: c.evidence,
          }),
        )
        .digest("hex"),
    }));
  return { result, candidates };
}
