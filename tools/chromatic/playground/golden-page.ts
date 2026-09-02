// The golden compare page: approved baseline beside current render for each
// canonical case, with the concrete diffs named. Baseline SVGs are committed
// repo content, so injecting them is injecting our own reviewed markup.

import baselines from "../golden/baselines.json";
import { PROFILE_AXES, type CompositionModel, type VisualProfile } from "../engine/types";
import { CANONICAL_PAIRS } from "../engine/canon";
import { buildPairModel } from "../engine/pair";
import { renderArtwork } from "../engine/render";
import { esc } from "./esc";

interface CaseDiff {
  palette: string[];
  profile: string[];
  composition: string[];
  svgChanged: boolean;
}

function diffCase(
  baseline: (typeof baselines.cases)[number],
  model: ReturnType<typeof buildPairModel>,
  svg: string,
): CaseDiff {
  const palette: string[] = [];
  const currentByRole = new Map<string, string>(model.palette.map((c) => [c.role, c.hex]));
  const baseByRole = new Map<string, string>(baseline.palette.map((c) => [c.role, c.hex]));
  for (const role of new Set([...currentByRole.keys(), ...baseByRole.keys()])) {
    const before = baseByRole.get(role);
    const after = currentByRole.get(role);
    if (before !== after) palette.push(`${role}: ${before ?? "—"} → ${after ?? "—"}`);
  }

  const profile: string[] = [];
  for (const axis of PROFILE_AXES) {
    const before = (baseline.profile as VisualProfile)[axis];
    const after = model.profile[axis];
    if (Math.abs(before - after) > 0.005) {
      profile.push(`${axis}: ${(before * 100).toFixed(0)} → ${(after * 100).toFixed(0)}`);
    }
  }

  const composition: string[] = [];
  for (const key of Object.keys(model.composition) as Array<keyof CompositionModel>) {
    const before = (baseline.composition as CompositionModel)[key];
    const after = model.composition[key];
    const same = typeof after === "number" && typeof before === "number"
      ? Math.abs(after - before) <= 0.005
      : after === before;
    if (!same) {
      const show = (v: number | string) => (typeof v === "number" ? v.toFixed(2) : v);
      composition.push(`${key}: ${show(before)} → ${show(after)}`);
    }
  }

  return { palette, profile, composition, svgChanged: svg !== baseline.svg };
}

/**
 * Baseline and current render share seed-derived element ids, and SVG ids are
 * document-global — without namespacing, a differing pair would silently
 * borrow each other's gradients. The baseline copy gets its own prefix.
 */
function namespaceIds(svg: string): string {
  return svg.replace(/(url\(#|id=")(ch[0-9a-z]+-)/g, "$1base-$2");
}

const rows: string[] = [];
let differing = 0;

for (const canon of CANONICAL_PAIRS) {
  const baseline = baselines.cases.find((c) => c.slug === canon.slug);
  const model = buildPairModel(canon.scenario);
  const svg = renderArtwork(model);
  if (!baseline) {
    differing++;
    rows.push(`<div class="case differs"><div class="case-head"><b>${esc(canon.title)}</b><span class="badge warn">no baseline</span></div><div class="panes"><div></div><div class="pane">${svg}</div></div></div>`);
    continue;
  }
  const diff = diffCase(baseline, model, svg);
  const differs = diff.svgChanged || diff.palette.length > 0 || diff.profile.length > 0 || diff.composition.length > 0;
  if (differs) differing++;
  const diffLines = differs
    ? `<div class="diffs">${[
        diff.palette.length ? `palette — <code>${esc(diff.palette.join(" · "))}</code>` : "",
        diff.profile.length ? `profile — <code>${esc(diff.profile.join(" · "))}</code>` : "",
        diff.composition.length ? `composition — <code>${esc(diff.composition.join(" · "))}</code>` : "",
        diff.svgChanged && !diff.palette.length && !diff.profile.length && !diff.composition.length
          ? "drawing changed with identical model — renderer-level change" : "",
      ].filter(Boolean).join("<br>")}</div>`
    : "";
  rows.push(`
    <div class="case${differs ? " differs" : ""}">
      <div class="case-head"><b>${esc(canon.title)}</b><span class="badge ${differs ? "warn" : "ok"}">${differs ? "differs" : "matches"}</span></div>
      <div class="panes">
        <div><div class="pane-label">Approved baseline</div><div class="pane">${namespaceIds(baseline.svg)}</div></div>
        <div><div class="pane-label">Current render</div><div class="pane">${svg}</div></div>
      </div>
      ${diffLines}
    </div>`);
}

document.getElementById("summary")!.innerHTML = differing === 0
  ? `<b class="ok">All ${CANONICAL_PAIRS.length} match their approved baselines.</b>`
  : `<b class="warn">${differing} of ${CANONICAL_PAIRS.length} differ from their approved baselines.</b> If the change is intentional, accept it with the update script below.`;
document.getElementById("cases")!.innerHTML = rows.join("");
