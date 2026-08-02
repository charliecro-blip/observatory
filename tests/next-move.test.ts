import { describe, it, expect } from "vitest";
import { pickNextMove, minutesUntil, type NextMoveInput } from "../artifacts/tides/src/lib/next-move";

// A fixed "now" so every window figure in these tests is checkable by hand.
const NOW = new Date("2026-08-02T12:00:00");

function input(patch: Partial<NextMoveInput> = {}): NextMoveInput {
  return {
    now: NOW,
    currentHour: { planet: "Jupiter", began: "11:44", ends: "12:56" },
    upcomingHours: [{ planet: "Mars", time: "12:56" }, { planet: "Sun", time: "14:08" }],
    tasks: [],
    stars: [],
    ...patch,
  };
}

describe("minutesUntil", () => {
  it("measures forward within the day", () => {
    expect(minutesUntil("12:56", NOW)).toBe(56);
  });

  it("wraps past midnight rather than returning a negative remainder", () => {
    // The last planetary hour of the night ends after the date rolls over.
    const lateNight = new Date("2026-08-02T23:40:00");
    expect(minutesUntil("00:15", lateNight)).toBe(35);
  });

  it("reports a time already past as negative, not as tomorrow", () => {
    // Only a wrap of more than half a day counts as tomorrow — an hour that
    // ended ten minutes ago must not read as "23h 50m left".
    expect(minutesUntil("11:50", NOW)).toBe(-10);
  });
});

describe("pickNextMove", () => {
  it("prefers the task whose ruling planet IS this hour's ruler", () => {
    const m = pickNextMove(input({
      tasks: [
        { id: 1, title: "Sort the inbox", planet: "Mercury" },
        { id: 2, title: "Apply for the grant", planet: "Jupiter" },
      ],
    }));
    expect(m.kind).toBe("task");
    expect(m.taskId).toBe(2);
    expect(m.why).toMatch(/This hour runs on Jupiter/);
    expect(m.when).toBe("56 min left in the Jupiter hour");
  });

  it("falls to a Guiding Star when the hour suits a direction with no task under it", () => {
    const m = pickNextMove(input({
      tasks: [{ id: 1, title: "Sort the inbox", planet: "Mercury" }],
      stars: [{ id: 7, title: "Grow the business", planet: "Jupiter" }],
    }));
    expect(m.kind).toBe("star");
    expect(m.starId).toBe(7);
    expect(m.why).toMatch(/put one piece of it here/);
  });

  it("names a soon-opening hour instead of manufacturing a reason to act now", () => {
    const m = pickNextMove(input({
      tasks: [{ id: 3, title: "Have the hard conversation", planet: "Mars" }],
    }));
    expect(m.taskId).toBe(3);
    expect(m.why).toMatch(/Mars hour .* opens at 12:56/);
    expect(m.when).toBe("in 56 min");
  });

  it("does not reach more than two hours ahead for a match", () => {
    // Saturn is the third upcoming hour — too far out to be a "next move".
    const m = pickNextMove(input({
      upcomingHours: [
        { planet: "Mars", time: "12:56" },
        { planet: "Sun", time: "14:08" },
        { planet: "Saturn", time: "15:20" },
      ],
      tasks: [{ id: 4, title: "Do the boring foundation", planet: "Saturn" }],
    }));
    expect(m.why).toMatch(/Nothing in the sky singles this out/);
  });

  it("falls back to the day's element, and says the claim is weaker", () => {
    const m = pickNextMove(input({
      dayElement: "fire",
      tasks: [
        { id: 5, title: "Reconcile the accounts", element: "earth" },
        { id: 6, title: "Ship the launch post", element: "fire" },
      ],
    }));
    expect(m.taskId).toBe(6);
    expect(m.why).toMatch(/No hour singles anything out/);
  });

  it("admits when the sky is neutral rather than dressing the first item as destiny", () => {
    const m = pickNextMove(input({ tasks: [{ id: 8, title: "Renew the passport" }] }));
    expect(m.taskId).toBe(8);
    expect(m.why).toMatch(/Nothing in the sky singles this out/);
  });

  it("with no tasks, asks for a piece of a star rather than picking nothing", () => {
    const m = pickNextMove(input({ stars: [{ id: 9, title: "Finish the book" }] }));
    expect(m.kind).toBe("empty");
    expect(m.title).toMatch(/Finish the book/);
  });

  it("with nothing at all, says so honestly", () => {
    const m = pickNextMove(input());
    expect(m.kind).toBe("empty");
    expect(m.why).toMatch(/nothing to place, the sky has nothing to time/);
  });

  it("carries the void-of-course caveat without vetoing the pick", () => {
    // VOC qualifies BEGINNINGS. Refusing to recommend anything for hours at a
    // time would be the app going quiet exactly when it's asked a question.
    const m = pickNextMove(input({
      voc: true,
      tasks: [{ id: 2, title: "Apply for the grant", planet: "Jupiter" }],
    }));
    expect(m.taskId).toBe(2);
    expect(m.caveat).toMatch(/void of course/);
  });

  it("never claims a window that has already closed", () => {
    // Data can lag a minute past the hour boundary; the phrasing must not
    // become "-3 min left".
    const m = pickNextMove(input({
      currentHour: { planet: "Jupiter", began: "10:44", ends: "11:56" },
      tasks: [{ id: 2, title: "Apply for the grant", planet: "Jupiter" }],
    }));
    expect(m.when).toBe("in the Jupiter hour");
  });
});
