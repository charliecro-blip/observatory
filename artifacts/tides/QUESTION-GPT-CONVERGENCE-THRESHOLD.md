# Question for critique: does an hour × Moon stack count as one family or two?

This is the last undecided piece of the convergence contract, and it is now the
only thing standing between us and a threshold. We have deliberately not moved
it, because moving it to hit a number is the failure mode this whole exercise
exists to avoid.

## What we did, and what it did to the numbers

Your motion recommendation is built. Cap narrowed to traditional significators
of inceptions only; activity modes assigned; the two axes split into
`supportLevel` (agreement) and `suitability` (fitness), with structured
reasons, derived rather than mutated.

Measured over a month, all 46 activities, one real natal chart:

| month | `supported` | `convergent` | activities with any convergence |
|---|---|---|---|
| August (eclipse season) | 629 | 15 | 12 of 46 |
| October (ordinary) | 430 | **214** | **38 of 46** |

**The starvation finding is dead.** Nine convergent windows a month was an
artifact of the category error stacked on an eclipse season, not a property of
the sky. Your instinct that scarcity might be coming from the candidate
architecture rather than the threshold was half right — it was coming from the
cap.

But 214 a month is ~4.6 per activity, and we do not think that is scarce enough
to mean anything. The tier has swung from unreachable to ordinary without the
convergence DEFINITION changing at all.

## The specific convention we preserved, and now need ruled on

The engine generates timed candidates from planetary hours, Moon-aspect swells,
Moon-sign affinity and VOC periods. When an hour and a Moon aspect overlap it
emits a merged candidate carrying both.

The tier test currently reads:

```ts
const stacked = c.sources.includes("moon") && c.sources.includes("hour");
const greatSignals = (stacked ? 1 : 0) + distinctDayFamilies.length;
```

**The hour × Moon stack counts as ONE**, even though it spans two of our
canonical families (`planetary-time` and `lunar-contact`). That convention
predates the family work — the owner's note in 2026-07-20 was that one signal
was not scarce enough, because Venus hours recur every day and a governing
house holds the Moon for days.

When we normalised family counting we deliberately preserved it, so that a bug
fix could not smuggle in a threshold change. That preservation is now the
question.

Under your definition — *"at least two independent source families, at least
one moment-specific"* — an hour and a Moon aspect **are** two independent
families, both moment-specific. That reading would make every stacked window
convergent, which would raise 214 substantially higher.

## What we actually want to know

1. **Are a planetary hour and a Moon-to-significator aspect independent
   testimony, or two views of one thing?** Our unease: the hour is a division
   of the day by a fixed rotation, and the Moon aspect is a real celestial
   event. They are independent in cause. But an hour recurs every day for
   every activity with that ruler, which makes it feel more like ambient
   condition than event — the same reasoning that led us to bar ambient
   families from *leading* the daily reading elsewhere in the engine.

2. **If they are independent, does convergence need three families rather than
   two** to stay meaningful — or does the answer lie in weighting rather than
   counting? You noted that "three weak families agreeing may deserve less than
   two strong ones, and a flat count cannot say so."

3. **Should the planetary hour be demoted from a convergence-eligible family
   to a qualifier** — something that sharpens a window that already converges,
   rather than one of the voices establishing that it does? That is the
   ambient/event distinction we already enforce in the daily reading, applied
   here.

4. **Is per-activity-per-month the right unit to calibrate against at all?**
   214 across 46 activities is ~4.6 each; against a five-activity palette it
   would be ~23 a month, or nearly one a day. You argued calibration should
   target the palette for usefulness and the whole engine for coherence. If
   convergence should feel like an event, roughly what rate per tracked
   activity would you defend — and is that a number we should be deriving from
   the doctrine rather than from product feel?

## What we will not do

Move the threshold until the palette produces a comfortable amount of content.
You named that failure precisely: it would make "convergent" mean *whatever
threshold produces enough for this user*. We would rather ship a tier that
fires rarely and means something than one tuned to fill a dashboard.

## One gap in our own evidence

Variant A was only ever measured on the eclipse month, so the October figure
has no A baseline beside it. We are reconstructing A on October by checking, for
each B-convergent window, whether A's rule would have capped it — which gives an
exact delta rather than the inference we are currently relying on. If that
changes the story we will send a correction.
