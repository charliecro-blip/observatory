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
