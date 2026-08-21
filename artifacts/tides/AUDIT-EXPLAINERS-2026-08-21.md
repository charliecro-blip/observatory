# The small explainers — an audit of the moment's language sets

2026-08-21. Owner ask: "an audit of the small little explainers that we give
for certain astrological features of the moment. I want them to be internally
consistent, of course, but I also want them to be clear and helpful in a
small, detailed way… probably more than suggestions for activities (which are
helpful) we can also emphasize approaches/ways of doing things, vibes and
qualities. but I also want them adaptable and keyed in according to what's
actually happening astrologically — with all the solar themes today, I was
noticing that it feels flavored by the sun–south node conjunction."

Candidate copy in this doc is DRAFT and goes through `no-ai-slop` when it
ships (CLAUDE.md). Nothing here is implemented yet.

---

## 0. Today, as the specimen

Measured with the app's engine at 1:30 PM CDT: Sun 28.7° Leo, South Node
29.8° Leo (conjunct, 1.1°), Mercury 22.6° Leo, Jupiter 11.5° Leo, Moon 16.9°
Sagittarius, Saturn/Neptune/Pluto/Chiron retrograde. Nine days after the
total solar eclipse at 20° Leo; a lunar eclipse seven days out; the engine's
`eclipseWindow()` says `active: true`.

What the rail said: SEASON "Leo season — The heart on stage, warmth that
wants witnesses"; MOON "favors plan the trip · study the big idea · teach —
and preach a little"; THIS HOUR "Sun in Leo · DOMICILE · whatever you make,
you can stand behind in public · the audience quietly becomes the point";
then "this hour back someone in public · be seen — present or publish · take
the credit that's yours".

Every line is TRUE and every line is keyed to the sign alone. The three
facts that make this solar day unlike other Leo days — the Sun on the South
Node, the eclipse corridor, the Leo stellium with Mercury just past the
node — produce no sentence on any surface. The owner felt the flavor; the
app had no way to name it.

## 1. What exists (the inventory, condensed)

Full inventory with file:line references is in the agent report behind this
doc; the shape is what matters here. Roughly twenty language sets, in two
registers, across two authorities:

| Set | Keyed to | Register | Surface |
|---|---|---|---|
| Sign essence / feel / favors / shadow (`mythos.ts`) | sign only | essence = quality; favors = activity | Rail SEASON, Rail MOON, Studio |
| Sign inflection (`sky-readings.ts`) | sign only | quality | Planets dossier |
| SIGN_GUIDE, SIGN_FAVORS (server copies) | sign only | mixed | synthesis, email, share card |
| Planet-in-sign + dignity (`planetInSign.ts`) | planet × sign × dignity × sect | quality, two clauses (does · misses) | Rail THIS HOUR / THIS DAY |
| Approach by day-part (`approach.ts`) | planet × chronotype day-part × void | activity, imperative | Rail THIS HOUR "this hour …", MomentsAhead |
| Tide guidance (`elements.ts`) | Moon element × level × void | pace quality + verb list | Home TideStrip |
| Void readings (`voidOfCourse.ts`) | Moon sign while void (+ Lilly exempt) | feel = quality; instead = activity | DayConditions, Rail, synthesis |
| Synthesis testimonies (`synthesis.ts`) | sect, hour + dignity, day ruler, Moon sign, Moon aspects (applying, orb), standing aspects, phase, void, natal transits | mixed; flavour + counterpoint + watch | DayReading, ReadZone, WovenReading |
| Named patterns (`patterns.ts`) | cazimi/combust, reception, besiegement, translation of light, void | quality with outlet | DayReading |
| Planet roads (`synthesis.ts`) | planet only | gift · shadow · work | counterpoint/watch |
| Aspect explainers (4 separate tables) | aspect × planets (× signs) | mixed | BigSky, MomentsAhead, Rail, TransitTake |
| Alternatives (`alternatives.ts`) | planet × self-reported capacity × void | activity, conditional | "or?" |
| Retro / station / eclipse notes (3 tables) | planet, direction, eclipse kind | quality | tooltips, almanac, CroppingUp (no prose by design) |
| Election evidence, linesUp why | window testimony | literal + gloss | Plan |
| PAIR_MEANINGS (96 strings) | planet pair × aspect class | quality | **dead — no UI import** |

## 2. Findings

### 2a. Internal consistency

1. **The sign is described in four voices.** Leo is "The heart on stage —
   warmth that wants witnesses" (mythos), "warm, expressive, and proud —
   wanting to be seen and to mean it" (inflection), "sunlit, generous fire
   that wants witnesses" (SIGN_GUIDE), and "Sunlit surf — bright, generous,
   theatrical water" (feel). Four tables, three files, two authorities; none
   imports another. They agree today by luck and will drift.

2. **The "feel" lines are tide vocabulary outside the tide instrument.**
   "Sunlit surf", "open ocean under full sail", "black still water of
   unknown depth" describe FIRE and WATER signs alike as water. The worldbook
   rule (WORLDBOOK §2, and the CI that once broke on "slack water") keeps
   nautical words inside the tide; the sign explainer is layer one.

3. **Three activity lists stack in one column.** Rail: SEASON favors (sign),
   MOON favors (sign), THIS HOUR approach (planet × day-part). Three "do X"
   lists, three grammatical moods (noun phrases, imperatives, a verb list
   in the tide strip), none of which knows the others exist. This is the
   stack the 2026-08-04 Home/Today split removed from the page body,
   rebuilt in the rail.

4. **The best-shaped set is the dignity line.** `planetInSign` is the one
   table in the quality register with a consistent grammar — does · misses,
   upside then edge, keyed to three real inputs. It should be the template,
   and today it is the exception.

5. **The reroll cycles paraphrases, not conditions.** ↻ on the Sun hour walks
   windows of three imperatives for the same planet. It never reaches the
   fact that would change the reading (the node, the eclipse, the station).
   A second take on the same fact is decoration; the second FACT is
   information.

6. **Dead and duplicated copy.** PAIR_MEANINGS (96 strings, tested, never
   rendered); the client `ECLIPSES` table is a 2026–27 hardcode the server has
   superseded; `SIGN_FAVORS` on the share card is a third copy of favors.

### 2b. What the explainers are keyed to — and aren't

| Condition | Engine computes it | Any explainer keyed to it |
|---|---|---|
| Sign, element, phase | yes | yes |
| Essential dignity, sect | yes | dignity word only; "sect" never reaches the UI by design |
| Void of course | yes | yes (well) |
| Moon's applying aspects, orb | yes | synthesis only |
| Retrograde / station | yes | tooltips, a ℞ mark |
| **Transiting nodes (Sun/Moon conjunct a node)** | yes (`lunarNodes`) | **none** |
| **Eclipse corridor** | yes (`eclipseWindow`) | election gate; a banner that "lies for four of its five days" (HOME study A3); no explainer |
| Combust / cazimi / under the beams | yes (patterns) | DayReading only |
| Stelliums / sign emphasis (four bodies in Leo today) | no | none |
| Planet changing sign today / hour of ingress | partly | Calendar only |

The Sun's own explainers — season, hour, dignity — take no input from the
Sun's condition. The Sun can be on a node, in an eclipse corridor, combust
Mercury, or about to change sign, and the sentence is the same Leo sentence.

### 2c. Register

The owner's instinct matches what the copy already does best. Where the app
speaks in qualities and approaches (dignity line, roads, void feel, named
patterns) it reads as observation; where it speaks in activity lists (favors,
by-part approach, CHARACTER_GRAIN verbs) it reads as instruction, and three
instructions in a column read as a horoscope. Activities are not wrong; they
are the EXAMPLE, not the sentence.

## 3. The principle: condition → approach → example

Every small explainer composes the same way, in this order, and stops when
the surface runs out of room:

1. **The condition, literally.** What is where. "Sun in Leo, on the South
   Node · 1.1°." At full: glyphs and degrees; at medium: the nouns; at
   minimal: nothing — the condition is implied by the approach.
2. **The approach — how things want doing.** One clause in the quality
   register: a manner, a pace, a grain, an edge. "What you stand behind in
   public today is the thing you've done before; repeating the known act
   comes easily, and the new one costs."
3. **One example at most.** "Show the finished thing rather than launch the
   next." Never a list of three. The list lives behind ↻ or in Plan.

And one rule that makes it adaptive: **the sentence is built from a base
plus the single most salient qualifier**, never a stack. Salience is
rarity, the same ordering DayConditions already uses:

    eclipse corridor (≈4× a year)
      > luminary on a node (≈2× a year each)
      > station of a classical planet (few per year)
      > void of course (most days, hours)
      > dignity / sect (changes by hour)
      > phase (changes by week)
      > sign (changes by month, or 2.5 days for the Moon)

So the Sun hour today composes from the Leo base and the node qualifier;
the eclipse corridor appears on the SEASON line (it is the season's fact,
not the hour's); the Moon's line carries its own qualifier (none rare today:
a Sagittarius Moon, waxing, not void). Nothing repeats a fact another line
already holds, which is the rule that stopped Home arguing with itself.

## 4. Today, rewritten under the principle (DRAFT copy)

Full lens:
- SEASON · ☉ 28° Leo, in the eclipse corridor (solar Aug 12, lunar Aug 28)
  — the season is settling what the eclipse shook loose; the approach is
  to finish the stories already in motion rather than open new ones.
- THIS HOUR · ☉ Leo · domicile · on the ☋ South Node (1.1°) — what you can
  stand behind in public today is the thing you've stood behind before;
  the known act comes easily, the new one costs more than it looks. Back
  what you've already made.
- MOON · ☽ 17° Sagittarius, waxing, not void — the mood is for range and
  meaning; the approach is the long view over the near task. Example: study
  the big idea.

Medium lens (same facts, fewer nouns):
- This hour favors standing behind work you've already done, over launching
  the next thing; the Sun is sitting on the Moon's South Node.

Minimal lens (approach only, no sky nouns, one sentence):
- A good hour for showing finished work, and a costly one for launching
  something new.

The minimal line is not a different text: it is the approach clause of the
same composition with the condition clause removed. One structure, three
renderings — which is what keeps the lenses consistent with each other.

## 5. How it lands, by reader

The twelve from the HOME study and the ten paying personas collapse into
five reading modes for this purpose:

| Reader | Wants from an explainer | What breaks for them today | Render |
|---|---|---|---|
| The astrologer (Luna, Vela, Sable) | the literal fact and provenance; she adapts it herself | generic sign copy she can see is generic; no node, no corridor — she stops trusting the rail | full: literal → approach → a provenance tag ("Compass reading" / "tradition") |
| Zero-astrology, one job (Dan, Kenji, Tomas) | a manner to work in, no nouns | "be seen — present or publish" reads as an instruction from a horoscope | minimal: approach clause only, imperative mood allowed, one example |
| Pacing / capacity (Jess, Rachel, Kit, Imani) | pace, grain, and permission; never a list of doings | three activity lists feel like three demands | medium: pace words first ("a costly hour for starting"), the "or?" capacity branch close by |
| Content and clients (Ash, Sable, Marguerite, Dr. Renata) | a quotable quality line that will be the same next time | four voices for Leo; the card's favors differ from the rail's | one sign table, one voice, exported unchanged |
| Ten seconds on a phone (Priya, Maya) | one line | the reroll, the stack | the approach clause, nothing else; no ↻ |

And across the working rhythms, the GRAMMAR of the approach clause can
shift while the content stays: Campaign hears it as an imperative with a
target ("Back what you've made; launch nothing"), Route as a condition on
continuity ("the known act holds today; the new one slips"), Field as an
option ("one way in: show finished work"), Tide as weather ("a settling
hour"). Same composition, four moods — this is the element/rhythm
invitation-grammar idea applied to the explainers.

## 6. Recommendations, in order

1. **One sign table, one planet table, server-side, served.** Fold mythos
   essence/shadow, inflection, SIGN_GUIDE and SIGN_FAVORS into one record
   per sign; the client reads it from /tides/now (or a static /lexicon
   endpoint). Same for planet themes/roads/literacy. Delete PAIR_MEANINGS
   and the client ECLIPSES table.
2. **A qualifiers layer on /tides/now.** Computed once per moment: luminary
   node contacts (orb ≤ 3°), eclipse corridor with dates, stations within
   ±1 day, retrogrades, void, dignity word, sect, combust/cazimi, Moon's
   next applying aspect, sign emphasis (≥3 bodies). Each with `literal`,
   `salience`, and the base it qualifies (sun / moon / hour / day).
3. **A composer, not more tables.** `explain(base, qualifiers, lens,
   rhythm)` → { condition, approach, example }. The rail, the tide strip,
   MomentsAhead and the dossier render from it. The dignity line's
   does · misses grammar is the approach template.
4. **Rewrite the three rail sets in the quality register**, approach first,
   one example. Move "feel" (the water metaphors) out of the sign table into
   the tide instrument where it belongs, or cut it.
5. **↻ cycles qualifiers, not paraphrases.** First take: the rarest
   qualifier. Second: the next. Last: the base alone. Label the take with its
   fact, not "another take".
6. **Minimal = approach clause of the same composition.** Retire the
   separate `plainGuidance` string surgery once the composer exists.
7. **Copy pass on the whole lexicon at once**, by the no-ai-slop skill,
   with the worldbook at hand.

Cost: the qualifiers layer is mostly plumbing over functions the engine
already has (`lunarNodes`, `eclipseWindow`, `motionOf`, `essentialDignity`,
`patterns`). The composer is new but small. The rewrite is the real work
and it is copy, not code.

## 7. Open questions for the owner

- Provenance tags at the full lens — "tradition" vs "Compass reading" on
  each approach line — wanted, or too much furniture?
- Should the minimal lens ever mention an eclipse or a node, in plain
  words ("a week for finishing, not starting")? Today it cannot.
- The tide "feel" metaphors: move into the tide instrument, or retire?
- Rhythm-aware grammar (§5): build it with the composer, or after a week of
  the presets?

---

## 8. Built, the same day

- **The qualifiers layer** (`lib/qualifiers.ts`, on `/tides/now`): eclipse
  corridor, a luminary on the true node, stations and retrogrades of the
  classical planets, cazimi and combustion, the void, a gathering of three
  or more planets in one sign — each with bodies, salience, literal, plain,
  one approach clause, and provenance. One home per qualifier (the corridor
  is the season's; the node is the luminary's), learned the hard way: the
  first build opened SEASON, MOON and the tide strip with the same eclipse
  sentence.
- **The composer** (`lib/explain.ts`): condition → approach → example; the
  rail's three lines and the tide strip read from it. "The feel" left the
  rotation. The hour's approach list shows one example; ↻ walks the rest.
- **The engine, checked**: the node is now the true node (Meeus), within
  0.2° of Horizons across six dates; the four asteroids read from a
  Horizons table 1940–2070 (the Kepler model was 1–4° off for births in
  the 1960s–90s). Both pinned by `tests/ephemeris-reference.test.ts`.
- **One sign record** (`lib/lexicon/src/signs.ts`, §6.1): the client's
  SIGN_MYTHOS and SIGN_INFLECTION, the server's SIGN_GUIDE and the share
  card's favors are all built from it; `tests/lexicon.test.ts` pins that
  they agree. PAIR_MEANINGS (dead) and the hardcoded client eclipse table
  are gone.
- **The sign sentences in the approach register** (§6.4): each sign has an
  `approach` line — how work wants doing under it, one clause with a hinge
  — and the rail's SEASON and MOON bases read it, with one favor as the
  example. The old picture line survives as `image` for the dossier and
  the card; the water metaphors survive as `tideFeel`, tide-only.
- **One planet record** (`lib/lexicon/src/planets.ts`): the client's
  PLANET_MYTHOS / PLANET_ACTIVITIES / PLANET_CORE / PLANET_LITERACY, the
  rail's signification and meaning lines, and the server's PLANET_THEME /
  PLANET_ROADS are all views of it; `tests/lexicon-planets.test.ts` pins
  that. Each planet has an `approach` line — how work wants doing in its
  hour — which is THIS HOUR's base take, composed under the dignity line
  with the moment's qualifiers. The approach-by-part examples (approach.ts)
  stay where they are: they are the examples, keyed to the person's clock.
- Open: nothing from the audit. The copy in both lexicons is the owner's to
  revise in one place now.
