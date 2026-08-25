// THE DAY, ON THE LANDING PAGE.
//
// Home could tell you what kind of moment this was, what lined up, and what
// was on your list — but never what your day actually looked like. The
// scheduled windows lived in Plan, the habits in Stars, and neither
// appeared where you land (owner, 2026-08-13: "the home page doesn't give
// any mention of those to-do tasks, or a calendar view of the day/any plan.
// that should be essential").
//
// A spine, not a grid: the hours you have something in, in order, with now
// marked. A full calendar belongs in Calendar; this answers "what am I
// inside of, and what is next" at a glance.
//
// It renders nothing when the day is genuinely empty — Home already has a
// capture field and a "shape today" offer, and an empty timeline drawn in
// full would be furniture pretending to be information.

import { useTodayWindows } from "@/hooks/useTides";
import { localToday } from "@/lib/dates";
import { useQuery } from "@tanstack/react-query";
import { useFold, FoldToggle } from "@/components/ModuleFold";

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export default function DayAhead({ testerId, lat, lon, onNavigate }: {
  testerId: string | null;
  lat: number;
  lon: number;
  onNavigate?: (v: string) => void;
}) {
  const today = localToday();
  const { data: windows } = useTodayWindows(testerId, today);
  // Above the early return on purpose. useFold reaches useContext through
  // usePreferences, so calling it below `if (!scheduled.length) return null`
  // made this component call 16 hooks on an empty day and 17 on a day with
  // something on it — React saw the count change the moment the windows query
  // resolved and the card went from empty to filled. Nothing here depends on
  // `scheduled`, so it belongs with the other hooks.
  const folded = useFold().isFolded("dayAhead");

  // YOUR CALENDAR IS PART OF YOUR DAY (owner, 2026-08-19). This card promised
  // "what is actually on today, in order, with now marked" and showed only
  // what Compass itself had placed — so the meetings that shape the day were
  // the one thing missing from it.
  //
  // An unreachable calendar is NOT an empty one: the query's failure is
  // reported below rather than rendered as a free afternoon, the same rule
  // the weaver learned the hard way.
  const calQ = useQuery<{ connected?: boolean; events?: any[] }>({
    queryKey: ["gcal-today", testerId, today],
    queryFn: async () => {
      const start = new Date(`${today}T00:00:00`).toISOString();
      const end = new Date(`${today}T23:59:59`).toISOString();
      const r = await fetch(`/api/integrations/google-cal/events?start=${start}&end=${end}`,
        { headers: testerId ? { "x-tester-id": testerId } : {} });
      // 404/409 mean "not connected" — a true empty, not a failure.
      if (r.status === 404 || r.status === 409) return { connected: false, events: [] };
      if (!r.ok) throw new Error(`calendar unreachable (${r.status})`);
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 1000 * 60 * 5,
  });
  const calendarUnreachable = calQ.isError || calQ.fetchStatus === "paused";

  // The habit chips are gone (HOME study D2 — one habit had four sightings on
  // one page). A habit is not "on the day" until something places it: this
  // card is the day's spine, and unplaced habits were a second copy of the
  // HABITS card wearing chips. That card owns them, and its tally is tappable.
  const nowMs = Date.now();
  // Both kinds on one spine, in time order. A calendar event is a COMMITMENT
  // (someone else is expecting you) where a window is a choice, so it is
  // marked rather than merged silently — but it sits in the same list,
  // because the day does not keep them in separate places.
  const gcal = (calQ.data?.events ?? [])
    .filter((e: any) => !e.allDay && e.start)
    .map((e: any) => ({ id: `g-${e.id}`, title: e.title, startTime: e.start, endTime: e.end, gcal: true }));
  const scheduled = [
    ...(Array.isArray(windows) ? windows : []).filter((w: any) => w?.startTime),
    ...gcal,
  ].sort((a: any, b: any) => Date.parse(a.startTime) - Date.parse(b.startTime));

  if (!scheduled.length && !calendarUnreachable) return null;

  const nextIdx = scheduled.findIndex((w: any) => Date.parse(w.startTime) > nowMs);

  return (
    <div style={{
      background: "var(--color-card)", border: "1px solid var(--color-border)",
      borderRadius: 12, padding: "12px 16px 13px",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
          <FoldToggle id="dayAhead" label="Your day" />
          <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)" }}>
            Your day
          </span>
          {/* Folded, the count is what the card was for. */}
          {folded && (
            <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>
              {scheduled.length ? `${scheduled.length} on today` : "nothing on today"}
            </span>
          )}
        </span>
        {onNavigate && (
          <button onClick={() => onNavigate("calendar")} style={{
            fontSize: 10.5, background: "none", border: "none", padding: 0,
            cursor: "pointer", color: "var(--color-primary)",
          }}>Open Calendar <span aria-hidden="true">→</span></button>
        )}
      </div>
      {!folded && <>

      {scheduled.length > 0 && (
        <div style={{ marginTop: 7 }}>
          {scheduled.map((w: any, i: number) => {
            const startMs = Date.parse(w.startTime);
            const endMs = w.endTime ? Date.parse(w.endTime) : startMs;
            const past = endMs < nowMs;
            const inside = startMs <= nowMs && nowMs <= endMs;
            const done = !!w.completedAt;
            return (
              <div key={w.id ?? i}>
                {/* Now sits BETWEEN entries, where it actually falls, rather
                    than as a badge on whichever row is nearest. */}
                {i === nextIdx && nextIdx > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                    <span style={{ fontSize: 10.5, color: "var(--color-primary)", fontVariantNumeric: "tabular-nums", minWidth: 52 }}>now</span>
                    <div style={{ flex: 1, height: 1, background: "var(--color-primary)", opacity: 0.35 }} />
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, padding: "4px 0", alignItems: "baseline", opacity: past && !inside ? 0.5 : 1 }}>
                  <span style={{
                    fontSize: 11, fontVariantNumeric: "tabular-nums", minWidth: 52, flexShrink: 0,
                    color: inside ? "var(--color-primary)" : "var(--text-3)",
                    fontWeight: inside ? 600 : 400,
                  }}>{clock(w.startTime)}</span>
                  <span style={{
                    fontSize: 12.5, color: "var(--color-foreground)", flex: 1, minWidth: 0,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    textDecoration: done ? "line-through" : "none",
                  }}>{w.title}</span>
                  {w.gcal && (
                    <span title="From your calendar" style={{
                      fontSize: 10.5, color: "var(--text-3)", border: "1px solid var(--color-border)",
                      borderRadius: 4, padding: "0 5px", flexShrink: 0, lineHeight: "14px",
                    }}>calendar</span>
                  )}
                  {inside && !done && (
                    <span style={{ fontSize: 11, color: "var(--color-primary)", flexShrink: 0 }}>now</span>
                  )}
                  {done && <span aria-hidden="true" style={{ fontSize: 11, color: "#4a8060", flexShrink: 0 }}>✓</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {calendarUnreachable && (
        <div style={{ fontSize: 10.5, color: "#8a5030", marginTop: scheduled.length ? 7 : 5, lineHeight: 1.5 }}>
          Couldn&rsquo;t reach your calendar — anything on it is missing from this list.
        </div>
      )}

      </>}
    </div>
  );
}
