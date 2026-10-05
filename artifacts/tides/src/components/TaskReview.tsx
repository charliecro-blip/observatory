/**
 * A REVIEW YOU CAN OPEN ANY TIME (plan Part B, T7; the August audit's F10:
 * "weekly review ambush-gated; GTD wants it summonable").
 *
 * Four questions, each a short list, in the order a review usually runs:
 * what hasn't been clarified, who you are waiting on, what was parked for
 * someday, and what the week holds. Each task opens in place (the same
 * clarify panel as the Tasks list), so the review is where the sorting
 * happens, not a report about it. Nothing here is scored or counted against
 * anyone: an empty section says it is empty and moves on.
 */
import type { ReactNode } from "react";

export interface ReviewTask {
  id: number;
  title: string;
  done: string;
  dueDate?: string | null;
  estMinutes?: number | null;
  nextStep?: string | null;
  parkedAs?: string | null;
  waitingOn?: string | null;
  checkBackOn?: string | null;
  parentId?: number | null;
}

export function reviewSections<T extends ReviewTask>(tasks: T[], today: string, weekEnd: string) {
  const open = tasks.filter((t) => t.done !== "true");
  // A task with steps is clarified by them; a step is clarified by being one.
  const hasSteps = new Set(tasks.filter((t) => t.parentId).map((t) => t.parentId));
  return {
    unclarified: open.filter((t) => !t.parkedAs && !t.nextStep && !t.estMinutes && !t.parentId && !hasSteps.has(t.id)),
    waiting: open.filter((t) => t.parkedAs === "waiting")
      .sort((a, b) => String(a.checkBackOn ?? "9999").localeCompare(String(b.checkBackOn ?? "9999"))),
    waitingDue: open.filter((t) => t.parkedAs === "waiting" && t.checkBackOn && t.checkBackOn <= today),
    someday: open.filter((t) => t.parkedAs === "someday"),
    week: open.filter((t) => !t.parkedAs && t.dueDate && t.dueDate <= weekEnd)
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))),
  };
}

function Part({ title, note, empty, children, count }: { title: string; note: string; empty: string; children: ReactNode; count: number }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <h3 style={{ margin: 0, font: "600 12.5px/1.3 var(--font-sans)", color: "var(--color-foreground)" }}>{title}{count ? ` · ${count}` : ""}</h3>
      <p style={{ margin: "0 0 4px", fontSize: 11.5, color: "var(--text-3)" }}>{count ? note : empty}</p>
      {children}
    </section>
  );
}

export default function TaskReview<T extends ReviewTask>({ tasks, today, weekEnd, renderRow, onClose, onOpenCalendar }: {
  tasks: T[];
  today: string;
  weekEnd: string;
  renderRow: (t: T) => ReactNode;
  onClose: () => void;
  onOpenCalendar?: () => void;
}) {
  const s = reviewSections(tasks, today, weekEnd);
  return (
    <div role="region" aria-label="Review" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <h2 style={{ margin: 0, font: "600 14px/1.3 var(--font-sans)" }}>Review</h2>
        <button onClick={onClose} style={{ fontSize: 11.5, border: "none", background: "none", color: "var(--color-primary)", cursor: "pointer", textDecoration: "underline" }}>Close the review</button>
      </div>
      <Part title="Not clarified yet" count={s.unclarified.length}
        note="These have no next step or length yet; open one to give it a first step or a place, or to park it."
        empty="Every open task has a next step or a length.">
        {s.unclarified.map((t) => <div key={t.id}>{renderRow(t)}</div>)}
      </Part>
      <Part title="Waiting on someone" count={s.waiting.length}
        note={s.waitingDue.length ? `${s.waitingDue.length === 1 ? "One is" : `${s.waitingDue.length} are`} at or past the date you set to look again.` : "None has reached the date you set to look again."}
        empty="You aren't waiting on anyone.">
        {s.waiting.map((t) => <div key={t.id}>{renderRow(t)}</div>)}
      </Part>
      <Part title="Someday" count={s.someday.length}
        note="Parked on purpose, out of every list until you open one and put it back in play."
        empty="Nothing is parked for someday.">
        {s.someday.map((t) => <div key={t.id}>{renderRow(t)}</div>)}
      </Part>
      <Part title="The week" count={s.week.length}
        note="Dated through the next seven days, including anything past its date."
        empty="Nothing is dated in the next seven days.">
        {s.week.map((t) => <div key={t.id}>{renderRow(t)}</div>)}
        {onOpenCalendar && (
          <button onClick={onOpenCalendar} style={{ alignSelf: "flex-start", fontSize: 11.5, border: "none", background: "none", padding: 0, color: "var(--color-primary)", cursor: "pointer", textDecoration: "underline" }}>See the week in Calendar</button>
        )}
      </Part>
    </div>
  );
}
