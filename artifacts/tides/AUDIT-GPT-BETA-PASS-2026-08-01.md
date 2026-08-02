# Compass — Final Beta Product Pass

**Purpose:** Simplify and clarify the first-run experience before creating the final beta-launch checklist.

**Primary product promise:** Compass helps a person answer three questions:

1. **What fits now?**
2. **When should I do what matters?**
3. **What am I steering toward?**

Everything in the first session should establish one of those three ideas. Calendar, Log, instruments, reports, notifications, advanced astrology, and long-cycle detail remain valuable, but they should not compete with the primary loop during onboarding.

---

## 1. Executive recommendation

The current app is close to the right core structure. It already has:

- a strong Today hero
- a compact Guiding Stars card
- an On Deck card
- a dedicated Plan surface
- a thoughtful Guiding Star empty state
- an optional full instrument panel

The remaining problem is **hierarchy**.

The intro currently teaches six conceptual ideas before the user has experienced the app. After setup, a new user can encounter several banners and prompts before reaching the actual tide hero. The existing “How Compass works” guide is useful as reference, but it is a document the user must choose to open, not a first-session experience.

For beta, reorganize first use around this path:

> **Read the moment → choose a direction → place something in time → return to Today.**

Do not add more explanation on top of the current explanation. Replace the mandatory conceptual sequence and first-run guide strip with a shorter intro plus a contextual spotlight walkthrough.

---

# 2. Audit of the current intro

## What is working

The intro has a coherent visual voice and introduces several important distinctions:

- character versus level
- four day characters
- high versus low tide
- personal timing
- the idea that time contains nested rhythms

The opening “weather report for time” metaphor is understandable and should survive in some form.

## What is not working

### A. It is concept-first rather than job-first

The current six-slide sequence teaches:

1. weather for time
2. four day characters
3. tide level
4. nested rhythms
5. planning
6. birth-chart personalization

The user must absorb the model before seeing the concrete product. The main practical jobs—deciding what to do now, planning, and steering by Guiding Stars—arrive late or not at all.

### B. Six slides before account setup is too much

After the slides, the user still faces name, birth data, and rhythm setup. This creates a long runway before the first useful reading.

### C. The planning slide contains stale product copy

It says:

> “Log how days actually felt — it learns what fits you.”

The felt-rating loop has been removed. The current pattern is based on completed work, not a daily subjective rating. Remove this sentence everywhere.

### D. The final personalization frame over-centers birth data

Birth data is a valuable personalization layer, but it is not the reason the product exists. The final impression should be about the user’s direction and agency, not data entry.

### E. The nested-rhythms visual is a reference diagram, not an onboarding visual

`SpineGauge compact` still renders the complete ladder: hour, lunar aspects, day, planetary day, planetary aspects, lunar month, season, year, and chapter. Compact mode hides supporting explanation, but it does not reduce conceptual load. It asks a first-time user to understand nine layers at once.

Keep the full SpineGauge for the Guide or an advanced “How timing works” reference. Do not use the full ladder in mandatory onboarding.

---

# 3. Recommended intro: three slides

Use actual miniature product compositions rather than abstract glyphs alone. Each slide should visually resemble the interface the user will see next.

## Slide 1 — Know what fits now

**Title:** Know what fits now.

**Body:**  
Compass reads the conditions around this moment and turns them into a clear suggestion: focus, move, connect, rest—or wait.

**Visual:**  
A miniature Today card:

- Building Tide
- Rising
- “Good for patient, constructive work”
- one small “best next move” row

This combines character and level without requiring two separate teaching slides.

## Slide 2 — Steer toward what matters

**Title:** Give your time a direction.

**Body:**  
Name a few Guiding Stars—the longer things you are trying to build. Compass connects today’s choices to where you actually want to go.

**Visual:**  
One Guiding Star card:

- “Finish the book”
- next move: “Outline chapter four”
- suggested stretch: “Tue 10:30–12:00”

This establishes the connection between aspiration and action.

## Slide 3 — Plan with the current

**Title:** Plan with the current.

**Body:**  
Paste a list or choose something you want to begin. Compass finds better windows—and tells you when the timing is against it.

**Visual:**  
Two or three items placed into time:

- Write proposal → Wednesday morning
- Difficult conversation → Thursday evening
- Launch project → Avoid this week

**Footer:**  
Personalized by your rhythm, your calendar, and—optionally—your birth chart.

## Navigation

- `Back`
- `Next`
- `Skip`
- final CTA: `See my day`

Three progress dots only.

---

# 4. What to do with the nested-rhythms idea

## Recommended decision

Remove it from the mandatory intro.

It is intellectually important, but it is not required to receive value. Introduce it after the user has seen a recommendation and naturally asks, “Where did this come from?”

## New simplified visualization

Use **three stacked bands**, not the full depth gauge:

### NOW
Planetary hour and passing Moon  
*What is peaking or shifting in this moment?*

### TODAY
Day character and tide level  
*What kind of day is this?*

### YOUR CHAPTER
Season, personal cycles, and Guiding Stars  
*What larger period and direction is this moment part of?*

A single line or needle can pass through all three:

> Compass combines these layers to answer: **what fits now?**

### Why stacked bands

- legible on a phone
- directly maps to the product
- permits real example data
- visually communicates nesting without nine labels
- does not require astrology knowledge

The full nine-rung SpineGauge can remain under:

- Settings → How Compass works
- Planets/reference
- a `Why this reading?` disclosure
- an advanced astrology-detail level

---

# 5. Rework the setup sequence

## Current issue

The present flow is effectively:

1. six intro slides
2. name
3. birth data
4. chronotype/free windows
5. dashboard

A person who chooses “Show me today” on the birth step exits onboarding and bypasses rhythm setup, even though wake/sleep and availability are directly relevant to usable scheduling.

## Recommended first-run flow

### Screen 0 — Welcome

- Compass wordmark
- one-sentence value proposition
- `Start fresh`
- `Restore account`

Returning users should not need to skip the intro before reaching account restoration.

### Screens 1–3 — Intro

Only the three job-focused slides above.

### Screen 4 — Basic setup

Ask only for:

- name
- usual wake time
- usual sleep time

Use sensible defaults. Make it skippable.

### Enter the app

Show Today immediately.

### Progressive personalization after value

Prompt for these later and separately:

- birth details: “Personalize the sky to your chart”
- free weekday/weekend windows: “Make planning fit your real availability”
- location: “Sharpen planetary hours and sunrise/sunset”

Do not present all three as toll gates before the first useful reading.

## Acceptable lower-scope alternative

If the existing onboarding architecture must remain for beta:

- reduce intro to three slides
- place chronotype before birth data
- make “skip birth chart” continue to chronotype rather than exit onboarding
- collapse free-window setup behind “Set availability later”
- correct all stale felt-rating language

---

# 6. Replace the first-run guide strip with a spotlight walkthrough

The permanent Guide remains useful as a reference in Settings. The first-run strip on Today should be replaced by an actual product tour.

## Tour principles

- highlights the real interface
- moves across the essential routes
- no more than five steps
- explains only the primary loop
- works on desktop and mobile
- can be skipped immediately
- can be restarted from Settings
- completion is account-scoped
- does not depend on optional or ephemeral content

Do not highlight:

- VoC banners
- live crossings
- notifications
- premium prompts
- the instrument rail
- reports
- Log
- Calendar controls

Those are later discovery.

## Suggested five-step tour

### Step 1 — Read the moment

**Anchor:** Today tide hero

**Copy:**  
This is the current moment: what kind of time it is, how strong it is, and what it supports.

**CTA:** `Next`

### Step 2 — Choose what fits now

**Anchor:** a new or strengthened `Best next move` surface

**Copy:**  
Compass matches the moment to your tasks and Guiding Stars. This is the quickest answer to “What should I do now?”

**CTA:** `Next`

If the user has no tasks or stars, the stable empty state should say:

> Add something you are considering, and Compass will tell you whether it fits now or belongs somewhere else.

### Step 3 — Set a direction

**Anchor:** Guiding Stars card on Today, then navigate to the Guiding Stars page

**Copy:**  
Guiding Stars are the longer things you are steering toward. Tasks and habits can belong to one, so the day stays connected to a direction.

**CTA:** `See Guiding Stars`

### Step 4 — Put it in time

**Anchor:** Plan → Schedule

**Copy:**  
Paste a list and Compass proposes a week. Nothing is scheduled until you approve it, and it will not move blocks behind your back.

**CTA:** `Next`

### Step 5 — The loop

**Anchor:** navigation or a small diagram

**Copy:**  
Read the moment on Today. Choose a Guiding Star. Use Plan to place the next moves. Then return to Today to see what is on deck.

**Final CTA:** `Set my first Guiding Star`

Alternative final CTA for a user who already has one:

`Plan one next move`

---

# 7. Spotlight-tour implementation specification

Create a reusable component such as:

```text
src/components/SpotlightTour.tsx
src/lib/tour.ts
```

Add stable anchors:

```html
data-tour="today-hero"
data-tour="best-next-move"
data-tour="today-stars"
data-tour="nav-stars"
data-tour="first-star"
data-tour="nav-plan"
data-tour="plan-schedule"
```

## Behavior

- Render through a portal.
- Measure target bounds with `getBoundingClientRect()`.
- Cut a padded spotlight hole through the overlay.
- Recalculate on resize, scroll, route change, and mobile orientation.
- Scroll the target into view before showing the step.
- Desktop: tooltip beside target.
- Mobile: tooltip as a bottom sheet with the target still visible.
- Support Back, Next, Skip, Escape, and keyboard focus.
- Respect reduced-motion preferences.
- If an anchor is unavailable, advance safely rather than breaking the tour.
- Keep tour copy outside page components in a typed step definition.

## Persistence

Do not use one global browser flag such as `obs_saw_tour`.

Persist:

```text
tourVersion
completedAt
skippedAt
lastStep
```

against the current account, or at minimum in a tester-ID-namespaced local key.

Version the tour so a future major navigation change can justify showing a new short tour.

## Analytics

Track:

- `tour_started`
- `tour_step_viewed`
- `tour_skipped`
- `tour_completed`
- `first_star_started`
- `first_star_created`
- `first_plan_started`
- `first_plan_committed`
- `best_next_move_opened`

The important funnel is not merely tour completion. It is:

> viewed Today → created a Star → planned one move → returned to Today

---

# 8. Simplify the product around the three core jobs

## A. Today should answer “What fits now?”

The current hero describes the weather well, but the practical answer can still be buried. `Ask` contains a “What should I do right now?” prompt, yet that is behind a secondary AI affordance.

Create a first-class deterministic `Best next move` card directly beneath the hero.

### Suggested content

- one task, habit, scheduled block, or Guiding Star next move
- why it fits this moment
- how long the window remains useful
- linked Guiding Star, when relevant

### Actions

- `Start now`
- `Find another time`
- `Add something`
- `Ask why` as a secondary explanation

AI may explain the recommendation, but the recommendation itself should come from deterministic timing and the user’s actual work.

### Today hierarchy

For essential density:

1. Tide hero
2. Best next move
3. Guiding Stars
4. On Deck
5. contextual ritual or reflection
6. secondary banners

A genuinely active, short-lived crossing may still rise above the hero. Generic setup, notification, guide, and premium banners should not.

## B. Guiding Stars should answer “What am I steering toward?”

The existing empty state is good. The first-star creation form is not yet as simple as the empty state promises.

A first-time user can encounter:

- title
- description
- diagnosed planet
- planet override
- element override
- horizon
- optional long-cycle anchoring

That is useful advanced control, but too much for the first Star.

### First-Star fast path

Initially ask only:

1. What are you steering toward?
2. Why does it matter? *(optional)*

Then:

- auto-diagnose planet and element
- default the horizon
- show the reading as a result, not a required decision
- place overrides under `Adjust timing signature`
- place long-cycle anchoring under `Advanced`

After creation, immediately ask:

> What is one next move?

That next move can then flow into Plan.

## C. Plan should answer “When should I do it?”

Plan currently has:

- Schedule
- Break down
- Begin

`Break down` duplicates functionality already available inside Guiding Stars. For the beta-focused product, keep Plan to two questions:

### Schedule
Where should this work go?

### Begin
When should this specific thing start?

Move goal breakdown entirely into the relevant Guiding Star. This makes the navigation model much easier to explain.

## D. Navigation

Recommended order:

### Desktop
`Today · Plan · Guiding Stars · Calendar`

### Mobile
`Today · Plan · Stars · Calendar`

This mirrors the primary journey:

1. orient
2. act or schedule
3. connect to direction
4. inspect the wider timeline

Keeping the current four destinations is reasonable. The main changes are order and naming.

Calendar is important, but it does not need to be part of the first-run walkthrough.

---

# 9. Remove or delay first-session noise

A new user can currently encounter multiple items before the hero:

- guide strip
- live crossing banner
- ritual card
- review card
- notification opt-in
- first-Star prompt
- premium prompt

Not every person will see every item, but the architecture permits a crowded first impression.

## For beta first session

- replace guide strip with the spotlight tour
- suppress notification opt-in until after the tour or second visit
- suppress premium discovery messaging during the beta
- keep the first-Star invitation, but integrate it into the tour and Guiding Stars card
- keep Review hidden until a real completed period exists
- keep live crossings only when genuinely active and useful
- do not place setup cards above the hero

The first visible product object should almost always be the answer to:

> What kind of moment is this?

---

# 10. Retain the Guide, but change its role

The existing `How Compass works` modal is valuable. Keep it in Settings as the permanent manual.

Update it after the simplification:

- daily loop
- Today
- Guiding Stars
- Plan
- Calendar and Log
- what Compass will not do
- advanced timing layers

The Guide should no longer be the first-run teaching method. It is the place a user returns to in week three.

Add a small `?` or `How this works` entry in the global shell or Settings. Do not restore the dismissible first-run reading strip.

---

# 11. Copy and terminology pass

Use one plain description for each core destination:

- **Today:** what fits now
- **Guiding Stars:** what you are steering toward
- **Plan:** when to do it
- **Calendar:** what is ahead and what happened

Specific corrections:

- remove all references to daily felt ratings teaching the model
- avoid saying the app “learns” unless naming the behavioral pattern it actually computes
- use `Guiding Stars` consistently rather than alternating freely with Aims, North Stars, goals, and stars
- decide whether the public tab label is `Guiding Stars`, `Stars`, or `Aims`
- reserve `North Star` only if it is a genuinely different concept; otherwise remove it
- explain `Begin` as “choose a start” in introductory copy
- keep astrology terms behind evidence/details at minimal detail

---

# 12. Implementation sequence for Claude Code

## Phase 1 — Correct and shorten onboarding

1. Remove stale felt-rating claims.
2. Replace six slides with the three job-focused slides.
3. Add a direct Restore Account route to the welcome screen.
4. Decouple rhythm setup from birth-chart setup.
5. Move the full SpineGauge out of mandatory onboarding.
6. Add the simplified three-band timing illustration to Guide/reference.

## Phase 2 — Build the tour

1. Add stable `data-tour` anchors.
2. Build the accessible spotlight overlay.
3. Add route-aware tour steps.
4. Replace the Today guide strip.
5. Add restart-tour control in Settings.
6. Add analytics and versioned persistence.

## Phase 3 — Clarify Today

1. Ensure the hero is first for ordinary first use.
2. Add or strengthen `Best next move`.
3. Place Guiding Stars and On Deck directly after it.
4. delay notification/premium/setup banners
5. test essential density at phone and desktop widths

## Phase 4 — Simplify Stars and Plan

1. Add first-Star fast path.
2. Move advanced planet/element/horizon controls behind disclosure.
3. Ask for one next move after Star creation.
4. Remove `Break down` as a Plan mode.
5. Keep breakdown inside the selected Guiding Star.
6. rename/reorder navigation consistently.

## Phase 5 — First-session validation

Run at least five fresh-account tests with people who have not seen the product.

Ask them, without prompting:

- What is Compass for?
- Where would you go to decide what to do now?
- Where would you put a longer-term aim?
- Where would you paste a list to schedule?
- What does an Avoid result mean?
- What would you do next?

Watch behavior, not only answers.

---

# 13. Beta acceptance criteria for this pass

This product pass is complete when:

- the mandatory intro contains no more than three slides
- all intro claims match current product behavior
- a returning user can restore an account without passing through the intro
- a chartless user still reaches rhythm setup
- a fresh user reaches Today quickly
- the tide hero is the first ordinary product object
- the walkthrough highlights actual interface elements
- the walkthrough covers Today, one Guiding Star, and Plan
- the walkthrough is skippable and restartable
- first-Star creation needs no astrology choices
- the user can create a Star and one next move without leaving the flow
- Plan exposes only Schedule and Begin at top level
- the current guide remains available as reference
- notification and premium prompts do not interrupt first value
- mobile and desktop walkthroughs both pass
- analytics can distinguish tour completion from actual activation
- no new user-facing copy refers to the retired felt-rating loop

---

# 14. Product sentence to design around

> **Compass reads the moment, connects it to what matters, and helps you place the next move in time.**

The first-run experience should make that sentence felt before it teaches the full cosmology.
