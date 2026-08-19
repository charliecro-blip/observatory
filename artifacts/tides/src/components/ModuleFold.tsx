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

export function useFold() {
  const { prefs, updateDisplay } = usePreferences();
  const folded = prefs.display.collapsedModules ?? [];
  return {
    isFolded: (id: string) => folded.includes(id),
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
      style={{
        background: "none", border: "none", cursor: "pointer", padding: "0 2px",
        color: "var(--text-3)", fontSize: 10, lineHeight: 1, flexShrink: 0,
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
