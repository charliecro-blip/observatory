/**
 * ASK — three doors (design 2026-08-19, DESIGN-ASK-AND-HOME).
 *
 * The panel used to open with eleven-plus prompts at once: a row per Guiding
 * Star, four "right now" rows, four timing chips, and a text field. Every one
 * was well written and the set was unreadable — a menu that long is a wall.
 *
 * The three groups it already had are not arbitrary. They are three
 * RELATIONSHIPS TO TIME, and they mirror the app's own ladder:
 *
 *   Orient       the long    Stars    "am I still pointed somewhere?"
 *   This moment  now         Today    "what's actually in front of me?"
 *   Timing       ahead       Plan     "when should this happen?"
 *
 * So this is not new structure. It is that structure, CLOSED by default:
 * three choices instead of eleven, and opening one reveals its three.
 *
 * THE GUARD. Ask never answers "what should I do" — the loop does, above it,
 * deterministically, and two answers to one question is the failure this
 * codebase has fixed three times. Everything behind "This moment" is framed
 * as thinking about the pick that already exists: why it, what it cannot see,
 * whether rest is the better call. "Orient" is the one door that may propose,
 * and it is safe because a Guiding Star is not a now-question.
 *
 * One component, both surfaces (the advisor panel and Home), so the doors
 * cannot drift apart.
 */

import { useState } from "react";
import { ELEMENT_COLORS } from "@/lib/elements";

/** A pick carries a ready question and, where it makes sense, the fragment a
 *  surface with a text field should prefill instead. */
export interface AskPick { send: string; fill?: string }

interface DoorItem { label: string; sub?: string; pick: AskPick }
type DoorKey = "orient" | "moment" | "timing";

// Hues come from the element table, never re-frozen as literals here — the
// palette themes rewrite those tokens, and a hardcoded hex survives the theme
// switch as a stain (regressions.test.ts pins this).
const DOOR_META: Record<DoorKey, { title: string; blurb: string; color: string }> = {
  orient: { title: "Orient",      blurb: "Toward a Guiding Star",           color: ELEMENT_COLORS.air },
  moment: { title: "This moment", blurb: "Why this, and what it can't see", color: ELEMENT_COLORS.water },
  timing: { title: "Timing",      blurb: "When, and which window",          color: ELEMENT_COLORS.fire },
};

function DoorIcon({ door, size = 21 }: { door: DoorKey; size?: number }) {
  const c = DOOR_META[door].color;
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: c, strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (door === "orient") {
    return <svg {...common}><path d="M12 3.2 L13.9 9.4 L20.2 9.4 L15.1 13.2 L17 19.4 L12 15.6 L7 19.4 L8.9 13.2 L3.8 9.4 L10.1 9.4 Z" /></svg>;
  }
  if (door === "moment") {
    return <svg {...common}><circle cx="12" cy="12" r="8.4" /><circle cx="12" cy="12" r="2.6" fill={c} stroke="none" /></svg>;
  }
  return <svg {...common}><circle cx="12" cy="12" r="8.4" /><path d="M12 7.4 L12 12 L15.4 13.8" /></svg>;
}

export function buildDoors(
  stars: { id: number; title: string }[],
  strongestFit: { title?: string; why?: string } | null | undefined,
): Record<DoorKey, DoorItem[]> {
  return {
    // With no stars this is the cold-start door too, at no extra cost.
    orient: stars.length
      ? stars.map(s => ({
          label: s.title,
          sub: "Move this forward",
          pick: { send: `Help me make progress on my guiding star "${s.title}" right now. Given what I'm holding and the hours left, what's one concrete thing I could do toward it — and if this isn't the moment for that kind of effort, say so and tell me when would be better.` },
        }))
      : [{
          label: "Help me name one",
          sub: "A long-term ideal to steer by",
          pick: { send: "I don't have a Guiding Star yet. Ask me a couple of questions about what I'm actually trying to build or change, then suggest two or three I could steer by — concrete enough that a task could serve them." },
        }],

    moment: [
      ...(strongestFit?.title ? [{
        label: "Why this suggestion?",
        sub: `Compass is pointing at "${strongestFit.title}"`,
        pick: { send: `Compass is suggesting "${strongestFit.title}" right now, because: ${strongestFit.why ?? "(no reason given)"} Walk me through that reasoning — which factors actually drove it, how strong the case is, and what would have to be true for it to be the wrong call.` },
      }] : []),
      {
        label: "What should I weigh right now?",
        sub: "The things timing can't account for",
        // It asked what could "outweigh Compass's current suggestion" until
        // Home stopped making one (2026-08-19). A question about a
        // recommendation nobody asked for has nothing to refer to.
        pick: { send: "Given the hour I'm in and what I'm holding, what should I actually weigh right now? Be specific about what the app cannot see — my energy, obligations, whether something is blocked, other people — and how each would change what's worth doing." },
      },
      {
        label: "Is this a moment to rest?",
        sub: "An honest look, not a push",
        pick: { send: "Is this a moment to rest? Look honestly at what's in front of me. If stepping back is the better call, help me feel okay about it instead of pushing. If it genuinely supports effort, tell me that plainly too." },
      },
    ],

    timing: [
      {
        label: "Is now a good time?",
        sub: "For what you're about to start",
        pick: {
          send: "Given what I'm holding and the hours left today, what's genuinely well-timed right now — and what would be better left for later?",
          fill: "Is now a good time to ",
        },
      },
      {
        label: "When should I…",
        sub: "Find the window in the week",
        pick: {
          send: "Look at what I'm holding and my week, and tell me when the big ones are best done. Where the timing is genuinely open, say so rather than inventing a preference.",
          fill: "When today or this week should I ",
        },
      },
      {
        label: "Compare two options",
        sub: "Name the trade-off",
        pick: {
          send: "I have more than one thing I could do with this window. Walk me through how to choose between them, given my deadlines and what Compass already suggested.",
          fill: "Which is the better use of this window — ",
        },
      },
    ],
  };
}

export default function AskDoors({
  stars, strongestFit, layout, onPick, note,
}: {
  stars: { id: number; title: string }[];
  strongestFit?: { title?: string; why?: string } | null;
  /** "tiles" — three across, for Home. "rows" — compact, for the panel. */
  layout: "tiles" | "rows";
  onPick: (pick: AskPick) => void;
  note?: string;
}) {
  const [open, setOpen] = useState<DoorKey | null>(null);
  const doors = buildDoors(stars, strongestFit);
  const keys: DoorKey[] = ["orient", "moment", "timing"];

  const Tile = ({ k }: { k: DoorKey }) => {
    const meta = DOOR_META[k];
    const isOpen = open === k;
    return (
      <button
        onClick={() => setOpen(isOpen ? null : k)}
        aria-expanded={isOpen}
        style={{
          display: "flex", flexDirection: layout === "tiles" && !open ? "column" : "row",
          alignItems: layout === "tiles" && !open ? "flex-start" : "center",
          gap: layout === "tiles" && !open ? 6 : 9,
          padding: layout === "tiles" && !open ? "14px 13px" : "11px 12px",
          textAlign: "left", width: "100%", cursor: "pointer",
          border: isOpen ? `1.5px solid ${meta.color}` : "1px solid var(--color-border)",
          background: isOpen ? `${meta.color}0F` : "var(--color-card-2)",
          borderRadius: 10,
        }}>
        <DoorIcon door={k} size={layout === "tiles" && !open ? 21 : 18} />
        <span style={{ minWidth: 0 }}>
          <span style={{
            display: "block", fontSize: 13, fontWeight: 600,
            color: isOpen || !open ? "var(--color-foreground)" : "var(--color-muted)",
          }}>{meta.title}</span>
          {layout === "tiles" && !open && (
            <span style={{ display: "block", fontSize: 10.5, lineHeight: 1.45, color: "var(--color-muted)", marginTop: 4 }}>
              {meta.blurb}
            </span>
          )}
        </span>
      </button>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {note && !open && (
        <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>{note}</div>
      )}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 8,
      }}>
        {keys.map(k => <Tile key={k} k={k} />)}
      </div>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {doors[open].map((item, i) => (
            <button key={i} onClick={() => onPick(item.pick)} style={{
              display: "flex", alignItems: "flex-start", gap: 11, width: "100%", textAlign: "left",
              padding: "11px 13px", borderRadius: 9, cursor: "pointer",
              border: "1px solid var(--color-border)", background: "var(--color-card)",
            }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--color-foreground)" }}>{item.label}</span>
                {item.sub && (
                  <span style={{ display: "block", fontSize: 10.5, color: "var(--color-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.sub}
                  </span>
                )}
              </span>
              <span style={{ fontSize: 13, color: "var(--text-3)", flexShrink: 0 }}>›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
