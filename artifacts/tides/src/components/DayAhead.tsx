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
import { useQuery } from "@tanstack/react-query";
import { localToday } from "@/lib/dates";
import { ELEMENT_COLORS } from "@/lib/elements";

interface HabitLite {
  id: number; name: string; emoji?: string | null;
  doneToday: boolean; dueToday?: boolean; element?: string | null;
}

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

  const { data: habits = [] } = useQuery<HabitLite[]>({
    queryKey: ["habits", testerId, today, lat.toFixed(2), lon.toFixed(2)],
    queryFn: async () => {
      const r = await fetch(`/api/habits?today=${today}&lat=${lat}&lon=${lon}`,
        { headers: testerId ? { "x-tester-id": testerId } : {} });
      const j = await r.json();
      return Array.isArray(j) ? j : [];
    },
    enabled: !!testerId,
    staleTime: 60_000,
  });

  const nowMs = Date.now();
  const scheduled = (Array.isArray(windows) ? windows : [])
    .filter((w: any) => w?.startTime)
    .sort((a: any, b: any) => Date.parse(a.startTime) - Date.parse(b.startTime));

  // Habits are shown as a row rather than placed on the spine: most carry no
  // time, and inventing one would put a claim on the day that nobody made.
  const openHabits = habits.filter((h) => !h.doneToday);
  const doneHabits = habits.filter((h) => h.doneToday);

  if (!scheduled.length && !habits.length) return null;

  const nextIdx = scheduled.findIndex((w: any) => Date.parse(w.startTime) > nowMs);

  return (
    <div style={{
      background: "var(--color-card)", border: "1px solid var(--color-border)",
      borderRadius: 12, padding: "12px 16px 13px",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)" }}>
          Your day
        </span>
        {onNavigate && (
          <button onClick={() => onNavigate("calendar")} style={{
            fontSize: 10.5, background: "none", border: "none", padding: 0,
            cursor: "pointer", color: "var(--color-primary)",
          }}>See the calendar →</button>
        )}
      </div>

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
                    <span style={{ fontSize: 9, color: "var(--color-primary)", fontVariantNumeric: "tabular-nums", minWidth: 52 }}>now</span>
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
                  {inside && !done && (
                    <span style={{ fontSize: 9.5, color: "var(--color-primary)", flexShrink: 0 }}>now</span>
                  )}
                  {done && <span style={{ fontSize: 9.5, color: "#4a8060", flexShrink: 0 }}>✓</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {habits.length > 0 && (
        <div style={{
          marginTop: scheduled.length ? 9 : 6,
          paddingTop: scheduled.length ? 8 : 0,
          borderTop: scheduled.length ? "1px solid var(--color-border)" : "none",
          display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 10, color: "var(--text-3)", marginRight: 2 }}>
            {openHabits.length === 0 ? "habits — all done" : "habits"}
          </span>
          {openHabits.map((h) => {
            const col = ELEMENT_COLORS[h.element as keyof typeof ELEMENT_COLORS] ?? "var(--color-border)";
            return (
              <button key={h.id} onClick={onNavigate ? () => onNavigate("work") : undefined} style={{
                fontSize: 10.5, padding: "3px 9px", borderRadius: 999, cursor: onNavigate ? "pointer" : "default",
                border: `1px solid ${col}55`, background: "var(--color-card-2)", color: "var(--color-foreground)",
              }}>{h.emoji ? `${h.emoji} ` : ""}{h.name}</button>
            );
          })}
          {doneHabits.map((h) => (
            <span key={h.id} style={{
              fontSize: 10.5, padding: "3px 9px", borderRadius: 999,
              border: "1px solid var(--color-border)", background: "transparent",
              color: "var(--text-3)", textDecoration: "line-through",
            }}>{h.emoji ? `${h.emoji} ` : ""}{h.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}
