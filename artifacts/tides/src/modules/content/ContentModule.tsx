import React, { useState } from "react";
import { useTidesNow, useTidesWeek, useSkyEvents } from "@/hooks/useTides";
import { HelpBadge, Tooltip } from "@/components/Tooltip";
import {
  buildContentPrescription,
  buildHourlySchedule,
  buildContentCalendar,
  extractLaunchWindows,
  TASK_LABELS,
  TASK_COLORS,
  ROLE_COLORS,
  type ContentTask,
  type ContentDay,
} from "./contentLogic";

const PLANET_ICONS: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀",
  Mars: "♂", Jupiter: "♃", Saturn: "♄",
};

function planetColor(p: string): string {
  return { Sun:"#c08020", Moon:"#7080a0", Mercury:"#608060", Venus:"#a06080",
    Mars:"#c04040", Jupiter:"#6040a0", Saturn:"#807060" }[p] ?? "#888";
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function TaskPill({ task, size = "md" }: { task: ContentTask; size?: "sm" | "md" }) {
  const color = TASK_COLORS[task];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: size === "sm" ? "2px 8px" : "4px 11px",
      borderRadius: 10, fontSize: size === "sm" ? 9.5 : 11, fontWeight: 500,
      background: `${color}18`, color, border: `1px solid ${color}40`,
    }}>
      {TASK_LABELS[task]}
    </span>
  );
}

// ── Briefing card ─────────────────────────────────────────────────────────────

function BriefingCard({ now, lat, lon }: { now: any; lat: number; lon: number }) {
  const presc = buildContentPrescription(now);
  const ql = { excellent: "#3a7030", good: "#3a6030", moderate: "#a07030", low: "#8a5030" }[presc.qualityLabel];

  return (
    <div style={{ background: "#fff", border: "1px solid #e0dbd4", borderRadius: 12, padding: "18px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.6px", color: "#aaa", marginBottom: 5 }}>Today's content timing</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: "#1a2a3a", lineHeight: 1.3 }}>{presc.headline}</div>
        </div>
        <div style={{
          flexShrink: 0, padding: "4px 10px", borderRadius: 8, fontSize: 10, fontWeight: 600,
          background: `${ql}18`, color: ql, border: `1px solid ${ql}35`,
        }}>
          {presc.qualityLabel}
        </div>
      </div>

      {/* VOC warning */}
      {presc.vocWarning && (
        <div style={{
          background: "#faf5ee", border: "1px solid #d8cca8", borderLeft: "3px solid #b0a060",
          borderRadius: 6, padding: "8px 12px", marginBottom: 12, fontSize: 11, color: "#7a6030",
        }}>
          ◌ Moon void of course — skip publishing and pitching. Edit and research are your friends right now.
        </div>
      )}

      {/* Summary */}
      <div style={{ fontSize: 11.5, color: "#555", lineHeight: 1.65, marginBottom: 14 }}>
        {presc.summary}
      </div>

      {/* Task recommendations */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "#aaa", alignSelf: "center" }}>Focus on:</div>
        <TaskPill task={presc.primaryTask} />
        {presc.secondaryTasks.map(t => <TaskPill key={t} task={t} size="sm" />)}
      </div>

      {/* Best formats */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ fontSize: 10, color: "#aaa" }}>Best formats:</div>
        {presc.bestFormats.map(f => (
          <span key={f} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: "#e8e4de", color: "#555" }}>
            {f}
          </span>
        ))}
        {presc.avoidFormats.length > 0 && <>
          <div style={{ fontSize: 10, color: "#c07050", marginLeft: 4 }}>Avoid:</div>
          {presc.avoidFormats.map(f => (
            <span key={f} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 8, background: "#f5ece8", color: "#c07050", textDecoration: "line-through" }}>
              {f}
            </span>
          ))}
        </>}
      </div>

      {presc.avoid.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 10, color: "#c07050" }}>
          ✗ {presc.avoid.join(" · ")}
        </div>
      )}

      {presc.launchWindowOpen && (
        <div style={{
          marginTop: 12, padding: "7px 12px", borderRadius: 8, background: "#f8f2ff",
          border: "1px solid #c0a0d8", fontSize: 11, color: "#6030a0",
        }}>
          ✦ Launch window open — favorable conditions for publishing and sharing widely
        </div>
      )}
    </div>
  );
}

// ── Hourly schedule ───────────────────────────────────────────────────────────

function HourlySchedule({ now }: { now: any }) {
  const hours = buildHourlySchedule(now);
  const QUAL_COLORS = { peak: "#3a7040", good: "#5a8060", neutral: "#888", avoid: "#c06040" };

  return (
    <div style={{ background: "#fff", border: "1px solid #e0dbd4", borderRadius: 12, padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Hour-by-hour</div>
        <HelpBadge term="planetaryHour" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {hours.map((h, i) => {
          const isNow = i === 0;
          const pColor = planetColor(h.planet);
          const qColor = QUAL_COLORS[h.quality];
          return (
            <Tooltip
              key={i}
              content={
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4, color: "#fff" }}>{PLANET_ICONS[h.planet]} {h.planet} hour — {h.taskLabel}</div>
                  <div style={{ fontSize: 10, color: "#b0aaa4", lineHeight: 1.55 }}>{h.note}</div>
                </div>
              }
              width={240}
            >
              <div style={{
                display: "flex", alignItems: "center", gap: 12, padding: "9px 10px",
                borderRadius: 7, cursor: "help",
                background: isNow ? "#f8f5f0" : "transparent",
                border: isNow ? "1px solid #e0d8cc" : "1px solid transparent",
                marginBottom: 2,
              }}>
                {/* Planet orb */}
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, background: `${pColor}20`, color: pColor,
                }}>
                  {PLANET_ICONS[h.planet] ?? "○"}
                </div>

                {/* Time + task */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "#aaa", fontVariantNumeric: "tabular-nums", minWidth: 40 }}>{h.time}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#333" }}>{h.planet}</span>
                    {isNow && <span style={{ fontSize: 8, background: "#1a2a3a", color: "#fff", padding: "1px 5px", borderRadius: 4 }}>NOW</span>}
                  </div>
                  <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>{h.taskLabel}</div>
                </div>

                {/* Quality indicator */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: qColor }} />
                  <span style={{ fontSize: 9, color: qColor, textTransform: "uppercase", letterSpacing: "0.4px" }}>{h.quality}</span>
                </div>

                {/* Task pill */}
                <TaskPill task={h.task} size="sm" />
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

// ── 14-day content calendar ───────────────────────────────────────────────────

function ContentCalendar({ lat, lon }: { lat: number; lon: number }) {
  const { data: weekData } = useTidesWeek(14, lat, lon);
  const [selected, setSelected] = useState<ContentDay | null>(null);
  const days = buildContentCalendar(weekData?.days ?? []);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ background: "#fff", border: "1px solid #e0dbd4", borderRadius: 12, padding: "16px 20px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>14-day content calendar</div>

      {/* Calendar strip */}
      <div style={{ display: "flex", gap: 3, overflowX: "auto", paddingBottom: 8, marginBottom: 12 }}>
        {days.map(d => {
          const isToday = d.date === today;
          const col = ROLE_COLORS[d.role];
          return (
            <button
              key={d.date}
              onClick={() => setSelected(selected?.date === d.date ? null : d)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                minWidth: 42, padding: "8px 4px", borderRadius: 8, border: "2px solid",
                borderColor: selected?.date === d.date ? col : isToday ? "#1a2a3a" : "transparent",
                background: selected?.date === d.date ? `${col}18` : isToday ? "#f0ede8" : "#faf8f5",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 8.5, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.4px" }}>{d.label}</div>
              <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 500, color: isToday ? "#1a2a3a" : "#444" }}>
                {new Date(d.date + "T12:00:00").getDate()}
              </div>
              {/* Role dot */}
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: col }} />
              {/* Quality bar */}
              <div style={{ width: 28, height: 3, borderRadius: 2, background: "#e8e4de" }}>
                <div style={{ height: "100%", width: `${(d.qualityScore / 7) * 100}%`, background: col, borderRadius: 2 }} />
              </div>
              {d.voc && <div style={{ fontSize: 6.5, color: "#b0a060" }}>VOC</div>}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: selected ? 12 : 0 }}>
        {(Object.entries(ROLE_COLORS) as [ContentDay["role"], string][]).map(([role, color]) => (
          <div key={role} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9.5, color: "#888" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
            {role}
          </div>
        ))}
      </div>

      {/* Day detail */}
      {selected && (
        <div style={{
          marginTop: 12, padding: "12px 14px", borderRadius: 9,
          background: `${ROLE_COLORS[selected.role]}10`,
          border: `1px solid ${ROLE_COLORS[selected.role]}30`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1a2a3a" }}>{selected.dayName}</div>
            <span style={{
              fontSize: 10, padding: "2px 9px", borderRadius: 8,
              background: ROLE_COLORS[selected.role], color: "#fff", fontWeight: 500,
            }}>{selected.roleLabel}</span>
            {selected.voc && <span style={{ fontSize: 9, color: "#b0a060" }}>VOC periods</span>}
          </div>
          <div style={{ fontSize: 11, color: "#555", lineHeight: 1.55, marginBottom: 8 }}>{selected.note}</div>
          <div style={{ display: "flex", gap: 8, fontSize: 10, color: "#888" }}>
            <span>{selected.element} element</span>
            <span>·</span>
            <span>{selected.biodynamicType} day</span>
            <span>·</span>
            <span>quality {selected.qualityScore}/7</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Launch windows ────────────────────────────────────────────────────────────

function LaunchWindows({ lat, lon }: { lat: number; lon: number }) {
  const { data } = useSkyEvents(21, lat, lon);
  const windows = extractLaunchWindows(data?.events ?? []);

  if (windows.length === 0) return null;

  return (
    <div style={{ background: "#fff", border: "1px solid #e0dbd4", borderRadius: 12, padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Upcoming launch windows</div>
        <HelpBadge term="benefic" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {windows.map((w, i) => {
          const isStrong = w.strength === "strong";
          return (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 12px",
              borderRadius: 8, background: isStrong ? "#fdf8ff" : "#faf8f5",
              border: `1px solid ${isStrong ? "#c0a0d0" : "#e0dbd4"}`,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, background: isStrong ? "#c0a0d020" : "#e8e4de",
                color: isStrong ? "#6030a0" : "#888",
              }}>
                {PLANET_ICONS[w.planet] ?? "✦"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#1a2a3a", marginBottom: 2 }}>{w.headline}</div>
                <div style={{ fontSize: 10, color: "#aaa" }}>{w.timeLabel}</div>
              </div>
              {isStrong && (
                <div style={{ fontSize: 8, padding: "2px 7px", borderRadius: 6, background: "#c0a0d020", color: "#6030a0", fontWeight: 600, flexShrink: 0 }}>
                  STRONG
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, fontSize: 10, color: "#aaa", lineHeight: 1.5 }}>
        Venus and Jupiter crossing the Ascendant or Midheaven are peak windows for publishing, launching, and pitching. Sun at Midheaven marks authority and public-facing visibility peaks.
      </div>
    </div>
  );
}

// ── Platform guidance card ────────────────────────────────────────────────────

const PLATFORM_GUIDANCE: Record<string, { planet: string; task: string; note: string }> = {
  "Written (blog/newsletter)": { planet: "Mercury", task: "draft",   note: "Mercury hours for writing and editing. Saturn for structure and SEO." },
  "Short-form (social/threads)": { planet: "Air signs", task: "shortform", note: "Air element days (Gemini, Libra, Aquarius moon) for varied, social content." },
  "Video (YT/Reels)":         { planet: "Sun",     task: "publish",  note: "Sun hours for presence and authority on camera. Jupiter for reach." },
  "Audio (podcast)":          { planet: "Mercury", task: "draft",    note: "Mercury + air element days for fluent spoken word." },
  "Visual/Design":            { planet: "Venus",   task: "design",   note: "Venus hours and flower biodynamic days for peak aesthetic output." },
  "Courses/Long content":     { planet: "Jupiter", task: "ideate",   note: "Jupiter hours for expansive teaching. Saturn for structure and completion." },
};

function PlatformGuidance({ now }: { now: any }) {
  const planet = now?.planetaryHour?.planet ?? "Mercury";
  const element = now?.element?.element ?? "air";
  const bio = now?.biodynamicType ?? "flower";

  return (
    <div style={{ background: "#fff", border: "1px solid #e0dbd4", borderRadius: 12, padding: "16px 20px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>By content format</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {Object.entries(PLATFORM_GUIDANCE).map(([format, info]) => {
          const isActive =
            (info.planet === planet) ||
            (info.planet === "Air signs" && element === "air") ||
            (info.task === "design" && bio === "flower");
          return (
            <div key={format} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
              borderRadius: 7, background: isActive ? "#f8f5f0" : "#faf8f5",
              border: `1px solid ${isActive ? "#d8d0c0" : "#eeebe6"}`,
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                background: isActive ? "#c08030" : "#ccc",
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: isActive ? 600 : 400, color: isActive ? "#1a2a3a" : "#666" }}>
                  {format}
                </div>
                <div style={{ fontSize: 9.5, color: "#aaa", marginTop: 1 }}>{info.note}</div>
              </div>
              {isActive && (
                <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 6, background: "#d8c8a8", color: "#6a4a10", fontWeight: 600 }}>
                  NOW
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ContentModule ────────────────────────────────────────────────────────

export default function ContentModule({ testerId, lat, lon }: { testerId: string | null; lat: number; lon: number }) {
  const { data: now } = useTidesNow(testerId, lat, lon);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <BriefingCard now={now} lat={lat} lon={lon} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <HourlySchedule now={now} />
        <PlatformGuidance now={now} />
      </div>

      <ContentCalendar lat={lat} lon={lon} />
      <LaunchWindows lat={lat} lon={lon} />
    </div>
  );
}
