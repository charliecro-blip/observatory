import React, { useState, useCallback, useEffect } from "react";
import { localToday, localDateStr } from "@/lib/dates";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/Skeleton";
import { HelpBadge, Tooltip } from "@/components/Tooltip";
import { usePreferences, useUiDensity, useAstroDetail, useTimeFormat } from "@/contexts/preferences-context";
import { takesFor, lineOf } from "@/lib/explain";
import type { TidesNow } from "@/lib/types";
import { SIGN_MYTHOS, PLANET_ACTIVITIES } from "@/lib/mythos";
import { suggestApproach, approachOptions } from "@/lib/approach";
import { useTester } from "@/contexts/tester-context";
import { useNorthStars } from "@/hooks/useTides";
import { ELEMENT_MYTHOS } from "@/lib/mythos";
import TransitTake from "@/components/TransitTake";
import { CompassMark } from "@/components/CompassMark";
import Glyph from "@/components/Glyph";
import { planetColor, PLANET_COLORS } from "@/lib/planetColors";
import { ELEMENT_COLORS, elementColor } from "@/lib/elements";

// Rail planet glyph — the design-system glyph (Noto symbol face, optically
// thinned), inheriting the surrounding span's color (tint=false) so the rail's
// per-planet colouring is preserved. bg defaults to the rail surface.
const PG = ({ p, size = 12, bg = "var(--color-rail)" }: { p: string; size?: number; bg?: string }) =>
  <Glyph name={p} size={size} tint={false} bg={bg} />;

// A small, accurate moon-phase disc. The old rail moon was a fixed radial
// gradient that always looked ~full regardless of the real phase. This renders
// the true illuminated fraction and the correct lit side (waxing = right,
// waning = left in the northern hemisphere). Kept deliberately small and quiet
// — the tide chart is the app's hero, not the moon.
function MoonDisc({ illum, waxing, size = 26 }: { illum: number; waxing: boolean; size?: number }) {
  const r = size / 2;
  const lit = "#e7ddc6", dark = "#413d33";
  const f = Math.max(0, Math.min(1, illum));
  const x = (1 - 2 * f) * r;
  const rxTerm = Math.abs(x);
  // Terminator ellipse bulge: for a gibbous moon (illum>0.5, x<0) it must bulge
  // LEFT so the lit region is the big 86%-style shape; for a crescent it bulges
  // right to leave a thin sliver lit. (Getting this backwards drew the ~14%
  // crescent lit and made an 86% moon read as mostly dark.)
  const sweepTerm = x < 0 ? 1 : 0;
  // Right-lit shape (outer right semicircle + terminator ellipse back to top);
  // mirror horizontally for a waning moon so the light sits on the left.
  const d = `M ${r} 0 A ${r} ${r} 0 0 1 ${r} ${size} A ${rxTerm} ${r} 0 0 ${sweepTerm} ${r} 0 Z`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0, transform: waxing ? "none" : "scaleX(-1)" }} aria-hidden>
      <circle cx={r} cy={r} r={r} fill={dark} />
      <path d={d} fill={lit} />
      <circle cx={r} cy={r} r={r - 0.5} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1" />
    </svg>
  );
}


// Void-of-course is a liminal, restful state — NOT a warning. It gets its own
// calm slate-lavender ("slack water"), deliberately distinct from the yellow/
// amber used for cautions so the two never read as the same signal.
const VOC_COLOR = "#6f6a90";
const VOC_BG = "#ece9f4";

// The sign's zodiac glyph + its element color — the atomic "instrument reading".
function signGlyphInfo(sign?: string) {
  if (!sign) return null;
  const sm = SIGN_MYTHOS[sign.split(" ")[0]];
  const el = sm?.element ?? "water";
  return { glyph: sm?.glyph ?? "", color: elementColor(el, "var(--color-muted)"), el };
}

/**
 * What a planet can and cannot do FROM THE SIGN IT IS IN — served by the API
 * (lib/planetInSign), never composed here.
 *
 * Replaces ARCHETYPE_QUALITY on the day-ruler row. That table said the same
 * thing about Mars whether Mars was exalted in Capricorn or in fall in Cancer,
 * so the rail printed the sign and then described a planet that was not in it.
 *
 * The dignity word is deliberately terse and unglossed. It is the one piece of
 * inherited doctrine on the row, and a reader who does not know "fall" learns
 * it faster from seeing it attached to a reading than from a parenthetical.
 */
function PlanetReading({ planet, planets }: { planet: string; planets?: any[] }) {
  const r = (planets ?? []).find((x: any) => x.planet === planet)?.reading;
  if (!r) return null;
  const DIGNITY_COLOR: Record<string, string> = {
    domicile: "#4a8050", exaltation: "#4a8050", detriment: "#a06030", fall: "#a06030",
  };
  return (
    <div style={{ fontSize: 9, color: "var(--text-3)", lineHeight: 1.55 }}>
      {r.dignity && (
        <span style={{
          fontSize: 7.5, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700,
          color: DIGNITY_COLOR[r.dignity] ?? "var(--text-3)", marginRight: 5,
        }}>{r.dignity}</span>
      )}
      {r.does}
      {/* The downside is shown, not hidden behind a tap: a placement with only
          an upside is a horoscope. Dimmer, because it is the second thing to
          read, not the first. */}
      <span style={{ color: "var(--color-muted)" }}> · {r.misses}</span>
    </div>
  );
}

/**
 * What the Moon sign favours — UNLESS she is void, in which case she does not
 * deliver it.
 *
 * The rail read "favors start the thing you've been circling" while the void
 * banner two inches above said "Start nothing you'd have to defend tomorrow".
 * Both came from real doctrine and they flatly contradicted each other on one
 * screen: SIGN_MYTHOS.favors says what an Aries Moon inclines toward, and the
 * void says she will make no further contact to bring any of it about. The
 * sign describes the appetite; the void decides whether it lands.
 *
 * Same failure as the carried-by/led-by collision — two true statements, each
 * answering a different question, with nothing on screen saying so.
 */
function moonFavours(sm: any, voc?: { isVOC?: boolean; reading?: { instead: string } | null }) {
  if (voc?.isVOC && voc.reading) return { label: "instead", text: voc.reading.instead };
  return { label: "favors", text: sm.favors.slice(0, 3).join(" · ") };
}

/**
 * The rail's width.
 *
 * Narrowed from 210. At that width it took nearly a fifth of a laptop screen,
 * and the effect was not just spatial: the rail has glyphs, colour, progress
 * bars and live times, so the supposedly SECONDARY sky instrument read as more
 * alive than the product's central answer. Home now carries its own visual
 * event; this gives it the room to.
 */
const RAIL_W = 186;

// A collapsed section: one dense clickable row (label + glyphs/values), the
// instrument a fluent user reads at a glance. Click anywhere to expand.
function GlyphRow({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={`Expand ${label}`} style={{
      width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 14px",
      borderBottom: "1px solid var(--color-border)", background: "none", border: "none",
      borderBottomWidth: 1, cursor: "pointer", textAlign: "left",
    }}>
      <span style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-3)", width: 34, flexShrink: 0 }}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>{children}</span>
    </button>
  );
}

// An element-colored chip for a sign — the "colored bit for Sun in Cancer /
// Moon in Aquarius" a beginner can read at a glance.
// The sign's element tints the chip but is no longer SPELLED here. The hero's
// woven reading names the day's element ("a fire day — courage to spend"), and
// a rail chip saying "Pisces · water" beside it read as a flat contradiction
// rather than as a second layer (beta pass §B2). One place names an element.
function SignChip({ glyph, label, sign }: { glyph: string; label: string; sign?: string }) {
  const el = sign ? (SIGN_MYTHOS[sign.split(" ")[0]]?.element ?? "water") : "water";
  const col = elementColor(el, "#888888");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11 }}>
      <span style={{ color: col }}>{glyph}</span>
      <span style={{ fontWeight: 600, color: "var(--color-foreground)" }}>{label}</span>
      {sign && (
        <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, background: `${col}1e`, color: col, fontWeight: 600 }}>
          {sign}
        </span>
      )}
    </span>
  );
}

const ASPECT_COLORS: Record<string, string> = {
  "☌︎": "#f0b060", "□": "#e06060", "△": "#60a060", "⚹": "#6090d0", "☍︎": "#e06060",
};

// Order Moon aspects chronologically — the one that perfects soonest first —
// so the rail reads in the order they actually happen. Applying aspects (still
// closing) come first by time-to-exact; separating ones (already past) follow
// by how far past. Fixes "Mercury listed before Venus even though Venus is
// exact first."
function aspectTimeKey(a: { applying?: boolean; hoursToExact?: number | null; orb: number }): number {
  if (a.applying) return a.hoursToExact != null ? a.hoursToExact : a.orb;
  return 1000 + a.orb;
}
function sortMoonAspects<T extends { applying?: boolean; hoursToExact?: number | null; orb: number }>(list: T[]): T[] {
  return [...list].sort((x, y) => aspectTimeKey(x) - aspectTimeKey(y));
}

// Tap-to-cycle suggestion line — each tap turns up another way the same voice
// could play out ("plan the expansion" → "say yes bigger" → …). The ⟳ n/m
// affordance says there are more behind the one showing. `seed` keeps the
// default rotating with the hour/day so untouched rails still vary.
function CycleLine({ prefix, options, seed = 0, show = 1, style }: {
  prefix: string; options: string[]; seed?: number; show?: number; style?: React.CSSProperties;
}) {
  const [off, setOff] = useState(0);
  if (!options?.length) return null;
  const n = options.length;
  const start = (((seed % n) + n) % n + off) % n;
  const shown = Array.from({ length: Math.min(show, n) }, (_, i) => options[(start + i) % n]);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); setOff((o) => o + 1); }}
      title="Tap for another way this could play out"
      style={{
        display: "block", width: "100%", textAlign: "left", background: "none", border: "none",
        padding: 0, cursor: "pointer", fontSize: 9.5, color: "var(--color-muted)", lineHeight: 1.45,
        fontFamily: "inherit", ...style,
      }}
    >
      {/* A LABEL, not the first word of the sentence.
          Rendered inline and lowercase, "instead" ran straight into a
          capitalised value — "instead Good hours for the work already in
          front of you" — which reads as broken grammar rather than a
          labelled field (owner, 2026-08-13). The rail already has a
          micro-label idiom (SEASON, MOON, THIS HOUR); these now use it. */}
      <span style={{
        display: "block", color: "var(--text-3)", fontSize: 8,
        textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 1,
      }}>{prefix}</span>
      <span key={start} className="phrase-in">{shown.join(" · ")}</span>
      <span style={{ marginLeft: 5, color: "var(--text-3)", fontSize: 8.5, whiteSpace: "nowrap" }}>
        ⟳ {show === 1 ? `${start + 1}/${n}` : "more"}
      </span>
    </button>
  );
}



// Mobile instrument strip — the desktop rail's nesting ladder, ported to a
// single horizontal row of glyph "instruments" under the phone top bar. A
// fluent user reads Sun/Moon/Day/Hour at a glance; tapping one opens an inline
// detail card. This is the nesting-principle dashboard on the device most
// people actually use.

/**
 * Hour/day verbs for the COLLAPSED rail.
 *
 * These popovers read PLANET_ACTIVITIES raw — a flat planet→verbs map with no
 * sense of the clock — which is the map the approach layer was written to
 * replace, and the reason a Mars hour once proposed "train hard" at 21:20
 * against a stated 23:00 bedtime. That was fixed on Today and in the EXPANDED
 * rail, and missed here, so the same sentence could still appear late at night
 * one panel over. One vocabulary, one rule set, everywhere it renders.
 */
function railVerbs(planet: string | undefined, chronotype: { wakeTime?: string | null; sleepTime?: string | null } | undefined,
                   voc: boolean, moonSign?: string | null): string[] {
  if (!planet) return [];
  const opts = approachOptions({
    planet, at: new Date(),
    wakeTime: chronotype?.wakeTime, sleepTime: chronotype?.sleepTime,
    voc, moonSign,
  });
  return opts.length ? opts : (PLANET_ACTIVITIES[planet] ?? []);
}

export function MobileInstruments({ now }: { now: TidesNow | undefined }) {
  const { profile: miProfile } = useTester();
  const [open, setOpen] = useState<string | null>(null);
  const [moonTake, setMoonTake] = useState(0);
  // The phone's rail. At the astro-quiet lens the glyph strip folds away like
  // the desktop rail does; a running session leaves its one-line note so the
  // mode is as legible on a phone as it is at a desk.
  const { level: miLevel, sessionQuiet: miSessionQuiet } = useAstroDetail();
  if (miLevel === "minimal") {
    if (!miSessionQuiet) return null;
    return (
      <div style={{
        background: "var(--color-rail)", borderBottom: "1px solid var(--color-border)",
        flexShrink: 0, padding: "6px 12px", fontSize: 10.5, color: "var(--text-3)",
      }}>
        Sky is quiet · session
      </div>
    );
  }
  // A transient/partial `now` (e.g. an error body cached mid-reload) can lack
  // planetaryHour; the hour chip dereferences it, so guard the whole strip
  // rather than crash the page on mobile.
  if (!now || !now.planetaryHour) return null;
  const { moonSign, moonPhase, moonIllumination, planetaryHour, element } = now;
  const sunSign = (now as any).sunSign as string | undefined;
  const dayRuler = (now as any).dayRuler as string | undefined;
  const isVOC = !!(now as any).voc?.isVOC || !!(now as any).voidOfCourse;
  const elemColor = elementColor(element?.element ?? "water", "#888888");

  const chipStyle = (id: string, accent: string): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 5, flexShrink: 0, cursor: "pointer",
    padding: "5px 10px", borderRadius: 16, fontSize: 12,
    border: open === id ? `1px solid ${accent}` : "1px solid var(--color-border)",
    background: open === id ? `${accent}14` : "var(--color-card)",
  });

  const sun = signGlyphInfo(sunSign);
  const moon = signGlyphInfo(moonSign);

  const detail = (() => {
    if (open === "sun" && sunSign) {
      const sm = SIGN_MYTHOS[sunSign.split(" ")[0]];
      return <><b>{sunSign} season</b>{sm && <> — {sm.essence}</>}</>;
    }
    if (open === "moon") {
      const sm = moonSign ? SIGN_MYTHOS[moonSign.split(" ")[0]] : null;
      const mf = sm ? moonFavours(sm, now?.voc) : null;
      const takes = sm && mf ? [
        { l: mf.label, t: mf.text },
        { l: "the feel", t: sm.feel },
        { l: "watch for", t: sm.shadow },
      ] : [];
      const tk = takes.length ? takes[moonTake % takes.length] : null;
      return <>
        <b>{moonPhase?.replace(/_/g, " ")} · {moonSign}</b>{isVOC && <span style={{ color: VOC_COLOR }}> · void of course</span>}
        {tk && <div style={{ marginTop: 3 }}><span style={{ color: "var(--text-3)" }}>{tk.l}</span> {tk.t}
          <button onClick={() => setMoonTake(i => i + 1)} aria-label="Another take on this Moon" style={{ marginLeft: 5, fontSize: 10, color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer" }}>↻</button></div>}
      </>;
    }
    if (open === "day" && dayRuler) {
      return <><b>{dayRuler}'s day</b>
        <PlanetReading planet={dayRuler} planets={now.planets} />
        <CycleLine prefix="good for" options={railVerbs(dayRuler, miProfile?.chronotype, isVOC, moonSign)} show={3} style={{ marginTop: 3, fontSize: 10 }} /></>;
    }
    if (open === "hour") {
      return <><b>{planetaryHour.planet} hour</b> <span style={{ color: "var(--text-3)" }}>{planetaryHour.began}–{planetaryHour.ends}</span>
        <PlanetReading planet={planetaryHour.planet} planets={now.planets} />
        <CycleLine prefix="this hour" options={railVerbs(planetaryHour.planet, miProfile?.chronotype, isVOC, moonSign)} seed={new Date().getHours()} style={{ marginTop: 3, fontSize: 10 }} /></>;
    }
    if (open === "aspects") {
      const asps = sortMoonAspects(((now as any).moonAspects ?? []) as any[]);
      return <>
        <b>Moon aspects</b>
        {asps.length === 0 && <div style={{ marginTop: 3, color: "var(--color-muted)" }}>None in orb right now — open water.</div>}
        {asps.slice(0, 4).map((a: any, i: number) => {
          const partner = a.planet1 === "Moon" ? a.planet2 : a.planet1;
          const glyph = { conjunction: "☌︎", sextile: "⚹", square: "□", trine: "△", opposition: "☍︎" }[a.aspect as string] ?? "·";
          return (
            <div key={i} style={{ marginTop: 3, color: "var(--color-muted)" }}>
              ☽ {glyph} <PG p={partner} /> <b style={{ color: "var(--color-foreground)" }}>{partner}</b>
              <span style={{ color: "var(--text-3)", marginLeft: 5 }}>
                {a.applying && a.hoursToExact != null ? `exact in ~${Math.round(a.hoursToExact)}h` : !a.applying ? `${a.orb.toFixed(1)}° past` : `${a.orb.toFixed(1)}° orb`}
              </span>
            </div>
          );
        })}
      </>;
    }
    return null;
  })();

  return (
    <div style={{ background: "var(--color-rail)", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "7px 10px" }}>
        {sunSign && (
          <button onClick={() => setOpen(o => o === "sun" ? null : "sun")} style={chipStyle("sun", sun?.color ?? "#888888")}>
            <span style={{ color: sun?.color }}>☉ {sun?.glyph}</span>
            <span style={{ color: "var(--text-2)" }}>{sunSign}</span>
          </button>
        )}
        <button onClick={() => setOpen(o => o === "moon" ? null : "moon")} style={chipStyle("moon", moon?.color ?? "#888888")}>
          <MoonDisc illum={moonIllumination ?? 0} waxing={!/waning|last/i.test(moonPhase ?? "")} size={15} />
          <span style={{ color: "var(--text-2)" }}>{Math.round((moonIllumination ?? 0) * 100)}%</span>
          <span style={{ color: moon?.color }}>{moon?.glyph}</span>
          {isVOC && <span style={{ color: VOC_COLOR }}>◒</span>}
        </button>
        {dayRuler && (
          <button onClick={() => setOpen(o => o === "day" ? null : "day")} style={chipStyle("day", planetColor(dayRuler))}>
            <span style={{ color: planetColor(dayRuler) }}><PG p={dayRuler} /></span>
            <span style={{ color: "var(--text-2)" }}>day</span>
          </button>
        )}
        {((now as any).moonAspects ?? []).length > 0 && (
          <button onClick={() => setOpen(o => o === "aspects" ? null : "aspects")} style={chipStyle("aspects", PLANET_COLORS.Moon)}>
            <span style={{ color: PLANET_COLORS.Moon }}>☽{{ conjunction: "☌︎", sextile: "⚹", square: "□", trine: "△", opposition: "☍︎" }[((now as any).moonAspects[0].aspect) as string] ?? "·"}</span>
            <span style={{ color: "var(--text-2)" }}>{(now as any).moonAspects.length}</span>
          </button>
        )}
        <button onClick={() => setOpen(o => o === "hour" ? null : "hour")} style={chipStyle("hour", planetColor(planetaryHour.planet))}>
          <span style={{ color: planetColor(planetaryHour.planet) }}><PG p={planetaryHour.planet} /></span>
          <span style={{ color: "var(--text-2)" }}>hr</span>
        </button>
      </div>
      {detail && (
        <div style={{ padding: "0 12px 9px", fontSize: 11, color: "var(--color-muted)", lineHeight: 1.5 }}>{detail}</div>
      )}
    </div>
  );
}

function progressPct(began: string, ends: string) {
  const parse = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const b = parse(began), e = parse(ends);
  if (e <= b) return 50;
  return Math.min(100, Math.max(0, ((cur - b) / (e - b)) * 100));
}

const PLANET_SIGNIFICATION: Record<string, string> = {
  Sun: "Visibility, leadership, vitality. Good for presenting yourself, making decisions, and creative assertion.",
  Moon: "Nourishment, care, routine. Tend to home, body, and emotional space.",
  Mercury: "Communication, ideas, movement. Write, pitch, learn, travel.",
  Venus: "Beauty, pleasure, connection. Relationship, art, sensory enjoyment.",
  Mars: "Action, ignition, assertion. Physical work, bold starts, decisive moves.",
  Jupiter: "Expansion, abundance, generosity. Think big, share widely, grow.",
  Saturn: "Structure, focus, consolidation. Slow down, commit, build foundations.",
};

const ASPECT_MEANINGS: Record<string, { name: string; nature: string; desc: string }> = {
  conjunction: { name:"Conjunction ☌︎", nature:"Amplifying", desc:"The two planets merge energies — their themes intensify and blend. Effects depend on the planets involved." },
  trine:       { name:"Trine △", nature:"Harmonious", desc:"120° apart — energy flows easily and supportively between these planetary themes. A natural, gifting aspect." },
  sextile:     { name:"Sextile ⚹", nature:"Supportive", desc:"60° apart. A helpful connection, but it needs you to act on it — a trine gives, a sextile offers." },
  square:      { name:"Square □", nature:"Tension", desc:"90° apart — friction and challenge between these themes. Productive tension if channeled; frustration if resisted." },
  opposition:  { name:"Opposition ☍︎", nature:"Polarity", desc:"180° apart — polarization between two themes. Integration and balance are needed; others may mirror this tension." },
};

const PLANET_MEANING: Record<string, string> = {
  Sun:     "Core identity, vitality, authority, creative expression",
  Moon:    "Emotions, intuition, instinct, the body's wisdom",
  Mercury: "Mind, communication, movement, craft, perception",
  Venus:   "Beauty, values, pleasure, relationship, aesthetics",
  Mars:    "Drive, assertion, courage, desire, physical force",
  Jupiter: "Expansion, meaning, abundance, generosity, philosophy",
  Saturn:  "Structure, discipline, time, responsibility, limits",
  Uranus:  "Liberation, disruption, innovation, awakening",
  Neptune: "Imagination, dissolution, spirituality, the subtle",
  Pluto:   "Transformation, power, depth, endings, regeneration",
};

// Approximate sunrise/sunset for the Rail (mirrors Today.tsx logic)
export function railSunTimes(lat: number, lon: number): { sunrise: Date; sunset: Date; solarNoon: Date } | null {
  const today = localToday();
  // lstNoon below is expressed in UTC hours, so the base these offsets are added
  // to must also be UTC midnight — otherwise sun times are shifted by the local
  // timezone offset (e.g. solar noon rendering as ~5pm instead of ~1pm).
  const midnight = new Date(today + "T00:00:00Z");
  const base = new Date(today + "T12:00:00Z");
  const jd = base.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = ((280.460 + 0.9856474 * n) % 360 + 360) % 360;
  const g = (((357.528 + 0.9856003 * n) % 360 + 360) % 360) * Math.PI / 180;
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180;
  const sinDec = Math.sin(23.439 * Math.PI / 180) * Math.sin(lambda);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.sin(-0.833 * Math.PI / 180) - Math.sin(lat * Math.PI / 180) * sinDec) /
               (Math.cos(lat * Math.PI / 180) * cosDec);
  if (Math.abs(cosH) > 1) return null;
  const H = Math.acos(cosH) * 180 / Math.PI;
  const B = (360 / 365) * (n - 81) * Math.PI / 180;
  const EqT = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const lstNoon = 12 - lon / 15 - EqT / 60;
  return {
    sunrise: new Date(midnight.getTime() + (lstNoon - H / 15) * 3600000),
    sunset:  new Date(midnight.getTime() + (lstNoon + H / 15) * 3600000),
    solarNoon: new Date(midnight.getTime() + lstNoon * 3600000),
  };
}

// `SunArc` lived here — a daylight arc drawn from railSunTimes, and never
// rendered by anything. Removed 2026-08-15. `railSunTimes` itself stays: it
// is exported and TideWater draws the day's light band with it, which is the
// reason deleting the component wholesale would have been wrong.

// The rail at the astro-quiet lens: clock, date, and the day's light — the
// desk stripped to what a scheduler needs. When a running session is what
// quieted the sky, the note says so, so the state reads as a mode with an
// end rather than a breakage.
function QuietRail({ lat, lon, sessionQuiet, onNavigate }: {
  lat: number; lon: number; sessionQuiet: boolean; onNavigate?: (v: string) => void;
}) {
  const fmtT = useTimeFormat();
  const [tick, setTick] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTick(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const sun = railSunTimes(lat, lon);
  return (
    <aside style={{
      width: RAIL_W, minWidth: RAIL_W, background: "var(--color-rail)",
      display: "flex", flexDirection: "column", flex: 1, minHeight: 0, fontSize: 12,
    }}>
      <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--color-border)" }}>
        <button onClick={() => onNavigate?.("today")} title="Back to Today" style={{
          fontSize: 20, fontWeight: 400, fontFamily: "var(--font-display)", letterSpacing: "0.01em",
          display: "flex", alignItems: "center", gap: 7, background: "none", border: "none",
          cursor: "pointer", padding: 0, color: "var(--color-foreground)",
        }}>
          <span style={{ color: "var(--color-primary)", display: "flex" }}><CompassMark size={19} title="Compass" /></span>
          Compass
        </button>
      </div>
      <div style={{ padding: "16px 14px" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 30, lineHeight: 1.1, color: "var(--color-foreground)" }}>
          {fmtT(tick)}
        </div>
        <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 4 }}>
          {tick.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
        {sun && (
          <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 8 }}>
            Light {fmtT(sun.sunrise)}–{fmtT(sun.sunset)}
          </div>
        )}
        {sessionQuiet && (
          <div style={{
            fontSize: 10.5, color: "var(--text-3)", marginTop: 14, paddingTop: 10,
            borderTop: "1px solid var(--color-border)",
          }}>
            Sky is quiet · session
          </div>
        )}
      </div>
    </aside>
  );
}

export default function Rail({ now, testerId, lat = 40.7, lon = -74.0, onNavigate }: { now: TidesNow | undefined; testerId: string | null; lat?: number; lon?: number; onNavigate?: (v: string) => void }) {
  const { prefs } = usePreferences();
  // The astro-quiet lens folds the whole instrument panel away — see the
  // QuietRail branch below the hooks (it must sit after them: hook order).
  const { level: astroLevel, sessionQuiet } = useAstroDetail();
  const { profile, locationKnown } = useTester();
  const { railSections } = prefs.display;
  // How much of the rail is the first session allowed to be? At `essential`
  // the rail is a slim sky-strip — season, moon, this hour — because the full
  // instrument panel (aspect tables, transits, retrogrades, waves) was the
  // bulk of the nine stacked things a fresh account met on Today (beta pass
  // §B1). Everything hidden here is one tap away via the same density toggle
  // Today uses, mirrored at the foot of the rail so it's reachable from any view.
  const { essential, setDensity } = useUiDensity();
  const { watchPlanets } = prefs.timing;
  const [showNonMoonAspects, setShowNonMoonAspects] = useState(false);
  const [expandedHour, setExpandedHour] = useState<string | null>(null);
  const [moonTakeIdx, setMoonTakeIdx] = useState(0);
  const [seasonTakeIdx, setSeasonTakeIdx] = useState(0);
  const [hourTakeIdx, setHourTakeIdx] = useState(0);
  const [hourExampleIdx, setHourExampleIdx] = useState(0);
  // Instrument-dashboard collapse: `compact` (persisted) turns every core
  // section into a one-line glyph an experienced user reads at a glance; while
  // compact, an individual section can still be expanded (added to `expanded`).
  // isOpen(id) = full form; else the glyph row.
  const [compact, setCompact] = useState<boolean>(() => localStorage.getItem("obs_rail_compact") === "1");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());   // compact mode: sections opened back out
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set()); // full mode: sections individually minimized
  // Each section is independently collapsible in BOTH modes (accordion): in
  // compact everything starts as a glyph and you open the ones you want; in full
  // everything starts open and you can minimize the ones you don't.
  const isOpen = (id: string) => compact ? expanded.has(id) : !collapsed.has(id);
  const toggleOpen = (id: string) => {
    const set = compact ? setExpanded : setCollapsed;
    set(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const setCompactMode = (v: boolean) => { setCompact(v); setExpanded(new Set()); setCollapsed(new Set()); localStorage.setItem("obs_rail_compact", v ? "1" : "0"); };
  // Which sections survive the essential density: the nesting ladder's top
  // three rungs (year → month → hour). Aspects, transits, retrogrades, stars
  // and waves are the instrument panel, and waves/stars are already on Today.
  const ESSENTIAL_RAIL = new Set(["season", "moon", "hour"]);
  const show = (id: string) => !essential || ESSENTIAL_RAIL.has(id);
  // A clear, always-visible minimize control for an open section header.
  const Collapse = ({ id }: { id: string }) => (
    <button onClick={(e) => { e.stopPropagation(); toggleOpen(id); }} title="Minimize" style={{ fontSize: 11, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>▾</button>
  );
  // Section header — the WHOLE row toggles (clicking exactly on the tiny ▾
  // was the only target before, which read as broken). Inner controls like
  // HelpBadge stop propagation themselves.
  const SectionHeader = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <div onClick={() => toggleOpen(id)} style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-3)", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
      <span style={{ display: "flex", alignItems: "center" }}>{children}</span>
      <Collapse id={id} />
    </div>
  );
  const [wavesOpen, setWavesOpen] = useState(true);
  const [transitsOpen, setTransitsOpen] = useState(true);
  const [transitsExpanded, setTransitsExpanded] = useState(false);
  const [expandedPersonal, setExpandedPersonal] = useState<string | null>(null);
  const { data: northStars } = useNorthStars(testerId);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const qc = useQueryClient();
  const today = localToday();

  // A non-2xx response (e.g. a Neon cold start) still resolves r.json() —
  // often {error:"..."} — without throwing, so an unguarded array default
  // never kicks in and a later .filter()/.map() on that object took down the
  // whole app via the ErrorBoundary (audit P0 #8). Today.tsx already guards
  // its equivalent queries this way; Rail (which mounts first) didn't.
  const { data: tasks = [] } = useQuery<any[]>({
    // Same key AND same params as Today's copy on purpose: they share the
    // cache, so a mismatch would have the rail and the page disagreeing
    // about what is on today.
    queryKey: ["tasks-today", testerId, today, new Date().getTimezoneOffset()],
    queryFn: async () => {
      const r = await fetch(`/api/tasks?date=${today}&tz=${new Date().getTimezoneOffset()}`, { headers: testerId ? {"x-tester-id": testerId} : {} });
      const j = await r.json();
      return Array.isArray(j) ? j : [];
    },
    enabled: !!testerId,
    refetchInterval: 30_000,
  });

  const { data: goals = [] } = useQuery<any[]>({
    queryKey: ["goals", testerId],
    queryFn: async () => {
      const r = await fetch("/api/planning/goals", { headers: testerId ? {"x-tester-id": testerId} : {} });
      const j = await r.json();
      return Array.isArray(j) ? j : [];
    },
    enabled: !!testerId,
  });

  // RESONANT NOW reads HABITS, not the legacy practices route (HOME study
  // M4). Two fixes ago this section pointed at a URL that never existed; one
  // fix ago it pointed at the right URL — which reads the cultivations
  // table, one no surface can populate since the 2026-07-09 merge, so it
  // rendered nothing for every post-merge account anyway. Habits carry the
  // same sky scoring now (`resonance`/`resonanceNote`, lib/habitTiming.ts),
  // and this key matches Home's habit reads, so the answer is one cache
  // entry shared across the page rather than another request.
  const habitsQ = useQuery<any[]>({
    queryKey: ["habits", testerId, today, lat, lon],
    queryFn: async () => {
      const r = await fetch(`/api/habits?today=${today}&lat=${lat}&lon=${lon}`,
        { headers: testerId ? { "x-tester-id": testerId } : {} });
      const j = await r.json();
      return Array.isArray(j) ? j : [];
    },
    enabled: !!testerId,
    staleTime: 60_000,
  });
  const railHabits: any[] = habitsQ.data ?? [];
  // Only when there is nothing to show. A failed background refresh still
  // holds a good reading, and a paused query (react-query's offline path)
  // never sets isError at all — it sits at "pending" forever, which is the
  // same admission as an error and has to reach the same line.
  const habitsFailed = !habitsQ.data && (habitsQ.isError || habitsQ.fetchStatus === "paused");

  const toggleTask = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({ done: "true" }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks-today"] }),
  });

  const addTask = useMutation({
    mutationFn: async (title: string) => {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({ title, dueDate: today }),
      });
      if (!r.ok) throw new Error("add task failed"); // was silent — the typed title vanished on failure
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks-today"] }); setNewTaskTitle(""); setShowAddTask(false); },
  });
  const [expandedAspect, setExpandedAspect] = useState<number | null>(null);
  const [expandedNonMoon, setExpandedNonMoon] = useState<number | null>(null);
  const toggleHour = useCallback((key: string) => setExpandedHour(v => v === key ? null : key), []);
  const toggleAspect = useCallback((i: number) => setExpandedAspect(v => v === i ? null : i), []);
  const toggleNonMoon = useCallback((i: number) => setExpandedNonMoon(v => v === i ? null : i), []);
  // The quiet lens needs no sky read at all — it renders before the skeleton
  // so a slow reading can't make the quiet rail flicker through loading bones.
  if (astroLevel === "minimal") {
    return <QuietRail lat={lat} lon={lon} sessionQuiet={sessionQuiet} onNavigate={onNavigate} />;
  }
  // Also treat a malformed response (e.g. a transient 429 error object) as
  // "not ready yet" — show the skeleton rather than crashing on now.planetaryHour.
  if (!now || !now.planetaryHour) {
    return (
      <aside style={{ width: RAIL_W, minWidth: RAIL_W, background: "var(--color-rail)", borderRight: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: 0 }}>
        <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--color-border)" }}>
          <Skeleton width={60} height={16} style={{ marginBottom: 6 }} />
          <Skeleton width={100} height={10} />
        </div>
        {[80, 100, 60, 80].map((h, i) => (
          <div key={i} style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: 6 }}>
            <Skeleton width={50} height={9} />
            <Skeleton width="90%" height={h === 80 ? 34 : 12} borderRadius={h === 80 ? 17 : 4} />
            {h > 60 && <Skeleton width="70%" height={10} />}
          </div>
        ))}
      </aside>
    );
  }

  const { planetaryHour, upcomingHours, moonSign, moonPhase, moonIllumination } = now;
  const sunSign: string | undefined = (now as any).sunSign;
  const dayRuler: string | undefined = (now as any).dayRuler;
  const isVOC: boolean = !!(now as any).voc?.isVOC || !!(now as any).voidOfCourse;
  const pct = progressPct(planetaryHour.began, planetaryHour.ends);
  const pColor = planetColor(planetaryHour.planet);

  return (
    <aside style={{
      width: RAIL_W, minWidth: RAIL_W, background: "var(--color-rail)",
      display: "flex", flexDirection: "column", overflowY: "auto", fontSize: 12,
      flex: 1, minHeight: 0,
    }}>
      {/* Header — date lives in the page topbar (with time), not duplicated here */}
      <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* The wordmark is a way home (owner 2026-07-28): click → Today. */}
        <button onClick={() => onNavigate?.("today")} title="Back to Today" style={{
          fontSize: 20, fontWeight: 400, fontFamily: "var(--font-display)", letterSpacing: "0.01em",
          display: "flex", alignItems: "center", gap: 7, background: "none", border: "none",
          cursor: "pointer", padding: 0, color: "var(--color-foreground)",
        }}>
          <span style={{ color: "var(--color-primary)", display: "flex" }}><CompassMark size={19} title="Compass" /></span>
          Compass
        </button>
        {/* The compact/expand control is for the instrument panel. At essential
            there are three sections and nothing to compact — the one control
            that means anything there is the density switch at the foot. */}
        {!essential && (
          <button onClick={() => setCompactMode(!compact)} title={compact ? "Expand the panel" : "Compact — read it like an instrument panel"} style={{
            fontSize: 12, lineHeight: 1, color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer", padding: 2,
          }}>{compact ? "⊞" : "⊟"}</button>
        )}
      </div>

      {/* ── The nesting ladder: big/slow/simple → small/fast/granular ──
          Season (Sun, ~a month) → Moon (phase ~a month, sign ~2.5 days) →
          This day (24h) → This hour (~1h) → the granular aspects below. A
          beginner reads only the top of this and already has something to work
          with; the detail waits below for whoever wants it. */}

      {/* The planet dossiers' door lived here (AUDIT-JOURNEY J4). It sits
          under Plan now (owner 2026-08-21: "I'm not sure read the planets
          belongs here; put them under plan for now"). */}

      {/* SEASON — the slowest, simplest signifier: what sign the Sun is in. */}
      {sunSign && (isOpen("season") ? (
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-border)" }}>
          <SectionHeader id="season">Season</SectionHeader>
          <SignChip glyph="☉︎" label={`${sunSign} season`} sign={sunSign} />
          {/* The season gets the same "another take" treatment the Moon has —
              it was the one chip in the rail with a single static line and
              nothing to tap, so it read as broken next to its neighbour. */}
          {(() => {
            const sm = SIGN_MYTHOS[sunSign.split(" ")[0]];
            if (!sm) return null;
            // CONDITION → APPROACH → EXAMPLE (AUDIT-EXPLAINERS-2026-08-21 §3).
            // The rarest thing qualifying the Sun leads — an eclipse corridor,
            // the Sun on a node, a gathering in the sign — and the sign's own
            // sentence comes last, as the base. "The feel" left this rotation:
            // its surf-and-fog lines are tide vocabulary outside the tide.
            const takes = takesFor(["Sun", "season"], now?.qualifiers, {
              label: "essence", approach: sm.essence.replace(/\.$/, ""), example: sm.favors[0],
            }, astroLevel);
            takes.push({ key: "shadow", label: "watch for", condition: "", approach: sm.shadow.replace(/\.$/, "") });
            const t = takes[seasonTakeIdx % takes.length];
            return (
              <div style={{ fontSize: 9.5, color: "var(--color-muted)", marginTop: 5, lineHeight: 1.5 }}>
                <span style={{
                  display: "block", color: "var(--text-3)", fontSize: 8,
                  textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 1,
                }}>{t.label}{t.provenance === "compass" && astroLevel === "full" ? " · Compass reading" : ""}</span>
                {t.condition && <span style={{ color: "var(--color-foreground)" }}>{t.condition} — </span>}
                {lineOf({ ...t, condition: "" })}
                {takes.length > 1 && (
                  <button onClick={() => setSeasonTakeIdx(i => i + 1)} title={`Another take on this season (${(seasonTakeIdx % takes.length) + 1} of ${takes.length})`} aria-label="Another take on this season"
                    style={{ marginLeft: 5, fontSize: 9, color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>↻</button>
                )}
              </div>
            );
          })()}
          {/* The solar cycle IS part of the tides — daylight as the year's
              slowest wave: how much light, and which way it's running. */}
          {(now as any)?.daylight && (() => {
            const d = (now as any).daylight;
            const h = Math.floor(d.lengthMin / 60), m = d.lengthMin % 60;
            const drift = d.deltaMin === 0 ? "holding steady" : `${Math.abs(d.deltaMin)} min ${d.deltaMin > 0 ? "longer" : "shorter"} than yesterday`;
            return (
              <div style={{ fontSize: 9.5, color: "var(--color-muted)", marginTop: 5, lineHeight: 1.5 }}>
                ☀ {h}h {String(m).padStart(2, "0")}m of light · <b style={{ color: "#a08a50" }}>{d.phase}</b> · {drift}
              </div>
            );
          })()}
        </div>
      ) : (
        <GlyphRow label="Sun" onClick={() => toggleOpen("season")}>
          <span style={{ fontSize: 12, color: signGlyphInfo(sunSign)?.color }}>☉ {signGlyphInfo(sunSign)?.glyph}</span>
          <span style={{ fontSize: 10, color: "var(--text-3)" }}>{sunSign}</span>
        </GlyphRow>
      ))}

      {/* MOON — phase (where in the ~month cycle) + sign (the ~2.5-day character)
          + void-of-course state. */}
      {railSections.includes("moon") && !isOpen("moon") && (
        <GlyphRow label="Moon" onClick={() => toggleOpen("moon")}>
          <MoonDisc illum={moonIllumination ?? 0} waxing={!/waning|last/i.test(moonPhase ?? "")} size={16} />
          <span style={{ fontSize: 10, color: "var(--color-muted)" }}>{Math.round((moonIllumination ?? 0) * 100)}%</span>
          <span style={{ fontSize: 12, color: signGlyphInfo(moonSign)?.color }}>{signGlyphInfo(moonSign)?.glyph}</span>
          <span style={{ fontSize: 10, color: "var(--text-3)" }}>{moonSign}</span>
          {isVOC && <span style={{ fontSize: 11, color: VOC_COLOR }}>◒</span>}
        </GlyphRow>
      )}
      {railSections.includes("moon") && isOpen("moon") && (
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-border)" }}>
          <SectionHeader id="moon">Moon<HelpBadge term="moonPhase"/></SectionHeader>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MoonDisc illum={moonIllumination ?? 0} waxing={!/waning|last/i.test(moonPhase ?? "")} />
            <div>
              <div style={{ fontWeight: 600 }}>{moonPhase?.replace(/_/g, " ")}</div>
              <div style={{ color: "var(--color-muted)", marginTop: 1, fontSize: 10 }}>{Math.round((moonIllumination ?? 0) * 100)}% lit</div>
            </div>
          </div>
          <div style={{ marginTop: 6 }}>
            <SignChip glyph="☽︎" label="Moon in" sign={moonSign} />
          </div>
          {/* The tide chip that used to sit here is gone — it restated the
              hero's own headline two inches away. Void of course stays: it's a
              gate on the Moon itself, which is what this section is about. */}
          {isVOC && (
            <div style={{ marginTop: 6 }}>
              <span title="Void of course — the Moon makes no more aspects before changing sign. A liminal, 'slack water' stretch: rest, finish, review; not the moment to launch."
                style={{ fontSize: 9, padding: "2px 8px", borderRadius: 8, background: VOC_BG, color: VOC_COLOR, fontWeight: 600 }}>
                ◒ void of course
              </span>
            </div>
          )}
          {/* What this Moon sign means — cycles favors → feel → shadow → essence.
              Labelled "the Moon's mood" so it reads as a LAYER under the day's
              reading rather than a competing verdict: the hero says what kind of
              day it is, this says what the Moon is doing inside it (§B2). */}
          {(() => {
            const sm = moonSign ? SIGN_MYTHOS[moonSign.split(" ")[0]] : null;
            if (!sm) return null;
            // The Moon's qualifiers lead (the void, the Moon on a node, the
            // eclipse corridor); the sign's mood is the base, with one favor as
            // its example. When void, the void qualifier carries the sign's own
            // void reading, so `instead` is not repeated here.
            const fav = moonFavours(sm, now?.voc);
            const takes = takesFor(["Moon"], now?.qualifiers, {
              label: "the mood", approach: sm.essence.replace(/\.$/, ""),
              example: now?.voc?.isVOC ? undefined : sm.favors[0],
            }, astroLevel);
            if (!now?.voc?.isVOC) takes.push({ key: "favors", label: fav.label, condition: "", approach: fav.text });
            takes.push({ key: "shadow", label: "watch for", condition: "", approach: sm.shadow.replace(/\.$/, "") });
            const t = takes[moonTakeIdx % takes.length];
            // How much of this mood is LEFT — measured, not assumed. The label
            // used to read a flat "next 2½ days" (a sign's average length), so
            // on a day the Moon changed sign at 3:36pm it promised two and a
            // half more days of it. The bar shows how far through the sign she
            // actually is, which is the thing the sentence is about.
            const prog = (now as any).moonSignProgress as
              { fraction: number; degreesIn: number; hoursLeft: number; nextSign: string } | undefined;
            const left = prog
              ? prog.hoursLeft < 1 ? "minutes left"
                : prog.hoursLeft < 24 ? `${Math.round(prog.hoursLeft)}h left`
                : `${(prog.hoursLeft / 24).toFixed(1)} days left`
              : null;
            return (
              <div style={{ fontSize: 9.5, color: "var(--color-muted)", marginTop: 7, lineHeight: 1.5 }}>
                <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-3)", marginBottom: 3 }}>
                  The Moon's mood{left ? ` · ${left}` : ""}
                </div>
                {prog && (
                  <div title={`${Math.round(prog.degreesIn)}° through ${moonSign} — then ${prog.nextSign}`}
                    style={{ height: 3, background: "var(--color-border)", borderRadius: 2, marginBottom: 5, position: "relative" }}>
                    <div style={{
                      height: "100%", width: `${Math.round(prog.fraction * 100)}%`,
                      background: signGlyphInfo(moonSign)?.color ?? "var(--color-muted)",
                      borderRadius: 2,
                    }} />
                  </div>
                )}
                <span style={{
                  display: "block", color: "var(--text-3)", fontSize: 8,
                  textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: 1,
                }}>{t.label}{t.provenance === "compass" && astroLevel === "full" ? " · Compass reading" : ""}</span>
                {t.condition && <span style={{ color: "var(--color-foreground)" }}>{t.condition} — </span>}
                {lineOf({ ...t, condition: "" })}
                <button onClick={() => setMoonTakeIdx(i => i + 1)} title={`Another take on this Moon (${(moonTakeIdx % takes.length) + 1} of ${takes.length})`} aria-label="Another take on this Moon sign"
                  style={{ marginLeft: 5, fontSize: 9, color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>↻</button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Moon Aspects */}
      {show("aspects") && railSections.includes("aspects") && now.moonAspects && now.moonAspects.length > 0 && !isOpen("aspects") && (
        <GlyphRow label="Moon aspects" onClick={() => toggleOpen("aspects")}>
          <span style={{ fontSize: 12, color: "var(--color-muted)" }}>☽</span>
          <span style={{ fontSize: 10, color: "var(--text-3)" }}>{now.moonAspects.length} aspect{now.moonAspects.length === 1 ? "" : "s"}</span>
        </GlyphRow>
      )}
      {show("aspects") && railSections.includes("aspects") && now.moonAspects && now.moonAspects.length > 0 && isOpen("aspects") && (
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-border)" }}>
          <SectionHeader id="aspects">Moon aspects<HelpBadge term="moonAspects"/></SectionHeader>
          {sortMoonAspects(now.moonAspects).slice(0, 5).map((a, i) => {
            const other = a.planet1 === "Moon" ? a.planet2 : a.planet1;
            const aspSym: Record<string,string> = { conjunction:"☌︎", opposition:"☍︎", square:"□", trine:"△", sextile:"⚹" };
            const aspColor: Record<string,string> = { conjunction:"#f0b060", opposition:"#e06060", square:"#e06060", trine:"#60a060", sextile:"#6090d0" };
            const sym = aspSym[a.aspect] ?? a.aspect;
            const col = aspColor[a.aspect] ?? "#888888";
            const pCol = planetColor(other);
            const isExpanded = expandedAspect === i;
            const aspMeaning = ASPECT_MEANINGS[a.aspect];
            return (
              <div key={i} style={{ borderBottom: i < now.moonAspects!.length-1 ? "1px solid var(--color-border)" : "none" }}>
                <button onClick={() => toggleAspect(i)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"5px 0", width:"100%", background:"none", border:"none", cursor:"pointer" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11 }}>
                    <span style={{ fontSize:11, color:PLANET_COLORS.Moon }}>☽</span>
                    <span style={{ color:col, fontWeight:700, fontSize:12 }}>{sym}</span>
                    <span style={{ color:pCol, fontWeight:600 }}><PG p={other} /></span>
                    <span style={{ color:"var(--text-2)", fontSize:10 }}>{other}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <div style={{ fontSize:9 }}>
                      {a.orb < 0.5
                        ? <span style={{ fontSize:8, background:"#b0703024", color:"#b07030", padding:"1px 4px", borderRadius:3, fontWeight:600 }}>exact now</span>
                        : a.applying
                          ? (() => {
                              // Use the backend's real per-pair closing speed so this
                              // matches the Planetary Pulse exact time for the same aspect.
                              // Fall back to the Moon's average speed only if unavailable.
                              const hrsToExact = a.hoursToExact ?? a.orb / 0.55;
                              const now_ = new Date();
                              const exactAt = new Date(now_.getTime() + hrsToExact * 3600 * 1000);
                              const hh = exactAt.getHours().toString().padStart(2,"0");
                              const mm = exactAt.getMinutes().toString().padStart(2,"0");
                              return <span style={{ color:col, fontWeight:500 }}>→ {hh}:{mm}</span>;
                            })()
                          : <span style={{ color:"var(--text-3)" }}>{a.orb.toFixed(1)}° past</span>
                      }
                    </div>
                    <span style={{ fontSize:8, color: isExpanded ? col : "var(--text-3)", transition:"transform 0.15s", display:"inline-block", transform: isExpanded ? "rotate(180deg)" : "none" }}>▾</span>
                  </div>
                </button>
                {isExpanded && aspMeaning && (
                  <div style={{ padding:"4px 6px 8px 14px", fontSize:9, color:"var(--color-muted)", lineHeight:1.55, borderLeft:`2px solid ${col}60`, background:`${col}08`, marginBottom:3, borderRadius:"0 0 4px 4px" }}>
                    <div style={{ fontWeight:600, color:col, marginBottom:2 }}>{aspMeaning.name} · {aspMeaning.nature}</div>
                    <div style={{ marginBottom:3 }}>{aspMeaning.desc}</div>
                    {PLANET_MEANING[other] && (
                      <div style={{ color:"var(--text-3)" }}><strong style={{ color:pCol }}>{other}:</strong> {PLANET_MEANING[other]}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Retrogrades */}

      {/* THIS DAY — the day's planetary ruler (24h). Bigger and simpler than the
          hour; a whole day has one keynote. */}
      {show("day") && dayRuler && railSections.includes("hour") && !isOpen("day") && (
        <GlyphRow label="Day" onClick={() => toggleOpen("day")}>
          <span style={{ fontSize: 12, color: planetColor(dayRuler) }}><PG p={dayRuler} /></span>
          <span style={{ fontSize: 10, color: "var(--text-3)" }}>{dayRuler}'s day</span>
        </GlyphRow>
      )}
      {show("day") && dayRuler && railSections.includes("hour") && isOpen("day") && (
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-border)" }}>
          <SectionHeader id="day">This day</SectionHeader>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, background: `${planetColor(dayRuler)}1e`, color: planetColor(dayRuler) }}>
              <PG p={dayRuler} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 12.5 }}>
                {dayRuler}'s day
                {(() => {
                  // The day-ruler's current sign — same "…in {sign}" treatment
                  // the hour gets, since a planet is never just itself.
                  const sign = (now.planets ?? []).find((x: any) => x.planet === dayRuler)?.sign;
                  return sign ? <span style={{ fontWeight: 400, fontSize: 10, color: "var(--color-muted)" }}> in {sign}</span> : null;
                })()}
              </div>
              <PlanetReading planet={dayRuler} planets={now.planets} />
            </div>
          </div>
          <CycleLine
            prefix="good for"
            options={railVerbs(dayRuler, profile?.chronotype, isVOC, moonSign)}
            show={3}
            style={{ marginTop: 5, lineHeight: 1.5 }}
          />
        </div>
      )}

      {/* Planetary Hour */}
      {/* Planetary hours are DERIVED FROM LOCAL SUNRISE AND SUNSET. On a guessed
          meridian every hour boundary shifts, so the whole section is fiction
          dressed as a schedule — and it was previously shown anyway, behind a
          "hours & sun times are estimated" caption. The owner's standing rule:
          if it needs a disclaimer, the design is wrong. Withheld until the
          location is real, with the fix offered in its place. */}
      {railSections.includes("hour") && !locationKnown && (
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-border)" }}>
          <SectionHeader id="hour">This hour<HelpBadge term="planetaryHour"/></SectionHeader>
          <div style={{ fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.55 }}>
            Planetary hours are cut from your local sunrise and sunset, so they need to know where you are.
          </div>
          <button onClick={() => onNavigate?.("settings")}
            style={{ marginTop: 6, background: "none", border: "none", padding: 0, cursor: "pointer",
                     fontSize: 10.5, color: "var(--color-primary)", fontWeight: 600 }}>
            Set your location →
          </button>
        </div>
      )}
      {railSections.includes("hour") && locationKnown && !isOpen("hour") && (
        <GlyphRow label="Hour" onClick={() => toggleOpen("hour")}>
          <span style={{ fontSize: 12, color: pColor }}><PG p={planetaryHour.planet} /></span>
          <span style={{ fontSize: 10, color: "var(--text-3)" }}>{planetaryHour.planet}</span>
          <span style={{ fontSize: 9, color: "var(--text-3)", marginLeft: "auto" }}>{planetaryHour.began}–{planetaryHour.ends}</span>
        </GlyphRow>
      )}
      {railSections.includes("hour") && locationKnown && isOpen("hour") && (
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-border)" }}>
          <SectionHeader id="hour">This hour<HelpBadge term="planetaryHour"/></SectionHeader>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 14, flexShrink: 0,
              background: `${pColor}22`, color: pColor,
              outline: watchPlanets.includes(planetaryHour.planet) ? `2px solid ${pColor}` : "none",
            }}>
              <PG p={planetaryHour.planet} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>
                {planetaryHour.planet}
                {(() => {
                  // The hour ruler's current sign — a planet is never just
                  // itself; the sign it stands in colors its voice.
                  const sign = (now.planets ?? []).find((x: any) => x.planet === planetaryHour.planet)?.sign;
                  return sign ? <span style={{ fontWeight: 400, fontSize: 10, color: "var(--color-muted)" }}> in {sign}</span> : null;
                })()}
              </div>
              <PlanetReading planet={planetaryHour.planet} planets={now.planets} />
              {/* What qualifies THIS planet right now — on a node, combust,
                  stationing, retrograde — under the dignity line, which says
                  what it does from its sign. The two are the condition; the
                  approach below is what to do with it. */}
              {(() => {
                const takes = takesFor([planetaryHour.planet], now?.qualifiers, { label: "", approach: "" }, astroLevel)
                  .filter(t => t.key !== "base");
                if (!takes.length) return null;
                const t = takes[hourTakeIdx % takes.length];
                return (
                  <div style={{ fontSize: 9.5, color: "var(--color-muted)", marginTop: 3, lineHeight: 1.45 }}>
                    <span style={{ display: "block", color: "var(--text-3)", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.7px" }}>
                      {t.label}{t.provenance === "compass" && astroLevel === "full" ? " · Compass reading" : ""}
                    </span>
                    <span style={{ color: "var(--color-foreground)" }}>{t.condition} — </span>{lineOf({ ...t, condition: "" })}
                    {takes.length > 1 && (
                      <button onClick={() => setHourTakeIdx(i => i + 1)} title={`The next thing qualifying ${planetaryHour.planet} (${(hourTakeIdx % takes.length) + 1} of ${takes.length})`} aria-label="The next qualifier"
                        style={{ marginLeft: 5, fontSize: 9, color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>↻</button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
          <div style={{ fontSize: 9, color: "var(--text-3)", display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <span>{planetaryHour.began}</span><span>{planetaryHour.ends}</span>
          </div>
          <div style={{ height: 3, background: "var(--color-border)", borderRadius: 2, marginBottom: 8 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: pColor, borderRadius: 2 }} />
          </div>
          {/* One concrete thing this hour's voice favors — rotates with the
              hour by default, and tapping cycles the other ways it could
              play out without leaving the frame. */}
          {/* The approach for THIS hour, chosen by where it lands in the
              user's own day and whether the Moon is void — not a flat list of
              the planet's verbs. Falls back to the flat list only if the
              approach layer has nothing for this body. */}
          {(() => {
            const ctx = {
              planet: planetaryHour.planet,
              at: new Date(),
              wakeTime: profile?.chronotype?.wakeTime,
              sleepTime: profile?.chronotype?.sleepTime,
              voc: isVOC,
              moonSign,
            };
            const opts = approachOptions(ctx);
            if (!opts.length) {
              // Through railVerbs, which carries the same fallback but keeps
              // the flat list from being rendered raw anywhere. In practice
              // this branch is unreachable — both maps cover exactly the seven
              // traditional planets — but "unreachable" is how the collapsed
              // rail kept its unfiltered copy for a year.
              return <CycleLine prefix="this hour" options={railVerbs(planetaryHour.planet, profile?.chronotype, isVOC, moonSign)}
                seed={new Date().getHours()} style={{ marginBottom: 8 }} />;
            }
            // Several ways in at once (owner 2026-08-18: "more options on the
            // sun hour suggestion"). The suggested approach still leads —
            // stable between glances — and two alternatives sit under it;
            // ↻ walks the window through the rest of the list.
            const lead = suggestApproach(ctx)?.text ?? opts[0];
            const ordered = [lead, ...opts.filter(o => o !== lead)];
            // ONE example, never three (AUDIT-EXPLAINERS §2c): a column of
            // three imperatives is what made the rail read as a horoscope.
            // The rest stay one tap away.
            const shown = ordered[hourExampleIdx % ordered.length];
            return (
              <div style={{ fontSize: 9.5, color: "var(--color-muted)", marginBottom: 8, lineHeight: 1.5 }}>
                <span style={{ color: "var(--text-3)" }}>for example</span> {shown}
                {ordered.length > 1 && (
                  <button onClick={() => setHourExampleIdx(i => i + 1)} title={`Another way to take this hour (${(hourExampleIdx % ordered.length) + 1} of ${ordered.length})`} aria-label="Another way to take this hour"
                    style={{ marginLeft: 5, fontSize: 9, color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>↻</button>
                )}
              </div>
            );
          })()}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* Five upcoming hours is a schedule; two is a heads-up. The
                essential rail wants the heads-up. */}
            {(upcomingHours ?? []).slice(0, essential ? 2 : 5).map((h) => {
              const hCol = planetColor(h.planet);
              const isWatched = watchPlanets.includes(h.planet);
              const key = h.time;
              const isExpanded = expandedHour === key;
              return (
                <div key={key}>
                  <button
                    onClick={() => toggleHour(key)}
                    style={{
                      display: "flex", alignItems: "center", width: "100%", gap: 6,
                      background: isExpanded ? `${hCol}14` : "transparent",
                      border: "none", borderRadius: 5, padding: "4px 4px", cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: 11, color: hCol, width: 14, textAlign: "center", flexShrink: 0 }}>
                      <PG p={h.planet} />
                    </span>
                    <span style={{ flex: 1, fontSize: 10, color: isWatched ? "var(--color-foreground)" : "var(--color-muted)", fontWeight: isWatched ? 600 : 400, textAlign: "left" }}>
                      {h.planet}
                    </span>
                    <span style={{ fontSize: 9, color: isWatched ? hCol : "var(--text-3)", fontWeight: isWatched ? 600 : 400 }}>{h.time}</span>
                    <span style={{ fontSize: 7, color: "var(--text-3)" }}>{isExpanded ? "▲" : "▾"}</span>
                  </button>
                  {isExpanded && (
                    <div style={{ padding: "4px 8px 6px 24px", fontSize: 9, color: "var(--color-muted)", lineHeight: 1.45, borderLeft: `2px solid ${hCol}40`, marginLeft: 11, marginBottom: 2 }}>
                      {PLANET_SIGNIFICATION[h.planet] ?? `${h.planet} hour.`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Non-moon aspects — expand toggle */}
      {show("aspects") && railSections.includes("aspects") && now.aspects && now.aspects.filter(a => a.planet1 !== "Moon" && a.planet2 !== "Moon").length > 0 && (
        <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--color-border)" }}>
          <button onClick={() => setShowNonMoonAspects(v => !v)} style={{
            display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%",
            background:"none", border:"none", cursor:"pointer", padding:0,
          }}>
            <span style={{ fontSize:9, textTransform:"uppercase", letterSpacing:"0.7px", color:"var(--text-3)" }}>
              Planetary aspects
            </span>
            <span style={{ fontSize:8, color:"#c8b870", fontWeight:600, background:"#c8b87026", padding:"1px 5px", borderRadius:4, border:"1px solid #e8d890" }}>
              {showNonMoonAspects ? "▲ hide" : `${now.aspects.filter(a => a.planet1 !== "Moon" && a.planet2 !== "Moon").length} ▼`}
            </span>
          </button>
          {showNonMoonAspects && (() => {
            const aspSym: Record<string,string> = { conjunction:"☌︎", opposition:"☍︎", square:"□", trine:"△", sextile:"⚹" };
            const aspColor: Record<string,string> = { conjunction:"#f0b060", opposition:"#e06060", square:"#e06060", trine:"#60a060", sextile:"#6090d0" };
            const nonMoon = now.aspects!.filter(a => a.planet1 !== "Moon" && a.planet2 !== "Moon").slice(0, 8);
            return (
              <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:0 }}>
                {nonMoon.map((a, i) => {
                  const sym = aspSym[a.aspect] ?? a.aspect;
                  const col = aspColor[a.aspect] ?? "#888888";
                  const p1c = planetColor(a.planet1), p2c = planetColor(a.planet2);
                  const aspMeaning = ASPECT_MEANINGS[a.aspect];
                  const isExp = expandedNonMoon === i;
                  return (
                    <div key={i} style={{ borderBottom: i < nonMoon.length-1 ? "1px solid var(--color-border)" : "none" }}>
                      <button onClick={() => toggleNonMoon(i)} style={{ display:"flex", alignItems:"center", gap:4, width:"100%", background:"none", border:"none", cursor:"pointer", padding:"5px 0" }}>
                        <span style={{ color:p1c, fontWeight:700, fontSize:12 }}><PG p={a.planet1} /></span>
                        <span style={{ color:col, fontWeight:700, fontSize:13 }}>{sym}</span>
                        <span style={{ color:p2c, fontWeight:700, fontSize:12 }}><PG p={a.planet2} /></span>
                        <span style={{ flex:1, fontSize:9, color:"var(--color-muted)", textAlign:"left" }}>{a.planet1} · {a.planet2}</span>
                        <span style={{ fontSize:8, color:a.applying?col:"var(--text-3)", fontWeight:a.applying?600:400 }} title={
                          a.stationsBeforeExact ? "Closing now, but a station turns it back before the aspect perfects"
                          : a.neverPerfected ? "Separating — a station turned it back before the aspect ever perfected"
                          : undefined
                        }>
                          {a.orb.toFixed(1)}°{a.stationsBeforeExact || a.neverPerfected ? " ℞↩" : a.applying ? " →" : "←"}
                        </span>
                        <span style={{ fontSize:8, color: isExp ? col : "var(--text-3)", transition:"transform 0.15s", display:"inline-block", transform: isExp ? "rotate(180deg)" : "none", marginLeft:3 }}>▾</span>
                      </button>
                      {isExp && aspMeaning && (
                        <div style={{ padding:"4px 6px 8px 14px", fontSize:9, color:"var(--color-muted)", lineHeight:1.55, borderLeft:`2px solid ${col}60`, background:`${col}08`, marginBottom:3, borderRadius:"0 0 4px 4px" }}>
                          <div style={{ fontWeight:600, color:col, marginBottom:2 }}>{aspMeaning.name} · {aspMeaning.nature}</div>
                          <div style={{ marginBottom:3 }}>{aspMeaning.desc}</div>
                          <div style={{ color:"var(--text-3)" }}>
                            <strong style={{ color:p1c }}>{a.planet1}:</strong> {PLANET_MEANING[a.planet1] ?? ""}
                          </div>
                          <div style={{ color:"var(--text-3)", marginTop:1 }}>
                            <strong style={{ color:p2c }}>{a.planet2}:</strong> {PLANET_MEANING[a.planet2] ?? ""}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Retrogrades — moved BELOW the aspects (owner 2026-07-11): they
          were popping as "important" up top; they are slow background
          context, so they sit here under the planetary aspects. */}
      {show("retrogrades") && railSections.includes("retrogrades") && now.retrogrades && now.retrogrades.length > 0 && (
        <div style={{ padding: "6px 14px", borderBottom: "1px solid var(--color-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize:9, color:"var(--color-muted)" }}>℞ {now.retrogrades.join(", ")} retrograde</span>
            <Tooltip content={
              <div>
                <div style={{ fontWeight:600, marginBottom:5, color:"#ffffff" }}>Retrograde Planets</div>
                <div style={{ color:"var(--color-muted)", fontSize:10.5, lineHeight:1.55 }}>
                  {now.retrogrades.map(p => {
                    const notes: Record<string,string> = {
                      Mercury: "Mercury retrograde affects communication, contracts, travel, and technology. Re-read, revise, and revisit rather than launch.",
                      Venus: "Venus retrograde affects relationships, finances, and aesthetics. Revisit rather than initiate new connections or purchases.",
                      Mars: "Mars retrograde affects decisive action and assertion. Redirect energy inward; avoid forcing outcomes.",
                      Jupiter: "Jupiter retrograde is a time for inner growth and philosophical review — expansion happens internally.",
                      Saturn: "Saturn retrograde calls for reassessing commitments, structures, and responsibilities.",
                      Uranus: "Uranus retrograde turns disruption inward — personal breakthroughs and course corrections.",
                      Neptune: "Neptune retrograde heightens clarity through illusion — a good time to review ideals and creative projects.",
                      Pluto: "Pluto retrograde intensifies inner transformation. Deep review of power dynamics and hidden patterns.",
                    };
                    return <div key={p} style={{ marginBottom:5 }}><strong style={{ color:"var(--text-3)" }}>{p}:</strong> {notes[p] ?? `${p} retrograde — revisit and review rather than initiate.`}</div>;
                  })}
                </div>
              </div>
            } width={280}>
              <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:14, height:14, borderRadius:"50%", fontSize:8.5, fontWeight:600, background:"var(--color-border)", color:"var(--color-muted)", cursor:"help", marginLeft:4, flexShrink:0 }}>?</span>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Personal transits — collapsible, grouped fast → slow. Fast movers
          (Sun/Mercury/Venus/Mars) are this week's weather; slow ones
          (Jupiter → Pluto) are the chapter you're living in. */}
      {show("transits") && railSections.includes("transits") && now.personalTransits && now.personalTransits.length > 0 && (() => {
        const FAST = new Set(["Sun", "Mercury", "Venus", "Mars", "Moon"]);
        const fast = now.personalTransits!.filter((t: any) => FAST.has(t.transitPlanet));
        const slow = now.personalTransits!.filter((t: any) => !FAST.has(t.transitPlanet));
        const shown = transitsExpanded ? now.personalTransits!.length : 3;
        let count = 0;
        // Each row opens the shared plain-language take — the same explainer a
        // transit gets on Currents, so "click to learn more" works here too.
        const row = (t: any, i: number) => {
          const key = `${t.transitPlanet}|${t.aspect}|${t.natalPlanet}`;
          const isExp = expandedPersonal === key;
          return (
            <div key={i}>
              <button onClick={() => setExpandedPersonal(v => v === key ? null : key)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 0", fontSize: 10, color: "var(--text-2)", width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: t.exact ? "#e0a040" : "#c0c0c0", flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{t.summary}</span>
                <span style={{ fontSize: 7, color: isExp ? "#8a7a50" : "var(--text-3)", transform: isExp ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>▾</span>
              </button>
              {isExp && <TransitTake t={t} />}
            </div>
          );
        };
        return (
          <div style={{ borderBottom: "1px solid var(--color-border)" }}>
            <button onClick={() => setTransitsOpen(v => !v)} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px",
              width: "100%", background: "none", border: "none", cursor: "pointer",
              fontSize: 9, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-3)",
            }}>
              <span style={{ display: "flex", alignItems: "center" }}>Your transits<HelpBadge term="angleCrossing"/></span>
              <span style={{ fontSize: 8, transform: transitsOpen ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>▾</span>
            </button>
            {transitsOpen && (
              <div style={{ padding: "0 14px 10px" }}>
                {fast.length > 0 && (
                  <div style={{ fontSize: 7.5, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-3)", margin: "2px 0 2px" }}>this week — fast</div>
                )}
                {fast.map((t: any, i: number) => (count++ < shown ? row(t, i) : null))}
                {slow.length > 0 && (
                  <div style={{ fontSize: 7.5, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-3)", margin: "6px 0 2px" }}>chapters — slow</div>
                )}
                {slow.map((t: any, i: number) => (count++ < shown ? row(t, i + 100) : null))}
                {now.personalTransits!.length > 3 && (
                  <button onClick={() => setTransitsExpanded(v => !v)} style={{ fontSize: 9, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", padding: "4px 0 0", textDecoration: "underline" }}>
                    {transitsExpanded ? "show fewer" : `show all ${now.personalTransits!.length}`}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}
      {/* Guiding Stars — the chief aims, always in the corner of your eye */}
      {show("stars") && (northStars?.length ?? 0) > 0 && (
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--color-border)" }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-3)", marginBottom: 6 }}>★ Guiding Stars</div>
          {northStars!.map((g: any) => {
            const m = ELEMENT_MYTHOS[g.element ?? ""];
            // No invented denominator — see Dashboard.tsx.
            const done = g.completedCount ?? 0;
            return (
              <button key={g.id} onClick={() => onNavigate?.("work")} title={m ? m.essence : undefined} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "3px 0", width: "100%",
                background: "none", border: "none", cursor: "pointer", textAlign: "left",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: m?.color ?? "#c8b89a", flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 10.5, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}</span>
                <span style={{ fontSize: 8.5, color: "var(--color-muted)", flexShrink: 0 }}>{done > 0 ? done : ""}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Waves — habits / tasks / goals. Hidden at essential, because Home
          already carries the habits and the day's tasks and in the rail this
          was a third copy of the same list rather than a second view of it.
          (It said "Today" until that page retired on 2026-08-19; the reason
          survived the move, the page did not.) */}
      {show("waves") && (
      <div style={{ borderTop: "1px solid var(--color-border)" }}>
        <button onClick={() => setWavesOpen(v => !v)} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 14px", width: "100%", background: "none", border: "none",
          cursor: "pointer", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.7px",
          color: "var(--text-3)",
        }}>
          <span>Waves · what to ride today</span>
          <span style={{ fontSize: 8, transform: wavesOpen ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>▾</span>
        </button>

        {wavesOpen && (
          <div style={{ paddingBottom: 8 }}>
            {/* What a "wave" is — the doable pieces (tasks & habits), not the
                long-term stars (those live in Aims). */}
            <div style={{ fontSize: 8.5, color: "var(--color-muted)", lineHeight: 1.5, padding: "0 14px 6px" }}>
              The doable pieces — your tasks and habits — surfaced when today's conditions support them.
            </div>
            {/* The read failing is not the same as having none, and the rail
                says which one happened rather than showing a list that is
                missing a section without saying so. */}
            {habitsFailed && (
              <div style={{ fontSize: 8.5, color: "var(--color-muted)", lineHeight: 1.5, padding: "0 14px 6px" }}>
                Couldn't read your habits just now, so none are shown below.
              </div>
            )}
            {railHabits.filter((p: any) => p.resonance === "resonant" && !p.doneToday).length > 0 && (
              <div style={{ fontSize: 7.5, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-3)", padding: "0 14px 2px" }}>resonant now — conditions back these</div>
            )}
            {/* Habits the current sky backs */}
            {railHabits.filter((p: any) => p.resonance === "resonant" && !p.doneToday).slice(0, 3).map((p: any) => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 7, padding: "5px 14px",
                borderLeft: "3px solid #60a060", background: "#60a06016",
              }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#60a060", flexShrink: 0 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10.5, color: "#2a5020", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  {p.resonanceNote && <div style={{ fontSize: 8, color: "var(--text-3)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.resonanceNote}</div>}
                </div>
              </div>
            ))}

            {/* Tasks */}
            {(tasks as any[]).filter(t => t.done !== "true").length > 0 && (
              <div style={{ fontSize: 7.5, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-3)", padding: "4px 14px 2px" }}>open tasks</div>
            )}
            {(tasks as any[]).filter(t => t.done !== "true").slice(0, 6).map((t: any) => (
              <div key={t.id} style={{
                display: "flex", alignItems: "center", gap: 7, padding: "5px 14px",
                borderLeft: "3px solid #b0b0c0",
              }}>
                <button onClick={() => toggleTask.mutate(t.id)} style={{
                  width: 13, height: 13, borderRadius: 3, border: "1.5px solid #b0b0c0",
                  background: "transparent", flexShrink: 0, cursor: "pointer", padding: 0,
                }}/>
                <div style={{ fontSize: 10.5, color: "var(--text-1)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
              </div>
            ))}

            {/* Guiding Stars are intentionally NOT here (owner 2026-07-11) —
                Waves is the doable daily layer (tasks + habits); the long-term
                stars live in Aims, not the daily rail. */}

            {/* Add task inline */}
            {showAddTask ? (
              <div style={{ padding: "5px 14px", display: "flex", gap: 4 }}>
                <input
                  autoFocus
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && newTaskTitle.trim()) addTask.mutate(newTaskTitle.trim());
                    if (e.key === "Escape") { setShowAddTask(false); setNewTaskTitle(""); }
                  }}
                  placeholder="Add task…"
                  style={{ flex: 1, padding: "4px 7px", borderRadius: 5, border: "1px solid var(--color-border)", fontSize: 10.5, outline: "none", background: "var(--color-card-2)" }}
                />
                {addTask.isError && <span style={{ fontSize: 9, color: "#a03030", alignSelf: "center" }}>failed</span>}
              </div>
            ) : (
              <button onClick={() => setShowAddTask(true)} style={{
                display: "block", width: "100%", textAlign: "left", padding: "5px 14px",
                background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "var(--text-3)",
              }}>
                + task
              </button>
            )}
          </div>
        )}
      </div>
      )}

      {/* The way back to the instrument panel. Today has the same switch under
          the hero, but the rail is on every view — so from Calendar or Plan
          this is the one place the hidden layers can be asked for. */}
      {essential && (
        <button onClick={() => setDensity("expanded")} style={{
          display: "block", width: "100%", textAlign: "left", padding: "9px 14px",
          borderTop: "1px solid var(--color-border)", background: "none",
          border: "none", cursor: "pointer", fontSize: 9.5, color: "var(--text-3)",
        }}>
          ⊞ Show the full instrument panel
        </button>
      )}
    </aside>
  );
}
