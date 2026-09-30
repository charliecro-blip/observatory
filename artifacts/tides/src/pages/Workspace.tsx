import React, { useState, useEffect, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/useIsMobile";
import GuidingStarsHub from "@/pages/GuidingStarsHub";
import BearingsCard from "@/components/BearingsCard";
import Tasks from "@/pages/Tasks";
import Habits from "@/pages/Habits";
import { parseWhen, formatDueChip } from "@/lib/parseWhen";
import { localToday, addDaysLocal } from "@/lib/dates";
import { useDialog } from "@/hooks/useDialog";

/**
 * The workspace's own pages, shared by both shells: the old WorkspaceShell
 * (everyone outside the timing-search cohort) and the Find-a-time shell, which
 * shows them under its own header since the density pass (2026-09-30, W5).
 * Moved out of App.tsx so FindTime can import them without a cycle.
 */
export type WorkTab = "overview" | "tasks" | "habits" | "bearings";

export function WorkPage({ testerId, now, lat, lon, seedElement, onSeedConsumed, focusStarId, onFocusConsumed, onOpenSettings, onLeaveWork, seedTab, onSeedTabConsumed, tab: controlledTab, onTabChange }: { testerId: string|null; now: any; lat: number; lon: number; seedElement?: string|null; onSeedConsumed?: ()=>void; focusStarId?: number|null; onFocusConsumed?: ()=>void; onOpenSettings?: ()=>void; onLeaveWork?: (v: string)=>void; seedTab?: WorkTab|null; onSeedTabConsumed?: ()=>void;
  /** Set by a host that draws its own tabs (the Find-a-time shell); the
   *  page's own tab bar is then left out. */
  tab?: WorkTab; onTabChange?: (t: WorkTab) => void }) {
  const [ownTab, setOwnTab] = useState<WorkTab>("overview");
  const tab = controlledTab ?? ownTab;
  const setTab = (t: WorkTab) => { if (onTabChange) onTabChange(t); else setOwnTab(t); };
  // Arriving from a summary elsewhere in the app (Home's habit progress, for
  // one) lands on the sub-tab that owns the detail. Without this a door
  // labelled "All habits →" put you on Guiding Stars, which is the kind of
  // small lie that teaches people not to trust the links.
  useEffect(() => {
    if (!seedTab) return;
    setTab(seedTab);
    onSeedTabConsumed?.();
  }, [seedTab, onSeedTabConsumed]);
  // Arriving with an element seed (from the Almanac reference) always lands on
  // Guiding Stars, where the pre-filled creation form opens.
  useEffect(() => { if (seedElement) setTab("overview"); }, [seedElement]);
  useEffect(() => { if (focusStarId != null) setTab("overview"); }, [focusStarId]);
  // Guiding Stars leads (the why), then the two daily-doing axes (tasks,
  // habits). Currents (long-cycle context) is now a header at the top.
  const narrow = useIsMobile();
  const TABS: {id:WorkTab; label:string}[] = [
    {id:"overview",  label:"Guiding Stars"},
    {id:"tasks",     label:"Tasks"},
    {id:"habits",    label:"Habits"},
    // Its own room (owner 2026-08-21: the card above every tab was "still
    // really prominent"; the ask was to expand it, not to bury it). Here it
    // can be as long as it needs to be, and the Stars overview gets its
    // first screen back.
    {id:"bearings",  label:"Your Bearings"},
  ];
  return (
    <div style={{flex:1, display:"flex", flexDirection:"column", overflow:"hidden"}}>
      {/* SUB-TAB BAR — one row, always.
          At 390px the four labels wrapped, so Stars opened with two rows of
          navigation stacked above a page that already carries the bottom bar:
          three bands of chrome before a word of content. The labels are not
          shortened — "Guiding Stars" is the name of the thing, and one name per
          concept is worth more than the pixels — so instead the row refuses to
          wrap, tightens its padding on a phone, and scrolls if it must. */}
      {!controlledTab && <div style={{
        display:"flex", borderBottom:"1px solid var(--color-border)",
        background: "var(--color-rail)", flexShrink:0,
        padding: narrow ? "0 8px" : "0 20px",
        flexWrap:"nowrap", overflowX:"auto", scrollbarWidth:"none",
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: narrow ? "10px 10px" : "10px 18px",
            whiteSpace:"nowrap", flexShrink:0,
            border:"none", background:"none", cursor:"pointer",
            fontSize:12, fontWeight: tab===t.id ? 600 : 400,
            color: tab===t.id ? "var(--color-foreground)" : "var(--color-muted)",
            borderBottom: tab===t.id ? "2px solid #1a2a3a" : "2px solid transparent",
            marginBottom:-1,
          }}>{t.label}</button>
        ))}
      </div>}
      <div style={{flex:1, overflow:"auto", display:"flex", flexDirection:"column", padding:"16px 20px"}}>
        {/* Tab content — inherits flex from parent, scrollable together with header */}
        {tab==="bearings"  && <BearingsCard testerId={testerId} onOpenSettings={onOpenSettings} expanded onNavigate={setTab} />}
        {tab==="overview"  && <GuidingStarsHub testerId={testerId} lat={lat} lon={lon} onNavigate={setTab} seedElement={seedElement} onSeedConsumed={onSeedConsumed} focusStarId={focusStarId} onFocusConsumed={onFocusConsumed}/>}
        {tab==="tasks"     && <Tasks    testerId={testerId} now={now} lat={lat} lon={lon}/>}
        {tab==="habits"    && <Habits   testerId={testerId} now={now} lat={lat} lon={lon} onNavigate={onLeaveWork}/>}
      </div>
    </div>
  );
}

const WINDOW_TYPES = [
  "deep_work","creative","planning","admin","social","relationship","recovery","study","launch","retreat",
];
const WINDOW_LABELS: Record<string,string> = {
  deep_work:"Deep work",creative:"Creative",planning:"Planning",admin:"Admin",
  social:"Social",relationship:"Relationship",recovery:"Recovery",study:"Study",launch:"Launch",retreat:"Retreat",
};

export function QuickCapture({ testerId, onClose, onDumpToPlanner }: { testerId: string|null; onClose: () => void; onDumpToPlanner: (text: string) => void }) {
  const { ref, props } = useDialog(onClose, "Add a task");
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [windowType, setWindowType] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(false);
  // ONE DOOR, FOUR EXITS (loyalty audit 2026-08-18, C1). Eight nouns can hold
  // "meditate", and nobody carries that taxonomy on day three — so the person
  // says the thing and picks its direction, and Compass files it: "to do" →
  // a task, "did" → a win, "keep doing" → a habit, "for a stretch" → a
  // sprint. The distinctions live in the verbs, not in a glossary.
  const [mode, setMode] = useState<"todo" | "did" | "habit" | "sprint">("todo");
  // Habit lines are scored only against the rhythm chosen here; sprint lines
  // all share one window.
  const [cadence, setCadence] = useState("most_days");
  const [sprintDays, setSprintDays] = useState(7);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // One task per non-empty line, so a single capture can be a whole brain-dump.
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // Lines whose parsed date the user has waved off, keyed by the raw text
  // rather than by row index — indices shift as you type above a line, which
  // would silently move a rejection onto someone else's task. Keying by text
  // also means editing a line re-offers the date, which is right: the words
  // changed, so the old refusal no longer refers to anything.
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const today = localToday();

  const parsed = useMemo(() => lines.map(raw => {
    const p = parseWhen(raw, today);
    const off = rejected.has(raw);
    return {
      raw,
      title: off ? raw : p.title,
      dueDate: off ? null : p.dueDate,
      // Kept even when rejected, so the row can offer the date back.
      offered: p.dueDate,
      off,
    };
  }), [text, rejected, today]);

  const dated = parsed.filter(p => p.offered);

  async function addAll() {
    if (lines.length === 0 || !testerId) return;
    setAdding(true);
    setAddError(false);
    try {
      const results = await Promise.all(parsed.map(p => fetch("/api/tasks", {
        method: "POST",
        headers: { "x-tester-id": testerId, "Content-Type": "application/json" },
        // `?? undefined` and not `?? null`: the column is nullable and the
        // route spreads the body straight into the insert, so an explicit null
        // and an absent key mean the same thing here — but undefined keeps the
        // payload honest about what the user actually specified.
        body: JSON.stringify({ title: p.title, dueDate: p.dueDate ?? undefined, bestWindowType: windowType || undefined }),
      })));
      // Was unconditional — a mid-list failure silently dropped that task
      // while the modal still closed on "success" (audit P0 #4).
      if (results.some(r => !r.ok)) { setAddError(true); return; }
      qc.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    } catch {
      setAddError(true);
    } finally {
      setAdding(false);
    }
  }

  // The non-task exits share addAll's failure honesty: a mid-list failure
  // keeps the sheet open and says so.
  async function submitLines(makeRequest: (line: string) => Promise<Response>, invalidate: string[]) {
    if (lines.length === 0 || !testerId) return;
    setAdding(true);
    setAddError(false);
    try {
      const results = await Promise.all(lines.map(makeRequest));
      if (results.some(r => !r.ok)) { setAddError(true); return; }
      for (const key of invalidate) qc.invalidateQueries({ queryKey: [key] });
      onClose();
    } catch {
      setAddError(true);
    } finally {
      setAdding(false);
    }
  }
  const H = { "x-tester-id": testerId ?? "", "Content-Type": "application/json" };
  // "Did": each line becomes a win dated today.
  const logAll = () => submitLines(
    l => fetch("/api/planning/wins", { method: "POST", headers: H, body: JSON.stringify({ text: l, tz: new Date().getTimezoneOffset() }) }),
    ["momentum"]);
  // "Keep doing": each line becomes a habit on the chosen rhythm.
  const keepAll = () => submitLines(
    l => fetch("/api/habits", { method: "POST", headers: H, body: JSON.stringify({ name: l, cadence }) }),
    ["habits"]);
  // "For a stretch": each line becomes a sprint sharing one window. The
  // server's three-at-once cap can refuse later lines; the sheet stays open
  // and says some didn't save rather than pretending.
  const sprintAll = () => submitLines(
    l => fetch("/api/sprints", { method: "POST", headers: H, body: JSON.stringify({ title: l, endDate: addDaysLocal(localToday(), sprintDays - 1), tz: new Date().getTimezoneOffset() }) }),
    ["sprints"]);
  const submitFor = { todo: addAll, did: logAll, habit: keepAll, sprint: sprintAll };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: "var(--z-sheet)",
      display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 120,
      padding: "120px 16px 16px",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      {/* Was a fixed 440px with no maxWidth — the Add button sat off-screen on
          a 390px phone, making quick capture unusable on mobile (audit P0 #7). */}
      <div ref={ref} {...props} style={{
        background: "var(--color-card)", borderRadius: 14, padding: "20px 22px", width: 440, maxWidth: "100%",
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)", border: "1px solid var(--color-border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>Quick capture</div>
          <div style={{ display: "flex", background: "var(--color-card-2)", borderRadius: 7, padding: 2, gap: 1, flexWrap: "wrap" }}>
            {([["todo", "To do"], ["did", "Did"], ["habit", "Keep doing"], ["sprint", "For a stretch"]] as const).map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)} style={{
                fontSize: 10.5, padding: "2px 10px", borderRadius: 5, border: "none", cursor: "pointer",
                background: mode === m ? "var(--color-card)" : "transparent",
                color: mode === m ? "var(--color-foreground)" : "var(--text-3)",
                fontWeight: mode === m ? 600 : 400,
              }}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 10.5, color: "var(--text-3)", marginBottom: 10 }}>
          {mode === "todo" ? "One thing per line — dump as many as you like. Say when, and it'll be read as a due date."
            : mode === "did" ? "One thing per line — each goes in today's log, planned or not."
            : mode === "habit" ? "One per line — each becomes a habit, scored only against the rhythm you pick."
            : "One per line — each becomes a sprint with a hard end date. Three can run at once."}
        </div>
        <textarea ref={inputRef} value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitFor[mode](); if (e.key === "Escape") onClose(); }}
          placeholder={mode === "todo" ? "reply to the landlord\ngo for a 45 min run\nbrainstorm names for the launch\ncall mom"
            : mode === "did" ? "cleared the inbox\nran 40 minutes\nfixed the gate latch"
            : mode === "habit" ? "morning walk\nread before bed"
            : "no sugar\nten cold calls"}
          rows={4}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 13.5, lineHeight: 1.6, background: "var(--color-card-2)", marginBottom: 10, resize: "vertical", fontFamily: "inherit", color: "var(--color-foreground)" }}
        />
        {/* Live parse preview. Shows ONLY the lines a date was found in — the
            textarea above already shows everything else, and repeating it would
            turn a small confirmation into a second copy of the input.
            What it must make visible is the part the user can't see coming:
            that some of their words are about to leave the title. */}
        {mode === "todo" && dated.length > 0 && (
          <div style={{
            marginBottom: 10, padding: "8px 10px", borderRadius: 8,
            background: "var(--color-card-2)", border: "1px solid var(--color-border)",
          }}>
            {dated.map(p => (
              <div key={p.raw} style={{ display: "flex", gap: 8, alignItems: "center", padding: "2px 0" }}>
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 11.5, lineHeight: 1.5,
                  color: p.off ? "var(--text-3)" : "var(--text-1)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{p.title}</span>
                <button
                  onClick={() => setRejected(prev => {
                    const next = new Set(prev);
                    if (next.has(p.raw)) next.delete(p.raw); else next.add(p.raw);
                    return next;
                  })}
                  title={p.off ? "Read this as a due date after all" : "Keep these words in the title instead"}
                  style={{
                    flexShrink: 0, padding: "2px 8px", borderRadius: 20, fontSize: 10.5, cursor: "pointer",
                    border: "1px solid var(--color-border)",
                    background: p.off ? "transparent" : "var(--color-card)",
                    color: p.off ? "var(--text-3)" : "var(--text-2)",
                    textDecoration: p.off ? "line-through" : "none",
                    fontFamily: "inherit",
                  }}>
                  {formatDueChip(p.offered!, today)}{p.off ? "" : " ×"}
                </button>
              </div>
            ))}
            <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 6, lineHeight: 1.5 }}>
              Tap a date to keep those words in the title instead. Or "quote a phrase" to stop it being read at all.
            </div>
          </div>
        )}
        {/* The mode's one option row: rhythm for habits, window for sprints. */}
        {mode === "habit" && (
          <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "var(--text-3)" }}>rhythm:</span>
            {([["daily", "Every day"], ["most_days", "Most days"], ["weekly", "A few times"], ["occasional", "When it fits"]] as const).map(([c, label]) => (
              <button key={c} onClick={() => setCadence(c)} style={{
                fontSize: 10, padding: "3px 9px", borderRadius: 10, cursor: "pointer",
                border: cadence === c ? "1.5px solid #1a2a3a" : "1px solid var(--color-border)",
                background: cadence === c ? "#1a2a3a10" : "var(--color-card-2)",
                color: cadence === c ? "var(--color-foreground)" : "var(--text-3)",
                fontWeight: cadence === c ? 600 : 400,
              }}>{label}</button>
            ))}
          </div>
        )}
        {mode === "sprint" && (
          <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "var(--text-3)" }}>how long:</span>
            {[3, 5, 7, 10, 14].map(d => (
              <button key={d} onClick={() => setSprintDays(d)} style={{
                fontSize: 10, padding: "3px 9px", borderRadius: 10, cursor: "pointer",
                border: sprintDays === d ? "1.5px solid #1a2a3a" : "1px solid var(--color-border)",
                background: sprintDays === d ? "#1a2a3a10" : "var(--color-card-2)",
                color: sprintDays === d ? "var(--color-foreground)" : "var(--text-3)",
                fontWeight: sprintDays === d ? 600 : 400,
              }}>{d}d</button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {mode === "todo" && <select value={windowType} onChange={e => setWindowType(e.target.value)}
            style={{ flex: 1, minWidth: 140, padding: "7px 10px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 11, color: "var(--text-2)", background: "var(--color-card-2)" }}>
            <option value="">Best time: any</option>
            {WINDOW_TYPES.map(t => <option key={t} value={t}>{WINDOW_LABELS[t]}</option>)}
          </select>}
          {/* Weave capture into scheduling (#15): hand the dump to the Planner,
              which reads each item's nature and finds it a good window. */}
          {mode === "todo" && <button onClick={() => { if (lines.length) { onDumpToPlanner(text); } }} disabled={lines.length === 0}
            title="Send these to the Planner to schedule"
            style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 12, cursor: lines.length ? "pointer" : "default", background: "var(--color-card)", color: lines.length ? "var(--color-foreground)" : "var(--text-3)", fontWeight: 500 }}>
            <span aria-hidden="true">✦</span> Dump &amp; schedule <span aria-hidden="true">→</span>
          </button>}
          {mode !== "todo" && <div style={{ flex: 1 }} />}
          <button onClick={() => submitFor[mode]()} disabled={lines.length === 0 || adding}
            style={{ padding: "7px 16px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 500, cursor: lines.length ? "pointer" : "default", background: lines.length ? "#1a2a3a" : "var(--color-border)", color: lines.length ? "#ffffff" : "var(--text-3)" }}>
            {adding ? "Saving…"
              : mode === "did" ? (lines.length > 1 ? `Log ${lines.length}` : "Log it")
              : mode === "habit" ? (lines.length > 1 ? `Keep ${lines.length}` : "Keep it")
              : mode === "sprint" ? (lines.length > 1 ? `Start ${lines.length}` : "Start it")
              : (lines.length > 1 ? `Add ${lines.length}` : "Add")}
          </button>
        </div>
        {addError && <div style={{ fontSize: 11, color: "#a03030", marginTop: 8 }}>Some of these didn't save — try again.</div>}
      </div>
    </div>
  );
}
