// No billing infrastructure exists yet. This module defines what's gated and
// why, so the paywall UI (PremiumGate, the explore modal, the Settings
// preview toggle) has one source of truth to build against — swapping the
// dev-override check in premium-context.tsx for a real entitlement check
// later shouldn't require touching any of the UI built on top of this.

export type PremiumFeature = "currents";

export interface PremiumFeatureMeta {
  key: PremiumFeature;
  title: string;
  teaser: string;
  icon: string;
}

// Currents (long-cycle personal transits) and Caution Periods (planetary
// sensitivity diagnosis + upcoming hard-aspect windows) currently share one
// gate — both live on the Currents page. Listed separately here because they
// are two distinct value props worth messaging separately in the explore
// modal, even though unlocking one unlocks both today.
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
    teaser: "Diagnose which planetary archetypes tend to hit you hardest, and see upcoming windows to move carefully.",
    icon: "⚠",
  },
];
