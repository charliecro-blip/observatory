/**
 * THE SKY, READ IN DEPTH — "Resonant now" and "The big sky".
 *
 * Both lived on Today, gated behind the expanded density, which put the app's
 * deepest sky read-out behind two doors on a page nobody lands on. They belong
 * on Planets: the surface someone reaches when they have decided to go
 * looking, which is exactly who these are for.
 *
 * RESONANT NOW answers "what fits right now" from the Moon's sign, the aspect
 * she is applying to, and then the hour. THE BIG SKY is the planet-to-planet read-out — the densest jargon in
 * the product, and the reason both are full-detail only.
 */

import React, { useState } from "react";
import { ELEMENT_COLORS, type Element } from "@/lib/elements";
import { approachOptions } from "@/lib/approach";
import {
  ASPECT_GEOMETRY, SIGN_INFLECTION, PLANET_CORE, composeTakes, composeEssence,
  composeGuidance, aspectSignificance, type AspectName,
} from "@/lib/sky-readings";
import { useTester } from "@/contexts/tester-context";
import { SIGN_MYTHOS, PLANET_MYTHOS, PLANET_ACTIVITIES } from "@/lib/mythos";
import { PLANET_GLYPH as BIGSKY_PLANET_GLYPH } from "@/lib/glyphs";
import { PLANET_COLORS } from "@/lib/planetColors";

const PLANET_THEMES: Record<string, { themes: string; icon: string; color: string }> = {
  Sun:     { icon:"☉︎", color:PLANET_COLORS.Sun, themes:"visibility · authority · vitality · identity" },
  Moon:    { icon:"☽︎", color:PLANET_COLORS.Moon, themes:"feeling · intuition · nourishment · cycles" },
  Mercury: { icon:"☿︎", color:PLANET_COLORS.Mercury, themes:"communication · writing · analysis · ideas" },
  Venus:   { icon:"♀︎", color:PLANET_COLORS.Venus, themes:"connection · beauty · pleasure · values" },
  Mars:    { icon:"♂︎", color:PLANET_COLORS.Mars, themes:"drive · action · courage · physical energy" },
  Jupiter: { icon:"♃︎", color:PLANET_COLORS.Jupiter, themes:"expansion · optimism · generosity · faith" },
  Saturn:  { icon:"♄︎", color:PLANET_COLORS.Saturn, themes:"discipline · structure · responsibility · long-term" },
  Uranus:  { icon:"♅︎", color:PLANET_COLORS.Uranus, themes:"disruption · innovation · liberation · surprise" },
  Neptune: { icon:"♆︎", color:PLANET_COLORS.Neptune, themes:"imagination · transcendence · compassion · dissolution" },
  Pluto:   { icon:"♇︎", color:PLANET_COLORS.Pluto, themes:"transformation · depth · power · shadow" },
};

// Convert hours-from-now into a readable "when it perfects" label.
function fmtExactWhen(hours: number): string {
  const when = new Date(Date.now() + hours * 3600000);
  if (hours < 48) {
    const t = when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const day = hours < 12 && when.getDate() === new Date().getDate() ? "today"
      : when.toLocaleDateString("en-US", { weekday: "short" });
    return `${day} ${t}`;
  }
  if (hours < 24 * 45) return when.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return when.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// Convert hours-since-perfection into a readable "how long ago" label, for
// separating aspects (the mirror case of fmtExactWhen).
function fmtSinceExact(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m ago`;
  if (hours < 48) return `${Math.round(hours)}h ago`;
  const days = Math.round(hours / 24);
  return days < 45 ? `${days}d ago` : `${Math.round(days / 30)}mo ago`;
}

// Resonant Now, redesigned per feedback: the Moon's sign was the only driver and
// the module names (Creative/Spiritual/Relationships) were too vague to act on.
// Now THREE independent voices each contribute one CONCRETE suggestion, each
// with a chip naming its source: the planetary hour (fastest), the Moon's sign
// (the ~2.5-day texture), and the strongest applying Moon aspect (the day's
// event). Concrete verbs come from the language layer (PLANET_ACTIVITIES /
// SIGN_MYTHOS) instead of module labels.
export function ModulePulse({ now }: { now: any; onNavigate?: (v: string) => void }) {
  const { profile: pulseProfile } = useTester();
  const moonSign: string = (now?.moonSign ?? "").split(" ")[0];
  const hourPlanet: string = now?.planetaryHour?.planet ?? "";
  const sm = SIGN_MYTHOS[moonSign];
  // Tap-to-cycle offsets, one per card. Each card carries its voice's WHOLE
  // list — the seeded pick is just the opening suggestion, and tapping turns
  // up the other ways that same influence could play out, in place.
  const [offs, setOffs] = useState<Record<number, number>>({});

  const suggestions: { options: string[]; seed: number; source: string; color: string; title?: string; suffix?: string }[] = [];

  // 1 — the Moon's sign (seed rotates daily so a 2.5-day sign doesn't repeat)
  if (sm) {
    suggestions.push({
      options: sm.favors,
      seed: new Date().getDate(),
      source: `Moon in ${moonSign}`,
      color: ELEMENT_COLORS[sm.element as Element] ?? "#4a6a90",
      title: sm.feel,
    });
  }

  // 2 — the strongest applying Moon aspect: harmonious → lean into the partner's
  // activities; hard → the partner's voice needs a deliberate, softer outlet.
  const applying = (now?.moonAspects ?? [])
    .filter((a: any) => a.applying)
    .sort((a: any, b: any) => (a.hoursToExact ?? 99) - (b.hoursToExact ?? 99))[0];
  if (applying) {
    const partner = applying.planet1 === "Moon" ? applying.planet2 : applying.planet1;
    // Fourth site, found by the broadened test rather than by reading. Same
    // rule: the aspect partner's verbs must respect the clock and the void
    // like every other card's do.
    const partnerOpts = approachOptions({
      planet: partner,
      at: new Date(),
      wakeTime: pulseProfile?.chronotype?.wakeTime,
      sleepTime: pulseProfile?.chronotype?.sleepTime,
      voc: !!now?.voc?.isVOC,
      moonSign,
    });
    const acts = partnerOpts.length ? partnerOpts : PLANET_ACTIVITIES[partner];
    const hard = applying.aspect === "square" || applying.aspect === "opposition";
    if (acts?.length) {
      suggestions.push({
        options: acts,
        seed: hard ? 0 : new Date().getDate(),
        suffix: hard ? " — gently; this current runs hot" : undefined,
        source: `Moon ${applying.aspect} ${partner}`,
        color: hard ? "#a05050" : "#4a7aa0",
        title: PLANET_MYTHOS[partner]?.essence,
      });
    }
  }

  // 3 — the hour's voice, LAST (seed rotates with the hour so untouched cards
  //     vary). It was pushed first, so the opening card on this panel was
  //     always the planetary hour and the Moon came after it. The owner's
  //     ordering puts her placement and her aspects above a ruler that turns
  //     over every sixty minutes (2026-08-22).
  //
  // Through the approach layer, not PLANET_ACTIVITIES. This card was the third
  // surface found still reading the flat list raw — after Today's ahead rows
  // and the collapsed rail — which meant a Mars hour could offer "train hard"
  // here at 11pm, the exact sentence that layer exists to prevent. The flat
  // list stays only as a fallback for a body the approach layer doesn't cover.
  const hourActs = hourPlanet
    ? (() => {
        const opts = approachOptions({
          planet: hourPlanet,
          at: new Date(),
          wakeTime: pulseProfile?.chronotype?.wakeTime,
          sleepTime: pulseProfile?.chronotype?.sleepTime,
          voc: !!now?.voc?.isVOC,
          moonSign,
        });
        return opts.length ? opts : PLANET_ACTIVITIES[hourPlanet];
      })()
    : undefined;
  if (hourActs?.length) {
    suggestions.push({
      options: hourActs,
      seed: new Date().getHours(),
      source: `${hourPlanet} hour`,
      // Hex fallback, because this value is later concatenated with an alpha
      // suffix (`${s.color}30`) — `var(--color-muted)30` is not a colour and
      // fails silently, leaving the card borderless for any ruler missing
      // from PLANET_THEMES. The blue matches the sibling builders' fallback
      // rather than a neutral grey, which the raw-grey guard rightly bans.
      color: PLANET_THEMES[hourPlanet]?.color ?? "#4a6a90",
      title: PLANET_MYTHOS[hourPlanet]?.whenLoud,
    });
  }

  // A blank module and a module that never loaded looked identical, so an
  // absent Moon sign read as a page still thinking. Name the missing voices.
  if (suggestions.length === 0) {
    return (
      <div style={{ margin: "12px 0" }}>
        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--color-muted)", marginBottom: 8 }}>
          Resonant now
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.55 }}>
          The Moon's sign and the planetary hour didn't come through, so there's nothing here to draw from.
        </div>
      </div>
    );
  }

  return (
    <div style={{ margin: "12px 0" }}>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--color-muted)", marginBottom: 8 }}>
        Resonant now <span style={{ letterSpacing: 0, textTransform: "none", color: "var(--text-3)" }}>· tap a card for another way in</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {suggestions.map((s, i) => {
          const n = s.options.length;
          const idx = (((s.seed % n) + n) % n + (offs[i] ?? 0)) % n;
          return (
            <button key={i} onClick={() => setOffs((o) => ({ ...o, [i]: (o[i] ?? 0) + 1 }))} title={s.title} style={{
              flex: "1 1 180px", background: "var(--color-card)", border: `1px solid ${s.color}30`,
              borderLeft: `3px solid ${s.color}`, borderRadius: 10, padding: "10px 12px",
              cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 5,
            }}>
              <div key={idx} className="phrase-in" style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)", lineHeight: 1.35 }}>
                {s.options[idx]}{s.suffix && <span style={{ fontWeight: 400, color: "#a05050" }}>{s.suffix}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
                <span style={{ fontSize: 8.5, color: s.color, fontWeight: 600 }}>{s.source}</span>
                {/* explicit invitation — the muted counter alone read as decoration */}
                <span style={{ fontSize: 9, color: "var(--color-muted)", flexShrink: 0 }}>⟳ tap for more · {idx + 1}/{n}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BigSkyCard({ asp, signOf }: { asp: any; signOf: (p: string) => string }) {
  const [open, setOpen] = useState(false);
  const [takeIdx, setTakeIdx] = useState(0);
  const aspect = (asp.aspect ?? "").toLowerCase() as AspectName;
  const geo = ASPECT_GEOMETRY[aspect];
  if (!geo) return null;

  const a = { planet: asp.planet1, sign: signOf(asp.planet1) };
  const b = { planet: asp.planet2, sign: signOf(asp.planet2) };
  const takes = composeTakes(a, b, aspect);
  const essence = composeEssence(a, b, aspect);
  const guidance = composeGuidance(a, b, aspect);
  const hard = aspect === "square" || aspect === "opposition";
  const accent = hard ? "#a05020" : aspect === "conjunction" ? "#8a6a20" : "#3a6020";

  const timing = asp.stationsBeforeExact
    ? "℞ stations before exact"
    : asp.neverPerfected
      ? "℞ separating · never perfected"
      : asp.applying && asp.hoursToExact != null
        ? `exact ${fmtExactWhen(asp.hoursToExact)}`
        : !asp.applying && asp.hoursSinceExact != null
          ? `peaked ${fmtSinceExact(asp.hoursSinceExact)}`
          : null;

  return (
    <div style={{ border: `1px solid ${accent}30`, borderLeft: `3px solid ${accent}`, borderRadius: 12, background: "var(--color-card)", overflow: "hidden" }}>
      <button onClick={() => setOpen(v => !v)} style={{ width: "100%", textAlign: "left", padding: "12px 14px", border: "none", background: "none", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* The pair drawn in symbols, then written out in words on the next
              line. Decorative, so it is hidden rather than announced as three
              raw codepoints ahead of the sentence saying the same thing. */}
          <span aria-hidden="true" style={{ fontSize: 15, letterSpacing: 1 }}>
            {BIGSKY_PLANET_GLYPH[a.planet]}<span style={{ color: accent, fontWeight: 700 }}>{geo.symbol}</span>{BIGSKY_PLANET_GLYPH[b.planet]}
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-primary)" }}>
            {a.planet} in {a.sign} {geo.symbol} {b.planet} in {b.sign}
          </span>
          {timing && <span style={{ fontSize: 9, color: "#b07030", background: "#fff8e8", border: "1px solid #e8d080", padding: "1px 6px", borderRadius: 5 }}>{timing}</span>}
          <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-3)", flexShrink: 0 }}>{open ? "▲ less" : "▼ explore"}</span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.55, marginTop: 5 }}>{essence}</div>
      </button>

      {open && (
        <div style={{ padding: "0 14px 12px", borderTop: "1px solid var(--color-border)" }}>
          {/* The take — cycle through genuinely different framings */}
          <div style={{ marginTop: 10, background: "var(--color-card-2)", borderRadius: 9, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: accent }}>{takes[takeIdx].label}</span>
              <button onClick={() => setTakeIdx(i => (i + 1) % takes.length)} style={{ fontSize: 9.5, color: "var(--text-2)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                another take ↻ <span style={{ color: "var(--text-3)" }}>{takeIdx + 1}/{takes.length}</span>
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.65 }}>{takes[takeIdx].text}</div>
          </div>

          {/* Favors / watch */}
          <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#3a6020" }}>FAVORS </span>
              <span style={{ fontSize: 10.5, color: "var(--text-2)", lineHeight: 1.5 }}>{guidance.favors}</span>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#a04030" }}>WATCH </span>
              <span style={{ fontSize: 10.5, color: "var(--text-2)", lineHeight: 1.5 }}>{guidance.watch}</span>
            </div>
          </div>

          {/* The players — planet-in-sign context */}
          <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 4 }}>
            {[a, b].map((p) => {
              const pc = PLANET_CORE[p.planet];
              return (
                <div key={p.planet} style={{ fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.5 }}>
                  <span style={{ color: "var(--color-foreground)", fontWeight: 600 }}><span aria-hidden="true">{BIGSKY_PLANET_GLYPH[p.planet]}</span> {p.planet} in {p.sign}</span>
                  {pc ? ` — ${pc.is}.` : ""}
                  <span style={{ color: "var(--text-3)" }}> In {p.sign}: {SIGN_INFLECTION[p.sign] ?? ""}.</span>
                </div>
              );
            })}
          </div>

          {/* The concept, explained plainly */}
          <div style={{ marginTop: 9, fontSize: 10, color: "var(--color-muted)", lineHeight: 1.55, fontStyle: "italic" }}>
            What a {geo.word} is: {geo.angle} apart. {geo.explain}
          </div>
        </div>
      )}
    </div>
  );
}

export function BigSky({ now }: { now: any }) {
  const aspects: any[] = now?.aspects ?? [];
  const planets: any[] = now?.planets ?? [];
  const signOf = (p: string) => planets.find((x) => x.planet === p)?.sign ?? "";

  const headliners = aspects
    .filter((a) => a.planet1 !== "Moon" && a.planet2 !== "Moon" && a.orb <= 6)
    .map((a) => ({ a, score: aspectSignificance(a) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, 3)
    // Keep only genuinely loud ones — a lone weak sextile shouldn't fake a headline.
    .filter(({ score }, i) => i === 0 || score >= 12)
    .map(({ a }) => a);

  // A quiet sky is an answer, not an absence. When every planet outside the
  // Moon is more than six degrees off every other, say so rather than leaving
  // the reader to wonder whether the module broke.
  if (headliners.length === 0) {
    return (
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--color-muted)", marginBottom: 7 }}>The big sky</div>
        <div style={{ fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.55 }}>
          Away from the Moon, no two planets are within six degrees of each other right now.
        </div>
      </div>
    );
  }

  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 7, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--color-muted)" }}>The big sky</div>
        <div style={{ fontSize: 10, color: "var(--color-muted)" }}>the strongest planet-to-planet weather right now — tap to explore</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {headliners.map((a, i) => <BigSkyCard key={`${a.planet1}-${a.planet2}-${i}`} asp={a} signOf={signOf} />)}
      </div>
    </div>
  );
}
