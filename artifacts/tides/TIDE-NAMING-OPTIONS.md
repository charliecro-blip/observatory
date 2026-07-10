# The four tides — naming options (owner decision)

The four day-characters map to the four elements. Current names:
**Deep (water) · Surge (fire) · Building (earth) · Clear (air).**

Owner's concern: these need to be either very well explained, or reconsidered.
The explication is now shipped — a "?" by the tide on Today opens a key with
each name, its element, its essence, and *why it's named that*
(`CHARACTER_WHY` in `lib/elements.ts`). This doc is the *rename* decision,
which is yours. No code has been changed to any of these alternatives.

## What makes a good name here

A good set would ideally be: (1) instantly evocative of the element, (2)
evocative of what the time is *for*, (3) consistent as parts of speech, (4)
short. The current set is strong on 1–2, weak on 3 (Deep=adjective,
Surge=noun, Building=gerund, Clear=adjective — grammatically mixed).

## The options

**A · Keep current, lean on the explication (recommended if the key tests well)**
Deep · Surge · Building · Clear. Pros: already everywhere, evocative, the
tide metaphor ("deep water / a surge") is intact. Cons: the grammar mix; the
element mapping isn't self-evident without the key.

**B · Verb-consistent (all what-you-do)**
Feel · Act · Build · Think. Pros: dead clear what each is *for*, consistent
verbs, zero astrology. Cons: loses the water/tide poetry; "Think" day sounds
clinical.

**C · Tide-literal (all states of water)**
Deep · Swell · Steady · Bright. Pros: all four stay inside the water/tide
metaphor (the app's master frame); Swell keeps fire's rising energy, Steady
suits earth, Bright suits air's clarity. Cons: Steady/Bright drift from the
element a bit.

**D · Element-forward (name the element, gloss the mood)**
Water · Fire · Earth · Air, each shown with its verb ("Water — feel & rest").
Pros: honest, teaches the real vocabulary, no key needed. Cons: abandons the
weather-not-astrology positioning that the whole app rests on; a "Fire day"
reads more astrological than "Surge."

**E · Adjective-consistent (fix only the grammar)**
Deep · Rising · Building → **Steady/Grounded** · Clear. Minimal change: only
"Surge" (noun) becomes an adjective. E.g. Deep · Fierce · Grounded · Clear,
or Deep · Bright · Grounded · Clear. Pros: keeps most of the current
recognition, fixes the parts-of-speech mix. Cons: "Fierce" may be too hot;
picking the fire word is the whole decision.

## My lean

**A or E.** The names are actually good — the real problem the owner felt is
that they were *unexplained*, which the shipped key fixes. If you still want a
tweak, **E** (make them all adjectives: e.g. *Deep · Bright · Grounded ·
Clear*, with fire = "Bright" or "Fierce") is the lowest-risk improvement — it
keeps the recognition you've built while fixing the grammatical wobble. I'd
avoid **D** (breaks the weather framing) and **B** (loses the poetry) unless
user testing shows the current names genuinely don't land.

To change them, edit `CHARACTER_LABEL` in `lib/elements.ts` — it's the single
source of truth, so every surface updates at once.
