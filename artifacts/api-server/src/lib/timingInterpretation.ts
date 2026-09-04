import { relationshipActivityKey } from "./romanticTime.js";
import { activityByKey, rankActivities } from "./activityCorrespondences.js";

/** Interpretation resolves wording only; it makes no timing judgment. */
export function interpretTimingActivity(text: string) {
  const option = (key: string) => {
    const a = activityByKey(key);
    return a ? { key: a.key, label: a.label } : null;
  };
  if (/\b(psychedelic|psilocybin|ayahuasca|lsd|mushroom trip)\b/i.test(text))
    return { state: "unsupported", options: [] };
  const relationship = relationshipActivityKey(text);
  if (relationship)
    return { state: "resolved", options: [option(relationship)!] };
  if (/\bdate\b/i.test(text))
    return {
      state: "ambiguous",
      options: [
        option("romantic-time"),
        { key: "first-date", label: "A first date" },
      ].filter(Boolean),
    };
  const matches = rankActivities(text, 3)
    .filter((x) => x.score >= 2)
    .map((x) => ({
      key: x.activity.key,
      label: x.activity.label,
      score: x.score,
    }));
  const resolved =
    matches.length &&
    (matches.length === 1 || matches[0].score - matches[1].score >= 1);
  return {
    state: resolved ? "resolved" : matches.length ? "ambiguous" : "unsupported",
    options: matches.map(({ key, label }) => ({ key, label })),
  };
}
