# Handoff — Home / Today split, and Google verification

Written 2026-08-14 at the end of a long session. Everything below is decided
unless marked OPEN. Nothing in the Home/Today section has been built yet.

---

## 1. The Home / Today split — DECIDED, not built

The organizing principle. Not *what data goes where* but **what question each
page answers**:

- **Home — "how am I doing, and what's coming?"** The standing, panoramic view.
- **Today — "what do I do next?"** The working view: one moment, one answer.

This is why the two pages kept duplicating each other. Today was home for a
while and accumulated both jobs; Home was then built beside it doing the same
job again. Three surfaces currently answer "what's on today": Home's task
groups, Today's list, and `DayAhead`.

### Owner's decisions (2026-08-14, verbatim where it matters)

> "today should definitely have a task list, and home gets cropping up - home
> should get a panoramic view of the most important things. maybe also the 14
> day view ahead"

Which settles the two questions that were open:

1. **Today KEEPS a task list.** It was not obvious — dropping it would have
   made Today genuinely slim, at the cost of making "place it on the calendar"
   the only way to see a task there. Rejected.
2. **Home GETS the cropping-up items.** The risk being accepted here is that
   Home becomes the everything-page again, which is the exact failure mode
   this split exists to undo. See the guard below.

### What moves

**To Home:**
- Habit progress and Guiding Star progress. Both are week-scale and read as
  noise on a page about the next hour.
- **"Cropping up"** — the panoramic strip. Sources already exist: the almanac
  (`/api/tides/almanac`, stations + eclipses + ingresses) and `rareWindows`.
  A retrograde station next week is precisely "a major thing cropping up".
- **A 14-day view ahead** (owner: "maybe also"). Treat as in-scope but the
  lowest-confidence item — build it last and check it earns its space.
  `QualityStrip` already renders exactly this shape and now correctly starts
  at today (fixed in `ea066bf`); `useTidesWeek(14, lat, lon, 0)` feeds it.
  Reuse it rather than writing a second one.

**Off Today:**
- The week strip, the Guiding Stars block, standing reference material.
- Today keeps: the current window and what to do in it, the day's actual
  schedule, capture, and its task list.

### The guard against Home re-bloating

Home is panoramic, which means **breadth at low resolution**. Every Home
section should be a *summary with a door* — a count, a shape, or a single
line, plus a way through to the tab that owns the detail. The moment a Home
section becomes the place you *do* the thing rather than *see* it, it belongs
on its own tab. Applies especially to the cropping-up strip: it names what is
coming, it does not explain it.

### The task list is the hard case — READ THIS BEFORE EDITING HOME

It belongs on both pages, as different things:

- **Home** — the whole list. "What am I holding?"
- **Today** — only what is placed today. "What's next?"

Home already fetches every task (bare `/api/tasks`, deliberately — see the
comment at `pages/Home.tsx:330`). The bug is presentation, not data. Verified
2026-08-14: tasks come back correct, `done:"false"`, `planningWindowId` set.

`pages/Home.tsx` around line 500 splits them into `overdue` / `dueToday` /
`undated` / `later`, then renders:

```
<Group label="overdue" items={overdue} />
<Group label="today"   items={dueToday} />
<Group label="no date" items={undated} cap={5} />
<Group label="later"   items={later} muted cap={5} />
```

An imported list of ten lands almost entirely in the two **capped, muted,
bottom** groups. That is why the owner repeatedly reported "not seeing the
to-do list I imported" while the data was present the whole time. Fixing this
means raising or removing the caps and reordering so an imported list is the
page's subject — a real edit to Home's task column, not a tweak.

Related, still open from an earlier session: **Plan should collapse its input
once a list exists**, offering "add more" rather than a large empty textarea.
Same underlying complaint — "I've already imported a list, orient around it,
minimal prompting for new input, although a little."

---

## 2. Google — what the owner needs to do

### Right now, for beta testers

**Switch the OAuth consent screen from "Testing" to "In production."** Stay
unverified. Testing mode expires refresh tokens after **7 days**, and Compass
requests `access_type=offline` (`routes/googleCal.ts:126`), so every tester
would silently need to reconnect weekly. In production they persist. It also
ends having to add each tester's email by hand.

Unchanged: testers still see "Google hasn't verified this app" once and go
**Advanced → Go to Compass**. Unverified apps carry a **100-user cap that
applies over the project's entire lifetime and cannot be reset** — do not burn
slots on throwaway accounts.

The expiry is already handled honestly in the app: `/status` refreshes to test
the grant and returns `needsReconnect`, and both Calendar and Settings surface
it, so an expired grant reads as "reconnect" rather than an empty calendar.

### Verification, if the beta outgrows 100 users or the warning costs signups

Compass requests `calendar.readonly` only — a **sensitive** scope, not a
restricted one. That matters: sensitive-scope verification needs the standard
review, **not** the third-party CASA security assessment restricted scopes
require.

Prepare:
1. **Verify domain ownership of compass.day in Google Search Console**, using
   the same Google account that owns the Cloud project.
2. **Host a publicly reachable privacy policy on compass.day** and link it on
   the consent screen. NOT YET CHECKED whether one exists — verify first.
3. A homepage on that domain explaining what the app does.
4. Consent screen branding accurate: app name, logo, support email.

Submit, via Cloud Console → APIs & Services → **Verification Center**:
5. Declare every scope requested and justify `calendar.readonly` specifically
   — say what it reads and why the feature cannot work without it.
6. **A demo video** showing the OAuth flow and the scope actually in use.
   Google requires the consent screen and the data's use to be visible.

Then: review happens over email to the project owners/editors. Weeks, not days.

Sources: [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification),
[Submitting your app for verification](https://support.google.com/cloud/answer/13461325?hl=en),
[Verification requirements](https://support.google.com/cloud/answer/13464321?hl=en),
[Unverified apps](https://support.google.com/cloud/answer/7454865?hl=en),
[Manage app audience](https://support.google.com/cloud/answer/15549945?hl=en)

---

## 3. Shipped this session, for context

`c67a58d` planetary hours no longer invented for users without coordinates ·
`0b2d9d7` `linesUp` takes an injectable `now`, recovered from a worktree a
prior handoff had wrongly called safe to discard · `6a96ed2` accessibility
pass ported forward (every glyph button labelled) · `95e3c7b` the almanac in
Plan · `ea066bf` water-ahead starts at today; all shorthand hex expanded so
`${color}${alpha}` cannot produce an invalid value; `oneAuthority` timeout
raised to 120s · `e3c6ab2` Jupiter's void verbs varied · `6c8f74b` Virgo's
void reframed positively.

## 4. Still open

- **The Home/Today split above** — the main piece of work.
- **Plan's input collapse** once a list exists.
- **AstroLyrica**: the void table's frame is now a written question in
  `ASTROLYRICA-COPY-HANDOFF.md` — should `feel` name a lack at all across the
  twelve signs, or should the table describe what each sign's attention is
  good at and let `VOID_SCOPE` do the limiting? Note the entries leaning
  hardest on caution (Libra's "Be sociable and don't sign") read as the most
  useful, so the answer may not be uniform.
- **Aug 28 Pisces lunar eclipse** cycle curation — needs the owner's
  node-polarity call. The almanac now surfaces the date on its own.
- **VAPID keys on Railway** for push, plus a frequency policy.
- **Natal half of Pass 3** (`ActivityAssessment` taking an optional chart).
- **Habits' kind-of-work** is recorded but still not consumed by timing. The
  UI implies otherwise; say so plainly until it is wired.
- `/api/practices` 404 — running in a separate session as of 2026-08-14.
