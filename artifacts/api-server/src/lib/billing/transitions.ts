/**
 * WHAT A BILLING EVENT DOES TO A PLAN.
 *
 * Pure, so it can be tested without a provider, a database or a network — and
 * so the rules below are readable as rules rather than inferred from a route
 * handler. This is the half of billing that has nothing to do with which
 * provider was chosen and everything to do with being correct.
 *
 * THE FOUR RULES, each of which exists because the obvious version is wrong:
 *
 * 1. STALE EVENTS ARE IGNORED. Webhooks arrive out of order and more than
 *    once. A retried "ended" delivered after a newer "active" would cancel a
 *    live subscription, and the customer would be the one to find out.
 *    Compared on the provider's own timestamp, never on arrival.
 *
 * 2. PAST DUE KEEPS ACCESS. A failed charge is usually a card that expired,
 *    and the retry usually succeeds. Cutting someone off on the first failure
 *    punishes them for their bank's timing; the provider's dunning window is
 *    the right place for that decision, not this function.
 *
 * 3. AN ENDED SUBSCRIPTION LANDS ON `free`, NEVER on `beta`. Beta is a gift
 *    given before billing existed. Once someone has subscribed and stopped,
 *    free is the honest state — and free is a genuinely useful product here,
 *    not a lockout.
 *
 * 4. NOTHING HERE TOUCHES ANY OF THE PERSON'S WORK. A downgrade writes to
 *    `plan` and the billing columns and nothing else. Every window Compass
 *    placed stays on their calendar; only the ability to compute new ones
 *    stops. This is the mechanic the pricing decision says must not slip, and
 *    the reason it holds is that this function has no way to break it.
 */

import type { BillingEvent } from "./port.js";

export interface PlanRow {
  plan?: string | null;
  planUpdatedAt?: Date | string | null;
  billingCustomerId?: string | null;
  billingSubscriptionId?: string | null;
  billingStatus?: string | null;
}

export interface PlanPatch {
  plan?: string;
  planUpdatedAt: Date;
  billingCustomerId?: string | null;
  billingSubscriptionId?: string | null;
  billingStatus?: string | null;
}

export type Applied =
  | { applied: true; patch: PlanPatch }
  /** Named reasons, so a webhook that changes nothing is legible in a log
   *  rather than looking like a silent failure. */
  | { applied: false; reason: "stale" | "unknown-kind" };

export function applyBillingEvent(row: PlanRow | null, event: BillingEvent): Applied {
  const last = row?.planUpdatedAt ? new Date(row.planUpdatedAt) : null;
  // Strictly older loses. Equal timestamps are allowed through: a provider
  // that stamps two events in the same second is more likely to be sending
  // both than sending one twice, and re-applying is harmless — every
  // transition below is idempotent.
  if (last && !Number.isNaN(last.getTime()) && event.occurredAt.getTime() < last.getTime()) {
    return { applied: false, reason: "stale" };
  }

  const ids = {
    billingCustomerId: event.customerId ?? row?.billingCustomerId ?? null,
    billingSubscriptionId: event.subscriptionId ?? row?.billingSubscriptionId ?? null,
    billingStatus: event.status ?? null,
    planUpdatedAt: event.occurredAt,
  };

  switch (event.kind) {
    case "subscription.active":
      return { applied: true, patch: { ...ids, plan: "paid" } };
    case "subscription.past_due":
      // Rule 2: status recorded, plan untouched. Leaving `plan` out of the
      // patch is what makes that true rather than merely intended.
      return { applied: true, patch: ids };
    case "subscription.ended":
      return { applied: true, patch: { ...ids, plan: "free" } };
    default:
      return { applied: false, reason: "unknown-kind" };
  }
}
