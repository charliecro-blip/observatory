/**
 * RhythmLead — the top of Home, shaped by how the person asked to be met.
 *
 * The four-preset experiment from DESIGN-WORKING-RHYTHM-2026-08-21 §7, step
 * 1: same account, same inventory, same sky, and a different FIRST QUESTION.
 * Nothing astrological decides this yet — the choice is the person's own,
 * from onboarding or Settings — and the test is whether the four feel like
 * four different ways of being helped. If they don't, no chart will rescue
 * them.
 *
 *   tide      — nothing extra; the app as built leads with the day
 *   campaign  — ONE MOVE: the thing to push on, the next one behind it
 *   route     — STAY THE COURSE: what you keep, with its tally, to tick
 *   field     — THREE WAYS IN: a few good options, chosen now, none lost
 *
 * The chip row is the experiment's scaffolding — a live switch so the owner
 * can feel the difference without a trip to Settings. It can go once a
 * shape is chosen, or stay as the free manual choice (§6).
 */
import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { jsonArray } from "@/lib/jsonArray";
import { localToday } from "@/lib/dates";
import { RHYTHMS, type Rhythm } from "@/lib/preferences";

/**
 * ELEMENT AS PAYOFF LANGUAGE (design §4): one line under the heading, in
 * the grammar of what makes effort feel good to this person — from the
 * chart's Sun element, when there is a chart. Not a theme; a sentence.
 */
const PAYOFF: Record<string, string> = {
  fire: "By your chart, momentum is what rewards you.",
  earth: "By your chart, seeing it add up is what rewards you.",
  air: "By your chart, variety is what rewards you.",
  water: "By your chart, the pull being there is what rewards you.",
};

interface TaskLite { id: number; title: string; dueDate?: string | null }
interface Habit {
  id: number; name: string; emoji?: string | null;
  doneToday?: boolean; windowDone?: number; windowTarget?: number;
  cadenceMet?: boolean; flavor?: string | null;
}

const KEPT = "#3f7a4a";
const BEHIND = "#a08040";

const CARD: React.CSSProperties = {
  background: "var(--color-card)", border: "1px solid var(--color-border)",
  borderRadius: 12, padding: "12px 16px 14px", flexShrink: 0,
};
const CAP: React.CSSProperties = {
  fontSize: 9.5, fontWeight: 700, letterSpacing: "0.9px", textTransform: "uppercase", color: "var(--text-3)",
};

export default function RhythmLead({
  rhythm, onPickRhythm, testerId, lat, lon,
  overdue, dueToday, undated, later, committedCount,
  onShape, shapeOpen, onFocus, gear, onEndGear, element, tideLevel, stars,
}: {
  /** The tide's level now — low and ebb make a rest the move. */
  tideLevel?: string | null;
  /** Live stars, with the planet each speaks. A Moon, Venus or Saturn star is a keeping. */
  stars?: { id: number; title: string; planet?: string | null }[];
  /** The rhythm in force — the override while it lasts, else the base. */
  rhythm: Rhythm;
  onPickRhythm: (r: Rhythm) => void;
  /** A temporary gear in force, if any. */
  gear?: { rhythm: Rhythm; until: string; base: Rhythm } | null;
  onEndGear?: () => void;
  /** The chart's Sun element, for the payoff line. Absent without a chart. */
  element?: string | null;
  testerId: string | null; lat: number; lon: number;
  overdue: TaskLite[]; dueToday: TaskLite[]; undated: TaskLite[]; later: TaskLite[];
  committedCount: number;
  onShape: () => void; shapeOpen: boolean;
  onFocus: (id: number) => void;
}) {
  const qc = useQueryClient();
  const today = localToday();
  // Same key as "Where you are", so this is a cache read, not a second fetch.
  const { data: habits } = useQuery<Habit[]>({
    queryKey: ["habits", testerId, today, lat, lon],
    queryFn: async () => jsonArray<Habit>(await fetch(`/api/habits?today=${today}&lat=${lat}&lon=${lon}`,
      { headers: testerId ? { "x-tester-id": testerId } : {} })),
    enabled: !!testerId && (rhythm === "route" || rhythm === "field" || rhythm === "campaign"),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, done }: { id: number; done: boolean }) => {
      const headers: Record<string, string> = { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) };
      if (done) await fetch(`/api/habits/${id}/log?date=${today}`, { method: "DELETE", headers });
      else await fetch(`/api/habits/${id}/log`, { method: "POST", headers, body: JSON.stringify({ date: today }) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["north-stars"] });
      qc.invalidateQueries({ queryKey: ["momentum"] });
    },
  });

  const gearLine = gear && (
    <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 6 }}>
      In gear through {new Date(gear.until + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}, then back to {RHYTHMS.find(r => r.key === gear.base)?.label ?? gear.base}.
      {onEndGear && <> <button onClick={onEndGear} style={{ background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer", color: "var(--color-primary)", textDecoration: "underline", textUnderlineOffset: 2 }}>End it now</button></>}
    </div>
  );
  const payoff = element && PAYOFF[element] ? (
    <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: -2, marginBottom: 8 }}>{PAYOFF[element]}</div>
  ) : null;

  const switcher = (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ fontSize: 10, color: "var(--text-3)" }}>how you want to be met:</span>
      {RHYTHMS.map(r => (
        <button key={r.key} title={r.blurb} onClick={() => onPickRhythm(r.key)} style={{
          fontSize: 10.5, padding: "3px 9px", borderRadius: 11, cursor: "pointer",
          border: `1px solid ${rhythm === r.key ? "var(--color-primary)" : "var(--color-border)"}`,
          background: rhythm === r.key ? "var(--color-primary)" : "var(--color-background)",
          color: rhythm === r.key ? "#fff" : "var(--color-muted)",
        }}>{r.label}</button>
      ))}
    </div>
  );

  if (rhythm === "tide") {
    return <div style={{ padding: "0 2px" }}>{switcher}{gearLine}</div>;
  }

  // The order a push wants: what's late, what's due, then what's waiting.
  const ranked = [...overdue, ...dueToday, ...undated, ...later];

  // A KEEPING — the other thing a day can hold (AUDIT-HOLISM-2026-08-21 §2):
  // a practice not yet kept today, or a star that speaks the Moon, Venus or
  // Saturn. The presets used to hold doings only; a do-nothing day had one
  // move, and it was the overdue task (USER-SIMULATIONS-2026-08-21-REST #2,
  // #3).
  const YIN = new Set(["Moon", "Venus", "Saturn"]);
  const practice = (habits ?? []).find(h => !h.doneToday && h.flavor !== "chore");
  const yinStar = (stars ?? []).find(s => s.planet && YIN.has(s.planet));
  const keeping: { kind: "habit" | "star"; title: string; id: number } | null =
    practice ? { kind: "habit", title: `${practice.emoji ? `${practice.emoji} ` : ""}${practice.name}`, id: practice.id }
    : yinStar ? { kind: "star", title: `★ ${yinStar.title}`, id: yinStar.id } : null;
  const tideOut = tideLevel === "low" || tideLevel === "ebb";

  if (rhythm === "campaign") {
    // The tide is out and there is something to keep: that is the move.
    if (tideOut && keeping) {
      return (
        <div style={{ ...CARD, borderLeft: "3px solid var(--color-primary)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={CAP}>One move</span>
            <span style={{ marginLeft: "auto" }}>{switcher}</span>
          </div>
          {payoff}
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--color-foreground)", lineHeight: 1.3, marginBottom: 4 }}>{keeping.title}</div>
          <div style={{ fontSize: 11.5, color: "var(--color-muted)" }}>The tide is out, so the move is a keeping{ranked[0] ? `; ${ranked[0].title} waits for the turn` : ""}.</div>
          {gearLine}
        </div>
      );
    }
    const move = ranked[0];
    const next = ranked[1];
    return (
      <div style={{ ...CARD, borderLeft: "3px solid var(--color-primary)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
          <span style={CAP}>One move</span>
          <span style={{ marginLeft: "auto" }}>{switcher}</span>
        </div>
        {payoff}
        {move ? (
          <>
            <button onClick={() => onFocus(move.id)} style={{
              display: "block", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer",
              fontSize: 17, fontWeight: 600, color: "var(--color-foreground)", lineHeight: 1.3, marginBottom: 4,
            }}>{move.title}</button>
            <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginBottom: 10 }}>
              {overdue.includes(move) ? "Past its date, so it comes first." : dueToday.includes(move) ? "Due today." : "Top of what you're holding."}
              {next && <> After it: {next.title}.</>}
            </div>
            <button onClick={onShape} style={{
              fontSize: 12, fontWeight: 600, padding: "7px 16px", borderRadius: 8, cursor: "pointer",
              border: "none", background: "var(--color-primary)", color: "#fff",
            }}>{shapeOpen ? "Hide the hours" : "Find it an hour →"}</button>
          </>
        ) : (
          <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>Nothing on the list. Add the one thing that matters and it leads here.</div>
        )}
        {gearLine}
      </div>
    );
  }

  if (rhythm === "route") {
    const live = habits ?? [];
    const rank = (h: Habit) => (h.cadenceMet === false ? 0 : 2) + (h.doneToday ? 1 : 0);
    const rows = [...live].sort((a, b) => rank(a) - rank(b)).slice(0, 6);
    const tally = (h: Habit) => {
      const target = h.windowTarget ?? 0, done = h.windowDone ?? 0;
      if (h.flavor === "chore") return h.doneToday ? "done today" : done > 0 ? `done ${done}×` : "";
      if (target > 0) return `${done} of ${target} this week`;
      return done > 0 ? `${done} this week` : "not yet this week";
    };
    return (
      <div style={{ ...CARD, borderLeft: `3px solid ${KEPT}` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
          <span style={CAP}>Stay the course</span>
          {committedCount > 0 && <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>{committedCount} block{committedCount === 1 ? "" : "s"} held this week</span>}
          <span style={{ marginLeft: "auto" }}>{switcher}</span>
        </div>
        {payoff}
        {rows.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>No routines yet. Add one in Stars and it leads here, with its count.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {rows.map(h => (
              <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <button onClick={() => toggle.mutate({ id: h.id, done: !!h.doneToday })} disabled={toggle.isPending}
                  aria-pressed={!!h.doneToday} aria-label={`${h.doneToday ? "Unmark" : "Mark"} ${h.name} for today`}
                  style={{
                    width: 15, height: 15, borderRadius: h.flavor === "chore" ? 4 : "50%", flexShrink: 0, padding: 0, cursor: "pointer",
                    border: h.doneToday ? "none" : "1.5px solid var(--color-border)",
                    background: h.doneToday ? KEPT : "transparent", color: "#fff", fontSize: 9, lineHeight: 1,
                  }}>{h.doneToday ? "✓" : ""}</button>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  color: h.doneToday ? "var(--text-3)" : "var(--color-foreground)", textDecoration: h.doneToday ? "line-through" : "none" }}>
                  {h.emoji ? `${h.emoji} ` : ""}{h.name}
                </span>
                <span style={{ fontSize: 10.5, flexShrink: 0, fontVariantNumeric: "tabular-nums",
                  color: h.cadenceMet === false ? BEHIND : (h.windowDone ?? 0) > 0 ? KEPT : "var(--text-3)" }}>{tally(h)}</span>
              </div>
            ))}
          </div>
        )}
        {gearLine}
      </div>
    );
  }

  // field
  const picks: TaskLite[] = [];
  for (const t of [overdue[0], dueToday[0], undated[0], undated[1], later[0]]) {
    if (t && !picks.includes(t)) picks.push(t);
    if (picks.length === (keeping ? 2 : 3)) break;
  }
  return (
    <div style={{ ...CARD, borderLeft: "3px solid #6f6a90" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={CAP}>{(() => { const n = picks.length + (keeping ? 1 : 0); return n === 1 ? "One way in" : `${["", "One", "Two", "Three"][n] ?? n} ways in`; })()}</span>
        <span style={{ marginLeft: "auto" }}>{switcher}</span>
      </div>
      {payoff}
      {picks.length === 0 && !keeping ? (
        <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>Nothing on the list yet. Whatever you add shows up here as a choice.</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${picks.length + (keeping ? 1 : 0)}, minmax(0, 1fr))`, gap: 8, marginBottom: 8 }}>
            {keeping && (
              <div style={{ textAlign: "left", padding: "9px 11px", borderRadius: 9, border: "1px dashed var(--color-border)", background: "var(--color-card-2)" }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-foreground)", lineHeight: 1.3 }}>{keeping.title}</div>
                <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 3 }}>a keeping</div>
              </div>
            )}
            {picks.map(t => (
              <button key={t.id} onClick={() => onFocus(t.id)} style={{
                textAlign: "left", padding: "9px 11px", borderRadius: 9, cursor: "pointer",
                border: "1px solid var(--color-border)", background: "var(--color-card-2)",
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-foreground)", lineHeight: 1.3 }}>{t.title}</div>
                <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 3 }}>
                  {overdue.includes(t) ? "past its date" : dueToday.includes(t) ? "due today" : later.includes(t) ? "later" : "no date"}
                </div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-muted)" }}>Pick one now and the others stay open.</div>
        </>
      )}
      {gearLine}
    </div>
  );
}
