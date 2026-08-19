/**
 * WHERE THE MOON IS IN ITS MONTH.
 *
 * This drew a sine wave labelled LOW · RISING · HIGH · EBB · LOW with a marker
 * on it, until the owner asked the question that ended it — "what is the
 * cycle?" There wasn't one: the wave came from Math.sin and the marker was a
 * five-way lookup off a categorical tide level, so it could only jump between
 * five fixed stops on a period nothing computed.
 *
 * The fix was not a disclaimer. A caption reading "not a graph of the day"
 * under a graph is an admission that the picture is lying and a request to be
 * forgiven for it, so the caption went and so did the invented curve. What
 * replaces it is a real position in a real period: elongation / 360, the
 * canonical definition of where the Moon is in its month, which is also the
 * only source that can tell waxing from waning — illumination alone cannot.
 *
 * IT LIVES ON CALENDAR NOW (2026-08-19), inherited from Today's hero as that
 * page retired. Its marks were white-on-gradient, built for the hero's dark
 * banner, and are the ordinary text tokens here. Calendar is the right home
 * regardless: this is a position in a period, on the page that owns time at
 * every other scale.
 */

import React from "react";

export default function LunarCycle({ now }: { now: any }) {
  if (!now?.moonCycle) return null;
  return (
    <div style={{
      background: "var(--color-card)", border: "1px solid var(--color-border)",
      borderRadius: 10, padding: "10px 16px 12px", margin: "0 10px 8px", flexShrink: 0,
    }}>
      {now?.moonCycle && (() => {
        const mc = now.moonCycle;
        const STOPS = [
          { at: 0,    label: "new" },
          { at: 0.25, label: "first ¼" },
          { at: 0.5,  label: "full" },
          { at: 0.75, label: "last ¼" },
          { at: 1,    label: "new" },
        ];
        return (
          <div style={{ marginTop: 20 }}
            title={`${mc.phase} — ${Math.round(mc.position * 100)}% through the lunar month (${mc.elongationDeg}° from the Sun)`}>
            <div style={{ position: "relative", height: 15 }}>
              {/* The track IS the cycle: one lunar month, left to right. */}
              <div style={{ position: "absolute", left: 0, right: 0, top: 6,
                height: 2, background: "rgba(255,255,255,0.22)", borderRadius: 1 }} />
              {/* Elapsed portion — how much of this month is behind you. */}
              <div style={{ position: "absolute", left: 0, top: 6, height: 2,
                width: `${mc.position * 100}%`, background: "var(--text-3)", borderRadius: 1 }} />
              {STOPS.slice(0, 4).map((st) => (
                <div key={st.at} style={{ position: "absolute", left: `${st.at * 100}%`, top: 3,
                  width: 1, height: 8, background: "var(--color-border)" }} />
              ))}
              <div style={{ position: "absolute", left: `${mc.position * 100}%`, top: 0,
                width: 14, height: 14, marginLeft: -7, borderRadius: "50%",
                background: "var(--color-primary)", boxShadow: "0 0 0 3px rgba(255,255,255,0.18)" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9,
              color: "var(--text-3)", marginTop: 5, letterSpacing: "0.6px" }}>
              {STOPS.map((st, i) => <span key={i}>{st.label}</span>)}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--color-muted)", marginTop: 7, letterSpacing: "0.2px" }}>
              {mc.phase} · {mc.waxing ? "waxing" : "waning"} — a stretch for {({
                initiate: "starting", build: "building", refine: "refining",
                release: "releasing", consolidate: "consolidating", recover: "recovering",
              } as Record<string, string>)[mc.approach] ?? mc.approach}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
