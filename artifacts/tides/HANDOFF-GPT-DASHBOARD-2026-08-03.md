# Compass — the home/Today split, and promoting convergence

Handoff for critique. This is a **structural reframe**, proposed by the owner
after living with the current build. It supersedes the emphasis (not the
constraints) of DASHBOARD-SPEC-2026-08-03.md, which was written under a
different assumption about who the user is.

Critique wanted on the shape and the ordering. Two of the eight points in the
last critique caught errors that would have shipped; the same scrutiny is
wanted here, particularly on **what should be built first**.

---

## 1. The reframe, in the owner's terms

- The Today tab is "super busy and a little overwhelming". It has been asked to
  be four things at once: the reading, the recommendation, the plan, and the
  forecast.
- The **home page should be a dashboard** — key elements of each important
  function at your fingertips, like the home view of a productivity app or a
  Notion dashboard, "except with astro functionality built in".
- **Today becomes the day laid out in time** — when different things are
  active, read like a calendar or a list of times. Possibly a single axis.
- This "puts more attention on the actual use of the app — planning and making
  decisions about what to do now, or how to execute on a plan, rather than
  reading the astro."
- **The astro recedes.** The left rail already carries most of the explanatory
  weight and should keep it.
- **Audience correction:** the average user is at least somewhat astro-savvy.
  Sun-sign-only users are not the target. Therefore "all our work to simplify
  everything to one meaningful thing might not be so important."
- **The job to be done:** not telling people what to do, but "encouraging them
  to think through all the things they want / need / are nourished by doing,
  and helping them steer toward those, rather than floating in meaningless
  engagements with time."
- **The thing to emphasise: moments of convergence for particular activities —
  globally, and for someone personally.**

---

## 2. What already exists (the important finding)

The convergence capability the owner named as most important is **already
built, and buried**.

`artifacts/api-server/src/lib/electionEngine.ts`
```ts
computeElections({ activityKey, span: "day"|"week"|"month", lat, lon, tzOffsetMin, natal })
```
Scans a horizon for one activity, with the natal chart as an optional layer.

`artifacts/api-server/src/lib/activityCorrespondences.ts` — **57 activities**,
each with: weighted planetary significators, favourable hour rulers, an aspect
palette (soft vs hard-as-fuel), Moon-sign affinities, **houses** (the personal
layer), a phase preference, a VOC stance, a Mercury-retrograde stance, and a
mapping to the app's scheduling window types.

`artifacts/tides/src/components/ElectionPicker.tsx` — **this is "the Compass"**.
Browse activities, pick one, get tiered times: ● good (planetary hours, Moon
aspects, sign days) and ★ great (**your natal houses/planets in play, standing
sky aspects, or stacked conditions**). One tap schedules a window. It currently
renders inside the Plan tab.

So the tiering already encodes convergence, globally *and* personally. The
owner's instruction is to **centre it**.

Also already wired: `matchActivity()` maps free text to an activity, and every
task is diagnosed to a ruling planet at creation
(`associateDeterministic(title)`). The bridge from "a task on your list" to
"and here is when it converges" mostly exists.

**What is NOT convergence, and should be rebuilt or retired:**
`/api/tides/best-times` answers "when should I do X this week" by finding peaks
in a blended elemental scalar. That is the same ontology error just removed
from the week chart — a single number mixing unrelated quantities — still live
in the surface that most resembles the intended future. It should be re-based
on the election engine rather than extended.

---

## 3. Proposed shape

**Home — the dashboard.** The page people live on. Widgets, one strong default
arrangement. Customisability is explicitly **deferred** (owner: "customizability
can come later"). Ranked by the owner:

1. **The Compass** — pick an activity, see when it converges. Centred.
2. **The to-do dump** — everything, in one view. "The capacity to see all of
   one's tasks in a single view is important."
3. **Loose work with reasons** — "encouragement to do specific tasks for
   specific reasons". This is the task→activity→window bridge above.
4. **The day's shape** — with **convergence windows highlighted on it**.
5. **Guiding Stars** — visible, not central.
6. **The log** — appears *only if the person has already engaged that day*, and
   **logging should look like crossing off to-dos**, not a separate ritual.
7. **The tide** — now just a widget.

**Today — the day in time.** One axis (or a list of times): planetary hours,
Moon aspects, ingresses, VOC gates, your commitments, and the convergence
windows, laid against the clock. Crucially: **"there can be different hero
moments within a single day"** — the day has several peaks for several
different activities, not one summary verdict.

**Compass — its own surface too.** The owner wants convergence in both places:
a widget on home, and a full surface, because "when does X line up" is a
question people arrive with.

---

## 4. Decisions already made — please don't relitigate

- Customisability is deferred; the default arrangement is the deliverable.
- The tide is demoted to a widget. It is not the organising idea any more.
- Guiding Stars stay, de-emphasised.
- The astro recedes into the rail; users are assumed astro-literate.
- The intake ("what do you want / need / are nourished by") needs to become
  more robust — the owner agrees, and it is upstream of the dashboard being
  any good.

## 5. What survives from the previous direction, and what does not

Worth being precise, because "simplify" bundled two different projects:

- **Survives — removing contradictions and false precision.** The published
  "Energy 89%" (which was lunar illumination plus two bonuses), the sine wave
  labelled as a cycle nothing computed, one fact told in three places. An
  astro-literate audience is *more* offended by these, not less.
- **Up for revision — collapsing to one recommendation.** "Strongest fit right
  now" as the centrepiece assumed a user who wanted to be told. It becomes one
  widget among several.

---

## 6. Open questions — critique especially wanted here

1. **Sequencing.** What is the first thing to build? Candidates: (a) the
   convergence surface re-based on the election engine; (b) the single-axis day
   view; (c) the unified task view; (d) the intake. The owner's ranking implies
   the Compass first, but the intake may gate everything downstream.
2. **What does a convergence window actually claim?** ★ currently means "natal
   houses/planets in play OR standing aspects OR stacked conditions" — an OR
   across quite different kinds of evidence. Should it be a count of agreeing
   *source families* (the discipline used elsewhere in the engine), so that
   convergence means the same thing everywhere?
3. **"Different hero moments within a single day"** — how many, and chosen how?
   The risk is a day that highlights six windows and therefore highlights
   nothing.
4. **Global vs personal convergence** — shown together on one axis, or
   separated? A user without a birth time gets no houses, so the personal layer
   is sometimes absent; how should the surface degrade?
5. **The to-do dump vs. the existing task model.** Tasks currently carry a
   due date, a planet, an optional Guiding Star, est. minutes and energy. Is
   the "dump" a new flat inbox, or a view over what exists?
6. **Does the log-as-checkoff idea collapse two models?** Wins are currently
   auto-detected plus named; tasks are checked off. Merging them is appealing
   but they mean different things.

## 7. Risks

- **A widget dashboard with a weak default** is a slower way to look at
  nothing. The default arrangement carries the whole product.
- **Convergence inflation.** If the engine can always find a "great" window,
  the tier means nothing. It needs a measured fire rate — the same calibration
  discipline used for the lead module, where thresholds were set from an
  observed distribution rather than chosen by taste.
- **Home and Today both becoming everything.** The split only helps if each
  refuses the other's job.

## 8. Constraints that hold regardless

Non-negotiable, from the product's constitution and hard-won fixes:
- Never manufacture significance; the app may decline and say a day is quiet.
- Nothing is scheduled without consent; windows are never silently moved.
- Coherence, not favourability. No outcome promises.
- One fact, one source. Two surfaces describing the same thing must read from
  one computation — this has broken three times.
- Determinism where it counts: the LLM explains, it never decides timing.
- Load: the Today page is ~18 API requests on a cold production load. New
  surfaces should not each add their own.

---

# ADDENDUM — critique received, and the two claims measured (2026-08-03)

The critique's build order is accepted: **one canonical, batchable convergence
definition first; then Compass interrogates it, Home summarises it, Today places
it on the clock.** Both code claims were checked against the engine rather than
taken on trust. One is real but dormant; one is real outright. The measurement
also inverted the headline risk.

Correction to §2 above: `ACTIVITIES.length` is **46**, not 57. The earlier
figure came from grepping `key:` across the file, which caught other structures.

## Claim 1 — GREAT can be reached by one source family counted twice

**Structurally true.** `greatSignals = (stacked ? 1 : 0) + daySources.length` is
computed *before* the emit-time `new Set(...)` dedupe, and three separate
branches push the literal `"natal"`: a significator transiting a governing
house, the Moon crossing one, and a significator contacting its own natal place.
Two of those satisfy `greatSignals >= 2` with one family.

**Empirically dormant on the sample.** Measured over 30 days across all 46
activities on a real natal chart: **zero** GREAT windows resolved to fewer than
two distinct families. The distinct-family histogram for GREAT was `{3: 9}` —
every single one carried exactly three. The branches that push "natal" evidently
co-occur with other families in practice.

So: a latent defect, not an active one. Worth fixing before the tier is
promoted, because promotion changes the exposure — but it is not currently
mis-tiering anything, and it should not be described as a bug users have hit.

## Claim 2 — `personalized` is response-level, not window-level

**Confirmed outright.** `personalized: !!natal` at the point of return, with the
field documented as "natal chart was available". It says nothing about whether
any given window contains personal testimony. The four-way distinction the
critique proposes (chart available / this window has personal testimony / it
supports this activity / it changed the tier) is the right correction.

## The measurement that changes the plan

| | over 30 days, 46 activities, one real chart |
|---|---|
| `good` windows | **635** |
| `great` windows | **9** |
| activities producing any `great` | **8 of 46** |

**The risk is not convergence inflation. It is convergence starvation.**

The critique reasonably expected "a few per week for a tracked activity" and
warned that an engine which can always find a great window makes the tier
meaningless. The opposite is true: across an entire month and every activity in
the table, "great" fires nine times, and 38 of 46 activities never converge at
all. A Home page centred on convergence would, most days, have nothing to
promote.

This does not weaken the proposed semantics — **supported / convergent /
personally reinforced** is still the right vocabulary, and it is more useful now
than it looked, because `supported` (635/month) is clearly the workhorse tier
and `convergent` is genuinely rare. What it changes is the *thresholds*, and
the design of the empty state:

1. Thresholds must be set from this distribution, not from an assumption about
   scarcity in either direction. The harness now exists:
   `tools/convergence-calibration.test.ts`, opt-in via `npx vitest run --dir
   tools` (~170s, deliberately kept out of the deploy's `pnpm test`).
2. **Refusal is now the common case, not the safety valve.** The critique's
   "no genuinely convergent window appears this week" copy will be shown often.
   It has to be a good state, not an apology.
3. Home's Compass module cannot be a list of convergent windows, because most
   days there will be none. It has to lead with `supported`, and treat
   `convergent` as the occasional highlight.

## Open questions this raises for a further pass

1. Given the measured scarcity, is `convergent` the right bar — or should the
   two-independent-family rule be relaxed, with a third rarer tier above it?
2. Should the calibration target be **per tracked activity** (a user's 5–8
   palette) rather than across all 46? Nine per month across everything is
   starvation; nine per month across a five-activity palette might be right.
3. Does the family-count rule need weighting? Three weak families agreeing may
   deserve less than two strong ones, and a flat count cannot say so.
