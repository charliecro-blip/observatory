/**
 * SPRINTS — short pushes with hard edges, on Home (owner 2026-08-18).
 *
 * A sprint is 3–14 days of one focused thing — transit-born ("while Mars
 * runs with Jupiter") or self-chosen (a dopamine fast, a meditation
 * challenge). Taps write the wins ledger (wins.sprintId), so every "did it"
 * lands in the Wake; the tally here is a count, never a gauge.
 *
 * THE SUGGESTION DISCIPLINE. The sky always has spans; people must not be
 * nagged with them. One suggestion at most, and only when: no sprint is
 * running, the lens is not astro-quiet, the span wasn't dismissed, and no
 * dismissal happened in the last four days. Dismissing is remembered
 * per-span. Personal spans (a planet steering one of your stars) outrank
 * global ones — the inventory-grounded case, not the horoscope-generator
 * one.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetchJson";
import { localToday, addDaysLocal } from "@/lib/dates";
import { useAstroDetail } from "@/contexts/preferences-context";
import SprintCard, { type SprintCardSubject } from "@/components/SprintCard";

interface Sprint {
  id: number; title: string; startDate: string; endDate: string;
  source: string; transitKey?: string | null; transitLabel?: string | null;
  goalId?: number | null; habitId?: number | null; targetCount?: number | null; status: string;
  tally: number; tallyDates: string[];
}
interface Span {
  key: string; transitPlanet: string; aspect: string; nature: string; targetPlanet: string;
  startDate: string; peakDate: string; endDate: string; days: number;
  active: boolean; clipped: boolean; theme: string;
  personal: { id: number; title: string } | null;
  habitMatch: { id: number; name: string; planet: string } | null;
}
interface GoalLite { id: number; title: string }
interface HabitLite { id: number; name: string; status?: string }

const ASPECT_VERB: Record<string, string> = {
  conjunction: "meets", sextile: "runs with", trine: "runs with",
  square: "grinds against", opposition: "faces",
};

const TEMPLATES = ["Dopamine fast", "Meditation", "Morning pages", "No sugar", "Cold showers", "Inbox zero"];
const DURATIONS = [3, 5, 7, 10, 14];

const fmtShort = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const weekday = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });

/** Dismissals, per tester: span keys waved off, plus a cooldown after any
 *  dismissal so the next span doesn't step straight into the vacancy. */
function dismissStore(testerId: string | null) {
  const key = `compass-sprint-dismissed-${testerId ?? "anon"}`;
  const read = (): { keys: Record<string, string>; cooldownUntil?: string } => {
    try { return JSON.parse(localStorage.getItem(key) ?? "{}"); } catch { return { keys: {} }; }
  };
  return {
    isDismissed: (spanKey: string) => !!read().keys?.[spanKey],
    inCooldown: (today: string) => (read().cooldownUntil ?? "") >= today,
    dismiss: (spanKey: string, today: string) => {
      const s = read();
      s.keys = { ...(s.keys ?? {}), [spanKey]: today };
      s.cooldownUntil = addDaysLocal(today, 4);
      try { localStorage.setItem(key, JSON.stringify(s)); } catch { /* private mode */ }
    },
  };
}

export default function Sprints({ testerId }: { testerId: string | null }) {
  const qc = useQueryClient();
  const today = localToday();
  const { level } = useAstroDetail();
  const skyQuiet = level === "minimal";
  const headers = { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) };
  const store = dismissStore(testerId);
  const [dismissedNow, setDismissedNow] = useState(0); // re-render after a dismissal

  const { data: sprintRows = [] } = useQuery<Sprint[]>({
    queryKey: ["sprints", testerId],
    queryFn: () => fetchJson<Sprint[]>("/api/sprints", { headers }),
    enabled: !!testerId,
  });
  const active = sprintRows.filter(s => s.status === "active");

  // The weather is fetched only when it could be offered: no running sprint,
  // and a lens that shows the sky at all.
  const { data: spanData } = useQuery<{ spans: Span[] }>({
    queryKey: ["transit-spans", testerId, today],
    queryFn: () => fetchJson<{ spans: Span[] }>(`/api/transits/spans?tz=${new Date().getTimezoneOffset()}`, { headers }),
    enabled: !!testerId && !skyQuiet && active.length === 0,
    staleTime: 1000 * 60 * 60 * 6,
  });

  void dismissedNow;
  const suggestion = (() => {
    if (skyQuiet || active.length > 0 || !spanData?.spans?.length) return null;
    if (store.inCooldown(today)) return null;
    const eligible = spanData.spans.filter(s => !store.isDismissed(s.key));
    // Inventory-grounded first: a star's planet, then a habit's favored
    // planet, then whatever is simply active in the sky.
    return eligible.find(s => s.personal)
      ?? eligible.find(s => s.habitMatch)
      ?? eligible.find(s => s.active)
      ?? eligible[0] ?? null;
  })();

  // ── The start sheet ───────────────────────────────────────────────────────
  const [sheet, setSheet] = useState<null | { span?: Span }>(null);
  const [title, setTitle] = useState("");
  const [days, setDays] = useState<number | "transit">(7);
  const [target, setTarget] = useState("");
  const [starId, setStarId] = useState<number | "">("");
  // Sprinting an EXISTING habit: the tap will keep the habit itself, and the
  // tally reads the habit's own log. Choosing one takes over the title.
  const [habitId, setHabitId] = useState<number | "">("");

  const { data: goalsList = [] } = useQuery<GoalLite[]>({
    queryKey: ["planning-goals-active", testerId],
    queryFn: () => fetchJson<GoalLite[]>("/api/planning/goals?status=active", { headers }),
    enabled: !!testerId && sheet != null,
  });
  const { data: habitsList = [] } = useQuery<HabitLite[]>({
    // Same key and shape as LogDone's list — one cache entry, not a second
    // request for the same answer.
    queryKey: ["logdone-habits", testerId],
    queryFn: async () => {
      const r = await fetch("/api/habits", { headers });
      const j = await r.json();
      return Array.isArray(j) ? j.filter((h: HabitLite) => h.status === "active") : [];
    },
    enabled: !!testerId && sheet != null,
  });

  const startSprint = useMutation({
    mutationFn: () => {
      const span = sheet?.span;
      const endDate = days === "transit" && span
        ? (span.endDate >= today ? span.endDate : today)
        : addDaysLocal(today, (days === "transit" ? 7 : days) - 1);
      return fetchJson("/api/sprints", {
        method: "POST", headers,
        body: JSON.stringify({
          title: title.trim(),
          endDate,
          source: span ? "transit" : "chosen",
          transitKey: span?.key,
          transitLabel: span ? `${span.transitPlanet} ${span.aspect} ${span.targetPlanet}` : undefined,
          // A habit sprint attributes through the habit's own star links, so
          // the two never claim the same act twice.
          goalId: habitId ? undefined : (starId || undefined),
          habitId: habitId || undefined,
          targetCount: parseInt(target, 10) > 0 ? parseInt(target, 10) : undefined,
          tz: new Date().getTimezoneOffset(),
        }),
      });
    },
    onSuccess: () => {
      setSheet(null); setTitle(""); setDays(7); setTarget(""); setStarId(""); setHabitId("");
      qc.invalidateQueries({ queryKey: ["sprints"] });
    },
  });

  const logIt = useMutation({
    // A habit sprint's tap keeps the HABIT — one act, one record, in the log
    // that already owns kept days; the sprint tally derives from it. A free
    // sprint's tap is a named win carrying sprintId.
    mutationFn: (s: Sprint) => s.habitId
      ? fetchJson(`/api/habits/${s.habitId}/log`, {
          method: "POST", headers, body: JSON.stringify({ date: today }),
        })
      : fetchJson("/api/planning/wins", {
          method: "POST", headers,
          body: JSON.stringify({
            text: `sprint: ${s.title}`, sprintId: s.id, goalId: s.goalId ?? undefined,
            tz: new Date().getTimezoneOffset(),
          }),
        }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sprints"] });
      qc.invalidateQueries({ queryKey: ["momentum"] });
      qc.invalidateQueries({ queryKey: ["habits"] });
    },
  });

  // Finishing offers a card; setting one down never does. A person who quit
  // on purpose does not want a commemorative object, and offering one would
  // turn an honest exit into a failure notice.
  const [cardFor, setCardFor] = useState<SprintCardSubject | null>(null);
  const [finishedOffer, setFinishedOffer] = useState<Sprint | null>(null);
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetchJson(`/api/sprints/${id}`, { method: "PATCH", headers, body: JSON.stringify({ status }) }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["sprints"] });
      // Only when something actually happened. A sprint finished with zero
      // kept days has nothing to tell, and offering a "0 DAYS KEPT" card
      // would be the shaming move this product exists to refuse.
      if (v.status === "done") {
        const s = sprintRows.find(x => x.id === v.id);
        setFinishedOffer(s && s.tally > 0 ? s : null);
      }
    },
  });

  const openSheet = (span?: Span) => {
    setSheet({ span });
    setDays(span ? "transit" : 7);
    // Riding a span that met your inventory prefills the thing it met: the
    // habit it matched, or the star whose planet it touched.
    if (span?.habitMatch && !span.personal) {
      setHabitId(span.habitMatch.id);
      setTitle(span.habitMatch.name);
    } else {
      setHabitId("");
      setTitle("");
    }
    setStarId(span?.personal?.id ?? "");
  };

  // Nothing running, nothing offered, sheet closed: one quiet door, plain at
  // every lens — the self-chosen sprint must not depend on the sky showing.
  // A just-finished sprint holds the card open past its own disappearance.
  if (active.length === 0 && !suggestion && !sheet && !finishedOffer && !cardFor) {
    return (
      <button onClick={() => openSheet()} style={{
        fontSize: 11, background: "none", border: "none", cursor: "pointer",
        color: "var(--text-3)", padding: "2px 0", textAlign: "left",
      }}>Start a sprint — a short push with an end date →</button>
    );
  }

  const spanLine = (s: Span) => {
    const verb = ASPECT_VERB[s.aspect] ?? "meets";
    const when = s.active ? `through ${weekday(s.endDate)}` : `${fmtShort(s.startDate)}–${fmtShort(s.endDate)}`;
    const who = s.personal
      ? `${s.transitPlanet} — steering "${s.personal.title}" — ${verb} ${s.targetPlanet}`
      : `${s.transitPlanet} ${verb} ${s.targetPlanet}`;
    // A habit the sky just met beats the generic theme as the tail: it names
    // the thing they already do that this spell leans into.
    const tail = !s.personal && s.habitMatch
      ? `"${s.habitMatch.name}" already leans on ${s.habitMatch.planet}`
      : s.theme;
    return `${who} ${when} — ${tail}.`;
  };

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, flexShrink: 0 }}>
      <div style={{ padding: "11px 16px 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.9px", textTransform: "uppercase", color: "var(--text-3)" }}>
          Sprints
        </div>
        {active.length > 0 && !sheet && (
          <button onClick={() => openSheet()} style={{
            marginLeft: "auto", fontSize: 11, background: "none", border: "none",
            padding: 0, cursor: "pointer", color: "var(--color-primary)",
          }}>+ another</button>
        )}
      </div>

      <div style={{ padding: "0 16px 12px" }}>
        {/* The finished moment — the one natural "tell someone" beat. Offered
            once, declined by dismissing, never posted by the app. */}
        {finishedOffer && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, color: "var(--color-foreground)", flex: 1, minWidth: 140 }}>
              "{finishedOffer.title}" — finished, {finishedOffer.tally} {finishedOffer.tally === 1 ? "day" : "days"} kept.
            </span>
            <button onClick={() => {
              setCardFor({
                title: finishedOffer.title, startDate: finishedOffer.startDate, endDate: finishedOffer.endDate,
                tally: finishedOffer.tally, transitLabel: finishedOffer.transitLabel,
              });
              setFinishedOffer(null);
            }} style={{
              fontSize: 10.5, padding: "3px 11px", borderRadius: 8, cursor: "pointer", flexShrink: 0,
              border: "1px solid #c8a04a", background: "#c8a04a14", color: "#8a6a20", fontWeight: 600,
            }}>Make a card</button>
            <button onClick={() => setFinishedOffer(null)} style={{
              fontSize: 10.5, background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-3)",
            }}>no thanks</button>
          </div>
        )}

        {/* Active sprints */}
        {active.map(s => {
          const dayN = Math.max(1, Math.round((Date.parse(today) - Date.parse(s.startDate)) / 86400000) + 1);
          const total = Math.round((Date.parse(s.endDate) - Date.parse(s.startDate)) / 86400000) + 1;
          const over = s.endDate < today;
          return (
            <div key={s.id} style={{ padding: "5px 0", borderTop: active[0] === s ? "none" : "1px solid var(--color-border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--color-foreground)" }}>
                  {s.title}
                </span>
                {!over && (
                  <button onClick={() => logIt.mutate(s)} disabled={logIt.isPending} style={{
                    fontSize: 10.5, padding: "3px 12px", borderRadius: 8, cursor: "pointer", flexShrink: 0,
                    border: "1px solid #4a7a52", background: "#4a7a5212", color: "#4a7a52", fontWeight: 600,
                  }}>{logIt.isPending ? "…" : "did it"}</button>
                )}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span>{over ? `window closed ${weekday(s.endDate)}` : `day ${Math.min(dayN, total)} of ${total}`}</span>
                {s.tally > 0 && <span style={{ color: "#4a7a52" }}>{s.habitId ? "kept" : "logged"} {s.tally}×{s.targetCount ? ` of ${s.targetCount}` : ""}</span>}
                {!skyQuiet && s.transitLabel && <span style={{ color: "#a08850" }}>{s.transitLabel}</span>}
                <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button onClick={() => setStatus.mutate({ id: s.id, status: "done" })} style={{ fontSize: 9.5, background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-3)" }}>finish</button>
                  <button onClick={() => setStatus.mutate({ id: s.id, status: "ended" })} style={{ fontSize: 9.5, background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-3)" }}>set down</button>
                </span>
              </div>
            </div>
          );
        })}

        {/* The one suggestion */}
        {suggestion && !sheet && (
          <div style={{ paddingTop: active.length ? 6 : 0 }}>
            <div style={{ fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.55 }}>{spanLine(suggestion)}</div>
            <div style={{ display: "flex", gap: 12, marginTop: 5 }}>
              <button onClick={() => openSheet(suggestion)} style={{
                fontSize: 11, background: "none", border: "none", padding: 0, cursor: "pointer",
                color: "var(--color-primary)", fontWeight: 600,
              }}>Ride it →</button>
              <button onClick={() => { store.dismiss(suggestion.key, today); setDismissedNow(n => n + 1); }} style={{
                fontSize: 10.5, background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-3)",
              }}>not this one</button>
            </div>
          </div>
        )}

        {/* The start sheet */}
        {sheet && (
          <div style={{ paddingTop: active.length ? 8 : 0 }}>
            {sheet.span && !skyQuiet && (
              <div style={{ fontSize: 10.5, color: "#a08850", marginBottom: 6 }}>{spanLine(sheet.span)}</div>
            )}
            <input
              autoFocus value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && title.trim()) startSprint.mutate(); if (e.key === "Escape") setSheet(null); }}
              placeholder="The push — morning pages, no sugar, ten cold calls…"
              style={{
                width: "100%", padding: "7px 11px", borderRadius: 8, fontSize: 12, outline: "none",
                border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-foreground)",
              }}
            />
            <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 9.5, color: "var(--text-3)" }}>or borrow one:</span>
              {TEMPLATES.map(t => (
                <button key={t} onClick={() => { setTitle(t); setHabitId(""); }} style={{
                  fontSize: 9.5, padding: "2px 8px", borderRadius: 10, cursor: "pointer",
                  border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--text-2)",
                }}>{t}</button>
              ))}
            </div>
            {/* Or turn an existing habit up for the stretch — its taps keep
                the habit itself, so the record stays in one place. */}
            {habitsList.length > 0 && (
              <div style={{ display: "flex", gap: 5, marginTop: 6, alignItems: "center" }}>
                <span style={{ fontSize: 9.5, color: "var(--text-3)" }}>or turn a habit up:</span>
                <select value={habitId}
                  onChange={e => {
                    const id = e.target.value ? Number(e.target.value) : "";
                    setHabitId(id);
                    if (id) {
                      const h = habitsList.find(x => x.id === id);
                      if (h) setTitle(h.name);
                    }
                  }}
                  style={{ fontSize: 10, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: habitId ? "var(--color-foreground)" : "var(--text-3)" }}>
                  <option value="">no habit</option>
                  {habitsList.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 9.5, color: "var(--text-3)" }}>how long:</span>
              {sheet.span && (
                <button onClick={() => setDays("transit")} style={{
                  fontSize: 9.5, padding: "2px 8px", borderRadius: 10, cursor: "pointer",
                  border: days === "transit" ? "1.5px solid #c8a04a" : "1px solid var(--color-border)",
                  background: days === "transit" ? "#c8a04a18" : "var(--color-card-2)",
                  color: days === "transit" ? "#8a6a20" : "var(--text-2)", fontWeight: days === "transit" ? 600 : 400,
                }}>until {fmtShort(sheet.span.endDate)}</button>
              )}
              {DURATIONS.map(d => (
                <button key={d} onClick={() => setDays(d)} style={{
                  fontSize: 9.5, padding: "2px 8px", borderRadius: 10, cursor: "pointer",
                  border: days === d ? "1.5px solid #1a2a3a" : "1px solid var(--color-border)",
                  background: days === d ? "#1a2a3a10" : "var(--color-card-2)",
                  color: days === d ? "var(--color-foreground)" : "var(--text-2)", fontWeight: days === d ? 600 : 400,
                }}>{d}d</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ fontSize: 9.5, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 4 }}>
                aim for
                <input type="number" min={1} max={99} value={target} onChange={e => setTarget(e.target.value)}
                  placeholder="—"
                  style={{ width: 44, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--color-border)", fontSize: 10.5, background: "var(--color-card-2)", color: "var(--color-foreground)" }} />
                times (optional)
              </label>
              {/* A habit sprint attributes through the habit's own stars —
                  offering a second star here would claim one act twice. */}
              {goalsList.length > 0 && !habitId && (
                <select value={starId} onChange={e => setStarId(e.target.value ? Number(e.target.value) : "")}
                  style={{ fontSize: 10, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: starId ? "var(--color-foreground)" : "var(--text-3)" }}>
                  <option value="">no star</option>
                  {goalsList.map(g => <option key={g.id} value={g.id}>★ {g.title}</option>)}
                </select>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 9, alignItems: "center" }}>
              <button onClick={() => startSprint.mutate()} disabled={!title.trim() || startSprint.isPending} style={{
                fontSize: 11.5, fontWeight: 600, padding: "6px 14px", borderRadius: 8, cursor: title.trim() ? "pointer" : "default",
                border: "none", background: title.trim() ? "#1a2a3a" : "var(--color-border)", color: title.trim() ? "#ffffff" : "var(--text-3)",
              }}>{startSprint.isPending ? "Starting…" : "Start the sprint"}</button>
              <button onClick={() => setSheet(null)} style={{ fontSize: 10.5, background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}>never mind</button>
              {startSprint.isError && (
                <span style={{ fontSize: 10, color: "#a03030" }}>
                  {((startSprint.error as any)?.body?.error) ?? "Didn't start — try again."}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {cardFor && <SprintCard sprint={cardFor} onClose={() => setCardFor(null)} />}
    </div>
  );
}
