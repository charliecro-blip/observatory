import { describe, it, expect } from "vitest";
import { yourDay, type DayWindow, type DayTask } from "../artifacts/tides/src/lib/your-day";

/**
 * Zone 3 — YOUR DAY.
 *
 * The card this replaces listed scheduled windows only, so a day with six
 * unscheduled things to do rendered as "Nothing scheduled" and looked empty.
 * The row that matters most is therefore "still loose": it is what makes the
 * console honest about work the app has not been given a time for.
 */

const day = (h: number, m = 0) => new Date(2026, 7, 3, h, m, 0);
const win = (title: string, s: string, e?: string): DayWindow => ({ title, startTime: s, endTime: e });
const task = (id: number, title: string, done = "false"): DayTask => ({ id, title, done });

describe("the three rows answer three different questions", () => {
  const windows = [win("Revise proposal", "10:00", "11:30"), win("Client call", "13:00", "13:30")];
  const tasks = [task(1, "Send invoice"), task(2, "Buy groceries")];

  it("puts what you're inside of in Now, and what's coming in Next", () => {
    const d = yourDay(windows, tasks, day(10, 30));
    expect(d.now).toEqual({ title: "Revise proposal", when: "10:00 AM–11:30 AM" });
    expect(d.next).toEqual({ title: "Client call", when: "1:00 PM" });
  });

  it("leaves Now empty between commitments rather than reaching backward", () => {
    // 12:00 is after the first block and before the second. Showing the
    // finished block as "now" would be a small lie told every lunchtime.
    const d = yourDay(windows, tasks, day(12));
    expect(d.now).toBeNull();
    expect(d.next?.title).toBe("Client call");
  });

  it("does not let one long block fill both rows", () => {
    // A block occupying Now and Next reads as two commitments.
    const d = yourDay([win("Deep work", "09:00", "17:00")], [], day(11));
    expect(d.now?.title).toBe("Deep work");
    expect(d.next).toBeNull();
  });

  it("names unscheduled work instead of hiding it", () => {
    const d = yourDay(windows, tasks, day(10, 30));
    expect(d.loose.map((t) => t.title)).toEqual(["Send invoice", "Buy groceries"]);
  });

  it("reports a genuinely empty day as empty, exactly once", () => {
    const d = yourDay([], [], day(10));
    expect(d.empty).toBe(true);
    expect(d.now).toBeNull();
    expect(d.next).toBeNull();
  });

  it("is not empty when there is loose work but nothing scheduled", () => {
    // The precise failure of the old card: this rendered "Nothing scheduled"
    // and the day looked clear when it was not.
    const d = yourDay([], [task(1, "Send invoice")], day(10));
    expect(d.empty).toBe(false);
    expect(d.loose).toHaveLength(1);
  });
});

describe("an in-progress task is not loose", () => {
  // Caught on screen: the Keep-going card read "you're already in this" with
  // "still loose · Revise the proposal" rendered six inches below it. Two
  // cards contradicting each other about one fact — the same failure the week
  // caption had when it argued with its own day labels.
  const running = { id: 1, title: "Revise the proposal" };

  it("moves it out of loose and into now", () => {
    const d = yourDay([], [task(1, "Revise the proposal"), task(2, "Send invoice")], day(10), running);
    expect(d.loose.map((t) => t.title)).toEqual(["Send invoice"]);
    expect(d.now).toEqual({ title: "Revise the proposal", when: "in progress" });
  });

  it("lets a real scheduled window keep the Now row", () => {
    // A window is a commitment made in advance; a start stamp is a note about
    // what you picked up. The commitment wins the slot — but the started task
    // still must not reappear as loose.
    const d = yourDay([win("Client call", "09:00", "11:00")],
      [task(1, "Revise the proposal")], day(10), running);
    expect(d.now?.title).toBe("Client call");
    expect(d.loose).toHaveLength(0);
  });

  it("is not empty when the only thing today is the task in hand", () => {
    const d = yourDay([], [task(1, "Revise the proposal")], day(10), running);
    expect(d.empty).toBe(false);
  });

  it("behaves as before when nothing is underway", () => {
    const d = yourDay([], [task(1, "Revise the proposal")], day(10), null);
    expect(d.now).toBeNull();
    expect(d.loose).toHaveLength(1);
  });
});

describe("loose means loose", () => {
  it("drops a task once a window carries the same title", () => {
    const d = yourDay([win("Send invoice", "15:00", "15:30")], [task(1, "Send invoice")], day(10));
    expect(d.loose).toHaveLength(0);
  });

  it("matches across incidental whitespace and case", () => {
    const d = yourDay([win("send   Invoice", "15:00", "15:30")], [task(1, "Send invoice")], day(10));
    expect(d.loose).toHaveLength(0);
  });

  it("never lists completed work", () => {
    const d = yourDay([], [task(1, "Done thing", "true"), task(2, "Open thing")], day(10));
    expect(d.loose.map((t) => t.title)).toEqual(["Open thing"]);
  });
});

describe("time formats from different surfaces both resolve", () => {
  it("accepts ISO instants as well as bare clock strings", () => {
    const iso = new Date(2026, 7, 3, 14, 0, 0).toISOString();
    const isoEnd = new Date(2026, 7, 3, 15, 0, 0).toISOString();
    const d = yourDay([{ title: "Call", startTime: iso, endTime: isoEnd }], [], day(14, 30));
    expect(d.now?.title).toBe("Call");
  });

  it("ignores a window whose time cannot be read, rather than crashing", () => {
    // Bad data should cost that row, not the console.
    const d = yourDay(
      [win("Broken", "not-a-time"), win("Fine", "16:00", "17:00")], [], day(16, 30));
    expect(d.now?.title).toBe("Fine");
  });

  it("treats a window with no end as a point, not as running forever", () => {
    // Otherwise a single open-ended entry would claim to be "now" for the
    // whole rest of the day.
    const d = yourDay([win("Vague", "09:00")], [], day(16));
    expect(d.now).toBeNull();
  });
});

describe("ordering is by clock, not by input order", () => {
  it("finds the earliest upcoming window regardless of array order", () => {
    const d = yourDay(
      [win("Later", "17:00", "18:00"), win("Sooner", "15:00", "16:00")], [], day(14));
    expect(d.next?.title).toBe("Sooner");
  });
});
