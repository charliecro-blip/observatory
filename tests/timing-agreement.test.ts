import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Calendar's own sunrise/sunset must agree with the server's.
 *
 * The Calendar computes planetary hours client-side instead of consuming the
 * server's, which the power-user audit flagged as a drift risk. Measuring it
 * found not drift but a straight bug: `lstNoon` is a UTC hour-of-day, and the
 * code added it to LOCAL midnight — so every result was displaced by the
 * viewer's UTC offset. New York on 2026-08-02 rendered as sunrise 09:53 and
 * sunset 00:09 the following morning, which shifted every planetary-hour band
 * on the page away from the ones Today and Plan use.
 *
 * These tests hold the two implementations together. The real fix is one
 * canonical timing service; until that lands, this makes a divergence fail
 * loudly instead of showing two different skies on two tabs.
 */

// The client's implementation, mirrored from Calendar.tsx. Kept in sync by the
// source-shape test at the bottom.
function approxSunriseSunset(dateStr: string, lat: number, lon: number) {
  const base = new Date(dateStr + "T12:00:00");
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
  const [yy, mm, dd] = dateStr.split("-").map(Number);
  const utcMidnight = Date.UTC(yy, mm - 1, dd);
  return {
    sunrise: new Date(utcMidnight + (lstNoon - H / 15) * 3600000),
    sunset: new Date(utcMidnight + (lstNoon + H / 15) * 3600000),
  };
}

const PLACES: [string, number, number][] = [
  ["New York", 40.7, -74.0],
  ["London", 51.5, -0.13],
  ["Tokyo", 35.7, 139.7],
  ["Sydney", -33.9, 151.2],
];
const DATES = ["2026-01-15", "2026-03-20", "2026-06-21", "2026-08-02", "2026-12-21"];

describe("client and server agree on sunrise/sunset", () => {
  it("stays within a few minutes everywhere, all year", async () => {
    const A: any = await import("../artifacts/api-server/src/lib/astro.js");
    const worst: string[] = [];
    for (const [name, lat, lon] of PLACES) {
      for (const d of DATES) {
        const client = approxSunriseSunset(d, lat, lon);
        if (!client) continue;
        const jd = A.julianDay(new Date(d + "T12:00:00Z"));
        const server = A.getSunriseSunset(jd, lat, lon);
        const dRise = Math.abs(client.sunrise.getTime() - server.sunrise.getTime()) / 60000;
        const dSet = Math.abs(client.sunset.getTime() - server.sunset.getTime()) / 60000;
        // A few minutes is the honest tolerance for two different low-precision
        // solar formulas. Hours means a frame-of-reference bug, which is
        // exactly what this caught.
        if (dRise > 6 || dSet > 6) worst.push(`${name} ${d}: rise ${dRise.toFixed(0)}m, set ${dSet.toFixed(0)}m`);
      }
    }
    expect(worst.join(" | ")).toBe("");
  });

  it("puts New York's August sunrise in the morning", async () => {
    // The specific failure, pinned as a plain sanity check: the buggy version
    // returned 09:53 local sunrise and a sunset after midnight.
    const r = approxSunriseSunset("2026-08-02", 40.7, -74.0)!;
    // Check the local wall-clock a New Yorker would actually read, which is
    // the thing that was wrong — and avoids the UTC-hour wrap that makes an
    // 8pm EDT sunset land in hour 0 of the following UTC day.
    const local = (d: Date) => Number(d.toLocaleString("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false }));
    expect(local(r.sunrise), "sunrise should be early morning").toBeGreaterThanOrEqual(5);
    expect(local(r.sunrise), "sunrise should be early morning").toBeLessThanOrEqual(7);
    expect(local(r.sunset), "sunset should be evening").toBeGreaterThanOrEqual(19);
    expect(local(r.sunset), "sunset should be evening").toBeLessThanOrEqual(21);
  });

  it("anchors to UTC midnight, not local midnight", () => {
    // The one-line distinction the whole bug turned on.
    const src = readFileSync(
      join(process.cwd(), "artifacts/tides/src/pages/Calendar.tsx"), "utf-8");
    expect(src).toMatch(/Date\.UTC\(yy, mm - 1, dd\)/);
    expect(src, "local-midnight anchor is back")
      .not.toMatch(/const midnight = new Date\(dateStr \+ "T00:00:00"\)/);
  });
});
