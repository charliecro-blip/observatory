// The rule-combination engine: weighted influences in, normalized
// VisualProfile out. Each influence contributes signed deltas; sums are
// squashed through tanh so strong agreement saturates gracefully instead of
// pinning at the rails, and a lone mild factor stays mild.

import { PROFILE_AXES, type Influence, type ProfileDelta, type VisualProfile } from "./types";

const SQUASH = 1.1;

export function combineInfluences(influences: Influence[]): VisualProfile {
  const sums: Record<string, number> = {};
  for (const axis of PROFILE_AXES) sums[axis] = 0;
  for (const inf of influences) {
    for (const [axis, v] of Object.entries(inf.deltas)) {
      sums[axis] += inf.weight * (v as number);
    }
  }
  const profile = {} as VisualProfile;
  for (const axis of PROFILE_AXES) {
    profile[axis] = 0.5 + 0.5 * Math.tanh(SQUASH * sums[axis]);
  }
  return profile;
}

export function scaleDeltas(deltas: ProfileDelta, factor: number): ProfileDelta {
  const out: ProfileDelta = {};
  for (const [axis, v] of Object.entries(deltas)) {
    out[axis as keyof ProfileDelta] = (v as number) * factor;
  }
  return out;
}
