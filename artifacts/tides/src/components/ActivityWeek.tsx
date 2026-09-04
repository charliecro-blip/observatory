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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { layoutLanes, spanLabel, durationLabel } from "@/lib/activityWeek";
import { usePreferences } from "@/contexts/preferences-context";
import { invalidateWindows } from "@/lib/invalidateWindows";

interface Win {
  date: string; dow: string;
  /** The planetary hour landing INSIDE a Moon swell — the concentrated core
   *  of the wider window it sits in, and the stronger of the two. */
  stackedHourMoon?: boolean;
  /** Read against this person's own chart rather than the universal sky. */
  personal?: boolean;
  startAt: string; endAt: string;
  startClock: string; endClock: string;
  /** A whole-day condition (the Moon's sign favors this), not a timed window.
   *  Rendered by its start time it read "7 AM" — the hour the engine's day
   *  begins — so a day-long affinity looked like a dawn appointment
   *  (found in the Plan workshop, 2026-08-21). */
  allDay?: boolean;
  tier: string; score: number; why?: string;
}

/**
 * Each tier now has a LINE as well as a fill, because a window and the
 * concentrated hour inside it are drawn differently rather than identically.
 *
 * A Friday reads 11:30–4:30 from a Moon swell, with 3:04–4:09 sitting inside
 * it where the planetary hour lands. Both were the same flat green chip, so
 * the picture said "two windows" when the truth is "one window with a hot
 * centre" (owner, 2026-08-28: "maybe a bit more elegance in the presentation
 * sequentially might be good? creative ways we could use color to
 * emphasize?").
 *
 * The core is drawn DEEPER than the window around it, rather than the window
 * being drawn lighter. Tried the other way first and looked at it: most
 * activities have no stacked hour on most days, so making the plain window an
 * outline turned an ordinary week into a grid of faint ghosts. The common case
 * has to stay solid; emphasis belongs on the rarer thing.
 */
const TIER: Record<string, { label: string; fill: string; ink: string; core: string; coreInk: string }> = {
  great: { label: "strong", fill: "#4a8060",   ink: "#ffffff",                 core: "#33553f",   coreInk: "#ffffff" },
  good:  { label: "good",   fill: "#4a806033", ink: "var(--color-foreground)", core: "#4a8060cc", coreInk: "#ffffff" },
  fair:  { label: "fair",   fill: "var(--color-card-2)", ink: "var(--color-muted)", core: "var(--color-border)", coreInk: "var(--color-foreground)" },
};

/** The "your chart" accent, the same violet the personalized badge uses. */
const MINE = "#6f6a90";

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
  // A custom activity's own creation panel (owner 2026-09-03: "an option for
  // people to add their own... and have that be something we sortage into
  // different astrological energies and create rule sets for"). Lives right
  // in the picker rather than a separate settings page, since making one and
  // immediately seeing its week is the point.
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newWhy, setNewWhy] = useState("");
  const [addError, setAddError] = useState<{ message: string; existingKey?: string } | null>(null);
  // The reason lived in a title attribute, which is nothing at all on a phone.
  // Holds the WINDOW now, not just its formatted text, so the reveal can also
  // offer to schedule it — a moment worth reading was a moment with nothing
  // to do about it (owner, 2026-09-03: "an opportunity to click on it and
  // schedule that into my calendar").
  const [selected, setSelected] = useState<{ w: Win; dow: string; label: string } | null>(null);
  const [scheduled, setScheduled] = useState(false);
  const tz = new Date().getTimezoneOffset();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const qc = useQueryClient();

  const schedule = useMutation({
    mutationFn: async () => {
      if (!selected || !testerId) return;
      const r = await fetch("/api/planning/windows", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tester-id": testerId },
        body: JSON.stringify({
          title: label, windowType: "deep_work",
          startTime: selected.w.startAt, endTime: selected.w.endAt,
        }),
      });
      if (!r.ok) throw new Error(`schedule failed (${r.status})`);
    },
    onSuccess: () => { invalidateWindows(qc); qc.invalidateQueries({ queryKey: ["tides-week"] }); setScheduled(true); },
  });

  // testerId rides in both the key and the header now — this used to be one
  // global, tester-independent cache entry, which was correct while the list
  // was purely the built-in fifty and became wrong the moment it could also
  // carry a tester's own custom activities.
  const { data: acts } = useQuery<{ activities: { key: string; label: string; custom?: boolean }[] }>({
    queryKey: ["election-activities", testerId],
    queryFn: async () => (await fetch("/api/elections/activities", { headers: testerId ? { "x-tester-id": testerId } : {} })).json(),
    staleTime: 5 * 60 * 1000,
  });

  const createCustom = useMutation({
    mutationFn: async () => {
      if (!testerId) throw new Error("no tester");
      const r = await fetch("/api/activities/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tester-id": testerId },
        body: JSON.stringify({ title: newTitle.trim(), description: newWhy.trim() || undefined }),
      });
      const body = await r.json();
      if (!r.ok) throw body;
      return body as { key: string; label: string };
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["election-activities"] });
      setActivity(created.key);
      setNewTitle(""); setNewWhy(""); setShowAdd(false); setAddError(null);
      setSelected(null); setScheduled(false);
    },
    onError: (err: any) => {
      setAddError({ message: err?.message ?? "Couldn't read that as an activity — try rephrasing it.", existingKey: err?.key });
    },
  });

  const deleteCustom = useMutation({
    mutationFn: async (key: string) => {
      if (!testerId) return;
      await fetch(`/api/activities/custom/by-key/${encodeURIComponent(key)}`, { method: "DELETE", headers: { "x-tester-id": testerId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["election-activities"] });
      setActivity("train-hard"); setSelected(null); setScheduled(false);
    },
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
  const customOnes = all.filter(a => a.custom);
  // A tester's own activities stay visible in the short list too — they are
  // not part of the curated fifty, and the whole point of making one is
  // seeing it without first finding "all 51".
  const shown = (showAll ? all : all.filter(a => shortlist.includes(a.key)))
    .concat(showAll ? [] : customOnes.filter(a => !shortlist.includes(a.key)));

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
        {all.find(a => a.key === activity)?.custom && (
          <button onClick={() => deleteCustom.mutate(activity)} disabled={deleteCustom.isPending} style={{
            marginLeft: "auto", fontSize: 10.5, background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-3)",
          }}>{deleteCustom.isPending ? "removing…" : "remove this activity"}</button>
        )}
      </div>

      {/* The picker. Ten by default; the other fifty behind a door. Your own
          activities carry a small dot — the same rule set as the built-in
          fifty, still worth telling apart at a glance since nobody else's
          list has this one on it. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: showAdd ? 8 : 11, alignItems: "center" }}>
        {shown.map(a => (
          <button key={a.key} onClick={() => { setSelected(null); setScheduled(false); setActivity(a.key); }} title={a.custom ? "Your own activity" : undefined} style={{
            fontSize: 10.5, padding: "3px 10px", borderRadius: 12, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
            border: `1px solid ${a.key === activity ? "var(--color-primary)" : a.custom ? "#6f6a9055" : "var(--color-border)"}`,
            background: a.key === activity ? "var(--color-primary)" : "var(--color-background)",
            color: a.key === activity ? "#ffffff" : "var(--text-2)",
          }}>
            {a.custom && <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: a.key === activity ? "#ffffff" : "#6f6a90", flexShrink: 0 }} />}
            {a.label}
          </button>
        ))}
        <button onClick={() => setShowAll(v => !v)} style={{
          fontSize: 10.5, padding: "3px 8px", background: "none", border: "none",
          cursor: "pointer", color: "var(--color-primary)",
        }}>{showAll ? "fewer" : `all ${all.length}`}</button>
        {testerId && (
          <button onClick={() => { setShowAdd(v => !v); setAddError(null); }} style={{
            fontSize: 10.5, padding: "3px 10px", borderRadius: 12, cursor: "pointer",
            border: "1px dashed var(--color-border)", background: "none", color: "var(--text-3)",
          }}>{showAdd ? "cancel" : "+ add yours"}</button>
        )}
      </div>

      {showAdd && (
        <div style={{ marginBottom: 11, padding: "9px 11px", borderRadius: 9, background: "var(--color-card-2)", border: "1px solid var(--color-border)" }}>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="What do you want windows for? e.g. Practice guitar"
            style={{ width: "100%", fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-background)", color: "var(--color-foreground)", marginBottom: 6, boxSizing: "border-box" }} />
          <input value={newWhy} onChange={e => setNewWhy(e.target.value)} placeholder="Why it matters (optional — sharpens the reading)"
            style={{ width: "100%", fontSize: 11.5, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--color-border)", background: "var(--color-background)", color: "var(--color-foreground)", marginBottom: 8, boxSizing: "border-box" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => createCustom.mutate()} disabled={!newTitle.trim() || createCustom.isPending} style={{
              fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 6, cursor: newTitle.trim() ? "pointer" : "default",
              border: "none", background: "var(--color-primary)", color: "#ffffff", opacity: newTitle.trim() ? 1 : 0.5,
            }}>{createCustom.isPending ? "Reading it…" : "Create"}</button>
            <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>Read the same way a Guiding Star is — element, ruling planet, houses.</span>
          </div>
          {addError && (
            <div style={{ fontSize: 11, color: "#a05020", marginTop: 6 }}>
              {addError.message}
              {addError.existingKey && (
                <button onClick={() => { setActivity(addError.existingKey!); setShowAdd(false); setAddError(null); setNewTitle(""); setNewWhy(""); }} style={{
                  marginLeft: 6, fontSize: 11, background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--color-primary)", fontWeight: 600,
                }}>Use it →</button>
              )}
            </div>
          )}
        </div>
      )}

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
                      <div key={`ad-${i}`} title={w.why ?? ""} onClick={() => { setSelected({ w, dow: d.dow, label: "all day" }); setScheduled(false); }}
                        style={{ position: "absolute", left: 0, right: 0, top: i * (laneH + gapH), height: laneH,
                          background: (TIER[w.tier] ?? TIER.fair).fill, color: (TIER[w.tier] ?? TIER.fair).ink,
                          border: w.tier === "great" ? "none" : "1px solid var(--color-border)",
                          borderRadius: 4, fontSize: 10, lineHeight: `${laneH - 2}px`, textAlign: "center",
                          cursor: w.why ? "pointer" : "default" }}>all day</div>
                    ))}
                    {placed.map((p, i) => {
                      const w = p.win, t = TIER[w.tier] ?? TIER.fair;
                      // The hour inside the swell is the core; the swell is the
                      // window around it. Outline for the window, fill for the
                      // core, so the nesting is visible rather than described.
                      const core = !!w.stackedHourMoon;
                      // Read against this person's own chart. The violet is the
                      // one the "your chart" badge above already uses, so the
                      // badge and the bars are saying the same thing.
                      const mine = !!w.personal;
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
                      const barLabel = trackW === 0 ? w.startClock
                        : room > full.length * 5.7 ? full
                        : room > w.startClock.length * 5.7 ? w.startClock : "";
                      return (
                        <div key={i} title={`${barLabel} · ${durationLabel(w)}${w.why ? ` — ${w.why}` : ""}`}
                          onClick={() => { setSelected({ w, dow: d.dow, label: full }); setScheduled(false); }}
                          style={{ position: "absolute", left: `${left}%`, width: `${widthPct}%`,
                            top: (allDay.length + p.lane) * (laneH + gapH), height: laneH,
                            background: core ? t.core : t.fill,
                            color: core ? t.coreInk : t.ink,
                            border: w.tier === "great" || core ? "none" : "1px solid var(--color-border)",
                            // The one place a fourth colour is spent, and only
                            // on the edge nearest the reader's own chart.
                            borderLeft: mine ? `3px solid ${MINE}` : undefined,
                            borderRadius: 4, fontSize: 10, lineHeight: `${laneH - 2}px`,
                            textAlign: "center", overflow: "hidden", whiteSpace: "nowrap",
                            fontWeight: core ? 600 : 400,
                            cursor: "pointer" }}>
                          {barLabel}
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

          {selected ? (
            <div style={{ marginTop: 9, padding: "8px 10px", borderRadius: 8, background: "var(--color-card-2)", border: "1px solid var(--color-border)" }}>
              <div style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.5 }}>
                {selected.dow}{selected.w.allDay ? ", all day" : ` ${selected.label}`} · {durationLabel(selected.w)}
                {selected.w.why ? ` — ${selected.w.why}` : ""}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                {scheduled ? (
                  <span style={{ fontSize: 11, color: "#3f7a4a", fontWeight: 600 }}>Scheduled ✓</span>
                ) : (
                  <button onClick={() => schedule.mutate()} disabled={!testerId || schedule.isPending} style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, cursor: testerId ? "pointer" : "default",
                    border: "none", background: "var(--color-primary)", color: "#ffffff",
                  }}>{schedule.isPending ? "Scheduling…" : "Schedule this →"}</button>
                )}
                <button onClick={() => { setSelected(null); setScheduled(false); }} style={{
                  fontSize: 11, background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-3)",
                }}>close</button>
              </div>
              {schedule.isError && <div style={{ fontSize: 10.5, color: "#a05020", marginTop: 4 }}>Couldn't schedule that — try again.</div>}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 9, lineHeight: 1.5 }}>
              {total === 0
                ? `Nothing this week stands out for ${label.toLowerCase()}.`
                : `${total} window${total === 1 ? "" : "s"} this week. Pick one to see what's behind it, and schedule it if it fits.`}
              {data?.chartAvailable === false && (
                <span> Add your birth chart to have these read against your own houses.</span>
              )}
              {/* Said once, and only when there is a violet edge on screen to
                  explain. The outline-and-core pairing is left to speak for
                  itself; an edge colour cannot. */}
              {(data?.windows ?? []).some(w => w.personal) && (
                <span> A violet edge marks the ones read against your own chart.</span>
              )}
              {(data?.withheld?.hourOnly ?? 0) > 0 && (
                <span> {data!.withheld!.hourOnly} matching planetary hours aren't listed on their own.</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
