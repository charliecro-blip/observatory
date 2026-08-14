// COMPASS — the first thing on Home, and the app's whole promise in one act.
//
// The loop (now → then) already existed, but it rendered inside the "What
// lines up" card, below a section title, a badge row and a serif item title —
// so the first thing the eye met was a card header, not the answer. Owner,
// 2026-08-13: "a key feature would be — what should I do right now? That's
// the central, main feature of this."
//
// This is that answer standing on its own, above the reading it came from.
// It states one act, why now, and what follows — and when work is already
// underway it says keep going instead, which overrides the sky on purpose.
//
// It deliberately does NOT restate the evidence, the alternatives, or the
// horizon. Those stay in the card below, which is where someone goes when
// they want to argue with the answer rather than act on it.

import { ELEMENT_COLORS } from "@/lib/elements";

export interface LoopShape {
  now: {
    title: string;
    heldId: string;
    why: string;
    until: string | null;
    inFlow: boolean;
    elapsedMin?: number;
  } | null;
  then: { title: string; heldId: string; startClock: string } | null;
}

const ACCENT = ELEMENT_COLORS.earth;
const FLOW = "#4a7a52";

export default function CompassNow({ loop, onOpenWork, onAsk }: {
  loop: LoopShape | undefined;
  /** Jump to the item in Your Work — the row is where you complete it. */
  onOpenWork?: (heldId: string) => void;
  /** Ask the advisor about this specific suggestion. */
  onAsk?: (seed: string) => void;
}) {
  const now = loop?.now;
  // Nothing to loop over is not this component's story to tell — Home's
  // cold-start doors and its all-placed state both say it better, with the
  // right offer attached. Rendering an empty stage here would be the
  // "beautiful centerpiece with nothing in it" failure.
  if (!now) return null;

  const inFlow = now.inFlow;
  const edge = inFlow ? FLOW : ACCENT;

  return (
    <div style={{
      background: "var(--color-card)",
      border: "1px solid var(--color-border)",
      borderLeft: `3px solid ${edge}`,
      borderRadius: 12,
      padding: "15px 20px 16px",
    }}>
      <div style={{
        fontSize: 9, textTransform: "uppercase", letterSpacing: "1px",
        color: inFlow ? FLOW : "var(--text-3)", marginBottom: 5,
      }}>
        {inFlow ? `Keep going · ${now.elapsedMin}m in` : "Compass · right now"}
      </div>

      {/* The act, at the size of an answer. */}
      <div style={{
        fontFamily: "var(--font-display)", fontSize: 26, lineHeight: 1.2,
        color: "var(--color-foreground)", letterSpacing: "0.01em",
      }}>
        {now.title}
      </div>

      {now.until && !inFlow && (
        <div style={{ fontSize: 12.5, color: "var(--color-muted)", marginTop: 3 }}>
          until {now.until}
        </div>
      )}

      <div style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.55, marginTop: 6, maxWidth: 62 * 8 }}>
        {now.why}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 11, flexWrap: "wrap" }}>
        {onOpenWork && (
          <button onClick={() => onOpenWork(now.heldId)} style={{
            fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8,
            border: "none", cursor: "pointer", background: "var(--color-primary)", color: "var(--color-card)",
          }}>{inFlow ? "Mark it done" : "Start this"}</button>
        )}
        {onAsk && (
          <button onClick={() => onAsk(`Why is "${now.title}" the strongest fit right now, and how should I go about it?`)} style={{
            fontSize: 11.5, background: "none", border: "none", padding: 0,
            cursor: "pointer", color: "var(--color-primary)",
          }}>Why this? →</button>
        )}
        {/* The horizon, kept quiet: naming what follows gives the moment a
            shape without turning the page into a queue. Absent while in
            flow — a queue shown mid-task is the interruption we refuse. */}
        {loop?.then && !inFlow && (
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>
            then · {loop.then.title}
            {loop.then.startClock ? ` at ${loop.then.startClock}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
