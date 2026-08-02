import { ElectionPicker } from "@/components/ElectionPicker";
import { invalidateWindows } from "@/lib/invalidateWindows";
import type { AskElectionContext } from "@/App";
import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useElectionCategories, useElectionScan, type ElectionResult, type ElectionVerdict } from "@/hooks/useElection";
import { useNorthStars, useTidesWeek } from "@/hooks/useTides";
import Planner from "@/components/Planner";
import { PLANET_GLYPH as PLANET_ICONS } from "@/lib/glyphs";
import { ELEMENT_COLORS } from "@/lib/elements";

const BD_ELEMENT_COLOR: Record<string, string> = { fire: "#c04830", earth: ELEMENT_COLORS.earth, air: ELEMENT_COLORS.air, water: ELEMENT_COLORS.water };

// The PM breakdown, self-contained for the Plan tab (#3). Pick a Guiding Star,
// let the AI propose steps, edit, and commit them onto the star's backing
// project — same /api/planning/breakdown endpoints Aims uses.
function GoalBreakdown({ testerId }: { testerId: string | null }) {
  const qc = useQueryClient();
  const { data: stars } = useNorthStars(testerId);
  const list: any[] = Array.isArray(stars) ? stars : [];
  const [goalId, setGoalId] = useState<number | "">("");
  const [proposed, setProposed] = useState<{ title: string; element: string }[] | null>(null);
  const [committed, setCommitted] = useState(false);
  const authHeaders = { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) };
  const goal = list.find((g) => g.id === goalId);

  const run = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/planning/breakdown", {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ title: goal?.title, description: goal?.description }),
      });
      if (!r.ok) throw new Error("breakdown failed");
      return (await r.json()).milestones as { title: string; element: string }[];
    },
    onSuccess: (steps) => { setProposed(steps ?? []); setCommitted(false); },
  });

  const commit = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/planning/breakdown/commit", {
        method: "POST", headers: authHeaders,
        body: JSON.stringify({ goalId, milestones: proposed }),
      });
      if (!r.ok) throw new Error("commit failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["milestones"] });
      qc.invalidateQueries({ queryKey: ["north-stars"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setCommitted(true);
    },
  });

  return (
    <div style={{ marginBottom: 30 }}>
      <div style={{ marginBottom: 4, fontSize: 20, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "-0.3px" }}>Break it down</div>
      <div style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.6, marginBottom: 18 }}>
        Pick a Guiding Star that feels too big, and Compass proposes the steps to get there — each tagged with the
        kind of energy it needs. Edit them, then commit; they become the star's steps, ready to schedule.
      </div>

      {list.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--text-3)", padding: "20px 0" }}>
          No Guiding Stars yet — set one under <b>Stars</b> first, then come back to break it into steps.
        </div>
      ) : (
        <>
          <select value={goalId} onChange={(e) => { setGoalId(e.target.value ? Number(e.target.value) : ""); setProposed(null); setCommitted(false); }}
            style={{ width: "100%", maxWidth: 380, padding: "9px 11px", borderRadius: 9, border: "1px solid var(--color-border)", fontSize: 13, background: "var(--color-card-2)", color: "var(--color-foreground)", marginBottom: 12 }}>
            <option value="">Which Guiding Star?</option>
            {list.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>

          {goalId !== "" && !proposed && (
            <div>
              <button onClick={() => run.mutate()} disabled={run.isPending} style={{
                padding: "8px 18px", borderRadius: 9, border: "none", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                background: "#1a2a3a", color: "#fff",
              }}>{run.isPending ? "Thinking through the steps…" : "✦ Propose the steps"}</button>
              {run.isError && <span style={{ fontSize: 11, color: "#a03030", marginLeft: 10 }}>Something went wrong — try again.</span>}
            </div>
          )}

          {proposed && (
            <div>
              <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10 }}>Here's a path — edit any step, then commit them to <b>{goal?.title}</b>.</div>
              {proposed.map((s, i) => {
                const col = BD_ELEMENT_COLOR[s.element] ?? "#888";
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", marginBottom: 7, borderRadius: 9, border: "1px solid var(--color-border)", background: "var(--color-card)", borderLeft: `3px solid ${col}` }}>
                    <span style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>{i + 1}</span>
                    <input value={s.title} onChange={(e) => setProposed((p) => p!.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                      style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: "var(--color-foreground)", border: "none", background: "none", outline: "none" }} />
                    <span style={{ fontSize: 9.5, color: col, fontWeight: 600, flexShrink: 0 }}>● {s.element}</span>
                    <button onClick={() => setProposed((p) => p!.filter((_, j) => j !== i))} title="Remove" style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 14, lineHeight: 1, flexShrink: 0 }}>✕</button>
                  </div>
                );
              })}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                {!committed ? (
                  <button onClick={() => commit.mutate()} disabled={commit.isPending || proposed.length === 0} style={{
                    padding: "9px 20px", borderRadius: 9, border: "none", fontSize: 12.5, fontWeight: 600,
                    background: "#3a6020", color: "#fff", cursor: "pointer",
                  }}>{commit.isPending ? "Saving…" : `Commit ${proposed.length} step${proposed.length === 1 ? "" : "s"} →`}</button>
                ) : (
                  <span style={{ fontSize: 12, color: "#3a6020", fontWeight: 600 }}>✓ Steps added to {goal?.title} — find them under Stars to schedule.</span>
                )}
                <button onClick={() => { setProposed(null); setCommitted(false); }} style={{ fontSize: 11, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer" }}>start over</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const VERDICT_COLORS: Record<ElectionVerdict, string> = {
  strong: "#3a6020", workable: ELEMENT_COLORS.water, caution: "#a05020", avoid: "#a03030",
};
const VERDICT_BG: Record<ElectionVerdict, string> = {
  strong: "#e8f5e0", workable: "#e8eef8", caution: "#f8ede0", avoid: "#f8e4e0",
};
// One grading language app-wide (the FIT scale): electional keeps a 4th step
// because a BEGINNING can be genuinely worth refusing.
const VERDICT_LABELS: Record<ElectionVerdict, string> = {
  strong: "A great time", workable: "This time will do", caution: "Against the current", avoid: "Avoid",
};

function fmtRange(startIso: string, endIso: string): string {
  const s = new Date(startIso), e = new Date(endIso);
  const dateLabel = s.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const t = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dateLabel} · ${t(s)}–${t(e)}`;
}

function RuleRow({ rule }: { rule: ElectionResult["rules"][number] }) {
  const ok = rule.passed;
  const dotColor = rule.severity === "support"
    ? (ok ? "#3a6020" : "#bbb")
    : (ok ? "#3a6020" : rule.severity === "hard" ? "#a03030" : "#a05020");
  return (
    <div style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--color-border)" }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, marginTop: 4, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--color-foreground)" }}>
          {rule.label}
          <span style={{ fontWeight: 400, color: "var(--text-3)", marginLeft: 6, textTransform: "uppercase", fontSize: 8.5, letterSpacing: "0.4px" }}>
            {rule.severity}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "var(--color-muted)", lineHeight: 1.5, marginTop: 2 }}>{rule.detail}</div>
      </div>
    </div>
  );
}

function ElectionWindowCard({ result, defaultOpen, testerId, categoryLabel }: { result: ElectionResult; defaultOpen: boolean; testerId: string | null; categoryLabel: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const failedHard = result.rules.filter((r) => r.severity === "hard" && !r.passed);
  const qc = useQueryClient();
  const [added, setAdded] = useState(false);

  // Putting a chosen window on the calendar is a plain manual schedule (free) —
  // it writes a planning window at that time so Launch stops dead-ending.
  const addToCalendar = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/planning/windows", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) },
        body: JSON.stringify({
          title: categoryLabel,
          windowType: "launch",
          startTime: result.windowStart,
          endTime: result.windowEnd,
        }),
      });
      if (!r.ok) throw new Error(`schedule failed (${r.status})`);
    },
    onSuccess: () => {
      invalidateWindows(qc);
      setAdded(true);
    },
  });

  return (
    <div style={{
      border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-card)",
      marginBottom: 10, overflow: "hidden",
    }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        width: "100%", textAlign: "left", padding: "12px 14px", border: "none", cursor: "pointer",
        background: "none", display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          fontSize: 9.5, fontWeight: 700, padding: "3px 9px", borderRadius: 20, letterSpacing: "0.3px",
          color: VERDICT_COLORS[result.verdict], background: VERDICT_BG[result.verdict], flexShrink: 0,
        }}>{VERDICT_LABELS[result.verdict]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-foreground)" }}>
            {fmtRange(result.windowStart, result.windowEnd)}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 1 }}>
            {PLANET_ICONS[result.planetaryHour] ?? ""} {result.planetaryHour} hour{result.planetaryHourMatch ? " · matches this venture" : ""}
          </div>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{open ? "▲" : "▼"}</div>
      </button>
      <div style={{ padding: "0 14px 10px" }}>
        <div style={{ fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.5, marginBottom: 8 }}>{result.summary}</div>
        {open && (
          <div style={{ marginTop: 4, marginBottom: 8 }}>
            {result.rules.map((r) => <RuleRow key={r.key} rule={r} />)}
          </div>
        )}
        {result.verdict !== "avoid" && (
          added ? (
            <div style={{ fontSize: 11, color: "#3a6020", fontWeight: 600 }}>✓ Added to your calendar (Ahead)</div>
          ) : (
            <button onClick={() => addToCalendar.mutate()} disabled={addToCalendar.isPending} style={{
              fontSize: 11, fontWeight: 600, padding: "6px 13px", borderRadius: 8, cursor: "pointer",
              border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-primary)",
            }}>{addToCalendar.isPending ? "Adding…" : "＋ Put it on my calendar"}</button>
          )
        )}
      </div>
      {failedHard.length > 0 && !open && (
        <div style={{ padding: "0 14px 10px", fontSize: 10.5, color: "#a03030" }}>
          {failedHard.map((r) => r.label).join(", ")}
        </div>
      )}
    </div>
  );
}

// Whether the location is real (not the NYC default) — angle crossings are
// meaningless without the user's actual horizon.
function locationIsReal(lat: number, lon: number): boolean {
  return Math.abs(lat - 40.7) > 0.01 || Math.abs(lon - -74.0) > 0.01;
}

// Advanced timing layer for a beginning (#10): the personal angle crossings in
// the scan range — moments a planet crosses your Ascendant/Midheaven, i.e. rises
// or culminates over your horizon. Off by default and clearly explained, since
// it's a subtler, more advanced signal than the planetary hour / Moon's aspects.
function AngleCrossingsPanel({ days, lat, lon }: { days: number; lat: number; lon: number }) {
  const { data: week } = useTidesWeek(Math.min(days, 14), lat, lon);
  const real = locationIsReal(lat, lon);
  const rows: { date: string; time: string; planet: string; angle: string; type: string }[] = [];
  for (const d of week?.days ?? []) {
    for (const c of (d.crossings ?? []) as any[]) {
      rows.push({ date: d.date, time: c.time, planet: c.planet, angle: c.angle, type: c.type });
    }
  }
  return (
    <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 10, background: "var(--color-card-2)", border: "1px solid var(--color-border)" }}>
      <div style={{ fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.55, marginBottom: rows.length ? 10 : 0 }}>
        <b style={{ color: "var(--color-primary)" }}>Angle crossings</b> are moments a planet crosses one of your chart's angles — rising over your eastern horizon (Ascendant) or culminating overhead (Midheaven). Traditionally, beginning something as a benefic (Venus, Jupiter) crosses an angle lends it that planet's character. A subtle, advanced signal — use it to fine-tune a time you've already chosen from the windows above.
      </div>
      {!real ? (
        <div style={{ fontSize: 11, color: "#a05020" }}>Set your real location (Settings) — crossings depend on your exact horizon.</div>
      ) : rows.length === 0 ? (
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>No notable angle crossings in this range.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {rows.slice(0, 12).map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
              <span style={{ width: 96, flexShrink: 0, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>
                {new Date(r.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </span>
              <span style={{ width: 54, flexShrink: 0, color: "var(--color-muted)", fontVariantNumeric: "tabular-nums" }}>{r.time}</span>
              <span style={{ flexShrink: 0 }}>{PLANET_ICONS[r.planet] ?? ""}</span>
              <span style={{ color: "var(--color-foreground)" }}>{r.planet} crosses your {r.angle}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Launch({ testerId, lat, lon, plannerSeed, onPlannerSeedConsumed, onAskAboutElection }: { testerId: string | null; lat: number; lon: number; plannerSeed?: string | null; onPlannerSeedConsumed?: () => void; onAskAboutElection?: (ctx: AskElectionContext, seed: string) => void }) {
  const [category, setCategory] = useState<string | null>(null);
  const [days, setDays] = useState(14);
  const [showCrossings, setShowCrossings] = useState(false);
  // Plan has two distinct rooms: SCHEDULE (weave the week's tasks into good
  // windows) and BEGIN (electional — pick the moment to start one specific
  // venture). A switcher instead of one long scroll, so each mode gets the
  // whole surface and neither buries the other.
  const [mode, setMode] = useState<"schedule" | "breakdown" | "begin">("schedule");
  // A dump arriving from quick capture always lands in Schedule mode.
  React.useEffect(() => { if (plannerSeed) setMode("schedule"); }, [plannerSeed]);
  const { data: catData } = useElectionCategories();
  const { data: scan, isLoading } = useElectionScan(category, days, lat, lon);
  const categories = catData?.categories ?? [];
  const activeCategory = categories.find((c) => c.key === category);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "24px 28px 60px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Mode switcher */}
        <div style={{ display: "inline-flex", padding: 3, gap: 3, borderRadius: 10, background: "var(--color-card-2)", border: "1px solid var(--color-border)", marginBottom: 18 }}>
          {/* Two questions only (game plan §8C): "where should this work go?"
              and "when should this specific thing start?" Break down moved
              INSIDE the Guiding Star it serves — GuidingStarsHub has owned
              runBreakdown/commitBreakdown since the star rework, so the tab
              here was a duplicate door that made Plan harder to explain.
              "Pick a day" over "Begin": it is the marketing hook ("Pick the
              day. Know why.") as a tab, and the least discoverable word of
              the three became the plainest. */}
          {([["schedule", "Schedule"], ["begin", "Pick a day"]] as const).map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: "6px 18px", borderRadius: 8, fontSize: 12.5, cursor: "pointer", border: "none",
              background: mode === m ? "var(--color-card)" : "transparent", color: mode === m ? "var(--color-primary)" : "var(--text-3)",
              fontWeight: mode === m ? 600 : 400, boxShadow: mode === m ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            }}>{label}</button>
          ))}
        </div>

        {/* Plan weaves work into "the open stretches of your week" — but with
            no calendar connected it doesn't know which stretches are open, so
            the promise quietly degrades into guessing. Ask BEFORE the planning
            happens, not after (owner 2026-08-02); dismissible, and gone for
            good once connected. */}
        {mode === "schedule" && <ConnectCalendarPrompt testerId={testerId} />}

        {/* SCHEDULE — "when should I do all of this?" */}
        {mode === "schedule" && <Planner testerId={testerId} lat={lat} lon={lon} seedList={plannerSeed} onSeedConsumed={onPlannerSeedConsumed} />}

        {/* BREAK DOWN — "this goal is too big; give me the steps" (#3: the PM
            breakdown, also reachable from Aims, surfaced here in Plan). */}

        {mode === "begin" && (<>
        {/* Electional — "when should I BEGIN one specific venture?" */}
        <div style={{ marginBottom: 4, fontSize: 20, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "-0.3px" }}>
          Begin something
        </div>
        <div style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.6, marginBottom: 22 }}>
          When's a good moment to begin something? The sky's timing describes the shape and early tempo of a
          beginning — not a guaranteed outcome. Perfect windows are rare; this shows the best available one honestly.
        </div>

        {/* The activity election picker — the extensive correspondence list,
            tiered good/great times, one-tap scheduling (owner 2026-07-20). */}
        <ElectionPicker testerId={testerId} lat={lat} lon={lon} onAsk={onAskAboutElection} />

        {/* Category picker — one idea at a time: once a category is chosen the
            grid folds away to just the choice + a "change" affordance, so the
            screen belongs to the results (mobile-first pacing). */}
        {!category ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
            {categories.map((c) => (
              <button key={c.key} onClick={() => setCategory(c.key)} style={{
                textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                border: "1px solid var(--color-border)", background: "var(--color-card)",
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-foreground)" }}>{c.label}</div>
                <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2, lineHeight: 1.4 }}>{c.description}</div>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "10px 12px", borderRadius: 10, border: "1.5px solid #1a2a3a", background: "var(--color-card)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-primary)" }}>{activeCategory?.label}</div>
              <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 1, lineHeight: 1.4 }}>{activeCategory?.description}</div>
            </div>
            <button onClick={() => setCategory(null)} style={{
              fontSize: 10.5, padding: "4px 12px", borderRadius: 8, cursor: "pointer", flexShrink: 0,
              border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-muted)",
            }}>← change</button>
          </div>
        )}

        {category && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>Scan next</span>
              {[7, 14, 30].map((d) => (
                <button key={d} onClick={() => setDays(d)} style={{
                  padding: "5px 12px", borderRadius: 8, fontSize: 11, cursor: "pointer",
                  border: days === d ? "1.5px solid #1a2a3a" : "1px solid var(--color-border)",
                  background: days === d ? "#1a2a3a10" : "var(--color-card)",
                  color: days === d ? "var(--color-foreground)" : "var(--color-muted)", fontWeight: days === d ? 600 : 400,
                }}>{d} days</button>
              ))}
            </div>

            {/* Advanced: personal angle crossings across the range (#10) */}
            <div style={{ marginBottom: 14 }}>
              <button onClick={() => setShowCrossings((v) => !v)} style={{
                fontSize: 10.5, padding: "4px 11px", borderRadius: 8, cursor: "pointer",
                border: "1px solid var(--color-border)", background: showCrossings ? "#fff8f0" : "var(--color-card)",
                color: showCrossings ? "#b07020" : "var(--color-muted)", fontWeight: 500,
              }}>{showCrossings ? "▾" : "▸"} Angle crossings · advanced</button>
            </div>
            {showCrossings && <AngleCrossingsPanel days={days} lat={lat} lon={lon} />}

            {isLoading && <div style={{ fontSize: 12, color: "var(--text-3)" }}>Scanning the sky…</div>}

            {scan?.hardBlock && (
              <div style={{
                padding: "12px 14px", borderRadius: 10, background: "#f8e4e0", border: "1px solid #e0c0b8",
                marginBottom: 16, fontSize: 12, color: "#8a3020", lineHeight: 1.55,
              }}>
                Mercury is retrograde right now — classically avoided for {activeCategory?.label.toLowerCase()},
                regardless of how the Moon looks. {scan.hardBlock.clearsOn
                  ? `The nearest genuinely clear window opens after Mercury turns direct on ${new Date(scan.hardBlock.clearsOn).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`
                  : "It doesn't clear within this scan range — try a longer window."}
              </div>
            )}

            {scan && scan.windows.length === 0 && !isLoading && (
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>No windows found in this range.</div>
            )}

            {scan?.windows.map((w, i) => (
              <ElectionWindowCard key={w.date} result={w} defaultOpen={i === 0 && activeCategory?.weight !== "light"}
                testerId={testerId} categoryLabel={activeCategory?.label ?? "Launch"} />
            ))}
          </>
        )}

        <div style={{ marginTop: 24, fontSize: 10, color: "var(--text-3)", lineHeight: 1.6, borderTop: "1px solid var(--color-border)", paddingTop: 14 }}>
          A v1 ruleset — sources disagree on some secondary rules, and this takes reasonable, commonly-cited
          positions. Health, surgical, and medical timing decisions are out of scope everywhere in this app.
        </div>
        </>)}
      </div>
    </div>
  );
}

/**
 * "Compass will plan around what's already there."
 *
 * The Planner's own copy promises to weave work into "the open stretches of
 * your week … around your waking hours and your calendar". With no calendar
 * connected, the second half of that sentence is aspirational: it plans around
 * a week it can't see, and the user only discovers the gap when a suggested
 * window lands on top of a meeting.
 *
 * Deliberately placed BEFORE the planning UI rather than after a bad result —
 * the fix is worth nothing once the plan is already wrong. Self-gating: absent
 * when connected, when Google isn't configured on this deployment, and once
 * dismissed (per tester, so a second tester on the same machine still sees it).
 */
function ConnectCalendarPrompt({ testerId }: { testerId: string | null }) {
  const qc = useQueryClient();
  const key = `obs_plan_gcal_prompt_${testerId ?? "anon"}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(key) === "1"; } catch { return false; }
  });

  const { data: status } = useQuery<{ connected: boolean; configured?: boolean }>({
    queryKey: ["gcal-status", testerId],
    queryFn: async () => {
      const r = await fetch("/api/integrations/google-cal/status", {
        headers: testerId ? { "x-tester-id": testerId } : {},
      });
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 30_000,
  });

  // The popup posts back on success — refresh so the strip disappears without
  // a reload, and so the Planner picks the events up on its next run.
  React.useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === "google-cal-connected") {
        qc.invalidateQueries({ queryKey: ["gcal-status"] });
        qc.invalidateQueries({ queryKey: ["gcal-events"] });
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [qc]);

  if (dismissed || !testerId) return null;
  if (!status || status.connected || status.configured === false) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      background: "var(--color-card)", border: "1px solid var(--color-border)",
      borderLeft: "3px solid var(--color-primary)", borderRadius: 10,
      padding: "10px 14px", marginBottom: 14,
    }}>
      <span style={{ fontSize: 15, flexShrink: 0 }}>▦</span>
      <div style={{ flex: 1, minWidth: 220, fontSize: 11.5, color: "var(--color-foreground)", lineHeight: 1.55 }}>
        Connect a calendar and Compass will plan <b>around what's already there</b> —
        otherwise it's placing work into a week it can't see.
      </div>
      <button
        onClick={() => window.open(
          `/api/integrations/google-cal/auth?testerId=${encodeURIComponent(testerId)}`,
          "gcal-connect", "width=500,height=600,left=200,top=100")}
        style={{
          fontSize: 10.5, fontWeight: 600, padding: "5px 12px", borderRadius: 8, cursor: "pointer",
          border: "1px solid var(--color-border)", background: "var(--color-card-2)",
          color: "var(--color-primary)", flexShrink: 0,
        }}>Connect →</button>
      <button
        onClick={() => { try { localStorage.setItem(key, "1"); } catch { /* private mode */ } setDismissed(true); }}
        title="Not now"
        style={{ fontSize: 13, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", padding: "0 2px", flexShrink: 0 }}>
        ✕
      </button>
    </div>
  );
}
