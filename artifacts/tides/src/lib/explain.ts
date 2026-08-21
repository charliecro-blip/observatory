/**
 * THE COMPOSER — condition → approach → example (AUDIT-EXPLAINERS-2026-08-21
 * §3). A surface hands in its base (the sign's or planet's own sentence) and
 * the moment's qualifiers; it gets back the TAKES for its body, rarest
 * qualifier first and the base last, each already composed for the lens.
 * ↻ walks the takes. No take stacks two qualifiers.
 */
import type { AstroDetail } from "@/lib/preferences";

export interface Qualifier {
  key: string; bodies: string[]; salience: number; label: string;
  literal: string; plain: string; approach: string; example?: string;
  provenance: "tradition" | "compass";
}

export interface Take {
  /** Small-caps label over the line. */
  label: string;
  /** The fact, at this lens; empty for the base take (the chip already says it). */
  condition: string;
  /** How things want doing. */
  approach: string;
  example?: string;
  provenance?: "tradition" | "compass";
  /** The qualifier key, for tests and for stable reroll order. */
  key: string;
}

/** Takes for one body, composed for the lens. `base` is always last. */
export function takesFor(
  bodies: string[],
  qualifiers: Qualifier[] | undefined,
  base: { label: string; approach: string; example?: string },
  level: AstroDetail,
): Take[] {
  const mine = (qualifiers ?? [])
    .filter(q => q.bodies.some(b => bodies.includes(b)))
    .sort((a, b) => b.salience - a.salience);
  const takes: Take[] = mine.map(q => ({
    key: q.key,
    label: q.label,
    condition: level === "full" ? q.literal : q.plain,
    approach: q.approach,
    example: q.example,
    provenance: q.provenance,
  }));
  takes.push({ key: "base", label: base.label, condition: "", approach: base.approach, example: base.example });
  return takes;
}

/** One line: "condition — approach. Example." with the pieces a surface can style. */
export function lineOf(t: Take): string {
  const head = t.condition ? `${t.condition} — ` : "";
  const ex = t.example ? ` ${cap(t.example)}.` : "";
  return `${head}${t.condition ? t.approach : cap(t.approach)}.${ex}`;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
