import { describe, it, expect } from "vitest";
import { daylightOnLocalDay } from "../artifacts/api-server/src/lib/astro";

const dayIn = (d: Date, tz: string) => d.toLocaleDateString("en-CA", { timeZone: tz });
const PLACES: [string, number, number, string][] = [
  ["Austin", 30.1912, -97.8028, "America/Chicago"],
  ["Honolulu", 21.31, -157.86, "Pacific/Honolulu"],
  ["London", 51.5, -0.12, "Europe/London"],
  ["Tokyo", 35.68, 139.69, "Asia/Tokyo"],
  ["Auckland", -36.85, 174.76, "Pacific/Auckland"],
];

// The unit under test used to be getSunriseSunset(julianDay(now)), which
// anchors to the UTC calendar date: an Austin evening after 7 PM asked for
// "today" and got tomorrow's sunrise. The civil date asked for must be the one
// answered, at every longitude.
describe("daylightOnLocalDay", () => {
  it.each(PLACES)("%s: sunrise, solar noon and sunset all fall on the civil day asked for", (_n, lat, lon, tz) => {
    for (const day of ["2026-03-08", "2026-06-21", "2026-10-04", "2026-12-21"]) {
      const d = daylightOnLocalDay(day, lat, lon);
      expect(d.polar).toBeNull();
      for (const t of [d.sunrise!, d.solarNoon!, d.sunset!]) expect(dayIn(t, tz), `${day} ${t.toISOString()}`).toBe(day);
      expect(+d.sunrise!).toBeLessThan(+d.solarNoon!);
      expect(+d.solarNoon!).toBeLessThan(+d.sunset!);
    }
  });

  it("Austin, Oct 4 2026", () => {
    const d = daylightOnLocalDay("2026-10-04", 30.1912, -97.8028);
    const hm = (t: Date) => t.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });
    expect(hm(d.sunrise!)).toBe("7:26 AM");
    expect(hm(d.sunset!)).toBe("7:13 PM");
  });

  it("withholds a day with no sunrise or sunset instead of inventing one", () => {
    const night = daylightOnLocalDay("2026-12-21", 69.65, 18.96); // Tromsø
    expect(night).toEqual({ sunrise: null, solarNoon: null, sunset: null, polar: "night" });
    expect(daylightOnLocalDay("2026-06-21", 69.65, 18.96).polar).toBe("day");
  });
});
