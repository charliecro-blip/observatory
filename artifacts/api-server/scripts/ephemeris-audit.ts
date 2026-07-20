/**
 * Ephemeris accuracy audit — diffs our hand-rolled astro.ts against
 * astronomy-engine (pure-JS, JPL-validated to sub-arcminute) so we can decide
 * keep-vs-replace from data, not vibes. Weighted by what actually hurts:
 * the Moon (0.5°/hr → position error IS timing error on elections).
 */
import * as Astro from "astronomy-engine";
import { getPlanetPositions, moonLongitude, sunLongitude, julianDay } from "../src/lib/astro.js";

const BODIES: [string, Astro.Body][] = [
  ["Sun", Astro.Body.Sun], ["Moon", Astro.Body.Moon], ["Mercury", Astro.Body.Mercury],
  ["Venus", Astro.Body.Venus], ["Mars", Astro.Body.Mars], ["Jupiter", Astro.Body.Jupiter],
  ["Saturn", Astro.Body.Saturn], ["Uranus", Astro.Body.Uranus], ["Neptune", Astro.Body.Neptune],
  ["Pluto", Astro.Body.Pluto],
];
const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
const norm = (d: number) => ((d % 360) + 360) % 360;
const angDiff = (a: number, b: number) => { let d = Math.abs(norm(a) - norm(b)); return d > 180 ? 360 - d : d; };

// Truth: geocentric apparent ecliptic longitude of date.
function trueLon(body: Astro.Body, date: Date): number {
  const ecl = Astro.Ecliptic(Astro.GeoVector(body, date, true));
  return norm(ecl.elon);
}

// Ours: from getPlanetPositions (Mercury..Pluto) + moon/sun longitude helpers.
function ourLon(name: string, date: Date): number {
  const jd = julianDay(date);
  if (name === "Sun") return norm(sunLongitude(jd));
  if (name === "Moon") return norm(moonLongitude(jd));
  const p = getPlanetPositions(jd).find(x => x.planet === name);
  return p ? norm(SIGNS.indexOf(p.sign) * 30 + p.degree) : NaN;
}

// Date grid: every 3 days across ±2y from now, + historical spot dates.
const now = Date.now();
const dates: Date[] = [];
for (let d = -730; d <= 730; d += 3) dates.push(new Date(now + d * 86400000));
for (const iso of ["1990-06-15", "2000-01-01", "2010-07-04", "2020-12-21"]) dates.push(new Date(iso + "T12:00:00Z"));

const stats: Record<string, { max: number; sum: number; n: number; signMiss: number; worstDate: string }> = {};
for (const [name] of BODIES) stats[name] = { max: 0, sum: 0, n: 0, signMiss: 0, worstDate: "" };

for (const date of dates) {
  for (const [name, body] of BODIES) {
    const t = trueLon(body, date), o = ourLon(name, date);
    if (Number.isNaN(o)) continue;
    const err = angDiff(t, o);
    const s = stats[name];
    s.sum += err; s.n++;
    if (err > s.max) { s.max = err; s.worstDate = date.toISOString().slice(0, 10); }
    if (SIGNS[Math.floor(norm(t) / 30)] !== SIGNS[Math.floor(norm(o) / 30)]) s.signMiss++;
  }
}

console.log(`\nEphemeris audit — ${dates.length} dates (±2y @3d + 4 historical), vs astronomy-engine\n`);
console.log("body      mean°   max°    max@date      wrong-sign   Moon: max as time");
console.log("─".repeat(78));
for (const [name] of BODIES) {
  const s = stats[name];
  const mean = s.sum / s.n;
  const moonTime = name === "Moon" ? `${(s.max / 0.5 * 60).toFixed(0)} min` : "";
  console.log(
    `${name.padEnd(9)} ${mean.toFixed(3).padStart(6)} ${s.max.toFixed(3).padStart(6)}  ${s.worstDate.padEnd(12)}  ${String(s.signMiss).padStart(4)}/${s.n}     ${moonTime}`
  );
}
console.log("\n(mean/max = absolute ecliptic-longitude error in degrees; wrong-sign = disagreements that would show the wrong zodiac sign)");
