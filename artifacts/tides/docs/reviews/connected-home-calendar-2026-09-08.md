# Connected Home, Calendar, and Almanac

This pass changes the timing shell into a shared Home / Calendar / Almanac navigation, with Workspace optional. It reuses the original calendar and readings and preserves the timing-search service.

Home shows the existing current reading, a factual lunar-cycle marker, the request field, and up to three upcoming chosen plans. It does not render the entire personal task dashboard. Current-moment exploration remains available through the existing Home instrument.

Search results appear with the existing calendar. Canonical candidates project onto the day/week grid as dashed, unsaved openings; clicking one focuses its result and evidence. They are never inserted as planning windows until the existing choose flow succeeds. Actual intervals remain unchanged when clipped to the visible 5 AM–11 PM grid; the result retains the full times. Calendar selection can seed the requested day, with explicit range review before searching.

Saved choices moved under Calendar. Search saves and calendar edits now refresh the same planning-window queries plus the homepage/library cache. The original Almanac remains available in the shared shell.

Visual changes remove the full-page decorative grid, reduce headline scale, keep existing typography and semantic colors, and use a single-column layout on smaller screens. Calendar results stack ahead of the grid below 1100px, with a jump link to the calendar.

Validation: client TypeScript check passed; production build passed. 36 focused tests passed in America/Chicago, Asia/Kolkata, and UTC, including calendar projection across midnight and a daylight-saving boundary. Browser verification confirmed a real writing opening projected onto the grid and keyboard focus moved to its matching result when selected.

Remaining: live Google Calendar OAuth/sync rehearsal; mobile-device rehearsal; broader language coverage and Watches. Almanac retains its historical activity/week presentation and general day coloring; further consolidation should be reviewed rather than assumed equivalent to the search result envelope. This is a local implementation, not a production deployment.

A subsequent scratch-account rehearsal saved a one-hour writing session for September 9 at 7 AM. The block appeared immediately on the calendar, its matching proposed opening disappeared, and the session appeared in the homepage plan preview after refresh. The scratch record is retained. Returning Home also clears the previous search confirmation.
