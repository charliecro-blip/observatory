/**
 * "a" or "an" in front of a word the code did not choose.
 *
 * Every copy site that builds an indefinite article from a template variable
 * gets this wrong for some value of that variable, and the two zodiac signs
 * that start with a vowel are both common: the hero rendered "a Aries Moon"
 * and "a Aquarius Moon" roughly a sixth of the time. The aspect strings have
 * the same hole — "a opposition".
 *
 * Sound, not spelling, is the actual rule, but every value that reaches this
 * function is a sign name, an aspect name, or an element, and none of them are
 * the awkward cases (no "hour", no "unicorn"). If that stops being true, this
 * needs a real exception list rather than a wider vowel test.
 */
export function an(word: string): string {
  return /^[aeiou]/i.test(word.trim()) ? `an ${word}` : `a ${word}`;
}
