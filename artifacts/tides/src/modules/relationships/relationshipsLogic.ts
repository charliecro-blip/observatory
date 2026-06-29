import type { ModuleLogic, PlanetTaskDef, ModulePrescription } from "../shared/types";

export const TASK_COLORS: Record<string, string> = {
  connect:     "#a06080",
  nurture:     "#7080a0",
  celebrate:   "#a07030",
  communicate: "#4080a0",
  clarify:     "#c08020",
  space:       "#c04040",
  reflect:     "#607060",
  commit:      "#1a2a3a",
};

export const TASK_LABELS: Record<string, string> = {
  connect:     "Connect",
  nurture:     "Nurture",
  celebrate:   "Celebrate",
  communicate: "Communicate",
  clarify:     "Clarify",
  space:       "Give space",
  reflect:     "Reflect",
  commit:      "Commit",
};

const PLANET_TASKS: Record<string, PlanetTaskDef> = {
  Venus:   { task:"connect",     label:"Connect",      quality:"peak",    note:"Venus governs love, beauty, and social bonding. The strongest hour for quality time, romantic connection, creative collaboration, and social warmth." },
  Moon:    { task:"nurture",     label:"Nurture",       quality:"peak",    note:"Moon hours open emotional depth. Listen without an agenda. Comfort, care, and gentleness are especially received here." },
  Jupiter: { task:"celebrate",   label:"Celebrate",     quality:"good",    note:"Jupiter brings generosity and goodwill. Shared experiences, celebrations, gifts, and expansive social time all flourish under Jupiter." },
  Mercury: { task:"communicate", label:"Communicate",   quality:"good",    note:"Mercury rules clear exchange. The best hour for important conversations, clearing misunderstandings, and articulating what matters." },
  Sun:     { task:"clarify",     label:"Clarify",       quality:"good",    note:"The Sun brings honest clarity. Use for direct, heart-to-heart conversations about serious matters. Bring attention and willingness to be seen." },
  Mars:    { task:"space",       label:"Give space",    quality:"avoid",   note:"Mars brings friction and impatience. Avoid confrontations and difficult conversations unless truly necessary. Channel energy into movement or solo work." },
  Saturn:  { task:"commit",      label:"Commit",        quality:"neutral", note:"Saturn governs structure and long-term agreements. Good for defining boundaries, formal commitments, and serious relational agreements." },
};

const ELEMENT_NOTES: Record<string, string> = {
  fire:  "Fire: passionate, energetic social energy. Fun experiences, adventures, and playful connection.",
  earth: "Earth: practical care. Acts of service, reliability, and showing up consistently.",
  air:   "Air: light intellectual rapport, witty banter, and playful social exchange.",
  water: "Water: emotional depth. Intuitive connection, vulnerability, and deep listening.",
};

const PHASE_ROLE: Record<string, { role: string; note: string }> = {
  "New Moon":            { role:"reflect",     note:"New Moon: set relational intentions. Clarify what you want and need in your connections before acting." },
  "Waxing Crescent":     { role:"connect",     note:"Building energy: reach out, make plans, initiate connection with lightness." },
  "First Quarter":       { role:"communicate", note:"First Quarter: push through social inertia. Say what needs saying." },
  "Waxing Gibbous":      { role:"nurture",     note:"Waxing Gibbous: deepen what's building. More presence, more care." },
  "Full Moon":           { role:"celebrate",   note:"Full Moon: peak emotional energy. Share, celebrate, and be seen together. Watch for heightened reactivity." },
  "Waning Gibbous":      { role:"reflect",     note:"Waning Gibbous: gratitude and review. What has grown? What still needs attention?" },
  "Last Quarter":        { role:"clarify",     note:"Last Quarter: release what doesn't serve the relationship. Honest, gentle conversation." },
  "Waning Crescent":     { role:"reflect",     note:"Waning Crescent: rest from social effort. Private reflection." },
  "Balsamic Moon":       { role:"reflect",     note:"Balsamic: deepest rest. Prepare for the relational cycle to renew." },
};

export const relationshipsLogic: ModuleLogic = {
  id: "relationships",
  taskColors: TASK_COLORS,
  taskLabels: TASK_LABELS,
  planetTasks: PLANET_TASKS,

  buildPrescription(now: any): ModulePrescription {
    const planet  = now?.planetaryHour?.planet ?? "Venus";
    const phase   = now?.moonPhase ?? "Full Moon";
    const element = now?.element ?? "water";
    const voc     = now?.voidOfCourse ?? false;
    const qs      = now?.qualityScore ?? 4;

    const pDef    = PLANET_TASKS[planet] ?? PLANET_TASKS.Venus;
    const phaseR  = PHASE_ROLE[phase] ?? PHASE_ROLE["Full Moon"];
    const elemNote = ELEMENT_NOTES[element] ?? "";

    const qualityLabel =
      qs >= 6 ? "excellent" :
      qs >= 5 ? "good"      :
      qs >= 3 ? "moderate"  : "low";

    const opportunities: string[] = [];
    const cautions: string[] = [];

    if (["Venus", "Moon", "Jupiter"].includes(planet) && !voc) {
      opportunities.push(`${planet} hour: ${pDef.quality === "peak" ? "peak energy for " + TASK_LABELS[pDef.task].toLowerCase() : TASK_LABELS[pDef.task]}`);
    }
    if (element === "water") opportunities.push("Water element: emotional depth flows — ideal for vulnerable, real conversations");
    if (element === "fire")  opportunities.push("Fire element: playful, passionate energy — plan something fun and spirited");
    if (["Full Moon", "Waxing Gibbous"].includes(phase)) opportunities.push(`${phase}: emotional amplification — powerful for connection and celebration`);

    if (planet === "Mars") cautions.push("Mars hour: hold back on confrontations; channel energy into movement");
    if (voc) cautions.push("VOC: emotional signals may be unreliable; avoid heavy relational decisions");
    if (["Full Moon"].includes(phase)) cautions.push("Full Moon heightens reactivity — take a breath before responding");

    return {
      headline:       `${planet} hour — ${TASK_LABELS[pDef.task]}`,
      summary:        `${pDef.note} ${elemNote} ${phaseR.note}`,
      primaryTask:    pDef.task,
      secondaryTasks: [phaseR.role].filter(r => r !== pDef.task),
      opportunities,
      cautions,
      qualityLabel,
      vocWarning: voc,
    };
  },

  buildCalendarDay(day: any) {
    const phase   = day.moonPhase ?? "Full Moon";
    const element = day.element ?? "water";
    const bio     = day.biodynamicType ?? "flower";
    const qs      = day.qualityScore ?? 4;
    const voc     = !!(day.voidPeriods);

    if (["Full Moon"].includes(phase) && qs >= 5) {
      return { role:"celebrate", roleLabel:"Celebrate", color:TASK_COLORS.celebrate, note:`Full Moon at high quality — plan celebrations, shared experiences, and joyful gatherings.` };
    }
    if (["Waning Crescent", "Balsamic Moon"].includes(phase)) {
      return { role:"reflect", roleLabel:"Reflect", color:TASK_COLORS.reflect, note:"Waning crescent / balsamic: private reflection time. Rest from social effort." };
    }
    if (bio === "flower" && ["water", "fire"].includes(element) && qs >= 4) {
      return { role:"connect", roleLabel:"Connect", color:TASK_COLORS.connect, note:`Flower day + ${element} element: warm, beautiful energy for meaningful connection.` };
    }
    if (["First Quarter", "Last Quarter"].includes(phase)) {
      return { role:"communicate", roleLabel:"Communicate", color:TASK_COLORS.communicate, note:`${phase}: decisive energy supports saying what needs to be said.` };
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
