import type { TidesNow, SkyEvent } from "@/lib/types";

// ── Task types for content work ──────────────────────────────────────────────

export type ContentTask =
  | "draft"        // Writing first drafts, longform
  | "edit"         // Revising, refining, proofreading
  | "design"       // Visual work, branding, aesthetics
  | "research"     // Gathering, reading, sourcing
  | "ideate"       // Brainstorming, outlining, strategy
  | "pitch"        // Outreach, proposals, negotiation
  | "publish"      // Posting, scheduling, distributing
  | "analyze"      // Reviewing metrics, auditing, archiving
  | "rest";        // No focused content work recommended

export type ContentFormat =
  | "longform"     // Essays, blog posts, white papers
  | "shortform"    // Threads, social posts, captions
  | "newsletter"   // Email, nurture sequences
  | "video"        // Scripts, recording, talking-head
  | "visual"       // Design, infographics, brand assets
  | "audio"        // Podcast, voice notes
  | "educational"  // Courses, tutorials, how-tos
  | "personal"     // Diary-style, confessional, lifestyle
  | "opinion"      // Takes, arguments, thought leadership
  | "narrative";   // Storytelling, case studies, journeys

export interface ContentPrescription {
  headline: string;
  summary: string;
  primaryTask: ContentTask;
  secondaryTasks: ContentTask[];
  bestFormats: ContentFormat[];
  avoidFormats: ContentFormat[];
  avoid: string[];
  launchWindowOpen: boolean;
  qualityLabel: "excellent" | "good" | "moderate" | "low";
  vocWarning: boolean;
}

export interface ContentHour {
  time: string;
  planet: string;
  task: ContentTask;
  taskLabel: string;
  note: string;
  quality: "peak" | "good" | "neutral" | "avoid";
}

export interface ContentDay {
  date: string;
  label: string;          // "Mon", "Tue", etc.
  dayName: string;        // "Monday"
  role: "launch" | "create" | "edit" | "research" | "rest";
  roleLabel: string;
  element: string;
  biodynamicType: string;
  qualityScore: number;
  voc: boolean;
  note: string;
}

export interface LaunchWindow {
  datetime: string;
  timeLabel: string;
  planet: string;
  angle: string;
  type: "benefic_crossing" | "sun_mc" | "high_quality";
  headline: string;
  strength: "strong" | "notable";
}

// ── Planetary hour → content task mapping ────────────────────────────────────

const PLANET_TASKS: Record<string, { primary: ContentTask; label: string; note: string }> = {
  Sun:     { primary: "publish",  label: "Publish & share",      note: "Sun hours favour visibility and authority. Ideal for publishing thought leadership, going live, or sharing widely." },
  Moon:    { primary: "ideate",   label: "Ideate & reflect",     note: "Moon hours favour intuition. Good for personal content, brainstorming from feeling, and audience empathy work." },
  Mercury: { primary: "draft",    label: "Write & edit",         note: "Mercury is the scribe. Peak hour for drafting, copywriting, editing, newsletters, and any written communication." },
  Venus:   { primary: "design",   label: "Design & aesthetics",  note: "Venus hours favour beauty. Ideal for visual work, branding, content that needs to look or feel refined." },
  Mars:    { primary: "pitch",    label: "Pitch & outreach",     note: "Mars hours favour assertion. Use for cold outreach, bold opinion pieces, calls-to-action, and competitive positioning." },
  Jupiter: { primary: "ideate",   label: "Strategise & expand",  note: "Jupiter expands. Excellent for big-picture content strategy, course creation, and anything that requires optimism and breadth." },
  Saturn:  { primary: "edit",     label: "Refine & structure",   note: "Saturn brings structure. Best for editing drafts, SEO optimisation, content audits, and building evergreen frameworks." },
};

function planetTaskQuality(planet: string, task: ContentTask): "peak" | "good" | "neutral" | "avoid" {
  const map: Record<string, ContentTask[]> = {
    Sun:     ["publish", "pitch"],
    Moon:    ["ideate", "research", "draft"],
    Mercury: ["draft", "edit", "research"],
    Venus:   ["design", "publish"],
    Mars:    ["pitch", "publish"],
    Jupiter: ["ideate", "pitch", "publish"],
    Saturn:  ["edit", "analyze", "research"],
  };
  const good = map[planet] ?? [];
  return good[0] === task ? "peak" : good.includes(task) ? "good" : task === "rest" ? "avoid" : "neutral";
}

// ── Element → content style ──────────────────────────────────────────────────

const ELEMENT_STYLE: Record<string, { formats: ContentFormat[]; voice: string; avoid: ContentFormat[] }> = {
  fire:  { formats: ["opinion","shortform","video"],   voice: "Bold, direct, energetic, inspiring. First-person strong takes.", avoid: ["longform","educational"] },
  earth: { formats: ["educational","longform","newsletter"], voice: "Practical, grounded, step-by-step. Facts over feelings.",   avoid: ["personal","audio"] },
  air:   { formats: ["shortform","newsletter","audio"], voice: "Conversational, idea-rich, varied. Thread-friendly.",            avoid: ["longform","personal"] },
  water: { formats: ["personal","narrative","newsletter"], voice: "Emotional, story-driven, introspective. Reader feels seen.",   avoid: ["opinion","shortform"] },
};

// ── Biodynamic → energy ──────────────────────────────────────────────────────

const BIO_NOTES: Record<string, string> = {
  fruit:  "Fruit day: peak outward vitality. Strong for launches, promotional content, anything that needs to grab attention.",
  flower: "Flower day: heightened aesthetic sensitivity. Excellent for visual content, brand work, and anything that needs to look beautiful.",
  root:   "Root day: grounded and practical. Ideal for instructional, evergreen content and structural editing.",
  leaf:   "Leaf day: fluid and nutritive. Good for personal, nurturing content and relationship-building pieces.",
};

// ── Moon phase → publishing strategy ────────────────────────────────────────

const PHASE_STRATEGY: Record<string, { strategy: string; recommend: ContentTask; avoid: ContentTask }> = {
  "new moon":         { strategy: "Plant seeds quietly. Set content intentions. Don't publish widely — let ideas incubate.", recommend: "ideate",  avoid: "publish" },
  "waxing_crescent":  { strategy: "Begin momentum. Share early ideas, start new series, build audience curiosity.",          recommend: "draft",   avoid: "analyze" },
  "first_quarter":    { strategy: "Push through resistance. Share challenging ideas. Overcome creative friction.",           recommend: "pitch",   avoid: "rest" },
  "waxing_gibbous":   { strategy: "Refine and perfect. Your drafts are close to ready — edit, tighten, prepare to launch.", recommend: "edit",    avoid: "rest" },
  "full_moon":        { strategy: "Peak publishing window. Share your best work widely. Collaborate and amplify.",           recommend: "publish", avoid: "ideate" },
  "waning_gibbous":   { strategy: "Gratitude and sharing. Repurpose, share behind-the-scenes, thank your audience.",        recommend: "publish", avoid: "draft" },
  "last_quarter":     { strategy: "Release and evaluate. Review analytics, archive what isn't working, cull the backlog.",  recommend: "analyze", avoid: "publish" },
  "waning_crescent":  { strategy: "Rest and reflect. Gather inspiration, read widely, do not force output.",                recommend: "research",avoid: "pitch" },
  "balsamic_moon":    { strategy: "Deep rest before the new cycle. No publishing. Let the creative field lie fallow.",      recommend: "rest",    avoid: "publish" },
};

function normalisePhase(phase: string): string {
  return phase.toLowerCase().replace(/ /g, "_");
}

// ── Main prescription builder ─────────────────────────────────────────────────

export function buildContentPrescription(now: TidesNow | undefined): ContentPrescription {
  if (!now) {
    return {
      headline: "Loading timing data…",
      summary: "",
      primaryTask: "rest",
      secondaryTasks: [],
      bestFormats: [],
      avoidFormats: [],
      avoid: [],
      launchWindowOpen: false,
      qualityLabel: "low",
      vocWarning: false,
    };
  }

  const planet = now.planetaryHour?.planet ?? "Mercury";
  const element = now.element?.element ?? "air";
  const bio = now.biodynamicType ?? "flower";
  const phase = normalisePhase(now.moonPhase ?? "");
  const quality = now.qualityScore ?? 4;
  const isVOC = now.voc?.isVOC ?? false;

  const planetMap = PLANET_TASKS[planet] ?? PLANET_TASKS["Mercury"];
  const elStyle = ELEMENT_STYLE[element] ?? ELEMENT_STYLE["air"];
  const phaseStr = PHASE_STRATEGY[phase] ?? PHASE_STRATEGY["waxing_gibbous"];

  const qualityLabel: ContentPrescription["qualityLabel"] =
    quality >= 6 ? "excellent" : quality >= 5 ? "good" : quality >= 3 ? "moderate" : "low";

  // VOC overrides publishing/pitching
  const primaryTask: ContentTask = isVOC
    ? (quality >= 4 ? "edit" : "rest")
    : planetMap.primary;

  const secondaryTasks: ContentTask[] = [];
  if (!isVOC) {
    if (primaryTask !== "draft" && !["water"].includes(element)) secondaryTasks.push("draft");
    if (primaryTask !== "edit") secondaryTasks.push("edit");
    if (phaseStr.recommend !== primaryTask) secondaryTasks.push(phaseStr.recommend);
  }
  const uniqueSecondary = [...new Set(secondaryTasks)].filter(t => t !== primaryTask).slice(0, 2);

  const avoid: string[] = [];
  if (isVOC) avoid.push("Publishing new work", "Pitching or sending proposals", "Finalising agreements");
  if (phase === "new_moon" || phase === "balsamic_moon") avoid.push("Wide distribution or promotion");
  if (quality < 3) avoid.push("High-stakes content decisions");

  const launchWindowOpen = !isVOC && quality >= 5 &&
    (["Venus", "Jupiter", "Sun"].includes(planet) || bio === "fruit");

  return {
    headline: buildHeadline(planet, element, bio, isVOC, quality),
    summary: buildSummary(planet, element, bio, phase, isVOC, quality, phaseStr.strategy),
    primaryTask,
    secondaryTasks: uniqueSecondary,
    bestFormats: isVOC ? ["educational"] : elStyle.formats,
    avoidFormats: isVOC ? ["shortform","opinion"] : elStyle.avoid,
    avoid,
    launchWindowOpen,
    qualityLabel,
    vocWarning: isVOC,
  };
}

function buildHeadline(planet: string, element: string, bio: string, voc: boolean, quality: number): string {
  if (voc) return "Moon void of course — edit, don't publish";
  if (planet === "Mercury" && element === "air") return "Peak writing window — conversational and clear";
  if (planet === "Venus" && (bio === "flower" || bio === "fruit")) return "Aesthetic peak — visual work and brand content";
  if (planet === "Jupiter" && quality >= 5) return "Expansive hour — strategy, launches, and big ideas";
  if (planet === "Sun" && quality >= 5) return "Visibility window — share your best work";
  if (planet === "Saturn") return "Structure hour — edit, refine, and systematise";
  if (planet === "Mars") return "Bold hour — strong takes and outreach";
  if (element === "water") return "Narrative energy — personal and story-driven content";
  if (element === "earth") return "Grounded day — practical and instructional content";
  if (quality >= 6) return "High-quality window — prioritise creative output";
  if (quality <= 2) return "Low-quality window — light tasks and rest";
  return "Moderate timing — steady, methodical work";
}

function buildSummary(planet: string, element: string, bio: string, phase: string, voc: boolean, quality: number, phaseStrategy: string): string {
  const parts: string[] = [];

  if (voc) {
    parts.push("The Moon is void of course — a period traditionally unfavourable for new initiatives, publishing, or pitching. Use this time to edit existing drafts, review your content calendar, or do research that doesn't require decisions.");
  } else {
    const ptask = PLANET_TASKS[planet];
    if (ptask) parts.push(ptask.note);
    const el = ELEMENT_STYLE[element];
    if (el) parts.push(`${element.charAt(0).toUpperCase() + element.slice(1)} element days favour ${el.voice.toLowerCase()}`);
  }

  const bioNote = BIO_NOTES[bio];
  if (bioNote) parts.push(bioNote);
  parts.push(phaseStrategy);

  return parts.filter(Boolean).join(" ");
}

// ── Hourly content schedule ───────────────────────────────────────────────────

export function buildHourlySchedule(now: TidesNow | undefined): ContentHour[] {
  if (!now) return [];
  const hours: ContentHour[] = [];

  // Current hour
  const cur = now.planetaryHour;
  if (cur) {
    const pt = PLANET_TASKS[cur.planet] ?? PLANET_TASKS["Mercury"];
    hours.push({
      time: cur.began,
      planet: cur.planet,
      task: now.voc?.isVOC ? "edit" : pt.primary,
      taskLabel: now.voc?.isVOC ? "Edit (VOC)" : pt.label,
      note: now.voc?.isVOC ? "VOC in effect — avoid publishing." : pt.note,
      quality: now.voc?.isVOC ? "avoid" : (now.qualityScore ?? 4) >= 5 ? "peak" : "good",
    });
  }

  // Upcoming hours
  for (const h of (now.upcomingHours ?? []).slice(0, 6)) {
    const pt = PLANET_TASKS[h.planet] ?? PLANET_TASKS["Mercury"];
    hours.push({
      time: h.time,
      planet: h.planet,
      task: pt.primary,
      taskLabel: pt.label,
      note: pt.note,
      quality: ["Mercury","Venus","Jupiter","Sun"].includes(h.planet) ? "good" : "neutral",
    });
  }

  return hours;
}

// ── 14-day content calendar ───────────────────────────────────────────────────

export function buildContentCalendar(weekDays: any[]): ContentDay[] {
  return weekDays.map(d => {
    const score = d.qualityScore ?? 4;
    const voc = d.voidPeriods ?? false;
    const bio = d.biodynamicType ?? "leaf";
    const el = d.element ?? "water";
    const phase = normalisePhase(d.moonPhase ?? "");
    const phaseRec = PHASE_STRATEGY[phase]?.recommend;

    let role: ContentDay["role"];
    let roleLabel: string;
    let note: string;

    if (score >= 6 && !voc && (bio === "fruit" || bio === "flower") && ["Venus","Jupiter","Sun"].includes(d.dayRuler ?? "")) {
      role = "launch"; roleLabel = "Launch day"; note = "High visibility, strong energy for publishing and promotion.";
    } else if (score >= 5 && !voc && phaseRec === "publish") {
      role = "launch"; roleLabel = "Publish day"; note = "Moon phase supports sharing widely.";
    } else if (score >= 5 && !voc && (el === "air" || el === "fire")) {
      role = "create"; roleLabel = "Create day"; note = "Good energy for drafting and ideation.";
    } else if (score >= 4 && !voc && (phaseRec === "edit" || bio === "root" || el === "earth")) {
      role = "edit"; roleLabel = "Edit day"; note = "Grounded, structured — ideal for refining existing work.";
    } else if (score >= 3 && (el === "water" || phaseRec === "research" || phaseRec === "rest")) {
      role = "research"; roleLabel = "Research day"; note = "Receptive energy — gather, read, and plan without producing.";
    } else {
      role = "rest"; roleLabel = "Rest day"; note = "Low quality or VOC periods — light tasks only.";
    }

    const date = new Date(d.date + "T12:00:00");
    return {
      date: d.date,
      label: date.toLocaleDateString("en-US", { weekday: "short" }),
      dayName: date.toLocaleDateString("en-US", { weekday: "long" }),
      role,
      roleLabel,
      element: el,
      biodynamicType: bio,
      qualityScore: score,
      voc,
      note,
    };
  });
}

// ── Launch window extractor ───────────────────────────────────────────────────

export function extractLaunchWindows(events: SkyEvent[]): LaunchWindow[] {
  const windows: LaunchWindow[] = [];

  for (const e of events) {
    if (e.type === "crossing") {
      const isBenefic = ["Venus","Jupiter"].includes(e.title.split(" ")[0] ?? "");
      const isAngle = e.subtitle?.includes("ASC") || e.subtitle?.includes("MC");
      const isSunMC = e.title.includes("Sun") && e.subtitle?.includes("MC");
      if ((isBenefic && isAngle) || isSunMC) {
        windows.push({
          datetime: e.date + (e.time ? `T${e.time}` : ""),
          timeLabel: e.time ? formatTime(e.time) : e.date,
          planet: e.title.split(" ")[0] ?? "Venus",
          angle: e.subtitle?.includes("ASC") ? "ASC" : "MC",
          type: isSunMC ? "sun_mc" : "benefic_crossing",
          headline: isSunMC
            ? "Sun at Midheaven — authority and public visibility peak"
            : `${e.title.split(" ")[0]} crossing ${e.subtitle?.includes("ASC") ? "Ascendant" : "Midheaven"} — ${
                e.title.includes("Venus") ? "creative and relational visibility" : "expansion and good fortune peak"
              }`,
          strength: isBenefic && isAngle ? "strong" : "notable",
        });
      }
    }
    if (e.type === "quality_window" && e.quality === "favorable") {
      windows.push({
        datetime: e.date,
        timeLabel: e.date,
        planet: "—",
        angle: "—",
        type: "high_quality",
        headline: e.title,
        strength: "notable",
      });
    }
  }

  return windows.slice(0, 8);
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ── Task label helpers ────────────────────────────────────────────────────────

export const TASK_LABELS: Record<ContentTask, string> = {
  draft:    "Write draft",
  edit:     "Edit & refine",
  design:   "Visual design",
  research: "Research",
  ideate:   "Brainstorm",
  pitch:    "Pitch & outreach",
  publish:  "Publish & share",
  analyze:  "Analyse & audit",
  rest:     "Rest",
};

export const TASK_COLORS: Record<ContentTask, string> = {
  draft:    "#5070a0",
  edit:     "#3a6030",
  design:   "#9060b0",
  research: "#5a7a80",
  ideate:   "#c08040",
  pitch:    "#a05030",
  publish:  "#c04060",
  analyze:  "#808080",
  rest:     "#b0a890",
};

export const ROLE_COLORS: Record<ContentDay["role"], string> = {
  launch:   "#c04060",
  create:   "#5070a0",
  edit:     "#3a6030",
  research: "#5a7a80",
  rest:     "#b0a890",
};
