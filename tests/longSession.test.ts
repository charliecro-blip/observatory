import { describe, it, expect } from "vitest";
import { findLongSessions } from "../artifacts/api-server/src/lib/longSession.js";
import { getSunriseSunset, julianDay } from "../artifacts/api-server/src/lib/astro.js";
import { dayTimeline } from "../artifacts/api-server/src/lib/dayTimeline.js";

// Local-constructor dates → the viewer is the machine's zone, stated
// explicitly now that the weavers no longer assume it. See dayTimeline.test.
const TZ = new Date(2026, 7, 5).getTimezoneOffset();
const AUSTIN = { lat: 30.27, lon: -97.74, tzOffsetMin: TZ };
const TROMSO = { lat: 69.65, lon: 18.96 };
const aug = (d: number) => new Date(2026, 7, d, 12, 0);
const dec = (d: number) => new Date(2026, 11, d, 12, 0);

describe("long sessions", () => {
  it("returns distinct tradeoffs rather than one winner", () => {
    const r = findLongSessions({ activityKey: "deep-work", minutes: 240, date: aug(5), ...AUSTIN })!;
    expect(r.options.length).toBeGreaterThan(1);
    // Deduplicated: the same block winning two categories is one option.
    const starts = r.options.map(o => o.candidate.startAt.getTime());
    expect(new Set(starts).size).toBe(starts.length);
  });

  it("computes the arc from the local hour sequence, not from duration", () => {
    const r = findLongSessions({ activityKey: "deep-work", minutes: 240, date: aug(5), ...AUSTIN })!;
    for (const o of r.options) {
      // Four civil hours does NOT mean four planetary hours — temporal hours
      // change length with season and latitude. This is the claim that was
      // wrong in rev 1 of the design.
      expect(o.candidate.arc.length).toBeGreaterThan(0);
      const summed = o.candidate.arc.reduce((n, a) => n + a.minutes, 0);
      expect(Math.abs(summed - 240)).toBeLessThanOrEqual(5);
    }
  });

  it("does not split a block at a lunar transition", () => {
    // A four-hour option must be four hours even when a void or ingress falls
    // inside it — those ride along as `transitions`.
    for (let d = 3; d <= 14; d++) {
      const r = findLongSessions({ activityKey: "deep-work", minutes: 240, date: aug(d), ...AUSTIN });
      for (const o of r?.options ?? []) {
        expect(o.candidate.durationMinutes).toBe(240);
        expect(o.candidate.uninterrupted).toBe(true);
      }
    }
  });

  it("reports the shortfall instead of degrading to the minimum viable form", () => {
    // Ten hours of commitments leaves no four-hour block.
    const busy = [{ startAt: new Date(2026, 7, 5, 8, 0), endAt: new Date(2026, 7, 5, 21, 0), title: "All day" }];
    const r = findLongSessions({ activityKey: "deep-work", minutes: 240, date: aug(5), ...AUSTIN, commitments: busy })!;
    expect(r.options).toEqual([]);
    expect(r.shortfall).toBeTruthy();
    expect(r.shortfall!.longestMinutes).toBeLessThan(240);
  });

  it("splits at a commitment but not around it", () => {
    const r = findLongSessions({
      activityKey: "deep-work", minutes: 180, date: aug(5), ...AUSTIN,
      commitments: [{ startAt: new Date(2026, 7, 5, 13, 0), endAt: new Date(2026, 7, 5, 14, 0), title: "Standup" }],
    })!;
    for (const o of r.options) {
      const s = o.candidate.startAt.getTime(), e = o.candidate.endAt.getTime();
      const mtgStart = new Date(2026, 7, 5, 13, 0).getTime();
      const mtgEnd = new Date(2026, 7, 5, 14, 0).getTime();
      expect(s >= mtgEnd || e <= mtgStart).toBe(true);   // never straddles it
    }
  });

  it("ranks lexicographically — a deferral is never outranked by hour coverage", () => {
    for (let d = 1; d <= 20; d++) {
      const r = findLongSessions({ activityKey: "sign-contract", minutes: 180, date: aug(d), ...AUSTIN });
      for (const o of r?.options ?? []) expect(o.candidate.suitability).not.toBe("defer");
    }
  });

  it("returns null for an unknown activity rather than guessing", () => {
    expect(findLongSessions({ activityKey: "no-such-thing", minutes: 240, date: aug(5), ...AUSTIN })).toBeNull();
  });
});

describe("polar day and night", () => {
  // getSunriseSunset substitutes a symmetric 12-hour day when the Sun never
  // crosses the horizon, so its callers always get a Date. Tromsø on the
  // winter solstice reported 12.00h of daylight and a full set of ~60-minute
  // planetary hours — fiction consumed as fact by every hour consumer.
  it("flags the substitution at the source", () => {
    const polar = getSunriseSunset(julianDay(dec(21)), TROMSO.lat, TROMSO.lon);
    expect(polar.polar).toBe("night");
    const ordinary = getSunriseSunset(julianDay(aug(5)), AUSTIN.lat, AUSTIN.lon);
    expect(ordinary.polar).toBeNull();
  });

  it("withholds planetary hours under polar night", () => {
    const ev = dayTimeline({ date: dec(21), ...TROMSO });
    expect(ev.filter(e => e.kind === "hour-change")).toEqual([]);
    // The rest of the day still works — this is a withholding, not a failure.
    expect(ev.some(e => e.kind === "waking-start")).toBe(true);
  });

  it("withholds the arc under polar night but still finds the block", () => {
    const r = findLongSessions({ activityKey: "deep-work", minutes: 240, date: dec(21), ...TROMSO })!;
    expect(r.options.length).toBeGreaterThan(0);
    for (const o of r.options) expect(o.candidate.arc).toEqual([]);
  });

  it("still produces an arc at an ordinary latitude on the same date", () => {
    const r = findLongSessions({ activityKey: "deep-work", minutes: 240, date: dec(21), ...AUSTIN })!;
    expect(r.options.some(o => o.candidate.arc.length > 0)).toBe(true);
  });
});

describe("sect under polar conditions", () => {
  // Sect drives dignity — exaltation and triplicity differ by day and night —
  // so getting it wrong at high latitude corrupts the readings themselves, not
  // just the hours. Unlike planetary hours this is ANSWERABLE: in polar night
  // the Sun is below the horizon the whole time, in polar day above it. So
  // synthesis.ts and the /tides/now route correct it rather than withholding.
  it("distinguishes polar night from midnight sun", () => {
    expect(getSunriseSunset(julianDay(dec(21)), TROMSO.lat, TROMSO.lon).polar).toBe("night");
    expect(getSunriseSunset(julianDay(new Date(2026, 5, 21, 12, 0)), TROMSO.lat, TROMSO.lon).polar).toBe("day");
  });

  // Without the flag both of these compare against a fabricated symmetric
  // twelve-hour day, so sect flips at a sunrise that never happened.
  it("would otherwise put the Sun up for half of polar night", () => {
    const s = getSunriseSunset(julianDay(dec(21)), TROMSO.lat, TROMSO.lon);
    // The substitute is a symmetric twelve-hour day. Asserted on the window
    // itself rather than on a wall-clock instant, which would only be testing
    // the machine's timezone.
    const spanHours = (s.sunset.getTime() - s.sunrise.getTime()) / 3600000;
    expect(spanHours).toBeCloseTo(12, 1);
    const midpoint = new Date((s.sunrise.getTime() + s.sunset.getTime()) / 2);
    const naive = midpoint >= s.sunrise && midpoint < s.sunset;
    const corrected = s.polar ? s.polar === "day" : naive;
    expect(naive).toBe(true);        // what every caller computed before
    expect(corrected).toBe(false);   // the Sun does not rise at all that day
  });
});
