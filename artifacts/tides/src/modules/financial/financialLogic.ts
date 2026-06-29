import type { ModuleLogic, PlanetTaskDef, ModulePrescription } from "../shared/types";

export const TASK_COLORS: Record<string, string> = {
  decide:   "#1a2a3a",
  invest:   "#3a7040",
  contract: "#4060a0",
  plan:     "#607060",
  review:   "#807060",
  research: "#6070a0",
  wait:     "#c04040",
  divest:   "#a07030",
};

export const TASK_LABELS: Record<string, string> = {
  decide:   "Major decide",
  invest:   "Invest / grow",
  contract: "Sign / agree",
  plan:     "Plan",
  review:   "Review",
  research: "Research",
  wait:     "Hold / wait",
  divest:   "Divest / release",
};

const PLANET_TASKS: Record<string, PlanetTaskDef> = {
  Mercury: { task:"contract", label:"Sign / agree",  quality:"good",    note:"Mercury governs agreements, paperwork, and communication. Best hour for signing contracts, sending proposals, and closing deals with clear terms." },
  Jupiter: { task:"invest",   label:"Invest / grow", quality:"peak",    note:"Jupiter brings expansion and good fortune. The best planetary energy for growth investments, opportunity assessment, and asking for more." },
  Saturn:  { task:"plan",     label:"Plan",          quality:"good",    note:"Saturn rules structure and long-term thinking. Use this hour for risk analysis, budgeting, due diligence, and building sound financial frameworks." },
  Venus:   { task:"review",   label:"Review assets", quality:"good",    note:"Venus governs value and aesthetics. Good for reviewing asset quality, partnership negotiations, and decisions with a creative or relational dimension." },
  Sun:     { task:"decide",   label:"Major decide",  quality:"good",    note:"The Sun brings clarity and authority. The best hour to make final decisions on major financial matters — avoid impulsiveness, bring your full attention." },
  Moon:    { task:"research", label:"Research",      quality:"neutral", note:"Moon hours are emotional and intuitive — valuable for sensing into a situation, but not for acting on those senses alone. Research and observe." },
  Mars:    { task:"wait",     label:"Hold / wait",   quality:"avoid",   note:"Mars brings impulsive energy and heightened risk. A poor time for financial decisions — easy to rush, easy to miss details. If you must act, be slow and deliberate." },
};

const PHASE_ROLE: Record<string, { role: string; note: string }> = {
  "New Moon":            { role:"plan",     note:"New Moon: plant intentions. Set financial goals, begin planning cycles, open new accounts. Don't execute yet." },
  "Waxing Crescent":     { role:"invest",   note:"First momentum. Begin growth investments, open new positions, take early action on expansion plans." },
  "First Quarter":       { role:"decide",   note:"Decisive energy. Overcome hesitation and commit to well-researched financial decisions." },
  "Waxing Gibbous":      { role:"invest",   note:"Strong growth phase. Continue building. Review and adjust without abandoning direction." },
  "Full Moon":           { role:"review",   note:"Full Moon: emotions run high — poor for major decisions. Good for reviewing what you've built and what needs releasing." },
  "Waning Gibbous":      { role:"review",   note:"Calibration. What's working? Trim what isn't. Avoid new investments; strengthen what exists." },
  "Last Quarter":        { role:"divest",   note:"Release and simplify. Divest underperformers, pay down debt, close out what no longer fits." },
  "Waning Crescent":     { role:"research", note:"Introspection. Review portfolios, read deeply, and prepare for the next cycle without acting." },
  "Balsamic Moon":       { role:"wait",     note:"Balsamic: complete rest from financial action. Avoid decisions; let the cycle close." },
};

export const financialLogic: ModuleLogic = {
  id: "financial",
  taskColors: TASK_COLORS,
  taskLabels: TASK_LABELS,
  planetTasks: PLANET_TASKS,

  buildPrescription(now: any): ModulePrescription {
    const planet  = now?.planetaryHour?.planet ?? "Mercury";
    const phase   = now?.moonPhase ?? "Full Moon";
    const voc     = now?.voidOfCourse ?? false;
    const qs      = now?.qualityScore ?? 4;

    const pDef    = PLANET_TASKS[planet] ?? PLANET_TASKS.Mercury;
    const phaseR  = PHASE_ROLE[phase] ?? PHASE_ROLE["Full Moon"];

    const qualityLabel =
      qs >= 6 ? "excellent" :
      qs >= 5 ? "good"      :
      qs >= 3 ? "moderate"  : "low";

    const opportunities: string[] = [];
    const cautions: string[] = [];

    let alertBanner: ModulePrescription["alertBanner"];

    if (voc) {
      alertBanner = { text:"⚠ Moon void of course — hardest avoid for financial decisions. Things begun now often do not reach their intended outcome.", color:"#9a6020", bg:"#fdf3e0" };
    } else if (planet === "Mars") {
      alertBanner = { text:"Mars hour — impulsive energy peaks. Hold off on financial commitments. Research and review only.", color:"#a03030", bg:"#fdf0ee" };
    }

    if (["Jupiter", "Mercury"].includes(planet) && !voc) opportunities.push(`${planet} hour: favorable for ${pDef.task === "invest" ? "growth and expansion decisions" : "agreements and clear terms"}`);
    if (["Waxing Crescent", "First Quarter", "Waxing Gibbous"].includes(phase)) opportunities.push("Waxing moon: building energy supports new investments and growth positions");
    if (planet === "Saturn" && !voc) opportunities.push("Saturn hour: excellent for due diligence, risk analysis, and long-term planning");

    if (["Full Moon", "Balsamic Moon"].includes(phase)) cautions.push(`${phase}: emotionally charged — review only, avoid new commitments`);
    if (qs < 3) cautions.push("Low overall quality score — a rest day for financial decisions");

    return {
      headline:       `${planet} hour — ${TASK_LABELS[pDef.task]}`,
      summary:        `${pDef.note} ${phaseR.note}`,
      primaryTask:    voc ? "wait" : (pDef.quality === "avoid" ? "wait" : pDef.task),
      secondaryTasks: [phaseR.role].filter(r => r !== pDef.task && !voc),
      opportunities,
      cautions,
      qualityLabel,
      vocWarning: voc,
      alertBanner,
    };
  },

  buildCalendarDay(day: any) {
    const phase   = day.moonPhase ?? "Full Moon";
    const voc     = !!(day.voidPeriods);
    const qs      = day.qualityScore ?? 4;

    if (voc && ["Balsamic Moon", "Waning Crescent"].includes(phase)) {
      return { role:"wait", roleLabel:"Hold / wait", color:TASK_COLORS.wait, note:"VOC + waning moon: hardest avoid for financial action. Research or rest." };
    }
    if (["New Moon", "Waxing Crescent", "First Quarter"].includes(phase) && qs >= 4 && !voc) {
      return { role:"invest", roleLabel:"Invest / grow", color:TASK_COLORS.invest, note:`${phase}: growth phase supports new investments and forward financial moves.` };
    }
    if (["Last Quarter", "Waning Gibbous", "Waning Crescent"].includes(phase)) {
      return { role:"divest", roleLabel:"Divest / release", color:TASK_COLORS.divest, note:`${phase}: waning energy — release underperformers, simplify, and pay down.` };
    }
    if (["Full Moon", "Balsamic Moon"].includes(phase)) {
      return { role:"review", roleLabel:"Review", color:TASK_COLORS.review, note:`${phase}: high emotion. Review positions only — avoid new commitments.` };
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
