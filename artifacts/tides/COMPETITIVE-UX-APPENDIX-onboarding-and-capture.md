# Competitive UX — appendix: onboarding, day-repair, and NL capture
*Research 2026-07-29. Companion to `COMPETITIVE-UX-2026-07-29.md`, which covers the
autoscheduler/ritual/keyboard archetypes. This appendix covers the day-planner and
natural-language-capture layer: Akiflow, Amie, Notion Calendar, Structured, Tweek,
Todoist, Fantastical.*

**Sourcing caveat:** most domains were unreachable for direct fetch, so much of this is
search-extraction. Two exceptions worth trusting more: Notion Calendar's shortcut table
was pulled from its **shipping JS bundle** (Notion deliberately doesn't publish it), and
Structured's + Tweek's help centers were read in full. Reddit/Product Hunt were largely
blocked. Unverified items are flagged at the bottom.

---

## The findings that change what we should build

### 1. ★ Pre-seed the day — don't hand anyone an empty canvas
**Structured auto-creates two recurring tasks on first launch — "Rise and Shine" and
"Wind Down"** — explicitly *"to have a frame around your day."* The user's first
interaction is **editing**, not creating. No blank state, no decision paralysis, and the
recurring-task concept is taught by example rather than explained.

This is the single best onboarding move in the whole study, and **Compass is unusually
well-placed to steal it** because we just shipped habit cadence with solar anchors: we
can seed exactly those two dailies and anchor them to *real sunrise and sunset at the
user's location*, which is the same idea with an actual astronomical basis rather than
an arbitrary default. It also demonstrates cadence + solar anchoring in the first ten
seconds without a word of explanation.

Related: Structured's onboarding copy deliberately lowers stakes — *"don't be afraid to
include tasks like 'Breakfast', 'Take a shower', and 'Buy tomatoes'."*

### 2. ★ Tweek's users articulate our cadence thesis better than we do
Direct review quote, and it is almost verbatim the reasoning behind the cadence work:

> *"It's been the exact thing I needed to see my tasks **without the 'guilt' of having
> to plug them into a specific time block**."*

The category splits on **geometry, not features**: Structured makes time concrete
(vertical, sequential, durations, a running task); Tweek makes it deliberately vague
(horizontal, seven buckets, no clock). Both chase the same ADHD/overwhelm audience with
the same time-blindness pitch. Structured's failure mode is a plan that shatters by
10am; Tweek's is a list with no relationship to capacity. **Compass's cadence model is a
third position — commitment to a rhythm without commitment to a clock slot — and that
positioning language is available to us.**

### 3. ⚠️ Recurrence behind a paywall is the #1 generator of 1-star reviews
Both Structured and Tweek gate recurring tasks, and in **both** cases it is the loudest
complaint in their review corpus:
- *"Why do I need to pay to repeat a task? No way I'm gonna retype my whole thing every day"*
- *"this isn't an app with an optional upgrade, it's a downloadable ad for a paid app"*

Structured's version has a real trap: a free user who deletes the seeded Rise and
Shine / Wind Down **cannot recreate them without Pro**.

**Direct implication for our pricing draft: habit cadence must stay free.** A daily
planner whose routines are paid reads as extortionate, and cadence is core to the
product's thesis, not an upsell. This is consistent with "free gives you today" — but
worth stating explicitly so it doesn't get quietly moved later.

### 4. ⚠️ Invisible generosity earns you nothing — sharpens the beta-marker plan
Fantastical 3 grandfathered existing owners *completely* (they kept every feature they'd
paid for, permanently, per platform) — MacStories called it *"one of the most reasonable,
generous upgrade flows I've seen"* — **and got review-bombed anyway.** The diagnosis, from
David Lynch via Michael Tsai:

> *"there's **no in-app indication of 'you're getting X for free because you bought the
> app'**. So existing users only see the places they're being asked to pay more… if
> they'd swapped some of the 'you need pro' stars into '**loyal customer**' icons, we'd all
> have a better sense of what we're getting."*

This refines the beta-cohort recommendation in `PRICING-AND-MARKETING-2026-07-29.md`.
The `✦` marker should **not** read as "this is premium (but you have it)". It should read
as **"included for you — beta"**. Same information, opposite emotional valence: one is a
future bill, the other is a gift being received. Given our beta is friends and clients
who did us a favor, this is the difference between the marker building goodwill and
building dread.

Counterpoint worth keeping (Tsai, defending subscriptions): *"I don't actually want major
changes or a lot of new features. I just want them to keep maintaining it."*

### 5. An open lane: nobody cascades
Structured explicitly does **not** ripple the day — tasks are pinned to absolute times,
overruns must be hand-slid, and overlaps render badly. It's the loudest unmet request in
its reviews, with users volunteering the correct design:

> *"add an unexpected event… and have everything bump forward accordingly, rather than
> having to hand slide it… **having some events able to be toggled as 'locked' and
> un-bumpable would be important**."*

Tweek has no times to ripple. Motion cascades but *silently*, which the community calls
"AI calendar anxiety" (see the main study's Part C). **Nobody has shipped consent-based
cascade** — "your 2pm ran long; shift the next three? [yes / just this one / no]" with
lockable anchors. That's an open lane, and it's compatible with our no-silent-moves rule.

### 6. Design the *rejection* of a bad parse alongside the parser
Compass's Planner parses a natural-language dump and currently offers no way to say "no,
that word isn't a date." The two mature parsers both treat rejection as first-class:
- **Todoist** documents its canonical false positive (`"Create monthly report"` → `monthly`
  grabbed as recurrence) on **four separate help pages**, and ships two undo gestures —
  click the highlighted token, or **press Backspace immediately after it highlights**
  (one keystroke, no mode change).
- **Fantastical** ships a **quoting escape**: `"Prepare for Wacky Wednesday" on Tuesday at 9pm`.
- Todoist also publishes a table of **unsupported** recurrence patterns *with prescribed
  workarounds* — unusually honest, and probably deflects real support load.

⚠️ Todoist's **last-token-wins** ordering is a leak worth avoiding: `lunch today for next
Tuesday` yields next Tuesday, and reviewers report having to *train themselves* to type
the date last. A parser that requires user retraining is exposing its implementation.

### 7. Two philosophies of parse preview — and Fantastical's is the one to want
- **Todoist**: annotates in place, strips recognized text on save. Cheap, dense, no context.
- **Fantastical**: builds the object *beside* you as you type, and recognized words are
  **animated — "flown down"** into the field they populate, so the transfer is visible.
  Type "for two hours" and the event block **extends vertically**; add "repeat every week"
  and a repeat icon appears on it live.

The part Todoist has no answer to: **Fantastical previews against your real calendar**,
and the binding is **two-way** — *"you can drag the event preview to a different day or
time, and the event creation details will update automatically."* You see the parse *and*
whether it collides with anything.

For Compass this is directly relevant, because our differentiator is exactly context:
previewing a parsed task against *the day's tide and existing blocks* is the Fantastical
move plus the thing only we have.

Also: **Fantastical confirms a mode change on three channels at once** (event→task changes
the header text, restyles the preview to the list color, *and* pops a checkbox).

### 8. Fantastical's parser is deliberately NOT an LLM
Flexibits markets it as an on-device ML model with rules on top — *"usually faster than an
LLM"*, and no data leaves the device. **Privacy and latency positioned as parser features.**
Worth noting given our own correction that Compass's weave is deterministic ephemeris math
and only the initial list parse is AI: being the non-LLM option is a marketable stance, not
an admission.

### 9. Both NL leaders give the parser away free
Todoist monetizes deadlines and durations, not capture. Fantastical monetizes scheduling
links and autocomplete, not parsing. **Neither treats fast capture as monetizable — it's
the acquisition hook.** Consistent with our "free gives you today" line.

---

## Reference detail worth keeping

**Notion Calendar's two-key editing chords** (extracted from the shipping bundle; not
publicly documented): `E`+`T` title · `D` day · `S` start · `Q` end · `Z` time zone ·
`R` repeat · `P` participants · `L` location · `U` duration · `Y`/`N`/`M` respond.
Views on single keys: `1`/`D` day, `0`/`W` week, `M` month, `2`–`9` N-day.
**Correction to a widely-repeated claim:** Notion's own docs say ⌘K toggles weekends. It
doesn't — ⌘K is the command menu; weekends are `⇧⌘E`.

**Akiflow's two-entry-point command bar:** `⌘E` global/OS-wide, `⌘K` in-app. Splitting by
context is cleaner than overloading one hotkey. Core triage keystroke is `P` (plan the
selected task). Syntax: `#project` `*tag` `!priority` `<deadline` `=2h`.

**Akiflow killed Snooze and replaced it with Time Frames** — hide-until-date → place-in-
visible-horizon (Today / This Week / Next Week / This Month / Someday), all still visible
on an Upcoming page. They traded inbox cleanliness for reviewability. Relevant to how we
think about Someday/deferred work.

**Structured's three layout densities** (Full / Simplified / Minimal — the last removes
timestamps entirely) exist explicitly because *"[it] may help you if you are having
trouble focussing on too many things at once."* A precedent for our essential/expanded
density toggle, taken one step further.

**Structured's Replan** is the most developed day-repair ritual in the category: a
Tinder-style card stack over unfinished tasks, four swipe directions (reschedule / inbox /
complete / delete). Includes a shame-adjacent nudge — reschedule the same task 3+ times
and a badge counts the moves. Note that as a *risk*, not just a feature (see main study
Part C on guilt ledgers).

**Amie is a cautionary tale, not a model.** Won Best Designed App 2022, shipped genuinely
novel interactions (drag an email onto the grid to schedule a reply; **while composing an
email, typing "let's meet tomorrow at 4pm" pops a preview card of your calendar at that
slot showing conflicts**; Spotify history plotted onto the timeline). Then pivoted to AI
meeting notes in July 2024. Now 3.39/128 on the US App Store with *"pretty and fun but
functionally challenged"* and *"the AI scheduler doesn't exist… but it says it does."*
Pricing changed at least five times in two years; the free tier was removed.
**Contrast:** Notion Calendar launched to *"just a skin for Google Calendar"* and now sits
at **4.74/7,061** on the strength of a complete keyboard layer and a free price.

---

## Unverified / open
- Exact highlight colors in Todoist and Fantastical previews — neither vendor documents
  them; third-party sources say red. Don't quote a color without a screenshot.
- Amie's current free tier (its own page shows none; third parties claim one) and live
  prices for Amie/Fantastical (client-rendered).
- Product Hunt review corpora (Cloudflare-blocked); Reddit for Structured and Tweek
  specifically (crawler-blocked — App Store RSS and HN substituted).
