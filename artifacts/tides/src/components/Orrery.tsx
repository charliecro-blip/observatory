import React from "react";

// The Star Base orrery — a small navigable wheel of the zodiac with your natal
// planets placed on it. Click a planet to select it. The signature instrument
// of the console: you steer by seeing the whole sky at once.

const SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const SIGN_GLYPH: Record<string, string> = { Aries: "♈", Taurus: "♉", Gemini: "♊", Cancer: "♋", Leo: "♌", Virgo: "♍", Libra: "♎", Scorpio: "♏", Sagittarius: "♐", Capricorn: "♑", Aquarius: "♒", Pisces: "♓" };
const PLANET_GLYPH: Record<string, string> = { Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂", Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇" };
const PLANET_COLOR: Record<string, string> = {
  Sun: "#c8971e", Moon: "#5a6b8c", Mercury: "#7a8a4a", Venus: "#3f8493", Mars: "#c04830",
  Jupiter: "#7a5cae", Saturn: "#6a6258", Uranus: "#3a9aa8", Neptune: "#5a6cae", Pluto: "#7a3a5a",
};
// Element tint per sign (fire, earth, air, water repeating from Aries).
const SIGN_TINT = ["#c0483015", "#4a704015", "#c19a3a15", "#3a5a8015", "#c0483015", "#4a704015", "#c19a3a15", "#3a5a8015", "#c0483015", "#4a704015", "#c19a3a15", "#3a5a8015"];

const CX = 150, CY = 150;
const R_OUTER = 142, R_INNER = 112, R_SIGN = 127;
const D2R = Math.PI / 180;
// Longitude 0° (Aries) at the top, increasing clockwise.
const pos = (lon: number, r: number) => ({ x: CX + r * Math.cos((lon - 90) * D2R), y: CY + r * Math.sin((lon - 90) * D2R) });
const longitude = (sign: string, degree: number) => SIGNS.indexOf(sign) * 30 + (degree ?? 0);

export default function Orrery({ planets, selected, onSelect }: {
  planets: { planet: string; sign: string; degree: number }[];
  selected: string;
  onSelect: (p: string) => void;
}) {
  // Nudge overlapping planets outward so clustered ones stay legible.
  const placed = [...planets]
    .filter((p) => PLANET_GLYPH[p.planet])
    .map((p) => ({ ...p, lon: longitude(p.sign, p.degree) }))
    .sort((a, b) => a.lon - b.lon)
    .map((p, i, arr) => {
      let r = 90;
      for (let j = 0; j < i; j++) {
        const prev = arr[j] as any;
        if (Math.abs(prev.lon - p.lon) < 9 && Math.abs((prev._r ?? 90) - r) < 15) r = (prev._r ?? 90) - 16;
      }
      (p as any)._r = r;
      return p as typeof p & { lon: number; _r: number };
    });

  return (
    <svg viewBox="0 0 300 300" width="100%" height="260" role="img" aria-label="your chart wheel — click a planet to visit it" style={{ maxWidth: 300, margin: "0 auto", display: "block" }}>
      <circle cx={CX} cy={CY} r={R_OUTER} fill="none" style={{ stroke: "var(--color-border)" }} strokeWidth="1" />
      <circle cx={CX} cy={CY} r={R_INNER} fill="none" style={{ stroke: "var(--color-border)" }} strokeWidth="1" />

      {/* 12 sign segments */}
      {SIGNS.map((sign, i) => {
        const start = pos(i * 30, R_INNER), startO = pos(i * 30, R_OUTER);
        const mid = pos(i * 30 + 15, R_SIGN);
        const a0 = (i * 30 - 90) * D2R, a1 = ((i + 1) * 30 - 90) * D2R;
        const p0i = pos(i * 30, R_INNER), p1i = pos((i + 1) * 30, R_INNER);
        const p0o = pos(i * 30, R_OUTER), p1o = pos((i + 1) * 30, R_OUTER);
        const wedge = `M ${p0i.x} ${p0i.y} A ${R_INNER} ${R_INNER} 0 0 1 ${p1i.x} ${p1i.y} L ${p1o.x} ${p1o.y} A ${R_OUTER} ${R_OUTER} 0 0 0 ${p0o.x} ${p0o.y} Z`;
        return (
          <g key={sign}>
            <path d={wedge} fill={SIGN_TINT[i]} />
            <line x1={start.x} y1={start.y} x2={startO.x} y2={startO.y} style={{ stroke: "var(--color-border)" }} strokeWidth="1" />
            <text x={mid.x} y={mid.y + 4} textAnchor="middle" fontSize="13" fill="#9a948a">{SIGN_GLYPH[sign]}</text>
          </g>
        );
      })}

      {/* Planets */}
      {placed.map((p) => {
        const col = PLANET_COLOR[p.planet] ?? "#888";
        const isSel = p.planet === selected;
        const pt = pos(p.lon, (p as any)._r);
        return (
          <g key={p.planet} style={{ cursor: "pointer" }} onClick={() => onSelect(p.planet)}>
            <circle cx={pt.x} cy={pt.y} r={isSel ? 14 : 11} fill={isSel ? col : `${col}1e`} stroke={col} strokeWidth={isSel ? 2 : 1} />
            <text x={pt.x} y={pt.y + 5} textAnchor="middle" fontSize={isSel ? 15 : 13} fill={isSel ? "#fff" : col} style={{ pointerEvents: "none", fontWeight: isSel ? 700 : 400 }}>{PLANET_GLYPH[p.planet]}</text>
          </g>
        );
      })}

      {placed.length === 0 && (
        <text x={CX} y={CY + 4} textAnchor="middle" fontSize="11" fill="#aaa">add your birth details</text>
      )}
      {placed.length > 0 && (
        <text x={CX} y={CY + 4} textAnchor="middle" fontSize="10" fill="#bbb" style={{ letterSpacing: "0.5px" }}>YOUR SKY</text>
      )}
    </svg>
  );
}
