/**
 * CHECK OFF, FROM INSIDE THE LOG (2026-08-24).
 *
 * Writing up a day and marking what you kept were two separate errands: the
 * Log could show that a practice went unticked and offer no way to tick it,
 * which sent you to Home to do the one gesture the page you were on had just
 * finished describing.
 *
 * WHAT IS HONESTLY BACK-DATABLE, AND WHAT IS NOT. A habit's record is a date —
 * /habits/:id/log takes the day as an argument, so ticking Tuesday's walk on
 * Thursday stores it against Tuesday and every streak downstream reads true. A
 * task's record is a MOMENT: PATCH /tasks/:id stamps completedAt with the
 * clock, deliberately, because it is the only trace of when work happened
 * (tasks.ts says so at the assignment). Offering a checkbox on a past day
 * would file today's timestamp under that day's heading.
 *
 * So the two rows behave differently on a past day, and the page says why
 * rather than greying something out and leaving you to guess. A refusal with
 * its reason is the house style; a checkbox that quietly lies is not.
 *
 * The habits query deliberately shares WhereYouAre's key shape, so ticking
 * from here and ticking from Home are one cache entry rather than two that
 * drift.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Habit {
  id: number; name: string; status?: string;
  doneToday?: boolean; flavor?: string;
}
interface Task { id: number; title: string; done?: string }

const KEPT = "var(--color-quality-good)";

export default function DayCheckOff({ testerId, date, lat = 40.7, lon = -74.0 }: {
  testerId: string | null; date: string; lat?: number; lon?: number;
}) {
  const qc = useQueryClient();
  const headers = { "x-tester-id": testerId ?? "", "Content-Type": "application/json" };
  const today = new Date().toLocaleDateString("en-CA");
  const isToday = date === today;
  // Log lists days that have happened, but a timeline can be scrolled and a
  // date field can be typed into, so this is cheap insurance against offering
  // to record a Thursday that has not arrived.
  const isFuture = date > today;

  const { data: habits = [], isError: habitsError } = useQuery<Habit[]>({
    queryKey: ["habits", testerId, date, lat, lon],
    queryFn: async () => {
      const r = await fetch(`/api/habits?today=${date}&lat=${lat}&lon=${lon}`, { headers });
      if (!r.ok) throw new Error("habits unavailable");
      const j = await r.json();
      return Array.isArray(j) ? j.filter((h: Habit) => h.status !== "archived") : [];
    },
    enabled: !!testerId && !isFuture,
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["tasks", "all"],
    queryFn: async () => {
      const r = await fetch("/api/tasks", { headers });
      if (!r.ok) throw new Error("tasks unavailable");
      const j = await r.json();
      return Array.isArray(j) ? j : [];
    },
    enabled: !!testerId && !isFuture,
  });

  const toggleHabit = useMutation({
    mutationFn: async ({ id, done }: { id: number; done: boolean }) => {
      const r = done
        ? await fetch(`/api/habits/${id}/log?date=${date}`, { method: "DELETE", headers })
        : await fetch(`/api/habits/${id}/log`, { method: "POST", headers, body: JSON.stringify({ date }) });
      if (!r.ok) throw new Error("could not save");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["logs-day"] });
      qc.invalidateQueries({ queryKey: ["north-stars"] });
      qc.invalidateQueries({ queryKey: ["momentum"] });
    },
  });

  const finishTask = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/tasks/${id}`, {
        method: "PATCH", headers, body: JSON.stringify({ done: true }),
      });
      if (!r.ok) throw new Error("could not save");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["logs-day"] });
      qc.invalidateQueries({ queryKey: ["momentum"] });
    },
  });

  const openTasks = tasks.filter(t => t.done !== "true");
  if (isFuture) return null;
  if (!habits.length && !openTasks.length && !habitsError) return null;

  const failed = toggleHabit.isError || finishTask.isError;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", marginBottom: 10 }}>
        Check off
      </div>

      {habitsError && (
        <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginBottom: 8 }}>
          Couldn't load this day's practices, which is a connection problem rather than an empty day.
        </div>
      )}

      {failed && (
        <div style={{ fontSize: 11.5, color: "var(--color-quality-challenge)", marginBottom: 8 }} role="status">
          That didn't save, so the mark you see may not be the mark on record. Try it again in a moment.
        </div>
      )}

      {habits.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: openTasks.length ? 14 : 0 }}>
          {habits.map(h => {
            const chore = h.flavor === "chore";
            const done = !!h.doneToday;
            return (
              <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "3px 0" }}>
                <button
                  onClick={() => toggleHabit.mutate({ id: h.id, done })}
                  disabled={toggleHabit.isPending}
                  aria-pressed={done}
                  aria-label={`${done ? "Unmark" : "Mark"} ${h.name} for ${date}`}
                  style={{
                    // 15px mark inside a 24px target — the trade WhereYouAre's
                    // HabitRow makes, for the same reason.
                    width: 24, height: 24, margin: -4.5, flexShrink: 0, padding: 0,
                    border: "none", background: "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: toggleHabit.isPending ? "default" : "pointer",
                  }}>
                  <span style={{
                    // A chore checks off in the tasks' own square voice; the
                    // circle stays the mark of a practice.
                    width: 15, height: 15, borderRadius: chore ? 4 : "50%",
                    border: done ? "none" : "1.5px solid var(--color-border)",
                    background: done ? KEPT : "transparent",
                    color: "#ffffff", fontSize: 9, lineHeight: 1,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{done ? "✓" : ""}</span>
                </button>
                <span style={{
                  fontSize: 12, flex: 1, minWidth: 0, color: "var(--color-foreground)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  opacity: done ? 0.6 : 1,
                }}>{h.name}</span>
              </div>
            );
          })}
        </div>
      )}

      {openTasks.length > 0 && (
        <>
          <div style={{ fontSize: 10.5, color: "var(--text-3)", marginBottom: 6, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Still open
          </div>
          {isToday ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {openTasks.slice(0, 8).map(t => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "3px 0" }}>
                  <button
                    onClick={() => finishTask.mutate(t.id)}
                    disabled={finishTask.isPending}
                    aria-label={`Mark ${t.title} done`}
                    style={{
                      width: 24, height: 24, margin: -4.5, flexShrink: 0, padding: 0,
                      border: "none", background: "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: finishTask.isPending ? "default" : "pointer",
                    }}>
                    <span style={{
                      width: 15, height: 15, borderRadius: 4,
                      border: "1.5px solid var(--color-border)", background: "transparent",
                    }} />
                  </button>
                  <span style={{
                    fontSize: 12, flex: 1, minWidth: 0, color: "var(--color-foreground)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{t.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.5 }}>
              {openTasks.length === 1 ? "One to-do is" : `${openTasks.length} to-dos are`} still open, and
              they can be ticked on the day you finish them — a to-do stores the moment it was done, so
              closing one here would file today's time under this date. Practices above take the date
              you are looking at, so those you can still fill in.
            </div>
          )}
        </>
      )}
    </div>
  );
}
