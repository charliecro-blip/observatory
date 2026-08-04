# Decision: take the Cultivator's ideas, not its container (2026-08-03)

Owner said "let's adopt", then narrowed it: *"I really only meant the portions
that we need — that's for you to decide."* So this supersedes the wholesale
version.

**We adopt three ideas. We do not adopt the cultivations system.**

## Why not the system

GPT's review of the dashboard plan warned, about the to-do dump: *"Do not
create a second task system."* The cultivations table **is** a second task
system. It carries its own title, status, frequency, domain, element and
check-in history — a parallel object to tasks, with a parallel completion
model, sitting beside Guiding Stars which already claim "a thing you are
tending over time".

Adopting the container would leave the app with three answers to "what am I
working on" instead of the current two. The findings doc called that out as the
problem; wholesale adoption would have entrenched it.

Its 14 domains, `element`/`elements`, `relatedHouse` and
`relatedBodyWeatherTags` are also duplicative or legacy: ACTIVITIES already
carries a richer categorisation that actually drives timing, and the body-
weather tags belong to the health-tracker the table was written for. The
`/element-balance` and `/element-report` endpoints were built on that app's
assumptions and have never been exercised by Compass.

## The three ideas we take, and where each belongs

**1. `minimumViable` → onto ACTIVITIES, not onto a user's instance.**
"The minimum viable version of this practice during adverse timing." This is a
property of the KIND of activity — the reduced form of hard training is the
same reduced form for everyone — so it belongs in the correspondence table
where every window can reach it. That is what lets a `qualified` window finish
its own sentence: *"strong timing, but Mercury is retrograde — do the minimum
viable version"* instead of a silent demotion.

**2. Plural planetary association → merges with the significator restructure.**
`favoredPlanets` / `cautionPlanets` being arrays is the right instinct, and it
is the same change GPT asked for independently: significators need `role` and
`system`, not one planet and a weight. So this is not a separate piece of work.
Task #43's planetary facets are built on ACTIVITIES, against the same fields.

**3. Richer completion → extend the task we have.**
`effortLevel`, `durationMinutes`, `practicesCompleted[]` are better than a
tick, and the owner wants logging to look like crossing things off. So they
extend the existing task completion path — the one that already stamps
`completedAt` and `startedAt` — rather than arriving as a second history.

## What happens to the code that exists

`routes/cultivations.ts` and its two tables stay in the repo, unmounted or
mounted, but stop being a destination. Nothing new is built against them. They
are not deleted in this pass because deletion is cheap to do later and
impossible to undo cheaply, and production holds zero rows either way.

Revised from the earlier version of this document, which said the Cultivator
would become the tending surface and the nine endpoints would become real
product. That was adoption of the container, and it was more than we need.
