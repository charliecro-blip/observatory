import React, { useState, useEffect, useRef } from "react";
import { fetchJson } from "@/lib/fetchJson";
import { localToday, addDaysLocal } from "@/lib/dates";
import { invalidateWindows } from "@/lib/invalidateWindows";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNorthStars, useCurrents } from "@/hooks/useTides";
import { ELEMENT_MYTHOS, type ElementMythos } from "@/lib/mythos";
import { ActivityTimesHint } from "@/components/ActivityTimesHint";
import { useTester } from "@/contexts/tester-context";
import { CAUTION_PLANET_ARCHETYPE } from "@/lib/tester-profile";
import { HOUSE_MEANINGS } from "@/lib/currents-content";
import { ScheduleSuggest } from "@/components/ScheduleSuggest";
import TransitTake from "@/components/TransitTake";
import { PLANET_GLYPH } from "@/lib/glyphs";
import Glyph from "@/components/Glyph";
import { aiErrorMessage } from "@/lib/aiError";
import { PLANET_COLORS } from "@/lib/planetColors";
import { ELEMENT_COLORS } from "@/lib/elements";
import { starsNeedingLook } from "@/lib/checkInState";
import { servesStar } from "@/lib/starLinks";
import { scrollBehavior } from "@/lib/reducedMotion";

const ELEMENTS = ["fire", "earth", "air", "water"] as const;
const MAX_ACTIVE_STARS = 5;


const ELEMENT_INFO: Record<string, { color: string; label: string }> = {
  fire:  { color: "#c04830", label: "Fire" },
  earth: { color: ELEMENT_COLORS.earth, label: "Earth" },
  air:   { color: ELEMENT_COLORS.air, label: "Air" },
  water: { color: ELEMENT_COLORS.water, label: "Water" },
};

const HORIZON_COLORS: Record<string, { bg: string; color: string }> = {
  near: { bg: "#dbeafe", color: "#2a5a90" },
  mid:  { bg: "#f0e8d8", color: "#8a5020" },
  long: { bg: "#e8d8f0", color: ELEMENT_COLORS.air },
};

// The seven classical rulers a Guiding Star can be diagnosed to — planets drive
// scheduling more precisely than elements (Mars→training, Mercury→study).
const STAR_PLANETS = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"] as const;
const PLANET_PICK_COLOR = PLANET_COLORS;

// A step whose wording implies "do this over and over" is really a habit, not a
// one-off task — used to pre-highlight "make it a habit" on the step.
const RECURRING_STEP_RE = /\b(consistent(ly)?|regularly|routine|daily|weekly|monthly|every ?day|each ?day|keep (up|going)|ongoing|maintain|practice|show up|stay|habitual)\b/i;
const looksRecurring = (title: string) => RECURRING_STEP_RE.test(title);

function houseSystemPref(): string {
  return localStorage.getItem("obs_house_system") ?? "whole-sign";
}

const ordinal = (n: number) => { const v = n % 100; const s = ["th", "st", "nd", "rd"]; return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`; };
const fmtMonth = (iso: string | null | undefined) => iso ? new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" }) : null;
const fmtDay = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const daysUntil = (iso: string | null | undefined) =>
  iso ? Math.round((new Date(iso + "T12:00:00").getTime() - Date.now()) / 86400000) : null;

const anchorLabel = (g: any) =>
  g.anchorKind === "chapter" ? `rides ${g.anchorPlanet} through your ${ordinal(g.anchorHouse)}`
    : g.anchorKind === "transit" ? `rides a ${g.anchorPlanet} transit to your ${ordinal(g.anchorHouse)}`
    : `rides your ${ordinal(g.anchorHouse)}-house year`;

// House → element by triplicity: 1/5/9 fire, 2/6/10 earth, 3/7/11 air, 4/8/12 water.
const houseElement = (h: number) => (["water", "fire", "earth", "air"] as const)[h % 4];

const horizonFromUntil = (until: string | null) => {
  if (!until) return "long";
  const months = (new Date(until + "T12:00:00").getTime() - Date.now()) / (30.44 * 86400000);
  return months <= 6 ? "near" : months <= 18 ? "mid" : "long";
};

interface PendingAnchor {
  kind: "chapter" | "profection" | "transit";
  planet?: string;
  house: number;
  until: string | null;
  element: string;
  label: string;
}

function authH(tid: string | null) {
  return { ...(tid ? { "x-tester-id": tid } : {}), "Content-Type": "application/json" };
}

/**
 * Guiding Stars — the app's only long-term-ideal surface (Goals as a separate
 * concept is gone; every row here IS a Guiding Star). Creating one, seeing
 * what season backs it, and breaking it into tasks/habits all happen in this
 * one page — no second "manage in Goals" tab to bounce to.
 */
export default function GuidingStarsHub({ testerId, lat = 40.7, lon = -74.0, onNavigate, seedElement, onSeedConsumed, focusStarId, onFocusConsumed }: {
  testerId: string | null;
  lat?: number; lon?: number;
  onNavigate: (tab: "tasks" | "habits") => void;
  seedElement?: string | null;
  onSeedConsumed?: () => void;
  focusStarId?: number | null;
  onFocusConsumed?: () => void;
}) {
  const qc = useQueryClient();
  const { data: stars, isLoading, isError: starsError } = useNorthStars(testerId);
  // CAUTION PERIODS ARE NOT PAID any more. They are natal-derived, and the
  // pricing decision (2026-08-19) turned natal down as the paid axis — the
  // engine treats chartless as first-class, so charging here would charge for
  // the thing the architecture was built to make optional. Kept as a named
  // constant rather than deleted at every use site, so what changed stays
  // legible and the gate is one edit away if the line ever moves back.
  const premiumUnlocked = true;
  const { profile } = useTester();
  const { data: currentsData } = useCurrents(testerId, houseSystemPref());
  const cautionPlanets = profile?.cautionPlanets;
  const activeCautionMatches = premiumUnlocked && cautionPlanets && cautionPlanets.length > 0
    ? (currentsData?.cautionWindows ?? []).filter((t: any) => cautionPlanets.includes(t.cautionPlanet))
    : [];

  const [showForm, setShowForm] = useState(false);
  const [expandedWeather, setExpandedWeather] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", horizon: "near", element: "", planet: "" });
  const [pendingAnchor, setPendingAnchor] = useState<PendingAnchor | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showSeasons, setShowSeasons] = useState(false);
  // The sky's reading of the aim — auto-diagnosed from the title as you type.
  // We suggest an element + planet from it but never force them; form.element /
  // form.planet hold only an EXPLICIT override (empty = "use the reading").
  const [diagnosis, setDiagnosis] = useState<{ element: string; planets: string[]; rationale: string; windowType?: string; activityKey?: string; houses?: number[]; source?: string } | null>(null);
  useEffect(() => {
    const text = `${form.title} ${form.description}`.trim();
    if (text.length < 3) { setDiagnosis(null); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/associate", { method: "POST", headers: authH(testerId), body: JSON.stringify({ text }) });
        if (!r.ok || cancelled) return;
        setDiagnosis(await r.json());
      } catch { /* the reading is optional — creation works without it */ }
    }, 450);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.title, form.description, testerId]);
  // What we'll actually save: the user's pick if they made one, else the reading.
  const effElement = form.element || diagnosis?.element || "";
  const effPlanet = form.planet || diagnosis?.planets?.[0] || "";
  // The planet and element pickers are OVERRIDES, not questions. Asking a
  // first-time user to choose a ruling planet before their first star exists
  // is asking them to know the system to use the system — so the reading
  // stands by default and the pickers wait behind one line (beta pass §5).
  const [showTimingOverrides, setShowTimingOverrides] = useState(false);
  // The star that was just created, holding the "what's one next move?" ask.
  const [nextMoveFor, setNextMoveFor] = useState<{ goalId: number; title: string; element?: string } | null>(null);
  const [nextMoveTitle, setNextMoveTitle] = useState("");

  // Landed here from the morning glance: scroll that star's card into view and
  // hold a brief highlight so the eye lands on the game plan it came for.
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [highlightId, setHighlightId] = useState<number | null>(null);
  useEffect(() => {
    if (focusStarId == null || !stars) return;
    const el = cardRefs.current[focusStarId];
    if (el) {
      el.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
      setHighlightId(focusStarId);
      const t = setTimeout(() => setHighlightId(null), 2400);
      onFocusConsumed?.();
      return () => clearTimeout(t);
    }
    return undefined;
  }, [focusStarId, stars]);

  // Landed here from "Set a Guiding Star in this element" in the Almanac: open
  // the creation form with the element pre-chosen, then clear the seed so it
  // doesn't re-fire on the next render (#25).
  useEffect(() => {
    if (!seedElement) return;
    setForm(f => ({ ...f, element: seedElement }));
    setShowForm(true);
    onSeedConsumed?.();
  }, [seedElement]);

  const list: any[] = stars ?? [];
  // Read once per render rather than held in state: the check-in can be
  // edited in another tab, and a stale copy here would contradict it.
  const needsLook = starsNeedingLook();
  // useNorthStars only returns active goals server-side today — fetch all so
  // paused ones can be shown/resumed here too, without a separate tab.
  const { data: allGoals = [] } = useQuery<any[]>({
    queryKey: ["goals", testerId],
    queryFn: async () => { const r = await fetch("/api/planning/goals", { headers: authH(testerId) }); const j = await r.json(); return Array.isArray(j) ? j : []; },
    enabled: !!testerId,
  });
  const pausedGoals = allGoals.filter((g: any) => g.status === "paused");

  const authHeaders = { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) } as Record<string, string>;
  const { data: allTasks = [] } = useQuery<any[]>({
    queryKey: ["tasks", testerId, "all"],
    queryFn: async () => { const j = await fetchJson("/api/tasks", { headers: authHeaders }); return Array.isArray(j) ? j : []; },
    enabled: !!testerId,
  });
  const { data: allHabits = [] } = useQuery<any[]>({
    queryKey: ["habits", testerId],
    queryFn: async () => { const j = await fetchJson(`/api/habits?today=${localToday()}`, { headers: authHeaders }); return Array.isArray(j) ? j : []; },
    enabled: !!testerId,
  });
  // Steps (milestones) — the one useful bit of the old Projects tab, folded in.
  // A star's "steps" live on a backing project (goalId = star.id); the word
  // "project" never appears — it's just an ordered checklist toward the star.
  const { data: allProjects = [] } = useQuery<any[]>({
    queryKey: ["projects", testerId],
    queryFn: async () => { const j = await (await fetch("/api/planning/projects?status=active", { headers: authHeaders })).json(); return Array.isArray(j) ? j : []; },
    enabled: !!testerId,
  });
  const { data: allMilestones = [] } = useQuery<any[]>({
    queryKey: ["milestones", testerId],
    queryFn: async () => { const j = await (await fetch("/api/planning/milestones", { headers: authHeaders })).json(); return Array.isArray(j) ? j : []; },
    enabled: !!testerId,
  });
  const projectForStar = (starId: number) => allProjects.find((p: any) => p.goalId === starId);
  const stepsForStar = (starId: number) => {
    const proj = projectForStar(starId);
    return proj ? allMilestones.filter((m: any) => m.projectId === proj.id) : [];
  };

  // Project facilitation: the server-computed progress rollup (task → step →
  // star). Tasks are already loaded above as `allTasks`; group them by step.
  const { data: starProgress = {} } = useQuery<Record<string, any>>({
    queryKey: ["star-progress", testerId],
    queryFn: async () => { const j = await (await fetch("/api/planning/star-progress", { headers: authHeaders })).json(); return (j && typeof j === "object" && !Array.isArray(j)) ? j : {}; },
    enabled: !!testerId,
  });
  const tasksForStep = (milestoneId: number) => (allTasks as any[]).filter((t) => t.milestoneId === milestoneId);

  const [stepAdd, setStepAdd] = useState<number | null>(null);
  const [stepTitle, setStepTitle] = useState("");
  // Adding a task under a specific step
  const [stepTaskAdd, setStepTaskAdd] = useState<number | null>(null);
  const [stepTaskTitle, setStepTaskTitle] = useState("");
  const refreshPM = () => {
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["star-progress"] });
    qc.invalidateQueries({ queryKey: ["milestones"] });
  };
  const addTaskToStep = useMutation({
    mutationFn: async ({ milestoneId, starId, title, element }: { milestoneId: number; starId: number; title: string; element?: string }) => {
      const windowType = element === "fire" ? "creative" : element === "earth" ? "deep_work" : element === "air" ? "planning" : element === "water" ? "recovery" : undefined;
      const r = await fetch("/api/tasks", { method: "POST", headers: authHeaders, body: JSON.stringify({ title, goalId: starId, milestoneId, bestWindowType: windowType }) });
      if (!r.ok) throw new Error("add task failed"); // was silent — the form closed and the task vanished on failure
    },
    onSuccess: () => { refreshPM(); setStepTaskAdd(null); setStepTaskTitle(""); },
  });
  // A recurring-sounding step ("post consistently", "practice daily") is really
  // a habit, not a one-off task — so we offer to turn it into one, pre-selected
  // when the wording gives it away.
  const addHabitFromStep = useMutation({
    mutationFn: async ({ milestoneId, starId, title, element, planet }: { milestoneId: number; starId: number; title: string; element?: string; planet?: string }) => {
      const r = await fetch("/api/habits", { method: "POST", headers: authHeaders, body: JSON.stringify({
        name: title, goalId: starId, milestoneId,
        favoredElements: element || undefined, favoredPlanets: planet || undefined,
      }) });
      if (!r.ok) throw new Error("habit failed");
    },
    onSuccess: () => { refreshPM(); qc.invalidateQueries({ queryKey: ["habits"] }); qc.invalidateQueries({ queryKey: ["star-progress"] }); },
  });
  const toggleStepTask = useMutation({
    mutationFn: async ({ id, done }: { id: number; done: boolean }) => {
      { const _r = await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: authHeaders, body: JSON.stringify({ done: !done }) }); if (!_r.ok) throw new Error(`request failed (${_r.status})`); }
    },
    onSuccess: refreshPM,
  });

  // AI milestone breakdown — propose steps for a big star, review, accept.
  const [breakdownFor, setBreakdownFor] = useState<number | null>(null);
  const [proposedSteps, setProposedSteps] = useState<{ title: string; element: string }[]>([]);
  const runBreakdown = useMutation({
    mutationFn: async ({ title, description }: { title: string; description?: string }) => {
      const r = await fetch("/api/planning/breakdown", { method: "POST", headers: authHeaders, body: JSON.stringify({ title, description }) });
      // Was unchecked: on a 429 the steps came back empty, the button that
      // triggered this hid itself (it's gated on breakdownFor), and NOTHING
      // rendered — the feature silently vanished with no way to retry.
      if (!r.ok) throw new Error(await aiErrorMessage(r));
      return (await r.json()).milestones as { title: string; element: string }[];
    },
    onSuccess: (steps) => setProposedSteps(steps ?? []),
  });
  const commitBreakdown = useMutation({
    mutationFn: async ({ goalId }: { goalId: number }) => {
      const r = await fetch("/api/planning/breakdown/commit", { method: "POST", headers: authHeaders, body: JSON.stringify({ goalId, milestones: proposedSteps }) });
      if (!r.ok) throw new Error("Couldn't save those steps — try again.");
    },
    onSuccess: () => { refreshPM(); qc.invalidateQueries({ queryKey: ["projects"] }); setBreakdownFor(null); setProposedSteps([]); },
  });

  // Weave the whole star: gather its open tasks in step order and hand them to
  // the planner, staggering soft deadlines by step so earlier steps schedule
  // first (the timing-aware plan the design doc calls for). Commits directly.
  const [weaveResult, setWeaveResult] = useState<{ starId: number; placed: number; unplaced: number } | null>(null);
  const weaveStar = useMutation({
    mutationFn: async ({ starId }: { starId: number }) => {
      const steps = stepsForStar(starId);
      const stepOrder = new Map(steps.map((m: any, i: number) => [m.id, i]));
      const open = (allTasks as any[])
        .filter((t) => t.goalId === starId && t.done !== "true" && t.milestoneId != null)
        .sort((a, b) => (stepOrder.get(a.milestoneId) ?? 99) - (stepOrder.get(b.milestoneId) ?? 99));
      if (open.length === 0) return { placed: 0, unplaced: 0 };
      // Soft deadline per step: step 0 within ~3 days, each later step +4 days,
      // so the deadline-first weaver keeps the sequence.
      const payload = open.map((t) => {
        const si = stepOrder.get(t.milestoneId) ?? 0;
        const due = addDaysLocal(localToday(), 3 + si * 4);
        return { title: t.title, estimatedMinutes: 45, energy: "medium", dueDate: due };
      });
      const wr = await fetch("/api/plan/weave", { method: "POST", headers: authHeaders, body: JSON.stringify({ tasks: payload, horizon: "month", lat, lon, tz: new Date().getTimezoneOffset() }) });
      // Was unchecked: a failed weave fell through to planned=[] and reported
      // "✓ Woven 0 onto your calendar" — indistinguishable from "nothing
      // needed scheduling", so the user never knew it had failed.
      if (!wr.ok) throw new Error(await aiErrorMessage(wr));
      const data = await wr.json();
      const planned = (data.planned ?? []).filter((p: any) => p.title);
      if (planned.length) {
        const cr = await fetch("/api/plan/commit", { method: "POST", headers: authHeaders, body: JSON.stringify({ items: planned }) });
        if (!cr.ok) throw new Error("Found times, but couldn't save them to your calendar — try again.");
      }
      return { placed: planned.length, unplaced: (data.unplaced ?? []).length };
    },
    onSuccess: (r, vars) => { refreshPM(); invalidateWindows(qc); setWeaveResult({ starId: vars.starId, ...r }); },
  });
  const addStep = useMutation({
    mutationFn: async ({ starId, starTitle, title }: { starId: number; starTitle: string; title: string }) => {
      let proj = projectForStar(starId);
      if (!proj) {
        const r = await fetch("/api/planning/projects", { method: "POST", headers: authHeaders, body: JSON.stringify({ title: starTitle, goalId: starId }) });
        // Unchecked, this parsed an ERROR BODY as a project: `proj.id` came
        // back undefined and the step below was created against no project at
        // all — a milestone orphaned from the star it belongs to, reported as
        // success.
        if (!r.ok) throw new Error(`request failed (${r.status})`);
        proj = await r.json();
      }
      { const _r = await fetch("/api/planning/milestones", { method: "POST", headers: authHeaders, body: JSON.stringify({ title, projectId: proj.id }) }); if (!_r.ok) throw new Error(`request failed (${_r.status})`); }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["milestones"] });
      qc.invalidateQueries({ queryKey: ["star-progress"] });
      setStepAdd(null); setStepTitle("");
    },
  });
  // Inline check-off — affirming a task or today's habit right on the star card,
  // so the review loop closes here instead of requiring a trip to Tasks/Habits.
  const completeTask = useMutation({
    mutationFn: async (id: number) => {
      { const _r = await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: authHeaders, body: JSON.stringify({ done: true }) }); if (!_r.ok) throw new Error(`request failed (${_r.status})`); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["north-stars"] }); },
  });
  const toggleHabitToday = useMutation({
    mutationFn: async ({ id, done }: { id: number; done: boolean }) => {
      const r = done
        ? await fetch(`/api/habits/${id}/log`, { method: "DELETE", headers: authHeaders })
        : await fetch(`/api/habits/${id}/log`, { method: "POST", headers: authHeaders, body: JSON.stringify({ date: localToday() }) });
      if (!r.ok) throw new Error(`request failed (${r.status})`);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["habits"] }); qc.invalidateQueries({ queryKey: ["north-stars"] }); },
  });

  const cycleStep = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const next = status === "pending" ? "in_progress" : status === "in_progress" ? "completed" : "pending";
      { const _r = await fetch(`/api/planning/milestones/${id}`, { method: "PATCH", headers: authHeaders, body: JSON.stringify({ status: next }) }); if (!_r.ok) throw new Error(`request failed (${_r.status})`); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["milestones"] }); qc.invalidateQueries({ queryKey: ["star-progress"] }); },
  });

  const addGoal = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        title: form.title, description: form.description, horizon: form.horizon,
        // The reading's element/planet unless the anchor season overrides element,
        // plus the matched activity key (unlocks the precise election engine).
        element: pendingAnchor ? pendingAnchor.element : (effElement || null),
        planet: effPlanet || null,
        activityKey: diagnosis?.activityKey ?? null,
      };
      if (pendingAnchor) {
        body.anchorKind = pendingAnchor.kind;
        body.anchorPlanet = pendingAnchor.planet ?? null;
        body.anchorHouse = pendingAnchor.house;
        body.anchorUntil = pendingAnchor.until;
      }
      const r = await fetch("/api/planning/goals", { method: "POST", headers: authH(testerId), body: JSON.stringify(body) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message ?? "Failed"); }
      return r.json();
    },
    onSuccess: (created: any) => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["north-stars"] });
      // A star with nothing under it is a wish. The one question that turns it
      // into work — "what's one next move?" — is asked here, in the same
      // breath, rather than left for the user to find later (beta pass §5:
      // acting on a recommendation tied to real work IS the activation event).
      if (created?.id) setNextMoveFor({ goalId: created.id, title: created.title, element: created.element ?? undefined });
      setForm({ title: "", description: "", horizon: "near", element: "", planet: "" });
      setDiagnosis(null); setShowTimingOverrides(false);
      setPendingAnchor(null); setShowForm(false); setFormError(null);
    },
    onError: (e: any) => setFormError(e.message),
  });

  /**
   * The date this one finishes, or null if it never does.
   *
   * A star and a project were living in one list under one word — "Aligned
   * Spine", which you hold, beside "Take Board Exams Quickly", which has a day
   * somebody else picked. A date here is a REAL deadline, unlike the anchor
   * beside it, which exists precisely to give a value a season instead of an
   * invented one. Both can be true at once: a project may still ride a chapter.
   */
  const setEndsOn = useMutation({
    mutationFn: async ({ id, endsOn }: { id: number; endsOn: string | null }) => {
      const r = await fetch(`/api/planning/goals/${id}`, {
        method: "PATCH", headers: authHeaders, body: JSON.stringify({ endsOn }),
      });
      if (!r.ok) throw new Error(`could not set the date (${r.status})`);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["north-stars"] }); qc.invalidateQueries({ queryKey: ["goals"] }); },
  });

  const clearAnchor = useMutation({
    mutationFn: async (id: number) => {
      { const _r = await fetch(`/api/planning/goals/${id}`, { method: "PATCH", headers: authH(testerId), body: JSON.stringify({ anchorKind: null, anchorPlanet: null, anchorHouse: null, anchorUntil: null }) }); if (!_r.ok) throw new Error(`request failed (${_r.status})`); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); qc.invalidateQueries({ queryKey: ["north-stars"] }); },
  });

  const retireStar = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/planning/goals/${id}`, { method: "PATCH", headers: authH(testerId), body: JSON.stringify({ status: "done" }) });
      if (!r.ok) throw new Error("Failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); qc.invalidateQueries({ queryKey: ["north-stars"] }); },
  });
  const deleteStar = useMutation({
    mutationFn: async (id: number) => {
      { const _r = await fetch(`/api/planning/goals/${id}`, { method: "DELETE", headers: authH(testerId) }); if (!_r.ok) throw new Error(`request failed (${_r.status})`); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); qc.invalidateQueries({ queryKey: ["north-stars"] }); },
  });

  const cycleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const next = status === "active" ? "paused" : "active";
      const r = await fetch(`/api/planning/goals/${id}`, { method: "PATCH", headers: authH(testerId), body: JSON.stringify({ status: next }) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message ?? "Failed"); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); qc.invalidateQueries({ queryKey: ["north-stars"] }); setFormError(null); },
    onError: (e: any) => setFormError(e.message),
  });

  const setElement = useMutation({
    mutationFn: async ({ id, element }: { id: number; element: string }) => {
      { const _r = await fetch(`/api/planning/goals/${id}`, { method: "PATCH", headers: authH(testerId), body: JSON.stringify({ element }) }); if (!_r.ok) throw new Error(`request failed (${_r.status})`); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); qc.invalidateQueries({ queryKey: ["north-stars"] }); },
  });

  const logSession = useMutation({
    mutationFn: async (goalId: number) => {
      const now = new Date().toISOString();
      const r = await fetch("/api/planning/windows", {
        method: "POST", headers: authH(testerId),
        body: JSON.stringify({ title: "Logged session", goalId, adHoc: true, startTime: now, endTime: now }),
      });
      if (!r.ok) throw new Error(`request failed (${r.status})`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["north-stars"] }),
  });

  const [quickAdd, setQuickAdd] = useState<{ goalId: number; kind: "task" | "habit" } | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  // After a linked task/habit is created, offer to find it a good time.
  const [suggestFor, setSuggestFor] = useState<{ title: string; goalId: number; kind: "task" | "habit" } | null>(null);
  const createLinked = useMutation({
    mutationFn: async ({ goalId, kind, title, element }: { goalId: number; kind: "task" | "habit"; title: string; element?: string }) => {
      const r = kind === "task"
        ? await fetch("/api/tasks", { method: "POST", headers: authHeaders, body: JSON.stringify({ title, goalId }) })
        : await fetch("/api/habits", { method: "POST", headers: authHeaders, body: JSON.stringify({ name: title, goalId, favoredElements: element || undefined }) });
      // Was silent — this then opened ScheduleSuggest for an item that was
      // never actually created (audit P0 #4).
      if (!r.ok) throw new Error("create linked item failed");
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: [v.kind === "task" ? "tasks" : "habits"] });
      setSuggestFor({ title: v.title, goalId: v.goalId, kind: v.kind });
      setQuickAdd(null); setQuickTitle("");
    },
  });

  const byElement: Record<string, { completed: number; scheduled: number; stars: any[] }> = {};
  for (const el of ELEMENTS) byElement[el] = { completed: 0, scheduled: 0, stars: [] };
  for (const g of list) {
    const el = g.element as string | undefined;
    if (!el || !byElement[el]) continue;
    byElement[el].completed += g.completedCount ?? 0;
    byElement[el].scheduled += g.scheduledCount ?? 0;
    byElement[el].stars.push(g);
  }
  const topElement = ELEMENTS.map((el) => ({ el, completed: byElement[el].completed })).sort((a, b) => b.completed - a.completed)[0];

  const closingSoon = list.filter((g: any) => {
    if (!g.anchorKind || !g.anchorUntil) return false;
    const d = daysUntil(g.anchorUntil);
    return d != null && d >= 0 && d <= 30;
  });

  const atCap = list.length >= MAX_ACTIVE_STARS;

  if (isLoading) {
    return <div style={{ padding: 40, color: "var(--text-3)", fontSize: 13 }}>Reading your Guiding Stars…</div>;
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "-0.4px" }}>Guiding Stars</div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>Your long-term ideals — the few things everything else should serve</div>
          </div>
          <button onClick={() => setShowForm(v => !v)} disabled={atCap && !showForm} title={atCap ? `Only ${MAX_ACTIVE_STARS} active at a time — pause one first` : undefined} style={{
            fontSize: 11, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--color-border)",
            background: showForm ? "#1a2a3a" : (atCap ? "var(--color-card-2)" : "var(--color-card)"),
            color: showForm ? "#ffffff" : (atCap ? "var(--text-3)" : "var(--text-2)"),
            cursor: atCap && !showForm ? "default" : "pointer", flexShrink: 0, whiteSpace: "nowrap",
          }}>
            {showForm ? "Cancel" : "+ New Guiding Star"}
          </button>
        </div>

        {activeCautionMatches.length > 0 && (
          <div style={{ background: "#a0404008", border: "1px solid #a0404030", borderLeft: "3px solid #a04040", borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#a04040", marginBottom: 2 }}>
              {activeCautionMatches.length === 1 ? "An advisory is active" : `${activeCautionMatches.length} advisories are active`}
            </div>
            <div style={{ fontSize: 10.5, color: "#8a5050", lineHeight: 1.5 }}>
              {activeCautionMatches.map((t: any, i: number) => (
                <span key={i}>
                  {i > 0 && " · "}
                  <span aria-hidden="true">{PLANET_GLYPH[t.triggerPlanet]}</span> {t.triggerPlanet} {String(t.aspect).toLowerCase()} your {t.cautionPlanet} ({CAUTION_PLANET_ARCHETYPE[t.cautionPlanet as keyof typeof CAUTION_PLANET_ARCHETYPE]?.label.toLowerCase()})
                </span>
              ))}
              {" — the theme you flagged is live for a little while. Move big commitments gently, then it passes."}
            </div>
          </div>
        )}

        {closingSoon.length > 0 && (
          <div style={{ background: "#8a6a2008", border: "1px solid #c8a84040", borderLeft: "3px solid #c8a840", borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#8a6a20", marginBottom: 2 }}>
              {closingSoon.length === 1 ? "A season is closing" : `${closingSoon.length} seasons are closing`}
            </div>
            <div style={{ fontSize: 10.5, color: "#8a7a50", lineHeight: 1.55 }}>
              {closingSoon.map((g: any, i: number) => (
                <span key={g.id}>
                  {i > 0 && " · "}
                  <b>{g.title}</b> {anchorLabel(g)}, closing {fmtDay(g.anchorUntil)}
                </span>
              ))}
              {" — land it, or consciously hand it to the next season."}
            </div>
          </div>
        )}

        {formError && (
          <div style={{ background: "#fdf0ec", border: "1px solid #e8c0b0", borderRadius: 8, padding: "9px 14px", fontSize: 12, color: "#a04030", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {formError}
            <button onClick={() => setFormError(null)} aria-label="Dismiss error" style={{ background: "none", border: "none", color: "#a04030", cursor: "pointer", fontSize: 14 }}>×</button>
          </div>
        )}

        {/* The one question after a star is set. It sits exactly where the form
            was, so the page doesn't jump and the ask reads as the next beat of
            the same action — name the direction, then name one move. Skipping
            is one tap and costs nothing; the star is already saved. */}
        {nextMoveFor && (
          <div style={{ background: "var(--color-card)", border: "1px solid #c8a84055", borderLeft: "3px solid #c8a840", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ fontSize: 12.5, color: "var(--color-foreground)" }}>
              <b>★ {nextMoveFor.title}</b> is set.
            </div>
            <div style={{ fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.5 }}>
              What's one next move? Something you could actually do — Compass will find it a time that suits the work.
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                autoFocus
                value={nextMoveTitle}
                onChange={e => setNextMoveTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && nextMoveTitle.trim()) {
                    createLinked.mutate({ goalId: nextMoveFor.goalId, kind: "task", title: nextMoveTitle.trim(), element: nextMoveFor.element });
                    setNextMoveFor(null); setNextMoveTitle("");
                  }
                  if (e.key === "Escape") { setNextMoveFor(null); setNextMoveTitle(""); }
                }}
                placeholder="e.g. draft the outline"
                style={{ flex: 1, padding: "7px 10px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 12, background: "var(--color-card-2)" }}
              />
              <button
                onClick={() => {
                  if (!nextMoveTitle.trim()) return;
                  createLinked.mutate({ goalId: nextMoveFor.goalId, kind: "task", title: nextMoveTitle.trim(), element: nextMoveFor.element });
                  setNextMoveFor(null); setNextMoveTitle("");
                }}
                disabled={!nextMoveTitle.trim()}
                style={{ padding: "6px 16px", borderRadius: 7, border: "none", fontSize: 11.5, cursor: nextMoveTitle.trim() ? "pointer" : "default",
                  background: nextMoveTitle.trim() ? "#1a2a3a" : "var(--color-border)", color: nextMoveTitle.trim() ? "#ffffff" : "var(--text-3)" }}>
                Find it a time
              </button>
              <button onClick={() => { setNextMoveFor(null); setNextMoveTitle(""); }} style={{
                padding: "6px 10px", borderRadius: 7, border: "none", background: "none",
                fontSize: 11, color: "var(--text-3)", cursor: "pointer",
              }}>Not yet</button>
            </div>
          </div>
        )}

        {showForm && (
          <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>

            {pendingAnchor && (() => {
              const ec = ELEMENT_INFO[pendingAnchor.element]?.color ?? "#888888";
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10.5, color: ec, background: `${ec}10`, border: `1px solid ${ec}40`, borderRadius: 7, padding: "6px 10px" }}>
                  <span style={{ fontWeight: 600 }}>⏳ {pendingAnchor.label}</span>
                  {pendingAnchor.until && <span style={{ color: "var(--text-3)" }}>until {fmtMonth(pendingAnchor.until)}</span>}
                  <button onClick={() => setPendingAnchor(null)} aria-label="Clear the cycle anchor" style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 12, padding: 0 }}>✕</button>
                </div>
              );
            })()}

            {/* A short walk-through so the blank field isn't intimidating — a
                Guiding Star is a direction, not a to-do, and examples give
                people a shape to copy. Owner #4: 'setting up a new guiding
                star needs encouragement / walking people through it.' */}
            <div style={{ fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.55 }}>
              <b style={{ color: "var(--color-primary)" }}>A Guiding Star is a direction you're steering toward</b> — a longer-term ideal, not a single task. Compass reads its nature from your wording to learn when it's best served. <b>Not everything worth steering toward is ambition:</b> rest, people, and home are directions too — and the days that suit them are days the app would otherwise have nothing to offer you.
            </div>
            {/* The examples used to be four flavours of achievement ("Finish the
                book", "Grow the business"), which quietly taught that a Guiding
                Star means output. That skews what the app can ever say: a
                watery, inward day has nothing to point at if every star is
                fire or air, so it reads as a flat day instead of a day for
                different work. Grouped by the KIND of life a star can belong to
                — the labels, not the elements, do the teaching. */}
            {!form.title && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
                <span style={{ fontSize: 9.5, color: "var(--color-muted)", marginRight: 2 }}>e.g.</span>
                {[
                  { ex: "Finish the book", kind: "make" },
                  { ex: "Grow the business", kind: "build" },
                  { ex: "Get strong & steady", kind: "body" },
                  { ex: "Rest without guilt", kind: "restore" },
                  { ex: "Deepen my closest bonds", kind: "people" },
                  { ex: "Make my home feel like mine", kind: "home" },
                ].map(({ ex, kind }) => (
                  <button key={ex} onClick={() => setForm(f => ({ ...f, title: ex }))} title={`A "${kind}" direction`} style={{
                    fontSize: 10, padding: "3px 10px", borderRadius: 10, border: "1px dashed #d0c8bc",
                    background: "var(--color-card-2)", color: "var(--color-muted)", cursor: "pointer",
                  }}>{ex}</button>
                ))}
              </div>
            )}
            <input autoFocus value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="What are you steering toward?"
              style={{ padding: "8px 11px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 13, background: "var(--color-card-2)" }} />
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Why does it matter? (optional — a line to your future self)"
              style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 12, background: "var(--color-card-2)" }} />

            {/* The sky's reading — auto-diagnosed from the words as you type.
                It suggests a ruling planet + element; you can override either. */}
            {diagnosis && (form.title.trim().length >= 3) && (
              <div style={{ background: "var(--color-card-2)", border: "1px solid var(--color-border)", borderRadius: 9, padding: "9px 11px" }}>
                {/* NOT "the sky reads this as". Nothing celestial read the
                    text — Compass classified the words through its own
                    correspondence system, and a user who notices the planet
                    change as they retype has caught the app overclaiming.
                    Naming the actual source is what makes the override below
                    make sense. */}
                <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--color-muted)", marginBottom: 4 }}>
                  We read your wording as
                </div>
                <div style={{ fontSize: 11.5, color: "var(--color-foreground)", lineHeight: 1.5 }}>{diagnosis.rationale}</div>
                {diagnosis.houses && diagnosis.houses.length > 0 && (
                  <div style={{ fontSize: 9.5, color: "var(--text-3)", marginTop: 3 }}>
                    Lives in your {diagnosis.houses.map(ordinal).join(" & ")} house{diagnosis.houses.length > 1 ? "s" : ""}
                  </div>
                )}
              </div>
            )}

            {/* The overrides. Closed by default: the reading above already
                chose, and a first star should cost a title and a tap. */}
            <button onClick={() => setShowTimingOverrides(v => !v)} style={{
              display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
              cursor: "pointer", padding: 0, fontSize: 10.5, color: "var(--text-3)", textAlign: "left",
            }}>
              <span aria-hidden="true" style={{ fontSize: 9, display: "inline-block", transition: "transform 0.15s", transform: showTimingOverrides ? "rotate(180deg)" : "none" }}>▾</span>
              Adjust timing signature
              {!showTimingOverrides && effPlanet && (
                <span style={{ color: "var(--color-muted)" }}>
                  · now <span aria-hidden="true">{PLANET_GLYPH[effPlanet] ?? ""}</span> {effPlanet}{effElement ? `, ${effElement}` : ""}
                </span>
              )}
            </button>

            {showTimingOverrides && (<>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 5 }}>Its ruling planet <span style={{ color: "#c8a04a" }}>— what drives its timing</span></div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {STAR_PLANETS.map(p => {
                  const on = effPlanet === p;
                  const suggested = !form.planet && diagnosis?.planets?.[0] === p;
                  const col = PLANET_PICK_COLOR[p] ?? "#8a8278";
                  return (
                    <button key={p} onClick={() => setForm(f => ({ ...f, planet: p }))} title={`${p}${suggested ? " — read from your words" : ""}`} style={{
                      fontSize: 10.5, padding: "4px 10px", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                      border: on ? `1px solid ${col}` : "1px solid #e0dad0",
                      background: on ? `${col}18` : "var(--color-card-2)",
                      color: on ? col : "var(--text-3)", fontWeight: on ? 600 : 400,
                    }}><span aria-hidden="true">{PLANET_GLYPH[p] ?? ""}</span> {p}{suggested ? " ·" : ""}</button>
                  );
                })}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 5 }}>Which element does this live in?</div>
              <div style={{ display: "flex", gap: 4 }}>
                {Object.entries(ELEMENT_INFO).map(([key, info]) => {
                  const on = effElement === key;
                  const suggested = !form.element && diagnosis?.element === key;
                  return (
                    <button key={key} onClick={() => setForm(f => ({ ...f, element: key }))} style={{
                      fontSize: 10, padding: "4px 11px", borderRadius: 10, cursor: "pointer", flex: 1,
                      border: on ? `1px solid ${info.color}` : suggested ? `1px dashed ${info.color}` : "1px solid #e0dad0",
                      background: on ? `${info.color}18` : "var(--color-card-2)",
                      color: on ? info.color : suggested ? info.color : "var(--text-3)",
                      fontWeight: on ? 600 : 400,
                    }}>{info.label}</button>
                  );
                })}
              </div>
            </div>
            </>)}

            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {(["near", "mid", "long"] as const).map(h => (
                <button key={h} onClick={() => setForm(f => ({ ...f, horizon: h }))} style={{
                  flex: 1, padding: "5px 0", borderRadius: 6, border: "1px solid", cursor: "pointer", fontSize: 11,
                  borderColor: form.horizon === h ? HORIZON_COLORS[h].color : "var(--text-3)",
                  background: form.horizon === h ? HORIZON_COLORS[h].bg : "transparent",
                  color: form.horizon === h ? HORIZON_COLORS[h].color : "var(--color-muted)", fontWeight: form.horizon === h ? 600 : 400,
                }}>{h}</button>
              ))}
              <button onClick={() => form.title.trim() && addGoal.mutate()} disabled={!form.title.trim()}
                style={{ padding: "5px 18px", borderRadius: 7, border: "none", fontSize: 11, background: form.title.trim() ? "#1a2a3a" : "var(--color-border)", color: form.title.trim() ? "#ffffff" : "var(--text-3)", cursor: "pointer" }}>
                Create
              </button>
            </div>

            {/* Optional, secondary: anchor this aim to a season the sky is
                backing. Deliberately AFTER the aim inputs and behind a toggle —
                you write your own intention first; the astrology comes in as
                support, not as the leading prompt. */}
            {premiumUnlocked && currentsData?.hasChart && (() => {
              const prof = currentsData.profection;
              const chapters: any[] = currentsData.transitsByHouse ?? [];
              if (!prof && chapters.length === 0) return null;
              const riding = (kind: string, house: number, planet?: string) =>
                list.some(g => g.anchorKind === kind && g.anchorHouse === house && (kind !== "chapter" || g.anchorPlanet === planet));
              const start = (a: PendingAnchor) => {
                setPendingAnchor(a);
                setForm(f => ({ ...f, horizon: horizonFromUntil(a.until), element: a.element }));
              };
              const Row = ({ a, sub, isRiding }: { a: PendingAnchor; sub: string; isRiding: boolean }) => {
                const ec = ELEMENT_INFO[a.element]?.color ?? "#888888";
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0", borderBottom: "1px solid var(--color-border)" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: ec, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--color-primary)" }}>
                        <span aria-hidden="true">{a.planet ? PLANET_GLYPH[a.planet] ?? "" : ""}</span> {a.label}
                      </div>
                      <div style={{ fontSize: 9.5, color: "var(--text-3)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {sub}{a.until ? ` · until ${fmtMonth(a.until)}` : ""}
                      </div>
                    </div>
                    {isRiding
                      ? <span style={{ fontSize: 9, color: "#80a870", flexShrink: 0 }}><span aria-hidden="true">✓</span> riding this</span>
                      : <button onClick={() => start(a)} style={{ fontSize: 9.5, padding: "3px 10px", borderRadius: 8, border: `1px solid ${ec}50`, background: `${ec}10`, color: ec, cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>
                          Ride this <span aria-hidden="true">→</span>
                        </button>}
                  </div>
                );
              };
              return (
                <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
                  {!showSeasons ? (
                    <button onClick={() => setShowSeasons(true)} style={{ fontSize: 10.5, color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
                      Optional: anchor it to a season the sky is backing <span aria-hidden="true">→</span>
                    </button>
                  ) : (
                    <div style={{ background: "var(--color-card-2)", borderRadius: 10, padding: "10px 14px 4px" }}>
                      <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 6, lineHeight: 1.5 }}>
                        The long cycles moving through your chart right now — riding one gives your aim a natural season instead of an invented deadline.
                      </div>
                      {prof && (
                        <Row a={{ kind: "profection", house: prof.house, until: prof.yearEnd ?? null, element: houseElement(prof.house), label: `Your ${ordinal(prof.house)}-house year · ${HOUSE_MEANINGS[prof.house]?.title ?? ""}` }}
                          sub={`Ruler of the year: ${prof.timeLord}`} isRiding={riding("profection", prof.house)} />
                      )}
                      {chapters.map((t: any) => (
                        <Row key={t.planet} a={{ kind: "chapter", planet: t.planet, house: t.house, until: t.leavesHouse ?? null, element: houseElement(t.house), label: `${t.planet} through your ${ordinal(t.house)} · ${HOUSE_MEANINGS[t.house]?.title ?? ""}` }}
                          sub={`A slow chapter${t.retrograde ? " · currently retrograde" : ""}`} isRiding={riding("chapter", t.house, t.planet)} />
                      ))}
                      {(currentsData.majorTransits ?? []).slice(0, 3).map((t: any, i: number) => (
                        <Row key={`mt${i}`} a={{ kind: "transit", planet: t.transitPlanet, house: t.natalHouse, until: null, element: houseElement(t.natalHouse), label: `${t.transitPlanet} ${String(t.aspect).toLowerCase()} your natal ${t.natalPlanet}` }}
                          sub={`Active now${t.exact ? " · exact" : ` · ${t.orb}° orb`}`} isRiding={list.some(g => g.anchorKind === "transit" && g.anchorPlanet === t.transitPlanet && g.anchorHouse === t.natalHouse)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Active Guiding Stars — each with explicit task/habit breakdown right here */}
        {/* A FAILED fetch is not a first run. Without this branch, a 500 on
            the stars query rendered "Set your first Guiding Star" — the
            onboarding pitch — to someone who has stars, which is the
            failed-request-as-empty-life defect on the page where it stings
            most: it looks like their stars were deleted. */}
        {list.length === 0 && starsError && !showForm && (
          <div style={{ textAlign: "center", padding: "44px 24px", color: "#a05050", fontSize: 13, lineHeight: 1.6 }}>
            Couldn't load your Guiding Stars just now — they're still there.
            This is a connection problem, not an empty page.
          </div>
        )}
        {list.length === 0 && !starsError && !showForm && (
          <div style={{ textAlign: "center", padding: "44px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div aria-hidden="true" style={{ fontSize: 30, opacity: 0.6 }}>✦</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-primary)" }}>Set your first Guiding Star</div>
            <div style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.6, maxWidth: 380 }}>
              A Guiding Star is a direction you're steering toward — something bigger than a task. Everything else on this page hangs off it: you'll break it into steps, tasks, and habits, and Compass helps you time them to the sky.
            </div>
            <button onClick={() => setShowForm(true)} style={{
              marginTop: 4, padding: "8px 20px", borderRadius: 9, border: "none",
              background: "#1a2a3a", color: "#ffffff", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            }}><span aria-hidden="true">✦</span> Name your first star</button>
          </div>
        )}

        {list.map((g: any) => {
          const info = ELEMENT_MYTHOS[g.element ?? ""];
          const ec = g.element ? (ELEMENT_INFO[g.element]?.color ?? "#8a8278") : "#8a8278";
          // Denominator = what was actually scheduled, never an invented
          // weekly quota (see Dashboard.tsx). No schedule, no ratio, no bar.
          const done = g.completedCount ?? 0;
          const scheduled = g.scheduledCount ?? 0;
          const pct = scheduled > 0 ? Math.min(100, Math.round((done / scheduled) * 100)) : 0;
          const gTasks = allTasks.filter((t: any) => t.goalId === g.id && t.done !== "true");
          // A habit can serve several stars (starIds CSV); it belongs under
          // every one of them, not only the first (goalId mirrors the first).
          const gHabits = allHabits.filter((h: any) => servesStar(h, g.id));
          const adding = quickAdd && quickAdd.goalId === g.id ? quickAdd.kind : null;
          const dLeft = daysUntil(g.anchorUntil);
          const closing = dLeft != null && dLeft >= 0 && dLeft <= 30;
          // Flagged at the turning-point check-in. Its kept card links here
          // saying "N stars marked for a look →"; until now this page had no
          // idea which ones (integration audit, gap 3).
          const flagged = needsLook.has(g.id);

          return (
            <div key={g.id} ref={el => { cardRefs.current[g.id] = el; }} style={{
              background: "var(--color-card)",
              // Longhand sides only — mixing border and borderLeft shorthands
              // makes React warn on every rerender.
              borderTop: highlightId === g.id ? `1px solid ${ec}` : "1px solid var(--color-border)",
              borderRight: highlightId === g.id ? `1px solid ${ec}` : "1px solid var(--color-border)",
              borderBottom: highlightId === g.id ? `1px solid ${ec}` : "1px solid var(--color-border)",
              borderLeft: `3px solid ${ec}`, borderRadius: 10, overflow: "hidden",
              boxShadow: highlightId === g.id ? `0 0 0 3px ${ec}30` : "none",
              transition: "box-shadow 0.4s, border-color 0.4s",
            }}>
              <div style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-foreground)" }}>{g.title}</span>
                      {flagged && (
                        <span title="You marked this for a second look at the new moon" style={{
                          fontSize: 9, padding: "2px 7px", borderRadius: 999, whiteSpace: "nowrap",
                          border: "1px solid #b8703a55", background: "#b8703a12", color: "#a05f2c",
                        }}>needs a look</span>
                      )}
                      {(g as any).planet && (() => {
                        const pc = PLANET_PICK_COLOR[(g as any).planet] ?? "#8a8278";
                        return <span title={`Ruled by ${(g as any).planet} — drives this star's best times`} style={{ fontSize: 9, color: pc, background: `${pc}14`, padding: "1px 7px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 3 }}><Glyph name={(g as any).planet} size={11} tint={false} bg={`${pc}14`} /> {(g as any).planet}</span>;
                      })()}
                      {info && <span style={{ fontSize: 9, color: info.color, background: `${info.color}14`, padding: "1px 7px", borderRadius: 8 }}>{info.name}</span>}
                    </div>
                    {g.description && <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>{g.description}</div>}
                    {g.anchorKind && g.anchorHouse != null && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 5, fontSize: 9.5, color: ec, background: `${ec}10`, border: `1px solid ${ec}30`, borderRadius: 6, padding: "2px 7px" }}>
                        <span>⏳ {anchorLabel(g)}{g.anchorUntil ? ` · until ${fmtMonth(g.anchorUntil)}` : ""}</span>
                        {closing && <span style={{ color: "#a04040", fontWeight: 700 }}>closing soon</span>}
                        <button onClick={() => clearAnchor.mutate(g.id)} title="Unlink from this cycle" aria-label="Unlink from this cycle" style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 10, padding: 0, lineHeight: 1 }}>✕</button>
                      </div>
                    )}
                    {/* Does this one end? Null is a star; a date makes it a
                        project, and the dashboard reads it to decide which of
                        the two ways to draw its progress. */}
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 5, fontSize: 9.5, color: "var(--text-3)" }}>
                      {(g as any).endsOn ? (
                        <>
                          <span style={{ color: "var(--color-meridian)", border: "1px solid var(--color-border)", borderRadius: 6, padding: "2px 7px" }}>
                            finishes {fmtDay((g as any).endsOn)}
                          </span>
                          <button onClick={() => setEndsOn.mutate({ id: g.id, endsOn: null })}
                            title="No end date — hold this one as a star instead"
                            aria-label={`Remove the end date from ${g.title}`}
                            style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 10, padding: 0, lineHeight: 1 }}>✕</button>
                        </>
                      ) : (
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                          <span>does this finish?</span>
                          <input type="date" value=""
                            onChange={(e) => e.target.value && setEndsOn.mutate({ id: g.id, endsOn: e.target.value })}
                            aria-label={`Set an end date for ${g.title}`}
                            style={{ fontSize: 9.5, padding: "1px 4px", borderRadius: 5, border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--text-2)", cursor: "pointer" }} />
                        </label>
                      )}
                    </div>
                    {!g.element && (
                      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                        {Object.entries(ELEMENT_INFO).map(([key, ei]) => (
                          <button key={key} onClick={() => setElement.mutate({ id: g.id, element: key })} style={{
                            fontSize: 9, padding: "2px 8px", borderRadius: 10, cursor: "pointer",
                            border: "1px solid #e0dad0", background: "var(--color-card-2)", color: "var(--text-3)",
                          }}>{ei.label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => logSession.mutate(g.id)} title="Log a session for this star" style={{
                      fontSize: 9.5, padding: "3px 9px", borderRadius: 12, border: "1px solid #e0dad0",
                      background: "var(--color-card-2)", color: "var(--color-muted)", cursor: "pointer",
                    }}>+ log</button>
                    <button onClick={() => cycleStatus.mutate({ id: g.id, status: g.status })} title="Set this star down for a while — it keeps its history" style={{
                      fontSize: 9.5, padding: "3px 9px", borderRadius: 12, border: "1px solid #e0dad0",
                      background: "none", color: "var(--color-muted)", cursor: "pointer",
                    }}>pause</button>
                    <button onClick={() => { if (confirm(`Retire “${g.title}”? It ends here, and the history stays in the Log.`)) retireStar.mutate(g.id); }} title="End this star — reached, outgrown, or done with" style={{
                      fontSize: 9.5, padding: "3px 9px", borderRadius: 12, border: "1px solid #e0dad0",
                      background: "none", color: "var(--color-muted)", cursor: "pointer",
                    }}>retire</button>
                  </div>
                </div>

                {scheduled > 0 && (
                  <div style={{ height: 3, background: "var(--color-background)", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: ec, borderRadius: 2, opacity: 0.75 }} />
                  </div>
                )}
                <div style={{ fontSize: 9, color: "var(--text-3)", marginTop: 3 }}>
                  {scheduled > 0 ? `${done}/${scheduled} sessions this week`
                    : done > 0 ? `${done} session${done === 1 ? "" : "s"} this week`
                    : "no sessions scheduled"}
                </div>
              </div>

              {/* Breakdown — explicit and visible, not a footnote */}
              <div style={{ padding: "10px 14px", background: "var(--color-card-2)", borderTop: "1px solid var(--color-border)" }}>
                <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-3)", marginBottom: 7 }}>
                  Broken down into
                </div>
                {gTasks.length === 0 && gHabits.length === 0 && (
                  <div style={{ fontSize: 10.5, color: "var(--text-3)", marginBottom: 6 }}>Nothing yet — add a task or habit below.</div>
                )}
                {gTasks.length > 0 && (
                  <div style={{ marginBottom: gHabits.length > 0 ? 6 : 0 }}>
                    {gTasks.slice(0, 4).map((t: any) => (
                      <button key={t.id} onClick={() => completeTask.mutate(t.id)} title="Mark done"
                        style={{ display: "block", width: "100%", textAlign: "left", fontSize: 10.5, color: "var(--color-muted)", padding: "2px 0", background: "none", border: "none", cursor: "pointer" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#3a6020"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#6a6258"; }}
                      >☐ {t.title}</button>
                    ))}
                    {gTasks.length > 4 && (
                      <button onClick={() => onNavigate("tasks")} style={{ fontSize: 9.5, color: "var(--text-2)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        +{gTasks.length - 4} more in Tasks →
                      </button>
                    )}
                  </div>
                )}
                {gHabits.length > 0 && (
                  <div>
                    {gHabits.map((h: any) => (
                      <button key={h.id} onClick={() => toggleHabitToday.mutate({ id: h.id, done: !!h.doneToday })} title={h.doneToday ? "Undo today's practice" : "Affirm today's practice"}
                        style={{ display: "block", width: "100%", textAlign: "left", fontSize: 10.5, padding: "2px 0", background: "none", border: "none", cursor: "pointer", color: h.doneToday ? "#5a8a48" : "var(--color-muted)" }}>
                        {h.doneToday ? "✓" : "↻"} {h.name}{h.doneToday ? <span style={{ color: "#9ab88a", fontSize: 9 }}> · done today</span> : ""}
                      </button>
                    ))}
                  </div>
                )}
                {/* Steps (ordered milestones) with their tasks — the project
                    facilitation: task → step → star, with a rollup bar. */}
                {(() => {
                  const steps = stepsForStar(g.id);
                  if (steps.length === 0) return null;
                  const STEP_COL: Record<string, string> = { pending: "#c8c0b4", in_progress: "#c8a840", completed: "#80b870" };
                  const prog = starProgress[g.id];
                  const elCol = ELEMENT_INFO[g.element ?? ""]?.color ?? "#7a8a9a";
                  return (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--color-border)" }}>
                      {/* Rollup bar */}
                      {prog && (prog.tasksTotal > 0 || prog.stepsTotal > 0) && (
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ fontSize: 9, color: "var(--text-3)" }}>Project · {prog.pct}%</span>
                            <span style={{ fontSize: 9, color: "var(--text-3)" }}>
                              {prog.tasksTotal > 0 ? `${prog.tasksDone}/${prog.tasksTotal} tasks` : `${prog.stepsDone}/${prog.stepsTotal} steps`}
                            </span>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: "var(--color-card-2)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${prog.pct}%`, background: elCol, borderRadius: 2, transition: "width 0.3s" }} />
                          </div>
                        </div>
                      )}
                      <div style={{ fontSize: 9, color: "var(--text-3)", marginBottom: 3 }}>Steps</div>
                      {steps.map((m: any) => {
                        const stepTasks = tasksForStep(m.id);
                        return (
                          <div key={m.id} style={{ marginBottom: 3 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "2px 0" }}>
                              <span onClick={() => cycleStep.mutate({ id: m.id, status: m.status })} title="Cycle step status"
                                style={{ width: 8, height: 8, borderRadius: "50%", background: STEP_COL[m.status] ?? "var(--color-border)", flexShrink: 0, cursor: "pointer" }} />
                              <span style={{ fontSize: 10.5, flex: 1, color: m.status === "completed" ? "var(--text-3)" : "var(--color-muted)", textDecoration: m.status === "completed" ? "line-through" : "none" }}>{m.title}</span>
                              {m.status !== "completed" && <ActivityTimesHint title={m.title} testerId={testerId} lat={lat} lon={lon} />}
                              {stepTasks.length > 0 && <span style={{ fontSize: 9, color: "var(--text-3)" }}>{stepTasks.filter((t) => t.done === "true").length}/{stepTasks.length}</span>}
                              {(() => {
                                const stepHabits = (allHabits as any[]).filter((h) => h.milestoneId === m.id);
                                const already = stepHabits.length > 0;
                                const recur = looksRecurring(m.title);
                                return already ? (
                                  <span title="This step is a recurring habit" style={{ fontSize: 9, color: "var(--text-2)" }}><span aria-hidden="true">↻</span> habit</span>
                                ) : (
                                  <button
                                    onClick={() => addHabitFromStep.mutate({ milestoneId: m.id, starId: g.id, title: m.title, element: g.element ?? undefined, planet: (g as any).planet ?? undefined })}
                                    disabled={addHabitFromStep.isPending}
                                    title={recur ? "This reads like a recurring practice — make it a habit" : "Make this step a recurring habit"}
                                    style={{ fontSize: 9, color: recur ? "#7a6cae" : "var(--text-3)", background: recur ? "#7a6cae12" : "none", border: "none", borderRadius: 5, cursor: "pointer", padding: recur ? "1px 6px" : "0 2px", fontWeight: recur ? 600 : 400, lineHeight: 1 }}
                                  ><span aria-hidden="true">↻</span> habit</button>
                                );
                              })()}
                              <button onClick={() => { setStepTaskAdd(m.id); setStepTaskTitle(""); }} title="Add a task to this step"
                                style={{ fontSize: 11, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>+</button>
                            </div>
                            {/* Tasks under the step */}
                            {stepTasks.map((t) => (
                              <div key={t.id} onClick={() => toggleStepTask.mutate({ id: t.id, done: t.done === "true" })}
                                style={{ display: "flex", alignItems: "center", gap: 6, padding: "1px 0 1px 15px", cursor: "pointer" }}>
                                <span style={{ fontSize: 10, color: t.done === "true" ? "#80b870" : "var(--text-3)" }}>{t.done === "true" ? "✓" : "○"}</span>
                                <span style={{ fontSize: 10, color: t.done === "true" ? "var(--text-3)" : "var(--text-2)", textDecoration: t.done === "true" ? "line-through" : "none" }}>{t.title}</span>
                              </div>
                            ))}
                            {stepTaskAdd === m.id && (
                              <div style={{ display: "flex", gap: 4, padding: "2px 0 2px 15px" }}>
                                <input autoFocus value={stepTaskTitle} onChange={(e) => setStepTaskTitle(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && stepTaskTitle.trim()) addTaskToStep.mutate({ milestoneId: m.id, starId: g.id, title: stepTaskTitle.trim(), element: g.element ?? undefined });
                                    if (e.key === "Escape") { setStepTaskAdd(null); setStepTaskTitle(""); }
                                  }}
                                  placeholder="Task for this step…"
                                  style={{ flex: 1, padding: "3px 8px", borderRadius: 5, border: "1px solid var(--color-border)", fontSize: 10, background: "var(--color-card)" }} />
                                <button onClick={() => stepTaskTitle.trim() && addTaskToStep.mutate({ milestoneId: m.id, starId: g.id, title: stepTaskTitle.trim(), element: g.element ?? undefined })}
                                  disabled={addTaskToStep.isPending}
                                  style={{ fontSize: 9, padding: "3px 8px", borderRadius: 5, border: "none", background: "#1a2a3a", color: "#ffffff", cursor: "pointer" }}>{addTaskToStep.isPending ? "…" : "Add"}</button>
                                {addTaskToStep.isError && <span style={{ fontSize: 9, color: "#a03030", alignSelf: "center" }}>failed</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {/* Weave the whole star — timing-aware scheduling of every
                          open task, in step order, onto the calendar. */}
                      {(() => {
                        const openCount = (allTasks as any[]).filter((t) => t.goalId === g.id && t.done !== "true" && t.milestoneId != null).length;
                        if (openCount === 0) return null;
                        const done = weaveResult?.starId === g.id;
                        return (
                          <div style={{ marginTop: 6 }}>
                            {done ? (
                              <div style={{ fontSize: 9.5, color: "#3a6020" }}>✓ Woven {weaveResult!.placed} onto your calendar (Plan/Ahead){weaveResult!.unplaced ? ` · ${weaveResult!.unplaced} couldn't fit` : ""}.</div>
                            ) : (
                              <>
                                <button onClick={() => weaveStar.mutate({ starId: g.id })} disabled={weaveStar.isPending}
                                  style={{ fontSize: 10, padding: "4px 11px", borderRadius: 7, border: `1px solid ${elCol}40`, background: `${elCol}0e`, color: elCol, cursor: "pointer", fontWeight: 600 }}>
                                  {weaveStar.isPending ? "Reading the sky…" : `✦ Schedule these ${openCount} — the sky picks the times`}
                                </button>
                                {weaveStar.isError && (
                                  <div style={{ fontSize: 9.5, color: "#a03030", marginTop: 4 }}>{(weaveStar.error as Error)?.message ?? "Couldn't schedule those — try again."}</div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {/* AI breakdown review — proposed steps for this star */}
                {breakdownFor === g.id && proposedSteps.length > 0 && (
                  <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 9, border: "1px solid var(--color-border)", background: "var(--color-card-2)" }}>
                    <div style={{ fontSize: 10, color: "var(--color-muted)", marginBottom: 6 }}>Proposed steps — edit or drop, then keep them:</div>
                    {proposedSteps.map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: ELEMENT_INFO[s.element]?.color ?? "#aaaaaa", flexShrink: 0 }} />
                        <input value={s.title} onChange={(e) => setProposedSteps((ps) => ps.map((p, j) => j === i ? { ...p, title: e.target.value } : p))}
                          style={{ flex: 1, padding: "3px 7px", borderRadius: 5, border: "1px solid var(--color-border)", fontSize: 11, background: "var(--color-card)" }} />
                        <button onClick={() => setProposedSteps((ps) => ps.filter((_, j) => j !== i))} aria-label="Drop this step" style={{ fontSize: 11, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button onClick={() => commitBreakdown.mutate({ goalId: g.id })} disabled={commitBreakdown.isPending || proposedSteps.length === 0}
                        style={{ fontSize: 10.5, padding: "5px 14px", borderRadius: 7, border: "none", background: "#1a2a3a", color: "#ffffff", cursor: "pointer", fontWeight: 600 }}>
                        {commitBreakdown.isPending ? "Adding…" : `Keep ${proposedSteps.length} steps`}
                      </button>
                      <button onClick={() => { setBreakdownFor(null); setProposedSteps([]); }} style={{ fontSize: 10, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer" }}>discard</button>
                    </div>
                  </div>
                )}

                {/* Add a step (milestone) */}
                {stepAdd === g.id && (
                  <div style={{ display: "flex", gap: 5, marginTop: 7 }}>
                    <input autoFocus value={stepTitle} onChange={e => setStepTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && stepTitle.trim()) addStep.mutate({ starId: g.id, starTitle: g.title, title: stepTitle.trim() });
                        if (e.key === "Escape") { setStepAdd(null); setStepTitle(""); }
                      }}
                      placeholder="A step toward this star…"
                      style={{ flex: 1, padding: "4px 9px", borderRadius: 6, border: "1px solid var(--color-border)", fontSize: 11, background: "var(--color-card)" }}
                    />
                    <button onClick={() => stepTitle.trim() && addStep.mutate({ starId: g.id, starTitle: g.title, title: stepTitle.trim() })}
                      style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, border: "none", background: "#1a2a3a", color: "#ffffff", cursor: "pointer" }}>Add</button>
                    <button onClick={() => { setStepAdd(null); setStepTitle(""); }} aria-label="Cancel adding a step"
                      style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-muted)", cursor: "pointer" }}>✕</button>
                  </div>
                )}

                <div style={{ marginTop: 8 }}>
                  {adding ? (
                    <div style={{ display: "flex", gap: 5 }}>
                      <input autoFocus value={quickTitle} onChange={e => setQuickTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && quickTitle.trim()) createLinked.mutate({ goalId: g.id, kind: adding, title: quickTitle.trim(), element: g.element ?? undefined });
                          if (e.key === "Escape") { setQuickAdd(null); setQuickTitle(""); }
                        }}
                        placeholder={adding === "task" ? "Task for this star…" : "Habit for this star…"}
                        style={{ flex: 1, padding: "4px 9px", borderRadius: 6, border: "1px solid var(--color-border)", fontSize: 11, background: "var(--color-card)" }}
                      />
                      <button onClick={() => quickTitle.trim() && createLinked.mutate({ goalId: g.id, kind: adding, title: quickTitle.trim(), element: g.element ?? undefined })}
                        disabled={createLinked.isPending}
                        style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, border: "none", background: "#1a2a3a", color: "#ffffff", cursor: "pointer" }}>{createLinked.isPending ? "…" : "Add"}</button>
                      <button onClick={() => { setQuickAdd(null); setQuickTitle(""); }} aria-label={adding === "task" ? "Cancel adding a task" : "Cancel adding a habit"}
                        style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-muted)", cursor: "pointer" }}>✕</button>
                      {createLinked.isError && <span style={{ fontSize: 9, color: "#a03030", alignSelf: "center" }}>failed</span>}
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <button onClick={() => { setQuickAdd({ goalId: g.id, kind: "task" }); setQuickTitle(""); }}
                        style={{ fontSize: 10.5, color: "var(--text-2)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>+ task</button>
                      <button onClick={() => { setQuickAdd({ goalId: g.id, kind: "habit" }); setQuickTitle(""); }}
                        style={{ fontSize: 10.5, color: "var(--text-2)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>+ habit</button>
                      <button onClick={() => { setStepAdd(g.id); setStepTitle(""); }}
                        style={{ fontSize: 10.5, color: "var(--text-2)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>+ step</button>
                      {/* AI breakdown — only advertise when the star has no steps yet */}
                      {stepsForStar(g.id).length === 0 && breakdownFor !== g.id && (
                        <button onClick={() => { setBreakdownFor(g.id); setProposedSteps([]); runBreakdown.mutate({ title: g.title, description: g.description ?? undefined }); }}
                          disabled={runBreakdown.isPending}
                          style={{ fontSize: 10.5, color: "#7a6cae", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", fontWeight: 600 }}>
                          {runBreakdown.isPending && breakdownFor === g.id ? "thinking…" : <><span aria-hidden="true">✦</span> break into steps</>}
                        </button>
                      )}
                    </div>
                  )}
                  {/* The breakdown button hides itself once clicked, so without
                      this a failure left the card completely silent. */}
                  {breakdownFor === g.id && runBreakdown.isError && (
                    <div style={{ fontSize: 9.5, color: "#a03030", marginTop: 4 }}>
                      {(runBreakdown.error as Error)?.message ?? "Couldn't break that down."}{" "}
                      <button onClick={() => { setBreakdownFor(null); runBreakdown.reset(); }}
                        style={{ fontSize: 9.5, color: "#7a6cae", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>dismiss</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Your long weather — Currents folded in as a context band. It sits
            BELOW your stars: you steer by your own aims first, and the slow
            arcs moving through your chart are the seasons those stars can ride.
            Premium (personal chart).

            Also requires at least one star. Its whole framing is "the seasons
            your STARS can ride" — with no stars there is nothing to ride them,
            so for a first-time visitor it was a page of profections and natal
            transits standing between them and the one thing they came to do
            (owner 2026-08-02: "we might back off the long weather bit — that's
            a bit confusing for a beginner"). */}
        {premiumUnlocked && currentsData?.hasChart && list.length > 0 && (() => {
          const prof = currentsData.profection;
          const transits: any[] = currentsData.majorTransits ?? [];
          // Jupiter & Saturn's house chapters — the great time-keepers get equal
          // billing with the profection and the slow aspects.
          const keepers: any[] = (currentsData.transitsByHouse ?? []).filter((t: any) => t.planet === "Jupiter" || t.planet === "Saturn");
          if (!prof && transits.length === 0 && keepers.length === 0) return null;
          return (
            <div style={{ background: "linear-gradient(180deg, var(--color-card) 0%, var(--color-card-2) 100%)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--color-muted)", marginBottom: 7 }}>Your long weather · the seasons your stars can ride</div>
              {prof && (
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)", marginBottom: 5 }}>
                  <span aria-hidden="true">{PLANET_GLYPH[prof.timeLord] ?? "◔"}</span> Your {ordinal(prof.house)}-house year
                  <span style={{ fontWeight: 400, color: "var(--text-3)" }}> · {HOUSE_MEANINGS[prof.house]?.title ?? ""} · ruled by {prof.timeLord}</span>
                </div>
              )}
              {transits.slice(0, 2).map((t: any, i: number) => {
                const key = `lw-${t.transitPlanet}-${t.natalPlanet}`;
                const isExp = expandedWeather === key;
                return (
                  <div key={i}>
                    <button onClick={() => setExpandedWeather(v => v === key ? null : key)} style={{ fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.5, display: "flex", gap: 6, alignItems: "baseline", width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "1px 0" }}>
                      <span style={{ color: "#a04040", flexShrink: 0 }}><span aria-hidden="true">{PLANET_GLYPH[t.transitPlanet]}</span></span>
                      <span style={{ flex: 1 }}>{t.transitPlanet} {String(t.aspect).toLowerCase()} your natal {t.natalPlanet} — {t.exact ? "exact now" : `${t.orb}° orb`}{t.likelyDomains?.length ? ` · ${t.likelyDomains.slice(0, 2).join(", ")}` : ""}</span>
                      <span aria-hidden="true" style={{ fontSize: 9, color: "var(--text-3)", transform: isExp ? "rotate(180deg)" : "none", display: "inline-block" }}>▾</span>
                    </button>
                    {isExp && <TransitTake t={t} accent="#8a8ba0" />}
                  </div>
                );
              })}
              {keepers.map((t: any, i: number) => (
                <div key={`k${i}`} style={{ fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.5, display: "flex", gap: 6, alignItems: "baseline", padding: "1px 0" }}>
                  <span style={{ color: "#5a6b8c", flexShrink: 0 }}><span aria-hidden="true">{PLANET_GLYPH[t.planet]}</span></span>
                  <span>{t.planet} through your {ordinal(t.house)} · {HOUSE_MEANINGS[t.house]?.title ?? ""} — {t.planet === "Jupiter" ? "where growth wants to happen" : "where structure is being earned"}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Weekly retro */}
        {topElement && topElement.completed > 0 && (
          <div style={{ fontSize: 11.5, color: "var(--color-muted)", padding: "2px 2px" }}>
            Most active element this week: <b style={{ color: ELEMENT_MYTHOS[topElement.el].color }}>{ELEMENT_MYTHOS[topElement.el].name}</b>
            {" "}({topElement.completed} session{topElement.completed === 1 ? "" : "s"} logged)
          </div>
        )}

        {/* Element cards */}
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)", marginBottom: 10 }}>
            The four elements
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {ELEMENTS.map((el) => {
              const m: ElementMythos = ELEMENT_MYTHOS[el];
              const tally = byElement[el];
              return (
                <button key={el} onClick={() => onNavigate("habits")} style={{
                  textAlign: "left", cursor: "pointer", background: "var(--color-card)",
                  border: `1px solid ${m.color}30`, borderRadius: 12, padding: "12px 14px",
                  display: "flex", flexDirection: "column", gap: 6,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-primary)" }}>{m.name}</span>
                    {tally.stars.length === 0 && <span style={{ fontSize: 9, color: "var(--text-3)", marginLeft: "auto" }}>no Guiding Star</span>}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.45 }}>{m.essence}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                    {m.domains.slice(0, 3).map((d, i) => (
                      <span key={i} style={{ fontSize: 9, color: m.color, background: `${m.color}12`, padding: "2px 7px", borderRadius: 8 }}>{d}</span>
                    ))}
                  </div>
                  {tally.completed > 0 && (
                    <div style={{ fontSize: 9.5, color: "var(--text-3)", marginTop: 2 }}>{tally.completed} session{tally.completed === 1 ? "" : "s"} this week</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Paused stars */}
        {pausedGoals.length > 0 && (
          <div style={{ paddingTop: 8, borderTop: "1px solid var(--color-border)" }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-3)", marginBottom: 8 }}>Paused</div>
            {pausedGoals.map((g: any) => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 7, opacity: 0.6 }}>
                <div style={{ fontSize: 12, color: "var(--color-muted)", flex: 1 }}>{g.title}</div>
                <button onClick={() => cycleStatus.mutate({ id: g.id, status: g.status })} style={{ fontSize: 10, color: "#6090c0", background: "none", border: "none", cursor: "pointer" }}>resume</button>
                <button onClick={() => { if (confirm(`Retire “${g.title}”?`)) retireStar.mutate(g.id); }} style={{ fontSize: 10, color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer" }}>retire</button>
                <button onClick={() => { if (confirm(`Delete “${g.title}” completely? For test stars — real journeys deserve retirement.`)) deleteStar.mutate(g.id); }} style={{ fontSize: 10, color: "#c08080", background: "none", border: "none", cursor: "pointer" }}>delete</button>
              </div>
            ))}
          </div>
        )}

      </div>

      {suggestFor && (
        <ScheduleSuggest
          title={suggestFor.title} testerId={testerId} lat={lat} lon={lon}
          goalId={suggestFor.goalId} kind={suggestFor.kind}
          onClose={() => setSuggestFor(null)}
        />
      )}
    </div>
  );
}
