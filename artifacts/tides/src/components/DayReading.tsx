/**
 * THE DAY'S READING — the synthesis engine's output, and the testimony under it.
 *
 * Home's tide strip says what kind of day it is in one line. This is the
 * evidence: the testimony stack (planetary hours, day rulers, the slower
 * layers) and the woven sentence that reads the day as a whole rather than as
 * a list of aspects. It is the "recipe, not a spice rack" work, and it was
 * the one thing in Today's hero that nothing else on Home carried.
 *
 * FOLDED BY DEFAULT. It moved from a page built to be read to one built to be
 * acted on, so it arrives quiet and opens on request rather than claiming the
 * band above the day's work.
 *
 * WHAT DID NOT COME WITH IT: the lunar-cycle position bar. Every fact in it —
 * the phase, how much of the month is behind you — is already stated in words
 * on the rail and drawn on the Calendar's month grid, and its marks were
 * white-on-gradient, built for the hero's dark banner. Restyling a duplicate
 * into a light card is work spent making a third copy of one fact.
 *
 * Each layer states its own lens: the testimony stack folds at minimal
 * because it is sky by definition, and the woven sentence names elements and
 * planets outright, so it belongs to `full` alone.
 */

import React from "react";
import ReadZone from "@/components/ReadZone";
import WovenReading from "@/components/WovenReading";

export default function DayReading({ now, level, testerId, accent }: {
  now: any;
  level: "minimal" | "medium" | "full";
  testerId: string | null;
  accent: string;
}) {
  // Nothing to show at minimal: both layers below are sky, and the strip's
  // guidance line is the part that was always for everyone.
  if (!now?.reading || level === "minimal") return null;
  const elColor = accent;
  const tide = now?.tide;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <ReadZone reading={now.reading} testerId={testerId} accent={accent} />
      {/* HOW STRONGLY, AND HOW MUCH THE TESTIMONIES AGREE — the meta row
          from the retired hero. It came within an inch of being deleted with
          the banner it sat on, which would have taken a real fact off the
          page silently. It sits under the reading rather than over it: this
          is a statement ABOUT the read, not part of it. */}
      {/* Every figure here says what it MEANS on hover/tap. A bare
          "Energy 83% · medium confidence" invites the reader to
          supply their own definition — and the likeliest guess
          ("83% good") is the one thing it doesn't mean. "Confidence"
          is relabelled "signal agreement", which is what it actually
          measures: how much the testimonies concur. It was never a
          calibrated probability and shouldn't borrow the authority
          of one. */}
      {<div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        {/* No percentage. "Energy 89%" invited exactly the question
            the owner asked — how does that square with a 74% lit
            Moon? — and the honest answer was damning: energy IS the
            illumination, plus up to 0.15 for angular planets and 0.10
            for tight aspects. A number that is mostly one input with
            two bonuses stapled on should not be published to two
            significant figures, and the spec already said to drop it
            (§"What survives of the tide scalar": demote or remove the
            public numeric). The scalar stays an internal input; the
            surface says the band, which is all it can support. */}
        <div title="How charged this moment is — not how favorable. A charged hour can be a difficult one. Deliberately a band, not a percentage: the underlying number is mostly lunar illumination and cannot carry more precision than that."
          style={{ fontSize: 11, color: elColor, display: "flex", alignItems: "center", gap: 4, cursor: "help" }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: elColor }} />
          {tide?.band === "high" ? "strongly charged" : tide?.band === "low" ? "quietly charged" : "moderately charged"}
        </div>
        <div title="Which way the day's activation is moving — rising, steady, or ebbing."
          style={{ fontSize: 11, color: "var(--color-muted)", display: "flex", alignItems: "center", gap: 4, cursor: "help" }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#aaaaaa" }} />
          {tide?.trend ?? "steady"}
        </div>
        <div title="How much the day's separate testimonies point the same way. High agreement means a clear picture — not a guarantee about the outcome."
          style={{ fontSize: 11, color: "var(--color-muted)", display: "flex", alignItems: "center", gap: 4, cursor: "help" }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#aaaaaa" }} />
          {tide?.confidence ?? "medium"} signal agreement
        </div>
        {now?.voc?.isVOC && (
          <div style={{ fontSize: 11, color: "#b0a060", display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#b0a060" }} />
            Moon VOC
          </div>
        )}
      </div>}

      {level === "full" && (
        <WovenReading
          reading={now.reading} level={level} accent={accent}
          saidAlready={now?.voc?.isVOC ? ["voc", "Void of course"] : []}
          workingOnly
        />
      )}
    </div>
  );
}
