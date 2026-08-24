/**
 * FOLD A MODULE SHUT — the minimize half of a configurable dashboard
 * (audit 2026-08-19 §7, owner: "can these modules be manually adjustable…
 * minimizing or expanding them?").
 *
 * A FOLDED MODULE IS NOT A HIDDEN ONE. It keeps its header and a one-line
 * summary of what it holds, so folding is a density choice rather than a
 * disappearance. This is the same rule that makes the app report gaps with
 * reasons instead of dropping them silently: nothing a person folded may
 * quietly become an absence they were never told about.
 *
 * THE SUMMARY MUST BE A FACT THE MODULE ALREADY KNOWS — "3 ahead", "2 open",
 * "5 habits · 2 stars". Never a count invented for the fold, and never a
 * denominator nobody set.
 *
 * The state lives in DisplayPrefs, which syncs across devices since the prefs
 * column landed — a layout arranged on a laptop that reset on the phone would
 * be worse than not offering the feature.
 */

import React from "react";
import { usePreferences } from "@/contexts/preferences-context";

/**
 * Ids that start CLOSED for anyone who has not said otherwise.
 *
 * `collapsedModules` records what a person folded, and TRIM_FOLDS seeds it —
 * but only when a rhythm is CHOSEN. An account that picked its rhythm before a
 * new door existed has a stored list that cannot mention it, so a door added
 * later opens for every existing tester however it is registered: exactly what
 * happened to "readday", which the four-zone Home added as the single door for
 * the tide, the reading and the day's conditions.
 *
 * Reading the retired ids as consent covers that. Anyone whose stored list
 * folded "reading" or "tide" had already asked for this content to be closed,
 * and the door is where that content now lives — so their answer carries over
 * instead of being lost to a rename. Open it once and the toggle writes a real
 * entry, which then wins.
 */
const FOLDED_UNLESS_TOLD: Record<string, string[]> = {
  readday: ["reading", "tide"],
};

export function useFold() {
  const { prefs, updateDisplay } = usePreferences();
  const folded = prefs.display.collapsedModules ?? [];
  const impliedFold = (id: string) => {
    const heirs = FOLDED_UNLESS_TOLD[id];
    if (!heirs) return false;
    // Only when nothing has been said about the door itself.
    return !folded.includes(id) && heirs.some(h => folded.includes(h));
  };
  return {
    isFolded: (id: string) => folded.includes(id) || impliedFold(id),
    // Computed from the CURRENT list, not this render's copy of it. Reading
    // the snapshot lost every fold but the last when several landed in one
    // tick — each toggle saw the same array and wrote over the others.
    toggle: (id: string) => updateDisplay(d => {
      const cur = d.collapsedModules ?? [];
      return { collapsedModules: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] };
    }),
  };
}

/**
 * The control itself. Deliberately a chevron rather than an ✕: a close button
 * says the thing is going away, and this one is coming back the moment it is
 * tapped again.
 */
export function FoldToggle({ id, label }: { id: string; label: string }) {
  const { isFolded, toggle } = useFold();
  const folded = isFolded(id);
  return (
    <button
      onClick={() => toggle(id)}
      aria-expanded={!folded}
      aria-label={`${folded ? "Expand" : "Collapse"} ${label}`}
      title={folded ? `Expand ${label}` : `Collapse ${label}`}
      // BIGGER, AND WITH SOMETHING TO HIT (owner, 2026-08-20: "these expand
      // functions were not intuitive for me to see — I want bigger arrows").
      // It was a 10px glyph with 2px of padding: a control the size of a
      // full stop, on modules whose whole point is that they open.
      style={{
        background: "none", border: "none", cursor: "pointer",
        padding: "2px 5px", margin: "0 1px 0 -3px", borderRadius: 5,
        color: "var(--text-2)", fontSize: 14, lineHeight: 1, flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        minWidth: 22, minHeight: 22,
      }}>{folded ? "▸" : "▾"}</button>
  );
}

/** The one-line stand-in a folded module leaves behind. */
export function FoldedSummary({ text }: { text?: string }) {
  if (!text) return null;
  return <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>{text}</span>;
}

/** Renders its children only while the module is open. */
export function Fold({ id, children }: { id: string; children: React.ReactNode }) {
  const { isFolded } = useFold();
  if (isFolded(id)) return null;
  return <>{children}</>;
}
