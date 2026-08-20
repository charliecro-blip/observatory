/**
 * "How Compass works" — the thing to come back to.
 *
 * The intro slides teach the CONCEPTS (character, level, nested rhythms) and do
 * it well. What nothing taught was the app: which tab is for what, what the
 * daily loop is, and which affordances exist at all. A new tester finished
 * onboarding knowing what a tide is and not knowing that Plan takes a pasted
 * to-do list.
 *
 * And the intro runs exactly once. Anything learned there is gone by Thursday,
 * with no way back to it — which is the specific gap this closes.
 *
 * Voice per LANGUAGE-STUDY §1: plain in the instruction. This screen is all
 * instruction, so there is no lyricism in it anywhere.
 */
import React, { useState } from "react";
import { logEvent } from "@/lib/analytics";

interface Section {
  key: string;
  glyph: string;
  title: string;
  lead: string;
  points: { term: string; text: string }[];
}

const SECTIONS: Section[] = [
  {
    key: "loop",
    glyph: "◉",
    title: "The daily loop",
    lead: "Two moments a day. Everything else is optional.",
    points: [
      { term: "Morning — Cast off", text: "Today opens with the day's character, your first few things, and one good window. It appears in the first hours after you wake, not at a fixed clock time." },
      { term: "Evening — Log the day", text: "A line about the day, if you want one. It lands in the Log stamped with that day's sky. Optional — nothing depends on it." },
      { term: "Your pattern", text: "Built from what you actually finish — tasks, habits, blocks — against the kind of day it was, including void spells. Nothing extra to log: it accrues from work you were doing anyway. It stays silent until there is enough of it to mean something, and it reports what happened, never what a day does to you." },
    ],
  },
  {
    key: "kinds",
    glyph: "⊞",
    title: "What lives where",
    lead: "Several kinds of thing, one capture sheet — say it and Compass files it.",
    points: [
      { term: "A task", text: "Fires once and is done. \"Call mom friday\" — the date is read from your words." },
      { term: "A habit", text: "Recurs on the rhythm you choose and is scored only against that rhythm. A chore is a habit without the streak language — plain upkeep, checked off and never scored." },
      { term: "A sprint", text: "A short push with a hard end date — a week of cold showers, ten cold calls. Sometimes it rides a transit; ending early is allowed and recorded honestly." },
      { term: "A Guiding Star", text: "The long thing you're steering toward. Stars don't get scheduled — their steps and habits do, and everything done in their service counts toward them." },
      { term: "A win", text: "The record that something happened, planned or not. Finished tasks, kept habits, sprint days and named moments all land in the wake on their own." },
      { term: "Home and Today", text: "Home steers what you're holding; Today runs the day itself." },
    ],
  },
  {
    key: "home",
    glyph: "⌂",
    title: "Home",
    lead: "What you're steering, and when the sky backs it.",
    points: [
      { term: "Where you are", text: "Your Guiding Stars with the habits and tasks that serve each one under them, plus anything not tied to a star yet." },
      { term: "Everything you're holding", text: "Every open task in one list, split by overdue, today, no date, and later. Type a line and press Enter; there's no form." },
      { term: "The weather", text: "One line for the kind of day it is, with the chart and the full reading underneath if you want them. Compass does not tell you what to do with it — Ask does that, when you ask." },
    ],
  },
  {
    key: "log",
    glyph: "❦",
    title: "Log",
    lead: "What actually happened, in your own words.",
    points: [
      { term: "The record", text: "What you finished and what you wrote, day by day, stamped with the sky at the time — so a pattern can be looked for later rather than assumed now." },
      { term: "The evening line", text: "One sentence about how the day went. Nothing is required, and a quiet day in the log is still a day in the log." },
      { term: "Why it's stamped", text: "The sky is recorded alongside what you did so the two can be compared honestly. Compass never claims the connection for you." },
    ],
  },
  {
    key: "calendar",
    glyph: "▦",
    title: "Calendar",
    lead: "Your week, and the thirty days ahead.",
    points: [
      { term: "The strip", text: "Thirty days of tide at a glance. Tap a bar to jump to that day." },
      { term: "The Log", text: "Every line you've written, stamped with that day's sky, alongside what you finished. Ahead and behind in one place." },
      { term: "Keys", text: "D / W / M / A switch views, T jumps to today, ← → move by one." },
      { term: "Subscribe", text: "Settings → Your calendar feed gives you a link that puts your blocks into Apple Calendar, Google Calendar or Outlook, and keeps them up to date." },
    ],
  },
  {
    key: "aims",
    glyph: "✦",
    title: "Stars",
    lead: "The long things, and the daily things.",
    points: [
      { term: "Guiding Stars", text: "A few long-term aims. Each gets an element, which is how Compass knows which days suit moving it forward." },
      { term: "Tasks", text: "Anything with a due date. Undone tasks carry forward on their own and say so — 'carried from Mon' — rather than quietly disappearing." },
      { term: "Habits", text: "Things you do repeatedly. Set a cadence — every day, most days, a number of times a week, or whenever it fits — and Compass stops nagging about the ones that never had a schedule." },
      { term: "Solar anchors", text: "A daily can be anchored to sunrise or sunset instead of a clock time, so it moves with the season. Your two starter habits already are." },
    ],
  },
  {
    key: "plan",
    glyph: "▲",
    title: "Plan",
    lead: "Two different questions.",
    points: [
      { term: "Weave a list", text: "Paste in a to-do list — plain text, however you'd write it to yourself — and Compass places it into the week, matching each thing to a day that suits it." },
      { term: "Begin something", text: "Pick a good moment to start something specific. This is the one that will sometimes tell you not to: if the month is genuinely against it, you get an Avoid, not a nearest-available slot." },
      { term: "Capacity", text: "If a day is already full, Compass says so before it writes anything, rather than fitting things in and letting you discover it later." },
    ],
  },
  {
    key: "honest",
    glyph: "◐",
    title: "What Compass won't do",
    lead: "Worth knowing up front.",
    points: [
      { term: "It won't move your blocks behind your back", text: "Nothing reschedules silently. If something needs to shift, you shift it." },
      { term: "It won't promise outcomes", text: "It describes conditions. 'This stretch suits deep work' — never 'this will go well'." },
      { term: "It won't pretend to know you yet", text: "The personal layer needs your birth details, and the pattern needs a few weeks of finished work behind it. Until then it tells you what it doesn't know." },
      { term: "It won't keep a guilt ledger", text: "There's a record of when you showed up, not a streak that resets. A rhythm has a beat you can miss and come back to." },
    ],
  },
];

export function Guide({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<string | null>("loop");

  React.useEffect(() => { logEvent("guide_opened"); }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How Compass works"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "24px 16px", overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-card)", border: "1px solid var(--color-border)",
          borderRadius: 16, maxWidth: 560, width: "100%", padding: "24px 24px 20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--color-primary)" }}>How Compass works</div>
          <button onClick={onClose} aria-label="Close the guide" style={{
            background: "none", border: "none", fontSize: 18, color: "var(--text-3)", cursor: "pointer", lineHeight: 1,
          }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 16, lineHeight: 1.6 }}>
          You don't need to know any astrology to use this. Everything below is optional except the first section.
        </div>

        {SECTIONS.map((s) => {
          const isOpen = open === s.key;
          return (
            <div key={s.key} style={{ borderTop: "1px solid var(--color-border)" }}>
              <button
                onClick={() => { setOpen(isOpen ? null : s.key); if (!isOpen) logEvent("guide_section", { section: s.key }); }}
                aria-expanded={isOpen}
                style={{
                  width: "100%", display: "flex", alignItems: "baseline", gap: 9, padding: "12px 0",
                  background: "none", border: "none", cursor: "pointer", textAlign: "left",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--color-muted)", width: 14 }}>{s.glyph}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-foreground)" }}>{s.title}</span>
                  <span style={{ fontSize: 11.5, color: "var(--text-3)", marginLeft: 8 }}>{s.lead}</span>
                </span>
                <span style={{ fontSize: 10, color: "var(--text-3)" }}>{isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen && (
                <div style={{ paddingBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  {s.points.map((p) => (
                    <div key={p.term} style={{ paddingLeft: 23 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-1)", marginBottom: 2 }}>{p.term}</div>
                      <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.65 }}>{p.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 14, marginTop: 2, fontSize: 11, color: "var(--text-3)", lineHeight: 1.6 }}>
          Still stuck, or something looks wrong? Email charliecro@gmail.com — during the beta that reaches a person, not a queue.
        </div>
      </div>
    </div>
  );
}
