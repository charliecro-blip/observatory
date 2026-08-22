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
interface Association { element: string; planets: string[]; windowType: string; rationale: string; source: string; }

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
  title, testerId, lat, lon, goalId, projectId, kind, onClose,
}: {
  title: string;
  testerId: string | null;
  lat: number; lon: number;
  goalId?: number; projectId?: number;
  kind: "task" | "habit";
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

  const element = assoc?.element ?? "earth";
  const { data: bestData } = useQuery<{ windows: BestWindow[] }>({
    queryKey: ["best-times-suggest", element, lat, lon],
    queryFn: async () => {
      const r = await fetch(`/api/tides/elemental-peaks?lens=${element}&lat=${lat}&lon=${lon}&days=7&tz=${new Date().getTimezoneOffset()}`);
      return r.json();
    },
    enabled: !!assoc,
  });

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
  const ranked = [...(bestData?.windows ?? [])]
    .filter(isWaking)
    .sort((a, b) => {
      const free = (w: BestWindow) => (isWithinFreeWindow(w, chronotype) ? 0 : 1);
      if (free(a) !== free(b)) return free(a) - free(b);
      return Date.parse(a.startAt) - Date.parse(b.startAt); // soonest first
    })
    .slice(0, 3);

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

  const ec = ELEMENT_COLOR[element] ?? "#8a8278";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,16,12,0.4)", zIndex: "var(--z-dialog-nested)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => onClose(false)}>
      <div ref={ref} {...props} onClick={(e) => e.stopPropagation()} style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 16, padding: "20px 22px", maxWidth: 440, width: "100%" }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-3)", marginBottom: 4 }}>Find a good time</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-primary)", marginBottom: 8 }}>{title}</div>

        {/* Premium teaser for free users — manual scheduling stays available below */}
        {!unlocked && (
          <div style={{ background: `${ec}0c`, border: `1px solid ${ec}33`, borderRadius: 10, padding: "11px 13px", marginBottom: 12 }}>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.55 }}>
              <b style={{ color: "var(--color-primary)" }}>✦ Let Compass find the best time</b> — it reads what this is really about and matches it to the sky and your free hours.
            </div>
            <button onClick={() => setShowPremium(true)} style={{ marginTop: 7, fontSize: 10.5, padding: "5px 12px", borderRadius: 8, border: `1px solid ${ec}55`, background: "var(--color-card)", color: ec, cursor: "pointer", fontWeight: 600 }}>
              Explore premium
            </button>
          </div>
        )}

        {unlocked && assoc && (
          <div style={{ fontSize: 11, color: "var(--color-muted)", lineHeight: 1.55, marginBottom: 14, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: ec, flexShrink: 0, marginTop: 4 }} />
            <span>{assoc.rationale} <span style={{ color: "var(--text-3)" }}>Best in {element} windows this week:</span></span>
          </div>
        )}

        {unlocked && !bestData && <div style={{ fontSize: 12, color: "var(--text-3)", padding: "12px 0" }}>Reading the week…</div>}
        {err && <div style={{ fontSize: 11, color: "#c05030", padding: "6px 0" }}>Couldn't schedule that — try again.</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {unlocked && ranked.map((w, i) => {
            const awake = isAwakeDuring(w, chronotype);
            const free = isWithinFreeWindow(w, chronotype);
            return (
              <button key={i} onClick={() => schedule(w.startAt, w.endAt)} disabled={busy} style={{
                display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: busy ? "default" : "pointer",
                padding: "10px 12px", borderRadius: 10, border: `1px solid ${ec}40`, background: `${ec}0c`,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-primary)" }}>{fmtDay(w.startAt)} · {w.startClock}–{w.endClock}</div>
                  <div style={{ fontSize: 9.5, color: "var(--text-3)", marginTop: 1 }}>
                    {free && awake ? "fits your usual free time" : awake ? "you're usually awake" : "outside your usual awake hours"}
                  </div>
                </div>
                <span style={{ fontSize: 10.5, color: ec, fontWeight: 600, flexShrink: 0 }}>Schedule →</span>
              </button>
            );
          })}
          {unlocked && bestData && ranked.length === 0 && (
            <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>No standout windows this week — pick your own time below.</div>
          )}
        </div>

        {/* Pick your own */}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
          {!customOpen ? (
            <button onClick={() => setCustomOpen(true)} style={{ fontSize: 11, color: "var(--text-2)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
              Or pick my own time →
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
