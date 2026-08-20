/**
 * Home — the dashboard you land on.
 *
 * The owner's brief, 2026-08-03: "rather than the Today tab, which is now super
 * busy and a little overwhelming, make the homepage more of a dashboard … the
 * astro might increasingly fade to the back … I actually want to center the
 * Compass and the to-do dump … the really important things are moments of
 * convergence for particular activities, globally and especially personally."
 *
 * So the order here is an argument, not a layout preference:
 *
 *   0. RIGHT NOW        conditional — only when a real condition is gating
 *   1. WHAT LINES UP    timing computed for what you already hold
 *   2. THE DUMP         everything you are holding, in one view
 *   3. GUIDING STARS    visible, not central
 *   4. THE LOG          only once you have actually done something today
 *
 * The picker is NOT the first module. It sat where the page's intelligence
 * belongs and left the actual join — read a task, hold it in your head, scroll
 * up, find it again in a category tree — to the reader, which withheld the
 * product's central claim. It is still essential, and it is still a query
 * interface, so it lives at the bottom of module 1.
 *
 * Home notices. The Compass lets you investigate. Today puts it on the clock.
 *
 * Today keeps the day laid out in time. This page is what you are steering.
 *
 * WHAT IS DELIBERATELY ABSENT
 * ---------------------------------------------------------------------------
 * No tide hero, no woven reading, no standing conditions. The owner's call was
 * that the tide is "a widget right now" and that "there can be different hero
 * moments within a single day" — a single hero curve at the top asserts one
 * shape for the whole day, which is the claim he stopped believing. The sky
 * lives in the left rail and on Today.
 *
 * Customisability is deferred by explicit decision ("customizability can come
 * later"), so the order is fixed rather than stored. Nothing here is
 * per-user-configurable yet, and the code should not pretend otherwise by
 * building a settings shape nobody can reach.
 */

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ElectionPicker } from "@/components/ElectionPicker";
import { useNorthStars, useTidesNow, useTidesWeek } from "@/hooks/useTides";
import { QualityStrip } from "@/components/QualityStrip";
import CroppingUp from "@/components/CroppingUp";
import TideStrip from "@/components/TideStrip";
import DayReading from "@/components/DayReading";
import { UnifiedTideChart } from "@/components/TideWater";
import LunarCycle from "@/components/LunarCycle";
import { ELEMENT_COLORS, CHARACTER_ELEMENT, type TideCharacter } from "@/lib/elements";
import MomentsAhead from "@/components/MomentsAhead";
import DayConditions from "@/components/DayConditions";
import AngleCrossing from "@/components/AngleCrossing";
import { useFold, FoldToggle, FoldedSummary, Fold } from "@/components/ModuleFold";
import { NotificationOptIn } from "@/components/NotificationOptIn";
import WhereYouAre from "@/components/WhereYouAre";
import Sprints from "@/components/Sprints";
import AskDoors from "@/components/AskDoors";
import { fetchJson, HttpError } from "@/lib/fetchJson";
import { localToday } from "@/lib/dates";
import { touchLine, type TouchTrail } from "@/lib/touches";
import { parseWhen } from "@/lib/parseWhen";
import { useTester } from "@/contexts/tester-context";
import { CommittedWeekStrip, useCommittedWeek } from "@/components/WeekCommitted";
import { ReviewCard } from "@/components/Momentum";
import NewMoonCheckIn, { turningPointPromptOpen } from "@/components/NewMoonCheckIn";
import RareMomentBanner from "@/components/RareMomentBanner";
import DayAhead from "@/components/DayAhead";
import { useUiDensity, useAstroDetail, usePreferences } from "@/contexts/preferences-context";
import { useHomeData, type Task, type LinesUpResult } from "@/hooks/useHomeData";
import RitualCard from "@/components/RitualCard";
import { ritualPhase } from "@/lib/chronotype";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { AskElectionContext } from "@/App";


// `overflow: hidden` used to be here, to keep the group rows' full-bleed
// dividers inside the rounded corners. It also CLIPPED the Compass — the
// activity picker is taller than its parent expected, so the last row of
// pills ("Intimacy & sex") was cut off at the card edge with no scrollbar and
// no hint that anything was missing. Rounded corners are not worth silently
// eating content; the rows clip themselves instead, below.






const card: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
};

// A column has a comfortable measure. Task rows were running the full 1250px
// of a desktop window with a 15px checkbox stranded at the far left, so the
// eye had to cross the screen to get from the control to the text. This is
// what made a correct list feel awkward.
const COLUMN_MAX = 760;

/** ISO instant → the viewer's wall clock. The API returns instants. */
const clockOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/**
 * THREE LEVELS, NOT FOUR EQUAL PANELS.
 *
 * The page read as "here are four features" because every module was the same
 * white rounded rectangle with the same heading, padding and border — the
 * product's primary intelligence carried exactly as much visual weight as an
 * empty task input. There are three jobs here and they should not look alike:
 *
 *   ANSWER   what lines up — the reason to open Compass
 *   WORK     what you hold, and the action that acts on it
 *   CONTEXT  the week, the stars, the log
 */
/**
 * Both levels carry `flexShrink: 0`, and it is load-bearing rather than
 * defensive. Home's root is a flex column, so every card is a flex item — and
 * a flex item's automatic minimum size (the floor that normally stops it
 * shrinking below its own content) applies ONLY while its overflow is
 * `visible`. The hero sets `overflow: hidden` to clip the gradient seam to its
 * rounded corners, which silently switches that floor off: the card collapsed
 * to 1.67px while its 350px of children painted over the grid below it, and
 * the page read as though the hero had failed to render at all. Cards without
 * `overflow` were unaffected, which is what made it look like a hero bug.
 */
const ANSWER: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 14,
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  flexShrink: 0,
};
const PANEL: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  flexShrink: 0,
};

/**
 * Badge colours are HEX, never CSS variables.
 *
 * The tint is built by concatenating an alpha suffix — `${color}16` — and
 * `var(--text-3)16` is not a colour. It fails SILENTLY to transparent, so the
 * badges rendered as bare uppercase text and the judgment the hero exists to
 * show became invisible. The dark-mode sweep hit this exact trap across 134
 * sites and settled on hex for the same reason; this is that rule, re-learned.
 *
 * Green is reserved for actual convergence and used nowhere decoratively.
 */
const CONVERGENT = "#3f7a4a";
const QUALIFIED = "#a08040";
const PERSONAL = "#6f6a90";
const NEUTRAL = "#8a8780";

/**
 * Where a window sits relative to NOW, in words.
 *
 * The hero read "Today, 9:14 PM–10:06 PM" identically at seven in the morning
 * and at twenty past nine at night. Those are different pieces of information —
 * one is a plan and one is an instruction — and the owner's note was that the
 * page should answer for the MOMENT, not only for the day.
 *
 * The part of day is named rather than the raw clock where that reads more
 * naturally: people orient by "this evening", not by 21:14.
 */
function partOfDay(d: Date): string {
  const h = d.getHours();
  if (h < 5) return "tonight";
  if (h < 12) return "this morning";
  if (h < 14) return "around midday";
  if (h < 18) return "this afternoon";
  if (h < 22) return "this evening";
  return "tonight";
}

/**
 * "1 hr 7 min", not "1.1 hours".
 *
 * Decimal hours are a unit the reader has to convert before they can act, and
 * the conversion is the whole point of showing the length at all — someone
 * deciding whether a window fits a piece of work needs minutes, not tenths.
 */
function durationPhrase(mins: number): string {
  if (mins < 60) return `${mins} minutes`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h} hr${h === 1 ? "" : "s"}${m ? ` ${m} min` : ""}`;
}

/** A coarse distance in time. Deliberately rounded — nobody acts on "in 187 min". */
function roughGap(mins: number): string {
  if (mins < 60) return `${Math.max(1, mins)} min`;
  const h = Math.round(mins / 60);
  return `${h} hour${h === 1 ? "" : "s"}`;
}

/**
 * The hero's window, as label / clock / meta / elapsed.
 *
 * THE CLOCK LEADS AND THE PHRASE BECOMES THE LABEL. The reverse — giving the
 * moment-relative phrase the display size and demoting the times — reads
 * better in four of the five moments and worse in the one that matters: while
 * a window is open, "Open now" is a weaker headline than the time you have
 * left in it. Since the open case is the only one someone acts on immediately,
 * it decides the layout for all five.
 *
 * The clock itself changes shape when open: the start time has stopped being
 * actionable, so it becomes "until 6:10 PM" rather than "5:19–6:10 PM".
 *
 * A passed window keeps its size and loses its ink. It is history, not an
 * error — shrinking it, hiding it or colouring it amber would all make a
 * finished window look like a fault.
 */
function momentBlock(r: { state: string; startAt: string; endAt: string; startClock: string; endClock: string; allDay: boolean }) {
  const now = Date.now();
  const startMs = Date.parse(r.startAt), endMs = Date.parse(r.endAt);
  const mins = Math.round((endMs - startMs) / 60000);

  if (r.allDay) return { label: "TODAY", clock: "All day", meta: "supported start to finish", elapsed: null };

  if (r.state === "open-now") {
    const left = Math.max(0, Math.round((endMs - now) / 60000));
    return {
      label: "OPEN NOW",
      clock: `until ${r.endClock}`,
      meta: `${durationPhrase(mins)} · ${left} left`,
      // The one place a progress bar is honest: it measures a window that is
      // actually running, against two instants the engine supplied.
      elapsed: Math.min(1, Math.max(0, (now - startMs) / (endMs - startMs))),
    };
  }
  if (r.state === "passed") {
    return {
      label: "PASSED",
      clock: `${r.startClock}–${r.endClock}`,
      meta: `${durationPhrase(mins)} · ended ${roughGap(Math.round((now - endMs) / 60000))} ago`,
      elapsed: null,
    };
  }

  const until = Math.round((startMs - now) / 60000);
  if (until <= 90) {
    return { label: `IN ${roughGap(until).toUpperCase()}`, clock: `${r.startClock}–${r.endClock}`, meta: durationPhrase(mins), elapsed: null };
  }
  return {
    // partOfDay rather than a flat "LATER TODAY": "this evening" and "around
    // midday" are the terms people actually orient by, and the label slot is
    // wide enough to carry them.
    label: partOfDay(new Date(startMs)).toUpperCase(),
    clock: `${r.startClock}–${r.endClock}`,
    meta: `${durationPhrase(mins)} · starts in ${roughGap(until)}`,
    elapsed: null,
  };
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase",
      padding: "3px 9px", borderRadius: 999, color, background: `${color}18`,
      border: `1px solid ${color}33`, whiteSpace: "nowrap",
    }}>{text}</span>
  );
}

/**
 * Every module's header, and — when given a `fold` id — the place its fold
 * control lives (audit §7).
 *
 * The header is the ONLY thing a folded module leaves on the page, beside the
 * summary. Putting the control here rather than on each card means a module
 * cannot ship a fold that has no way back.
 */
function SectionTitle({ children, note, action, fold, summary }: {
  children: React.ReactNode; note?: string; action?: React.ReactNode;
  /** Module id. Omit for a module that must not be foldable. */
  fold?: string;
  /** Shown INSTEAD of `note` while folded — one true fact this module holds. */
  summary?: string;
}) {
  const { isFolded } = useFold();
  const folded = !!fold && isFolded(fold);
  return (
    <div style={{ padding: "11px 16px 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
      {fold && <FoldToggle id={fold} label={typeof children === "string" ? children : "this section"} />}
      <div style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: "0.9px", textTransform: "uppercase",
        color: "var(--text-3)",
      }}>{children}</div>
      {folded ? <FoldedSummary text={summary} />
        : note ? <div style={{ fontSize: 10, color: "var(--text-3)" }}>{note}</div> : null}
      {/* The action goes with the body: a "refresh" or a "shape today" beside
          a header whose contents are folded away acts on something nobody can
          see. */}
      {action && !folded && <div style={{ marginLeft: "auto" }}>{action}</div>}
    </div>
  );
}

export default function Home({
  testerId, lat, lon, onNavigate, onAskAboutElection, onQuickCapture, firstRun, onOpenStar,
}: {
  testerId: string | null;
  lat: number;
  lon: number;
  onNavigate: (v: string) => void;
  onAskAboutElection?: (ctx: AskElectionContext, seed: string) => void;
  /** Opens the multi-line capture sheet — what "paste today's list" means. */
  onQuickCapture?: () => void;
  /** The walkthrough is armed or running. Asking for notification permission
   *  is a poor first sentence, so the opt-in waits until it is answered. */
  firstRun?: boolean;
  /** Deep link from a morning star row into that star's game plan. It was
   *  wired to Today and went unpassed when the ritual card moved here — the
   *  row still rendered, and tapping it did nothing. */
  onOpenStar?: (goalId: number) => void;
}) {
  const { essential } = useUiDensity();
  // THE COMEBACK MOMENT (loyalty audit 2026-08-18, A2). Streak apps churn
  // people at the first missed week: return, see red, delete. Compass's
  // mechanics are already kind — rollover carries, cadence forgives, touches
  // never zero — but the kindness was silent. A person back after five or
  // more quiet days gets greeted once, not audited. Ref-guarded so React's
  // StrictMode double-mount can't stamp today before the read.
  const [comebackDays, setComebackDays] = useState<number | null>(null);
  const isMobile = useIsMobile();

  // Opt-in. A day plan that appears unasked would be the app telling someone
  // how to spend their time, which is a different product from one that answers
  // when asked.
  const [shapeOpen, setShapeOpen] = useState(false);

  // The sky's own fortnight — BEHIND A REVEAL since the HOME study (W3): the
  // prominence tally gave the strip one vote in twelve, and eleven personas
  // could not say what the bar heights meant. The one who could (the
  // astrologer) can open it; nobody else pays for it, in pixels or in the
  // request, which now fires only when asked for. `back = 0` matters:
  // Calendar fetches back-days for its month grid, and a strip titled "the
  // water ahead" that includes them opens half-spent.
  const [waterOpen, setWaterOpen] = useState(false);

  // CROSS-HIGHLIGHT. The hero and the task row are two views of one object, not
  // two statements of the same fact — clicking either shows you the other. This
  // is the answer to the duplication the page had: the connection is made by
  // the interaction rather than by repeating the sentence.
  //
  // PERSISTENT AND DISMISSED BY HAND, never on a timer.
  //
  // This began as a 2400ms auto-clear, which fails in two ordinary ways: it
  // expires while someone is still reading the evidence it opened, and it
  // cannot survive a scroll — on a page where the hero and the row are far
  // apart, the highlight is often over before the reader arrives. A link the
  // user ends is also a link the user can trust is still there.
  const [focusedTask, setFocusedTask] = useState<number | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const clearLink = () => { setFocusedTask(null); setEvidenceOpen(false); };

  // Which task groups are showing everything. Held HERE rather than inside
  // `Group`, because `Group` is redefined on every render — React sees a new
  // component type each time and remounts the subtree, so any state living
  // inside it would reset on the next keystroke in the input above.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [newTitle, setNewTitle] = useState("");
  // The log-it door (home-base ask 3): work nobody planned gets recorded the
  // hour it happens, as a WIN — never as a pre-checked task. A task that never
  // needed doing is inventory noise; a win is a record.
  const [logOpen, setLogOpen] = useState(false);
  const [logText, setLogText] = useState("");
  const { locationKnown, profile } = useTester();
  // The astro-quiet lens (stored "minimal", or a running session forcing it).
  // What it hides here: the VOC strip, the What-lines-up receipt, the water
  // reveal, CroppingUp, and per-row timing lines. What survives: the loop
  // (with its plain why), the list, the week, the stars, the rhythm — the
  // productivity core the lens exists to leave standing.
  const { level: astroLevel } = useAstroDetail();
  const skyQuiet = astroLevel === "minimal";

  // Ritual hours read the PERSON's clock, not the office's: the first hours
  // after waking and the last before sleep, from their chronotype. Null in
  // between, which is what keeps the loop's own queries from firing on an
  // ordinary afternoon.
  const ritualMode = ritualPhase(profile?.chronotype);

  // ── EVERY server answer, and everything derived from one ─────────────────
  // Home used to open with ~600 lines before its first piece of markup. They
  // live in hooks/useHomeData now, which is the refactor the audit's
  // "extract the blocks into components" was reaching for and missing: the
  // markup was never coupled to the PAGE, it was coupled to this pile of
  // derived state, and the pile is what needed a name.
  const {
    today, headers, tasks, tasksFailed, northStars, cycle, habitsForRisk, now, tz,
    touchData,
    resolution, setDuration, setActivity, shaped, shaping, committed,
    sundayToday, reviewForced, rareShowing, water,
    logWin, addTask, toggleTask, reorder, moveWithin,
    all, open, doneToday, scheduled, loose, placed, overdue, dueToday, later, undated,
    soleGroup, engagedToday, needsDuration, needsActivity,
    ritualTasks, ritualWindows, ritualWeek,
  } = useHomeData({ testerId, lat, lon, skyQuiet, locationKnown, shapeOpen, waterOpen, ritualMode });
  // Same dial Today uses — one mental model for "how much is on screen",
  // shared across pages rather than a second Home-only preference.
  const comebackRan = useRef(false);
  useEffect(() => {
    if (!testerId || comebackRan.current) return;
    comebackRan.current = true;
    try {
      const key = `compass-last-seen-${testerId}`;
      const prev = localStorage.getItem(key);
      if (prev && prev < today) {
        const days = Math.round((Date.parse(today) - Date.parse(prev)) / 86400000);
        if (days >= 5) setComebackDays(days);
      }
      localStorage.setItem(key, today);
    } catch { /* private mode — the greeting just doesn't happen */ }
  }, [testerId, today]);

  const showVoid = usePreferences().prefs.display.todayShowVOC;
  const showCrossings = usePreferences().prefs.display.todayShowCrossings;
  const showJournal = usePreferences().prefs.display.todayShowJournal;
  /** Sets the link. Symmetric: the row's verdict and the hero title both call it. */
  const linkRow = (id: number) => { setFocusedTask(id); setEvidenceOpen(true); };

  const Row = ({ t, muted, move }: { t: Task; muted?: boolean; move?: { up?: () => void; down?: () => void } }) => {
    const focused = focusedTask === t.id;
    return (
      <div
        onMouseEnter={(e) => { if (!focused) e.currentTarget.style.background = "var(--color-card-2)"; }}
        onMouseLeave={(e) => { if (!focused) e.currentTarget.style.background = "transparent"; }}
        style={{
        padding: "7px 16px", borderTop: "1px solid var(--color-border)",
        // A transparent rule on every row, so highlighting never shifts layout.
        borderLeft: `2px solid ${focused ? CONVERGENT : "transparent"}`,
        background: focused ? "var(--color-card-2)" : "transparent",
        transition: "background 140ms ease, border-color 140ms ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <button
            onClick={() => toggleTask.mutate({ id: t.id, done: t.done !== "true" })}
            aria-label={t.done === "true" ? `Reopen ${t.title}` : `Complete ${t.title}`}
            style={{
              width: 15, height: 15, borderRadius: 4, flexShrink: 0, cursor: "pointer", padding: 0,
              border: `1.5px solid ${t.done === "true" ? CONVERGENT : "var(--color-border)"}`,
              background: t.done === "true" ? CONVERGENT : "transparent",
              color: "#ffffff", fontSize: 10, lineHeight: 1,
            }}
          >{t.done === "true" ? "✓" : ""}</button>
          <span style={{
            fontSize: 12.5, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            color: muted ? "var(--text-3)" : "var(--color-foreground)",
            textDecoration: t.done === "true" ? "line-through" : "none",
          }}>{t.title}</span>
          {/* Reorder (F11): quiet arrows, tap-sized enough for a phone. */}
          {move && t.done !== "true" && (
            <span style={{ display: "flex", gap: 0, flexShrink: 0 }}>
              {([["↑", move.up, "up"], ["↓", move.down, "down"]] as const).map(([glyph, fn, dir]) => (
                <button key={dir} onClick={fn} disabled={!fn}
                  aria-label={`Move ${t.title} ${dir}`}
                  style={{
                    fontSize: 10, padding: "0 4px", background: "none", border: "none",
                    cursor: fn ? "pointer" : "default", color: "var(--text-3)",
                    opacity: fn ? 0.7 : 0.2, lineHeight: 1.4,
                  }}>{glyph}</button>
              ))}
            </span>
          )}
        </div>
        {/* The task's TIMING STATE, on the task. This is what finally joins the
            inventory to the engine — previously a task row knew nothing about
            whether the engine had anything to say about it. */}
        {/* Scheduled tasks say nothing per-row: they live under a group whose
            label carries the fact once (HOME study D4 — ten rows each saying
            "already scheduled" was the list narrating its own furniture). */}
        {/* WHAT THE ROW STILL SAYS, and what it stopped saying.
            Gone: the assigned window, the held-back reason, and the "no
            reading today" line — all three told you what to do with a task
            before you asked (owner, 2026-08-19). What is left asks YOU for
            something: a task with no duration or no kind of work cannot be
            timed even when you do ask, and saying so is a request for input
            rather than an instruction. */}
        {t.done !== "true" && !scheduled.has(t.id)
          && (needsDuration.has(t.id) || needsActivity.has(t.id)) && (
          <div style={{ fontSize: 10.5, marginLeft: 24, marginTop: 1, color: "var(--color-muted)" }}>
            {needsActivity.has(t.id) ? (
              <span style={{ color: QUALIFIED }}>needs to know what kind of task this is before it can be timed</span>
            ) : (
              <span style={{ color: QUALIFIED }}>needs a rough duration before it can be placed</span>
            )}
          </div>
        )}
        {/* The touch trail — partial progress as dated record, muted, after
            the title. Never a percentage, and never a done-mark: a task with
            touches and done:"false" renders exactly as open as any other. */}
        {t.done !== "true" && (() => {
          const line = touchLine(touchData?.touches?.[String(t.id)]);
          return line ? (
            <div style={{ fontSize: 10, marginLeft: 24, marginTop: 1, color: "var(--text-3)" }}>{line}</div>
          ) : null;
        })()}
        {/* THE WORDS, not just the colour. A green edge means nothing to
            someone who has not learned what green means here, and the link is
            the page's least obvious affordance. Saying where the thing went and
            what happened is what makes it legible on first encounter. */}
        {focused && (
          <div style={{ fontSize: 10, marginLeft: 24, marginTop: 2, color: "var(--text-3)" }}>
            Shown in the answer above
          </div>
        )}
      </div>
    );
  };

  /**
   * THE LIST IS THE SUBJECT OF THIS COLUMN, so it is shown.
   *
   * This used to cap "no date" and "later" at five each and mute "later" —
   * which meant a freshly imported list of ten landed almost entirely inside
   * two small, dimmed, bottom groups behind a "+5 more →" that navigated to
   * another tab. The owner reported not seeing the list he had just imported
   * while every one of its rows was in the DOM. The data was never the bug.
   *
   * Caps survive, because Home is panoramic and an unbounded backlog would
   * make it the everything-page again — but they are now generous, and they
   * open IN PLACE. Sending someone to a different tab to see the rest of the
   * list they are looking at is what made a cap read as a disappearance.
   */
  const GROUP_CAP = 12;
  const Group = ({ label, items, muted, cap, bare }: {
    label: string; items: Task[]; muted?: boolean; cap?: number;
    /** The only group with anything in it. Its label states nothing the reader
     *  doesn't already know, and a header above the whole list makes a single
     *  dump look like a category rather than the inventory it is. */
    bare?: boolean;
  }) => {
    if (items.length === 0) return null;
    const open = expandedGroups.has(label);
    const shown = cap && !open ? items.slice(0, cap) : items;
    const hidden = items.length - shown.length;
    return (
      <>
        {!bare && (
          <div style={{
            fontSize: 8, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-3)",
            padding: "8px 16px 2px", borderTop: "1px solid var(--color-border)",
          }}>{label} · {items.length}</div>
        )}
        {shown.map((t) => {
          const i = items.indexOf(t);
          return <Row key={t.id} t={t} muted={muted}
            // Muted groups (scheduled) keep their served order — their time
            // is set elsewhere and arrows there would reorder nothing real.
            move={muted ? undefined : {
              up: i > 0 ? () => moveWithin(items, t.id, -1) : undefined,
              down: i < items.length - 1 ? () => moveWithin(items, t.id, 1) : undefined,
            }} />;
        })}
        {(hidden > 0 || open) && (
          <button
            onClick={() => setExpandedGroups((prev) => {
              const next = new Set(prev);
              if (next.has(label)) next.delete(label); else next.add(label);
              return next;
            })}
            style={{
              display: "block", width: "100%", textAlign: "left", padding: "6px 16px 8px",
              background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--text-3)",
            }}>{open ? "Show fewer ↑" : `Show all ${items.length} ↓`}</button>
        )}
      </>
    );
  };

  return (
    // `flex: 1` + `overflowY: auto` make Home its own scroll region, the same
    // shape Today uses. Without it Home was merely stretched to the content
    // row's height and never scrolled, so anything past the fold had nowhere
    // to go — which is why a taller hero pushed the page into collapsing
    // rather than into scrolling.
    <div style={{
      flex: 1, minHeight: 0, overflowY: "auto",
      display: "flex", flexDirection: "column", gap: 14,
      padding: "14px 0 40px", maxWidth: 980, margin: "0 auto", width: "100%",
    }}>

      {/* The comeback greeting — once, on the first open after 5+ quiet
          days. A single line, no tally of what was missed: the absence of
          an audit IS the feature. */}
      {comebackDays != null && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
          background: "var(--color-card)", border: "1px solid var(--color-border)",
          borderLeft: "3px solid #4a7a52", borderRadius: 10,
        }}>
          <span style={{ flex: 1, fontSize: 12.5, color: "var(--color-foreground)" }}>
            Back after {comebackDays} days. Everything kept your place — start anywhere.
          </span>
          <button onClick={() => setComebackDays(null)} aria-label="Dismiss" style={{
            fontSize: 12, background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 0,
          }}>✕</button>
        </div>
      )}

      {/* ══ WHERE YOU ARE · the report that actually changes ══════════════
          The top strip used to hold the last turning-point's kept card — a
          souvenir holding the page's most valuable band for up to a month
          (design 2026-08-19). This is what accrues instead: the habits and
          what has moved toward the stars. It ABSORBS the rhythm card and the
          Guiding Stars card from the context column rather than becoming a
          third voice for the same facts. */}
      {/* ── AN ANGLE CROSSING, ABOVE EVERYTHING ═══════════════════════════
          The shortest-lived fact in the app — an angle sweeps ~14°/hr, so a
          3° orb is about thirteen minutes — and it was visible only on Today
          (owner, 2026-08-19: "I think it's important to have in there").

          The audit said this move cost an unconditional 14-day fetch, because
          the week payload was the only place the client read crossings from.
          Measured instead of assumed: /tides/week is ~900ms, the same scan
          over a 2-hour window is ~8ms, so it rides on /tides/now and Home
          pays nothing.

          IT SITS ABOVE THE REPORT, not in either band. The owner's standing
          instruction for this banner is that it comes to the top of the
          screen when it is live, and nothing else on Home expires: a
          condition describes the hour you are already in, while this is a
          twenty-minute window already closing. It renders on a tiny fraction
          of loads, so the ordinary page pays nothing for the place it
          holds. */}
      {!skyQuiet && <AngleCrossing crossings={now?.crossings} enabled={showCrossings} />}

      {/* ══ THE DAILY LOOP ════════════════════════════════════════════════
          Morning "Cast off", evening "Log the day" — the ritual the whole
          product is shaped around, which until now lived on a page nobody
          lands on. It leads when it renders at all, because during those
          hours it IS the reason someone opened the app; the rest of the day
          it renders nothing and Home is unchanged. */}
      {ritualMode && now && (
        <RitualCard
          mode={ritualMode}
          now={now}
          week={ritualWeek}
          todayTasks={(ritualTasks ?? []) as any}
          windows={ritualWindows}
          testerId={testerId}
          displayName={profile?.displayName}
          lat={lat} lon={lon}
          showJournal={showJournal}
        />
      )}

      <WhereYouAre testerId={testerId} lat={lat} lon={lon} onNavigate={onNavigate} onOpenStar={onOpenStar} />


      {/* ══ THE DAY, IN ONE LINE ═══════════════════════════════════════════
          Home had no tide surface at all (owner, 2026-08-19: "a smaller
          version of the tides banner should be on the homepage"). It sits
          under the answer rather than over it: this is the day's conditions,
          and conditions read after the thing they qualify, which is the same
          argument that moved Compass to the top of the page.

          It renders at EVERY lens. At minimal it names the day by its date
          and keeps the guidance with the sky words taken out, which is the
          half of the hero that was always for everyone — the strip stands
          down only when there is no reading to report. */}
      <TideStrip now={now} minimal={skyQuiet} />

      {/* THE TIDE, ON REQUEST. It went to Calendar when Today retired and
          came back here (owner, 2026-08-20) — where it also stops crushing
          Calendar's grid, since that page is a flex column with no room for
          a fixed-height chart above it.

          Folded by default: it is the heaviest thing on the page and the
          strip above already says what kind of day it is in one line. The
          chart is for when you want the hours. */}
      {!skyQuiet && now?.dayArc && (
        <div style={{ ...PANEL, overflow: "hidden" }}>
          <SectionTitle fold="tide" summary="the hours, and where the water runs high">The tide</SectionTitle>
          <Fold id="tide">
            <LunarCycle now={now} />
            <UnifiedTideChart arc={now.dayArc} now={now} lat={lat} lon={lon} />
          </Fold>
        </div>
      )}

      {/* THE READING UNDER THE LINE. The strip says what kind of day it is;
          this is the synthesis engine's evidence for saying so — the one
          thing in Today's hero that nothing on Home carried. Folded by
          default: it came from a page built to be read to one built to be
          acted on. */}
      {!skyQuiet && now?.reading && (
        <div style={{ ...PANEL, overflow: "hidden" }}>
          <SectionTitle fold="reading" summary="what the sky is doing today">The reading</SectionTitle>
          <Fold id="reading">
            <div style={{ padding: "0 16px 14px" }}>
              <DayReading
                now={now}
                level={astroLevel}
                testerId={testerId}
                accent={ELEMENT_COLORS[CHARACTER_ELEMENT[(now?.tide?.character ?? "deep") as TideCharacter] ?? "water"]}
              />
            </div>
          </Fold>
        </div>
      )}

      {/* ── THE CONDITION SLOT · one at a time, ranked by rarity.
          Rhythm risk, then the void Moon, then where you are in a cycle.
          Three banners folded into one slot (audit §5): rhythm risk and the
          cycle phase lived on Today, where nobody lands, and the void was
          drawn on both pages in two different voices.

          Conditions are NOT in the notice queue below and never were: a
          condition is information about the hour you are already in rather
          than an offer competing for attention, and letting a common one
          suppress a rare one is exactly backwards. */}
      <DayConditions now={now} cycle={cycle} habits={habitsForRisk} skyQuiet={skyQuiet} showVoid={showVoid} />

      {/* ── TURNING POINT · the check-in prompt during a cycle window, or the
          kept one-pager after. Renders nothing on ordinary days.
          ONE BANNER AT A TIME: when the VOC strip above is live, it holds
          Home's banner slot and the offer waits for the next render without
          it — a live condition outranks an invitation, and two stacked
          banners is how Today got to eight. The kept card is content, not a
          banner, and shows regardless. */}
      {/* ── THE NOTICE QUEUE, ordered by RARITY — the rarer thing wins the
          slot, because the whole value of an interruption is how seldom it
          comes. Turning points (monthly; eclipse-tier rarer still) outrank
          exceptional days (~14 a year), so only one of these two ever shows.

          The void strip above is deliberately NOT in this queue. It is a
          condition — information about the hour you are already in — not an
          offer competing for attention, and it occurs on a large share of
          days. An earlier version let it suppress both of these, which had
          the common thing silencing the rare ones: exactly backwards. */}
      {/* The lunation's boundaries come from the sky, on the reading Home
          already fetches — so the check-in's window and the cycle the ledger
          stamps intentions with cannot drift apart. */}
      <NewMoonCheckIn
        testerId={testerId}
        onNavigate={onNavigate}
        cycleStart={now?.moonCycle?.cycleStart}
        nextCycleStart={now?.moonCycle?.nextCycleStart}
        lat={lat}
        lon={lon}
      />
      {/* The rare-day banner leads with aspect lines — sky vocabulary the
          quiet lens exists to fold away, however rare the day. The turning-
          point check-in above stays: its language is the app's own. */}
      {!skyQuiet && <RareMomentBanner onNavigate={onNavigate} suppressed={turningPointPromptOpen(now?.moonCycle?.cycleStart)} />}
      {/* THE SUNDAY REVIEW, third in the rarity order (HOME study W1). It
          lived on Today, where Home-landers never met it. Monthly outranks
          roughly-fortnightly outranks weekly, so it stands down whenever
          either notice above holds the slot — and it renders at all only on
          its own day, so the ledger read it depends on is not paid for on
          the six days it would return nothing. */}
      {(reviewForced || (sundayToday && !turningPointPromptOpen(now?.moonCycle?.cycleStart) && !rareShowing)) && (
        <ReviewCard testerId={testerId} lat={lat} lon={lon} onOpenLog={() => onNavigate("log")} />
      )}

      {/* THE DAILY-RETURN HEARTBEAT · one-tap opt-in for the morning and
          evening pushes. It lived on Today (audit §5), which is not where
          anyone lands, so it was shown to whoever happened to visit rather
          than to everyone. Self-gating — hidden once enabled, dismissed or
          blocked — and held back entirely until the walkthrough is answered,
          because asking for notification permission is a poor first sentence.

          Below the notice queue on purpose: this is an ask rather than a
          notice, so it never competes for the rarity slot. */}
      {!firstRun && <NotificationOptIn lat={lat} lon={lon} />}

      {/* THE WORK comes BEFORE the reading now.
          Compass answers "what now" at the top of the page, so the big
          reading card is no longer the answer — it is the why, the
          alternatives and the horizon, which is depth on request. Leaving
          it between the answer and the person's own list pushed the list
          ~1400 characters down the page, below the fold (owner,
          2026-08-13: "on the home page i want to be able to see my to do
          list"). Answer, then what you're holding, then the evidence. */}
      {/* ══ LEVEL 2 · THE WORK, and LEVEL 3 · CONTEXT beside it ═══════════
          One column on a phone. The two-column template had no breakpoint, so
          at 375px each column got ~180px: task titles truncated at a dozen
          characters, the week strip's day labels overlapped into one smear,
          and the PAGE scrolled horizontally — the landing surface, broken on
          exactly the screens the two retention-risk personas live on
          (HOME study 2026-08-15, D3). The horizon row below always knew this
          trick; the work grid just never learned it. */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "minmax(0,1.55fr) minmax(0,1fr)", gap: 14, alignItems: "start" }}>

        {/* YOUR WORK — capture, inventory and the action that acts on them,
            together. The standalone "Shape today" card is gone: an action
            separated from its object was too much real estate for one line. */}
        {/* The tour's arming anchor and its first stop. This panel renders in
            every state including a cold start, which is why the walkthrough
            waits for it rather than for the loop hero (J1). */}
        <div style={PANEL} data-tour="home-work">
          <SectionTitle
            fold="work"
            summary={open.length ? `${open.length} open` : "nothing on the list"}
            note={open.length ? `${open.length} open` : undefined}
            action={
              /* The outage line that used to sit here is gone with the sky
                 read it reported on. Shaping the day is something you ask
                 for, and the request answers for itself when it fails. */
              (
                <button onClick={() => setShapeOpen(v => !v)} style={{
                  fontSize: 11, background: "none", border: "none", padding: 0, cursor: "pointer",
                  color: "var(--color-primary)",
                }}>{shapeOpen ? "Hide the shape" : "Shape today"}</button>
              )
            }
          >Your work</SectionTitle>
          <Fold id="work">

          <div style={{ padding: "0 16px 10px" }}>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              /* Clearing the field is the FIELD's business, so it rides on this
                 call rather than inside the mutation (useHomeData). A mutation
                 that reaches into a component's state clears it even when
                 fired from somewhere that never touched it. */
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTitle.trim()) {
                  addTask.mutate(newTitle.trim(), { onSuccess: () => setNewTitle("") });
                }
              }}
              placeholder="Add a task. Say when, and it's read as a due date."
              style={{
                width: "100%", padding: "8px 11px", borderRadius: 8, fontSize: 12.5, outline: "none",
                border: "1px solid var(--color-border)", background: "var(--color-card-2)",
                color: "var(--color-foreground)",
              }}
            />
            {addTask.isError && <div style={{ fontSize: 10, color: "#a03030", marginTop: 4 }}>Didn't save — try again.</div>}
            {/* The other direction: record something already done. */}
            {!logOpen ? (
              <button onClick={() => setLogOpen(true)} style={{
                fontSize: 10.5, background: "none", border: "none", padding: "4px 0 0", cursor: "pointer",
                color: "var(--text-3)",
              }}>Log something done →</button>
            ) : (
              <div style={{ marginTop: 6 }}>
                <input
                  autoFocus
                  value={logText}
                  onChange={(e) => setLogText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && logText.trim()) {
                      logWin.mutate(logText.trim(), {
                        onSuccess: () => { setLogText(""); setLogOpen(false); },
                      });
                    }
                    if (e.key === "Escape") { setLogOpen(false); setLogText(""); }
                  }}
                  placeholder="What did you do? It goes in today's log."
                  style={{
                    width: "100%", padding: "7px 11px", borderRadius: 8, fontSize: 12, outline: "none",
                    border: "1px solid var(--color-border)", background: "var(--color-card-2)",
                    color: "var(--color-foreground)",
                  }}
                />
                {logWin.isError && <div style={{ fontSize: 10, color: "#a03030", marginTop: 4 }}>Didn't save — try again.</div>}
              </div>
            )}
          </div>

          {/* Resolution chips live here now, with the work they act on. */}
          {shapeOpen && resolution && resolution.needsDuration.length > 0 && (
            <div style={{ padding: "4px 16px 8px", borderTop: "1px solid var(--color-border)" }}>
              <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-3)", marginBottom: 4 }}>
                how much room should these get?
              </div>
              {resolution.needsDuration.map((n) => (
                <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11.5, flex: 1, minWidth: 120 }}>{n.title}</span>
                  {n.chips.map((m) => (
                    <button key={m} disabled={setDuration.isPending}
                      onClick={() => setDuration.mutate({ id: n.id, minutes: m })}
                      style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 999, cursor: "pointer",
                        border: "1px solid var(--color-border)", background: "var(--color-card-2)",
                        color: "var(--color-foreground)",
                      }}>{m < 60 ? `${m}m` : `${m / 60}h`}</button>
                  ))}
                </div>
              ))}
            </div>
          )}
          {shapeOpen && resolution && resolution.needsActivity.length > 0 && (
            <div style={{ padding: "4px 16px 8px", borderTop: "1px solid var(--color-border)" }}>
              <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-3)", marginBottom: 4 }}>
                what kind of work are these?
              </div>
              {resolution.needsActivity.slice(0, 4).map((n) => (
                <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 0", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11.5, flex: 1, minWidth: 120 }}>{n.title}</span>
                  {n.options.map((o) => (
                    <button key={o.key} disabled={setActivity.isPending}
                      onClick={() => setActivity.mutate({ id: n.id, activityKey: o.key })}
                      style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 999, cursor: "pointer",
                        border: "1px solid var(--color-border)", background: "var(--color-card-2)",
                        color: "var(--color-foreground)",
                      }}>{o.label}</button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* The shaped day, when asked for. */}
          {shapeOpen && shaped && (
            <div style={{ borderTop: "1px solid var(--color-border)" }}>
              <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-3)", padding: "8px 16px 3px" }}>
                {shaping ? "shaping…" : "today, shaped"}
              </div>
              {shaped.placed.map((p) => (
                <div key={p.item.id} style={{ display: "flex", gap: 10, padding: "3px 16px" }}>
                  <span style={{ fontSize: 11, color: "var(--color-primary)", fontVariantNumeric: "tabular-nums", flexShrink: 0, minWidth: 88 }}>
                    {clockOf(p.startAt)}–{clockOf(p.endAt)}
                  </span>
                  <span style={{ fontSize: 11.5, flex: 1, minWidth: 0 }}>
                    {p.item.title}
                    {p.assumedDuration && <span style={{ fontSize: 9, color: "var(--text-3)" }}> · {p.minutes}m assumed</span>}
                  </span>
                </div>
              ))}
              {shaped.openTime.map((o, i) => (
                <div key={`o-${i}`} style={{ display: "flex", gap: 10, padding: "3px 16px" }}>
                  <span style={{ fontSize: 11, color: "var(--text-3)", fontVariantNumeric: "tabular-nums", flexShrink: 0, minWidth: 88 }}>
                    {clockOf(o.startAt)}–{clockOf(o.endAt)}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--color-muted)" }}>open · nothing needed placing here</span>
                </div>
              ))}
              <div style={{ height: 6 }} />
            </div>
          )}

          {tasksFailed ? (
            <div style={{ padding: "10px 16px 14px", fontSize: 11.5, color: "#a03030", borderTop: "1px solid var(--color-border)" }}>
              Your tasks didn't load. The list is intact; it's the connection.
            </div>
          ) : (
            <>
              {/* A single-group list drops its heading. Almost every imported
                  dump is one group — ten undated lines — and labelling it
                  "no date · 10" filed the whole inventory under a caveat. */}
              <Group label="overdue" items={overdue} bare={soleGroup === "overdue"} />
              <Group label="today" items={dueToday} bare={soleGroup === "today"} />
              <Group label="no date" items={undated} cap={GROUP_CAP} bare={soleGroup === "no date"} />
              {/* Not muted any more. Dimming a whole group made the backlog
                  read as disabled, and "later" is still work you are holding. */}
              <Group label="later" items={later} cap={GROUP_CAP} bare={soleGroup === "later"} />
              {/* The fact said once, as a heading, never per-row (D4). */}
              <Group label="scheduled" items={placed} muted cap={GROUP_CAP} />
              {open.length === 0 && tasks && (
                <div style={{ padding: "4px 16px 14px", fontSize: 11.5, color: "var(--text-3)" }}>Nothing on the list.</div>
              )}
            </>
          )}
          </Fold>
        </div>

        {/* ── CONTEXT column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* YOUR DAY — what is actually on today, in order, with now marked.
              Above This week because the day you are standing in outranks
              the one ahead of it; renders nothing when the day is empty. */}
          <DayAhead testerId={testerId} lat={lat} lon={lon} onNavigate={onNavigate} />

          {/* MOMENTS AHEAD, under what's already placed. DayAhead answers
              "what is on today"; this answers "what are the hours I have
              left for", which nothing else on Home says — the week strip is
              a horizon, and nothing names a pick any more (2026-08-19).

              Sky vocabulary end to end, so the quiet lens hides it outright.
              There is nothing here to translate: the rows ARE the planetary
              hours and the Moon's applying contacts. */}
          {!skyQuiet && (
            <MomentsAhead
              now={now}
              tasks={open.map(t => ({ id: t.id, title: t.title, planet: t.planet }))}
              stars={(northStars ?? []).filter((g: any) => g.status !== "done" && g.status !== "paused")
                .map((g: any) => ({ id: g.id, title: g.title, planet: g.planet }))}
              chronotype={profile?.chronotype}
              label="Moments ahead"
              framed
            />
          )}

          {/* THIS WEEK — what you have committed to, not what could be placed.
              Always rendered: an empty committed week is a real answer and the
              card says so, where the old proposal-driven version could only
              go blank and blame the week. */}
          <div style={PANEL}>
            <SectionTitle
              action={
                <button onClick={() => onNavigate("launch")} style={{
                  fontSize: 11, background: "none", border: "none", padding: 0, cursor: "pointer",
                  color: "var(--color-primary)",
                }}>Open Plan →</button>
              }
              fold="week"
              summary={committed.length ? `${committed.length} committed` : "nothing committed"}
            >This week</SectionTitle>
            <Fold id="week">
              <CommittedWeekStrip windows={committed} onOpen={() => onNavigate("launch")} />
            </Fold>
          </div>

          {/* The rhythm card and the Guiding Stars card lived here. Both are
              in "Where you are" at the top of the page now — one report
              instead of two cards saying adjacent halves of it. */}

          {/* Expanded only: the day's wins are a look backward, and the
              landing page's essential job is forward. The Log tab holds the
              full record either way. */}
          {engagedToday && !essential && (
            <div style={PANEL}>
              <SectionTitle note={`${doneToday.length} crossed off`}>Today's log</SectionTitle>
              {doneToday.map((t) => <Row key={t.id} t={t} />)}
              <div style={{ padding: "9px 16px 12px", borderTop: "1px solid var(--color-border)" }}>
                <button onClick={() => onNavigate("log")} style={{
                  fontSize: 11, background: "none", border: "none", cursor: "pointer",
                  color: "var(--color-primary)", padding: 0,
                }}>Add a note about how it went →</button>
              </div>
            </div>
          )}

          {/* The density toggle retired from Home (HOME study M5): no study
              participant ever found it, and the only thing it revealed here
              was the log card. Density remains a preference, set from Today,
              and Home still honors it — it just stopped selling it. */}
        </div>
      </div>


      {/* ══ LEVEL 1 · THE ANSWER ═══════════════════════════════════════════
          A moment becoming available, not a row returned from an API. The
          task title is the visual centre; the judgment reads as badges; the
          interpretation comes BEFORE the technical receipt. */}
      {/* The hero's left edge is the other half of the link — the row carries
          the same 2px green rule, so the two cards read as one object seen
          twice rather than as two statements of the same fact. The edge is
          always drawn so that setting the link never shifts layout. */}
      {/* ══ ASK · the chief function ══════════════════════════════════════
          Three doors, closed (DESIGN-ASK-AND-HOME-2026-08-19). It takes the
          slot the receipt used to hold because a receipt for an answer given
          three hundred pixels above does not deserve the page's second most
          valuable card — and because "what do I want to orient to?" is the
          question people actually arrive holding.

          ASK IS WHERE A RECOMMENDATION LIVES NOW. Home stopped naming one
          unprompted on 2026-08-19, so there is no pick above for these doors
          to reason about — which means "This moment" asks a question rather
          than explaining an answer nobody requested. */}
      {onAskAboutElection && (
        <div style={{ ...PANEL, overflow: "hidden" }}>
          <div style={{ height: 3, background: `linear-gradient(90deg, ${PERSONAL}, ${PERSONAL}66 55%, var(--color-border))` }} />
          <SectionTitle fold="ask" summary="three doors">Ask</SectionTitle>
          <Fold id="ask"><div style={{ padding: "0 16px 14px" }}>
            <AskDoors
              layout="tiles"
              stars={(northStars ?? [])
                .filter((g: any) => g.status !== "done" && g.status !== "paused")
                .slice(0, 4)
                .map((g: any) => ({ id: g.id, title: g.title }))}
              strongestFit={null}
              onPick={(pick) => onAskAboutElection(
                { activity: "", windows: [] },
                // Home has no text field, so a fragment would strand the
                // reader mid-sentence: send the complete question instead.
                pick.send,
              )}
            />
          </div></Fold>
        </div>
      )}

      {/* ══ THE HORIZON ═══════════════════════════════════════════════════
          Home's second question — "what's coming?" — which nothing on the
          page looked far enough ahead to answer. Two facts at two scales:
          the fortnight's shape, and the fixed dates beyond it.

          BREADTH AT LOW RESOLUTION, which is the whole guard against Home
          becoming the everything-page again. Neither of these explains
          itself; both hand you a door to the tab that owns the detail.

          `auto-fit` rather than two fixed columns, because `CroppingUp`
          renders nothing on a genuinely quiet stretch and a fixed grid
          would leave a hole where a card declined to speak.

          IT SITS BELOW THE ANSWER NOW (audit 2026-08-19 §6). The horizon
          used to interrupt the page between Compass's answer and the
          receipt for that answer — a forecast wedged into the middle of an
          argument. Home's first question is "what now"; this is the second
          one, and it reads that way only when it comes second. */}
      {/* THE HORIZON, IN ONE BREATH. The dates ahead and the shape of the
          days they land in were two cards asking the same question, so the
          reader answered it twice (owner, 2026-08-19: "cropping up and the
          water ahead should be shown in one breath"). The chart still opens
          on request — it is the heavier half — but it opens INSIDE the card
          whose question it finishes. */}
      {!skyQuiet && (
        <CroppingUp
          testerId={testerId}
          onNavigate={onNavigate}
          water={!waterOpen ? (
            <button onClick={() => setWaterOpen(true)} style={{
              fontSize: 11, background: "none", border: "none", cursor: "pointer",
              color: "var(--color-primary)", padding: "2px 16px 12px", textAlign: "left",
            }}>Show the next two weeks</button>
          ) : (
            <div>
              {water && <QualityStrip week={water} days={14} onPick={() => onNavigate("calendar")} />}
              <button onClick={() => setWaterOpen(false)} style={{
                fontSize: 11, background: "none", border: "none", cursor: "pointer",
                color: "var(--text-3)", padding: "6px 16px 10px", textAlign: "left",
              }}>Hide it</button>
            </div>
          )}
        />
      )}
    </div>
  );
}
