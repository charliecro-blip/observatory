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

/** The convergence green, matching Home's `CONVERGENT`. Hex, so alpha suffixes work. */
const PLACED = "#3f7a4a";

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const dayName = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
};

export function useWeekShape(testerId: string | null, lat: number, lon: number, locationKnown: boolean, enabled: boolean) {
  return useQuery<WovenWeek>({
    queryKey: ["shape-week", testerId, lat, lon],
    queryFn: () => fetchJson<WovenWeek>(
      `/api/elections/shape-week?lat=${lat}&lon=${lon}&tz=${new Date().getTimezoneOffset()}&locationKnown=${locationKnown}`,
      { headers: testerId ? { "x-tester-id": testerId } : undefined }),
    enabled: !!testerId && enabled,
  });
}

/**
 * The week, as an answer rather than a chart.
 *
 * The first version drew seven bars: one black rectangle and six near-invisible
 * lines. A reader could not tell whether the dark one meant booked, active,
 * pressured, current, selected or unavailable — and a row of unlabelled slots
 * does not earn a card. It also buried the one genuinely useful fact ("6 of 7
 * days open") under decoration.
 *
 * Now it names the days, names what is placed on them, and states the shape in
 * a sentence. White space is still the output; it is just legible as deliberate
 * openness rather than as something that failed to render.
 */
export function WeekStrip({ week, onOpen }: { week: WovenWeek; onOpen?: () => void }) {
  const placedDays = week.days.filter(d => d.woven.placed.length);
  const openDays = week.days.filter(d => d.light);
  const blocks = placedDays.reduce((n, d) => n + d.woven.placed.length, 0);
  const todayKey = week.days[0]?.key;

  return (
    <div style={{ padding: "0 16px 12px" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${week.days.length}, 1fr)`, gap: 3 }}>
        {week.days.map((d) => {
          const first = d.woven.placed[0];
          const isToday = d.key === todayKey;
          return (
            <div key={d.key} style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 9, fontWeight: isToday ? 700 : 500,
                color: isToday ? "var(--color-foreground)" : "var(--text-3)",
              }}>{dayName(d.key)}</div>
              {/* A bar that means one thing: minutes of placed work. An open day
                  gets a visible floor rather than nothing, because nothing and
                  missing look identical. */}
              {/* An open day is DRAWN, not left blank — a dashed cell reads as
                  "nothing here on purpose", where an absence reads as a
                  rendering failure. Occupancy is not the target, so the empty
                  state has to look deliberate. */}
              {/* A placed day is tinted with the convergence green rather than
                  outlined in ink: at this size a 1px border reads as a box,
                  and a fill reads as a day with something in it. The dashed
                  cell beside it stays empty on purpose — the two states have to
                  be distinguishable at a glance, from across a room. */}
              {/* Tinted with the convergence green rather than outlined in ink:
                  at this size a 1px border reads as a box, and a fill reads as
                  a day with something in it.

                  The tint is the green at low ALPHA, not an opaque pale green.
                  A fixed light fill is only light against a light card — in
                  dark mode it becomes a glowing block, which is how a quiet
                  accent turns into the loudest thing on the page. Translucent
                  means the card underneath decides the value in both themes. */}
              <div style={{
                height: 26, marginTop: 3, borderRadius: 5,
                border: first ? `1px solid ${PLACED}55` : "1px dashed var(--color-border)",
                background: first ? `${PLACED}1e` : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {first && (
                  <span style={{ fontSize: 8.5, fontWeight: 600, color: PLACED }}>
                    {clock(first.startAt).replace(/:00/, "").replace(/\s?(AM|PM)/, "")}
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 8.5, marginTop: 3, color: "var(--text-3)", textAlign: "center",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {first ? "" : "open"}
              </div>
              {first && (
                <div style={{
                  fontSize: 8.5, color: "var(--color-muted)", lineHeight: 1.25, marginTop: 1,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{first.item.title}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* The sentence the bars were failing to say. */}
      <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.5 }}>
        {blocks === 0
          ? "Nothing placed yet this week."
          : `${blocks} ${blocks === 1 ? "block" : "blocks"} placed · ${openDays.length} ${openDays.length === 1 ? "day" : "days"} deliberately open`}
      </div>

      {onOpen && (
        <button onClick={onOpen} style={{
          fontSize: 10.5, background: "none", border: "none", padding: 0, marginTop: 6,
          cursor: "pointer", color: "var(--color-primary)",
        }}>See the week →</button>
      )}
    </div>
  );
}

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
              <span style={{ fontSize: 9, color: "#6f6a90" }} title="the day before carried a major piece of work">
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
                {p.assumedDuration && <span style={{ fontSize: 9, color: "var(--text-3)" }}> · {p.minutes}m assumed</span>}
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
          <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-3)", marginBottom: 4 }}>
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
