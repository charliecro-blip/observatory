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
      { term: "Evening — Log the day", text: "Rate how the day actually felt: aligned, mixed, or off. Thirty seconds. This is the part that makes the app yours — it learns which days land for you and stops guessing." },
      { term: "Why the rating matters", text: "Compass will not tell you which days suit you until it has enough of your own ratings to say so honestly. Until then it says so." },
    ],
  },
  {
    key: "today",
    glyph: "◉",
    title: "Today",
    lead: "What kind of moment this is, and what it's good for.",
    points: [
      { term: "The tide card", text: "The day's character (Deep, Surge, Building, Clear) and its level — how charged it is and which way it's moving. Drag across the chart to read any hour." },
      { term: "Your window", text: "One suggested stretch for something you actually have to do — not a generic 'good time to rest'." },
      { term: "The left rail", text: "The sky as it is right now: season, Moon, planetary day and hour. Tap the ? badges to learn any of it. Ignorable — nothing in the loop requires it." },
    ],
  },
  {
    key: "calendar",
    glyph: "▦",
    title: "Calendar",
    lead: "Your week, and the thirty days ahead.",
    points: [
      { term: "The strip", text: "Thirty days of tide at a glance. Tap a bar to jump to that day." },
      { term: "The Log", text: "Every rating and logbook line you've written, stamped with that day's sky. Ahead and behind in one place." },
      { term: "Keys", text: "D / W / M / A switch views, T jumps to today, ← → move by one." },
      { term: "Subscribe", text: "Settings → Your calendar feed gives you a link that puts your blocks into Apple Calendar, Google Calendar or Outlook, and keeps them up to date." },
    ],
  },
  {
    key: "aims",
    glyph: "✦",
    title: "Aims",
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
      { term: "It won't pretend to know you yet", text: "The personal layer needs your birth details, and the felt-pattern needs a couple of weeks of ratings. Until then it tells you what it doesn't know." },
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
