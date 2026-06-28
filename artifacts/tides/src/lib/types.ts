export interface SkyAspect {
  planet1: string; planet2: string; aspect: string; nature: string; orb: number; applying: boolean;
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
  crossings?: Crossing[];
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
