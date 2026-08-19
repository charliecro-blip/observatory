# Compass — copy inventory for the Astrolyrica voice pass

Paste this whole file into the Astrolyrica chat. It contains **every
user-facing copy table in the app**, verbatim, plus the rules each one has to
satisfy. Nothing here needs repo access — the strings are all inline.

What comes back should be the same tables with the same keys and the same
shapes, rewritten in the Astrolyrica voice. Keys and structure are load-bearing
(code indexes them); only the strings change.

---

## ADDENDUM — 2026-08-12 (read this first)

The tables below are unchanged and still current. This addendum adds two new
surfaces and one vocabulary consult. Same rules apply throughout.

### A1. New surface: the turning-point check-in (live today)

A one-page reset offered at real astrological turning points (new moons,
eclipses, solstices, retrograde stations). Today's, verbatim:

- Banner: **"Today is a new moon and a solar eclipse in Leo. Ten minutes to
  reset?"** · buttons "Take ten minutes →" / "Not now"
- Page title: **"New Moon in Leo · Solar Eclipse"** · subtitle "About ten
  minutes. Yours to keep or skip."
- The read, ¶1: **"Today's new moon is a solar eclipse in Leo, near the
  Moon's south node. A new moon opens a cycle. An eclipse turns the volume
  up. The south node points backward — this one favors letting go over
  launching."**
- The read, ¶2: **"Keep the reset small: name what you're done carrying,
  check that your stars still point somewhere true, and call one shot for
  the month."**
- Prompt 1 label: "What are you done carrying?" · hint "One line. It doesn't
  have to be graceful."
- Prompt 2 label: "Your stars — still true?" · per-star buttons "still true"
  / "needs a look"
- Prompt 3 label: "One shot for this cycle" · hint "One thing, by the next
  new moon"
- Submit: "Keep this" · disabled note "Write at least one line to keep it."
  · enabled note "Stays on your homepage until the next new moon."
- Kept card: eyebrow "This cycle · set at the Leo eclipse" · sub "Setting
  down: {their line}" · "{n} stars marked for a look →" · "edit"

Specific asks, beyond a general read:
1. **"An eclipse turns the volume up"** — is there a truer image? It must
   amplify without threatening (rules 1–2).
2. **"The south node points backward"** — astrologically loose on purpose.
   Offer 2–3 alternate framings of south-node release for a stranger.
3. The prompts themselves: keep the questions this plain, but offer sharper
   verbs if you have them.

### A2. Vocabulary consult: the weather layer (WORLDBOOK.md, new)

Compass's layer-1 forecast language is moving from tide words to weather
words. The binding rule: **dynamics, never valence** — weather's motion
words yes (still, building, clearing), weather's judgment words never (fair,
foul, good, bad), because "fair" is favorability sneaking back in. Every
word must land for a stranger with no glossary. Current candidates, one
word-family per engine axis:

| Axis | Candidates | Question for you |
|---|---|---|
| Energy (how charged) | still · stirring · full | better height-words with no valence? |
| Trend (direction) | building · holding · clearing | does "holding" read as a direction? |
| Coherence (agreement) | settled · mixed · unsettled | is "unsettled" too negative-coded? |
| Standing conditions | "a Mercury advisory" | advisory vs watch vs plainer? |
| Personal overlay | "…and gusty where you are" | keep or better? |

A composed forecast should read like: *"Full and building, settled — gusty
where you are."* React to the composition shape too, not just the words.

### A3. Draft request: the next cycle (Aug 28 — lunar eclipse, Pisces 5°)

The next turning point is a full-moon lunar eclipse, 16 days after this
solar one. Full-moon check-ins are HARVEST, not intention: the prompts pull
what actually happened ("What came through since the new moon?" · "What's
now visible that wasn't?") and never set new goals. Draft the read (two
short paragraphs, same shape as A1) for a Pisces full-moon lunar eclipse,
under all ten rules. Node polarity deliberately unstated — the owner will
curate that detail against the engine before it ships.

---

## What Compass is, in one paragraph

Compass reads the sky around a moment and turns it into a plain suggestion —
what this hour is good for, and how to go about it. It is a timing app, not a
prediction app. The astrology is computed deterministically from an ephemeris;
an LLM never decides timing, only explains it. The product's stance is that the
sky describes *qualities of time*, and the user matches their own activities to
them — so almost all copy is about **ways of going about things**, not about
what will happen.

## Non-negotiable rules for any replacement copy

These are product commitments, not style preferences. Copy that breaks one is
wrong even if it reads beautifully.

1. **Never manufacture significance.** On a quiet day the app says so. No line
   may imply something is happening when nothing is.
2. **Describe, don't promise.** Coherence, not favourability. "A charged hour
   can be a difficult one." Never predict an outcome or guarantee a result.
3. **Void-of-course forbids beginnings.** Every VOC string must be a re-verb —
   finish, return, revise, repair. Never "start", "begin", "launch".
4. **Wind-down forbids arousal.** Nothing high-arousal in the last two hours
   before sleep — no "train hard", "compete", "sprint", "perform", "publish".
   This is enforced by tests.
5. **Name an outlet, not just a hazard.** Every shadow has a `work` — where the
   same energy can legitimately go. A difficulty named without an outlet is a
   warning label. (This field was added *because* the day's edge only warned.)
6. **No jargon in plain clothes.** "your core self" was replaced by "your sense
   of yourself" — the first names a concept, the second names something a
   reader recognises in themselves.
7. **No endorsement language.** "Stacked support" was replaced, because
   "support" implied the sky was backing the user's plan. The computed fact is
   only that several independent layers point the same way.
8. **Nothing circular.** Fortune was defined as "your fortune".
9. **Rest and company are first-class**, not consolation prizes. Being depleted
   or wanting people are legitimate ways to spend an hour.
10. **Concrete enough to act on within the hour.** "Stillness counts as the
    work" is good. "Weight arriving, not yet landed" is evocative and useless.

## The three defects found by reading the live app (the failure modes to hunt)

- **"Stacked support — 3 other layers of the sky agree."** → endorsement.
- **"Moon grinds against your core self (0.7°)"** → concept, not experience.
- **"Fortune: your fortune"** → circular definition.

All three had passed review as code. They were only caught by reading them on
screen, which is why this pass is worth doing across the whole vocabulary.

## Voice notes

- Second person, lowercase, no exclamation marks.
- Short. Most of these render at 10–12px in a dense dashboard.
- British-ish plainness over American motivational register. No "crush it",
  no "unlock", no "harness".
- The app is allowed to decline, to say nothing is happening, and to tell
  someone to rest. It should never sound like it is selling them their day.

---

# The tables

### `PLANET_ROADS` — `artifacts/api-server/src/lib/synthesis.ts`
gift / shadow / work for the seven visible planets. `work` is the outlet — where the shadow's energy can legitimately go. Used by the day's edge line and by transit notes.

```ts
const PLANET_ROADS: Record<string, { gift: string; shadow: string; work: string }> = {
  Sun:     { gift: "vitality and warmth", shadow: "pride, needing to be the center",
             work: "put the wanting-to-be-seen into making something worth seeing" },
  Moon:    { gift: "care and attunement", shadow: "moodiness, clinging",
             work: "feel it deliberately and briefly, rather than all day sideways" },
  Mercury: { gift: "clarity and curiosity", shadow: "overthinking, scattered nerves",
             work: "write the loop down — it stops circling once it is on paper" },
  Venus:   { gift: "warmth and ease", shadow: "indulgence, avoiding the hard word",
             work: "have the pleasant thing and say the true thing, in that order" },
  Mars:    { gift: "courage and decisive effort", shadow: "impatience, a short fuse",
             work: "spend the edge on something physical and finishable, before it finds a person" },
  Jupiter: { gift: "faith and generosity", shadow: "overreach, glossing the detail",
             work: "say yes to the size, then check the one detail you would rather skip" },
  Saturn:  { gift: "discipline and endurance", shadow: "rigidity, fear, gloom",
             work: "do the smallest real piece — the weight lifts by moving, not by resolving" },
};
```

### `OUTER_THEME` — `artifacts/api-server/src/lib/synthesis.ts`
same shape for the three outers, plus a `verb`.

```ts
const OUTER_THEME: Record<string, { verb: string; gift: string; shadow: string; work: string }> = {
  Uranus:  { verb: "breaking the old pattern", gift: "fresh air and honest change", shadow: "restlessness, rupture for its own sake",
             work: "change one real thing on purpose, so the restlessness has somewhere to land" },
  Neptune: { verb: "dissolving and imagining", gift: "imagination and compassion", shadow: "fog, drift, self-deception",
             work: "make something or rest — both use the fog; deciding in it does not" },
  Pluto:   { verb: "deep renovation", gift: "depth and renewal", shadow: "control, obsession",
             work: "name what you are actually trying to control, then loosen one grip" },
};
```

### `ELEMENT_ROADS` — `artifacts/api-server/src/lib/synthesis.ts`
gift / shadow per element.

```ts
const ELEMENT_ROADS: Record<Element, { gift: string; shadow: string }> = {
  fire:  { gift: "courage and initiative", shadow: "burnout, recklessness" },
  earth: { gift: "groundedness and follow-through", shadow: "rigidity, drudgery, perfectionism" },
  air:   { gift: "perception and perspective", shadow: "overthinking, all talk and no move" },
  water: { gift: "empathy and renewal", shadow: "overwhelm, escapism, withdrawal" },
};
```

### `NATAL_POINT_WORD` — `artifacts/api-server/src/lib/synthesis.ts`
what a natal point MEANS when a transit lands on it. Appears as: 'Moon grinds against {this} (0.7°)'.

```ts
const NATAL_POINT_WORD: Record<string, string> = {
  Sun: "your sense of yourself", Moon: "your inner life", Mercury: "your thinking", Venus: "your relating",
  Mars: "your drive", Jupiter: "your growth", Saturn: "your foundations",
  Uranus: "your independence", Neptune: "your imagination", Pluto: "your depths",
  ASC: "how you meet the world", MC: "your work in the world",
  Fortune: "your body and resources", // the Lot — defining it as "your fortune" said nothing
};
```

### `BY_PART` — `artifacts/tides/src/lib/approach.ts`
the core activity vocabulary: planet x time-of-day. One is picked by a stable rotation; the refresh arrow cycles them. 3-5 per band.

```ts
const BY_PART: Record<string, Partial<Record<DayPart, string[]>>> = {
  Sun: {
    early:   ["set the day's one intention", "get light on your face", "decide what today is actually for"],
    morning: ["make the decision as yourself", "lead the meeting", "put your name on it", "ask for the thing directly"],
    midday:  ["be seen — present, publish", "claim credit honestly", "back someone publicly", "make the call you've been deferring"],
    evening: ["say the thing you meant to say", "let something you made be seen", "give someone your full attention", "celebrate a finished thing"],
    winddown:["name one thing that went right", "put the day down deliberately", "thank someone specifically"],
    night:   ["let it keep until morning"],
  },
  Moon: {
    early:   ["notice what mood you woke in", "eat something properly", "move slowly on purpose"],
    morning: ["tend home & body", "call your people", "put the house back in order", "cook ahead"],
    midday:  ["cook for someone", "check in with someone who'd like it", "tend the thing you've been neglecting", "ask how someone actually is"],
    evening: ["water rituals — bathe, swim", "make the room comfortable", "eat with people", "put something away properly"],
    winddown:["nap without guilt", "journal the mood", "let the day settle", "make the room soft"],
    night:   ["rest — this is the hour for it", "let the feeling pass through without a verdict"],
  },
  Mercury: {
    early:   ["sort the day before it starts", "write the list", "clear the desk first", "read one thing properly"],
    morning: ["write & send", "learn the skill", "draft the difficult message", "ask the question you've been guessing at"],
    midday:  ["run the errands", "negotiate the detail", "compare the two options on paper", "teach it to someone and find the gap", "make the call, don't email"],
    evening: ["fix the words", "reply to what's outstanding", "read back what you wrote this morning", "name tomorrow's first sentence"],
    winddown:["tidy the inbox and stop", "note tomorrow's first task", "close the open loops in writing"],
    night:   ["read something undemanding", "stop deciding — write it down instead"],
  },
  Venus: {
    early:   ["make the morning pleasant on purpose", "choose what you actually like"],
    morning: ["beautify the space", "choose the pleasing option", "make the peace offering", "put care into the presentation"],
    midday:  ["reconcile & connect", "tend love & friendship", "buy the thing that lasts", "make it look the way it should"],
    evening: ["enjoy something on purpose", "share a meal", "say the affectionate thing out loud", "make plans with someone"],
    winddown:["something soft — music, a bath, company", "let it be enough", "put beauty in the room you'll wake in"],
    night:   ["comfort over effort"],
  },
  Mars: {
    early:   ["train hard", "do the brave errand first", "take the hardest task while you're fresh"],
    morning: ["train hard", "make the cut", "start the thing you've been circling", "say the direct no"],
    midday:  ["have the direct conversation", "compete at something", "clear the blocked item by force", "do the physical job"],
    evening: ["have the conversation you've been avoiding", "finish by force if needed", "throw something out", "settle the thing rather than sleep on it"],
    winddown:["cut one thing loose", "decisive tidying, then stop", "write the boundary you'll hold tomorrow"],
    night:   ["let the edge go until morning", "spend it walking, not arguing"],
  },
  Jupiter: {
    early:   ["zoom out to the larger story", "ask what this is in service of"],
    morning: ["apply & publish", "say yes bigger", "make the introduction", "aim one size higher than comfortable"],
    midday:  ["teach what you know", "plan the expansion", "make the generous offer", "back someone else's bigger idea"],
    evening: ["be generous first", "make the bigger ask", "widen the plan before narrowing it", "feed people"],
    winddown:["read something that widens the frame", "let the plan be big and unwritten", "be glad about one thing on purpose"],
    night:   ["dream it larger; write it tomorrow"],
  },
  Saturn: {
    early:   ["do the boring foundation while it's quiet", "start the thing that needs a long runway"],
    morning: ["keep the commitment", "build the part no one sees", "do the unglamorous hour first", "say what you can actually deliver"],
    midday:  ["pay the debt", "prune & cancel", "fix the thing properly rather than again", "put the structure under it"],
    evening: ["review the long game", "close the loop", "decline something to protect the rest", "check the work against the standard"],
    winddown:["put one thing in order, slowly", "the unglamorous task, done properly", "set the boundary and keep it", "end it on time, deliberately"],
    night:   ["stillness counts as the work", "one slow, small thing — or nothing"],
  },
};
```

### `VOC_FORMS` — `artifacts/tides/src/lib/approach.ts`
void-of-course forms. Every entry must be a RE-verb — the tradition's counsel is finish, don't begin.

```ts
const VOC_FORMS: Record<string, string[]> = {
  Sun:     ["revisit what you already put your name to", "re-read it before it goes out"],
  Moon:    ["rest, tidy, tend what's already yours", "return to something comforting"],
  Mercury: ["revise & re-send", "clear the backlog, start nothing new"],
  Venus:   ["return to someone you've been meaning to", "re-make something you already love"],
  Mars:    ["finish what's already in motion", "clear the decks, don't open a front"],
  Jupiter: ["return to the bigger plan and revise it", "re-read what you meant to learn"],
  Saturn:  ["close out an old obligation", "repair rather than rebuild"],
};
```

### `REGISTER` — `artifacts/tides/src/lib/alternatives.ts`
'another fit' — the same hour spent three other ways, keyed to what the engine cannot observe. `day` vs `quiet` (wind-down/night).

```ts
const REGISTER: Record<string, Record<Capacity, Forms>> = {
  Sun: {
    depleted: { day: ["do the one visible thing, then stop", "let a small win count"],
                quiet: ["name one thing that went right"] },
    restless: { day: ["walk somewhere you can be seen", "move the body toward the goal"],
                quiet: ["a slow walk, nothing strenuous"] },
    social:   { day: ["say the thing in front of someone", "let a friend see the work"],
                quiet: ["tell one person how the day went"] },
  },
  Moon: {
    depleted: { day: ["eat, rest, lower the bar on purpose", "tend the body first"],
                quiet: ["rest without earning it"] },
    restless: { day: ["walk, swim, move water", "cook something with your hands"],
                quiet: ["stretch, then stop"] },
    social:   { day: ["call the person you think of first", "be domestic with someone"],
                quiet: ["sit with someone, no agenda"] },
  },
  Mercury: {
    depleted: { day: ["sort, file, tidy — low-stakes ordering", "one small message, not the hard one"],
                quiet: ["note tomorrow's first task and close the laptop"] },
    restless: { day: ["walk and dictate", "run the errands that need legs"],
                quiet: ["walk without the phone"] },
    social:   { day: ["talk it through with someone", "teach the thing you just learned"],
                quiet: ["a light conversation, nothing decided"] },
  },
  Venus: {
    depleted: { day: ["make one thing nicer, cheaply", "choose comfort deliberately"],
                quiet: ["something soft — music, a bath"] },
    restless: { day: ["move somewhere beautiful", "dance, garden, arrange"],
                quiet: ["move slowly through a pleasant room"] },
    social:   { day: ["share a meal", "repair the thing left unsaid"],
                quiet: ["good company, low effort"] },
  },
  Mars: {
    depleted: { day: ["one decisive small thing, then stop", "clear the smallest blocked item"],
                quiet: ["cut one thing loose, then rest"] },
    restless: { day: ["train hard", "physical work with a visible end"],
                quiet: ["decisive tidying — movement without adrenaline"] },
    social:   { day: ["have the direct conversation", "do something competitive with people"],
                quiet: ["say the honest thing kindly, then leave it"] },
  },
  Jupiter: {
    depleted: { day: ["read something that widens the frame", "be generous in one cheap way"],
                quiet: ["let the plan be big and unwritten"] },
    restless: { day: ["go somewhere further than usual", "move toward the bigger version"],
                quiet: ["a wandering walk, no destination"] },
    social:   { day: ["make the bigger ask of someone", "teach, host, introduce two people"],
                quiet: ["a long conversation with no outcome"] },
  },
  Saturn: {
    depleted: { day: ["the smallest unglamorous task, done properly", "lower the commitment honestly"],
                quiet: ["stillness counts as the work"] },
    restless: { day: ["physical order — clear, sort, repair", "the maintenance you keep deferring"],
                quiet: ["put one thing in order, slowly"] },
    social:   { day: ["set the boundary out loud", "keep the promise you made someone"],
                quiet: ["say no, kindly and early"] },
  },
};
```

### `CONDITION` — `artifacts/tides/src/lib/alternatives.ts`
the three condition phrases those are keyed to.

```ts
const CONDITION: Record<Capacity, string> = {
  depleted: "if you're running on empty",
  restless: "if you need to move",
  social: "if you'd rather not be alone",
};
```

### `VOC_BY_CAPACITY` — `artifacts/tides/src/lib/alternatives.ts`
VOC overrides capacity — re-verbs again.

```ts
const VOC_BY_CAPACITY: Record<Capacity, string> = {
  depleted: "return to something already underway — start nothing",
  restless: "walk, tidy, move — but open no new front",
  social: "reconnect with someone you've been meaning to",
};
```

### `FRAMING` — `artifacts/tides/src/lib/modes.ts`
how the four zones are labelled in each temporal mode.

```ts
const FRAMING: Record<DayMode, ZoneFraming> = {
  morning: {
    moveLabel: "Where to start",
    dayLabel: "Already committed",
    dayEmpty: "Nothing committed yet — the day is open.",
    aheadLabel: "Shape of the day",
  },
  ordinary: {
    moveLabel: "Strongest fit right now",
    dayLabel: "Your day",
    dayEmpty: "Nothing on today — weave your day in Plan →",
    aheadLabel: "Ahead",
  },
  evening: {
    moveLabel: "Finish, release, or carry",
    dayLabel: "How the day went",
    dayEmpty: "Nothing was on today.",
    aheadLabel: "Tomorrow's first shift",
  },
};
```

### `CHARACTER_ESSENCE` — `artifacts/tides/src/lib/elements.ts`
The hero's one-line essence under the tide name. Renders at 15px directly under 'Surge Tide'.

```ts
export const CHARACTER_ESSENCE: Record<TideCharacter, string> = {
  deep:     "Feeling, intuition, and slow creative depth.",
  surge:    "Initiative, courage, and visible action.",
  building: "Patient craft, structure, and finishing.",
  clear:    "Thought, communication, and connection.",
};
```


### `QUIET_DAY_GUIDANCE` — same file
What the hero says when the sky is genuinely quiet. This is where rule 1 lives: the app declines rather than inventing a reading.

```ts
export const QUIET_DAY_GUIDANCE: Record<TideCharacter, string> = {
  deep:     "A quiet, still day — nothing pulling hard. Follow what feeling asks for; your rhythm is your own.",
  surge:    "A quiet, open day — no strong current. Move if you want to, but nothing's pushing. Your rhythm is your own.",
  building: "A quiet, steady day — nothing demanding. Good for ordinary, unhurried work. Your rhythm is your own.",
  clear:    "A quiet, open day — the sky is calm. Think, drift, or do nothing in particular. Your rhythm is your own.",
};
```


### `tideGuidance()` — same file
The hero's main paragraph, by character x level, with a VOC override.

```ts
export function tideGuidance(character: TideCharacter, level: string, voc = false): string {
  const grain = CHARACTER_GRAIN[character];
  const pace = LEVEL_GUIDANCE[level] ?? LEVEL_GUIDANCE.tide;
  const verbs = grain.split(", ");
  if (level === "high" || level === "rising") {
    if (voc) {
      // The energy is real — spend it on what's already moving. Naming the
      // charge and then redirecting it beats pretending the day is flat.
      return `Energy is high, but the Moon is void — spend it on what's already moving rather than on a start. Good for ${verbs.slice(0, 3).join(", ")} in service of something underway.`;
    }
    return `${pace} Lean into what this tide favors — ${verbs.slice(0, 3).join(", ")}.`;
  }
  if (level === "ebb" || level === "low") {
    // On low/ebb, favor the receptive end of the character
    const gentle = character === "surge" ? "let the fire bank — stretch, move gently, don't force a launch"
      : character === "building" ? "tidy, close loops, tend what's already built"
      : character === "clear" ? "review notes, read, let ideas settle rather than broadcast"
      : "rest fully, journal, let feeling move without acting on it";
    // Low tide and a void agree with each other — no contradiction to resolve,
    // so the void only adds the reason.
    return `${pace} ${gentle.charAt(0).toUpperCase() + gentle.slice(1)}.${voc ? " The Moon is void, which points the same way." : ""}`;
  }
  if (voc) {
    return `${pace} With the Moon void, favor finishing over starting — good for ${verbs.slice(0, 3).join(", ")} on work already in hand.`;
  }
  return `${pace} Good for ${verbs.slice(0, 3).join(", ")}.`;
}
```

---

## Sentence templates (not tables — the shapes the tables get poured into)

These are in `artifacts/api-server/src/lib/synthesis.ts`. The `${...}` slots are
filled from the tables above.

```ts
// the day's edge — sect malefic
`${planet} runs with a rougher edge ${isDay ? "by day" : "at night"} — the sharpest caution is ${shadow}. ${cap(work)}.`

// the day's steadiest voice — sect benefic
`${planet} is the ${isDay ? "day" : "night"}'s steadiest voice${strong ? ", strongly placed" : faint ? ", though faintly placed" : ""} — ${verb} carries best`
```

## READ zone labels — `artifacts/tides/src/components/ReadZone.tsx`

```
LED BY            <the leading testimony's note>
MIXED CURRENT     Two things pull different ways — {a}; and {b}
QUIET SKY         Nothing in particular is pulling. The ordinary reading stands.

{n} other layers of the sky point the same way.      // was "Stacked support"
No meaningful change since your last check, {when}. Your current course still holds.
Changed since your last check, {when}.

band labels:      this hour · today · this stretch · background
```

## Strongest fit / Keep going — `artifacts/tides/src/pages/Today.tsx`

```
Strongest fit right now          // ordinary mode; see FRAMING for the others
Keep going · {22 min in}
You're already in this. Compass won't move you off it — finish, or stop deliberately.
not working on this anymore →
▾ another fit  /  ▴ hide
Compass can read the hour, not your energy. You pick the line that's true.
The Moon is void — these all finish rather than begin.

strongly charged / moderately charged / quietly charged      // never a percentage
{high|medium|low} signal agreement
```

## Week chart — `artifacts/api-server/src/routes/tides.ts`

```ts
const APPROACH_TONE = {
  initiate:    "A seeding week — the cycle restarts. Good for beginnings that need no audience yet.",
  build:       "A building week. Momentum is available; put it into what you already started.",
  refine:      "A refining week. The shape exists — this is for adjusting it, not adding to it.",
  consolidate: "A consolidating week. Less about starting than about making what exists hold.",
  release:     "A releasing week. Things come to visibility and completion; let them go out.",
  recover:     "A recovering week. The cycle is emptying out. Rest is the work.",
};
// month spans instead say: `The cycle turns at new Moon {date} and full Moon {date}.`
// both may be followed by: ` Structural pressure around {up to 3 dates}.`
```

The six words `initiate · build · refine · consolidate · release · recover` are
shared by the week chart AND the hero's lunar strip. They must stay one
vocabulary — the two surfaces contradicting each other is a bug this app has
already had twice.

## Emails

`artifacts/api-server/src/lib/interpretation.ts` (192 lines) composes the report
content; `artifacts/api-server/src/routes/reports.ts` assembles subject + HTML.
The emails are **interpretation-first by design**: every astrological fact must
earn its place with a "so what — do this". They reuse the app's vocabulary, so
they should inherit the same voice rather than get their own.

Two rules specific to the emails:
- The subject must carry something that **changes** day to day, or consecutive
  days thread into one another in the inbox.
- On a void day the subject leads with "Begin nothing today".

---

## What to hand back

The same tables, same keys, same shapes — only the strings rewritten. Plus a
short note on anything you think the *structure* gets wrong, not just the
wording: e.g. if gift/shadow/work is the wrong decomposition, or if the three
capacities (depleted / restless / social) are the wrong three, that is more
valuable than better adjectives.

---

## Answered: the void-of-course table's frame (2026-08-14)

This was an open question for AstroLyrica. It has been decided in-house and the
twelve entries rewritten; it is recorded here rather than deleted because the
reasoning constrains future edits to the table.

**The question was:** `feel` had been rewritten three times for Virgo and
flagged three times, each pass keeping a deficit frame while changing the
words. Should `feel` name a lack at all, given that `VOID_SCOPE` already scopes
the caution to beginnings?

**The answer: the axis was wrong.** It is not positive against negative, it is
specific against atmospheric. Libra reads as the most useful of the twelve, and
not because it cautions — because "agreements made now tend not to hold" names
one particular act that particularly fails, and a person can act on that. The
old Aquarius line ("ideas with nobody to bring them to") is just as negative and
far less useful, because nothing follows from it. Virgo failed the same way in
the other direction: it described a mood rather than an act.

So the table is deliberately **not uniform**. Where a sign gives us a specific
thing that will not take, `feel` names it. Where it does not, `feel` says what
the attention is good for and lets `VOID_SCOPE` do the limiting.

**A second defect, unflagged and larger.** Four entries opened with list
membership — "this is one of the four Lilly exempts", "the last of Lilly's
four". That is bookkeeping rather than a feeling, it met the reader first in
exactly the four signs where the news is good, and it hands over the list
instead of the reason. A sign is exempt because the Moon is exalted there, or
because the sign is Jupiter's, and that is the part worth knowing.

The citation now lives in its own `provenance` field, attributed, carried by six
signs: Lilly's four, plus the Moon's fall in Scorpio and her detriment in
Capricorn. The other six leave it absent rather than reach for a claim to fill
the field. This also moved dignity vocabulary out of the layer-1 line, which
brings the table back inside the stranger test.

`feel` / `instead` survives as the decomposition, now with `provenance` beside
it. The tests in `tests/voidOfCourse.test.ts` pin all of the above.

**Still worth an outside view** on the twelve sentences themselves — the frame
is settled, the prose is not, and the Virgo entry is the owner's own wording and
should be left alone.

---

## ADDENDUM — 2026-08-16 (the home-base build)

The astro-quiet lens shipped app-wide, and with it a set of deliberately
PLAIN strings. Rule for everything in this addendum: these render at the
"minimal" astrology level or on productivity surfaces, so they must pass the
stranger test with zero sky vocabulary — no tide words, no instrument words.
Rewrite for voice if wanted, but any draft that reintroduces the sky at
these keys is wrong by construction.

### A2. The loop's plain why-lines (server-composed, `whyPlain`)

Shown under the compass answer at the quiet lens. Composed from fragments:

- deadline half: **"past due" / "due today" / "due tomorrow" / "due Friday"**
  (weekday only within six days)
- calendar half: **"you're free until 2 PM"** / **"your calendar is clear
  for the rest of the day"** (only when a connected calendar actually
  answered)
- joined: "Due Friday, and you're free until 2 PM."
- neither fact: **"This is the strongest fit for right now."**
- mid-meeting suffix (shared with the astro why): "The window outlasts
  what's on your calendar right now."

### A3. The quiet rail and session state

- Rail at minimal: the clock, the date, and **"Light 6:13am–7:37pm"**
- While a session runs (any lens becomes minimal): **"Sky is quiet ·
  session"**

### A4. The log-it doors

- Capture sheet mode toggle: **"To do" / "Did"** · Did-mode sub-line: "One
  thing per line — each goes in today's log, planned or not." · button "Log
  it" / "Log N"
- Home, under the add-input: **"Log something done →"** · placeholder "What
  did you do? It goes in today's log."
- Log day view: **"Add to this day's log"** · placeholder "Something you did
  that day, planned or not." · saved note "In the ledger ✓"
- Session done: **"Log what this was for"** · title placeholder "What were
  you working on?" · link select "No link — just the log" · untitled linked
  fallback text "worked on: {title}"
- Flow release offer (Today): "{N} min in \"{title}\" — keep it in the
  log?" · "Log it" / "leave it"

### A5. Touch trails (tasks page + Home rows)

- **"worked on · Tue · Thu"** ("today" for today) · more than three days:
  "worked on · N days recently". Hard rule: never a percentage, never a
  completion word — a touched task is still not done.

### A6. Plain weave copy (Plan at minimal)

- Intro (has tasks): "Compass fits what you're holding into the open
  stretches of your week, by deadline and energy. Nothing is scheduled
  until you say so."
- Intro (cold): "Dump everything on your plate. The Planner reads each
  line, then fits it into the open stretches of your week — by deadline,
  duration and energy, around your waking hours and your calendar. Nothing
  is scheduled until you say so."
- Button: "Weave it in" (no ✦) · pending "Placing…"
- Stale note: "…weave it again and it'll place around what's open now."
- Every plain placement grades "workable" with the existing "this time will
  do" — already sky-free, reused on purpose.

### A7. Settings dial (rewritten)

"Same engine underneath — this only changes what's shown. Minimal quiets
the sky across the whole app: plain reasons on the compass, a bare
calendar, the instrument rail folded away. Medium keeps the moon and the
day's character. Full shows everything in the sky's own words. Starting a
session quiets the sky on its own, for as long as it runs."

### A8. Summoned review (Log)

- Door: **"Review the week now"** · close: "Close the review" · non-Sunday
  chip: "This week" · empty state: "The wake is empty so far — nothing to
  review yet."

### A9. Chores, the day's landmarks, and star links (2026-08-16, later)

- Habit form chore line: **"This is a chore — upkeep on a cycle, checked off
  plainly, never scored."** · card chip "chore" · ledger voice "done:" (a
  practice stays "kept:")
- Anchor row (any cadence now): **"Hang it on the day? (optional)"** ·
  options "At sunrise / Sun overhead / At sunset / **Before bed**" — bed's
  time is the chronotype's own, shown as "by 11:00 PM"
- The sun-calendar on Habits: header **"The day's landmarks"** · per-landmark
  "Sunrise · 6:16 AM", "Sunset · by 7:36 PM", "Before bed · by 11:00 PM"
- Star links on a habit card: unlinked "☆ star" · linked "★ {first} +N" ·
  picker pills toggle "★/☆ {title}", closed by "done"

### A10. Sprints (2026-08-18)

Short pushes with hard edges, sometimes riding a week-scale transit. The
suggestion line must describe conditions and never promise outcomes.

- Card header **"Sprints"** · quiet door "Start a sprint — a short push with
  an end date →" · "+ another"
- Suggestion: "{Mars} {runs with|grinds against|meets|faces} {Jupiter}
  through {Fri} — {a training or courage push, with growth in the air}." ·
  personal variant "{Mars} — steering \"{Get fit}\" — runs with…" · CTAs
  "Ride it →" / "not this one"
- Row: "day 3 of 8" · "logged 4× of 6" · "window closed Tue" · "did it" ·
  "finish" / "set down"
- Sheet: placeholder "The push — morning pages, no sugar, ten cold calls…" ·
  "or borrow one:" templates (Dopamine fast, Meditation, Morning pages, No
  sugar, Cold showers, Inbox zero) · "how long:" / "until {Aug 21}" ·
  "aim for N times (optional)" · "Start the sprint" / "never mind"
- Server refusals: "three sprints are already running — finish or set one
  down first" · "past a month it isn't a sprint — give it a shorter window,
  or make it a habit"
- Ledger voice: "sprint: {title}"

Addendum to A10 (same day): sprints weave into what's already held.
- Sheet gains "or turn a habit up:" (existing habit → its taps keep the
  habit itself; tally reads "kept N×")
- Habit-matched suggestion tail: "…— \"{Morning run}\" already leans on
  {Mars}."
- Riding a personal span preselects that star in the sheet.

### A11. The loyalty batch (2026-08-18, evening)

- Capture sheet modes are now four: **"To do" / "Did" / "Keep doing" /
  "For a stretch"** · habit sub-line "One per line — each becomes a habit,
  scored only against the rhythm you pick." · sprint sub-line "One per line
  — each becomes a sprint with a hard end date. Three can run at once." ·
  buttons "Keep it/Keep N", "Start it/Start N" · option rows "rhythm:" /
  "how long:"
- Comeback greeting (once, after 5+ quiet days): **"Back after {N} days.
  Everything kept your place — start anywhere."**
- First session ever, in the timer panel: **"The sky steps back while a
  session runs. It returns when you stop."**
- Guide gains "What lives where" (task/habit/sprint/star/win + "Home steers
  what you're holding; Today runs the day itself." — the same sentence now
  in the tour's loop stop).
