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
import { fetchJson } from "@/lib/fetchJson";
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
}
interface LinesUp {
  results: LinesUpResult[];
  clarify: { held: { id: string; title: string }; candidates: { key: string; label: string }[] }[];
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
const ANSWER: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 14,
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};
const PANEL: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
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

function whenPhrase(r: { state: string; startAt: string; endAt: string; startClock: string; endClock: string; allDay: boolean }) {
  if (r.allDay) return { lead: "Supported all day", sub: null as string | null };
  const start = new Date(r.startAt);
  const mins = Math.round((start.getTime() - Date.now()) / 60000);

  if (r.state === "open-now") {
    return { lead: `Open now, until ${r.endClock}`, sub: null };
  }
  if (r.state === "passed") {
    // Said plainly rather than hidden: it was the day's best window and it has
    // gone, which is worth knowing.
    return { lead: `${r.startClock}–${r.endClock}`, sub: "that window has passed" };
  }
  if (mins <= 90) {
    return { lead: `In ${mins < 60 ? `${Math.max(1, mins)} min` : "about an hour"}, ${r.startClock}–${r.endClock}`, sub: null };
  }
  return { lead: `${partOfDay(start).replace(/^this |^around /, (m) => m)}, ${r.startClock}–${r.endClock}`, sub: null };
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
  const { data: lines, isError: linesFailed, isLoading: linesLoading } = useQuery<LinesUp>({
    queryKey: ["lines-up", testerId, lat, lon],
    queryFn: () => fetchJson<LinesUp>(
      `/api/elections/lines-up?lat=${lat}&lon=${lon}&tz=${new Date().getTimezoneOffset()}&locationKnown=${locationKnown}`,
      { headers }),
    enabled: !!testerId,
  });

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
  const needsActivity = new Set((resolution?.needsActivity ?? []).map(n => Number(n.id.replace("task-", ""))));

  const Row = ({ t, muted }: { t: Task; muted?: boolean }) => {
    const timing = timingFor.get(t.id);
    return (
      <div style={{ padding: "7px 16px", borderTop: "1px solid var(--color-border)" }}>
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
        {t.done !== "true" && (timing || needsDuration.has(t.id) || needsActivity.has(t.id)) && (
          <div style={{ fontSize: 10.5, marginLeft: 24, marginTop: 1, color: "var(--color-muted)" }}>
            {timing ? (
              <>
                <span style={{ color: timing.supportLevel === "convergent" ? CONVERGENT : "var(--color-muted)" }}>
                  {timing.activityLabel}
                </span>
                {" · "}
                {timing.allDay ? "supported all day" : `window ${timing.startClock}–${timing.endClock}`}
              </>
            ) : needsActivity.has(t.id) ? "needs a kind of work before it can be timed"
              : "needs a rough duration before it can be placed"}
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
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "14px 0 40px", maxWidth: 980, margin: "0 auto", width: "100%" }}>

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
      <div style={ANSWER}>
        <SectionTitle
          action={
            <details style={{ display: "inline" }}>
              <summary style={{ fontSize: 11, color: "var(--color-primary)", cursor: "pointer", listStyle: "none" }}>
                Find another activity →
              </summary>
            </details>
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

            <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.22, letterSpacing: "-0.4px", color: "var(--color-foreground)" }}>
              {lead.held.title}
            </div>
            {(() => {
              const w = whenPhrase(lead);
              return (
                <>
                  <div style={{
                    fontSize: 15, marginTop: 4, fontWeight: 500,
                    color: lead.state === "passed" ? "var(--text-3)" : "var(--color-primary)",
                  }}>
                    {w.lead.charAt(0).toUpperCase() + w.lead.slice(1)}
                  </div>
                  {w.sub && <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 1 }}>{w.sub}</div>}
                </>
              );
            })()}

            {/* The receipt, behind a disclosure. An astro-literate reader must
                be able to inspect it; nobody should have to read it first. */}
            {lead.why && (
              <details style={{ marginTop: 9 }}>
                <summary style={{
                  fontSize: 11.5, color: "var(--color-primary)", cursor: "pointer", listStyle: "none",
                  display: "inline-block", padding: "3px 10px", borderRadius: 7,
                  border: "1px solid var(--color-border)",
                }}>
                  See the evidence
                </summary>
                <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.55, marginTop: 5 }}>{lead.why}</div>
              </details>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={() => setShapeOpen(true)} style={{
                fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8, cursor: "pointer",
                border: "none", background: "var(--color-primary)", color: "var(--color-card)",
              }}>Put on today</button>
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
          <div style={{ padding: "2px 20px 18px" }}>
            <div style={{ fontSize: 17, lineHeight: 1.35, color: "#a03030" }}>
              I couldn't read the sky just now.
            </div>
            <div style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.55, marginTop: 5 }}>
              This is a connection problem, not a quiet day — the difference matters, so it says so.
            </div>
          </div>
        ) : linesLoading ? (
          <div style={{ padding: "2px 20px 18px", fontSize: 14, color: "var(--text-3)" }}>Reading the sky…</div>
        ) : (
          /* The quiet day CONTRACTS rather than disappearing. */
          <div style={{ padding: "2px 20px 18px" }}>
            <div style={{ fontSize: 17, lineHeight: 1.35, color: "var(--color-foreground)" }}>
              {lines?.quiet === "thin-inventory"
                ? "Compass doesn't have enough to time yet."
                : "Nothing you're holding is especially singled out today."}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.55, marginTop: 5 }}>
              {lines?.quiet === "thin-inventory"
                ? "Add something below, or look up an activity."
                : "Use priority, momentum, or simple necessity."}
              {lines?.nextOpening && (
                <> The next notable opening is {lines.nextOpening.activityLabel.toLowerCase()} on {lines.nextOpening.date} at {lines.nextOpening.startClock}.</>
              )}
            </div>
          </div>
        )}

        {/* Two or three results: compact rows beneath the lead, never three heroes. */}
        {secondary.map((r) => (
          <div key={r.held.id} style={{
            display: "flex", alignItems: "baseline", gap: 10, padding: "7px 20px",
            borderTop: "1px solid var(--color-border)",
          }}>
            <span style={{ fontSize: 12.5, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.held.title}
            </span>
            {r.supportLevel === "convergent" && <Badge text="converges" color={CONVERGENT} />}
            <span style={{
              fontSize: 11.5, flexShrink: 0,
              color: r.state === "passed" ? "var(--text-3)" : "var(--color-primary)",
            }}>
              {r.allDay ? "all day" : r.state === "open-now" ? `now, until ${r.endClock}` : `${r.startClock}–${r.endClock}`}
            </span>
          </div>
        ))}

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
              <button onClick={() => setShapeOpen(v => !v)} style={{
                fontSize: 11, background: "none", border: "none", padding: 0, cursor: "pointer",
                color: "var(--color-primary)",
              }}>{shapeOpen ? "Hide the shape" : "Shape today →"}</button>
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
