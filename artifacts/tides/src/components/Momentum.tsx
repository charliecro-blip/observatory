import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { logEvent } from "@/lib/analytics";
import { ELEMENT_COLORS } from "@/lib/elements";

/** The week whose wake this device has already read, or null. */
function readWake(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function markWakeRead(key: string, weekStart: string) {
  try { localStorage.setItem(key, weekStart); } catch { /* private mode */ }
}

/**
 * Momentum — the daily progress loop's shared UI (owner 2026-07-17):
 *   morning : StarRows — one tappable row per Guiding Star (next move + today's
 *             best window) → that star's game plan
 *   evening : EveningHarvest — auto-harvested wins + "name a win" + the helm streak
 *   anytime : WakeList — the continual wins ledger, filterable by star
 * All three read one endpoint (/api/planning/momentum); auto wins are derived
 * server-side from completions, so nothing here double-books.
 */

export interface MomentumStar {
  id: number; title: string; element: string | null;
  stepsDone: number; stepsTotal: number; openTasks: number;
  nextMove: { kind: string; id: number; title: string } | null;
  bestWindowToday: { startClock: string; endClock: string } | null;
  winsWeek: number; winsCycle: number; winsToday: number;
}
export interface MomentumData {
  today: string; streak: number; cycleStart: string; prevCycleStart: string; weekStart: string;
  winsToday: number; winsWeek: number; winsCycle: number; winsPrevCycle: number;
  keptToday?: number; keptWeek?: number;
  intentions: { id: number; text: string; goalId: number | null }[];
  prevIntentions: { id: number; text: string; goalId: number | null }[];
  stars: MomentumStar[];
  ledger: { date: string; goalId: number | null; goalIds?: number[]; text: string; source: string; winId?: number; kind?: "win" | "kept" }[];
}

const EL_COLOR: Record<string, string> = { fire: "#c04830", earth: ELEMENT_COLORS.earth, air: ELEMENT_COLORS.air, water: ELEMENT_COLORS.water };
const elc = (el?: string | null) => EL_COLOR[el ?? ""] ?? "#8a8278";

export function useMomentum(testerId: string | null, lat = 40.7, lon = -74.0, enabled = true) {
  // The response carries `today` and `cycleStart`, both derived from the tz
  // and coordinates in the URL and neither of which was in the key. With a
  // five-minute staleTime and a tab left open, the cycle review could keep
  // deciding whether to show against yesterday's date — which would have
  // quietly undone the cycle-boundary fix (lib/lunarCycle.ts) from the client
  // side. The day is read once here so the key and the URL cannot disagree.
  const tz = new Date().getTimezoneOffset();
  const today = new Date(Date.now() - tz * 60000).toISOString().slice(0, 10);
  return useQuery<MomentumData>({
    queryKey: ["momentum", testerId, today, tz, lat, lon],
    queryFn: async () => {
      const r = await fetch(`/api/planning/momentum?tz=${tz}&lat=${lat}&lon=${lon}`,
        { headers: { "x-tester-id": testerId ?? "" } });
      // A refusal is not a momentum record. Unchecked, a 401's error body
      // became `data`, every consumer's `if (!data) return null` passed it
      // through, and `data.ledger.filter` threw the whole of Home into its
      // error boundary — "Cannot read properties of undefined (reading
      // 'filter')" in EveningHarvest. Thrown here so react-query calls it what
      // it is and the cards stand down instead.
      if (!r.ok) throw new Error(`momentum unavailable (${r.status})`);
      const j = await r.json();
      // And a 200 that is not a momentum record is a server bug, not an empty
      // day — the same rule jsonArray() enforces for lists.
      if (!j || !Array.isArray(j.ledger) || !Array.isArray(j.stars)) {
        throw new Error("momentum came back in a shape this cannot read");
      }
      return j;
    },
    enabled: !!testerId && enabled,
    staleTime: 1000 * 60 * 5,
  });
}

// ── Morning: one row per star — the 10-second glance ─────────────────────────
export function StarRows({ testerId, lat, lon, onOpenStar }: {
  testerId: string | null; lat?: number; lon?: number;
  onOpenStar?: (goalId: number) => void;
}) {
  const { data } = useMomentum(testerId, lat, lon);
  const stars = data?.stars ?? [];
  if (stars.length === 0) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-3)" }}>Your stars today</span>
        {(data?.streak ?? 0) > 0 && (
          <span style={{ fontSize: 9, color: "#8a7a5e" }} title="Days you've closed the loop — one missed day lowers sail without sinking the run">
            ⚓ {data!.streak} day{data!.streak === 1 ? "" : "s"} at the helm
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {stars.map(s => {
          const c = elc(s.element);
          return (
            <button key={s.id} onClick={() => onOpenStar?.(s.id)} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 9,
              border: `1px solid ${c}35`, background: "var(--color-card)", cursor: "pointer", textAlign: "left",
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--color-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  ✦ {s.title}
                </div>
                <div style={{ fontSize: 10, color: "var(--color-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.nextMove ? `next: ${s.nextMove.title}` : s.openTasks > 0 ? `${s.openTasks} open tasks` : "break it into a first step →"}
                </div>
              </div>
              {/* THE ASSIGNED WINDOW IS GONE (owner, 2026-08-19). A row read
                  "Courtship · 7 AM–9 AM" — a time this star's element happens
                  to suit, printed beside an aim the app had never been told
                  anything about, which reads as an instruction rather than an
                  observation. The star and what is next on it stay; when to
                  do it is the person's. `bestWindowToday` is still computed
                  and still served, for the surfaces you ASK. */}
              <span aria-hidden="true" style={{ fontSize: 10, color: "var(--text-3)", flexShrink: 0 }}>→</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Evening: the harvest — what moved, name a win, streak ────────────────────
export function EveningHarvest({ testerId, lat, lon }: { testerId: string | null; lat?: number; lon?: number }) {
  const qc = useQueryClient();
  const { data } = useMomentum(testerId, lat, lon);
  const [text, setText] = useState("");
  const [starId, setStarId] = useState<number | "">("");
  // THE MOON QUESTION (AUDIT-HOLISM §3.7): what restored you. A day that
  // rested had nothing to say to "what moved" (REST #10); it says it here,
  // as a keeping.
  const [kept, setKept] = useState("");
  const nameKept = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/planning/wins", {
        method: "POST", headers: { "Content-Type": "application/json", "x-tester-id": testerId ?? "" },
        body: JSON.stringify({ text: kept.trim(), kind: "kept", tz: new Date().getTimezoneOffset() }),
      });
      if (!r.ok) throw new Error(`kept save failed (${r.status})`);
    },
    onSuccess: () => { logEvent("kept_named"); setKept(""); qc.invalidateQueries({ queryKey: ["momentum"] }); },
  });
  const nameWin = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/planning/wins", {
        method: "POST",
        headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), goalId: starId || undefined, tz: new Date().getTimezoneOffset() }),
      });
      if (!r.ok) throw new Error(`win save failed (${r.status})`);
    },
    onSuccess: () => { logEvent("win_named"); setText(""); qc.invalidateQueries({ queryKey: ["momentum"] }); },
  });
  if (!data) return null;
  const todayWins = data.ledger.filter(l => l.date === data.today);
  const starTitle = (id: number | null) => data.stars.find(s => s.id === id)?.title;

  return (
    <div style={{ marginBottom: 8 }}>
      {todayWins.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-3)", marginBottom: 4 }}>
            Today's wins · {todayWins.length}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {todayWins.map((w, i) => (
              <span key={i} style={{
                fontSize: 10, padding: "3px 9px", borderRadius: 14, fontWeight: 600,
                background: w.source === "named" ? "#8a6a2012" : "#4a806012",
                border: w.source === "named" ? "1px solid #c8b06a55" : "1px solid #4a806030",
                color: w.source === "named" ? "#8a6a20" : "#4a8060",
              }}>
                {w.kind === "kept" ? "☾" : w.source === "named" ? "★" : "✓"} {w.text}{starTitle(w.goalId) ? ` · ${starTitle(w.goalId)}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}
      {/* Name a win — the written line that carries the meaning. Was a
          non-wrapping flex row whose fixed-width members summed past a phone
          screen — the log-it button was unreachable, blocking the daily win
          loop on mobile (audit P0 #7). */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && text.trim() && nameWin.mutate()}
          placeholder="Name a win in your own words…"
          style={{ flex: 1, minWidth: 140, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 11.5, background: "var(--color-card)" }} />
        {data.stars.length > 0 && (
          <select value={starId} onChange={e => setStarId(e.target.value ? Number(e.target.value) : "")}
            style={{ padding: "6px 6px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 10, color: "var(--color-muted)", background: "var(--color-card)", maxWidth: 110 }}>
            <option value="">no star</option>
            {data.stars.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        )}
        <button onClick={() => text.trim() && nameWin.mutate()} disabled={!text.trim() || nameWin.isPending}
          style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: text.trim() ? "#1a2a3a" : "var(--color-border)", color: text.trim() ? "#ffffff" : "var(--text-3)", fontSize: 10.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
          ★ log it
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
        <input value={kept} onChange={e => setKept(e.target.value)}
          onKeyDown={e => e.key === "Enter" && kept.trim() && nameKept.mutate()}
          placeholder="What restored you, or what you let be…"
          style={{ flex: 1, minWidth: 140, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 11.5, background: "var(--color-card)" }} />
        <button onClick={() => kept.trim() && nameKept.mutate()} disabled={!kept.trim() || nameKept.isPending}
          style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: kept.trim() ? "#4a6080" : "var(--color-border)", color: kept.trim() ? "#ffffff" : "var(--text-3)", fontSize: 10.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
          ☾ kept
        </button>
      </div>
      <div style={{ fontSize: 9.5, color: "var(--text-3)", marginTop: 5 }}>
        {data.streak > 0 ? `⚓ ${data.streak} day${data.streak === 1 ? "" : "s"} at the helm · ` : ""}{data.winsWeek} win{data.winsWeek === 1 ? "" : "s"} this week{(data.keptWeek ?? 0) > 0 ? ` · ${data.keptWeek} kept` : ""} · {data.winsCycle} this moon cycle
      </div>
    </div>
  );
}

// ── The Wake: the continual wins ledger ──────────────────────────────────────
export function WakeList({ testerId, lat, lon }: { testerId: string | null; lat?: number; lon?: number }) {
  const { data } = useMomentum(testerId, lat, lon);
  const [filter, setFilter] = useState<number | "all">("all");
  if (!data || data.ledger.length === 0) return null;
  // A multi-starred habit's item answers to EVERY star it serves.
  const items = data.ledger.filter(l => filter === "all" || l.goalId === filter || l.goalIds?.includes(filter as number));
  const starTitle = (id: number | null) => data.stars.find(s => s.id === id)?.title;
  const starEl = (id: number | null) => data.stars.find(s => s.id === id)?.element;
  // Group by date for scannable days
  const byDate: Record<string, typeof items> = {};
  for (const it of items) (byDate[it.date] = byDate[it.date] ?? []).push(it);
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>The wake</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 9.5, color: "#8a7a5e" }}>
            ⚓ {data.streak}d at the helm · {data.winsWeek} this week · {data.winsCycle} this cycle
          </span>
          <button
            onClick={async () => {
              // Header-authenticated fetch, then a blob URL in a new tab. An
              // <a href> put the tester id — the account credential — in the
              // URL, where it outlives the click in history and referrers.
              try {
                const r = await fetch(`/api/studio/cycle.png?tz=${new Date().getTimezoneOffset()}`,
                  { headers: testerId ? { "x-tester-id": testerId } : undefined });
                if (!r.ok) return;
                window.open(URL.createObjectURL(await r.blob()), "_blank");
              } catch { /* retryable */ }
            }}
            style={{ fontSize: 9.5, color: "#8a6a20", background: "none", cursor: "pointer", border: "1px solid #c8b06a55", borderRadius: 8, padding: "2px 8px" }}
            title="Your lunation in wins, as a card"><span aria-hidden="true">↗</span> cycle card</button>
        </div>
      </div>
      <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 8 }}>
        Every win, trailing behind the ship — done things harvested automatically, starred ones named by you.
      </div>
      {data.stars.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
          <button onClick={() => setFilter("all")} style={{
            fontSize: 9.5, padding: "3px 10px", borderRadius: 12, cursor: "pointer",
            border: filter === "all" ? "1px solid #1a2a3a" : "1px solid var(--color-border)",
            background: filter === "all" ? "#1a2a3a" : "transparent", color: filter === "all" ? "#ffffff" : "var(--color-muted)",
          }}>all</button>
          {data.stars.map(s => (
            <button key={s.id} onClick={() => setFilter(s.id)} style={{
              fontSize: 9.5, padding: "3px 10px", borderRadius: 12, cursor: "pointer",
              border: filter === s.id ? `1px solid ${elc(s.element)}` : "1px solid var(--color-border)",
              background: filter === s.id ? `${elc(s.element)}18` : "transparent",
              color: filter === s.id ? elc(s.element) : "var(--color-muted)", fontWeight: filter === s.id ? 600 : 400,
            }}>✦ {s.title}</button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflowY: "auto" }}>
        {dates.map(d => (
          <div key={d}>
            <div style={{ fontSize: 9, color: "var(--color-muted)", marginBottom: 3 }}>
              {new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              {d >= data.cycleStart ? "" : " · last cycle"}
            </div>
            {byDate[d].map((w, i) => (
              <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 7, fontSize: 11, padding: "2px 0" }}>
                <span style={{ color: w.source === "named" ? "#c8a04a" : "#4a8060", flexShrink: 0 }}>
                  {w.source === "named" ? "★" : "✓"}
                </span>
                <span style={{ color: "var(--color-foreground)", flex: 1 }}>{w.text}</span>
                {starTitle(w.goalId) && (
                  <span style={{ fontSize: 9, color: elc(starEl(w.goalId)), flexShrink: 0 }}>✦ {starTitle(w.goalId)}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── The Sunday review — the week in the wake ─────────────────────────────────
// This card carried a second, New-Moon mode until the HOME study (W1). Its two
// jobs both live in the turning-point check-in now: the intention ask was the
// same question the check-in's one shot already answers (the "same question
// from a surface that could not see this answer" bug, fixed once on 2026-08-13
// and structurally this time), and the retrospective — "you set out to X, N
// wins in the wake" — opens the check-in sheet instead, where the loop closes
// in the same sitting that starts the next one. One ritual, one surface.
//
// It renders on HOME's notice queue, not on Today: the study found Home-landers
// never met it, and a weekly retrospective is panoramic by definition.
// ?review=week still forces it for design work.
export function ReviewCard({ testerId, lat, lon, onOpenLog, firstRun = false, summoned = false }: {
  testerId: string | null; lat?: number; lon?: number; onOpenLog?: () => void;
  /** The walkthrough hasn't been answered — this account has no past to review. */
  firstRun?: boolean;
  /** Asked for by hand (the Log's "review now" door, F10) — the Sunday gate
   *  stands aside, and an empty week gets a quiet line rather than silence,
   *  because a door that opens onto nothing reads as broken. */
  summoned?: boolean;
}) {
  const { data } = useMomentum(testerId, lat, lon);
  if (!data) return null;

  const force = new URLSearchParams(window.location.search).get("review");
  const isSunday = new Date().getDay() === 0;
  const showWeek = summoned || force === "week" || isSunday;
  if (!showWeek) return null;
  if (summoned && data.ledger.length === 0 && data.stars.length === 0) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-3)", padding: "10px 2px" }}>
        The wake is empty so far — nothing to review yet.
      </div>
    );
  }
  // A retrospective needs something to look back ON. This was gated purely on
  // the DATE, so an account created on a Sunday met "⚓ The week in the wake —
  // 0 wins this week · 0 days at the helm" as one of its first impressions:
  // the app reporting a failure the user hadn't had time to earn. Suppress
  // while the walkthrough is unanswered, and whenever the period being
  // reviewed is genuinely empty of both wins and stars. `?review=` still
  // forces either card for design work.
  const nothingToReview = data.ledger.length === 0 && data.stars.length === 0;

  // A review you have read is not a review you are owed. The card had no read
  // state at all — "Read the whole wake" navigated and the card was still
  // there on the way back, which turns a weekly retrospective into a banner
  // that outlasts its own purpose (owner 2026-08-23).
  //
  // Keyed to the WEEK, not to a boolean: read this Sunday's and next
  // Sunday's still arrives. Client-side because it is a display preference —
  // a device that has not seen it should still be shown it.
  const readKey = `compass-wake-read-${testerId}`;
  const alreadyRead = readWake(readKey) === data.weekStart;
  if (!force && !summoned && (firstRun || nothingToReview || alreadyRead)) return null;

  const named = (from: string, to?: string) => data.ledger
    .filter(l => l.source === "named" && l.date >= from && (!to || l.date < to))
    .slice(0, 3);
  const starTitle = (id: number | null) => data.stars.find(s => s.id === id)?.title;

  const topNamed = named(data.weekStart);
  return (
      <div style={{ background: "linear-gradient(135deg, #8a6a2010, #8a6a2004)", border: "1px solid #c8b06a45", borderRadius: 14, padding: "13px 16px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-primary)" }}>⚓ The week in the wake</span>
          <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: "#8a6a20" }}>
            {summoned && new Date().getDay() !== 0 ? "This week" : "Sunday review"}
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginBottom: 7 }}>
          {/* A week that rested is not a week that failed (REST #11): with
              nothing won and no streak, the line reads the keepings instead
              of printing a double zero under a gold border. */}
          {data.winsWeek === 0 && data.streak === 0
            ? ((data.keptWeek ?? 0) > 0 ? `${data.keptWeek} kept this week, and no wins to count` : "A quiet week in the wake")
            : <>{data.winsWeek} win{data.winsWeek === 1 ? "" : "s"} this week · {data.streak} day{data.streak === 1 ? "" : "s"} at the helm{(data.keptWeek ?? 0) > 0 ? ` · ${data.keptWeek} kept` : ""}</>}
          {data.stars.filter(s => s.winsWeek > 0).map(s => ` · ${s.title}: ${s.winsWeek}`).join("")}
        </div>
        {topNamed.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 7 }}>
            {topNamed.map((w, i) => (
              <div key={i} style={{ fontSize: 11, color: "var(--color-foreground)" }}>
                <span aria-hidden="true" style={{ color: "#c8a04a" }}>★</span> {w.text}{starTitle(w.goalId) ? ` · ${starTitle(w.goalId)}` : ""}
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => { markWakeRead(readKey, data.weekStart); onOpenLog?.(); }}
          style={{ fontSize: 10.5, padding: "4px 12px", borderRadius: 8, border: "1px solid #c8b06a55", background: "var(--color-card)", color: "#8a6a20", cursor: "pointer", fontWeight: 600 }}>
          Read the whole wake <span aria-hidden="true">→</span>
        </button>
      </div>
  );
}
