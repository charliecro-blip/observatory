/**
 * QUALIFIERS — what makes THIS moment unlike other moments with the same
 * sign (AUDIT-EXPLAINERS-2026-08-21 §3, §6.2).
 *
 * Every small explainer in the app used to be keyed to the sign alone, so the
 * Sun on the South Node inside an eclipse corridor read exactly like any
 * other Leo afternoon. This is the layer that knows the difference: each
 * qualifier names the bodies it qualifies, a salience (rarity — the same
 * ordering DayConditions uses, rarer wins), the fact literally and in plain
 * words, and ONE approach clause in the quality register. Surfaces compose a
 * base plus the single most salient qualifier for their body; ↻ walks the
 * rest. No surface stacks them — and no qualifier has two homes: the eclipse
 * corridor is the SEASON's fact, a luminary on a node is that luminary's,
 * so the rail's three lines and the tide strip cannot all open with the
 * same sentence (which is exactly what the first build did).
 *
 * Provenance is carried, not implied: "tradition" where the reading is the
 * inherited doctrine (eclipses delay elections, combustion hides, a station
 * turns), "compass" where it is this app's synthesis (the node's manner, a
 * stellium's pull). Copy here is draft until it has been through the skill.
 */
import { lunarNodes, eclipseWindow } from "./astro.js";
import { nodeTiming } from "./nodeEvents.js";
import { motionOf } from "./motion.js";

export interface Qualifier {
  key: string;
  /** Planet names, and/or "season" for the Sun's sign as a whole. */
  bodies: string[];
  /** Rarer is higher. Ties break by list order. */
  salience: number;
  /** A short uppercase-able label for the take. */
  label: string;
  /** The fact, astrologer-grade. */
  literal: string;
  /** The same fact in words that need no glossary. */
  plain: string;
  /** How things want doing under it — one clause. */
  approach: string;
  example?: string;
  provenance: "tradition" | "compass";
  /**
   * ISO instant this is exact, where that is a meaningful thing to say.
   *
   * An orb is not a time of day. The Moon-on-a-node qualifier carried "· 1.5°"
   * and nothing else, so a reader told the mood leans forward could not tell
   * whether that was this morning or already behind them (owner, 2026-08-27).
   * Sent as an instant, never a formatted clock: this server runs in UTC in
   * production and has told someone the wrong day that way before.
   */
  exactAt?: string;
  /** True while the bodies are still closing. */
  applying?: boolean;
}

interface Body { planet: string; longitude: number; sign: string; degree: number; retrograde: boolean }

const CLASSICAL = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
const sep = (a: number, b: number) => Math.abs(((a - b) % 360 + 540) % 360 - 180);
const deg = (x: number) => `${x.toFixed(1)}°`;

const RX_APPROACH: Record<string, string> = {
  Mercury: "plans get revised under it; re-sending and rechecking go better than starting",
  Venus: "what you want is under review; tastes and terms revisit themselves before they settle",
  Mars: "effort doubles back; the push that worked last month needs re-aiming",
  Jupiter: "growth turns inward; the bigger frame is being rethought",
  Saturn: "structure is under review; commitments stretch and get re-tested before they hold",
};
const STATION_RX: Record<string, string> = {
  Mercury: "the mind's matters turn inward for review; what gets pushed now tends to come back around",
  Venus: "matters of taste and relating turn inward; what gets signed now tends to be revisited",
  Mars: "the drive turns inward; the push that won't land now is better saved",
  Jupiter: "the expansion pauses to reconsider its size",
  Saturn: "the structure pauses to be re-tested; what was holding gets questioned",
};
const STATION_D: Record<string, string> = {
  Mercury: "the mind's matters are ready to move again; what was under review can be sent",
  Venus: "matters of taste and relating move again; terms can settle",
  Mars: "the drive is ready to move again; the push has somewhere to go",
  Jupiter: "the expansion resumes at its reconsidered size",
  Saturn: "the structure holds again; commitments under review can be settled",
};

export function computeQualifiers(jd: number, bodies: Body[], opts: { voc?: boolean; vocFeel?: string | null } = {}): Qualifier[] {
  const out: Qualifier[] = [];
  const by = (p: string) => bodies.find(b => b.planet === p);
  const sun = by("Sun"), moon = by("Moon");

  // ── Eclipse corridor (≈4 a year) ─────────────────────────────────────────
  const ecl = eclipseWindow(jd);
  if (ecl.active && ecl.kind) {
    const n = ecl.daysAway ?? 0;
    out.push({
      key: `eclipse:${ecl.kind}`, bodies: ["season"], salience: 100, label: "eclipse season",
      literal: n === 0 ? `${ecl.kind} eclipse today` : `within ${n} day${n === 1 ? "" : "s"} of a ${ecl.kind} eclipse`,
      plain: n === 0 ? "an eclipse today" : "an eclipse within the week",
      approach: "the stretch is for settling what is already in motion; beginnings made in it tend to change shape faster than planned",
      example: "finish the story that's open",
      provenance: "tradition",
    });
  }

  // ── A luminary on a node (the Sun ≈ twice a year; the Moon twice a month) ─
  const nodes = lunarNodes(jd);
  for (const lum of [sun, moon]) {
    if (!lum) continue;
    for (const [which, node] of [["North", nodes.north], ["South", nodes.south]] as const) {
      const orb = sep(lum.longitude, node.longitude);
      if (orb > 3) continue;
      const isSun = lum.planet === "Sun";
      // Exactness only for the Moon. She crosses a node twice a month and the
      // meeting is hours wide, so the time of day is the useful part; the Sun
      // takes days over the same 3° and a clock reading would imply a
      // precision the event does not have. The walk costs 289 ephemeris reads
      // and is guarded by the orb above, so an ordinary request never pays it.
      const timing = isSun ? null : nodeTiming(jd, which);
      out.push({
        key: `${lum.planet.toLowerCase()}-${which.toLowerCase()}-node`,
        bodies: [lum.planet],
        salience: isSun ? 80 : 60,
        label: `on the ${which} Node`,
        ...(timing ?? {}),
        literal: `${lum.planet} on the ${which} Node · ${deg(orb)}`,
        plain: `the ${lum.planet} is sitting on the Moon's ${which} Node`,
        approach: which === "South"
          ? (isSun
            ? "what comes easily today is the thing you have done before; the new act costs more than it looks"
            : "the mood leans on the familiar; the old comfort is close at hand")
          : (isSun
            ? "the unfamiliar move is the one worth leaning toward; the known act gives less than usual"
            : "the mood leans forward; what is unfamiliar sits better than what is known"),
        example: which === "South" ? "back what you have already made" : "try the version you have not tried",
        provenance: "compass",
      });
    }
  }

  // ── Stations and retrogrades of the classical planets ────────────────────
  for (const p of ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"]) {
    const m = motionOf(p, jd);
    if (!m) continue;
    if (m.phase === "stationing-retrograde" || m.phase === "stationing-direct") {
      const rx = m.phase === "stationing-retrograde";
      out.push({
        key: `station:${p}`, bodies: [p], salience: 70, label: rx ? "stationing retrograde" : "stationing direct",
        literal: `${p} stationing ${rx ? "retrograde" : "direct"}`,
        plain: `${p} is turning ${rx ? "backward" : "forward"} this week`,
        approach: (rx ? STATION_RX : STATION_D)[p],
        provenance: "tradition",
      });
    } else if (m.phase === "retrograde") {
      out.push({
        key: `retrograde:${p}`, bodies: [p], salience: 30, label: "retrograde",
        literal: `${p} retrograde`, plain: `${p} is moving backward`,
        approach: RX_APPROACH[p], provenance: "tradition",
      });
    }
  }

  // ── Cazimi and combustion (Mercury, Venus, Mars near the Sun) ────────────
  if (sun) {
    for (const p of ["Mercury", "Venus", "Mars"]) {
      const b = by(p); if (!b) continue;
      const orb = sep(b.longitude, sun.longitude);
      if (orb <= 0.2833) {
        out.push({
          key: `cazimi:${p}`, bodies: [p, "Sun"], salience: 55, label: "cazimi",
          literal: `${p} cazimi · ${deg(orb)}`, plain: `${p} is in the heart of the Sun`,
          approach: `${p}'s matters are lit and protected; act through them`,
          provenance: "tradition",
        });
      } else if (orb <= 8.5) {
        out.push({
          key: `combust:${p}`, bodies: [p, "Sun"], salience: 40, label: "combust",
          literal: `${p} combust · ${deg(orb)} from the Sun`, plain: `${p} is lost in the Sun's glare`,
          approach: `${p}'s matters are hard to see clearly from inside them; hold them lightly and ask for a second pair of eyes`,
          provenance: "tradition",
        });
      }
    }
  }

  // ── The void ─────────────────────────────────────────────────────────────
  if (opts.voc) {
    out.push({
      key: "void", bodies: ["Moon"], salience: 50, label: "void of course",
      literal: "Moon void of course", plain: "the Moon makes no more contacts before changing sign",
      approach: opts.vocFeel ?? "finishing and resting take; beginnings tend to drift",
      provenance: "tradition",
    });
  }

  // ── Sign emphasis (three or more classical planets in one sign) ──────────
  const counts = new Map<string, string[]>();
  for (const b of bodies) if (CLASSICAL.includes(b.planet) && b.planet !== "Moon") counts.set(b.sign, [...(counts.get(b.sign) ?? []), b.planet]);
  for (const [sign, ps] of counts) {
    if (ps.length < 3) continue;
    out.push({
      key: `emphasis:${sign}`, bodies: ["season", ...ps], salience: 35, label: `${sign} emphasis`,
      literal: `${ps.length} planets in ${sign}: ${ps.join(", ")}`,
      plain: `${ps.length} planets are gathered in ${sign}`,
      approach: `the season's manner runs through more than the Sun; ${sign}'s way of doing things is hard to step outside of`,
      provenance: "compass",
    });
  }

  return out.sort((a, b) => b.salience - a.salience);
}
