# Design Brief — Compass, round 2 (2026-07-27)

> Outbound brief: what needs design attention now that the engine and the
> essential-density simplification have landed. Companion to the inbound
> brand kit (`design_handoff_compass_brand` — K2 Degree Dial mark, Meridian
> palette, motion notes), which stays authoritative for identity.

## Context the designer needs

- **Usage reality:** Today gets ~90% of views. Two first-time visitors
  bounced within minutes on the pre-simplification UI. The core journey is
  Today → Plan → Calendar; everything else is an add-on.
- **Two orthogonal dials already exist and must be respected:**
  `astroDetail` (minimal/medium/full — how much *jargon*) and `uiDensity`
  (essential/expanded — how many *modules*). **Design for
  essential+medium first**; that's the default new-user view.
- **The engine now emits one woven judgment** per day (`DayReading`):
  a flavour sentence, a convergent element, 1–3 watch items, an honest
  counterpoint, named patterns, and a ranked testimony table. Surfaces
  should *render this one object*, not assemble their own day.
- **Open language decision** (owner, pending): "weather" as the spoken
  register, "tide" as the instrument (see `LANGUAGE-WORKSHOP.md`).
  Design can lead here — mock the hero both ways; seeing them may decide it.
- Constraints: CSP-strict, self-hosted fonts, no CDNs; tokens in
  `src/index.css`; both themes; mobile is real (bottom nav exists).

## 1 · The hero is the product — make it one composition

Today's hero is three eras stacked: gradient banner (big word + curve),
guidance paragraph, then the woven reading block. It reads as strata, not
as one report. **Brief: design the single "weather report card":**

- Headline register: the big word (Surge/Building/Clear/Deep) + level, in
  the display face — keep "one big word on screen."
- The woven flavour sentence is the *subheadline* — it's the best sentence
  the app produces and currently looks like body text.
- One WATCH line, the counterpoint as a quiet italic "but…", patterns as
  1–3 chips. The full testimony table ("the working") stays behind a
  disclosure — on mobile, as a bottom sheet.
- The tide curve: keep as a thin gauge strip *inside* the card or drop it —
  designer's call after trying both. The current one-swell SVG is a
  placeholder, not a keepsake.
- Mock the header label both ways: "SURGE TIDE · high" vs "TODAY'S
  WEATHER — Surge · high". This mock decides the language question.

## 2 · One timeline, not three lists

"On Deck," Waves' "moments ahead," and the (doubted) day-arc chart all
answer *"what's coming today?"* **Brief: one NEXT strip** — 2–4
time-ordered rows mixing calendar windows, matched planetary hours
("3:12 · Sun hour — a window for *rehearse the pitch*"), and angle
crossings (the ◆ moments). If this lands, the UnifiedTideChart can retire
from Today entirely (it survives in expanded/Calendar if wanted). This is
also the natural home of the **journey CTA**: every row tappable →
prefilled scheduling in Plan.

## 3 · Empty states ARE the onboarding

The friends who bounced saw empty Guiding Stars, empty On Deck, empty
Waves — three grey boxes. **Brief: design the three first-journey empty
states as invitations with exactly one action each:**

- Guiding Stars → "Name one thing you're steering toward" (inline input,
  not a nav-away)
- On Deck → "Pick tomorrow's best window" (one tap, engine suggests)
- Waves → "One task for today" (the input already exists — style the
  invitation)

Related: compress onboarding to two beats (one intro card + intake). The
astro-detail chooser should be three *visual previews* (mini hero mocks at
each level), not three text descriptions.

## 4 · Cautions: one voice, one place

VoC currently appears in the hero counterpoint, a standalone banner, the
rail, and conditions. **Brief: a single caution slot in the hero card**
(the counterpoint line) + at most one contextual chip elsewhere. Same
principle for rhythm-risk and cycle banners — they should feel like one
"advisory" design family (the amber/quiet register), not four ad-hoc boxes.

## 5 · Confidence as visibility

"low confidence · mixed signals" is honest but reads like telemetry.
**Brief: a visibility metaphor** — clear / hazy / fog — one small icon +
word, replacing the chips row's "confidence" and "Signals are mixed today."
(Pairs naturally with the weather register; design both registers.)

## 6 · The rail, essential edition

The desktop rail is the old instrument panel (season, moon, aspects list,
hours, transits — now pref-toggleable). **Brief: a slim default rail** —
moon phase+sign, current hour with time remaining, one caution chip —
with the full panel behind the existing prefs. Mobile's instrument strip
should be its sibling, not a different design.

## 7 · Net-new elements that shipped unstyled (functional CSS only)

Each works; none has been *designed*:
- **WovenReading block** (flavour/watch/counterpoint/chips/working table)
- **Moments-ahead rows** in Waves
- **Standing conditions strip** (per-retrograde lines, "today's edge," era
  line) — wants a quiet "almanac footer" treatment
- **Crossing ◆ markers** + event dots on the day arc (if the chart survives)
- **Planet dossier "weather today"** block (sky aspects + natal hits)
- **Email template** — currently hand-rolled parchment inline-CSS; needs
  the brand kit applied (Meridian tokens, the mark, dark-mode-safe email
  HTML). This is the first thing beta users will *forward to friends* —
  worth real polish.
- **Settings email opt-in card** (address/hour/span chips/test button)

## 8 · Simplifications to consider (designer license to kill)

- The duplicate top-bar controls (Session timer, mobile-preview 📱, theme,
  +task, Settings) — propose a reduced top bar; several are dev tools.
- "Set location — hours & sun times are estimated" warning chip — reduce to
  an icon-level nudge inside the hero meta.
- Share button placement on the hero (currently floats in the banner).
- The 5-dot intro carousel → 1 card.
- Emoji glyphs still on some cards vs the brand line-icon set — finish the
  sweep, one icon family everywhere.

## Priorities

1. Hero composition (§1) — decides the language question with it
2. NEXT strip + journey CTAs (§2)
3. Empty states / first journey (§3)
4. Email template (§7)
5. Cautions + confidence (§4, §5)
6. Rail + remaining polish (§6, §7, §8)

Deliverable format that works well for us: the same `.dc.html` reference
prototypes as the brand kit, per surface, desktop + mobile, both themes.
We recreate in React against `src/index.css` tokens.
