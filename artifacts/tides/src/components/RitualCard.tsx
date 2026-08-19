/**
 * THE DAILY LOOP — morning "Cast off", evening "Log the day".
 *
 * Compass's whole shape is a loop (owner, 2026-07-29: the nav IS the loop),
 * and this card is where the loop is actually opened and closed. It lived on
 * Today, which since the 2026-08-04 split is not the page anyone lands on —
 * so the app's central ritual was on a surface people had to go looking for.
 *
 * TIME-OF-DAY GATED, not always-on. Morning is the first hours after waking
 * and evening the last before sleep, both read from the person's OWN
 * chronotype rather than an office clock; in between this renders nothing and
 * Home is its usual self. That is why it can sit high on the page without
 * costing the ordinary day anything.
 *
 * It carries the whole ritual with it — the star rows, the morning chips,
 * the cascade when a block is missed, the block check, and the evening
 * harvest — because splitting a loop across two pages is how it stops being
 * one.
 */

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetchJson";
import { Outbox, type OutboxState } from "@/lib/outbox";

/** Where the day's journal line lives on this device. */
function journalKey(testerId: string | null, date: string) {
  return `tides-journal-${testerId ?? "anon"}-${date}`;
}

/** Text written but not yet accepted by the server. Survives a closed tab. */
function journalPendingKey(testerId: string | null, date: string) {
  return `tides-journal-pending-${testerId ?? "anon"}-${date}`;
}

import { ELEMENT_COLORS, CHARACTER_ELEMENT, type TideCharacter } from "@/lib/elements";
import { PLANET_LITERACY } from "@/lib/sky-literacy";
import { localToday, localDayRange, addDaysLocal } from "@/lib/dates";
import { invalidateWindows } from "@/lib/invalidateWindows";
import { useTester } from "@/contexts/tester-context";
import { StarRows, EveningHarvest } from "@/components/Momentum";

/** Streak language, and the reason it stays gentle below three days: a
 *  cadence the person chose is not a streak they are failing. */
const STREAK_NUDGE = (streak: number) =>
  streak >= 21 ? `day ${streak + 1} — this is who you are now`
  : streak >= 7 ? `day ${streak + 1} — the streak is the point`
  : streak >= 3 ? `day ${streak + 1} — momentum is real`
  : "small and daily beats big and rare";

export default function RitualCard({ mode, now, week, todayTasks, windows, testerId, displayName, onOpenStar, lat, lon, showJournal = true }: {
  mode: "morning" | "evening";
  now: any; week: any;
  todayTasks: { id: number; title: string; done: string }[];
  windows: any[] | undefined;
  testerId: string | null;
  displayName?: string;
  onOpenStar?: (goalId: number) => void;
  lat?: number; lon?: number;
  /** The `todayShowJournal` preference — the evening line is optional. */
  showJournal?: boolean;
}) {
  const qc = useQueryClient();
  const today = localToday();
  // Waking hours for re-homing, so nothing is ever proposed for 4am. The
  // chronotype is optional, hence the plain fallback; and when sleep is
  // earlier than wake it wraps past midnight, so the scan runs to end of day.
  const { profile: ritualProfile } = useTester();
  const parseHour = (v: string | undefined, fallback: number) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? ""));
    if (!m) return fallback;
    const h = parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
    return h >= 0 && h <= 24 ? h : fallback;
  };
  const wakeHour = parseHour(ritualProfile?.chronotype?.wakeTime, 7);
  const sleepRaw = parseHour(ritualProfile?.chronotype?.sleepTime, 22);
  const sleepHour = sleepRaw > wakeHour ? sleepRaw : 24;
  // Defensive: these come from queries that can momentarily hand back a
  // non-array (a transient error body). The ritual card is time-gated, so a
  // bad value here surfaces as a whole-page crash rather than a skipped card.
  const tasks = Array.isArray(todayTasks) ? todayTasks : [];
  const wins = Array.isArray(windows) ? windows : [];
  const { data: habitsRaw = [] } = useQuery<any[]>({
    // Same key and same URL as every other habits read in the app. Sharing a
    // key while asking for something different serves one surface's answer to
    // another, which is a bug this repo has already paid for once.
    queryKey: ["habits", testerId, today, lat, lon],
    queryFn: async () => { const j = await fetchJson(`/api/habits?today=${today}&lat=${lat}&lon=${lon}`, { headers: { "x-tester-id": testerId ?? "" } }); return Array.isArray(j) ? j : []; },
    enabled: !!testerId,
  });
  const habits = Array.isArray(habitsRaw) ? habitsRaw : [];
  const toggleLog = useMutation({
    mutationFn: async ({ id, done }: { id: number; done: boolean }) => {
      const headers = { "x-tester-id": testerId ?? "", "Content-Type": "application/json" };
      if (done) await fetch(`/api/habits/${id}/log?date=${today}`, { method: "DELETE", headers });
      else await fetch(`/api/habits/${id}/log`, { method: "POST", headers, body: JSON.stringify({ date: today }) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits"] }),
  });

  // Marking a scheduled block done — the door that was missing.
  // POST /planning/windows/:id/complete has existed since the Planner shipped
  // and was never called from anywhere, so `completedAt` was null on virtually
  // every row. The evening card already SAID "completed N blocks"; it just had
  // no way for anyone to make that true. It is also one of the three signals
  // the done-pattern reads, so an unwired verb meant a third of that evidence
  // never existed.
  const [blockError, setBlockError] = useState<number | null>(null);
  const markBlock = useMutation({
    mutationFn: async ({ id, done }: { id: number; done: boolean }) => {
      const r = await fetch(`/api/planning/windows/${id}/complete`, {
        method: "POST",
        headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
      });
      // Checked, because a silent write failure here is the exact bug class
      // this codebase spent a day removing (BACKLOG §2).
      if (!r.ok) throw new Error("could not save");
      return id;
    },
    onMutate: ({ id }) => { setBlockError(null); void id; },
    onError: (_e, v) => setBlockError(v.id),
    onSuccess: (id) => {
      invalidateWindows(qc);
      void offerCascade(id);
    },
  });

  // ── The cascade ───────────────────────────────────────────────────────────
  // Marking a block done AFTER its scheduled end is the moment we learn the
  // day slipped — and the only moment where asking about it isn't a nag,
  // because the user just told us.
  //
  // It ASKS. Motion ripples silently and its own users call that "AI calendar
  // anxiety"; Structured refuses to ripple at all, which is its loudest unmet
  // request. Both fall out of treating a block as a slot. A Compass window is
  // a claim that this time suits this work, so the card leads with what the
  // move COSTS — in the weaver's own words, not a second vocabulary.
  const [cascade, setCascade] = useState<null | {
    overrunMinutes: number; anchorTitle: string; affected: any[];
  }>(null);

  async function offerCascade(id: number) {
    const w = wins.find((x: any) => x.id === id);
    if (!w || !testerId) return;
    const overran = Date.now() - new Date(w.endTime).getTime();
    if (overran <= 60_000) return; // finished on time — nothing slipped
    try {
      const { from, to } = localDayRange(localToday());
      const r = await fetch("/api/planning/cascade/preview", {
        method: "POST",
        headers: { "x-tester-id": testerId, "Content-Type": "application/json" },
        body: JSON.stringify({
          windowId: id, from, to, lat, lon,
          tzOffsetMin: new Date().getTimezoneOffset(),
        }),
      });
      if (!r.ok) return; // a failed preview is silence, never a wrong offer
      const p = await r.json();
      if (p?.affected?.length) setCascade({ ...p, anchorTitle: w.title });
    } catch {
      // Same reasoning: if we can't say what a move costs, we don't offer one.
    }
  }

  const applyCascade = useMutation({
    mutationFn: async (shifts: { id: number; startAt: string; endAt: string }[]) => {
      const r = await fetch("/api/planning/cascade/apply", {
        method: "POST",
        headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({ shifts }),
      });
      if (!r.ok) throw new Error("could not move those");
      return r.json();
    },
    onSuccess: () => { invalidateWindows(qc); setCascade(null); },
  });

  const tide = now?.tide;
  const character = (tide?.character ?? "deep") as TideCharacter;
  const elKey = CHARACTER_ELEMENT[character] ?? "water";
  const elColor = ELEMENT_COLORS[elKey] ?? ELEMENT_COLORS.water;
  const habitList = Array.isArray(habits) ? habits : [];
  const el = now?.element?.element ?? "";

  // The day's flavor, for an honest accomplishment line on heavy days
  const HARD = new Set(["conjunction", "square", "opposition"]);
  const HEAVY = new Set(["Saturn", "Mars", "Pluto"]);
  const heavyContact = (now?.moonAspects ?? [])
    .map((a: any) => ({ ...a, partner: a.planet1 === "Moon" ? a.planet2 : a.planet1 }))
    .find((a: any) => HARD.has(a.aspect) && HEAVY.has(a.partner) && a.orb <= 4);
  const heavyAdj = heavyContact ? PLANET_LITERACY[heavyContact.partner]?.adjective : null;

  const firstName = (displayName ?? "").split(" ")[0];

  if (mode === "morning") {
    // "Today's three" (top task · next event · next block) used to render here.
    // It was YOUR DAY's now / next / still loose, computed by a second
    // algorithm — two surfaces answering one question two ways, which is how
    // the week caption came to argue with its own labels and how the
    // Keep-going card came to sit above "still loose: the same task". YOUR DAY
    // owns it, and in the morning it is framed "Already committed".
    //
    // The tide restatement went with it: the hero says the same sentence
    // verbatim a few inches above. This card's job is the twice-daily anchor —
    // the greeting, the star rows, the evening harvest — not a second reading
    // of a day already on screen.

    return (
      <div style={{ background: `linear-gradient(135deg, ${elColor}16, ${elColor}05)`, border: `1px solid ${elColor}30`, borderRadius: 14, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--color-primary)" }}>⛵ Cast off{firstName ? `, ${firstName}` : ""}</span>
          <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: elColor }}>morning</span>
        </div>


        {/* The morning glance: one row per Guiding Star — next move + today's
            best window for its element; tap → that star's game plan. */}
        <StarRows testerId={testerId} lat={lat} lon={lon} onOpenStar={onOpenStar} />

        {/* Morning chips: every daily, plus any looser practice that's actually
            BEHIND its own cadence. An "whenever it fits" habit never appears
            here unprompted — the morning glance shouldn't manufacture a
            to-do out of something that declared it has no schedule. */}
        {(() => {
          const morningHabits = habitList.filter((h: any) => {
            const cad = h.cadence ?? "daily";
            if (cad === "daily") return true;
            if (cad === "occasional") return false;
            return h.cadenceMet === false;
          });
          return morningHabits.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {morningHabits.map((h: any) => {
                const resonant = !h.doneToday && el && h.favoredElements?.includes(el);
                // An explicit solar anchor wins; otherwise fall back to the
                // element's implied rhythm — fire rides sunrise, air the high
                // sun, earth lands by sunset, water takes the Moon's own hour.
                const dl = (now as any)?.daylight;
                const moonHr = ((now as any)?.upcomingHours ?? []).find((u: any) => u.planet === "Moon");
                const fmtT = (iso?: string) => iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;
                const fe = h.favoredElements?.[0];
                // Bed is the chronotype's hour, not the sky's — the server
                // sends no instant for it, so the time renders from the
                // person's own sleepTime here.
                const sleepT = ritualProfile?.chronotype?.sleepTime;
                const anchor = h.doneToday ? null
                  : h.solarAnchor === "bed" ? `⏾ by ${sleepT ? new Date(`2000-01-01T${sleepT.padStart(5, "0")}:00`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "bed"}`
                  : h.solarAnchorAt ? `${h.solarAnchor === "sunset" ? "☾" : "☉"} ${h.solarAnchor === "sunset" ? "by " : ""}${fmtT(h.solarAnchorAt)}`
                  : fe === "fire" && dl?.sunrise ? `☉ ${fmtT(dl.sunrise)}`
                  : fe === "air" && dl?.sunrise && dl?.sunset ? `☉ ${fmtT(new Date((Date.parse(dl.sunrise) + Date.parse(dl.sunset)) / 2).toISOString())}`
                  : fe === "earth" && dl?.sunset ? `☉ by ${fmtT(dl.sunset)}`
                  : fe === "water" && moonHr ? `☽ ${moonHr.time}`
                  : null;
                return (
                  <button key={h.id} onClick={() => toggleLog.mutate({ id: h.id, done: h.doneToday })}
                    title={anchor ? "A daily sky anchor for this habit — sun or moon time that suits its element" : undefined}
                    style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 18, cursor: "pointer",
                    border: h.doneToday ? "1px solid #4a806040" : `1px solid ${resonant ? elColor : "var(--color-border)"}`,
                    background: h.doneToday ? "#4a806012" : "var(--color-card)",
                  }}>
                    <span style={{ fontSize: 11, color: h.doneToday ? "#4a8060" : "var(--text-3)" }}>{h.doneToday ? "✓" : "○"}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: h.doneToday ? "#4a8060" : "var(--color-foreground)" }}>{h.name}</span>
                    {resonant && <span style={{ fontSize: 10, color: elColor }}>✦</span>}
                    {/* A streak reads as encouragement on a daily and as
                        nonsense on a 3×/week — so non-dailies show their
                        cadence position instead. */}
                    <span style={{ fontSize: 9, color: "var(--text-3)" }}>
                      {(h.cadence ?? "daily") !== "daily"
                        ? `${h.windowDone ?? 0}/${h.windowTarget ?? 0} this week`
                        : h.doneToday ? `${h.streak}d` : STREAK_NUDGE(h.streak ?? 0)}
                    </span>
                    {anchor && <span style={{ fontSize: 8.5, color: "var(--text-3)" }}>{anchor}</span>}
                  </button>
                );
              })}
            </div>
          </div>
          );
        })()}

      </div>
    );
  }

  // ── Evening: Log the day ──
  const keptHabits = habitList.filter((h: any) => h.doneToday);
  // The denominator is DAILIES only. Counting a 3×/week or "whenever it fits"
  // practice as a miss every day it isn't done is exactly the cramped feeling
  // the cadence model exists to remove (owner 2026-07-29) — a day with two
  // dailies kept should read as two of two, not two of nine.
  const dailyHabits = habitList.filter((h: any) => (h.cadence ?? "daily") === "daily");
  const keptDailies = dailyHabits.filter((h: any) => h.doneToday);
  const doneBlocks = wins.filter((w: any) => w.completedAt);
  const closedTasks = tasks.filter((t) => t.done === "true");
  const didAnything = keptHabits.length + doneBlocks.length + closedTasks.length > 0;
  const parts: string[] = [];
  if (dailyHabits.length) parts.push(`kept ${keptDailies.length} of ${dailyHabits.length} dail${dailyHabits.length === 1 ? "y" : "ies"}`);
  // Non-daily practices are pure credit when they happen, never a shortfall.
  const keptOther = keptHabits.length - keptDailies.length;
  if (keptOther > 0) parts.push(`${keptOther} other practice${keptOther === 1 ? "" : "s"}`);
  if (closedTasks.length) parts.push(`closed ${closedTasks.length} task${closedTasks.length === 1 ? "" : "s"}`);
  if (doneBlocks.length) parts.push(`completed ${doneBlocks.length} block${doneBlocks.length === 1 ? "" : "s"}`);
  const tomorrow = (week?.days ?? [])[1];
  const tomorrowChar = tomorrow?.element ? ({ water: "Deep", fire: "Surge", earth: "Building", air: "Clear" } as Record<string, string>)[tomorrow.element] : null;

  return (
    <div style={{ background: `linear-gradient(135deg, ${elColor}16, ${elColor}05)`, border: `1px solid ${elColor}30`, borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--color-primary)" }}>🌙 Log the day{firstName ? `, ${firstName}` : ""}</span>
        <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: elColor }}>evening</span>
      </div>

      {/* Outside the didAnything branch, deliberately. BlockCheck is the ONLY
          way to mark a scheduled block complete, and it used to sit INSIDE it —
          so on a day whose only activity was blocks, `didAnything` was false
          and the verb never rendered. You could record a block only if you had
          already recorded something else. The door existed and was locked from
          the inside, which also starved the done-pattern of a third of its
          evidence for exactly the people who plan in blocks. */}
      {cascade && (
        <CascadeCard
          cascade={cascade}
          pending={applyCascade.isPending}
          onApply={(shifts) => applyCascade.mutate(shifts)}
          onDismiss={() => setCascade(null)}
        />
      )}
      <BlockCheck
        wins={wins} markBlock={markBlock} blockError={blockError} elColor={elColor}
        testerId={testerId} lat={lat ?? 30.27} lon={lon ?? -97.74}
        wakeHour={wakeHour} sleepHour={sleepHour}
        onRehomed={() => invalidateWindows(qc)}
      />

      {didAnything ? (
        <>
          <div style={{ fontSize: 12.5, color: "var(--color-foreground)", marginBottom: 6 }}>
            You {parts.join(" · ")}.
            {heavyAdj && <span style={{ color: "#8a7060" }}> On a {heavyAdj} day, that counts double.</span>}
          </div>
          {keptHabits.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
              {keptHabits.map((h: any) => (
                <span key={h.id} style={{ fontSize: 10, padding: "3px 9px", borderRadius: 14, background: "#4a806012", border: "1px solid #4a806030", color: "#4a8060", fontWeight: 600 }}>
                  ✓ {h.name}{h.streak > 0 ? ` · ${h.streak}d` : ""}
                </span>
              ))}
            </div>
          )}
          {habitList.some((h: any) => !h.doneToday) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
              {habitList.filter((h: any) => !h.doneToday).map((h: any) => (
                <button key={h.id} onClick={() => toggleLog.mutate({ id: h.id, done: false })} style={{
                  fontSize: 10, padding: "3px 9px", borderRadius: 14, background: "var(--color-card)",
                  border: "1px solid var(--color-border)", color: "var(--text-3)", cursor: "pointer",
                }}>○ {h.name} — did it? tap to log</button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 8 }}>
          A quiet day in the log is still a day in the log.
          {(tide?.level === "low" || tide?.level === "ebb") && " The tide was low — resting was reading the water right."}
        </div>
      )}

      {/* The harvest: today's wins (auto + named) and the line in your own
          words — this is the loop's evening half. */}
      <EveningHarvest testerId={testerId} lat={lat} lon={lon} />

      <div style={{ fontSize: 10.5, color: "var(--text-3)", paddingTop: 8, borderTop: "1px solid var(--color-border)" }}>
        Rate the day below — it lands in the Log, stamped with tonight's sky.
        {tomorrowChar && <span style={{ color: "var(--color-muted)" }}> Tomorrow: a {tomorrowChar} day.</span>}
      </div>

      {/* "Below" is now INSIDE. This rendered as a sibling on Today, so the
          sentence above pointed at a separate block — and once the card moved
          to Home the two would have been on different pages entirely. */}
      <div style={{ marginTop: 10 }}>
        <EveningReflection now={now} today={today} testerId={testerId} showJournal={showJournal} />
      </div>
    </div>
  );
}

/**
 * Today's scheduled blocks, with a way to say one happened.
 *
 * Deliberately only ONE verb. "Skip" needs no button — not pressing anything is
 * already that, and a schedule that demands you account for every unmet block
 * is the guilt ledger this product refuses (BACKLOG §4, do-not-copy).
 */
/**
 * "Your 2pm ran long — shift the next three?"
 *
 * The consent card. Three things it must do that a silent reschedule cannot:
 *
 *  · Show the cost. Each row says what the block's timing becomes, in the
 *    weaver's own grading ("a great time for this" / "this time will do" /
 *    "swimming against the current"). A block that no longer suits its new
 *    hour says so BEFORE you agree, not after.
 *  · Offer a middle. "Just the next one" is the honest answer most of the
 *    time — the 3pm slipped, the 6pm is fine where it is.
 *  · Make leaving them the easy, blameless option. Nothing here is a failure
 *    state, so nothing is styled like one.
 */
function CascadeCard({ cascade, onApply, onDismiss, pending }: {
  cascade: { overrunMinutes: number; anchorTitle: string; affected: any[] };
  onApply: (shifts: { id: number; startAt: string; endAt: string }[]) => void;
  onDismiss: () => void;
  pending: boolean;
}) {
  const t = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const shiftOf = (a: any) => ({ id: a.id, startAt: a.to.startAt, endAt: a.to.endAt });
  const all = cascade.affected.map(shiftOf);
  const n = cascade.affected.length;
  const costs = cascade.affected.filter((a: any) => a.verdict !== "holds").length;

  // Shifting ONLY the next block can push it on top of the one after, which
  // "shift all" never does because everything moves together. The card exists
  // to say what a move costs, so it cannot quietly hand back a double-booking.
  const soloOverlaps =
    n > 1 && new Date(cascade.affected[0].to.endAt) > new Date(cascade.affected[1].from.startAt);

  return (
    <div style={{
      marginBottom: 10, padding: "11px 13px", borderRadius: 10,
      background: "var(--color-card-2)", border: "1px solid var(--color-border)",
    }}>
      <div style={{ fontSize: 12, color: "var(--text-1)", marginBottom: 2 }}>
        <strong>{cascade.anchorTitle}</strong> ran {cascade.overrunMinutes} min long.
      </div>
      <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 8 }}>
        {n === 1 ? "One block sits after it." : `${n} blocks sit after it.`}{" "}
        {costs === 0
          ? "They'd all still suit their new times."
          : costs === n
            ? n === 1 ? "Moving it costs something:" : "Moving them costs something:"
            : `${costs} of them would lose something:`}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 9 }}>
        {cascade.affected.map((a: any) => (
          <div key={a.id} style={{ fontSize: 11, lineHeight: 1.45 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
              <span style={{ color: "var(--text-1)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.title}
              </span>
              <span style={{ color: "var(--text-3)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                {t(a.from.startAt)} → {t(a.to.startAt)}
              </span>
            </div>
            <div style={{ color: a.verdict === "holds" ? "var(--text-3)" : "var(--text-2)", fontSize: 10.5 }}>
              {a.verdict === "holds" ? "still " : "now "}{a.to.tierNote}
              {a.runsPastDay && " · runs past the end of your day"}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button onClick={() => onApply(all)} disabled={pending}
          style={{ fontSize: 11, padding: "4px 11px", borderRadius: 14, cursor: "pointer",
                   border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--text-1)", fontWeight: 500 }}>
          {n === 1 ? "Shift it" : `Shift all ${n}`}
        </button>
        {n > 1 && (
          <button onClick={() => onApply([all[0]])} disabled={pending}
            title={soloOverlaps
              ? `Would run into ${cascade.affected[1].title} at ${t(cascade.affected[1].from.startAt)}`
              : undefined}
            style={{ fontSize: 11, padding: "4px 11px", borderRadius: 14, cursor: "pointer",
                     border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--text-2)" }}>
            Just the next one
          </button>
        )}
        <button onClick={onDismiss} disabled={pending}
          style={{ fontSize: 11, padding: "4px 11px", borderRadius: 14, cursor: "pointer",
                   border: "none", background: "none", color: "var(--text-3)" }}>
          Leave them
        </button>
      </div>
      {soloOverlaps && (
        // Visible, not a tooltip — hover-only information is already a known
        // debt here (BACKLOG §3b) and this one changes what you'd choose.
        <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 6, lineHeight: 1.45 }}>
          Moving just the next one would run it into {cascade.affected[1].title} at{" "}
          {t(cascade.affected[1].from.startAt)}. Shifting all {n} keeps the gaps you had.
        </div>
      )}
    </div>
  );
}

/**
 * Where an undone block goes next.
 *
 * Deliberately NOT "same time tomorrow". The reason this block sat at 2pm
 * today doesn't transfer to 2pm tomorrow, so the times offered are scored for
 * the work — the same grading the weaver used to place it in the first place.
 *
 * The one verb rule holds: choosing a time is the only action. Doing nothing
 * leaves the block where it is, and nothing here counts, scolds, or tallies.
 */
function RehomeInline({ win, testerId, lat, lon, wakeHour, sleepHour, onDone }: {
  win: any; testerId: string | null; lat: number; lon: number;
  wakeHour: number; sleepHour: number; onDone: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { from, to } = localDayRange(addDaysLocal(localToday(), 1));
        const r = await fetch("/api/planning/rehome/suggest", {
          method: "POST",
          headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
          body: JSON.stringify({
            windowId: win.id, from, to, lat, lon,
            tzOffsetMin: new Date().getTimezoneOffset(), wakeHour, sleepHour,
          }),
        });
        if (!r.ok) throw new Error("no");
        const j = await r.json();
        if (alive) { setData(j); setState("ready"); }
      } catch {
        if (alive) setState("failed");
      }
    })();
    return () => { alive = false; };
  }, [win.id, testerId, lat, lon, wakeHour, sleepHour]);

  async function place(s: { startAt: string; endAt: string }) {
    setSaving(true);
    try {
      // PATCH /planning/windows/:id — shipped with the Planner and, until now,
      // never once called from the client.
      const r = await fetch(`/api/planning/windows/${win.id}`, {
        method: "PATCH",
        headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({ startTime: s.startAt, endTime: s.endAt }),
      });
      if (!r.ok) throw new Error("no");
      onDone();
    } catch {
      setState("failed");
    } finally {
      setSaving(false);
    }
  }

  const box = {
    marginTop: 4, marginBottom: 2, padding: "7px 9px", borderRadius: 8,
    background: "var(--color-card-2)", border: "1px solid var(--color-border)",
  } as const;

  if (state === "loading") {
    return <div style={{ ...box, fontSize: 10.5, color: "var(--text-3)" }}>Reading tomorrow…</div>;
  }
  if (state === "failed") {
    return <div style={{ ...box, fontSize: 10.5, color: "var(--text-3)" }}>
      Couldn't work out tomorrow just now — it'll keep.
    </div>;
  }
  if (!data?.suggestions?.length) {
    return <div style={{ ...box, fontSize: 10.5, color: "var(--text-3)" }}>
      {data?.fullDay
        ? "Tomorrow's already spoken for. This one can wait for a real opening."
        : "Nothing on tomorrow suits this yet."}
    </div>;
  }

  return (
    <div style={box}>
      <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 5 }}>
        Tomorrow, when it would actually suit:
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {data.suggestions.map((s: any) => (
          <button key={s.startAt} onClick={() => place(s)} disabled={saving}
            style={{
              display: "flex", gap: 8, alignItems: "baseline", textAlign: "left",
              padding: "4px 8px", borderRadius: 7, cursor: "pointer", width: "100%",
              border: "1px solid var(--color-border)", background: "var(--color-card)",
              fontFamily: "inherit",
            }}>
            <span style={{ fontSize: 11, color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>
              {new Date(s.startAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-2)" }}>{s.tierNote}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BlockCheck({ wins, markBlock, blockError, elColor, testerId, lat, lon, wakeHour, sleepHour, onRehomed }: {
  wins: any[]; markBlock: any; blockError: number | null; elColor: string;
  testerId: string | null; lat: number; lon: number;
  wakeHour: number; sleepHour: number; onRehomed: () => void;
}) {
  const open = wins.filter((w: any) => !w.completedAt);
  const [moving, setMoving] = useState<number | null>(null);
  if (open.length === 0) return null;
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-3)", marginBottom: 4 }}>
        Did these happen?
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {open.slice(0, 4).map((w: any) => {
          const t = new Date(w.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          // Only once its hour has actually gone. Offering to re-home a block
          // that hasn't started yet would be the app deciding, on your behalf,
          // that you aren't going to do it.
          const past = Date.now() > new Date(w.endTime).getTime();
          return (
            <div key={w.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text-2)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t} · {w.title}
                </span>
                {blockError === w.id && (
                  <span style={{ fontSize: 9, color: "#a03030" }}>didn't save</span>
                )}
                {past && (
                  <button
                    onClick={() => setMoving(moving === w.id ? null : w.id)}
                    style={{
                      fontSize: 10, padding: "2px 9px", borderRadius: 12, cursor: "pointer",
                      border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--text-3)",
                    }}
                  >{moving === w.id ? "never mind" : "→ move it"}</button>
                )}
                <button
                  onClick={() => markBlock.mutate({ id: w.id, done: true })}
                  disabled={markBlock.isPending}
                  style={{
                    fontSize: 10, padding: "2px 10px", borderRadius: 12, cursor: "pointer",
                    border: `1px solid ${elColor}40`, background: `${elColor}12`, color: elColor, fontWeight: 600,
                  }}
                >✓ did it</button>
              </div>
              {moving === w.id && (
                <RehomeInline
                  win={w} testerId={testerId} lat={lat} lon={lon}
                  wakeHour={wakeHour} sleepHour={sleepHour}
                  onDone={() => { setMoving(null); onRehomed(); }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * THE EVENING REFLECTION — what got done, and a line about how it felt.
 *
 * It rendered as a sibling of the ritual card on Today, which split one loop
 * across two blocks and, once the card moved to Home, would have split it
 * across two PAGES. The evening branch owns it now.
 *
 * The journal writes to the day's check-in row so it appears in the Log,
 * sky-stamped, with localStorage as the instant offline copy — through an
 * Outbox, because the code this replaced set a "will retry" flag and never
 * retried: text written offline sat on disk forever while the UI called it
 * safe.
 */
function EveningReflection({ now, today, testerId, showJournal }: {
  now: any; today: string; testerId: string | null; showJournal: boolean;
}) {
  const [journalText, setJournalText] = useState("");
  const [journalSync, setJournalSync] = useState<OutboxState>("clean");
  // Guards the server-hydrate race (audit P1): if the user starts typing
  // before the "no local copy" server fetch resolves, the fetch must not
  // stomp what they just typed.
  const journalTypedRef = useRef(false);
  // The outbox is created once and outlives re-renders, so it reads these
  // through refs rather than closing over a stale first-render value.
  const testerIdRef = useRef(testerId);
  const todayRef = useRef(today);
  testerIdRef.current = testerId;
  todayRef.current = today;
  useEffect(() => {
    const saved = localStorage.getItem(journalKey(testerId, today));
    if (saved) { setJournalText(saved); return; }
    // No local copy (new device / cleared storage) — hydrate from the server
    // check-in so the journal follows the account, not the browser.
    if (!testerId) return;
    fetch(`/api/check-ins/today?date=${today}`, { headers: { "x-tester-id": testerId } })
      .then(r => (r.ok ? r.json() : null))
      .then(row => { if (row?.notes && !journalTypedRef.current) setJournalText(row.notes); })
      .catch(() => {});
  }, [testerId, today]);

  // Journal persists to the day's check-in row so it shows up in The Log,
  // sky-stamped — localStorage stays as the instant/offline copy.
  //
  // Through an Outbox, because the old code set a "will retry" flag and then
  // never retried: text written offline sat on disk forever while the UI said
  // it was safe. The outbox actually retries, reports honestly when it can't,
  // and keeps the words either way.
  const outboxRef = useRef<Outbox | null>(null);
  if (!outboxRef.current) {
    outboxRef.current = new Outbox({
      send: async (notes) => {
        if (!testerIdRef.current) return false;
        const r = await fetch("/api/check-ins", {
          method: "POST",
          headers: { "x-tester-id": testerIdRef.current, "Content-Type": "application/json" },
          body: JSON.stringify({ date: todayRef.current, notes }),
        });
        if (r.ok) localStorage.removeItem(journalPendingKey(testerIdRef.current, todayRef.current));
        return r.ok;
      },
      onState: (s) => setJournalSync(s),
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      debounceMs: 900,
    });
  }

  // Unsent text from a previous session, plus a retry the moment the network
  // comes back — the two paths that made "will retry" a lie.
  useEffect(() => {
    if (!testerId) return;
    const pending = localStorage.getItem(journalPendingKey(testerId, today));
    if (pending) outboxRef.current?.restore(pending);
    const onOnline = () => outboxRef.current?.retryNow();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [testerId, today]);

  useEffect(() => () => outboxRef.current?.dispose(), []);

  function saveJournal(text: string) {
    journalTypedRef.current = true;
    setJournalText(text);
    localStorage.setItem(journalKey(testerId, today), text);
    if (!testerId) return;
    // Marked unsent BEFORE the attempt, so a tab closed mid-flight leaves a
    // record to pick up rather than a silent gap.
    localStorage.setItem(journalPendingKey(testerId, today), text);
    outboxRef.current?.queue(text);
  }
  const todayShowJournal = showJournal;
  if (!now) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <DonePattern today={today} testerId={testerId} />
      {todayShowJournal && (
        <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-foreground)" }}>Logbook line</span>
            {/* Four states that are each literally true, rather than one
                reassuring sentence that wasn't. "Failed" offers the verb it
                names — a Retry button that retries. */}
            <span style={{ fontSize: 9, display: "flex", alignItems: "center", gap: 6, color: journalSync === "failed" ? "#a03030" : "var(--color-muted)" }}>
              {journalSync === "failed" ? (
                <>
                  saved on this device — couldn't sync
                  <button onClick={() => outboxRef.current?.retryNow()}
                    style={{ fontSize: 9, padding: "1px 7px", borderRadius: 10, cursor: "pointer",
                             border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--text-2)" }}>
                    Retry
                  </button>
                </>
              ) : journalSync === "syncing" || journalSync === "pending" ? "saving…"
                : journalTypedRef.current ? "saved ✓"
                : "lands in The Log, stamped with today's sky"}
            </span>
          </div>
          <textarea
            value={journalText}
            onChange={e => saveJournal(e.target.value)}
            placeholder="A line about today — what you did, how the water was…"
            rows={2}
            style={{
              width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8,
              border: "1px solid var(--color-border)", background: "var(--color-card-2)",
              fontSize: 12, lineHeight: 1.5, color: "var(--color-foreground)",
              outline: "none", resize: "vertical", fontFamily: "inherit",
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * What you get done, by the kind of day it was.
 *
 * This replaced the felt rating (aligned / mixed / off), which was removed for
 * two reasons that both survived checking:
 *
 *   · It was write-only. Traced 2026-07-31: the rating had ZERO references in
 *     electionEngine, election, synthesis, dayarc, interpretation or plan. It
 *     changed no recommendation anywhere. Thirty seconds a day for a sentence.
 *   · It was confounded by its own advice. The app says "a Deep day — rest",
 *     you rest, and it asks whether that felt right. Agreement is compliance,
 *     not evidence.
 *
 * Completions cost the reader nothing and nobody was told to produce them.
 *
 * The epistemic rules are inherited wholesale, because they were the good part:
 * silent below a floor, always the counts and the window, always the
 * comparison, and never a causal claim — what HAPPENED on those days, not what
 * those days do to you.
 */
function DonePattern({ today, testerId }: { today: string; testerId: string | null }) {
  const { data } = useQuery<{
    enough: boolean; daysObserved: number; activeDays: number; itemsCompleted: number;
    range: { from: string; to: string };
    characters: { character: string; days: number; activeDays: number; items: number; perDay: number; otherDays: number; otherPerDay: number | null }[];
    voidOfCourse: { days: number; perDay: number; otherDays: number; otherPerDay: number | null } | null;
  }>({
    queryKey: ["done-pattern", testerId, today],
    queryFn: async () => {
      const r = await fetch(`/api/check-ins/done-pattern?days=60&today=${today}&tz=${new Date().getTimezoneOffset()}`,
        { headers: { "x-tester-id": testerId ?? "" } });
      if (!r.ok) throw new Error("pattern unavailable");
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 10 * 60_000,
  });

  if (!data) return null;
  const top = data.enough ? data.characters[0] : null;
  const voc = data.enough ? data.voidOfCourse : null;
  const rate = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

  // Nothing to say yet, and nothing to nag about — this accrues on its own from
  // work the reader was doing anyway, so there is no call to action here.
  if (!top) {
    if (data.itemsCompleted === 0) return null;
    return (
      <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "11px 14px" }}>
        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--color-muted)", marginBottom: 5 }}>Your pattern</div>
        <div style={{ fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.55 }}>
          {data.itemsCompleted} finished across {data.activeDays} of the last {data.daysObserved} days. Not enough yet to say which kinds of day suit you — it builds as you go, with nothing extra to log.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--color-muted)", marginBottom: 6 }}>
        What you've finished
      </div>
      <div style={{ fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.55 }}>
        You close <b style={{ color: "#4a8060" }}>{rate(top.perDay)} a day</b> on{" "}
        {top.character.charAt(0).toUpperCase() + top.character.slice(1)} days ({top.days} of them)
        {top.otherPerDay != null && <> — against {rate(top.otherPerDay)} on the other {top.otherDays}</>}.
      </div>
      {voc && voc.otherPerDay != null && (
        <div style={{ fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.55, marginTop: 5 }}>
          On void-of-course days: <b>{rate(voc.perDay)} a day</b> across {voc.days} — against {rate(voc.otherPerDay)} on the other {voc.otherDays}.
        </div>
      )}
      <div style={{ fontSize: 9.5, color: "var(--text-3)", marginTop: 5 }}>
        {data.itemsCompleted} items · {data.range.from} to {data.range.to}. What happened on those days, not what they do to you.
      </div>
    </div>
  );
}
