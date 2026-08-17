// Touches — partial progress as the dated record of having worked on a task
// (home-base build 2026-08-16, ask 4). A touch trail is a quiet line after
// the title: "worked on · Tue · Thu". Never a percentage, never a gauge —
// `done` stays binary, and a task with touches is still not done.

import { localToday } from "./dates";

export interface TouchTrail { dates: string[]; minutes: number }

/** The muted trail line, or null when there is nothing to say. */
export function touchLine(t: TouchTrail | undefined | null): string | null {
  if (!t || t.dates.length === 0) return null;
  const today = localToday();
  // Noon-anchored parse so the civil date's weekday survives every timezone.
  const name = (d: string) => d === today
    ? "today"
    : new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });
  if (t.dates.length <= 3) return `worked on · ${t.dates.map(name).join(" · ")}`;
  return `worked on · ${t.dates.length} days recently`;
}
