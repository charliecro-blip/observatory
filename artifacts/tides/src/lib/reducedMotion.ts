/**
 * "Does this person want less movement?"
 *
 * `index.css` neutralises CSS transitions and animations under
 * `prefers-reduced-motion: reduce`, which covers everything the stylesheet can
 * reach. It cannot reach `scrollIntoView({ behavior: "smooth" })` — the option
 * passed in JavaScript wins over the `scroll-behavior` property — so the three
 * places that scroll the page ask here instead.
 *
 * Read at call time rather than cached, so someone who changes the setting
 * mid-session gets the new answer without a reload.
 */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** `behavior` for a scroll call: "auto" when movement is unwelcome. */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}
