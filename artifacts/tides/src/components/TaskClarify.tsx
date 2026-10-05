import { useState } from "react";

/**
 * SORTING WHAT YOU HOLD, one task at a time (plan Part B: T1, T2, T4, T5).
 *
 * Opens under a task row. Three questions, each answerable in one tap or one
 * line, none required:
 *
 *   Next step   the smallest physical action ("open the herbs book to p. 231").
 *               Finishing a step records it as worked on (a touch, the same
 *               record the session timer writes) and asks what comes next.
 *   Where       home, out, at the computer, on the phone, anywhere.
 *   Park it     someday (out of every list until you look), or waiting on
 *               someone, with a date to look again.
 *
 * A suggested step is shown in the field and saved only when you save it.
 */
export interface ClarifyTask {
  id: number;
  title: string;
  nextStep?: string | null;
  context?: string | null;
  parkedAs?: string | null;
  waitingOn?: string | null;
  checkBackOn?: string | null;
  parentId?: number | null;
  done?: string;
}

export type TaskPatch = Partial<Pick<ClarifyTask, "nextStep" | "context" | "parkedAs" | "waitingOn" | "checkBackOn">>;

export const PLACES: { key: string; label: string }[] = [
  { key: "home", label: "at home" },
  { key: "out", label: "out" },
  { key: "computer", label: "at the computer" },
  { key: "phone", label: "on the phone" },
  { key: "anywhere", label: "anywhere" },
];
export const placeLabel = (k: string | null | undefined) => PLACES.find((p) => p.key === k)?.label ?? k ?? "";

const small = { fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--text-2)", cursor: "pointer" } as const;
const primary = { ...small, background: "#1a2a3a", color: "#ffffff", border: "none" } as const;
const text = { fontSize: 11, padding: 0, border: "none", background: "none", color: "var(--color-primary)", cursor: "pointer", textDecoration: "underline" } as const;
const label = { fontSize: 10.5, textTransform: "uppercase" as const, letterSpacing: "0.5px", color: "var(--text-3)", fontWeight: 600, minWidth: 64 };
const input = { flex: 1, minWidth: 160, padding: "6px 9px", borderRadius: 6, border: "1px solid var(--color-border)", fontSize: 12.5, background: "var(--color-card-2)", color: "var(--color-foreground)" };

export default function TaskClarify({ task, testerId, onPatch, onStepDone, onFinish, steps, onAddSteps, onToggleStep }: {
  task: ClarifyTask;
  testerId: string | null;
  onPatch: (fields: TaskPatch) => void;
  /** Records the current step as worked on. */
  onStepDone: (step: string) => void;
  /** Marks the whole task done. */
  onFinish: () => void;
  /** The task's steps (child tasks), when it has any (T3). */
  steps?: ClarifyTask[];
  /** Creates child tasks with these titles. Absent for a task that is itself a step. */
  onAddSteps?: (titles: string[]) => void;
  onToggleStep?: (id: number, done: boolean) => void;
}) {
  const [proposal, setProposal] = useState<{ title: string; keep: boolean }[] | null>(null);
  const [breaking, setBreaking] = useState(false);
  const [breakNote, setBreakNote] = useState<string | null>(null);
  const [newStep, setNewStep] = useState("");
  const breakDown = async () => {
    setBreaking(true);
    setBreakNote(null);
    try {
      const r = await fetch(`/api/tasks/${task.id}/steps-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) },
      });
      const d = await r.json().catch(() => null);
      if (r.ok && Array.isArray(d?.steps) && d.steps.length) setProposal(d.steps.map((t: string) => ({ title: t, keep: true })));
      else setBreakNote(r.status === 503 ? "Suggestions aren’t available right now, so steps go in one at a time below." : "No steps came back this time, so they go in one at a time below.");
    } catch {
      setBreakNote("No steps came back this time, so they go in one at a time below.");
    } finally {
      setBreaking(false);
    }
  };
  const hasSteps = (steps?.length ?? 0) > 0;
  const [draft, setDraft] = useState(task.nextStep ?? "");
  const [editing, setEditing] = useState(!task.nextStep);
  const [askNext, setAskNext] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestNote, setSuggestNote] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [who, setWho] = useState(task.waitingOn ?? "");
  const [lookAgain, setLookAgain] = useState(task.checkBackOn ?? "");

  const saveStep = (step: string) => {
    const v = step.trim();
    onPatch({ nextStep: v || null });
    setDraft(v);
    setEditing(!v);
    setAskNext(false);
    setSuggestNote(null);
  };

  const suggest = async () => {
    setSuggesting(true);
    setSuggestNote(null);
    try {
      const r = await fetch(`/api/tasks/${task.id}/next-step-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) },
      });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.suggestion) { setDraft(d.suggestion); setSuggestNote("A suggestion, yours to change or save."); }
      else setSuggestNote(r.status === 503 ? "Suggestions aren’t available right now." : "No suggestion came back this time.");
    } catch {
      setSuggestNote("No suggestion came back this time.");
    } finally {
      setSuggesting(false);
    }
  };

  if (task.parkedAs) {
    return (
      <div style={{ padding: "2px 0 10px 34px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12, color: "var(--text-2)" }}>
        <span>
          {task.parkedAs === "waiting"
            ? <>Waiting on {task.waitingOn || "someone"}{task.checkBackOn ? `, look again ${new Date(`${task.checkBackOn}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}.</>
            : <>Parked for someday.</>}
        </span>
        <button style={small} onClick={() => onPatch({ parkedAs: null })}>Back in play</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "4px 0 12px 34px", display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Steps inside the task (T3). When a task has them, its next step is
          its first open one, so the single next-step field steps aside. */}
      {onAddSteps && (hasSteps || proposal || breakNote) && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
          <span style={{ ...label, paddingTop: 3 }}>Steps</span>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5, minWidth: 200 }}>
            {(steps ?? []).map((st, i) => {
              const done = st.done === "true";
              const isNext = !done && (steps ?? []).findIndex((x) => x.done !== "true") === i;
              return (
                <label key={st.id} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 12.5, color: done ? "var(--text-3)" : "var(--color-foreground)", cursor: "pointer" }}>
                  <input type="checkbox" checked={done} onChange={() => onToggleStep?.(st.id, !done)} style={{ accentColor: "#1a2a3a" }} />
                  <span style={{ textDecoration: done ? "line-through" : "none", fontWeight: isNext ? 600 : 400 }}>{st.title}</span>
                  {isNext && <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>next</span>}
                </label>
              );
            })}
            {proposal && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "6px 8px", border: "1px dashed var(--color-border)", borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>Suggested steps, with any you uncheck left out.</span>
                {proposal.map((p, i) => (
                  <label key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, opacity: p.keep ? 1 : 0.45, cursor: "pointer" }}>
                    <input type="checkbox" checked={p.keep} onChange={(e) => setProposal((ps) => ps && ps.map((x, j) => j === i ? { ...x, keep: e.target.checked } : x))} style={{ accentColor: "#1a2a3a" }} />
                    {p.title}
                  </label>
                ))}
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={primary} disabled={!proposal.some((p) => p.keep)} onClick={() => { onAddSteps(proposal.filter((p) => p.keep).map((p) => p.title)); setProposal(null); }}>
                    Add {proposal.filter((p) => p.keep).length} step{proposal.filter((p) => p.keep).length === 1 ? "" : "s"}
                  </button>
                  <button style={text} onClick={() => setProposal(null)}>Cancel</button>
                </div>
              </div>
            )}
            {breakNote && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{breakNote}</span>}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <input value={newStep} onChange={(e) => setNewStep(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newStep.trim()) { onAddSteps([newStep.trim()]); setNewStep(""); } }} placeholder="add a step" style={input} />
              <button style={newStep.trim() ? primary : small} disabled={!newStep.trim()} onClick={() => { onAddSteps([newStep.trim()]); setNewStep(""); }}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Next step */}
      {!hasSteps && !proposal && !breakNote && (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <span style={{ ...label, paddingTop: 6 }}>Next step</span>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, minWidth: 200 }}>
          {askNext ? (
            <>
              <span style={{ fontSize: 12, color: "var(--text-2)" }}>Logged as worked on; what’s the next step?</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && draft.trim() && saveStep(draft)} placeholder="the next thing you’d physically do" style={input} />
                <button style={draft.trim() ? primary : small} disabled={!draft.trim()} onClick={() => saveStep(draft)}>Save</button>
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <button style={text} onClick={() => { onFinish(); setAskNext(false); }}>That finishes it</button>
                <button style={text} onClick={() => saveStep("")}>No next step yet</button>
              </div>
            </>
          ) : editing ? (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && draft.trim() && saveStep(draft)} placeholder="the first thing you’d physically do" style={input} />
                <button style={draft.trim() ? primary : small} disabled={!draft.trim()} onClick={() => saveStep(draft)}>Save</button>
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
                <button style={text} disabled={suggesting} onClick={suggest}>{suggesting ? "Thinking of one…" : "Suggest one"}</button>
                {task.nextStep && <button style={text} onClick={() => { setDraft(task.nextStep ?? ""); setEditing(false); setSuggestNote(null); }}>Cancel</button>}
                {suggestNote && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{suggestNote}</span>}
              </div>
            </>
          ) : (
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "var(--color-foreground)" }}>{task.nextStep}</span>
              <button style={small} onClick={() => { onStepDone(task.nextStep!); setDraft(""); setAskNext(true); }}>Did it</button>
              <button style={text} onClick={() => setEditing(true)}>Change</button>
            </div>
          )}
        </div>
      </div>

      )}
      {onAddSteps && !hasSteps && !proposal && (
        <div style={{ paddingLeft: 74, marginTop: -4 }}>
          <button style={text} disabled={breaking} onClick={breakDown}>{breaking ? "Breaking it down…" : "Break it into steps"}</button>
        </div>
      )}

      {/* Where */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={label}>Where</span>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {PLACES.map((p) => {
            const on = task.context === p.key;
            return (
              <button key={p.key} aria-pressed={on} onClick={() => onPatch({ context: on ? null : p.key })}
                style={{ ...small, padding: "3px 10px", borderRadius: 14, border: on ? "1.5px solid #1a2a3a" : small.border, fontWeight: on ? 600 : 400, color: on ? "var(--color-foreground)" : "var(--text-3)" }}>
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Park it */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={label}>Park it</span>
        {!waiting ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button style={small} onClick={() => onPatch({ parkedAs: "someday" })}>Someday</button>
            <button style={small} onClick={() => setWaiting(true)}>Waiting on someone</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <input autoFocus value={who} onChange={(e) => setWho(e.target.value)} placeholder="who" aria-label="Who you're waiting on" style={{ ...input, flex: "0 1 160px", minWidth: 120 }} />
            <label style={{ fontSize: 11, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 5 }}>
              look again
              <input type="date" value={lookAgain} onChange={(e) => setLookAgain(e.target.value)} style={{ ...input, flex: "0 0 auto", minWidth: 0 }} />
            </label>
            <button style={primary} onClick={() => { onPatch({ parkedAs: "waiting", waitingOn: who.trim() || null, checkBackOn: lookAgain || null }); setWaiting(false); }}>Park</button>
            <button style={text} onClick={() => setWaiting(false)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
