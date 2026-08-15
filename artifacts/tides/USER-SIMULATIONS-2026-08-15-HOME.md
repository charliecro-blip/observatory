# User simulations — 2026-08-15 · THE HOME STUDY

Sixth pass, first since the Home/Today split shipped (2026-08-15, commits
`470f106`…`f4ef7ad`). The four retention studies and the pricing study never
saw this page: Home as the landing surface, panoramic, with Today demoted to
the working view. The owner's brief for this pass: **what do the personas want
prominent on Home, what is confusing or unnecessary, where does the app trip
them across a day, a week, a month — and how does it get sleeker.**

**Method honesty (unchanged from the MONTH study):** simulations, not people.
Every structural claim below was verified against the running build first —
screenshots, live payloads, network traces, refs throughout. The felt-texture
claims are directional. What is NOT directional is Part A: those are defects
observed on screen today, and three of them were caught as contradictions
visible in a single screenshot.

Roster: the established twelve (`USER-SIMULATIONS-2026-07-29-MONTH.md`). Same
stakes, one month later in their fictional lives where it matters.

---

## Grounding — Home as built today (verified 2026-08-15, live app)

Module stack, top to bottom (`pages/Home.tsx` render order):

| # | Module | Heading | Renders when |
|---|--------|---------|--------------|
| 1 | CompassNow | COMPASS · RIGHT NOW | loop has a now/then |
| 2 | VOC strip | RIGHT NOW · THE MOON IS VOID | Moon void |
| 3 | Turning-point banner / kept card | (eclipse mark) | check-in window (computed, 5 days) |
| 4 | RareMomentBanner | — | rare day, when 3 idle |
| 5 | Work grid L: task column | YOUR WORK | always |
| 6 | Work grid R: DayAhead | YOUR DAY | day non-empty |
| 7 | Work grid R: committed week | THIS WEEK | always |
| 8 | Work grid R: Guiding Stars | GUIDING STARS | stars exist |
| 9 | Work grid R: RhythmProgress | HABITS | habits exist |
| 10 | Work grid R: Today's log | TODAY'S LOG | expanded + engaged |
| 11 | Horizon L: QualityStrip | THE WATER AHEAD | week data |
| 12 | Horizon R: CroppingUp | CROPPING UP | events in 45d |
| 13 | Answer card | WHAT LINES UP | always |

Measured on a typical filled account (LA coordinates, 3 tasks, 2 habits,
2 stars):

- **Page height 2,658px** — about three laptop folds, six phone folds.
- **8 uppercase section headings** on one page.
- **9 distinct "→" door labels** visible at once: Why this? · Take ten
  minutes · Shape today · See the calendar · See week · Weave the week in
  Plan · Open Stars · All habits · Plan around these. Below the fold, three
  more: Put on today · Find another activity · Find a time for something
  else. **Twelve doors, ten verb patterns.**
- **16 API calls on a cold load** (13 distinct); slowest 2.4s
  (`elections/lines-up`, `habits`, `account/sync` on a cold server). The
  answer card shows "Reading the sky…" for that whole window.
- **Mobile (375px): the work grid does not collapse.** Two columns render at
  ~180px each — task titles truncate at ~12 characters, "See the calendar →"
  wraps to three lines, the week strip's day labels overlap into
  "SatSunMoTueWedThuFri", and the page scrolls horizontally
  (`document.body.scrollWidth > window.innerWidth` measured true).
  `Home.tsx` work grid: `gridTemplateColumns: "minmax(0,1.55fr) minmax(0,1fr)"`
  with no breakpoint. The horizon row is fine (`auto-fit, minmax(280px,1fr)`).

---

## Part A — Three contradictions visible in one screenshot

These are not persona findings. They were on screen simultaneously during
grounding, on a real account, at 1:04 PM on a Saturday.

### A1. Home answers "what now" twice, and today the answers disagreed

Top of page (CompassNow): **"Long run — until 2:04 PM — This is what the hour
suits. [Start this]"**. Bottom of page (What lines up): **"Long run — IN 1
HOUR — 2:04 PM–3:06 PM — [Put on today]"**.

The top card reads the planetary hour ("this is what the hour suits");
the bottom card reads the election engine (window opens at 2:04). Both are
legitimate engines. But a person sees: *start the run now, it suits until
2:04* directly above *your run's window starts at 2:04*. Do I run now or at
2:04? The page does not say, because the page does not know it said both.

The Home/Today split was made precisely to end "three surfaces answering
what's on today" (`HANDOFF-HOME-TODAY-2026-08-14.md`). The split moved the
duplication down one level: one page, two engines, two CTAs ("Start this"
vs "Put on today"), one activity.

### A2. One habit, four sightings

"Long run" appeared, simultaneously: in CompassNow (as the hero), in YOUR
DAY's habit chips, in HABITS ("0 of 7 this week"), and in WHAT LINES UP (as
the lead). Four renderings of one habit on one page is the page arguing with
its own panoramic claim — breadth at low resolution means each thing appears
once, at the right altitude.

### A3. The eclipse banner lies for four of its five days

"**Today is a new moon** and a solar eclipse in Leo" — shown on August 15.
The new moon was August 12. The line is written for day zero of a five-day
window (`NewMoonCheckIn.tsx:443`, hardcoded in the banner JSX, not even in
the curated CYCLE block). Every persona who opens the app on days 1–4 reads
a false sentence in the app's own banner — and this is the app whose moat is
"describe conditions, never promise outcomes." Dan checks his phone's moon
widget, sees a waxing crescent, and files Compass under horoscope-grade
sloppiness. **One fact, one source; this fact has zero sources.**

---

## Part B — The twelve, through Home

Format per persona: what they'd pin to the top · what confuses or wastes
their attention · what trips them across day/week/month.

### 1 · Luna — pro astrologer

**Wants prominent:** WHAT LINES UP — the evidence panel is the one thing here
she can't get elsewhere, and it's at the very bottom of the page. VOC strip
with the new `provenance` line (she will notice the Lilly citation and respect
it). CROPPING UP earns its place instantly — stations and eclipses are her
planning spine.
**Confusing/unnecessary:** CompassNow's "This is what the hour suits" with no
receipt — she taps "Why this?" expecting testimony and gets the loop
rationale; the real evidence is two folds down in a different card (A1). The
water-ahead bars: she can't tell what the bar height IS (qualityScore is
unlabeled).
**Trips (day/week/month):** Day — the disagreement in A1 is disqualifying for
public recommendation; she'd screenshot it. Week — fine. Month — she'd catch
the stale eclipse banner (A3) on day 2 and lose confidence in every other
date in the app.
**Verdict:** the astro-literate user's page is upside down: the receipt is
furthest away.

### 2 · Dan — zero astrology, one job to do

**Wants prominent:** YOUR WORK and nothing else. His entire Home need:
"pick a good day for the site work" → that lives in Plan's Pick-a-day.
Home should be a short hallway to it.
**Confusing/unnecessary:** the vocabulary wall. Between Home's headings and
strips he meets: void of course · lunar eclipse · Virgo · waxing crescent ·
Guiding Stars · the water ahead · cropping up. WORLDBOOK layer-1 rules say
the front page passes the stranger test; the SECTIONS mostly do, but the
horizon row's content doesn't try ("Sun enters Virgo" with no gloss).
**Trips:** Day — CompassNow tells him to "Finish the album" (his wife's
task? no — the lead task on a shared demo; on his own account it names his
own task, fine). Week — the committed strip is now honest ("Nothing woven in
yet") and that's good for him: no fake "open" days. Month — he came, he
picked a date in Plan, Home never showed him the date he picked as a
standing fact. **The one thing Dan wants pinned — "site work: Sep 3, you
chose this" — has no Home slot.** Committed week shows it only if it's
within 7 days.
**Verdict:** Home is 80% noise for Dan, but the 20% (work + committed week)
is the right 20%. His fix is subtraction, not addition.

### 3 · Rachel — ADHD freelancer

**Wants prominent:** ONE next action. CompassNow is exactly right for her —
"Long run, until 2:04, Start this" is the ADHD-correct interface. Then the
task list, uncapped (the 2026-08-15 in-place expansion fix was for her).
**Confusing/unnecessary:** twelve doors is eleven too many. Every "→" is a
context-switch invitation, and she takes them — Shape today, See week, Open
Stars, All habits, Plan around these — twenty minutes gone, no task started.
The A1 contradiction is worst for her: two CTAs for the same act
("Start this" / "Put on today") reads as a decision she now has to make.
**Trips:** Day — starts strong with CompassNow, derails at the horizon row
(novelty magnet). Week — Plan now greets her with "You're holding 17 things
already" instead of an empty dump box: genuinely good, one less re-import
spiral. Month — the page's length itself: 2,658px of morning is a scroll
habit that decays into skimming, then skipping.
**Verdict:** Rachel is the strongest argument for a fold rule: **everything
below CompassNow + YOUR WORK is depth, and depth should be one door, not
seven.**

### 4 · Jess — spoonie, pacing is survival

**Wants prominent:** the VOC strip and any "the sky is quiet, rest is
legitimate" reading — the app's refusal to invent work is why she stays.
RhythmProgress's "occasional habits are never behind" is her favorite fact.
**Confusing/unnecessary:** HABITS "0 of 7 this week" in amber-adjacent
positioning on a flare day reads as reproach even though the cadence model
was built to avoid exactly this. The number is honest; the placement (upper
right column, every morning) is a scoreboard.
**Trips:** Day — on a bad day she opens Home and CompassNow says "Long run."
There is no cheap way to say "not today" — the loop has no snooze, so the
same instruction stands all day. Week — fine. Month — the check-in's
"What are you done carrying?" landed well; the kept card staying all cycle
is right for her.
**Verdict:** needs a "lighter day" gesture on CompassNow — one tap that says
today runs at half sail, and the hero respects it. (Product decision; the
chronotype/rhythm-risk plumbing exists server-side.)

### 5 · Amara — therapist, evaluating for clients

**Wants prominent:** exactly what's there now that the caution framing is
positive — she reads the Virgo void line ("precision is running high…") and
approves. The check-in ritual is the feature she'd assign to clients.
**Confusing/unnecessary:** A3 is a professional blocker: she cannot hand a
client an app that says "today is a new moon" three days late. The A1
contradiction reads to her like the app has two personalities.
**Trips:** Month — she'd notice the check-in depends on a hand-written block
per lunation (the September block doesn't exist yet). If the ritual silently
disappears next cycle, a client who built a practice on it is dropped.
**The curation bottleneck is a client-safety issue for her, not a
maintenance chore.**

### 6 · Kenji — program manager, go-live on the line

**Wants prominent:** THIS WEEK (committed) and CROPPING UP, in that order —
they're his Gantt's two missing rows. The committed-week fix (real
placements, no fake "open") happened to be his exact requirement.
**Confusing/unnecessary:** THE WATER AHEAD — fourteen unlabeled bars in
element colors mean nothing to him and sit right where his eye lands after
the week. CompassNow suggesting a task at 1 PM when his calendar owns 1 PM —
Home doesn't read Google Calendar (only the weaver does), so the hero can
contradict his actual meetings.
**Trips:** Day — hero-vs-calendar collisions. Week — none; Plan is his room.
Month — Cropping up's 45-day horizon covers his go-live; he'd want the
Mercury station note visible on the date he cares about, which it is. Kenji
retains.
**Verdict:** water-ahead is for the astro-fluent; Kenji would demote it below
Cropping up or collapse it.

### 7 · Ash — content creator

**Wants prominent:** whatever is screenshotable. Today's hero card (tide,
big type) lives on Today now; Home's CompassNow is typographically flat by
comparison. They'd screenshot the VOC strip if it looked like anything.
**Confusing/unnecessary:** none of it confuses them; it's just not *postable*.
**Trips:** Month — Studio remains the retention hook; Home is a corridor.
No Home changes for Ash except: the check-in's eclipse mark (the occultation
SVG) is the single most distinctive visual on the page and it's 24px.
**Verdict:** low-weight vote, but a real one: Home has no visual signature.
Sleek isn't only fewer modules; it's one memorable mark.

### 8 · Priya — 10-second mornings, phone

**Wants prominent:** CompassNow + habit check-off, both thumb-reachable.
**Confusing/unnecessary:** EVERYTHING about mobile Home as measured: columns
at 180px, truncated tasks, horizontal scroll, week strip unreadable. Her
10-second budget is spent panning a broken grid. **She cannot check off a
habit from Home at all** — RhythmProgress is deliberately read-only and the
chips in YOUR DAY are labels, not buttons; the check-off lives on Today
(TodayHabits) or Stars→Habits.
**Trips:** Day — the check-off she does every morning is two taps away from
the landing page; on mobile the grid bug adds a pan. Week/month — she
never sees them; she lives in the first fold.
**Verdict:** the mobile collapse is her whole review. Fix the grid, then
give the first fold a tappable habit row, and Priya is served in one fold.

### 9 · Sam — night shift

**Wants prominent:** the same as Priya plus times that respect her chronotype.
**Confusing/unnecessary:** CompassNow at 6 AM (her evening) suggests deep
work as she's winding down — the loop reads clock windows, and her inversion
is a chronotype question the hero doesn't consult. partOfDay labels
("this morning") are HER morning only by accident.
**Trips:** Day — the hero's confidence is miscalibrated for her twice a day.
Week — fine. Month — fine. She files Home under "pretty but off by twelve
hours" unless chronotype reaches the loop.
**Verdict:** known class of issue (chronotype-blind windows), now surfaced on
the landing page where it's most visible.

### 10 · Alex — no birth data

**Wants prominent:** what's there — Home is the best page in the app for
Alex because nothing on it needs a chart. Lines-up runs, VOC runs, almanac
runs, habits run.
**Confusing/unnecessary:** "Your chart agrees" badge never appears for them
(correct, no fabrication) — but nothing ever says the app is running in
no-chart mode, so they wonder what they're missing.
**Trips:** none specific to Home. The move-date pick lives in Plan and
worked without birth time. Alex retains and never knows they're the
architecture's best-served edge case.

### 11 · Marcus — founder, launch date

**Wants prominent:** CROPPING UP (he plans around stations now), THIS WEEK,
and the launch date itself once picked — same gap as Dan: **a chosen
election has no standing Home presence** once picked. It lives in Plan's
AlreadyWoven if within a week, else nowhere.
**Confusing/unnecessary:** WHAT LINES UP's secondary rows ("same window as…"
contention notes) — he reads them as the engine second-guessing itself
rather than honest contention labeling. Copy problem, not logic.
**Trips:** Month — he picked Sep 2 for launch; from Aug 20 he wants a
countdown-ish standing fact ("Launch: Sep 2, 13 days — Mercury goes direct
Sep 9, after"). The app knows all of this and shows none of it on Home.
**Verdict:** with Dan, makes two votes for a "committed dates" slot —
elections you accepted, rendered as standing facts.

### 12 · Maya — Co-Star refugee, phone-only

**Wants prominent:** one poetic true sentence and one tappable action; 15
seconds, most days.
**Confusing/unnecessary:** Home gives her thirteen modules and twelve doors
where Co-Star gave her one screen. She doesn't distrust it; she's just
tired. The mobile grid bug (Priya's) is her daily texture. The banner
nagging "Ten minutes to reset?" four mornings running (snooze resets daily
by design) trains her thumb to dismiss — and that thumb-training transfers
to every other banner the app will ever show.
**Trips:** Day 1 fine, day 4 the banner nag, day 9 she stops scrolling below
the first fold, day 23 the first fold alone decides retention. **On mobile
the first fold currently contains: a possibly-contradicted hero and a
possibly-false banner.**
**Verdict:** Maya's Home is the first fold. Everything below it is, for
her, server cost.

---

## Part C — The prominence tally

Votes for "top three modules," across the twelve:

| Module | Votes | Who |
|---|---|---|
| CompassNow (one answer, IF single-sourced) | 8 | Rachel, Priya, Sam, Maya, Jess, Alex, Dan*, Luna* |
| YOUR WORK (task list) | 7 | Dan, Rachel, Kenji, Marcus, Priya, Alex, Maya |
| THIS WEEK (committed) | 6 | Kenji, Marcus, Dan, Priya, Amara, Alex |
| CROPPING UP | 5 | Kenji, Marcus, Luna, Amara, Dan |
| HABITS (if tappable) | 4 | Priya, Maya, Jess, Sam |
| VOC strip / conditions | 4 | Jess, Amara, Luna, Alex |
| WHAT LINES UP (as evidence, not as a second hero) | 3 | Luna, Amara, Marcus |
| GUIDING STARS | 2 | Amara, Jess |
| THE WATER AHEAD | 1 | Luna |
| Turning-point banner (in window, honest copy) | 2 | Amara, Jess |

*Dan and Luna want CompassNow only if it stops disagreeing with the answer
card.

Reading the tally: **the consensus Home is five things** — one answer, the
work, the committed week, the fixed dates ahead, and habits-you-can-tap.
The water-ahead strip got one vote out of twelve. Guiding Stars' *progress*
got two (it matters monthly, not daily). What-lines-up's *evidence* is loved
by three but as depth-behind-the-answer, not as a second card.

---

## Part D — The trip ledger, day / week / month

Graded: **[copy]** string change · **[small]** contained code fix ·
**[design]** needs the owner's call.

### Across a day

| # | Trip | Fix | Grade |
|---|------|-----|-------|
| D1 | Two "what now" answers can disagree (A1) | One hero. CompassNow keeps the slot; WHAT LINES UP stops rendering its own lead when it matches the loop's `now` (the linesUp payload already links them by heldId) and becomes the evidence panel behind "Why this? →". Two engines stay; one voice speaks. | design |
| D2 | One habit × four sightings (A2) | DayAhead drops its habit chips (a habit isn't "on the day" until placed); CompassNow and HABITS each keep their altitude. | small |
| D3 | Mobile grid never collapses; horizontal scroll | Stack the work grid below 768px, same as the horizon row already does. | small |
| D4 | "already scheduled" repeated on every scheduled row | Say it once as a group label ("Scheduled · 3") instead of per-row. | small |
| D5 | Habit check-off absent from the landing page | Make RhythmProgress rows tappable for *today only* (the week figures stay read-only). Revisits the read-only rule — the rule was "no doing on Home," but a check-off is a tally mark, not a workflow. | design |
| D6 | Hero can contradict Google Calendar (Kenji) | Loop consults gcal busy blocks before naming a time (weaver already fetches them). | design |
| D7 | 2.4s cold "Reading the sky…" on the answer | Measure on prod first (dev+cold scratch server inflates); if real, cache lines-up per (tester, day-quarter) server-side. | small |
| D8 | Twelve doors, ten verb patterns | One verb rule: doors that LEAVE Home read "Open X →"; in-place reveals read "Show/Hide". Kill "Weave the week in Plan →" (→"Open Plan →"), "Plan around these →" (→"Open Plan →"), "Find a time for something else" (dedupe with "Find another activity"). | copy |

### Across a week

| # | Trip | Fix | Grade |
|---|------|-----|-------|
| W1 | Sunday review renders on Today; Home-landers never meet it | The notice queue on Home already ranks by rarity; let the Sunday review claim that slot on Sundays (it outranks nothing else weekly). | design |
| W2 | The chosen election has no standing presence (Dan, Marcus) | A "Committed" line in THIS WEEK's card footer for accepted elections beyond 7 days: date + title + one condition note. Two personas independently asked. | design |
| W3 | Water-ahead bars unreadable to 11 of 12 | Either label the bars (day quality word on tap exists — surface it) or collapse the strip behind Cropping up. One vote of twelve says its current prominence is unearned. | design |

### Across a month

| # | Trip | Fix | Grade |
|---|------|-----|-------|
| M1 | "Today is a new moon" shown 3 days late (A3) | Day-aware line: day 0 keeps the sentence; days 1+ get "This cycle opened with a new moon and solar eclipse in Leo." The date is already computed (`moonCycle.cycleStart`). | copy |
| M2 | Banner re-nags daily for 5 days; trains dismissal (Maya) | After two "Not now"s, shrink to a one-line text link for the window's remainder. Preserves the ritual without the nag. | small |
| M3 | Check-in vanishes next cycle unless the owner writes a block (Amara) | Standing risk, by design (b8bdac7 makes it stand down honestly). Needs either a September block written before Sep 11 or a generic fallback block that asks the three questions without the curated read. | design + owner |
| M4 | Rail's "resonant now" reads `cultivations`, a table the UI can't populate | Product decision pending (flagged 2026-08-15): finish the habits merge and point it at habits' timing, or delete the readers. | design |
| M5 | Density toggle sits at the bottom of the context column; nobody found it in any study | Move next to the section it actually affects, or retire on Home (Home is close to essential-only already). | small |

---

## Part E — What "sleek" cashes out to

Not a redesign. Four moves, in order of leverage:

1. **One voice per fact.** D1 + D2 + A3 are the same disease: the page says
   one thing several ways and eventually says it two different ways. The
   repo already has this rule ("one fact, one source") — Home just predates
   its enforcement. Merging the hero and demoting duplicates removes ~700px
   and the only two contradictions on the page.

2. **The five-module consensus.** CompassNow · YOUR WORK · THIS WEEK ·
   CROPPING UP · HABITS. Everything else earns its render conditionally
   (VOC when void, notices in window, log when engaged) or lives behind one
   "more" — including the water-ahead strip and the evidence panel.

3. **The first fold IS mobile Home.** Fix D3, then treat the phone's first
   fold as the product: hero + one tappable habit row + capture. Maya and
   Priya — the two retention-risk personas — never scroll.

4. **One door verb.** Twelve arrows with ten phrasings read as clutter even
   when the modules don't. A door audit is a morning of copy work and it is
   the cheapest sleekness in this document.

What this study deliberately does NOT recommend: hiding the astrology.
Jess, Amara, Luna, and Alex all stay BECAUSE the conditions layer is honest
and present. The sleekness problem is repetition and door sprawl, not the
sky.

---

## Changed since this study's snapshot

- D3 (mobile grid) and M1 (stale banner line) were fixed the same day this
  was written — they were unambiguous.
- The owner ratified the six headline calls the same day; D1, D5, W2, M2, M3
  and D8 shipped in `d408a9d`. Still open from the ledger: D2 (DayAhead's
  habit chips), D4 ("already scheduled" per row), D6 (the hero consulting
  Google Calendar), D7 (cold-load latency, to be measured on prod), W1
  (Sunday review on Home), W3 (the water-ahead strip's prominence), M5 (the
  density toggle), and M4 (the cultivations decision).
