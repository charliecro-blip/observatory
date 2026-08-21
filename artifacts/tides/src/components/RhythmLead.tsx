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
  onShape, shapeOpen, onFocus,
}: {
  rhythm: Rhythm;
  onPickRhythm: (r: Rhythm) => void;
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
    enabled: !!testerId && rhythm === "route",
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

  const switcher = (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ fontSize: 10, color: "var(--text-3)" }}>how Compass meets you:</span>
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
    return <div style={{ padding: "0 2px" }}>{switcher}</div>;
  }

  // The order a push wants: what's late, what's due, then what's waiting.
  const ranked = [...overdue, ...dueToday, ...undated, ...later];

  if (rhythm === "campaign") {
    const move = ranked[0];
    const next = ranked[1];
    return (
      <div style={{ ...CARD, borderLeft: "3px solid var(--color-primary)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
          <span style={CAP}>One move</span>
          <span style={{ marginLeft: "auto" }}>{switcher}</span>
        </div>
        {move ? (
          <>
            <button onClick={() => onFocus(move.id)} style={{
              display: "block", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer",
              fontSize: 17, fontWeight: 600, color: "var(--color-foreground)", lineHeight: 1.3, marginBottom: 4,
            }}>{move.title}</button>
            <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginBottom: 10 }}>
              {overdue.includes(move) ? "Late, so it goes first." : dueToday.includes(move) ? "Due today." : "Top of what you're holding."}
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
      </div>
    );
  }

  // field
  const picks: TaskLite[] = [];
  for (const t of [overdue[0], dueToday[0], undated[0], undated[1], later[0]]) {
    if (t && !picks.includes(t)) picks.push(t);
    if (picks.length === 3) break;
  }
  return (
    <div style={{ ...CARD, borderLeft: "3px solid #6f6a90" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={CAP}>{picks.length === 1 ? "One way in" : `${["", "One", "Two", "Three"][picks.length]} ways in`}</span>
        <span style={{ marginLeft: "auto" }}>{switcher}</span>
      </div>
      {picks.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--text-3)" }}>Nothing on the list yet. Whatever you add shows up here as a choice.</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${picks.length}, minmax(0, 1fr))`, gap: 8, marginBottom: 8 }}>
            {picks.map(t => (
              <button key={t.id} onClick={() => onFocus(t.id)} style={{
                textAlign: "left", padding: "9px 11px", borderRadius: 9, cursor: "pointer",
                border: "1px solid var(--color-border)", background: "var(--color-card-2)",
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-foreground)", lineHeight: 1.3 }}>{t.title}</div>
                <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 3 }}>
                  {overdue.includes(t) ? "past due" : dueToday.includes(t) ? "due today" : later.includes(t) ? "later" : "no date"}
                </div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-muted)" }}>Pick one now and the others stay open.</div>
        </>
      )}
    </div>
  );
}
