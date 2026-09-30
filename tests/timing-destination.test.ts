import { describe, expect, it } from "vitest";
import { asksForNowOverview } from "../artifacts/tides/src/lib/timingDestination";
describe("reuse the current-moment instrument", () => {
  it.each([
    "what should i do right now?",
    "What can I do now?",
    "what's good now?",
    "right now",
    "What should I do today?",
  ])("recognizes the overview request %s", (text) => {
    expect(asksForNowOverview(text)).toBe(true);
  });
  it.each([
    "workout right now",
    "what should I do about my presentation?",
    "painting today",
    "What should I do next weekend?",
  ])("keeps activity and other-horizon requests in search: %s", (text) => {
    expect(asksForNowOverview(text)).toBe(false);
  });
});
