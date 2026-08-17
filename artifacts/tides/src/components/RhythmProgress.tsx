// HABITS ON HOME — how the rhythm is actually going, at the scale it moves at.
//
// A habit's story is a week long. Today can tell you whether you have done the
// thing yet, which is a different and much smaller question, and it is the only
// question Today was answering — so the part of a habit that is worth knowing
// (that the walk has happened five times in seven days, that the weekly one has
// not happened at all) had nowhere to be read.
//
// TODAY'S TALLY IS TAPPABLE; THE WEEK STAYS READ-ONLY (HOME study D5). The
// first version made the whole card read-only under the summary-with-a-door
// rule, which cost the busy-parent persona her one daily gesture: on the
// landing page, the habit she does every morning could be seen and not
// ticked. A check-off is a tally mark, not a workflow — the rule was written
// against Home becoming a place you DO things, and one tap that records a
// fact is not doing, it is counting. Editing, scheduling and the streak
// detail stay behind the door.
//
// WHAT THE FIGURE MEANS. `windowTarget` is derived from the cadence the person
// chose — daily is 7, most days is 5, weekly is their own number, occasional
// is 0 — so "4 of 5 this week" is scored against their decision rather than
// against one the app invented. Occasional habits have no target and are never
// given one: they report the bare count and cannot be behind.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { jsonArray } from "@/lib/jsonArray";
import { localToday } from "@/lib/dates";

interface Habit {
  id: number;
  name: string;
  emoji?: string | null;
  doneToday?: boolean;
  windowDone?: number;
  windowTarget?: number;
  cadenceMet?: boolean;
  /** "chore" = recurring upkeep (owner F7) — a task-voiced check-off, and
   *  never a weekly score beside it. */
  flavor?: string | null;
}

const KEPT = "#3f7a4a";
const BEHIND = "#a08040";

/** Rows shown before the card starts being a list. The rest are counted. */
const MAX_ROWS = 5;

export default function RhythmProgress({ testerId, lat, lon, onNavigate }: {
  testerId: string | null;
  lat: number;
  lon: number;
  onNavigate: (v: string) => void;
}) {
  const qc = useQueryClient();
  const today = localToday();
  const { data: habits, isError } = useQuery<Habit[]>({
    // The day and the place are in the URL, so they belong in the cache
    // identity. Keying on the tester alone (as Today's habit strip still does)
    // lets a cached answer outlive the day it was computed for.
    queryKey: ["habits", testerId, today, lat, lon],
    queryFn: async () => jsonArray<Habit>(
      await fetch(`/api/habits?today=${today}&lat=${lat}&lon=${lon}`,
        { headers: testerId ? { "x-tester-id": testerId } : {} })),
    enabled: !!testerId,
  });

  const toggleToday = useMutation({
    mutationFn: async ({ id, done }: { id: number; done: boolean }) => {
      const headers: Record<string, string> = { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) };
      // Both directions name the viewer's LOCAL date — the same rule every
      // other habit toggle in the app has already learned the hard way.
      if (done) await fetch(`/api/habits/${id}/log?date=${today}`, { method: "DELETE", headers });
      else await fetch(`/api/habits/${id}/log`, { method: "POST", headers, body: JSON.stringify({ date: today }) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits"] }),
  });

  // No habits is not a state worth a card. Somebody who has never set one up
  // does not need a panel telling them so every time they open the app; the
  // Habits tab is where that invitation belongs.
  if (isError || !habits || habits.length === 0) return null;

  const doneToday = habits.filter((h) => h.doneToday).length;
  // Sorted by what needs looking at: behind first, then untouched today, then
  // the ones already kept. Alphabetical would bury the one fact worth a glance.
  const sorted = [...habits].sort((a, b) => {
    const rank = (h: Habit) =>
      (h.cadenceMet === false ? 0 : 2) + (h.doneToday ? 1 : 0);
    return rank(a) - rank(b);
  });
  const shown = sorted.slice(0, MAX_ROWS);
  const hidden = habits.length - shown.length;

  return (
    <div style={{
      background: "var(--color-card)", border: "1px solid var(--color-border)",
      borderRadius: 12, flexShrink: 0,
    }}>
      <div style={{ padding: "11px 16px 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: "0.9px", textTransform: "uppercase",
          color: "var(--text-3)",
        }}>Habits</div>
        <div style={{ fontSize: 10, color: "var(--text-3)" }}>
          {doneToday} of {habits.length} today
        </div>
        <div style={{ marginLeft: "auto" }}>
          <button onClick={() => onNavigate("habits")} style={{
            fontSize: 11, background: "none", border: "none", padding: 0, cursor: "pointer",
            color: "var(--color-primary)",
          }}>Open Habits →</button>
        </div>
      </div>

      <div style={{ padding: "0 16px 12px" }}>
        {shown.map((h) => {
          const target = h.windowTarget ?? 0;
          const done = h.windowDone ?? 0;
          const behind = h.cadenceMet === false;
          const chore = h.flavor === "chore";
          return (
            <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
              <button
                onClick={() => toggleToday.mutate({ id: h.id, done: !!h.doneToday })}
                disabled={toggleToday.isPending}
                aria-pressed={!!h.doneToday}
                aria-label={`${h.doneToday ? "Unmark" : "Mark"} ${h.name} for today`}
                style={{
                  // A chore checks off in the tasks' own square voice; the
                  // circle stays the mark of a practice.
                  width: 15, height: 15, borderRadius: chore ? 4 : "50%", flexShrink: 0, padding: 0,
                  cursor: toggleToday.isPending ? "default" : "pointer",
                  border: h.doneToday ? "none" : "1.5px solid var(--color-border)",
                  background: h.doneToday ? KEPT : "transparent",
                  color: "#ffffff", fontSize: 9, lineHeight: 1,
                }}>{h.doneToday ? "✓" : ""}</button>
              <span style={{
                fontSize: 12, flex: 1, minWidth: 0, color: "var(--color-foreground)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{h.emoji ? `${h.emoji} ` : ""}{h.name}</span>
              <span style={{
                fontSize: 10, flexShrink: 0,
                color: chore ? "var(--text-3)" : behind ? BEHIND : done > 0 ? KEPT : "var(--text-3)",
              }}>
                {/* An occasional habit reports what happened and nothing else.
                    Printing "3 of 0" or inventing a denominator for it would
                    score a habit the person deliberately left unscored.
                    A chore says even less: done today, or nothing — never a
                    weekly score (owner F7). */}
                {chore
                  ? (h.doneToday ? "done today" : done > 0 ? `done ${done}× this week` : "")
                  : target > 0 ? `${done} of ${target} this week`
                  : done > 0 ? `${done} this week`
                  : "nothing this week"}
              </span>
            </div>
          );
        })}
        {hidden > 0 && (
          <div style={{ fontSize: 10, color: "var(--text-3)", paddingTop: 4 }}>
            and {hidden} more
          </div>
        )}
      </div>
    </div>
  );
}
