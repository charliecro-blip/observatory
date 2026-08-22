/**
 * ONE CONDITION AT A TIME — Home's condition slot (audit 2026-08-19 §5).
 *
 * A CONDITION is information about the hour or the day you are already in: a
 * void Moon, a rhythm-risk window, where you are in a cycle. It is not an
 * offer competing for your attention, which is what separates these from the
 * notice queue above them — and it is why the void was deliberately kept OUT
 * of that queue, where a common thing would have silenced rarer ones.
 *
 * These three lived in two places. VOC was drawn twice, once on Home with the
 * reading, the scope and the Lilly provenance, and once on Today as a
 * two-line strip; rhythm-risk and the cycle phase were on Today only, which
 * is not where anyone lands. Consolidating them threatened to recreate
 * exactly what the 2026-08-04 split was meant to fix, so:
 *
 * ONLY ONE RENDERS, ranked by rarity — the same rule the notice queue uses,
 * applied consistently rather than invented twice:
 *
 *   1. RHYTHM RISK    occasional, and a care signal. It survives the quiet
 *                     lens: nothing in it is astrology, and someone who
 *                     asked for a plain planner still wants to be told to
 *                     move gently today.
 *   2. VOID MOON      a large share of days. Sky vocabulary, so it stands
 *                     down at the quiet lens.
 *   3. CYCLE PHASE    every single day, for anyone tracking. True, useful,
 *                     and the least surprising thing on the list — so it
 *                     takes the slot only when nothing rarer wants it.
 *
 * Rarity is the rule because the whole value of an interruption is how seldom
 * it comes.
 */

const RISK = { fg: "#803020", sub: "#a05030", rule: "#c05020", bg: "#fff8f0", border: "#e0b080" };

export interface CycleData { cycleStartDate?: string; cycleLength: number; lutealLength: number }

export type Condition = "risk" | "void" | "cycle" | null;

/**
 * WHICH CONDITION HOLDS THE SLOT.
 *
 * Exported and pure so the ranking is testable on its own. A precedence rule
 * living inside a render tree is a rule nothing can check — which is the same
 * complaint that got the moments-ahead block extracted, and the reason three
 * banners could sit on Today for months with nothing asserting they never
 * stacked.
 */
export function pickCondition({ now, cycle, skyQuiet, showVoid = true }: {
  now: any; cycle?: CycleData | null; skyQuiet: boolean; showVoid?: boolean;
}): Condition {
  if (now?.rhythmRisk) return "risk";
  if (showVoid && !skyQuiet && now?.voc?.isVOC && now?.voc?.reading) return "void";
  if (cycle?.cycleStartDate) return "cycle";
  return null;
}

export default function DayConditions({ now, cycle, habits, skyQuiet, showVoid = true }: {
  now: any;
  cycle?: CycleData | null;
  /** For the minimum-viable line — the smallest version of a practice on a
   *  hard day, which is the only actionable thing a risk window can offer. */
  habits?: { name: string; minimumViable?: string | null }[];
  skyQuiet: boolean;
  /**
   * The `todayShowVOC` preference, which used to gate Today's copy of this
   * strip. Today's copy is gone, so without routing the setting here the
   * Settings toggle would silently control nothing — a switch that does
   * nothing is worse than no switch.
   */
  showVoid?: boolean;
}) {
  const which = pickCondition({ now, cycle, skyQuiet, showVoid });

  // ── 1. Rhythm risk
  if (which === "risk") {
    const factors: string[] = now.rhythmRiskFactors ?? [];
    const viable = (habits ?? []).filter(h => h.minimumViable);
    return (
      <div style={{
        background: RISK.bg, border: `1px solid ${RISK.border}`, borderLeft: `3px solid ${RISK.rule}`,
        borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 10, flexShrink: 0,
      }}>
        <span aria-hidden="true" style={{ fontSize: 16, flexShrink: 0 }}>⚠</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: RISK.fg }}>Rhythm-risk window · move gently</div>
          {factors.length > 0 && (
            <div style={{ fontSize: 10, color: RISK.sub, marginTop: 2 }}>{factors.join(" · ")}</div>
          )}
          {viable.length > 0 && (
            <div style={{ fontSize: 10, color: "var(--color-muted)", marginTop: 6 }}>
              <span style={{ fontWeight: 600, color: "#6a4020" }}>Minimum viable: </span>
              {viable.map(h => `${h.name}: ${h.minimumViable}`).join(" · ")}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 2. The void Moon. Home's version, which carries the reading, the scope
  // and the provenance — Today's two-line strip was the lesser of the two
  // copies and is gone.
  if (which === "void") {
    const benign = now.voc.reading.benign;
    return (
      <div style={{
        background: "var(--color-card)", border: "1px solid var(--color-border)",
        borderLeft: `3px solid ${benign ? "#3f6f8a" : "#a08040"}`,
        borderRadius: 0, padding: "11px 16px", flexShrink: 0,
      }}>
        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)", marginBottom: 3 }}>
          Right now · the Moon is void
          {now.voc.nextIngress && <span style={{ textTransform: "none", letterSpacing: 0 }}> until {now.voc.nextIngress}</span>}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>{now.voc.reading.feel}</div>
        <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.5, marginTop: 3 }}>{now.voc.reading.instead}</div>
        {now.voc.scope && (
          <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5, marginTop: 4 }}>{now.voc.scope}</div>
        )}
        {/* THE CITATION, LAST AND SMALLEST. Six signs carry one; the other six
            render nothing rather than a hedge. It sits below the counsel
            because it is the source of the claim rather than part of it. */}
        {now.voc.reading.provenance && (
          <div style={{ fontSize: 10.5, color: "var(--text-3)", lineHeight: 1.5, marginTop: 6, fontStyle: "italic" }}>
            {now.voc.reading.provenance}
          </div>
        )}
      </div>
    );
  }

  // ── 3. Where you are in the cycle.
  if (which === "cycle" && cycle?.cycleStartDate) {
    const start = new Date(cycle.cycleStartDate + "T12:00:00");
    const diff = Math.floor((Date.now() - start.getTime()) / 86400000);
    if (diff < 0) return null;
    const dayOfCycle = (diff % cycle.cycleLength) + 1;
    const follEnd = cycle.cycleLength - cycle.lutealLength;
    const phases = [
      { name: "Menstrual",  max: 5,                  color: "#c04050", desc: "Rest · release · introspection" },
      { name: "Follicular", max: follEnd - 4,        color: "#d08020", desc: "Rising energy · creativity · planning" },
      { name: "Ovulatory",  max: follEnd,            color: "#50a050", desc: "Peak energy · visibility · connection" },
      { name: "Luteal",     max: cycle.cycleLength,  color: "#6050a0", desc: "Focus · nesting · detail work" },
    ];
    const phase = phases.find(p => dayOfCycle <= p.max) ?? phases[3];
    return (
      <div style={{
        background: `${phase.color}10`, border: `1px solid ${phase.color}30`, borderLeft: `3px solid ${phase.color}`,
        borderRadius: 8, padding: "9px 14px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: phase.color }}>{phase.name} · day {dayOfCycle} of cycle</div>
          <div style={{ fontSize: 10, color: "var(--color-muted)", marginTop: 1 }}>{phase.desc}</div>
        </div>
        <div style={{ fontSize: 8, color: `${phase.color}80`, background: `${phase.color}15`, padding: "2px 7px", borderRadius: 4, flexShrink: 0 }}>cycle</div>
      </div>
    );
  }

  return null;
}
