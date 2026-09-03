import React, { useState } from "react";
import { localToday } from "@/lib/dates";
import { invalidateWindows } from "@/lib/invalidateWindows";
import { useDialog } from "@/hooks/useDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTester } from "@/contexts/tester-context";
import { useEntitlements } from "@/contexts/entitlements-context";
import { PremiumExploreModal } from "@/components/PremiumGate";
import { isWithinFreeWindow, isAwakeDuring } from "@/lib/chronotype";
import { ELEMENT_COLORS } from "@/lib/elements";

const ELEMENT_COLOR: Record<string, string> = { fire: "#c04830", earth: ELEMENT_COLORS.earth, air: ELEMENT_COLORS.air, water: ELEMENT_COLORS.water };

interface BestWindow { date: string; startClock: string; endClock: string; startAt: string; endAt: string; peakE: number; label: string; }
/**
 * A real election window, from the same engine ActivityWeek draws its bars
 * from. `why` is already the joined, literal-then-reading sentence the engine
 * builds — the fact first, what to make of it after, the house rule the rest
 * of the app follows.
 */
interface ElectionWindow {
  startAt: string; endAt: string; startClock: string; endClock: string;
  tier: "good" | "great"; why: string; personal: boolean;
}
interface Association { element: string | null; planets: string[]; windowType: string; rationale: string; source: string; activityKey?: string; }

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/**
 * Shown right after a task/habit is created: reads the aim's timing signature
 * (association), pulls the best windows for it this week from the tide engine,
 * ranks them against the user's free/awake hours, and lets them schedule one in
 * a tap — which writes a planning window onto the Ahead calendar. Or pick their
 * own time, or skip. The whole point: creating a thing and finding its time are
 * one motion, and the calendar is where they meet.
 */
export function ScheduleSuggest({
  title, testerId, lat, lon, goalId, projectId, kind, taskId, onClose,
}: {
  title: string;
  testerId: string | null;
  lat: number; lon: number;
  goalId?: number; projectId?: number;
  kind: "task" | "habit";
  /** So scheduling from here moves the task's existing window instead of
   *  cloning a second one — the same idempotent path Save time now uses
   *  everywhere else. */
  taskId?: number;
  onClose: (scheduled: boolean) => void;
}) {
  // onClose carries "did we schedule anything"; Escape and the scrim are
  // both a plain dismissal, so both pass false.
  const { ref, props } = useDialog(() => onClose(false), "Find a good time");
  const qc = useQueryClient();
  const { profile } = useTester();
  // Finding a task's best times ACROSS THE WEEK is orchestration — the paid
  // half of the line — while picking your own time by hand stays free, which
  // is what the custom picker below is. Keyed on placement.calendar rather
  // than on the old "scheduling" bundle, which also carried natal features
  // the pricing decision un-gated.
  const unlocked = useEntitlements().can("placement.calendar");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  // Free users go straight to picking their own time (manual scheduling is
  // free); the app's best-time intelligence is the premium layer.
  const [customOpen, setCustomOpen] = useState(!unlocked);
  const [customDate, setCustomDate] = useState(localToday());
  const [customStart, setCustomStart] = useState("09:00");
  const [showPremium, setShowPremium] = useState(false);

  const { data: assoc } = useQuery<Association>({
    queryKey: ["associate", title],
    queryFn: async () => {
      const r = await fetch("/api/associate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: title }),
      });
      return r.json();
    },
    enabled: unlocked, // the reading is part of the premium timing intelligence
  });

  /**
   * ASKED, NOT DEFAULTED.
   *
   * This was `assoc?.element ?? "earth"`, so even once the server stopped
   * inventing an element the sheet would have gone on inventing one — and then
   * fetched a whole week of earth peaks to answer a question nobody had
   * settled. The owner's line was "i would actually rather be asked" (2026-08-31),
   * alongside "tap an element to correct it" pointing at nothing tappable.
   *
   * Null now stays null until the reader picks, and the picker below is the
   * thing that was being described but never rendered.
   */
  const [pickedElement, setPickedElement] = useState<string | null>(null);
  const element = pickedElement ?? assoc?.element ?? null;

  /**
   * THE REAL ENGINE, WHEN THE TASK IS KNOWN.
   *
   * This used to ask elemental-peaks for every task — "when does the fire
   * tide run highest" — which is a real answer to a different question.
   * The route's own header says so: "Activity timing is
   * evaluateActivityInterval / /elections/times. Nothing here should be used
   * to answer it." A task matched to a real activity (association source
   * "correspondence") gets that engine now, which is the one ActivityWeek
   * already draws its bars from — genuine per-window evidence, not a curve.
   *
   * This also answers the other half of the same complaint: "i want more,
   * and an explanation of why, the astro behind it" — a single elemental
   * peak per day, mostly landing outside waking hours, was why there was
   * often exactly one option; a real week scan for a real activity commonly
   * returns several, each with its own reason attached.
   */
  const { data: electionData } = useQuery<{ windows: ElectionWindow[] }>({
    queryKey: ["election-times-suggest", assoc?.activityKey, lat, lon],
    queryFn: async () => {
      const tzOffsetMin = new Date().getTimezoneOffset();
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const r = await fetch(
        `/api/elections/times?activity=${encodeURIComponent(assoc!.activityKey!)}&span=week&lat=${lat}&lon=${lon}&tz=${tzOffsetMin}&timeZone=${encodeURIComponent(timeZone)}&locationKnown=true`,
        { headers: testerId ? { "x-tester-id": testerId } : {} },
      );
      return r.json();
    },
    enabled: !!assoc?.activityKey,
  });

  // THE HONEST FALLBACK, only when there is no real activity to hand the
  // election engine — a keyword or shape match, or a manually picked lane.
  // Kept, but no longer the default path, and the copy below says what it
  // actually is: an element's tide, not this task's own timing.
  const { data: bestData } = useQuery<{ windows: BestWindow[] }>({
    queryKey: ["best-times-suggest", element, lat, lon],
    queryFn: async () => {
      const r = await fetch(`/api/tides/elemental-peaks?lens=${element}&lat=${lat}&lon=${lon}&days=7&tz=${new Date().getTimezoneOffset()}`);
      return r.json();
    },
    enabled: !!assoc && !assoc.activityKey && !!element,
  });
  const usingElections = !!assoc?.activityKey;

  // Waking-hours filter + a clear order. A sky-perfect 3am slot is a taunt,
  // not a suggestion, so night windows are REMOVED (not just deprioritized)
  // unless the user's chronotype says they're awake then. Then: free-time fit
  // first, and within that, SOONEST first — so the list has a legible logic.
  const chronotype = profile?.chronotype;
  const wakeH = chronotype?.wakeTime ? parseInt(chronotype.wakeTime.split(":")[0], 10) : 7;
  const sleepH = chronotype?.sleepTime ? parseInt(chronotype.sleepTime.split(":")[0], 10) : 22;
  const isWaking = (w: BestWindow) => {
    const h = new Date(w.startAt).getHours(); // viewer-local
    return sleepH > wakeH ? (h >= wakeH && h < sleepH) : (h >= wakeH || h < sleepH);
  };
  // A shared shape so one render loop draws either source. `evidence` carries
  // the real why for an election window and stays undefined for an elemental
  // peak, which is the honest difference between the two paths made visible.
  const candidates: { startAt: string; endAt: string; startClock: string; endClock: string; tier?: "good"|"great"; evidence?: string; personal?: boolean }[] =
    usingElections
      ? (electionData?.windows ?? []).map(w => ({
          startAt: w.startAt, endAt: w.endAt, startClock: w.startClock, endClock: w.endClock,
          tier: w.tier, evidence: w.why, personal: w.personal,
        }))
      : (bestData?.windows ?? []);
  const ranked = candidates
    .filter(isWaking)
    .sort((a, b) => {
      // A GREAT window still outranks a merely free one — the sky's own
      // scarcity is worth more than a soonest-first tiebreak.
      if (usingElections) {
        const tierRank = (t?: string) => (t === "great" ? 0 : 1);
        if (tierRank(a.tier) !== tierRank(b.tier)) return tierRank(a.tier) - tierRank(b.tier);
      }
      const free = (w: typeof a) => (isWithinFreeWindow(w, chronotype) ? 0 : 1);
      if (free(a) !== free(b)) return free(a) - free(b);
      return Date.parse(a.startAt) - Date.parse(b.startAt); // soonest first
    })
    // More than the old 3 — a real week scan for a real activity usually has
    // more to offer than a single elemental peak per day did.
    .slice(0, usingElections ? 5 : 3);
  const loading = usingElections ? (assoc?.activityKey && !electionData) : (element && !bestData);

  async function schedule(startAt: string, endAt: string) {
    if (!testerId || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/planning/windows", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tester-id": testerId },
        body: JSON.stringify({
          title,
          windowType: assoc?.windowType ?? "deep_work",
          startTime: startAt,
          endTime: endAt,
          goalId: goalId ?? undefined,
          projectId: projectId ?? undefined,
          taskId,
        }),
      });
      if (!r.ok) throw new Error(`schedule failed (${r.status})`);
      invalidateWindows(qc);
      qc.invalidateQueries({ queryKey: ["tides-week"] });
      onClose(true);
    } catch {
      setErr(true);
      setTimeout(() => setErr(false), 4000);
    } finally {
      setBusy(false);
    }
  }

  function scheduleCustom() {
    const start = new Date(`${customDate}T${customStart}:00`);
    const end = new Date(start.getTime() + 60 * 60000); // default 1h block
    schedule(start.toISOString(), end.toISOString());
  }

  const ec = (element ? ELEMENT_COLOR[element] : null) ?? "#8a8278";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,16,12,0.4)", zIndex: "var(--z-dialog)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => onClose(false)}>
      <div ref={ref} {...props} onClick={(e) => e.stopPropagation()} style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 16, padding: "20px 22px", maxWidth: 440, width: "100%" }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-3)", marginBottom: 4 }}>Find a good time</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-primary)", marginBottom: 8 }}>{title}</div>

        {/* Premium teaser for free users — manual scheduling stays available below */}
        {!unlocked && (
          <div style={{ background: `${ec}0c`, border: `1px solid ${ec}33`, borderRadius: 10, padding: "11px 13px", marginBottom: 12 }}>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.55 }}>
              <b style={{ color: "var(--color-primary)" }}><span aria-hidden="true">✦</span> Let Compass find the best time</b> — it reads what this is really about and matches it to the sky and your free hours.
            </div>
            <button onClick={() => setShowPremium(true)} style={{ marginTop: 7, fontSize: 10.5, padding: "5px 12px", borderRadius: 8, border: `1px solid ${ec}55`, background: "var(--color-card)", color: ec, cursor: "pointer", fontWeight: 600 }}>
              Explore premium
            </button>
          </div>
        )}

        {unlocked && assoc && (
          <div style={{ fontSize: 11, color: "var(--color-muted)", lineHeight: 1.55, marginBottom: 14, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: ec, flexShrink: 0, marginTop: 4 }} />
            <span>
              {assoc.rationale}
              {/* Said plainly which question is being answered. Elemental
                  peaks read a LANE's tide, not this task's own timing — the
                  route that computes it says so explicitly in its own header
                  — so the fallback copy must not borrow the confident phrasing
                  the real engine earns. */}
              {usingElections && <span style={{ color: "var(--text-3)" }}> This week's windows for it, from the timing engine:</span>}
              {!usingElections && element && <span style={{ color: "var(--text-3)" }}> No specific activity recognized — reading the {element} tide instead:</span>}
            </span>
          </div>
        )}

        {/* THE QUESTION, actually asked. Four lanes, no preselection — a
            highlighted option is an answer the reader did not give. */}
        {unlocked && !element && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 7 }}>What kind of work is this?</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {([
                ["fire", "Drive"], ["earth", "Steady"], ["air", "Thinking"], ["water", "Feeling"],
              ] as const).map(([key, label]) => (
                <button key={key} onClick={() => setPickedElement(key)} style={{
                  fontSize: 11.5, padding: "6px 13px", borderRadius: 12, cursor: "pointer",
                  border: `1px solid ${ELEMENT_COLOR[key] ?? "var(--color-border)"}55`,
                  background: "var(--color-card-2)", color: "var(--text-2)",
                }}>{label}</button>
              ))}
            </div>
          </div>
        )}

        {unlocked && loading && <div style={{ fontSize: 12, color: "var(--text-3)", padding: "12px 0" }}>Reading the week…</div>}
        {err && <div style={{ fontSize: 11, color: "#c05030", padding: "6px 0" }}>Couldn't schedule that — try again.</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {unlocked && ranked.map((w, i) => {
            const awake = isAwakeDuring(w, chronotype);
            const free = isWithinFreeWindow(w, chronotype);
            return (
              <button key={i} onClick={() => schedule(w.startAt, w.endAt)} disabled={busy} style={{
                display: "flex", alignItems: "flex-start", gap: 10, textAlign: "left", cursor: busy ? "default" : "pointer",
                padding: "10px 12px", borderRadius: 10, border: `1px solid ${ec}40`, background: `${ec}0c`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                    {fmtDay(w.startAt)} · {w.startClock}–{w.endClock}
                    {w.tier === "great" && (
                      <span title="Strong: several signs agree" style={{ fontSize: 10, fontWeight: 700, color: "#8a6a20", background: "#c8a04a22", borderRadius: 4, padding: "1px 5px" }}>★ strong</span>
                    )}
                    {w.personal && (
                      <span title="Read against your own chart" style={{ fontSize: 10, fontWeight: 700, color: "#6f6a90", background: "#6f6a9018", borderRadius: 4, padding: "1px 5px" }}>your chart</span>
                    )}
                  </div>
                  {/* THE ASTRO BEHIND IT. `evidence` is the engine's own
                      literal-then-reading sentence — the same one ActivityWeek
                      shows on a tapped bar — not a restatement of it. */}
                  {w.evidence ? (
                    <div style={{ fontSize: 10.5, color: "var(--text-2)", marginTop: 2, lineHeight: 1.4 }}>{w.evidence}</div>
                  ) : (
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
                      {free && awake ? "fits your usual free time" : awake ? "you're usually awake" : "outside your usual awake hours"}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 10.5, color: ec, fontWeight: 600, flexShrink: 0 }}>Schedule <span aria-hidden="true">→</span></span>
              </button>
            );
          })}
          {unlocked && !loading && (usingElections ? electionData : bestData) && ranked.length === 0 && (
            <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>No standout windows this week — pick your own time below.</div>
          )}
        </div>

        {/* Pick your own */}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
          {!customOpen ? (
            <button onClick={() => setCustomOpen(true)} style={{ fontSize: 11, color: "var(--text-2)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
              Or pick my own time <span aria-hidden="true">→</span>
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)}
                style={{ padding: "6px 8px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 12, background: "var(--color-card-2)" }} />
              <input type="time" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                style={{ padding: "6px 8px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 12, background: "var(--color-card-2)" }} />
              <button onClick={scheduleCustom} disabled={busy} style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: "#1a2a3a", color: "#ffffff", fontSize: 11, cursor: "pointer" }}>Schedule</button>
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button onClick={() => onClose(false)} style={{ fontSize: 11, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer" }}>
            Skip — I'll schedule it later
          </button>
        </div>
      </div>
      {showPremium && <PremiumExploreModal onClose={() => setShowPremium(false)} />}
    </div>
  );
}
