/**
 * The week's work, distributed across days.
 *
 * Two surfaces render this: Plan's SCHEDULE room in full, and Home as a compact
 * strip. One component, because the two must never disagree about what the
 * week holds — and because the compact form is genuinely the same answer with
 * less of it, not a different summary computed separately.
 *
 * WHAT IT REFUSES TO LOOK LIKE
 * ---------------------------------------------------------------------------
 * A full calendar. Occupancy is not the goal, so an open day is drawn as an
 * open day and labelled as deliberate — "a good week may hold one major
 * placement and several mostly open days" is the design's own standard, and a
 * grid that renders emptiness as absence would quietly contradict it.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetchJson";

export interface WovenWeek {
  days: {
    date: string;
    key: string;
    light: boolean;
    recovering: boolean;
    woven: {
      placed: { item: { id: string; title: string }; startAt: string; endAt: string; minutes: number; assumedDuration: boolean }[];
      unplaced: { item: { id: string; title: string }; reason: string }[];
      openTime: { startAt: string; endAt: string; minutes: number }[];
    };
  }[];
  unplaced: { item: { id: string; title: string }; reason: string }[];
  warnings: string[];
}

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const dayName = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
};

export function useWeekShape(testerId: string | null, lat: number, lon: number, locationKnown: boolean, enabled: boolean) {
  // Every input the response depends on belongs in the cache identity — `tz`
  // and `locationKnown` rode in the URL but not the key, so a DST transition
  // or a location-permission toggle could serve the stale answer with no
  // refetch. Same rule as Home's lines-up/shape-day queries.
  const tz = new Date().getTimezoneOffset();
  // The IANA zone, alongside the numeric offset — this is the week-scan
  // endpoint, and a seven-day span is the one most likely to actually
  // straddle a DST transition.
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return useQuery<WovenWeek>({
    queryKey: ["shape-week", testerId, lat, lon, tz, zone, locationKnown],
    queryFn: () => fetchJson<WovenWeek>(
      `/api/elections/shape-week?lat=${lat}&lon=${lon}&tz=${tz}&timeZone=${encodeURIComponent(zone)}&locationKnown=${locationKnown}`,
      { headers: testerId ? { "x-tester-id": testerId } : undefined }),
    enabled: !!testerId && enabled,
  });
}

// `WeekStrip` lived here — the compact form of this proposal, rendered on
// Home. It was removed on 2026-08-15 when Home switched to showing the week
// it has actually COMMITTED to (components/WeekCommitted.tsx). The proposal
// answers "where could the loose work go?", which is Plan's question, so
// `WeekWeave` below is now its only form and this file has one consumer.

/** The full weave: every day, its placements, and its open stretches. For Plan. */
export function WeekWeave({ week }: { week: WovenWeek }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {week.warnings.map((w, i) => (
        <div key={i} style={{
          fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.5,
          padding: "8px 12px", borderRadius: 8, background: "var(--color-card-2)",
        }}>{w}</div>
      ))}

      {week.days.map((d) => (
        <div key={d.key} style={{
          border: "1px solid var(--color-border)", borderRadius: 10,
          background: "var(--color-card)", overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "8px 14px 6px" }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{dayName(d.key)}</span>
            <span style={{ fontSize: 10, color: "var(--text-3)" }}>{d.key.slice(5)}</span>
            {d.recovering && (
              <span style={{ fontSize: 10.5, color: "#6f6a90" }} title="the day before carried a major piece of work">
                lighter on purpose
              </span>
            )}
          </div>

          {d.woven.placed.map((p) => (
            <div key={p.item.id} style={{ display: "flex", gap: 10, padding: "5px 14px", borderTop: "1px solid var(--color-border)" }}>
              <span style={{ fontSize: 10.5, color: "var(--color-primary)", fontVariantNumeric: "tabular-nums", flexShrink: 0, minWidth: 86 }}>
                {clock(p.startAt)}–{clock(p.endAt)}
              </span>
              <span style={{ fontSize: 12, flex: 1, minWidth: 0 }}>
                {p.item.title}
                {/* The block is drawn at a length nobody chose — the weaver
                    derives it from the kind of work when a task carries no
                    estimate. Saying "assumed" narrated our bookkeeping; saying
                    it is a guess at a size, and naming who can settle it, is
                    the same fact in the reader's terms. Nothing here is
                    committed: keeping a placement happens in Plan, which asks
                    for a real duration before it will schedule anything. */}
                {p.assumedDuration && (
                  <span style={{ fontSize: 10.5, color: "var(--text-3)" }}> · guessing {p.minutes}m — set a length in Plan</span>
                )}
              </span>
            </div>
          ))}

          {/* An open day is a result. Saying so is the difference between a
              plan with room in it and a scheduler that failed. */}
          {d.light && (
            <div style={{ padding: "4px 14px 10px", fontSize: 11.5, color: "var(--color-muted)" }}>
              Open. Nothing you hold needed placing here.
            </div>
          )}
        </div>
      ))}

      {week.unplaced.length > 0 && (
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: "10px 14px", background: "var(--color-card)" }}>
          <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-3)", marginBottom: 4 }}>
            didn't fit this week
          </div>
          {week.unplaced.map((u, i) => (
            <div key={`${u.item.id}-${i}`} style={{ fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.5 }}>
              {u.item.title} — {u.reason}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
