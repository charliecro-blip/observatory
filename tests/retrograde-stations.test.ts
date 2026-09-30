import { describe, expect, it } from 'vitest';
import { accurateRetrograde } from '../artifacts/api-server/src/lib/ephemeris';
import { julianDay } from '../artifacts/api-server/src/lib/astro';

// Published station dates: https://cafeastrology.com/astrology-of-2026.html
// Use points several hours either side so this checks current motion rather
// than claiming agreement to a particular ephemeris's exact station minute.
describe('motion at the requested instant around stations', () => {
  it.each([
    ['Venus', '2026-10-03T03:00:00Z', false],
    ['Venus', '2026-10-03T12:00:00Z', true],
    ['Uranus', '2026-09-10T14:00:00Z', false],
    ['Uranus', '2026-09-10T23:00:00Z', true],
    ['Mercury', '2026-03-20T15:00:00Z', true],
    ['Mercury', '2026-03-21T00:00:00Z', false],
  ])('%s motion at %s', (planet, at, expected) => {
    expect(accurateRetrograde(planet, julianDay(new Date(at)))).toBe(expected);
  });
  it('keeps the luminaries direct', () => {
    const jd = julianDay(new Date('2026-10-03T12:00:00Z'));
    expect(accurateRetrograde('Sun', jd)).toBe(false);
    expect(accurateRetrograde('Moon', jd)).toBe(false);
  });
});
