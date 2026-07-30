# Pricing, the free/paid line, and marketing-backward
*Drafted 2026-07-29. Synthesis of the paying-persona study (`PAYING-PERSONAS-2026-07-29.md`),
the month-deep study, and the current build. Owner decisions still open — this is a
recommendation, not a settled plan.*

---

## 1. The organizing idea: **free gives you today, paid gives you the rhythm**

Every version of this line I tried came back to one split, and it's the one that
happens to be true three ways at once:

| | What it is | What it costs us | What it's worth to them |
|---|---|---|---|
| **A single day's reading** | deterministic, local compute | ~nothing | proves the product |
| **Repetition + delivery + memory** | email, push, feeds, history | real infra | *creates the habit* |
| **AI generation** | OpenAI calls | real money per call | high, but bursty |

So: **the free tier should be complete for one day. Paid should be about
continuity.** A free user can answer "what is today, and what should I do with
it" fully — including the personal chart layer. A paying user gets that day
*delivered to them*, remembered, and extended into a rhythm.

This also fixes the flaw in the current line. Today `lib/premium.ts` gates the
personal/astrological layer itself — which means a free user gets a pleasant
generic weather app and never once feels the thing they'd be paying for. Hiding
the differentiator is the worst possible place to put the wall.

**Second reason this line is right:** it aligns price with our actual cost.
The deterministic election engine is nearly free for us to run and is the most
persuasive thing we have — so it should be *tasted* free and *metered*, not
walled. The AI (Ask, Planner parsing) is what genuinely costs money per use, so
metering it is honest rather than arbitrary.

### The proposed tiers

**Free — "Today"**
- The full daily reading, *including* the personal layer once a chart is added
- Calendar, tasks, habits + cadence, the Planner, the Log — the whole planner
- **1 election per week** ("when should I ___")
- **3 Ask questions per month**
- No email, no push, no calendar feed, no long-horizon views

**Compass — $9/mo · $79/yr**
- Unlimited elections + Ask
- **The return loop**: morning/evening push, email reports
- **The calendar feed** (just shipped) + two-way calendar when it lands
- Currents / long cycles, the Wake, the long-horizon views

**Practitioner — $59/mo · $540/yr**
- Multi-chart (clients), per-client elections, the bi-wheel Chart tier
- Client-facing branded handout
- Benchmark: SimplePractice / Practice Better at $69–99, *not* astrology apps.
  The persona study put one practitioner ≈ 6.5 consumers.

**Studio — $25/mo** (content creators)
- Custom branding on cards, batch export, 1:1 format, the election card
- Benchmark: Canva + Later, not Co-Star.

**"Elect a date" — $49 one-time**
- The episodic buyer (wedding, launch, move). Nobody else sells this.
- Also the lowest-friction way to get a *real* willingness-to-pay number.

### The hard divisions, stated plainly
Three things should be unambiguously paid, because each is a *continuity*
feature and each has real marginal cost:
1. **Anything that arrives without you opening the app** (push, email).
2. **Anything unlimited** (Ask, elections).
3. **Anything with someone else's name on it** (client output, branding).

Everything else can be free without hurting us.

### ⚠️ One thing that must NEVER move behind the wall: habit cadence
Both Structured and Tweek gate recurring tasks, and in **both** cases it is the
single loudest complaint in their review corpus — *"Why do I need to pay to
repeat a task?"*, *"this isn't an app with an optional upgrade, it's a
downloadable ad for a paid app."* Structured's version has a genuine trap: a
free user who deletes their seeded routines can't recreate them without Pro.

A daily planner whose *routines* are paid reads as extortionate. Cadence is the
product's thesis, not an upsell. It's already free under "free gives you today"
— writing it down here so it doesn't get quietly reconsidered later.
(Source: `COMPETITIVE-UX-APPENDIX-onboarding-and-capture.md` §3.)

---

## 2. The beta cohort — I'd argue against splitting it

The instinct is right (we currently learn *nothing* about pricing, since
premium defaults to unlocked and the whole beta lives in the paid product).
But splitting ~12 friends and clients into haves and have-nots is the wrong
instrument:

- **n=6 per arm proves nothing.** Not a signal, just noise with feelings attached.
- **They talk to each other.** The split gets discovered, and it reads as a
  test being run *on* them rather than *with* them.
- **Confounded outcome.** If a free-arm person drifts, we can't distinguish
  "the free tier is too thin" from "they were never that engaged" — and with
  n=6, one disengaged friend swings the whole result.
- **They did us a favor.** Taking features away from people who volunteered to
  be early is a bad trade for data we can get another way.

### What to do instead — mark it, don't gate it

Keep all beta users on full access, but **make the paid surfaces visibly paid
while still working**. A small `✦` marker. Nothing is taken away; the line
simply becomes legible.

**Word the marker as a gift, not a future bill.** Fantastical 3 grandfathered
existing owners *completely* — kept every feature they'd paid for, permanently —
and got review-bombed anyway, because the UI only ever showed them locks. The
diagnosis from that fallout applies exactly here:

> *"there's no in-app indication of 'you're getting X for free because you
> bought the app'. So existing users only see the places they're being asked to
> pay more… if they'd swapped some of the 'you need pro' stars into **'loyal
> customer'** icons, we'd all have a better sense of what we're getting."*

So: **"✦ included for you — beta"**, not "✦ premium". Identical information,
opposite emotional valence — one reads as a bill arriving, the other as a gift
being received. With a cohort of friends and clients who did us a favor, that
distinction is the whole difference between the marker building goodwill and
building dread. (Source: `COMPETITIVE-UX-APPENDIX-onboarding-and-capture.md` §4.)

Why this is better:
- **Usage of a marked feature IS the willingness-to-pay signal.** Someone who
  hits a `✦` feature 20×/week has told you more than a survey would.
- It surfaces the line *before* anyone is charged, so there's no bait-and-switch
  later — the single biggest risk with the current everything-unlocked setup.
- It's a natural conversation opener with exactly the dozen people whose honest
  reaction we want: *"we'd charge for this one — would you?"*

**Prerequisite (and it's currently missing):** there are 11 analytics events and
**none of them is a conversion event**. Before any of this reads as data we need
`premium_feature_used {feature}` and `premium_marker_seen {feature}` firing.
That's the cheapest high-value instrumentation on the list.

**Run the actual free/paid split on cohort 2** — strangers, no social cost,
and by then a real number to test.

---

## 3. Marketing-backward: the hooks, and what each one demands of the app

Working the direction the owner asked for — start from what makes someone stop
scrolling, then ask what the app must do to keep that promise.

### Hook 1 — "You're not lazy. You're on the wrong schedule."
The most emotionally loaded line available to us, and the one most likely to be
screenshotted. It converts self-blame into mis-timing, which is the single
belief this audience most wants permission to hold.

**What it demands:** proof, or it's a horoscope. The felt-rating loop is that
proof — *"your most aligned days have been Clear Tides (68%, 19 logged)"*. It
exists today but the pattern is computed from **localStorage only**, so it dies
on a device change. Recomputing it from the `behaviorTags` already stored
server-side is the work. **Without this, the headline is a claim we can't back.**

### Hook 2 — "The app that tells you not to."
Counter-positioning against every productivity tool ever built, all of which
exist to say yes to more. Our election engine will look at a moment and refuse.
The month-deep study found the refusal paths — the Mercury-Rx block, "no clean
window" — were what *converted* people. It's our most distinctive behavior and
no competitor has anything like it.

**What it demands:** protect the "Avoid" verdict as a first-class outcome, and
never soften it into "proceed with caution" for engagement's sake. Also demands
the engine be *right*, which is why today's four election-engine fixes matter
commercially and not just technically.

### Hook 3 — "Pick the day. Know why."
The paid CTA and the $49 SKU in one line. Leads with the confirmed conversion
event, and the differentiator isn't the astrology — it's that **it shows its
work**.

**What it demands:** a keepable, sendable artifact. `/api/studio/best.png`
already renders an election card and has no door to it. This is the best
build-to-value ratio on the whole list.

### Hook 4 — "Some days you're a hammer. Some days you're a sponge."
The four-character model made physical. Language a creative repeats to a friend.

**What it demands:** nothing — already shipped. This is free marketing sitting
in the product.

### Hook 5 — "For work that doesn't run on a straight line."
The identity headline. Says the reader is a certain kind of person, not that the
product has a feature.

**What it demands:** the onboarding must not immediately contradict it with a
grid of astro-jargon. The `astroDetail: minimal` path exists but only gates
three surfaces — it needs to actually hold across the first session.

### The word to never use: **"productivity."**
This audience left those tools deliberately. *"Enchanted productivity"* is an
excellent internal shape-name — it's been the right sorting principle all week —
and a bad headline. Also avoid "astrology app" (pre-sorts us into a category
with a low ceiling) and "AI-powered" (reads as commodity, and our moat is the
deterministic engine, not the LLM).

---

## 4. Lateral: marketing that IS product

The strongest ideas here are the ones where the marketing surface and the
product surface are the same object.

### ★ The "When should I ___?" public tool — the big one
A no-signup page: type a thing, get a good time and the reasoning. It is
simultaneously the landing page, the SEO surface, the demo, the top of funnel,
and a genuinely useful free tool.

Why it's the right bet:
- The election engine **already works without a birth chart** (chartless →
  good-only tiers). The hardest part is done.
- Every persona in the month-deep study used Begin for a real decision — 11 of
  12 — and four changed real dates because of it. It's the confirmed wedge.
- It's inherently shareable ("look what it said about my launch date").
- It's the natural funnel: free answer → "want this for *your* chart?" → signup.

**What's missing:** a public unauthenticated route, a single-purpose page, and
the shareable card. Days, not weeks, and mostly assembly of existing parts.

### The daily card as distribution
Studio already generates shareable cards server-side. Every card someone posts
is an ad that costs us nothing. Needs: co-branding/unbranded option, 1:1 format,
batch. The creator persona was the highest-confidence payer *and* the
distribution channel — those are the same person.

### The refusal as a content series
"Don't launch this week — here's why." Distinctive, screenshottable, builds
authority precisely because it withholds. No other timing content does this;
everything else in the space is relentlessly affirming.

### Lunation emails as a standalone content product
The composer exists (`composeNewMoon`). A New-Moon letter is a natural
subscribe-able artifact that isn't the app, feeding people back into the app.

---

## 5. What I'd actually sequence

1. **Instrument the line** (`premium_feature_used`) + add `✦` markers. Cheap,
   and everything else depends on knowing what people reach for.
2. **Make the felt-pattern survive a device** — it's the evidence under the best
   headline we have.
3. **Surface the election artifact** — best build-to-value ratio; unlocks the
   $49 SKU and the sharing loop.
4. **Build the public "when should I ___" page** — the wedge, mostly assembly.
5. *Then* set prices against real usage data, and run the free/paid split on
   cohort 2.

Note that (1)–(3) are all small, and none of them require deciding the price
first. The price should be the *last* decision, not the first.
