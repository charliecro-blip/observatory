import { Router } from "express";
import { db } from "@workspace/db";
import { planningWindows } from "@workspace/db/schema";
import { eq, gte } from "drizzle-orm";

const router = Router();

function icalDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escIcal(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// GET /tides/calendar.ics
router.get("/tides/calendar.ics", async (req, res) => {
  const testerId = (req.headers["x-tester-id"] as string) ?? req.query.tid as string ?? null;

  let windows: any[] = [];
  if (testerId) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    windows = await db.select().from(planningWindows)
      .where(eq(planningWindows.testerId, testerId))
      .orderBy(planningWindows.startTime);
  }

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tides//Timing Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Tides Windows",
    "X-WR-TIMEZONE:UTC",
  ];

  for (const w of windows) {
    const uid = `tides-window-${w.id}@tides.app`;
    const start = new Date(w.startTime);
    const end = new Date(w.endTime);
    const label = w.title ?? w.windowType?.replace(/_/g, " ");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTART:${icalDate(start)}`,
      `DTEND:${icalDate(end)}`,
      `SUMMARY:${escIcal(label)}`,
      `DESCRIPTION:${escIcal(`${w.windowType?.replace(/_/g, " ")} window${w.notes ? " — " + w.notes : ""}`)}`,
      `CATEGORIES:${escIcal(w.windowType ?? "window")}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="tides.ics"');
  res.send(lines.join("\r\n"));
});

export default router;
