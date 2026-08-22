import React from "react";
import { PREMIUM_FEATURES, FREE_KEEPS } from "@/lib/premium";
import { useDialog } from "@/hooks/useDialog";

export function PremiumExploreModal({ onClose }: { onClose: () => void }) {
  const { ref, props } = useDialog(onClose, "Across the week");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,16,12,0.45)", zIndex: "var(--z-dialog)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div ref={ref} {...props} onClick={(e) => e.stopPropagation()} style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 16, padding: "28px 26px", maxWidth: 420, width: "100%" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-primary)", marginBottom: 4 }}>Across the week</div>
        <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.6, marginBottom: 18 }}>
          Everyone gets Compass's answer for right now; these are the parts that reach across days.
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
        {/* WHAT YOU KEEP, said out loud. A screen that lists only what you
            lack reads as a hostage note, and the free tier here is meant to
            be genuinely useful rather than a demo. */}
        <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.6, marginBottom: 14, borderTop: "1px solid var(--color-border)", paddingTop: 12 }}>
          <div style={{ fontWeight: 600, color: "var(--text-2)", marginBottom: 4 }}>Free keeps</div>
          {FREE_KEEPS.map((k, i) => <div key={i}>· {k}</div>)}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--text-3)", marginBottom: 16, lineHeight: 1.5 }}>
          Nothing costs anything yet; everyone is on the beta plan while billing is built.
        </div>
        <button onClick={onClose} style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: "#1a2a3a", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Got it
        </button>
      </div>
    </div>
  );
}

/* PremiumGate — the wrapper component — was removed 2026-08-19. Its one
   consumer was the natal chart on Planets, which the pricing decision
   un-gated: paid is orchestration, not personalization. The gate that
   matters now is server-side (api-server/src/middlewares/entitlement.ts),
   and the client reads it through useEntitlements(). A client-only wrapper
   would be a wall someone could walk around. */
