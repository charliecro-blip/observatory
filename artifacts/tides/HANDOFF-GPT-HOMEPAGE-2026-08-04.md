# Handoff to GPT — Compass homepage design

Self-contained. You do not need the codebase.

## The product in four lines

Compass is an astrology-based timing app (closed beta, compass.day). A
deterministic engine — own ephemeris, planetary hours, dignity, classical
electional rules — computes when the sky supports a given activity. No LLM
touches timing. The audience is astro-literate; "simplify to one thing" is
probably the wrong target for them.

The owner's stated centre of the product: **"the really important things are
moments of convergence for particular activities — globally, especially, as well
as for someone personally."**

## What Home is now

Landing page. Fixed order, top to bottom:

1. **Right Now** — conditional. Appears only when the Moon is void of course,
   carrying a sign-specific reading ("The urge to start, with nothing that will
   take hold… Burn it physically. Start nothing you'd have to defend tomorrow.")
   Absent otherwise.
2. **The Compass** — a picker. 9 category chips (Body, Mind, Craft & work, Love
   & intimacy, Social, Home, Money, Spirit, Launches & stakes). Choosing one
   reveals ~8 activity chips. Choosing an activity returns elected windows over
   a day/week/month, tiered good vs great (great requires a birth chart).
3. **Everything you're holding** — every open task in one list, grouped
   overdue / today / no date / later. Free-text add, one line, no form.
4. **Guiding Stars** — long-term aims, one compact row of chips. Deliberately
   not central.
5. **Today's log** — appears only after something has been crossed off today.
   Shaped like the task list, not like a journal prompt.

A separate **Today** tab keeps the day laid out in time with the woven
astrological reading. A left rail carries live sky (season, Moon, hour) on every
page. So Home does **not** need to carry the sky — that job is taken.

## Constraints that are settled — do not reopen

- **Customisability is deferred.** The answer must be one fixed order, not "let
  the user choose." Saying "make it configurable" is a non-answer.
- **No tide hero on Home.** The owner ruled the tide is "a widget now" and
  "there can be different hero moments within a single day." A single curve
  across the top asserts one shape for the whole day.
- **Don't duplicate Today.** The woven reading lives there.
- **Nothing invented.** The app refuses to fill slots with plausible activity.
  If a good window exists and nothing in the person's life wants it, the honest
  output is an empty slot.
- **A disclaimer means the design is wrong.** Standing owner rule: if a surface
  needs a caption explaining what it isn't, rebuild the surface.

## The question, and my position

**Q1 — order.** Compass-first (you decide, then see what you hold) or dump-first
(you see what you hold, then ask when)? Compass-first opens with the app's
distinctive value but asks "what are you deciding about?" before the person has
remembered what they're carrying. Dump-first is the more natural task flow but
pushes the astrology further back — which the owner half wants and half doesn't.

**Q2 — and this is the one I think actually matters.** *The Compass is currently
a picker, not a compass.* It presents 9 categories and 8 chips and waits. A
compass points. Given that the stated centre of the product is **moments of
convergence**, a surface that makes you go looking for convergence is arguably
the wrong shape regardless of where it sits on the page.

The inversion I'd argue for: Home leads with **today's convergences, computed** —
"three things have unusual support today," drawn from what the person actually
holds (their tasks, their Guiding Stars) plus the strong global windows — with
the category picker demoted to "something else?" underneath.

That would make Home answer rather than ask, and it uses the engine's real
output instead of making the person query it. It also connects the two halves of
the page, which currently have **no line between them at all**: there are eight
tasks and a timing engine sitting on the same screen, and nothing relates them.

**Q3 — the empty case.** If Home leads with computed convergences, what does it
say on a day with none? "Nothing converges today" is honest and possibly the
most valuable thing the app can say — it is the refusal that makes the other
days mean something. But it is also a blank homepage. Is that shippable, and if
so what carries the page?

**Q4 — cold start.** A new user has no tasks and no Guiding Stars, so a
convergence surface computed from what they hold has nothing to compute from.
The picker degrades gracefully here and the convergence surface does not. Does
that argue for keeping the picker primary, or for a distinct first-run state?

## What would be most useful back

A recommendation on Q2 specifically — is "compute and show convergences" right,
or is the picker's explicitness actually the better serving of an astro-literate
audience who want to ask their own question? And if the inversion is right, what
carries Q3's empty day.

Concrete disagreement is more useful than synthesis. If you think the current
design is correct, say so and say why.
