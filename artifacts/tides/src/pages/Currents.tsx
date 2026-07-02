import React, { useState } from "react";
import { useCurrents } from "@/hooks/useTides";
import { HOUSE_MEANINGS, PLANET_MODES, PROFECTION_GUIDANCE, composePlacement } from "@/lib/currents-content";
import { PremiumGate } from "@/components/PremiumGate";
import { CautionQuestionnaireModal } from "@/components/CautionQuestionnaire";
import { useTester } from "@/contexts/tester-context";
import { CAUTION_PLANET_ARCHETYPE } from "@/lib/tester-profile";

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
  const { profile } = useTester();
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const cautionPlanets = profile?.cautionPlanets;

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

        {/* Caution Periods — self-reported planetary sensitivity, not a silent
            natal-chart verdict. Any planet can be a personal trigger; the chart
            only pre-suggests likely answers in the questionnaire. */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", color: "#a89a88" }}>
              Caution periods · your sensitivity
            </div>
            {cautionPlanets && cautionPlanets.length > 0 && (
              <button onClick={() => setShowQuestionnaire(true)} style={{ fontSize: 9.5, color: "#999", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                Edit
              </button>
            )}
          </div>
          {cautionPlanets && cautionPlanets.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {cautionPlanets.map((p) => {
                const arch = CAUTION_PLANET_ARCHETYPE[p];
                return (
                  <div key={p} style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 16 }}>{PLANET_GLYPH[p]}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)" }}>{p} <span style={{ color: "#999", fontWeight: 400 }}>· {arch?.label}</span></div>
                      <div style={{ fontSize: 10, color: "#999", marginTop: 1 }}>{arch?.feel}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 11.5, color: "#888", lineHeight: 1.6, marginBottom: 10 }}>
                Which planetary archetypes tend to hit you hardest? Any planet can be a personal trigger — this is self-reported, not computed for you.
              </div>
              <button onClick={() => setShowQuestionnaire(true)} style={{ fontSize: 11.5, padding: "7px 16px", borderRadius: 9, border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-primary)", cursor: "pointer", fontWeight: 600 }}>
                Take the questionnaire
              </button>
            </div>
          )}
        </div>

        {showQuestionnaire && (
          <CautionQuestionnaireModal sensitivity={sensitivity} onClose={() => setShowQuestionnaire(false)} />
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
            Flagged when it matches the planets the user self-reported above —
            computed client-side, since the self-report lives in the tester
            profile, not on the server. */}
        {cautionWindows.length > 0 && (() => {
          const withMatch = cautionWindows.map((t) => ({ t, matches: !!cautionPlanets?.includes(t.transitPlanet) }));
          const ranked = cautionPlanets && cautionPlanets.length > 0
            ? [...withMatch.filter((x) => x.matches), ...withMatch.filter((x) => !x.matches)]
            : withMatch;
          return (
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", color: "#a89a88", marginBottom: 10 }}>
              Caution windows · active now
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ranked.map(({ t, matches }, i) => {
                const sevColor = SEVERITY_COLOR[t.severity] ?? "#999";
                const aspLower = (t.aspect ?? "").toLowerCase();
                const arch = CAUTION_PLANET_ARCHETYPE[t.transitPlanet as keyof typeof CAUTION_PLANET_ARCHETYPE];
                return (
                  <div key={i} style={{
                    background: matches ? "#a0404008" : "var(--color-card)",
                    border: matches ? "1px solid #a0404040" : "1px solid var(--color-border)",
                    borderLeft: matches ? "3px solid #a04040" : "1px solid var(--color-border)",
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
                        {matches && (
                          <div style={{ fontSize: 8, color: "#a04040", fontWeight: 600 }}>your caution planet</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          );
        })()}

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
