# First-run pass — owner's own walkthrough, 2026-08-02

*The owner ran a fresh account through the app and wrote down everything that
snagged. This file splits that list into **what was fixed** (all shipped in
`29878f2`, with tests) and **what needs a decision** — each of the latter with
a recommendation and a rough cost, so it can be answered rather than
re-discovered.*

---

## Part 1 — Fixed (shipped, verified live)

Recorded here only so the next session doesn't reopen them.

| Snag | What it actually was |
|---|---|
| "Moon in Pisces for the next 2½ days" but it was about to change sign | A hardcoded string. Now measured: degree-based progress + real ingress time, with a fill bar. |
| Hero says "initiative, visible action" and "initiations won't take" and "energy 100%" | Two engines, neither aware of the other. Now one reconciled voice, deduped across three channels. |
| Can't click Leo season for more info | Season was the one chip in the rail with no interaction. Given the same ↻ as Moon. |
| Week-in-the-wake shown to a brand-new account | Gated purely on the date. Now needs something to actually review. |
| Moments at the bottom should show on the tide chart | They only had symbols in the **vivid** style; the default is **calm**. Added there. |
| Neptune/Saturn days should be diminished in height | They were *raising* it — every crest was positive. Now signed on hard contacts. |

**One correction to an earlier answer of mine:** I first said aspect
clustering was "computed but never used" in the curve height. That was wrong —
its removal was deliberate and documented (it double-counted against the
per-aspect crests). The real defect was the *sign* of hard aspects from the
dampening planets, which is what got fixed.

---

## Part 2 — Needs your decision

### A. Chronotype — ✅ **partly done; the rest is your call**

The worry was losing users to the question. Worth knowing before deciding: it
is **load-bearing**, not decoration — it drives ritual timing, the planner's
waking hours, and the sleep shading on the tide chart. Cutting it degrades
Plan's output quality for every user thereafter.

Current copy: *"When you're usually free and how you naturally run helps
Compass suggest timing that actually fits your life, not just the sky."*
That's already a value pitch. The friction is more likely **position** (a
third form before any value has landed) than the question itself.

**Shipped:** the step already had a prominent "Skip for now", but skipping
stored **nothing** — which left `sleepIntervals()` empty, so the planner would
cheerfully propose a 3am window for someone who'd merely declined to answer.
Skipping now keeps the form's own sensible defaults (07:00–23:00, "steady")
and flags them `assumed: true`, so the app never presents a guess as the
user's statement. A skip is now a soft default instead of a hole.

**Still your call:** whether to move the step out of onboarding entirely and
ask *contextually* the first time someone opens Plan — the moment its value is
self-evident. More work, probably better. Worth doing if activation data shows
drop-off at this step specifically; the `assumed` flag makes that measurable.

### B. Load time — **needs measurement, not a guess**

Everything observed this session was the **dev server**, which is not
representative (unbundled modules, HMR, no compression). Before optimising
anything, measure production: `/api/tides/now` does a lot per request
(ephemeris, natal chart, transits, synthesis, a full day-arc curve at fine
time steps). Likely candidates once measured:

1. Day-arc curve resolution — computed per request; cacheable per (day, lat/lon
   rounded, tz).
2. Natal-chart fetch on every `now` call.
3. Cold starts on Neon.

**Recommend:** one profiling pass against compass.day before touching code.
I can do this if you want it.

### C. Plan as a fuller project-management surface — **recommend depth toggle**

You liked the straightforwardness but want more. Those pull opposite ways, and
the app already has the pattern that resolves it: `astroDetail` and
`uiDensity` both gate depth without a second product.

Proposed shape, in order of cost:
1. **Now:** keep Schedule / Pick a day as-is.
2. **Add:** a per-star "plan of record" view — steps with dependencies and
   target weeks, which the star page half-has already (`runBreakdown` produces
   milestones today; they just don't get a timeline).
3. **Later:** a `planDepth: simple | project` preference. Simple stays exactly
   what it is now, so no beta user loses the thing they liked.

The refusal that should survive all three: **nothing is scheduled without
consent** — a PM view must not start auto-placing work.

### D. Calendar import *before* planning — ✅ **shipped**

Confirmed the gap: `Launch.tsx` had **no** Google Calendar affordance at all,
while the Planner's own copy promises to work "around your waking hours and
your calendar." It was planning around a week it couldn't see.

A dismissible strip now sits **above** the planning UI (not after a bad
result — the fix is worthless once the plan is already wrong): *"Connect a
calendar and Compass will plan around what's already there — otherwise it's
placing work into a week it can't see."* Self-gating on connected / not-
configured / dismissed, per-tester. Uses the existing OAuth popup and
refreshes on its success message, so the strip disappears without a reload.

*Note:* it does not appear on the local scratch environment because Google
credentials aren't configured there (`configured: false`) — verified by
stubbing the status response. It will appear on production.

### E. Guiding Stars "long weather" — ✅ **backed off; on-ramp still needs an endpoint**

**Shipped:** the panel now also requires **at least one star**. Its whole
framing is "the seasons your *stars* can ride" — with no stars there is
nothing to ride them, so a first-time visitor met profections and natal
transits standing between them and the one thing they came to do.

**Not shipped:** the "need help? we can suggest directions based on your
astrology" on-ramp. There is currently **no** star-suggestion endpoint — the
creation form auto-diagnoses from words you type, but nothing proposes aims
from your chart. That's a genuine new feature (LLM + prompt design + a
`/api/planning/goals/suggest` route), not a copy change. Worth doing; wanted
to flag the real cost rather than half-build it.

### F. Elemental structure on the homepage — **needs your clarification**

Checked the code: `ElementalBalance` and `FourTides` are **already unrendered**
on Today. The only elemental thing left is the **Fire/Earth/Air/Water lens
tabs inside the tide chart**, which appear only at *expanded* density — so you
were likely in expanded when you saw them.

That matters, because those same tabs carry *"Best this week for bold moves:
✓ Wed 6:15 PM–11:45 PM…"*, which is arguably the most concretely useful line
on the page — and a default (essential) user never sees it.

Two readings, opposite conclusions:
- If the **tabs** are the clutter → hide the lens selector at essential, keep
  Overall only.
- If the **windows** are the value → surface "best this week for X" *at
  essential*, without the tab strip.

**Recommend the second.** But tell me which you meant.

### G. 30-day view on the homepage — **recommend optional horizons**

You called "the water ahead — next 30 days" useful enough to earn a homepage
spot, then wondered about a week/10-day variant. Both are right; make it a
control rather than a pick: **Week · 30 days**, remembered like the other
display prefs, and shown at essential (it's the cheapest "why should I come
back tomorrow" the app has).

Note it now has more vertical variation than when you looked, because the
dampener change landed — Saturn/Neptune days visibly dip.

### H. Ask should know about lunar aspects and hours — **agree, straightforward**

Ask already receives election context. Extending the payload with the
current planetary hour + the day's Moon aspects is a contained change, and it
would stop Ask from reasoning about a day while blind to the two fastest
signals the rest of the app is built on. Worth doing right after the above.

Also: the two contradictions you saw on the Ask screen were the *same* hero
bug — Ask renders the same tide summary. That's fixed at the source.

---

---

## Where this leaves things

**Done in this pass:** A (partly), D, E (partly) — plus all six defects in
Part 1.

**Waiting on you — one question blocks the best remaining item:**

> **F: when you said "the elemental structure on the homepage", did you mean
> the Fire/Earth/Air/Water tab strip, or the whole block including the "Best
> this week for bold moves" windows?**

That answer decides whether the fix is *hide it* or *promote it to essential
density*, and I'd rather not guess — the windows line may be the single most
useful sentence on the page, and a default-density user never sees it today.

**Then, in order:**

1. **G** (horizon toggle: week / 30 days on the homepage) — the cheapest
   "why come back tomorrow" the app has, and the 30-day strip now shows real
   vertical variation since the dampener fix.
2. **H** (Ask gets lunar aspects + planetary hour) — contained; stops the
   advisor reasoning while blind to the two fastest signals the rest of the
   app runs on.
3. **E-remainder** (star-suggestion endpoint) — new feature, real cost.
4. **B** (production profiling) — must precede any performance work.
5. **C** (Plan depth toggle) — the largest; wants its own pass.
