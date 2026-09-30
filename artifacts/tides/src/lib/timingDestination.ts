/** Navigation intent only; activity-specific timing still goes to the interpreter. */
export function asksForNowOverview(text: string): boolean {
  return /^(?:what (?:should|could|can) i do(?: (?:right )?now| today)?|what(?:'s| is) (?:good|supported) (?:right )?now|show me (?:right )?now|right now)[?.!]*$/i.test(
    text.trim().replace(/’/g, "'").replace(/\s+/g, " "),
  );
}
