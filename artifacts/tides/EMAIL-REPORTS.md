# Email Reports — content & voice spec

**Status:** Phase 1 built (2026-07-05) — the *content*, previewable live, no
sender yet. Owner decision: email reports lead; push/text notifications are a
later phase.

**Preview them now** (Settings → Email reports, or directly):
```
/api/reports/preview?span=day&tz=<offset>     (HTML, as the email would render)
/api/reports/preview?span=week&tz=<offset>
/api/reports/preview?span=month&tz=<offset>
&format=json                                   (subject + blocks + plaintext)
```

---

## The idea

The report is the app coming to you: a short, literate weather bulletin for
your life, in the same voice as the product. Each span answers one question:

| Span | Question | Sent | Subject pattern |
| --- | --- | --- | --- |
| **Day** | What kind of day is this? | each morning ~6am local | `Today's weather — Water · workable · Moon void` |
| **Week** | What shape is the week? | Sunday evening | `Your week ahead — the shape of the next seven days` |
| **Month** | Where are the anchor points? | 1st of the month (or day after New Moon) | `Your month ahead — lunations and the transits that matter` |

## Content blocks (built, in order)

**Day** — 30-second read:
1. The day's character: element + quality ("A water day — feeling, depth, absorption — workable conditions").
2. Moon: phase, % lit, sign, void-of-course note if live.
3. Planetary day + current hour, with one "good for" phrase.
4. *On deck today* — the user's scheduled windows (Planner output included).
5. *The big sky* — top 2 aspects, **station-honest** ("never perfected; a station turned it back").
6. *Landing on your chart* — top 3 personal transits (needs natal chart; degrades honestly).
7. A one-line closing nudge tied to their first Guiding Star.

**Week** — 60-second read:
1. *The shape of the week* — 7 one-liners: weekday, Moon sign, element, quality.
2. *Already on your calendar* — the week's planning windows.
3. *Landing on your chart this week* — dated transit forecast (7d).
4. Closing: "Plan the deep work into the good days; keep the mixed ones light."

**Month**:
1. *The month's anchor points* — New/Full Moon dates with one-word guidance.
2. Transits perfecting, grouped week by week (30d forecast engine).
3. Closing line on lunations as the month's tide.

## Voice rules (same guardrails as the app)

- **Describe, never promise.** "Workable conditions," never "a great day awaits."
- Weather register throughout; astrology terms appear but are always glossed in plain words.
- The reader's aims lead; the sky supports. The star-nudge closes, it doesn't open.
- Short. Day ≤ ~120 words, week ≤ ~200, month ≤ ~250. If a block is empty, it's omitted — no filler.
- Station-honest, VoC as "slack water," advisories gentle. No health/medical/financial claims.
- Footer on every report: *"Conditions, not fate — the sky describes the weather; you steer."*

## Rendering

- HTML: single-column, ≤560px, Georgia serif, warm paper palette (email clients
  won't load Geist/Baar Sophia — the almanac-paper look is the email identity).
  Inline styles only (email-client safe). Plaintext alternative generated.
- The wordmark stays text ("Tides") until a hosted logo image exists.

## Phase 2 — sending (not built)

1. **Settings opt-in**: email field + toggles per span + preferred hour; store on
   `tester_profiles` (add `email`, `reportPrefs` jsonb).
2. **Sender**: Resend (simplest) — one `POST /emails` per report; needs
   `RESEND_API_KEY` on Railway + a from-domain (ties into the custom-domain task).
3. **Scheduler**: a Railway cron (or `node-cron` in the server) that walks
   opted-in profiles each hour and sends where `localHour === preferredHour`.
4. Unsubscribe link (signed testerId token) — legally required before real sends.
5. Later phase: push/text notifications reuse the same composed blocks.

## Fine-tuning knobs (owner, react to the previews)

- Subject-line flavor: informational (current) vs. evocative ("High water at 9am").
- The star-nudge line: keep / rotate variants / drop.
- Week report: add best-windows-per-element? (engine exists; adds length.)
- Month report: include profection-month line? (needs birth time.)
- Day report send-time: fixed 6am vs. at the user's wake time (chronotype).
