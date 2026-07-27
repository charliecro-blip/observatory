import type { QueryClient } from "@tanstack/react-query";

/**
 * Planning windows are read under four different query-key roots across the
 * app (the calendar grid, the calendar day view, the tides day, and Tasks).
 * A create/update/delete anywhere must refresh all of them — otherwise a newly
 * scheduled window doesn't appear until the consumer remounts (the classic
 * "I added an event and it's not on the calendar" bug). Over-invalidating is
 * safe: react-query just refetches the active queries.
 */
const WINDOW_KEY_ROOTS = ["windows", "windows-all", "planning-windows", "planning-windows-all"] as const;

export function invalidateWindows(qc: QueryClient): void {
  for (const root of WINDOW_KEY_ROOTS) qc.invalidateQueries({ queryKey: [root] });
}
