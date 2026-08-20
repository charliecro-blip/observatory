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
 */

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface Win {
  date: string; dow: string;
  startAt: string; endAt: string;
  startClock: string; endClock: string;
  tier: string; score: number; why?: string;
}

const TIER: Record<string, { label: string; fill: string; ink: string }> = {
  great: { label: "strong", fill: "#4a8060", ink: "#ffffff" },
  good:  { label: "good",   fill: "#4a806033", ink: "var(--color-foreground)" },
  fair:  { label: "fair",   fill: "var(--color-card-2)", ink: "var(--color-muted)" },
};

/** The handful people actually ask about, in the order they ask. The full
 *  sixty stay behind "everything" — a wall of chips is not a menu. */
const FEATURED = [
  "train-hard", "deep-work", "deep-study", "first-date", "deepen-bond",
  "hard-conversation", "negotiate", "publish", "deep-rest", "meditate",
];

export default function ActivityWeek({ testerId, lat, lon, locationKnown = true }: {
  testerId: string | null; lat: number; lon: number; locationKnown?: boolean;
}) {
  const [activity, setActivity] = useState("train-hard");
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

  const { data, isPending } = useQuery<{ windows: Win[]; personalized?: boolean; chartAvailable?: boolean }>({
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
  const shown = showAll ? all : all.filter(a => FEATURED.includes(a.key));

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
        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.9px", textTransform: "uppercase", color: "var(--text-3)" }}>
          The week for
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-foreground)" }}>{label}</span>
        {data?.personalized && (
          <span title="Read against your own chart, not just the universal sky"
            style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, background: "#6f6a9018", color: "#6f6a90" }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 5 }}>
            {days.map(d => (
              <div key={d.key} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 9, color: "var(--text-3)", marginBottom: 3, textAlign: "center" }}>
                  {d.dow}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {d.wins.length === 0 ? (
                    // An empty day is drawn, not omitted. "Nothing on Tuesday"
                    // is the answer someone came for as often as the windows are.
                    <div style={{ height: 26, borderRadius: 5, border: "1px dashed var(--color-border)" }} />
                  ) : d.wins.slice(0, 3).map((w, i) => {
                    const t = TIER[w.tier] ?? TIER.fair;
                    return (
                      <div key={i} title={w.why ?? ""} onClick={() => setWhy(w.why ? `${d.dow} ${w.startClock} — ${w.why}` : null)} style={{
                        background: t.fill, color: t.ink, borderRadius: 5,
                        padding: "4px 3px", fontSize: 9, lineHeight: 1.3, textAlign: "center",
                        border: w.tier === "great" ? "none" : "1px solid var(--color-border)",
                        cursor: w.why ? "pointer" : "default",
                      }}>
                        {w.startClock}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
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
          </div>
        </>
      )}
    </div>
  );
}
