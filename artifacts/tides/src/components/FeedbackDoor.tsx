/**
 * TELL US WHAT HAPPENED — the beta's one reachable complaint.
 *
 * It replaces a mailto: near the bottom of Settings, which asked a tester to
 * leave the app and reconstruct from memory something that confused them a
 * minute ago. This costs one tap from anywhere, and it sends the two things
 * an email never carries: which surface they were looking at, and how the app
 * was configured while they looked at it.
 *
 * FIVE DOORS, NO FORM. Enough to sort by, few enough to read at a glance. The
 * note is optional on purpose — "confusing" on the Plan page with a viewport
 * of 390x844 is already an actionable report, and demanding prose is how a
 * feedback control gets used twice and then never again.
 *
 * DIALOG CONTRACT, in full: labelled, modal, Escape closes, Tab is trapped
 * inside, and focus returns to the control that opened it. SpotlightTour has
 * the first two; this is the first place in the app with all four, and it is
 * meant to be the thing the next dialog copies.
 */
import { useEffect, useRef, useState } from "react";
import { usePreferences } from "@/contexts/preferences-context";
import { logEvent } from "@/lib/analytics";

const KINDS = [
  { key: "confusing",  label: "Confusing" },
  { key: "wrong",      label: "Wrong" },
  { key: "broken",     label: "Broken" },
  { key: "delightful", label: "Delightful" },
  { key: "idea",       label: "An idea" },
] as const;
type Kind = (typeof KINDS)[number]["key"];

export default function FeedbackDoor({ testerId, view, surface, recommendationId, onClose }: {
  testerId: string | null;
  view: string;
  surface?: string;
  recommendationId?: string;
  onClose: () => void;
}) {
  const { prefs } = usePreferences();
  const [kind, setKind] = useState<Kind | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"editing" | "sending" | "sent" | "failed">("editing");

  const panelRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);
  // The control that opened this, so it can be handed focus back on close —
  // otherwise a keyboard user is returned to the top of the document and has
  // to walk the whole topbar again to get where they were.
  const openerRef = useRef<Element | null>(typeof document !== "undefined" ? document.activeElement : null);

  useEffect(() => {
    firstRef.current?.focus();
    const opener = openerRef.current as HTMLElement | null;
    return () => { if (opener && typeof opener.focus === "function") opener.focus(); };
  }, []);

  // Escape closes, and Tab cycles within the panel rather than escaping to the
  // page behind it — a modal you can Tab out of is a modal in appearance only.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea, [href], input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send() {
    if (!kind) return;
    setState("sending");
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) },
        body: JSON.stringify({
          kind, note,
          context: {
            view, surface, recommendationId,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            rhythm: prefs.display.rhythmOverride?.rhythm ?? prefs.display.rhythm,
            astroDetail: prefs.display.astroDetail,
          },
        }),
      });
      if (!r.ok) throw new Error(String(r.status));
      logEvent("feedback_sent", { kind, view });
      setState("sent");
      setTimeout(onClose, 1200);
    } catch {
      setState("failed");
    }
  }

  const CHIP = (on: boolean) => ({
    fontSize: 11.5, padding: "5px 11px", borderRadius: 999, cursor: "pointer",
    border: `1px solid ${on ? "var(--color-foreground)" : "var(--color-border)"}`,
    background: on ? "var(--color-foreground)" : "transparent",
    color: on ? "var(--color-card)" : "var(--text-2)",
    fontWeight: on ? 600 : 400,
  });

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: "var(--z-modal, 900)", background: "rgba(0,0,0,0.28)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Send feedback"
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(420px, 100%)", background: "var(--color-card)",
          border: "1px solid var(--color-border)", borderRadius: 12, padding: 18,
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        }}
      >
        {state === "sent" ? (
          <div style={{ fontSize: 12.5, color: "var(--color-foreground)" }}>
            Thanks — that's saved, along with where you were when you sent it.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-foreground)", marginBottom: 3 }}>
              Tell us what happened
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 12, lineHeight: 1.5 }}>
              Pick the closest one. The page you're on and your settings come along, so you don't have to describe them.
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {KINDS.map((k, i) => (
                <button
                  key={k.key}
                  ref={i === 0 ? firstRef : undefined}
                  onClick={() => setKind(k.key)}
                  aria-pressed={kind === k.key}
                  style={CHIP(kind === k.key)}
                >{k.label}</button>
              ))}
            </div>

            <textarea
              value={note}
              onChange={e => setNote(e.target.value.slice(0, 1000))}
              placeholder="Anything you want to add — optional"
              rows={3}
              style={{
                width: "100%", boxSizing: "border-box", resize: "vertical",
                fontSize: 12.5, lineHeight: 1.5, padding: "8px 10px", borderRadius: 8,
                border: "1px solid var(--color-border)", background: "var(--color-card-2)",
                color: "var(--color-foreground)", fontFamily: "inherit", marginBottom: 12,
              }}
            />

            {state === "failed" && (
              <div role="status" style={{ fontSize: 11.5, color: "var(--color-quality-challenge)", marginBottom: 8 }}>
                That didn't send. It's still here if you try again.
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
              <button onClick={onClose} style={{
                fontSize: 11.5, padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                border: "none", background: "transparent", color: "var(--text-3)",
              }}>Cancel</button>
              <button
                onClick={send}
                disabled={!kind || state === "sending"}
                style={{
                  fontSize: 11.5, padding: "6px 14px", borderRadius: 8,
                  cursor: kind && state !== "sending" ? "pointer" : "default",
                  border: "1px solid var(--color-foreground)",
                  background: kind ? "var(--color-foreground)" : "transparent",
                  color: kind ? "var(--color-card)" : "var(--text-3)",
                  opacity: kind ? 1 : 0.55, fontWeight: 600,
                }}
              >{state === "sending" ? "Sending…" : "Send"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
