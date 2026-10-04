import { relationshipActivityKey } from "./romanticTime.js";
import { activityByKey, rankActivities } from "./activityCorrespondences.js";

const DIRECT_ACTIVITY_PATTERNS: Array<[RegExp, string]> = [
  [
    /\b(?:take|have|need|fit in) (?:a |an )?(?:restorative )?nap\b/i,
    "deep-rest",
  ],
  [/\b(?:get|schedule|book) (?:my |a )?hair cut\b/i, "haircut"],
  [
    /\b(?:learn|practice) (?:to play )?(?:the )?(?:guitar|piano|drums|violin)\b/i,
    "learn-skill",
  ],
  [/\b(?:give|deliver) (?:a |the )?presentation\b/i, "teach-present"],
  [/\b(?:focus on|work on|do some) (?:my )?(?:coding|code)\b/i, "deep-work"],
  [
    /\b(?:tidy|organize|declutter) (?:up )?(?:my |the )?(?:apartment|house|home|room|space)\b/i,
    "organize",
  ],
  [
    /\b(?:fix|repair|mend) (?:my |the |a )?(?:kitchen |bathroom )?(?:sink|faucet|toilet|door|bike|car|computer)\b/i,
    "repair",
  ],
  [
    /\b(?:ask for|negotiate) (?:a |my )?(?:raise|salary|pay|rate)\b/i,
    "negotiate",
  ],
  [
    /\b(?:have|start) (?:a |the )?(?:difficult|hard|serious) conversation\b/i,
    "hard-conversation",
  ],
  [
    /\bcall (?:my )?(?:mom|mother|dad|father|parent|parents|sister|brother|family)\b/i,
    "call-family",
  ],
  [
    /\b(?:bake|make) (?:a |some )?(?:loaf of )?(?:bread|cake|cookies)\b/i,
    "cook",
  ],
  [/\b(?:do|file|prepare) (?:my |the )?taxes\b/i, "budget"],
  [/\b(?:write|reflect) in (?:my |a )?journal\b/i, "journal"],
];

export type ActivityInterpretation = {
  state: "resolved" | "ambiguous" | "unsupported";
  options: Array<{ key: string; label: string }>;
  clarification?: string;
};

/** Interpretation resolves wording only; it makes no timing judgment. */
export function interpretTimingActivity(text: string): ActivityInterpretation {
  text = text
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  const option = (key: string) => {
    const a = activityByKey(key);
    return a ? { key: a.key, label: a.label } : null;
  };
  if (/\b(psychedelic|psilocybin|ayahuasca|lsd|mushroom trip)\b/i.test(text))
    return { state: "unsupported", options: [] };
  // Negation and multiple jobs require semantic clarification, never first-hit routing.
  if (/\b(?:not|instead of|rather than|don't|do not|except)\b/i.test(text))
    return {
      state: "ambiguous",
      options: [],
      clarification:
        "What would you like to find a time for? Please name the activity you want to do.",
    };
  const parts = text.split(/\s+(?:and then|and|or|versus)\s+/i);
  if (parts.length > 1) {
    const results = parts.map((part) => interpretTimingActivity(part));
    const keys = [
      ...new Set(
        results
          .filter((r) => r.state === "resolved")
          .map((r) => r.options[0]?.key)
          .filter(Boolean),
      ),
    ];
    if (keys.length > 1)
      return {
        state: "ambiguous",
        options: keys.map((key) => option(key!)!),
        clarification: "Which activity would you like to time first?",
      };
  }
  if (
    /\b(?:prepare|rehearse|work on) (?:a |my |the )?(?:presentation|talk|keynote)\b/i.test(
      text,
    )
  )
    return {
      state: "ambiguous",
      options: [
        option("first-draft")!,
        option("deep-work")!,
        option("teach-present")!,
      ],
      clarification:
        "Are you writing it, preparing the material, or delivering it?",
    };
  if (
    /\bpaint(?:ing)? (?:my |the |a )?(?:kitchen|wall|walls|house|room|fence|bedroom)\b/i.test(
      text,
    )
  )
    return { state: "resolved", options: [option("beautify")!] };
  if (/\bdraw (?:up|down|a conclusion|conclusions|a bath|blood)\b/i.test(text))
    return { state: "unsupported", options: [] };
  if (
    /\b(?:yoga|gentle|stretch|recovery|pilates)\b/i.test(text) &&
    /\bwork[ -]?out\b/i.test(text)
  )
    return { state: "resolved", options: [option("gentle-movement")!] };
  if (/\b(work[ -]?out|gym|training session)\b/i.test(text))
    return { state: "resolved", options: [option("train-hard")!] };
  if (
    /\b(painting|drawing|draw|illustrat(?:e|ing|ion)|sculpt(?:ing|ure)?|pottery|ceramics|collage|songwriting)\b|\b(write a song|compose music)\b/i.test(
      text,
    )
  )
    return { state: "resolved", options: [option("creative-practice")!] };
  for (const [pattern, key] of DIRECT_ACTIVITY_PATTERNS) {
    if (pattern.test(text))
      return { state: "resolved", options: [option(key)!] };
  }
  const relationship = relationshipActivityKey(text);
  if (relationship)
    return { state: "resolved", options: [option(relationship)!] };
  if (/\bdate\b/i.test(text))
    return {
      state: "ambiguous",
      options: [
        option("romantic-time"),
        { key: "first-date", label: "A first date" },
      ].filter(
        (value): value is { key: string; label: string } => value !== null,
      ),
    };
  const ranked = rankActivities(text, 3);
  // A single short word that names one activity and nothing else ("nap",
  // "qigong", "film") scores under the confidence bar on length alone. When it
  // is the ONLY activity the words touch at all, there is no rival reading to
  // guard against, so it resolves (2026-10-03). A runner-up worth only one
  // stray label word ("call" in "call the bank" brushing Call family) is not
  // a rival either. Two real matches still ask.
  if (ranked[0] && ranked[0].score >= 1.3 && (ranked[1]?.score ?? 0) <= 0.5)
    return { state: "resolved", options: [{ key: ranked[0].activity.key, label: ranked[0].activity.label }] };
  const matches = ranked
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
