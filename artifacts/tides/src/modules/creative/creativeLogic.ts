import type { ModuleLogic, PlanetTaskDef, ModulePrescription } from "../shared/types";

export const TASK_COLORS: Record<string, string> = {
  flow:    "#6040a0",
  write:   "#4080a0",
  refine:  "#a06080",
  vision:  "#a07030",
  start:   "#c04040",
  craft:   "#607060",
  perform: "#c08020",
  rest:    "#808080",
};

export const TASK_LABELS: Record<string, string> = {
  flow:    "Deep flow",
  write:   "Write",
  refine:  "Refine",
  vision:  "Vision",
  start:   "Start bold",
  craft:   "Craft",
  perform: "Perform",
  rest:    "Rest field",
};

const PLANET_TASKS: Record<string, PlanetTaskDef> = {
  Moon:    { task:"flow",    label:"Deep flow",   quality:"peak",    note:"The Moon governs emotional depth and intuition. Ideal for immersive creative flow, working with personal material, and letting work emerge without force." },
  Venus:   { task:"refine",  label:"Refine",      quality:"peak",    note:"Venus rules aesthetic sensibility. Use this hour to refine, compose, arrange, and make beauty decisions. Strong for visual and musical work." },
  Mercury: { task:"write",   label:"Write",       quality:"good",    note:"Mercury governs language and transmission. Excellent for writing, scripting, lyrics, conceptual articulation. Ideas move quickly." },
  Jupiter: { task:"vision",  label:"Vision",      quality:"good",    note:"Jupiter expands perspective. Useful for big-picture creative vision, concept development, and imagining the finished work's full arc." },
  Mars:    { task:"start",   label:"Start bold",  quality:"good",    note:"Mars brings courage and raw momentum. Good for starting things you've been avoiding, cutting through creative block, first drafts." },
  Saturn:  { task:"craft",   label:"Craft",       quality:"neutral", note:"Saturn demands discipline and mastery. Best for technical practice, structural editing, and revision work that requires patience." },
  Sun:     { task:"perform", label:"Perform",     quality:"good",    note:"The Sun radiates outward. Recording final versions, performing, sharing completed work, and showing work to audiences all benefit here." },
};

const ELEMENT_NOTES: Record<string, string> = {
  fire:  "Fire energy favors bold, expressive, improvisational work. Take risks. Say what you mean.",
  earth: "Earth grounds craft. Patient, detailed, technically focused work. Good for iteration.",
  air:   "Air is conceptual and eclectic. Experiment, collaborate, make unusual connections.",
  water: "Water flows deep. Personal, emotional, intuitive material surfaces most naturally now.",
};

const PHASE_NOTES: Record<string, { role: string; note: string }> = {
  "New Moon":            { role:"vision",   note:"Plant seeds. Ideal for intention-setting, new project starts, and mapping the creative landscape. Nothing needs to be finished." },
  "Waxing Crescent":     { role:"start",    note:"First momentum. Begin drafts, sketches, and early experiments. Energy is building — use it." },
  "First Quarter":       { role:"start",    note:"Decisive energy. Push through resistance. Commit to a direction and act on it." },
  "Waxing Gibbous":      { role:"flow",     note:"Refinement and momentum together. Work intensively and make adjustments as you go." },
  "Full Moon":           { role:"perform",  note:"Peak energy and emotion. Share, perform, record, and reveal. Heightened reactivity — watch for over-sensitivity." },
  "Waning Gibbous":      { role:"refine",   note:"Gratitude and calibration. Review what you've made. What needs deepening?" },
  "Last Quarter":        { role:"craft",    note:"Structured release. Edit, archive, and complete. Remove what doesn't serve the work." },
  "Waning Crescent":     { role:"rest",     note:"Fallow field. Let the creative ground rest. Absorb, research, and restore." },
  "Balsamic Moon":       { role:"rest",     note:"Surrender. Rest is creative work too. Allow the subconscious to integrate." },
};

function qualityScore(now: any): number {
  return now?.qualityScore ?? 4;
}

export const creativeLogic: ModuleLogic = {
  id: "creative",
  taskColors: TASK_COLORS,
  taskLabels: TASK_LABELS,
  planetTasks: PLANET_TASKS,

  buildPrescription(now: any): ModulePrescription {
    const planet = now?.planetaryHour?.planet ?? "Mercury";
    const phaseKey = now?.moonPhase ?? "Full Moon";
    const element  = now?.element ?? "air";
    const bio      = now?.biodynamicType ?? "flower";
    const voc      = now?.voidOfCourse ?? false;
    const qs       = qualityScore(now);

    const pDef   = PLANET_TASKS[planet] ?? PLANET_TASKS.Mercury;
    const phase  = PHASE_NOTES[phaseKey] ?? PHASE_NOTES["Full Moon"];
    const elemNote = ELEMENT_NOTES[element] ?? "";

    const qualityLabel =
      qs >= 6 ? "excellent" :
      qs >= 5 ? "good"      :
      qs >= 3 ? "moderate"  : "low";

    const opportunities: string[] = [];
    const cautions: string[] = [];

    if (["Moon", "Venus"].includes(planet)) opportunities.push(`${planet} hour — strong for ${pDef.task === "flow" ? "immersive creation" : "aesthetic refinement"}`);
    if (bio === "flower") opportunities.push("Flower day — heightened aesthetic and musical perception");
    if (bio === "fruit")  opportunities.push("Fruit day — peak vitality for performing and sharing work");
    if (["Full Moon", "Waxing Gibbous"].includes(phaseKey)) opportunities.push(`${phaseKey} amplifies emotional resonance in creative material`);

    if (voc) cautions.push("Moon void of course — ideas may shift; wait to commit to final versions");
    if (planet === "Saturn" && qs < 3) cautions.push("Low quality + Saturn: avoid forced discipline; let the field rest");
    if (bio === "root") cautions.push("Root day can feel heavy for light creative work — lean into structure or take a rest day");

    return {
      headline:       `${planet} hour — ${TASK_LABELS[pDef.task]} (${phaseKey})`,
      summary:        `${pDef.note} ${elemNote} ${phase.note}`,
      primaryTask:    pDef.task,
      secondaryTasks: phase.role !== pDef.task ? [phase.role] : [],
      opportunities,
      cautions,
      qualityLabel,
      vocWarning: voc,
    };
  },

  buildCalendarDay(day: any) {
    const phase    = day.moonPhase ?? "Full Moon";
    const voc      = !!(day.voidPeriods);
    const qs       = day.qualityScore ?? 4;
    const bio      = day.biodynamicType ?? "flower";
    const element  = day.element ?? "air";

    const phaseRole = PHASE_NOTES[phase]?.role ?? "flow";

    if (voc && qs < 3) return { role:"rest", roleLabel:"Rest field", color:"#909090", note:"Low quality + VOC periods. Let creative energy restore itself." };
    if (["Full Moon", "Waxing Gibbous"].includes(phase) && qs >= 5) return { role:"perform", roleLabel:"Perform & share", color:TASK_COLORS.perform, note:`${phase} at high quality — ideal for sharing work, recording, performing.` };
    if (["Waning Crescent", "Balsamic Moon"].includes(phase)) return { role:"rest", roleLabel:"Rest field", color:TASK_COLORS.rest, note:"Balsamic / waning crescent: fallow creative field. Research, absorb, restore." };
    if (bio === "flower" && qs >= 4) return { role:"refine", roleLabel:"Refine", color:TASK_COLORS.refine, note:`Flower day (${element}): heightened aesthetic sensitivity — refine, compose, make beauty decisions.` };
    if (qs >= 5) return { role:"flow", roleLabel:"Deep flow", color:TASK_COLORS.flow, note:`High quality ${element} day — conditions favor deep immersive creative work.` };

    return {
      role: phaseRole,
      roleLabel: TASK_LABELS[phaseRole] ?? phaseRole,
      color: TASK_COLORS[phaseRole] ?? "#888",
      note: `${phase}: ${PHASE_NOTES[phase]?.note ?? ""}`,
    };
  },
};
