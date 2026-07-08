# User simulations — retest against the 2026-07-08 build

Re-walk of the thirty personas from `USER-SIMULATIONS-2026-07-04.md`, against
everything shipped since: **The Log** (sky-stamped timeline + reflect-back),
the **reflect loop on Today** (felt rating + journal → DB), **Currents→Aims
context header**, **Compass orientation picker + why-mode**, the **sky-literacy
layer** (planet dossiers, teachable-moment line, learn-the-sky primer,
bilingual labels), **Resonant Now tap-to-cycle**, **personal angles / sky
clock**, **Launch→calendar**, **text-size setting**, **honest
unknown-birth-time mode**, **mobile instrument strip**, **Planner v2 with GCal
busy-time**. Plus persona #31: the owner.

---

## Part 0 — Scorecard: the July 4 P0s, four days later

| July 4 finding | Status now |
|---|---|
| Unknown birth time fabricates an Ascendant | ✅ **Fixed** — timeless mode, honest copy (Alex #24, Jordan #2 flip to retained) |
| Felt-loop buried + localStorage-only | ✅ **Fixed and promoted** — Today card + The Log + per-planet track record (Jess #17, Gary #26, Amara #16 flip) |
| Mobile never sees the instrument ladder | ✅ **Fixed** — mobile strip (Maya #1, Priya #3 partially flip) |
| Text size unreadable for older users | ✅ **Fixed** — Default/Large/Larger (Rosa #13 flips) |
| Launch results dead-end | ✅ **Fixed** — "put it on my calendar" (Kenji #10, Carlos #29 flip) |
| GCal unconfigured in prod | 🟠 Built; owner-side config remains (Marcus #6 still churns) |
| **No notifications** | ❌ **Still the #1 breaker.** Push scaffolding exists (subscribe + test button) but there is no scheduler — nothing ever fires. Rachel #9 still churns week 3; ~24/30 still have no reason to return on day 4. |
| Compass ungated on free | ❌ Still open (bounded by 30/hr rate limit) |

Net: the *integrity* and *trust-engine* failures are closed. The *retention
loop* failure (nothing pings you) is untouched and is now the oldest open P0.

---

## Part I — New friction the new features created

The July build added five suggestion/teaching voices to a page that already
had three. Walking the beginners cluster through Today now:

**F1 — Too many oracles on one screen (new #1 clarity issue).**
Today can simultaneously show: the hero's tide guidance ("lean in — feel,
dream, heal"), the teachable-moment line ("a saturnine undertone"), three
Resonant Now cards, Big Sky takes, the rail's "this hour…" + day "good for…",
Standing Conditions, and the header chip's *quality* verdict ("good
conditions"). Maya (#1) reads four different instructions for the same
morning and can't tell which one is *the* answer. Dan (#4) likes exactly one
of them (hours) and scrolls past the rest. **The instruments disagree about
altitude:** which voice is primary, which is texture? Nothing says.
→ Recommendation: an explicit hierarchy. ONE headline verdict (the tide),
one action row (Resonant Now), everything else collapsed/on-demand. See
Part IV.

**F2 — Two vocabularies still fight (from the tide audit, now user-visible).**
"Deep Tide · High, ebbing" (coherence language) sits next to "fire day ·
good conditions" and "· Water · Workable" (favorability language, with a
baked-in fire/air bias). Gary (#26) spots the contradiction in an afternoon:
"the tide says rest, the chip says good — which is it?" Luna (#11) will
eventually notice watery days systematically score lower and that's the
public-correction risk. → Retire the quality *label* from all surfaces.

**F3 — The location nag never resolves.**
"⚠ Set location — hours & sun times are estimated" has appeared in literally
every screenshot of every session. Onboarding collects birth place but never
asks for *current* location, so 100% of new users carry a permanent warning
banner through their first week. Priya (#3) assumes something is broken.
→ Add a location step (or "use my location" prompt) to onboarding; demote
the banner to a Settings hint after first dismissal.

**F4 — Aims opens on the wrong altitude.**
The Currents context header (long weather) renders *expanded above* Guiding
Stars, so the page leads with multi-year transits before showing the user's
own aims. Owen (#20) reads it as astrology homework before his goals; Elena
(#7) loves it but would still put her stars first. → Default the header
collapsed (one-line summary), expand on tap.

**F5 — The Log's day view double-prompts.**
"How did today feel?" on Today and "Your reflection" in the Log are the same
write with different framings; users who do both wonder if they're two
different journals (they aren't — good — but nothing says so). One line of
copy fixes it ("same logbook as Today").

**F6 — New-user Day 1 emptiness is now *more* visible.**
The dashboard's bento makes empty states prominent: no stars, nothing on
deck, empty Log. The Log's empty state now teaches the loop (good), but
Guiding Stars / On Deck still just point elsewhere. Jordan (#2) sees a
beautiful dashboard of nothing. → Each empty card should offer its one-tap
first action in place.

**Wins to bank (personas that flipped):**
- **Bill (#18)** — the learn-the-sky primer + planet dossiers are exactly his
  book; he now has a curriculum. Highest-LTV persona got *stronger*.
- **Jess (#17) / Gary (#26)** — the felt loop → Log → per-planet track record
  ("you rated 4 saturnine days; 3 aligned") is the personal-calibration view
  Gary asked for. The app's credibility story is now real.
- **Ash (#14)** — Resonant Now cycling *is* their multi-reading ethos, now
  interactive. (Still no share on Big Sky cards — their one ask.)
- **Amara (#16)** — reflect-don't-predict is now first-class; her
  recommendation bar is met.
- **Theo (#12)** — planet dossiers show next-contact dates; still wants exact
  perfection dates for slow transits (unchanged ask).

---

## Part II — Persona #31: the owner. Morning & evening check-in.

**The ritual as stated:** morning — DCA reminder/encouragement, awareness of
next steps + calendar; evening — review the day, feel accomplishment. Twice a
day, a few minutes each.

**Walking it against the current build, morning:**
1. Opens app → Today. The page is identical at 7am and 11pm — no
   time-of-day awareness anywhere.
2. DCA habit: *exists* as a habit with a streak counter — but it lives on the
   Aims → Habits tab, two taps away, and Today's habit card shows a bare
   checkbox ("morning stretch ○ 0/1 done"). No encouragement, no streak
   surfaced, no "this is why it matters" line. **Encouragement layer: absent.**
3. Next steps: the On-Deck card shows scheduled blocks (usually "Nothing
   scheduled") and GCal events *if connected*. Tasks-due-today are on another
   tab. There is no single "your three things today" view.
4. Nothing *initiates* the ritual — no morning notification, no email send
   (reports compose but nothing delivers them).

**Evening:**
1. The reflect loop exists and is good: felt rating + logbook line → The Log.
2. But there is **no review moment** — nothing plays back what happened
   today: which habits were kept, which blocks completed, which tasks closed.
   The accomplishment feeling has no surface. Streak data exists
   (habits have streaks + 14-day dots) but is never celebrated.
3. The Log shows the day *after* it's logged — it's an archive, not a ritual.

**What the ritual needs (design, buildable in ~2 sessions):**

**A. Time-aware Today.** The top of Today becomes a ritual card that reads
the clock:
- **Morning mode (wake → ~11am): "Cast off."** Greeting + one-line weather
  ("Deep tide, rising — a feeling day; protect the afternoon peak") · the
  DCA/habit nudges as *encouragement chips* ("Day 12 — the streak is the
  point ✦ resonant today") · **Today's three**: top task(s) toward active
  stars + next calendar item + first scheduled block, as one glanceable row ·
  one Resonant Now suggestion.
- **Evening mode (~7pm → sleep): "Log the day."** Auto-assembled review:
  ✓ habits kept (streak +1 animations), ✓ blocks completed, ✓ tasks closed —
  then the felt rating + logbook line (already built) — then one
  accomplishment line ("3 of 3 kept on a saturnine day — that's the hard
  kind") — then tomorrow's first commitment as a soft preview.
- Between modes, Today is what it is now (minus the clutter — Part IV).

**B. The delivery mechanism.** The ritual dies without a trigger:
- Morning: push notification (scaffolding exists — needs a cron/scheduler on
  the server + copy) or the email day-report (composer exists — needs Resend
  + cron). Either closes Rachel (#9) too. **This is the same missing
  scheduler as the #1 P0 — one build closes both.**
- Evening: a second scheduled ping ("how did the day feel?") — which is also
  the Log's data-collection engine.

**C. Encouragement copy layer.** Habits gain an optional `why` line ("DCA —
future-you's paycheck") shown in morning mode + streak framing. Small
content work, big felt difference.

---

## Part III — Aesthetics: from wall of text to instrument panel

The diagnosis is right: Today is currently ~10 same-width beige cards of
9-13px prose. Everything has equal visual weight, so nothing is legible at a
glance — the eye has no landing point. The fixes are structural, not
decorative:

**1. One hero, everything else instruments.** The tide is the emotional
product — give it the screen's only big moment: full-bleed color field in the
day's element (the gradient exists, amplify it), the tide curve as a living
graphic (gentle water motion — TideWater component exists), the character
word set large in the display face (Baar Sophia is already self-hosted and
only used twice). Numbers-as-dials, not sentences.

**2. Time-of-day atmosphere.** The page palette should know dawn from noon
from night (tint the background wash by sun position — the engine already
computes sunrise/sunset). Morning app ≠ midnight app. This alone makes it
feel alive, and it's ~a CSS variable driven by one calculation.

**3. Collapse by default, expand by curiosity.** The rail already has this
pattern (accordion sections). Apply it to Today's body: Big Sky = one line
each until tapped (exists), Standing Conditions = one line, teachable moment
= one line (exists). Target: **Today above the fold = hero + ritual card +
Resonant Now. Everything else is a tap away.**

**4. Glyphs and chips over prose.** The app already owns a great glyph
language (planet glyphs, moon disc, element colors, week-ahead bars). Extend
it: streak dots instead of "0/1 done", the felt history as three colored dots
on the Log rows (done), aspect chips instead of sentences. Rule of thumb:
if it repeats daily, it should be a glyph; if it's today-only news, it can
be a sentence.

**5. Motion as life, sparingly.** Three places earn animation: the tide
water (slow, ambient), the phrase-cycle transitions (a 150ms fade —
currently instant), and the evening review checkmarks (the accomplishment
beat). Nothing else moves.

**6. Kill the third vocabulary.** Part of the wall-of-text feeling is three
verdict systems in one viewport (tide + quality label + guidance prose).
Retiring the quality label (F2) removes a whole stratum of text for free.

---

## Part IV — Priorities out of this retest

1. **The scheduler** (push cron + morning/evening pings + email send) — one
   build, closes the #1 P0 from both studies AND the owner ritual's trigger.
2. **Time-aware ritual card** (morning brief / evening review on Today) —
   the owner's ask, and the retention shape for Priya/Rachel/Elena.
3. **Today de-clutter pass** (hierarchy: hero + ritual + resonant; collapse
   the rest; retire quality label; location prompt in onboarding).
4. **Aims header collapsed by default** (one-line long-weather summary).
5. Aesthetics phase 1: element-atmosphere + tide hero treatment + Baar
   Sophia display scale (the "lively" pass).
6. Share cards on Big Sky takes (Ash/Zoe — distribution, cheap).

Not re-litigated (still true from July 4): Compass gating decision, couples
feature, cycle-as-lens, i18n, polar-latitude honesty line.
