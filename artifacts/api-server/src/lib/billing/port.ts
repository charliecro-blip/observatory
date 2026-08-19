/**
 * THE BILLING PORT — what any provider must be able to do, and nothing about
 * which one it is.
 *
 * The owner has not chosen between a merchant-of-record (Paddle, Lemon
 * Squeezy — they become the legal seller and handle VAT worldwide) and a raw
 * processor (Stripe — cheaper, and the tax registration is yours). That
 * choice has tax and legal consequences and is not a choice a file should
 * make by being named after one of them, which is why nothing here and
 * nothing in the schema says "stripe".
 *
 * Picking one later means writing ONE adapter against this interface. What is
 * already built and tested — the plan transitions, the ordering and
 * idempotency guards, the downgrade that preserves committed work — is the
 * part that has nothing to do with the provider and everything to do with
 * being correct.
 */

export type BillingEventKind =
  /** A subscription is live and paid. */
  | "subscription.active"
  /** Payment failed and the provider is retrying. Access is KEPT — see
   *  transitions.ts for why yanking it on the first failed retry is wrong. */
  | "subscription.past_due"
  /** Over, whether cancelled, refunded, or finally failed. */
  | "subscription.ended";

/**
 * A provider event, normalized. Every provider sends a different shape; the
 * adapter's whole job is to produce this or return null.
 */
export interface BillingEvent {
  kind: BillingEventKind;
  /** The account this is about, resolved by the adapter from its own ids. */
  testerId: string;
  /** The provider's ids, stored so the two systems can be reconciled when
   *  they disagree — which is the failure that actually matters in billing. */
  customerId?: string | null;
  subscriptionId?: string | null;
  /** The provider's own status string, kept verbatim. */
  status?: string | null;
  /**
   * WHEN THE EVENT HAPPENED at the provider, not when it reached us.
   *
   * Webhooks arrive out of order and more than once. Without this a retried
   * "ended" delivered after a newer "active" would cancel a live
   * subscription, and the customer would be the one to notice.
   */
  occurredAt: Date;
}

export interface CheckoutRequest {
  testerId: string;
  /** Where to send the person back to, once they are done. */
  returnUrl?: string;
}

export interface BillingAdapter {
  /** A name for logs and for the "not configured" message. */
  readonly name: string;
  /** False when no keys are present. Nothing pretends to work without them. */
  readonly configured: boolean;
  /** A hosted checkout URL, or null when the adapter cannot make one. */
  createCheckout(req: CheckoutRequest): Promise<{ url: string } | null>;
  /**
   * Verify the signature and normalize, or return null.
   *
   * Returning null must mean REJECT. An unverified webhook can set anyone's
   * plan to anything, so an adapter that cannot check a signature has to say
   * so rather than trusting the body.
   */
  parseWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): Promise<BillingEvent | null>;
  /** What it costs, if the provider will say. Null renders no number rather
   *  than a guess — a wrong price is worse than no price. */
  price(): Promise<{ amount: number; currency: string; interval: "month" | "year" } | null>;
}
