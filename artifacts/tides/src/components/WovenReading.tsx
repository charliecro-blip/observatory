/**
 * WovenReading — the synthesis engine's DayReading, rendered at the viewer's
 * astro-detail level. This is what makes "minimal" honest rather than
 * dumbed-down: one woven sentence and the single thing to watch, distilled
 * from the full testimony table underneath (which "full" reveals).
 *
 *   minimal → flavour + top watch
 *   medium  → + foci + counterpoint + named patterns (plain language)
 *   full    → + the testimony table (weights, salience, the reading's working)
 */
import { useState } from "react";
import type { AstroDetail } from "@/lib/preferences";

export interface ReadingTestimony {
  source: string;
  activities: string[];
  weight: number;
  salience: number;
  polarity: 1 | -1;
  note: string;
  gift?: string;
  shadow?: string;
  score: number;
}
export interface ReadingPattern { name: string; reading: string; polarity: 1 | -1 | 0; salience: number }
export interface DayReadingData {
  flavour: string;
  foci: string[];
  watch: { note: string; salience: number }[];
  counterpoint?: string;
  patterns: ReadingPattern[];
  testimonies: ReadingTestimony[];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function WovenReading({ reading, level, accent = "#5a6cae" }: {
  reading: DayReadingData | null | undefined;
  level: AstroDetail;
  accent?: string;
}) {
  const [showWorking, setShowWorking] = useState(false);
  if (!reading?.flavour) return null;
  const med = level !== "minimal";
  const full = level === "full";
  const topWatch = reading.watch?.[0];

  return (
    <div style={{ borderTop: `1px solid ${accent}22`, margin: "12px 0", paddingTop: 11 }}>
      {/* The woven sentence — every level gets this. */}
      <div style={{ fontSize: 13.5, color: "#2a2a2a", lineHeight: 1.6 }}>
        {cap(reading.flavour)}
      </div>

      {/* What to watch — the discernment, one line. */}
      {topWatch && (
        <div style={{ fontSize: 11.5, color: "#6a6258", marginTop: 6, display: "flex", gap: 6, alignItems: "baseline" }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: accent, letterSpacing: "0.8px", flexShrink: 0 }}>WATCH</span>
          <span>{cap(topWatch.note)}</span>
        </div>
      )}

      {/* Medium: the honest "but…" + the named shapes, plain language. */}
      {med && reading.counterpoint && (
        <div style={{ fontSize: 11.5, color: "#907040", fontStyle: "italic", marginTop: 6, lineHeight: 1.55 }}>
          {reading.counterpoint}
        </div>
      )}
      {med && reading.patterns?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {reading.patterns.slice(0, 3).map((p) => (
            <span key={p.name} title={full ? p.name : undefined} style={{
              fontSize: 10.5, lineHeight: 1.45, padding: "3px 9px", borderRadius: 12,
              background: p.polarity < 0 ? "#a0404012" : `${accent}12`,
              color: p.polarity < 0 ? "#8a4040" : "#41526e",
              border: `1px solid ${p.polarity < 0 ? "#a0404025" : `${accent}25`}`,
            }}>
              {p.reading}
            </span>
          ))}
        </div>
      )}

      {/* Full: the reading's working — the ranked testimony table. */}
      {full && reading.testimonies?.length > 0 && (
        <div style={{ marginTop: 9 }}>
          <button onClick={() => setShowWorking(!showWorking)} style={{
            fontSize: 10, color: "#8a8278", background: "none", border: "none", cursor: "pointer", padding: 0,
            letterSpacing: "0.5px",
          }}>
            {showWorking ? "▾ the working" : "▸ the working — every voice, weighted"}
          </button>
          {showWorking && (
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
              {reading.testimonies.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 10.5, color: "#6a6258", lineHeight: 1.5 }}>
                  <span style={{
                    flexShrink: 0, fontVariantNumeric: "tabular-nums", fontWeight: 600,
                    color: t.polarity > 0 ? "#4a7a52" : "#a04040", width: 38, textAlign: "right",
                  }}>
                    {t.polarity > 0 ? "+" : "−"}{Math.abs(t.score).toFixed(2)}
                  </span>
                  <span style={{ flexShrink: 0, color: "#a89a88", width: 96, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.source}
                  </span>
                  <span>{t.note}<span style={{ color: "#b0a898" }}> · w {t.weight.toFixed(2)} · loud {t.salience.toFixed(2)}</span></span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
