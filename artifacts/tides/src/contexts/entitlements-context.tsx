/**
 * WHAT THIS ACCOUNT CAN DO — asked of the server, never decided here.
 *
 * The context this replaces held a localStorage boolean that defaulted to
 * UNLOCKED and that nothing server-side ever consulted. It was a preference
 * wearing an entitlement's clothes: anyone could flip it, and the routes it
 * was supposed to protect answered regardless.
 *
 * So this is a READ, not a rule. The line lives in one place —
 * api-server/src/lib/entitlements.ts — and both the client's doors and the
 * server's guards resolve it from that same function. Two copies of a
 * free/paid line drift, and the drift always favors whichever copy is
 * cheaper to change.
 *
 * WHAT IT NEVER DOES IS BLOCK. While the answer is in flight the app behaves
 * as though everything is available, because a page that renders paywalls
 * during a network round trip shows a wall to someone who has paid. The
 * server refuses anything genuinely gated with a 402 whatever the client
 * believes, which is what makes an optimistic client safe here.
 */

import React, { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTester } from "@/contexts/tester-context";

export type Feature =
  | "shape.day" | "shape.week" | "sessions.long" | "placement.calendar"
  | "horizon.week" | "history.patterns" | "elections.strict" | "ask.timing";

export type Plan = "beta" | "free" | "trial" | "paid";

export interface Entitlement {
  plan: Plan;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  features: Partial<Record<Feature, boolean>>;
}

interface Value {
  /** Null until the first answer arrives. */
  entitlement: Entitlement | null;
  can: (f: Feature) => boolean;
  /** True while the answer is unknown — for "…" rather than a price. */
  loading: boolean;
}

const Ctx = createContext<Value | null>(null);

export function EntitlementsProvider({ children }: { children: React.ReactNode }) {
  const testerId = useTester().profile?.testerId ?? null;
  const { data, isPending } = useQuery<Entitlement>({
    queryKey: ["entitlements", testerId],
    queryFn: async () => {
      const r = await fetch("/api/account/entitlements", {
        headers: testerId ? { "x-tester-id": testerId } : {},
      });
      if (!r.ok) throw new Error(`entitlements ${r.status}`);
      return r.json();
    },
    enabled: !!testerId,
    // Plans change rarely, and on the two events that DO change one — a trial
    // starting, a subscription landing — the mutation invalidates this key
    // directly rather than waiting out a stale time.
    staleTime: 5 * 60_000,
  });

  const value: Value = {
    entitlement: data ?? null,
    loading: !!testerId && isPending,
    // Unknown reads as ALLOWED. See the header: the server is the thing that
    // refuses, so the cost of guessing wrong here is a 402 the client handles,
    // while the cost of guessing the other way is showing a paywall to
    // somebody who is paying.
    can: (f) => (data ? data.features[f] !== false : true),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEntitlements(): Value {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useEntitlements must be used inside EntitlementsProvider");
  return ctx;
}
