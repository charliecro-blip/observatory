export interface ModulePrescription {
  headline: string;
  summary: string;
  primaryTask: string;
  secondaryTasks: string[];
  opportunities: string[];
  cautions: string[];
  qualityLabel: "excellent" | "good" | "moderate" | "low";
  vocWarning: boolean;
  alertBanner?: { text: string; color: string; bg: string };
}

export interface HourSlot {
  time: string;
  planet: string;
  task: string;
  taskLabel: string;
  note: string;
  quality: "peak" | "good" | "neutral" | "avoid";
  isCurrent: boolean;
}

export interface CalendarDay {
  date: string;
  label: string;
  dayName: string;
  role: string;
  roleLabel: string;
  color: string;
  qualityScore: number;
  voc: boolean;
  note: string;
  element: string;
  biodynamicType: string;
}

export interface PlanetTaskDef {
  task: string;
  label: string;
  note: string;
  quality: "peak" | "good" | "neutral" | "avoid";
}

export interface ModuleLogic {
  id: string;
  taskColors: Record<string, string>;
  taskLabels: Record<string, string>;
  planetTasks: Record<string, PlanetTaskDef>;
  buildPrescription: (now: any) => ModulePrescription;
  buildCalendarDay: (day: any) => { role: string; roleLabel: string; color: string; note: string };
}
