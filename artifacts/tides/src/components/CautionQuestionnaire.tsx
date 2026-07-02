import React, { useState } from "react";
import { useTester } from "@/contexts/tester-context";
import { CAUTION_PLANETS, CAUTION_PLANET_ARCHETYPE, type CautionPlanet } from "@/lib/tester-profile";

const PLANET_GLYPH: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
  Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇",
};

/**
 * The Caution Periods self-report. Any planet can be a personal trigger, so
 * this isn't computed silently from the natal chart — the user picks. The
 * chart-derived score (`sensitivity`, from /api/currents) is used only to
 * pre-suggest likely answers ("your chart suggests" hint), never to decide
 * for them.
 */
export function CautionQuestionnaireModal({ sensitivity, onClose }: {
  sensitivity?: { planet: string; score: number }[];
  onClose: () => void;
}) {
  const { profile, updateCautionPlanets } = useTester();
  const suggested = new Set((sensitivity ?? []).filter((s) => s.score >= 3).map((s) => s.planet));
  const [picked, setPicked] = useState<Set<CautionPlanet>>(
    () => new Set(profile?.cautionPlanets ?? (sensitivity ? [...suggested] as CautionPlanet[] : [])),
  );

  function toggle(p: CautionPlanet) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  }

  function save() {
    updateCautionPlanets([...picked]);
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,16,12,0.45)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 16, padding: "26px 24px", maxWidth: 460, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--color-primary)", marginBottom: 5 }}>Which of these tend to be hard for you?</div>
        <div style={{ fontSize: 11.5, color: "#888", lineHeight: 1.6, marginBottom: 16 }}>
          Any planet can be a personal trigger — pick whichever resonate. This shapes which upcoming windows get flagged as a caution for you specifically.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 18 }}>
          {CAUTION_PLANETS.map((p) => {
            const arch = CAUTION_PLANET_ARCHETYPE[p];
            const isPicked = picked.has(p);
            const isSuggested = suggested.has(p);
            return (
              <button key={p} type="button" onClick={() => toggle(p)} style={{
                display: "flex", alignItems: "flex-start", gap: 10, textAlign: "left", cursor: "pointer",
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
          })}
        </div>
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
