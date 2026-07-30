import React, { useState } from "react";
import { useCurrents, useTransitForecast } from "@/hooks/useTides";
import { HOUSE_MEANINGS, PLANET_MODES, PROFECTION_GUIDANCE, composePlacement } from "@/lib/currents-content";
import { PremiumGate } from "@/components/PremiumGate";
import { CautionQuestionnaireModal } from "@/components/CautionQuestionnaire";
import { useTester } from "@/contexts/tester-context";
import { CAUTION_PLANET_ARCHETYPE } from "@/lib/tester-profile";
import TransitTake from "@/components/TransitTake";
import { PLANET_GLYPH } from "@/lib/glyphs";
import { PLANET_COLORS } from "@/lib/planetColors";


const ASPECT_SYM: Record<string, string> = {
  conjunction: "☌︎", opposition: "☍︎", square: "□", trine: "△", sextile: "⚹",
};

const SEVERITY_COLOR: Record<string, string> = {
  major: "#a04040", strong: "#c07020", moderate: PLANET_COLORS.Moon, mild: "#999",
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
  const [forecastDays, setForecastDays] = useState(30);
  const [profOpen, setProfOpen] = useState(false);
  const [expandedTransit, setExpandedTransit] = useState<string | null>(null);
  const { data: forecast } = useTransitForecast(testerId, forecastDays);
  const cautionPlanets = profile?.cautionPlanets;

  if (isLoading) {
    return <div style={{ padding: 40, color: "var(--text-3)", fontSize: 13 }}>Reading the long currents…</div>;
  }
  if (!data?.hasChart) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ maxWidth: 380, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🌊</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-primary)", marginBottom: 8 }}>The long currents are personal</div>
          <div style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.6 }}>
            Add your birth chart in Settings to see your profected year, your active
            outer-planet chapters, and how the slow planets are moving through your houses.
          </div>
        </div>
      </div>
    );
  }
  // Chart exists but the birth time is unknown — Currents is entirely house/
  // Ascendant-based, so it genuinely can't be computed. Say so honestly.
  if (data.timeKnown === false) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ maxWidth: 400, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🕰️</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-primary)", marginBottom: 8 }}>Currents needs your birth time</div>
          <div style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.6 }}>
            Your profected year, house chapters, and rising sign are all measured from
            the exact moment you were born — so they can't be worked out without a birth
            time. Your daily tide, Big Sky, and planet readings work fine without it.
            Add a time in Settings whenever you find it, and this unlocks.
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
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
            The slow water beneath the daily tide · {data.ascendant?.sign} rising · {houseSystem.replace("-", " ")} houses
          </div>
        </div>

        {/* Your season now — THREE equal readings, none subordinate: the profected
            year (annual frame), the sharpest slow aspects (what's landing), and
            Jupiter & Saturn by house (the two great time-keepers' chapters). */}
        {(() => {
          const topAspects = [...majorTransits]
            .sort((a, b) => {
              const hard = (t: any) => ["Conjunction", "Square", "Opposition"].includes(t.aspect) ? 0 : 1;
              return hard(a) - hard(b) || (a.orb ?? 9) - (b.orb ?? 9);
            })
            .slice(0, 3);
          const greatKeepers = transits.filter((t: any) => t.planet === "Jupiter" || t.planet === "Saturn");
          const cardStyle: React.CSSProperties = { background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "13px 15px", display: "flex", flexDirection: "column", gap: 5, minWidth: 0 };
          const labelStyle: React.CSSProperties = { fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-3)" };
          return (
            <div>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)", marginBottom: 10 }}>
                Your season now
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                {prof && (
                  <div style={{ ...cardStyle, cursor: "pointer" }} onClick={() => setProfOpen(v => !v)} title="The annual frame — click for what this year favors">
                    <div style={labelStyle}>Profected year · through {fmtDate(prof.yearEnd)}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-primary)" }}>{prof.house}th house · {profHouse?.title}</div>
                    <div style={{ fontSize: 11, color: "var(--color-muted)" }}>{PLANET_GLYPH[prof.timeLord]} ruled by {prof.timeLord} · this month: {prof.monthHouse}th ({HOUSE_MEANINGS[prof.monthHouse]?.title})</div>
                    {profOpen && <div style={{ fontSize: 11, color: "var(--color-muted)", lineHeight: 1.6 }}>{PROFECTION_GUIDANCE[prof.house]}</div>}
                    <div style={{ fontSize: 9, color: "var(--text-3)", marginTop: "auto" }}>{profOpen ? "▲ less" : "▼ what this year favors"}</div>
                  </div>
                )}
                <div style={cardStyle}>
                  <div style={labelStyle}>Slow aspects · landing now</div>
                  {topAspects.length ? topAspects.map((t: any, i: number) => (
                    <div key={i} style={{ fontSize: 11.5, color: "var(--color-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {PLANET_GLYPH[t.transitPlanet]} <span style={{ color: SEVERITY_COLOR[t.severity] ?? "var(--text-3)" }}>{ASPECT_SYM[(t.aspect ?? "").toLowerCase()] ?? "·"}</span> {PLANET_GLYPH[t.natalPlanet] ?? ""} {t.transitPlanet} {String(t.aspect).toLowerCase()} your {t.natalPlanet}
                    </div>
                  )) : <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>Quiet — no slow planet is on a natal point.</div>}
                  <div style={{ fontSize: 9, color: "var(--text-3)", marginTop: "auto" }}>details below ↓</div>
                </div>
                <div style={cardStyle}>
                  <div style={labelStyle}>Jupiter & Saturn · by house</div>
                  {greatKeepers.length ? greatKeepers.map((t: any, i: number) => (
                    <div key={i} style={{ fontSize: 11.5, color: "var(--color-foreground)" }}>
                      {PLANET_GLYPH[t.planet]} {t.planet} through your {t.house}th · {HOUSE_MEANINGS[t.house]?.title}
                      <div style={{ fontSize: 9.5, color: "var(--text-3)" }}>{t.planet === "Jupiter" ? "where growth wants to happen" : "where structure is being earned"}{t.leavesHouse ? ` · until ${fmtDate(t.leavesHouse)}` : ""}</div>
                    </div>
                  )) : <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>—</div>}
                </div>
              </div>
            </div>
          );
        })()}

        {showQuestionnaire && (
          <CautionQuestionnaireModal sensitivity={sensitivity} onClose={() => setShowQuestionnaire(false)} />
        )}

        {/* Major transits lead — the sharpest, most personally-felt layer of the
            long cycles (the actual aspects landing on natal points), with hard
            aspects first. House placements follow as the slower background. */}
        {majorTransits.length > 0 && (
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)", marginBottom: 10 }}>
              Major transits · aspects to your chart
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...majorTransits]
                .sort((a, b) => {
                  const hard = (t: any) => ["Conjunction", "Square", "Opposition"].includes(t.aspect) ? 0 : 1;
                  return hard(a) - hard(b) || (a.orb ?? 9) - (b.orb ?? 9);
                })
                .map((t, i) => {
                const sevColor = SEVERITY_COLOR[t.severity] ?? "#999";
                const aspLower = (t.aspect ?? "").toLowerCase();
                const key = `major-${t.transitPlanet}-${aspLower}-${t.natalPlanet}`;
                const isExp = expandedTransit === key;
                return (
                  <div key={i} style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden" }}>
                    <button onClick={() => setExpandedTransit(v => v === key ? null : key)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
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
                          <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 1 }}>{t.likelyDomains.join(" · ")}</div>
                        )}
                      </div>
                      <div style={{ fontSize: 9, color: sevColor, background: `${sevColor}15`, padding: "2px 7px", borderRadius: 4, fontWeight: 600, flexShrink: 0 }}>
                        {t.exact ? "exact" : `${t.orb.toFixed(1)}°`}
                      </div>
                      <span style={{ fontSize: 9, color: isExp ? sevColor : "var(--text-3)", transform: isExp ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.15s", flexShrink: 0 }}>▾</span>
                    </button>
                    {isExp && <div style={{ padding: "0 14px 10px" }}><TransitTake t={t} accent={sevColor} /></div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* The weeks ahead — a dated forecast of transits landing on your chart */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)" }}>
              The weeks ahead · transits landing on your chart
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[30, 60].map((d) => (
                <button key={d} onClick={() => setForecastDays(d)} style={{
                  fontSize: 10, padding: "2px 9px", borderRadius: 6, cursor: "pointer",
                  border: forecastDays === d ? "1px solid #1a2a3a" : "1px solid var(--color-border)",
                  background: forecastDays === d ? "#1a2a3a10" : "var(--color-card)",
                  color: forecastDays === d ? "var(--color-foreground)" : "var(--text-3)", fontWeight: forecastDays === d ? 600 : 400,
                }}>{d}d</button>
              ))}
            </div>
          </div>
          {(forecast?.transits ?? []).length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-3)", padding: "8px 2px" }}>No notable transits perfect in the next {forecastDays} days — a quiet stretch.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(forecast?.transits ?? []).map((t: any, i: number) => {
                const sevColor = SEVERITY_COLOR[t.severity] ?? "#999";
                const aspLower = (t.aspect ?? "").toLowerCase();
                const peak = new Date(t.peakDate);
                const rel = t.dayOffset === 0 ? "today" : t.dayOffset === 1 ? "tomorrow" : `in ${t.dayOffset} days`;
                const key = `fc-${i}-${t.transitPlanet}-${aspLower}-${t.natalPlanet}`;
                const isExp = expandedTransit === key;
                return (
                  <div key={i} style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderLeft: `3px solid ${sevColor}`, borderRadius: 9, overflow: "hidden" }}>
                    <button onClick={() => setExpandedTransit(v => v === key ? null : key)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "9px 13px", display: "flex", alignItems: "center", gap: 11, textAlign: "left" }}>
                      <div style={{ flexShrink: 0, textAlign: "center", minWidth: 46 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)" }}>{peak.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                        <div style={{ fontSize: 8.5, color: "var(--text-3)" }}>{rel}</div>
                      </div>
                      <div style={{ fontSize: 15, flexShrink: 0, display: "flex", alignItems: "center", gap: 2 }}>
                        <span>{PLANET_GLYPH[t.transitPlanet]}</span>
                        <span style={{ color: sevColor, fontSize: 12 }}>{ASPECT_SYM[aspLower] ?? "·"}</span>
                        <span>{PLANET_GLYPH[t.natalPlanet] ?? t.natalPlanet[0]}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)" }}>
                          {t.transitPlanet} {aspLower} your natal {t.natalPlanet}
                          {t.natalPlanet !== "Ascendant" && t.natalHouse ? ` (${t.natalSign}, house ${t.natalHouse})` : t.natalPlanet !== "Ascendant" ? ` (${t.natalSign})` : ""}
                        </div>
                        {t.likelyDomains?.length > 0 && <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 1 }}>{t.likelyDomains.slice(0, 3).join(" · ")}</div>}
                      </div>
                      <div style={{ fontSize: 9, color: sevColor, background: `${sevColor}15`, padding: "2px 7px", borderRadius: 4, fontWeight: 600, flexShrink: 0 }}>{t.exact ? "exact" : `${t.orb}°`}</div>
                      <span style={{ fontSize: 9, color: isExp ? sevColor : "var(--text-3)", transform: isExp ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.15s", flexShrink: 0 }}>▾</span>
                    </button>
                    {isExp && <div style={{ padding: "0 13px 9px" }}><TransitTake t={t} accent={sevColor} /></div>}
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ fontSize: 9.5, color: "var(--text-3)", marginTop: 8, lineHeight: 1.5 }}>
            Dated to the day each aspect is tightest. Slow-planet transits (Saturn, Uranus, Neptune, Pluto) color a whole season; fast ones pass in days.
          </div>
        </div>

        {/* Active chapters — outer planets by house */}
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)", marginBottom: 10 }}>
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
                      <div style={{ fontSize: 10, color: "var(--text-3)" }}>
                        {PLANET_MODES[t.planet]?.mode} · {c.houseTitle} · {fmtDate(t.enteredHouse)} → {fmtDate(t.leavesHouse)}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6, marginBottom: 9 }}>{c.emphasis}</div>
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

        {/* Caution periods — demoted below the transits/chapters (it's a
            personal-calibration layer, not the page's headline) and given real
            explanation: what the questionnaire feeds, and what a "window" means. */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)" }}>
              Caution periods · your sensitivity
            </div>
            {cautionPlanets && cautionPlanets.length > 0 && (
              <button onClick={() => setShowQuestionnaire(true)} style={{ fontSize: 9.5, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                Edit
              </button>
            )}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--text-3)", lineHeight: 1.55, marginBottom: 8 }}>
            The planets you marked as personal triggers. When one of them makes a hard aspect to your
            chart, that stretch gets flagged — here, and as ⚠ marks on the Ahead calendar — so you can
            move big commitments carefully rather than be surprised by them.
          </div>
          {cautionPlanets && cautionPlanets.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {cautionPlanets.map((p) => {
                const arch = CAUTION_PLANET_ARCHETYPE[p];
                return (
                  <div key={p} style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 16 }}>{PLANET_GLYPH[p]}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)" }}>{p} <span style={{ color: "var(--text-3)", fontWeight: 400 }}>· {arch?.label}</span></div>
                      <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 1 }}>{arch?.feel}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.6, marginBottom: 10 }}>
                Which planetary archetypes tend to hit you hardest? Any planet can be a personal trigger — this is self-reported, not computed for you.
              </div>
              <button onClick={() => setShowQuestionnaire(true)} style={{ fontSize: 11.5, padding: "7px 16px", borderRadius: 9, border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-primary)", cursor: "pointer", fontWeight: 600 }}>
                Take the questionnaire
              </button>
            </div>
          )}
        </div>

        {/* Caution windows — currently-active HARD aspects from a heavy planet to
            a natal point (not trines/sextiles, which are supportive not cautionary).
            Flagged when it matches the planets the user self-reported above —
            computed client-side, since the self-report lives in the tester
            profile, not on the server. */}
        {cautionWindows.length > 0 && (() => {
          // Only show windows that match one of the user's flagged planets —
          // a fast body hitting a natal placement they didn't flag isn't a
          // caution for them, so don't surface it as one.
          const withMatch = cautionWindows
            .map((t) => ({ t, matches: !!cautionPlanets?.includes(t.cautionPlanet) }))
            .filter((x) => x.matches);
          if (withMatch.length === 0) return null;
          const ranked = withMatch;
          return (
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)", marginBottom: 10 }}>
              Advisories · active now
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ranked.map(({ t, matches }, i) => {
                const sevColor = "#a04040";
                const aspLower = (t.aspect ?? "").toLowerCase();
                const arch = CAUTION_PLANET_ARCHETYPE[t.cautionPlanet as keyof typeof CAUTION_PLANET_ARCHETYPE];
                return (
                  <div key={i} style={{
                    background: matches ? "#a0404008" : "var(--color-card)",
                    border: matches ? "1px solid #a0404040" : "1px solid var(--color-border)",
                    borderLeft: matches ? "3px solid #a04040" : "1px solid var(--color-border)",
                    borderRadius: 10, padding: "10px 14px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ fontSize: 15, flexShrink: 0, display: "flex", alignItems: "center", gap: 2 }}>
                        <span>{PLANET_GLYPH[t.triggerPlanet]}</span>
                        <span style={{ color: sevColor, fontSize: 12 }}>{ASPECT_SYM[aspLower] ?? "·"}</span>
                        <span>{PLANET_GLYPH[t.cautionPlanet] ?? t.cautionPlanet[0]}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)" }}>
                          {t.triggerPlanet} {aspLower} your {t.cautionPlanet}
                          {arch && <span style={{ color: "var(--text-3)", fontWeight: 400 }}> · {arch.label}</span>}
                        </div>
                        {arch && <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 1 }}>{arch.feel}</div>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                        <div style={{ fontSize: 9, color: sevColor, background: `${sevColor}15`, padding: "2px 7px", borderRadius: 4, fontWeight: 600 }}>
                          {t.exact ? "exact" : `${t.orb.toFixed(1)}°`}
                        </div>
                        <div style={{ fontSize: 8, color: "#a04040", fontWeight: 600 }}>passing window</div>
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
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)", marginBottom: 10 }}>
            Next chapter shifts
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...transits]
              .filter((t) => t.leavesHouse)
              .sort((a, b) => a.leavesHouse.localeCompare(b.leavesHouse))
              .map((t) => (
                <div key={t.planet} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5 }}>
                  <span style={{ width: 60, color: "var(--text-3)", flexShrink: 0 }}>{fmtDate(t.leavesHouse)}</span>
                  <span style={{ color: PLANET_MODES[t.planet]?.color }}>{PLANET_GLYPH[t.planet]}</span>
                  <span style={{ color: "var(--text-2)" }}>{t.planet} leaves your {t.house}th House → enters the {t.house === 12 ? 1 : t.house + 1}th</span>
                </div>
              ))}
          </div>
        </div>

      </div>
    </div>
  );
}
