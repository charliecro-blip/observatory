import React, { useState } from "react";
import { useTester } from "@/contexts/tester-context";
import { CAUTION_PLANETS, CAUTION_PLANET_ARCHETYPE, type CautionPlanet } from "@/lib/tester-profile";

const PLANET_GLYPH: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
  Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇",
};

// The three slow, powerful outer planets are the recommended starting set —
// they're what most people feel most distinctly, and keeping the list short
// keeps caution windows sparing rather than a wall of flags.
const STARTER: CautionPlanet[] = ["Uranus", "Neptune", "Pluto"];
const OTHERS = CAUTION_PLANETS.filter((p) => !STARTER.includes(p));
const MAX_PICKS = 3;

/**
 * The Caution Periods self-report. Any planet CAN be a personal trigger, but
 * the three outer planets are foregrounded and the whole thing is capped at
 * three — a caution window should be a rare, gentle heads-up, not a constant
 * state of alarm. The chart-derived score only pre-suggests, never decides.
 */
export function CautionQuestionnaireModal({ sensitivity, onClose }: {
  sensitivity?: { planet: string; score: number }[];
  onClose: () => void;
}) {
  const { profile, updateCautionPlanets } = useTester();
  const suggested = new Set((sensitivity ?? []).filter((s) => s.score >= 3).map((s) => s.planet));
  const [picked, setPicked] = useState<Set<CautionPlanet>>(
    () => new Set(profile?.cautionPlanets ?? []),
  );
  const [showOthers, setShowOthers] = useState(
    () => (profile?.cautionPlanets ?? []).some((p) => OTHERS.includes(p)),
  );

  const atCap = picked.size >= MAX_PICKS;

  function toggle(p: CautionPlanet) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else if (next.size < MAX_PICKS) next.add(p);
      return next;
    });
  }

  function save() {
    updateCautionPlanets([...picked]);
    onClose();
  }

  const renderPlanet = (p: CautionPlanet) => {
    const arch = CAUTION_PLANET_ARCHETYPE[p];
    const isPicked = picked.has(p);
    const isSuggested = suggested.has(p);
    const disabled = !isPicked && atCap;
    return (
      <button key={p} type="button" onClick={() => toggle(p)} disabled={disabled} style={{
        display: "flex", alignItems: "flex-start", gap: 10, textAlign: "left",
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1,
        padding: "9px 12px", borderRadius: 10,
        border: isPicked ? "1.5px solid #1a2a3a" : "1px solid var(--color-border)",
        background: isPicked ? "#1a2a3a10" : "var(--color-card-2)",
      }}>
        <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{PLANET_GLYPH[p]}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: isPicked ? "#1a2a3a" : "var(--color-foreground)" }}>
            {p} <span style={{ fontWeight: 400, color: "#999" }}>· {arch.label}</span>
            {isSuggested && <span style={{ fontSize: 8.5, color: "#a04040", marginLeft: 6, fontWeight: 600 }}>chart suggests this</span>}
          </div>
          <div style={{ fontSize: 10.5, color: "#999", marginTop: 2, lineHeight: 1.4 }}>{arch.feel}</div>
        </div>
        <span style={{ fontSize: 13, color: isPicked ? "#1a2a3a" : "#ccc", flexShrink: 0 }}>{isPicked ? "✓" : ""}</span>
      </button>
    );
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,16,12,0.45)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 16, padding: "26px 24px", maxWidth: 460, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--color-primary)", marginBottom: 5 }}>Which of these tend to be hard for you?</div>
        <div style={{ fontSize: 11.5, color: "#888", lineHeight: 1.6, marginBottom: 6 }}>
          Pick up to three. When the Sun or Moon touches one of these in your chart, you'll get a gentle heads-up for that short stretch — nothing more. Most people start with the three slow, powerful ones below.
        </div>
        <div style={{ fontSize: 10, color: "#a89a88", marginBottom: 14 }}>{picked.size}/{MAX_PICKS} chosen</div>

        <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.6px", color: "#a89a88", marginBottom: 7 }}>The three to start with</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
          {STARTER.map(renderPlanet)}
        </div>

        {!showOthers ? (
          <button onClick={() => setShowOthers(true)} style={{ fontSize: 10.5, color: "#8a8278", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", marginBottom: 16, padding: 0 }}>
            The others can be triggers too — show them
          </button>
        ) : (
          <>
            <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.6px", color: "#a89a88", marginBottom: 7 }}>The rest</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
              {OTHERS.map(renderPlanet)}
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "#888", fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
            Cancel
          </button>
          <button onClick={save} style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: "#1a2a3a", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
