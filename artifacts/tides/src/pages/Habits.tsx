import React, { useState, useEffect } from "react";
import { jsonArray, listState } from "@/lib/jsonArray";
import { localToday, addDaysLocal } from "@/lib/dates";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TidesNow } from "@/lib/types";
import { ScheduleSuggest } from "@/components/ScheduleSuggest";
import { useTester } from "@/contexts/tester-context";
import Glyph from "@/components/Glyph";
import { ELEMENT_COLORS, elementColor } from "@/lib/elements";
import { PLANET_COLORS } from "@/lib/planetColors";
import { starIdsOf } from "@/lib/starLinks";

const PLANET_CHOICES = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn"];

const ELEMENTS = ["water","fire","earth","air"];
// Simplified lunation quarters for tagging — timingScore matches these against
// the live phase name via includes(), so "waxing" catches both crescent and
// gibbous. New = begin/reset, waxing = build, full = culminate, waning = release.
const PHASES = [
  { key:"new",    label:"New · begin" },
  { key:"waxing", label:"Waxing · build" },
  { key:"full",   label:"Full · culminate" },
  { key:"waning", label:"Waning · release" },
];
const WINDOW_TYPES = ["deep_work","creative","planning","social","recovery","study","retreat"];
const WINDOW_LABELS: Record<string,string> = {
  deep_work:"Deep work",creative:"Creative",planning:"Planning",social:"Social",
  recovery:"Recovery",study:"Study",retreat:"Retreat",
};


interface HabitDay { date: string; done: boolean; isToday: boolean; }
interface Habit {
  id: number; name: string; emoji?: string; description?: string;
  // Merged practices model: the server now returns these as arrays + a
  // computed resonance (the Moon's timing and phase first, then element,
  // then the planetary hour — lib/habitTiming.ts).
  favoredElements?: string[]; favoredPhases?: string[]; favoredPlanets?: string[];
  bestWindowType?: string; minimumViable?: string; streak: number; doneToday: boolean;
  days: HabitDay[]; goalId?: number; projectId?: number;
  resonance?: "resonant"|"supported"|"neutral"|"soften"|"protect"; resonanceNote?: string;
  // Cadence: the rhythm this habit actually wants, and how it's doing against
  // THAT rather than against a universal every-day standard.
  cadence?: Cadence; windowDone?: number; windowTarget?: number; cadenceMet?: boolean;
  solarAnchor?: "sunrise"|"noon"|"sunset"|"bed"|null; solarAnchorAt?: string|null;
  // "chore" = recurring upkeep, not an identity practice — no streak framing.
  flavor?: string | null;
  // Every star this habit serves, CSV ("3,7"). goalId mirrors the first.
  starIds?: string | null;
}

/** The star ids a habit serves, whichever column carries them. */
const habitStarIds = starIdsOf;

type Cadence = "daily"|"most_days"|"weekly"|"occasional";
const CADENCE_OPTIONS: { key: Cadence; label: string; hint: string }[] = [
  { key: "daily",      label: "Every day",   hint: "a true daily — the streak counts" },
  { key: "most_days",  label: "Most days",   hint: "about 5 of 7, missing one is fine" },
  { key: "weekly",     label: "A few times", hint: "you pick how many per week" },
  { key: "occasional", label: "When it fits", hint: "tracked, never scored" },
];
type SolarAnchor = "sunrise"|"noon"|"sunset"|"bed";
const SOLAR_ANCHOR_OPTIONS: { key: SolarAnchor; label: string; glyph: string }[] = [
  { key: "sunrise", label: "At sunrise",  glyph: "☀︎" },
  { key: "noon",    label: "Sun overhead", glyph: "☉" },
  { key: "sunset",  label: "At sunset",   glyph: "☾" },
  // Bed is the person's own landmark, not the sky's — its time comes from
  // the chronotype they gave at onboarding, never from the server.
  { key: "bed",     label: "Before bed",  glyph: "⏾" },
];

// How a habit is doing, in its OWN terms. A 3×/week practice that's done 3
// times is complete — not a broken 7-day streak. `occasional` never reports a
// shortfall at all, which is the whole point of having it.
function cadenceLabel(h: Habit): { text: string; tone: "met"|"progress"|"quiet" } {
  const cadence = h.cadence ?? "daily";
  const done = h.windowDone ?? 0;
  const target = h.windowTarget ?? 0;
  // A chore never speaks streak language, whatever its cadence — the record
  // is the fact it happened, said once and quietly (owner F7).
  if (h.flavor === "chore") {
    return {
      text: h.doneToday ? "done today" : done > 0 ? `done ${done}× this week` : "",
      tone: "quiet",
    };
  }
  if (cadence === "occasional") {
    return { text: done > 0 ? `${done}× in the last week` : "whenever it fits", tone: "quiet" };
  }
  if (cadence === "daily") {
    return h.streak > 0
      ? { text: `${h.streak}-day run`, tone: h.doneToday ? "met" : "progress" }
      : { text: h.doneToday ? "begun again" : "every day", tone: h.doneToday ? "met" : "progress" };
  }
  return {
    text: done >= target ? `${done} of ${target} this week ✓` : `${done} of ${target} this week`,
    tone: done >= target ? "met" : "progress",
  };
}
const asArr = (v: unknown): string[] => Array.isArray(v) ? v : String(v ?? "").split(",").map(s=>s.trim()).filter(Boolean);

// The bed landmark, from the chronotype's own sleep time ("HH:MM"). A time in
// the small hours belongs to tomorrow — a night owl's 03:00 bed is tonight's,
// not this morning's. Null when no chronotype exists: no invented bedtime.
function bedTimeToday(sleepTime: string | undefined | null, today: string): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(sleepTime ?? "");
  if (!m) return null;
  const d = new Date(`${today}T12:00:00`);
  d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
  if (parseInt(m[1], 10) < 12) d.setDate(d.getDate() + 1);
  return d;
}
const fmtClock = (d: Date | null) => d ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;
interface GoalLite { id: number; title: string; }
interface ProjectLite { id: number; title: string; }

function authH(tid: string|null) {
  return { ...(tid ? {"x-tester-id":tid} : {}), "Content-Type":"application/json" };
}

// The server computes resonance now (element + planetary hour + phase + planet
// timing — the merged practices model). Fall back to a light element check
// only if the server didn't send one.
function timingScore(h: Habit, now: TidesNow|undefined): "resonant"|"supported"|"neutral"|"soften"|"protect" {
  if (h.resonance) return h.resonance;
  if (!now) return "neutral";
  const el = now.element?.element ?? "";
  return asArr(h.favoredElements).includes(el) ? "supported" : "neutral";
}

const TIMING_COLORS = { resonant:"#3a6020", supported:ELEMENT_COLORS.water, neutral:"#888888", soften:"#8a5020", protect:"#8a5020" };
const TIMING_BG = { resonant:"#d0f0c0", supported:"#d0e0f8", neutral:"#e8e4de", soften:"#f0e0c0", protect:"#f0e0c0" };

export default function Habits({ testerId, now, lat = 40.7, lon = -74.0, onNavigate }: { testerId:string|null; now:TidesNow|undefined; lat?:number; lon?:number; onNavigate?:(v:string)=>void }) {
  const qc = useQueryClient();
  const today = localToday();
  // A half-filled habit form used to die on any tab change: the form is
  // component state, and leaving Habits unmounts the page. Someone who had
  // named a habit and set its cadence came back to an empty form with no
  // indication anything had been lost (owner, 2026-08-13). The draft now
  // survives on disk until it is submitted or explicitly discarded.
  const HABIT_DRAFT_KEY = `compass-habit-draft-${testerId ?? "anon"}`;
  const BLANK_FORM = { name:"", emoji:"", favoredElements:[] as string[], favoredPhases:[] as string[], favoredPlanets:[] as string[], bestWindowType:"", minimumViable:"", cadence:"daily" as Cadence, targetPerWeek:3, solarAnchor:"" as ""|SolarAnchor, chore:false };
  const readHabitDraft = () => {
    try {
      const raw = localStorage.getItem(HABIT_DRAFT_KEY);
      if (!raw) return null;
      return { ...BLANK_FORM, ...JSON.parse(raw) } as typeof BLANK_FORM;
    } catch { return null; }
  };
  const [showAdd, setShowAdd] = useState(() => {
    const d = readHabitDraft();
    return !!(d && (d.name.trim() || d.emoji.trim()));
  });
  const [form, setForm] = useState(() => readHabitDraft() ?? BLANK_FORM);
  /**
   * The habit being edited, or null while the form is creating a new one.
   *
   * A cadence chosen once at creation was permanent — a daily entered by
   * mistake could only be archived and retyped, losing its whole record with
   * it (owner, 2026-08-22: "I accidentally put in a daily habit that should
   * be a weekly"). The PATCH has always taken cadence and targetPerWeek;
   * nothing in the app ever sent them. This is that door.
   *
   * It reuses the creation form rather than growing a second one, so the two
   * can never drift apart in what they can express.
   */
  const [editingId, setEditingId] = useState<number|null>(null);
  // Written on every keystroke rather than on unmount: a tab change can
  // unmount without a cleanup pass running in time, and the whole point is
  // to survive leaving unexpectedly.
  useEffect(() => {
    const worth = form.name.trim() || form.emoji.trim() || form.minimumViable.trim()
      || form.favoredElements.length || form.favoredPhases.length || form.favoredPlanets.length;
    try {
      // Only a NEW habit's form is a draft worth surviving a tab change. An
      // edit is of something already saved, so persisting it would overwrite
      // a real draft with a copy of an existing habit.
      if (showAdd && worth && editingId === null) localStorage.setItem(HABIT_DRAFT_KEY, JSON.stringify(form));
      else if (!worth && editingId === null) localStorage.removeItem(HABIT_DRAFT_KEY);
    } catch { /* private mode */ }
  }, [form, showAdd, editingId, HABIT_DRAFT_KEY]);

  // Several stars at creation, not one (owner 2026-08-21: "set habits to
  // match multiple stars"). The edit chips below could already do this; the
  // creation form was still a single select, so every habit was born serving
  // one star and had to be re-linked.
  const [newGoalIds, setNewGoalIds] = useState<number[]>([]);
  const newGoalId: number | "" = newGoalIds[0] ?? "";
  const [newProjectId, setNewProjectId] = useState<number|"">("");
  // Retroactive star-linking (owner 2026-08-16: "if I set habits before I
  // articulate guiding stars, I want to go back and weave them in"). The
  // PATCH has taken goalId all along; this is the first UI that sends it
  // after creation. `linking` = the habit whose picker is open.
  const { profile: testerProfile } = useTester();
  const [linking, setLinking] = useState<number|null>(null);
  const linkStars = useMutation({
    mutationFn: async ({ id, goalIds }: { id: number; goalIds: number[] }) => {
      const r = await fetch(`/api/habits/${id}`, { method: "PATCH", headers: authH(testerId), body: JSON.stringify({ goalIds }) });
      if (!r.ok) throw new Error(`couldn't link that habit (${r.status})`);
    },
    // The picker stays open across toggles — linking two stars is two taps,
    // not two openings. It closes by hand.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["north-stars"] });
    },
  });
  const [suggestFor, setSuggestFor] = useState<{ title: string; goalId?: number; projectId?: number } | null>(null);

  const { data: goalsList = [] } = useQuery<GoalLite[]>({
    queryKey: ["planning-goals-active", testerId],
    queryFn: async () => { const r = await fetch("/api/planning/goals?status=active", { headers: authH(testerId) }); const j = await r.json(); return Array.isArray(j) ? j : []; },
    enabled: !!testerId,
  });
  const { data: projectsList = [] } = useQuery<ProjectLite[]>({
    queryKey: ["planning-projects-active", testerId],
    queryFn: async () => { const r = await fetch("/api/planning/projects?status=active", { headers: authH(testerId) }); const j = await r.json(); return Array.isArray(j) ? j : []; },
    enabled: !!testerId,
  });

  const { data: habits = [], isError: habitsError, isLoading: habitsLoading } = useQuery<Habit[]>({
    queryKey: ["habits", testerId, today, lat, lon],
    queryFn: async () => {
      // ?today= is the viewer's LOCAL date — without it the server falls back
      // to its own UTC day and the whole streak/cadence window shifts for
      // evening users (the 8pm-ET rollover).
      const r = await fetch(`/api/habits?today=${today}&lat=${lat}&lon=${lon}`, { headers: authH(testerId) });
      // THROWS on failure. The old line here — `Array.isArray(j) ? j : []` —
      // turned a 500 into an empty list, so a failed fetch rendered as "No
      // habits yet. Add one above." to someone who has habits: the exact
      // failed-request-as-empty-life defect jsonArray() was built to end,
      // hand-rolled back into existence one page over.
      return jsonArray<Habit>(r);
    },
    enabled: !!testerId,
    refetchInterval: 60_000,
  });

  const addHabit = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/habits", {
        method: "POST", headers: authH(testerId),
        body: JSON.stringify({
          name: form.name.trim(), emoji: form.emoji || undefined,
          favoredElements: form.favoredElements.join(",") || undefined,
          favoredPhases: form.favoredPhases.join(",") || undefined,
          favoredPlanets: form.favoredPlanets.join(",") || undefined,
          bestWindowType: form.bestWindowType || undefined,
          minimumViable: form.minimumViable.trim() || undefined,
          goalIds: newGoalIds.length ? newGoalIds : undefined,
          projectId: newProjectId || undefined,
          cadence: form.cadence,
          targetPerWeek: form.cadence === "weekly" ? form.targetPerWeek : undefined,
          solarAnchor: form.solarAnchor || undefined,
          flavor: form.chore ? "chore" : undefined,
        }),
      });
      if (!r.ok) throw new Error(`create habit failed (${r.status})`);
    },
    onSuccess: () => {
      qc.invalidateQueries({queryKey:["habits"]}); setShowAdd(false);
      setSuggestFor({ title: form.name.trim(), goalId: newGoalId || undefined, projectId: newProjectId || undefined });
      setForm({name:"",emoji:"",favoredElements:[],favoredPhases:[],favoredPlanets:[],bestWindowType:"",minimumViable:"",cadence:"daily",targetPerWeek:3,solarAnchor:"",chore:false});
      setNewGoalIds([]); setNewProjectId("");
      // Saved for real — the draft has nothing left to protect.
      try { localStorage.removeItem(HABIT_DRAFT_KEY); } catch { /* private mode */ }
    },
  });

  /**
   * Save a change to a habit that already exists. Every field the creation
   * form can set, the edit can change — including the cadence pair, which is
   * the whole reason this exists.
   */
  const editHabit = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/habits/${id}`, {
        method: "PATCH", headers: authH(testerId),
        body: JSON.stringify({
          name: form.name.trim(), emoji: form.emoji || null,
          favoredElements: form.favoredElements.join(",") || null,
          favoredPhases: form.favoredPhases.join(",") || null,
          favoredPlanets: form.favoredPlanets.join(",") || null,
          bestWindowType: form.bestWindowType || null,
          minimumViable: form.minimumViable.trim() || null,
          cadence: form.cadence,
          // The server nulls the target for any cadence but weekly, so this
          // only has to be right when it means something.
          targetPerWeek: form.cadence === "weekly" ? form.targetPerWeek : undefined,
          // "" means no anchor. Sent as null so clearing one actually clears
          // it rather than being skipped as undefined.
          solarAnchor: form.solarAnchor || null,
        }),
      });
      if (!r.ok) throw new Error(`save habit failed (${r.status})`);
    },
    onSuccess: () => {
      qc.invalidateQueries({queryKey:["habits"]});
      setShowAdd(false); setEditingId(null); setForm(BLANK_FORM);
    },
  });

  /** Load an existing habit into the shared form and open it for editing. */
  const startEditing = (h: Habit) => {
    setEditingId(h.id);
    setForm({
      name: h.name ?? "", emoji: h.emoji ?? "",
      favoredElements: asArr(h.favoredElements), favoredPhases: asArr(h.favoredPhases),
      favoredPlanets: asArr(h.favoredPlanets),
      bestWindowType: h.bestWindowType ?? "", minimumViable: h.minimumViable ?? "",
      cadence: (h.cadence ?? "daily") as Cadence,
      targetPerWeek: h.windowTarget ?? 3,
      solarAnchor: (h.solarAnchor ?? "") as ""|SolarAnchor,
      chore: h.flavor === "chore",
    });
    setShowAdd(true);
  };

  /** Leave the form without saving, whichever mode it is in. */
  const cancelForm = () => {
    setShowAdd(false); setEditingId(null); setForm(BLANK_FORM);
    setNewGoalIds([]); setNewProjectId("");
  };

  /**
   * Mark or unmark a habit on a DAY — today by default, any of the last
   * fourteen on request.
   *
   * The endpoint has always taken a date. Nothing in the app ever sent one
   * other than today's, so a habit you did but forgot to check off was
   * unrecordable: the day was on screen, as a dot, and there was no way to
   * fill it in. That turns the streak into a record of remembering to tap
   * rather than of doing the thing, which is the opposite of what it is for.
   */
  const toggleLog = useMutation({
    mutationFn: async ({ id, done, date }: { id:number; done:boolean; date?:string }) => {
      // Both directions must name the viewer's LOCAL date — the DELETE was
      // falling back to the server's UTC day, so an evening un-check removed
      // TOMORROW's log and left today's in place.
      const on = date ?? today;
      if (done) {
        await fetch(`/api/habits/${id}/log?date=${on}`, { method:"DELETE", headers: authH(testerId) });
      } else {
        await fetch(`/api/habits/${id}/log`, { method:"POST", headers: authH(testerId), body: JSON.stringify({ date: on }) });
      }
    },
    onSuccess: () => qc.invalidateQueries({queryKey:["habits"]}),
  });

  const removeHabit = useMutation({
    mutationFn: async (id:number) => {
      await fetch(`/api/habits/${id}`, { method:"DELETE", headers: authH(testerId) });
    },
    onSuccess: () => qc.invalidateQueries({queryKey:["habits"]}),
  });

  const scored = habits
    .map(h => ({ ...h, timing: timingScore(h, now) }))
    .sort((a,b) => {
      const order = { resonant:0, supported:1, neutral:2, soften:3, protect:4 };
      return (order[a.timing] ?? 2) - (order[b.timing] ?? 2);
    });

  // This week's completions per element — a habit tagged with multiple
  // elements counts toward each. Reuses the 14-day `days` log already fetched
  // per habit rather than a separate query.
  const weekAgo = addDaysLocal(localToday(), -6);
  const weekByElement: Record<string, number> = { fire: 0, earth: 0, air: 0, water: 0 };
  for (const h of habits) {
    const els = asArr(h.favoredElements);
    if (els.length === 0) continue;
    const completedThisWeek = h.days.filter(d => d.done && d.date >= weekAgo).length;
    for (const el of els) if (weekByElement[el] !== undefined) weekByElement[el] += completedThisWeek;
  }
  const weekTotal = Object.values(weekByElement).reduce((a, b) => a + b, 0);

  const toggleEl = (el: string) => setForm(f => ({
    ...f, favoredElements: f.favoredElements.includes(el) ? f.favoredElements.filter(e=>e!==el) : [...f.favoredElements, el]
  }));
  const togglePhase = (p: string) => setForm(f => ({
    ...f, favoredPhases: f.favoredPhases.includes(p) ? f.favoredPhases.filter(e=>e!==p) : [...f.favoredPhases, p]
  }));
  const togglePlanet = (p: string) => setForm(f => ({
    ...f, favoredPlanets: f.favoredPlanets.includes(p) ? f.favoredPlanets.filter(e=>e!==p) : [...f.favoredPlanets, p]
  }));

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid var(--color-border)",background: "var(--color-rail)",flexShrink:0}}>
        <div style={{fontSize:12,color:"var(--color-muted)",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <span>{now ? `${now.element?.element} · ${now.moonPhase?.replace(/_/g," ")}` : "Loading…"}</span>
          {/* Dailies done today — the count is its own satisfying metric when
              you keep more practices than any one day can hold (owner
              2026-07-29). Only counts true dailies, so a 2×/week habit not
              done today never reads as a miss. */}
          {(() => {
            const dailies = habits.filter(h => (h.cadence ?? "daily") === "daily");
            if (dailies.length === 0) return null;
            const done = dailies.filter(h => h.doneToday).length;
            const all = done === dailies.length;
            return (
              <span style={{
                fontSize:10.5,padding:"2px 9px",borderRadius:12,fontWeight:600,
                background: all ? "#60a05018" : "var(--color-card-2)",
                color: all ? "#4a8040" : "var(--text-3)",
                border: `1px solid ${all ? "#60a05040" : "var(--color-border)"}`,
              }}>
                {all ? `all ${dailies.length} dailies ✓` : `${done} of ${dailies.length} dailies today`}
              </span>
            );
          })()}
        </div>
        <button onClick={() => { if (showAdd) { cancelForm(); } else { setEditingId(null); setForm(readHabitDraft() ?? BLANK_FORM); setShowAdd(true); } }}
          style={{fontSize:11,padding:"5px 12px",borderRadius:7,border:"1px solid var(--color-border)",background:showAdd?"#1a2a3a":"var(--color-card)",color:showAdd?"#ffffff":"var(--text-2)",cursor:"pointer"}}>
          {showAdd ? "Close" : "+ New habit"}
        </button>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:12}}>

        {/* New-moon review — the lunation's reset point, the natural moment to
            re-choose habits at the cycle scale habits actually live on. */}
        {/* Clickable through to THIS new moon's own check-in, rather than a
            standing note about new moons in general (owner, 2026-08-13) —
            the reset it describes is the one the check-in actually runs. */}
        {now?.moonPhase === "New Moon" && habits.length > 0 && (
          <div style={{background:"#50608a08",border:"1px solid #7080a040",borderLeft:"3px solid #7080a0",borderRadius:10,padding:"10px 14px"}}>
            <div style={{fontSize:11,fontWeight:600,color:"#50608a",marginBottom:2}}>New moon — a natural reset</div>
            <div style={{fontSize:10.5,color:"#60709a",lineHeight:1.5}}>
              The lunation begins again. A good moment to look down this list and ask which habits still serve — retire what doesn't, recommit to what does.
            </div>
            {onNavigate && (
              <button onClick={() => onNavigate("home")} style={{
                marginTop: 6, fontSize: 10.5, background: "none", border: "none", padding: 0,
                cursor: "pointer", color: "#50608a", fontWeight: 600,
              }}>Open this new moon's check-in <span aria-hidden="true">→</span></button>
            )}
          </div>
        )}

        {/* This week per element */}
        {weekTotal > 0 && (
          <div style={{display:"flex",gap:6,alignItems:"center",fontSize:10.5,color:"var(--text-3)",padding:"2px 2px"}}>
            <span style={{textTransform:"uppercase",letterSpacing:"0.5px",fontSize:9,color:"var(--text-3)"}}>This week</span>
            {ELEMENTS.filter(el => weekByElement[el] > 0).map(el => (
              <span key={el} style={{color:elementColor(el),fontWeight:600}}>
                {el} {weekByElement[el]}
              </span>
            ))}
          </div>
        )}

        {/* THE DAY'S LANDMARKS — the sun-calendar (owner 2026-08-16: "the
            sun-calendar with the habits got lost along the way"). Four fixed
            points in the person's actual day — sunrise, noon, sunset, bed —
            with the habits hung on each, checkable in place. Sunrise/sunset
            are today's real times here; bed is the chronotype's own hour.
            Renders only when something is anchored: an empty scaffold is
            furniture. */}
        {(() => {
          const anchored = habits.filter(h => h.solarAnchor);
          if (anchored.length === 0) return null;
          const dl = (now as any)?.daylight;
          const sunrise = dl?.sunrise ? new Date(dl.sunrise) : null;
          const sunset = dl?.sunset ? new Date(dl.sunset) : null;
          const noon = sunrise && sunset ? new Date((sunrise.getTime() + sunset.getTime()) / 2) : null;
          const bed = bedTimeToday(testerProfile?.chronotype?.sleepTime, today);
          const timeOf: Record<SolarAnchor, Date | null> = { sunrise, noon, sunset, bed };
          const STRIP_LABEL: Record<SolarAnchor, string> = { sunrise: "Sunrise", noon: "Noon", sunset: "Sunset", bed: "Before bed" };
          return (
            <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.9px", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 8 }}>
                The day's landmarks
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
                {SOLAR_ANCHOR_OPTIONS.map(opt => {
                  const hs = anchored.filter(h => h.solarAnchor === opt.key);
                  if (hs.length === 0) return null;
                  const t = fmtClock(timeOf[opt.key]);
                  return (
                    <div key={opt.key}>
                      <div style={{ fontSize: 10, color: "#a06818", fontWeight: 600, marginBottom: 5 }}>
                        {opt.glyph} {STRIP_LABEL[opt.key]}{t ? ` · ${opt.key === "sunset" || opt.key === "bed" ? "by " : ""}${t}` : ""}
                      </div>
                      {hs.map(h => (
                        <button key={h.id} onClick={() => toggleLog.mutate({ id: h.id, done: h.doneToday })}
                          style={{
                            display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left",
                            padding: "3px 0", background: "none", border: "none", cursor: "pointer",
                          }}>
                          <span style={{
                            width: 13, height: 13, borderRadius: h.flavor === "chore" ? 3 : "50%", flexShrink: 0,
                            border: h.doneToday ? "none" : "1.5px solid var(--color-border)",
                            background: h.doneToday ? "#3f7a4a" : "transparent",
                            color: "#ffffff", fontSize: 8, lineHeight: "13px", textAlign: "center",
                          }}>{h.doneToday ? "✓" : ""}</span>
                          <span style={{
                            fontSize: 11.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            color: h.doneToday ? "var(--text-3)" : "var(--color-foreground)",
                            textDecoration: h.doneToday ? "line-through" : "none",
                          }}>{h.emoji ? `${h.emoji} ` : ""}{h.name}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Add form */}
        {showAdd && (
          <div style={{background: "var(--color-card)",border:"1px solid var(--color-border)",borderRadius:10,padding:"16px"}}>
            {/* The emoji box read as decoration nobody could change — it sat
                unlabelled beside the name, so a sprout appeared on the habit
                and looked like something the app had assigned (owner,
                2026-08-13). It is yours; the label and title say so. */}
            <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"center"}}>
              <input value={form.emoji} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))} placeholder="🌿" maxLength={2}
                title="Pick any emoji for this habit — tap and type or paste one"
                aria-label="Habit icon"
                style={{width:44,padding:"7px",borderRadius:7,border:"1px solid var(--color-border)",fontSize:18,textAlign:"center",background: "var(--color-card-2)",cursor:"text"}}/>
              <input autoFocus value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
                onKeyDown={e=>{ if (e.key!=="Enter"||!form.name.trim()) return; editingId === null ? addHabit.mutate() : editHabit.mutate(editingId); }}
                placeholder="Habit name…"
                style={{flex:1,padding:"7px 10px",borderRadius:7,border:"1px solid var(--color-border)",fontSize:13,background: "var(--color-card-2)"}}/>
            </div>

            {/* Cadence leads the form — the rhythm a practice wants is more
                fundamental than which element suits it, and choosing it here
                is what keeps a 3×/week habit from being scored as a failed
                daily (owner 2026-07-29). */}
            <div style={{marginBottom:10}}>
              <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:"0.6px",color:"var(--text-3)",marginBottom:5}}>How often does this want to happen?</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                {CADENCE_OPTIONS.map(c => {
                  const on = form.cadence === c.key;
                  return (
                    <button key={c.key} type="button" onClick={()=>setForm(f=>({...f,cadence:c.key}))} style={{
                      textAlign:"left",padding:"7px 10px",borderRadius:8,cursor:"pointer",
                      border:on?"1.5px solid #1a2a3a":"1px solid var(--color-border)",
                      background:on?"#1a2a3a10":"var(--color-card-2)",
                    }}>
                      <div style={{fontSize:11.5,fontWeight:on?600:500,color:on?"var(--color-primary)":"var(--color-foreground)"}}>{c.label}</div>
                      <div style={{fontSize:9,color:"var(--text-3)",marginTop:1,lineHeight:1.35}}>{c.hint}</div>
                    </button>
                  );
                })}
              </div>
              {/* Chore flavor (owner F7): recurring upkeep — same cadence
                  machinery, no streak framing anywhere it renders. */}
              <label style={{display:"flex",alignItems:"center",gap:7,marginTop:8,cursor:"pointer"}}>
                <input type="checkbox" checked={form.chore}
                  onChange={e=>setForm(f=>({...f,chore:e.target.checked}))}
                  style={{width:13,height:13,accentColor:"#1a2a3a",cursor:"pointer"}}/>
                <span style={{fontSize:10.5,color:"var(--color-muted)"}}>
                  This is a chore — upkeep on a cycle, checked off plainly, never scored.
                </span>
              </label>
              {form.cadence === "weekly" && (
                <div style={{display:"flex",alignItems:"center",gap:6,marginTop:7}}>
                  <span style={{fontSize:10.5,color:"var(--color-muted)"}}>How many times a week?</span>
                  {[2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={()=>setForm(f=>({...f,targetPerWeek:n}))} style={{
                      width:26,height:26,borderRadius:7,cursor:"pointer",fontSize:11,fontWeight:600,
                      border:form.targetPerWeek===n?"1.5px solid #1a2a3a":"1px solid var(--color-border)",
                      background:form.targetPerWeek===n?"#1a2a3a10":"var(--color-card-2)",
                      color:form.targetPerWeek===n?"var(--color-primary)":"var(--color-muted)",
                    }}>{n}</button>
                  ))}
                </div>
              )}
              {/* Any cadence can hang on the day's landmarks (owner
                  2026-08-16) — a 3×/week run at sunrise is as anchored as a
                  daily one. "Before bed" is the chronotype's time, not the
                  sun's. */}
              <div style={{marginTop:7}}>
                <div style={{fontSize:10.5,color:"var(--color-muted)",marginBottom:4}}>Hang it on the day? <span style={{color:"var(--text-3)"}}>(optional)</span></div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {SOLAR_ANCHOR_OPTIONS.map(s => {
                    const on = form.solarAnchor === s.key;
                    return (
                      <button key={s.key} type="button" onClick={()=>setForm(f=>({...f,solarAnchor: on ? "" : s.key}))} style={{
                        display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:14,cursor:"pointer",fontSize:10.5,
                        border:on?"1.5px solid #c08020":"1px solid var(--color-border)",
                        background:on?"#c0802015":"var(--color-card-2)",
                        color:on?"#a06818":"var(--color-muted)",
                      }}><span>{s.glyph}</span>{s.label}</button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* THE TIMING IS SECONDARY TO DOING THE THING (owner, 2026-08-13).
                Everything below this line is optional and says so once, at the
                top, rather than leaving a reader to guess whether a habit is
                incomplete without an element, a phase and a planet. A habit
                with none of it set is a perfectly good habit; the sky just
                has less to say about when it suits. */}
            <div style={{
              fontSize:10.5, color:"var(--color-muted)", lineHeight:1.5,
              borderTop:"1px solid var(--color-border)", paddingTop:9, marginTop:4, marginBottom:8,
            }}>
              <b style={{fontWeight:600}}>Timing — all optional.</b> Skip it and the habit works exactly the same; fill any of it in and Compass can suggest when it fits.
            </div>

            <div style={{marginBottom:8}}>
              <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:"0.6px",color:"var(--text-3)",marginBottom:5}}>Best elements</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {ELEMENTS.map(el => (
                  <button key={el} onClick={()=>toggleEl(el)} style={{
                    fontSize:10,padding:"3px 9px",borderRadius:10,border:"1px solid",cursor:"pointer",
                    borderColor:form.favoredElements.includes(el)?elementColor(el):"#d8d2ca",
                    background:form.favoredElements.includes(el)?`${elementColor(el)}20`:"transparent",
                    color:form.favoredElements.includes(el)?elementColor(el):"var(--color-muted)",
                  }}>{el}</button>
                ))}
              </div>
            </div>

            <div style={{marginBottom:8}}>
              <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:"0.6px",color:"var(--text-3)",marginBottom:5}}>Best moon phase</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {PHASES.map(p => (
                  <button key={p.key} onClick={()=>togglePhase(p.key)} style={{
                    fontSize:10,padding:"3px 9px",borderRadius:10,border:"1px solid",cursor:"pointer",
                    borderColor:form.favoredPhases.includes(p.key)?PLANET_COLORS.Moon:"#d8d2ca",
                    background:form.favoredPhases.includes(p.key)?"#7080a020":"transparent",
                    color:form.favoredPhases.includes(p.key)?"#50608a":"var(--color-muted)",
                  }}>{p.label}</button>
                ))}
              </div>
            </div>

            {/* Planet linking — the merged practices intelligence: a habit can
                declare the planet(s) it serves, so its own hour lifts it. */}
            <div style={{marginBottom:10}}>
              <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:"0.6px",color:"var(--text-3)",marginBottom:5}}>Supported by planet</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {PLANET_CHOICES.map(p => {
                  const on = form.favoredPlanets.includes(p);
                  return (
                    <button key={p} type="button" onClick={()=>togglePlanet(p)} style={{
                      display:"flex",alignItems:"center",gap:4,padding:"4px 9px",borderRadius:14,cursor:"pointer",fontSize:11,
                      border:on?"1.5px solid #7a6cae":"1px solid var(--color-border)",
                      background:on?"#7a6cae18":"var(--color-card-2)",color:on?"#6a5c9e":"var(--color-muted)",fontWeight:on?600:400,
                    }}><Glyph name={p} size={12} bg="var(--color-card-2)" tint={on} style={on?undefined:{color:"var(--text-3)"}} />{p}</button>
                  );
                })}
              </div>
            </div>

            {/* MULTIPLE KINDS, because a practice can be more than one thing —
                a morning sit is recovery and study at once (owner asked twice:
                "i also want to be able to select multiple of them").
                Stored comma-separated in the same column, which is the
                convention the sibling fields already use (favoredElements,
                favoredPhases), so this needs no migration.

                THIS FIELD NOW DRIVES TIMING (2026-08-14). It sits under the
                "Timing — all optional" heading above, beside three fields that
                always did, and for months it was the only one nothing read:
                choosing "deep work" looked like telling Compass when to want
                the habit and told it nothing. Each kind maps to an element via
                timingTier.WINDOW_ELEMENT, scored as a weaker signal than an
                element chosen outright — see lib/habitTiming.ts. */}
            <div style={{marginBottom:8}}>
              <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:"0.6px",color:"var(--text-3)",marginBottom:5}}>Kind of work</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {WINDOW_TYPES.map(t => {
                  const chosen = form.bestWindowType ? form.bestWindowType.split(",").filter(Boolean) : [];
                  const on = chosen.includes(t);
                  return (
                    <button key={t} onClick={() => setForm(f => {
                      const cur = f.bestWindowType ? f.bestWindowType.split(",").filter(Boolean) : [];
                      const next = cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t];
                      return { ...f, bestWindowType: next.join(",") };
                    })} style={{
                      fontSize:10,padding:"3px 9px",borderRadius:10,cursor:"pointer",
                      border: on ? "1px solid #5a6a8a" : "1px solid var(--color-border)",
                      background: on ? "#5a6a8a14" : "transparent",
                      color: on ? "#4a5a7a" : "var(--color-muted)", fontWeight: on ? 600 : 400,
                    }}>{WINDOW_LABELS[t]}</button>
                  );
                })}
              </div>
            </div>
            {(goalsList.length > 0 || projectsList.length > 0) && (
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                {goalsList.length > 0 && (
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:9.5,color:"var(--text-3)",marginBottom:4}}>Counts toward {newGoalIds.length === 0 ? "no star yet" : newGoalIds.length === 1 ? "one star" : `${newGoalIds.length} stars`}</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      {goalsList.map(g => {
                        const on = newGoalIds.includes(g.id);
                        return (
                          <button key={g.id} type="button" onClick={()=>setNewGoalIds(on ? newGoalIds.filter(x=>x!==g.id) : [...newGoalIds, g.id])}
                            aria-pressed={on}
                            style={{fontSize:10.5,padding:"3px 9px",borderRadius:11,cursor:"pointer",
                              border:`1px solid ${on ? "var(--color-primary)" : "var(--color-border)"}`,
                              background: on ? "var(--color-primary)" : "var(--color-card-2)",
                              color: on ? "#fff" : "var(--color-muted)"}}>★ {g.title}</button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {projectsList.length > 0 && (
                  <select value={newProjectId} onChange={e=>setNewProjectId(e.target.value ? Number(e.target.value) : "")}
                    style={{flex:1,padding:"6px 8px",borderRadius:6,border:"1px solid var(--color-border)",fontSize:11,color:"var(--text-2)",background: "var(--color-card-2)"}}>
                    <option value="">Project: none</option>
                    {projectsList.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                )}
              </div>
            )}
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input value={form.minimumViable} onChange={e=>setForm(f=>({...f,minimumViable:e.target.value}))}
                placeholder="Minimum viable (e.g. 5 min walk)…"
                style={{flex:1,padding:"6px 9px",borderRadius:6,border:"1px solid var(--color-border)",fontSize:11,background: "var(--color-card-2)",color:"var(--text-2)"}}/>
              <button onClick={cancelForm}
                style={{padding:"6px 12px",borderRadius:7,border:"1px solid var(--color-border)",fontSize:11,background:"var(--color-card-2)",color:"var(--text-3)",cursor:"pointer"}}>
                Cancel
              </button>
              <button
                onClick={()=>{ if (!form.name.trim()) return; editingId === null ? addHabit.mutate() : editHabit.mutate(editingId); }}
                disabled={!form.name.trim() || editHabit.isPending || addHabit.isPending}
                style={{padding:"6px 16px",borderRadius:7,border:"none",fontSize:11,background:form.name.trim()?"#1a2a3a":"var(--color-border)",color:form.name.trim()?"#ffffff":"var(--text-3)",cursor:"pointer"}}>
                {editHabit.isPending || addHabit.isPending ? "Saving…" : editingId === null ? "Add" : "Save changes"}
              </button>
            </div>
          </div>
        )}

        {/* Habit rows */}
        {scored.map(h => {
          const tc = TIMING_COLORS[h.timing];
          const tb = TIMING_BG[h.timing];
          return (
            <div key={h.id} style={{background: "var(--color-card)",border:`1px solid ${h.timing==="resonant"?"#c0d8b0":"#e8e4de"}`,borderRadius:10,padding:"12px 14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                {/* Check button */}
                <button onClick={()=>toggleLog.mutate({id:h.id,done:h.doneToday})} style={{
                  width:26,height:26,borderRadius:7,border:`2px solid ${h.doneToday?"#80b870":"#c0bab0"}`,
                  background:h.doneToday?"#80b870":"transparent",flexShrink:0,cursor:"pointer",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#ffffff",
                }}>{h.doneToday?"✓":""}</button>

                {h.emoji && <span style={{fontSize:18,lineHeight:1}}>{h.emoji}</span>}
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:500,color:h.doneToday?"var(--text-3)":"var(--color-foreground)",textDecoration:h.doneToday?"line-through":"none"}}>
                    {h.name}
                    {h.flavor === "chore" && <span style={{fontSize:8,padding:"1px 6px",borderRadius:4,background:"var(--color-card-2)",border:"1px solid var(--color-border)",color:"var(--text-3)",fontWeight:600,marginLeft:6,verticalAlign:"middle",textDecoration:"none",display:"inline-block"}}>chore</span>}
                  </div>
                  {/* Progress in the habit's OWN cadence — a 3×/week practice
                      reads "2 of 3 this week", not a broken daily streak. */}
                  {(() => {
                    const c = cadenceLabel(h);
                    const anchor = h.solarAnchor ? SOLAR_ANCHOR_OPTIONS.find(s => s.key === h.solarAnchor) : null;
                    // Bed has no server instant — its time is the chronotype's
                    // own, computed here. Sky anchors keep the server's.
                    const anchorAt = h.solarAnchorAt ? new Date(h.solarAnchorAt)
                      : h.solarAnchor === "bed" ? bedTimeToday(testerProfile?.chronotype?.sleepTime, today)
                      : null;
                    return (
                      <div style={{fontSize:9,marginTop:1,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                        <span style={{color:c.tone==="met"?"#60a050":c.tone==="quiet"?"var(--text-3)":"var(--text-3)"}}>{c.text}</span>
                        {anchor && (anchorAt || h.solarAnchor === "bed") && (
                          <span style={{color:"#a08850"}} title={`${anchor.label} today`}>
                            {anchor.glyph} {h.solarAnchor === "bed" && anchorAt ? "by " : ""}{anchorAt ? fmtClock(anchorAt) : anchor.label.toLowerCase()}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* The stars this habit serves — linkable AFTER creation
                    (owner: "go back and weave them in"), and to more than one
                    (a walk can serve "get fit" and "clear head" both). */}
                {goalsList.length > 0 && (() => {
                  const linked = habitStarIds(h);
                  const goalsById = Object.fromEntries(goalsList.map(g => [g.id, g]));
                  const first = linked[0] != null ? goalsById[linked[0]] : undefined;
                  return linking === h.id ? (
                    <span style={{display:"flex",gap:3,alignItems:"center",flexWrap:"wrap",flexShrink:0,maxWidth:280}}>
                      {goalsList.map(g => {
                        const on = linked.includes(g.id);
                        return (
                          <button key={g.id} disabled={linkStars.isPending}
                            onClick={()=>linkStars.mutate({ id: h.id, goalIds: on ? linked.filter(x=>x!==g.id) : [...linked, g.id] })}
                            title={on ? `Unlink from ${g.title}` : `Also serves ${g.title}`}
                            style={{fontSize:8.5,padding:"2px 7px",borderRadius:10,cursor:"pointer",maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                              border:on?"1.5px solid #c8a04a":"1px solid var(--color-border)",
                              background:on?"#c8a04a18":"var(--color-card-2)",
                              color:on?"#8a6a20":"var(--text-3)",fontWeight:on?600:400}}>
                            {on ? "★" : "☆"} {g.title}
                          </button>
                        );
                      })}
                      <button onClick={()=>setLinking(null)} style={{fontSize:8.5,padding:"2px 6px",background:"none",border:"none",cursor:"pointer",color:"var(--text-3)"}}>done</button>
                    </span>
                  ) : (
                    <button onClick={()=>setLinking(h.id)}
                      title={linked.length ? `Serves ${linked.map(id=>goalsById[id]?.title ?? "a star").join(", ")} — click to change` : "Tie this habit to a Guiding Star"}
                      style={{fontSize:8,padding:"2px 7px",borderRadius:4,flexShrink:0,cursor:"pointer",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                        border:"1px solid #c8a04a45",background:linked.length?"#c8a04a12":"none",
                        color:linked.length?"#8a6a20":"var(--text-3)",fontWeight:600}}>
                      {linked.length
                        ? `★ ${first?.title ?? "star"}${linked.length > 1 ? ` +${linked.length - 1}` : ""}`
                        : "☆ star"}
                    </button>
                  );
                })()}
                {asArr(h.favoredElements).length > 0 && (
                  <div style={{display:"flex",gap:2,flexShrink:0}} title={`Elements: ${asArr(h.favoredElements).join(", ")}`}>
                    {asArr(h.favoredElements).map(el => (
                      <span key={el} style={{width:6,height:6,borderRadius:"50%",background:elementColor(el, "var(--color-border)"),display:"inline-block"}}/>
                    ))}
                  </div>
                )}
                {asArr(h.favoredPlanets).length > 0 && (
                  <span role="img" aria-label={`Supports: ${asArr(h.favoredPlanets).join(", ")}`} style={{display:"flex",gap:3,flexShrink:0,fontSize:12}} title={`Supports: ${asArr(h.favoredPlanets).join(", ")}`}>
                    {asArr(h.favoredPlanets).map(p => <Glyph key={p} name={p} size={12} bg="var(--color-card)" />)}
                  </span>
                )}
                <div style={{fontSize:8,padding:"2px 6px",borderRadius:4,background:tb,color:tc,fontWeight:600,flexShrink:0}}>{h.timing}</div>
                {/* Schedule this habit — habits want recurring good-time blocks;
                    this finds the next one. Owner: 'habits need help figuring
                    out when to schedule.' */}
                <button onClick={()=>setSuggestFor({ title: h.name, goalId: h.goalId })} title="Find a good time for this habit"
                  style={{fontSize:8.5,padding:"2px 7px",borderRadius:5,border:"1px solid #c8b06a55",background:"#c8b06a12",color:"#8a6a20",fontWeight:600,cursor:"pointer",flexShrink:0}}>◷ schedule</button>
                <button onClick={()=>startEditing(h)} aria-label={`Edit ${h.name}`} title="Edit — including how often"
                  style={{fontSize:10,color: editingId===h.id ? "var(--color-brass)" : "var(--text-3)",background:"none",border:"none",cursor:"pointer",padding:"0 4px",fontWeight:editingId===h.id?600:400}}>Edit</button>
                <button onClick={()=>removeHabit.mutate(h.id)} aria-label="Delete habit" style={{fontSize:11,color:"var(--text-3)",background:"none",border:"none",cursor:"pointer",padding:"0 2px"}}>✕</button>
              </div>

              {/* 14-day streak dots. "14d" alone named nothing — a row of
                  dots beside an unexplained abbreviation is a mark the reader
                  has to decode (owner, 2026-08-13). Each dot says its own
                  date and whether it was done, and the label says what the
                  row is.

                  EACH DOT IS ALSO THE CONTROL FOR ITS DAY. A habit you did
                  yesterday and forgot to check off had nowhere to be recorded:
                  the day was right here on screen and the only writable day
                  was today. The dots are the obvious place for it — the row
                  already knows every date and already shows the answer, so it
                  only ever lacked the click. */}
              <div style={{display:"flex",gap:3,alignItems:"center"}} title="The last fourteen days — filled means done. Click a day to change it.">
                {h.days.map((d) => {
                  const label = new Date(d.date + "T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});
                  return (
                    <button key={d.date}
                      onClick={() => toggleLog.mutate({ id: h.id, done: d.done, date: d.date })}
                      disabled={toggleLog.isPending}
                      aria-pressed={d.done}
                      aria-label={`${d.done ? "Unmark" : "Mark"} ${h.name} on ${label}`}
                      title={`${label}${d.done ? " — done" : d.isToday ? " — today, not yet" : " — not done"}. Click to ${d.done ? "clear" : "mark done"}.`}
                      style={{
                        // The hit area is larger than the dot. A 7px target is
                        // unhittable on a phone, and growing the dot itself
                        // would wreck the row it has to read as.
                        padding:4, margin:-4, background:"none", border:"none",
                        cursor: toggleLog.isPending ? "default" : "pointer",
                        lineHeight:0, flexShrink:0,
                      }}>
                      <span style={{
                        display:"block",
                        width:d.isToday?10:7, height:d.isToday?10:7, borderRadius:"50%",
                        background:d.done?"#80b870":"var(--color-card-2)",
                        border:d.isToday?`1.5px solid ${h.doneToday?"#60a050":"#c0bab0"}`:"none",
                        opacity:d.done||d.isToday?1:0.4,
                      }}/>
                    </button>
                  );
                })}
                <div style={{fontSize:8.5,color:"var(--text-3)",marginLeft:5}}>last 14 days · click to fill one in</div>
              </div>

              {/* Timing note — the merged practices intelligence, in plain words */}
              {h.resonanceNote && h.timing !== "neutral" && (
                <div style={{fontSize:9.5,color:tc,marginTop:6,paddingTop:6,borderTop:"1px solid var(--color-border)"}}>
                  {h.timing === "resonant" ? "✦ " : h.timing === "soften" || h.timing === "protect" ? "◡ " : "· "}{h.resonanceNote}
                </div>
              )}
            </div>
          );
        })}

        {habits.length === 0 && !showAdd && (
          <div style={{textAlign:"center",padding:"48px 0",color:"var(--text-3)",fontSize:13}}>
            {/* empty / unavailable / loading are three different sentences. */}
            {(() => {
              const st = listState({ data: habits, isError: habitsError, isLoading: habitsLoading });
              if (st === "unavailable") return <span style={{color:"#a05050"}}>Couldn't load your habits — this is a connection problem, not an empty list.</span>;
              if (habitsLoading) return "Loading…";
              return testerId ? "No habits yet; add one above." : "Set up your profile first.";
            })()}
          </div>
        )}
      </div>

      {suggestFor && (
        <ScheduleSuggest
          title={suggestFor.title} testerId={testerId} lat={lat} lon={lon}
          goalId={suggestFor.goalId} projectId={suggestFor.projectId} kind="habit"
          onClose={() => setSuggestFor(null)}
        />
      )}
    </div>
  );
}
