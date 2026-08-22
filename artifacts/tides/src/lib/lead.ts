// What leads the READ, and whether anything should.
//
// The dashboard stack is ORDERED by duration — stable, legible, mirrors the
// rail. But duration cannot decide IMPORTANCE: a Saturn–Neptune square lasting
// six months may be the most significant thing in the chart and change nothing
// about this afternoon, while a planetary hour lasts sixty minutes and decides
// what you do next. So there are two systems, and this file is the second one.
//
//   Position in the stack  → duration
//   Eligibility to lead    → decision relevance
//
// THE STATE THAT MATTERS MOST IS "QUIET".
//
// An earlier draft always promoted a dominant row. That would have quietly
// broken the oldest commitment in the product — never manufacture significance
// when the sky is quiet — using the very feature meant to sharpen the reading.
// Ranking one row is judgment, which was never forbidden; what was ruled out is
// a bank of competing scores. But a system that cannot decline to promote
// anything is not exercising judgment, it is performing it. So `quiet` is a
// first-class return here, not a fallback branch.
//
// Deterministic and reconstructible on purpose, in the same spirit as
// lib/next-move.ts: a reader who disagrees should be able to see exactly which
// rule fired.

export type Family =
  | "hour" | "moonAspect" | "moonCycle" | "nonLunarAspect"
  | "chartCondition" | "personal" | "voc";

export type DurationBand = "now" | "today" | "stretch" | "background";

export interface LeadTestimony {
  source: string;
  note: string;
  salience: number;
  weight: number;
  polarity: 1 | -1;
  /**
   * The configuration itself, as data rather than as a sentence.
   *
   * The client only ever declared four of these fields, so the ones a LITERAL
   * reading needs — which planets, which aspect, which sign — arrived on every
   * response and were dropped by the type. The server has sent them all along
   * (api-server/src/lib/synthesis.ts, TestimonyFacts).
   */
  facts?: {
    kind?: string;
    planet?: string;
    partner?: string;
    aspect?: string;
    sign?: string;
    applying?: boolean;
    orbDeg?: number;
    durationDays?: number;
    phaseName?: string;
    waxing?: boolean;
    dignity?: number;
    isDay?: boolean;
    verb?: string;
  };
}

export interface LeadRow {
  source: string;
  family: Family;
  band: DurationBand;
  note: string;
  /** Why this was eligible — the rules that fired, in order. */
  because: string[];
  polarity: 1 | -1;
}

export type LeadResult =
  /** One influence genuinely explains the moment. */
  | { state: "leads"; lead: LeadRow; support: Family[] }
  /** Two strong voices pull opposite ways — say so rather than picking. */
  | { state: "crosscurrents"; a: LeadRow; b: LeadRow }
  /** Nothing materially changes the ordinary reading. This is a real answer. */
  | { state: "quiet" };

/**
 * Which FAMILY a testimony belongs to.
 *
 * This is the primitive that makes convergence countable. "Saturn hour",
 * "Moon square Saturn", and a Saturn-pressure pattern derived from that same
 * square are three renderings of at most two facts — counting them as three
 * agreeing voices is how the duplication bug returns wearing better clothes.
 */
export function familyOf(source: string): Family {
  const head = source.split(":")[0];
  switch (head) {
    case "hour": case "dayRuler":            return "hour";
    case "moonAspect":                       return "moonAspect";
    case "moonSign": case "phase":           return "moonCycle";
    case "aspect":                           return "nonLunarAspect";
    case "sect": case "sectMalefic":         return "chartCondition";
    case "transit":                          return "personal";
    case "voc":                              return "voc";
    // A named pattern arrives with its own label. It is derived from other
    // testimony, so it is never its own family — treating it as one would
    // double-count the fact it was built from.
    default:                                 return "chartCondition";
  }
}

/** Where a testimony sits on the duration spine. */
export function bandOf(t: LeadTestimony): DurationBand {
  const fam = familyOf(t.source);
  // Same family, different duration: the hour ruler governs ~60 minutes, the
  // day ruler the whole day. They share a family so they cannot count as two
  // independent voices, but filing the day ruler under "this hour" was simply
  // mislabelling it.
  if (t.source === "dayRuler") return "today";
  switch (fam) {
    case "hour":            return "now";
    case "moonAspect":      return "today";
    case "voc":             return "today";
    case "nonLunarAspect": {
      const d = t.facts?.durationDays ?? 30;
      return d > 60 ? "background" : "stretch";
    }
    case "moonCycle":       return t.source === "moonSign" ? "today" : "background";
    case "personal":        return "stretch";
    default:                return "background";
  }
}

// Thresholds calibrated against MEASURED fire rate, not chosen by feel.
//
// Two rounds of measurement, both of which changed the design:
//
//  1. A first guess of 0.42 sat below every sample in a 240-moment scan, so
//     "quiet" could never fire — the exact failure this module exists to
//     prevent. Raising it to p20 fixed the rate but not the model.
//  2. The rate then FLIPPED depending on which clock hours were sampled, and
//     the validity check inverted with it. Cause: every moment has a planetary
//     hour, so a well-dignified hour ruler alone could lift a sky out of quiet.
//     That is what produced the ambient/event split above, after which the
//     rates held steady across three different sampling schemes.
//
// Final sweep over 200 real moments (floor / crosscurrent-ratio → rates):
//     0.88 / 0.88 → leads 60%  cross 3%  quiet 38%
//     0.78 / 0.82 → leads 65%  cross 4%  quiet 31%
//     0.72 / 0.80 → leads 68%  cross 6%  quiet 27%
//     0.65 / 0.78 → leads 74%  cross 7%  quiet 20%   ← chosen
//
// Chosen because it matches the intended shape: one clear lead is the ordinary
// case, quiet is a real minority rather than never or usual, and crosscurrents
// stay notable instead of routine.
//
// These are RELATIVE cuts against an observed distribution, not absolute claims
// about the sky. They mean "louder than most moments", which is the honest
// reading of a scale built from salience × dignity. Re-measure if the synthesis
// weights change — tests/lead.test.ts fails loudly if the rates drift.
//
// RE-MEASURED 2026-08-22, because the synthesis weights did change — exactly
// the case this note anticipated. The owner's ordering ("planetary hours and
// days are very much secondary to lunar placement and aspects and other
// planetary aspects") demoted the ambient families and gave 66 previously
// silent outer-planet aspect families a voice, which lifted the whole impact
// distribution. At the old floor, quiet fell to 1.7% — the original bug,
// reintroduced from the other direction.
//
// Fresh sweep, three sampling schemes (the note above is why all three):
//     floor   Aug 9/15/21     Jan weekly      spread hours
//     1.15    L68 C11 Q22     L72 C13 Q16     L69 C6 Q26   ← chosen
//     1.20    L66 C11 Q23     L70 C13 Q18     L67 C6 Q28
//     1.30    L63 C10 Q28     L63 C10 Q27     L64 C6 Q30
//
// 1.15 restores the intended shape — one clear lead ordinary, quiet a real
// minority near 20%, crosscurrents notable but not routine — and holds within
// ±5 points across the three schemes.
const LEAD_FLOOR = 1.15;
const CROSSCURRENT_RATIO = 0.78;

/**
 * Can this testimony LEAD, or can it only support?
 *
 * Found by measurement: with every family eligible to lead, whether a moment
 * counted as "quiet" flipped depending on which clock hours were sampled —
 * because the planetary hour is ALWAYS present, so a well-dignified hour ruler
 * could single-handedly make an otherwise empty sky read as eventful. That is
 * incoherent: "quiet" should mean nothing is happening, not that the ambient
 * conditions happen to be strong.
 *
 * So the stack distinguishes AMBIENT from EVENT. Ambient conditions (the hour,
 * the day ruler, the Moon's sign, the phase, sect) are always true and always
 * described — but they cannot promote a day out of quiet. Only something
 * CHANGING can: an applying aspect, a void gate, a personal transit.
 */
function canLead(fam: Family, t: LeadTestimony): boolean {
  if (fam === "voc" || fam === "personal") return true;
  if (fam === "moonAspect" || fam === "nonLunarAspect") return true;
  // Ambient. Real, describable, never the reason a day stops being quiet.
  return false;
}

/** Impact = how much this testimony actually bears on a decision now. */
function impact(t: LeadTestimony): number {
  let v = t.salience * Math.max(0.4, t.weight);
  // Rule 2 — changing or exact inside the decision horizon. An applying aspect
  // is about to matter; a separating one already did.
  if (t.facts?.applying) v *= 1.15;
  if (typeof t.facts?.orbDeg === "number" && t.facts.orbDeg <= 1) v *= 1.15;
  // Rule 5 — a gate that qualifies everything else outranks ordinary weather.
  if (familyOf(t.source) === "voc") v *= 1.3;
  // Rule 4 — personal testimony is about THIS user, not the world.
  if (familyOf(t.source) === "personal") v *= 1.2;
  return v;
}

export function pickLead(testimonies: LeadTestimony[]): LeadResult {
  if (!testimonies.length) return { state: "quiet" };

  const ranked = [...testimonies]
    .map(t => ({ t, imp: impact(t), fam: familyOf(t.source) }))
    .sort((a, b) => b.imp - a.imp);

  // Only events may lead; ambient conditions may support. See canLead.
  const leadable = ranked.filter(r => canLead(r.fam, r.t));
  const top = leadable[0];
  // Rule 1 — does anything materially alter what to do? If nothing is changing
  // loudly enough, the honest answer is that this is a quiet sky, however
  // strong the ambient conditions happen to be.
  if (!top || top.imp < LEAD_FLOOR) return { state: "quiet" };

  const rowOf = (r: typeof top, because: string[]): LeadRow => ({
    source: r.t.source, family: r.fam, band: bandOf(r.t),
    note: r.t.note, because, polarity: r.t.polarity,
  });

  // Crosscurrents — a genuinely comparable voice pulling the other way, from a
  // DIFFERENT family. Same-family disagreement is usually one fact seen twice.
  const counter = leadable.find(r =>
    r !== top && r.fam !== top.fam && r.t.polarity !== top.t.polarity &&
    r.imp >= top.imp * CROSSCURRENT_RATIO);
  if (counter) {
    return {
      state: "crosscurrents",
      a: rowOf(top, ["strongest voice"]),
      b: rowOf(counter, ["comparable, and pulls the other way"]),
    };
  }

  // Rule 3 — reinforcement, counted by FAMILY. Only distinct families whose
  // polarity agrees with the lead count as support.
  const support = [...new Set(
    ranked.filter(r => r !== top && r.fam !== top.fam &&
                       r.t.polarity === top.t.polarity && r.imp >= LEAD_FLOOR * 0.6)
          .map(r => r.fam),
  )];

  const because = ["strongest voice"];
  if (top.t.facts?.applying) because.push("still building");
  if (support.length >= 2) because.push(`${support.length} other families agree`);

  return { state: "leads", lead: rowOf(top, because), support };
}
