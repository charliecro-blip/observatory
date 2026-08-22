import { describe, it, expect } from "vitest";
import { checkCrisis, KNOWN_FIGURATIVE } from "../artifacts/api-server/src/lib/crisisGate.js";

/**
 * THE GATE, IN BOTH DIRECTIONS.
 *
 * A false negative hands an astrology reading to someone in crisis. A false
 * positive hands a support card to someone whose back hurts. The first is far
 * worse and the second is not nothing: a gate that fires on ordinary venting
 * teaches people to use smaller words, which is the end of the feature.
 *
 * Both halves are pinned here because both are load-bearing.
 */
describe("the crisis gate", () => {
  const BLOCKS = [
    "i want to kill myself",
    "I've been thinking about killing myself",
    "im suicidal",
    "having suicidal thoughts again",
    "i want to die",
    "I just wish I was dead",
    "everyone would be better off dead",
    "thinking about ending my life",
    "i want to end it all",
    "I don't want to be here anymore",
    "don't want to wake up tomorrow",
    "there's no reason to live",
    "nothing to live for",
    "life is not worth living",
    "i've been cutting myself again",
    "i want to hurt myself",
    "thinking about an overdose",
    "I wish I was dead",
    "wish I were dead honestly",
    "sometimes I wish I wasn't here",
    "I wish I'd never been born",
  ];
  for (const text of BLOCKS) {
    it(`blocks: ${text}`, () => {
      const r = checkCrisis(text);
      expect(r.blocked, text).toBe(true);
      if (r.blocked) {
        expect(r.resources.length).toBeGreaterThanOrEqual(2);
        expect(r.message.length).toBeGreaterThan(20);
      }
    });
  }

  for (const text of KNOWN_FIGURATIVE) {
    it(`does not block: ${text}`, () => {
      expect(checkCrisis(text).blocked, text).toBe(false);
    });
  }

  const ORDINARY = [
    "irritable, can't settle, snapping at people",
    "flat, nothing much matters",
    "anxious about the presentation",
    "exhausted and behind on everything",
    "furious with my brother",
    "lonely",
    "grieving, and it comes in waves",
    "burnt out and resentful about it",
    "restless, want to crawl out of my skin",
    "sad for no reason I can name",
    "hopeless about the project",
    "so angry I could scream",
    // Near-misses that must stay through: the words are close, the sense is not.
    "I wish I was better at this",
    "I wish I were on holiday",
    "I want to be done with this project",
    "dead set on finishing today",
  ];
  for (const text of ORDINARY) {
    it(`lets ordinary feeling through: ${text}`, () => {
      expect(checkCrisis(text).blocked, text).toBe(false);
    });
  }

  it("is not fooled by case or padding", () => {
    expect(checkCrisis("   I WANT TO KILL MYSELF   ").blocked).toBe(true);
    expect(checkCrisis("honestly? i want to kill myself.").blocked).toBe(true);
  });

  it("catches violent ideation toward someone else", () => {
    expect(checkCrisis("i want to hurt him").blocked).toBe(true);
    expect(checkCrisis("i'm going to kill someone if this keeps up").blocked).toBe(true);
  });

  it("passes empty and whitespace without blocking", () => {
    expect(checkCrisis("").blocked).toBe(false);
    expect(checkCrisis("   ").blocked).toBe(false);
    expect(checkCrisis(undefined as unknown as string).blocked).toBe(false);
  });

  it("names the support lines it offers, so they cannot silently vanish", () => {
    const r = checkCrisis("i want to die");
    expect(r.blocked).toBe(true);
    if (r.blocked) {
      const labels = r.resources.map(x => x.label).join(" ");
      expect(labels).toMatch(/988/);
      expect(labels).toMatch(/741741/);
      expect(labels).toMatch(/findahelpline/);
    }
  });
});
