// The turning-point check-in — v1 of HANDOFF-NEW-MOON-CHECKIN-2026-08-12.md.
//
// The CYCLE constant below is the curation seam the brief asks for: the owner
// writes one block per lunation (with Claude, ahead of time) until an
// automated baseline exists. Storage is localStorage until the shape has
// survived contact with beta testers; nothing here has earned a schema yet.
//
// The prompt is an offer, and "Not now" is a snooze, not a refusal form:
// it quiets the banner for the rest of the day and the offer returns the
// next morning, until the window closes (owner 2026-08-12 — one mis-click
// must not cost a whole month's ritual). At most one appearance per day,
// nothing is recorded about skipping, and when the window closes unanswered
// Home simply keeps being Home.

import React, { useEffect, useState } from "react";
import { useNorthStars } from "@/hooks/useTides";
import { ELEMENT_COLORS } from "@/lib/elements";
import { localDateStr } from "@/lib/dates";

const ACCENT = ELEMENT_COLORS.fire; // Leo. Each cycle names its own accent.

// ── The cycle — owner-edited, one block per lunation ─────────────────────
const CYCLE = {
  key: "2026-08-12-leo-eclipse",
  opens: "2026-08-12",
  closes: "2026-08-16", // last day the prompt offers itself
  name: "New Moon in Leo · Solar Eclipse",
  read: [
    "Today's new moon is a solar eclipse in Leo, near the Moon's south node. A new moon opens a cycle. An eclipse turns the volume up. The south node points backward — this one favors letting go over launching.",
    "Keep the reset small: name what you're done carrying, check that your stars still point somewhere true, and call one shot for the month.",
  ],
  releaseLabel: "What are you done carrying?",
  releaseHint: "One line. It doesn't have to be graceful.",
  oneShotLabel: "One shot for this cycle",
  oneShotHint: "One thing, by the next new moon",
};

interface Saved {
  release: string;
  oneShot: string;
  stars: Record<string, "true" | "look">;
  savedAt: string;
  /** Local date the featured card stops showing (≈ next new moon). */
  until: string;
}

// Inside the `compass-` namespace so purgeLocalData() wipes them on account
// deletion (tests/regressions.test.ts derives every written key and checks).
const SAVE_KEY = `compass-nm-checkin-${CYCLE.key}`;
const DISMISS_KEY = `compass-nm-dismiss-${CYCLE.key}`;

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Saved;
    return s.until >= localDateStr() ? s : null;
  } catch { return null; }
}

const LABEL: React.CSSProperties = {
  fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.7px",
  color: "var(--text-3)", marginBottom: 6,
};
const INPUT: React.CSSProperties = {
  width: "100%", padding: "8px 11px", borderRadius: 8, fontSize: 13, outline: "none",
  border: "1px solid var(--color-border)", background: "var(--color-card-2)",
  color: "var(--color-foreground)",
};
const PILL: React.CSSProperties = {
  fontSize: 10, padding: "3px 10px", borderRadius: 999, cursor: "pointer",
  border: "1px solid var(--color-border)", background: "var(--color-card-2)",
  color: "var(--color-muted)",
};

// The occultation, drawn: the accent disc, and the card's own background
// passing over it. Inherits the banner's surface so it survives both themes.
function EclipseMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}>
      <circle cx="11" cy="13" r="8" fill={`${ACCENT}2a`} stroke={ACCENT} strokeWidth="1.3" />
      <circle cx="14.5" cy="9.5" r="7" fill="var(--color-card)" />
    </svg>
  );
}

export default function NewMoonCheckIn({ testerId, onNavigate, suppressPrompt }: {
  testerId: string | null;
  onNavigate?: (v: string) => void;
  /** True when a higher-priority banner (a live condition) holds Home's one
   *  banner slot this render — the offer waits; the kept card still shows. */
  suppressPrompt?: boolean;
}) {
  const { data: starsData } = useNorthStars(testerId);
  const stars = (Array.isArray(starsData) ? starsData : [])
    .filter((g: any) => g.status !== "done" && g.status !== "paused");

  const [saved, setSaved] = useState<Saved | null>(readSaved);
  // The stored value is the LOCAL DATE of the last "Not now" — dismissed
  // means "dismissed today", so the offer returns with the next morning.
  const [dismissedOn, setDismissedOn] = useState<string | null>(() => {
    try { return localStorage.getItem(DISMISS_KEY); } catch { return null; }
  });
  const [open, setOpen] = useState(false);
  const [release, setRelease] = useState("");
  const [oneShot, setOneShot] = useState("");
  const [starMarks, setStarMarks] = useState<Record<string, "true" | "look">>({});

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  const today = localDateStr();
  const inWindow = today >= CYCLE.opens && today <= CYCLE.closes;

  const beginFresh = () => { setRelease(""); setOneShot(""); setStarMarks({}); setOpen(true); };
  const beginEdit = () => {
    if (saved) { setRelease(saved.release); setOneShot(saved.oneShot); setStarMarks(saved.stars); }
    setOpen(true);
  };
  const dismiss = () => {
    const d = localDateStr();
    try { localStorage.setItem(DISMISS_KEY, d); } catch { /* private mode */ }
    setDismissedOn(d);
  };
  const keep = () => {
    const until = new Date();
    until.setDate(until.getDate() + 29); // ≈ one lunation; engine-derived later
    const s: Saved = {
      release: release.trim(), oneShot: oneShot.trim(), stars: starMarks,
      savedAt: new Date().toISOString(), until: localDateStr(until),
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* private mode */ }
    setSaved(s);
    setOpen(false);
  };
  const canKeep = release.trim().length > 0 || oneShot.trim().length > 0;
  const looks = saved ? Object.values(saved.stars).filter((v) => v === "look").length : 0;

  const overlay = open && (
    <div onClick={() => setOpen(false)} style={{
      position: "fixed", inset: 0, zIndex: 60, background: "rgba(20,16,12,0.45)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "6vh 16px 16px", overflowY: "auto",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 560, background: "var(--color-card)",
        border: "1px solid var(--color-border)", borderTop: `3px solid ${ACCENT}`,
        borderRadius: 14, padding: "22px 24px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
            <div style={{ paddingTop: 3 }}><EclipseMark size={30} /></div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--color-foreground)" }}>
                {CYCLE.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>About ten minutes. Yours to keep or skip.</div>
            </div>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close" style={{
            background: "none", border: "none", cursor: "pointer", fontSize: 16,
            color: "var(--text-3)", lineHeight: 1, padding: 2, flexShrink: 0,
          }}>✕</button>
        </div>

        {CYCLE.read.map((p, i) => (
          <p key={i} style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.6, margin: "10px 0 0" }}>{p}</p>
        ))}

        <div style={{ marginTop: 18 }}>
          <div style={LABEL}>{CYCLE.releaseLabel}</div>
          <input value={release} onChange={(e) => setRelease(e.target.value)}
            placeholder={CYCLE.releaseHint} style={INPUT} />
        </div>

        {stars.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={LABEL}>Your stars — still true?</div>
            {stars.map((g: any) => {
              const mark = starMarks[g.id];
              const col = ELEMENT_COLORS[g.element as keyof typeof ELEMENT_COLORS] ?? "#8a8278";
              return (
                <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: col, flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: "var(--color-foreground)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}</span>
                  <button onClick={() => setStarMarks((m) => ({ ...m, [g.id]: "true" }))} style={{
                    ...PILL,
                    ...(mark === "true" ? { border: "1px solid #4a7a52", color: "#4a7a52", background: "#4a7a5212" } : {}),
                  }}>still true</button>
                  <button onClick={() => setStarMarks((m) => ({ ...m, [g.id]: "look" }))} style={{
                    ...PILL,
                    ...(mark === "look" ? { border: `1px solid ${ACCENT}`, color: ACCENT, background: `${ACCENT}12` } : {}),
                  }}>needs a look</button>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <div style={LABEL}>{CYCLE.oneShotLabel}</div>
          <input value={oneShot} onChange={(e) => setOneShot(e.target.value)}
            placeholder={CYCLE.oneShotHint} style={INPUT} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
          <button onClick={keep} disabled={!canKeep} style={{
            fontSize: 12.5, fontWeight: 600, padding: "8px 18px", borderRadius: 8,
            border: "none", cursor: canKeep ? "pointer" : "default",
            background: canKeep ? "var(--color-primary)" : "var(--color-border)",
            color: "var(--color-card)",
          }}>Keep this</button>
          <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>
            {canKeep ? "Stays on your homepage until the next new moon." : "Write at least one line to keep it."}
          </span>
        </div>
      </div>
    </div>
  );

  // Saved and current → the featured card, in place of any prompt.
  if (saved) {
    const headline = saved.oneShot || saved.release;
    return (
      <>
        <div style={{
          background: "var(--color-card)", border: "1px solid var(--color-border)",
          borderLeft: `3px solid ${ACCENT}`, borderRadius: 12, padding: "12px 16px",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)" }}>
              This cycle · set at the Leo eclipse
            </span>
            <button onClick={beginEdit} style={{
              fontSize: 10.5, background: "none", border: "none", padding: 0,
              cursor: "pointer", color: "var(--color-primary)",
            }}>edit</button>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 19, lineHeight: 1.3, color: "var(--color-foreground)", marginTop: 5 }}>
            {headline}
          </div>
          {saved.oneShot && saved.release && (
            <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginTop: 3 }}>
              Setting down: {saved.release}
            </div>
          )}
          {looks > 0 && (
            <button onClick={onNavigate ? () => onNavigate("work") : undefined} style={{
              fontSize: 10.5, background: "none", border: "none", padding: 0, marginTop: 6,
              cursor: onNavigate ? "pointer" : "default", color: ACCENT,
            }}>{looks} star{looks === 1 ? "" : "s"} marked for a look →</button>
          )}
        </div>
        {overlay}
      </>
    );
  }

  if (!inWindow || dismissedOn === today || suppressPrompt) return <>{overlay}</>;

  return (
    <>
      <div style={{
        background: "var(--color-card)", border: "1px solid var(--color-border)",
        borderLeft: `3px solid ${ACCENT}`, borderRadius: 12, padding: "11px 16px",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 220 }}>
          <EclipseMark />
          <span style={{ fontSize: 12.5, color: "var(--color-foreground)" }}>
            Today is a new moon and a solar eclipse in Leo. Ten minutes to reset?
          </span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
          <button onClick={beginFresh} style={{
            fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8,
            border: "none", cursor: "pointer", background: "var(--color-primary)",
            color: "var(--color-card)",
          }}>Take ten minutes →</button>
          <button onClick={dismiss} style={{
            fontSize: 11, background: "none", border: "none", padding: 0,
            cursor: "pointer", color: "var(--text-3)",
          }}>Not now</button>
        </div>
      </div>
      {overlay}
    </>
  );
}
