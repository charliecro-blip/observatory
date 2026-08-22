// WHAT YOU'VE ALREADY WOVEN IN — the Plan tab's memory.
//
// Plan could take a list and place it, and then had nothing to say about
// what it had placed: to see your own committed week you left for Calendar
// (owner, 2026-08-13: "see what I've already woven in … all in the planning
// tab"). The same shape as the audit's other findings — the app knew, and
// the surface did not say.
//
// Deliberately the WEEK, not the day: Home already owns today's spine, and
// the question this answers is "what did I commit to?", which is a week-
// scale question. Grouped by day, quiet, and it says plainly when the answer
// is nothing rather than drawing an empty frame.

import { useQuery } from "@tanstack/react-query";
import { localToday, addDaysLocal } from "@/lib/dates";
import { localDayRange } from "@/lib/dates";

interface Win { id: number; title: string; startTime: string; endTime: string; completedAt?: string | null }

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

export default function AlreadyWoven({ testerId, days = 7, onNavigate }: {
  testerId: string | null;
  days?: number;
  onNavigate?: (v: string) => void;
}) {
  const today = localToday();
  const until = addDaysLocal(today, days);

  const { data: windows = [] } = useQuery<Win[]>({
    queryKey: ["planning-windows-range", testerId, today, until],
    queryFn: async () => {
      const { from } = localDayRange(today);
      const { to } = localDayRange(until);
      const r = await fetch(
        `/api/planning/windows?date=${today}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { headers: testerId ? { "x-tester-id": testerId } : {} },
      );
      const j = await r.json();
      return Array.isArray(j) ? j : [];
    },
    enabled: !!testerId,
    staleTime: 60_000,
  });

  const upcoming = windows
    .filter(w => w?.startTime)
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));

  const byDay = new Map<string, Win[]>();
  for (const w of upcoming) {
    const key = new Date(w.startTime).toDateString();
    byDay.set(key, [...(byDay.get(key) ?? []), w]);
  }

  return (
    <div style={{ marginTop: 26, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-3)" }}>
          Already woven in
        </span>
        {onNavigate && upcoming.length > 0 && (
          <button onClick={() => onNavigate("calendar")} style={{
            fontSize: 11, background: "none", border: "none", padding: 0,
            cursor: "pointer", color: "var(--color-primary)",
          }}>Open the calendar →</button>
        )}
      </div>

      {upcoming.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.55 }}>
          Nothing on the calendar for the next {days} days. What you weave above lands here.
        </div>
      ) : (
        [...byDay.entries()].map(([key, items]) => (
          <div key={key} style={{ marginBottom: 9 }}>
            <div style={{ fontSize: 10, color: "var(--color-muted)", marginBottom: 3 }}>
              {dayLabel(items[0].startTime)}
            </div>
            {items.map(w => (
              <div key={w.id} style={{ display: "flex", gap: 10, padding: "3px 0", alignItems: "baseline" }}>
                <span style={{
                  fontSize: 11, color: "var(--text-3)", fontVariantNumeric: "tabular-nums",
                  minWidth: 52, flexShrink: 0,
                }}>{clock(w.startTime)}</span>
                <span style={{
                  fontSize: 12.5, color: "var(--color-foreground)", flex: 1, minWidth: 0,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  textDecoration: w.completedAt ? "line-through" : "none",
                  opacity: w.completedAt ? 0.55 : 1,
                }}>{w.title}</span>
                {w.completedAt && <span aria-hidden="true" style={{ fontSize: 10, color: "#4a8060", flexShrink: 0 }}>✓</span>}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
