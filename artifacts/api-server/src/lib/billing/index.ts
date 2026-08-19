/**
 * Which adapter is in play. Resolved from the environment so that choosing a
 * provider is a deploy-time decision and an unconfigured server is a working
 * server — just one that cannot sell anything.
 */

import type { BillingAdapter } from "./port.js";
import { noBilling } from "./none.js";

export * from "./port.js";
export * from "./transitions.js";

let adapter: BillingAdapter = noBilling;

/** Swap the adapter in — called once at boot when a provider is configured,
 *  and by tests. */
export function useBillingAdapter(a: BillingAdapter): void { adapter = a; }
export function billing(): BillingAdapter { return adapter; }
