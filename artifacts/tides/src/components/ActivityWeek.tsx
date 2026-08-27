/**
 * THE WEEK, FOR ONE THING.
 *
 * Owner, 2026-08-20: "views where people could look at different opportune
 * moments for different activities. Like — how does working out, love, deep
 * study look for the week ahead? When, how strong."
 *
 * Pick an activity and the next seven days redraw as the windows that suit
 * it. It is the almanac question asked the way people actually ask it — not
 * "what is Thursday like" but "when should I train" — and it needed no new
 * engine: /elections/times has answered exactly this for one activity over a
 * span since the picker shipped. What was missing was seeing the whole week
 * at once instead of a list.
 *
 * IT IS ALLOWED TO COME BACK EMPTY, and says so plainly. A week with no
 * strong window for hard training is a real answer, and manufacturing three
 * mediocre ones to fill the grid is how an almanac turns into a horoscope.
 *
 * THE STRENGTH IS THE TIER, NOT A NUMBER. The engine scores internally, but a
 * score printed next to a window invites arithmetic nobody can check — the
 * same reason the day's charge is a band rather than a percentage. Three
 * tiers, each with its own weight on the page.
 *
 * SEVEN ROWS, NOT SEVEN COLUMNS (2026-08-25). It drew each window as its start
 * clock and dropped the end, so a five-hour Friday and a sixty-seven-minute
 * one were the same small chip: "I think we might see time frames for these
 * activities, not just single moments. it's a function that needs more space."
 * The spans were always in the payload — a sixty-pixel column simply had
 * nowhere to put them, and no room for a bar whose length meant anything.
 * A row per day gives each one a real 24-hour track, so length is duration and
 * position is time of day. Layout arithmetic lives in lib/activityWeek.
 */

import React, { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { layoutLanes, spanLabel, durationLabel } from "@/lib/activityWeek";
import { usePreferences } from "@/contexts/preferences-context";

interface Win {
  date: string; dow: string;
  startAt: string; endAt: string;
  startClock: string; endClock: string;
  /** A whole-day condition (the Moon's sign favors this), not a timed window.
   *  Rendered by its start time it read "7 AM" — the hour the engine's day
   *  begins — so a day-long affinity looked like a dawn appointment
   *  (found in the Plan workshop, 2026-08-21). */
  allDay?: boolean;
  tier: string; score: number; why?: string;
}

const TIER: Record<string, { label: string; fill: string; ink: string }> = {
  great: { label: "strong", fill: "#4a8060", ink: "#ffffff" },
  good:  { label: "good",   fill: "#4a806033", ink: "var(--color-foreground)" },
  fair:  { label: "fair",   fill: "var(--color-card-2)", ink: "var(--color-muted)" },
};

/**
 * The fallback shortlist, for someone who has not said what they want timed.
 *
 * It is ten of fifty, chosen by us, and it leans hard toward work: intake
 * asked how you want to be met and what you are holding, never what you
 * wanted windows found for, so this stood in for an answer nobody had been
 * asked to give (owner, 2026-08-27). It is now only the default. Anything
 * chosen at intake replaces it, and the full fifty stay behind "all" either
 * way, because a wall of chips is not a menu.
 */
const FEATURED = [
  "train-hard", "deep-work", "deep-study", "first-date", "deepen-bond",
  "hard-conversation", "negotiate", "publish", "deep-rest", "meditate",
];

/** The drawn part of the clock. */
const TRACK_START = 5 * 60, TRACK_END = 23 * 60;
/** Day label column and the gap to the track. */
const LABEL_W = 52, ROW_GAP = 8;

/** A minute of the day as a percentage across the track, clamped to it. */
function pctOf(min: number): number {
  const p = ((min - TRACK_START) / (TRACK_END - TRACK_START)) * 100;
  return Math.max(0, Math.min(100, p));
}

export default function ActivityWeek({ testerId, lat, lon, locationKnown = true }: {
  testerId: string | null; lat: number; lon: number; locationKnown?: boolean;
}) {
  const { prefs } = usePreferences();
  const [activity, setActivity] = useState("train-hard");
  // The real drawn width of a day track. A bar decides whether its span will
  // fit inside it, and the first version of that check assumed a 360px track
  // — true on the desktop Almanac and false on a phone, where "7–11:44 AM"
  // was printed into 57px and clipped. Measured rather than assumed.
  const [trackW, setTrackW] = useState(0);
  const roRef = useRef<ResizeObserver | null>(null);
  // A callback ref, not useEffect on a plain ref. The grid renders only after
  // the query resolves, so an effect with [] runs while the node is still null
  // and the observer never attaches — trackW stays 0 and every bar decides its
  // label does not fit. This attaches when the node actually appears.
  const gridRef = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setTrackW(Math.max(0, e.contentRect.width - LABEL_W - ROW_GAP)));
    ro.observe(el);
    roRef.current = ro;
  }, []);
  const [showAll, setShowAll] = useState(false);
  // The reason lived in a title attribute, which is nothing at all on a phone.
  const [why, setWhy] = useState<string | null>(null);
  const tz = new Date().getTimezoneOffset();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { data: acts } = useQuery<{ activities: { key: string; label: string }[] }>({
    queryKey: ["election-activities"],
    queryFn: async () => (await fetch("/api/elections/activities")).json(),
    staleTime: Infinity,
  });

  const { data, isPending } = useQuery<{ windows: Win[]; personalized?: boolean; chartAvailable?: boolean; withheld?: { hourOnly: number } }>({
    // Everything the answer depends on is in the key. The zone and the
    // location flag ride in the URL, and a key that omits them serves a
    // Chicago answer to a traveller — a lesson this repo has already paid for.
    queryKey: ["activity-week", activity, testerId, lat.toFixed(2), lon.toFixed(2), tz, zone, locationKnown],
    queryFn: async () => (await fetch(
      `/api/elections/times?activity=${encodeURIComponent(activity)}&span=week&lat=${lat}&lon=${lon}&tz=${tz}&timeZone=${encodeURIComponent(zone)}&locationKnown=${locationKnown}`,
      { headers: testerId ? { "x-tester-id": testerId } : {} },
    )).json(),
    enabled: !!activity,
  });

  const all = acts?.activities ?? [];
  const label = all.find(a => a.key === activity)?.label ?? activity;
  // What this person said they wanted help timing, when they said anything.
  // An empty list means never asked or nothing chosen, and the curated
  // default stands — it is never filled in on their behalf.
  const chosen = prefs.timing.helpTiming ?? [];
  const shortlist = chosen.length ? chosen : FEATURED;
  const shown = showAll ? all : all.filter(a => shortlist.includes(a.key));

  // One column per day, so an empty day is VISIBLE as an empty day rather
  // than missing from a list.
  const days: { key: string; dow: string; date: string; wins: Win[] }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() + i * 86400000);
    const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const dow = d.toLocaleDateString("en-US", { weekday: "short" });
    days.push({ key: date, dow, date, wins: (data?.windows ?? []).filter(w => w.date === date) });
  }
  const total = data?.windows?.length ?? 0;

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "13px 16px 14px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.9px", textTransform: "uppercase", color: "var(--text-3)" }}>
          The week for
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-foreground)" }}>{label}</span>
        {data?.personalized && (
          <span title="Read against your own chart, not just the universal sky"
            style={{ fontSize: 10.5, padding: "1px 7px", borderRadius: 8, background: "#6f6a9018", color: "#6f6a90" }}>
            your chart
          </span>
        )}
      </div>

      {/* The picker. Ten by default; the other fifty behind a door. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 11 }}>
        {shown.map(a => (
          <button key={a.key} onClick={() => { setWhy(null); setActivity(a.key); }} style={{
            fontSize: 10.5, padding: "3px 10px", borderRadius: 12, cursor: "pointer",
            border: `1px solid ${a.key === activity ? "var(--color-primary)" : "var(--color-border)"}`,
            background: a.key === activity ? "var(--color-primary)" : "var(--color-background)",
            color: a.key === activity ? "#ffffff" : "var(--text-2)",
          }}>{a.label}</button>
        ))}
        <button onClick={() => setShowAll(v => !v)} style={{
          fontSize: 10.5, padding: "3px 8px", background: "none", border: "none",
          cursor: "pointer", color: "var(--color-primary)",
        }}>{showAll ? "fewer" : `all ${all.length}`}</button>
      </div>

      {isPending && <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>Reading the week…</div>}

      {!isPending && (
        <>
          {/* The track runs 5 AM to 11 PM. The engine does not elect windows
              in the small hours for anything in the featured set, and giving
              the empty third of the clock a third of the width made every
              real window a third narrower for nothing. Anything outside the
              range is clamped to the edge rather than dropped. */}
          <div ref={gridRef} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {days.map(d => {
              const timed = d.wins.filter(w => !w.allDay);
              const allDay = d.wins.filter(w => w.allDay);
              const { placed, lanes } = layoutLanes(timed);
              const laneH = 16, gapH = 2;
              // All-day conditions get lanes of their own ABOVE the timed ones.
              // Sharing lane 0 drew a full-width bar and then a timed bar on
              // top of it, so Sunday's 4:08 PM window was painted over the
              // whole-day affinity it sits inside and neither could be read.
              const rows = allDay.length + lanes;
              const trackH = rows * laneH + (rows - 1) * gapH;
              return (
                <div key={d.key} style={{ display: "flex", alignItems: "flex-start", gap: ROW_GAP }}>
                  <div style={{ width: LABEL_W, flexShrink: 0, fontSize: 10.5, color: "var(--text-3)", paddingTop: 2, fontVariantNumeric: "tabular-nums" }}>
                    {d.dow} {d.date.split(" ")[1]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, position: "relative", height: trackH,
                    borderLeft: "1px solid var(--color-border)", borderRight: "1px solid var(--color-border)" }}>
                    {/* Noon, so a bar's position reads as a time without a ruler under every row. */}
                    <div style={{ position: "absolute", left: `${pctOf(12 * 60)}%`, top: 0, bottom: 0, width: 1, background: "var(--color-border)" }} />
                    {/* An empty day is drawn, not omitted. "Nothing on Tuesday"
                        is the answer someone came for as often as the windows are. */}
                    {!d.wins.length && (
                      <div style={{ position: "absolute", left: 0, right: 0, top: "50%", borderTop: "1px dashed var(--color-border)" }} />
                    )}
                    {allDay.map((w, i) => (
                      <div key={`ad-${i}`} title={w.why ?? ""} onClick={() => setWhy(w.why ? `${d.dow}, all day — ${w.why}` : null)}
                        style={{ position: "absolute", left: 0, right: 0, top: i * (laneH + gapH), height: laneH,
                          background: (TIER[w.tier] ?? TIER.fair).fill, color: (TIER[w.tier] ?? TIER.fair).ink,
                          border: w.tier === "great" ? "none" : "1px solid var(--color-border)",
                          borderRadius: 4, fontSize: 10, lineHeight: `${laneH - 2}px`, textAlign: "center",
                          cursor: w.why ? "pointer" : "default" }}>all day</div>
                    ))}
                    {placed.map((p, i) => {
                      const w = p.win, t = TIER[w.tier] ?? TIER.fair;
                      const left = pctOf(p.startMin), right = pctOf(p.endMin);
                      const widthPct = Math.max(right - left, 1.2);
                      const full = spanLabel(w.startClock, w.endClock);
                      // A ladder: the whole span where there is room, else the
                      // start clock, else nothing and the bar speaks through
                      // its length and position alone. Roughly 5.7px per
                      // character at 10px, plus padding; the 10px floor is
                      // app-wide, so this cannot be solved by shrinking type.
                      //
                      // trackW === 0 means NOT MEASURED YET, not zero width, so
                      // it falls to the short form rather than to nothing. The
                      // measurement is an upgrade, and a surface that renders
                      // blank bars whenever a ResizeObserver has not delivered
                      // is one bad frame away from looking broken.
                      const room = (widthPct / 100) * trackW - 5;
                      const label = trackW === 0 ? w.startClock
                        : room > full.length * 5.7 ? full
                        : room > w.startClock.length * 5.7 ? w.startClock : "";
                      return (
                        <div key={i} title={`${label} · ${durationLabel(w)}${w.why ? ` — ${w.why}` : ""}`}
                          onClick={() => setWhy(`${d.dow} ${label} · ${durationLabel(w)}${w.why ? ` — ${w.why}` : ""}`)}
                          style={{ position: "absolute", left: `${left}%`, width: `${widthPct}%`,
                            top: (allDay.length + p.lane) * (laneH + gapH), height: laneH,
                            background: t.fill, color: t.ink,
                            border: w.tier === "great" ? "none" : "1px solid var(--color-border)",
                            borderRadius: 4, fontSize: 10, lineHeight: `${laneH - 2}px`,
                            textAlign: "center", overflow: "hidden", whiteSpace: "nowrap",
                            cursor: "pointer" }}>
                          {label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* One ruler for the whole grid, aligned to the tracks above it. */}
          <div style={{ display: "flex", gap: ROW_GAP, marginTop: 3 }}>
            <div style={{ width: LABEL_W, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0, position: "relative", height: 11 }}>
              {([[6 * 60, "6a"], [12 * 60, "noon"], [18 * 60, "6p"]] as [number, string][]).map(([m, t]) => (
                <span key={t} style={{ position: "absolute", left: `${pctOf(m)}%`, transform: "translateX(-50%)", fontSize: 10, color: "var(--text-3)" }}>{t}</span>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 9, lineHeight: 1.5 }}>
            {why
              ? why
              : total === 0
                ? `Nothing this week stands out for ${label.toLowerCase()}.`
                : `${total} window${total === 1 ? "" : "s"} this week. Pick one to see what's behind it.`}
            {!why && data?.chartAvailable === false && (
              <span> Add your birth chart to have these read against your own houses.</span>
            )}
            {!why && (data?.withheld?.hourOnly ?? 0) > 0 && (
              <span> {data!.withheld!.hourOnly} matching planetary hours aren't listed on their own.</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
