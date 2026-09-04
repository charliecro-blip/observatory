/** Global flag plus an explicit cohort. Empty cohorts fail closed. `*` is for scratch. */
export function timingEnabledFor(
  testerId: string,
  flag = process.env.TIMING_SEARCH_ENABLED,
  cohort = process.env.TIMING_SEARCH_TESTER_IDS,
) {
  if (flag !== "true") return false;
  const ids = (cohort ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.includes("*") || ids.includes(testerId);
}
