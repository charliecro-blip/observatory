// Color Weather tests — fixture natal chart, hand-pinned sky. No live
// ephemeris: this repo has been burned twice by tests that read the actual
// day's sky.

import { describe, expect, it } from "vitest";
import { SIGNS, type Planet, type Sign } from "../engine/types";
import type { NatalInput } from "../engine/chart";
import { buildColorWeather, findTransitAspects, type TransitPosition } from "../engine/weather";
import { renderArtwork } from "../engine/render";

const signOf = (lon: number): Sign => SIGNS[Math.floor(((lon % 360) + 360) % 360 / 30)];
const at = (planet: Planet, longitude: number): TransitPosition =>
  ({ planet, sign: signOf(longitude), longitude });

// Same fixture chart as chart.test.ts.
const FIXTURE: NatalInput = {
  ascendant: { sign: "Scorpio", longitude: 220 },
  midheaven: { sign: "Leo", longitude: 130 },
  planets: [
    { planet: "Sun", sign: "Leo", longitude: 130, houseNumber: 10 },
    { planet: "Moon", sign: "Pisces", longitude: 345, houseNumber: 5 },
    { planet: "Mercury", sign: "Virgo", longitude: 155, houseNumber: 11 },
    { planet: "Venus", sign: "Taurus", longitude: 45, houseNumber: 7 },
    { planet: "Mars", sign: "Capricorn", longitude: 282, houseNumber: 3 },
    { planet: "Jupiter", sign: "Sagittarius", longitude: 255, houseNumber: 2 },
    { planet: "Saturn", sign: "Leo", longitude: 134, houseNumber: 10 },
    { planet: "Uranus", sign: "Scorpio", longitude: 226, houseNumber: 1 },
    { planet: "Neptune", sign: "Sagittarius", longitude: 263, houseNumber: 2 },
    { planet: "Pluto", sign: "Libra", longitude: 195, houseNumber: 12 },
  ],
};

// Transiting Mars sits 1° from natal Venus; transiting Saturn sits 2° from
// natal Sun (and natal Saturn).
const SKY: TransitPosition[] = [at("Mars", 46), at("Saturn", 132)];

// Longitude 98 misses every transit-orb band against every fixture planet.
const QUIET_SKY: TransitPosition[] = [at("Mars", 98)];

describe("color weather", () => {
  it("finds the pinned transit aspects with transit-tight orbs", () => {
    const found = findTransitAspects(FIXTURE, SKY);
    const marsVenus = found.find((t) => t.transiting === "Mars" && t.natal === "Venus");
    expect(marsVenus?.aspect).toBe("conjunction");
    expect(marsVenus?.orb).toBeCloseTo(1, 5);
    const saturnSun = found.find((t) => t.transiting === "Saturn" && t.natal === "Sun");
    expect(saturnSun?.aspect).toBe("conjunction");
    expect(saturnSun?.orb).toBeCloseTo(2, 5);
  });

  it("ranks transits, modifies the profile, and adds the arriving pigment", () => {
    const wx = buildColorWeather(FIXTURE, SKY);
    expect(wx.active.length).toBeGreaterThan(0);
    expect(wx.active.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < wx.transits.length; i++) {
      expect(wx.transits[i - 1].score).toBeGreaterThanOrEqual(wx.transits[i].score);
    }
    // Transiting Saturn on the natal Sun and Saturn darkens the field.
    expect(wx.model.profile.luminosity).toBeLessThan(wx.base.model.profile.luminosity);
    const weather = wx.model.palette.find((c) => c.role === "weather");
    expect(weather).toBeDefined();
    expect(weather!.hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(weather!.sources[0]).toContain("transiting");
    expect(wx.shifts.length).toBeGreaterThan(0);
    expect(wx.lines).toHaveLength(wx.active.length);
    for (const line of wx.lines) expect(line).toContain("Transiting");
  });

  it("is deterministic, and a different sky draws different weather", () => {
    const one = buildColorWeather(FIXTURE, SKY);
    const two = buildColorWeather(FIXTURE, SKY);
    expect(two.model.palette.map((c) => c.hex)).toEqual(one.model.palette.map((c) => c.hex));
    expect(renderArtwork(two.model)).toEqual(renderArtwork(one.model));
    const other = buildColorWeather(FIXTURE, [at("Mars", 47), at("Saturn", 132)]);
    expect(renderArtwork(other.model)).not.toEqual(renderArtwork(one.model));
  });

  it("reports a quiet sky honestly: no transits, baseline field, no invented weather", () => {
    const wx = buildColorWeather(FIXTURE, QUIET_SKY);
    expect(wx.active).toHaveLength(0);
    expect(wx.model.profile).toEqual(wx.base.model.profile);
    expect(wx.model.palette.find((c) => c.role === "weather")).toBeUndefined();
    expect(wx.shifts).toHaveLength(0);
    expect(wx.lines).toHaveLength(0);
  });
});
