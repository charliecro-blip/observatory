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

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ElectionPicker } from "@/components/ElectionPicker";
import { useNorthStars, useTidesNow } from "@/hooks/useTides";
import { fetchJson, HttpError } from "@/lib/fetchJson";
import { localToday } from "@/lib/dates";
import { useTester } from "@/contexts/tester-context";
import { WeekStrip, useWeekShape } from "@/components/WeekShape";
import type { AskElectionContext } from "@/App";

interface Task {
  id: number;
  title: string;
  done: string | null;
  dueDate: string | null;
  planet?: string | null;
  bestWindowType?: string | null;
  startedAt?: string | null;
}

// `overflow: hidden` used to be here, to keep the group rows' full-bleed
// dividers inside the rounded corners. It also CLIPPED the Compass — the
// activity picker is taller than its parent expected, so the last row of
// pills ("Intimacy & sex") was cut off at the card edge with no scrollbar and
// no hint that anything was missing. Rounded corners are not worth silently
// eating content; the rows clip themselves instead, below.

interface LinesUpResult {
  held: { id: string; title: string; kind: string };
  activityKey: string; activityLabel: string;
  alternative?: { key: string; label: string };
  startClock: string; endClock: string; allDay: boolean;
  startAt: string; endAt: string;
  state: "open-now" | "ahead" | "passed";
  supportLevel: string; suitability: string;
  personal: boolean; why: string;
  evidence: { family: string; text: string }[];
  noObjections: boolean;
}
interface LinesUp {
  results: LinesUpResult[];
  clarify: { held: { id: string; title: string }; candidates: { key: string; label: string }[] }[];
  alreadyScheduled: { id: string; title: string }[];
  quiet: "supported-only" | "nothing-singled-out" | "thin-inventory" | null;
  nextOpening: { activityLabel: string; date: string; startClock: string } | null;
  notPriced: number;
  chartAvailable: boolean;
}


interface ShapedDay {
  placed: {
    item: { id: string; title: string; kind: string };
    startAt: string; endAt: string; minutes: number;
    assumedDuration: boolean; activityKey: string | null; basis: string;
  }[];
  unplaced: { item: { id: string; title: string }; reason: string }[];
  openTime: { startAt: string; endAt: string; minutes: number }[];
  warnings: string[];
}


interface Resolution {
  needsActivity: { id: string; title: string; options: { key: string; label: string }[] }[];
  needsDuration: { id: string; title: string; activityKey: string; activityLabel: string; chips: number[] }[];
  ready: number;
}

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

function SectionTitle({ children, note, action }: {
  children: React.ReactNode; note?: string; action?: React.ReactNode;
}) {
  return (
    <div style={{ padding: "11px 16px 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
      <div style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: "0.9px", textTransform: "uppercase",
        color: "var(--text-3)",
      }}>{children}</div>
      {note && <div style={{ fontSize: 10, color: "var(--text-3)" }}>{note}</div>}
      {action && <div style={{ marginLeft: "auto" }}>{action}</div>}
    </div>
  );
}

export default function Home({
  testerId, lat, lon, onNavigate, onAskAboutElection,
}: {
  testerId: string | null;
  lat: number;
  lon: number;
  onNavigate: (v: string) => void;
  onAskAboutElection?: (ctx: AskElectionContext, seed: string) => void;
}) {
  const qc = useQueryClient();
  const today = localToday();
  const headers = testerId ? { "x-tester-id": testerId } : undefined;

  // EVERY task, not today's. "The capacity to see all of one's tasks in a
  // single view is important" — a dashboard that showed only today's would be
  // the third place in the app that does that, and none of them answer "what am
  // I actually holding".
  const { data: tasks, isError: tasksFailed } = useQuery<Task[]>({
    queryKey: ["tasks", "all"],
    queryFn: () => fetchJson<Task[]>("/api/tasks", { headers }),
    enabled: !!testerId,
  });
  const { data: northStars } = useNorthStars(testerId);
  const { data: now } = useTidesNow(testerId, lat, lon);
  const { locationKnown } = useTester();
  const linesQ = useQuery<LinesUp>({
    queryKey: ["lines-up", testerId, lat, lon],
    queryFn: () => fetchJson<LinesUp>(
      `/api/elections/lines-up?lat=${lat}&lon=${lon}&tz=${new Date().getTimezoneOffset()}&locationKnown=${locationKnown}`,
      { headers }),
    enabled: !!testerId,
  });
  const { data: lines, error: linesError, refetch: refetchLines, isFetching: linesFetching } = linesQ;

  /**
   * A PAUSED QUERY IS UNREACHABLE, NOT LOADING.
   *
   * `isError` alone was not enough, and the gap is not small. When a fetch
   * fails, react-query consults its `onlineManager` before retrying; if that
   * says offline, the retry is PAUSED rather than run. A paused query sits at
   * `status: "pending"` indefinitely — `isError` never becomes true, no error
   * is ever surfaced, and a spinner spins forever.
   *
   * Measured with the API stopped: `fetchStatus: "paused"`, `failureCount: 1`,
   * `status: "pending"`, unchanged after ten seconds, while a hand-rolled
   * `fetch()` to the same URL returned 500 in 12ms. So the outage module built
   * for exactly this situation could not be reached in the situation it was
   * built for, because the flag it keyed on is the one flag that never flips.
   *
   * Both are the same admission — Compass could not get an answer — so both
   * lead to the same state. `fetchStatus` is checked rather than `isPaused` so
   * that a pause DURING a background refresh, when we still hold good data,
   * does not throw away a perfectly valid reading.
   */
  const linesUnreachable = linesQ.fetchStatus === "paused" && !lines;
  const linesFailed = linesQ.isError || linesUnreachable;

  // WHICH read failed, and WHEN it failed — both from the server.
  //
  // Not knowing what someone holds and not having judged the sky are different
  // admissions, and the surface says different things for each. The timestamp
  // is the server's because a time the client makes up is not evidence: it
  // would say "didn't answer at 4:02 PM" about a moment nothing happened at.
  const failure = (() => {
    const body = linesError instanceof HttpError ? linesError.body as Record<string, unknown> : null;
    const reason = typeof body?.reason === "string" ? body.reason : null;
    const at = typeof body?.at === "string" ? body.at : null;
    return { reason, at };
  })();

  // Opt-in. A day plan that appears unasked would be the app telling someone
  // how to spend their time, which is a different product from one that answers
  // when asked.
  const [shapeOpen, setShapeOpen] = useState(false);
  const { data: resolution } = useQuery<Resolution>({
    queryKey: ["needs-resolution", testerId],
    queryFn: () => fetchJson<Resolution>("/api/elections/needs-resolution", { headers }),
    enabled: !!testerId && shapeOpen,
  });
  // Storing the picked duration is what turns a SUGGESTION into a commitment.
  // Nothing is reserved until this runs — a chip on screen has committed
  // nothing, which is the difference between offering a duration and assuming
  // one.
  const setDuration = useMutation({
    mutationFn: ({ id, minutes }: { id: string; minutes: number }) =>
      fetchJson(`/api/tasks/${id.replace("task-", "")}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(headers ?? {}) },
        body: JSON.stringify({ estMinutes: minutes }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["needs-resolution"] });
      qc.invalidateQueries({ queryKey: ["shape-day"] });
      qc.invalidateQueries({ queryKey: ["shape-week"] });
    },
  });

  // Records the person's own answer. Without this the question below was
  // read-only — Compass asked "what kind of work is this?" and had nowhere to
  // put the reply, so the same question came back every time. A confirmed key
  // outranks the matcher everywhere it is read.
  const setActivity = useMutation({
    mutationFn: ({ id, activityKey }: { id: string; activityKey: string }) =>
      fetchJson(`/api/tasks/${id.replace("task-", "")}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(headers ?? {}) },
        body: JSON.stringify({ activityKey }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["needs-resolution"] });
      qc.invalidateQueries({ queryKey: ["shape-day"] });
      qc.invalidateQueries({ queryKey: ["shape-week"] });
      qc.invalidateQueries({ queryKey: ["lines-up"] });
    },
  });

  const { data: shaped, isFetching: shaping } = useQuery<ShapedDay>({
    queryKey: ["shape-day", testerId, lat, lon],
    queryFn: () => fetchJson<ShapedDay>(
      `/api/elections/shape-day?lat=${lat}&lon=${lon}&locationKnown=${locationKnown}`, { headers }),
    enabled: !!testerId && shapeOpen,
  });

  // The week strip loads with the page rather than on demand: it is a shape,
  // not a plan, and it is the answer to Home being thin on a day when nothing
  // converges and nothing is void. Cheap enough — the same memoised elections
  // the day shaping uses.
  const { data: week } = useWeekShape(testerId, lat, lon, locationKnown, true);

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
  /** Sets the link. Symmetric: the row's verdict and the hero title both call it. */
  const linkRow = (id: number) => { setFocusedTask(id); setEvidenceOpen(true); };
  const clearLink = () => { setFocusedTask(null); setEvidenceOpen(false); };

  const [newTitle, setNewTitle] = useState("");
  const addTask = useMutation({
    mutationFn: (title: string) =>
      fetchJson("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(headers ?? {}) },
        body: JSON.stringify({ title, dueDate: today }),
      }),
    onSuccess: () => { setNewTitle(""); qc.invalidateQueries({ queryKey: ["tasks"] }); },
  });
  const toggleTask = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      fetchJson(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(headers ?? {}) },
        body: JSON.stringify({ done: done ? "true" : "false" }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const all = tasks ?? [];
  const open = all.filter((t) => t.done !== "true");
  const doneToday = all.filter((t) => t.done === "true" && t.dueDate === today);

  // Overdue and undated are separated because they are different problems: one
  // is a promise you broke, the other is a thought you had. Merging them into
  // "open tasks" is what makes a list feel like an accusation.
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today);
  const dueToday = open.filter((t) => t.dueDate === today);
  const later = open.filter((t) => t.dueDate && t.dueDate > today);
  const undated = open.filter((t) => !t.dueDate);

  // The Log appears only after you have engaged today. The owner's rule: "the
  // log should only come if someone has already engaged with the app that day —
  // and logging should also look like crossing off to-do tasks." An empty
  // review card on a day you have not started is a chore, not a reflection.
  const engagedToday = doneToday.length > 0 || all.some((t) => t.startedAt && t.startedAt.startsWith(today));

  // THE JOIN. A timing result and a task row used to repeat each other word for
  // word — the hero said "a time for deep focus on board exam prep" and the
  // list below said it again. Repetition does not communicate connection; it
  // just makes the page feel sparse. The result stays the answer, and the task
  // row carries a small indicator pointing back at it.
  const timingFor = new Map<number, LinesUpResult>();
  for (const r of lines?.results ?? []) {
    const id = Number(r.held.id.replace("task-", ""));
    if (!Number.isNaN(id)) timingFor.set(id, r);
  }
  const needsDuration = new Set((resolution?.needsDuration ?? []).map(n => Number(n.id.replace("task-", ""))));
  const scheduled = new Set((lines?.alreadyScheduled ?? []).map(n => Number(n.id.replace("task-", ""))));
  const needsActivity = new Set((resolution?.needsActivity ?? []).map(n => Number(n.id.replace("task-", ""))));

  const Row = ({ t, muted }: { t: Task; muted?: boolean }) => {
    const timing = timingFor.get(t.id);
    const isHero = lead ? Number(lead.held.id.replace("task-", "")) === t.id : false;
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
              color: "#fff", fontSize: 10, lineHeight: 1,
            }}
          >{t.done === "true" ? "✓" : ""}</button>
          <span style={{
            fontSize: 12.5, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            color: muted ? "var(--text-3)" : "var(--color-foreground)",
            textDecoration: t.done === "true" ? "line-through" : "none",
          }}>{t.title}</span>
        </div>
        {/* The task's TIMING STATE, on the task. This is what finally joins the
            inventory to the engine — previously a task row knew nothing about
            whether the engine had anything to say about it. */}
        {t.done !== "true" && (timing || scheduled.has(t.id) || needsDuration.has(t.id) || needsActivity.has(t.id) || linesFailed) && (
          <div style={{ fontSize: 10.5, marginLeft: 24, marginTop: 1, color: "var(--color-muted)" }}>
            {scheduled.has(t.id) ? (
              /* Survives the outage on purpose: this one does not depend on the
                 sky, so it is still true when the sky read failed. */
              <span style={{ color: "var(--color-muted)" }}>already scheduled</span>
            ) : linesFailed ? (
              /* WITHHELD, not blank. "No particular timing today" says Compass
                 looked and found nothing; this says it never looked. Rendering
                 an outage as the former is the false statement the whole state
                 exists to prevent. Italic is used nowhere else in the app, so
                 the difference is visible without reading the words. */
              <span style={{ color: "var(--text-3)", fontStyle: "italic" }}>
                not judged — no reading for today
              </span>
            ) : timing ? (
              /* The verdict is the OTHER end of the cross-highlight: clicking it
                 opens the hero's evidence and marks this row, so the two stop
                 being separate statements of one fact. */
              <button
                onClick={() => { if (isHero) (focused ? clearLink() : linkRow(t.id)); }}
                style={{
                  background: "none", border: "none", padding: 0, textAlign: "left",
                  font: "inherit", cursor: isHero ? "pointer" : "default",
                  color: timing.supportLevel === "convergent" ? CONVERGENT : "var(--color-muted)",
                }}>
                {timing.supportLevel === "convergent" && "✦ "}
                {timing.activityLabel}
                <span style={{ color: "var(--color-muted)" }}>
                  {" · "}
                  {timing.allDay ? "supported all day"
                    : timing.state === "open-now" ? `open now, until ${timing.endClock}`
                    : timing.state === "passed" ? `${timing.startClock}–${timing.endClock}, passed`
                    : `${timing.startClock}–${timing.endClock}`}
                </span>
              </button>
            ) : needsActivity.has(t.id) ? (
              <span style={{ color: QUALIFIED }}>needs a kind of work before it can be timed</span>
            ) : (
              <span style={{ color: QUALIFIED }}>needs a rough duration before it can be placed</span>
            )}
          </div>
        )}
        {/* THE WORDS, not just the colour. A green edge means nothing to
            someone who has not learned what green means here, and the link is
            the page's least obvious affordance. Saying where the thing went and
            what happened is what makes it legible on first encounter. */}
        {focused && (
          <div style={{ fontSize: 10, marginLeft: 24, marginTop: 2, color: "var(--text-3)" }}>
            Shown above · reasoning open
          </div>
        )}
      </div>
    );
  };

  const Group = ({ label, items, muted }: { label: string; items: Task[]; muted?: boolean }) =>
    items.length === 0 ? null : (
      <>
        <div style={{
          fontSize: 8, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-3)",
          padding: "8px 16px 2px", borderTop: "1px solid var(--color-border)",
        }}>{label} · {items.length}</div>
        {items.map((t) => <Row key={t.id} t={t} muted={muted} />)}
      </>
    );

  const lead = lines?.results?.[0];
  const secondary = (lines?.results ?? []).slice(1);

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

      {/* ── RIGHT NOW · conditional. Only when a real condition is gating. */}
      {now?.voc?.isVOC && now.voc.reading && (
        <div style={{
          ...PANEL,
          borderLeft: `3px solid ${now.voc.reading.benign ? PERSONAL : QUALIFIED}`,
          borderRadius: 0, padding: "11px 16px",
        }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)", marginBottom: 3 }}>
            Right now · the Moon is void
            {now.voc.nextIngress && <span style={{ textTransform: "none", letterSpacing: 0 }}> until {now.voc.nextIngress}</span>}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>{now.voc.reading.feel}</div>
          <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.5, marginTop: 3 }}>{now.voc.reading.instead}</div>
          {now.voc.scope && (
            <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5, marginTop: 4 }}>{now.voc.scope}</div>
          )}
        </div>
      )}

      {/* ══ LEVEL 1 · THE ANSWER ═══════════════════════════════════════════
          A moment becoming available, not a row returned from an API. The
          task title is the visual centre; the judgment reads as badges; the
          interpretation comes BEFORE the technical receipt. */}
      {/* The hero's left edge is the other half of the link — the row carries
          the same 2px green rule, so the two cards read as one object seen
          twice rather than as two statements of the same fact. The edge is
          always drawn so that setting the link never shifts layout. */}
      <div style={{
        ...ANSWER, overflow: "hidden",
        borderLeft: `3px solid ${focusedTask != null && lead && focusedTask === Number(lead.held.id.replace("task-", "")) ? CONVERGENT : "var(--color-border)"}`,
        transition: "border-color 140ms ease",
      }}>
        {/* A 3px seam across the top of the only elevated surface on the page.
            The one piece of pure decoration here, and it earns its place by
            marking which card is the answer without another border or label.
            ACTIVE STATE ONLY. The seam is built from the convergence green, and
            green is never decorative here — drawing it above a cold start, a
            quiet day or an outage would dress up a card that has nothing to
            report, which is how an empty state starts lying. */}
        {lead && (
          <div style={{
            height: 3,
            background: `linear-gradient(90deg, ${CONVERGENT}, ${CONVERGENT}66 55%, var(--color-border))`,
          }}/>
        )}
        <SectionTitle
          action={
            linesFailed ? (
              /* Amber, not green: this is a needs-input state, and it belongs
                 in the header rather than inside the empty slot so that the
                 module is identifiable as unread before you read a word of it. */
              // The existing Badge, in the needs-input colour. Reusing it beats
              // fresh hexes: Badge already builds its fill as an alpha suffix
              // on the same ink, so the chip survives dark mode, and an amber
              // pill already means "needs input" everywhere else on the page.
              <Badge text="no reading" color={QUALIFIED} />
            ) : focusedTask != null && lead && focusedTask === Number(lead.held.id.replace("task-", "")) ? (
              /* The link ends by hand. Since nothing expires it, there must be
                 a visible way out — and naming the state ("Linked to your
                 work") is what tells someone the green edge below is a
                 relationship rather than a status. */
              <button onClick={clearLink} style={{
                fontSize: 10.5, background: "none", border: "none", padding: 0,
                cursor: "pointer", color: CONVERGENT,
              }}>
                Linked to your work <span style={{ color: "var(--text-3)" }}>✕</span>
              </button>
            ) : (
              <details style={{ display: "inline" }}>
                <summary style={{ fontSize: 11, color: "var(--color-primary)", cursor: "pointer", listStyle: "none" }}>
                  Find another activity →
                </summary>
              </details>
            )
          }
        >What lines up</SectionTitle>

        {lead ? (
          <div style={{ padding: "2px 20px 18px" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              <Badge
                text={lead.supportLevel === "convergent" ? "Several factors converge" : "Supported"}
                color={lead.supportLevel === "convergent" ? CONVERGENT : NEUTRAL}
              />
              {/* Suitability shown BESIDE support, not folded into it — they
                  answer different questions: the sky, and the matter. */}
              <Badge
                text={lead.suitability}
                color={lead.suitability === "clear" ? NEUTRAL : QUALIFIED}
              />
              {lead.personal && <Badge text="Personal reinforcement" color={PERSONAL} />}
            </div>

            <div
              onClick={() => { const id = Number(lead.held.id.replace("task-", "")); if (!Number.isNaN(id)) (focusedTask === id ? clearLink() : linkRow(id)); }}
              title="Show this in your work"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 29, fontWeight: 400, lineHeight: 1.18, letterSpacing: "0.01em",
                color: "var(--color-foreground)", cursor: "pointer",
                // Shorthand WITH the colour in it, not the longhand pair.
                //
                // The earlier note here claimed longhand had fixed React's
                // "don't mix shorthand and non-shorthand" warning. It had not:
                // the warning still fired ~10 times on every cold load, because
                // React reuses this DOM node across renders in which the same
                // position is styled with the `textDecoration` shorthand, and
                // the collision is between renders rather than within one style
                // object. `textDecoration: "underline <color>"` carries the
                // colour itself, so no longhand exists to collide with — and
                // these were the only two longhand uses in the app.
                // (`textUnderlineOffset` is not part of the shorthand and is
                // safe to keep alongside it.)
                textDecoration: focusedTask === Number(lead.held.id.replace("task-", ""))
                  ? "underline var(--color-border)" : "none",
                textUnderlineOffset: 5,
              }}>
              {lead.held.title}
            </div>
            {(() => {
              const m = momentBlock(lead);
              const passed = lead.state === "passed";
              return (
                <div style={{ marginTop: 12 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 500, letterSpacing: "0.1em",
                    color: passed ? "var(--text-3)" : "var(--color-muted)",
                  }}>{m.label}</div>
                  <div style={{
                    fontFamily: "var(--font-display)", fontSize: 32, lineHeight: 1.15,
                    whiteSpace: "nowrap", marginTop: 2,
                    color: passed ? "var(--text-3)" : "var(--color-foreground)",
                  }}>{m.clock}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 3 }}>{m.meta}</div>
                  {m.elapsed != null && (
                    <div style={{
                      height: 3, borderRadius: 2, marginTop: 9, maxWidth: 320,
                      background: "var(--color-border)", overflow: "hidden",
                    }}>
                      <div style={{ height: "100%", width: `${m.elapsed * 100}%`, background: CONVERGENT }}/>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* The receipt, behind a disclosure. An astro-literate reader must
                be able to inspect it; nobody should have to read it first. */}
            {/* One testimony per line, in an inset panel. The engine computes
                them separately and used to join them into a single blur; three
                facts a reader can weigh is a different thing from one sentence
                they can only accept. */}
            {evidenceOpen && (lead.evidence?.length ?? 0) > 0 && (
              <div style={{
                background: "var(--color-card-2)", border: "1px solid var(--color-border)",
                borderRadius: 8, padding: "15px 17px", marginTop: 11, maxWidth: 720,
                display: "flex", flexDirection: "column", gap: 12,
              }}>
                {/* Two columns: the KIND of claim, then the claim. Knowing you
                    are about to read a lunar testimony rather than a personal
                    one changes how it lands, and the family was already known
                    at the point each testimony was computed — the join was the
                    only thing throwing it away. The label set is deliberately
                    NOT an enum here: a family this view has never heard of
                    renders as itself rather than vanishing. */}
                {lead.evidence.map((e, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 12,
                    borderTop: i === 0 ? "none" : "1px solid var(--color-border)",
                    paddingTop: i === 0 ? 0 : 12,
                  }}>
                    <div style={{
                      width: 78, flexShrink: 0, paddingTop: 3,
                      fontSize: 9.5, fontWeight: 500, letterSpacing: "0.12em",
                      textTransform: "uppercase", color: "var(--text-3)",
                    }}>{e.family}</div>
                    <div style={{ fontSize: 12.5, color: "var(--color-foreground)", lineHeight: 1.55, minWidth: 0 }}>
                      {e.text}
                    </div>
                  </div>
                ))}
                {/* THE ABSENCE LINE. A claim about Compass's own reasons list,
                    not about the sky — see `ElectionWindow.noObjections`. It is
                    rendered only when the engine asserts it, because the view
                    is not in a position to know. */}
                {lead.noObjections && (
                  <div style={{
                    borderTop: "1px solid var(--color-border)", paddingTop: 11,
                    fontSize: 11.5, color: "var(--text-3)",
                  }}>
                    No qualifying objections were recorded.
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => setShapeOpen(true)} style={{
                fontSize: 12, fontWeight: 600, padding: "7px 15px", borderRadius: 8, cursor: "pointer",
                border: "none", background: "var(--color-primary)", color: "var(--color-card)",
              }}>Put on today</button>
              {(lead.evidence?.length ?? 0) > 0 && (
                <button onClick={() => setEvidenceOpen(v => !v)} style={{
                  fontSize: 12, padding: "7px 13px", borderRadius: 8, cursor: "pointer",
                  border: "1px solid var(--color-border)", background: "var(--color-card)",
                  color: "var(--color-foreground)",
                }}>{evidenceOpen ? "Hide evidence" : "See evidence"}</button>
              )}
              <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                {lead.activityLabel}
                {lead.alternative && (
                  <> · <button onClick={() => onNavigate("launch")} style={{
                    fontSize: 10.5, background: "none", border: "none", padding: 0, cursor: "pointer",
                    color: "var(--color-primary)", textDecoration: "underline",
                  }}>change</button></>
                )}
              </span>
            </div>
          </div>
        ) : linesFailed ? (
          /* AN OUTAGE IS NOT A QUIET DAY.
             Found by accident: with the API down, this hero said "Nothing
             you're holding is especially singled out today" — a confident,
             false statement, and exactly the defect the codebase already has a
             rule against ("a failed request stops looking like an empty life").
             Reintroduced here because a thrown query and an empty result both
             leave `lines` undefined, and the quiet branch caught both. */
          /* Separated from a quiet day by STRUCTURE, not by a caption. The
             answer slot is drawn and left empty, exactly where the answer would
             have been, so the shape of the missing thing is visible. A quiet day
             has no such hole: it has an answer, and the answer is "nothing in
             particular". A caption saying "this isn't a quiet day" would be the
             disclaimer the rules already forbid. */
          <div style={{ padding: "2px 20px 20px" }}>
            <div style={{
              border: "1px dashed var(--color-border)", borderRadius: 8, padding: 18,
            }}>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: 21, lineHeight: 1.25,
                color: "var(--color-foreground)",
              }}>
                {/* Three different admissions, because they are three different
                    facts. Not reaching Compass at all is not the same as
                    Compass failing to read the sky, and neither is the same as
                    not knowing what you hold — and only the last two mean a
                    reading was actually attempted. */}
                {linesUnreachable ? "Compass couldn't reach the reading."
                  : failure.reason === "inventory-unread" ? "Compass couldn't read what you're holding."
                  : "Compass couldn't read the sky for today."}
              </div>
              <div style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.55, marginTop: 6 }}>
                {/* The failure time is stated only when the server sent one. An
                    invented timestamp would be a fabricated observation, and
                    this module exists precisely to stop Compass asserting
                    things it did not observe. An unreachable server never sent
                    one, so nothing is claimed about when it happened. */}
                {failure.at && `The reading didn't answer at ${new Date(failure.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}. `}
                {linesUnreachable && "The connection didn't hold long enough to ask. "}
                Nothing has been judged either way.
              </div>
              <button
                // `refetch()` does not rescue a PAUSED query, and neither does
                // telling the online manager it is online.
                //
                // Measured, with the API restored: `onlineManager.isOnline()`
                // was already `true` while the query sat at
                // `fetchStatus: "paused"`. The retryer parked itself when the
                // network was down and only wakes on an online *event*; the
                // value being correct now is not one. So both earlier attempts
                // — `setOnline(navigator.onLine)`, then flipping it through
                // false — left a button that looked like it worked and changed
                // nothing.
                //
                // Removing the query drops the parked retryer with it. The
                // mounted observer then creates a fresh query, which starts
                // unpaused because the manager reports online. This depends on
                // no retryer internals, which is why it is the version that
                // survives a react-query upgrade.
                onClick={() => { qc.removeQueries({ queryKey: ["lines-up"] }); void refetchLines(); }}
                disabled={linesFetching}
                style={{
                  marginTop: 12, fontSize: 12, padding: "7px 14px", borderRadius: 8,
                  cursor: linesFetching ? "default" : "pointer",
                  border: "1px solid var(--color-border)", background: "var(--color-card-2)",
                  color: "var(--color-foreground)", opacity: linesFetching ? 0.6 : 1,
                }}>
                {linesFetching ? "Reading…" : "Try again"}
              </button>
            </div>
          </div>
        ) : !lines ? (
          /* NO DATA IN HAND IS NOT A QUIET DAY EITHER.
             This was `linesLoading`, and it let the false statement back in by
             a second route. react-query reports `isLoading: false` for a
             DISABLED query, and this one is disabled until `testerId` resolves
             — so with the API down, the tester lookup never returns, the query
             never runs, and the page fell through to "nothing is especially
             singled out today": maximally confident, entirely unfounded.
             Gating on the presence of DATA rather than on the absence of a
             loading flag is what makes that unrepresentable, because every way
             of not having an answer now lands here. */
          <div style={{ padding: "2px 20px 18px", fontSize: 14, color: "var(--text-3)" }}>Reading the sky…</div>
        ) : (
          /* The quiet day CONTRACTS rather than disappearing. */
          lines.quiet === "thin-inventory" ? (
            /* COLD START is its own state, not a thinner quiet day.
               Compass can only point at what someone holds, so with an empty
               inventory the honest move is to say that and open three doors —
               rather than report an absence of convergence, which would blame
               the sky for a thing the sky has nothing to do with. */
            <div style={{ padding: "2px 20px 20px" }}>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: 24, lineHeight: 1.28,
                color: "var(--color-foreground)", maxWidth: 560,
              }}>
                Compass can only point toward things you actually hold.
              </div>
              {/* DOORS, not buttons — and each one states its cost.
                  What stalls people here is not being unable to choose; it is
                  not knowing what they are agreeing to. "Choose recurring
                  activities" sounds like a setup wizard until it says it sets
                  up timing for good, and "paste your list" sounds like the
                  start of an onboarding interview until it says nothing else
                  is asked for. The sub-line is the whole point of the shape. */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14, maxWidth: 520 }}>
                {[
                  { title: "Paste today's list", sub: "One line each. Nothing else asked for.",
                    go: () => document.querySelector<HTMLInputElement>('input[placeholder^="Add something"]')?.focus() },
                  { title: "Choose recurring activities", sub: "Pick from a list. Sets up timing for good.",
                    go: () => onNavigate("work") },
                  { title: "Find a time for one thing", sub: "Name it, get a window. No account of your life.",
                    go: () => onNavigate("launch") },
                ].map((d) => (
                  <button key={d.title} onClick={d.go}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-card-2)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                      padding: "13px 15px", borderRadius: 8, cursor: "pointer",
                      border: "1px solid var(--color-border)", background: "transparent",
                      transition: "background 140ms ease",
                    }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13.5, color: "var(--color-foreground)" }}>{d.title}</span>
                      <span style={{ display: "block", fontSize: 11.5, color: "var(--text-3)", marginTop: 2 }}>{d.sub}</span>
                    </span>
                    <span style={{ color: "var(--text-3)", fontSize: 13 }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
          <div style={{ padding: "2px 20px 18px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, lineHeight: 1.3, color: "var(--color-foreground)" }}>
              Nothing you're holding is especially singled out today.
            </div>
            <div style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.55, marginTop: 5 }}>
              Use priority, momentum, or simple necessity.
              {lines?.nextOpening && (
                <> The next notable opening is {lines.nextOpening.activityLabel.toLowerCase()} on {lines.nextOpening.date} at {lines.nextOpening.startClock}.</>
              )}
            </div>
          </div>
          )
        )}

        {/* Two or three results: compact rows beneath the lead, never three heroes.
            CONTENTION. Two activities can legitimately elect the same interval —
            a single night planetary hour suited both `deep-work` and
            `sign-contract` here, and the engine is right to return both. But
            listing two windows that are in fact ONE window, with nothing said,
            offers the same 53 minutes twice and lets someone accept both. The
            overlap is computable from what is already on screen, so the honest
            move is to name it rather than to let the reader discover it by
            double-booking. */}
        {secondary.map((r, i) => {
          const clash = [lead, ...secondary.slice(0, i)].find(
            (p) => p && !p.allDay && !r.allDay &&
              Date.parse(p.startAt) < Date.parse(r.endAt) &&
              Date.parse(r.startAt) < Date.parse(p.endAt));
          return (
          <div key={r.held.id} style={{
            display: "flex", alignItems: "baseline", gap: 10, padding: "7px 20px",
            borderTop: "1px solid var(--color-border)",
          }}>
            <span style={{ fontSize: 12.5, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.held.title}
              {clash && (
                <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                  {" · same window as "}{clash.held.title.length > 22 ? `${clash.held.title.slice(0, 22)}…` : clash.held.title}
                </span>
              )}
            </span>
            {r.supportLevel === "convergent" && <Badge text="converges" color={CONVERGENT} />}
            <span style={{
              fontSize: 11.5, flexShrink: 0,
              color: r.state === "passed" ? "var(--text-3)" : "var(--color-primary)",
            }}>
              {r.allDay ? "all day" : r.state === "open-now" ? `now, until ${r.endClock}` : `${r.startClock}–${r.endClock}`}
            </span>
          </div>
          );
        })}

        {lines?.clarify.map((c) => (
          <div key={c.held.id} style={{ padding: "7px 20px", borderTop: "1px solid var(--color-border)" }}>
            <div style={{ fontSize: 12 }}>{c.held.title}</div>
            <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 1 }}>
              {c.candidates.map(x => x.label).join(" or ")}? Compass won't time it until it knows which.
            </div>
          </div>
        ))}

        <div style={{ borderTop: "1px solid var(--color-border)", padding: "4px 6px 6px" }}>
          <details>
            <summary style={{ padding: "6px 14px", cursor: "pointer", fontSize: 11.5, color: "var(--color-primary)", listStyle: "none" }}>
              Find a time for something else →
            </summary>
            <ElectionPicker testerId={testerId} lat={lat} lon={lon} onAsk={onAskAboutElection} />
          </details>
        </div>
      </div>

      {/* ══ LEVEL 2 · THE WORK, and LEVEL 3 · CONTEXT beside it ═══════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.55fr) minmax(0,1fr)", gap: 14, alignItems: "start" }}>

        {/* YOUR WORK — capture, inventory and the action that acts on them,
            together. The standalone "Shape today" card is gone: an action
            separated from its object was too much real estate for one line. */}
        <div style={PANEL}>
          <SectionTitle
            note={open.length ? `${open.length} open` : undefined}
            action={
              /* Said ONCE, at the top, rather than repeated down every row. The
                 person's work is unaffected by a failed sky read and must not
                 look broken — but "Shape today" would be an offer Compass
                 cannot currently honour, so it stands down. */
              linesFailed ? (
                <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                  Unaffected — timing lines are held back
                </span>
              ) : (
                <button onClick={() => setShapeOpen(v => !v)} style={{
                  fontSize: 11, background: "none", border: "none", padding: 0, cursor: "pointer",
                  color: "var(--color-primary)",
                }}>{shapeOpen ? "Hide the shape" : "Shape today →"}</button>
              )
            }
          >Your work</SectionTitle>

          <div style={{ padding: "0 16px 10px" }}>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) addTask.mutate(newTitle.trim()); }}
              placeholder="Add something — one line, no ceremony"
              style={{
                width: "100%", padding: "8px 11px", borderRadius: 8, fontSize: 12.5, outline: "none",
                border: "1px solid var(--color-border)", background: "var(--color-card-2)",
                color: "var(--color-foreground)",
              }}
            />
            {addTask.isError && <div style={{ fontSize: 10, color: "#a03030", marginTop: 4 }}>Didn't save — try again.</div>}
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
                  <span style={{ fontSize: 11, color: "var(--color-muted)" }}>open · nothing you hold needed placing here</span>
                </div>
              ))}
              <div style={{ height: 6 }} />
            </div>
          )}

          {tasksFailed ? (
            <div style={{ padding: "10px 16px 14px", fontSize: 11.5, color: "#a03030", borderTop: "1px solid var(--color-border)" }}>
              I couldn't load your tasks. This is a connection problem, not an empty list.
            </div>
          ) : (
            <>
              <Group label="overdue" items={overdue} />
              <Group label="today" items={dueToday} />
              <Group label="no date" items={undated} />
              <Group label="later" items={later} muted />
              {open.length === 0 && tasks && (
                <div style={{ padding: "4px 16px 14px", fontSize: 11.5, color: "var(--text-3)" }}>Nothing on the list.</div>
              )}
            </>
          )}
        </div>

        {/* ── CONTEXT column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* THIS WEEK — answers a question rather than drawing seven slots. */}
          {week && (
            <div style={PANEL}>
              <SectionTitle
                action={
                  <button onClick={() => onNavigate("launch")} style={{
                    fontSize: 11, background: "none", border: "none", padding: 0, cursor: "pointer",
                    color: "var(--color-primary)",
                  }}>See week →</button>
                }
              >This week</SectionTitle>
              <WeekStrip week={week} />
            </div>
          )}

          {(northStars ?? []).filter((g: any) => g.status !== "done" && g.status !== "paused").length > 0 && (
            <div style={PANEL}>
              <SectionTitle note="open the tab to work on them">Guiding Stars</SectionTitle>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 16px 14px" }}>
                {(northStars ?? [])
                  .filter((g: any) => g.status !== "done" && g.status !== "paused")
                  .map((g: any) => (
                    <button key={g.id} onClick={() => onNavigate("work")} style={{
                      fontSize: 11, padding: "4px 11px", borderRadius: 999, cursor: "pointer",
                      border: "1px solid var(--color-border)", background: "var(--color-card-2)",
                      color: "var(--color-foreground)",
                    }}>{g.title}</button>
                  ))}
              </div>
            </div>
          )}

          {engagedToday && (
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
        </div>
      </div>
    </div>
  );
}
