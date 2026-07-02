/**
 * Tide model — the composed astrological state, computed as independent axes.
 * See artifacts/tides/DESIGN.md for the full rationale.
 *
 *   Character = element (Deep/Surge/Building/Clear) — WHAT KIND of energy
 *   Energy    = 0..1, Moon-phase driven, element-NEUTRAL — HOW CHARGED
 *   Trend     = rising | steady | ebbing — waxing/waning + aspects + VOC→ebb
 *   Coherence = 0..1 — how ALIGNED the axes are → Confidence (NOT the level)
 *
 * Energy × Trend read as one curve: Low → Rising → High → Ebb → Low.
 * Coherence is a SEPARATE dial. This split is what kills the old fire-bias.
 */

export type TideCharacter = "deep" | "surge" | "building" | "clear";
export type TideTrend = "rising" | "steady" | "ebbing";
export type TideBand = "high" | "mid" | "low";
export type TideConfidence = "high" | "medium" | "low";

export const SIGN_TO_ELEMENT: Record<string, string> = {
  Aries: "fire", Leo: "fire", Sagittarius: "fire",
  Taurus: "earth", Virgo: "earth", Capricorn: "earth",
  Gemini: "air", Libra: "air", Aquarius: "air",
  Cancer: "water", Scorpio: "water", Pisces: "water",
};

export const PLANET_TO_ELEMENT: Record<string, string> = {
  Sun: "fire", Mars: "fire", Jupiter: "fire",
  Saturn: "earth", Venus: "earth",
  Mercury: "air", Uranus: "air",
  Moon: "water", Neptune: "water", Pluto: "water",
};

const ELEMENT_TO_CHARACTER: Record<string, TideCharacter> = {
  water: "deep", fire: "surge", earth: "building", air: "clear",
};

const CHARACTER_LABEL: Record<TideCharacter, string> = {
  deep: "Deep", surge: "Surge", building: "Building", clear: "Clear",
};

const WAXING_PHASES = new Set(["New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous"]);
const WANING_PHASES = new Set(["Waning Gibbous", "Last Quarter", "Waning Crescent"]);

export interface TideAspectLite {
  nature: string;      // "flowing" | "supportive" | "challenging" | "intensifying"
  applying: boolean;
  orb: number;
}

export interface TideInput {
  moonSign: string;
  illumination: number;   // moonPhase fraction 0..1 (Full ≈ 1, New ≈ 0)
  phaseName: string;
  voc: boolean;
  moonAspects: TideAspectLite[];
  angularCount: number;   // planets on an angle (activity)
  hourElement: string;    // element of the current planetary-hour ruler
  personalHardTransit?: boolean;
}

export interface TideState {
  character: TideCharacter;
  characterLabel: string;  // "Deep"
  element: string;         // "water"
  energy: number;          // 0..1
  band: TideBand;          // high | mid | low
  trend: TideTrend;
  level: string;           // curve point: "low" | "rising" | "tide" | "high" | "ebb"
  levelLabel: string;      // "High, ebbing"
  coherence: number;       // 0..1
  confidence: TideConfidence;
  headline: string;        // "Deep Tide"
  qualityScore: number;    // derived 0..7 (legacy / "why" view)
  personal: boolean;       // a hard personal transit is active
}

function clamp(n: number, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, n)); }

export function computeTide(input: TideInput): TideState {
  const element = SIGN_TO_ELEMENT[input.moonSign] ?? "water";
  const character = ELEMENT_TO_CHARACTER[element] ?? "deep";

  // ── Energy (element-neutral): illumination dominates, activity adds ──────────
  let energy = input.illumination;
  energy += Math.min(0.15, input.angularCount * 0.05);
  const tight = input.moonAspects.filter(a => a.orb <= 3).length;
  energy += Math.min(0.10, tight * 0.05);
  energy = clamp(energy);
  const band: TideBand = energy >= 0.72 ? "high" : energy <= 0.28 ? "low" : "mid";

  // ── Trend: waxing/waning + applying softness − hard/separating − VOC ─────────
  let trendScore = 0;
  if (WAXING_PHASES.has(input.phaseName)) trendScore += 1;
  if (WANING_PHASES.has(input.phaseName)) trendScore -= 1;
  // Full Moon is the crest — energy peaks and tips into release.
  if (input.phaseName === "Full Moon") trendScore -= 1;
  for (const a of input.moonAspects) {
    const soft = a.nature === "flowing" || a.nature === "supportive";
    const hard = a.nature === "challenging";
    if (a.applying && soft) trendScore += 0.5;
    else if (a.applying && hard) trendScore -= 0.5;
    else if (!a.applying) trendScore -= 0.25; // separating = releasing
  }
  if (input.voc) trendScore -= 1; // VOC bends toward Ebb — never floors energy
  // A phase peak dominates aspect noise: the Full Moon can't read "rising" (it's
  // the crest), and the New Moon can't read "ebbing" (it's the trough).
  if (input.phaseName === "Full Moon") trendScore = Math.min(trendScore, 0);
  if (input.phaseName === "New Moon") trendScore = Math.max(trendScore, 0);
  const trend: TideTrend = trendScore > 0.4 ? "rising" : trendScore < -0.4 ? "ebbing" : "steady";

  // ── Level curve point (Energy band × Trend) ─────────────────────────────────
  let level: string;
  if (band === "high") level = "high";
  else if (band === "low") level = "low";
  else level = trend === "rising" ? "rising" : trend === "ebbing" ? "ebb" : "tide";

  // Human phrase — the Full-Moon-VOC case reads "High, ebbing"
  let levelLabel: string;
  if (band === "high") {
    levelLabel = trend === "ebbing" ? "High, ebbing" : trend === "rising" ? "High, still rising" : "High";
  } else if (band === "low") {
    levelLabel = trend === "rising" ? "Low, rising" : "Low";
  } else {
    levelLabel = trend === "rising" ? "Rising" : trend === "ebbing" ? "Ebbing" : "Steady";
  }

  // ── Coherence → Confidence (separate from energy) ───────────────────────────
  let coherence = 0.6;
  if (input.hourElement === element) coherence += 0.2;
  const hard = input.moonAspects.filter(a => a.nature === "challenging").length;
  const soft = input.moonAspects.filter(a => a.nature === "flowing" || a.nature === "supportive").length;
  if (hard > 0 && soft > 0) coherence -= 0.2;        // mixed signals
  else if (soft > 0 && hard === 0) coherence += 0.1; // clean & supportive
  if (input.voc) coherence -= 0.15;                  // ambiguous / between statements
  coherence = clamp(coherence);
  const confidence: TideConfidence = coherence >= 0.72 ? "high" : coherence <= 0.45 ? "low" : "medium";

  // ── Derived legacy 0..7 quality (for the "why" view; NOT the headline) ───────
  const qualityScore = Math.round(energy * 4 + coherence * 3);

  return {
    character,
    characterLabel: CHARACTER_LABEL[character],
    element,
    energy: parseFloat(energy.toFixed(2)),
    band,
    trend,
    level,
    levelLabel,
    coherence: parseFloat(coherence.toFixed(2)),
    confidence,
    headline: `${CHARACTER_LABEL[character]} Tide`,
    qualityScore,
    personal: !!input.personalHardTransit,
  };
}
