/**
 * THE DAY, IN ONE LINE — Home's tide widget (owner, 2026-08-19: "a smaller
 * version of the tides banner should be on the homepage").
 *
 * Home has never had a tide surface, on purpose: the owner's call was that
 * the tide is "a widget right now" and that "there can be different heroes"
 * (Home.tsx's own header). This is the widget, at widget size. It is NOT the
 * hero shrunk — Today's hero is a filled 44px gradient panel carrying a share
 * button, a moon-sign block and the lunar-cycle position, and every one of
 * those is what makes it a hero rather than a strip.
 *
 * WHAT IT CARRIES: the element as a color, the day's character, and the
 * guidance line. What it deliberately drops: the Share button (the Studio is
 * a Today and Calendar affordance), the confidence hedge, the moon-sign
 * corner, and the cycle position.
 *
 * IT OBEYS THE LENS FROM THE FIRST COMMIT. The full hero learned this the
 * hard way — the loudest sky surface in the app was still speaking tide
 * levels and moon signs to someone who had asked for none of it (AUDIT-
 * JOURNEY J2). At `minimal` this states the day plainly and keeps the
 * guidance, which is the half that was always for everyone.
 *
 * A quiet day says so. `isQuiet` is the same test the hero uses, and the
 * honest reading for an undramatic day is that it is undramatic — most days
 * are, and manufacturing weather for them is how a reading starts lying.
 */

import {
  ELEMENT_COLORS, ELEMENT_SURFACE, CHARACTER_ELEMENT, CHARACTER_LABEL,
  tideGuidance, QUIET_DAY_GUIDANCE, plainGuidance, type TideCharacter,
} from "@/lib/elements";

export default function TideStrip({ now, minimal, onOpen }: {
  now: any;
  /** The quiet lens, or a quiet session — no sky vocabulary either way. */
  minimal: boolean;
  onOpen?: () => void;
}) {
  // No reading is not a blank strip. Home already says "Compass couldn't read
  // the sky today" in the card below; a second silent gap under it would read
  // as a third state rather than the same outage.
  if (!now?.tide) return null;

  const character = (now.tide.character ?? "deep") as TideCharacter;
  const element = CHARACTER_ELEMENT[character] ?? "water";
  const rule = ELEMENT_SURFACE[element] ?? ELEMENT_COLORS[element];

  const activation = now?.dayArc?.heightFactors?.activation ?? 1;
  const aspectsAhead = (now?.dayArc?.events ?? []).filter((e: any) => e.kind === "aspect" && !e.past).length;
  const isQuiet = activation < 0.25 && aspectsAhead === 0 && (now.tide.band ?? "mid") !== "high";

  const raw = isQuiet
    ? QUIET_DAY_GUIDANCE[character]
    : tideGuidance(character, now.tide.level, !!now?.voc?.isVOC);
  const guidance = minimal ? plainGuidance(raw) : raw;
  // The moment's rarest qualifier, under the day's line — an eclipse
  // corridor, a luminary on a node, a station — so Home says the thing that
  // makes today unlike other days of its kind (AUDIT-EXPLAINERS §4). Only
  // the rare ones (a retrograde is not news on a strip). Never at minimal.
  // The luminaries' own rare qualifiers only: the season's (the eclipse
  // corridor) lives in the rail's SEASON line and would repeat here.
  const rare = !minimal ? (now?.qualifiers ?? []).find((q: any) => q.salience >= 60 && (q.bodies.includes("Sun") || q.bodies.includes("Moon"))) : null;

  // At minimal the day names itself by its date, which is a fact everyone
  // already holds. Inventing a plain-language stand-in for "Deep" would be
  // giving the same reading a costume.
  const heading = minimal
    ? new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : `${now.tide.headline ?? CHARACTER_LABEL[character]}${now.tide.levelLabel ? ` · ${now.tide.levelLabel.toLowerCase()}` : ""}`;

  const body = (
    <div style={{
      display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap",
      padding: "9px 14px", borderLeft: `3px solid ${rule}`,
    }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-foreground)", flexShrink: 0 }}>
        {heading}
      </span>
      <span style={{ flex: 1, minWidth: 180, fontSize: 12, lineHeight: 1.45, color: "var(--color-muted)" }}>
        {guidance}
      </span>
      {rare && (
        <span style={{ fontSize: 11, color: "var(--color-muted)", flexBasis: "100%", lineHeight: 1.5 }}>
          <span style={{ color: "var(--color-foreground)" }}>{rare.plain.charAt(0).toUpperCase() + rare.plain.slice(1)}</span> — {rare.approach}.
        </span>
      )}
    </div>
  );

  if (!onOpen) return <div style={{ ...PANEL }}>{body}</div>;
  return (
    <button onClick={onOpen} title="Open Today" style={{
      ...PANEL, display: "block", width: "100%", textAlign: "left",
      padding: 0, cursor: "pointer", font: "inherit",
    }}>{body}</button>
  );
}

const PANEL = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  overflow: "hidden",
  flexShrink: 0,
} as const;
