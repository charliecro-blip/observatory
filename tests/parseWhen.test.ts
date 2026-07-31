// Quick Capture's natural-language due dates.
//
// Written the way BACKLOG §10 asks for: the expectation is COMPUTED at run
// time from the date under test, never pinned to a literal, so these keep
// meaning something after the week they were written. Where a rule is a
// judgement call ("next friday" = which Friday?), the test states the
// judgement rather than echoing the implementation.

import { describe, it, expect } from "vitest";
import { parseWhen, formatDueChip } from "../artifacts/tides/src/lib/parseWhen";

/** Day-of-week of a YYYY-MM-DD, computed without touching the parser. */
function dow(dateStr: string): number {
  return new Date(dateStr + "T12:00:00").getDay();
}
function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86400000,
  );
}

// A fixed week of "todays" so every rule is exercised from all seven starting
// weekdays — the weekday rules are exactly where an off-by-one hides on one
// day of the week and nowhere else.
const WEEK = [
  "2026-08-03", // Monday
  "2026-08-04",
  "2026-08-05",
  "2026-08-06",
  "2026-08-07",
  "2026-08-08",
  "2026-08-09", // Sunday
];

describe("parseWhen — relative days", () => {
  it("tomorrow is exactly one day on, from every day of the week", () => {
    for (const today of WEEK) {
      const r = parseWhen("draft the report tomorrow", today);
      expect(daysBetween(today, r.dueDate!)).toBe(1);
      expect(r.title).toBe("draft the report");
    }
  });

  it("today and tonight both resolve to the day the user is standing in", () => {
    for (const today of WEEK) {
      expect(parseWhen("call mom today", today).dueDate).toBe(today);
      expect(parseWhen("call mom tonight", today).dueDate).toBe(today);
    }
  });

  it("day after tomorrow is two days, and is not shortened to 'tomorrow'", () => {
    for (const today of WEEK) {
      const r = parseWhen("ship it the day after tomorrow", today);
      expect(daysBetween(today, r.dueDate!)).toBe(2);
      expect(r.title).toBe("ship it");
    }
  });

  it("'in N days' and 'in N weeks' count from today", () => {
    for (const today of WEEK) {
      expect(daysBetween(today, parseWhen("review in 3 days", today).dueDate!)).toBe(3);
      expect(daysBetween(today, parseWhen("review in 2 weeks", today).dueDate!)).toBe(14);
      expect(daysBetween(today, parseWhen("review in 1 week", today).dueDate!)).toBe(7);
    }
  });
});

describe("parseWhen — weekdays", () => {
  it("a bare weekday is the SOONEST such day, today included", () => {
    for (const today of WEEK) {
      for (const [name, target] of [["monday", 1], ["friday", 5], ["saturday", 6]] as const) {
        const r = parseWhen(`gym ${name}`, today);
        // Independently: the right answer lands on the named weekday, is not in
        // the past, and no earlier date satisfies both.
        expect(dow(r.dueDate!)).toBe(target);
        const delta = daysBetween(today, r.dueDate!);
        expect(delta).toBeGreaterThanOrEqual(0);
        expect(delta).toBeLessThan(7);
      }
    }
  });

  it("naming today's own weekday means today, not a week away", () => {
    for (const today of WEEK) {
      const name = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][dow(today)];
      expect(parseWhen(`standup ${name}`, today).dueDate).toBe(today);
    }
  });

  it("'next friday' is next week's Friday — never this week's", () => {
    for (const today of WEEK) {
      const r = parseWhen("retro next friday", today);
      expect(dow(r.dueDate!)).toBe(5);
      const plain = parseWhen("retro friday", today).dueDate!;
      // "next" may never point EARLIER than the plain word.
      expect(daysBetween(today, r.dueDate!)).toBeGreaterThanOrEqual(daysBetween(today, plain));
      // On Mon–Fri the two must genuinely differ — that distinction is the
      // whole reason the rule exists. On Sat/Sun they legitimately coincide:
      // this week's Friday has already passed, so the coming Friday IS next
      // week's, and inventing a gap would push the date a week too far.
      if (dow(today) >= 1 && dow(today) <= 5) {
        expect(r.dueDate).not.toBe(plain);
      }
      expect(r.title).toBe("retro");
    }
  });

  it("'next week' is next week's Monday", () => {
    for (const today of WEEK) {
      const r = parseWhen("plan the quarter next week", today);
      expect(dow(r.dueDate!)).toBe(1);
      expect(daysBetween(today, r.dueDate!)).toBeGreaterThan(0);
      expect(r.title).toBe("plan the quarter");
    }
  });

  it("'this weekend' is the coming Saturday", () => {
    for (const today of WEEK) {
      const r = parseWhen("fix the shelf this weekend", today);
      expect(dow(r.dueDate!)).toBe(6);
      expect(daysBetween(today, r.dueDate!)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("parseWhen — calendar dates", () => {
  it("month-and-day parses in both orders", () => {
    const today = "2026-08-03";
    expect(parseWhen("invoice aug 20", today).dueDate).toBe("2026-08-20");
    expect(parseWhen("invoice august 20th", today).dueDate).toBe("2026-08-20");
    expect(parseWhen("invoice 20 august", today).dueDate).toBe("2026-08-20");
    expect(parseWhen("invoice 20th of august", today).dueDate).toBe("2026-08-20");
  });

  it("a date already past rolls to next year rather than landing behind us", () => {
    const today = "2026-08-03";
    const r = parseWhen("taxes on april 15", today);
    expect(r.dueDate).toBe("2027-04-15");
    expect(daysBetween(today, r.dueDate!)).toBeGreaterThan(0);
  });

  it("an impossible date is rejected, not rolled into the next month", () => {
    // The failure mode this guards: `new Date(2026, 1, 31)` is March 3rd, so a
    // typo would silently produce a real-looking date a month off.
    const r = parseWhen("audit february 31", "2026-08-03");
    expect(r.dueDate).toBeNull();
    expect(r.title).toBe("audit february 31");
  });

  it("numeric dates are deliberately NOT parsed — 8/7 is ambiguous worldwide", () => {
    const r = parseWhen("renew the lease 8/7", "2026-08-03");
    expect(r.dueDate).toBeNull();
    expect(r.title).toBe("renew the lease 8/7");
  });
});

describe("parseWhen — the title it leaves behind", () => {
  it("swallows the preposition with the date", () => {
    const today = "2026-08-03";
    for (const prep of ["by", "on", "due", "before", "for"]) {
      expect(parseWhen(`send the deck ${prep} friday`, today).title).toBe("send the deck");
    }
  });

  it("keeps a typed time in the title, since no column can hold it", () => {
    // Dropping "2pm" from the title would destroy the only record of it; the
    // schema has date granularity only.
    const r = parseWhen("draft the report by fri 2pm", "2026-08-03");
    expect(r.dueDate).not.toBeNull();
    expect(r.title).toContain("2pm");
  });

  it("leaves a line with no date completely untouched", () => {
    for (const line of ["reply to the landlord", "brainstorm names for the launch", "call mom"]) {
      const r = parseWhen(line, "2026-08-03");
      expect(r.dueDate).toBeNull();
      expect(r.title).toBe(line);
      expect(r.matched).toBeNull();
    }
  });

  it("reports the exact substring it consumed, so the strip is auditable", () => {
    const r = parseWhen("send the deck by next friday", "2026-08-03");
    expect(r.matched?.toLowerCase()).toContain("next friday");
    expect("send the deck by next friday").toContain(r.matched!);
  });
});

describe("parseWhen — words that only look like dates", () => {
  it("does not read 'sun' or 'sat' as weekdays", () => {
    // Both are ordinary English, and this app says "Sun" on nearly every
    // screen. Abbreviating them was never worth the false positives.
    for (const line of ["track sun exposure", "sat down with the numbers"]) {
      expect(parseWhen(line, "2026-08-03").dueDate).toBeNull();
    }
  });

  it("does not read a bare month name with no day number", () => {
    for (const line of ["watch march of the penguins", "may need to call the vet"]) {
      expect(parseWhen(line, "2026-08-03").dueDate).toBeNull();
    }
  });

  it("does not fire on a weekday embedded in a longer word", () => {
    expect(parseWhen("check the mondays newsletter", "2026-08-03").dueDate).toBeNull();
    expect(parseWhen("book the wedding venue", "2026-08-03").dueDate).toBeNull();
  });
});

describe("parseWhen — the escape hatch", () => {
  it("quoted text is protected from parsing", () => {
    const r = parseWhen('read "the friday book"', "2026-08-03");
    expect(r.dueDate).toBeNull();
    expect(r.title).toBe("read the friday book");
  });

  it("quotes that protected nothing are left alone", () => {
    // Punctuation the user typed for their own reasons must survive a feature
    // they never invoked.
    const r = parseWhen('call the "big fish" client', "2026-08-03");
    expect(r.dueDate).toBeNull();
    expect(r.title).toBe('call the "big fish" client');
  });

  it("a date outside the quotes still parses", () => {
    const r = parseWhen('read "the friday book" by monday', "2026-08-03");
    expect(dow(r.dueDate!)).toBe(1);
    expect(r.title).toBe("read the friday book");
  });
});

describe("formatDueChip", () => {
  it("always names the real calendar day, never only a relative word", () => {
    // The chip is the user's chance to catch the parser being wrong, which it
    // cannot be if it only ever says "tomorrow".
    const today = "2026-08-03";
    for (const n of [0, 1, 2, 5, 30, 200]) {
      const d = new Date("2026-08-03T12:00:00");
      d.setDate(d.getDate() + n);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const chip = formatDueChip(iso, today);
      expect(chip).toMatch(new RegExp(`\\b${d.getDate()}\\b`));
    }
  });

  it("marks today and tomorrow as such", () => {
    expect(formatDueChip("2026-08-03", "2026-08-03")).toContain("today");
    expect(formatDueChip("2026-08-04", "2026-08-03")).toContain("tomorrow");
  });
});
