/**
 * A GEAR CHANGE, offered — and open to negotiation.
 *
 * The sky says one working style is lit for a stretch. The person can say
 * yes, ask what this is, ADJUST it (a different rhythm, a shorter span)
 * before agreeing, or put it away. An invitation you can only accept or
 * refuse is an instruction with manners (owner 2026-08-21: "give options
 * for more info and for people to suggest/adapt the invitation before
 * agreeing"). Yes sets a dated override on the rhythm preference; Home
 * leads that way until the date and says so.
 *
 * Sky vocabulary end to end, so the quiet lens hides it outright.
 */
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RHYTHMS, type Rhythm } from "@/lib/preferences";
import { logEvent } from "@/lib/analytics";

interface Gear { rhythm: Rhythm; literal: string; reading: string; until: string; detail?: string[] }

const fmt = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const addDays = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/** What Home does under each rhythm — the part of "more info" the server can't know. */
const WHAT_CHANGES: Record<Rhythm, string> = {
  tide: "Home opens on the day's conditions, then what fits them.",
  campaign: "Home opens on one move with an hour for it; the backlog folds to three lines; the week and the reading fold away.",
  route: "Home opens on your routines with their counts, and Shape Day keeps each task's usual slot over an hour the sky read better.",
  field: "Home opens on two or three ways in, and moving one costs nothing.",
};

export default function GearChange({ testerId, current, base, onAccept }: {
  testerId: string | null;
  /** The rhythm in force now (override included). */
  current: Rhythm;
  /** The person's own base rhythm. */
  base: Rhythm;
  onAccept: (rhythm: Rhythm, until: string, reason: string) => void;
}) {
  const { data } = useQuery<{ available: boolean; gear: Gear | null }>({
    queryKey: ["gear", testerId],
    queryFn: async () => {
      const r = await fetch("/api/account/gear", { headers: testerId ? { "x-tester-id": testerId } : {} });
      if (!r.ok) return { available: false, gear: null };
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 6 * 3600 * 1000,
  });
  const gear = data?.gear ?? null;
  const dismissKey = `compass-gear-dismissed-${testerId}`;
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try { return localStorage.getItem(dismissKey); } catch { return null; }
  });
  const [open, setOpen] = useState<"info" | "adjust" | null>(null);
  // The adjusted invitation, seeded from the offer once it arrives.
  const [pick, setPick] = useState<Rhythm | null>(null);
  const [untilPick, setUntilPick] = useState<string | null>(null);

  if (!gear || gear.rhythm === current || dismissed === gear.literal) return null;

  const chosen = pick ?? gear.rhythm;
  const until = untilPick ?? gear.until;
  const label = (r: Rhythm) => RHYTHMS.find(x => x.key === r)?.label ?? r;
  const adapted = chosen !== gear.rhythm || until !== gear.until;

  const accept = () => {
    logEvent("gear_accepted", { proposed: gear.rhythm, chosen, proposedUntil: gear.until, until, adapted });
    onAccept(chosen, until, `${gear.literal}${adapted ? " · adjusted" : ""}`);
  };
  const dismiss = () => {
    logEvent("gear_dismissed", { proposed: gear.rhythm });
    setDismissed(gear.literal);
    try { localStorage.setItem(dismissKey, gear.literal); } catch { /* private mode */ }
  };

  const spans: { label: string; until: string }[] = [
    { label: `through ${fmt(gear.until)}`, until: gear.until },
    { label: "a week", until: addDays(7) },
    { label: "three days", until: addDays(3) },
  ].filter((o, i, a) => a.findIndex(x => x.until === o.until) === i);

  const small: React.CSSProperties = {
    fontSize: 11.5, padding: "6px 13px", borderRadius: 8, cursor: "pointer",
    border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-muted)",
  };

  return (
    <div style={{
      padding: "10px 16px",
      background: "var(--color-card)", border: "1px solid var(--color-border)", borderLeft: "3px solid #6f6a90", borderRadius: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220, fontSize: 12, lineHeight: 1.55 }}>
          <div style={{ color: "var(--color-foreground)" }}>{gear.literal}</div>
          <div style={{ color: "var(--color-muted)" }}>
            Read as: {gear.reading}. Lead with <b style={{ color: "var(--color-foreground)" }}>{label(chosen)}</b> through {fmt(until)}?
            {adapted && <span style={{ color: "var(--text-3)" }}> (your version)</span>}
            {base !== current && <span style={{ color: "var(--text-3)" }}> You'd come back to your own rhythm after.</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={accept} style={{
            fontSize: 11.5, fontWeight: 600, padding: "6px 13px", borderRadius: 8, cursor: "pointer",
            border: "none", background: "var(--color-primary)", color: "#fff",
          }}>Yes, through {fmt(until)}</button>
          <button onClick={() => setOpen(open === "adjust" ? null : "adjust")} aria-expanded={open === "adjust"} style={{ ...small, color: open === "adjust" ? "var(--color-primary)" : small.color }}>Adjust</button>
          <button onClick={() => setOpen(open === "info" ? null : "info")} aria-expanded={open === "info"} style={{ ...small, color: open === "info" ? "var(--color-primary)" : small.color }}>What's this?</button>
          <button onClick={dismiss} style={small}>Not now</button>
        </div>
      </div>

      {open === "info" && (
        <div style={{ marginTop: 9, paddingTop: 9, borderTop: "1px dashed var(--color-border)", fontSize: 11.5, lineHeight: 1.6, color: "var(--text-2)" }}>
          {(gear.detail ?? []).map((line, i) => <div key={i} style={{ marginBottom: 3 }}>{line}</div>)}
          <div style={{ marginTop: 5, color: "var(--color-muted)" }}>
            If you say yes: {WHAT_CHANGES[chosen]} Your own rhythm is untouched and comes back on {fmt(until)}, or whenever you end it.
          </div>
        </div>
      )}

      {open === "adjust" && (
        <div style={{ marginTop: 9, paddingTop: 9, borderTop: "1px dashed var(--color-border)", fontSize: 11.5, lineHeight: 1.6, color: "var(--text-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: "var(--text-3)", marginRight: 2 }}>lead with</span>
            {RHYTHMS.map(r => (
              <button key={r.key} title={r.blurb} onClick={() => setPick(r.key)} style={{
                fontSize: 10.5, padding: "3px 9px", borderRadius: 11, cursor: "pointer",
                border: `1px solid ${chosen === r.key ? "var(--color-primary)" : "var(--color-border)"}`,
                background: chosen === r.key ? "var(--color-primary)" : "var(--color-background)",
                color: chosen === r.key ? "#fff" : "var(--color-muted)",
              }}>{r.label}{r.key === gear.rhythm ? " ·" : ""}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "var(--text-3)", marginRight: 2 }}>for</span>
            {spans.map(o => (
              <button key={o.until} onClick={() => setUntilPick(o.until)} style={{
                fontSize: 10.5, padding: "3px 9px", borderRadius: 11, cursor: "pointer",
                border: `1px solid ${until === o.until ? "var(--color-primary)" : "var(--color-border)"}`,
                background: until === o.until ? "var(--color-primary)" : "var(--color-background)",
                color: until === o.until ? "#fff" : "var(--color-muted)",
              }}>{o.label}</button>
            ))}
            <input type="date" value={until} min={addDays(1)} onChange={e => e.target.value && setUntilPick(e.target.value)}
              aria-label="Until a date of your choosing"
              style={{ fontSize: 10.5, padding: "2px 6px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-foreground)" }} />
          </div>
          <div style={{ marginTop: 6, color: "var(--color-muted)" }}>
            {WHAT_CHANGES[chosen]}{chosen !== gear.rhythm ? ` The sky's own offer was ${label(gear.rhythm)}; yours is what gets kept.` : ""}
          </div>
        </div>
      )}
    </div>
  );
}
