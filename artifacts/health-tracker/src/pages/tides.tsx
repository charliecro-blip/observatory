import { useQuery } from "@tanstack/react-query";
import { useTester } from "@/contexts/tester-context";
import { Loader2, Moon, Sparkles, Clock, CalendarDays, ChevronRight, Activity, Star, FolderOpen, Sprout, Check } from "lucide-react";
import {
  ELEMENT_ICONS, ELEMENT_BADGE_CLS, ELEMENT_DOT_CLS, ELEMENT_COLOR_CLS,
  ELEMENT_LABELS, ELEMENT_CARD_CLS,
  type ElementKey,
} from "@/lib/elements";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlanetAspect {
  planet1: string;
  planet2: string;
  aspect: string;
  nature: string;
  exactAngle: number;
  orb: number;
  applying: boolean;
}

interface AngularPlanet {
  planet: string;
  angle: "ASC" | "MC" | "DSC" | "IC";
  orb: number;
  longitude: number;
  benefic: boolean;
  malefic: boolean;
}

interface LocalAngles {
  asc: number;
  mc: number;
  dsc: number;
  ic: number;
  ascSign: string;
  mcSign: string;
}

interface TidesNow {
  momentLabel: string;
  dayRuler: string;
  quality: "excellent" | "good" | "workable" | "mixed" | "avoid_if_possible";
  element: { element: ElementKey; source: string; moonSign: string; voidOfCourse: boolean; biodynamicType: string };
  planetaryHour: {
    ruler: string;
    hourNumber: number;
    isDayHour: boolean;
    prompt: string;
    supports: string[];
    cautions: string[];
    startTime: string;
    endTime: string;
  };
  voidOfCourse: boolean;
  moonPhase: string;
  moonFraction: number;
  moonSign: string;
  sunSign: string;
  retrogrades: string[];
  invitation: string;
  personalTransits: PersonalTransit[];
  moonAspects: PlanetAspect[];
  aspects: PlanetAspect[];
  angularPlanets: AngularPlanet[];
  localAngles: LocalAngles;
  lastMoonAspect: LastMoonAspect | null;
}

interface TidesWindow {
  startTime: string;
  endTime: string;
  element: ElementKey;
  voidOfCourse: boolean;
  planetaryHour: string;
  quality: string;
}

interface AngularCrossing {
  planet: string;
  angle: "ASC" | "MC" | "DSC" | "IC";
  crossingTime: string;
  minutesFromNow: number;
  durationMinutes: number;
  orbAtExact: number;
  benefic: boolean;
  malefic: boolean;
  interpretation: string;
}

interface PersonalTransit {
  transitPlanet: string;
  aspect: string;
  natalPlanet: string;
  natalSign: string;
  natalHouse: number;
  orb: number;
  exact: boolean;
  severity: "mild" | "moderate" | "strong" | "major";
  summary: string;
}

interface PlanningWindow {
  id: number;
  title: string;
  windowType: string;
  startTime: string;
  endTime: string;
  projectId: number | null;
}

interface ScoredPractice {
  id: number;
  title: string;
  domain: string;
  elements: string[] | null;
  element: string | null;
  frequency: string;
  minimumViable: string | null;
  match: "resonant" | "supported" | "neutral" | "soften" | "protect";
  recommendation: string;
  todayCheckIn: { completed: boolean } | null;
}

interface LastMoonAspect {
  planet: string;
  aspect: string;
  nature: string;
  orbAtExact: number;
  hoursAgo: number;
  benefic: boolean;
  malefic: boolean;
}

interface TidesWeek {
  weekOf: string;
  weekTone: string;
  weekElement: string;
  days: Array<{
    date: string;
    dayLabel: string;
    moonSign: string;
    moonPhase: string;
    element: ElementKey;
    voidPeriods: boolean;
    quality: string;
    bestFor: string[];
    tone: string;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const QUALITY_LABEL: Record<string, string> = {
  excellent:        "Excellent",
  good:             "Good",
  workable:         "Workable",
  mixed:            "Mixed",
  avoid_if_possible: "Avoid if possible",
};

const QUALITY_CLS: Record<string, string> = {
  excellent:        "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  good:             "text-sky-300 bg-sky-500/10 border-sky-500/20",
  workable:         "text-amber-300 bg-amber-500/10 border-amber-500/20",
  mixed:            "text-orange-300 bg-orange-500/10 border-orange-500/20",
  avoid_if_possible:"text-red-300 bg-red-500/10 border-red-500/20",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDayHeader(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function moonPhaseGlyph(phaseName: string, fraction: number): string {
  if (phaseName.includes("New"))            return "🌑";
  if (phaseName.includes("Waxing Crescent")) return "🌒";
  if (phaseName.includes("First Quarter"))   return "🌓";
  if (phaseName.includes("Waxing Gibbous"))  return "🌔";
  if (phaseName.includes("Full"))            return "🌕";
  if (phaseName.includes("Waning Gibbous"))  return "🌖";
  if (phaseName.includes("Last Quarter"))    return "🌗";
  return "🌘";
}

// ── Component ─────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().split("T")[0]; }

const WINDOW_TYPE_LABELS: Record<string, string> = {
  deep_work: "Deep Work", planning: "Planning", creative: "Creative",
  admin: "Admin", social: "Social", relationship: "Relationship",
  recovery: "Recovery", retreat: "Retreat", launch: "Launch", study: "Study",
};

export default function TidesPage() {
  const { profile } = useTester();
  const testerId = profile?.testerId ?? null;
  const headers = { "x-tester-id": testerId ?? "" };

  const { data: natal } = useQuery<{ birthLat: number; birthLon: number } | null>({
    queryKey: ["natal-chart-location", testerId],
    queryFn: () => fetch("/api/natal-chart", { headers }).then((r) => r.ok ? r.json() : null).catch(() => null),
    staleTime: Infinity,
  });

  const lat = natal?.birthLat ?? 40.7;
  const lon = natal?.birthLon ?? -74.0;
  const locationParams = `lat=${lat}&lon=${lon}`;

  const { data: now, isLoading: nowLoading } = useQuery<TidesNow>({
    queryKey: ["tides-now", lat, lon, testerId],
    queryFn: () => fetch(`/api/tides/now?${locationParams}`, { headers }).then((r) => r.json()),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });

  const { data: todayWindows = [] } = useQuery<PlanningWindow[]>({
    queryKey: ["planning-windows-tides", testerId, todayStr()],
    queryFn: () => fetch(`/api/planning/windows?date=${todayStr()}`, { headers }).then((r) => r.ok ? r.json() : []),
    enabled: !!testerId,
    staleTime: 60_000,
  });

  const { data: practicesData } = useQuery<{ practices: ScoredPractice[] }>({
    queryKey: ["tides-practices", lat, lon, testerId],
    queryFn: () => fetch(`/api/tides/practices?${locationParams}`, { headers }).then((r) => r.ok ? r.json() : null),
    enabled: !!testerId,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });

  const { data: windows } = useQuery<{ windows: TidesWindow[] }>({
    queryKey: ["tides-windows", lat, lon],
    queryFn: () => fetch(`/api/tides/windows?hours=10&${locationParams}`).then((r) => r.json()),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });

  const { data: week } = useQuery<TidesWeek>({
    queryKey: ["tides-week"],
    queryFn: () => fetch("/api/tides/week").then((r) => r.json()),
    staleTime: 30 * 60 * 1000,
  });

  const { data: crossingsData } = useQuery<{ crossings: AngularCrossing[] }>({
    queryKey: ["tides-crossings", lat, lon],
    queryFn: () => fetch(`/api/tides/crossings?hours=12&${locationParams}`).then((r) => r.json()),
    refetchInterval: 10 * 60 * 1000,
    staleTime: 9 * 60 * 1000,
  });

  if (nowLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  const el = now?.element?.element ?? "water";
  const ElIcon = ELEMENT_ICONS[el];
  const elColor = ELEMENT_COLOR_CLS[el];
  const elCard  = ELEMENT_CARD_CLS[el];
  const elBadge = ELEMENT_BADGE_CLS[el];

  // Collapse adjacent windows with same element into blocks
  const upcomingWindows = (windows?.windows ?? []).slice(1, 6); // skip current window

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8 pb-20">

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground/50 text-xs mb-2">
          <Moon className="w-3 h-3" />
          <span>{now?.moonPhase}</span>
          {now && <span>·</span>}
          <span>Moon in {now?.moonSign}</span>
          {now?.sunSign && <><span>·</span><span>Sun in {now.sunSign}</span></>}
        </div>
        <h1 className="font-serif text-2xl text-foreground tracking-wide">
          What kind of time is this?
        </h1>
        <p className="text-sm text-muted-foreground">{formatDayHeader()}</p>
      </div>

      {/* Now card */}
      {now && (
        <div className={`rounded-2xl border p-6 space-y-4 ${elCard}`}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-background/40 border border-border/20">
              <ElIcon className={`w-6 h-6 ${elColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-xs font-semibold uppercase tracking-widest ${elColor}`}>
                  {now.voidOfCourse ? "Void of course" : `${ELEMENT_LABELS[el]} field`}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${QUALITY_CLS[now.quality] ?? QUALITY_CLS.good}`}>
                  {QUALITY_LABEL[now.quality]}
                </span>
                {now.retrogrades.length > 0 && (
                  <span className="text-[10px] text-muted-foreground/40">
                    ℞ {now.retrogrades.join(", ")}
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed">{now.invitation}</p>
            </div>
          </div>

          {/* Planetary hour */}
          <div className="rounded-xl bg-background/30 border border-border/20 px-4 py-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground/50" />
              <span className="text-xs text-muted-foreground/60 font-medium">
                {now.planetaryHour.ruler} hour {now.planetaryHour.isDayHour ? "(day)" : "(night)"}
                {" · "}{formatTime(now.planetaryHour.startTime)}–{formatTime(now.planetaryHour.endTime)}
              </span>
            </div>
            <p className="text-xs text-foreground/60 italic pl-5 leading-relaxed">
              {now.planetaryHour.prompt}
            </p>
          </div>

          {/* Supports */}
          {now.planetaryHour.supports.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest">
                {now.voidOfCourse ? "Good for" : "This window supports"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {now.planetaryHour.supports.map((s) => (
                  <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-background/40 border border-border/30 text-foreground/60">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Cautions (VOC or otherwise) */}
          {now.planetaryHour.cautions.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest">Move gently around</p>
              <div className="flex flex-wrap gap-1.5">
                {now.planetaryHour.cautions.map((s) => (
                  <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/5 border border-orange-500/15 text-orange-300/60">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Moon's applying aspects */}
          {(now.moonAspects ?? []).filter((a) => a.applying).length > 0 && (
            <div className="space-y-1.5 border-t border-border/10 pt-3">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest">Moon applying to</p>
              <div className="flex flex-wrap gap-1.5">
                {now.moonAspects.filter((a) => a.applying).map((a) => {
                  const other = a.planet1 === "Moon" ? a.planet2 : a.planet1;
                  const isSoft = a.aspect === "trine" || a.aspect === "sextile" || a.aspect === "conjunction";
                  return (
                    <span
                      key={`${other}-${a.aspect}`}
                      className={`text-[11px] px-2 py-0.5 rounded-full border ${
                        isSoft
                          ? "bg-emerald-500/5 border-emerald-500/15 text-emerald-300/70"
                          : "bg-orange-500/5 border-orange-500/15 text-orange-300/70"
                      }`}
                    >
                      {a.aspect} {other} ({a.orb}°)
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Angular planets */}
          {(now.angularPlanets ?? []).length > 0 && (
            <div className="space-y-1.5 border-t border-border/10 pt-3">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest">On the angles</p>
              <div className="flex flex-wrap gap-1.5">
                {now.angularPlanets.map((ap) => (
                  <span
                    key={`${ap.planet}-${ap.angle}`}
                    className={`text-[11px] px-2 py-0.5 rounded-full border ${
                      ap.benefic
                        ? "bg-emerald-500/5 border-emerald-500/15 text-emerald-300/70"
                        : ap.malefic
                        ? "bg-orange-500/5 border-orange-500/15 text-orange-300/70"
                        : "bg-background/30 border-border/20 text-foreground/50"
                    }`}
                  >
                    {ap.planet} conjunct {ap.angle} ({ap.orb}°)
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Last Moon aspect — characterizes the day's residue */}
          {now.lastMoonAspect && (
            <div className="border-t border-border/10 pt-2.5 space-y-0.5">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest">Last Moon aspect</p>
              <p className={`text-[11px] ${now.lastMoonAspect.benefic ? "text-emerald-300/60" : now.lastMoonAspect.malefic ? "text-orange-300/60" : "text-foreground/45"}`}>
                {now.lastMoonAspect.aspect} {now.lastMoonAspect.planet}
                {" "}({now.lastMoonAspect.hoursAgo}h ago · {now.lastMoonAspect.nature})
                {now.voidOfCourse && " — this aspect colors the void period"}
              </p>
            </div>
          )}

          {/* Biodynamic day type + rising/MC */}
          {now.element?.biodynamicType && (
            <div className="border-t border-border/10 pt-2.5 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-[10px] text-muted-foreground/35 italic">
                {now.element.biodynamicType} day · {now.dayRuler} day
                {now.localAngles && ` · ${now.localAngles.ascSign} rising · ${now.localAngles.mcSign} at midheaven`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Personal transits */}
      {(now?.personalTransits ?? []).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-muted-foreground/40" />
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Your transits now</h2>
          </div>
          <div className="space-y-1.5">
            {(now?.personalTransits ?? []).map((t, i) => {
              const isStress = t.aspect === "square" || t.aspect === "opposition";
              const isFlow   = t.aspect === "trine" || t.aspect === "sextile";
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
                    isStress ? "border-orange-500/15 bg-orange-500/5"
                    : isFlow  ? "border-emerald-500/15 bg-emerald-500/5"
                    : "border-border/20 bg-card/20"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className={`text-xs font-medium ${
                        isStress ? "text-orange-300/80" : isFlow ? "text-emerald-300/80" : "text-foreground/70"
                      }`}>
                        {t.summary}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                        t.severity === "major" ? "border-red-500/30 text-red-300/70 bg-red-500/5"
                        : t.severity === "strong" ? "border-amber-500/30 text-amber-300/70 bg-amber-500/5"
                        : "border-border/30 text-muted-foreground/50"
                      }`}>
                        {t.severity}
                      </span>
                      {t.exact && (
                        <span className="text-[10px] text-muted-foreground/40 italic">exact</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground/50">
                      House {t.natalHouse} · natal {t.natalPlanet} in {t.natalSign}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Practices timing */}
      {(practicesData?.practices ?? []).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sprout className="w-3.5 h-3.5 text-muted-foreground/40" />
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Practices now</h2>
          </div>
          <div className="space-y-1.5">
            {(practicesData?.practices ?? [])
              .filter((p) => p.match !== "neutral")
              .slice(0, 6)
              .map((p) => {
                const tended = p.todayCheckIn?.completed === true;
                const matchColors: Record<string, string> = {
                  resonant:  "border-emerald-500/25 bg-emerald-500/5",
                  supported: "border-sky-500/20 bg-sky-500/5",
                  soften:    "border-amber-500/20 bg-amber-500/5",
                  protect:   "border-red-500/15 bg-red-500/5",
                };
                const matchLabel: Record<string, string> = {
                  resonant:  "resonant",
                  supported: "supported",
                  soften:    "soften",
                  protect:   "protect min",
                };
                const matchText: Record<string, string> = {
                  resonant:  "text-emerald-300/80",
                  supported: "text-sky-300/80",
                  soften:    "text-amber-300/80",
                  protect:   "text-red-300/70",
                };
                return (
                  <div
                    key={p.id}
                    className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${tended ? "opacity-50" : ""} ${matchColors[p.match] ?? "border-border/20 bg-card/20"}`}
                  >
                    <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                      tended ? "bg-chart-2 border-chart-2" : "border-border/40"
                    }`}>
                      {tended && <Check className="w-2.5 h-2.5 text-background" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className={`text-xs font-medium ${tended ? "line-through text-muted-foreground/40" : "text-foreground/85"}`}>
                          {p.title}
                        </span>
                        <span className={`text-[10px] font-medium ${matchText[p.match]}`}>
                          {matchLabel[p.match]}
                        </span>
                      </div>
                      {!tended && (
                        <p className="text-[11px] text-muted-foreground/50 leading-relaxed">
                          {p.recommendation}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Today's planning windows */}
      {todayWindows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-3.5 h-3.5 text-muted-foreground/40" />
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Today's windows</h2>
          </div>
          <div className="space-y-1.5">
            {todayWindows.map((w) => {
              const now2 = new Date();
              const isActive = new Date(w.startTime) <= now2 && new Date(w.endTime) >= now2;
              return (
                <div
                  key={w.id}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${
                    isActive ? "border-sky-500/30 bg-sky-500/10" : "border-border/20 bg-card/20"
                  }`}
                >
                  <Clock className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-sky-400" : "text-muted-foreground/30"}`} />
                  <span className="text-xs text-muted-foreground/60 flex-shrink-0">
                    {formatTime(w.startTime)}–{formatTime(w.endTime)}
                  </span>
                  <span className={`text-xs flex-1 min-w-0 truncate ${isActive ? "text-sky-300" : "text-foreground/70"}`}>
                    {w.title}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-border/20 text-muted-foreground/40 flex-shrink-0">
                    {WINDOW_TYPE_LABELS[w.windowType] ?? w.windowType}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Coming up */}
      {upcomingWindows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Coming up</h2>
          </div>
          <div className="space-y-1.5">
            {upcomingWindows.map((w) => {
              const wEl = w.element as ElementKey;
              const WIcon = ELEMENT_ICONS[wEl];
              return (
                <div
                  key={w.startTime}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border/20 bg-card/20"
                >
                  <WIcon className={`w-3.5 h-3.5 flex-shrink-0 ${ELEMENT_COLOR_CLS[wEl]}`} />
                  <span className="text-xs text-muted-foreground/60 flex-shrink-0">
                    {formatTime(w.startTime)}–{formatTime(w.endTime)}
                  </span>
                  <span className="text-xs text-foreground/70 flex-1 min-w-0 truncate">
                    {w.voidOfCourse ? "Void moon — rest, review, release" : `${w.planetaryHour} hour · ${ELEMENT_LABELS[wEl]} tone`}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${QUALITY_CLS[w.quality] ?? QUALITY_CLS.good}`}>
                    {QUALITY_LABEL[w.quality]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Angular crossings */}
      {(crossingsData?.crossings ?? []).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-muted-foreground/40" />
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Angles (next 12h)</h2>
          </div>
          <div className="space-y-1.5">
            {(crossingsData?.crossings ?? []).slice(0, 6).map((c) => {
              const hrs  = Math.floor(c.minutesFromNow / 60);
              const mins = c.minutesFromNow % 60;
              const timeLabel = c.minutesFromNow < 1
                ? "now"
                : c.minutesFromNow < 60
                ? `in ${c.minutesFromNow}m`
                : `in ${hrs}h ${mins > 0 ? `${mins}m` : ""}`;
              return (
                <div
                  key={`${c.planet}-${c.angle}-${c.minutesFromNow}`}
                  className={`flex items-start gap-3 px-4 py-2.5 rounded-xl border ${
                    c.benefic ? "border-emerald-500/15 bg-emerald-500/5"
                    : c.malefic ? "border-orange-500/15 bg-orange-500/5"
                    : "border-border/15 bg-card/15"
                  }`}
                >
                  <div className="flex-shrink-0 pt-0.5 text-right w-16">
                    <p className={`text-xs font-medium ${c.benefic ? "text-emerald-300/80" : c.malefic ? "text-orange-300/80" : "text-foreground/60"}`}>
                      {formatTime(c.crossingTime)}
                    </p>
                    <p className="text-[10px] text-muted-foreground/40">{timeLabel}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${c.benefic ? "text-emerald-300/80" : c.malefic ? "text-orange-300/80" : "text-foreground/70"}`}>
                      {c.planet} conjunct {c.angle}
                      <span className="text-muted-foreground/40 font-normal ml-1">~{c.durationMinutes}m window</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 leading-relaxed mt-0.5">
                      {c.interpretation}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week rhythm */}
      {week && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground/40" />
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Week of {week.weekOf}
            </h2>
          </div>

          {/* Week tone */}
          <div className="rounded-xl border border-border/20 bg-card/20 px-5 py-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-3.5 h-3.5 text-muted-foreground/30 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/70 leading-relaxed italic">{week.weekTone}</p>
            </div>
          </div>

          {/* Day-by-day */}
          <div className="grid gap-1.5">
            {week.days.map((day) => {
              const dEl = day.element as ElementKey;
              const DIcon = ELEMENT_ICONS[dEl];
              const isToday = day.date === new Date().toISOString().split("T")[0];
              return (
                <div
                  key={day.date}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${
                    isToday
                      ? `${ELEMENT_CARD_CLS[dEl]} ring-1 ring-inset ring-primary/20`
                      : "border-border/15 bg-card/10"
                  }`}
                >
                  <div className="w-20 flex-shrink-0">
                    <p className={`text-xs font-medium ${isToday ? ELEMENT_COLOR_CLS[dEl] : "text-foreground/60"}`}>
                      {day.dayLabel}
                    </p>
                    <p className="text-[10px] text-muted-foreground/40">{day.date.slice(5)}</p>
                  </div>
                  <DIcon className={`w-3 h-3 flex-shrink-0 ${ELEMENT_COLOR_CLS[dEl]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground/70 truncate">
                      <span className="mr-1">{moonPhaseGlyph(day.moonPhase, 0)}</span>
                      Moon in {day.moonSign}
                      {day.voidPeriods && <span className="text-muted-foreground/40 ml-1">· void window</span>}
                    </p>
                  </div>
                  <div className="flex gap-1 items-center flex-shrink-0">
                    {day.bestFor.slice(0, 2).map((b) => (
                      <span key={b} className={`hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-full border ${ELEMENT_BADGE_CLS[dEl]}`}>
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
