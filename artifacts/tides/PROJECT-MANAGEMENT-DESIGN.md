# Serious project management in Tides — persona + facilitation design

Owner asked: do we have a heavy-PM persona, and how could a *big* project be
facilitated end-to-end? The 30-persona study has no true PM archetype (closest:
Marcus the founder #6, Elena the freelancer #7, Rachel the ADHD PM #9). Here's
persona #31, and a facilitation design grounded in the pieces the app already
has. Design only — nothing built.

## Persona: Nadia, 39 — program lead, launching a product in 4 months

Runs real projects for a living; lives in Linear/Asana at work but wants her
*own* big personal projects (write the book, launch the side business, renovate
the house) held somewhere that respects timing, not just deadlines. She thinks
in **milestones → tasks → weeks**, and she wants three things a normal to-do app
doesn't give her:
1. **A place to break a big aim into a real structure** and see the whole arc.
2. **The sky as a scheduling advisor** — not "when is it due" but "when will
   this kind of work go well," which is exactly the app's edge.
3. **Progress that rolls up** — so the book *feels* 40% done, not "17 loose
   tasks somewhere."

Where she bounces today: a Guiding Star can hold steps, and the Planner can
weave tasks, but nothing connects them into one facilitated arc. Steps don't
have their own tasks; the Planner doesn't know about milestones; progress
doesn't roll up from tasks → step → star. The scaffolding is all there,
unjoined.

## What already exists (the unjoined pieces)

- **Guiding Star** = the big aim (goals table), element-tagged, season-anchored.
- **Steps** = milestones on a backing project (goalId = star.id) — ordered
  sub-goals, already in the UI ("BROKEN DOWN INTO").
- **Tasks** = the atoms, can link to a goal; the **Planner** weaves them into
  good sky windows with timing tiers.
- **Progress** = habits/sessions roll into a star's count, but tasks and steps
  don't.

## The facilitation arc (what to build)

**1 · Break down — AI-assisted milestone scaffolding.**
On a Guiding Star, "Break this into steps" → AI proposes 4–8 milestones for a
"launch a product" / "write a book" aim (reuse the associate/plan AI). Each
milestone gets an element signature (research = air, build = earth, launch =
fire) so its work lands in the right sky windows later.

**2 · Populate — tasks under a step.**
Each step becomes a small task list (tasks gain a `milestoneId`, nullable —
one migration). This is the missing join: the big aim now has real atoms,
grouped by milestone.

**3 · Weave — the Planner reads the structure.**
The weaver already places tasks in tiered windows; extend it to accept "weave
this whole star" — pull every open task across its milestones, respect
milestone order (don't schedule step 3's tasks before step 1's), and lay a
multi-week plan. This is where Tides beats Asana: the schedule is timing-aware,
not just deadline-aware.

**4 · Roll up — progress that's felt.**
Tasks-done / tasks-total per step; steps-done / total per star → one progress
ring on the star. The book *reads* 40% done. A "burndown" against the
season-anchor (Saturn through your 9th until March) gives the arc a real
horizon without an invented deadline.

**5 · The review loop.**
Weekly (or at each new moon — the app's natural reset), "here's what moved,
here's what's next, here's the sky for the coming week's work." Ties the PM
flow into the ritual + Log that already exist.

## Where it lives

Inside the Guiding Star — expand a star into a **project view**: the arc of
milestones, each with its tasks and progress, a "weave the next stretch"
button, and the rollup ring. No new tab; the big-project surface is just a
Guiding Star opened all the way up. Keeps the "everything serves a guiding
star" spine intact.

## The one differentiator to protect

Every PM tool schedules by deadline. Tides schedules by **what the sky supports
for that kind of work** — research in clear/air windows, hard building in
earth, launches on rising fire. Nadia can get a Gantt chart anywhere; she
can't get "do the deep-writing milestone during your Deep-tide mornings this
month" anywhere else. The facilitation should foreground *that*, not try to
out-Gantt Asana.

## Smallest first build (if we proceed)

`tasks.milestoneId` (one migration) + "tasks under a step" in the Star UI +
progress rollup ring. That alone turns a Guiding Star into a real project.
Weaving-the-whole-star and AI breakdown are the second and third increments.
