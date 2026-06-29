import React, { useState } from "react";
import { useTidesNow, useTidesWeek } from "@/hooks/useTides";
import { Tooltip, HelpBadge } from "@/components/Tooltip";
import type { ModuleLogic, ModulePrescription, HourSlot, CalendarDay } from "./types";

const PLANET_ICONS: Record<string, string> = {
  Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀",
  Mars: "♂", Jupiter: "♃", Saturn: "♄",
};
function planetColor(p: string) {
  return { Sun:"#c08020", Moon:"#7080a0", Mercury:"#608060", Venus:"#a06080",
    Mars:"#c04040", Jupiter:"#6040a0", Saturn:"#807060" }[p] ?? "#888";
}
const QUAL_COLORS = { peak:"#3a7040", good:"#5a8060", neutral:"#888", avoid:"#c06040" };

// ── Briefing card ─────────────────────────────────────────────────────────────

export function ModuleBriefing({ presc, taskColors, taskLabels }: {
  presc: ModulePrescription;
  taskColors: Record<string, string>;
  taskLabels: Record<string, string>;
}) {
  const ql = { excellent:"#3a7030", good:"#3a6030", moderate:"#a07030", low:"#8a5030" }[presc.qualityLabel];

  return (
    <div style={{ background:"#fff", border:"1px solid #e0dbd4", borderRadius:12, padding:"18px 20px" }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:12 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.6px", color:"#aaa", marginBottom:5 }}>
            Right now
          </div>
          <div style={{ fontSize:17, fontWeight:600, color:"#1a2a3a", lineHeight:1.3 }}>{presc.headline}</div>
        </div>
        <div style={{ flexShrink:0, padding:"4px 10px", borderRadius:8, fontSize:10, fontWeight:600, background:`${ql}18`, color:ql, border:`1px solid ${ql}35` }}>
          {presc.qualityLabel}
        </div>
      </div>

      {presc.vocWarning && (
        <div style={{ background:"#faf5ee", border:"1px solid #d8cca8", borderLeft:"3px solid #b0a060", borderRadius:6, padding:"8px 12px", marginBottom:12, fontSize:11, color:"#7a6030" }}>
          ◌ Moon void of course — avoid new commitments and decisions that need to stick.
        </div>
      )}

      {presc.alertBanner && (
        <div style={{ background:presc.alertBanner.bg, border:`1px solid ${presc.alertBanner.color}50`, borderLeft:`3px solid ${presc.alertBanner.color}`, borderRadius:6, padding:"8px 12px", marginBottom:12, fontSize:11, color:presc.alertBanner.color }}>
          {presc.alertBanner.text}
        </div>
      )}

      <div style={{ fontSize:11.5, color:"#555", lineHeight:1.65, marginBottom:14 }}>{presc.summary}</div>

      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:presc.opportunities.length ? 10 : 0 }}>
        <div style={{ fontSize:10, color:"#aaa", alignSelf:"center" }}>Focus:</div>
        {[presc.primaryTask, ...presc.secondaryTasks].map((t, i) => {
          const col = taskColors[t] ?? "#888";
          return (
            <span key={t} style={{
              display:"inline-flex", alignItems:"center", padding: i === 0 ? "4px 11px" : "2px 9px",
              borderRadius:10, fontSize: i === 0 ? 11 : 9.5, fontWeight:500,
              background:`${col}18`, color:col, border:`1px solid ${col}40`,
            }}>
              {taskLabels[t] ?? t}
            </span>
          );
        })}
      </div>

      {presc.opportunities.length > 0 && (
        <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:4 }}>
          {presc.opportunities.map((o, i) => (
            <div key={i} style={{ fontSize:10.5, color:"#3a6030", display:"flex", gap:6 }}>
              <span>✓</span><span>{o}</span>
            </div>
          ))}
        </div>
      )}
      {presc.cautions.length > 0 && (
        <div style={{ marginTop:6, display:"flex", flexDirection:"column", gap:4 }}>
          {presc.cautions.map((c, i) => (
            <div key={i} style={{ fontSize:10.5, color:"#c07050", display:"flex", gap:6 }}>
              <span>✗</span><span>{c}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Hourly schedule ───────────────────────────────────────────────────────────

export function ModuleHourly({ slots, taskColors, taskLabels }: {
  slots: HourSlot[];
  taskColors: Record<string, string>;
  taskLabels: Record<string, string>;
}) {
  return (
    <div style={{ background:"#fff", border:"1px solid #e0dbd4", borderRadius:12, padding:"16px 20px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:600 }}>Hour by hour</div>
        <HelpBadge term="planetaryHour" />
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
        {slots.map((h, i) => {
          const pCol = planetColor(h.planet);
          const taskCol = taskColors[h.task] ?? "#888";
          const qCol = QUAL_COLORS[h.quality];
          return (
            <Tooltip key={i} content={
              <div>
                <div style={{ fontWeight:600, marginBottom:4, color:"#fff" }}>{PLANET_ICONS[h.planet]} {h.planet} hour — {h.taskLabel}</div>
                <div style={{ fontSize:10, color:"#b0aaa4", lineHeight:1.55 }}>{h.note}</div>
              </div>
            } width={240}>
              <div style={{
                display:"flex", alignItems:"center", gap:10, padding:"8px 10px",
                borderRadius:7, cursor:"help",
                background: h.isCurrent ? "#f8f5f0" : "transparent",
                border: h.isCurrent ? "1px solid #e0d8cc" : "1px solid transparent",
              }}>
                <div style={{ width:26, height:26, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, background:`${pCol}20`, color:pCol }}>
                  {PLANET_ICONS[h.planet] ?? "○"}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:10, color:"#aaa", fontVariantNumeric:"tabular-nums", minWidth:38 }}>{h.time}</span>
                    <span style={{ fontSize:11, fontWeight:600, color:"#333" }}>{h.planet}</span>
                    {h.isCurrent && <span style={{ fontSize:8, background:"#1a2a3a", color:"#fff", padding:"1px 5px", borderRadius:4 }}>NOW</span>}
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                  <div style={{ width:5, height:5, borderRadius:"50%", background:qCol }} />
                </div>
                <span style={{ fontSize:9.5, padding:"2px 8px", borderRadius:8, background:`${taskCol}18`, color:taskCol, border:`1px solid ${taskCol}30`, flexShrink:0 }}>
                  {taskLabels[h.task] ?? h.task}
                </span>
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

// ── Calendar strip ────────────────────────────────────────────────────────────

export function ModuleCalendar({ days }: { days: CalendarDay[] }) {
  const [selected, setSelected] = useState<CalendarDay | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ background:"#fff", border:"1px solid #e0dbd4", borderRadius:12, padding:"16px 20px" }}>
      <div style={{ fontSize:13, fontWeight:600, marginBottom:14 }}>14-day view</div>
      <div style={{ display:"flex", gap:3, overflowX:"auto", paddingBottom:8, marginBottom:12 }}>
        {days.map(d => {
          const isToday = d.date === today;
          const col = d.color;
          const isSelected = selected?.date === d.date;
          return (
            <button key={d.date} onClick={() => setSelected(isSelected ? null : d)} style={{
              display:"flex", flexDirection:"column", alignItems:"center", gap:3,
              minWidth:42, padding:"8px 4px", borderRadius:8, border:"2px solid",
              borderColor: isSelected ? col : isToday ? "#1a2a3a" : "transparent",
              background: isSelected ? `${col}18` : isToday ? "#f0ede8" : "#faf8f5",
              cursor:"pointer",
            }}>
              <div style={{ fontSize:8.5, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.4px" }}>{d.label}</div>
              <div style={{ fontSize:11, fontWeight: isToday ? 700 : 500, color: isToday ? "#1a2a3a" : "#444" }}>
                {new Date(d.date + "T12:00:00").getDate()}
              </div>
              <div style={{ width:6, height:6, borderRadius:"50%", background:col }} />
              <div style={{ width:28, height:3, borderRadius:2, background:"#e8e4de" }}>
                <div style={{ height:"100%", width:`${(d.qualityScore/7)*100}%`, background:col, borderRadius:2 }} />
              </div>
              {d.voc && <div style={{ fontSize:6.5, color:"#b0a060" }}>VOC</div>}
            </button>
          );
        })}
      </div>

      {selected && (
        <div style={{ padding:"12px 14px", borderRadius:9, background:`${selected.color}10`, border:`1px solid ${selected.color}30` }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
            <div style={{ fontSize:13, fontWeight:600 }}>{selected.dayName}</div>
            <span style={{ fontSize:10, padding:"2px 9px", borderRadius:8, background:selected.color, color:"#fff", fontWeight:500 }}>
              {selected.roleLabel}
            </span>
            {selected.voc && <span style={{ fontSize:9, color:"#b0a060" }}>VOC periods</span>}
          </div>
          <div style={{ fontSize:11, color:"#555", lineHeight:1.55, marginBottom:8 }}>{selected.note}</div>
          <div style={{ display:"flex", gap:8, fontSize:10, color:"#888" }}>
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

// ── Complete module wrapper ───────────────────────────────────────────────────

export function ModuleShell({
  testerId, lat, lon, logic,
  extraSections,
}: {
  testerId: string | null;
  lat: number;
  lon: number;
  logic: ModuleLogic;
  extraSections?: React.ReactNode;
}) {
  const { data: now } = useTidesNow(testerId, lat, lon);
  const { data: weekData } = useTidesWeek(14, lat, lon);

  // Normalize now into a flat shape for logic functions
  const flatNow = now ? {
    ...now,
    element: (now.element as any)?.element ?? now.element ?? "air",
    voidOfCourse: now.voc?.isVOC ?? false,
    qualityScore: now.qualityScore ?? 4,
  } : undefined;
  const presc = logic.buildPrescription(flatNow);

  // Build hour slots from now data
  const slots: HourSlot[] = [];
  if (flatNow?.planetaryHour) {
    const cur = flatNow.planetaryHour;
    const def = logic.planetTasks[cur.planet];
    slots.push({
      time: cur.began, planet: cur.planet, isCurrent: true,
      task: def?.task ?? "rest", taskLabel: def?.label ?? "Rest",
      note: def?.note ?? "", quality: def?.quality ?? "neutral",
    });
  }
  for (const h of (flatNow?.upcomingHours ?? []).slice(0, 6)) {
    const def = logic.planetTasks[h.planet];
    slots.push({
      time: h.time, planet: h.planet, isCurrent: false,
      task: def?.task ?? "rest", taskLabel: def?.label ?? "Rest",
      note: def?.note ?? "", quality: def?.quality ?? "neutral",
    });
  }

  // Build calendar
  const calDays: CalendarDay[] = (weekData?.days ?? []).map(d => {
    const role = logic.buildCalendarDay(d);
    const date = new Date(d.date + "T12:00:00");
    return {
      date: d.date,
      label: date.toLocaleDateString("en-US", { weekday:"short" }),
      dayName: date.toLocaleDateString("en-US", { weekday:"long" }),
      element: d.element ?? "water",
      biodynamicType: d.biodynamicType ?? "leaf",
      qualityScore: d.qualityScore ?? 4,
      voc: d.voidPeriods ?? false,
      ...role,
    };
  });

  // Legend for calendar
  const roles = [...new Set(calDays.map(d => d.role))];
  const roleColorMap: Record<string, string> = {};
  calDays.forEach(d => { roleColorMap[d.role] = d.color; });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <ModuleBriefing presc={presc} taskColors={logic.taskColors} taskLabels={logic.taskLabels} />

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <ModuleHourly slots={slots} taskColors={logic.taskColors} taskLabels={logic.taskLabels} />
        <div style={{ background:"#fff", border:"1px solid #e0dbd4", borderRadius:12, padding:"16px 20px" }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>Day roles</div>
          {roles.map(r => {
            const day = calDays.find(d => d.role === r);
            return day ? (
              <div key={r} style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:10 }}>
                <div style={{ width:7, height:7, borderRadius:"50%", background:day.color, flexShrink:0, marginTop:3 }} />
                <div>
                  <div style={{ fontSize:11, fontWeight:600, color:"#333" }}>{day.roleLabel}</div>
                  <div style={{ fontSize:10, color:"#aaa", lineHeight:1.4 }}>{day.note}</div>
                </div>
              </div>
            ) : null;
          })}
        </div>
      </div>

      <ModuleCalendar days={calDays} />
      {extraSections}
    </div>
  );
}
