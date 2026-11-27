# Astrowaves source

Astrowaves finds good times in the local sky for the things a person wants more of, and lets them know before those times come. One engine runs in two places:

- **The web app** at `compass.day/waves` (`static/waves/index.html` plus `static/waves/core.js`).
- **The iPhone app** in Scriptable (`static/today/starswell.js`, fetched by the loader in `static/today/SETUP.md`). When it can reach `compass.day/waves`, the phone shows the same web interface inside Scriptable. The phone supplies location, calendar events and saved state, and it creates calendar events and reminders itself. Offline, it falls back to its older built-in screens.

Everything is computed on the device. Nothing about the person leaves it.

## Files

| File | What it does |
| --- | --- |
| `sky.js` | Astronomy: planetary hours, angle crossings, chart angles, the lunar timeline (perfections, void Moon) |
| `rulebook.js`, `rules.json`, `doctrine.json` | Which planets, hours, signs and aspects suit each activity |
| `engine.js`, `core.js` | Hour-level evidence and the older sky reading |
| `plan.js` | The planner. `plan()` finds waves, `moment()` gives the sky right now, `tides()` and `spans()` give multi-day waves, `natalPositions()` sets up your-chart waves |
| `plan-main.js`, `widget-shell.js` | The Scriptable app: widgets, notifications, calendar and the bridge to the web interface |
| `web/app.html` | The web interface source |

## Build

```sh
cd artifacts/tides/astrowaves
npm i --no-save astronomy-engine        # bundle.py inlines its browser build
python3 bundle.py                        # writes starswell-core.js
cp starswell-core.js ../static/waves/core.js
python3 mkplan.py                        # writes StarswellPlan.js (the phone bundle)
cp StarswellPlan.js ../static/today/starswell.js
python3 web/build.py                     # writes ../static/waves/index.html from web/app.html
```

## How a wave is found

1. **Crossings first.** A planet the activity needs, crossing the Ascendant, MC, Descendant or IC, gives a 15-minute window (5 minutes before the crossing to 10 minutes after). Weight is the planet's weight for the activity × the angle's weight × the angle's fit for the activity (table below).
2. **Then the rest of the sky.** Lunar aspects to the activity's planets within two hours, the planetary hour, the rising sign, the Moon's sign and the void Moon (counted against or for, depending on the activity) all add or subtract.
3. **Hours as a fallback.** Strong planetary hours fill in where crossings are thin.
4. **Tiers.** Every good wave is shown. The strongest few, one a day at most, up to how often the person wants the thing, are marked **strong**. The rest are **supportive**. A day with no wave is **open for practice**.
5. **Multi-day waves.** `tides()` scores whole days from day-level conditions: the Moon's sign, the day's ruler, aspects between the activity's planets, the Moon's aspects that day, and how much of the waking day the Moon is void. Aspects between two slow planets count lightly, because they last for weeks. `spans()` joins runs of good days, judged against that activity's own range, into one wave such as "Saturday to Sunday".
6. **The sky right now.** `moment()` scores every activity for one moment, names the moment by its strongest angular planet (falling back to the hour's ruler), and says what comes next.
7. **Your chart (Plus).** When the degree of a natal planet the activity needs crosses an angle where the person is, that becomes a wave too.

### The planet and the angle together (a draft for Charlie to correct)

The planet gives the quality and the angle gives it a direction. Rising: the body, beginning. MC: work in the world, being seen. Setting: meeting someone. IC: home, roots, rest. Multipliers on a crossing's weight, from `FIT` in `plan.js`:

| Intention | Rising | MC | Setting | IC |
| --- | --- | --- | --- | --- |
| Meditation / quiet time | 1.0 | 0.8 | 0.9 | **1.3** |
| Move / exercise | **1.25** | 1.0 | 0.8 | 0.7 |
| Walk or yoga | **1.15** | 0.9 | 1.0 | 0.9 |
| Long run or ride | **1.2** | 1.1 | 0.8 | 0.7 |
| Deep work | 1.0 | **1.3** | 0.8 | 0.8 |
| Writing | **1.15** | **1.15** | 0.8 | 1.0 |
| Making art | **1.2** | 1.1 | 0.9 | 1.0 |
| Admin and errands | 0.9 | **1.25** | 0.9 | 0.9 |
| Calling someone | 0.9 | 1.0 | **1.3** | 1.0 |
| Romance | 0.9 | 0.7 | **1.35** | 1.1 |
| Downtime | 0.8 | 0.7 | 1.0 | **1.35** |
| Journaling | 1.0 | 0.8 | 0.9 | **1.2** |
| Cooking | 0.9 | 0.8 | 1.1 | **1.3** |

### Lead time and length, per activity

Reminders come this long before a wave, and calendar events default to this length. The activity can run past the wave: start on it and keep going.

| Intention | Reminder | Default length |
| --- | --- | --- |
| Meditation, journaling | 10 min | 20 min |
| Move / exercise, long run | 45 min | 60 to 90 min |
| Walk or yoga | 20 min | 40 min |
| Deep work, writing | 15 min | 90 to 120 min |
| Making art | 20 min | 120 min |
| Romance | 60 min | 120 min |
| Calling someone, admin, downtime | 10 min | 30 to 60 min |
| Cooking | 30 min | 60 min |

## Borrowed from Compass

Rules Astrowaves now shares with the main Compass app, so the two read the same sky the same way:

- **A planetary hour can't make a wave strong on its own.** Compass's census found hours on 99% of activity-days, so they can only reinforce. An hour wave is marked strong only when a lunar contact backs it (`CENSUS-FINDINGS-2026-08-04.md`).
- **The last two hours before sleep are wind-down.** Movement, long sessions, deep work and admin get no waves there, and the sky right now marks them "close to bedtime" (`src/lib/approach.ts`).
- **Waking hours can cross midnight.** A day that ends at 1:30 am is taken at its word (`api-server/src/lib/waking.ts`).
- **Day scores use the activity's own planets.** Essential dignity, retrograde, tight aspects from benefics and malefics, and Moon phase, with Compass's weights scaled to this file's day scale (`api-server/src/lib/rareWindows.ts`). The longer view reports a stretch's percentile within its own horizon, so a claim like "top 3% of these 90 days" can be checked.
- **Almanac patterns stay quiet until there's enough to count:** ten caught waves, and four of a kind. They report counts, never a verdict (`src/components/FeltPattern.tsx`).
- **Today opens with the Moon in one sentence:** her sign, phase, void status and the next aspect she perfects (`src/lib/moonLine.ts`).

Still worth taking from Compass: the canonical activity table (`api-server/src/lib/activityCorrespondences.ts`, with house rulers and natal tiers) in place of `rules.json`; the two-year rare-day notice (`RareMomentBanner`, about fourteen days a year); invitations that can be adjusted before you accept them (`GearChange`); conditional alternatives keyed to what the app can't know, like "if you're running empty" (`src/lib/alternatives.ts`); and the theme-aware planet palette (`src/lib/planetColors.ts`).

## Free and Plus

Free covers everything a person needs to use Astrowaves well: Today, the week, the sky right now, the astrology behind every wave, reminders, calendar, widgets, their own words for the planets and their full almanac. Free holds two intentions at a time.

Plus ($5.99 a month or $39.99 a year, prices to test) adds:

- **Your chart.** Waves from the moments your own planets cross the angles where you are, plus "Moon over your natal Venus" days.
- **Plan my week.** A proposed week that meets how often you want each thing, on strong waves that miss your calendar. Approve it and everything goes on the calendar at once. Fully automatic rescheduling is left out on purpose, since iOS can't run it reliably.
- **The longer view.** Thirty and ninety days ahead, with runs of good days for placing bigger things.
- **Patterns in your almanac.** These appear after eight caught waves, labeled as an early read until twenty.
- **Room for more.** Any number of intentions. One-off searches (a first date, a hard conversation) are next, using acts already in `rules.json`.
- **Letters from the sky.** A seasonal note from Charlie. Planned.

During the beta, Plus is open to everyone. "Preview the free version" under You shows the limits.

## Beta

- `compass.day/waves/beta.html` is the guide for testers: the two ways in, the two-week ask, and what stays on the device.
- The web app installs to the Home Screen (`manifest.json`, icons from `web/icon.svg`; regenerate the PNGs with `node web/mkicons.js` from a folder that has Playwright).
- **Tell Charlie** (under You, and "This doesn't fit" on any wave) posts to Compass's existing `/api/feedback` with kind, note, screen, viewport, build and the wave's id. Read them with `GET /api/feedback` as admin, filtering on `surface` starting `astrowaves`.
- **Today is one of the good ones** appears when an intention's day ranks in the top 2% of the next four months and today is the crest of its stretch. It's computed once a day on the device and cached (Compass's `RareMomentBanner` rule).
- **Now** adds three conditional picks keyed to what the app can't know: running empty, wanting company, needing to move (Compass's `alternatives.ts`).

## Editorial rules

Astrowaves offers invitations, not instructions. It never says a chance was missed, never uses urgency, never treats a weak score as a reason not to do something necessary, and never equates catching a wave with succeeding at the activity. Notifications describe conditions and don't promise outcomes.
