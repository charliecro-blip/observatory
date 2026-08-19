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
import CompassNow from "@/components/CompassNow";
import { useUiDensity, useAstroDetail } from "@/contexts/preferences-context";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { AskElectionContext } from "@/App";

interface Task {
  id: number;
  title: string;
  done: string | null;
  dueDate: string | null;
  planet?: string | null;
  bestWindowType?: string | null;
  startedAt?: string | null;
  sortOrder?: number;
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
  heldBack: { item: { id: string; title: string }; reason: string }[];
  quiet: "supported-only" | "nothing-singled-out" | "all-placed" | "thin-inventory" | null;
  /** One act and the one after it — the engine's own composition. */
  loop?: {
    now: { title: string; heldId: string; why: string; whyPlain?: string; until: string | null; inFlow: boolean; elapsedMin?: number } | null;
    then: { title: string; heldId: string; startClock: string } | null;
  };
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
  testerId, lat, lon, onNavigate, onAskAboutElection, onQuickCapture,
}: {
  testerId: string | null;
  lat: number;
  lon: number;
  onNavigate: (v: string) => void;
  onAskAboutElection?: (ctx: AskElectionContext, seed: string) => void;
  /** Opens the multi-line capture sheet — what "paste today's list" means. */
  onQuickCapture?: () => void;
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
  // Same dial Today uses — one mental model for "how much is on screen",
  // shared across pages rather than a second Home-only preference.
  const { essential } = useUiDensity();
  // THE COMEBACK MOMENT (loyalty audit 2026-08-18, A2). Streak apps churn
  // people at the first missed week: return, see red, delete. Compass's
  // mechanics are already kind — rollover carries, cadence forgives, touches
  // never zero — but the kindness was silent. A person back after five or
  // more quiet days gets greeted once, not audited. Ref-guarded so React's
  // StrictMode double-mount can't stamp today before the read.
  const [comebackDays, setComebackDays] = useState<number | null>(null);
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

  // The astro-quiet lens (stored "minimal", or a running session forcing it).
  // What it hides here: the VOC strip, the What-lines-up receipt, the water
  // reveal, CroppingUp, and per-row timing lines. What survives: the loop
  // (with its plain why), the list, the week, the stars, the rhythm — the
  // productivity core the lens exists to leave standing.
  const { level: astroLevel } = useAstroDetail();
  const skyQuiet = astroLevel === "minimal";
  const isMobile = useIsMobile();
  // Read once and reused in both the key and the fetch. Every value the
  // response depends on belongs in the cache identity — this one didn't:
  // `tz` and `locationKnown` rode in the URL but not the key, so a change in
  // either (a DST transition mid-session, toggling location permission)
  // could serve the OLD answer from cache with no refetch, because
  // react-query had no way to see the input had changed. `ElectionPicker`
  // already learned this lesson once; this makes it a repository rule rather
  // than a fix applied one query at a time.
  const tz = new Date().getTimezoneOffset();
  // The IANA zone, alongside the numeric offset — corrects the day boundary
  // for the specific day in question (a DST-transition day, most of all)
  // rather than trusting a snapshot offset for the whole session.
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // The touch trails: which tasks were worked on, and when (wins.taskId).
  const { data: touchData } = useQuery<{ touches: Record<string, TouchTrail> }>({
    queryKey: ["touches", testerId],
    queryFn: () => fetchJson(`/api/planning/touches?tz=${new Date().getTimezoneOffset()}`, { headers }),
    enabled: !!testerId,
  });
  const linesQ = useQuery<LinesUp>({
    queryKey: ["lines-up", testerId, lat, lon, tz, zone, locationKnown],
    queryFn: () => fetchJson<LinesUp>(
      `/api/elections/lines-up?lat=${lat}&lon=${lon}&tz=${tz}&timeZone=${encodeURIComponent(zone)}&locationKnown=${locationKnown}`,
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
    // `skyQuiet` is in the key because it is in the URL: the plain weave and
    // the elected weave are different answers, and flipping the lens must not
    // serve one as the other from cache.
    queryKey: ["shape-day", testerId, lat, lon, tz, zone, locationKnown, skyQuiet],
    queryFn: () => fetchJson<ShapedDay>(
      `/api/elections/shape-day?lat=${lat}&lon=${lon}&tz=${tz}&timeZone=${encodeURIComponent(zone)}&locationKnown=${locationKnown}${skyQuiet ? "&sky=false" : ""}`, { headers }),
    enabled: !!testerId && shapeOpen,
  });

  // The week strip loads with the page rather than on demand: it is a shape,
  // not a plan, and it is the answer to Home being thin on a day when nothing
  // converges and nothing is void.
  //
  // COMMITTED, not proposed. This read `shape-week`, which only collects work
  // that has NOT been placed — so the card emptied out the moment a week was
  // fully woven and told the reader nothing was placed yet. See
  // components/WeekCommitted.tsx. The proposal still lives in Plan, which is
  // the tab that acts on it.
  // Sixty days, not seven: the strip draws a week, and everything past it
  // feeds the card's "Committed" footer — the launch you picked, standing
  // (HOME study W2).
  const { data: committed = [] } = useCommittedWeek(testerId, 60);

  // The sky's own fortnight — BEHIND A REVEAL since the HOME study (W3): the
  // prominence tally gave the strip one vote in twelve, and eleven personas
  // could not say what the bar heights meant. The one who could (the
  // astrologer) can open it; nobody else pays for it, in pixels or in the
  // request, which now fires only when asked for. `back = 0` matters:
  // Calendar fetches back-days for its month grid, and a strip titled "the
  // water ahead" that includes them opens half-spent.
  const [waterOpen, setWaterOpen] = useState(false);

  // The Sunday review's gates. `rareShowing` mirrors RareMomentBanner's own
  // query by key, so asking here costs nothing extra and the two can't
  // disagree about whether the slot is held.
  const sundayToday = new Date().getDay() === 0;
  const reviewForced = new URLSearchParams(window.location.search).get("review") === "week";
  const { data: rareData } = useQuery<{ hits: unknown[] }>({
    queryKey: ["rare-today", tz],
    queryFn: async () => (await fetch(`/api/elections/rare-today?tz=${tz}`)).json(),
    staleTime: 1000 * 60 * 60 * 6,
    enabled: sundayToday || reviewForced,
  });
  const rareShowing = (rareData?.hits?.length ?? 0) > 0;
  const { data: water } = useTidesWeek(14, lat, lon, 0, waterOpen);

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
  const logWin = useMutation({
    mutationFn: (text: string) =>
      fetchJson("/api/planning/wins", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(headers ?? {}) },
        body: JSON.stringify({ text, tz: new Date().getTimezoneOffset() }),
      }),
    onSuccess: () => { setLogText(""); setLogOpen(false); qc.invalidateQueries({ queryKey: ["momentum"] }); },
  });
  const addTask = useMutation({
    // The one-line add reads dates the way the capture sheet does (F12):
    // "call mom friday" lands on Friday. Any parse trouble falls back to the
    // raw title due today — a date guess must never block the add.
    mutationFn: (raw: string) => {
      let title = raw, dueDate = today;
      try {
        const p = parseWhen(raw, today);
        if (p.title.trim()) title = p.title;
        if (p.dueDate) dueDate = p.dueDate;
      } catch { /* raw title, due today */ }
      return fetchJson("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(headers ?? {}) },
        body: JSON.stringify({ title, dueDate }),
      });
    },
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

  // Reorder within a group (F11) — move buttons, not drag, for a first pass
  // that works on a phone. sortOrder has been in the schema all along; this
  // is the first UI that writes it.
  const reorder = useMutation({
    mutationFn: (updates: { id: number; sortOrder: number }[]) =>
      Promise.all(updates.map(u => fetchJson(`/api/tasks/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(headers ?? {}) },
        body: JSON.stringify({ sortOrder: u.sortOrder }),
      }))),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const moveWithin = (group: Task[], id: number, dir: -1 | 1) => {
    const idx = group.findIndex(t => t.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= group.length) return;
    const desired = [...group];
    [desired[idx], desired[j]] = [desired[j], desired[idx]];
    // Renumber the group in tens. Swapping two equal sortOrders (the default
    // 0) is a no-op, so the first move settles the whole group's numbers and
    // later moves are two-row writes.
    const updates = desired
      .map((t, i) => ({ id: t.id, sortOrder: i * 10 }))
      .filter(u => (desired.find(t => t.id === u.id)!.sortOrder ?? 0) !== u.sortOrder);
    if (updates.length) reorder.mutate(updates);
  };

  const all = tasks ?? [];
  const open = all.filter((t) => t.done !== "true");
  const doneToday = all.filter((t) => t.done === "true" && t.dueDate === today);

  // Overdue and undated are separated because they are different problems: one
  // is a promise you broke, the other is a thought you had. Merging them into
  // "open tasks" is what makes a list feel like an accusation.
  const scheduled = new Set((lines?.alreadyScheduled ?? []).map(n => Number(n.id.replace("task-", ""))));
  // Placed tasks leave the date groups: their time is set, so "overdue" and
  // "no date" stop applying, and one labelled group carries the fact the rows
  // used to repeat. `scheduled` comes from the lines-up read, so during an
  // outage placed tasks fall back into the date groups — visible and honest,
  // just unlabelled until the reading returns.
  const loose = open.filter((t) => !scheduled.has(t.id));
  const placed = open.filter((t) => scheduled.has(t.id));
  const overdue = loose.filter((t) => t.dueDate && t.dueDate < today);
  const dueToday = loose.filter((t) => t.dueDate === today);
  const later = loose.filter((t) => t.dueDate && t.dueDate > today);
  const undated = loose.filter((t) => !t.dueDate);

  // The label of the one group that has anything in it, when there is exactly
  // one. Drives the bare (unheaded) rendering below.
  const soleGroup = (() => {
    const filled = ([
      ["overdue", overdue], ["today", dueToday], ["no date", undated], ["later", later],
    ] as const).filter(([, items]) => items.length > 0);
    return filled.length === 1 ? filled[0][0] : null;
  })();

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
  // The engine looked and declined, with a reason. Carried per item so the row
  // can say so instead of showing the blank line that used to mean both
  // "declined" and "never considered".
  const heldBack = new Map((lines?.heldBack ?? []).map(h => [Number(h.item.id.replace("task-", "")), h.reason]));
  const needsActivity = new Set((resolution?.needsActivity ?? []).map(n => Number(n.id.replace("task-", ""))));

  const Row = ({ t, muted, move }: { t: Task; muted?: boolean; move?: { up?: () => void; down?: () => void } }) => {
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
        {/* At the quiet lens the timing/held-back/outage lines fold away with
            the rest of the sky; the two needs-input lines stay, because a
            duration and a kind of work feed the plain weave too. */}
        {t.done !== "true" && !scheduled.has(t.id) && (skyQuiet
          ? (needsDuration.has(t.id) || needsActivity.has(t.id))
          : (timing || heldBack.has(t.id) || needsDuration.has(t.id) || needsActivity.has(t.id) || linesFailed)) && (
          <div style={{ fontSize: 10.5, marginLeft: 24, marginTop: 1, color: "var(--color-muted)" }}>
            {!skyQuiet && linesFailed ? (
              /* WITHHELD, not blank. "No particular timing today" says Compass
                 looked and found nothing; this says it never looked. Rendering
                 an outage as the former is the false statement the whole state
                 exists to prevent. Italic is used nowhere else in the app, so
                 the difference is visible without reading the words. */
              <span style={{ color: "var(--text-3)", fontStyle: "italic" }}>
                not judged — no reading for today
              </span>
            ) : !skyQuiet && timing ? (
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
            ) : !skyQuiet && heldBack.has(t.id) ? (
              /* A refusal that carries its reason. Amber rather than faint,
                 because this is a judgment Compass made and stands behind —
                 "no window today" is an answer, not an absence of one. */
              <span style={{ color: QUALIFIED }}>held back — {heldBack.get(t.id)}</span>
            ) : needsActivity.has(t.id) ? (
              <span style={{ color: QUALIFIED }}>needs a kind of work before it can be timed</span>
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

  const lead = lines?.results?.[0];
  /**
   * ONE VOICE PER FACT (HOME study 2026-08-15, D1 / A1).
   *
   * When the answer card's lead is the same item CompassNow is already
   * showing, this page used to say "what now" twice — from two engines, in
   * two tenses, with two CTAs — and the day the study was written the two
   * disagreed on screen: "until 2:04 PM · Start this" above "IN 1 HOUR ·
   * 2:04–3:06 PM · Put on today". Both engines were right; the page was
   * wrong to let them both speak as heroes.
   *
   * So when they name the same item, the hero up top keeps the voice and
   * this card becomes what its own header always promised: the receipt.
   * Judgment badges, the window as a line of evidence rather than a
   * headline, testimony, alternatives. When they name DIFFERENT items (or
   * there is no loop), nothing is duplicated and the full hero renders as
   * before.
   */
  const leadIsLoopNow = !!lead && lines?.loop?.now?.heldId === lead.held.id;
  const secondary = (lines?.results ?? []).slice(1);
  // At the quiet lens the answer card renders only when what it has to say is
  // a productivity fact — an outage, a load in flight, a cold start, a fully
  // placed day. The receipt (badges, testimony, windows) and the sky's
  // quiet-day sentence stand down; CompassNow above already holds the answer.
  const showAnswerCard = !skyQuiet
    || linesFailed || !lines
    || lines.quiet === "all-placed" || lines.quiet === "thin-inventory";

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
      <WhereYouAre testerId={testerId} lat={lat} lon={lon} onNavigate={onNavigate} />

      {/* ══ COMPASS · the answer, first ═══════════════════════════════════
          "What should I do right now" is the app's central question, and it
          was arriving fifth — inside a card, under a section title and a
          badge row. It leads now, above the reading it came from and above
          the conditions that qualify it: a qualification read before the
          thing it qualifies is backwards.

          Renders nothing when there is nothing to loop over; Home's
          cold-start doors and its all-placed state each say that better,
          with the right offer attached. */}
      <CompassNow
        loop={lines?.loop}
        onOpenWork={(heldId) => {
          const id = Number(heldId.replace("task-", ""));
          if (!Number.isNaN(id)) linkRow(id);
        }}
        // The advisor is handed the same facts the card shows, so it reasons
        // from the engine's answer rather than re-deriving one of its own.
        // `subject` pins WHICH pick the question is about: the loop's, not
        // whatever Today's own engine would name — the seed question and the
        // context must never disagree about their subject.
        onAsk={onAskAboutElection && lead ? (seed) => onAskAboutElection({
          activity: lead.activityLabel,
          windows: [{
            label: lead.allDay ? "all day" : `${lead.startClock}–${lead.endClock}`,
            tier: lead.supportLevel,
            why: lines?.loop?.now?.why,
          }],
          subject: lines?.loop?.now ? {
            title: lines.loop.now.title,
            why: skyQuiet && lines.loop.now.whyPlain ? lines.loop.now.whyPlain : lines.loop.now.why,
            when: lines.loop.now.until ?? undefined,
            kind: "loop",
          } : undefined,
        }, seed) : undefined}
      />

      {/* ── RIGHT NOW · conditional. Only when a real condition is gating.
          Stands down at the quiet lens: a void Moon is exactly the kind of
          standing sky condition the lens exists to fold away. */}
      {!skyQuiet && now?.voc?.isVOC && now.voc.reading && (
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
          {/* THE CITATION, LAST AND SMALLEST. Six signs carry one; the other
              six render nothing here rather than a hedge. It sits below the
              counsel because it is the source of the claim rather than part
              of it — this used to open the lead sentence in the four Lilly
              signs, which spent the best line on bookkeeping. */}
          {now.voc.reading.provenance && (
            <div style={{ fontSize: 10.5, color: "var(--text-3)", lineHeight: 1.5, marginTop: 6, fontStyle: "italic" }}>
              {now.voc.reading.provenance}
            </div>
          )}
        </div>
      )}

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
            note={open.length ? `${open.length} open` : undefined}
            action={
              /* Said ONCE, at the top, rather than repeated down every row. The
                 person's work is unaffected by a failed sky read and must not
                 look broken — but "Shape today" would be an offer Compass
                 cannot currently honour, so it stands down. */
              linesFailed ? (
                <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                  Timing is unavailable. Your list is fine.
                </span>
              ) : (
                <button onClick={() => setShapeOpen(v => !v)} style={{
                  fontSize: 11, background: "none", border: "none", padding: 0, cursor: "pointer",
                  color: "var(--color-primary)",
                }}>{shapeOpen ? "Hide the shape" : "Shape today"}</button>
              )
            }
          >Your work</SectionTitle>

          <div style={{ padding: "0 16px 10px" }}>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) addTask.mutate(newTitle.trim()); }}
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
                    if (e.key === "Enter" && logText.trim()) logWin.mutate(logText.trim());
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
        </div>

        {/* ── CONTEXT column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* YOUR DAY — what is actually on today, in order, with now marked.
              Above This week because the day you are standing in outranks
              the one ahead of it; renders nothing when the day is empty. */}
          <DayAhead testerId={testerId} lat={lat} lon={lon} onNavigate={onNavigate} />

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
            >This week</SectionTitle>
            <CommittedWeekStrip windows={committed} onOpen={() => onNavigate("launch")} />
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

      {/* ══ THE HORIZON ═══════════════════════════════════════════════════
          Home's second question — "what's coming?" — which nothing on the
          page looked far enough ahead to answer. Two facts at two scales:
          the fortnight's shape, and the fixed dates beyond it.

          BREADTH AT LOW RESOLUTION, which is the whole guard against Home
          becoming the everything-page again. Neither of these explains
          itself; both hand you a door to the tab that owns the detail.

          `auto-fit` rather than two fixed columns, because `CroppingUp`
          renders nothing on a genuinely quiet stretch and a fixed grid
          would leave a hole where a card declined to speak. */}
      {!skyQuiet && <CroppingUp onNavigate={onNavigate} />}

      {/* THE WATER AHEAD, on request (W3). In-place reveal, so no arrow. */}
      {!skyQuiet && (!waterOpen ? (
        <button onClick={() => setWaterOpen(true)} style={{
          fontSize: 11, background: "none", border: "none", cursor: "pointer",
          color: "var(--text-3)", padding: "2px 0", textAlign: "left", flexShrink: 0,
        }}>Show the water ahead</button>
      ) : (
        <div style={{ flexShrink: 0 }}>
          {water && (
            // `overflow: hidden` clips QualityStrip's own full-bleed bottom
            // rule to the rounded corners — safe on a non-flex-item wrapper.
            <div style={{ ...PANEL, overflow: "hidden" }}>
              <QualityStrip week={water} days={14} onPick={() => onNavigate("calendar")} />
            </div>
          )}
          <button onClick={() => setWaterOpen(false)} style={{
            fontSize: 11, background: "none", border: "none", cursor: "pointer",
            color: "var(--text-3)", padding: "4px 0 0", textAlign: "left",
          }}>Hide the water ahead</button>
        </div>
      ))}

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

          It never answers "what should I do": CompassNow does that, above,
          deterministically. Everything behind "This moment" reasons about
          THAT pick rather than proposing a rival one. */}
      {onAskAboutElection && (
        <div style={{ ...PANEL, overflow: "hidden" }}>
          <div style={{ height: 3, background: `linear-gradient(90deg, ${PERSONAL}, ${PERSONAL}66 55%, var(--color-border))` }} />
          <SectionTitle>Ask</SectionTitle>
          <div style={{ padding: "0 16px 14px" }}>
            <AskDoors
              layout="tiles"
              stars={(northStars ?? [])
                .filter((g: any) => g.status !== "done" && g.status !== "paused")
                .slice(0, 4)
                .map((g: any) => ({ id: g.id, title: g.title }))}
              strongestFit={lines?.loop?.now
                ? { title: lines.loop.now.title, why: skyQuiet && lines.loop.now.whyPlain ? lines.loop.now.whyPlain : lines.loop.now.why }
                : null}
              note="Compass answered above — this is for thinking it through."
              onPick={(pick) => onAskAboutElection(
                {
                  activity: lead?.activityLabel ?? "",
                  windows: lead ? [{
                    label: lead.allDay ? "all day" : `${lead.startClock}–${lead.endClock}`,
                    tier: lead.supportLevel,
                    why: lines?.loop?.now?.why,
                  }] : [],
                  subject: lines?.loop?.now ? {
                    title: lines.loop.now.title,
                    why: skyQuiet && lines.loop.now.whyPlain ? lines.loop.now.whyPlain : lines.loop.now.why,
                    when: lines.loop.now.until ?? undefined,
                    kind: "loop",
                  } : undefined,
                },
                // Home has no text field, so a fragment would strand the
                // reader mid-sentence: send the complete question instead.
                pick.send,
              )}
            />
          </div>
        </div>
      )}

      {showAnswerCard && <div data-tour="home-answer" style={{
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
                  Find another activity
                </summary>
              </details>
            )
          }
        >{leadIsLoopNow ? "Why this lines up" : "What lines up"}</SectionTitle>

        {lead ? (
          <div style={{ padding: "2px 20px 18px" }}>
            {/* The loop moved OUT of this card and up to CompassNow — one
                copy, at the top, where the question is actually asked. What
                stays here is what someone comes to this card for: the
                badges, the evidence, the alternatives, the horizon. */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              <Badge
                text={lead.supportLevel === "convergent" ? "Several things line up" : "Supported"}
                color={lead.supportLevel === "convergent" ? CONVERGENT : NEUTRAL}
              />
              {/* Suitability shown BESIDE support, not folded into it — they
                  answer different questions: the sky, and the matter. A clear
                  matter gets no chip: unqualified is the default state, and a
                  badge announcing normality is noise. An unknown value renders
                  as itself rather than vanishing. */}
              {lead.suitability !== "clear" && (
                <Badge
                  text={lead.suitability === "qualified" ? "Useful, with a catch" : lead.suitability}
                  color={QUALIFIED}
                />
              )}
              {lead.personal && <Badge text="Your chart agrees" color={PERSONAL} />}
            </div>

            {/* The item's name and its moment render only when CompassNow is
                NOT already saying them three hundred pixels up (D1). In the
                merged state the receipt still names the window — but as a
                line among the facts, where a receipt keeps its dates. */}
            {leadIsLoopNow && (
              <div style={{ fontSize: 13, color: "var(--color-foreground)", lineHeight: 1.5 }}>
                {lead.activityLabel}
                <span style={{ color: "var(--color-muted)" }}>
                  {" · "}
                  {lead.allDay ? "supported all day"
                    : lead.state === "open-now" ? `open now, until ${lead.endClock}`
                    : lead.state === "passed" ? `${lead.startClock}–${lead.endClock}, passed`
                    : `window ${lead.startClock}–${lead.endClock}`}
                </span>
              </div>
            )}
            {!leadIsLoopNow && <div
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
            </div>}
            {!leadIsLoopNow && (() => {
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
                    Compass found nothing against it.
                  </div>
                )}
              </div>
            )}

            {/* The CTA row belongs to the full hero. Merged, this card is a
                receipt, and a receipt does not re-sell you the purchase: the
                act's button lives on CompassNow, and only the evidence toggle
                survives here (A1 counted "Start this" over "Put on today" as
                a decision the page forced the reader to make). */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
              {!leadIsLoopNow && (
                <button onClick={() => setShapeOpen(true)} style={{
                  fontSize: 12, fontWeight: 600, padding: "7px 15px", borderRadius: 8, cursor: "pointer",
                  border: "none", background: "var(--color-primary)", color: "var(--color-card)",
                }}>Put on today</button>
              )}
              {(lead.evidence?.length ?? 0) > 0 && (
                <button onClick={() => setEvidenceOpen(v => !v)} style={{
                  fontSize: 12, padding: "7px 13px", borderRadius: 8, cursor: "pointer",
                  border: "1px solid var(--color-border)", background: "var(--color-card)",
                  color: "var(--color-foreground)",
                }}>{evidenceOpen ? "Hide evidence" : "See evidence"}</button>
              )}
              <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                {!leadIsLoopNow && lead.activityLabel}
                {lead.alternative && (
                  <> {!leadIsLoopNow && "· "}<button onClick={() => onNavigate("launch")} style={{
                    fontSize: 10.5, background: "none", border: "none", padding: 0, cursor: "pointer",
                    color: "var(--color-primary)", textDecoration: "underline",
                  }}>change activity</button></>
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
                {linesUnreachable ? "Today's reading didn't load."
                  : failure.reason === "inventory-unread" ? "Compass couldn't load your list."
                  : "Compass couldn't read the sky today."}
              </div>
              <div style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.55, marginTop: 6 }}>
                {/* The failure time is stated only when the server sent one. An
                    invented timestamp would be a fabricated observation, and
                    this module exists precisely to stop Compass asserting
                    things it did not observe. An unreachable server never sent
                    one, so nothing is claimed about when it happened. */}
                {failure.at && `No answer at ${new Date(failure.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}. `}
                {linesUnreachable && "The connection dropped before Compass could ask. "}
                Compass hasn't judged anything either way.
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
          <div style={{ padding: "2px 20px 18px", fontSize: 14, color: "var(--text-3)" }}>{skyQuiet ? "Finding what's next…" : "Reading the sky…"}</div>
        ) : (
          /* The quiet day CONTRACTS rather than disappearing. */
          lines.quiet === "all-placed" ? (
            /* EVERYTHING IS ALREADY PLACED. Not a cold start — the opposite.
               This state used to render the cold-start doors above a fully
               scheduled list, telling someone their list was empty while it
               sat one panel below. */
            <div style={{ padding: "2px 20px 20px" }}>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: 22, lineHeight: 1.3,
                color: "var(--color-foreground)", maxWidth: 560,
              }}>
                Everything you're holding already has a time.
              </div>
              <div style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.55, marginTop: 5 }}>
                {(lines.alreadyScheduled?.length ?? 0) > 0
                  ? `${lines.alreadyScheduled.length} thing${lines.alreadyScheduled.length === 1 ? "" : "s"} on the calendar. Add something new and Compass will find it a window.`
                  : "Add something new and Compass will find it a window."}
              </div>
              <div className="cta-row" style={{ display: "flex", gap: 16, marginTop: 14 }}>
                <button onClick={() => onNavigate("calendar")} style={{
                  fontSize: 12, background: "none", border: "none", padding: 0, cursor: "pointer",
                  color: "var(--color-primary)",
                }}>See the day →</button>
                <button onClick={() => onQuickCapture?.()} style={{
                  fontSize: 12, background: "none", border: "none", padding: 0, cursor: "pointer",
                  color: "var(--text-3)",
                }}>Add something</button>
              </div>
            </div>
          ) : lines.quiet === "thin-inventory" ? (
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
                Compass times the things on your list. There's nothing on it yet.
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
                  // "Paste a list" has to OPEN somewhere to paste it. This
                  // focused the one-line field far below instead, which read
                  // as the click having failed — a door that only scrolls is
                  // not a door. The capture sheet takes a whole dump at once.
                  { title: "Paste today's list", sub: "One line per thing.",
                    go: () => onQuickCapture
                      ? onQuickCapture()
                      : document.querySelector<HTMLInputElement>('input[placeholder^="Add a task"]')?.focus() },
                  { title: "Choose recurring activities", sub: "Pick once; timing works from then on.",
                    go: () => onNavigate("work") },
                  { title: "Find a time for one thing", sub: "Name it and get a window.",
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
              Nothing stands out today.
            </div>
            <div style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.55, marginTop: 5 }}>
              Pick by what matters most; the sky has no preference.
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
            {r.supportLevel === "convergent" && <Badge text="lines up" color={CONVERGENT} />}
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

        {!skyQuiet && <div style={{ borderTop: "1px solid var(--color-border)", padding: "4px 6px 6px" }}>
          <details>
            <summary style={{ padding: "6px 14px", cursor: "pointer", fontSize: 11.5, color: "var(--color-primary)", listStyle: "none" }}>
              Find a time for something else
            </summary>
            <ElectionPicker testerId={testerId} lat={lat} lon={lon} onAsk={onAskAboutElection} />
          </details>
        </div>}
      </div>}
    </div>
  );
}
