#!/usr/bin/env python3
"""
Generate artifacts/api-server/src/lib/sprintIdeas.ts from the Astrolyrica
sprint tables in knowledge/astrolyrica-sprints/.

The YAML is the SOURCE OF TRUTH and is versioned beside the generated file;
this script is how the two stay in step. Generating rather than parsing at
runtime is deliberate: the api-server ships as an esbuild bundle, so a
runtime read would depend on the process's cwd (the trap knowledge.ts lives
with), and a YAML parser would be a new dependency against a workspace that
enforces a minimum release age.

    python3 scripts/gen-sprint-ideas.py
"""
import yaml, pathlib, json

root = pathlib.Path(__file__).resolve().parent.parent
src = root / "knowledge" / "astrolyrica-sprints"
out = root / "artifacts" / "api-server" / "src" / "lib" / "sprintIdeas.ts"

generic = yaml.safe_load((src / "sprints.yaml").read_text())["sprints"]
pairs = yaml.safe_load((src / "sprint_pairs.yaml").read_text())["sprint_pairs"]

def cap(p): return p.capitalize()

modes = {}
for e in generic:
    modes[f"{cap(e['transiting_planet'])}|{e['aspect']}"] = {
        "push": e["push"], "register": e["register"],
        "ideas": e["ideas"], "avoid": e["avoid"],
    }

pair_map = {}
for e in pairs:
    k = f"{cap(e['transiting_planet'])}|{e['aspect']}|{cap(e['target_planet'])}"
    pair_map[k] = {"ideas": e["ideas"], "avoid": e["avoid"]}

body = f'''/**
 * Sprint ideas — GENERATED, do not edit by hand.
 *
 * Source: knowledge/astrolyrica-sprints/{{sprints,sprint_pairs}}.yaml
 * Regenerate: python3 scripts/gen-sprint-ideas.py
 *
 * Two layers, written by Astrolyrica against the brief in
 * ASTROLYRICA-COPY-HANDOFF.md. SPRINT_PAIRS is the specific one — transiting
 * planet x aspect x target, so Mars square Saturn (the deferred grind) reads
 * unlike Mars square Neptune (discipline against fog). SPRINT_MODES is the
 * generic fallback by shape alone. Resolve the pair first, then the mode.
 *
 * `avoid` rides along deliberately: it is what the copy must never become,
 * and keeping it next to the ideas is what stops a later edit reintroducing
 * streak framing or an ultimatum from the sky.
 */

export interface SprintIdea {{ ideas: string[]; avoid: string[] }}
export interface SprintMode extends SprintIdea {{ push: string; register: string }}

/** `${{TransitingPlanet}}|${{aspect}}` */
export const SPRINT_MODES: Record<string, SprintMode> = {json.dumps(modes, indent=2, ensure_ascii=False)};

/** `${{TransitingPlanet}}|${{aspect}}|${{TargetPlanet}}` */
export const SPRINT_PAIRS: Record<string, SprintIdea> = {json.dumps(pair_map, indent=2, ensure_ascii=False)};

/** The specific pairing when there is one, else the shape's generic ideas. */
export function sprintIdeasFor(transiting: string, aspect: string, target: string): SprintIdea | null {{
  return SPRINT_PAIRS[`${{transiting}}|${{aspect}}|${{target}}`]
    ?? SPRINT_MODES[`${{transiting}}|${{aspect}}`]
    ?? null;
}}

/** The register line for a shape — Astrolyrica's phrasing of the mode. */
export function sprintRegisterFor(transiting: string, aspect: string): string | null {{
  return SPRINT_MODES[`${{transiting}}|${{aspect}}`]?.register ?? null;
}}
'''
out.write_text(body)
print(f"wrote {out.relative_to(root)} — {len(modes)} modes, {len(pair_map)} pairs")
