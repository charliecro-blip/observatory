# Restore the existing instruments

The timing-first shell hid too much of the existing app behind Workspace. This change makes Now, Calendar, and Almanac directly accessible alongside search, reusing Home.tsx and Calendar.tsx rather than copying their implementations.

- General current-moment questions open the existing Home experience. Specific activities still go to the timing interpreter. Home retains its current conditions, personal inventory, rhythm preferences, and session timer.
- Calendar retains agenda, day, week, month, and almanac views, events, existing planning windows, and Google Calendar controls.
- Almanac opens the existing calendar almanac view, including the activity timeline and sky events.
- Star links carry their identifier into the existing workspace. Account settings open Settings directly.
- The inherited instruments use their existing styles within a shared navigation shell. This is a restoration pass, not a finished visual redesign.

Verified in the local browser: the exact “what should i do right now?” request opens Now; loaded content includes current conditions and an honest empty inventory. Calendar and Almanac render; the almanac contains dated sky events and activity intervals. Google Calendar reports unconfigured on this scratch server, so live sync was not tested or enabled.

Validation: 9 navigation-intent regressions passed, client TypeScript check passed, production client build passed. No backend judgment rules, OAuth credentials, or production data changed.

Follow-up: review the restored surfaces with the owner before removing or reworking more of the original app. The legacy almanac's broad day coloring and Home's rhythm language remain inherited behavior, distinct from activity-specific timing-search results.
