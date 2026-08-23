// THE WEEK YOU HAVE ACTUALLY COMMITTED TO.
//
// Home's strip used to render `shape-week`, which is a PROPOSAL: it collects
// work where `planningWindowId == null` — that is, work not yet placed — and
// distributes it across the days. Useful, but it answers "where could the
// loose things go?", and Home asks "how am I doing, and what's coming?".
//
// The two came apart at exactly the wrong moment. Weave a week in and every
// task gains a `planningWindowId`, so all of them drop out of the proposal at
// once, and the card went blank the instant the week filled up: seven days
// drawn as empty, under the sentence "Nothing placed yet this week." The
// better someone used Plan, the emptier Home claimed their week was (owner,
// 2026-08-15: "it looks like I've already woven things in").
//
// This reads the committed windows instead, from the same endpoint and on the
// same query key as `AlreadyWoven` in Plan, so the two surfaces cannot
// disagree about what is on the week.
//
// WHY NO DAY SAYS "open". The old strip labelled every unproposed day open,
// which is a claim about a day this card is not in a position to make: it
// reads Compass placements and knows nothing about the calendar underneath
// them. A day with nothing woven into it may be full of meetings. Empty cells
// are drawn empty and the summary counts them as "with nothing placed", which
// is the fact actually in hand.

import { useQuery } from "@tanstack/react-query";
import { localToday, addDaysLocal, localDayRange, localDateStr } from "@/lib/dates";

export interface CommittedWindow {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  completedAt?: string | null;
}

/** The convergence green, matching Home's `CONVERGENT`. Hex, so alpha suffixes work. */
const PLACED = "#3f7a4a";

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/**
 * Everything woven in between today and `days` out.
 *
 * Shared with `AlreadyWoven` by key as well as by endpoint. Two surfaces
 * computing "your committed week" separately is how they end up disagreeing,
 * and this is the pair most likely to be read one after the other.
 */
/**
 * The fetch runs 60 days out, not 7, since the HOME study (W2): two personas
 * independently asked where a chosen date GOES once picked — an accepted
 * election vanished from every Home surface the moment it fell past the
 * seven-day strip, so the launch someone picked and must defend had no
 * standing presence anywhere on the landing page. The strip still draws one
 * week; what lies beyond it renders as the card's footer lines.
 */
export function useCommittedWeek(testerId: string | null, days = 60) {
  const today = localToday();
  const until = addDaysLocal(today, days);
  return useQuery<CommittedWindow[]>({
    queryKey: ["planning-windows-range", testerId, today, until],
    queryFn: async () => {
      const { from } = localDayRange(today);
      const { to } = localDayRange(until);
      const r = await fetch(
        `/api/planning/windows?date=${today}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { headers: testerId ? { "x-tester-id": testerId } : {} },
      );
      const j = await r.json();
      // A transient error object must not crash the .filter/.map below.
      return Array.isArray(j) ? j : [];
    },
    enabled: !!testerId,
    staleTime: 60_000,
  });
}

export function CommittedWeekStrip({ windows, onOpen }: {
  windows: CommittedWindow[];
  onOpen?: () => void;
}) {
  const today = localToday();
  // Seven day keys built forward from today in LOCAL terms, then windows
  // bucketed by the local day of their start instant. Deriving the columns
  // from the data instead would silently drop the empty days, which are half
  // of what this strip is for.
  const dayKeys = Array.from({ length: 7 }, (_, i) => addDaysLocal(today, i));
  const byDay = new Map<string, CommittedWindow[]>();
  for (const w of windows) {
    if (!w?.startTime) continue;
    const key = localDateStr(new Date(w.startTime));
    byDay.set(key, [...(byDay.get(key) ?? []), w]);
  }
  for (const [, list] of byDay) list.sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));

  // Inside the strip's seven days, and beyond them. The beyond list is the
  // W2 answer: committed dates as standing facts — date and title, nothing
  // to do, the detail belonging to Plan.
  const weekEnd = addDaysLocal(today, 7);
  const inWeek = windows.filter(w => w?.startTime && localDateStr(new Date(w.startTime)) < weekEnd);
  const beyond = windows
    .filter(w => w?.startTime && localDateStr(new Date(w.startTime)) >= weekEnd && !w.completedAt)
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));

  const blocks = inWeek.length;
  const emptyDays = dayKeys.filter(k => !byDay.has(k)).length;

  return (
    <div style={{ padding: "0 16px 14px" }}>
      <div style={{ display: "flex", gap: 4 }}>
        {dayKeys.map((key) => {
          const list = byDay.get(key) ?? [];
          const first = list[0];
          const isToday = key === today;
          const [y, m, d] = key.split("-").map(Number);
          return (
            <div key={key} style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 9, textAlign: "center", color: isToday ? "var(--color-foreground)" : "var(--text-3)",
                fontWeight: isToday ? 700 : 400,
              }}>
                {new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" })}
              </div>
              {/* Tinted with the convergence green at low ALPHA rather than an
                  opaque pale fill. A fixed light green is only light against a
                  light card; in dark mode it becomes the loudest thing on the
                  page. Translucent lets the card underneath decide. */}
              <div style={{
                height: 26, marginTop: 3, borderRadius: 5,
                border: first ? `1px solid ${PLACED}55` : "1px dashed var(--color-border)",
                background: first ? `${PLACED}1e` : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {first && (
                  <span style={{ fontSize: 8.5, fontWeight: 600, color: PLACED }}>
                    {clock(first.startTime).replace(/:00/, "").replace(/\s?(AM|PM)/, "")}
                    {list.length > 1 && ` +${list.length - 1}`}
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 8.5, marginTop: 3, color: "var(--color-muted)", lineHeight: 1.25,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center",
              }}>{first ? first.title : ""}</div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.5 }}>
        {blocks === 0
          ? "Nothing woven into this week yet."
          : `${blocks} ${blocks === 1 ? "block" : "blocks"} woven in${
              emptyDays > 0 ? ` · ${emptyDays} ${emptyDays === 1 ? "day" : "days"} with nothing placed` : ""}`}
      </div>

      {/* Committed dates past the strip — the launch you picked, standing
          where you land every morning instead of evaporating on day eight. */}
      {beyond.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--color-border)" }}>
          <div style={{
            fontSize: 8, textTransform: "uppercase", letterSpacing: "0.7px",
            color: "var(--text-3)", marginBottom: 3,
          }}>Committed</div>
          {beyond.slice(0, 3).map((w) => (
            <div key={w.id} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "2px 0" }}>
              <span style={{ fontSize: 10.5, color: PLACED, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                {new Date(w.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <span style={{
                fontSize: 11.5, color: "var(--color-foreground)", minWidth: 0,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{w.title}</span>
            </div>
          ))}
          {beyond.length > 3 && (
            <div style={{ fontSize: 10, color: "var(--text-3)", paddingTop: 2 }}>
              and {beyond.length - 3} more
            </div>
          )}
        </div>
      )}

      {/* Only when empty. The card's header already carries an "Open Plan →"
          door on Home, and two doors to one place on one card was exactly the
          sprawl the audit counted (D8). The empty state keeps its own because
          the header door is easy to miss when the card has nothing to show. */}
      {onOpen && blocks === 0 && (
        <button onClick={onOpen} style={{
          fontSize: 10.5, background: "none", border: "none", padding: 0, marginTop: 6,
          cursor: "pointer", color: "var(--color-primary)",
        }}>Open Plan <span aria-hidden="true">→</span></button>
      )}
    </div>
  );
}
