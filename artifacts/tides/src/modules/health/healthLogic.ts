import type { ModuleLogic, PlanetTaskDef, ModulePrescription } from "../shared/types";

export const TASK_COLORS: Record<string, string> = {
  train:    "#c04040",
  vitalize: "#c08020",
  rest:     "#7080a0",
  discipline:"#607060",
  moderate: "#6040a0",
  care:     "#a06080",
  breathe:  "#4080a0",
};

export const TASK_LABELS: Record<string, string> = {
  train:     "Train hard",
  vitalize:  "Vitalize",
  rest:      "Rest & recover",
  discipline:"Discipline",
  moderate:  "Moderate",
  care:      "Self-care",
  breathe:   "Breathe & move",
};

const PLANET_TASKS: Record<string, PlanetTaskDef> = {
  Mars:    { task:"train",      label:"Train hard",    quality:"peak",    note:"Mars governs physical power and effort. The best hour for high-intensity training, athletic challenge, breaking personal records, and raw physical output." },
  Sun:     { task:"vitalize",   label:"Vitalize",      quality:"peak",    note:"The Sun brings life force and energy. Excellent for outdoor activity, light exposure, energizing movement, and anything that restores vitality." },
  Moon:    { task:"rest",       label:"Rest & recover",quality:"good",    note:"Moon hours govern the body's emotional and fluid systems. Prioritize sleep, hydration, gentle movement, and emotional wellness." },
  Saturn:  { task:"discipline", label:"Discipline",    quality:"good",    note:"Saturn demands consistency. Use this hour for maintaining strict routines, fasting windows, mobility work, and long-term habit reinforcement." },
  Jupiter: { task:"moderate",   label:"Moderate",      quality:"neutral", note:"Jupiter expands — watch for overindulgence in food, drink, or effort. Good for abundant nutrition; be mindful of excess." },
  Venus:   { task:"care",       label:"Self-care",     quality:"good",    note:"Venus rules pleasure and beauty. Excellent for self-care practices: massage, body care, skin routines, gentle yoga, and restorative stretching." },
  Mercury: { task:"breathe",    label:"Breathe & move",quality:"good",    note:"Mercury governs coordination and nervous system. Excellent for breathwork, yoga, coordination training, and mind-body practices." },
};

const BIO_NOTES: Record<string, { best: string; note: string }> = {
  fruit:  { best:"train",     note:"Fruit day: peak vitality. The body is at its most energized — excellent for training, performance, and physical challenges." },
  root:   { best:"discipline",note:"Root day: grounding and strength. Focus on strength work, earthy foods, and consistent foundational habits." },
  flower: { best:"care",      note:"Flower day: gentle and beautiful. Prioritize self-care, body care rituals, light movement, and restorative practices." },
  leaf:   { best:"rest",      note:"Leaf day: cleansing and hydrating. Support detox pathways with water, rest, lymphatic movement, and light fasting." },
};

const PHASE_ROLE: Record<string, { role: string; note: string }> = {
  "New Moon":            { role:"discipline", note:"New Moon: start new health habits and routines. Light movement; set intentions for the cycle." },
  "Waxing Crescent":     { role:"train",      note:"Building energy: begin new training blocks. Momentum supports progressive overload." },
  "First Quarter":       { role:"train",      note:"Decisive energy: push training intensity. Break through plateaus." },
  "Waxing Gibbous":      { role:"vitalize",   note:"High energy approaching peak. Continue building. Feed the body well." },
  "Full Moon":           { role:"train",      note:"Full Moon: peak physical energy. Excellent for peak performance and testing limits. Watch for emotional tension." },
  "Waning Gibbous":      { role:"moderate",   note:"Waning begins: moderate intensity. Prioritize recovery alongside maintenance." },
  "Last Quarter":        { role:"rest",       note:"Detox and release. Support the body in removing what it no longer needs." },
  "Waning Crescent":     { role:"rest",       note:"Deep recovery. Rest, gentle movement, hydration, and early sleep." },
  "Balsamic Moon":       { role:"rest",       note:"Balsamic: complete physical rest. Let the body fully restore before the new cycle." },
};

export const healthLogic: ModuleLogic = {
  id: "health",
  taskColors: TASK_COLORS,
  taskLabels: TASK_LABELS,
  planetTasks: PLANET_TASKS,

  buildPrescription(now: any): ModulePrescription {
    const planet  = now?.planetaryHour?.planet ?? "Sun";
    const phase   = now?.moonPhase ?? "Full Moon";
    const bio     = now?.biodynamicType ?? "fruit";
    const element = now?.element ?? "fire";
    const voc     = now?.voidOfCourse ?? false;
    const qs      = now?.qualityScore ?? 4;

    const pDef    = PLANET_TASKS[planet] ?? PLANET_TASKS.Sun;
    const phaseR  = PHASE_ROLE[phase] ?? PHASE_ROLE["Full Moon"];
    const bioNote = BIO_NOTES[bio] ?? BIO_NOTES.fruit;

    const qualityLabel =
      qs >= 6 ? "excellent" :
      qs >= 5 ? "good"      :
      qs >= 3 ? "moderate"  : "low";

    const opportunities: string[] = [];
    const cautions: string[] = [];

    if (["Mars", "Sun"].includes(planet) && ["fruit", "root"].includes(bio)) {
      opportunities.push(`${planet} hour + ${bio} day: peak window for intense physical effort`);
    }
    if (bio === "fruit") opportunities.push("Fruit day: body vitality at its highest — train, perform, and push");
    if (bio === "leaf")  opportunities.push("Leaf day: excellent for detox support, hydration, and cleansing movement");
    if (["Full Moon", "Waxing Gibbous"].includes(phase)) opportunities.push(`${phase}: physical energy peaks — schedule your hardest training here`);

    if (planet === "Jupiter") cautions.push("Jupiter hour: watch overindulgence — moderation is the practice today");
    if (bio === "leaf" && planet === "Mars") cautions.push("Leaf day + Mars: high-intensity training may feel heavier than expected");
    if (["Balsamic Moon", "Waning Crescent"].includes(phase)) cautions.push(`${phase}: don't force training — rest is the productive choice`);

    return {
      headline:       `${planet} hour — ${TASK_LABELS[pDef.task]}`,
      summary:        `${pDef.note} ${bioNote.note} ${phaseR.note}`,
      primaryTask:    pDef.task,
      secondaryTasks: [bioNote.best, phaseR.role].filter((r, i, a) => r !== pDef.task && a.indexOf(r) === i),
      opportunities,
      cautions,
      qualityLabel,
      vocWarning: voc,
    };
  },

  buildCalendarDay(day: any) {
    const phase   = day.moonPhase ?? "Full Moon";
    const bio     = day.biodynamicType ?? "fruit";
    const qs      = day.qualityScore ?? 4;

    if (["Full Moon", "Waxing Gibbous", "First Quarter"].includes(phase) && bio === "fruit" && qs >= 5) {
      return { role:"train", roleLabel:"Train hard", color:TASK_COLORS.train, note:`${phase} + Fruit day: peak physical performance window. Schedule your hardest training today.` };
    }
    if (bio === "fruit" && qs >= 4) {
      return { role:"vitalize", roleLabel:"Vitalize", color:TASK_COLORS.vitalize, note:"Fruit day: high vitality — outdoor activity, energizing movement, performance." };
    }
    if (bio === "leaf" || ["Balsamic Moon", "Waning Crescent", "Last Quarter"].includes(phase)) {
      return { role:"rest", roleLabel:"Rest & recover", color:TASK_COLORS.rest, note:`${bio === "leaf" ? "Leaf day" : phase}: body needs restoration. Hydrate, sleep well, gentle movement only.` };
    }
    if (bio === "flower") {
      return { role:"care", roleLabel:"Self-care", color:TASK_COLORS.care, note:"Flower day: gentle, restorative self-care. Body care rituals, yoga, and light movement." };
    }
    if (bio === "root") {
      return { role:"discipline", roleLabel:"Discipline", color:TASK_COLORS.discipline, note:"Root day: grounding energy — strength training, consistent routine, foundational habits." };
    }

    const phaseRole = PHASE_ROLE[phase] ?? PHASE_ROLE["Full Moon"];
    return {
      role: phaseRole.role,
      roleLabel: TASK_LABELS[phaseRole.role] ?? phaseRole.role,
      color: TASK_COLORS[phaseRole.role] ?? "#888",
      note: phaseRole.note,
    };
  },
};
