import React, { useState } from "react";
import { useSkyEvents, useTidesWeek } from "@/hooks/useTides";
import type { SkyEvent } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  moon_phase: "Moon phase", ingress: "Moon ingress", voc: "Void of course",
  crossing: "Angular crossing", quality_window: "Quality window",
};

const QUALITY_COLORS: Record<string, string> = {
  favorable: "#3a6020", caution: "#a05020", neutral: "#555",
};
const QUALITY_BG: Record<string, string> = {
  favorable: "#e8f5e0", caution: "#f8ede0", neutral: "#f0ede8",
};
const ELEMENT_COLORS: Record<string, string> = {
  water: "#3a5a80", fire: "#8a3a20", earth: "#3a6030", air: "#602080",
};

function groupByDate(events: SkyEvent[]) {
  const map: Record<string, SkyEvent[]> = {};
  for (const e of events) {
    (map[e.date] ??= []).push(e);
  }
  return map;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return "Today";
  if (dateStr === tomorrow) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

const FILTER_TYPES = [
  { id: "all", label: "All" },
  { id: "moon_phase", label: "Moon phases" },
  { id: "crossing", label: "Crossings" },
  { id: "quality_window", label: "Good days" },
  { id: "voc", label: "VOC" },
];

export default function Sky({ testerId, lat = 40.7, lon = -74.0 }: { testerId: string | null; lat?: number; lon?: number }) {
  const [filter, setFilter] = useState("all");
  const [days, setDays] = useState(30);
  const { data: eventsData, isLoading } = useSkyEvents(days, lat, lon);
  const { data: week } = useTidesWeek(days, lat, lon);

  const allEvents = eventsData?.events ?? [];
  const filtered = filter === "all" ? allEvents : allEvents.filter(e => e.type === filter);
  const grouped = groupByDate(filtered);
  const dates = Object.keys(grouped).sort();

  const weekDayMap = new Map((week?.days ?? []).map(d => [d.date, d]));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Topbar */}
      <div style={{ padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #d0cbc3", background: "#ece8e2", flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a" }}>Sky ahead</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "1px solid #d0cbc3", background: "#f0ede8", color: "#555" }}>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
          </select>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ padding: "8px 20px", display: "flex", gap: 4, flexWrap: "wrap", borderBottom: "1px solid #e8e4de", background: "#f4f0ea", flexShrink: 0 }}>
        {FILTER_TYPES.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            fontSize: 9, padding: "3px 9px", borderRadius: 10, border: "1px solid #d0cbc3", cursor: "pointer",
            background: filter === f.id ? "#1a2a3a" : "#fff",
            color: filter === f.id ? "#fff" : "#666", fontWeight: filter === f.id ? 600 : 400,
          }}>
            {f.label}
          </button>
        ))}
        <div style={{ marginLeft: "auto", fontSize: 10, color: "#aaa", lineHeight: "24px" }}>
          {filtered.length} events
        </div>
      </div>

      {/* 30-day quality strip */}
      {filter === "all" && (
        <div style={{ padding: "10px 20px", borderBottom: "1px solid #e8e4de", background: "#faf8f5", flexShrink: 0 }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: "#aaa", marginBottom: 6 }}>Quality at a glance</div>
          <div style={{ display: "flex", gap: 2, overflowX: "auto" }}>
            {(week?.days ?? []).map(day => {
              const ec = ELEMENT_COLORS[day.element ?? "water"] ?? "#888";
              const today = new Date().toISOString().slice(0, 10);
              const isToday = day.date === today;
              const q = day.qualityScore ?? 5;
              const h = Math.max(8, (q / 7) * 28);
              return (
                <div key={day.date} title={`${day.label} — ${day.quality} (${day.element})`} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  minWidth: 22, flexShrink: 0,
                }}>
                  <div style={{ fontSize: 7, color: isToday ? "#b07030" : "#ccc", fontWeight: isToday ? 700 : 400 }}>
                    {new Date(day.date + "T12:00:00").getDate()}
                  </div>
                  <div style={{ width: 14, height: h, borderRadius: 3, background: ec, opacity: 0.7 + (q / 35) }} />
                  {(day.crossings ?? []).length > 0 && (
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#e0a040" }} />
                  )}
                  {day.voidPeriods && (
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#bbb" }} />
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 8, color: "#bbb" }}>
            <span>■ element quality</span>
            <span style={{ color: "#e0a040" }}>● crossing</span>
            <span>● VOC</span>
          </div>
        </div>
      )}

      {/* Event feed */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
        {isLoading && (
          <div style={{ color: "#bbb", fontSize: 12, textAlign: "center", padding: "32px 0" }}>Computing sky events…</div>
        )}

        {!isLoading && dates.length === 0 && (
          <div style={{ color: "#bbb", fontSize: 12, textAlign: "center", padding: "32px 0" }}>No events match this filter.</div>
        )}

        {dates.map(date => {
          const dayEvents = grouped[date];
          const dayData = weekDayMap.get(date);
          const ec = dayData ? (ELEMENT_COLORS[dayData.element] ?? "#888") : "#888";
          const isToday = date === new Date().toISOString().slice(0, 10);
          return (
            <div key={date}>
              {/* Date header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{
                  fontSize: isToday ? 12 : 10, fontWeight: isToday ? 700 : 600,
                  color: isToday ? "#b07030" : "#555",
                }}>
                  {formatDate(date)}
                </div>
                {dayData && (
                  <div style={{ fontSize: 8, color: ec, opacity: 0.8 }}>
                    {dayData.moonSign} · {dayData.element}
                  </div>
                )}
                <div style={{ flex: 1, height: 1, background: "#e8e4de" }} />
              </div>

              {/* Events for this date */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {dayEvents.map((ev, i) => (
                  <EventCard key={i} event={ev} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventCard({ event }: { event: SkyEvent }) {
  const qColor = QUALITY_COLORS[event.quality] ?? "#555";
  const qBg    = QUALITY_BG[event.quality] ?? "#f0ede8";
  return (
    <div style={{
      display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 12px",
      borderRadius: 8, background: "#fff", border: `1px solid ${event.quality === "caution" ? "#f0d8b0" : event.quality === "favorable" ? "#c8e0b8" : "#e8e4de"}`,
    }}>
      <div style={{ fontSize: 16, width: 22, textAlign: "center", flexShrink: 0, marginTop: 1 }}>
        {event.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#1a2a3a" }}>{event.title}</div>
          {event.time && (
            <div style={{ fontSize: 9, color: "#aaa" }}>{event.time}</div>
          )}
        </div>
        {event.subtitle && (
          <div style={{ fontSize: 10, color: "#777", lineHeight: 1.4 }}>{event.subtitle}</div>
        )}
      </div>
      <div style={{
        fontSize: 7, padding: "2px 6px", borderRadius: 4, background: qBg, color: qColor,
        fontWeight: 600, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.4px",
      }}>
        {TYPE_LABELS[event.type] ?? event.type}
      </div>
    </div>
  );
}
