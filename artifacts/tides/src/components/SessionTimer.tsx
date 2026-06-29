import React, { useState, useEffect, useRef } from "react";

const PLANET_ICONS: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀",
  Mars: "♂", Jupiter: "♃", Saturn: "♄",
};

function planetColor(p: string) {
  return { Sun:"#c08020", Moon:"#7080a0", Mercury:"#608060", Venus:"#a06080",
    Mars:"#c04040", Jupiter:"#6040a0", Saturn:"#807060" }[p] ?? "#888";
}

type Phase = "idle" | "active" | "paused" | "done";

interface SessionTimerProps {
  planetaryHour?: { planet: string; began: string; ends: string };
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

export function SessionTimer({ planetaryHour }: SessionTimerProps) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [duration, setDuration] = useState(25 * 60);
  const [remaining, setRemaining] = useState(25 * 60);
  const [customMin, setCustomMin] = useState("25");
  const [useCustom, setUseCustom] = useState(false);
  const [useUntilHourEnd, setUseUntilHourEnd] = useState(false);
  const [note, setNote] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef<Date | null>(null);

  // Compute seconds until end of current planetary hour
  const hourEnd = planetaryHour?.ends ? parseHHMM(planetaryHour.ends) : null;
  const secsUntilHourEnd = hourEnd ? Math.max(0, Math.floor((hourEnd.getTime() - Date.now()) / 1000)) : 0;

  function resolvedDuration() {
    if (useUntilHourEnd) return secsUntilHourEnd;
    if (useCustom) return (parseInt(customMin) || 25) * 60;
    return duration;
  }

  function start() {
    const dur = resolvedDuration();
    setRemaining(dur);
    setPhase("active");
    startedRef.current = new Date();
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(intervalRef.current!);
          setPhase("done");
          // Browser notification if permission granted
          if (Notification.permission === "granted") {
            new Notification("Session complete", {
              body: note ? `"${note}" — time's up.` : "Your Tides session is complete.",
              icon: "/favicon.svg",
            });
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }

  function pause() {
    clearInterval(intervalRef.current!);
    setPhase("paused");
  }

  function resume() {
    setPhase("active");
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { clearInterval(intervalRef.current!); setPhase("done"); return 0; }
        return r - 1;
      });
    }, 1000);
  }

  function stop() {
    clearInterval(intervalRef.current!);
    setPhase("idle");
    setRemaining(resolvedDuration());
  }

  useEffect(() => () => clearInterval(intervalRef.current!), []);

  // Progress ring params
  const totalSecs = useUntilHourEnd ? secsUntilHourEnd || duration : duration;
  const pct = phase !== "idle" ? (remaining / Math.max(totalSecs, 1)) : 1;
  const R = 28;
  const circ = 2 * Math.PI * R;
  const planet = planetaryHour?.planet;
  const pColor = planet ? planetColor(planet) : "#888";

  const activeHourRemaining = secsUntilHourEnd;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "4px 10px",
          borderRadius: 8, border: "1px solid #d0cbc3", fontSize: 10,
          background: phase === "active" ? "#fff8f0" : "#f0ede8",
          color: phase === "active" ? "#8a4020" : "#666",
          cursor: "pointer", fontWeight: phase === "active" ? 600 : 400,
        }}
      >
        {phase === "active" && (
          <svg width={10} height={10} viewBox="0 0 10 10">
            <circle cx={5} cy={5} r={4} stroke="#e0a040" strokeWidth={1.5} fill="none"/>
            <circle cx={5} cy={5} r={4} stroke="#e0a040" strokeWidth={1.5} fill="none"
              strokeDasharray={`${(remaining / totalSecs) * 25.1} 25.1`}
              transform="rotate(-90 5 5)" strokeLinecap="round"/>
          </svg>
        )}
        {phase === "active" ? fmt(remaining) : "⏱ Session"}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          background: "#fff", border: "1px solid #d8d2ca", borderRadius: 12,
          boxShadow: "0 6px 24px rgba(0,0,0,0.12)", padding: "16px 18px",
          width: 240, zIndex: 500,
        }}>
          {/* Planetary hour context */}
          {planet && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #f0ede8" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: `${pColor}20`, color: pColor, flexShrink: 0 }}>
                {PLANET_ICONS[planet] ?? "○"}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600 }}>{planet} hour</div>
                <div style={{ fontSize: 9, color: "#aaa" }}>
                  {planetaryHour?.began} – {planetaryHour?.ends}
                  {activeHourRemaining > 0 && <span style={{ color: "#c08030" }}> · {fmt(activeHourRemaining)} left</span>}
                </div>
              </div>
            </div>
          )}

          {phase === "idle" && (
            <>
              <div style={{ fontSize: 10, color: "#aaa", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>Duration</div>
              <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
                {PRESETS.map(p => (
                  <button key={p.label} onClick={() => { setDuration(p.seconds); setUseCustom(false); setUseUntilHourEnd(false); }}
                    style={{ fontSize: 10, padding: "4px 9px", borderRadius: 8, border: "1px solid", cursor: "pointer",
                      background: !useCustom && !useUntilHourEnd && duration === p.seconds ? "#1a2a3a" : "#fff",
                      color: !useCustom && !useUntilHourEnd && duration === p.seconds ? "#fff" : "#555",
                      borderColor: !useCustom && !useUntilHourEnd && duration === p.seconds ? "#1a2a3a" : "#d0cbc3",
                    }}>{p.label}</button>
                ))}
                {secsUntilHourEnd > 60 && (
                  <button onClick={() => { setUseUntilHourEnd(true); setUseCustom(false); }}
                    style={{ fontSize: 10, padding: "4px 9px", borderRadius: 8, border: "1px solid", cursor: "pointer",
                      background: useUntilHourEnd ? "#1a2a3a" : "#fff",
                      color: useUntilHourEnd ? "#fff" : "#555",
                      borderColor: useUntilHourEnd ? "#1a2a3a" : "#d0cbc3",
                    }}>Until hour ends</button>
                )}
                <button onClick={() => { setUseCustom(true); setUseUntilHourEnd(false); }}
                  style={{ fontSize: 10, padding: "4px 9px", borderRadius: 8, border: "1px solid", cursor: "pointer",
                    background: useCustom ? "#1a2a3a" : "#fff",
                    color: useCustom ? "#fff" : "#555",
                    borderColor: useCustom ? "#1a2a3a" : "#d0cbc3",
                  }}>Custom</button>
              </div>
              {useCustom && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <input type="number" min={1} max={300} value={customMin} onChange={e => setCustomMin(e.target.value)}
                    style={{ width: 60, padding: "5px 8px", borderRadius: 6, border: "1px solid #d8d2ca", fontSize: 12 }}/>
                  <span style={{ fontSize: 11, color: "#888" }}>minutes</span>
                </div>
              )}
              <input
                value={note} onChange={e => setNote(e.target.value)}
                placeholder="Session label (optional)"
                style={{ width: "100%", padding: "6px 10px", borderRadius: 7, border: "1px solid #d8d2ca", fontSize: 11, marginBottom: 10, outline: "none", background: "#faf8f5" }}
              />
              <button onClick={start} style={{
                width: "100%", padding: "8px 0", borderRadius: 8, border: "none",
                background: "#1a2a3a", color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer",
              }}>
                Start session
              </button>
            </>
          )}

          {(phase === "active" || phase === "paused") && (
            <>
              {note && <div style={{ fontSize: 11, color: "#555", marginBottom: 12, fontStyle: "italic" }}>"{note}"</div>}
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
              <div style={{ display: "flex", gap: 6 }}>
                {phase === "active"
                  ? <button onClick={pause} style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "1px solid #d0cbc3", background: "#fff", fontSize: 11, cursor: "pointer" }}>Pause</button>
                  : <button onClick={resume} style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "none", background: "#1a2a3a", color: "#fff", fontSize: 11, cursor: "pointer" }}>Resume</button>
                }
                <button onClick={stop} style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "1px solid #d0cbc3", background: "#fff", fontSize: 11, cursor: "pointer", color: "#c05030" }}>Stop</button>
              </div>
            </>
          )}

          {phase === "done" && (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a", marginBottom: 4 }}>Session complete</div>
              {note && <div style={{ fontSize: 11, color: "#888", fontStyle: "italic", marginBottom: 10 }}>"{note}"</div>}
              <button onClick={() => { setPhase("idle"); setNote(""); setRemaining(resolvedDuration()); }}
                style={{ padding: "7px 18px", borderRadius: 7, border: "none", background: "#1a2a3a", color: "#fff", fontSize: 11, cursor: "pointer" }}>
                New session
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
