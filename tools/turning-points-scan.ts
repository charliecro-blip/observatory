// The turning-point scan — the curation calendar for the check-in feature
// (HANDOFF-NEW-MOON-CHECKIN-2026-08-12.md). Prints the coming months of
// reset moments from the app's own ephemeris: lunations (with eclipse
// coincidence), solstices/equinoxes, and Mercury/Venus/Mars stations with
// the ~2.5°-approach date a station's prompt should open on.
//
// NOT a vitest file on purpose: vitest.config.ts includes only tests/**, so
// a tools/*.test.ts never runs and quietly rots. Run it directly —
//
//   EB=node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild/bin/esbuild
//   $EB tools/turning-points-scan.ts --bundle --platform=node --format=esm \
//       --outfile=/tmp/tp.mjs && node /tmp/tp.mjs
//
// SCAN_FROM is a fixed date (not Date.now()) so output is reproducible and
// diffable; bump it when re-running for a new curation window.

import {
  julianDay, sunLongitude, moonLongitude, eclipseWindow, getPlanetPositions,
} from "../artifacts/api-server/src/lib/astro";

const SCAN_FROM = "2026-08-12T00:00:00Z";
const SCAN_DAYS = 240;

const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
const norm = (x: number) => ((x % 360) + 360) % 360;
const signOf = (lon: number) => SIGNS[Math.floor(norm(lon) / 30)];
const degIn = (lon: number) => (norm(lon) % 30).toFixed(1);
const dateOf = (jd: number) => new Date((jd - 2440587.5) * 86400000).toISOString().slice(0, 16) + "Z";

const start = julianDay(new Date(SCAN_FROM));
const end = start + SCAN_DAYS;

const phaseAngle = (jd: number) => norm(moonLongitude(jd) - sunLongitude(jd));
console.log("=== LUNATIONS ===");
let prev = phaseAngle(start);
for (let jd = start + 0.04; jd <= end; jd += 0.04) {
  const cur = phaseAngle(jd);
  const crossedNew = prev > 300 && cur < 60;
  const crossedFull = prev < 180 && cur >= 180;
  if (crossedNew || crossedFull) {
    let lo = jd - 0.04, hi = jd;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const a = phaseAngle(mid);
      if (crossedNew ? a > 300 : a < 180) lo = mid; else hi = mid;
    }
    const t = (lo + hi) / 2;
    const lon = crossedNew ? sunLongitude(t) : moonLongitude(t);
    const ecl = eclipseWindow(t);
    console.log(`${crossedNew ? "NEW " : "FULL"} ${dateOf(t)} — ${signOf(lon)} ${degIn(lon)}°${ecl.active ? `  ⚠ ECLIPSE (${ecl.kind})` : ""}`);
  }
  prev = cur;
}

console.log("=== SOLSTICE / EQUINOX ===");
let prevSun = sunLongitude(start);
for (let jd = start + 0.02; jd <= end; jd += 0.02) {
  const cur = sunLongitude(jd);
  for (const target of [0, 90, 180, 270]) {
    if (norm(prevSun - target) > 350 && norm(cur - target) < 10) {
      let lo = jd - 0.02, hi = jd;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (norm(sunLongitude(mid) - target) > 350) lo = mid; else hi = mid;
      }
      const t = (lo + hi) / 2;
      const name = target === 180 ? "EQUINOX (fall)" : target === 270 ? "SOLSTICE (winter)"
        : target === 0 ? "EQUINOX (spring)" : "SOLSTICE (summer)";
      console.log(`${name} ${dateOf(t)} — Sun 0° ${signOf(target)}`);
    }
  }
  prevSun = cur;
}

console.log("=== STATIONS ===");
for (const planet of ["Mercury", "Venus", "Mars"]) {
  const lonAt = (jd: number) => {
    const p = getPlanetPositions(jd).find((x) => x.planet === planet);
    return p ? p.longitude : NaN;
  };
  const motionAt = (jd: number) => {
    const m = lonAt(jd + 0.25) - lonAt(jd);
    return ((m + 540) % 360) - 180;
  };
  let prevM = motionAt(start);
  for (let jd = start + 0.5; jd <= end; jd += 0.5) {
    const m = motionAt(jd);
    if (Math.sign(m) !== Math.sign(prevM) && Math.abs(prevM) < 1) {
      let lo = jd - 0.5, hi = jd;
      for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2;
        if (Math.sign(motionAt(mid)) === Math.sign(prevM)) lo = mid; else hi = mid;
      }
      const t = (lo + hi) / 2;
      const lon = lonAt(t);
      const dir = m < 0 ? "RETRO " : "DIRECT";
      let approach = "";
      if (dir === "RETRO ") {
        for (let back = t - 1; back > t - 45; back -= 0.25) {
          const gap = Math.abs(((lonAt(back) - lon + 540) % 360) - 180);
          if (gap >= 2.5) { approach = `  (slowing from ~${dateOf(back + 0.25).slice(0, 10)})`; break; }
        }
      }
      console.log(`${planet.toUpperCase().padEnd(7)} stations ${dir} ${dateOf(t)} — ${signOf(lon)} ${degIn(lon)}°${approach}`);
    }
    prevM = m;
  }
}
