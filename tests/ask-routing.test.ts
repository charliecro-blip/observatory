import { describe, it, expect } from "vitest";
import { routeToAsk, isQuestion } from "../artifacts/api-server/src/lib/askRouting";
import { interpretTimingRequest } from "../artifacts/api-server/src/lib/timingRequest";

// Plan Part A, Phase 3: one box. A question goes to Ask unless it names an
// activity and asks about time. Anchored: Sunday 2026-10-04, 10:00 Chicago.
const now = new Date("2026-10-04T15:00:00Z");
const route = (t: string) => routeToAsk(t, interpretTimingRequest(t, "America/Chicago", now) as any) ? "ask" : "timing";

describe("the one box", () => {
  it.each([
    ["why does today feel so heavy?", "ask"],
    ["what does Venus retrograde mean for me", "ask"],
    ["should I quit my job", "ask"],
    ["how do I start a meditation practice?", "ask"],
    ["when should I call mom this week?", "timing"],
    ["should I cut my hair this weekend?", "timing"],
    ["what's the best time to sign the lease?", "timing"],
    ["elect a haircut in the next couple of weeks", "timing"],
    ["haircut friday", "timing"],
    ["garden saturday", "timing"],
  ])("%s → %s", (text, want) => {
    expect(route(text)).toBe(want);
  });

  it("knows a question when it sees one", () => {
    expect(isQuestion("haircut friday")).toBe(false);
    expect(isQuestion("Is this a good week to launch?")).toBe(true);
  });
});
