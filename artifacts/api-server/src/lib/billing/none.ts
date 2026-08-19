/**
 * THE UNCONFIGURED ADAPTER — the default, and the honest one.
 *
 * With no provider chosen there is no checkout, and this says so instead of
 * throwing, returning a dead link, or silently marking someone paid. Every
 * refusal names the reason, which is the same rule the rest of the app
 * follows for gaps.
 */

import type { BillingAdapter } from "./port.js";

export const noBilling: BillingAdapter = {
  name: "none",
  configured: false,
  async createCheckout() { return null; },
  // Never trust a webhook body we cannot verify. With no provider there is no
  // signature to check, so every delivery is rejected — an endpoint that
  // accepted them would let anyone set any account to paid.
  async parseWebhook() { return null; },
  async price() { return null; },
};
