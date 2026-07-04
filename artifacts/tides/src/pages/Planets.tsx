import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrents } from "@/hooks/useTides";
import { PLANET_CORE, planetInSignNote } from "@/lib/sky-readings";
import { HOUSE_MEANINGS } from "@/lib/currents-content";
import Orrery from "@/components/Orrery";

// Star Base — the cosmic-navigation console. Move between the ten planets (the
// drives you're made of) and the twelve houses (the arenas of your life), see
// what each means, how it lives in your chart, and how the sky is moving it now.
// A check-in on any of them opens a real reflection in Compass. Composes content
// that already exists (sky-readings, HOUSE_MEANINGS, currents transits).

const ORDER = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
const GLYPH: Record<string, string> = { Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂", Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇" };
const COLOR: Record<string, string> = {
  Sun: "#c8971e", Moon: "#5a6b8c", Mercury: "#7a8a4a", Venus: "#3f8493", Mars: "#c04830",
  Jupiter: "#7a5cae", Saturn: "#6a6258", Uranus: "#3a9aa8", Neptune: "#5a6cae", Pluto: "#7a3a5a",
};
const ELEMENT_COLOR: Record<string, string> = { fire: "#c04830", earth: "#4a7040", air: "#7040a0", water: "#3a5a80" };
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

function PlanetsView({ natal, currents, onReflect }: { natal: any; currents: any; onReflect?: (s: string) => void }) {
  const [selected, setSelected] = useState("Sun");
  const core = PLANET_CORE[selected] ?? { name: selected, is: "", short: "", use: "" };
  const col = COLOR[selected] ?? "#888";
  const natalPos = (natal?.planets ?? []).find((p: any) => p.planet === selected);
  const sign = natalPos?.sign as string | undefined;
  const house = natalPos?.houseNumber as number | null | undefined;
  const houseMeaning = house ? HOUSE_MEANINGS[house] : null;
  const activations = ((currents?.majorTransits ?? []) as any[]).filter((t) => t.natalPlanet === selected);

  return (
    <>
      <div style={{ fontSize: 12.5, color: "#888", lineHeight: 1.6, marginBottom: 8 }}>
        The ten drives you're made of. Visit one to see what it means, how it lives in your chart, and how the sky is moving it right now.
      </div>
      <Orrery planets={natal?.planets ?? []} selected={selected} onSelect={setSelected} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 22, marginTop: 8 }}>
        {ORDER.map((p) => {
          const active = p === selected, pc = COLOR[p] ?? "#888";
          return (
            <button key={p} onClick={() => setSelected(p)} title={p} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 999, cursor: "pointer",
              border: active ? `1.5px solid ${pc}` : "1px solid var(--color-border)", background: active ? `${pc}14` : "var(--color-card)",
              color: active ? pc : "#888", fontWeight: active ? 600 : 400, fontSize: 12,
            }}><span style={{ fontSize: 14 }}>{GLYPH[p]}</span>{p}</button>
          );
        })}
      </div>

      <div style={{ background: `linear-gradient(180deg, ${col}12, ${col}04)`, border: "1px solid var(--color-border)", borderRadius: 14, padding: "18px 20px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 6 }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0, background: `${col}20`, color: col, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{GLYPH[selected]}</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-primary)" }}>your inner {core.name}</div>
            <div style={{ fontSize: 12, color: col, fontWeight: 600 }}>{core.short}</div>
          </div>
        </div>
        <div style={{ fontSize: 13.5, color: "var(--color-foreground)", lineHeight: 1.65, marginTop: 8 }}>{core.name} is {core.is}. Good for {core.use}.</div>
      </div>

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
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-primary)" }}>your {ordinal(selected)} house · {meaning.title}</div>
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

export default function StarBase({ testerId, onReflect }: { testerId: string | null; lat?: number; lon?: number; onReflect?: (seed: string) => void }) {
  const [mode, setMode] = useState<"planets" | "houses">("planets");

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
        {/* Console toggle — the two kinds of destination */}
        <div style={{ display: "inline-flex", padding: 3, gap: 3, borderRadius: 10, background: "var(--color-card-2)", border: "1px solid var(--color-border)", marginBottom: 18 }}>
          {(["planets", "houses"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: "6px 16px", borderRadius: 8, fontSize: 12.5, cursor: "pointer", border: "none",
              background: mode === m ? "var(--color-card)" : "transparent", color: mode === m ? "var(--color-primary)" : "#999",
              fontWeight: mode === m ? 600 : 400, boxShadow: mode === m ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            }}>{m === "planets" ? "Planets" : "Houses"}</button>
          ))}
        </div>

        {mode === "planets"
          ? <PlanetsView natal={natal} currents={currents} onReflect={onReflect} />
          : <HousesView natal={natal} currents={currents} onReflect={onReflect} />}
      </div>
    </div>
  );
}
