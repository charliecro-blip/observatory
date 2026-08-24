import React, { useState } from "react";
import { invalidateWindows } from "@/lib/invalidateWindows";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { logEvent } from "@/lib/analytics";
import type { AskElectionContext } from "@/App";
import { ELEMENT_COLORS } from "@/lib/elements";
import { useTester } from "@/contexts/tester-context";
import { partOfDay } from "@/lib/clock";

/**
 * The election picker (owner 2026-07-20): browse the extensive activity list,
 * pick one, get tiered times — ● good (planetary hours, Moon aspects, sign
 * days — localized) and ★ great (your natal houses/planets in play, standing
 * sky aspects, or stacked conditions). One tap schedules a window.
 * Data: /api/elections/activities + /api/elections/times (lib/
 * activityCorrespondences + electionEngine server-side).
 */

const EL_COLOR: Record<string, string> = { fire: "#c04830", earth: ELEMENT_COLORS.earth, air: ELEMENT_COLORS.air, water: ELEMENT_COLORS.water };

interface ActivityLite {
  key: string; label: string; category: string; element: string;
  gloss: string; windowType: string;
}
interface ElectionWindowT {
  date: string; dow: string; startAt: string; endAt: string;
  startClock: string; endClock: string; allDay?: boolean;
  tier: "good" | "great"; why: string; score: number;
}

type PartOfDay = "morning" | "afternoon" | "evening";
const PART_LABEL: Record<PartOfDay, string> = { morning: "mornings", afternoon: "afternoons", evening: "evenings" };

export function ElectionPicker({ testerId, lat, lon, onAsk }: { testerId: string | null; lat: number; lon: number; onAsk?: (ctx: AskElectionContext, seed: string) => void }) {
  const qc = useQueryClient();
  // Read ONCE per render: the cache key and the request must not be able to
  // disagree about which timezone they meant.
  const tzOffset = new Date().getTimezoneOffset();
  // The IANA zone, alongside the numeric offset — corrects the day
  // boundary for the specific day in question rather than trusting a
  // snapshot, which drifts by an hour across a DST transition.
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { locationKnown } = useTester();
  const [category, setCategory] = useState<string>("body");
  const [activityKey, setActivityKey] = useState<string | null>(null);
  const [span, setSpan] = useState<"day" | "week" | "month">("week");
  const [scheduled, setScheduled] = useState<string | null>(null);
  // Layer 1 (deterministic): "when you're free" filters the elected windows by
  // part of day — no astrology invented, just a filter. Layer 2 (subjective):
  // the note rides into Ask so it can advise within the real windows.
  const [showDetails, setShowDetails] = useState(false);
  const [freeParts, setFreeParts] = useState<Set<PartOfDay>>(new Set());
  const [note, setNote] = useState("");

  const { data: list } = useQuery<{ categories: { key: string; label: string; gloss: string }[]; activities: ActivityLite[] }>({
    queryKey: ["election-activities"],
    queryFn: async () => (await fetch("/api/elections/activities")).json(),
    staleTime: Infinity,
  });

  const { data: times, isFetching } = useQuery<{ chartAvailable: boolean; personalized: boolean; cautions: string[]; windows: ElectionWindowT[]; activity: ActivityLite; withheld?: { hourOnly: number } }>({
    // lat/lon/tz are COMPUTATIONAL INPUTS and therefore belong in the key.
    // Without them a location or timezone change left the previous place's
    // windows cached for the full stale period — the app quietly answering
    // "when should I do this here?" with times computed for somewhere else.
    // Rounded to 2dp so trivial GPS jitter does not thrash the cache while a
    // real move always does.
    queryKey: ["election-times", activityKey, span, testerId, lat.toFixed(2), lon.toFixed(2), tzOffset, zone, locationKnown],
    queryFn: async () => (await fetch(
      `/api/elections/times?activity=${activityKey}&span=${span}&lat=${lat}&lon=${lon}&tz=${tzOffset}&timeZone=${encodeURIComponent(zone)}&locationKnown=${locationKnown}`,
      { headers: testerId ? { "x-tester-id": testerId } : {} },
    )).json(),
    enabled: !!activityKey,
    staleTime: 1000 * 60 * 10,
  });

  const schedule = useMutation({
    mutationFn: async (w: ElectionWindowT) => {
      const act = list?.activities.find(a => a.key === activityKey);
      const r = await fetch("/api/planning/windows", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tester-id": testerId ?? "" },
        body: JSON.stringify({
          title: act?.label ?? "Election", windowType: act?.windowType ?? "deep_work",
          startTime: w.startAt, endTime: w.endAt,
        }),
      });
      if (!r.ok) throw new Error(`schedule failed (${r.status})`);
      return `${w.dow}|${w.startClock}`;
    },
    onSuccess: (key, w) => {
      logEvent("election_schedule", { activity: activityKey, tier: w.tier });
      setScheduled(key);
      invalidateWindows(qc);
      setTimeout(() => setScheduled(null), 2500);
    },
  });

  const activities = (list?.activities ?? []).filter(a => a.category === category);
  const selected = list?.activities.find(a => a.key === activityKey);

  const allWindows = times?.windows ?? [];
  const shownWindows = freeParts.size === 0
    ? allWindows
    // A window whose clock cannot be read is KEPT rather than dropped: the
    // filter is a convenience, and silently hiding a real window because a
    // string did not parse is the same class of error as classifying it wrong.
    : allWindows.filter(w => { const p = w.allDay ? null : partOfDay(w.startClock); return w.allDay || p == null || freeParts.has(p); });
  const filteredOut = allWindows.length - shownWindows.length;

  function togglePart(p: PartOfDay) {
    setFreeParts(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; });
  }

  function askAboutTimes() {
    if (!onAsk) return;
    const label = (selected?.label ?? "this").toLowerCase();
    const when = span === "day" ? "today" : `this ${span}`;
    const windows = shownWindows.slice(0, 4).map(w => ({
      label: `${w.dow} ${w.date} · ${w.allDay ? "all day" : `${w.startClock}–${w.endClock}`}`,
      tier: w.tier, why: w.why,
    }));
    const freeNote = freeParts.size ? ` I'm free ${[...freeParts].map(p => PART_LABEL[p]).join(" / ")}.` : "";
    const seed = `Help me pick the best time for ${label} ${when}.${freeNote}${note.trim() ? ` ${note.trim()}` : ""}`;
    logEvent("election_ask", { activity: activityKey, span, hasNote: !!note.trim() });
    onAsk({ activity: selected?.label ?? activityKey!, note: note.trim() || undefined, windows }, seed);
  }

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "16px 18px", marginBottom: 18 }}>
      {/* The timing/election engine keeps the name Auspice — "under good
          auspices", the favorable moment — now that Compass is the product. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 2 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--color-primary)" }}>Find the time for anything</div>
        {/* Sub-brand tag (Compass brand kit): small-caps after a hairline dot,
            air-gold — Auspice is the timing engine, a feature of Compass. */}
        <span style={{ fontSize: 9, letterSpacing: "1.6px", textTransform: "uppercase", color: ELEMENT_COLORS.air, fontFamily: "var(--font-display)" }}>· Auspice</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 10 }}>
        {/* Second person. This read "Auspice reads its good and great times
            from the sky", which is the app naming itself in the third person on
            a control — the tic the owner has flagged twice and the house rule
            forbids. The sub-brand tag above still carries the name, which is
            where a name belongs. */}
        Pick an activity to see its good and great times, read from the sky{times?.chartAvailable ? " and your chart" : ""}.
      </div>

      {/* Categories */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
        {(list?.categories ?? []).map(c => (
          <button key={c.key} onClick={() => { setCategory(c.key); setActivityKey(null); }} title={c.gloss} style={{
            fontSize: 10, padding: "4px 11px", borderRadius: 14, cursor: "pointer",
            border: category === c.key ? "1px solid #1a2a3a" : "1px solid var(--color-border)",
            background: category === c.key ? "#1a2a3a" : "transparent",
            color: category === c.key ? "#ffffff" : "var(--color-muted)", fontWeight: category === c.key ? 600 : 400,
          }}>{c.label}</button>
        ))}
      </div>

      {/* Activities in category */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: activityKey ? 12 : 0 }}>
        {activities.map(a => {
          const c = EL_COLOR[a.element] ?? "#8a8278";
          const on = activityKey === a.key;
          return (
            <button key={a.key} onClick={() => setActivityKey(a.key)} title={a.gloss} style={{
              fontSize: 11, padding: "6px 12px", borderRadius: 9, cursor: "pointer",
              border: on ? `1.5px solid ${c}` : "1px solid var(--color-border)",
              background: on ? `${c}14` : "var(--color-card-2)",
              color: on ? c : "var(--color-foreground)", fontWeight: on ? 700 : 400,
            }}>{a.label}</button>
          );
        })}
      </div>

      {activityKey && (
        <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 10.5, color: "var(--color-muted)", fontStyle: "italic" }}>{selected?.gloss}</div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["day", "week", "month"] as const).map(s => (
                <button key={s} onClick={() => setSpan(s)} style={{
                  fontSize: 9.5, padding: "3px 10px", borderRadius: 10, cursor: "pointer",
                  border: span === s ? "1px solid #1a2a3a" : "1px solid var(--color-border)",
                  background: span === s ? "#1a2a3a" : "transparent", color: span === s ? "#ffffff" : "var(--color-muted)",
                }}>{s}</button>
              ))}
            </div>
          </div>

          {(times?.cautions ?? []).map((c, i) => (
            <div key={i} style={{ fontSize: 10.5, color: "#8a6a20", background: "#c8b06a14", border: "1px solid #c8b06a45", borderRadius: 8, padding: "6px 10px", marginBottom: 8, lineHeight: 1.5 }}>
              ⚠ {c}
            </div>
          ))}
          {times && !times.chartAvailable && (
            <div style={{ fontSize: 9.5, color: "var(--text-3)", marginBottom: 8 }}>
              ○ Add your birth chart in Settings and ★ great times get read from your own houses.
            </div>
          )}
          {/* A gap is output, never a silent drop: the hours the engine matched
              and chose not to list are counted here, so nobody wonders where
              the Mercury hours went. */}
          {(times?.withheld?.hourOnly ?? 0) > 0 && (
            <div style={{ fontSize: 9.5, color: "var(--text-3)", marginBottom: 8 }}>
              {times!.withheld!.hourOnly} matching planetary hour{times!.withheld!.hourOnly === 1 ? "" : "s"} this {span} aren't listed on their own, only where they fall inside a window above.
            </div>
          )}

          {isFetching && <div style={{ fontSize: 11, color: "var(--text-3)", padding: "10px 0" }}>Reading the sky…</div>}
          {!isFetching && allWindows.length === 0 && (
            <div style={{ fontSize: 11, color: "var(--text-3)", padding: "6px 0" }}>No clean window in this span — a quiet stretch for this.</div>
          )}
          {!isFetching && allWindows.length > 0 && shownWindows.length === 0 && (
            <div style={{ fontSize: 11, color: "var(--text-3)", padding: "6px 0" }}>
              No window falls in your free times this {span}. <button onClick={() => setFreeParts(new Set())} style={{ background: "none", border: "none", color: "var(--text-2)", cursor: "pointer", textDecoration: "underline", fontSize: 11, padding: 0 }}>show all <span aria-hidden="true">→</span></button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {shownWindows.map((w, i) => {
              const key = `${w.dow}|${w.startClock}`;
              const great = w.tier === "great";
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 9, padding: "7px 11px", borderRadius: 9,
                  border: great ? "1px solid #c8b06a70" : "1px solid var(--color-border)",
                  background: great ? "#c8b06a0e" : "var(--color-card-2)",
                }}>
                  <span title={great ? "Great — your chart or stacked sky conditions" : "Good — the sky's general weather"}
                    style={{ fontSize: great ? 13 : 10, color: great ? "#c8a04a" : "var(--color-muted)", flexShrink: 0, width: 16, textAlign: "center" }}>
                    {great ? "★" : "●"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)" }}>
                      {w.dow} {w.date} · {w.allDay ? "all day" : `${w.startClock}–${w.endClock}`}
                    </div>
                    <div style={{ fontSize: 9.5, color: "var(--color-muted)", marginTop: 1, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, lineHeight: 1.45 }}>
                      {w.why}
                    </div>
                  </div>
                  {!w.allDay && (
                    scheduled === key
                      ? <span style={{ fontSize: 10, color: "#4a8060", fontWeight: 600, flexShrink: 0 }}><span aria-hidden="true">✓</span> on the calendar</span>
                      : <button onClick={() => schedule.mutate(w)} disabled={schedule.isPending} style={{
                          fontSize: 9.5, padding: "4px 11px", borderRadius: 8, cursor: "pointer", flexShrink: 0,
                          border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--text-1)", fontWeight: 600,
                        }}>schedule</button>
                  )}
                </div>
              );
            })}
          </div>

          {filteredOut > 0 && shownWindows.length > 0 && (
            <div style={{ fontSize: 9, color: "var(--color-muted)", marginTop: 5 }}>{filteredOut} more outside your free times · <button onClick={() => setFreeParts(new Set())} style={{ background: "none", border: "none", color: "var(--color-muted)", cursor: "pointer", textDecoration: "underline", fontSize: 9, padding: 0 }}>show all</button></div>
          )}

          {/* Add details — Layer 1 (free-time filter, deterministic) + Layer 2
              (a note that rides into Ask with these windows as given facts). */}
          <div style={{ borderTop: "1px dashed var(--color-border)", marginTop: 11, paddingTop: 9 }}>
            {!showDetails ? (
              <button onClick={() => setShowDetails(true)} style={{
                fontSize: 10, background: "none", border: "none", color: "#6a7a8a", cursor: "pointer", padding: 0, fontWeight: 500,
              }}>＋ Narrow it down · tell Ask more</button>
            ) : (
              <div>
                <div style={{ fontSize: 9.5, color: "var(--color-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.5px" }}>When are you free?</div>
                <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
                  {(["morning", "afternoon", "evening"] as PartOfDay[]).map(p => {
                    const on = freeParts.has(p);
                    return (
                      <button key={p} onClick={() => togglePart(p)} style={{
                        fontSize: 10, padding: "4px 11px", borderRadius: 14, cursor: "pointer", textTransform: "capitalize",
                        border: on ? "1px solid #3a5a80" : "1px solid var(--color-border)",
                        background: on ? "#3a5a8014" : "transparent", color: on ? ELEMENT_COLORS.water : "var(--color-muted)", fontWeight: on ? 600 : 400,
                      }}>{p}</button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 9.5, color: "var(--color-muted)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.5px" }}>Anything Ask should know?</div>
                <textarea
                  value={note} onChange={e => setNote(e.target.value)} rows={2}
                  placeholder="what you're hoping for, worried about, or working around…"
                  style={{
                    width: "100%", boxSizing: "border-box", fontSize: 11, padding: "7px 9px", borderRadius: 8, resize: "vertical",
                    border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-foreground)",
                    fontFamily: "inherit", lineHeight: 1.45,
                  }}
                />
              </div>
            )}

            {onAsk && (
              <button onClick={askAboutTimes} style={{
                marginTop: 10, width: "100%", fontSize: 11.5, padding: "9px 12px", borderRadius: 9, cursor: "pointer", fontWeight: 600,
                border: "1px solid #c0bab0", background: "var(--color-card)", color: "var(--text-2)",
              }}><span aria-hidden="true">✦</span> Ask which one — and how to make the most of it</button>
            )}
          </div>

          {/* The rare question, asked separately because it is a different
              question: the windows above are the good hours in the next week
              or month, and this is the uncommon DAY worth moving a week
              around. Opt-in — a two-year scan offered unasked would push
              every ordinary choice into waiting for a better one. */}
          <RareWindows activityKey={activityKey!} label={selected?.label ?? ""} tzOffset={tzOffset} />
        </div>
      )}
    </div>
  );
}

interface RareDayT { date: string; percentile: number; reasons: string[]; against: string[] }

function RareWindows({ activityKey, label, tzOffset }: { activityKey: string; label: string; tzOffset: number }) {
  const [open, setOpen] = useState(false);
  const { data, isFetching } = useQuery<{ days: RareDayT[]; none?: string; horizonDays: number }>({
    queryKey: ["election-rare", activityKey, tzOffset],
    queryFn: async () => (await fetch(`/api/elections/rare?activity=${activityKey}&tz=${tzOffset}`)).json(),
    enabled: open,
    staleTime: 1000 * 60 * 60,
  });

  if (!open) {
    return (
      <div style={{ borderTop: "1px dashed var(--color-border)", marginTop: 11, paddingTop: 9 }}>
        <button onClick={() => setOpen(true)} style={{
          fontSize: 10, background: "none", border: "none", color: "#6a7a8a", cursor: "pointer", padding: 0, fontWeight: 500,
        }}>☆ When is the rare one? · scan the next two years</button>
      </div>
    );
  }

  return (
    <div style={{ borderTop: "1px dashed var(--color-border)", marginTop: 11, paddingTop: 9 }}>
      <div style={{ fontSize: 9.5, color: "var(--color-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Exceptional days for {label.toLowerCase()}
      </div>
      {isFetching && <div style={{ fontSize: 11, color: "var(--text-3)" }}>Reading the next two years…</div>}
      {data?.none && <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>{data.none}</div>}
      {(data?.days ?? []).map((d) => {
        const when = new Date(d.date + "T12:00:00");
        return (
          <div key={d.date} style={{ padding: "6px 0", borderTop: "1px solid var(--color-border)" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-foreground)" }}>
                {when.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
              </span>
              {/* The claim states its own basis — "top 1% of two years" is
                  checkable in a way that a star rating is not. */}
              <span style={{ fontSize: 9.5, color: "#8a7a50" }}>
                top {Math.max(0.1, Math.round((100 - d.percentile) * 10) / 10)}% of two years
              </span>
            </div>
            {d.reasons.map((r, i) => (
              <div key={i} style={{ fontSize: 10.5, color: "var(--color-muted)", marginTop: 1 }}>· {r}</div>
            ))}
            {d.against.map((a, i) => (
              <div key={`x${i}`} style={{ fontSize: 10.5, color: "#8a7a50", marginTop: 1 }}>· against: {a}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
