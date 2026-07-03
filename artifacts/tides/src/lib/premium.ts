// No billing infrastructure exists yet. This module defines what's gated and
// why, so the paywall UI (PremiumGate, the explore modal, the Settings
// preview toggle) has one source of truth to build against — swapping the
// dev-override check in premium-context.tsx for a real entitlement check
// later shouldn't require touching any of the UI built on top of this.

// The free/paid line: FREE is a genuinely useful weather-app-plus-planner —
// the universal tide (Now), the Ahead calendar with manual scheduling, the
// Almanac reference, and Guiding Stars/tasks/habits usable as a plain planner
// with no astrology required. PAID is when it becomes PERSONAL and INTELLIGENT:
// your own chart's long cycles, your personal caution windows, and the app
// finding the best *time* for what you're planning (the AI/tide timing layer,
// which is also where the real per-user cost lives).
export type PremiumFeature = "currents" | "scheduling";

export interface PremiumFeatureMeta {
  key: PremiumFeature;
  title: string;
  teaser: string;
  icon: string;
}

export const PREMIUM_FEATURES: PremiumFeatureMeta[] = [
  {
    key: "currents",
    title: "Currents",
    teaser: "Your profected year, active outer-planet chapters, and major transits — the long water beneath the daily tide.",
    icon: "🌊",
  },
  {
    key: "currents",
    title: "Caution Periods",
    teaser: "Flag the planetary archetypes that hit you hardest, and get a gentle heads-up when the Sun or Moon lights one up.",
    icon: "⚠",
  },
  {
    key: "scheduling",
    title: "Smart scheduling",
    teaser: "Tides reads what a task or habit is really about and finds its best times this week — matched to the sky and to your own free hours. You can always still pick your own time for free.",
    icon: "✦",
  },
];
