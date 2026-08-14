import React, { useState, useEffect } from "react";
import { localToday, addDaysLocal } from "@/lib/dates";
import { aiErrorMessage } from "@/lib/aiError";
import { invalidateWindows } from "@/lib/invalidateWindows";
import { restorePlannerDraft } from "@/lib/plannerDraft";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNorthStars } from "@/hooks/useTides";
import { useTester } from "@/contexts/tester-context";
import { PLANET_GLYPH } from "@/lib/glyphs";
import { ELEMENT_COLORS } from "@/lib/elements";
import PlanCalendar from "@/components/PlanCalendar";

// The Planner — dump everything you need to do, and it weaves each task into the
// calendar at the time the sky best supports it (GTD + astrology). Two steps:
// parse the dump into editable cards (fix the estimate / energy / deadline the
// AI guessed), then weave those into open windows for review before anything is
// written. Honors your waking hours and works around your Google Calendar.

const ELEMENT_COLOR: Record<string, string> = { fire: "#c04830", earth: ELEMENT_COLORS.earth, air: ELEMENT_COLORS.air, water: ELEMENT_COLORS.water };
const ENERGIES = ["low", "medium", "high"] as const;
/** What the energy setting actually decides, said where it is set. */
const ENERGY_HINT: Record<string, string> = {
  low: "Can be done tired — placed in the day's quieter stretches",
  medium: "Ordinary focus",
  high: "Needs you at your best — placed at the day's peaks",
};

interface Card {
  title: string; estimatedMinutes: number; energy: string; dueDate: string | null;
  element: string; windowType: string; planets: string[]; rationale: string;
  /** Every lane this work suits, primary first. Absent means just `element`. */
  elements?: string[];
  /** The Guiding Star this serves, when one is named. */
  goalId?: number | null;
}
interface Alternative { startAt: string; endAt: string; date: string; tier: string; tierNote: string; planetaryHour: string; }
interface PlannedItem extends Card { date: string; startAt: string; endAt: string; planetaryHour: string; matchedLane: boolean; tier?: string; tierNote?: string; alternatives?: Alternative[]; }
interface UnplacedItem { title: string; element: string; reason: string; }
interface WeaveResult { horizon: string; planned: PlannedItem[]; unplaced: UnplacedItem[]; }

const HORIZONS: { key: string; label: string; hint: string }[] = [
  { key: "day", label: "Today", hint: "one line per thing you want to land today" },
  { key: "week", label: "This week", hint: "add deadlines like “report by Fri” — it'll respect them" },
  { key: "month", label: "This month", hint: "bigger arcs; note due dates and it schedules backward from them" },
];

const fmtDayHeader = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

// A draft survives a reload. It used to be pure component state, so a refresh
// — or a phone deciding to reclaim the tab — silently threw away a dump, an AI
// parse of it, and a woven schedule. That is minutes of real work and two API
// calls, discarded with no warning and no way back.
const draftKey = (testerId: string | null) => `compass-planner-draft-${testerId ?? "anon"}`;

interface Draft {
  horizon: string; rawList: string; cards: Card[] | null;
  result: WeaveResult | null; dropped: number[]; savedAt: string;
}

export default function Planner({ testerId, lat, lon, seedList, onSeedConsumed }: { testerId: string | null; lat: number; lon: number; seedList?: string | null; onSeedConsumed?: () => void }) {
  const qc = useQueryClient();
  const { profile } = useTester();
  const [horizon, setHorizon] = useState("week");
  const [rawList, setRawList] = useState("");
  const [cards, setCards] = useState<Card[] | null>(null);   // editable, after parse
  const [result, setResult] = useState<WeaveResult | null>(null);
  const [dropped, setDropped] = useState<Set<number>>(new Set());
  // What the minute field currently READS, per card, while it is being typed
  // in. Clamping on every keystroke made the field impossible to edit: typing
  // "6" toward "60" parsed as 6, was floored to the 15 minimum, and the
  // caret landed after a number nobody typed — so backspace appeared to stick
  // at 15 and no other value could be reached. The clamp belongs on blur.
  const [minDraft, setMinDraft] = useState<Record<number, string>>({});
  /** The "add more" box, open only when asked for. A second thought APPENDS
   *  to the list — it does not replace what has already been read. */
  const [addingMore, setAddingMore] = useState(false);
  const [moreText, setMoreText] = useState("");
  // The stars a task can be hung on. The intake is where someone knows what
  // a piece of work is in service of — asking later, on a different page,
  // is asking after the moment has passed.
  const { data: starsRaw } = useNorthStars(testerId);
  const stars = (Array.isArray(starsRaw) ? starsRaw : [])
    .filter((g: any) => g.status !== "done" && g.status !== "paused");
  const [committed, setCommitted] = useState(false);
  // Set when a restored draft's schedule had already gone stale.
  const [staleWeave, setStaleWeave] = useState(false);
  const [restored, setRestored] = useState(false);

  // Restore once, before anything else can write over it.
  useEffect(() => {
    try {
      // The list comes back; a schedule whose moments have passed does not.
      // See lib/plannerDraft.ts for why, and the tests that pin it.
      const { draft, staleWeave: stale } = restorePlannerDraft(
        localStorage.getItem(draftKey(testerId)), Date.now(),
      );
      if (draft) {
        const d = draft as Draft;
        setHorizon(d.horizon ?? "week");
        setRawList(d.rawList ?? "");
        setCards(d.cards ?? null);
        setDropped(new Set(d.dropped ?? []));
        setResult(d.result ?? null);
      }
      setStaleWeave(stale);
    } finally {
      setRestored(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testerId]);

  // Persist on every change, but never before the restore has run — otherwise
  // the initial empty state overwrites the draft we are about to load.
  useEffect(() => {
    if (!restored) return;
    try {
      if (!rawList && !cards && !result) {
        localStorage.removeItem(draftKey(testerId));
        return;
      }
      const d: Draft = { horizon, rawList, cards, result, dropped: [...dropped], savedAt: new Date().toISOString() };
      localStorage.setItem(draftKey(testerId), JSON.stringify(d));
    } catch {
      // Private mode / quota. The draft simply won't survive; nothing breaks.
    }
  }, [restored, testerId, horizon, rawList, cards, result, dropped]);

  const chrono: any = profile?.chronotype ?? {};
  const authHeaders = { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) };
  // `rawList` is cleared too. Without it, starting over after a commit put
  // the already-scheduled list back in the box, so the tab looked as though
  // nothing had happened and re-reading it would have duplicated the lot
  // (owner, 2026-08-13: "after I have input a list, it should not show in
  // the place where I input things").
  const reset = () => { setCards(null); setResult(null); setDropped(new Set()); setCommitted(false); setStaleWeave(false); setRawList(""); setAddingMore(false); };

  const parse = useMutation({
    // Accepts an optional list so the quick-capture seed can be parsed
    // immediately, before the rawList state has flushed.
    mutationFn: async (listArg?: string): Promise<Card[]> => {
      const r = await fetch("/api/plan/parse", {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ rawList: listArg ?? rawList, tz: new Date().getTimezoneOffset() }),
      });
      if (!r.ok) throw new Error(await aiErrorMessage(r));
      return (await r.json()).tasks;
    },
    // APPEND when this was an "add more" pass, replace when it was the first
    // read. A second thought is an addition; treating it as a replacement
    // would silently drop everything already reviewed and edited.
    onSuccess: (t) => {
      setCards(prev => (addingMore && prev ? [...prev, ...t] : t));
      setResult(null);
      setCommitted(false);
      setAddingMore(false);
      setMoreText("");
    },
  });

  // Arrived from quick capture's "dump & schedule": prefill the list and read
  // it straight away, so capture flows seamlessly into scheduling (#15).
  useEffect(() => {
    if (!seedList) return;
    setRawList(seedList);
    reset();
    parse.mutate(seedList);
    onSeedConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedList]);

  // Your calendar as busy time, so the weaver schedules around real commitments.
  //
  // This used to return [] on BOTH "not connected" and "the request failed" —
  // which made a broken calendar indistinguishable from a free week, and the
  // weaver would confidently place deep work on top of a meeting. For someone
  // who has started running their week through Compass, "couldn't check your
  // calendar" and "your calendar is empty" are opposite facts, and only one of
  // them is safe to plan on.
  //
  // `ok: false` is now returned distinctly so the caller can say so rather than
  // quietly producing a wrong plan. Not-connected stays silent — that's a
  // genuine empty, not a failure.
  type BusyResult = { ok: boolean; busy: { startAt: string; endAt: string }[] };
  async function gcalBusy(): Promise<BusyResult> {
    const days = horizon === "day" ? 1 : horizon === "month" ? 28 : 7;
    const start = new Date().toISOString();
    const end = new Date(Date.now() + days * 86400000).toISOString();
    try {
      const r = await fetch(`/api/integrations/google-cal/events?start=${start}&end=${end}`, { headers: authHeaders });
      // 404/409 = not connected: a true empty, nothing to warn about.
      if (r.status === 404 || r.status === 409) return { ok: true, busy: [] };
      if (!r.ok) return { ok: false, busy: [] };
      const data = await r.json();
      if (data?.connected === false) return { ok: true, busy: [] };
      return {
        ok: true,
        busy: (data.events ?? []).filter((e: any) => !e.allDay && e.start && e.end)
          .map((e: any) => ({ startAt: e.start, endAt: e.end })),
      };
    } catch { return { ok: false, busy: [] }; }
  }
  // Surfaced next to the result — never swallowed.
  const [calendarUnverified, setCalendarUnverified] = useState(false);

  const weave = useMutation({
    mutationFn: async (): Promise<WeaveResult> => {
      const cal = await gcalBusy();
      setCalendarUnverified(!cal.ok);
      const busy = cal.busy;
      const r = await fetch("/api/plan/weave", {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({
          tasks: cards, horizon, lat, lon, tz: new Date().getTimezoneOffset(),
          // The zone NAME, not just the offset: the offset changes at a DST
          // boundary, so it cannot say when a local day ends across one.
          tzName: Intl.DateTimeFormat().resolvedOptions().timeZone,
          wakeTime: chrono.wakeTime, sleepTime: chrono.sleepTime, busy,
        }),
      });
      if (!r.ok) throw new Error(await aiErrorMessage(r));
      return r.json();
    },
    onSuccess: (data) => { setResult(data); setDropped(new Set()); setCommitted(false); },
  });

  const commit = useMutation({
    mutationFn: async () => {
      const items = (result?.planned ?? []).filter((_, i) => !dropped.has(i));
      const r = await fetch("/api/plan/commit", { method: "POST", headers: authHeaders, body: JSON.stringify({ items }) });
      if (!r.ok) throw new Error("commit failed");
      return r.json();
    },
    onSuccess: () => {
      invalidateWindows(qc);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setCommitted(true);
      // Written to the calendar — it is no longer a draft, and leaving it on
      // disk would offer to re-commit work that already exists.
      try { localStorage.removeItem(draftKey(testerId)); } catch { /* ignore */ }
    },
  });

  /**
   * Keep ONE item, without taking the whole plan.
   *
   * All-or-nothing was the only option, so a plan that was right about eight
   * of nine things had to be accepted wholesale or abandoned. The same
   * /plan/commit endpoint takes a list, so a list of one is a legitimate
   * commit — no new server surface.
   */
  const [keptOne, setKeptOne] = useState<Set<number>>(new Set());
  const commitOne = useMutation({
    mutationFn: async ({ idx }: { idx: number }) => {
      const item = result?.planned[idx];
      if (!item) throw new Error("nothing to keep");
      const r = await fetch("/api/plan/commit", { method: "POST", headers: authHeaders, body: JSON.stringify({ items: [item] }) });
      if (!r.ok) throw new Error("couldn't schedule that one");
      return r.json();
    },
    onSuccess: (_d, { idx }) => {
      invalidateWindows(qc);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setKeptOne((s) => new Set(s).add(idx));
    },
  });

  // Which row has its alternatives open. The plan is a proposal until commit,
  // so moving one is local state — no endpoint, nothing written.
  const [movingIdx, setMovingIdx] = useState<number | null>(null);
  const moveTo = (idx: number, alt: Alternative) => {
    setResult((r) => {
      if (!r) return r;
      const planned = r.planned.map((p, i) => i === idx
        ? { ...p, startAt: alt.startAt, endAt: alt.endAt, date: alt.date, tier: alt.tier, tierNote: alt.tierNote, planetaryHour: alt.planetaryHour,
            // The slot it just vacated becomes an option again, and the one it
            // took stops being one — otherwise "move" is a one-way door.
            alternatives: [
              { startAt: p.startAt, endAt: p.endAt, date: p.date, tier: p.tier ?? "workable", tierNote: p.tierNote ?? "", planetaryHour: p.planetaryHour },
              ...(p.alternatives ?? []).filter((a) => a.startAt !== alt.startAt),
            ].slice(0, 3) }
        : p);
      return { ...r, planned };
    });
    setMovingIdx(null);
  };

  const editCard = (i: number, patch: Partial<Card>) => setCards((cs) => cs!.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const removeCard = (i: number) => setCards((cs) => cs!.filter((_, j) => j !== i));

  /**
   * Break one big card into the moments it is actually made of.
   *
   * A three-hour card is not a three-hour act — it is several, and the sky
   * suits them differently. This reuses the same /planning/breakdown the
   * Guiding Stars use, but keeps the result HERE as cards rather than
   * committing steps to a goal: the intake's job is to make the list true
   * before anything is scheduled, not to start a project.
   *
   * The parent's estimate is divided among the parts, so a broken-down task
   * does not silently triple the time it claims on the week.
   */
  const breakDown = useMutation({
    mutationFn: async ({ card }: { card: Card; index: number }) => {
      const r = await fetch("/api/planning/breakdown", {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ title: card.title }),
      });
      if (!r.ok) throw new Error(await aiErrorMessage(r));
      return (await r.json()).milestones as { title: string; element: string }[];
    },
    onSuccess: (steps, { card, index }) => {
      const parts = (steps ?? []).filter((s) => s.title?.trim());
      if (!parts.length) return;
      const each = Math.max(15, Math.round(card.estimatedMinutes / parts.length));
      setCards((cs) => {
        if (!cs) return cs;
        const made: Card[] = parts.map((s) => ({
          ...card,
          title: s.title.trim(),
          estimatedMinutes: each,
          element: ["fire", "earth", "air", "water"].includes(s.element) ? s.element : card.element,
          elements: undefined,
        }));
        return [...cs.slice(0, index), ...made, ...cs.slice(index + 1)];
      });
    },
  });

  /** A card's lanes, primary first. Absent `elements` means the single one. */
  const cardElements = (c: Card): string[] => (c.elements?.length ? c.elements : [c.element]);

  /**
   * Add or remove a lane. The last one cannot be removed — a task with no
   * element has nothing to be scheduled against, and silently falling back
   * to a guess would undo the correction the user just made.
   */
  const toggleElement = (i: number, c: Card, el: string) => {
    const cur = cardElements(c);
    const next = cur.includes(el) ? cur.filter((x) => x !== el) : [...cur, el];
    if (!next.length) return;
    editCard(i, { elements: next, element: next[0] });
  };

  const keptCount = (result?.planned.length ?? 0) - dropped.size;
  const byDay: Record<string, { item: PlannedItem; idx: number }[]> = {};
  (result?.planned ?? []).forEach((item, idx) => {
    if (dropped.has(idx)) return;
    (byDay[dayKey(item.startAt)] ??= []).push({ item, idx });
  });
  // …and within each day, since a move can land between two existing rows.
  Object.values(byDay).forEach((es) => es.sort((a, b) => Date.parse(a.item.startAt) - Date.parse(b.item.startAt)));

  // ── Capacity honesty (Sunsama's move) ──────────────────────────────────────
  // Say the overcommitment out loud BEFORE anything is written, while it's
  // still free to drop something. Deliberately a statement, not a block: this
  // app doesn't refuse to let you overreach, it just declines to pretend the
  // day is bigger than it is. Waking hours come from the chronotype the user
  // already gave us at onboarding (default 8–21 matches the weaver's clamp).
  const wakeH = parseInt(String(chrono.wakeTime ?? "08:00").slice(0, 2), 10);
  const sleepH = parseInt(String(chrono.sleepTime ?? "21:00").slice(0, 2), 10);
  const wakingHours = Math.max(1, (Number.isFinite(sleepH) ? sleepH : 21) - (Number.isFinite(wakeH) ? wakeH : 8));
  const dayLoad = Object.entries(byDay).map(([day, entries]) => {
    const minutes = entries.reduce((sum, { item }) => {
      const ms = Date.parse(item.endAt) - Date.parse(item.startAt);
      return sum + (Number.isFinite(ms) && ms > 0 ? ms / 60000 : 45);
    }, 0);
    return { day, hours: minutes / 60, share: minutes / 60 / wakingHours, count: entries.length };
  });
  // Two thirds of the waking day already spoken for is the point where a plan
  // stops being a plan; the copy stays plain rather than alarmed.
  const heavyDays = dayLoad.filter(d => d.share >= 0.66);

  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ marginBottom: 4, fontSize: 20, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "-0.3px" }}>Plan</div>
      <div style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.6, marginBottom: 16 }}>
        Dump everything on your plate. The Planner reads each task's nature, then weaves it into the open
        stretches of your week where the sky best supports that kind of work — deep work in focused windows,
        outreach in social ones — around your waking hours and your calendar. Nothing is scheduled until you say so.
      </div>

      {/* Horizon */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {HORIZONS.map((h) => (
          <button key={h.key} onClick={() => { setHorizon(h.key); }} style={{
            padding: "5px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer",
            border: horizon === h.key ? "1.5px solid #1a2a3a" : "1px solid var(--color-border)",
            background: horizon === h.key ? "#1a2a3a10" : "var(--color-card)",
            color: horizon === h.key ? "var(--color-foreground)" : "var(--color-muted)", fontWeight: horizon === h.key ? 600 : 400,
          }}>{h.label}</button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8 }}>{HORIZONS.find((h) => h.key === horizon)?.hint}</div>

      {/* Step 1 — dump */}
      {!cards && (
        <>
          <textarea
            value={rawList} onChange={(e) => setRawList(e.target.value)}
            placeholder={"write the quarterly report — deep focus, ~2h, due Friday\nreply to the landlord\ngo for a 45 min run\nbrainstorm names for the launch\ncall mom"}
            rows={6}
            style={{ width: "100%", padding: "11px 13px", borderRadius: 10, border: "1px solid var(--color-border)", fontSize: 12.5, lineHeight: 1.6, background: "var(--color-card-2)", color: "var(--color-foreground)", resize: "vertical", outline: "none", fontFamily: "inherit" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
            <button onClick={() => parse.mutate(undefined)} disabled={parse.isPending || !rawList.trim()} style={{
              padding: "8px 18px", borderRadius: 9, border: "none", fontSize: 12.5, fontWeight: 600,
              cursor: rawList.trim() ? "pointer" : "default", background: rawList.trim() ? "#1a2a3a" : "var(--color-border)", color: rawList.trim() ? "#fff" : "var(--text-3)",
            }}>{parse.isPending ? "Reading your list…" : "Read my list →"}</button>
            {parse.isError && <span style={{ fontSize: 11, color: "#a03030" }}>{(parse.error as Error)?.message ?? "Something went wrong — try again."}</span>}
          </div>
        </>
      )}

      {/* Step 2 — editable cards */}
      {cards && !result && (
        <div>
          {staleWeave && (
            // Explains a schedule that vanished between visits. Saying nothing
            // would read as the app losing the plan; the truth is that the plan
            // named times that have since passed.
            <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 9, padding: "7px 10px", borderRadius: 8, background: "var(--color-card-2)", border: "1px solid var(--color-border)" }}>
              Your list is still here, but the schedule around it had already passed — weave it again and it'll read the sky as it is now.
            </div>
          )}
          <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10 }}>
            Here's what I read — tweak the estimate, energy, or deadline, then weave it in.
          </div>
          {cards.map((c, i) => {
            const col = ELEMENT_COLOR[c.element] ?? "#888";
            return (
              <div key={i} style={{ padding: "10px 12px", marginBottom: 8, borderRadius: 9, border: "1px solid var(--color-border)", background: "var(--color-card)", borderLeft: `3px solid ${col}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                  <input value={c.title} onChange={(e) => editCard(i, { title: e.target.value })}
                    style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: "var(--color-foreground)", border: "none", background: "none", outline: "none" }} />
                  {c.planets?.length > 0 && (
                    <span style={{ fontSize: 10, color: "var(--text-3)" }} title={c.rationale}>{c.planets.map((p) => PLANET_GLYPH[p] ?? "").join(" ")}</span>
                  )}
                  <button onClick={() => removeCard(i)} title="Remove" style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>
                </div>
                {/* The read is a guess, not a verdict — every element stays one
                    tap away (a list of unrecognized tasks once came back
                    uniformly "earth" with no way to disagree). */}
                {/* Several lanes at once, because some work honestly belongs
                    in more than one: filming is the performance AND the
                    making. The scheduler treats them as alternatives — any
                    lane counts as a match — so naming a second one widens
                    the hours that suit, it does not dilute them. The first
                    stays primary for colour and for display. */}
                <div style={{ display: "flex", gap: 4, marginBottom: 7, flexWrap: "wrap", alignItems: "center" }}>
                  {(["fire", "earth", "air", "water"] as const).map((el) => {
                    const ec = ELEMENT_COLOR[el];
                    const chosen = cardElements(c);
                    const active = chosen.includes(el);
                    return (
                      <button key={el} onClick={() => toggleElement(i, c, el)} style={{
                        fontSize: 10, padding: "3px 10px", borderRadius: 10, cursor: "pointer",
                        border: active ? `1.5px solid ${ec}` : "1px solid var(--color-border)",
                        background: active ? `${ec}14` : "var(--color-card-2)",
                        color: active ? ec : "var(--text-3)", fontWeight: active ? 600 : 400,
                      }}>● {el}</button>
                    );
                  })}
                  {cardElements(c).length > 1 && (
                    <span style={{ fontSize: 9.5, color: "var(--text-3)" }}>any of these suits it</span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <label style={{ fontSize: 11, color: "var(--color-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                    {/* Free typing: any minute count is allowed, not just the
                        15-minute steps the arrows offer. The clamp runs on
                        blur so a half-typed number is never rewritten under
                        the caret. */}
                    <input type="number" min={1} max={480} step={5} inputMode="numeric"
                      value={minDraft[i] ?? String(c.estimatedMinutes)}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setMinDraft((d) => ({ ...d, [i]: raw }));
                        const n = parseInt(raw, 10);
                        if (Number.isFinite(n) && n >= 1 && n <= 480) editCard(i, { estimatedMinutes: n });
                      }}
                      onBlur={() => {
                        const n = parseInt(minDraft[i] ?? "", 10);
                        const settled = Number.isFinite(n) ? Math.max(1, Math.min(480, n)) : c.estimatedMinutes;
                        editCard(i, { estimatedMinutes: settled });
                        setMinDraft((d) => { const next = { ...d }; delete next[i]; return next; });
                      }}
                      style={{ width: 58, padding: "3px 5px", borderRadius: 6, border: "1px solid var(--color-border)", fontSize: 11, background: "var(--color-card-2)", color: "var(--color-foreground)" }} /> min
                  </label>
                  {/* The row said "low medium high" with nothing naming what
                      was being set — three bare adjectives beside a duration
                      read as anything at all. */}
                  <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--color-muted)", marginRight: 1 }}>energy</span>
                    {ENERGIES.map((en) => (
                      <button key={en} onClick={() => editCard(i, { energy: en })}
                        title={ENERGY_HINT[en]} style={{
                        fontSize: 10, padding: "3px 9px", borderRadius: 8, cursor: "pointer",
                        border: c.energy === en ? "1px solid #1a2a3a" : "1px solid var(--color-border)",
                        background: c.energy === en ? "#1a2a3a10" : "var(--color-card-2)", color: c.energy === en ? "var(--color-foreground)" : "var(--text-3)",
                      }}>{en}</button>
                    ))}
                  </div>
                  {/* Deadlines are opt-in — most tasks don't have one, and an
                      empty date field reads as a demand to invent one. */}
                  {c.dueDate != null ? (
                    <label style={{ fontSize: 11, color: "var(--color-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                      due <input type="date" value={c.dueDate} onChange={(e) => editCard(i, { dueDate: e.target.value || null })}
                        style={{ padding: "3px 5px", borderRadius: 6, border: "1px solid var(--color-border)", fontSize: 11, background: "var(--color-card-2)", color: "var(--color-foreground)" }} />
                      <button onClick={() => editCard(i, { dueDate: null })} aria-label="Clear due date" style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 11, padding: 0 }}>✕</button>
                    </label>
                  ) : (
                    <button onClick={() => editCard(i, { dueDate: addDaysLocal(localToday(), 3) })}
                      style={{ fontSize: 10.5, color: "var(--color-muted)", background: "none", border: "1px dashed var(--color-border)", borderRadius: 6, padding: "3px 9px", cursor: "pointer" }}>
                      + due date
                    </button>
                  )}
                  {/* Hang it on a star. Only offered when stars exist —
                      an empty picker is a question about something the
                      person hasn't got. */}
                  {stars.length > 0 && (
                    <select value={c.goalId ?? ""} onChange={(e) => editCard(i, { goalId: e.target.value ? Number(e.target.value) : null })}
                      title="The Guiding Star this serves"
                      style={{
                        padding: "3px 6px", borderRadius: 6, fontSize: 10.5, maxWidth: 150,
                        border: "1px solid var(--color-border)", background: "var(--color-card-2)",
                        color: c.goalId ? "var(--color-foreground)" : "var(--text-3)",
                      }}>
                      <option value="">no star</option>
                      {stars.map((g: any) => <option key={g.id} value={g.id}>{g.title}</option>)}
                    </select>
                  )}
                </div>

                {/* Only offered on cards big enough to actually contain
                    parts. A 45-minute task broken into three fifteens is
                    bookkeeping, not planning. */}
                {c.estimatedMinutes >= 90 && (
                  <div style={{ marginTop: 7 }}>
                    <button
                      onClick={() => breakDown.mutate({ card: c, index: i })}
                      disabled={breakDown.isPending}
                      style={{
                        fontSize: 10.5, color: "#7a6cae", background: "none", border: "none",
                        cursor: "pointer", padding: 0, textDecoration: "underline", fontWeight: 600,
                      }}>
                      {breakDown.isPending && breakDown.variables?.index === i
                        ? "thinking it through…"
                        : "✦ break into moments"}
                    </button>
                    <span style={{ fontSize: 9.5, color: "var(--text-3)", marginLeft: 8 }}>
                      {Math.round(c.estimatedMinutes / 60 * 10) / 10}h — the sky may suit its parts differently
                    </span>
                    {breakDown.isError && breakDown.variables?.index === i && (
                      <div style={{ fontSize: 9.5, color: "#a03030", marginTop: 3 }}>
                        {(breakDown.error as Error)?.message ?? "Couldn't break that down — try again."}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {/* ADD MORE — the box comes back empty, on request, and appends.
              The dump box itself stays hidden once its list is read: leaving
              the submitted text on screen made the page look as though
              nothing had happened. */}
          {addingMore ? (
            <div style={{ marginTop: 10 }}>
              <textarea
                autoFocus value={moreText} onChange={(e) => setMoreText(e.target.value)}
                placeholder={"anything else? one line each"}
                rows={3}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--color-border)", fontSize: 12.5, lineHeight: 1.6, background: "var(--color-card-2)", color: "var(--color-foreground)", resize: "vertical", outline: "none", fontFamily: "inherit" }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 7 }}>
                <button onClick={() => moreText.trim() && parse.mutate(moreText)} disabled={parse.isPending || !moreText.trim()} style={{
                  padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600,
                  cursor: moreText.trim() ? "pointer" : "default",
                  background: moreText.trim() ? "#1a2a3a" : "var(--color-border)", color: moreText.trim() ? "#fff" : "var(--text-3)",
                }}>{parse.isPending ? "Reading…" : "Add to the list"}</button>
                <button onClick={() => { setAddingMore(false); setMoreText(""); }} style={{ fontSize: 11, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer" }}>cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingMore(true)} style={{
              marginTop: 10, fontSize: 11.5, color: "var(--color-primary)", background: "none",
              border: "1px dashed var(--color-border)", borderRadius: 8, padding: "6px 12px", cursor: "pointer",
            }}>+ add more to the list</button>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
            <button onClick={() => weave.mutate()} disabled={weave.isPending || cards.length === 0} style={{
              padding: "8px 18px", borderRadius: 9, border: "none", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              background: "#1a2a3a", color: "#fff",
            }}>{weave.isPending ? "Reading the sky…" : "✦ Weave it in"}</button>
            <button onClick={reset} style={{ fontSize: 11, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer" }}>start over</button>
            {weave.isError && <span style={{ fontSize: 11, color: "#a03030" }}>{(weave.error as Error)?.message ?? "Something went wrong — try again."}</span>}
          </div>
        </div>
      )}

      {/* Step 3 — proposed schedule */}
      {result && (
        <div>
          {keptCount > 0 ? (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>Proposed schedule · {keptCount} task{keptCount === 1 ? "" : "s"}</div>
              {/* NOTHING IS SAVED YET, said where the plan appears rather than
                  only on the button at the bottom. Weaving reads as the act
                  that did the thing — a full schedule is on screen — so a
                  reader who stops here believes their list is on the calendar
                  and later finds Tasks empty (owner, 2026-08-13). */}
              {!committed && (
                <div style={{ fontSize: 11, color: "#8a7a50", marginTop: 3 }}>
                  A proposal — nothing is on your calendar or in Tasks until you keep it, below or per task.
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 10 }}>Nothing scheduled.</div>
          )}

          {/* The plan was built without knowing what's already on the calendar.
              Said plainly and BEFORE the commit button, because the failure is
              invisible in the result itself — the schedule looks just as
              confident either way. */}
          {calendarUnverified && (
            <div style={{
              fontSize: 11, lineHeight: 1.6, color: "#8a5030", marginBottom: 12,
              background: "#a0502010", border: "1px solid #a0502033", borderLeft: "3px solid #a05020",
              borderRadius: 8, padding: "9px 12px", display: "flex", gap: 8, alignItems: "flex-start",
            }}>
              <span style={{ flexShrink: 0 }}>⚠</span>
              <div style={{ flex: 1 }}>
                <b>Compass couldn't check your calendar.</b> This plan was built as though
                nothing else is booked, so it may sit on top of real commitments.
                <button onClick={() => weave.mutate()} disabled={weave.isPending} style={{
                  marginLeft: 6, fontSize: 10.5, padding: "2px 9px", borderRadius: 6, cursor: "pointer",
                  border: "1px solid #a0502055", background: "var(--color-card)", color: "#8a5030", fontWeight: 600,
                }}>{weave.isPending ? "…" : "Try again"}</button>
              </div>
            </div>
          )}

          {/* Capacity honesty — named before you commit, while dropping is
              still free. Not a blocker; the app doesn't refuse to let you
              overreach, it just won't pretend the day is bigger than it is. */}
          {heavyDays.length > 0 && (
            <div style={{
              fontSize: 11, lineHeight: 1.6, color: "#8a6a30", marginBottom: 12,
              background: "#c0802010", border: "1px solid #c0802033", borderRadius: 9, padding: "9px 12px",
            }}>
              <b style={{ color: "#a06818" }}>That's a full {heavyDays.length === 1 ? "day" : "few days"}.</b>{" "}
              {heavyDays.map((d, i) => (
                <span key={d.day}>
                  {i > 0 ? " · " : ""}{d.day} carries {d.hours < 1 ? "under an hour" : `about ${Math.round(d.hours)}h`} across {d.count} block{d.count === 1 ? "" : "s"}
                  {d.share >= 1 ? " — more than you're usually awake for" : `, roughly ${Math.round(d.share * 100)}% of your waking hours`}
                </span>
              ))}
              . Worth dropping a couple below before you commit — you can always weave them into next week.
            </div>
          )}

          {/* The shape first, then the detail: whether the week is stacked
              on Wednesday and empty on Thursday is the question a list
              cannot answer. Same `planned` array as the rows below, so the
              picture and the plan can never drift apart. */}
          <PlanCalendar items={result.planned as any} dropped={dropped} />

          {/* Sorted at RENDER, not once at weave time. The array was ordered
              chronologically when it arrived, so grouping followed it — but a
              move rewrites one item's time in place, and the groups then
              rendered Friday, Monday, Sunday. A schedule out of order is worse
              than no schedule. */}
          {Object.entries(byDay)
            .sort((a, b) => Date.parse(a[1][0].item.startAt) - Date.parse(b[1][0].item.startAt))
            .map(([day, entries]) => (
            <div key={day} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-3)", marginBottom: 6 }}>{fmtDayHeader(entries[0].item.startAt)}</div>
              {entries.map(({ item, idx }) => {
                const col = ELEMENT_COLOR[item.element] ?? "#888";
                return (
                  <div key={idx} style={{ display: "flex", gap: 10, padding: "9px 12px", marginBottom: 6, borderRadius: 9, border: "1px solid var(--color-border)", background: "var(--color-card)", borderLeft: `3px solid ${col}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-foreground)" }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>
                        {fmtTime(item.startAt)}–{fmtTime(item.endAt)} · {item.estimatedMinutes}m
                        <span style={{ color: col, marginLeft: 6 }}>● {item.element}</span>
                        <span style={{ color: "var(--text-3)", marginLeft: 6 }}>{PLANET_GLYPH[item.planetaryHour] ?? ""} {item.planetaryHour} hour</span>
                      </div>
                      {/* Timing tier — the grading language for the slot itself */}
                      {item.tierNote && (
                        <div style={{
                          fontSize: 10.5, marginTop: 3, fontWeight: 600,
                          color: item.tier === "great" ? "#3a7040" : item.tier === "against" ? "#a06020" : "var(--color-muted)",
                        }}>
                          {item.tier === "great" ? "✦ " : item.tier === "against" ? "≋ " : "· "}{item.tierNote}
                        </div>
                      )}
                      <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 3, lineHeight: 1.5 }}>{item.rationale}</div>
                      {/* Move, not just drop. Until this existed the only
                          response to a placement you disliked was to delete it
                          and weave the whole list again. */}
                      {(item.alternatives?.length ?? 0) > 0 && (
                        <div style={{ marginTop: 5 }}>
                          <button onClick={() => setMovingIdx(movingIdx === idx ? null : idx)} style={{
                            fontSize: 10, padding: "2px 8px", borderRadius: 6, cursor: "pointer",
                            border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--text-2)",
                          }}>{movingIdx === idx ? "Keep it here" : `Move — ${item.alternatives!.length} other option${item.alternatives!.length === 1 ? "" : "s"}`}</button>
                          {movingIdx === idx && (
                            <div style={{ marginTop: 5, display: "flex", flexDirection: "column", gap: 4 }}>
                              {item.alternatives!.map((a) => (
                                <button key={a.startAt} onClick={() => moveTo(idx, a)} style={{
                                  textAlign: "left", fontSize: 10.5, padding: "5px 9px", borderRadius: 7, cursor: "pointer",
                                  border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--text-2)",
                                }}>
                                  <b style={{ color: "var(--text-1)" }}>{fmtDayHeader(a.startAt)}</b> {fmtTime(a.startAt)}–{fmtTime(a.endAt)}
                                  <span style={{ color: a.tier === "great" ? "#3a7040" : "var(--color-muted)", marginLeft: 6 }}>
                                    {a.tier === "great" ? "✦" : "·"} {a.tierNote}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Keep just this one. A plan that is right about eight of
                        nine should not have to be taken whole or abandoned. */}
                    {!committed && (
                      keptOne.has(idx)
                        ? <span style={{ fontSize: 10, color: "#3a6020", fontWeight: 600, flexShrink: 0 }}>✓ kept</span>
                        : <button onClick={() => commitOne.mutate({ idx })} disabled={commitOne.isPending}
                            title="Put just this one on the calendar" style={{
                              fontSize: 9.5, padding: "3px 9px", borderRadius: 7, cursor: "pointer", flexShrink: 0,
                              border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--text-2)", fontWeight: 600,
                            }}>{commitOne.isPending && commitOne.variables?.idx === idx ? "…" : "keep"}</button>
                    )}
                    <button onClick={() => setDropped((prev) => new Set(prev).add(idx))} title="Drop this one" style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 14, flexShrink: 0, lineHeight: 1 }}>✕</button>
                  </div>
                );
              })}
            </div>
          ))}

          {result.unplaced.length > 0 && (
            <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 9, background: "#8a6a2008", border: "1px solid #c8a84040" }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "#8a6a20", marginBottom: 4 }}>Couldn't place {result.unplaced.length}</div>
              {result.unplaced.map((u, i) => (
                <div key={i} style={{ fontSize: 11, color: "#8a7a50", lineHeight: 1.5 }}><b>{u.title}</b> — {u.reason}</div>
              ))}
              <div style={{ fontSize: 10, color: "#a99a70", marginTop: 4 }}>Try a longer horizon, or free up some calendar time.</div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
            {keptCount > 0 && !committed && (
              <button onClick={() => commit.mutate()} disabled={commit.isPending} style={{ padding: "9px 20px", borderRadius: 9, border: "none", fontSize: 12.5, fontWeight: 600, background: "#3a6020", color: "#fff", cursor: "pointer" }}>{commit.isPending ? "Scheduling…" : `Schedule all ${keptCount} →`}</button>
            )}
            {committed && <span style={{ fontSize: 12, color: "#3a6020", fontWeight: 600 }}>✓ Woven into your calendar (Ahead) and added to Tasks.</span>}
            <button onClick={() => setResult(null)} style={{ fontSize: 11, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer" }}>← back to edit</button>
          </div>
        </div>
      )}
    </div>
  );
}
