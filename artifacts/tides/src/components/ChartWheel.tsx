import React, { useMemo } from "react";
import { useTheme } from "@/contexts/theme-context";
import { glyphChar, fontFor, GLYPH_INDEX, GLYPH_ELEMENT_COLORS, type GlyphTheme } from "@/lib/celestialGlyphs";

// The astro clock — a bi-wheel. Natal planets on the inner track, current
// transits on the outer, the zodiac ring outside them, house spokes if the
// birth time is known, and transit→natal aspect lines strung through the
// center. Real geometry, read the way a practitioner reads it.

interface ChartPlanet { planet: string; sign: string; degree: number; longitude: number; retrograde: boolean; house?: number | null; }
interface Aspect { transitPlanet: string; natalPlanet: string; aspect: string; orb: number; exact: boolean; severity: string; }

const SIGN_ORDER = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const SIGN_ELEMENT = ["fire", "earth", "air", "water"]; // repeats by triplicity from Aries

// Aspect line color by nature — harmonious blue/green, hard red, conjunction gold.
const ASPECT_LINE: Record<string, { color: string; dash?: string }> = {
  Conjunction: { color: "#c8a03a" },
  Sextile: { color: "#5a8fb0", dash: "3 3" },
  Trine: { color: "#5a9a6a" },
  Square: { color: "#c05a4a" },
  Opposition: { color: "#c05a4a", dash: "5 3" },
};

export default function ChartWheel({
  natalPlanets, transitPlanets, cusps, ascendant, aspects, size = 340, highlight, onPickAspect,
}: {
  natalPlanets: ChartPlanet[];
  transitPlanets: ChartPlanet[];
  cusps: number[] | null;
  ascendant: number | null;
  aspects: Aspect[];
  size?: number;
  highlight?: { transitPlanet: string; natalPlanet: string } | null;
  onPickAspect?: (a: Aspect) => void;
}) {
  const { theme } = useTheme();
  const glyphTheme: GlyphTheme = theme === "dark" ? "observatory" : "tide";
  const elColors = GLYPH_ELEMENT_COLORS[glyphTheme];
  const ink = theme === "dark" ? "#c8cfda" : "#3a3a3a";
  const faint = theme === "dark" ? "#2a3038" : "#e6e2d8";
  const ringBg = theme === "dark" ? "#12161d" : "#faf8f3";

  const cx = size / 2, cy = size / 2;
  const rZodiacOuter = size * 0.47;
  const rZodiacInner = size * 0.40;
  const rTransit = size * 0.355;   // transit planet track
  const rNatal = size * 0.255;     // natal planet track
  const rAspect = size * 0.205;    // aspect lines live inside this

  // Ascendant on the left (9 o'clock); no time → 0° Aries at left.
  const asc = ascendant ?? 0;
  // longitude → screen point. Counterclockwise from the Ascendant on the left.
  const pt = (lon: number, r: number) => {
    const a = (180 + (lon - asc)) * (Math.PI / 180);
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  };

  // De-cluster planets that sit within minSep degrees on the same track:
  // push each colliding one outward a notch so glyphs don't stack.
  const placeTrack = (planets: ChartPlanet[], baseR: number, minSep = 7) => {
    const sorted = [...planets].sort((a, b) => a.longitude - b.longitude);
    const out: { p: ChartPlanet; r: number }[] = [];
    let run = 0;
    for (let i = 0; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const gap = prev ? Math.abs(sorted[i].longitude - prev.longitude) : 999;
      run = gap < minSep ? run + 1 : 0;
      out.push({ p: sorted[i], r: baseR + run * (size * 0.032) });
    }
    return out;
  };
  const natalPlaced = useMemo(() => placeTrack(natalPlanets, rNatal), [natalPlanets, size]);
  const transitPlaced = useMemo(() => placeTrack(transitPlanets, rTransit), [transitPlanets, size]);

  const natalLon: Record<string, number> = Object.fromEntries(natalPlanets.map((p) => [p.planet, p.longitude]));
  const transitLon: Record<string, number> = Object.fromEntries(transitPlanets.map((p) => [p.planet, p.longitude]));

  const glyphEl = (name: string) => GLYPH_INDEX[name]?.element ?? "water";
  const pcolor = (name: string) => elColors[glyphEl(name)];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: size, display: "block", margin: "0 auto" }}>
      {/* Zodiac ring */}
      <circle cx={cx} cy={cy} r={rZodiacOuter} fill={ringBg} stroke={faint} strokeWidth={1} />
      <circle cx={cx} cy={cy} r={rZodiacInner} fill="none" stroke={faint} strokeWidth={1} />
      {SIGN_ORDER.map((sign, i) => {
        const startLon = i * 30;
        const el = SIGN_ELEMENT[i % 4];
        // segment divider
        const div = pt(startLon, rZodiacOuter);
        const divIn = pt(startLon, rZodiacInner);
        // glyph at segment center
        const mid = pt(startLon + 15, (rZodiacOuter + rZodiacInner) / 2);
        return (
          <g key={sign}>
            <line x1={divIn.x} y1={divIn.y} x2={div.x} y2={div.y} stroke={faint} strokeWidth={1} />
            <text x={mid.x} y={mid.y} fontSize={size * 0.05} fill={elColors[el as keyof typeof elColors]}
              fontFamily={fontFor(sign)} textAnchor="middle" dominantBaseline="central">
              {glyphChar(GLYPH_INDEX[sign].cp)}
            </text>
          </g>
        );
      })}

      {/* House cusps (spokes) — only with a known birth time */}
      {cusps && cusps.map((c, i) => {
        const outer = pt(c, rZodiacInner);
        const isAngle = i === 0 || i === 3 || i === 6 || i === 9; // ASC/IC/DSC/MC
        const mid = pt(c + 15, rAspect * 0.62);
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={outer.x} y2={outer.y}
              stroke={isAngle ? (theme === "dark" ? "#4a5568" : "#c8bfa8") : faint}
              strokeWidth={isAngle ? 1.4 : 0.6} />
            <text x={mid.x} y={mid.y} fontSize={size * 0.028} fill={theme === "dark" ? "#5a6472" : "#bcb4a2"}
              textAnchor="middle" dominantBaseline="central">{i + 1}</text>
          </g>
        );
      })}

      {/* Aspect lines (transit → natal) */}
      {aspects.map((a, i) => {
        const t = transitLon[a.transitPlanet], n = natalLon[a.natalPlanet];
        if (t == null || n == null) return null;
        const spec = ASPECT_LINE[a.aspect];
        if (!spec) return null;
        const p1 = pt(t, rAspect), p2 = pt(n, rAspect);
        const isHi = highlight && highlight.transitPlanet === a.transitPlanet && highlight.natalPlanet === a.natalPlanet;
        const dim = highlight && !isHi;
        return (
          <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            stroke={spec.color} strokeWidth={isHi ? 2 : a.exact ? 1.2 : 0.7}
            strokeDasharray={spec.dash} opacity={dim ? 0.12 : a.exact ? 0.9 : 0.5}
            style={{ cursor: onPickAspect ? "pointer" : "default" }}
            onClick={() => onPickAspect?.(a)} />
        );
      })}
      <circle cx={cx} cy={cy} r={rAspect} fill="none" stroke={faint} strokeWidth={0.6} />

      {/* Natal planets (inner track) */}
      {natalPlaced.map(({ p, r }) => {
        const pos = pt(p.longitude, r);
        return (
          <g key={"n" + p.planet}>
            <circle cx={pos.x} cy={pos.y} r={size * 0.028} fill={ringBg} stroke={faint} strokeWidth={0.5} />
            <text x={pos.x} y={pos.y} fontSize={size * 0.045} fill={pcolor(p.planet)}
              fontFamily={fontFor(p.planet)} textAnchor="middle" dominantBaseline="central">
              {glyphChar(GLYPH_INDEX[p.planet].cp)}
            </text>
          </g>
        );
      })}

      {/* Transit planets (outer track) — ringed to read as "the moving sky" */}
      {transitPlaced.map(({ p, r }) => {
        const pos = pt(p.longitude, r);
        return (
          <g key={"t" + p.planet}>
            <circle cx={pos.x} cy={pos.y} r={size * 0.03} fill={ringBg} stroke={pcolor(p.planet)} strokeWidth={1} opacity={0.9} />
            <text x={pos.x} y={pos.y} fontSize={size * 0.045} fill={pcolor(p.planet)}
              fontFamily={fontFor(p.planet)} textAnchor="middle" dominantBaseline="central">
              {glyphChar(GLYPH_INDEX[p.planet].cp)}
            </text>
            {p.retrograde && <text x={pos.x + size * 0.035} y={pos.y - size * 0.028} fontSize={size * 0.026} fill={pcolor(p.planet)} textAnchor="middle">℞</text>}
          </g>
        );
      })}

      {/* Center label: inner ring = natal, outer = transiting sky */}
      <text x={cx} y={cy - 5} fontSize={size * 0.026} fill={theme === "dark" ? "#5a6472" : "#b0a898"} textAnchor="middle">natal</text>
      <text x={cx} y={cy + 9} fontSize={size * 0.024} fill={theme === "dark" ? "#4a5568" : "#c0b8aa"} textAnchor="middle">· transits ring outside ·</text>
    </svg>
  );
}
