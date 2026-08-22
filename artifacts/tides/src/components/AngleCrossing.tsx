/**
 * A PLANET CROSSING A LOCAL ANGLE — the app's shortest-lived fact.
 *
 * An angle sweeps the ecliptic at about 14°/hr (the ~15°/hr diurnal rate less
 * the Moon's own ~0.5°/hr drift), so a 3° orb is roughly thirteen minutes
 * either side of exact. It is the one thing in Compass that is genuinely
 * about the next twenty minutes, which is why the owner asked for it at the
 * top of the page when it is live.
 *
 * IT LIVED ONLY ON TODAY, the page nobody has landed on since 2026-08-04. The
 * 2026-08-19 audit said moving it would cost an unconditional 14-day fetch on
 * Home, because the week payload was the only place the client read crossings
 * from. Measuring settled it the other way: /tides/week runs ~900ms, while the
 * same scan over a 2-hour window is ~8ms warm, so `/tides/now` carries it and
 * Home pays nothing — it already fetches that payload.
 *
 * ONE COMPONENT, TWO SURFACES. Home shows it because that is where people
 * land; Today shows it because that is the page for reading the sky. Same
 * code, same copy, same data, so the two cannot drift into two voices about
 * one fact — which is exactly what happened to the void Moon.
 *
 * Sky vocabulary end to end, so both callers gate it on the lens.
 */

import { PLANET_COLORS } from "@/lib/planetColors";
import { PLANET_GLYPH } from "@/lib/glyphs";

const SIGNIFICATION: Record<string, string> = {
  Moon: "nourishment · care · small tasks · environment",
  Mars: "action · ignition · assertion · exertion",
  Saturn: "slowing · focusing · consolidation · rest",
  Venus: "beauty · pleasure · connection · relationship",
  Jupiter: "expansion · abundance · generosity · vision",
  Sun: "visibility · leadership · vitality · clarity",
  Mercury: "communication · ideas · movement · craft",
};

/** What the ~20 minutes is actually good for. Conditions, never a promise. */
const ACTIVITY: Record<string, string> = {
  Mars: "a hard workout or a decisive push",
  Venus: "a date, a connection, or making something beautiful",
  Mercury: "writing, calls, errands, a quick pitch",
  Sun: "being seen — present, lead, put yourself forward",
  Jupiter: "the big ask, teaching, or reaching wider",
  Saturn: "focused, structural work — the unglamorous right thing",
  Moon: "rest, home, food, tending someone",
};

export interface Crossing {
  planet: string;
  angle: string;
  /** ISO instant of exactness, read in the viewer's own timezone. */
  at: string;
  benefic?: boolean;
  malefic?: boolean;
}

/** ≈14°/hr, so a 3° orb is ≈12.9 minutes. */
const DEG_PER_MIN = 14 / 60;
const ORB_DEG = 3;
export const WINDOW_MIN = ORB_DEG / DEG_PER_MIN;

/**
 * The crossings that are live at `now`, nearest to exact first.
 *
 * Exported and pure: "is this crossing active" is a claim with real
 * arithmetic behind it, and it decided nothing testable while it lived inside
 * a render tree. ALL of them, not the nearest one — a second simultaneous
 * crossing (Jupiter AND Saturn at an angle) used to be silently concealed
 * behind the first.
 */
export function activeCrossings(crossings: Crossing[] | undefined, now: Date = new Date()) {
  return (crossings ?? [])
    .map(c => {
      const t = Date.parse(c.at);
      if (Number.isNaN(t)) return null;
      const diff = (t - now.getTime()) / 60000;   // minutes; negative = past
      return { c, diff, orbDeg: Math.abs(diff) * DEG_PER_MIN };
    })
    .filter((x): x is { c: Crossing; diff: number; orbDeg: number } =>
      x !== null && Math.abs(x.diff) <= WINDOW_MIN)
    .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff));
}

export default function AngleCrossing({ crossings, enabled = true }: {
  crossings?: Crossing[];
  /** The `todayShowCrossings` preference, and the lens. */
  enabled?: boolean;
}) {
  if (!enabled) return null;
  const active = activeCrossings(crossings);
  if (!active.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
      {active.map(({ c, diff, orbDeg }, i) => {
        const col = PLANET_COLORS[c.planet] ?? PLANET_COLORS.Sun;
        const sig = SIGNIFICATION[c.planet];
        const rising = !!c.benefic || ["Venus", "Jupiter", "Sun"].includes(c.planet);
        const when = Math.abs(diff) < 2 ? "peaking now"
          : diff < 0 ? `exact ${Math.round(-diff)}m ago · ${orbDeg.toFixed(1)}° orb`
          : `exact in ${Math.round(diff)}m · ${orbDeg.toFixed(1)}° orb`;
        const clock = new Date(c.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        return (
          <div key={`${c.planet}-${c.angle}-${i}`} style={{
            background: `${col}14`, border: `1px solid ${col}55`, borderLeft: `3px solid ${col}`,
            borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
          }}>
            <span className="phrase-in" style={{ fontSize: 16, flexShrink: 0 }}><span aria-hidden="true">{PLANET_GLYPH[c.planet] ?? "⚡"}</span></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: col }}>
                {c.planet} crosses {c.angle} · active now
              </div>
              <div style={{ fontSize: 10, color: "var(--color-muted)", marginTop: 2 }}>
                {clock} · {when}{sig ? ` — ${sig}` : ""}
              </div>
              {ACTIVITY[c.planet] && (
                <div style={{ fontSize: 10, color: col, marginTop: 3, fontWeight: 500 }}>
                  ◷ A ~20-min window for {ACTIVITY[c.planet]}.
                </div>
              )}
            </div>
            <div style={{ fontSize: 8, background: `${col}22`, color: col, padding: "2px 7px", borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>
              ● {rising ? "↑" : ""} {c.angle}
            </div>
          </div>
        );
      })}
    </div>
  );
}
