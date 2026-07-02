import React from "react";
import { useCurrents } from "@/hooks/useTides";
import { HOUSE_MEANINGS, PLANET_MODES, PROFECTION_GUIDANCE, composePlacement } from "@/lib/currents-content";

const PLANET_GLYPH: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
  Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function houseSystemPref(): string {
  return localStorage.getItem("obs_house_system") ?? "whole-sign";
}

export default function Currents({ testerId }: { testerId: string | null }) {
  const houseSystem = houseSystemPref();
  const { data, isLoading } = useCurrents(testerId, houseSystem);

  if (isLoading) {
    return <div style={{ padding: 40, color: "#999", fontSize: 13 }}>Reading the long currents…</div>;
  }
  if (!data?.hasChart) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ maxWidth: 380, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🌊</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-primary)", marginBottom: 8 }}>The long currents are personal</div>
          <div style={{ fontSize: 12.5, color: "#777", lineHeight: 1.6 }}>
            Add your birth chart in Settings to see your profected year, your active
            outer-planet chapters, and how the slow planets are moving through your houses.
          </div>
        </div>
      </div>
    );
  }

  const prof = data.profection;
  const transits: any[] = data.transitsByHouse ?? [];
  const profHouse = HOUSE_MEANINGS[prof?.house];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Header */}
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "-0.4px" }}>Currents</div>
          <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
            The slow water beneath the daily tide · {data.ascendant?.sign} rising · {houseSystem.replace("-", " ")} houses
          </div>
        </div>

        {/* Profected year — the annual frame */}
        {prof && (
          <div style={{ background: "linear-gradient(135deg,#2a3a52,#3a4a68)", borderRadius: 14, padding: "18px 22px", color: "#fff" }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "1.2px", color: "rgba(255,255,255,0.55)", marginBottom: 6 }}>
              Your year · age {prof.age} · through {fmtDate(prof.yearEnd)}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 3 }}>
              {prof.house}th House year · {profHouse?.title}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.6, marginBottom: 12 }}>
              {PROFECTION_GUIDANCE[prof.house]}
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 11 }}>
              <div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px" }}>Ruler of the year</div>
                <div style={{ fontWeight: 600, marginTop: 2 }}>{PLANET_GLYPH[prof.timeLord]} {prof.timeLord} <span style={{ color: "rgba(255,255,255,0.6)", fontWeight: 400 }}>· watch its transits</span></div>
              </div>
              <div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px" }}>This month</div>
                <div style={{ fontWeight: 600, marginTop: 2 }}>{prof.monthHouse}th House · {HOUSE_MEANINGS[prof.monthHouse]?.title}</div>
              </div>
            </div>
          </div>
        )}

        {/* Active chapters — outer planets by house */}
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", color: "#a89a88", marginBottom: 10 }}>
            Active chapters · slow planets in your houses
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {transits.map((t) => {
              const c = composePlacement(t.planet, t.house);
              if (!c) return null;
              return (
                <div key={t.planet} style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: `${c.color}18`, color: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                      {PLANET_GLYPH[t.planet]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>
                        {t.planet} in your {t.house}th House {t.retrograde && <span style={{ color: "#a06040", fontSize: 10 }}>℞</span>}
                      </div>
                      <div style={{ fontSize: 10, color: "#999" }}>
                        {PLANET_MODES[t.planet]?.mode} · {c.houseTitle} · {fmtDate(t.enteredHouse)} → {fmtDate(t.leavesHouse)}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#4a4a4a", lineHeight: 1.6, marginBottom: 9 }}>{c.emphasis}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {c.practices.map((p, i) => (
                      <span key={i} style={{ fontSize: 10, color: c.color, background: `${c.color}12`, padding: "3px 9px", borderRadius: 10 }}>{p}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chapter timeline — when the next boundary lands */}
        <div style={{ background: "var(--color-card-2)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", color: "#a89a88", marginBottom: 10 }}>
            Next chapter shifts
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...transits]
              .filter((t) => t.leavesHouse)
              .sort((a, b) => a.leavesHouse.localeCompare(b.leavesHouse))
              .map((t) => (
                <div key={t.planet} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5 }}>
                  <span style={{ width: 60, color: "#999", flexShrink: 0 }}>{fmtDate(t.leavesHouse)}</span>
                  <span style={{ color: PLANET_MODES[t.planet]?.color }}>{PLANET_GLYPH[t.planet]}</span>
                  <span style={{ color: "#555" }}>{t.planet} leaves your {t.house}th House → enters the {t.house === 12 ? 1 : t.house + 1}th</span>
                </div>
              ))}
          </div>
        </div>

      </div>
    </div>
  );
}
