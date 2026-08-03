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
import { logEvent } from "@/lib/analytics";

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
  /** The convergent element the flavour names — the day's own current. Sent
   *  by /api/tides/now and used by the next-move picker; the type had simply
   *  omitted it. */
  element: string;
  foci: string[];
  watch: { note: string; salience: number; source?: string }[];
  counterpoint?: string;
  /** Which testimony source the counterpoint speaks for ("voc", "moonAspect"…). */
  counterpointSource?: string;
  patterns: ReadingPattern[];
  testimonies: ReadingTestimony[];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function WovenReading({ reading, level, accent = "#5a6cae", saidAlready = [] }: {
  reading: DayReadingData | null | undefined;
  level: AstroDetail;
  accent?: string;
  /** Pattern names the surrounding card has ALREADY spoken, by name. The hero's
   *  guidance line now reconciles the void itself ("energy is high, but the
   *  Moon is void — spend it on what's already moving"), and the counterpoint
   *  restates it a third time. Three sentences about one fact, stacked, is how
   *  a card stops sounding like it knows what it thinks. */
  saidAlready?: string[];
}) {
  const [showWorking, setShowWorking] = useState(false);
  if (!reading?.flavour) return null;
  const med = level !== "minimal";
  const full = level === "full";
  const said = new Set(saidAlready.map(s => s.toLowerCase()));
  // The void reaches this card through THREE channels — watch, counterpoint,
  // and pattern chip — so suppressing one still left the reader told the same
  // thing twice. Take the loudest watch line the card hasn't already spoken.
  const topWatch = (reading.watch ?? []).find(w => !said.has((w.source ?? "").toLowerCase()));
  // …and named patterns are THEMSELVES pushed into the watch list server-side,
  // so whenever a pattern won the WATCH slot its chip repeated the identical
  // sentence two lines below it. Reported live: "Moon rules both this hour and
  // your ascendant…" rendered twice, verbatim, in one card. Whatever WATCH
  // just said cannot also be a chip.
  const spoken = new Set(
    [...said, ...(topWatch?.source ? [topWatch.source.toLowerCase()] : [])],
  );
  const patterns = (reading.patterns ?? []).filter(p => !spoken.has(p.name.toLowerCase()));

  return (
    <div style={{ borderTop: `1px solid ${accent}22`, margin: "12px 0", paddingTop: 11 }}>
      {/* The woven sentence — every level gets this. */}
      <div style={{ fontSize: 13.5, color: "var(--text-1)", lineHeight: 1.6 }}>
        {cap(reading.flavour)}
      </div>

      {/* What to watch — the discernment, one line. */}
      {topWatch && (
        <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginTop: 6, display: "flex", gap: 6, alignItems: "baseline" }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: accent, letterSpacing: "0.8px", flexShrink: 0 }}>WATCH</span>
          <span>{cap(topWatch.note)}</span>
        </div>
      )}

      {/* Medium: the honest "but…" + the named shapes, plain language. */}
      {med && reading.counterpoint && !said.has((reading.counterpointSource ?? "").toLowerCase()) && (
        <div style={{ fontSize: 11.5, color: "#907040", fontStyle: "italic", marginTop: 6, lineHeight: 1.55 }}>
          {reading.counterpoint}
        </div>
      )}
      {med && patterns.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {patterns.slice(0, 3).map((p) => (
            <span key={p.name} title={full ? p.name : undefined} style={{
              fontSize: 10.5, lineHeight: 1.45, padding: "3px 9px", borderRadius: 12,
              background: p.polarity < 0 ? "#a0404012" : `${accent}12`,
              color: p.polarity < 0 ? "var(--color-quality-challenge)" : "#41526e",
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
          <button onClick={() => { if (!showWorking) logEvent("reading_working_opened"); setShowWorking(!showWorking); }} style={{
            fontSize: 10, color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer", padding: 0,
            letterSpacing: "0.5px",
          }}>
            {showWorking ? "▾ the working" : "▸ the working — every voice, weighted"}
          </button>
          {showWorking && (
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
              {reading.testimonies.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.5 }}>
                  <span style={{
                    flexShrink: 0, fontVariantNumeric: "tabular-nums", fontWeight: 600,
                    color: t.polarity > 0 ? "#4a7a52" : "#a04040", width: 38, textAlign: "right",
                  }}>
                    {t.polarity > 0 ? "+" : "−"}{Math.abs(t.score).toFixed(2)}
                  </span>
                  <span style={{ flexShrink: 0, color: "var(--text-3)", width: 96, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.source}
                  </span>
                  <span>{t.note}<span style={{ color: "var(--color-muted)" }}> · w {t.weight.toFixed(2)} · loud {t.salience.toFixed(2)}</span></span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
