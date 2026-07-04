# Tides — Marketing & Launch-Hype Handoff

**For:** Claude Design (starts cold — this brief is self-contained)
**From:** the Tides build
**Date:** 2026-07-04
**Stage:** private beta (first testers going through the app now; a waitlist of interested people already exists)

**What we need, in one line:** a marketing landing page, a starter kit of marketing materials, and a run of Instagram content we can post *now* to build hype during beta — all in the visual + verbal voice the product already has.

---

## 1. What Tides is (product primer)

Tides is a **timing app dressed as a companion, not a fortune-teller.** It reads the sky the way a good almanac reads weather and tells you the *shape and tempo* of a moment — when the water is high and slow (good for deep, absorbing work), when it's rising, when it's ebbing — so you can time your real life (starting things, focusing, resting) with the grain of the day instead of against it.

It's astrology as **rhythm and texture, not prediction.** The whole product is built to be *honest*: it describes the character of a window, never guarantees an outcome, and refuses to make health/medical/financial claims.

**The core metaphor is tides and weather.** The surfaces are named for it:
- **Today** — "the day's weather." The hero is a **Tide Level** (Low / Rising / High / Ebb) — a measure of *coherence*, not of good-vs-bad luck.
- **Calendar / Ahead** — the road ahead: good windows and cautionary ones, laid on a calendar.
- **Currents** — your slow, multi-year cycles moving underneath everything.
- **Aims** — your guiding stars (goals), broken into steps you can time.
- **When** — "when's a good moment to begin something?" (electional timing for launches, conversations, first dates, etc.).

**Signature details worth featuring visually:**
- An **accurate, understated moon-phase disc** (real illumination %, quietly drawn — not a cartoon moon).
- A **tide curve** for the day (low → rising → high → ebb) with a "you are here" marker.
- The **instrument rail** — a left-hand "sky ladder" nesting big→small: Season/Sun → Moon (+ void-of-course) → planetary Day → planetary Hour. It reads like a dashboard on a well-made instrument.
- The app already generates **shareable tide cards** (there's a Share button on the Today card) — see §4, this is a built-in growth loop and the IG visual language should rhyme with it.

**How it works for a user:** no sign-up wall — you answer a short intake (birth date/place; birth *time* optional, and the app is honest when it's unknown), and you're in. Free tier + a premium tier (premium features are scaffolded; billing is coming).

---

## 2. Positioning & audience

**The differentiator to lean on: honest astrology.** Most astrology apps sell certainty and flattery ("the universe has BIG plans for you today ✨"). Tides deliberately doesn't. It's for people who are astrology-*curious* but allergic to woo — planners, makers, deep-workers, cycle-aware people — who want a *lens on timing* they can feel in their own day, described plainly. Position against hype, not toward it. That restraint is the brand.

**Primary audience:** thoughtful, self-directed people who already plan around their own rhythms (productivity/ritual/journaling/cycle-tracking adjacent), 25–45, aesthetic-literate, skeptical of typical astro-app tone.

**Taglines to explore** (founder to pick/replace — not locked):
- "Timing you can feel."
- "The sky, read like weather."
- "Astrology for people who plan."
- "Know the tide before you row."
- "Not fortune-telling. Timing."

---

## 3. Voice & guardrails (please hold these — they are the brand)

- **Understated, literate, warm.** Almanac, not horoscope. Think a well-made field guide.
- **Describe, never promise.** "Good for deep, absorbing work," not "you WILL have a breakthrough." A window describes *shape and early tempo*, not a guaranteed outcome. This line appears in the product and must hold in marketing.
- **No claims we've explicitly ruled out:** no health/medical/surgical timing, no financial-outcome promises, nothing deterministic ("the stars decide"). Astrology framed as a lens/rhythm.
- **Confident, not salesy.** Let the craft (the moon disc, the tide curve, the palettes) do the persuading.
- **Beta-honest.** It's early and we say so — "join the first testers," not "download the #1 app."

---

## 4. Visual system that already exists (source material to pull from)

Claude Design has the design files locally — reuse, don't reinvent:
- `Tides - Sign & Planet Palettes.dc.html` — the **four palettes** (see below), the actual identity.
- `Tides - Theme Studio.dc.html`, `Tides - Desktop/Mobile.dc.html`, `Rail.dc.html`, `Moon.dc.html`, `Tides.dc.html`, and a `screenshots/` folder — pull real UI shots for the marketing page and IG.

**The four looks** (a user flips between these in-app; use them as marketing texture — a "one product, your weather" reveal):
- **Tide** — warm light / default. Elements: fire `#C2613E`, earth `#5E9A52`, air `#CBA13C`, water `#3F8493`.
- **Almanac** — warm paper.
- **Observatory** — cosmic dark (fire `#FF7A59`, earth `#5FC98A`, air `#F2C94C`, water `#46C2E6`). Likely the most striking for IG.
- **Minimal** — stark white.

**Type in the design study:** Spectral (serif, editorial), Space Grotesk (display/UI), Geist / Geist Mono / IBM Plex Mono (numerals, timestamps, the "instrument" feel). Marketing should feel like this pairing — literary serif + precise mono.

**Motifs:** the tide curve, the moon disc, the four elements (fire/earth/air/water) as a quiet color language, the instrument-rail ladder. Water/deep-blues and warm paper are the emotional center; the cosmic-dark is the "wow."

---

## 5. Deliverables

### A. Marketing landing page (design, desktop + mobile)
A single scrolling page. Suggested sections:
1. **Hero** — the tide metaphor, a tagline, a single primary CTA (**Join the beta / Get the waitlist invite**). Anchor it on the moon disc or the tide curve.
2. **The idea** — "timing as weather, read honestly." 2–3 lines. Set the anti-hype tone immediately.
3. **What you get** — 3–5 feature moments with real UI shots: Today's tide, When (timing a start), the road Ahead, your Currents. One sentence each, in-voice.
4. **The four looks** — the palette reveal ("your weather, your way").
5. **Honesty note** — a short, disarming "what this is / isn't" block (a lens on timing, not a prediction; no health/medical claims). This *builds* trust with the skeptical audience rather than hiding the caveat.
6. **Beta / social proof** — "first testers are in now," room for a couple of tester quotes later.
7. **CTA repeat** — waitlist capture (email).
8. **Footer** — privacy / terms (placeholders for now), contact.

*Note:* the page will live on the Railway-hosted domain (custom domain coming); it can be a route in the app or a standalone static page — design shouldn't assume a CMS.

### B. Starter marketing kit
- **Logo / wordmark** treatment (moon-phase mark pairs naturally with "Tides").
- **App icon** direction (the moon disc is the obvious hero).
- **Social profile kit** — avatar + a cohesive IG grid look (see C).
- **A reusable "daily tide card" template** — this is the important one: it should match the app's in-app Share card so user-shared cards and our own posts speak one language. Fields: date, tide level, the moon disc, one line of "today's weather," element accent color.
- **OpenGraph / share preview** image.
- 2–3 **screenshot frames** (device mockups) for the page and posts.

### C. Instagram content — postable during beta (the "hype now" ask)
Aim for a **launch runway** of ~12–15 pieces, mixing formats. Concepts:
1. **Daily/weekly "today's tide" cards** — the recurring, ownable format (reuses the B template). Low-effort to keep posting; trains the audience on the metaphor.
2. **The four looks reveal** — carousel showing Tide → Almanac → Observatory → Minimal.
3. **Educational carousels, in-voice** — "what's a void-of-course moon?", "high water vs. ebb," "why we don't do horoscopes" (the anti-hype manifesto post — likely the best-performing, most shareable one).
4. **Build-in-public / founder** — a couple of behind-the-scenes posts; screenshots, the thinking. Good for the existing interested list.
5. **The moon disc as motion** — a short reel of the phase drawing itself / the tide curve animating.
6. **Beta CTA posts** — "we're letting the first people in," waitlist link in bio. Frame scarcity honestly (it *is* early).
7. **Testimonial frames** (template now, fill as tester quotes arrive).

Deliver as: a small set of **reusable templates** (so the founder can keep posting solo) + ~5 fully-designed hero posts to seed the grid.

---

## 6. Decisions for the founder (flag, don't block)

- **Product name / wordmark** — "Tides" assumed; confirm it's final before logo lockup.
- **Tagline** — pick from §2 or supply your own.
- **What (if any) pricing to show** now vs. "free during beta."
- **IG handle / brand name** for the profile kit.
- **How much "beta" to foreground** — waitlist-gated vs. open-but-early.

---

## 7. Context for whoever picks this up

This is a solo build in private beta with a warm list of interested people already waiting. The goal of this work is **top-of-funnel while the product finishes hardening**: a page that captures the waitlist, a kit that lets the founder post consistently without a designer in the loop, and IG content that earns the right audience (the skeptical, aesthetic, planning-minded crowd) rather than the generic astro-app crowd. Restraint and craft are the whole pitch — please let the work look like the product: precise, literate, and quietly beautiful.
