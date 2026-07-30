# The email study — 2026-07-30 · THE PERSONA-ENCOUNTER PASS

*"It was nice, but far from helpful."* — the owner, on receiving a real daily
report this morning.

This study takes that verdict seriously and asks the only question that
matters for an email product: **on which morning does each person stop
opening it, and what would that specific morning's email have had to say to
survive?**

**The data.** 30 consecutive daily reports plus one weekly and one New Moon
report, produced by stubbing the clock and calling the real composers
(`artifacts/api-server/src/routes/reports.ts` — `composeDay` :79,
`composeWeek` :176, `composeNewMoon` :297) against the owner's actual
subscribed profile. Output at `/tmp/sim30.json`. Every line quoted below is
verbatim from that run. Dates run **Thu 2026-07-30 → Fri 2026-08-28**.

**Method honesty.** These are simulations, not interviews. The persona cast is
reused from `USER-SIMULATIONS-2026-07-29-MONTH.md` and
`PAYING-PERSONAS-2026-07-29.md` so the behaviour claims inherit those studies'
grounding. What is *not* simulated is the email text — that is real output, and
every structural claim about it was counted, not intuited.

---

## Part 0 — What the corpus is, before anyone reads it

### 0.1 Established (owner's pass, not re-derived)

- **0/30 days name a single task. 0/30 mention a due date.** The composer
  imports `planningWindows, goals` and **never imports `tasks`**
  (`reports.ts:18`). The person's actual work is not in the email's world.
- **"Toward your stars" fires 30/30; 23/30 print the same discouraging
  sentence** — *"'aligned spine' runs on earth energy; today leans [x]. A
  lighter supporting step fits better than a hard push."* One earth-tagged
  star against four elements makes ~75% mismatch structurally guaranteed
  (`reports.ts:150-160`).
- **16 of 29 consecutive day-pairs share an identical subject line;
  12 unique subjects across 30 days.** The Moon holds a sign ~2.5 days and the
  subject is derived from it (`reports.ts:170`).
- **"The long weather" is 2 sentences for the whole month**, both ending
  *"A slow background — not today's task."*
- **The lead contradicts itself** — opens "A water day…" then "A Taurus Moon."
- **"A Aquarius Moon" 7/30.**
- **"Key moments today" proposes generic activities**, most often deep rest.

### 0.2 New, counted this pass

**① The "best window" is a restatement of the first "Lean into" line — 30/30.**
`reports.ts:141` runs the election engine on `fav[0].key`, i.e. the top
favoured activity, which is also `Lean into` line 1. So "Key moments today"
never adds information; it adds a clock time to something already said 40
words earlier. **Two blocks, one fact, every single day.**

**② The window has already opened when the email lands, 7/30 days.** Default
`sendHour` is 7 (`emailSubscriptions.ts:13`). Windows opening at or before
08:00: Aug 7 (**7:09 AM**, "for the hard conversation"), Aug 10 (7:11), Aug 11
(7:12), Aug 15 (7 AM), Aug 16 (7:16), Aug 21 (7 AM), Aug 26 (7 AM). On Aug 7
the email arrives and says you have nine minutes to start the hard
conversation.

**③ On void days the same fact is stated 4–6 times in one ~229-word email.**
Aug 15 is the worst, at six: "In the sky's shape" (*"The day's initiations
won't take — finish, rest, review; begin nothing you want to last"*), "Lean
into" ×2 (*"Organize / declutter — Clearing suits the void and the waning
moon"*, *"Deep clean — Removal work — the waning moon and even the void carry
it"*), "Ease off" (*"launching, buying, or publishing — the Moon is void;
begin nothing you want to last"*), and "Key moments" ×2 (*"Best window — 7
AM–10:20 AM for organize / declutter (void of course)"* and *"The Moon goes
void of course today — slack water"*). Aug 10: 5. Jul 31, Aug 14, Aug 24,
Aug 27: 4 each — and on Aug 24 and Aug 27 the clause **"begin nothing you want
to last" appears three times verbatim** in the same email, having also opened
it (*"Though the Moon is void of course — slack water; begin nothing you want
to last (watch beginning something you want to last)"*).

**④ 38 unique "Lean into" lines fill 90 slots.** The gloss is a constant per
activity, so *"Meet new people / network — Eleventh-house weather: friends you
haven't met."* arrives 6 times, *"Deep rest / nap — Slack water is real rest —
the void is for this."* 6 times, *"Repair / reconcile…"* 5 times, verbatim.

**⑤ "Hold the day's shape loosely there." — 30/30, as a fixed tail.** The
caution clause varies (29 distinct openers) and then always terminates in the
same seven words. A daily reader learns to stop reading at the em-dash.

**⑥ Element contradiction is worse than 15/30 — it is 21/30** on a strict
recount (lead line 1's declared element vs. lead line 2's Moon sign element).
Line 1 is `cap(reading.flavour)` from the synthesis engine (which folds in
natal contacts); line 2 is the raw sign. They are two different questions
printed as one paragraph.

**⑦ The weekly report contradicts the daily report for the same date.**
- Weekly: *"Thu, Jul 30 — **A fire day** — courage and initiative to spend."*
  Daily for Jul 30: *"**An air day** — perception and perspective to spend."*
- Weekly: *"Fri, Jul 31 — **Pisces Moon**, Venus day."* Daily for Jul 31:
  *"A **Aquarius** Moon on Friday."*
- Weekly: *"Keep light / rest — **Sun** (Moon void)."* The daily that flags a
  void that week is **Fri Jul 31**; the Aug 2 daily mentions no void.
- Cause, verified: `composeWeek` calls `dayReading(noonDate, …, { scope:
  "day" })` **with no `natal` and no `ascRuler`** (`reports.ts:198-199`),
  while `composeDay` passes both (`reports.ts:99-104`); and the weekly samples
  the sky at *local noon* (`localNoonJd`, :44) while the daily samples at
  *send time* (`julianDay(now)`, :80). Two composers, two skies.
- Consequence of the missing natal: **"A fire day — courage and initiative to
  spend" is printed for 6 of the weekly's 7 day-lines.** The week ahead reads
  as one undifferentiated day repeated.

**⑧ The weekly's "standout days" nominate the day you are reading it.**
*"Deep focus — **Thu**: best for learn a new skill"* — Thu is send day.
`restDay` falls back to `perDay[0]` when no void exists (`reports.ts:212`), so
"keep light / rest" also defaults to today. A *week-ahead* email whose
headline recommendation is *today* has no forward function.

**⑨ Block census across 30 days:** lead 30, `Lean into` 30, `Ease off` 30,
`Key moments today` 30, `Toward your stars` 30, `The long weather` 30, `In the
sky's shape` 23. Median 229 words, range 187–266. **Six to seven blocks, every
day, at identical length, with the same headings in the same order.** There is
no visual signal anywhere in the corpus that distinguishes an ordinary Tuesday
from the New Moon.

**⑩ What the email never contains, and the app has:** a task title, a due
date, an overdue count, a habit name, a habit's `minimumViable`, a streak, a
win from yesterday, a felt rating, an intention, a milestone `targetDate`, a
project, the word "you did", or any number derived from the reader's own
history. `tasks`, `habits`, `habitLogs`, `wins`, `intentions`, `milestones`,
`dailyCheckIns` — seven tables of the person — are untouched by
`reports.ts`.

---

## Part 1 — Eight persona encounters

Anchor days for all eight: **D1 = Thu Jul 30 · D3 = Sat Aug 1 · D7 = Wed
Aug 5 · D14 = Wed Aug 12 · D30 = Fri Aug 28.**

For orientation, those five mornings as sent:

| | Subject | Top "Lean into" | "Best window" | "Toward your stars" |
|---|---|---|---|---|
| D1 | Aquarius Moon — systems thinking, the unconventional approach | Learn a new skill | 10:38–11:50 AM | mismatch (air) |
| D3 | Pisces Moon — make art from feeling, meditate and drift | Deep rest / nap | 9:50 AM–2:50 PM | mismatch (water) |
| D7 | Taurus Moon — finish and polish, cook well and provision | Budget & ledger | 8:18–9:29 AM | **match (earth)** |
| D14 | Virgo Moon — edit and refine, organize the system | Plan & strategize | 1–2:10 PM | **match (earth)** |
| D30 | Pisces Moon — make art from feeling, meditate and drift | Repair / reconcile | 8:31–9:38 AM | mismatch (water) |

Note that D30's subject is **identical to D3's**, 27 days apart. Gmail will
thread them.

---

### 1 · Rachel, 33 — freelance product designer, ADHD

*Three client deliverables and an overdue portfolio relaunch; rent depends on
invoicing this month. The MONTH study lost her in week 3 — mechanically, not
preferentially.*

**D1 (Thu Jul 30, 07:00).** Opens it in bed. This is the best-case morning:
novelty plus a real need. She reads the lead — *"An air day — perception and
perspective to spend, carried by a Aquarius Moon"* — and the "A Aquarius"
registers as a typo, which for an ADHD reader is a small credibility tax paid
before any value is delivered. Then: *"Learn a new skill — Mercury gathers,
Jupiter gives it somewhere to go."* She has three deliverables. She is not
learning a new skill today. Then *"Best window — 10:38 AM–11:50 AM for learn a
new skill."* Then: *"'aligned spine' runs on earth energy; today leans air. A
lighter supporting step fits better than a hard push."*

She has an overdue portfolio relaunch and the app's response to her one stated
goal is **don't push today**. She closes it. Net behaviour change: zero. She
does not resent it — it was pretty. That is the failure mode.

**D3 (Sat Aug 1).** Subject: *"Pisces Moon — make art from feeling, meditate
and drift."* Opens on the sofa. *"Deep rest / nap — Slack water is real rest —
the void is for this."* On a Saturday when she is behind. *"Best window — 9:50
AM–2:50 PM for deep rest / nap."* **A five-hour nap window is the single
concrete recommendation of the day.** For a freelancer whose rent depends on
invoicing, this is the email actively arguing against her interests with high
production values. Still opens; slight sourness.

**D7 (Wed Aug 5).** This is the good one and she doesn't see it. Subject
*"Taurus Moon — finish and polish, cook well and provision."* Inside, for the
first time in a week: *"Today's earth current suits 'aligned spine.' A window
for budget & ledger moves it forward — one step counts double."* This is the
sentence the whole feature exists for. But it is **block five of six**, below
a "Lean into" list whose first item is *"Budget & ledger — Review money under
Rx happily; just don't commit it"* — and she has already learned in six days
that nothing below the fold changes. She skims to the subject line's promise
("finish and polish"), thinks *good, a finishing day*, and does not scroll.
**The best morning of the month is invisible because it looks exactly like the
worst one.**

**D14 (Wed Aug 12).** She has stopped opening. Not deleting — the email is
still arriving and it is still nice-looking, so it accumulates. Gmail has
begun threading the repeats. The Aug 11/12 pair both read *"Leo Moon —
perform, present, publish, creative play"*; Aug 13/14/15 all read *"Virgo Moon
— edit and refine, organize the system"*. A threaded conversation titled
"Virgo Moon" with 3 unread is indistinguishable from a newsletter she meant to
cancel. Open rate for the week: 1 of 7.

**D30 (Fri Aug 28).** Subject *"Pisces Moon — make art from feeling, meditate
and drift"* — she has seen this exact subject before (Aug 1, Aug 2). She does
not open. Two weeks later, cleaning her inbox on a bad day, she filters
Compass to a label. **She never unsubscribes**, which is worse: the owner's
metrics will read "still subscribed."

**Kill point:** D3, when the email recommended a five-hour nap to someone
behind on rent. **Confirmed dead:** D14, when repeated subjects made the
thread indistinguishable from spam.

---

### 2 · Jess, 26 — chronic illness, spoonie

*Pacing is survival, not productivity. Flare cycle mid-month. In the MONTH
study she received the app's single highest-value sentence: "Your most aligned
days have been Deep Tide (71% aligned, 7 logged)."*

**D1.** She is the one persona for whom the current email is *close*. The
permission register is native to her. But D1's content is *"Learn a new
skill"*, *"Meet new people / network"*, *"Plan & strategize"* — three high-cost
activities and no low-cost one. And the caution line — *"Though Mars meets
your core self (2.0°) — pressure on your core self; watch impatience, a short
fuse"* — is a body claim she can't check against her body until 4pm.

**D3 (Sat Aug 1).** *"Deep rest / nap — Slack water is real rest — the void is
for this."* Best window 9:50 AM–2:50 PM for it. **This is the best email any
persona receives all month, and it is an accident** — it is the same
rest-defaulting behaviour that insulted Rachel. She screenshots it. She rests
without guilt. Real value delivered.

**D7 (Wed Aug 5).** Fine. *"Finish & ship the last 10%"*, *"Ease off — rushing
or pivoting."* Neutral.

**D14 (Wed Aug 12).** She is three days into the flare that started around
Aug 9. She has logged `dailyCheckIns` with low energy for four consecutive
days and rated three of them Off. The email that morning: *"A fire day —
courage and initiative to spend"*, *"Hard training — Mars work — give the
force a worthy target"* (Aug 11), and on the 12th *"Teach / present"*,
*"Publish / release"*, *"Apply / submit"*, and *"Ease off — quiet background
work — the day asks to be seen."*

**The app is telling a woman in a flare that the day asks to be seen, on the
fourth morning after she told the app she has nothing.** It knows. The
`dailyCheckIns` rows exist. `reports.ts` does not read them. This is the
sharpest failure in the corpus: not that the email is generic, but that the
email is *generically loud* on the exact days the in-app product would have
been kind. The app's proudest architectural commitment — the tide as a
permission structure — is inverted the moment it leaves the app.

**D30.** She has moved the daily to a folder and kept the New Moon report,
which is the only one whose cadence matches her body. She'd pay $4–5/mo for
the app. She would not pay a cent for the email as-is.

**Kill point:** D14, the flare mismatch. **Survives as:** New-Moon-only.

---

### 3 · Dan, 41 — HVAC contractor, zero astrology, wife re-sent the link

*The biggest commercial bid of his year. Subscribed because his wife typed his
email into Settings.*

**D1.** Subject: *"Aquarius Moon — systems thinking, the unconventional
approach."* He does not open it. There is no version of his morning in which
that subject beats a supplier email.

**D3.** Doesn't open.

**D7 (Wed Aug 5).** His wife says "did you see the good day thing." He opens
Aug 5 out of politeness. He reads three sentences: *"An earth day —
groundedness and follow-through to spend"* — fine, that's a fishing report,
he's OK with it — then *"Though Moon grinds against Jupiter (3.1° applying) —
friction around growth and the bigger frame (watch overreach, glossing the
detail)."* **Degrees.** In an email. To a man who wanted to know whether to
pour on Thursday. He closes it.

**D14.** Unopened. He notices the sender name in his promotions tab.

**D18 (Aug 18), the moment that decides it.** The email's key moment that day:
*"Best window — 8:26 AM–9:34 AM for intimacy & sex (Venus hour)."* He sees the
preview text on his lock screen at a job site. He shows it to his crew as a
joke. **This is the churn event and it is also a brand event** — the email
proposing scheduled sex at 8:26 on a Tuesday morning, unprompted, to a
subscriber who has never told the app anything about himself, is the whole
"nice, not helpful" problem in one line. It unsubscribes him and it makes the
product a punchline in a van.

**D30.** Unsubscribed on ~D18. The one thing that worked for him in the MONTH
study — Begin's plain verdict for a real decision — never appears in an email
at all.

**Kill point:** D18. **Root cause:** the email has no register control. There
is no `astroDetail` gate anywhere in `reports.ts` — `astroReveal()`
(`lib/preferences.ts:59-71`) is consumed at three client sites and zero server
ones. **A user on "minimal" gets degrees, hour rulers, and Venus-hour sex
recommendations in their inbox.**

---

### 4 · Imani, 34 — somatic coach & breathwork facilitator

*12 retainer clients, a monthly $65 workshop, a twice-yearly retreat. She
already schedules new-moon circles by the moon. $99/yr buyer; $300–540 with a
practitioner tier.*

**D1.** Opens immediately — this is her professional register. She likes the
voice. *"warm fog on slack water"* (D3) is genuinely better writing than
anything in her lunar-calendar app. She forwards D1 to nobody, because there
is nothing in it she could put her name on.

**D3–D7.** She's reading it as *supply*, not as guidance. What she wants from
it: which two days in the next fortnight should hold the August workshop. The
email cannot answer that, because it is a day-scoped instrument sent daily —
she'd have to open, remember, and hand-collate 14 of them. The **weekly**
could answer it, and does not: it prints *"A fire day — courage and initiative
to spend"* for six of seven days and nominates **Thursday, the send day**, as
the standout.

**D14.** She's opening 3 of 7. The New Moon report (Aug 11) is the one she
keeps: *"A Leo cycle favors — Perform, present, publish / Creative play / Host
generously / Romance and delight"* plus the cycle's dated turning points
(*"Tue, Aug 18 — First Quarter"*, *"Wed, Aug 26 — Full Moon in Aquarius"*).
That is a programming calendar, and it is the only forward-looking artifact in
the whole corpus. It arrives once a month.

**D30.** Daily filtered. Weekly filtered. New Moon kept and *screenshotted for
Instagram* — which is the app's actual growth loop happening by accident in
the wrong channel, unbranded and uninstrumented.

**Kill point:** she never had one; she quietly downgrades to New-Moon-only by
D10. **The cost:** the persona with the highest willingness to pay and the
largest downstream audience uses 1 of 32 sends.

---

### 5 · Priya, 34 — mother of a toddler, first month back at work

*Every morning is a 10-second budget: 07:10–07:25, on a phone, one-handed.*

**D1, 07:00.** The email lands 10 minutes before her window opens. She sees
the preview: *"Aquarius Moon — systems thinking, the unconventiona…"*.
Doesn't open — that is not a 10-second proposition, and the preview text gives
her no reason to believe it will be.

**D3 (Sat).** Opens on a Saturday, has 40 seconds. 229 words, six blocks. She
gets to *"Deep rest / nap"* and laughs.

**D7 (Wed Aug 5).** Opens on the commute, 07:14. The email's best-window
recommendation is *"8:18 AM–9:29 AM for budget & ledger."* She is in a car,
then in a meeting. Every one of the month's 30 best windows falls between
07:00 and 20:43; **25 of 30 fall in the 07:00–11:00 block**, which is her
least available time of the entire day and which the app *already knows*
because it collected her chronotype and could know from `planningWindows` if
anything were ever written there.

**D14.** Not opening. Her pattern from the MONTH study repeats exactly: real
affection for the product, zero loop closure, because every surface assumes
availability at the hours she has least of it.

**D30.** In a folder. The honest read: **the daily email is a
desktop-length artifact delivered to a phone-length attention span.** Its
median 229 words is roughly 6× what she can spend.

**Kill point:** D1, on preview text alone. She is the persona who never opens
enough to have a real kill point, which makes the *subject line* the entire
product for her.

---

### 6 · Marcus, 38 — bootstrapped founder, launching this month

*Must pick a launch date in week 1 and defend it to a cofounder. In the MONTH
study, the Begin → receipts → calendar → Ask chain was the app's best composed
journey.*

**D1.** Opens. Scans for anything date-shaped. Finds: *"Plan & strategize —
Saturn frames, Jupiter aims — a New-Moon matter by nature."* No dates. No
"here is your launch window." He has an election saved in the app — the
`planningWindows` row exists, and `composeDay` **does** read
`planningWindows` for today only (`reports.ts:128-137`). His window is on
day 11. So it appears in exactly one of thirty emails, on the day it happens,
with no lead time.

**D3–D7.** Opens twice more, looking for lead time. The email has no concept
of *ahead*. The word "tomorrow" appears in the corpus exactly 7 times, always
in the same boilerplate: *"save what you want to last for tomorrow."*

**D14 (Wed Aug 12).** Post-launch. He is now deciding whether to announce v2
pricing. The email says *"Publish / release — The release is what Rx disrupts
— draft under it, ship after it."* **This is the single most useful sentence
he receives all month** — it names a real constraint on a real decision. It is
buried as "Lean into" line 2, undated, with no station date, no "you have a
window on the 21st," no link to Begin. In-app the same engine gives him
*"Mercury is retrograde — the tradition blocks this outright; wait for the
direct station"* with a date. The email launders the app's sharpest asset into
a suggestion.

**D30.** Opens ~1 in 5, purely to scan for refusals. He'd read a "**heads up:
a genuinely notable day is coming**" email forever and never read a daily.

**Kill point:** no kill, but no habit either — he degrades to a scanner.
**The loss:** the email never carries the one thing that converted him.

---

### 7 · Sam, 29 — night-shift nurse, 19:00–07:00 rotation

*Wake 16:00, sleep 08:30. Has told the app her chronotype. Interview on day 18
— her exit from nights.*

**D1, 07:00.** The email arrives 90 minutes before she goes to sleep, at the
end of a twelve-hour shift. It is titled with the day that is beginning for
everyone else and ending for her. Its "Key moments today" window is
10:38–11:50 AM. **She will be asleep for all thirty of the month's best
windows** except Aug 17's *"7:51 PM–8:43 PM for a date."*

The clock is not a rounding error here: `sendHour` (`emailSubscriptions.ts:13`)
is a stored integer she could in principle change, but nothing in the email or
Settings connects it to the chronotype the app collected, and `composeDay`
computes "today" from `localDate(tz)` — wall clock, not her day-start. It is
the same phase-shift bug the MONTH study found in `RitualCard`
(`Today.tsx:773-774`), now reproduced in a second channel.

**D3.** Reads it in bed, as a bedtime story. Genuinely enjoys *"warm fog on
slack water."* Actions taken: none possible.

**D7.** Skims.

**D14.** Stopped.

**D18 — her interview.** The day she needed the product most. The email that
morning (Aug 16, Sun): *"Best window — 7:16 AM–8:25 AM for negotiate / ask for
more (Venus hour)"* — she is asleep — and *"Apply / submit — The document is
Mercury's; your visibility is the Sun's."* The correct email for her that
morning existed in the app: the election engine gave her a Sun-hour window
before the interview in the MONTH study. It never reached her inbox, because
the email doesn't know about her interview (it's a `task` with a `dueDate`)
and doesn't know when her day starts.

**Kill point:** D7, silently. **Root cause:** one field —
send-time-vs-day-start — and one join — `tasks.dueDate`.

---

### 8 · Maya, 27 — Co-Star refugee, phone-only, casual

*Competes with a TikTok scroll, not with a tool. In the MONTH study, push was
her only retention mechanic and it was dead.*

**D1.** Opens. Enjoys it. Screenshots the subject line to her close-friends
story because *"Aquarius Moon — systems thinking, the unconventional
approach"* is a good caption. **This is the highest-value thing the email does
for her and it happens once.**

**D3.** Opens. *"Pisces Moon — make art from feeling, meditate and drift"*
also makes a good caption, but she's not going to post two.

**D7.** Doesn't open. The Aug 5/6 pair are the same subject; so are Aug 3/4.
By day 7 she has received 7 emails and seen 5 distinct subjects, all of the
same grammatical shape. Her brain has correctly classified the sender as a
horoscope newsletter, and horoscope newsletters are a genre she scrolls past
in a feed, not a thing she opens in a mailbox.

**D14.** Zero opens for a week.

**D30.** The Aug 28 subject is byte-identical to Aug 1's. If she happened to
look, the thread would show her the same title she read four weeks ago. She
unsubscribes on a Sunday inbox purge — the fastest, quietest churn in the
roster, and the only one that will show up in the metrics.

**Kill point:** D7, on genre classification. **The insight she generates:**
her one real value moment was the subject line *as shareable text*. The
subject is doing content-marketing work and retention work at once, and it is
currently optimised for neither.

---

### Encounter summary

| Persona | Opens D1 | Opens D7 | Opens D14 | Opens D30 | Terminal state | Kill point |
|---|---|---|---|---|---|---|
| Rachel (ADHD) | ✓ | ✓ (skims) | 1/7 | ✗ | filtered | D3 nap window |
| Jess (spoonie) | ✓ | ✓ | ✓ | ✗ daily / ✓ NM | New-Moon only | D14 flare mismatch |
| Dan (skeptic) | ✗ | ✓ once | ✗ | — | **unsubscribed ~D18** | D18 "intimacy & sex" |
| Imani (coach) | ✓ | ~ | 3/7 | ✗ daily / ✓ NM | New-Moon only | D10 drift |
| Priya (parent) | ✗ | ✓ once | ✗ | ✗ | filtered | D1 preview text |
| Marcus (founder) | ✓ | ✓ | ~ | ~1/5 | scanner | none — never a habit |
| Sam (night shift) | ✓ | ~ | ✗ | ✗ | dead | D7, phase-shift |
| Maya (casual) | ✓ | ✗ | ✗ | ✗ | **unsubscribed ~D28** | D7 genre classification |

**2 unsubscribes, 3 filters, 2 downgrades-to-lunar, 1 scanner. Zero daily
habits formed out of eight.** The two unsubscribes are the *only* signal the
owner would currently see; the six quiet deaths are invisible, because there
is no open/click instrumentation on the email at all (`lib/analytics.ts` has
11 events, none of them email).

---

## Part 2 — The counterfactual: what the same morning had to say

The rule for every rewrite below: **it uses only data the app already stores.**
Table and column named for each. No new engine, no LLM, no new user input.

Available and currently unused by `reports.ts`:
`tasks.title/dueDate/originalDueDate/planet/estMinutes/energy/goalId` ·
`habits.name/cadence/targetPerWeek/minimumViable/favoredElements/favoredPlanets/solarAnchor` ·
`habitLogs.date` · `wins.text/date/goalId` · `intentions.text/cycleStart` ·
`milestones.title/targetDate/status` · `dailyCheckIns.energy/mood/focus/pain/behaviorTags` ·
`planningWindows.title/startTime/completedAt` ·
`goals.planet/activityKey/anchorUntil` · `testerProfile` chronotype ·
`computeElections({ activityKey })` — already called, just on the wrong key.

---

### Rachel — D3, Sat Aug 1

**Sent:**
> Deep rest / nap — Slack water is real rest — the void is for this.
> Best window — 9:50 AM–2:50 PM for deep rest / nap.
> "aligned spine" runs on earth energy; today leans water. A lighter
> supporting step fits better than a hard push.

**Should have been:**
> **Two things are due Monday: "Hartley deck v2" and "invoice Q3."**
> Today's water tide won't carry a hard push — but the deck's *first pass* is
> a Moon-and-Venus job, and 9:50–2:50 is the softest, longest window you'll
> get this week. Draft it badly on purpose; Monday's Taurus tide is the one
> that finishes things.
> *One 25-minute block is a win. Yesterday you logged none — that's fine, it
> was a Friday.*

Sources: `tasks.title` + `tasks.dueDate` (two rows due Aug 3) ·
`tasks.estMinutes` (25) · `computeElections` on the task's own
`planet`/`bestWindowType` rather than `fav[0].key` · the Aug 5 forecast the
weekly composer already computes · `planningWindows.completedAt` for the
"none yesterday" line.

**Why it works:** it names her deliverable, it *keeps* the astrological
reasoning (the water tide really is bad for the hard push) but converts it
from a refusal into a **reassignment**, and it moves the goal from
"don't push" to "do the version of it this day supports."

### Rachel — D7, Wed Aug 5 (the wasted good day)

**Sent (block 5 of 6):**
> Today's earth current suits "aligned spine." A window for budget & ledger
> moves it forward — one step counts double.

**Should have been the subject line and the first sentence:**
> **Subject: The earth day you've been waiting for — 8:18am, "Hartley deck"**
> This is one of 7 earth days in the next 30, and "aligned spine" runs on
> earth. Your two oldest open tasks — "Hartley deck v2" (carried from Fri)
> and "portfolio: pick 6 projects" (carried from Jul 22) — are both
> finish-work, and finish-work is exactly what this tide does.
> **8:18–9:29am is the window. Pick one.**

Sources: `tasks.originalDueDate` — the column that exists specifically so the
app can say *"carried from Fri"* without accusation, and which no email has
ever used · a 30-day scan of `SIGN_GUIDE[moonSign].element` for the "7 of 30"
scarcity number · `goals.element` match.

**Why it works:** scarcity ("7 of 30") converts a match from a nice fact into
a reason to act today, and it is computed from data the weekly composer
already loops over.

---

### Jess — D14, Wed Aug 12 (the flare)

**Sent:**
> A fire day — courage and initiative to spend…
> Teach / present · Publish / release · Apply / submit
> Ease off — quiet background work — the day asks to be seen.

**Should have been:**
> **Four low days logged in a row. The sky is loud today; you don't have to
> be.**
> Your minimum for "morning mobility" is *two stretches in bed* — that counts
> and the streak holds. Nothing else is due until Friday
> ("PT appointment", Aug 14).
> *For when it lifts: your best-rated days this month have been water days.
> Two of the next five are — Aug 18 and Aug 19.*

Sources: `dailyCheckIns.energy` × 4 consecutive rows (the flare is already in
the database) · `habits.minimumViable` — a column written expressly for this
sentence, never used outside the app · `habits.cadence` for the
streak-holds promise · `tasks.dueDate` · `dailyCheckIns` joined to the day's
element for the felt-pattern line, which is currently `localStorage`-only
(`Today.tsx:1537-1556`) and is the highest-value sentence in the entire
product.

**Why it works:** it inverts the failure. The same sky ("a fire day, the day
asks to be seen") is reported as *context she can decline*, not as an
instruction. And it does the one thing no other app does for her: it tells her
which of the coming days her own body has historically liked.

---

### Dan — D18, Tue Aug 18

**Sent:**
> Best window — 8:26 AM–9:34 AM for intimacy & sex (Venus hour).

**Should have been (and for him, should be the *only* email he gets, roughly
twice a month):**
> **Subject: Thu the 20th is your day to pour**
> You marked "start site work — Calloway bid" as flexible between the 18th
> and the 24th. Of those seven days, **Thursday the 20th is the strongest**:
> settled weather in the working sense the old almanacs meant, no
> begin-nothing spell, and a clear morning.
> Avoid Monday the 24th — it's the one day this week the tradition says don't
> start anything you want to last.
> *Reply STOP to stop these. You'll get about two a month.*

Sources: `planningWindows` or an election saved via Begin · `voidOfCourse` ·
`computeElections` — the entire chain exists. What is missing is (a) an email
that triggers on an *event* rather than a calendar tick, and (b) a
register gate: **`astroReveal()` must run server-side.** With `astroDetail:
"minimal"`, no degrees, no planet names, no hour rulers, no "Venus hour," and
categorically no intimacy recommendations.

---

### Imani — D1 and the weekly

**Sent (weekly):**
> Thu, Jul 30 — A fire day… Fri, Jul 31 — A fire day… Sat, Aug 1 — A fire
> day… [×6]
> Deep focus — Thu: best for learn a new skill.

**Should have been:**
> **Subject: Two good days for the August circle — the 13th and the 23rd**
> Of the next 21 evenings, two carry a gathering cleanly: **Thu Aug 13**
> (waxing, precise, good for a taught session) and **Sun Aug 23** (waxing
> gibbous, warm, good for a full room). Both are clear of begin-nothing
> spells.
> Avoid Aug 15 and Aug 24 for anything you want people to commit to.
> Your last circle was Jul 12 — a waxing Wednesday. It's the same shape.
> → *Hold Aug 13 · Hold Aug 23 · See the whole month*

Sources: `bestFor(sky, cats)` already computes exactly this and is already
called by `composeWeek` — it is simply run over 7 days instead of 21, and
reports the send day · `voidOfCourse` over the span ·
`planningWindows.completedAt` for "your last circle was Jul 12."

**Why it works:** her job is choosing two dates a month, and the app can
already choose them. The gap is span (7 → 21+) and framing (day-by-day
narration → a shortlist with holds).

---

### Priya — D7, Wed Aug 5, read at 07:14 in a car

**Sent:** 229 words, six blocks, best window 8:18–9:29 AM.

**Should have been, in full:**
> **Subject: 1 due today · your good hour is 8:20**
> "Nursery forms" is due today. It's a 15-minute job and the tide is behind
> finish-work — 8:18–9:29 is the clean stretch.
> Everything else can wait.

Twenty-nine words. Sources: `tasks.dueDate = today` · `tasks.estMinutes` ·
the same election call already being made. **And a second rule for her:
`sendHour` should follow her observed open time, not a default of 7** — the
column exists (`emailSubscriptions.sendHour`), nothing writes to it from
behaviour.

**Why it works:** her constraint isn't personalisation, it's *length*. The
counterfactual for Priya is mostly a deletion. Note that this email is
**correct at every density** — nothing in it needs the astrology turned up or
down.

---

### Marcus — D14, Wed Aug 12

**Sent:**
> Publish / release — The release is what Rx disrupts — draft under it, ship
> after it.

**Should have been:**
> **Subject: Don't announce pricing this week — the 2nd is clean**
> You asked Begin about "announce v2 pricing" on Aug 4. The answer hasn't
> changed and won't until **Sep 2**, when Mercury stations direct — the
> tradition blocks a release outright before then, and that's the same rule
> that moved your launch to the 11th.
> Draft now, ship the 2nd. **Sep 2 is a Wednesday.**
> → *Hold Sep 2*

Sources: the election query he already ran (there is no persistence for
"questions asked" — this is the **one counterfactual here that needs a small
new table**, ~3 columns: `testerId, activityKey, askedAt`) ·
`electionEngine.ts:113`'s existing station date · `computeElections`.

**Why it works:** it makes the email an **answer that follows up**, not a
broadcast. For him the email's job is to reach back into a decision he already
started in the app.

---

### Sam — D16, Sun Aug 16 (two days before the interview)

**Sent:** *"Best window — 7:16 AM–8:25 AM for negotiate / ask for more."*
She is asleep.

**Should have been, delivered at 16:30 her time:**
> **Subject: Interview Tuesday — prep window Monday 5–6pm**
> "Day-clinic interview" is on Tue Aug 18, 10am. That's mid-sleep for you, so
> the prep matters more than the hour: **Mon 5:00–6:00pm, right after you
> wake**, is a Sun-hour and the strongest speaking window in your waking
> range this week.
> Tuesday itself: get up at 14:00 the day before if you can. The rest of the
> week is yours.

Sources: `tasks.title/dueDate` (the interview) ·
`testerProfile` wake/sleep (already correctly wrapping midnight,
`lib/chronotype.ts:50-71`) · `computeElections` **filtered to her waking
range**, which the election engine already does in-app and the email does not.
Plus: `sendHour` derived from her day-start rather than 7.

**Why it works:** it is the same engine, restricted to hours she is conscious.
The MONTH study already proved the election engine respects her chronotype;
the email is the one surface that throws that away.

---

### Maya — D1, and then almost never

**Sent:** a daily she stops opening on D7.

**Should have been:** three emails in thirty days.
1. **Aug 11, New Moon** — *"Subject: New Moon tonight — name one thing"*, 40
   words, one field, one tap.
2. **Aug 26, Full Moon** — *"Subject: You named 'stop doomscrolling at
   work' — how'd it go?"* Sources: `intentions.text` + `intentions.cycleStart`
   — the table exists and nothing ever reads it back to the user by email.
3. **One standout day** — *"Subject: Tomorrow's the best day this month to
   ask for something"*, using `bestFor` over a 30-day span.

**Why it works:** her failure was genre classification on day 7. Three
event-shaped emails a month never establish a genre; thirty establish it
immediately.

---

### The counterfactual, generalised

Across eight rewrites, the replacement sentences draw on exactly six joins the
composer doesn't make:

1. `tasks` due today / due within 3 days / carried from (`originalDueDate`).
2. `computeElections` keyed on **the task's or star's** `planet` /
   `activityKey` — not on `fav[0]`, the sky's own favourite.
3. `habits.minimumViable` + `cadence` on low days; `habitLogs` for the streak
   that is being protected.
4. `dailyCheckIns` — the last 3–5 rows — as a *volume knob* on the whole
   email.
5. A span scan (7–30 days) for scarcity and shortlists, which `composeWeek`
   already half-does.
6. `intentions` / `wins` read back as evidence: *"you named X"*, *"you did Y."*

**None of these is an astrology problem. All six are a `SELECT`.**

---

## Part 3 — Subject lines

### 3.1 What's wrong, precisely

Current formula: `${moonSign} Moon — ${SIGN_GUIDE.favors.slice(0,2).join(", ")}`
(`reports.ts:170`).

Four defects, in order of damage:

1. **It cannot vary daily.** Its only input holds constant for ~2.5 days.
   12 unique across 30. Gmail threads identical subjects, so a run of three
   Virgo mornings arrives as *one* conversation with 2 unread — the visual
   grammar of a newsletter, not of a thing addressed to you.
2. **It announces a genre, not a message.** *"Pisces Moon — make art from
   feeling, meditate and drift"* is a horoscope headline. Productivity email
   gets opened because it implies an obligation or a deadline; horoscope email
   gets opened because it's a treat. **Treats have a novelty half-life;
   obligations don't.** The current subject spends the product's productivity
   equity to buy horoscope opens.
3. **It contains nothing that could only be true for the reader.** Two
   strangers subscribed in the same city get byte-identical subjects for
   thirty days.
4. **It's too long and back-loads the payload.** iOS Mail shows ~35 chars of
   subject in portrait; Gmail iOS ~40. *"Aquarius Moon — systems thinking, the
   unconventional approach"* (61) truncates to *"Aquarius Moon — systems
   thinki…"*. The two activities — the only part with any specificity — are
   never seen on a phone.

### 3.2 The proposed formula

> **`[their thing] + [a time or a number] — [≤4-word reason]`**
> Hard cap 42 characters. The first 25 characters must contain something the
> reader owns.

Five construction rules, each mapped to a defect above:

- **R1 — own-data first.** The subject must open with a task title, a due
  count, a habit name, an intention, or a date the user chose. Sky vocabulary
  may appear only after the em-dash. (Fixes defect 3, and fixes Priya, whose
  entire product is the preview text.)
- **R2 — a varying token by construction.** Every subject contains a clock
  time, a count, or a date. Because the window time is computed fresh daily,
  this makes duplicate subjects *structurally impossible* — the 16 threaded
  pairs go to zero without any editorial effort. (Fixes 1.)
- **R3 — ≤42 chars, payload in the first 25.** (Fixes 4.)
- **R4 — register-gated.** Run `astroReveal()` server-side. At
  `astroDetail: "minimal"` no sign, planet, degree, or hour-ruler may appear
  in the subject *or the body*. (Fixes Dan.)
- **R5 — no subject may repeat within 7 sends**, checked against a stored
  hash. Cheap belt-and-braces on R2.

On the horoscope-vs-productivity question: the two genres do not need
different subjects, they need **different first words**. *"Aquarius Moon —
finish the deck"* is a horoscope. *"Finish the deck — the day's built for it"*
is a productivity email that happens to be astrological. Same information,
same voice, opposite genre, and only the second one survives day 7 with Maya
and day 1 with Priya.

### 3.3 Ten concrete subjects, for the actual days in the data

Sky facts are verbatim from `/tmp/sim30.json`. Task titles are an illustrative
stand-in for the owner's real `tasks` rows and are marked `{}` on first use;
the star "aligned spine" is real.

| Day | Current subject (chars) | Proposed (chars) |
|---|---|---|
| Thu Jul 30 | Aquarius Moon — systems thinking, the unconventional approach (61) | **`{Beta invite copy}` — clear hour at 10:38** (38) |
| Fri Jul 31 | *(identical to Jul 30)* (61) | **Nothing new today — finish 2 open** (35) |
| Sat Aug 1 | Pisces Moon — make art from feeling, meditate and drift (54) | **A long soft window: 9:50–2:50** (31) |
| Wed Aug 5 | Taurus Moon — finish and polish, cook well and provision (56) | **Earth day 1 of 7 — "aligned spine"** (36) |
| Fri Aug 7 | Gemini Moon — write and edit, calls, errands, emails (51) | **The hard conversation — 7:09 window** (38) |
| Tue Aug 11 | Leo Moon — perform, present, publish, creative play (50) | **New Moon tonight — name one thing** (35) |
| Wed Aug 12 | *(identical to Aug 11)* (50) | **Don't announce pricing until Sep 2** (36) |
| Thu Aug 13 | Virgo Moon — edit and refine, organize the system (48) | **2 due today · your hour is 1pm** (32) |
| Sat Aug 15 | *(identical to Aug 13)* (48) | **Begin nothing today — 3 things to close** (41) |
| Fri Aug 28 | *(identical to Aug 1, 27 days earlier)* (54) | **31 wins this cycle — read the wake** (36) |

Ten subjects, ten distinct strings, mean 35.8 chars, every one of them
readable whole on an iPhone lock screen. Note Aug 15, one of the month's seven
void days — **the void day gets a subject that is genuinely useful precisely
because it is restrictive**; "begin nothing today" is the rare email subject
that reduces
your workload, which is a very strong open.

### 3.4 The best five

1. **`Don't announce pricing until Sep 2`** — a refusal with a date. The
   MONTH study's single strongest conversion mechanic ("Mercury is retrograde
   — the tradition blocks this outright"), finally in a subject line.
2. **`2 due today · your hour is 1pm`** — the whole product in six words:
   your obligation, plus the one thing only this app can add.
3. **`Begin nothing today — 3 things to close`** — the void day as
   permission. Reduces workload; opens well; unmistakably not a horoscope.
4. **`Earth day 1 of 7 — "aligned spine"`** — scarcity plus their own goal,
   quoted back. This is what "Toward your stars" should have been doing all
   month.
5. **`New Moon tonight — name one thing`** — the one genuinely calendrical
   event, with a single action. Survives every register, every persona,
   every chronotype.

---

## Part 4 — Cadence: daily is the wrong default

### 4.1 The evidence against daily

- Daily's only structural advantage is habit formation, and **0 of 8 personas
  formed one.**
- The content does not change fast enough to justify the frequency. The Moon
  sign holds ~2.5 days; the subject line is derived from it; "The long
  weather" changed **once in thirty days**; 38 unique "Lean into" lines filled
  90 slots. **The daily email is running at roughly 3× the rate at which its
  inputs change.**
- Frequency without variance is how a sender gets classified as a newsletter,
  and Maya's D7 kill point is exactly that classification event.
- Both personas who kept anything kept the **lunar** report — the one
  cadence that matches an actual cycle.

### 4.2 Recommended cadences

The app already has `spans: day | week | newmoon` (`emailSubscriptions.spans`)
and a `composeMonth` that exists but is not an offerable span
(`reports.ts:422` validates only `day|week|newmoon`). Four cadences, one new:

**A · `day` — but conditional.** Send the daily *only when there is something
of theirs to say*. Trigger on any of: a task due today or tomorrow; a
`planningWindow` today; a habit whose cadence target is at risk this week; a
task carried ≥3 days; a match between `goals.element` and today's element; a
void day colliding with something they've scheduled. **If none fires, send
nothing.** On this month's data with an active earth star and a typical task
load, that's roughly 12–16 sends in 30 days instead of 30 — and every one of
them opens with a reason. Silence is a feature: it makes the sends that do
arrive mean something.

*Who:* Rachel, Priya, Marcus, Sam — anyone with a live task list.

**B · `week` — Sunday, and rebuilt as a plan.** Fix the three bugs first
(§0.2⑦⑧): pass `natal` to `dayReading`, sample the same JD as the daily, and
**exclude day 0 from standout nomination**. Then change its job from
narrating seven days to *shortlisting two or three*: the strong day, the
protected day, the day to avoid, each with a "hold this" action.

*Who:* Imani (raised from 1/32 to ~4/30 useful sends), Marcus, Kenji-types,
anyone whose planning unit is a week.

**C · `newmoon` — keep exactly as is, promote it hard.** It is the best
artifact in the corpus: forward-looking, dated (*"Tue, Aug 18 — First
Quarter"*, *"Wed, Aug 26 — Full Moon in Aquarius"*), and it closes a loop
(`intentions`). Add the Full Moon as its bookend — the intention read back —
which needs one `SELECT` on `intentions` and no new astrology.

*Who:* Jess, Imani, Amara-types, Maya. **This should be the default for a new
subscriber**, not `["day"]` (`emailSubscriptions.ts:12`).

**D · `notable` — new, and the highest-value one to build.** Event-triggered:
*"a genuinely notable day is coming."* The tide engine can already rank days;
`bestFor` already picks standouts; `computeElections` already scores windows;
`computeTransitForecast` already dates peaks. Fire when: a top-decile day for
one of their star's activities falls in the next 3–5 days; a saved election's
constraint changes (Mercury stations); a caution transit peaks; a scarce
element-match day approaches. Expected volume: **2–4 a month.**

*Who:* Dan, Marcus, Owen-types, Nadia-types — every episodic user, which is
most of the roster and all of the highest-intent ones.

### 4.3 The recommended default

New subscribers get **`["notable", "newmoon"]`**. `day` is opt-in, described
honestly as *"only on mornings something of yours is happening"*. `week` is
opt-in for planners. This inverts the current default (`["day"]`) and it is a
one-line change plus a trigger function.

One operational note: **there is no open/click instrumentation on email at
all.** Before changing cadence, add `email_sent{span}`, `email_open{span}`,
`email_click{span,target}` to `lib/analytics.ts` — otherwise the six quiet
deaths in Part 1 stay invisible and the owner will conclude from two
unsubscribes that the email is fine.

---

## Part 5 — What to cut

### 5.1 Block-by-block verdict

| Block | Freq | Verdict |
|---|---|---|
| Lead ¶ (4 lines) | 30/30 | **Cut to one line.** Line 1 contradicts line 2 on 21/30 days; line 2 duplicates the subject; line 3 (phase) is genuinely useful ~4 days a month and noise the other 26; line 4 always ends "Hold the day's shape loosely there." |
| In the sky's shape | 23/30 | **Cut entirely from the daily.** Named patterns ("Moon and Mercury are each hosted in the other's sign") are the most jargon-dense lines in the corpus and the least actionable. Keep in-app where the reader chose to be. |
| Lean into (3) | 30/30 | **Cut to one**, and make it *theirs*. Three suggestions is a menu; a menu invites deferral. 38 unique lines across 90 slots means two-thirds of this block is repetition. |
| Ease off | 30/30 | **Cut, except on void days.** "Ease off — rushing or pivoting" is generic negation. On void days it's a real constraint and should be promoted into the headline instead. |
| Key moments today | 30/30 | **Keep — as the only concrete block.** But (a) stop restating `fav[0]`, key it to their task; (b) never propose a window already elapsed at send time; (c) clamp to waking hours. |
| Toward your stars | 30/30 | **Keep, invert.** Today it says "no" 23/30. It should either name the next concrete step, or, on mismatch days, **say nothing at all.** Silence beats a daily reminder that today isn't your day. |
| The long weather | 30/30 | **Cut from the daily entirely.** Two sentences in thirty days, both ending "not today's task." A block that prints something and instructs you to ignore it is pure cost. Move to the New Moon report, where a slow transit is on-tempo. |
| **Missing: their tasks** | 0/30 | **Add. This is the whole study.** |
| **Missing: yesterday** | 0/30 | **Add one line.** A win, a completed window, a felt rating, or a kind blank. The email has no memory and therefore no relationship. |

### 5.2 Recommended block order

Optimised for the fact that most reads end after line one.

1. **The headline — no heading, ≤15 words.** Their obligation plus the day's
   shape. *"2 due today; the tide is behind finish-work."* This must be
   complete on its own: for Priya and every lock-screen reader, **this line is
   the product.**
2. **Today — up to 3 owned rows**, each with a due flag and, where the engine
   has one, a time. Carried tasks marked *"carried from Fri"*
   (`originalDueDate`). If nothing is due, this block says so and the email
   ends here.
3. **The one window — a single time range, tied to row 1**, clamped to waking
   hours, never already elapsed. One sentence of *why*, register-gated.
4. **The warning — conditional, and only on a real collision.** A void day
   against a scheduled launch; a caution transit against a scheduled hard
   conversation. Suppressed by default. Its rarity is what will make it read.
5. **Yesterday — one line.** *"You closed 3."* / *"Quiet day — that's a day
   in the log too."* Cheap; it is the only block that proves the app is
   watching.
6. **The sky, briefly — one sentence, below a rule, opt-out-able.** Everything
   the current email leads with, demoted to a footer where the people who love
   it (Luna, Imani, Jess) will still find it and nobody else pays for it.
7. **Footer:** open today · change cadence · unsubscribe. **Three links,
   always, including on the first send.** The current report offers no
   in-email action of any kind.

### 5.3 The minimum viable morning email

Under 60 words. Blocks 1, 2, 3, footer:

> **2 due today · your hour is 1pm**
>
> The tide is behind precise, finishing work.
>
> **Due today** — Nursery forms (15 min) · Invoice Q3
> **Carried** — Hartley deck v2, from Friday
>
> **1:00–2:10pm** is the clean stretch. Take the deck into it.
>
> *Open today · Fewer emails · Unsubscribe*

That is 52 words against a current median of 229 — **a 77% cut** — and it
contains more of the reader than all thirty of the sent emails combined.

---

## Part 6 — The thesis

**The email should be a short, mostly-silent dispatch about the reader's own
day that happens to know what the sky is doing — not a beautifully written
daily bulletin about the sky that happens to be addressed to a person.**

Right now it is the second thing, and its craft is what disguises the problem:
thirty consecutive mornings of genuinely good prose (*"warm fog on slack
water"*, *"high, thin air — everything visible, nothing close"*) about a
subject the reader did not ask about, arriving at a fixed hour whether or not
anything is happening, closing with a note that today is not the day for their
only stated goal. It is a horoscope newsletter wearing a productivity app's
clothes, and every persona's inbox correctly classified it as such between
day 3 and day 14. The fix is not more personalisation or better writing — the
writing is already the best thing in the product. **The fix is to let the
person into their own email**: name the task, name the due date, point the
window at it, stay quiet on the days there is nothing to say, and put the sky
in the footer where it belongs — supporting the reader's aims rather than
replacing them, which is what `EMAIL-REPORTS.md` said in the first place and
what `reports.ts` has never once done.

---

*Companion documents: `USER-SIMULATIONS-2026-07-29-MONTH.md` (retention),
`PAYING-PERSONAS-2026-07-29.md` (willingness to pay), `EMAIL-REPORTS.md`
(the original voice rules this study finds unimplemented),
`COMPETITIVE-UX-2026-07-29.md`, `BACKLOG.md`.*
