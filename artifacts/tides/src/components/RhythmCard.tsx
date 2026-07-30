import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTester } from "@/contexts/tester-context";

// Your rhythm today — the body's cycles read against the sky's. The app's
// foundational move: chronotype mirrors the solar day, the menstrual cycle
// mirrors the lunar month, seasonal energy mirrors the solar year. This card
// surfaces where YOUR rhythms sit against the sky's, and when they're in phase.

type Dir = "building" | "releasing" | "peak" | "low";

// Moon phase name → where the lunar month is (building vs releasing).
function lunarDir(phase: string): { dir: Dir; label: string } {
  const p = (phase ?? "").toLowerCase();
  if (p.includes("new")) return { dir: "low", label: "new moon — the reset" };
  if (p.includes("full")) return { dir: "peak", label: "full moon — the peak" };
  if (p.includes("waxing")) return { dir: "building", label: "waxing — building" };
  return { dir: "releasing", label: "waning — releasing" };
}

// Cycle day → phase + direction. Follicular builds, luteal releases.
function cyclePhase(startDate: string, cycleLength: number, lutealLength: number): { name: string; dir: Dir; day: number } | null {
  const start = Date.parse(startDate + "T12:00:00");
  if (!Number.isFinite(start)) return null;
  const day = Math.floor((Date.now() - start) / 86400000) % cycleLength;
  const d = ((day % cycleLength) + cycleLength) % cycleLength;
  const ovulation = cycleLength - lutealLength;
  if (d <= 4) return { name: "menstrual", dir: "low", day: d + 1 };
  if (d < ovulation - 1) return { name: "follicular", dir: "building", day: d + 1 };
  if (d <= ovulation + 1) return { name: "ovulation", dir: "peak", day: d + 1 };
  return { name: "luteal", dir: "releasing", day: d + 1 };
}

// Solar-year phase → the yearly energy wave.
function solarDir(phase: string): { dir: Dir; label: string } {
  if (phase === "high light") return { dir: "peak", label: "high light — the year's crest" };
  if (phase === "deep dark") return { dir: "low", label: "deep dark — the year's trough" };
  if (phase === "light growing") return { dir: "building", label: "light growing — days lengthening" };
  return { dir: "releasing", label: "light waning — days shortening" };
}

const DIR_COLOR: Record<Dir, string> = { building: "#4a8060", peak: "#c8971e", releasing: "#7a6cae", low: "#5a6b8c" };

function couplingRead(a: Dir, b: Dir): string {
  if (a === b) return a === "low" ? "Both at their trough — a genuine rest window, on both clocks."
    : a === "peak" ? "Both cresting — your fullest window; use it."
    : a === "building" ? "Both building — momentum with the current, not against it."
    : "Both winding down — let things complete rather than starting.";
  if ((a === "peak" && b === "low") || (a === "low" && b === "peak")) return "Out of phase — one clock says go, the other says rest. Trust your body over the sky.";
  return "Slightly out of phase — your body and the sky are on different beats today; follow your body.";
}

export default function RhythmCard({ now }: { now: any }) {
  const { profile } = useTester();
  const testerId = profile?.testerId ?? null;
  const chrono = profile?.chronotype;

  const { data: cycle } = useQuery<any>({
    queryKey: ["cycle", testerId],
    queryFn: async () => {
      const r = await fetch("/api/cycle", { headers: testerId ? { "x-tester-id": testerId } : {} });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 1000 * 60 * 60,
  });

  const lunar = lunarDir(now?.moonPhase ?? "");
  const solar = solarDir(now?.daylight?.phase ?? "");
  const cyc = cycle?.cycleStartDate ? cyclePhase(cycle.cycleStartDate, cycle.cycleLength ?? 28, cycle.lutealLength ?? 14) : null;

  // Nothing to say if we have no sky data at all.
  if (!now?.moonPhase && !now?.daylight) return null;

  const Row = ({ sky, skyDir, body, bodyDir, read }: { sky: string; skyDir: Dir; body?: string; bodyDir?: Dir; read?: string }) => (
    <div style={{ padding: "9px 0", borderTop: "1px solid var(--color-border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, color: "var(--color-foreground)" }}>
          <span style={{ color: DIR_COLOR[skyDir], fontWeight: 600 }}>Sky</span> · {sky}
        </span>
        {body && bodyDir && (
          <>
            <span style={{ color: "var(--text-3)" }}>×</span>
            <span style={{ fontSize: 11.5, color: "var(--color-foreground)" }}>
              <span style={{ color: DIR_COLOR[bodyDir], fontWeight: 600 }}>You</span> · {body}
            </span>
          </>
        )}
      </div>
      {read && <div style={{ fontSize: 10.5, color: "var(--color-muted)", marginTop: 3, lineHeight: 1.5 }}>{read}</div>}
    </div>
  );

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "12px 16px 4px", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>Your rhythm today</span>
        <span style={{ fontSize: 9.5, color: "var(--text-3)" }}>your cycles, against the sky's</span>
      </div>

      {/* Lunar month ↔ menstrual cycle */}
      <Row
        sky={`☽ ${lunar.label}`} skyDir={lunar.dir}
        body={cyc ? `${cyc.name} phase · day ${cyc.day}` : undefined}
        bodyDir={cyc?.dir}
        read={cyc ? couplingRead(lunar.dir, cyc.dir) : "Track your cycle in Settings to see it beside the moon."}
      />

      {/* Solar year ↔ chronotype/season */}
      <Row
        sky={`☀ ${solar.label}`} skyDir={solar.dir}
        body={chrono?.wakeTime ? `awake ${chrono.wakeTime}–${chrono.sleepTime ?? ""}${chrono.description ? ` · ${chrono.description}` : ""}` : undefined}
        bodyDir={chrono ? "building" : undefined}
        read={
          solar.dir === "peak" ? "Your yearly energy crest — the light is on your side; spend it."
          : solar.dir === "low" ? "The year's dark trough — lower output is the season, not a failing."
          : undefined
        }
      />
    </div>
  );
}
