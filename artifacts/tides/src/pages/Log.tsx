import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, startOfDay, endOfDay, subDays } from "date-fns";

const ELEMENTS = {
  fire: { label: "Surge", color: "#b84020", bg: "#fff0ec" },
  earth: { label: "Building", color: "#4a7040", bg: "#f0f5ee" },
  air: { label: "Clear", color: "#c19a3a", bg: "#f4efdd" },
  water: { label: "Deep", color: "#2a5a80", bg: "#eaf0f8" },
};

interface DayLogEntry {
  date: string;
  element: string;
  mood: number | null;
  energy: number | null;
  notes: string;
  activitiesCount: number;
}

interface DayDetail {
  date: string;
  checkIn: {
    id: number;
    energy: number | null;
    mood: number | null;
    stress: number | null;
    sleepQuality: number | null;
    notes: string;
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
    personalTransits: any[] | null;
  };
}

export default function Log({ testerId }: { testerId: string | null }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(30); // days back
  const lat = 40.7;
  const lon = -74.0;

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
    queryKey: ["logs-timeline", testerId, startDate, endDate],
    queryFn: async () => {
      if (!testerId) return null;
      const r = await fetch(
        `/api/logs/timeline?startDate=${startDate}&endDate=${endDate}&limit=100&lat=${lat}&lon=${lon}`,
        { headers: { "x-tester-id": testerId } },
      );
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch day detail when selected
  const { data: dayDetail, isLoading: dayLoading } = useQuery({
    queryKey: ["logs-day", testerId, selectedDate],
    queryFn: async () => {
      if (!testerId || !selectedDate) return null;
      const r = await fetch(
        `/api/logs/day?date=${selectedDate}&lat=${lat}&lon=${lon}`,
        { headers: { "x-tester-id": testerId } },
      );
      return r.json();
    },
    enabled: !!testerId && !!selectedDate,
  });

  const summaries: DayLogEntry[] = timelineData?.summaries ?? [];

  const moodEmoji = (m: number | null) => {
    if (m === null) return "—";
    if (m <= 1) return "😞";
    if (m <= 2) return "😐";
    if (m <= 3) return "🙂";
    return "😊";
  };

  const energyBar = (e: number | null) => {
    if (e === null) return "—";
    return "█".repeat(Math.ceil(e / 2)) + "░".repeat(5 - Math.ceil(e / 2));
  };

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden", height: "100%" }}>
      {/* Left sidebar: Timeline */}
      <div
        style={{
          width: 280,
          borderRight: "1px solid var(--color-border)",
          background: "var(--color-rail)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
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
        </div>

        {/* Timeline list */}
        <div style={{ flex: 1, overflow: "auto", padding: "0 16px", paddingTop: 12 }}>
          {timelineLoading ? (
            <div style={{ fontSize: 12, color: "#888", padding: "20px 0", textAlign: "center" }}>
              Loading…
            </div>
          ) : summaries.length === 0 ? (
            <div style={{ fontSize: 12, color: "#888", padding: "20px 0", textAlign: "center" }}>
              No entries yet. Start by logging your daily check-in.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 16 }}>
              {summaries.map((entry) => {
                const isSelected = selectedDate === entry.date;
                const e = ELEMENTS[entry.element as keyof typeof ELEMENTS];
                const dateObj = parseISO(entry.date);
                const dayName = format(dateObj, "EEE");

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
                      <div style={{ fontSize: 11, fontWeight: 600, flex: 1 }}>
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
                      <span>{moodEmoji(entry.mood)}</span>
                      <span title={`Energy: ${entry.energy ?? "—"}`}>{energyBar(entry.energy)}</span>
                      {entry.activitiesCount > 0 && (
                        <span style={{ color: "#666", fontWeight: 500 }}>{entry.activitiesCount} done</span>
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

      {/* Right panel: Day detail */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
          <div style={{ flex: 1, overflow: "auto", padding: "20px 28px" }}>
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
                  <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase" }}>Today's weather</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>
                    {ELEMENTS[dayDetail.sky.element as keyof typeof ELEMENTS]?.label ?? dayDetail.sky.element}
                  </div>
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
              </div>
            </div>

            {/* Daily check-in */}
            {dayDetail.checkIn && (
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
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
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
                  {dayDetail.checkIn.notes && (
                    <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6, paddingTop: 10, borderTop: "1px solid var(--color-border)" }}>
                      "{dayDetail.checkIn.notes}"
                    </div>
                  )}
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
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{a.title}</div>
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
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{h.name}</div>
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
                  Your transits today
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
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>
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
    </div>
  );
}
