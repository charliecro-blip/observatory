import React, { useState, useEffect, useRef } from "react";
import { PLANET_GLYPH as PLANET_ICONS } from "@/lib/glyphs";
import { planetColor } from "@/lib/planetColors";
import { usePreferences, useAstroDetail } from "@/contexts/preferences-context";
import { useTester } from "@/contexts/tester-context";
import LogDone from "@/components/LogDone";



type Phase = "idle" | "active" | "paused" | "done";

interface SessionTimerProps {
  planetaryHour?: { planet: string; began: string; ends: string };
  /**
   * Open the panel already pointed at something, from elsewhere in the app.
   *
   * A session's subject is its note — it labels the run and pre-fills the
   * done-composer when the timer stops — so "start a session on this task" is
   * exactly "open, with the note set". Consumed once and cleared by the
   * parent, so picking the same task again opens it again.
   */
  openOn?: { title: string } | null;
  onOpened?: () => void;
}

const PRESETS = [
  { label: "25 min", seconds: 25 * 60 },
  { label: "52 min", seconds: 52 * 60 },
  { label: "90 min", seconds: 90 * 60 },
];

function parseHHMM(t: string): Date {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function SessionTimer({ planetaryHour, openOn, onOpened }: SessionTimerProps) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  // Starting a session is the one-tap door into the astro-quiet lens: the
  // whole app drops to "minimal" while the timer runs and returns when it
  // stops. The stored preference is never touched — this is flow mode as a
  // temporary state, not a setting.
  const { setSessionQuiet } = usePreferences();
  // The timer's own panel obeys the lens too. While a session runs the lens
  // is minimal by definition, so the "Moon hour" header was contradicting
  // the "sky is quiet" claim from inside the very control that made it.
  const { level: timerLevel } = useAstroDetail();
  const timerQuiet = timerLevel === "minimal";
  const { profile } = useTester();
  const testerId = profile?.testerId ?? null;
  // Whether the done state is offering to log the stretch. Offered, never
  // demanded — "New session" declines it, and a declined offer leaves no
  // record (home-base §3).
  const [logging, setLogging] = useState(false);
  // The first session ever gets one line explaining the side effect the
  // person is about to see — cards folding away reads as breakage without
  // it (loyalty audit C3). Computed at mount so it holds through the whole
  // first session, then never again.
  const [firstQuietNote] = useState(() => {
    try { return !localStorage.getItem("compass-session-quiet-note"); } catch { return false; }
  });
  const [duration, setDuration] = useState(25 * 60);
  const [remaining, setRemaining] = useState(25 * 60);
  const [customMin, setCustomMin] = useState("25");
  const [useCustom, setUseCustom] = useState(false);
  const [useUntilHourEnd, setUseUntilHourEnd] = useState(false);
  const [note, setNote] = useState("");

  // Pointed at from Home: open, take the subject, and tell the parent so the
  // same task can be picked again later.
  useEffect(() => {
    if (!openOn) return;
    setNote(openOn.title);
    setOpen(true);
    onOpened?.();
  }, [openOn, onOpened]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef<Date | null>(null);
  /** The wall-clock instant the session ends. The one source of truth while
   *  active — `remaining` is always derived from it, never counted down. */
  const endsAtRef = useRef<number | null>(null);
  /** The session's full length, captured once at start. The ring's
   *  denominator has to be frozen: `duration` ignores the custom and
   *  until-hour-end paths, and live `secsUntilHourEnd` shrinks in step with
   *  `remaining`, so a ring divided by either drains at the wrong rate or
   *  not at all. */
  const sessionTotalRef = useRef(25 * 60);

  // Compute seconds until end of current planetary hour
  const hourEnd = planetaryHour?.ends ? parseHHMM(planetaryHour.ends) : null;
  const secsUntilHourEnd = hourEnd ? Math.max(0, Math.floor((hourEnd.getTime() - Date.now()) / 1000)) : 0;

  function resolvedDuration() {
    if (useUntilHourEnd) return secsUntilHourEnd;
    if (useCustom) return (parseInt(customMin) || 25) * 60;
    return duration;
  }

  /**
   * TIME, NOT TICKS (owner, 2026-08-15: "it stops counting if I switch tabs?
   * I started this when there were 24 minutes left" — and came back to 23:54).
   *
   * The countdown was `setInterval(r => r - 1, 1000)`: it subtracted one
   * second per TICK, and browsers throttle or suspend intervals in hidden
   * tabs, so every backgrounded minute was a minute the timer never counted.
   * A 25-minute session left in another tab would happily run for an hour.
   *
   * The end is a wall-clock instant now, and `remaining` is derived from it
   * on every tick — the interval is only a refresh cadence, so it no longer
   * matters how often (or whether) a throttled tab fires it. A focus and a
   * visibilitychange listener resnap the display the moment the tab returns,
   * rather than waiting up to a minute for the throttled interval's next
   * fire. Pause stores the remainder; resume re-anchors the end from it.
   */
  function syncFromClock() {
    const endsAt = endsAtRef.current;
    if (endsAt == null) return;
    const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
    setRemaining(left);
    if (left <= 0) {
      clearInterval(intervalRef.current!);
      endsAtRef.current = null;
      setPhase("done");
      setSessionQuiet(false);   // the session is over; the sky comes back
      // Browser notification if permission granted. In a hidden tab the
      // throttled interval still fires about once a minute, so this lands
      // within a minute of the true end even when backgrounded.
      if (Notification.permission === "granted") {
        new Notification("Session complete", {
          body: note ? `"${note}" — time's up.` : "Your Compass session is complete.",
          icon: "/favicon.svg",
        });
      }
    }
  }

  function beginTicking() {
    clearInterval(intervalRef.current!);
    intervalRef.current = setInterval(syncFromClock, 1000);
  }

  function start() {
    const dur = resolvedDuration();
    sessionTotalRef.current = Math.max(dur, 1);
    setRemaining(dur);
    setPhase("active");
    setSessionQuiet(true);
    try { localStorage.setItem("compass-session-quiet-note", "1"); } catch { /* private mode */ }
    startedRef.current = new Date();
    endsAtRef.current = Date.now() + dur * 1000;
    beginTicking();
  }

  function pause() {
    // Capture the true remainder from the clock, then let the anchor go —
    // paused time must not elapse.
    const endsAt = endsAtRef.current;
    const left = endsAt != null ? Math.max(0, Math.round((endsAt - Date.now()) / 1000)) : 0;
    clearInterval(intervalRef.current!);
    endsAtRef.current = null;
    setRemaining(left);
    setPhase("paused");
  }

  function resume() {
    setPhase("active");
    endsAtRef.current = Date.now() + remaining * 1000;
    beginTicking();
  }

  function stop() {
    clearInterval(intervalRef.current!);
    endsAtRef.current = null;
    setPhase("idle");
    setSessionQuiet(false);
    setRemaining(resolvedDuration());
  }

  // Release the lens on unmount too — a quiet override with no timer behind
  // it would be a mode the person can't see or end.
  useEffect(() => () => { clearInterval(intervalRef.current!); setSessionQuiet(false); }, []);

  // The instant-resnap on returning to the tab. Without it the display shows
  // the last pre-background value until the throttled interval next fires.
  useEffect(() => {
    if (phase !== "active") return;
    const snap = () => syncFromClock();
    window.addEventListener("focus", snap);
    document.addEventListener("visibilitychange", snap);
    return () => {
      window.removeEventListener("focus", snap);
      document.removeEventListener("visibilitychange", snap);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Progress ring params
  const totalSecs = sessionTotalRef.current;
  const pct = phase !== "idle" ? (remaining / totalSecs) : 1;
  const R = 28;
  const circ = 2 * Math.PI * R;
  const planet = planetaryHour?.planet;
  const pColor = planet ? planetColor(planet) : "#888888";

  const activeHourRemaining = secsUntilHourEnd;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "4px 10px",
          borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 10,
          background: phase === "active" ? "#fff8f0" : "var(--color-background)",
          color: phase === "active" ? "#8a4020" : "var(--text-2)",
          cursor: "pointer", fontWeight: phase === "active" ? 600 : 400,
        }}
      >
        {phase === "active" && (
          <svg width={10} height={10} viewBox="0 0 10 10">
            <circle cx={5} cy={5} r={4} stroke="#e0a040" strokeWidth={1.5} fill="none"/>
            <circle cx={5} cy={5} r={4} stroke="#e0a040" strokeWidth={1.5} fill="none"
              strokeDasharray={`${pct * 25.1} 25.1`}
              transform="rotate(-90 5 5)" strokeLinecap="round"/>
          </svg>
        )}
        {phase === "active" ? fmt(remaining) : <><span aria-hidden="true">⏱</span> Session</>}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12,
          boxShadow: "0 6px 24px rgba(0,0,0,0.12)", padding: "16px 18px",
          width: 240, zIndex: "var(--z-session)",
        }}>
          {/* Planetary hour context */}
          {planet && !timerQuiet && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid var(--color-border)" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: `${pColor}20`, color: pColor, flexShrink: 0 }}>
                {PLANET_ICONS[planet] ?? "○"}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600 }}>{planet} hour</div>
                <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                  {planetaryHour?.began} – {planetaryHour?.ends}
                  {activeHourRemaining > 0 && <span style={{ color: "#c08030" }}> · {fmt(activeHourRemaining)} left</span>}
                </div>
              </div>
            </div>
          )}

          {phase === "idle" && (
            <>
              <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Duration</div>
              <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
                {PRESETS.map(p => (
                  <button key={p.label} onClick={() => { setDuration(p.seconds); setUseCustom(false); setUseUntilHourEnd(false); }}
                    style={{ fontSize: 10, padding: "4px 9px", borderRadius: 8, border: "1px solid", cursor: "pointer",
                      background: !useCustom && !useUntilHourEnd && duration === p.seconds ? "#1a2a3a" : "var(--color-card)",
                      color: !useCustom && !useUntilHourEnd && duration === p.seconds ? "#ffffff" : "var(--text-2)",
                      borderColor: !useCustom && !useUntilHourEnd && duration === p.seconds ? "#1a2a3a" : "#d0cbc3",
                    }}>{p.label}</button>
                ))}
                {secsUntilHourEnd > 60 && !timerQuiet && (
                  <button onClick={() => { setUseUntilHourEnd(true); setUseCustom(false); }}
                    style={{ fontSize: 10, padding: "4px 9px", borderRadius: 8, border: "1px solid", cursor: "pointer",
                      background: useUntilHourEnd ? "#1a2a3a" : "var(--color-card)",
                      color: useUntilHourEnd ? "#ffffff" : "var(--text-2)",
                      borderColor: useUntilHourEnd ? "#1a2a3a" : "#d0cbc3",
                    }}>Until hour ends</button>
                )}
                <button onClick={() => { setUseCustom(true); setUseUntilHourEnd(false); }}
                  style={{ fontSize: 10, padding: "4px 9px", borderRadius: 8, border: "1px solid", cursor: "pointer",
                    background: useCustom ? "#1a2a3a" : "var(--color-card)",
                    color: useCustom ? "#ffffff" : "var(--text-2)",
                    borderColor: useCustom ? "#1a2a3a" : "#d0cbc3",
                  }}>Custom</button>
              </div>
              {useCustom && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <input type="number" min={1} max={300} value={customMin} onChange={e => setCustomMin(e.target.value)}
                    style={{ width: 60, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--color-border)", fontSize: 12 }}/>
                  <span style={{ fontSize: 11, color: "var(--color-muted)" }}>minutes</span>
                </div>
              )}
              <input
                value={note} onChange={e => setNote(e.target.value)}
                placeholder="Session label (optional)"
                style={{ width: "100%", padding: "6px 10px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 11, marginBottom: 10, background: "var(--color-card-2)" }}
              />
              <button onClick={start} style={{
                width: "100%", padding: "8px 0", borderRadius: 8, border: "none",
                background: "#1a2a3a", color: "#ffffff", fontSize: 12, fontWeight: 500, cursor: "pointer",
              }}>
                Start session
              </button>
            </>
          )}

          {(phase === "active" || phase === "paused") && (
            <>
              {note && <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 12, fontStyle: "italic" }}>"{note}"</div>}
              {/* Ring */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                <svg width={80} height={80} viewBox="0 0 80 80">
                  <circle cx={40} cy={40} r={R} stroke="#e8e4de" strokeWidth={4} fill="none"/>
                  <circle cx={40} cy={40} r={R} stroke={pColor} strokeWidth={4} fill="none"
                    strokeDasharray={`${pct * circ} ${circ}`}
                    strokeLinecap="round"
                    transform="rotate(-90 40 40)"/>
                  <text x={40} y={44} textAnchor="middle" fontSize={14} fontWeight={600} fill="#1a2a3a" fontFamily="sans-serif">
                    {fmt(remaining)}
                  </text>
                </svg>
              </div>
              {firstQuietNote && (
                <div style={{ fontSize: 11, color: "var(--text-3)", textAlign: "center", marginBottom: 10, lineHeight: 1.5 }}>
                  The sky steps back while a session runs. It returns when you stop.
                </div>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                {phase === "active"
                  ? <button onClick={pause} style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card)", fontSize: 11, cursor: "pointer" }}>Pause</button>
                  : <button onClick={resume} style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "none", background: "#1a2a3a", color: "#ffffff", fontSize: 11, cursor: "pointer" }}>Resume</button>
                }
                <button onClick={stop} style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card)", fontSize: 11, cursor: "pointer", color: "#c05030" }}>Stop</button>
              </div>
            </>
          )}

          {phase === "done" && !logging && (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div aria-hidden="true" style={{ fontSize: 22, marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)", marginBottom: 4 }}>Session complete</div>
              {note && <div style={{ fontSize: 11, color: "var(--color-muted)", fontStyle: "italic", marginBottom: 10 }}>"{note}"</div>}
              {/* The maker-schedule loop's last step: session ends → the
                  stretch is recorded on the thing it was for. An offer only. */}
              <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                <button onClick={() => setLogging(true)}
                  style={{ padding: "7px 14px", borderRadius: 7, border: "none", background: "#1a2a3a", color: "#ffffff", fontSize: 11, cursor: "pointer" }}>
                  Log what this was for
                </button>
                <button onClick={() => { setPhase("idle"); setNote(""); setRemaining(resolvedDuration()); }}
                  style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--text-2)", fontSize: 11, cursor: "pointer" }}>
                  New session
                </button>
              </div>
            </div>
          )}

          {phase === "done" && logging && (
            <LogDone
              testerId={testerId}
              defaultTitle={note}
              // sessionTotalRef, not resolvedDuration(): for an until-hour-end
              // session, resolvedDuration() re-reads the live clock here and
              // offers the NEXT hour's remainder, not the stretch that ran.
              defaultMinutes={Math.max(1, Math.round(sessionTotalRef.current / 60))}
              onLogged={() => { setLogging(false); setPhase("idle"); setNote(""); setRemaining(resolvedDuration()); }}
              onSkip={() => setLogging(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
