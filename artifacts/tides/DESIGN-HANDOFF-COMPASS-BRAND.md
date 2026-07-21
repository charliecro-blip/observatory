# Design request: Compass — brand identity & UI kit rework (logo-led)

**For:** Claude Design
**From:** Compass — a rhythm-aware celestial-navigation planning app (React/TS, self-hosted)
**Deliverable:** a complete **brand kit** — starting with a **logo/mark** the product doesn't yet have — then the identity system it implies (wordmark, color, type, iconography, motion, voice) and how it lands across the app UI and every brand surface. This supersedes the identity portions of `DESIGN-HANDOFF-AUSPICE.md` and `DESIGN.md`, both written before the rename below.

---

## 0. Read this first — the name changed, and that changes the brief

The product has been renamed (final, intended-to-last):

- **Compass** is the **product** — the whole app. It's about **orientation**: knowing where you are in time and which way to move. *Not* fortune-telling, not omens.
- **Auspice** is the **timing engine** inside it — "find the time for anything · Auspice." The favorable-moment machinery (elections, planetary hours, best windows). It keeps its esoteric name because it earns it on that one surface.
- **Ask** is the **advisor** — the "what do I do now?" AI. (Formerly confusingly also called "Compass.")

The prior brief leaned "old-world paper almanac." **We think that instinct is now half-right and worth interrogating.** Compass is a *navigation instrument*, not a grimoire. The rework's job is to make the identity read as **precise, celestial, orienting, calm** — closer to an observatory or a ship's instrument than to a tarot deck or a cream-paper zine. Keep the warmth; lose anything that reads as mystical-decorative.

**The tagline in use:** *"move with time, instead of forcing yourself through it."*

---

## 1. The logo — the centerpiece of this request

Compass has **no logo today** — just the wordmark "Compass" set in a serif, with a small ● bullet in the rail. We need a real mark. Please treat this as the primary deliverable and give it real range.

### The trap to avoid
Search "compass logo" and you get ten thousand **magnetic compass roses** — the 4- or 8-point star-in-a-circle, needle pointing NE. It's the single most generic mark in the category, and worse, **it's the wrong instrument.** Compass doesn't read a magnetic field; it reads the **sky**. So:

- **No magnetic compass rose. No pocket-compass needle.** If the mark could belong to a hiking brand or a real-estate firm, it's wrong.
- Also avoid the current AI-identity defaults: a lone crescent moon, a hand-drawn constellation, a gradient orb, an all-seeing eye.

### The concept space (celestial navigation, not magnetic)
The right metaphors are the tools of **orienting by the sky**: the **sextant** (measuring a star's angle above the horizon — which is *literally* what electional astrology does), the **meridian** (the line the sky crosses at culmination — the pivot of the day), the **astrolabe/armillary** (nested rings of the celestial sphere), and the **fixed star** (the still point you steer by — Polaris). These are ownable, precise, and true to the product.

### Four concrete directions to explore
Sketches below are crude thinking aids in `currentColor` — recreate/refine, don't trace. Consistent `viewBox="0 0 64 64"`.

**A · The Meridian** — a ring with a single vertical line and a mark at the top (the point of culmination). Reads as a dial/instrument and a compass at once; abstract enough to be a system, not a picture. Doubles beautifully as a favicon and an app icon.

```svg
<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
  <circle cx="32" cy="32" r="22"/>
  <line x1="32" y1="10" x2="32" y2="54"/>
  <circle cx="32" cy="10" r="3.2" fill="currentColor" stroke="none"/>
</svg>
```

**B · The Sextant** — a graduated arc with a sightline running to a star. This is our favorite *conceptually*: the sextant measures the angle between horizon and star — exactly the "measure the moment" idea Auspice runs on. Risk: more literal/complex; needs to survive shrinking to 16px.

```svg
<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 50 A 40 40 0 0 1 50 12"/>
  <line x1="12" y1="50" x2="46" y2="20"/>
  <path d="M46 20 l2.2 5 5 .6 -3.8 3.5 1 5.2 -4.4-2.7 -4.4 2.7 1-5.2 -3.8-3.5 5-.6 z" stroke="none" fill="currentColor"/>
</svg>
```

**C · The Fixed Star** — a single sharp four-point star with a faint ring implying the sky's rotation around it. "The still point you steer by." Simplest, most flexible, most app-icon-ready; risk is it drifts toward generic "star app."

```svg
<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4">
  <circle cx="32" cy="32" r="20" opacity="0.35"/>
  <path d="M32 12 L35.5 28.5 L52 32 L35.5 35.5 L32 52 L28.5 35.5 L12 32 L28.5 28.5 Z" fill="currentColor" stroke="none"/>
</svg>
```

**D · The C-Ecliptic** — the letter **C** as the arc of the ecliptic/horizon, cradling a fixed star at the opening. Ties mark to wordmark; strongest when the app icon *is* this and the wordmark's C echoes it.

```svg
<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round">
  <path d="M48 18 A 22 22 0 1 0 48 46"/>
  <circle cx="46" cy="32" r="3.4" fill="currentColor" stroke="none"/>
</svg>
```

**Our lean:** **A (Meridian)** or **D (C-Ecliptic)** as the primary — both are abstract, instrument-true, scale to a favicon, and won't be mistaken for a hiking app; **B (Sextant)** as the richer "brand illustration" register for hero/marketing. But bring your own — if there's a fifth idea that nails "orient by the sky," we want to see it.

### What the mark must do
- Work as a **monochrome line mark** first (it will live in the rail at ~18px and as a favicon at 16px). Color is a bonus, never load-bearing.
- Read in **both** the light "Tide" theme and the dark "Observatory" theme.
- Have an obvious **app-icon** form (square, safe-area aware) and a **social-avatar** form (circle).
- Pair with the wordmark in a **horizontal lockup** and stand **alone**.

---

## 2. Wordmark & lockup

- Current display face is **Baar Sophia** (self-hosted serif; "Compass" is set in it). Keep it as a candidate but **re-evaluate for the new positioning** — we want the wordmark to feel like a precise instrument label, not a masthead. A slightly technical, high-legibility serif or a humanist sans with real character both fit; propose the pairing.
- Deliver: **mark + wordmark** lockup (horizontal, and stacked for square contexts), the **mark alone**, and the **wordmark alone**. Define clear-space and min-sizes.
- Sub-brand treatment: **Auspice** and **Ask** need a consistent, subordinate way to sign their surfaces (e.g. a small-caps gold "· AUSPICE" tag already appears on the election picker — formalize it). They are *features of* Compass, never co-equal logos.

---

## 3. Color — evolve it, and settle the "is this too safe?" question

The live tokens (keep the elements; interrogate the rest):

**Light ("Tide")** — bg `#f0ede8` warm oat · rail `#e8e4de` · border `#d0cbc3` · card `#fff`/`#faf8f5` · ink/primary `#1a2a3a` deep navy · muted `#888`.
**Dark ("Observatory")** — bg `#14181f` · card `#1e2430` · primary `#dce4f0`. *(This theme is genuinely nice and on-metaphor — an observatory at night. Consider making it the brand's hero register.)*
**The four elements (load-bearing across the whole app — do not discard):** fire `#8a3a20` · earth `#3a6030` · air `#CBA13C` · water `#3a5a80`.
**Quality accents:** good `#60a060` · caution `#d0a040` · challenge `#c04040`.

**The honest question we want you to answer:** the light theme's oat-paper-plus-navy-plus-gold is pleasant but sits close to a *very* common "calm/wellness/AI" palette. We're not attached to it. Options we'd weigh:
- **Push the Observatory (dark) theme to the front** as the brand's primary look — ink/indigo ground, a single confident metallic or star-white accent — and let the light theme be the "daytime" alternate. This would differentiate us instantly and suits "navigation by the night sky."
- Or **find one ownable signature color** — a specific brass, a meridian-gold, a particular twilight blue — that becomes unmistakably Compass, and discipline everything else around it.

Elements stay as the *semantic* palette (they mean fire/earth/air/water everywhere); the **brand** accent should be distinct from all four so it never competes with meaning. Give us a defended recommendation, not just swatches.

---

## 4. Typography, glyphs, iconography

- **Type roles today:** `Spectral` (editorial serif — readings, headlines), `Geist`/`Space Grotesk` (UI sans), `Geist Mono` (times, degrees, numerals — keep monospaced numerics; the app is full of clock times and orbs). Propose a tightened scale and pairing; the wordmark face may or may not be one of these.
- **Celestial glyphs — KEEP, do not redraw.** The 12 signs / 10 planets / 5 aspects render as **real type** (Noto Sans Symbols 2, + Symbols 1 for Venus, `U+FE0E` selector, per-glyph optical thinning, element-tinted). See `DESIGN-HANDOFF-STUDIO.md` / the glyph bundle. Six rounds of hand-drawn SVG glyphs read "kid-drawn" — the type recipe is final. The **logo mark is separate** from the glyph set, but should feel like it belongs to the same hand.
- **UI icons:** currently emoji/unicode in places (✦ ⚓ ☾ ⛵). We'd like a small, coherent **line-icon set** in the mark's drawing language (same stroke weight, terminals, corner radius) for the ~15 recurring UI actions. Define the grid and stroke.

---

## 5. Where the identity lands (applications)

Design the system, then show it on these:
1. **App icon** (iOS/Android/PWA maskable) + **favicon** (16/32) — the mark must survive both.
2. **Social avatar** (circle) + a couple of **profile/OG banners**.
3. **The rail wordmark** and top-bar treatment in-app (light + dark).
4. **The Studio share-cards** — already a system (`DESIGN-HANDOFF-STUDIO.md`); show how the new mark/brand signs them without fighting the primary-facts content rule.
5. **The reader emails** — day/week/new-moon (cream card, serif, gold rule today). Bring them into the new identity; the mark should sit in the email header.

---

## 6. Keep / push

**Keep (load-bearing):**
- The **celestial-navigation metaphor** and its vocabulary — Helm, Guiding Stars, Log, Currents, Tides, "days at the helm."
- The **four element colors** as the semantic palette.
- The **glyph system** (real type).
- **Honest, non-fatalistic** tone — quiet days look quiet; a "low tide" never reads as "give up." The identity must feel *kind and precise*, never ominous or gamified-harsh.
- The **Observatory dark theme** as a real, first-class mode.

**Push (open to real change):**
- The **logo** (net-new).
- The **wordmark face** and the **light palette** (the "is it too safe?" question in §3).
- Whether the brand's **hero register is light or dark**.

---

## 7. Constraints

- Renders **in-browser**, CSP-strict for shared surfaces (self-hosted fonts, inline assets — no external CDNs; the app already self-hosts everything for reliability incl. China). SVG marks preferred; deliver optimized SVG + the app-icon PNGs.
- **Theme-aware is non-negotiable** (Tide light ↔ Observatory dark at minimum).
- **Accessibility:** element/quality colors are decorative accents, never the only signal; contrast must hold in both themes.
- No dependency on color to read the mark (mono-first).

## 8. Reference in the repo

- `src/index.css` — the live token set (§3 values).
- `src/lib/celestialGlyphs.ts` + the glyph bundle — the glyph recipe (keep).
- `src/pages/Today.tsx`, `src/components/Rail.tsx` — where the wordmark/mark live in-app.
- `src/components/Studio.tsx` + `DESIGN-HANDOFF-STUDIO.md` — the share-card system.
- `src/routes`/reports (API) — the reader-email template.
- `DESIGN.md`, `DESIGN-HANDOFF-AUSPICE.md` — prior thinking (pre-rename; treat as history, not gospel).

## 9. Deliverable format

A `.dc.html` visual reference we can port from directly:
1. **The logo** — the chosen direction at final fidelity, plus 2–3 runners-up, shown mono + color, light + dark, and at favicon/app-icon/avatar sizes. Include the rationale for the pick.
2. **The wordmark + lockups**, clear-space, min-sizes.
3. **The brand kit** — color (with the §3 recommendation defended), type scale + pairing, the UI line-icon set, motion notes.
4. **Applied** — the five surfaces in §5, both themes.

High fidelity. Argue with our current choices freely — the two things we'd fight to keep are the **celestial-navigation metaphor** and the **element palette**; everything else, including the logo direction and whether we live mostly in the dark, is genuinely open.
