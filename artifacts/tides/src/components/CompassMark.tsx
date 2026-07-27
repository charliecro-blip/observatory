/**
 * The Compass mark — "Compass Card" (Claude Design brand kit, 2026-07-22).
 * An eight-point compass card seated in a graduated dial: reads as a
 * compass/star, but the graduated ticks make it an instrument scale, not a
 * generic magnetic rose. Monochrome via `currentColor` — colour is never
 * load-bearing; set the parent's `color` (ink, or Meridian on hero surfaces).
 *
 * K2 (Degree Dial) is the PRIMARY mark and the app-icon source. K4 (Open Card)
 * is the lighter line form for the rail / lockups. Both share the same star
 * geometry so they're unmistakably one family.
 */
import React from "react";

export type CompassMarkVariant = "k2" | "k4";

const STAR_FILL = "M32 8 L33.7 27.6 L41 22.9 L36.2 30.3 L56 32 L36.2 33.7 L41 41 L33.7 36.4 L32 56 L30.3 36.4 L23 41 L27.8 33.7 L8 32 L27.8 30.3 L23 22.9 L30.3 27.6 Z";
const STAR_LINE = "M32 6 L33.9 27.4 L41.9 22.1 L36.6 30.1 L58 32 L36.6 33.9 L41.9 41.9 L33.9 36.6 L32 58 L30.1 36.6 L22.1 41.9 L27.4 33.9 L6 32 L27.4 30.1 L22.1 22.1 L30.1 27.4 Z";

// The 12 degree ticks of the K2 dial (major cardinals + minors).
const DIAL_TICKS: [number, number, number, number][] = [
  [32, 3, 32, 6], [46.5, 6.9, 45, 9.5], [57.1, 17.5, 54.5, 19], [61, 32, 58, 32],
  [57.1, 46.5, 54.5, 45], [46.5, 57.1, 45, 54.5], [32, 61, 32, 58], [17.5, 57.1, 19, 54.5],
  [6.9, 46.5, 9.5, 45], [3, 32, 6, 32], [6.9, 17.5, 9.5, 19], [17.5, 6.9, 19, 9.5],
];

export function CompassMark({ size = 24, variant = "k2", title }: { size?: number; variant?: CompassMarkVariant; title?: string }) {
  const aria = title ? { role: "img", "aria-label": title } : { "aria-hidden": true };
  if (variant === "k4") {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" {...aria} style={{ flexShrink: 0, display: "block" }}>
        <circle cx="32" cy="32" r="29" stroke="currentColor" strokeWidth="2" />
        <path d={STAR_LINE} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx="32" cy="32" r="2.2" fill="currentColor" />
      </svg>
    );
  }
  // K2 — Degree Dial (primary)
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" {...aria} style={{ flexShrink: 0, display: "block" }}>
      <circle cx="32" cy="32" r="29" stroke="currentColor" strokeWidth="1.4" opacity="0.4" />
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.55">
        {DIAL_TICKS.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />)}
      </g>
      <path d={STAR_FILL} fill="currentColor" />
    </svg>
  );
}
