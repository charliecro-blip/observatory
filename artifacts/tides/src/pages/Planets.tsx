import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrents, useNatalAngles } from "@/hooks/useTides";
import { PLANET_CORE, planetInSignNote } from "@/lib/sky-readings";
import { PLANET_LITERACY, CONTACT_TONE } from "@/lib/sky-literacy";
import { HOUSE_MEANINGS } from "@/lib/currents-content";
import { PLANET_GLYPH as GLYPH } from "@/lib/glyphs";
import Glyph from "@/components/Glyph";
import ChartWheel from "@/components/ChartWheel";
import { PremiumGate } from "@/components/PremiumGate";

// Star Base — the cosmic-navigation console. Move between the ten planets (the
// drives you're made of) and the twelve houses (the arenas of your life), see
// what each means, how it lives in your chart, and how the sky is moving it now.
// A check-in on any of them opens a real reflection in Compass. Composes content
// that already exists (sky-readings, HOUSE_MEANINGS, currents transits).

const ORDER = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
const COLOR: Record<string, string> = {
  Sun: "#c8971e", Moon: "#5a6b8c", Mercury: "#7a8a4a", Venus: "#3f8493", Mars: "#c04830",
  Jupiter: "#7a5cae", Saturn: "#6a6258", Uranus: "#3a9aa8", Neptune: "#5a6cae", Pluto: "#7a3a5a",
};
const ELEMENT_COLOR: Record<string, string> = { fire: "#c04830", earth: "#4a7040", air: "#c19a3a", water: "#3a5a80" };
// House → its natural element (whole-sign from Aries=1) for a quiet accent.
const HOUSE_ELEMENT = ["fire", "earth", "air", "water", "fire", "earth", "air", "water", "fire", "earth", "air", "water"];

const CHECK_IN: Record<string, string> = {
  Sun: "Where do you most want to be seen right now — and where are you dimming yourself?",
  Moon: "What does the feeling body need today that you've been overriding?",
  Mercury: "What conversation or piece of writing is waiting for your attention?",
  Venus: "What would you do differently if you trusted what you actually enjoy?",
  Mars: "Where is your drive going this week — and where are you forcing something?",
  Jupiter: "Where could you say yes bigger — and where is more not the answer?",
  Saturn: "What unglamorous work, done consistently, would change everything in a year?",
  Uranus: "What are you ready to break free from, even a little?",
  Neptune: "What are you longing for — and what are you avoiding seeing clearly?",
  Pluto: "What needs to end so something truer can grow?",
};
const HOUSE_CHECK_IN: Record<number, string> = {
  1: "How are you showing up lately — and does it feel like you?",
  2: "What do you actually value, underneath what you're supposed to want?",
  3: "What have you been meaning to say, learn, or write?",
  4: "What would make home — inside or out — feel more like yours?",
  5: "Where has play, romance, or making things gone quiet?",
  6: "What daily rhythm is serving you, and what's quietly draining you?",
  7: "What's alive in your closest partnerships right now?",
  8: "What are you holding onto that's asking to be shared or released?",
  9: "What bigger question or horizon is pulling at you?",
  10: "What do you want to be known for — and is your work pointed there?",
  11: "Who are your people, and what future are you building toward together?",
  12: "What needs rest, retreat, or gentle release right now?",
};

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function planetSeed(planet: string, name: string, sign: string | undefined, house: number | null | undefined, activations: any[]): string {
  const parts = [`I want to check in with my inner ${name}.`];
  if (sign) parts.push(`In my chart it's in ${sign}${house ? `, my ${ordinal(house)} house` : ""}.`);
  if (activations.length) parts.push(`Right now, transiting ${activations[0].transitPlanet} is ${String(activations[0].aspect).toLowerCase()} it.`);
  parts.push(`Help me reflect: ${CHECK_IN[planet]}`);
  return parts.join(" ");
}
function houseSeed(house: number, title: string, natalHere: any[], transitsHere: any[]): string {
  const parts = [`I want to reflect on my ${ordinal(house)} house — ${title.toLowerCase()}.`];
  if (natalHere.length) parts.push(`My natal ${natalHere.map((p: any) => p.planet).join(" and ")} sits here.`);
  if (transitsHere.length) parts.push(`Right now, ${transitsHere.map((t: any) => t.planet).join(" and ")} is moving through it.`);
  parts.push(`Help me reflect: ${HOUSE_CHECK_IN[house]}`);
  return parts.join(" ");
}

function CheckInCard({ label, question, accent, onReflect, seed }: { label: string; question: string; accent: string; onReflect?: (s: string) => void; seed: string }) {
  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderLeft: `3px solid ${accent}`, borderRadius: 10, padding: "13px 16px" }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.7px", color: "#aaa", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: "var(--color-foreground)", lineHeight: 1.6, fontStyle: "italic", marginBottom: 10 }}>{question}</div>
      {onReflect && (
        <button onClick={() => onReflect(seed)} style={{ fontSize: 12, fontWeight: 600, padding: "6px 13px", borderRadius: 8, cursor: "pointer", border: `1px solid ${accent}`, background: `${accent}12`, color: accent }}>🧭 Reflect with Compass →</button>
      )}
    </div>
  );
}

function SectionCard({ label, accent, children }: { label: string; accent?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.7px", color: accent ?? "#aaa", marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

function PlanetsView({ natal, currents, onReflect, testerId, lat, lon, initialPlanet }: { natal: any; currents: any; onReflect?: (s: string) => void; testerId: string | null; lat: number; lon: number; initialPlanet?: string | null }) {
  const { data: anglesData } = useNatalAngles(testerId, lat, lon);
  const [selected, setSelected] = useState(initialPlanet && ORDER.includes(initialPlanet) ? initialPlanet : "Sun");
  useEffect(() => {
    if (initialPlanet && ORDER.includes(initialPlanet)) setSelected(initialPlanet);
  }, [initialPlanet]);
  const core = PLANET_CORE[selected] ?? { name: selected, is: "", short: "", use: "" };
  const col = COLOR[selected] ?? "#888";
  const natalPos = (natal?.planets ?? []).find((p: any) => p.planet === selected);
  const sign = natalPos?.sign as string | undefined;
  const house = natalPos?.houseNumber as number | null | undefined;
  const houseMeaning = house ? HOUSE_MEANINGS[house] : null;
  const activations = ((currents?.majorTransits ?? []) as any[]).filter((t) => t.natalPlanet === selected);

  // Your work under this planet — the stars/habits/tasks that live in its
  // domain (by explicit planet link, season anchor, or element kinship).
  // Overlap across planets is expected and fine.
  const PLANET_EL: Record<string, string> = { Sun: "fire", Mars: "fire", Jupiter: "fire", Saturn: "earth", Venus: "earth", Mercury: "air", Uranus: "air", Moon: "water", Neptune: "water", Pluto: "water" };
  const authHeaders = { ...(testerId ? { "x-tester-id": testerId } : {}) } as Record<string, string>;
  const { data: relStars = [] } = useQuery<any[]>({
    queryKey: ["north-stars", testerId],
    queryFn: async () => { const r = await fetch("/api/planning/north-stars", { headers: authHeaders }); const j = await r.json(); return Array.isArray(j) ? j : []; },
    enabled: !!testerId,
  });
  const { data: relHabits = [] } = useQuery<any[]>({
    queryKey: ["habits", testerId],
    queryFn: async () => { const r = await fetch("/api/habits", { headers: authHeaders }); const j = await r.json(); return Array.isArray(j) ? j : []; },
    enabled: !!testerId,
  });
  const { data: relTasks = [] } = useQuery<any[]>({
    queryKey: ["tasks", testerId, "all"],
    queryFn: async () => { const r = await fetch("/api/tasks", { headers: authHeaders }); const j = await r.json(); return Array.isArray(j) ? j : []; },
    enabled: !!testerId,
  });
  const planetEl = PLANET_EL[selected];
  const myStars = relStars.filter((g: any) => g.anchorPlanet === selected || g.element === planetEl);
  const starIds = new Set(myStars.map((g: any) => g.id));
  const myHabits = relHabits.filter((h: any) => (Array.isArray(h.favoredPlanets) ? h.favoredPlanets : []).includes(selected)
    || (Array.isArray(h.favoredElements) ? h.favoredElements : []).includes(planetEl));
  const myTasks = relTasks.filter((t: any) => t.done !== "true" && t.goalId != null && starIds.has(t.goalId)).slice(0, 5);

  // Sky-literacy: the weekly Moon-contact rhythm + the user's felt history on
  // this planet's days. Moon has no contacts-to-itself; its rhythm is taught
  // by the phase cycle instead.
  const lit = PLANET_LITERACY[selected];
  const { data: contacts } = useQuery<any>({
    queryKey: ["sky-literacy", selected, testerId],
    queryFn: async () => {
      const tz = new Date().getTimezoneOffset();
      const r = await fetch(`/api/sky-literacy/${selected}?tz=${tz}&lookback=30`, {
        headers: testerId ? { "x-tester-id": testerId } : {},
      });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!testerId && selected !== "Moon",
    staleTime: 1000 * 60 * 30,
  });

  return (
    <>
      <div style={{ fontSize: 12.5, color: "#888", lineHeight: 1.6, marginBottom: 8 }}>
        The ten drives you're made of. Visit one to see what it means, how it lives in your chart, and how the sky is moving it right now.
      </div>
      {/* (The orrery chart is parked for now — owner found it distracting on
          this page. The component survives at components/Orrery.tsx for a
          future "sky map" surface.) */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 22, marginTop: 8 }}>
        {ORDER.map((p) => {
          const active = p === selected, pc = COLOR[p] ?? "#888";
          return (
            <button key={p} onClick={() => setSelected(p)} title={p} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 999, cursor: "pointer",
              border: active ? `1.5px solid ${pc}` : "1px solid var(--color-border)", background: active ? `${pc}14` : "var(--color-card)",
              color: active ? pc : "#888", fontWeight: active ? 600 : 400, fontSize: 12,
            }}><Glyph name={p} size={15} bg="var(--color-card)" tint={active} style={active ? undefined : { color: "#999" }} />{p}</button>
          );
        })}
      </div>

      <div style={{ background: `linear-gradient(180deg, ${col}12, ${col}04)`, border: "1px solid var(--color-border)", borderRadius: 14, padding: "18px 20px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 6 }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0, background: `${col}20`, display: "flex", alignItems: "center", justifyContent: "center" }}><Glyph name={selected} size={26} bg="var(--color-card)" /></div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-primary)" }}>Your inner {core.name}</div>
            <div style={{ fontSize: 12, color: col, fontWeight: 600 }}>{core.short}</div>
          </div>
        </div>
        <div style={{ fontSize: 13.5, color: "var(--color-foreground)", lineHeight: 1.65, marginTop: 8 }}>{core.name} is {core.is}. Good for {core.use}.</div>
      </div>

      {/* ── Sky literacy: how it feels, when it comes around, what it means long-term ── */}
      {lit && (
        <SectionCard label={`How ${lit.adjective} time feels`} accent={col}>
          <div style={{ fontSize: 12.5, color: "var(--color-foreground)", lineHeight: 1.65 }}>{lit.feelsLike}</div>
          <div style={{ fontSize: 12, color: "#8a7060", lineHeight: 1.6, marginTop: 8 }}>
            <b style={{ color: "#7a6050" }}>The honest edge:</b> {lit.shadow}
          </div>
          <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6, marginTop: 8 }}>
            <b style={{ color: col }}>Use it:</b> {lit.useIt}
          </div>
          {lit.etymology && (
            <div style={{ fontSize: 10.5, color: "#a89a88", lineHeight: 1.5, marginTop: 8, fontStyle: "italic" }}>{lit.etymology}</div>
          )}
        </SectionCard>
      )}

      {/* The weekly rhythm — the learnable rep. Real ephemeris: the next Moon
          contact + the user's own felt-ratings on past contact days. */}
      {lit && selected !== "Moon" && (
        <SectionCard label={`Your ${lit.adjective} days`} accent={col}>
          <div style={{ fontSize: 12, color: "#777", lineHeight: 1.6, marginBottom: contacts ? 10 : 0 }}>{lit.weeklyNote}</div>
          {/* The Moon-contact rhythm isn't the whole story for the Sun: the
              week itself carries a solar day, and the natal Sun a monthly one. */}
          {selected === "Sun" && (
            <div style={{ fontSize: 12, color: "#777", lineHeight: 1.6, marginBottom: contacts ? 10 : 0 }}>
              Two more kinds of solar day: <b>every Sunday</b> (the Sun rules the day itself), and once a
              month <b>the Moon crosses your natal Sun</b> — a personal solar day{sign ? ` (yours is in ${sign})` : " (add your birth details to track it)"}.
            </div>
          )}
          {contacts?.nextHard && (
            <div style={{ background: `${col}0e`, border: `1px solid ${col}30`, borderRadius: 9, padding: "9px 12px", marginBottom: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-foreground)" }}>
                Next one: {new Date(contacts.nextHard.at).toLocaleDateString("en-US", { weekday: "long" })}{" "}
                <span style={{ fontWeight: 400, color: "#999" }}>
                  around {new Date(contacts.nextHard.at).toLocaleTimeString("en-US", { hour: "numeric" })} · Moon {contacts.nextHard.aspect} {selected}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#888", lineHeight: 1.5, marginTop: 3 }}>
                Likely to arrive {CONTACT_TONE[contacts.nextHard.aspect] ?? "as a distinct flavor in the day"}. Notice it — then rate the day on Today and see if you felt it.
              </div>
            </div>
          )}
          {contacts && contacts.pastHardDays?.length > 0 && (
            <div style={{ fontSize: 11.5, color: "#888", lineHeight: 1.6 }}>
              Last 30 days: <b style={{ color: "#666" }}>{contacts.pastHardDays.length}</b> {lit.adjective} day{contacts.pastHardDays.length === 1 ? "" : "s"}.
              {contacts.ratedCount > 0
                ? <> You rated {contacts.ratedCount} of them — <b style={{ color: "#4a8060" }}>{contacts.alignedCount} felt aligned</b>. Your evidence lives in the Log.</>
                : <> None rated yet — rate days on Today and your own evidence will build here.</>}
            </div>
          )}
        </SectionCard>
      )}
      {lit && selected === "Moon" && (
        <SectionCard label="The Moon's rhythm" accent={col}>
          <div style={{ fontSize: 12, color: "#777", lineHeight: 1.6 }}>{lit.weeklyNote}</div>
        </SectionCard>
      )}

      {/* Your work under this planet — where the archetype meets the to-do list */}
      {(myStars.length > 0 || myHabits.length > 0 || myTasks.length > 0) && (
        <SectionCard label={`Your work under ${core.name}`} accent={col}>
          {myStars.length > 0 && (
            <div style={{ marginBottom: myHabits.length || myTasks.length ? 8 : 0 }}>
              {myStars.map((g: any) => (
                <div key={g.id} style={{ display: "flex", alignItems: "baseline", gap: 7, padding: "2px 0" }}>
                  <span style={{ fontSize: 11, color: col }}>✦</span>
                  <span style={{ fontSize: 12.5, color: "var(--color-foreground)" }}>{g.title}</span>
                  <span style={{ fontSize: 9.5, color: "#aaa" }}>{g.anchorPlanet === selected ? `rides ${selected}` : "element kin"}</span>
                </div>
              ))}
            </div>
          )}
          {myHabits.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: myTasks.length ? 8 : 0 }}>
              {myHabits.map((h: any) => (
                <span key={h.id} style={{ fontSize: 10.5, padding: "3px 10px", borderRadius: 12, border: `1px solid ${col}30`, background: `${col}0c`, color: "var(--color-foreground)" }}>
                  ↻ {h.name}{h.streak > 0 ? ` · ${h.streak}d` : ""}
                </span>
              ))}
            </div>
          )}
          {myTasks.length > 0 && myTasks.map((t: any) => (
            <div key={t.id} style={{ display: "flex", alignItems: "baseline", gap: 7, padding: "1px 0" }}>
              <span style={{ fontSize: 10, color: "#ccc" }}>○</span>
              <span style={{ fontSize: 11.5, color: "#7a736a" }}>{t.title}</span>
            </div>
          ))}
          <div style={{ fontSize: 9.5, color: "#b0a898", marginTop: 6 }}>
            {selected === "Moon" ? "Work that shares the Moon's water." : `Aims anchored to ${selected} or sharing its ${planetEl} nature — overlap with other planets is normal.`}
          </div>
        </SectionCard>
      )}

      <SectionCard label="The long arc" accent={col}>
        <div style={{ fontSize: 12.5, color: "var(--color-foreground)", lineHeight: 1.65 }}>{lit?.longArc}</div>
      </SectionCard>

      {/* Personal timing — when THIS planet's natal degree crosses the local
          angles today. Rising = the day's personal sunrise for this drive;
          culminating = its noon. Classic electional practice, made ambient. */}
      {(() => {
        const evs = (anglesData?.events ?? []).filter((e) => e.planet === selected);
        if (!evs.length) return null;
        const fmt = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        const rise = evs.find((e) => e.angle === "ASC");
        const culm = evs.find((e) => e.angle === "MC");
        const soon = evs.find((e) => Math.abs(Date.parse(e.at) - Date.now()) < 15 * 60000);
        return (
          <div style={{ background: soon ? `${col}14` : "var(--color-card)", border: `1px solid ${soon ? col : "var(--color-border)"}`, borderRadius: 12, padding: "11px 16px", marginBottom: 14, display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.7px", color: soon ? col : "#aaa" }}>{soon ? `✦ your ${core.name} is on an angle now` : "Today at your location"}</span>
            {rise && <span style={{ fontSize: 12.5, color: "var(--color-foreground)" }}><b style={{ color: col }}>rises</b> {fmt(rise.at)}{rise.approximate ? " ~" : ""}</span>}
            {culm && <span style={{ fontSize: 12.5, color: "var(--color-foreground)" }}><b style={{ color: col }}>culminates</b> {fmt(culm.at)}{culm.approximate ? " ~" : ""}</span>}
            <span style={{ fontSize: 10, color: "#999" }}>good moments to lead with {core.short.replace(/^the /, "")}</span>
          </div>
        );
      })()}

      <SectionCard label="In your chart">
        {sign ? (
          <>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-foreground)", marginBottom: 4 }}>{core.name} in {sign}{house ? ` · your ${ordinal(house)} house` : ""}</div>
            <div style={{ fontSize: 12.5, color: "#777", lineHeight: 1.6 }}>{planetInSignNote(selected, sign)}</div>
            {houseMeaning ? (
              <div style={{ fontSize: 12, color: "#888", lineHeight: 1.6, marginTop: 6 }}>Your {ordinal(house!)} house is the ground of <b style={{ color: "#666" }}>{houseMeaning.title.toLowerCase()}</b> — {houseMeaning.domains}. That's where this drive most wants to act.</div>
            ) : (
              <div style={{ fontSize: 11.5, color: "#aaa", marginTop: 6 }}>Add your birth time in Settings to see which house it lives in.</div>
            )}
          </>
        ) : <div style={{ fontSize: 12.5, color: "#aaa" }}>Add your birth details in Settings to see where {core.name} sits in your chart.</div>}
      </SectionCard>

      <div style={{ background: activations.length ? "#8a6a2008" : "var(--color-card)", border: `1px solid ${activations.length ? "#c8a84040" : "var(--color-border)"}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.7px", color: activations.length ? "#a8862e" : "#aaa", marginBottom: 8 }}>Being activated now</div>
        {activations.length ? activations.map((t: any, i: number) => (
          <div key={i} style={{ marginBottom: i < activations.length - 1 ? 8 : 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-foreground)" }}>{GLYPH[t.transitPlanet]} transiting {t.transitPlanet} {String(t.aspect).toLowerCase()} your {core.name}<span style={{ fontWeight: 400, color: "#999", marginLeft: 6 }}>{t.exact ? "exact now" : `${t.orb}° orb`}</span></div>
            {t.likelyDomains?.length > 0 && <div style={{ fontSize: 12, color: "#8a7a50", lineHeight: 1.6, marginTop: 2 }}>Often felt around {t.likelyDomains.slice(0, 3).join(", ")}.</div>}
          </div>
        )) : <div style={{ fontSize: 12.5, color: "#999" }}>Quiet right now — no slow planet is touching your {core.name}. It's running at its natural baseline.</div>}
      </div>

      <CheckInCard label={`Check in with your inner ${core.name}`} question={CHECK_IN[selected]} accent={col} onReflect={onReflect} seed={planetSeed(selected, core.name, sign, house, activations)} />
    </>
  );
}

function HousesView({ natal, currents, onReflect }: { natal: any; currents: any; onReflect?: (s: string) => void }) {
  const [selected, setSelected] = useState(1);
  const meaning = HOUSE_MEANINGS[selected] ?? { title: `House ${selected}`, domains: "", keywords: [] };
  const col = ELEMENT_COLOR[HOUSE_ELEMENT[selected - 1]] ?? "#888";
  const natalHere = (natal?.planets ?? []).filter((p: any) => p.houseNumber === selected);
  const transitsHere = ((currents?.transitsByHouse ?? []) as any[]).filter((t) => t.house === selected);
  const isProfected = currents?.profection?.house === selected;
  const hasHouses = (natal?.planets ?? []).some((p: any) => p.houseNumber != null);

  return (
    <>
      <div style={{ fontSize: 12.5, color: "#888", lineHeight: 1.6, marginBottom: 16 }}>
        The twelve arenas of a life. Visit one to see what it governs, which of your planets live there, and what the sky is moving through it now.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 22 }}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => {
          const active = h === selected, hc = ELEMENT_COLOR[HOUSE_ELEMENT[h - 1]] ?? "#888";
          return (
            <button key={h} onClick={() => setSelected(h)} title={HOUSE_MEANINGS[h]?.title} style={{
              padding: "5px 11px", borderRadius: 999, cursor: "pointer", fontSize: 12,
              border: active ? `1.5px solid ${hc}` : "1px solid var(--color-border)", background: active ? `${hc}14` : "var(--color-card)",
              color: active ? hc : "#888", fontWeight: active ? 600 : 400,
            }}>{ordinal(h)}</button>
          );
        })}
      </div>

      <div style={{ background: `linear-gradient(180deg, ${col}12, ${col}04)`, border: "1px solid var(--color-border)", borderRadius: 14, padding: "18px 20px", marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-primary)" }}>Your {ordinal(selected)} house · {meaning.title}</div>
        <div style={{ fontSize: 13, color: col, fontWeight: 600, marginTop: 2 }}>{meaning.domains}</div>
        {meaning.keywords?.length > 0 && <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>{meaning.keywords.join(" · ")}</div>}
      </div>

      <SectionCard label="Your planets here">
        {!hasHouses ? (
          <div style={{ fontSize: 12.5, color: "#aaa" }}>Add your birth time in Settings — houses need an exact time to place your planets.</div>
        ) : natalHere.length ? (
          natalHere.map((p: any, i: number) => (
            <div key={i} style={{ fontSize: 13, color: "var(--color-foreground)", padding: "2px 0" }}>{GLYPH[p.planet]} {p.planet} in {p.sign} <span style={{ color: "#999", fontSize: 12 }}>— this drive lives in this arena of your life.</span></div>
          ))
        ) : <div style={{ fontSize: 12.5, color: "#999" }}>No natal planets sit here — this house is furnished by its ruler and whatever's transiting through.</div>}
      </SectionCard>

      <div style={{ background: (isProfected || transitsHere.length) ? "#8a6a2008" : "var(--color-card)", border: `1px solid ${(isProfected || transitsHere.length) ? "#c8a84040" : "var(--color-border)"}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.7px", color: (isProfected || transitsHere.length) ? "#a8862e" : "#aaa", marginBottom: 8 }}>Being activated now</div>
        {isProfected && (
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-foreground)", marginBottom: transitsHere.length ? 8 : 0 }}>★ This is your profected year — the whole year points here{currents?.profection?.timeLord ? `, ruled by ${currents.profection.timeLord}` : ""}.</div>
        )}
        {transitsHere.map((t: any, i: number) => (
          <div key={i} style={{ fontSize: 13, color: "var(--color-foreground)", padding: "2px 0" }}>{GLYPH[t.planet]} {t.planet} moving through{t.retrograde ? " (retrograde)" : ""} — a slow chapter here{t.leavesHouse ? ` until ${new Date(t.leavesHouse).toLocaleDateString("en-US", { month: "short", year: "numeric" })}` : ""}.</div>
        ))}
        {!isProfected && transitsHere.length === 0 && <div style={{ fontSize: 12.5, color: "#999" }}>Quiet right now — no slow planet is moving through this house.</div>}
      </div>

      <CheckInCard label={`Reflect on your ${ordinal(selected)} house`} question={HOUSE_CHECK_IN[selected]} accent={col} onReflect={onReflect} seed={houseSeed(selected, meaning.title, natalHere, transitsHere)} />
    </>
  );
}

// ── ChartView — the practitioner astro clock (premium) ──────────────────────
const ASP_GLYPH: Record<string, string> = { Conjunction: "☌", Sextile: "⚹", Square: "□", Trine: "△", Opposition: "☍" };
const ASP_TONE: Record<string, string> = { Conjunction: "#a8862e", Sextile: "#5a8fb0", Square: "#c05a4a", Trine: "#5a9a6a", Opposition: "#c05a4a" };
const SEV_ORDER: Record<string, number> = { major: 0, strong: 1, moderate: 2, mild: 3 };

function ChartView({ testerId }: { testerId: string | null }) {
  const [picked, setPicked] = useState<{ transitPlanet: string; natalPlanet: string; aspect: string } | null>(null);
  const [reading, setReading] = useState<{ key: string; text: string } | null>(null);
  const [loadingRead, setLoadingRead] = useState(false);

  const { data: chart, isLoading } = useQuery<any>({
    queryKey: ["chart-now", testerId],
    queryFn: async () => {
      const hs = (typeof localStorage !== "undefined" && localStorage.getItem("obs_house_system")) || "whole-sign";
      const r = await fetch(`/api/chart/now?houseSystem=${hs}`, { headers: testerId ? { "x-tester-id": testerId } : {} });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 1000 * 60 * 5,
  });

  async function explicate(a: { transitPlanet: string; natalPlanet: string; aspect: string }) {
    setPicked(a);
    const key = `${a.transitPlanet}-${a.aspect}-${a.natalPlanet}`;
    setLoadingRead(true);
    setReading(null);
    try {
      const hs = (typeof localStorage !== "undefined" && localStorage.getItem("obs_house_system")) || "whole-sign";
      const r = await fetch("/api/chart/explicate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) },
        body: JSON.stringify({ ...a, houseSystem: hs }),
      });
      const data = await r.json();
      setReading({ key, text: data.reading ?? "No reading available." });
    } catch {
      setReading({ key, text: "Couldn't reach the reader — try again." });
    } finally {
      setLoadingRead(false);
    }
  }

  if (isLoading) return <div style={{ fontSize: 12, color: "#999", padding: 20 }}>Casting the chart…</div>;
  if (!chart) return <div style={{ fontSize: 12.5, color: "#aaa", padding: 20 }}>Add your birth details in Settings to see your chart.</div>;

  const aspects = (chart.aspects ?? []) as any[];

  return (
    <>
      <div style={{ fontSize: 12.5, color: "#888", lineHeight: 1.6, marginBottom: 14 }}>
        Your natal chart with today's sky ringed outside it — the live geometry. Tap any transit for a reading that weighs it against the rest of your chart.
        {!chart.timeKnown && <span style={{ color: "#a08040" }}> Houses and angles are hidden — add your birth time to draw them.</span>}
      </div>

      <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 14, padding: "16px 12px", marginBottom: 16 }}>
        <ChartWheel
          natalPlanets={chart.natal.planets}
          transitPlanets={chart.transit}
          cusps={chart.natal.cusps}
          ascendant={chart.natal.ascendant}
          aspects={aspects}
          highlight={picked}
          onPickAspect={(a) => explicate({ transitPlanet: a.transitPlanet, natalPlanet: a.natalPlanet, aspect: a.aspect })}
        />
      </div>

      {/* Ranked transit stack */}
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.7px", color: "#aaa", marginBottom: 8 }}>Transits now · strongest first</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[...aspects].sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9) || a.orb - b.orb).slice(0, 14).map((a: any, i: number) => {
          const key = `${a.transitPlanet}-${a.aspect}-${a.natalPlanet}`;
          const isPicked = picked && picked.transitPlanet === a.transitPlanet && picked.natalPlanet === a.natalPlanet && picked.aspect === a.aspect;
          return (
            <div key={i} style={{ border: `1px solid ${isPicked ? ASP_TONE[a.aspect] : "var(--color-border)"}`, borderRadius: 9, background: "var(--color-card)", overflow: "hidden" }}>
              <button onClick={() => explicate({ transitPlanet: a.transitPlanet, natalPlanet: a.natalPlanet, aspect: a.aspect })}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  <Glyph name={a.transitPlanet} size={15} bg="var(--color-card)" />
                  <span style={{ color: ASP_TONE[a.aspect], fontWeight: 700, fontSize: 13 }}>{ASP_GLYPH[a.aspect] ?? a.aspect}</span>
                  <Glyph name={a.natalPlanet} size={15} bg="var(--color-card)" />
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--color-foreground)" }}>
                  {a.transitPlanet} {a.aspect.toLowerCase()} natal {a.natalPlanet}
                  {a.natalHouse ? <span style={{ color: "#999" }}> · {ordinal(a.natalHouse)} house</span> : null}
                </span>
                {a.exact && <span style={{ fontSize: 9, color: "#a8862e", fontWeight: 600 }}>exact</span>}
                <span style={{ fontSize: 10, color: "#aaa", fontVariantNumeric: "tabular-nums" }}>{a.orb.toFixed(1)}°</span>
              </button>
              {isPicked && (
                <div style={{ padding: "10px 14px", borderTop: `1px solid var(--color-border)`, background: "var(--color-card-2)" }}>
                  {loadingRead && reading?.key !== key ? (
                    <div style={{ fontSize: 11, color: "#999" }}>Reading the chart…</div>
                  ) : reading?.key === key ? (
                    <div style={{ fontSize: 12, color: "var(--color-foreground)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{reading.text}</div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
        {aspects.length === 0 && <div style={{ fontSize: 12, color: "#999" }}>No transits in orb right now — a quiet sky.</div>}
      </div>
    </>
  );
}

export default function StarBase({ testerId, lat = 40.7, lon = -74.0, onReflect, initialPlanet }: { testerId: string | null; lat?: number; lon?: number; onReflect?: (seed: string) => void; initialPlanet?: string | null }) {
  const [mode, setMode] = useState<"planets" | "houses" | "chart">("planets");
  // Arriving via a teachable-moment link ("today feels saturnine → visit
  // Saturn") lands directly on that planet's page.
  useEffect(() => { if (initialPlanet) setMode("planets"); }, [initialPlanet]);
  // FILED AWAY (owner, 2026-07-11): Houses and the practitioner Chart are
  // hidden for now — too much surface too soon. The views and their routes
  // stay fully built; flip this to re-reveal (Chart stays premium-gated).
  const SHOW_ADVANCED_MODES = false;

  const { data: natal } = useQuery<any>({
    queryKey: ["natal-chart", testerId],
    queryFn: async () => {
      const r = await fetch("/api/natal-chart", { headers: testerId ? { "x-tester-id": testerId } : {} });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!testerId,
  });
  const { data: currents } = useCurrents(testerId, (typeof localStorage !== "undefined" && localStorage.getItem("obs_house_system")) || "whole-sign");

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "24px 28px 60px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "-0.3px", marginBottom: 12 }}>Star Base</div>
        {/* Console toggle — hidden while Houses/Chart are filed away */}
        {SHOW_ADVANCED_MODES && (
        <div style={{ display: "inline-flex", padding: 3, gap: 3, borderRadius: 10, background: "var(--color-card-2)", border: "1px solid var(--color-border)", marginBottom: 18 }}>
          {([["planets", "Planets"], ["houses", "Houses"], ["chart", "Chart ⊕"]] as const).map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: "6px 16px", borderRadius: 8, fontSize: 12.5, cursor: "pointer", border: "none",
              background: mode === m ? "var(--color-card)" : "transparent", color: mode === m ? "var(--color-primary)" : "#999",
              fontWeight: mode === m ? 600 : 400, boxShadow: mode === m ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            }}>{label}</button>
          ))}
        </div>
        )}

        {mode === "planets" && <PlanetsView natal={natal} currents={currents} onReflect={onReflect} testerId={testerId} lat={lat} lon={lon} initialPlanet={initialPlanet} />}
        {mode === "houses" && <HousesView natal={natal} currents={currents} onReflect={onReflect} />}
        {mode === "chart" && (
          <PremiumGate feature="practitioner">
            <ChartView testerId={testerId} />
          </PremiumGate>
        )}
      </div>
    </div>
  );
}
