import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { useIsMobile } from "@/hooks/useIsMobile";
import { PLANET_LITERACY } from "@/lib/sky-literacy";
import { PLANET_GLYPH } from "@/lib/glyphs";

const ELEMENTS = {
  fire: { label: "Surge", color: "#b84020", bg: "#fff0ec" },
  earth: { label: "Building", color: "#4a7040", bg: "#f0f5ee" },
  air: { label: "Clear", color: "#c19a3a", bg: "#f4efdd" },
  water: { label: "Deep", color: "#2a5a80", bg: "#eaf0f8" },
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

const ELEMENT_TO_CHARACTER: Record<string, string> = {
  water: "deep", fire: "surge", earth: "building", air: "clear",
};

// Reflect back on any day — the composer writes to that day's check-in row
// (felt → behaviorTags, note → notes), so hindsight entries are first-class
// logbook entries too.
function ReflectComposer({ testerId, date, dayDetail }: {
  testerId: string | null; date: string; dayDetail: DayDetail;
}) {
  const qc = useQueryClient();
  const existing = decodeFelt(dayDetail.checkIn?.behaviorTags);
  const [felt, setFelt] = useState<string | null>(existing.felt);
  const [note, setNote] = useState(dayDetail.checkIn?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setFelt(decodeFelt(dayDetail.checkIn?.behaviorTags).felt);
    setNote(dayDetail.checkIn?.notes ?? "");
    setSaved(false);
  }, [date, dayDetail.checkIn?.id]);

  const dirty = felt !== existing.felt || note !== (dayDetail.checkIn?.notes ?? "");

  async function save() {
    if (!testerId || saving) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { date, notes: note || null };
      if (felt) {
        const tags = [`felt:${felt}`];
        const ch = existing.tideChar ?? ELEMENT_TO_CHARACTER[dayDetail.sky.element];
        if (ch) tags.push(`tideChar:${ch}`);
        if (existing.tideLevel) tags.push(`tideLevel:${existing.tideLevel}`);
        body.behaviorTags = tags;
      }
      await fetch("/api/check-ins", {
        method: "POST",
        headers: { "x-tester-id": testerId, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      qc.invalidateQueries({ queryKey: ["logs-day"] });
      qc.invalidateQueries({ queryKey: ["logs-timeline"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginBottom: 24, padding: "14px 16px", background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 10 }}>
        {dayDetail.checkIn ? "Your reflection" : "Reflect on this day"}
      </div>
      <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
        {Object.entries(FELT_META).map(([key, o]) => (
          <button key={key} onClick={() => setFelt(felt === key ? null : key)} style={{
            flex: 1, padding: "7px 6px", borderRadius: 8, cursor: "pointer",
            border: felt === key ? `1.5px solid ${o.color}` : "1px solid var(--color-border)",
            background: felt === key ? `${o.color}12` : "var(--color-card-2)",
            fontSize: 11, color: felt === key ? o.color : "var(--color-muted)",
            fontWeight: felt === key ? 600 : 400,
          }}>
            {o.icon} {o.label}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What happened that day — and did the weather fit?"
        rows={2}
        style={{
          width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8,
          border: "1px solid var(--color-border)", background: "var(--color-card-2)",
          fontSize: 12, lineHeight: 1.5, color: "var(--color-foreground)",
          outline: "none", resize: "vertical", fontFamily: "inherit", marginBottom: 8,
        }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10 }}>
        {saved && <span style={{ fontSize: 10, color: "#4a8060" }}>saved ✓</span>}
        <button onClick={save} disabled={!dirty || saving} style={{
          padding: "6px 16px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 600,
          cursor: dirty && !saving ? "pointer" : "default",
          background: dirty && !saving ? "#1a2a3a" : "#e0dcd6",
          color: dirty && !saving ? "#fff" : "#aaa",
        }}>
          {saving ? "…" : "Save"}
        </button>
      </div>
    </div>
  );
}

export default function Log({ testerId, onVisitPlanet }: { testerId: string | null; onVisitPlanet?: (planet: string) => void }) {
  const isMobile = useIsMobile();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(30); // days back
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
  const { data: dayDetail, isLoading: dayLoading } = useQuery<DayDetail | null>({
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
        <div style={{ fontSize: 10, color: "#aaa", marginBottom: 6, textTransform: "uppercase" }}>
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
                background: dateRange === d ? "var(--color-primary)20" : "transparent",
                color: dateRange === d ? "var(--color-primary)" : "#888",
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
          <div style={{ fontSize: 12, color: "#888", padding: "20px 0", textAlign: "center" }}>
            Loading…
          </div>
        ) : summaries.length === 0 ? (
          <div style={{ fontSize: 12, color: "#888", padding: "20px 8px", textAlign: "center", lineHeight: 1.7 }}>
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
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 10, color: "#888" }}>
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
                      <span style={{ color: "#666", fontWeight: 500 }}>{entry.activitiesCount} done</span>
                    )}
                    {entry.healthCount > 0 && (
                      <span style={{ color: "#666" }}>{entry.healthCount} logged</span>
                    )}
                  </div>
                  {entry.notes && (
                    <div style={{ fontSize: 9, color: "#999", marginTop: 4, lineHeight: 1.4, fontStyle: "italic" }}>
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
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#999",
            fontSize: 14,
            textAlign: "center",
            padding: 40,
          }}
        >
          Select a day to view details
        </div>
      ) : dayLoading ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#999",
          }}
        >
          Loading…
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
                <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>That day's weather</div>
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
                        border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "#998a76",
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
                  <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>It felt</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: feltMeta.color }}>
                    {feltMeta.icon} {feltMeta.label}
                    {feltInfo?.tideChar && (
                      <span style={{ fontWeight: 400, color: "#999" }}>
                        {" "}· during a {feltInfo.tideChar} tide
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reflect on this day — felt + note, editable in hindsight */}
          <ReflectComposer testerId={testerId} date={dayDetail.date} dayDetail={dayDetail} />

          {/* Check-in scores (only when any exist — Tides itself doesn't
              collect these yet; health-tracker data shows through) */}
          {dayDetail.checkIn && [dayDetail.checkIn.energy, dayDetail.checkIn.mood, dayDetail.checkIn.stress, dayDetail.checkIn.sleepQuality].some((v) => v !== null) && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 10 }}>
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
                          <div style={{ fontSize: 9, color: "#888" }}>{label}</div>
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
              <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 10 }}>
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
                    <div style={{ fontSize: 11, color: "#888" }}>
                      {a.windowType} · {format(parseISO(a.completedAt), "h:mm a")}
                    </div>
                    {a.notes && (
                      <div style={{ fontSize: 11, color: "#999", marginTop: 6, fontStyle: "italic" }}>
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
              <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 10 }}>
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
                    <div style={{ fontSize: 11, color: "#888" }}>
                      {format(parseISO(h.loggedAt), "h:mm a")}
                      {h.mood !== null && ` · mood ${h.mood}`}
                      {h.energy !== null && ` · energy ${h.energy}`}
                    </div>
                    {h.notes && (
                      <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
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
              <div style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 10 }}>
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
                    <div style={{ fontSize: 11, color: "#888" }}>{t.summary}</div>
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
