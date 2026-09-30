import { describe, expect, it } from 'vitest';
import { plainTideReading } from '../artifacts/tides/src/lib/elements';

describe('plain current reading', () => {
  it('keeps instrument metaphors and directives out of every ordinary reading', () => {
    for (const character of ['surge', 'building', 'clear', 'deep'] as const)
      for (const level of ['high', 'rising', 'tide', 'ebb', 'low']) {
        const reading = plainTideReading(character, level);
        expect(reading).not.toMatch(/tide|fire bank|seeds|force a start|must|should|—/i);
        expect(reading).not.toContain('undefined');
      }
  });
  it('retains the qualification about beginnings even for a quiet reading', () => {
    for (const quiet of [false, true]) {
      expect(plainTideReading('surge', 'high', true, quiet)).toContain('qualifies the timing for new beginnings');
      expect(plainTideReading('surge', 'high', false, quiet)).not.toContain('new beginnings');
    }
  });
});
