/**
 * THE MONTH'S LIGHT, AS ONE CURVE.
 *
 * The x-axis is the lunation, new to new. The y-axis is illuminated fraction.
 * Tonight is the marked point. So the picture answers, in one look, the thing
 * a percentage cannot: whether the light is still coming or already going, and
 * how far the reader is from either turn.
 *
 * Reasoning and the exactness check live in lib/lunation.
 */

import { useMemo } from "react";
import { illuminationAt, readLunation, lunationLine, type MoonCycle } from "@/lib/lunation";

const W = 300, H = 66, PAD_T = 7, PAD_B = 15;

/** Enough samples that the curve reads as smooth at any rendered width. */
const SAMPLES = 121;

export default function LunationArc({ cycle, maxWidth = 420 }: {
  cycle: MoonCycle | undefined | null;
  /** The arc scales uniformly, so this caps the height too (at 420 it is ~92px). */
  maxWidth?: number;
}) {
  const r = readLunation(cycle);

  const geom = useMemo(() => {
    const plotH = H - PAD_T - PAD_B;
    const y = (f: number) => PAD_T + (1 - f) * plotH;
    const x = (p: number) => p * W;
    let line = "";
    for (let i = 0; i < SAMPLES; i++) {
      const p = i / (SAMPLES - 1);
      line += `${i ? "L" : "M"} ${x(p).toFixed(2)} ${y(illuminationAt(p)).toFixed(2)} `;
    }
    return { line, area: `${line} L ${W} ${y(0)} L 0 ${y(0)} Z`, x, y };
  }, []);

  // No cycle, no arc. A curve drawn from a guessed position would be a picture
  // of nothing, and it would look exactly as authoritative as a real one.
  if (!r) return null;

  const cx = geom.x(r.position), cy = geom.y(r.lit);
  const label = lunationLine(r);

  return (
    <div style={{ maxWidth }}>
      {/* Uniform scaling on purpose. Stretching the viewBox to fill an
          arbitrary width turns the "tonight" dot into an ellipse and smears
          the axis labels, which is exactly the sort of thing that ships
          because nobody looked at it above 400px. */}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        role="img" aria-label={`The lunar cycle. ${label}.`}
        style={{ display: "block", height: "auto", overflow: "visible" }}>
        {/* The two turns. Hairlines rather than labeled gridlines: the shape
            already says where full is, and a reader who wants the date has the
            Almanac list below. */}
        {[0, 0.5, 1].map(p => (
          <line key={p} x1={geom.x(p)} x2={geom.x(p)} y1={PAD_T} y2={H - PAD_B}
            stroke="var(--color-border)" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
        ))}

        <path d={geom.area} fill="var(--color-meridian)" opacity={0.10} />
        <path d={geom.line} fill="none" stroke="var(--color-meridian)" strokeWidth={1.5}
          strokeLinecap="round" vectorEffect="non-scaling-stroke" />

        {/* Tonight: a drop line so the position reads against the axis, then
            the point itself. The halo keeps the dot legible where it sits on
            the curve at full, which is also where the curve is flattest. */}
        <line x1={cx} x2={cx} y1={cy} y2={H - PAD_B} stroke="var(--color-meridian)" strokeWidth={1}
          opacity={0.45} vectorEffect="non-scaling-stroke" />
        <circle cx={cx} cy={cy} r={5} fill="var(--color-card)" />
        <circle cx={cx} cy={cy} r={3} fill="var(--color-meridian)" />

        {/* Ends and middle, named in the app's own words. */}
        <text x={2} y={H - 3} fontSize={8.5} fill="var(--text-3)" style={{ textTransform: "uppercase", letterSpacing: "0.09em" }}>New</text>
        <text x={W / 2} y={H - 3} fontSize={8.5} fill="var(--text-3)" textAnchor="middle" style={{ textTransform: "uppercase", letterSpacing: "0.09em" }}>Full</text>
        <text x={W - 2} y={H - 3} fontSize={8.5} fill="var(--text-3)" textAnchor="end" style={{ textTransform: "uppercase", letterSpacing: "0.09em" }}>New</text>
      </svg>
      <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 5, fontVariantNumeric: "tabular-nums" }}>{label}</div>
    </div>
  );
}
