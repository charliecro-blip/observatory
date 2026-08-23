import { useState } from "react";
import { pickLead, bandOf, familyOf, type LeadTestimony, type DurationBand } from "@/lib/lead";
import { useAstroDetail } from "@/contexts/preferences-context";
import { literalOf, interpretationOf } from "@/lib/literalSky";

/**
 * Zone 1 — READ. What kind of moment is this?
 *
 * Replaces the hero's WATCH line, counterpoint and pattern chips: three
 * channels that repeatedly said the same fact in different clothes (fixed
 * three separate times before the general case was caught). One stack, one
 * voice, one place.
 *
 * Three levels, each doing different work:
 *   Tide name      — rapid orientation, and the vocabulary the product is built on
 *   Approach       — what it practically means
 *   Lead / stack   — the configuration doing the work, checkable against the rail
 *
 * The tide stays the headline deliberately. Letting the dominant configuration
 * become the title would ask the reader to interpret astrology before Compass
 * has done its product job, and would let whatever currently ranks highest
 * rename the whole dashboard hour to hour.
 *
 * SELECTIVE, not encyclopedic. The rail answers "what is there"; this answers
 * "what matters right now". Rendering all seven duration bands would just make
 * a vertical rail.
 *
 * Costs no extra request: everything here is derived from the `reading`
 * already present in /api/tides/now.
 */

const BAND_LABEL: Record<DurationBand, string> = {
  now: "this hour",
  today: "today",
  stretch: "this stretch",
  background: "background",
};
const BAND_ORDER: DurationBand[] = ["now", "today", "stretch", "background"];

/** Remember the last lead we showed, so "what changed" is real rather than decorative. */
function lastSeenKey(testerId: string | null) { return `obs_read_lastseen_${testerId ?? "anon"}`; }

export interface ReadingSubject {
  planet: string; share: number; count: number; ofTop: number;
  supports: string[]; presses: string[]; against: string[];
  gift?: string; shadow?: string;
}

export default function ReadZone({ reading, testerId, accent }: {
  reading: {
    testimonies?: LeadTestimony[];
    subject?: ReadingSubject;
    foci?: string[];
    counterpoint?: string;
    counterpointSource?: string;
  } | null | undefined;
  testerId: string | null;
  accent: string;
}) {
  // At `full` the reader has asked for the sky's own words; the composed
  // sentence is a paraphrase of a fact they want to see (owner, 2026-08-20).
  const literalFirst = useAstroDetail().level === "full";
  // The lead is a LeadRow, which carries no facts — only the testimony it was
  // chosen from does. They share a `source`, which is what that field is for.
  const factsBySource = new Map((reading?.testimonies ?? []).map(t => [t.source, t]));
  const literalForRow = (r: { source: string }) => {
    const t = factsBySource.get(r.source);
    return t ? literalOf(t) : null;
  };
  const [showSlow, setShowSlow] = useState(false);
  const testimonies = reading?.testimonies ?? [];
  if (!testimonies.length) return null;

  const result = pickLead(testimonies);

  // ── What changed since the last look ───────────────────────────────────────
  // The most valuable thing an app checked several times a day can say is
  // often "nothing". Compared by the LEAD's identity, not by the whole
  // reading — a shifting orb is not a change worth reporting.
  let changeLine: string | null = null;
  try {
    const key = lastSeenKey(testerId);
    const nowId = result.state === "leads" ? result.lead.source
      : result.state === "crosscurrents" ? `${result.a.source}|${result.b.source}`
      : "quiet";
    const prevRaw = localStorage.getItem(key);
    if (prevRaw) {
      const prev = JSON.parse(prevRaw) as { id: string; at: number };
      const mins = Math.round((Date.now() - prev.at) / 60000);
      // Under ~15 minutes it isn't a "last check", it's the same sitting.
      if (mins >= 15) {
        const when = mins < 90 ? `${mins} min ago` : `${Math.round(mins / 60)}h ago`;
        changeLine = prev.id === nowId
          ? `No meaningful change since your last check, ${when}. Your current course still holds.`
          : `Changed since your last check, ${when}.`;
      }
    }
    localStorage.setItem(key, JSON.stringify({ id: nowId, at: Date.now() }));
  } catch { /* private mode — the reading works without it */ }

  // ── The stack ──────────────────────────────────────────────────────────────
  // One row per band, strongest in each. Selective by construction: a band
  // with nothing worth saying contributes nothing.
  const leadSource = result.state === "leads" ? result.lead.source
    : result.state === "crosscurrents" ? result.a.source : null;
  // The lead is EXCLUDED from the stack — "LED BY" above is already its row.
  // Without this the strongest testimony rendered twice, verbatim, inches
  // apart: precisely the duplication this zone exists to end.
  const byBand = new Map<DurationBand, LeadTestimony>();
  for (const t of [...testimonies]
        .filter(t => t.source !== leadSource)
        .sort((a, b) => (b.salience * b.weight) - (a.salience * a.weight))) {
    const b = bandOf(t);
    if (!byBand.has(b)) byBand.set(b, t);
  }
  const rows = BAND_ORDER.filter(b => byBand.has(b)).map(b => ({ band: b, t: byBand.get(b)! }));

  const Row = ({ band, t }: { band: DurationBand; t: LeadTestimony }) => {
    const isLead = t.source === leadSource;
    return (
      <div style={{ display: "flex", gap: 9, alignItems: "baseline", padding: "2px 0" }}>
        <span style={{ fontSize: 9.5, color: "var(--text-3)", width: 72, flexShrink: 0 }}>
          {BAND_LABEL[band]}
        </span>
        <span style={{
          fontSize: 11.5, lineHeight: 1.5,
          color: isLead ? "var(--color-foreground)" : "var(--color-muted)",
          fontWeight: isLead ? 600 : 400,
        }}>
          {literalFirst && literalOf(t) ? (
            <>
              <span style={{ fontWeight: 600, color: "var(--color-foreground)" }}>{literalOf(t)}</span>
              <span style={{ color: "var(--text-3)" }}>{" — "}{interpretationOf(t.note)}</span>
            </>
          ) : t.note}
        </span>
      </div>
    );
  };

  // ── THE SUBJECT ───────────────────────────────────────────────────────────
  // When one body carries enough of the moment, that IS the finding, and the
  // ways it pulls are the detail. Before this the panel split a dominant Venus
  // across three duration bands in three grammars and never said her name as a
  // subject (owner, 2026-08-21). Absent on two moments in three, when nothing
  // dominates — and then the LED BY / MIXED CURRENT / QUIET SKY line leads, as
  // it always has.
  const subject = reading?.subject;
  const mixed = !!subject && subject.supports.length > 0 && (subject.presses.length + subject.against.length) > 0;
  const foci = (reading?.foci ?? []).filter(Boolean);
  // The counterpoint is suppressed when the subject already carries it — the
  // subject block names the pressing contacts AND the shadow, so repeating it
  // underneath is the same fact in two voices, which is what this zone exists
  // to prevent.
  const counterpointIsSubject = !!subject && !!reading?.counterpointSource?.includes(subject.planet);
  // The engine's counterpoint opens "— though …" and often "… watch X", which
  // under a row labelled "watch" said the word twice.
  const watch = !counterpointIsSubject
    ? reading?.counterpoint?.replace(/^\s*—\s*though\s*/i, "").replace(/;?\s*watch\s+/i, "; ").replace(/^;\s*/, "").trim()
    : null;

  const SubjectRow = ({ label, items }: { label: string; items: string[] }) =>
    items.length === 0 ? null : (
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "1px 0" }}>
        <span style={{ fontSize: 9.5, color: "var(--text-3)", width: 82, flexShrink: 0 }}>{label}</span>
        <span style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--color-muted)" }}>
          {[...new Set(items)].join(" · ")}
        </span>
      </div>
    );

  return (
    <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${accent}22` }}>
      {subject ? (
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--color-foreground)", lineHeight: 1.3 }}>
            {subject.planet} runs today
          </div>
          <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginTop: 2 }}>
            {subject.planet} carries {subject.count} of the {subject.ofTop} strongest signals
            {mixed ? ", and they don't all agree." : "."}
          </div>
          <div style={{ marginTop: 8 }}>
            <SubjectRow label="supports" items={subject.supports} />
            <SubjectRow label="presses on" items={subject.presses} />
            <SubjectRow label="at odds with" items={subject.against} />
          </div>
          {(subject.gift || subject.shadow) && (
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--color-border)" }}>
              {subject.gift && <SubjectRow label="gives" items={[subject.gift]} />}
              {subject.shadow && <SubjectRow label="costs" items={[subject.shadow]} />}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* The verdict line — one of three genuinely different states. */}
          {result.state === "leads" && (
            <div style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.55 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: accent, letterSpacing: "0.8px", marginRight: 6 }}>LED BY</span>
              {literalFirst && literalForRow(result.lead) ? (
                <>
                  <span style={{ fontWeight: 700 }}>{literalForRow(result.lead)}</span>
                  <span style={{ color: "var(--color-muted)" }}>{" — "}{interpretationOf(result.lead.note)}</span>
                </>
              ) : result.lead.note}
              {result.support.length >= 2 && (
                <div style={{ fontSize: 11, color: "#4a7a52", marginTop: 4 }}>
                  {result.support.length} other layers of the sky point the same way.
                </div>
              )}
            </div>
          )}
          {result.state === "crosscurrents" && (
            <div style={{ fontSize: 12.5, color: "var(--text-1)", lineHeight: 1.55 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#8a6a30", letterSpacing: "0.8px", marginRight: 6 }}>MIXED CURRENT</span>
              Two things pull different ways — {literalFirst && literalForRow(result.a)
                ? <><b>{literalForRow(result.a)}</b>{", "}{interpretationOf(result.a.note)}</>
                : result.a.note}; and {literalFirst && literalForRow(result.b)
                ? <><b>{literalForRow(result.b)}</b>{", "}{interpretationOf(result.b.note)}</>
                : result.b.note}
            </div>
          )}
          {result.state === "quiet" && (
            <div style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.55 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "var(--text-3)", letterSpacing: "0.8px", marginRight: 6 }}>QUIET SKY</span>
              Nothing in particular is pulling. The ordinary reading stands.
            </div>
          )}
        </>
      )}

      {/* ── WHAT IT FAVORS, AND WHAT TO WATCH ──────────────────────────────
          The engine has computed `foci` and the counterpoint all along and
          this panel showed neither, so the whole zone was condition and no
          approach — against the app's own explainer principle (condition →
          approach → example). */}
      {(foci.length > 0 || watch) && (
        <div style={{ marginTop: 10, paddingTop: 9, borderTop: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: 3 }}>
          {foci.length > 0 && (
            <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <span style={{ fontSize: 9.5, color: "var(--text-3)", width: 82, flexShrink: 0 }}>favors</span>
              <span style={{ fontSize: 11.5, color: "var(--color-foreground)", lineHeight: 1.5 }}>{foci.join(" · ")}</span>
            </div>
          )}
          {watch && (
            <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <span style={{ fontSize: 9.5, color: "var(--text-3)", width: 82, flexShrink: 0 }}>watch</span>
              <span style={{ fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.5 }}>{watch}</span>
            </div>
          )}
        </div>
      )}

      {/* ── THE READINGS BEHIND IT ─────────────────────────────────────────
          One tap, everything. The band stack was the panel's body and is now
          its receipt: the astrologer's check, which is the thing this app must
          never take away, without asking every reader to do the checking. */}
      {rows.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setShowSlow(v => !v)} aria-expanded={showSlow} style={{
            background: "none", border: "none", cursor: "pointer",
            padding: "4px 8px 4px 0", fontSize: 11.5, color: "var(--text-2)",
            display: "inline-flex", alignItems: "center", gap: 5,
          }}>
            <span aria-hidden="true" style={{ fontSize: 13, lineHeight: 1 }}>{showSlow ? "▾" : "▸"}</span>
            {showSlow ? "fewer" : `the ${testimonies.length} signals behind this`}
          </button>
          {showSlow && (
            <div style={{ marginTop: 3 }}>
              {rows.map(r => <Row key={r.band} band={r.band} t={r.t} />)}
            </div>
          )}
        </div>
      )}

      {changeLine && (
        <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 8, fontStyle: "italic" }}>
          {changeLine}
        </div>
      )}
    </div>
  );
}
