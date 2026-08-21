import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { WakeList, ReviewCard } from "@/components/Momentum";
import FeltPattern from "@/components/FeltPattern";
import LogComposer, { type LogVariant } from "@/components/LogComposer";
import Diary from "@/components/Diary";
import { format, parseISO } from "date-fns";
import { useIsMobile } from "@/hooks/useIsMobile";
import { PLANET_LITERACY } from "@/lib/sky-literacy";
import { PLANET_GLYPH } from "@/lib/glyphs";
import { ELEMENT_COLORS } from "@/lib/elements";

const ELEMENTS = {
  fire: { label: "Surge", color: ELEMENT_COLORS.fire, bg: "#fff0ec" },
  earth: { label: "Building", color: ELEMENT_COLORS.earth, bg: "#f0f5ee" },
  air: { label: "Clear", color: ELEMENT_COLORS.air, bg: "#f4efdd" },
  water: { label: "Deep", color: ELEMENT_COLORS.water, bg: "#eaf0f8" },
};

const FELT_META: Record<string, { label: string; icon: string; color: string }> = {
  aligned: { label: "Aligned", icon: "●", color: "#4a8060" },
  mixed: { label: "Mixed", icon: "◐", color: "#a08040" },
  off: { label: "Off", icon: "○", color: "#9a6060" },
};

interface DayLogEntry {
  date: string;
  element: string;
  mood: number | null;
  energy: number | null;
  felt: string | null;
  notes: string;
  activitiesCount: number;
  healthCount: number;
}

interface DayDetail {
  date: string;
  checkIn: {
    id: number;
    energy: number | null;
    mood: number | null;
    stress: number | null;
    sleepQuality: number | null;
    behaviorTags: string[] | null;
    notes: string | null;
  } | null;
  activities: Array<{
    id: number;
    title: string;
    windowType: string;
    completedAt: string;
    notes: string | null;
  }>;
  healthLogs: Array<{
    id: number;
    type: string;
    name: string;
    mood: number | null;
    energy: number | null;
    loggedAt: string;
    notes: string | null;
  }>;
  sky: {
    moonPhase: number; // 0-1
    element: string;
    flavors?: string[];
    personalTransits: any[] | null;
  };
}

const FLAVOR_PLANETS = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];

// The felt-rating lives in behaviorTags as `felt:aligned`, `tideChar:deep`, …
function decodeFelt(tags: string[] | null | undefined) {
  const get = (p: string) => tags?.find((t) => t.startsWith(p))?.slice(p.length) ?? null;
  return { felt: get("felt:"), tideChar: get("tideChar:"), tideLevel: get("tideLevel:") };
}

// Reflect back on any day — the composer writes to that day's check-in row
// (felt → behaviorTags, note → notes), so hindsight entries are first-class
// logbook entries too.
// The backfill door (home-base ask 3): a done thing from any day gets written
// into that day's ledger, the way habit dots already backfill. It writes a
// WIN — the record — and lands in the Wake stamped with this date.
function DayWinComposer({ testerId, date }: { testerId: string | null; date: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(false);
  useEffect(() => { setText(""); setSaved(false); }, [date]);

  async function save() {
    if (!testerId || saving || !text.trim()) return;
    setSaving(true);
    try {
      const r = await fetch("/api/planning/wins", {
        method: "POST",
        headers: { "x-tester-id": testerId, "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), date, tz: new Date().getTimezoneOffset() }),
      });
      if (!r.ok) throw new Error(`win failed (${r.status})`);
      qc.invalidateQueries({ queryKey: ["momentum"] });
      setText("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setErr(true);
      setTimeout(() => setErr(false), 4000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginBottom: 24, padding: "12px 16px", background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", marginBottom: 8 }}>
        Add to this day's log
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          placeholder="Something you did that day, planned or not."
          style={{
            flex: 1, padding: "7px 11px", borderRadius: 8, fontSize: 12.5, outline: "none",
            border: "1px solid var(--color-border)", background: "var(--color-card-2)",
            color: "var(--color-foreground)",
          }}
        />
        <button onClick={save} disabled={saving || !text.trim()} style={{
          padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 500,
          cursor: text.trim() ? "pointer" : "default",
          background: text.trim() ? "#1a2a3a" : "var(--color-border)",
          color: text.trim() ? "#ffffff" : "var(--text-3)",
        }}>{saving ? "Saving…" : "Log it"}</button>
      </div>
      {saved && <div style={{ fontSize: 10.5, color: "#3a6020", marginTop: 6 }}>In the ledger ✓</div>}
      {err && <div style={{ fontSize: 10.5, color: "#a03030", marginTop: 6 }}>Didn't save — try again.</div>}
    </div>
  );
}

export default function Log({ testerId, onVisitPlanet, lat = 40.7, lon = -74.0 }: { testerId: string | null; onVisitPlanet?: (planet: string) => void; lat?: number; lon?: number }) {
  const isMobile = useIsMobile();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // The summonable review (F10): the Sunday card's content, on demand. The
  // Sunday auto-appearance on Home stays; this is the GTD ask — a review you
  // can hold when you want one, not only when it ambushes you.
  const [reviewOpen, setReviewOpen] = useState(false);
  const [dateRange, setDateRange] = useState(30); // days back
  // The diary (workings) sits beside the days, as its own room.
  const [logMode, setLogMode] = useState<"days" | "diary">("days");
  const [logVariant, setLogVariant] = useState<LogVariant>(() => {
    try { return (localStorage.getItem("compass-log-variant") as LogVariant) || "page"; } catch { return "page"; }
  });
  // Readback-by-flavor: narrow the timeline to one planet's Moon-contact days.
  const [flavor, setFlavor] = useState<string>("");
  // Viewer timezone offset — day boundaries are the viewer's midnights.
  const tz = new Date().getTimezoneOffset();

  const startDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - dateRange);
    return d.toISOString().split("T")[0];
  }, [dateRange]);

  const endDate = useMemo(
    () => new Date().toISOString().split("T")[0],
    [],
  );

  // Fetch timeline (list of days)
  const { data: timelineData, isLoading: timelineLoading } = useQuery({
    queryKey: ["logs-timeline", testerId, startDate, endDate, flavor],
    queryFn: async () => {
      if (!testerId) return null;
      const r = await fetch(
        `/api/logs/timeline?startDate=${startDate}&endDate=${endDate}&limit=100&tz=${tz}${flavor ? `&flavor=${flavor}` : ""}`,
        { headers: { "x-tester-id": testerId } },
      );
      if (!r.ok) throw new Error("timeline failed");
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch day detail when selected
  const { data: dayDetail, isLoading: dayLoading, isError: dayError, refetch: refetchDay } = useQuery<DayDetail | null>({
    queryKey: ["logs-day", testerId, selectedDate],
    queryFn: async () => {
      if (!testerId || !selectedDate) return null;
      const r = await fetch(
        `/api/logs/day?date=${selectedDate}&tz=${tz}`,
        { headers: { "x-tester-id": testerId } },
      );
      if (!r.ok) throw new Error("day failed");
      return r.json();
    },
    enabled: !!testerId && !!selectedDate,
  });

  const summaries: DayLogEntry[] = timelineData?.summaries ?? [];

  const moodEmoji = (m: number | null) => {
    if (m === null) return null;
    if (m <= 1) return "😞";
    if (m <= 2) return "😐";
    if (m <= 3) return "🙂";
    return "😊";
  };

  const energyBar = (e: number | null) => {
    if (e === null) return null;
    return "█".repeat(Math.ceil(e / 2)) + "░".repeat(5 - Math.ceil(e / 2));
  };

  // On phones the Log is single-pane: the list, or (with a day selected) the
  // detail with a ← back row. Desktop keeps the two-pane layout.
  const showList = !isMobile || !selectedDate;
  const showDetail = !isMobile || !!selectedDate;

  const timelinePane = (
    <div
      style={{
        width: isMobile ? "100%" : 280,
        borderRight: isMobile ? "none" : "1px solid var(--color-border)",
        background: "var(--color-rail)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flex: isMobile ? 1 : undefined,
      }}
    >
      {/* Date range selector */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 6, textTransform: "uppercase" }}>
          Lookback
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDateRange(d)}
              style={{
                flex: 1,
                padding: "6px 0",
                fontSize: 11,
                borderRadius: 6,
                border: dateRange === d ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                // A real theme token, not an alpha-suffixed var:
                // `var(--color-primary)20` is not a colour and fails SILENTLY
                // to transparent, so the selected pill had no background at
                // all — the documented alpha-suffix trap, again. And a fixed
                // hex tint is no better here, because --color-primary flips
                // from near-black to near-white across themes; card-2 is the
                // one fill that reads as "selected" in both.
                background: dateRange === d ? "var(--color-card-2)" : "transparent",
                color: dateRange === d ? "var(--color-primary)" : "var(--color-muted)",
                cursor: "pointer",
                fontWeight: dateRange === d ? 600 : 400,
              }}
            >
              {d}d
            </button>
          ))}
        </div>
        {/* Jump to any day — the list only shows days with entries, but every
            day is reachable for hindsight reflection. */}
        <input
          type="date"
          max={endDate}
          value={selectedDate ?? ""}
          onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
          style={{
            width: "100%", boxSizing: "border-box", marginTop: 8, padding: "6px 10px",
            borderRadius: 6, border: "1px solid var(--color-border)",
            background: "var(--color-card-2)", color: "var(--color-foreground)",
            fontSize: 11, outline: "none",
          }}
        />
        {/* Readback-by-flavor — "show me my saturnine days" */}
        <select
          value={flavor}
          onChange={(e) => setFlavor(e.target.value)}
          style={{
            width: "100%", boxSizing: "border-box", marginTop: 8, padding: "6px 10px",
            borderRadius: 6, border: flavor ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
            background: "var(--color-card-2)", color: flavor ? "var(--color-primary)" : "var(--color-foreground)",
            fontSize: 11, outline: "none", fontWeight: flavor ? 600 : 400,
          }}
        >
          <option value="">All days</option>
          {FLAVOR_PLANETS.map((p) => (
            <option key={p} value={p}>
              {PLANET_GLYPH[p]} {PLANET_LITERACY[p]?.adjective ?? p.toLowerCase()} days · Moon × {p}
            </option>
          ))}
        </select>
      </div>

      {/* Timeline list */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 16px", paddingTop: 12 }}>
        {timelineLoading ? (
          <div style={{ fontSize: 12, color: "var(--color-muted)", padding: "20px 0", textAlign: "center" }}>
            Loading…
          </div>
        ) : summaries.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--color-muted)", padding: "20px 8px", textAlign: "center", lineHeight: 1.7 }}>
            {flavor ? (
              <>No {PLANET_LITERACY[flavor]?.adjective ?? flavor} days in this window — try a longer lookback.</>
            ) : (
              <>
                Nothing in the logbook yet.
                <br />
                Rate your day or jot a line in the journal on <b>Today</b> — it lands
                here automatically, stamped with that day's sky. Completed sessions
                show up here too.
              </>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 16 }}>
            {summaries.map((entry) => {
              const isSelected = selectedDate === entry.date;
              const e = ELEMENTS[entry.element as keyof typeof ELEMENTS] ?? ELEMENTS.water;
              const dateObj = parseISO(entry.date);
              const dayName = format(dateObj, "EEE");
              const felt = entry.felt ? FELT_META[entry.felt] : null;

              return (
                <button
                  key={entry.date}
                  onClick={() => setSelectedDate(entry.date)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: isSelected ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                    background: isSelected ? "var(--color-card)" : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, flex: 1, color: "var(--color-foreground)" }}>
                      {dayName} · {format(dateObj, "MMM d")}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: e.color,
                        background: e.bg,
                        padding: "2px 6px",
                        borderRadius: 4,
                      }}
                    >
                      {e.label}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 10, color: "var(--color-muted)" }}>
                    {felt && (
                      <span style={{ color: felt.color, fontWeight: 600 }}>
                        {felt.icon} {felt.label}
                      </span>
                    )}
                    {moodEmoji(entry.mood) && <span>{moodEmoji(entry.mood)}</span>}
                    {energyBar(entry.energy) && (
                      <span title={`Energy: ${entry.energy}`}>{energyBar(entry.energy)}</span>
                    )}
                    {entry.activitiesCount > 0 && (
                      <span style={{ color: "var(--text-2)", fontWeight: 500 }}>{entry.activitiesCount} done</span>
                    )}
                    {entry.healthCount > 0 && (
                      <span style={{ color: "var(--text-2)" }}>{entry.healthCount} logged</span>
                    )}
                  </div>
                  {entry.notes && (
                    <div style={{ fontSize: 9, color: "var(--text-3)", marginTop: 4, lineHeight: 1.4, fontStyle: "italic" }}>
                      "{entry.notes.substring(0, 50)}
                      {entry.notes.length > 50 ? "…" : ""}"
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const feltInfo = dayDetail?.checkIn ? decodeFelt(dayDetail.checkIn.behaviorTags) : null;
  const feltMeta = feltInfo?.felt ? FELT_META[feltInfo.felt] : null;

  const detailPane = (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {isMobile && selectedDate && (
        <button
          onClick={() => setSelectedDate(null)}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "10px 16px",
            border: "none", borderBottom: "1px solid var(--color-border)",
            background: "var(--color-rail)", color: "var(--color-primary)",
            fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left", flexShrink: 0,
          }}
        >
          ← Back to the log
        </button>
      )}
      {!selectedDate ? (
        /* No day selected → the Wake: the continual wins ledger is the Log's
           default view (owner 2026-07-17: tracking progress, emphasized). */
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
          {/* DAYS or the DIARY. The diary is the intentional record — set
              on purpose, stamped with the sky, closed with how it went. */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "var(--color-card-2)", borderRadius: 8, padding: 3, width: "fit-content" }}>
            {([["days", "The days"], ["diary", "The diary"]] as const).map(([m, label]) => (
              <button key={m} onClick={() => setLogMode(m)} style={{
                fontSize: 11.5, padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                background: logMode === m ? "var(--color-card)" : "transparent",
                color: logMode === m ? "var(--color-primary)" : "var(--text-3)", fontWeight: logMode === m ? 600 : 400,
              }}>{label}</button>
            ))}
          </div>
          {logMode === "diary" ? <Diary testerId={testerId} lat={lat} lon={lon} /> : (<>
          {/* The felt loop, finally shown. The endpoint that computes it has
              existed for weeks with nothing rendering it — a trust engine
              nobody can see is a diary (integration audit, gap 2). It belongs
              here rather than on Home: this is the reflective surface, and
              the finding is month-scale where Home is daily. */}
          <div style={{ marginBottom: 16 }}>
            <FeltPattern testerId={testerId} />
          </div>
          {/* Review now — the week's card without waiting for Sunday. */}
          <div style={{ marginBottom: 16 }}>
            {!reviewOpen ? (
              <button onClick={() => setReviewOpen(true)} style={{
                fontSize: 11.5, padding: "5px 13px", borderRadius: 8, cursor: "pointer",
                border: "1px solid var(--color-border)", background: "var(--color-card)",
                color: "var(--color-primary)", fontWeight: 500,
              }}>Review the week now</button>
            ) : (
              <>
                <ReviewCard testerId={testerId} summoned onOpenLog={() => setReviewOpen(false)} />
                <button onClick={() => setReviewOpen(false)} style={{
                  fontSize: 10.5, marginTop: 6, background: "none", border: "none",
                  cursor: "pointer", color: "var(--text-3)", padding: 0,
                }}>Close the review</button>
              </>
            )}
          </div>
          <WakeList testerId={testerId} />
          <div style={{ color: "var(--text-3)", fontSize: 12, textAlign: "center", padding: 20 }}>
            ← or select a day to read its full log
          </div>
          </>)}
        </div>
      ) : dayLoading ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-3)",
          }}
        >
          Loading…
        </div>
      ) : dayError ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-3)", padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "#a03030" }}>Couldn't load this day</div>
          <button onClick={() => refetchDay()}
            style={{ fontSize: 11, padding: "5px 12px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--text-1)", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      ) : dayDetail ? (
        <div style={{ flex: 1, overflow: "auto", padding: isMobile ? "16px 16px" : "20px 28px" }}>
          {/* Date header + weather */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--color-primary)", marginBottom: 8 }}>
              {format(parseISO(dayDetail.date), "EEEE, MMMM d, yyyy")}
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: "var(--color-muted)", textTransform: "uppercase" }}>That day's weather</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>
                  {ELEMENTS[dayDetail.sky.element as keyof typeof ELEMENTS]?.label ?? dayDetail.sky.element}
                </div>
                {(dayDetail.sky.flavors ?? []).length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3, flexWrap: "wrap" }}>
                    {(dayDetail.sky.flavors ?? []).map((p) => (
                      /* The Log looks back AND checks in — each flavor is a
                         door to that planet's page (natal + transits + goals). */
                      <button key={p} onClick={() => onVisitPlanet?.(p)} disabled={!onVisitPlanet} style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 10, cursor: onVisitPlanet ? "pointer" : "default",
                        border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--text-3)",
                      }}>
                        a {PLANET_LITERACY[p]?.adjective ?? p.toLowerCase()} day{onVisitPlanet ? " · check in →" : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {dayDetail.sky.moonPhase !== undefined && (
                <div style={{ fontSize: 18, paddingLeft: 12, borderLeft: "1px solid var(--color-border)" }}>
                  {dayDetail.sky.moonPhase < 0.125 || dayDetail.sky.moonPhase >= 0.875
                    ? "🌑"
                    : dayDetail.sky.moonPhase < 0.25
                      ? "🌒"
                      : dayDetail.sky.moonPhase < 0.375
                        ? "🌓"
                        : dayDetail.sky.moonPhase < 0.625
                          ? "🌕"
                          : dayDetail.sky.moonPhase < 0.75
                            ? "🌖"
                            : "🌗"}
                </div>
              )}
              {feltMeta && (
                <div style={{ paddingLeft: 12, borderLeft: "1px solid var(--color-border)" }}>
                  <div style={{ fontSize: 11, color: "var(--color-muted)", textTransform: "uppercase" }}>It felt</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: feltMeta.color }}>
                    {feltMeta.icon} {feltMeta.label}
                    {feltInfo?.tideChar && (
                      <span style={{ fontWeight: 400, color: "var(--text-3)" }}>
                        {" "}· during a {feltInfo.tideChar} tide
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reflect on this day — felt + writing, editable in hindsight. Three
              shapes are live at once while the owner picks one; the losers get
              deleted, they don't become a setting. */}
          <LogComposer
            testerId={testerId}
            date={dayDetail.date}
            dayDetail={dayDetail}
            variant={logVariant}
            onPickVariant={(v) => { setLogVariant(v); try { localStorage.setItem("compass-log-variant", v); } catch {} }}
          />

          {/* Backfill a win onto this day — yesterday's unplanned work counts too */}
          <DayWinComposer testerId={testerId} date={dayDetail.date} />

          {/* Check-in scores (only when any exist — Tides itself doesn't
              collect these yet; health-tracker data shows through) */}
          {dayDetail.checkIn && [dayDetail.checkIn.energy, dayDetail.checkIn.mood, dayDetail.checkIn.stress, dayDetail.checkIn.sleepQuality].some((v) => v !== null) && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", marginBottom: 10 }}>
                Daily check-in
              </div>
              <div
                style={{
                  padding: "14px 16px",
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 10,
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  {[
                    { label: "Energy", val: dayDetail.checkIn.energy },
                    { label: "Mood", val: dayDetail.checkIn.mood },
                    { label: "Stress", val: dayDetail.checkIn.stress },
                    { label: "Sleep", val: dayDetail.checkIn.sleepQuality },
                  ].map(
                    ({ label, val }) =>
                      val !== null && (
                        <div key={label}>
                          <div style={{ fontSize: 9, color: "var(--color-muted)" }}>{label}</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-primary)" }}>
                            {val}
                          </div>
                        </div>
                      ),
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Activities */}
          {dayDetail.activities.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", marginBottom: 10 }}>
                Activities completed
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {dayDetail.activities.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      padding: "10px 14px",
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--color-foreground)" }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: "var(--color-muted)" }}>
                      {a.windowType} · {format(parseISO(a.completedAt), "h:mm a")}
                    </div>
                    {a.notes && (
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6, fontStyle: "italic" }}>
                        {a.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Health logs */}
          {dayDetail.healthLogs.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", marginBottom: 10 }}>
                Health entries
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {dayDetail.healthLogs.map((h) => (
                  <div
                    key={h.id}
                    style={{
                      padding: "10px 14px",
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--color-foreground)" }}>{h.name}</div>
                    <div style={{ fontSize: 11, color: "var(--color-muted)" }}>
                      {format(parseISO(h.loggedAt), "h:mm a")}
                      {h.mood !== null && ` · mood ${h.mood}`}
                      {h.energy !== null && ` · energy ${h.energy}`}
                    </div>
                    {h.notes && (
                      <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>
                        {h.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Personal transits */}
          {dayDetail.sky.personalTransits && dayDetail.sky.personalTransits.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-muted)", textTransform: "uppercase", marginBottom: 10 }}>
                Your transits that day
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {dayDetail.sky.personalTransits.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "10px 14px",
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 2, color: "var(--color-foreground)" }}>
                      {t.transitPlanet} {t.aspect} {t.natalPlanet}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-muted)" }}>{t.summary}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "100%" }}>
      {showList && timelinePane}
      {showDetail && detailPane}
    </div>
  );
}
