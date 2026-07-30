import React, { useState, useEffect } from "react";
import { localToday, addDaysLocal } from "@/lib/dates";
import { aiErrorMessage } from "@/lib/aiError";
import { invalidateWindows } from "@/lib/invalidateWindows";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTester } from "@/contexts/tester-context";
import { PLANET_GLYPH } from "@/lib/glyphs";
import { ELEMENT_COLORS } from "@/lib/elements";

// The Planner — dump everything you need to do, and it weaves each task into the
// calendar at the time the sky best supports it (GTD + astrology). Two steps:
// parse the dump into editable cards (fix the estimate / energy / deadline the
// AI guessed), then weave those into open windows for review before anything is
// written. Honors your waking hours and works around your Google Calendar.

const ELEMENT_COLOR: Record<string, string> = { fire: "#c04830", earth: ELEMENT_COLORS.earth, air: ELEMENT_COLORS.air, water: ELEMENT_COLORS.water };
const ENERGIES = ["low", "medium", "high"] as const;

interface Card {
  title: string; estimatedMinutes: number; energy: string; dueDate: string | null;
  element: string; windowType: string; planets: string[]; rationale: string;
}
interface PlannedItem extends Card { date: string; startAt: string; endAt: string; planetaryHour: string; matchedLane: boolean; tier?: string; tierNote?: string; }
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

export default function Planner({ testerId, lat, lon, seedList, onSeedConsumed }: { testerId: string | null; lat: number; lon: number; seedList?: string | null; onSeedConsumed?: () => void }) {
  const qc = useQueryClient();
  const { profile } = useTester();
  const [horizon, setHorizon] = useState("week");
  const [rawList, setRawList] = useState("");
  const [cards, setCards] = useState<Card[] | null>(null);   // editable, after parse
  const [result, setResult] = useState<WeaveResult | null>(null);
  const [dropped, setDropped] = useState<Set<number>>(new Set());
  const [committed, setCommitted] = useState(false);

  const chrono: any = profile?.chronotype ?? {};
  const authHeaders = { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) };
  const reset = () => { setCards(null); setResult(null); setDropped(new Set()); setCommitted(false); };

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
    onSuccess: (t) => { setCards(t); setResult(null); setCommitted(false); },
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

  // Best-effort: hand the weaver your Google Calendar events as busy time so it
  // schedules around real commitments. Silently skipped if GCal isn't connected.
  async function gcalBusy(): Promise<{ startAt: string; endAt: string }[]> {
    try {
      const days = horizon === "day" ? 1 : horizon === "month" ? 28 : 7;
      const start = new Date().toISOString();
      const end = new Date(Date.now() + days * 86400000).toISOString();
      const r = await fetch(`/api/integrations/google-cal/events?start=${start}&end=${end}`, { headers: authHeaders });
      if (!r.ok) return [];
      const data = await r.json();
      return (data.events ?? []).filter((e: any) => !e.allDay && e.start && e.end).map((e: any) => ({ startAt: e.start, endAt: e.end }));
    } catch { return []; }
  }

  const weave = useMutation({
    mutationFn: async (): Promise<WeaveResult> => {
      const busy = await gcalBusy();
      const r = await fetch("/api/plan/weave", {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({
          tasks: cards, horizon, lat, lon, tz: new Date().getTimezoneOffset(),
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
    },
  });

  const editCard = (i: number, patch: Partial<Card>) => setCards((cs) => cs!.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const removeCard = (i: number) => setCards((cs) => cs!.filter((_, j) => j !== i));

  const keptCount = (result?.planned.length ?? 0) - dropped.size;
  const byDay: Record<string, { item: PlannedItem; idx: number }[]> = {};
  (result?.planned ?? []).forEach((item, idx) => {
    if (dropped.has(idx)) return;
    (byDay[dayKey(item.startAt)] ??= []).push({ item, idx });
  });

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
                <div style={{ display: "flex", gap: 4, marginBottom: 7 }}>
                  {(["fire", "earth", "air", "water"] as const).map((el) => {
                    const ec = ELEMENT_COLOR[el];
                    const active = c.element === el;
                    return (
                      <button key={el} onClick={() => editCard(i, { element: el })} style={{
                        fontSize: 10, padding: "3px 10px", borderRadius: 10, cursor: "pointer",
                        border: active ? `1.5px solid ${ec}` : "1px solid var(--color-border)",
                        background: active ? `${ec}14` : "var(--color-card-2)",
                        color: active ? ec : "var(--text-3)", fontWeight: active ? 600 : 400,
                      }}>● {el}</button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <label style={{ fontSize: 11, color: "var(--color-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                    <input type="number" min={15} max={240} step={15} value={c.estimatedMinutes}
                      onChange={(e) => editCard(i, { estimatedMinutes: Math.max(15, Math.min(240, parseInt(e.target.value) || 45)) })}
                      style={{ width: 52, padding: "3px 5px", borderRadius: 6, border: "1px solid var(--color-border)", fontSize: 11, background: "var(--color-card-2)", color: "var(--color-foreground)" }} /> min
                  </label>
                  <div style={{ display: "flex", gap: 3 }}>
                    {ENERGIES.map((en) => (
                      <button key={en} onClick={() => editCard(i, { energy: en })} style={{
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
                      <button onClick={() => editCard(i, { dueDate: null })} style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 11, padding: 0 }}>✕</button>
                    </label>
                  ) : (
                    <button onClick={() => editCard(i, { dueDate: addDaysLocal(localToday(), 3) })}
                      style={{ fontSize: 10.5, color: "var(--color-muted)", background: "none", border: "1px dashed var(--color-border)", borderRadius: 6, padding: "3px 9px", cursor: "pointer" }}>
                      + due date
                    </button>
                  )}
                </div>
              </div>
            );
          })}
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
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)", marginBottom: 10 }}>Proposed schedule · {keptCount} task{keptCount === 1 ? "" : "s"}</div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 10 }}>Nothing scheduled.</div>
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

          {Object.entries(byDay).map(([day, entries]) => (
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
                    </div>
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
