import React from "react";
import { PLANET_CORE, composeEssence, composeGuidance, type AspectName } from "@/lib/sky-readings";
import { HOUSE_MEANINGS } from "@/lib/currents-content";

// The shared "what does this transit mean for me?" explainer — one component so
// a transit reads identically wherever it's clicked open (rail, Currents, the
// weeks-ahead forecast, the Aims long-weather band). Composed from the same
// language layer BigSky uses, plus the natal side: whose drive in your chart is
// being touched, and in which arena of life.

const ASPECT_NAMES = new Set(["conjunction", "sextile", "square", "trine", "opposition"]);

const ordinal = (n: number) => { const v = n % 100; const s = ["th", "st", "nd", "rd"]; return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`; };

export interface TransitLike {
  transitPlanet: string;
  transitSign?: string;
  natalPlanet: string;
  natalSign?: string;
  natalHouse?: number | null;
  aspect: string; // any case
  likelyDomains?: string[];
}

export default function TransitTake({ t, accent = "#8a7a50" }: { t: TransitLike; accent?: string }) {
  const aspect = String(t.aspect ?? "").toLowerCase();
  if (!ASPECT_NAMES.has(aspect)) return null;
  const a = { planet: t.transitPlanet, sign: t.transitSign ?? "" };
  const b = { planet: t.natalPlanet, sign: t.natalSign ?? "" };
  const essence = composeEssence(a, b, aspect as AspectName);
  const guidance = composeGuidance(a, b, aspect as AspectName);
  const natalCore = t.natalPlanet === "Ascendant"
    ? "your rising point — how you meet the world, the front door of the chart"
    : PLANET_CORE[t.natalPlanet]?.is;
  const house = t.natalHouse && t.natalHouse >= 1 ? t.natalHouse : null;
  const houseMeaning = house ? HOUSE_MEANINGS[house] : null;

  return (
    <div style={{ padding: "7px 10px 9px", fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.6, borderLeft: `2px solid ${accent}60`, background: `${accent}0a`, borderRadius: "0 0 6px 6px" }}>
      <div style={{ color: "var(--color-foreground)", marginBottom: 4 }}>{essence}</div>
      {natalCore && (
        <div style={{ marginBottom: 4 }}>
          <span style={{ color: "var(--text-3)" }}>in your chart</span> — your {t.natalPlanet} is {natalCore}
          {t.natalSign ? `, in ${t.natalSign}` : ""}{houseMeaning ? `, in your ${ordinal(house!)} house (${houseMeaning.title.toLowerCase()}: ${houseMeaning.domains})` : ""}.
        </div>
      )}
      <div><span style={{ color: "#7a8a5a", fontWeight: 600 }}>favors</span> {guidance.favors}</div>
      <div style={{ marginTop: 2 }}><span style={{ color: "#a07040", fontWeight: 600 }}>watch</span> {guidance.watch}</div>
      {(t.likelyDomains?.length ?? 0) > 0 && (
        <div style={{ marginTop: 4, color: "var(--text-3)" }}>often felt around {t.likelyDomains!.slice(0, 3).join(", ")}</div>
      )}
    </div>
  );
}
