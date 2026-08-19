import { describe, it, expect } from "vitest";
import { applyBillingEvent } from "../artifacts/api-server/src/lib/billing/transitions";
import type { BillingEvent } from "../artifacts/api-server/src/lib/billing/port";
import { noBilling } from "../artifacts/api-server/src/lib/billing/none";

/**
 * WHAT A BILLING EVENT DOES TO A PLAN.
 *
 * No provider is chosen yet, and none of this depends on which one is. These
 * are the rules that are wrong in the obvious implementation: ordering,
 * idempotency, what a failed payment does, and what a cancellation must NOT
 * touch.
 */

const T0 = new Date("2026-08-19T12:00:00Z");
const at = (mins: number) => new Date(T0.getTime() + mins * 60_000);

const ev = (kind: BillingEvent["kind"], occurredAt: Date, extra: Partial<BillingEvent> = {}): BillingEvent => ({
  kind, testerId: "obs_x", occurredAt, ...extra,
});

describe("ordering, because webhooks arrive out of order and twice", () => {
  it("ignores an event older than the last one applied", () => {
    // The failure this prevents: a retried "ended" delivered after a newer
    // "active" cancels a live subscription, and the customer finds out first.
    const row = { plan: "paid", planUpdatedAt: at(10) };
    const out = applyBillingEvent(row, ev("subscription.ended", at(5)));
    expect(out).toEqual({ applied: false, reason: "stale" });
  });

  it("applies an event newer than the last one", () => {
    const row = { plan: "paid", planUpdatedAt: at(5) };
    const out = applyBillingEvent(row, ev("subscription.ended", at(10)));
    expect(out.applied).toBe(true);
  });

  it("lets an equal timestamp through, and is idempotent when it does", () => {
    const row = { plan: "free", planUpdatedAt: at(10) };
    const a = applyBillingEvent(row, ev("subscription.active", at(10)));
    expect(a.applied && a.patch.plan).toBe("paid");
    // Re-applying the same event lands on the same state.
    const b = applyBillingEvent({ plan: "paid", planUpdatedAt: at(10) }, ev("subscription.active", at(10)));
    expect(b.applied && b.patch.plan).toBe("paid");
  });

  it("applies anything to an account that has never had a billing event", () => {
    const out = applyBillingEvent({ plan: "beta" }, ev("subscription.active", at(0)));
    expect(out.applied && out.patch.plan).toBe("paid");
  });
});

describe("what each event means", () => {
  it("makes an active subscription paid", () => {
    const out = applyBillingEvent({ plan: "trial" }, ev("subscription.active", at(1), {
      customerId: "cus_1", subscriptionId: "sub_1", status: "active",
    }));
    expect(out.applied && out.patch).toMatchObject({
      plan: "paid", billingCustomerId: "cus_1", billingSubscriptionId: "sub_1", billingStatus: "active",
    });
  });

  it("KEEPS ACCESS while a payment is being retried", () => {
    // A failed charge is usually an expired card and the retry usually works.
    // Cutting someone off on the first failure punishes them for their bank's
    // timing. Leaving `plan` out of the patch is what makes that true.
    const out = applyBillingEvent({ plan: "paid", planUpdatedAt: at(0) },
      ev("subscription.past_due", at(1), { status: "past_due" }));
    expect(out.applied).toBe(true);
    expect(out.applied && out.patch.plan).toBeUndefined();
    expect(out.applied && out.patch.billingStatus).toBe("past_due");
  });

  it("lands an ended subscription on free, never back on beta", () => {
    // Beta was a gift given before billing existed. Someone who subscribed and
    // stopped belongs on free — which is a useful product here, not a lockout.
    for (const was of ["paid", "beta", "trial"]) {
      const out = applyBillingEvent({ plan: was }, ev("subscription.ended", at(1)));
      expect(out.applied && out.patch.plan, `from ${was}`).toBe("free");
    }
  });

  it("refuses a kind it does not know rather than guessing", () => {
    const out = applyBillingEvent({ plan: "paid" }, ev("subscription.exploded" as any, at(1)));
    expect(out).toEqual({ applied: false, reason: "unknown-kind" });
  });
});

describe("what a downgrade must NOT do", () => {
  it("writes only plan and billing fields — never anything the person made", () => {
    // The mechanic the pricing decision says must not slip: committed windows
    // survive the end of a subscription. It holds because this function has no
    // way to break it, and this test is what keeps that true.
    const out = applyBillingEvent({ plan: "paid" }, ev("subscription.ended", at(1)));
    expect(out.applied).toBe(true);
    const keys = Object.keys(out.applied ? out.patch : {}).sort();
    expect(keys).toEqual([
      "billingCustomerId", "billingStatus", "billingSubscriptionId", "plan", "planUpdatedAt",
    ]);
  });

  it("keeps the provider's ids when an event omits them", () => {
    // Reconciling the two systems is the thing that matters when they
    // disagree, so an event that does not restate an id must not erase it.
    const out = applyBillingEvent(
      { plan: "paid", billingCustomerId: "cus_1", billingSubscriptionId: "sub_1" },
      ev("subscription.ended", at(1)));
    expect(out.applied && out.patch.billingCustomerId).toBe("cus_1");
    expect(out.applied && out.patch.billingSubscriptionId).toBe("sub_1");
  });
});

describe("the unconfigured adapter, which is the current default", () => {
  it("sells nothing and admits it", async () => {
    expect(noBilling.configured).toBe(false);
    expect(await noBilling.createCheckout({ testerId: "obs_x" })).toBe(null);
    expect(await noBilling.price()).toBe(null);
  });

  it("REJECTS every webhook, because it cannot verify one", async () => {
    // An endpoint that trusted an unverified body would let anyone set any
    // account to paid by posting JSON at it.
    expect(await noBilling.parseWebhook('{"kind":"subscription.active"}', {})).toBe(null);
  });
});
