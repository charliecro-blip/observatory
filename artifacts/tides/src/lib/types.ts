export interface SkyAspect {
  planet1: string; planet2: string; aspect: string; nature: string; orb: number; applying: boolean;
  hoursToExact?: number | null;
  hoursSinceExact?: number | null;
  /** A station turns the pair around before the aspect perfects (no exact time exists). */
  stationsBeforeExact?: boolean;
  /** Separating, but the aspect never actually perfected — approached, stationed, retreated. */
  neverPerfected?: boolean;
}

export type TideCharacter = "deep" | "surge" | "building" | "clear";
export type TideTrend = "rising" | "steady" | "ebbing";

export interface TideState {
  character: TideCharacter;
  characterLabel: string;
  element: string;
  energy: number;        // 0..1
  band: "high" | "mid" | "low";
  trend: TideTrend;
  level: "low" | "rising" | "tide" | "high" | "ebb";
  levelLabel: string;    // "High, ebbing"
  coherence: number;     // 0..1
  confidence: "high" | "medium" | "low";
  headline: string;      // "Deep Tide"
  qualityScore: number;
  personal: boolean;
}

export interface TidesNow {
  timestamp: string;
  dayRuler: string;
  momentLabel: string;
  quality: string;
  element: { element: string; moonSign: string };
  moonPhase: string;
  moonIllumination: number;
  moonSign: string;
  /** Where the Moon is in its month — elongation/360, the canonical definition.
   *  Cannot be recovered from illumination alone (50% lit is both first and
   *  last quarter), which is why the hero reads the angle rather than the
   *  brightness. Replaced a decorative sine wave with a five-way marker. */
  moonCycle?: {
    position: number;
    elongationDeg: number;
    waxing: boolean;
    phase: string;
    approach: string;
    /** Local dates of the lunation boundaries — the same ones the ledger
     *  stamps intentions with, so no surface has to keep its own copy. */
    cycleStart?: string;
    prevCycleStart?: string;
    nextCycleStart?: string;
  };
  elementEmphasis?: string;
  planetaryHour: { planet: string; began: string; ends: string; quality: string; archetype?: string };
  upcomingHours: { planet: string; time: string }[];
  /** Angle crossings within ~2 hours — the client decides which are live. */
  crossings?: { planet: string; angle: string; at: string; benefic?: boolean; malefic?: boolean }[];
  voc?: {
    isVOC: boolean; lastAspect?: string; nextIngress?: string;
    /** What the void governs — stated so results below need no disclaimer. */
    scope?: string | null;
    /** Sign-specific reading; `benign` marks Lilly's four exempt signs. */
    /** `provenance` is present only where the tradition has something to cite
     *  — Lilly's four exempt signs, plus the Moon's fall and detriment. */
    reading?: { feel: string; instead: string; provenance?: string; benign: boolean } | null;
  };
  qualityScore?: number;
  personalTransits?: PersonalTransit[];
  moonAspects?: SkyAspect[];
  aspects?: SkyAspect[];
  retrogrades?: string[];
  /** Current position of every planet — the source for "in {sign}" wherever a planet is named. */
  planets?: {
    planet: string; sign: string; degree: number; retrograde: boolean;
    /** What this planet can and cannot do from the sign it is in. Null for
     *  points with no reading (the Nodes); `generational` for the outers. */
    reading?: { does: string; misses: string; dignity: string | null; generational: boolean } | null;
  }[];
  rhythmRisk?: boolean;
  rhythmRiskFactors?: string[];
  tide?: TideState;
  dayArc?: DayArc;
  /** The synthesis engine's woven reading (flavour/foci/watch/counterpoint/
   *  patterns/testimonies) — client gates depth by astro-detail level. */
  reading?: import("@/components/WovenReading").DayReadingData;
}

export interface DayArcEvent {
  time: string; clock: string; kind: "ingress" | "aspect" | "crossing";
  label: string; planet?: string; aspect?: string; past?: boolean;
}
export interface DayArcSegment {
  start: string; end: string; sign: string;
  character: string; characterLabel: string; voc: boolean;
}
export interface DayArcCurvePoint { t: string; hour: number; e: number; character: string; }
export interface DayArc {
  dayStart: string; dayEnd: string;
  segments: DayArcSegment[];
  events: DayArcEvent[];
  vocWindows: { start: string; end: string }[];
  curve?: DayArcCurvePoint[];
  curves?: Record<string, DayArcCurvePoint[]>;
  lenses?: { key: string; label: string }[];
  height?: number;
  heightFactors?: { phase: number; activation: number; season: number; standing: number };
}

export interface PersonalTransit {
  transitPlanet: string;
  aspect: string;
  natalPlanet: string;
  natalSign: string;
  natalHouse?: number;
  orb: number;
  exact: boolean;
  severity: string;
  summary: string;
}

export interface TidesWeek {
  days: WeekDay[];
  weekOf?: string;
  weekTone?: string;
  weekElement?: string;
}

export interface WeekDay {
  date: string;
  label: string;
  dayRuler: string;
  quality: string;
  qualityScore: number;
  element: string;
  moonSign: string;
  moonPhase: string;
  voidPeriods?: boolean;
  crossings?: Crossing[];
  moonAspects?: { planet: string; aspect: string; applying: boolean; orb: number }[];
  tide?: { character: string; element: string; energy: number; levelLabel: string };
  /** How full the Moon is — the ONE quantity a tide-shaped bar can honestly
   *  depict. The bar height is this and nothing else; aspect activity gets its
   *  own lane rather than being folded in. */
  moonFraction?: number;
  /** The lunar cycle as an instruction, not an amount: initiate · build ·
   *  refine · consolidate · release · recover. */
  approach?: string;
  /** Tight non-lunar configurations shaping the day. */
  weather?: { label: string; planets: [string, string]; aspect: string; orb: number; hard: boolean }[];
  /** 0..1 structural pressure from the hard non-lunar weather. */
  pressure?: number;
}

export interface SkyEvent {
  date: string;
  time?: string;
  at?: string;        // ISO UTC instant for timed events; date/time are localized from this in the client
  endAt?: string;     // ISO UTC end, for spans (the void) — clipped to local days by the reader
  type: "moon_phase" | "ingress" | "voc" | "crossing" | "quality_window" | "moon_aspect" | "aspect";
  title: string;
  subtitle?: string;
  icon: string;
  quality: "favorable" | "caution" | "neutral";
}

export interface Crossing {
  planet: string;
  angle: string;
  time: string;
  at?: string;        // ISO UTC instant; time is localized from this in the client
  type: string;
}

export interface ScoredPractice {
  id: number;
  name: string;
  description?: string;
  score: number;
  timing: "resonant" | "supported" | "neutral" | "soften" | "protect";
  reasons: string[];
}

export interface PlanningWindow {
  id: number;
  title: string;
  type: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

export interface Goal {
  id: number;
  title: string;
  description?: string;
  horizon: string;
  status: string;
}

export interface Task {
  id: number;
  title: string;
  done: boolean;
  bestWindow?: string;
  projectId?: number;
}
