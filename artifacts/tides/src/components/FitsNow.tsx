import { useState } from "react";
import { PLACES } from "@/components/TaskClarify";

/**
 * WHAT FITS NOW (plan Part B, T6): the GTD question asked of what you hold.
 *
 * Three choices (the time you have, the energy you have, where you are), and
 * back comes what fits, next step first. A task with a next step fits any
 * slot, because a step is minutes by definition; one without needs a length
 * that fits, and one with neither is counted rather than guessed at, so the
 * list can say how many are waiting to be clarified.
 *
 * Keepings sit beside doings (memory: holistic-not-productivity): every
 * practice not yet kept today is offered too, in its smallest version when
 * energy is low; three show, and the rest open from a count.
 */
export interface FitTask {
  id: number;
  title: string;
  done?: string | null;
  dueDate?: string | null;
  estMinutes?: number | null;
  energy?: string | null;
  context?: string | null;
  nextStep?: string | null;
  planet?: string | null;
  sortOrder?: number;
  /** A step inside another task (T3): it is a next step by definition. */
  parentId?: number | null;
}
export interface FitHabit { id?: number; name: string; minimumViable?: string | null; doneToday?: boolean; status?: string }

type Slot = 15 | 30 | 60;
type Energy = "low" | "medium" | "high";
const ENERGY_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };

export function fitsNow(tasks: FitTask[], opts: { slot: Slot; energy: Energy; place: string; today: string; hourRuler?: string | null }) {
  const fit: { task: FitTask; step: string | null; parentTitle: string | null; why: string[] }[] = [];
  let unclarified = 0;
  const titleOf = new Map(tasks.map((t) => [t.id, t.title]));
  // A task whose steps are open is offered through them, not as a whole.
  const heldBySteps = new Set(tasks.filter((t) => t.parentId && t.done !== "true" && titleOf.has(t.parentId)).map((t) => t.parentId));
  for (const t of tasks) {
    if (t.done === "true" || heldBySteps.has(t.id)) continue;
    const step = t.nextStep ?? (t.parentId ? t.title : null);
    const parentTitle = t.parentId ? titleOf.get(t.parentId) ?? null : null;
    const est = t.estMinutes ?? null;
    const timeOk = step ? true : est != null ? est <= (opts.slot === 60 ? 600 : opts.slot) : null;
    if (timeOk === null) { unclarified++; continue; }
    if (!timeOk) continue;
    // An energy nobody set is not guessed at: it passes the filter.
    if (t.energy && (ENERGY_RANK[t.energy] ?? 1) > ENERGY_RANK[opts.energy]) continue;
    if (opts.place !== "anywhere" && t.context && t.context !== "anywhere" && t.context !== opts.place) continue;
    const why: string[] = [];
    if (t.dueDate && t.dueDate < opts.today) why.push("past its date");
    else if (t.dueDate === opts.today) why.push("due today");
    if (!step && est != null) why.push(`about ${est >= 60 ? `${Math.round(est / 60)} h` : `${est} min`}`);
    if (opts.hourRuler && t.planet === opts.hourRuler) why.push(`the ${opts.hourRuler} hour suits it`);
    fit.push({ task: t, step, parentTitle, why });
  }
  const rank = (x: { task: FitTask; step: string | null }) => [
    x.step ? 0 : 1,
    x.task.dueDate && x.task.dueDate <= opts.today ? 0 : 1,
    opts.hourRuler && x.task.planet === opts.hourRuler ? 0 : 1,
    (x.task.estMinutes ?? 5) <= 15 ? 0 : 1,
    x.task.sortOrder ?? 0,
  ];
  fit.sort((a, b) => { const ra = rank(a), rb = rank(b); for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i]; return a.task.id - b.task.id; });
  return { fit, unclarified };
}

const chip = (on: boolean) => ({
  fontSize: 11.5, padding: "4px 11px", borderRadius: 14, cursor: "pointer",
  border: on ? "1.5px solid #1a2a3a" : "1px solid var(--color-border)",
  background: on ? "#1a2a3a10" : "var(--color-card-2)",
  color: on ? "var(--color-foreground)" : "var(--text-3)", fontWeight: on ? 600 : 400,
}) as const;
const rowLabel = { fontSize: 10.5, textTransform: "uppercase" as const, letterSpacing: "0.5px", color: "var(--text-3)", fontWeight: 600, minWidth: 58 };

export default function FitsNow({ tasks, habits = [], today, hourRuler, onStart, onOpenTasks }: {
  tasks: FitTask[];
  habits?: FitHabit[];
  today: string;
  /** The planetary hour's ruler, only when the sky is shown. */
  hourRuler?: string | null;
  onStart?: (title: string) => void;
  onOpenTasks?: () => void;
}) {
  const [slot, setSlot] = useState<Slot>(30);
  const [energy, setEnergy] = useState<Energy>("medium");
  const [place, setPlace] = useState("anywhere");
  const { fit, unclarified } = fitsNow(tasks, { slot, energy, place, today, hourRuler });
  const [allKeepings, setAllKeepings] = useState(false);
  // Every practice not yet kept today is offered; past three, the rest wait
  // behind a count rather than being dropped.
  const unkept = habits.filter((h) => !h.doneToday && (h.status ?? "active") === "active");
  const keepings = allKeepings ? unkept : unkept.slice(0, 3);
  const moreKeepings = unkept.length - keepings.length;
  const shown = fit.slice(0, 5);

  return (
    <section aria-labelledby="fits-now-title" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "14px 16px" }}>
      <h2 id="fits-now-title" style={{ font: "600 13px/1.3 var(--font-sans)", margin: "0 0 10px", color: "var(--color-foreground)" }}>What fits now</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={rowLabel}>Time</span>
          {([[15, "15 min"], [30, "30 min"], [60, "an hour or more"]] as const).map(([v, l]) => <button key={v} aria-pressed={slot === v} style={chip(slot === v)} onClick={() => setSlot(v)}>{l}</button>)}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={rowLabel}>Energy</span>
          {([["low", "low"], ["medium", "some"], ["high", "plenty"]] as const).map(([v, l]) => <button key={v} aria-pressed={energy === v} style={chip(energy === v)} onClick={() => setEnergy(v)}>{l}</button>)}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={rowLabel}>Where</span>
          {[{ key: "anywhere", label: "anywhere" }, ...PLACES.filter((p) => p.key !== "anywhere")].map((p) => <button key={p.key} aria-pressed={place === p.key} style={chip(place === p.key)} onClick={() => setPlace(p.key)}>{p.label}</button>)}
        </div>
      </div>

      {shown.length === 0 ? (
        <p style={{ margin: "0 0 6px", fontSize: 13, color: "var(--text-2)" }}>Nothing you hold fits {slot === 60 ? "an hour" : `${slot} minutes`} and {energy === "low" ? "low" : energy === "medium" ? "some" : "plenty of"} energy{place !== "anywhere" ? `, ${PLACES.find((p) => p.key === place)?.label}` : ""}.</p>
      ) : (
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {shown.map(({ task, step, parentTitle, why }) => (
            <li key={task.id} style={{ display: "flex", gap: 10, alignItems: "baseline", borderTop: "1px solid var(--color-border)", paddingTop: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: "var(--color-foreground)" }}>{task.parentId ? task.title : step ?? task.title}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 1 }}>
                  {[parentTitle ?? (task.nextStep ? task.title : null), ...why].filter(Boolean).join(" · ")}
                </div>
              </div>
              {onStart && (
                <button onClick={() => onStart(parentTitle ? `${parentTitle}: ${task.title}` : task.nextStep ? `${task.title}: ${task.nextStep}` : task.title)}
                  style={{ fontSize: 11, padding: "4px 11px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-primary)", cursor: "pointer", flexShrink: 0 }}>
                  Start
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      {keepings.length > 0 && (
        <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--text-2)" }}>
          Or a keeping: {keepings.map((h) => energy === "low" && h.minimumViable ? `${h.name} (${h.minimumViable})` : h.name).join(", ")}
          {moreKeepings > 0
            ? <>, and <button onClick={() => setAllKeepings(true)} style={{ fontSize: 12.5, padding: 0, border: "none", background: "none", color: "var(--color-primary)", cursor: "pointer", textDecoration: "underline" }}>{moreKeepings} more</button>.</>
            : "."}
        </p>
      )}
      {unclarified > 0 && (
        <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--text-3)" }}>
          {unclarified === 1 ? "One task has" : `${unclarified} tasks have`} no next step or length yet, so {unclarified === 1 ? "it isn’t" : "they aren’t"} counted.{" "}
          {onOpenTasks && <button onClick={onOpenTasks} style={{ fontSize: 11.5, padding: 0, border: "none", background: "none", color: "var(--color-primary)", cursor: "pointer", textDecoration: "underline" }}>Open Tasks</button>}
        </p>
      )}
    </section>
  );
}
