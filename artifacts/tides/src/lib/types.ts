export interface SkyAspect {
  planet1: string; planet2: string; aspect: string; nature: string; orb: number; applying: boolean;
  hoursToExact?: number | null;
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
  biodynamicType: string;
  elementEmphasis?: string;
  planetaryHour: { planet: string; began: string; ends: string; quality: string; archetype?: string };
  upcomingHours: { planet: string; time: string }[];
  voc?: { isVOC: boolean; lastAspect?: string; nextIngress?: string };
  qualityScore?: number;
  personalTransits?: PersonalTransit[];
  moonAspects?: SkyAspect[];
  aspects?: SkyAspect[];
  retrogrades?: string[];
  rhythmRisk?: boolean;
  rhythmRiskFactors?: string[];
  tide?: TideState;
  dayArc?: DayArc;
}

export interface DayArcEvent {
  time: string; clock: string; kind: "ingress" | "aspect";
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
  biodynamicType: string;
  voidPeriods?: boolean;
  crossings?: Crossing[];
}

export interface SkyEvent {
  date: string;
  time?: string;
  type: "moon_phase" | "ingress" | "voc" | "crossing" | "quality_window" | "moon_aspect";
  title: string;
  subtitle?: string;
  icon: string;
  quality: "favorable" | "caution" | "neutral";
}

export interface Crossing {
  planet: string;
  angle: string;
  time: string;
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
