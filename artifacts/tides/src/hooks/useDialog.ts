import { useEffect, useRef } from "react";

/**
 * THE FOUR THINGS A DIALOG OWES A KEYBOARD.
 *
 * Every overlay in this app was hand-rolled from two divs — a fixed backdrop
 * that closes on click, and a panel that stops the click from reaching it.
 * That works with a mouse and with nothing else: seven of the eight could only
 * be dismissed by clicking the scrim, none announced themselves as a dialog,
 * and Tab walked straight out of the panel into the page behind it.
 *
 * This supplies the four behaviors a primitive library would have given us,
 * had one been in use:
 *
 *   1. Escape closes.
 *   2. Focus starts inside, on the first control (or the panel itself).
 *   3. Tab and Shift+Tab cycle within the panel instead of escaping it.
 *   4. Focus returns to whatever opened the dialog when it unmounts.
 *
 * Put the returned `ref` and `props` on the PANEL, not the backdrop — the
 * backdrop keeps its own click-to-close handler:
 *
 *   const { ref, props } = useDialog(onClose, "Find a good time");
 *   <div onClick={onClose} style={backdrop}>
 *     <div ref={ref} {...props} onClick={e => e.stopPropagation()} style={panel}>
 */

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const isVisible = (el: HTMLElement) =>
  !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

export function useDialog(onClose: () => void, label: string, enabled = true) {
  const ref = useRef<HTMLDivElement>(null);
  // Held in a ref rather than an effect dependency. Callers pass inline
  // arrows, so a dependency here would re-run the effect on every render and
  // yank focus back to the first control mid-typing.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    const panel = ref.current;
    const opener = document.activeElement as HTMLElement | null;

    const focusables = () =>
      [...(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(isVisible);

    (focusables()[0] ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Stopped here so a dialog opened from inside another surface closes
        // only itself rather than collapsing everything behind it too.
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = focusables();
      if (!items.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      // Only if the opener is still on the page — the control that opened this
      // may have been the thing the dialog just removed.
      if (opener && document.contains(opener)) opener.focus();
    };
    // `enabled` only — most dialogs are mounted conditionally by their parent,
    // but one (NewMoonCheckIn) holds its own open state and stays mounted, so
    // the trap has to arm and disarm rather than run once on mount.
  }, [enabled]);

  return {
    ref,
    props: {
      role: "dialog" as const,
      "aria-modal": true,
      "aria-label": label,
      tabIndex: -1,
    },
  };
}
