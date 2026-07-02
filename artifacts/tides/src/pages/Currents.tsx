import React from "react";
import { useCurrents } from "@/hooks/useTides";
import { HOUSE_MEANINGS, PLANET_MODES, PROFECTION_GUIDANCE, composePlacement } from "@/lib/currents-content";
import { PremiumGate } from "@/components/PremiumGate";

// Mirrors HEAVY_PLANET_ARCHETYPE in artifacts/api-server/src/lib/natal.ts — kept
// as a small local display map rather than sharing a type across the API
// boundary for one lookup table.
const HEAVY_PLANET_ARCHETYPE: Record<string, { label: string; feel: string }> = {
  Uranus:  { label: "Disruptive",     feel: "sudden shifts, things breaking from routine, feeling knocked off course" },
  Neptune: { label: "Hazy / diffuse", feel: "fog, low motivation, sleepiness, things feeling unclear or hard to pin down" },
  Saturn:  { label: "Heavy",          feel: "weight, restriction, anxiety, a sense of being tested or held back" },
  Pluto:   { label: "Intense",        feel: "high stakes, power struggles, things feeling scarier or more consequential than usual" },
  Jupiter: { label: "Excess",         feel: "overdoing it — overcommitting, overspending, overindulging" },
};

const PLANET_GLYPH: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
  Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇",
};

const ASPECT_SYM: Record<string, string> = {
  conjunction: "☌", opposition: "☍", square: "□", trine: "△", sextile: "⚹",
};

const SEVERITY_COLOR: Record<string, string> = {
  major: "#a04040", strong: "#c07020", moderate: "#7080a0", mild: "#999",
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
  return (
    <PremiumGate feature="currents">
      <CurrentsContent testerId={testerId} />
    </PremiumGate>
  );
}

function CurrentsContent({ testerId }: { testerId: string | null }) {
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
  const majorTransits: any[] = data.majorTransits ?? [];
  const sensitivity: any[] = data.sensitivity ?? [];
  const cautionWindows: any[] = data.cautionWindows ?? [];
  const profHouse = HOUSE_MEANINGS[prof?.house];
  const topSensitivityMax = sensitivity[0]?.score || 1;

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

        {/* Caution Periods — planetary sensitivity diagnosis. Which heavy planets
            tend to land hardest for this chart, computed from natal hard-aspects
            + angularity, not a generic reading. */}
        {sensitivity.length > 0 && (
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", color: "#a89a88", marginBottom: 4 }}>
              Caution periods · your sensitivity
            </div>
            <div style={{ fontSize: 11, color: "#999", marginBottom: 10, lineHeight: 1.5 }}>
              Which planetary archetypes tend to hit you hardest, based on your chart — not a generic transit reading.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sensitivity.map((s) => {
                const arch = HEAVY_PLANET_ARCHETYPE[s.planet];
                const pct = Math.max(4, Math.round((s.score / (topSensitivityMax || 1)) * 100));
                const isPrimary = s.score >= 3 && sensitivity.indexOf(s) < 2;
                return (
                  <div key={s.planet} style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: s.hits?.length ? 5 : 0 }}>
                      <span style={{ fontSize: 14 }}>{PLANET_GLYPH[s.planet]}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)" }}>{s.planet}</span>
                      <span style={{ fontSize: 10, color: "#999" }}>· {arch?.label}</span>
                      {isPrimary && <span style={{ fontSize: 8, background: "#a0404018", color: "#a04040", padding: "1px 6px", borderRadius: 4, fontWeight: 600, marginLeft: "auto" }}>PRIMARY</span>}
                    </div>
                    <div style={{ height: 3, background: "var(--color-background)", borderRadius: 2, overflow: "hidden", marginBottom: 5 }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "#a04040", opacity: 0.6, borderRadius: 2 }} />
                    </div>
                    {s.hits?.length > 0 ? (
                      <div style={{ fontSize: 10, color: "#888", lineHeight: 1.5 }}>
                        {s.hits.map((h: any, i: number) => `${h.aspect} your natal ${h.personalPoint} (${h.orb}°)`).join(" · ")}
                        {s.angular && " · angular"}
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, color: "#bbb" }}>No tight natal aspects — {arch?.feel}</div>
                    )}
                  </div>
                );
              })}
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

        {/* Major transits — the actual aspects the slow planets are making to natal
            points right now, not just which house they're passing through. */}
        {majorTransits.length > 0 && (
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", color: "#a89a88", marginBottom: 10 }}>
              Major transits · aspects to your chart
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {majorTransits.map((t, i) => {
                const sevColor = SEVERITY_COLOR[t.severity] ?? "#999";
                const aspLower = (t.aspect ?? "").toLowerCase();
                return (
                  <div key={i} style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 15, flexShrink: 0, display: "flex", alignItems: "center", gap: 2 }}>
                      <span>{PLANET_GLYPH[t.transitPlanet]}</span>
                      <span style={{ color: sevColor, fontSize: 12 }}>{ASPECT_SYM[aspLower] ?? "·"}</span>
                      <span>{PLANET_GLYPH[t.natalPlanet] ?? t.natalPlanet[0]}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)" }}>
                        {t.transitPlanet} {aspLower} your natal {t.natalPlanet}
                        {t.natalPlanet !== "Ascendant" && ` (${t.natalSign}, house ${t.natalHouse})`}
                      </div>
                      {t.likelyDomains?.length > 0 && (
                        <div style={{ fontSize: 10, color: "#999", marginTop: 1 }}>{t.likelyDomains.join(" · ")}</div>
                      )}
                    </div>
                    <div style={{ fontSize: 9, color: sevColor, background: `${sevColor}15`, padding: "2px 7px", borderRadius: 4, fontWeight: 600, flexShrink: 0 }}>
                      {t.exact ? "exact" : `${t.orb.toFixed(1)}°`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Caution windows — currently-active HARD aspects from a heavy planet to
            a natal point (not trines/sextiles, which are supportive not cautionary).
            Flagged when it matches the chart's own top sensitivity planets. */}
        {cautionWindows.length > 0 && (
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", color: "#a89a88", marginBottom: 10 }}>
              Caution windows · active now
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {cautionWindows.map((t, i) => {
                const sevColor = SEVERITY_COLOR[t.severity] ?? "#999";
                const aspLower = (t.aspect ?? "").toLowerCase();
                const arch = HEAVY_PLANET_ARCHETYPE[t.transitPlanet];
                return (
                  <div key={i} style={{
                    background: t.matchesSensitivity ? "#a0404008" : "var(--color-card)",
                    border: t.matchesSensitivity ? "1px solid #a0404040" : "1px solid var(--color-border)",
                    borderLeft: t.matchesSensitivity ? "3px solid #a04040" : "1px solid var(--color-border)",
                    borderRadius: 10, padding: "10px 14px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ fontSize: 15, flexShrink: 0, display: "flex", alignItems: "center", gap: 2 }}>
                        <span>{PLANET_GLYPH[t.transitPlanet]}</span>
                        <span style={{ color: sevColor, fontSize: 12 }}>{ASPECT_SYM[aspLower] ?? "·"}</span>
                        <span>{PLANET_GLYPH[t.natalPlanet] ?? t.natalPlanet[0]}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)" }}>
                          {t.transitPlanet} {aspLower} your natal {t.natalPlanet}
                          {arch && <span style={{ color: "#999", fontWeight: 400 }}> · {arch.label}</span>}
                        </div>
                        {arch && <div style={{ fontSize: 10, color: "#999", marginTop: 1 }}>{arch.feel}</div>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                        <div style={{ fontSize: 9, color: sevColor, background: `${sevColor}15`, padding: "2px 7px", borderRadius: 4, fontWeight: 600 }}>
                          {t.exact ? "exact" : `${t.orb.toFixed(1)}°`}
                        </div>
                        {t.matchesSensitivity && (
                          <div style={{ fontSize: 8, color: "#a04040", fontWeight: 600 }}>your caution planet</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
