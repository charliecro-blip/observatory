/**
 * WHERE YOU ARE — the top of Home (design 2026-08-19).
 *
 * The top strip used to hold whatever you wrote at the last new moon: true,
 * worth keeping, and a SOUVENIR — it held the most valuable band on the page
 * for up to a month after it stopped being news. What belongs there is the
 * thing that actually changes daily and actually accrues: how the habits are
 * going, and what has moved toward the Guiding Stars.
 *
 * IT ABSORBS TWO CARDS RATHER THAN ADDING A THIRD VOICE. RhythmProgress and
 * Home's Guiding Stars card both folded into this, so the page's module count
 * goes DOWN while gaining the report — the one-voice-per-fact rule those two
 * were already straining against.
 *
 * The tap survives: a check-off is a tally mark, not a workflow (HOME study
 * D5), and it was the busy-parent persona's one daily gesture. Editing,
 * scheduling and the streak detail stay behind the doors.
 *
 * What it never does: score a star it was never given a target for, or print
 * a denominator nobody set. A star with nothing yet says "nothing yet".
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { jsonArray } from "@/lib/jsonArray";
import { localToday } from "@/lib/dates";

interface Habit {
  id: number; name: string; emoji?: string | null;
  doneToday?: boolean; windowDone?: number; windowTarget?: number;
  cadenceMet?: boolean; flavor?: string | null;
}
interface Star { id: number; title: string; status?: string; completedCount?: number; scheduledCount?: number }

const KEPT = "#3f7a4a";
const BEHIND = "#a08040";
const MAX_HABIT_ROWS = 5;

export default function WhereYouAre({ testerId, lat, lon, onNavigate }: {
  testerId: string | null; lat: number; lon: number; onNavigate: (v: string) => void;
}) {
  const qc = useQueryClient();
  const today = localToday();

  const { data: habits, isError: habitsFailed } = useQuery<Habit[]>({
    // Same key as every other habit read on the page, so this is one cache
    // entry shared rather than a second request for the same answer.
    queryKey: ["habits", testerId, today, lat, lon],
    queryFn: async () => jsonArray<Habit>(
      await fetch(`/api/habits?today=${today}&lat=${lat}&lon=${lon}`,
        { headers: testerId ? { "x-tester-id": testerId } : {} })),
    enabled: !!testerId,
  });
  const { data: stars } = useQuery<Star[]>({
    queryKey: ["north-stars", testerId],
    queryFn: async () => jsonArray<Star>(
      await fetch("/api/planning/north-stars", { headers: testerId ? { "x-tester-id": testerId } : {} })),
    enabled: !!testerId,
  });

  const toggleToday = useMutation({
    mutationFn: async ({ id, done }: { id: number; done: boolean }) => {
      const headers: Record<string, string> = { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) };
      if (done) await fetch(`/api/habits/${id}/log?date=${today}`, { method: "DELETE", headers });
      else await fetch(`/api/habits/${id}/log`, { method: "POST", headers, body: JSON.stringify({ date: today }) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["north-stars"] });
      qc.invalidateQueries({ queryKey: ["momentum"] });
    },
  });

  const liveHabits = habits ?? [];
  const liveStars = (stars ?? []).filter(s => s.status !== "done" && s.status !== "paused");

  // Nothing held at all is not a state worth a card — the cold-start doors
  // below say it better, with the right offer attached.
  if (habitsFailed || (liveHabits.length === 0 && liveStars.length === 0)) return null;

  const doneToday = liveHabits.filter(h => h.doneToday).length;
  const weekKept = liveHabits.reduce((n, h) => n + (h.windowDone ?? 0), 0);
  // What needs looking at first: behind, then untouched, then already kept.
  const sorted = [...liveHabits].sort((a, b) =>
    ((a.cadenceMet === false ? 0 : 2) + (a.doneToday ? 1 : 0)) -
    ((b.cadenceMet === false ? 0 : 2) + (b.doneToday ? 1 : 0)));
  const shown = sorted.slice(0, MAX_HABIT_ROWS);

  return (
    <div style={{
      background: "var(--color-card)", border: "1px solid var(--color-border)",
      borderRadius: 12, padding: "12px 16px 14px", flexShrink: 0,
    }}>
      <div style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: "0.9px", textTransform: "uppercase",
        color: "var(--text-3)", marginBottom: 10,
      }}>Where you are</div>

      <div style={{ display: "grid", gridTemplateColumns: liveStars.length ? "minmax(0, 1.35fr) minmax(0, 1fr)" : "minmax(0, 1fr)", gap: 20 }}>

        {liveHabits.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)" }}>Habits</span>
              <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                {doneToday} of {liveHabits.length} today{weekKept > 0 ? ` · ${weekKept} this week` : ""}
              </span>
              <button onClick={() => onNavigate("habits")} style={{
                marginLeft: "auto", fontSize: 10.5, background: "none", border: "none",
                padding: 0, cursor: "pointer", color: "var(--color-primary)",
              }}>Open →</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {shown.map(h => {
                const chore = h.flavor === "chore";
                const target = h.windowTarget ?? 0;
                const done = h.windowDone ?? 0;
                const behind = h.cadenceMet === false;
                return (
                  <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <button
                      onClick={() => toggleToday.mutate({ id: h.id, done: !!h.doneToday })}
                      disabled={toggleToday.isPending}
                      aria-pressed={!!h.doneToday}
                      aria-label={`${h.doneToday ? "Unmark" : "Mark"} ${h.name} for today`}
                      style={{
                        width: 14, height: 14, borderRadius: chore ? 4 : "50%", flexShrink: 0, padding: 0,
                        cursor: toggleToday.isPending ? "default" : "pointer",
                        border: h.doneToday ? "none" : "1.5px solid var(--color-border)",
                        background: h.doneToday ? KEPT : "transparent",
                        color: "#ffffff", fontSize: 8.5, lineHeight: 1,
                      }}>{h.doneToday ? "✓" : ""}</button>
                    <span style={{
                      flex: 1, minWidth: 0, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      color: h.doneToday ? "var(--text-3)" : "var(--color-foreground)",
                      textDecoration: h.doneToday ? "line-through" : "none",
                    }}>{h.emoji ? `${h.emoji} ` : ""}{h.name}</span>
                    <span style={{
                      fontSize: 10, flexShrink: 0,
                      color: chore ? "var(--text-3)" : behind ? BEHIND : done > 0 ? KEPT : "var(--text-3)",
                    }}>
                      {chore ? (h.doneToday ? "done today" : done > 0 ? `done ${done}×` : "")
                        : target > 0 ? `${done} of ${target}`
                        : done > 0 ? `${done} this week` : "nothing yet"}
                    </span>
                  </div>
                );
              })}
              {liveHabits.length > shown.length && (
                <div style={{ fontSize: 10, color: "var(--text-3)", paddingTop: 2 }}>
                  and {liveHabits.length - shown.length} more
                </div>
              )}
            </div>
          </div>
        )}

        {liveStars.length > 0 && (
          <div style={{ borderLeft: liveHabits.length ? "1px solid var(--color-border)" : "none", paddingLeft: liveHabits.length ? 20 : 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)" }}>Guiding Stars</span>
              <button onClick={() => onNavigate("work")} style={{
                marginLeft: "auto", fontSize: 10.5, background: "none", border: "none",
                padding: 0, cursor: "pointer", color: "var(--color-primary)",
              }}>Open →</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {liveStars.map(g => {
                const done = g.completedCount ?? 0;
                const scheduled = g.scheduledCount ?? 0;
                return (
                  <button key={g.id} onClick={() => onNavigate("work")} style={{
                    display: "flex", alignItems: "baseline", gap: 8, width: "100%", textAlign: "left",
                    padding: 0, background: "none", border: "none", cursor: "pointer",
                  }}>
                    <span style={{
                      flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--color-foreground)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{g.title}</span>
                    <span style={{ fontSize: 10, flexShrink: 0, color: done > 0 ? KEPT : "var(--text-3)" }}>
                      {done > 0 ? `${done} this week` : scheduled > 0 ? `${scheduled} scheduled` : "nothing yet"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
