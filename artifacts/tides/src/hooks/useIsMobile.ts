import { useEffect, useState } from "react";

const QUERY = "(max-width: 768px)";
const FORCE_KEY = "obs_force_mobile";

// Mobile-preview override: a desktop user can flip the whole app into the
// phone layout (App renders a 390px frame + this hook reports mobile). The
// app is mobile-first in spirit; this makes that reviewable from a desk.
export function getForceMobile(): boolean {
  try { return localStorage.getItem(FORCE_KEY) === "1"; } catch { return false; }
}
export function setForceMobile(v: boolean): void {
  try { localStorage.setItem(FORCE_KEY, v ? "1" : "0"); } catch { /* no-op */ }
  window.dispatchEvent(new Event("obs-force-mobile"));
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches);
  const [forced, setForced] = useState(getForceMobile);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    const onForce = () => setForced(getForceMobile());
    mq.addEventListener("change", onChange);
    window.addEventListener("obs-force-mobile", onForce);
    return () => { mq.removeEventListener("change", onChange); window.removeEventListener("obs-force-mobile", onForce); };
  }, []);
  return isMobile || forced;
}
