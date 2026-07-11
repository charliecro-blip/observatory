# A simpler mobile UI — proposal (owner review, nothing built)

Owner: "on mobile, things land in weird spots… even more should be toggle-able…
there's a lot going on. Come back with a much simpler mobile UI."

## The diagnosis

Mobile today is **the desktop app poured into a 390px column.** The desktop
rail is hidden, but everything else stacks vertically and renders at once. On
Today alone, in one scroll: the ritual card, the weather hero, a 4-card bento
(guiding stars / on deck / week ahead / sky clock / chart), the month-water
strip, the rhythm card, Big Sky (2+ aspect cards), standing conditions, the
reflect loop, VOC banners, cycle banners. That's ~12 instruments competing for
one thumb. Nothing is *wrong* individually; there's just no hierarchy, so the
eye has no landing point and the page feels like a wall. The crashes you hit
("weird spots") were the mobile instrument strip choking on a partial data
load — fixed — but the underlying feeling is real: **too much at once.**

## The principle: one question per screen

A phone glance should answer **one** question. Tides' one question is:
*"What kind of time is it, and what's my one next move?"* Everything else is a
tap away, not a scroll away. Concretely, three rules:

1. **Above the fold = the answer.** Tide + level + the single most relevant
   next thing. Full stop. No bento, no strip, no aspects.
2. **Everything else is opt-in** — either behind a tap ("more") or chosen by
   the user (visibility toggles).
3. **Navigate, don't scroll.** Use the bottom nav and in-page tabs; kill the
   infinite vertical stack.

## The proposed mobile Today

A short, deliberate page — roughly one-and-a-half screens, not four:

```
┌─────────────────────────────┐
│  ⛵ Cast off / 🌙 Log day    │  ← ritual card ONLY in morning/evening;
│  (or nothing, midday)       │    absent midday so the hero leads
├─────────────────────────────┤
│                             │
│      Deep Tide              │  ← the hero. One big word (display face),
│      High, rising · water   │    level, element, the ? key. A calm
│      [tide curve, ambient]  │    element-colored field. This is the app.
│                             │
├─────────────────────────────┤
│  → your one next thing      │  ← single line: top task / next block /
│                             │    "weave your day in Plan"
├─────────────────────────────┤
│  [ Now · Day · Sky ]        │  ← a 3-way segmented control. Tapping swaps
│  ···content for the tab···  │    the ONE section below it — not a stack.
└─────────────────────────────┘
     Today Cal Aims Log Plan ✦   ← bottom nav (unchanged)
```

The segmented control under the hero is the key move. Instead of stacking
Resonant Now + rhythm + month-water + Big Sky + conditions, they become
**three tabs of a single pane**:

- **Now** — Resonant Now (the tap-to-cycle suggestions) + the hour.
- **Day** — the rhythm card + month-water + the felt/reflect loop.
- **Sky** — Big Sky aspects + standing conditions + the teachable moment.

One is visible at a time. The scroll goes from ~12 sections to ~3 zones (hero,
next-thing, one active tab).

## More toggle-able (what you asked for)

A **Settings → Mobile home** list where the user checks which cards appear at
all — the same show/hide idea as the desktop rail sections, applied to the
mobile Today pane. Defaults on for a beginner: Now + Day. Off by default:
Sky (advanced), month-water (dense). A power user turns everything on; someone
who just wants "what's my tide" turns everything but the hero off. This
directly answers "even more should be toggle-able" and lets the page be as
simple as each person wants.

## The instrument strip

The desktop rail's sun/moon/day/hour glyph strip (the thing that was crashing)
is genuinely useful for the fluent, genuinely noise for the beginner. Proposal:
it lives **only inside the "Now" tab**, not pinned above every page — and it's
one of the toggle-able cards. The nesting-ladder education (the spine gauge)
teaches what those glyphs mean; the strip is where a graduate reads them.

## Navigation cleanups

- **Top tab bar → gone on mobile.** Six top tabs + a bottom nav is two
  navigations. On mobile the bottom nav is enough; the top row (which already
  collapses to a title on mobile) can drop entirely.
- **Sub-tabs stay** (Aims' Guiding Stars/Tasks/Habits, Calendar's Calendar/
  Almanac) — those are in-page and fine.
- **Consider swipe** between the Now/Day/Sky tabs (native-feeling), but that's
  polish, not v1.

## What this is NOT

Not a rewrite. The components all exist; this is **re-composition** — wrapping
Today's mobile body in a segmented pane, adding a visibility-prefs list, and
dropping the top tab bar on mobile. Desktop is untouched (it has room for the
rail + full stack). The 📱 preview toggle already lets us build and check this
from the desktop.

## Smallest first build (if you approve)

1. Mobile Today: hero + next-thing + **Now/Day/Sky segmented pane** (move the
   existing sections into the three tabs).
2. Drop the top tab bar on mobile (bottom nav only).
3. Settings → Mobile home visibility toggles.

Open question for you: are **Now / Day / Sky** the right three groupings, or
would you rather it be **Do / Feel / Sky** (action / reflection / weather)? The
grouping is the one real design decision here.
