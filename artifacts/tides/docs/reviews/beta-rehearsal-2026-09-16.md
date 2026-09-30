# Beta rehearsal, September 15–16, 2026

## Completed in this pass

- Restored the existing tides-b and api-scratch-b launch configurations. Frontend localhost:5175, scratch API localhost:3001, local compass_scratch database. Root production database was not used.
- Fixed accurateRetrograde to use centered motion around the requested instant rather than next-day displacement. Seven new fixed-time cases include Venus and Uranus retrograde stations, Mercury direct station, and direct luminaries. Three station cases failed before the fix and passed after it.
- Restored the existing “Find a session here” action for eligible broad ordinary results. It narrows the draft to the selected interval and asks for duration review; it does not save the broad interval.
- Reset scroll when the shell changes destination or switches between Home and a search draft.
- Disclosed existing 7 AM–11 PM coverage for ordinary searches as well as duration searches. No engine horizon change.

## Measured verification

Full suite after ephemeris correction: 119 files passed, 6 skipped; 1,377 tests passed and 33 skipped in each of America/Chicago, Asia/Kolkata, UTC. Database-dependent skipped tests are not claimed verified. Client and API typechecks passed. Client production build passed after scroll and broad-action fixes, with a bundle-size warning. The final range-note copy change follows that build.

Live browser, existing local Phase A review profile:
- “Write tomorrow” returned a broad result.
- 60-minute refinement returned concrete sessions.
- Chose September 16, 11:15 AM–12:15 PM; confirmed Saved to Compass and the same session on Home. Scratch record retained.
- After broad-action fix, “Find a session here” opened review with 60 minutes and narrowed boundaries, without saving.
- Calendar-to-Home navigation measured scrollY=0.
- Home at 390 CSS pixels: document width 390, request field bottom approximately 533 pixels. Temporary viewport override subsequently reset.
- September 16 refresh rendered current Home and retained the chosen session. Both preview and scratch API returned HTTP 200 outside sandbox networking.
- Original “A time to workout this weekend” request resolved to Hard training over September 19–20; final result inspection continues separately.

## Still open

- VoC definition choice: asked owner whether to unify on classical planets, matching timing/content. No answer yet; no rule changed.
- Google Calendar: scratch server unconfigured. It needs server-only GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET plus GOOGLE_CAL_REDIRECT_URI=http://localhost:3001/api/integrations/google-cal/callback, registered with the OAuth client. Existing integration requests calendar.readonly. Do not imply bidirectional sync or remote event creation. Configure through local secret settings, not chat, and let owner authorize their Google account. Never load production database configuration to enable this.
- Daytime restriction remains an explicit product constraint, not fixed global coverage. Removing it requires coordinated ordinary/long-session behavior and canonical parity tests, not a hidden adapter override.
- Held-out language evaluation, deeper legacy instrument style cleanup, fresh-profile onboarding, Google read/conflict rehearsal, and creative-practice rule review remain incomplete.
- No production deployment or beta sign-off. Existing unrelated dirty files remain untouched.

Workout follow-through: the original request rendered both Saturday and Sunday broad Capricorn windows, each with the now-accessible “Find a session here” action. No catalogue dropdown was required. Final copy-only change passed client typechecking.

## Language constraint follow-through

Ten added regression cases exposed silently ignored constraints: competing day parts, negated morning, overnight, noon, midnight, sunrise, relative days, this week, now plus tomorrow, and tomorrow night. All ten failed before correction. These now require range review; conflicting or negated day parts no longer narrow the draft to the first recognized fragment. Five supported-request controls remain automatic. The request, language, and Phase A suites pass together (92 tests) in Chicago, Kolkata, and UTC; API typechecking passes. These checks measure clarification behavior, not support for automatically resolving those expressions. The running API has not yet been rebuilt/restarted for this follow-through.
