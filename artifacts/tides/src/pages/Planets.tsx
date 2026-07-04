import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrents } from "@/hooks/useTides";
import { PLANET_CORE, planetInSignNote } from "@/lib/sky-readings";
import { HOUSE_MEANINGS } from "@/lib/currents-content";

// Star Base, step one — "visit" a planet. What it is, what it means for YOU
// (your natal sign + house), how it's being activated right now (slow transits
// to it), and a prompt to check in with it. Reference content already exists in
// sky-readings + currents-content; this composes it into a place you can wander.

const ORDER = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
const GLYPH: Record<string, string> = { Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂", Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇" };
const COLOR: Record<string, string> = {
  Sun: "#c8971e", Moon: "#5a6b8c", Mercury: "#7a8a4a", Venus: "#3f8493", Mars: "#c04830",
  Jupiter: "#7a5cae", Saturn: "#6a6258", Uranus: "#3a9aa8", Neptune: "#5a6cae", Pluto: "#7a3a5a",
};
// A question to sit with per planet — the "check in with your inner __" prompt.
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

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

// Compose a context-rich opening message for Compass so the reflection lands on
// this specific planet — its placement, what's activating it, and the question.
function reflectSeed(planet: string, name: string, sign: string | undefined, house: number | null | undefined, activations: any[]): string {
  const parts = [`I want to check in with my inner ${name}.`];
  if (sign) parts.push(`In my chart it's in ${sign}${house ? `, my ${ordinal(house)} house` : ""}.`);
  if (activations.length) parts.push(`Right now, transiting ${activations[0].transitPlanet} is ${String(activations[0].aspect).toLowerCase()} it.`);
  parts.push(`Help me reflect: ${CHECK_IN[planet]}`);
  return parts.join(" ");
}

export default function Planets({ testerId, onReflect }: { testerId: string | null; lat?: number; lon?: number; onReflect?: (seed: string) => void }) {
  const [selected, setSelected] = useState("Sun");

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

  const core = PLANET_CORE[selected] ?? { name: selected, is: "", short: "", use: "" };
  const col = COLOR[selected] ?? "#888";
  const natalPos = (natal?.planets ?? []).find((p: any) => p.planet === selected);
  const sign = natalPos?.sign as string | undefined;
  const house = natalPos?.houseNumber as number | null | undefined;
  const houseMeaning = house ? HOUSE_MEANINGS[house] : null;
  const activations = ((currents?.majorTransits ?? []) as any[]).filter((t) => t.natalPlanet === selected);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "24px 28px 60px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 4, fontSize: 20, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "-0.3px" }}>Planets</div>
        <div style={{ fontSize: 12.5, color: "#888", lineHeight: 1.6, marginBottom: 18 }}>
          The ten drives you're made of. Visit one to see what it means, how it lives in your chart, and how the sky is moving it right now.
        </div>

        {/* Picker */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 22 }}>
          {ORDER.map((p) => {
            const active = p === selected;
            const pc = COLOR[p] ?? "#888";
            return (
              <button key={p} onClick={() => setSelected(p)} title={p} style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 999, cursor: "pointer",
                border: active ? `1.5px solid ${pc}` : "1px solid var(--color-border)",
                background: active ? `${pc}14` : "var(--color-card)", color: active ? pc : "#888",
                fontWeight: active ? 600 : 400, fontSize: 12,
              }}>
                <span style={{ fontSize: 14 }}>{GLYPH[p]}</span>{p}
              </button>
            );
          })}
        </div>

        {/* The planet */}
        <div style={{ background: `linear-gradient(180deg, ${col}12, ${col}04)`, border: "1px solid var(--color-border)", borderRadius: 14, padding: "18px 20px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 6 }}>
            <div style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0, background: `${col}20`, color: col, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{GLYPH[selected]}</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-primary)" }}>your inner {core.name}</div>
              <div style={{ fontSize: 12, color: col, fontWeight: 600 }}>{core.short}</div>
            </div>
          </div>
          <div style={{ fontSize: 13.5, color: "var(--color-foreground)", lineHeight: 1.65, marginTop: 8 }}>
            {core.name} is {core.is}. Good for {core.use}.
          </div>
        </div>

        {/* In your chart */}
        <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.7px", color: "#aaa", marginBottom: 8 }}>In your chart</div>
          {sign ? (
            <>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-foreground)", marginBottom: 4 }}>
                {core.name} in {sign}{house ? ` · your ${ordinal(house)} house` : ""}
              </div>
              <div style={{ fontSize: 12.5, color: "#777", lineHeight: 1.6 }}>{planetInSignNote(selected, sign)}</div>
              {houseMeaning ? (
                <div style={{ fontSize: 12, color: "#888", lineHeight: 1.6, marginTop: 6 }}>
                  Your {ordinal(house!)} house is the ground of <b style={{ color: "#666" }}>{houseMeaning.title.toLowerCase()}</b> — {houseMeaning.domains}. That's where this drive most wants to act.
                </div>
              ) : (
                <div style={{ fontSize: 11.5, color: "#aaa", marginTop: 6 }}>Add your birth time in Settings to see which house it lives in.</div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: "#aaa" }}>Add your birth details in Settings to see where {core.name} sits in your chart.</div>
          )}
        </div>

        {/* Activated now */}
        <div style={{ background: activations.length ? "#8a6a2008" : "var(--color-card)", border: `1px solid ${activations.length ? "#c8a84040" : "var(--color-border)"}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.7px", color: activations.length ? "#a8862e" : "#aaa", marginBottom: 8 }}>Being activated now</div>
          {activations.length ? activations.map((t: any, i: number) => (
            <div key={i} style={{ marginBottom: i < activations.length - 1 ? 8 : 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-foreground)" }}>
                {GLYPH[t.transitPlanet]} transiting {t.transitPlanet} {String(t.aspect).toLowerCase()} your {core.name}
                <span style={{ fontWeight: 400, color: "#999", marginLeft: 6 }}>{t.exact ? "exact now" : `${t.orb}° orb`}</span>
              </div>
              {t.likelyDomains?.length > 0 && (
                <div style={{ fontSize: 12, color: "#8a7a50", lineHeight: 1.6, marginTop: 2 }}>Often felt around {t.likelyDomains.slice(0, 3).join(", ")}.</div>
              )}
            </div>
          )) : (
            <div style={{ fontSize: 12.5, color: "#999" }}>Quiet right now — no slow planet is touching your {core.name}. It's running at its natural baseline.</div>
          )}
        </div>

        {/* Check in */}
        <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderLeft: `3px solid ${col}`, borderRadius: 10, padding: "13px 16px" }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.7px", color: "#aaa", marginBottom: 6 }}>Check in with your inner {core.name}</div>
          <div style={{ fontSize: 13.5, color: "var(--color-foreground)", lineHeight: 1.6, fontStyle: "italic", marginBottom: 10 }}>{CHECK_IN[selected]}</div>
          {onReflect && (
            <button onClick={() => onReflect(reflectSeed(selected, core.name, sign, house, activations))} style={{
              fontSize: 12, fontWeight: 600, padding: "6px 13px", borderRadius: 8, cursor: "pointer",
              border: `1px solid ${col}`, background: `${col}12`, color: col,
            }}>🧭 Reflect with Compass →</button>
          )}
        </div>
      </div>
    </div>
  );
}
