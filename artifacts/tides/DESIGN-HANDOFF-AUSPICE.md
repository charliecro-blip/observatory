# Design request: Auspice — the whole-app visual system

**For:** Claude Design
**From:** Auspice — a rhythm-aware astrological planning app (React/TS, self-hosted)
**Deliverable:** a cohesive visual design system for the *app itself* (not just the shareable cards — those have their own brief, `DESIGN-HANDOFF-STUDIO.md`). We want the interface to feel like one considered instrument, not an accumulation of features.

## The one-sentence brief

Auspice reads the sky and your life and tells you **what kind of time this is, what to do now, and when the best moment for it is** — then tracks your progress toward the things you're steering by. Tagline in use: **"move with time."** The whole app is built on the metaphor of **celestial navigation** — you're at the helm, reading instruments, steering by guiding stars, keeping a log. The design should feel like a beautiful navigational instrument: calm, precise, trustworthy, a little bit old-world-almanac.

## What we most need from you

The app has grown *large* — many surfaces, and honestly more than a new user can absorb at once (see "The hierarchy problem" below). More than a re-skin, we need you to bring **visual hierarchy and restraint**: what leads, what recedes, what's one glance vs. what's a place you go. Design the *system* (type scale, spacing rhythm, card language, how density works), then show it applied to the five key surfaces.

## Brand & existing tokens (already in the codebase — evolve, don't discard)

**Type**
- `Baar Sophia` — the display/wordmark face (self-hosted serif; "Auspice" is set in it). Distinctive, editorial.
- `Spectral` — editorial serif for headlines and readings ("Deep Tide", card copy).
- `Geist` / `Space Grotesk` — UI/body sans.
- `Geist Mono` — numerals, times, degrees.
- `Noto Sans Symbols 2` (+ Symbols 1 for Venus) — the celestial glyphs, per the glyph handoff (real type, optical thinning, element-tinted). **Do not redraw glyphs.**

**Color (light default `#f0ede8` warm paper; there's a full dark "Observatory" theme too)**
- Ink `--color-primary: #1a2a3a`, muted `#888`, borders `#d0cbc3`, cards `#fff` / `#faf8f5`.
- The four elements are load-bearing throughout: fire `#8a3a20`, earth `#3a6030`, air `#CBA13C`, water `#3a5a80`.
- Quality accents: good `#60a060`, caution `#d0a040`, challenge `#c04040`.

**Four named themes exist** (Tide light, Almanac warm-paper, Observatory dark/cosmic, Minimal mono) — the design system must hold up across at least Tide (light) and Observatory (dark). Theme-aware is non-negotiable.

## The five surfaces to design (in priority order)

1. **Today** — the daily home. Reads the clock: a morning "Cast off" card (your Guiding Stars with next move + best window, the day's tide), an evening "Log the day" (wins harvest), and the day's weather. This is the retention surface; it must feel like *one glance*, not a dashboard. **This is the most important one.**
2. **The instrument rail** (left sidebar) — Season, Moon, Moon aspects, This Day, This Hour, retrogrades, transits. The literal "instrument panel." Dense, scannable, currently a bit undifferentiated — wants typographic hierarchy so the eye knows where to land.
3. **The tide chart** — the hero data-viz: an absolute-scale energy curve across the day, hover-inspectable, four element "lens" tabs. The signature image. (It just got an honesty overhaul — a quiet day should *look* quiet.)
4. **Aims** — Guiding Stars broken into steps/tasks/habits, each surfacing its best election times. The "what I'm steering by" surface. Progress needs to feel visible and rewarding.
5. **Plan → Begin** — the election picker: pick an activity → tiered ★ great / ● good times. Needs a clear two-tier visual language (what makes "great" feel earned and rare, "good" feel solid).

## The hierarchy problem (please engage with this directly)

Top nav is currently: Today · Calendar · Aims · Log · Plan · Planets — each with its own sub-surfaces. That's a lot. We suspect different users want different *slices* (the daily weather; the election tool; the goal-tracking loop; the content/cards). We're not asking you to cut features, but: **help us design an interface where the core daily loop is unmistakably primary and the deeper tools are clearly "go deeper" rather than competing for the front door.** A first-run / progressive-disclosure point of view would be very welcome.

## Constraints

- Everything renders in-browser (React inline styles / CSS vars today). No heavy dependencies assumed; we can adopt a token layer if you propose one.
- Must be theme-aware (light Tide ↔ dark Observatory at minimum).
- Accessibility: readings must stay legible; element/quality colors are decorative accents, never the only signal.
- The tone is **kind, not gamified-harsh** — e.g. the streak is "days at the helm" and a missed day "lowers sail" rather than resetting to zero. Visual language should match: encouraging, calm, never nagging.

## Reference in the repo

- `src/index.css` — the live token set.
- `src/pages/Today.tsx`, `src/components/Rail.tsx`, `src/components/TideWater.tsx` (tide chart), `src/pages/GuidingStarsHub.tsx`, `src/components/ElectionPicker.tsx` — the five surfaces as they stand.
- `src/lib/celestialGlyphs.ts` — the glyph system (your earlier handoff, live).
- `DESIGN.md` — the astrological architecture and vocabulary treaty (elements are yours, planets are the sky's, the tide is where they meet).

## Deliverable format

A `.dc.html` visual reference showing the design system (type scale, color, spacing, card language) and the five surfaces at final fidelity in both Tide-light and Observatory-dark, plus a short README of tokens and rationale. We port directly from it. High fidelity; argue with our current choices freely — the paper-almanac warmth and the navigation metaphor are the two things we'd keep.
