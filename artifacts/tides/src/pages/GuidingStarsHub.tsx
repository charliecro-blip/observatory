import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNorthStars, useCurrents } from "@/hooks/useTides";
import { ELEMENT_MYTHOS, sortIntentToElement, type ElementMythos } from "@/lib/mythos";
import { usePremium } from "@/contexts/premium-context";
import { useTester } from "@/contexts/tester-context";
import { CAUTION_PLANET_ARCHETYPE } from "@/lib/tester-profile";
import { HOUSE_MEANINGS } from "@/lib/currents-content";
import { ScheduleSuggest } from "@/components/ScheduleSuggest";

const ELEMENTS = ["fire", "earth", "air", "water"] as const;
const MAX_ACTIVE_STARS = 5;

const PLANET_GLYPH: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂",
  Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇",
};

const ELEMENT_INFO: Record<string, { color: string; label: string }> = {
  fire:  { color: "#c04830", label: "Fire" },
  earth: { color: "#4a7040", label: "Earth" },
  air:   { color: "#7040a0", label: "Air" },
  water: { color: "#3a5a80", label: "Water" },
};

const HORIZON_COLORS: Record<string, { bg: string; color: string }> = {
  near: { bg: "#dbeafe", color: "#2a5a90" },
  mid:  { bg: "#f0e8d8", color: "#8a5020" },
  long: { bg: "#e8d8f0", color: "#602080" },
};

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
export default function GuidingStarsHub({ testerId, lat = 40.7, lon = -74.0, onNavigate }: {
  testerId: string | null;
  lat?: number; lon?: number;
  onNavigate: (tab: "tasks" | "habits" | "projects") => void;
}) {
  const qc = useQueryClient();
  const { data: stars, isLoading } = useNorthStars(testerId);
  const { unlocked: premiumUnlocked } = usePremium();
  const { profile } = useTester();
  const { data: currentsData } = useCurrents(testerId, houseSystemPref());
  const cautionPlanets = profile?.cautionPlanets;
  const activeCautionMatches = premiumUnlocked && cautionPlanets && cautionPlanets.length > 0
    ? (currentsData?.cautionWindows ?? []).filter((t: any) => cautionPlanets.includes(t.cautionPlanet))
    : [];

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", horizon: "near", element: "" });
  const [pendingAnchor, setPendingAnchor] = useState<PendingAnchor | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showSeasons, setShowSeasons] = useState(false);

  const list: any[] = stars ?? [];
  // useNorthStars only returns active goals server-side today — fetch all so
  // paused ones can be shown/resumed here too, without a separate tab.
  const { data: allGoals = [] } = useQuery<any[]>({
    queryKey: ["goals", testerId],
    queryFn: async () => { const r = await fetch("/api/planning/goals", { headers: authH(testerId) }); return r.json(); },
    enabled: !!testerId,
  });
  const pausedGoals = allGoals.filter((g: any) => g.status !== "active");

  const authHeaders = { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) } as Record<string, string>;
  const { data: allTasks = [] } = useQuery<any[]>({
    queryKey: ["tasks", testerId, "all"],
    queryFn: async () => (await fetch("/api/tasks", { headers: authHeaders })).json(),
    enabled: !!testerId,
  });
  const { data: allHabits = [] } = useQuery<any[]>({
    queryKey: ["habits", testerId],
    queryFn: async () => (await fetch("/api/habits", { headers: authHeaders })).json(),
    enabled: !!testerId,
  });

  const addGoal = useMutation({
    mutationFn: async () => {
      const body = {
        ...form,
        ...(pendingAnchor ? {
          element: pendingAnchor.element,
          anchorKind: pendingAnchor.kind,
          anchorPlanet: pendingAnchor.planet ?? null,
          anchorHouse: pendingAnchor.house,
          anchorUntil: pendingAnchor.until,
        } : {}),
      };
      const r = await fetch("/api/planning/goals", { method: "POST", headers: authH(testerId), body: JSON.stringify(body) });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message ?? "Failed"); }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["north-stars"] });
      setForm({ title: "", description: "", horizon: "near", element: "" });
      setPendingAnchor(null); setShowForm(false); setFormError(null);
    },
    onError: (e: any) => setFormError(e.message),
  });

  const clearAnchor = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/planning/goals/${id}`, { method: "PATCH", headers: authH(testerId), body: JSON.stringify({ anchorKind: null, anchorPlanet: null, anchorHouse: null, anchorUntil: null }) });
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
      await fetch(`/api/planning/goals/${id}`, { method: "PATCH", headers: authH(testerId), body: JSON.stringify({ element }) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); qc.invalidateQueries({ queryKey: ["north-stars"] }); },
  });

  const logSession = useMutation({
    mutationFn: async (goalId: number) => {
      const now = new Date().toISOString();
      await fetch("/api/planning/windows", {
        method: "POST", headers: authH(testerId),
        body: JSON.stringify({ title: "Logged session", goalId, adHoc: true, startTime: now, endTime: now }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["north-stars"] }),
  });

  const [quickAdd, setQuickAdd] = useState<{ goalId: number; kind: "task" | "habit" } | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  // After a linked task/habit is created, offer to find it a good time.
  const [suggestFor, setSuggestFor] = useState<{ title: string; goalId: number; kind: "task" | "habit" } | null>(null);
  const createLinked = useMutation({
    mutationFn: async ({ goalId, kind, title, element }: { goalId: number; kind: "task" | "habit"; title: string; element?: string }) => {
      if (kind === "task") {
        await fetch("/api/tasks", { method: "POST", headers: authHeaders, body: JSON.stringify({ title, goalId }) });
      } else {
        await fetch("/api/habits", { method: "POST", headers: authHeaders, body: JSON.stringify({ name: title, goalId, favoredElements: element || undefined }) });
      }
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
    byElement[el].scheduled += Math.max(g.scheduledCount ?? 0, 2);
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
    return <div style={{ padding: 40, color: "#999", fontSize: 13 }}>Reading your Guiding Stars…</div>;
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "-0.4px" }}>Guiding Stars</div>
            <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>Your long-term ideals — the few things everything else should serve</div>
          </div>
          <button onClick={() => setShowForm(v => !v)} disabled={atCap && !showForm} title={atCap ? `Only ${MAX_ACTIVE_STARS} active at a time — pause one first` : undefined} style={{
            fontSize: 11, padding: "6px 14px", borderRadius: 8, border: "1px solid var(--color-border)",
            background: showForm ? "#1a2a3a" : (atCap ? "var(--color-card-2)" : "#fff"),
            color: showForm ? "#fff" : (atCap ? "#bbb" : "#555"),
            cursor: atCap && !showForm ? "default" : "pointer", flexShrink: 0, whiteSpace: "nowrap",
          }}>
            {showForm ? "Cancel" : "+ New Guiding Star"}
          </button>
        </div>

        {/* Your long weather — Currents folded in as the context band above the
            Helm. The slow arcs moving through your chart ARE the seasons your
            Guiding Stars ride, so they belong right here where you steer, not on
            a separate page. Premium (personal chart). */}
        {premiumUnlocked && currentsData?.hasChart && (() => {
          const prof = currentsData.profection;
          const transits: any[] = currentsData.majorTransits ?? [];
          if (!prof && transits.length === 0) return null;
          return (
            <div style={{ background: "linear-gradient(180deg, var(--color-card) 0%, var(--color-card-2) 100%)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.8px", color: "#8a8ba0", marginBottom: 7 }}>Your long weather · the seasons your stars can ride</div>
              {prof && (
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-primary)", marginBottom: transits.length ? 6 : 0 }}>
                  {PLANET_GLYPH[prof.timeLord] ?? "◔"} Your {ordinal(prof.house)}-house year
                  <span style={{ fontWeight: 400, color: "#999" }}> · {HOUSE_MEANINGS[prof.house]?.title ?? ""} · ruled by {prof.timeLord}</span>
                </div>
              )}
              {transits.slice(0, 2).map((t: any, i: number) => (
                <div key={i} style={{ fontSize: 10.5, color: "#777", lineHeight: 1.5, display: "flex", gap: 6, alignItems: "baseline" }}>
                  <span style={{ color: "#a04040", flexShrink: 0 }}>{PLANET_GLYPH[t.transitPlanet]}</span>
                  <span>{t.transitPlanet} {String(t.aspect).toLowerCase()} your natal {t.natalPlanet} — {t.exact ? "exact now" : `${t.orb}° orb`}{t.likelyDomains?.length ? ` · ${t.likelyDomains.slice(0, 2).join(", ")}` : ""}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {activeCautionMatches.length > 0 && (
          <div style={{ background: "#a0404008", border: "1px solid #a0404030", borderLeft: "3px solid #a04040", borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#a04040", marginBottom: 2 }}>
              {activeCautionMatches.length === 1 ? "A caution window is active" : `${activeCautionMatches.length} caution windows are active`}
            </div>
            <div style={{ fontSize: 10.5, color: "#8a5050", lineHeight: 1.5 }}>
              {activeCautionMatches.map((t: any, i: number) => (
                <span key={i}>
                  {i > 0 && " · "}
                  {PLANET_GLYPH[t.triggerPlanet]} {t.triggerPlanet} {String(t.aspect).toLowerCase()} your {t.cautionPlanet} ({CAUTION_PLANET_ARCHETYPE[t.cautionPlanet as keyof typeof CAUTION_PLANET_ARCHETYPE]?.label.toLowerCase()})
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
            <button onClick={() => setFormError(null)} style={{ background: "none", border: "none", color: "#a04030", cursor: "pointer", fontSize: 14 }}>×</button>
          </div>
        )}

        {showForm && (
          <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>

            {pendingAnchor && (() => {
              const ec = ELEMENT_INFO[pendingAnchor.element]?.color ?? "#888";
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10.5, color: ec, background: `${ec}10`, border: `1px solid ${ec}40`, borderRadius: 7, padding: "6px 10px" }}>
                  <span style={{ fontWeight: 600 }}>⏳ {pendingAnchor.label}</span>
                  {pendingAnchor.until && <span style={{ color: "#999" }}>until {fmtMonth(pendingAnchor.until)}</span>}
                  <button onClick={() => setPendingAnchor(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#bbb", cursor: "pointer", fontSize: 12, padding: 0 }}>✕</button>
                </div>
              );
            })()}

            <input autoFocus value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="What are you steering toward?"
              style={{ padding: "8px 11px", borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 13, background: "var(--color-card-2)", outline: "none" }} />
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)"
              style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 12, background: "var(--color-card-2)", outline: "none" }} />

            <div>
              <div style={{ fontSize: 10, color: "#aaa", marginBottom: 5 }}>Which element does this live in?</div>
              <div style={{ display: "flex", gap: 4 }}>
                {(() => {
                  const suggested = !form.element ? sortIntentToElement(`${form.title} ${form.description}`) : null;
                  return Object.entries(ELEMENT_INFO).map(([key, info]) => (
                    <button key={key} onClick={() => setForm(f => ({ ...f, element: key }))} style={{
                      fontSize: 10, padding: "4px 11px", borderRadius: 10, cursor: "pointer", flex: 1,
                      border: form.element === key ? `1px solid ${info.color}` : suggested === key ? `1px dashed ${info.color}` : "1px solid #e0dad0",
                      background: form.element === key ? `${info.color}18` : "var(--color-card-2)",
                      color: form.element === key ? info.color : suggested === key ? info.color : "#999",
                      fontWeight: form.element === key ? 600 : 400,
                    }}>{info.label}{suggested === key ? " ?" : ""}</button>
                  ));
                })()}
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {(["near", "mid", "long"] as const).map(h => (
                <button key={h} onClick={() => setForm(f => ({ ...f, horizon: h }))} style={{
                  flex: 1, padding: "5px 0", borderRadius: 6, border: "1px solid", cursor: "pointer", fontSize: 11,
                  borderColor: form.horizon === h ? HORIZON_COLORS[h].color : "#d8d2ca",
                  background: form.horizon === h ? HORIZON_COLORS[h].bg : "transparent",
                  color: form.horizon === h ? HORIZON_COLORS[h].color : "#888", fontWeight: form.horizon === h ? 600 : 400,
                }}>{h}</button>
              ))}
              <button onClick={() => form.title.trim() && addGoal.mutate()} disabled={!form.title.trim()}
                style={{ padding: "5px 18px", borderRadius: 7, border: "none", fontSize: 11, background: form.title.trim() ? "#1a2a3a" : "#e0dcd6", color: form.title.trim() ? "#fff" : "#aaa", cursor: "pointer" }}>
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
                const ec = ELEMENT_INFO[a.element]?.color ?? "#888";
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0", borderBottom: "1px solid var(--color-border)" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: ec, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--color-primary)" }}>{a.label}</div>
                      <div style={{ fontSize: 9.5, color: "#999", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {sub}{a.until ? ` · until ${fmtMonth(a.until)}` : ""}
                      </div>
                    </div>
                    {isRiding
                      ? <span style={{ fontSize: 9, color: "#80a870", flexShrink: 0 }}>✓ riding this</span>
                      : <button onClick={() => start(a)} style={{ fontSize: 9.5, padding: "3px 10px", borderRadius: 8, border: `1px solid ${ec}50`, background: `${ec}10`, color: ec, cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>
                          Ride this →
                        </button>}
                  </div>
                );
              };
              return (
                <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
                  {!showSeasons ? (
                    <button onClick={() => setShowSeasons(true)} style={{ fontSize: 10.5, color: "#8a8278", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
                      Optional: anchor it to a season the sky is backing →
                    </button>
                  ) : (
                    <div style={{ background: "var(--color-card-2)", borderRadius: 10, padding: "10px 14px 4px" }}>
                      <div style={{ fontSize: 10, color: "#999", marginBottom: 6, lineHeight: 1.5 }}>
                        The long cycles moving through your chart right now — riding one gives your aim a natural season instead of an invented deadline.
                      </div>
                      {prof && (
                        <Row a={{ kind: "profection", house: prof.house, until: prof.yearEnd ?? null, element: houseElement(prof.house), label: `Your ${ordinal(prof.house)}-house year · ${HOUSE_MEANINGS[prof.house]?.title ?? ""}` }}
                          sub={`Ruler of the year: ${prof.timeLord}`} isRiding={riding("profection", prof.house)} />
                      )}
                      {chapters.map((t: any) => (
                        <Row key={t.planet} a={{ kind: "chapter", planet: t.planet, house: t.house, until: t.leavesHouse ?? null, element: houseElement(t.house), label: `${PLANET_GLYPH[t.planet] ?? ""} ${t.planet} through your ${ordinal(t.house)} · ${HOUSE_MEANINGS[t.house]?.title ?? ""}` }}
                          sub={`A slow chapter${t.retrograde ? " · currently retrograde" : ""}`} isRiding={riding("chapter", t.house, t.planet)} />
                      ))}
                      {(currentsData.majorTransits ?? []).slice(0, 3).map((t: any, i: number) => (
                        <Row key={`mt${i}`} a={{ kind: "transit", planet: t.transitPlanet, house: t.natalHouse, until: null, element: houseElement(t.natalHouse), label: `${PLANET_GLYPH[t.transitPlanet] ?? ""} ${t.transitPlanet} ${String(t.aspect).toLowerCase()} your natal ${t.natalPlanet}` }}
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
        {list.length === 0 && !showForm && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#bbb", fontSize: 13, lineHeight: 1.6 }}>
            No Guiding Stars yet. Set one above — a long-term ideal, then break it into tasks and habits right on this page.
          </div>
        )}

        {list.map((g: any) => {
          const info = ELEMENT_MYTHOS[g.element ?? ""];
          const ec = g.element ? (ELEMENT_INFO[g.element]?.color ?? "#8a8278") : "#8a8278";
          const target = Math.max(g.scheduledCount ?? 0, 2);
          const pct = Math.min(100, Math.round(((g.completedCount ?? 0) / target) * 100));
          const gTasks = allTasks.filter((t: any) => t.goalId === g.id && t.done !== "true");
          const gHabits = allHabits.filter((h: any) => h.goalId === g.id);
          const adding = quickAdd && quickAdd.goalId === g.id ? quickAdd.kind : null;
          const dLeft = daysUntil(g.anchorUntil);
          const closing = dLeft != null && dLeft >= 0 && dLeft <= 30;

          return (
            <div key={g.id} style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderLeft: `3px solid ${ec}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-foreground)" }}>{g.title}</span>
                      {info && <span style={{ fontSize: 9, color: info.color, background: `${info.color}14`, padding: "1px 7px", borderRadius: 8 }}>{info.name}</span>}
                    </div>
                    {g.description && <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{g.description}</div>}
                    {g.anchorKind && g.anchorHouse != null && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 5, fontSize: 9.5, color: ec, background: `${ec}10`, border: `1px solid ${ec}30`, borderRadius: 6, padding: "2px 7px" }}>
                        <span>⏳ {anchorLabel(g)}{g.anchorUntil ? ` · until ${fmtMonth(g.anchorUntil)}` : ""}</span>
                        {closing && <span style={{ color: "#a04040", fontWeight: 700 }}>closing soon</span>}
                        <button onClick={() => clearAnchor.mutate(g.id)} title="Unlink from this cycle" style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", fontSize: 10, padding: 0, lineHeight: 1 }}>✕</button>
                      </div>
                    )}
                    {!g.element && (
                      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                        {Object.entries(ELEMENT_INFO).map(([key, ei]) => (
                          <button key={key} onClick={() => setElement.mutate({ id: g.id, element: key })} style={{
                            fontSize: 9, padding: "2px 8px", borderRadius: 10, cursor: "pointer",
                            border: "1px solid #e0dad0", background: "var(--color-card-2)", color: "#999",
                          }}>{ei.label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => logSession.mutate(g.id)} title="Log a session for this star" style={{
                      fontSize: 9.5, padding: "3px 9px", borderRadius: 12, border: "1px solid #e0dad0",
                      background: "var(--color-card-2)", color: "#6a6258", cursor: "pointer",
                    }}>+ log</button>
                    <button onClick={() => cycleStatus.mutate({ id: g.id, status: g.status })} style={{ fontSize: 10, color: "#bbb", background: "none", border: "none", cursor: "pointer" }}>pause</button>
                  </div>
                </div>

                <div style={{ height: 3, background: "var(--color-background)", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: ec, borderRadius: 2, opacity: 0.75 }} />
                </div>
                <div style={{ fontSize: 9, color: "#999", marginTop: 3 }}>{g.completedCount ?? 0}/{target} sessions this week</div>
              </div>

              {/* Breakdown — explicit and visible, not a footnote */}
              <div style={{ padding: "10px 14px", background: "var(--color-card-2)", borderTop: "1px solid var(--color-border)" }}>
                <div style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.6px", color: "#a89a88", marginBottom: 7 }}>
                  Broken down into
                </div>
                {gTasks.length === 0 && gHabits.length === 0 && (
                  <div style={{ fontSize: 10.5, color: "#bbb", marginBottom: 6 }}>Nothing yet — add a task or habit below.</div>
                )}
                {gTasks.length > 0 && (
                  <div style={{ marginBottom: gHabits.length > 0 ? 6 : 0 }}>
                    {gTasks.slice(0, 4).map((t: any) => (
                      <div key={t.id} style={{ fontSize: 10.5, color: "#6a6258", padding: "2px 0" }}>☐ {t.title}</div>
                    ))}
                    {gTasks.length > 4 && (
                      <button onClick={() => onNavigate("tasks")} style={{ fontSize: 9.5, color: "#7a8a9a", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        +{gTasks.length - 4} more in Tasks →
                      </button>
                    )}
                  </div>
                )}
                {gHabits.length > 0 && (
                  <div>
                    {gHabits.map((h: any) => (
                      <div key={h.id} style={{ fontSize: 10.5, color: "#6a6258", padding: "2px 0" }}>↻ {h.name}</div>
                    ))}
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
                        style={{ flex: 1, padding: "4px 9px", borderRadius: 6, border: "1px solid var(--color-border)", fontSize: 11, outline: "none", background: "var(--color-card)" }}
                      />
                      <button onClick={() => quickTitle.trim() && createLinked.mutate({ goalId: g.id, kind: adding, title: quickTitle.trim(), element: g.element ?? undefined })}
                        style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, border: "none", background: "#1a2a3a", color: "#fff", cursor: "pointer" }}>Add</button>
                      <button onClick={() => { setQuickAdd(null); setQuickTitle(""); }}
                        style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "#888", cursor: "pointer" }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => { setQuickAdd({ goalId: g.id, kind: "task" }); setQuickTitle(""); }}
                        style={{ fontSize: 10.5, color: "#7a8a9a", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>+ task</button>
                      <button onClick={() => { setQuickAdd({ goalId: g.id, kind: "habit" }); setQuickTitle(""); }}
                        style={{ fontSize: 10.5, color: "#7a8a9a", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>+ habit</button>
                      <button onClick={() => onNavigate("projects")}
                        style={{ fontSize: 10.5, color: "#bbb", background: "none", border: "none", cursor: "pointer", padding: 0, marginLeft: "auto" }}>needs a project instead? →</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Weekly retro */}
        {topElement && topElement.completed > 0 && (
          <div style={{ fontSize: 11.5, color: "#888", padding: "2px 2px" }}>
            Most active element this week: <b style={{ color: ELEMENT_MYTHOS[topElement.el].color }}>{ELEMENT_MYTHOS[topElement.el].name}</b>
            {" "}({topElement.completed} session{topElement.completed === 1 ? "" : "s"} logged)
          </div>
        )}

        {/* Element cards */}
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", color: "#a89a88", marginBottom: 10 }}>
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
                    {tally.stars.length === 0 && <span style={{ fontSize: 8.5, color: "#bbb", marginLeft: "auto" }}>no Guiding Star</span>}
                  </div>
                  <div style={{ fontSize: 10.5, color: "#888", lineHeight: 1.45 }}>{m.essence}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                    {m.domains.slice(0, 3).map((d, i) => (
                      <span key={i} style={{ fontSize: 8.5, color: m.color, background: `${m.color}12`, padding: "2px 7px", borderRadius: 8 }}>{d}</span>
                    ))}
                  </div>
                  {tally.completed > 0 && (
                    <div style={{ fontSize: 9.5, color: "#999", marginTop: 2 }}>{tally.completed} session{tally.completed === 1 ? "" : "s"} this week</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Paused stars */}
        {pausedGoals.length > 0 && (
          <div style={{ paddingTop: 8, borderTop: "1px solid var(--color-border)" }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: "#ccc", marginBottom: 8 }}>Paused</div>
            {pausedGoals.map((g: any) => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 7, opacity: 0.6 }}>
                <div style={{ fontSize: 12, color: "#888", flex: 1 }}>{g.title}</div>
                <button onClick={() => cycleStatus.mutate({ id: g.id, status: g.status })} style={{ fontSize: 10, color: "#6090c0", background: "none", border: "none", cursor: "pointer" }}>resume</button>
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
