import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { TOUR_STEPS, TOUR_VERSION, saveTourRecord } from "@/lib/tour";
import { logEvent } from "@/lib/analytics";
import { prefersReducedMotion } from "@/lib/reducedMotion";

/**
 * Coach marks over the real interface — dim the page, cut a spotlight around
 * one live element, say one or two lines, move on. Replaces the "New here?"
 * reading strip: show-don't-tell (beta pass 2026-08-01).
 *
 * Behaviour contract (GPT audit §7, adopted):
 *   · portal render; spotlight hole cut with a giant box-shadow
 *   · re-measures on resize and scroll, and after scrolling the target into view
 *   · desktop: card beside the hole; narrow screens: bottom sheet, target visible
 *   · Back / Next / Skip / Escape; reduced-motion respected
 *   · a MISSING anchor advances safely instead of breaking the tour —
 *     first-run pages vary (no windows yet, ritual card time-gated), and a
 *     tour that crashes on the empty state would break for exactly the
 *     people it exists for
 */
export default function SpotlightTour({ testerId, onDone, onFinalCta }: {
  testerId: string | null;
  onDone: () => void;
  /** The last step's CTA — "Set my first Guiding Star" → navigate to Stars. */
  onFinalCta?: () => void;
}) {
  const [step, setStep] = useState(0);
  // Viewport-space box, NOT a raw DOMRect. The app shell is scaled with CSS
  // `zoom` (textScale's --app-zoom), and this portal lives on the UNZOOMED
  // body — while getBoundingClientRect on zoomed content reports layout
  // pixels. Every coordinate was off by exactly the zoom factor (1.2 by
  // default — found only by painting the spotlight lime and looking). The
  // factor is MEASURED per tick as (offsetWidth × zoom) / rect.width, so a
  // future browser that starts reporting visual pixels gets factor 1 and
  // keeps working.
  interface Box { top: number; left: number; width: number; height: number; bottom: number; right: number }
  const [rect, setRect] = useState<Box | null>(null);
  const startedRef = useRef(false);
  const reduceMotion = typeof window !== "undefined"
    && prefersReducedMotion();

  const s = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    logEvent("tour_started", { version: TOUR_VERSION });
  }, []);

  const finish = useCallback((kind: "completed" | "skipped") => {
    saveTourRecord(testerId, kind === "completed"
      ? { completedAt: new Date().toISOString(), lastStep: step }
      : { skippedAt: new Date().toISOString(), lastStep: step });
    logEvent(kind === "completed" ? "tour_completed" : "tour_skipped", { step });
    onDone();
  }, [testerId, step, onDone]);

  // Find + measure the current anchor. Missing → advance (or finish), never throw.
  useEffect(() => {
    let alive = true;
    const el = document.querySelector<HTMLElement>(`[data-tour="${s.anchor}"]`);
    if (!el) {
      if (isLast) finish("completed");
      else setStep((n) => n + 1);
      return;
    }
    logEvent("tour_step_viewed", { step, anchor: s.anchor });
    // Instant, not smooth: a smooth scroll is an ANIMATION, and the settle
    // re-scrolls plus the browser's own focus scrolling race it — verified
    // live, the page ended up 384px past the hero. Instant scroll is
    // deterministic: scroll, measure, done.
    el.scrollIntoView({ block: "center" });
    // Keep the target centered until the USER scrolls, then never again.
    // A fixed settling timer was tried first and lost twice: async cards keep
    // mounting above the target for longer than any timer you'd dare pick,
    // and the moment the timer lapsed the next mount shoved the target
    // offscreen with the spotlight framing empty space. "Has the user touched
    // the page yet" is the only signal that doesn't need tuning.
    let userMoved = false;
    const markMoved = () => { userMoved = true; };
    window.addEventListener("wheel", markMoved, { passive: true });
    window.addEventListener("touchstart", markMoved, { passive: true });
    const measure = () => {
      if (!alive) return;
      const raw = el.getBoundingClientRect();
      // The app is scaled with `zoom` ON <html> (textScale). Two consequences,
      // and they compound: getBoundingClientRect returns VISUAL pixels, while
      // a style like `left: 268px` on our portal gets re-zoomed at paint time
      // — so styling from raw gBCR values lands everything at 1.2× its
      // intended spot. Convert gBCR to LAYOUT pixels by dividing by the
      // measured visual/layout ratio (raw.width / offsetWidth), which stays
      // correct even if a browser reverts to layout-px gBCR (ratio 1). The
      // viewport in layout px is documentElement.clientWidth/Height — NOT
      // window.innerWidth/Height, which are visual.
      const r: Box = {
        top: raw.top, left: raw.left,
        width: raw.width, height: raw.height,
        bottom: raw.bottom, right: raw.right,
      };
      const vh = window.innerHeight;
      // "Mostly visible", not "any pixel visible": the hero sat 72% above the
      // fold with its bottom strip showing, and a bottom<60 test called that
      // on-screen while the spotlight framed a sliver (verified live).
      const visiblePx = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      const off = visiblePx < Math.min(r.height, vh * 0.8) * 0.7;
      if (!userMoved && off && r.height > 0) {
        el.scrollIntoView({ block: "center" });
        return; // measure on the next tick, post-scroll
      }
      // Only re-render when the box actually moved — the interval below would
      // otherwise re-render every 350ms for nothing.
      setRect((prev) =>
        prev && Math.abs(prev.top - r.top) < 1 && Math.abs(prev.left - r.left) < 1
          && Math.abs(prev.width - r.width) < 1 && Math.abs(prev.height - r.height) < 1
          ? prev : r);
    };
    // After the scroll settles; then track further movement. The interval is
    // the safety net the event listeners can't be: fonts and images settle,
    // cards collapse, inner containers scroll — verified live, the hero's
    // rect drifted ~100px after the one-shot measure and the spotlight framed
    // empty space. 350ms of getBoundingClientRect is invisible; a spotlight
    // on the wrong element is not.
    const t = setTimeout(measure, reduceMotion ? 50 : 380);
    const iv = setInterval(measure, 350);
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      alive = false;
      clearTimeout(t);
      clearInterval(iv);
      window.removeEventListener("wheel", markMoved);
      window.removeEventListener("touchstart", markMoved);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Escape skips — the universal "get this off my screen".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish("skipped"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  if (!rect) return null;

  const pad = 8;
  const vw = window.innerWidth;
  const narrow = vw < 640;
  const cardW = narrow ? vw - 24 : 320;
  // Below the hole when there's room, else above when THERE is room — and
  // when neither fits (the hero is taller than the viewport leaves), center
  // over the target instead. The old two-way branch shoved the card off the
  // top of the screen for tall targets, leaving only its drop shadow visible
  // as a smudge across the spotlight (verified live).
  const CARD_H = 200;
  const vh = window.innerHeight;
  const top = rect.bottom + pad + 6 + CARD_H < vh
    ? rect.bottom + pad + 6
    : rect.top - pad - 6 - CARD_H > 12
      ? rect.top - pad - 6 - CARD_H
      : Math.max(12, (vh - CARD_H) / 2);
  const cardStyle: React.CSSProperties = narrow
    ? {
        position: "fixed", left: 12, right: 12, width: "auto",
        // Clear of the home indicator. index.html already sets
        // viewport-fit=cover, so env() resolves to a real inset here.
        bottom: "calc(12px + env(safe-area-inset-bottom))",
      }
    : {
        position: "fixed",
        left: Math.max(12, Math.min(rect.left, vw - cardW - 12)),
        top,
        width: cardW,
      };

  // The app is scaled with `zoom` on <html> (textScale's --app-zoom), and how
  // a browser paints fixed-position children under a zoomed root turned out to
  // be unpredictable enough to burn a debugging session. So the dialog root
  // carries zoom = 1/appZoom: nested zooms multiply, the net is exactly 1, and
  // every coordinate in here is a TRUE visual pixel — matching what
  // getBoundingClientRect returns, on any browser, at any text scale.
  const appZoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
  return createPortal(
    <div role="dialog" aria-label={`Walkthrough — ${s.title}`} style={{ position: "fixed", inset: 0, zIndex: "var(--z-tour)", zoom: 1 / appZoom }}>
      {/* The dim: four plain panels around the hole. The obvious one-liner —
          a transparent div with a 9999px box-shadow — painted phantom bright
          strips on this GPU (huge shadow spreads tile unreliably), which cost
          three debugging rounds to distinguish from coordinate bugs. Four
          rectangles cannot render wrong. */}
      {(() => {
        const x1 = rect.left - pad, y1 = rect.top - pad;
        const x2 = rect.right + pad, y2 = rect.bottom + pad;
        const dim = "rgba(10, 16, 24, 0.62)";
        const tr = reduceMotion ? "none" : "all 0.28s ease";
        const base: React.CSSProperties = { position: "fixed", background: dim, transition: tr, pointerEvents: "none" };
        return (
          <>
            <div style={{ ...base, left: 0, top: 0, right: 0, height: Math.max(0, y1) }} />
            <div style={{ ...base, left: 0, top: y1, width: Math.max(0, x1), height: Math.max(0, y2 - y1) }} />
            <div style={{ ...base, left: x2, top: y1, right: 0, height: Math.max(0, y2 - y1) }} />
            <div style={{ ...base, left: 0, top: y2, right: 0, bottom: 0 }} />
            {/* A hairline ring so the hole reads as deliberate */}
            <div style={{ position: "fixed", left: x1, top: y1, width: x2 - x1, height: y2 - y1, borderRadius: 14, border: "1.5px solid rgba(255,255,255,0.35)", transition: tr, pointerEvents: "none" }} />
          </>
        );
      })()}
      <div style={{
        ...cardStyle, zIndex: "calc(var(--z-tour) + 1)",
        background: "var(--color-card)", border: "1px solid var(--color-border)",
        borderRadius: 14, padding: "14px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
      }}>
        <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 3 }}>{step + 1} of {TOUR_STEPS.length}</div>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--color-primary)", marginBottom: 5 }}>{s.title}</div>
        <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6, marginBottom: 12 }}>{s.body}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => finish("skipped")}
            style={{ fontSize: 11, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", padding: "6px 2px" }}>
            Skip
          </button>
          <div style={{ flex: 1 }} />
          {step > 0 && (
            <button onClick={() => setStep((n) => n - 1)}
              style={{ fontSize: 12, padding: "7px 14px", borderRadius: 9, cursor: "pointer", border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--text-2)" }}>
              Back
            </button>
          )}
          {/* No autofocus: focusing scrolls the focused element into view,
              which fights the spotlight's own positioning. */}
          <button
            onClick={() => {
              if (!isLast) { setStep((n) => n + 1); return; }
              finish("completed");
              if (s.cta) onFinalCta?.();
            }}
            style={{ fontSize: 12, fontWeight: 600, padding: "7px 16px", borderRadius: 9, cursor: "pointer", border: "none", background: "#1a2a3a", color: "#ffffff" }}>
            {isLast ? (s.cta ?? "Done") : "Next"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
