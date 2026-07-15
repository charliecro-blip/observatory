/**
 * GET /api/export/ical?testerId=...
 * Exports user-created tasks (with due dates) and planning windows as iCal.
 * Intentionally excludes astrological computed events (planetary hours, aspects, etc.)
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { tasks, planningWindows } from "@workspace/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";

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
  const testerId = (req.headers["x-tester-id"] as string) || (req.query.testerId as string);
  if (!testerId) { res.status(400).json({ error: "Missing testerId" }); return; }

  const [taskRows, windowRows] = await Promise.all([
    db.select().from(tasks).where(and(eq(tasks.testerId, testerId), isNotNull(tasks.dueDate))),
    db.select().from(planningWindows).where(eq(planningWindows.testerId, testerId)),
  ]);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Auspice App//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Auspice — My Events",
    "X-WR-CALDESC:Tasks and planning windows from Tides",
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
    lines.push(
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
    ).filter(Boolean);
  }

  // Planning windows as timed events
  for (const w of windowRows) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid("window", w.id)}`,
      `DTSTAMP:${now}`,
      `DTSTART:${icalDate(new Date(w.startTime))}`,
      `DTEND:${icalDate(new Date(w.endTime))}`,
      `SUMMARY:${esc(w.title)}`,
      `CATEGORIES:${esc(w.windowType.replace("_", " "))}`,
      w.notes ? `DESCRIPTION:${esc(w.notes)}` : "",
      "END:VEVENT",
    ).filter(Boolean);
  }

  lines.push("END:VCALENDAR");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="tides-events.ics"`);
  res.send(lines.join("\r\n"));
});

export default router;
