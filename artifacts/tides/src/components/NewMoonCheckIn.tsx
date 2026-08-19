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
import { useQueryClient } from "@tanstack/react-query";
import { useNorthStars } from "@/hooks/useTides";
import { ELEMENT_COLORS } from "@/lib/elements";
import { localDateStr } from "@/lib/dates";
import { checkInSaveKey, CHECKIN_CYCLE_KEY } from "@/lib/checkInState";
import { useMomentum } from "@/components/Momentum";

const ACCENT = ELEMENT_COLORS.fire; // Leo. Each cycle names its own accent.

// ── The cycle — owner-edited, one block per lunation ─────────────────────
/**
 * How many days the offer stands after the new moon, the first day included.
 * The ledger's own cycle card on Today uses three; this one is the longer
 * ritual and "Not now" only snoozes until tomorrow, so it gets five.
 */
const WINDOW_DAYS = 5;

const CYCLE = {
  // Single-sourced so the save key and this block can never name different
  // cycles — the failure would be silent, and would look like lost data.
  key: CHECKIN_CYCLE_KEY,
  /**
   * WHICH LUNATION THIS CURATED BLOCK IS FOR.
   *
   * The window itself is no longer written here. `opens` and `closes` were two
   * hand-typed dates per cycle, and they drifted: this said the cycle opened
   * on 2026-08-12, which was right, while the server's own boundary said the
   * 13th, which was wrong — and the two disagreeing is what let an intention
   * be written under one cycle and read back under another (fixed server-side
   * 2026-08-15, lib/lunarCycle.ts). Two sources for one date will always find
   * a way to disagree; now the sky supplies it and this names only the cycle
   * the writing below belongs to.
   *
   * It still has to be named, because everything under it is written by hand
   * for one particular lunation. When the computed cycle moves past this date
   * and nobody has written the next block, the offer stands down rather than
   * showing August's eclipse read against September's new moon.
   */
  forCycleStart: "2026-08-12",
  name: "New Moon in Leo · Solar Eclipse",
  // The read went through the AstroLyrica voice pass 2026-08-12: "turns the
  // volume up" coded intensity/threat where the true axis is visibility, and
  // "the south node points backward" was jargon half-translated. Both fixed.
  read: [
    "Today's new moon is also a solar eclipse in Leo, which means the cycle it opens comes with the lights turned up — you'll notice more of this one than you usually would. It leans backward too, toward what you've already lived rather than toward what's next, and that lean runs in both directions at once: some of what's behind you is weight you can finally set down, and some of it is yours and worth carrying forward again.",
    "So keep the reset small. Name what you're done carrying, check your stars still point somewhere true, and call one shot for the cycle.",
  ],
  releaseLabel: "What are you done carrying?",
  releaseHint: "One line, and it doesn't have to be graceful",
  reclaimLabel: "Anything worth picking back up?",
  reclaimHint: "Something of yours you set aside — skip it if nothing comes to mind",
  oneShotLabel: "One shot for this cycle",
  oneShotHint: "One thing to aim at by the next new moon",
  // What's coming, so the cycle has a shape rather than a single date. Dates
  // from the app's own ephemeris (tools/turning-points-scan.ts); the owner
  // curates them per cycle with the rest of this block.
  ahead: [
    { when: "Aug 28", what: "A lunar eclipse on the full moon in Pisces, where this cycle comes to its harvest" },
    { when: "Sep 11", what: "New moon in Virgo, closing this cycle and opening the next" },
  ],
};

/**
 * THE RITUAL SURVIVES AN UNWRITTEN MONTH (HOME study 2026-08-15, M3).
 *
 * Standing down when the curated block lags the sky was honest, and it had a
 * cost the therapist persona named: someone who builds a monthly practice on
 * this ritual gets silently dropped the first cycle nobody writes. The three
 * questions are the ritual; the curated read is its seasoning. So a cycle
 * with no block of its own runs on this generic one — same questions, plain
 * read, no invented specifics (no sign, no eclipse, no "ahead" dates it has
 * no way to know) — and the curated block, when it exists, takes precedence.
 */
const GENERIC_CYCLE = {
  name: "New Moon check-in",
  read: [
    "A new moon is the month's natural reset: a moment to name what you're done carrying, check that your stars still point somewhere true, and call one shot for the cycle ahead.",
  ],
  releaseLabel: CYCLE.releaseLabel,
  releaseHint: CYCLE.releaseHint,
  reclaimLabel: CYCLE.reclaimLabel,
  reclaimHint: CYCLE.reclaimHint,
  oneShotLabel: CYCLE.oneShotLabel,
  oneShotHint: CYCLE.oneShotHint,
  ahead: [] as { when: string; what: string }[],
};

/** The active cycle's identity and content, given the computed start. */
function cycleFor(cycleStart: string | undefined) {
  const curated = !!cycleStart && cycleStart === CYCLE.forCycleStart;
  return {
    curated,
    key: curated ? CYCLE.key : `nm-${cycleStart ?? "unknown"}`,
    content: curated ? CYCLE : GENERIC_CYCLE,
  };
}

interface Saved {
  release: string;
  /** The south node's other face — something of yours worth reclaiming. */
  reclaim?: string;
  oneShot: string;
  stars: Record<string, "true" | "look">;
  savedAt: string;
  /** Last edit, when the aim has been adjusted mid-cycle. */
  revisedAt?: string;
  /** Local date the featured card stops showing (≈ next new moon). */
  until: string;
}

// Inside the `compass-` namespace so purgeLocalData() wipes them on account
// deletion. Derived per cycle rather than one constant, because the check-in
// now runs on any computed lunation; lib/checkInState owns the save-key shape
// so the Guiding Stars page reads the same answers without knowing the cycle.
const saveKeyOf = (cycleKey: string) => checkInSaveKey(cycleKey);
const dismissKeyOf = (cycleKey: string) => `compass-nm-dismiss-${cycleKey}`;
const dismissCountKeyOf = (cycleKey: string) => `compass-nm-dismiss-count-${cycleKey}`;

/** How many times this cycle's offer has been waved away. */
function dismissCount(cycleKey: string): number {
  try { return parseInt(localStorage.getItem(dismissCountKeyOf(cycleKey)) ?? "0", 10) || 0; } catch { return 0; }
}

/** `cycleStart` plus n days, as a local date string. */
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * Whether the turning-point offer is currently claiming Home's banner slot.
 *
 * Exported so the banner queue has ONE authority for this question rather
 * than a second copy of the window/dismissal/saved logic living in Home. A
 * turning point outranks a rare-moment notice: eclipses and new moons are
 * rarer than exceptional days, and two banners stacked is the failure this
 * queue exists to prevent.
 *
 * Takes the computed `cycleStart` rather than reading a constant, so the
 * window and the ledger's cycle can no longer disagree. Undefined means the
 * sky has not loaded yet, and an offer is not made on a guess.
 */
export function turningPointPromptOpen(cycleStart: string | undefined): boolean {
  if (!cycleStart) return false;
  const today = localDateStr();
  if (today < cycleStart || today > addDays(cycleStart, WINDOW_DAYS - 1)) return false;
  const { key } = cycleFor(cycleStart);
  if (readSaved(key)) return false;                    // already answered
  // Two wave-aways demote the offer to a quiet one-line link (see the render),
  // which no longer claims the banner slot — the rare-moment notice may have it.
  if (dismissCount(key) >= 2) return false;
  try { return localStorage.getItem(dismissKeyOf(key)) !== today; } catch { return true; }
}

function readSaved(cycleKey: string): Saved | null {
  try {
    const raw = localStorage.getItem(saveKeyOf(cycleKey));
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
// `plain` is the generic cycle's mark — an ordinary new moon is not an
// eclipse, and the drawing must not claim one the sky didn't provide.
function EclipseMark({ size = 24, plain = false }: { size?: number; plain?: boolean }) {
  if (plain) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}>
        <circle cx="12" cy="12" r="8" fill={`${ACCENT}2a`} stroke={ACCENT} strokeWidth="1.3" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}>
      <circle cx="11" cy="13" r="8" fill={`${ACCENT}2a`} stroke={ACCENT} strokeWidth="1.3" />
      <circle cx="14.5" cy="9.5" r="7" fill="var(--color-card)" />
    </svg>
  );
}

export default function NewMoonCheckIn({ testerId, onNavigate, cycleStart, nextCycleStart, lat, lon, suppressPrompt }: {
  testerId: string | null;
  onNavigate?: (v: string) => void;
  /** The current lunation's local start date, from `/tides/now`. */
  cycleStart?: string;
  /** When this cycle ends — what a cycle-scoped answer should expire on. */
  nextCycleStart?: string;
  /** For the ledger read that closes last cycle's loop inside the sheet. */
  lat?: number;
  lon?: number;
  /** True when something RARER holds the notice slot. Nothing currently
   *  outranks a turning point, so Home leaves this unset; it stays for the
   *  day something does (`turningPointPromptOpen` is the same question from
   *  the other side). The kept card shows regardless — it is content. */
  suppressPrompt?: boolean;
}) {
  const qc = useQueryClient();
  const { data: starsData } = useNorthStars(testerId);
  const stars = (Array.isArray(starsData) ? starsData : [])
    .filter((g: any) => g.status !== "done" && g.status !== "paused");

  // Which cycle this render is about — the curated block when the sky matches
  // it, the generic ritual otherwise. Everything below keys off this.
  const cycle = cycleFor(cycleStart);
  const C = cycle.content;

  const [saved, setSaved] = useState<Saved | null>(() => readSaved(cycle.key));
  // The kept one-pager, opened by hand from the one-line form.
  const [expanded, setExpanded] = useState(false);
  // The stored value is the LOCAL DATE of the last "Not now" — dismissed
  // means "dismissed today", so the offer returns with the next morning.
  const [dismissedOn, setDismissedOn] = useState<string | null>(() => {
    try { return localStorage.getItem(dismissKeyOf(cycle.key)); } catch { return null; }
  });
  const [dismissals, setDismissals] = useState<number>(() => dismissCount(cycle.key));
  const [open, setOpen] = useState(false);
  // The ledger, fetched only while the sheet is open: it exists to answer the
  // promise the old cycle-review card made — "the wake will answer at the next
  // New Moon". That card retired to end the two-surfaces-one-ritual split
  // (HOME study W1), so the answer now arrives HERE, in the same sitting that
  // opens the next cycle, which is where a closed loop actually closes.
  const { data: momentum } = useMomentum(testerId, lat, lon, open);
  const [release, setRelease] = useState("");
  const [reclaim, setReclaim] = useState("");
  const [oneShot, setOneShot] = useState("");
  const [starMarks, setStarMarks] = useState<Record<string, "true" | "look">>({});
  /** Editing an existing entry rather than writing a fresh one — the aim is
   *  meant to move as the cycle does, so the page says so when you return. */
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  // The sky loads after first render, and the cycle key changes with it —
  // re-read this cycle's saved answers and dismissals when it does, or the
  // state initialised against "nm-unknown" sticks for the session.
  useEffect(() => {
    setSaved(readSaved(cycle.key));
    try { setDismissedOn(localStorage.getItem(dismissKeyOf(cycle.key))); } catch { /* private mode */ }
    setDismissals(dismissCount(cycle.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle.key]);

  const today = localDateStr();
  // The sky's boundary, not a typed one. A cycle the curated block doesn't
  // cover no longer stands the ritual down — it runs generic (M3); the
  // curated read only ever appears against the lunation it was written for.
  const inWindow = !!cycleStart
    && today >= cycleStart && today <= addDays(cycleStart, WINDOW_DAYS - 1);

  const beginFresh = () => {
    setRelease(""); setReclaim(""); setOneShot(""); setStarMarks({});
    setEditing(false); setOpen(true);
  };
  const beginEdit = () => {
    if (saved) {
      setRelease(saved.release); setReclaim(saved.reclaim ?? "");
      setOneShot(saved.oneShot); setStarMarks(saved.stars);
    }
    setEditing(true); setOpen(true);
  };
  const dismiss = () => {
    const d = localDateStr();
    const n = dismissals + 1;
    try {
      localStorage.setItem(dismissKeyOf(cycle.key), d);
      localStorage.setItem(dismissCountKeyOf(cycle.key), String(n));
    } catch { /* private mode */ }
    setDismissedOn(d);
    setDismissals(n);
  };
  const keep = () => {
    // EXPIRES ON THE NEXT NEW MOON, not 29 days from whenever you happened to
    // write it. A flat 29 is close enough to a synodic month to look right and
    // drifts against the real cycle every time — a card kept on the fifth day
    // of the window outlived the following new moon by four days, so the
    // "kept" one-pager for a finished cycle was still on Home while the next
    // cycle's offer was trying to appear.
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 29);
    const s: Saved = {
      release: release.trim(), reclaim: reclaim.trim(), oneShot: oneShot.trim(),
      stars: starMarks,
      // The original savedAt survives an edit — when you first sat down with
      // the cycle is a different fact from when you last moved the aim.
      savedAt: editing && saved ? saved.savedAt : new Date().toISOString(),
      ...(editing ? { revisedAt: new Date().toISOString() } : {}),
      until: editing && saved ? saved.until : (nextCycleStart ?? localDateStr(fallback)),
    };
    try { localStorage.setItem(saveKeyOf(cycle.key), JSON.stringify(s)); } catch { /* private mode */ }
    setSaved(s);
    setOpen(false);

    // ONE INTENTION PER CYCLE, NOT TWO.
    //
    // The ledger (Momentum) keeps cycle intentions server-side and asks for
    // one whenever none is set. Left alone, someone who had just written a
    // one shot here was asked for an intention again on Today — the same
    // question, from a surface that could not see this answer (owner,
    // 2026-08-13). The one shot IS the cycle's intention, so it is written
    // to the canonical store as well.
    //
    // Fire-and-forget: the check-in is kept locally the moment it is saved,
    // and a failed sync must never cost someone the reset they just wrote.
    const oneShotText = oneShot.trim();
    if (oneShotText && testerId && !editing) {
      void fetch("/api/planning/intentions", {
        method: "POST",
        headers: { "x-tester-id": testerId, "Content-Type": "application/json" },
        body: JSON.stringify({ text: oneShotText, tz: new Date().getTimezoneOffset() }),
      }).then(() => qc.invalidateQueries({ queryKey: ["momentum"] })).catch(() => { /* kept locally regardless */ });
    }
  };
  const canKeep = release.trim().length > 0 || reclaim.trim().length > 0 || oneShot.trim().length > 0;
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
            <div style={{ paddingTop: 3 }}><EclipseMark size={30} plain={!cycle.curated} /></div>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--color-foreground)" }}>
                {C.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                {editing ? "Change whatever needs changing." : "About ten minutes, and yours to keep or skip."}
              </div>
            </div>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close" style={{
            background: "none", border: "none", cursor: "pointer", fontSize: 16,
            color: "var(--text-3)", lineHeight: 1, padding: 2, flexShrink: 0,
          }}>✕</button>
        </div>

        {/* The read is for the first sitting. Coming back to move the aim,
            you want the form, not the sermon — so it steps aside on edit. */}
        {!editing && C.read.map((p, i) => (
          <p key={i} style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.6, margin: "10px 0 0" }}>{p}</p>
        ))}

        {/* LAST CYCLE'S LOOP, CLOSED FIRST. The wake answering the intention
            you set a month ago is the reason to trust the one you're about to
            write. Only on a fresh sitting — returning to adjust an aim, you
            already know how the cycle went. Absent when the ledger has nothing
            to say: a first cycle has no loop to close, and inventing one would
            be a scoreboard for a game nobody had started. */}
        {!editing && momentum && ((momentum.prevIntentions ?? []).length > 0 || momentum.winsPrevCycle > 0) && (
          <div style={{
            marginTop: 14, padding: "10px 13px", borderRadius: 8,
            background: "var(--color-card-2)", border: "1px solid var(--color-border)",
          }}>
            <div style={LABEL}>Last cycle, answered</div>
            {(momentum.prevIntentions ?? []).map((i: any, k: number) => (
              <div key={k} style={{ fontSize: 12, color: "var(--color-foreground)", fontStyle: "italic", lineHeight: 1.5 }}>
                you set out to: "{i.text}"
              </div>
            ))}
            <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginTop: 3 }}>
              {momentum.winsPrevCycle} win{momentum.winsPrevCycle === 1 ? "" : "s"} in the wake.
            </div>
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <div style={LABEL}>{C.releaseLabel}</div>
          <input value={release} onChange={(e) => setRelease(e.target.value)}
            placeholder={C.releaseHint} style={INPUT} />
        </div>

        {/* The south node's other face. Optional on purpose — a prompt that
            demands an answer would manufacture one. */}
        <div style={{ marginTop: 16 }}>
          <div style={LABEL}>{C.reclaimLabel}</div>
          <input value={reclaim} onChange={(e) => setReclaim(e.target.value)}
            placeholder={C.reclaimHint} style={INPUT} />
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
          <div style={LABEL}>{C.oneShotLabel}</div>
          <input value={oneShot} onChange={(e) => setOneShot(e.target.value)}
            placeholder={C.oneShotHint} style={INPUT} />
        </div>

        {/* The cycle gets a shape: what's coming, and when this one closes.
            A preview, not a plan — no action attached to either line. */}
        {C.ahead.length > 0 && (
          <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid var(--color-border)" }}>
            <div style={LABEL}>The cycle ahead</div>
            {C.ahead.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "3px 0", alignItems: "baseline" }}>
                <span style={{ fontSize: 11, color: ACCENT, flexShrink: 0, minWidth: 44, fontVariantNumeric: "tabular-nums" }}>{a.when}</span>
                <span style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.5 }}>{a.what}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
          <button onClick={keep} disabled={!canKeep} style={{
            fontSize: 12.5, fontWeight: 600, padding: "8px 18px", borderRadius: 8,
            border: "none", cursor: canKeep ? "pointer" : "default",
            background: canKeep ? "var(--color-primary)" : "var(--color-border)",
            color: "var(--color-card)",
          }}>{editing ? "Save changes" : "Keep this"}</button>
          <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>
            {!canKeep ? "Write at least one line to keep it"
              : editing ? "You can come back and change it whenever you need to"
              : "This stays on your homepage until the next new moon"}
          </span>
        </div>
      </div>
    </div>
  );

  // Saved and current → ONE LINE, not a card (design 2026-08-19).
  //
  // What you wrote at the last new moon is a souvenir: true, worth keeping,
  // and worth re-reading — but it held the top of Home for up to a month
  // after it stopped being news, above the progress report that actually
  // changes daily. It reads as context now, with the full one-pager a tap
  // away. `expanded` restores the card for anyone who wants to sit with it.
  if (saved && !expanded) {
    const headline = saved.oneShot || saved.release;
    return (
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", padding: "0 4px" }}>
        <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>
          {cycle.curated ? "This cycle · set at the Leo eclipse" : "This cycle · set at the new moon"}
        </span>
        <span style={{ fontSize: 11.5, color: "var(--color-muted)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          you named <span style={{ color: "var(--text-2)" }}>{headline}</span>
        </span>
        <button onClick={() => setExpanded(true)} style={{
          fontSize: 10.5, background: "none", border: "none", padding: 0,
          cursor: "pointer", color: "var(--color-primary)", flexShrink: 0,
        }}>read it →</button>
      </div>
    );
  }

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
              {cycle.curated ? "This cycle · set at the Leo eclipse" : "This cycle · set at the new moon"}
            </span>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={beginEdit} style={{
                fontSize: 10.5, background: "none", border: "none", padding: 0,
                cursor: "pointer", color: "var(--color-primary)",
              }}>adjust</button>
              <button onClick={() => setExpanded(false)} style={{
                fontSize: 10.5, background: "none", border: "none", padding: 0,
                cursor: "pointer", color: "var(--text-3)",
              }}>close</button>
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 19, lineHeight: 1.3, color: "var(--color-foreground)", marginTop: 5 }}>
            {headline}
          </div>
          {saved.oneShot && saved.release && (
            <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginTop: 3 }}>
              Setting down: {saved.release}
            </div>
          )}
          {saved.reclaim && (
            <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginTop: 2 }}>
              Picking back up: {saved.reclaim}
            </div>
          )}
          {looks > 0 && (
            <button onClick={onNavigate ? () => onNavigate("work") : undefined} style={{
              fontSize: 10.5, background: "none", border: "none", padding: 0, marginTop: 6,
              cursor: onNavigate ? "pointer" : "default", color: ACCENT,
            }}>{looks} star{looks === 1 ? "" : "s"} marked for a look →</button>
          )}
          {/* The next turning point, so the kept card knows where it's headed
              and the cycle reads as a span rather than a note on a fridge. */}
          {C.ahead.length > 0 && (
            <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 7, paddingTop: 7, borderTop: "1px solid var(--color-border)" }}>
              Next: {C.ahead[0].when} · {C.ahead[0].what}
              {saved.revisedAt && <span> · adjusted {new Date(saved.revisedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
            </div>
          )}
        </div>
        {overlay}
      </>
    );
  }

  if (!inWindow || dismissedOn === today || suppressPrompt) return <>{overlay}</>;

  // TWO WAVE-AWAYS DEMOTE THE OFFER (HOME study M2). The snooze returns each
  // morning by design — one mis-click must not cost the month's ritual — but
  // by the third morning the full banner has become a nag, and a nag trains
  // the dismissing thumb for every banner the app will ever show. The offer
  // stays for the window's remainder as one quiet line; it no longer claims
  // the notice slot (turningPointPromptOpen agrees).
  if (dismissals >= 2) {
    const closes = new Date(addDays(cycleStart!, WINDOW_DAYS - 1) + "T12:00:00")
      .toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return (
      <>
        <button onClick={beginFresh} style={{
          fontSize: 11, background: "none", border: "none", padding: "2px 0",
          cursor: "pointer", color: "var(--color-primary)", textAlign: "left",
        }}>
          The new-moon check-in stays open until {closes}
        </button>
        {overlay}
      </>
    );
  }

  return (
    <>
      <div style={{
        background: "var(--color-card)", border: "1px solid var(--color-border)",
        borderLeft: `3px solid ${ACCENT}`, borderRadius: 12, padding: "11px 16px",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 220 }}>
          <EclipseMark plain={!cycle.curated} />
          {/* DAY-AWARE, because the window is five days long and this line was
              written for one of them. "Today is a new moon" was shown verbatim
              on days 1–4 — a false sentence from the app whose whole moat is
              refusing to say false things, hardcoded in JSX below the curated
              block it belonged in (HOME study 2026-08-15, A3). Day 0 keeps the
              present tense it earned; the rest of the window points back at
              the day the cycle actually opened. */}
          <span style={{ fontSize: 12.5, color: "var(--color-foreground)" }}>
            {cycle.curated
              ? (today === cycleStart
                ? "Today is a new moon and a solar eclipse in Leo. Ten minutes to reset?"
                : "This cycle opened with a new moon and solar eclipse in Leo. Ten minutes to reset?")
              : (today === cycleStart
                ? "Today is a new moon. Ten minutes to reset?"
                : "This cycle opened with a new moon. Ten minutes to reset?")}
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
