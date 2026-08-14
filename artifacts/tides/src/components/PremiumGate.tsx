import React, { useState } from "react";
import { usePremium } from "@/contexts/premium-context";
import { PREMIUM_FEATURES, type PremiumFeature } from "@/lib/premium";

export function PremiumExploreModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,16,12,0.45)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 16, padding: "28px 26px", maxWidth: 420, width: "100%" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-primary)", marginBottom: 4 }}>Deeper currents</div>
        <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.6, marginBottom: 18 }}>
          Beyond the daily tide, there's a longer view of your chart — currently in preview while the premium tier is built out.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {PREMIUM_FEATURES.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "var(--color-card-2)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "10px 12px" }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{f.icon}</span>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-primary)" }}>{f.title}</div>
                <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2, lineHeight: 1.5 }}>{f.teaser}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--text-3)", marginBottom: 16, lineHeight: 1.5 }}>
          Premium unlocking isn't live yet — this preview shows what's coming.
        </div>
        <button onClick={onClose} style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: "#1a2a3a", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Got it
        </button>
      </div>
    </div>
  );
}

/** Wraps premium content: renders children when unlocked, a locked teaser card
 *  (with an "explore" CTA) otherwise. See premium-context.tsx for the unlock
 *  check itself — there's no real entitlement system yet. */
export function PremiumGate({ feature, children }: { feature: PremiumFeature; children: React.ReactNode }) {
  const { unlocked } = usePremium();
  const [showModal, setShowModal] = useState(false);
  const metas = PREMIUM_FEATURES.filter((f) => f.key === feature);

  if (unlocked) return <>{children}</>;

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ maxWidth: 400, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>{metas[0]?.icon ?? "✦"}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-primary)", marginBottom: 8 }}>
          {metas.map((m) => m.title).join(" & ")} — premium
        </div>
        <div style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.6, marginBottom: 18 }}>
          {metas.map((m) => m.teaser).join(" ")}
        </div>
        <button onClick={() => setShowModal(true)} style={{ fontSize: 12, padding: "8px 18px", borderRadius: 9, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-primary)", cursor: "pointer", fontWeight: 600 }}>
          ✦ Explore premium
        </button>
      </div>
      {showModal && <PremiumExploreModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
