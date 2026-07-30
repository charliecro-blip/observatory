/**
 * GET /api/export/ical?testerId=...
 * Exports user-created tasks (with due dates) and planning windows as iCal.
 * Intentionally excludes astrological computed events (planetary hours, aspects, etc.)
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { tasks, planningWindows } from "@workspace/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { testerProfiles } from "@workspace/db";
import { hashFeedToken } from "../lib/feedToken.js";

const router = Router();

function icalDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
}

function icalDateOnly(s: string): string {
  // YYYY-MM-DD → YYYYMMDD (all-day event)
  return s.replace(/-/g, "");
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function uid(prefix: string, id: number): string {
  return `${prefix}-${id}@tides.app`;
}

router.get("/export/ical", async (req, res) => {
  // Two ways in, with very different trust levels:
  //   · x-tester-id — the app itself, already authenticated as far as this
  //     system authenticates anything.
  //   · ?feedToken=  — a calendar client, which cannot send headers. This is a
  //     dedicated, revocable secret that ONLY opens this route. The tester id
  //     is deliberately no longer accepted from the query string here: that
  //     is what turned a subscription URL into an account credential.
  const headerId = (req.headers["x-tester-id"] as string) || "";
  const feedToken = typeof req.query.feedToken === "string" ? req.query.feedToken : "";

  let testerId = headerId;
  if (!testerId && feedToken) {
    // Indexed lookup on the hash — scanning every profile on each calendar
    // poll would be a real cost (clients re-fetch on their own schedule). The
    // hash is deterministic, so equality here is exactly as strong as the
    // constant-time compare would be, without the table scan.
    const owner = (await db.select().from(testerProfiles)
      .where(eq(testerProfiles.feedTokenHash, hashFeedToken(feedToken))).limit(1))[0];
    if (!owner) { res.status(404).json({ error: "This calendar link is no longer valid." }); return; }
    testerId = owner.testerId;
    // Best-effort "last fetched" so a stale or unknown subscription is visible
    // in Settings; never allowed to fail the response.
    void db.update(testerProfiles)
      .set({ feedTokenLastUsedAt: new Date() })
      .where(eq(testerProfiles.testerId, owner.testerId))
      .catch(() => {});
  }
  if (!testerId) { res.status(400).json({ error: "Missing testerId" }); return; }

  const [taskRows, windowRows] = await Promise.all([
    db.select().from(tasks).where(and(eq(tasks.testerId, testerId), isNotNull(tasks.dueDate))),
    db.select().from(planningWindows).where(eq(planningWindows.testerId, testerId)),
  ]);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Compass App//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Compass — My Events",
    "X-WR-CALDESC:Tasks and planning windows from Compass",
  ];

  const now = icalDate(new Date());

  // Tasks as all-day events
  for (const t of taskRows) {
    if (!t.dueDate) continue;
    const dtStart = icalDateOnly(t.dueDate);
    // All-day event ends on next day
    const nextDay = new Date(t.dueDate + "T12:00:00");
    nextDay.setDate(nextDay.getDate() + 1);
    const dtEnd = icalDateOnly(nextDay.toISOString().slice(0, 10));
    const status = t.done === "true" ? "COMPLETED" : "NEEDS-ACTION";
    // The filter has to happen BEFORE the push: Array.push() returns the new
    // length, so `.push(...).filter()` was calling .filter on a number and
    // throwing — the whole route 500'd on every request, which meant the
    // calendar export has never once worked. (Both TS errors flagging this
    // were sitting in the baseline being ignored as noise.)
    lines.push(...[
      "BEGIN:VEVENT",
      `UID:${uid("task", t.id)}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:${esc(t.title)}`,
      `STATUS:${status}`,
      t.bestWindowType ? `CATEGORIES:${esc(t.bestWindowType.replace("_", " "))}` : "",
      t.notes ? `DESCRIPTION:${esc(t.notes)}` : "",
      "END:VEVENT",
    ].filter(Boolean));
  }

  // Planning windows as timed events
  for (const w of windowRows) {
    lines.push(...[
      "BEGIN:VEVENT",
      `UID:${uid("window", w.id)}`,
      `DTSTAMP:${now}`,
      `DTSTART:${icalDate(new Date(w.startTime))}`,
      `DTEND:${icalDate(new Date(w.endTime))}`,
      `SUMMARY:${esc(w.title)}`,
      `CATEGORIES:${esc(w.windowType.replace("_", " "))}`,
      w.notes ? `DESCRIPTION:${esc(w.notes)}` : "",
      "END:VEVENT",
    ].filter(Boolean));
  }

  lines.push("END:VCALENDAR");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="compass-events.ics"`);
  res.send(lines.join("\r\n"));
});

export default router;
