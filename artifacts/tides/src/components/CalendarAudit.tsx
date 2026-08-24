/**
 * READING A WEEK YOU HAVE ALREADY COMMITTED TO.
 *
 * Everywhere else Compass searches for a window; this points the same
 * evaluator at events already on the calendar and says what the sky is doing
 * then. Three rules, agreed before any of it was built, and each one is the
 * difference between an audit and a horoscope with a calendar skin:
 *
 * IT ONLY SPEAKS WHEN ASKED. A panel you open, never a mark on every event.
 * Compass stopped suggesting things unprompted on 2026-08-19, and a week that
 * annotated itself would walk straight back into it.
 *
 * IT WILL NOT GUESS WHAT AN EVENT IS. "Dinner w/ Sam" is not a first date
 * until somebody says so. A match is a PROPOSAL you confirm, and the answer
 * is remembered server-side so the same standing meeting is never asked about
 * twice. "Not that kind of thing" is a recordable answer too — without it the
 * audit would ask about the Tuesday stand-up every week forever.
 *
 * IT IS WILLING TO SAY NOTHING. Most events, most weeks, have no strong
 * testimony either way; measured across forty weeks the engine called 21 of
 * them quiet. Those collapse to a single line rather than each receiving a
 * portentous note, because a note on everything is noise and noise is how the
 * whole thing loses its credibility.
 *
 * A fourth rule follows from the first three and lives here rather than on
 * the server: A VERDICT ON SOMETHING YOU CANNOT MOVE IS JUST ANXIETY. Events
 * you did not organise are read only when you ask about that one specifically
 * — telling someone their 9am stand-up is badly timed helps nobody.
 */

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GCalEvent } from "@/hooks/useTides";
import { useDialog } from "@/hooks/useDialog";

type Reading =
  | { id: string; state: "assessed"; activityKey: string; suitability: "clear" | "qualified" | "defer";
      supportLevel: string; backgroundFit: string; reasons: { kind: string; planet: string | null }[]; families: string[] }
  | { id: string; state: "quiet"; activityKey: string }
  | { id: string; state: "needs-kind"; proposal: { activityKey: string; label: string; score: number } | null }
  | { id: string; state: "not-timeable" }
  | { id: string; state: "unknown-activity"; activityKey: string }
  | { id: string; state: "unreadable"; reason: string };

/** The engine's reason kinds, said plainly. Never a forecast — each one names
 *  a measurable fact about a planet, which is what makes it checkable. */
const REASON_TEXT: Record<string, (p: string | null) => string> = {
  "primary-significator-stationing-retrograde": p => `${p} is turning retrograde, and this kind of thing runs on ${p}`,
  "primary-significator-stationing-direct": p => `${p} is turning direct, and still barely moving`,
  "primary-significator-retrograde": p => `${p} is retrograde, and this kind of thing runs on ${p}`,
  "significator-station": p => `${p} is stationary`,
  "mercury-retrograde": () => "Mercury is retrograde",
};

const VERDICT: Record<string, { label: string; color: string }> = {
  defer:     { label: "argues against it", color: "#a04040" },
  qualified: { label: "worth working around", color: "#b07020" },
  clear:     { label: "nothing against it", color: "#4a8060" },
};

export default function CalendarAudit({ testerId, events, onClose }: {
  testerId: string | null;
  events: GCalEvent[];
  onClose: () => void;
}) {
  const { ref, props } = useDialog(onClose, "Reading your week");
  const qc = useQueryClient();
  const [picking, setPicking] = useState<string | null>(null);

  // Only what is YOURS to move, unless you ask about one by name. An event
  // with another organiser is someone else's decision and a verdict on it is
  // just anxiety.
  const mine = events.filter(e => !e.organizer || e.organizer === "self" || e.organizer === "");
  const scope = mine.length ? mine : events;

  const { data, isPending } = useQuery<{ readings: Reading[] }>({
    queryKey: ["calendar-audit", testerId, scope.map(e => e.id).join(",")],
    queryFn: async () => {
      const r = await fetch("/api/calendar/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) },
        body: JSON.stringify({
          events: scope.slice(0, 40).map(e => ({ id: e.id, title: e.title, start: e.start, end: e.end })),
        }),
      });
      if (!r.ok) throw new Error(`audit ${r.status}`);
      return r.json();
    },
    enabled: !!testerId && scope.length > 0,
  });

  const { data: kinds } = useQuery<{ kinds: { key: string; label: string }[] }>({
    queryKey: ["audit-kinds"],
    queryFn: async () => (await fetch("/api/calendar/audit/kinds", {
      headers: testerId ? { "x-tester-id": testerId } : {},
    })).json(),
    enabled: !!testerId,
    staleTime: Infinity,
  });

  const setKind = useMutation({
    mutationFn: async ({ eventId, activityKey }: { eventId: string; activityKey: string | null }) => {
      await fetch("/api/calendar/audit/kind", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) },
        body: JSON.stringify({ eventId, activityKey }),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["calendar-audit"] }); setPicking(null); },
  });

  const byId = new Map(events.map(e => [e.id, e]));
  const readings = data?.readings ?? [];
  const notable = readings.filter(r => r.state === "assessed");
  const asking = readings.filter(r => r.state === "needs-kind");
  const quiet = readings.filter(r => r.state === "quiet" || r.state === "not-timeable");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,16,12,0.45)", zIndex: "var(--z-dialog)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div ref={ref} {...props} onClick={e => e.stopPropagation()} style={{
        background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 16,
        padding: "20px 22px", maxWidth: 560, width: "100%", maxHeight: "82vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-primary)" }}>Reading your week</span>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: 13 }}>✕</button>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.6, marginBottom: 14 }}>
          What the sky is doing during things already on your calendar.
        </div>

        {isPending && <div style={{ fontSize: 12, color: "var(--text-3)" }}>Reading…</div>}
        {!isPending && readings.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--text-3)" }}>Nothing on the calendar in this stretch.</div>
        )}

        {/* ── What it has something to say about. */}
        {notable.map(r => {
          const ev = byId.get(r.id);
          const a = r as Extract<Reading, { state: "assessed" }>;
          const v = VERDICT[a.suitability] ?? VERDICT.clear;
          return (
            <div key={r.id} style={{ borderTop: "1px solid var(--color-border)", padding: "10px 0" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1, minWidth: 0 }}>{ev?.title ?? r.id}</span>
                <span style={{ fontSize: 10.5, color: v.color, fontWeight: 600 }}>{v.label}</span>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 1 }}>
                {ev && new Date(ev.start).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}
              </div>
              {/* THE REASONS ARE THE ANSWER. A verdict without them is an
                  opinion, and an opinion about someone's evening is worth
                  less than nothing. */}
              {a.reasons.length > 0 && (
                <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.6 }}>
                  {a.reasons.map((x, i) => (
                    <li key={i}>{(REASON_TEXT[x.kind] ?? (() => x.kind))(x.planet)}</li>
                  ))}
                </ul>
              )}
              {a.reasons.length === 0 && a.families.length > 0 && (
                <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginTop: 4 }}>
                  Nothing argues against it.
                </div>
              )}
            </div>
          );
        })}

        {/* ── What it needs told. A question, never a guess. */}
        {asking.length > 0 && (
          <div style={{ borderTop: "1px solid var(--color-border)", marginTop: 10, paddingTop: 10 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)", marginBottom: 6 }}>
              Tell it what these are
            </div>
            <div style={{ fontSize: 11, color: "var(--color-muted)", lineHeight: 1.55, marginBottom: 8 }}>
              Timing depends on what a thing is, and Compass won't assume. You only answer once.
            </div>
            {asking.map(r => {
              const ev = byId.get(r.id);
              const p = (r as Extract<Reading, { state: "needs-kind" }>).proposal;
              return (
                <div key={r.id} style={{ padding: "6px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, flex: 1, minWidth: 140 }}>{ev?.title ?? r.id}</span>
                    {p && (
                      <button onClick={() => setKind.mutate({ eventId: r.id, activityKey: p.activityKey })}
                        style={{ fontSize: 10.5, padding: "3px 10px", borderRadius: 12, cursor: "pointer",
                                 border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-primary)" }}>
                        {p.label}?
                      </button>
                    )}
                    <button onClick={() => setPicking(picking === r.id ? null : r.id)}
                      style={{ fontSize: 10.5, background: "none", border: "none", cursor: "pointer", color: "var(--color-primary)" }}>
                      {p ? "something else" : "pick a kind"}
                    </button>
                    <button onClick={() => setKind.mutate({ eventId: r.id, activityKey: null })}
                      style={{ fontSize: 10.5, background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}>
                      not that kind of thing
                    </button>
                  </div>
                  {picking === r.id && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                      {(kinds?.kinds ?? []).map(k => (
                        <button key={k.key} onClick={() => setKind.mutate({ eventId: r.id, activityKey: k.key })}
                          style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, cursor: "pointer",
                                   border: "1px solid var(--color-border)", background: "var(--color-background)", color: "var(--text-2)" }}>
                          {k.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Everything with nothing to report, as ONE line. Counted rather
               than listed, because the whole discipline of this feature is
               that silence is a real answer and silence should look like it. */}
        {quiet.length > 0 && (
          <div style={{ borderTop: "1px solid var(--color-border)", marginTop: 10, paddingTop: 10, fontSize: 11.5, color: "var(--text-3)" }}>
            {quiet.length} other {quiet.length === 1 ? "event has" : "events have"} nothing notable about their timing.
          </div>
        )}
      </div>
    </div>
  );
}
