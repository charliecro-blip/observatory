import React, { useState } from "react";
import { useSkyEvents, useTidesWeek } from "@/hooks/useTides";
import type { SkyEvent } from "@/lib/types";

const QUALITY_COLORS: Record<string, string> = {
  favorable: "#3a6020", caution: "#a05020", neutral: "#555",
};
const QUALITY_BG: Record<string, string> = {
  favorable: "#e8f5e0", caution: "#f8ede0", neutral: "#f0ede8",
};
const ELEMENT_COLORS: Record<string, string> = {
  water: "#3a5a80", fire: "#8a3a20", earth: "#3a6030", air: "#602080",
};
const PLANET_COLORS: Record<string, string> = {
  Sun:"#c08020", Moon:"#7080a0", Mercury:"#608060", Venus:"#c06090",
  Mars:"#c04040", Jupiter:"#6040a0", Saturn:"#807060", Uranus:"#3090a0",
};
const PLANET_ICONS: Record<string, string> = {
  Sun:"☉", Moon:"☽", Mercury:"☿", Venus:"♀", Mars:"♂",
  Jupiter:"♃", Saturn:"♄", Uranus:"♅", Neptune:"♆",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return "Today";
  if (dateStr === tomorrow) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

// ── Event interpretation ──────────────────────────────────────────────────────

interface EventDetail { meaning: string; practical: string; domains: string[]; planetColor?: string }

function interpretEvent(event: SkyEvent): EventDetail {
  const title = event.title ?? "";

  if (event.type === "voc") return {
    meaning: "The Moon has made its last major aspect before changing signs, entering a void period. Traditional timing: matters initiated during VOC often don't proceed as intended — plans change or the context shifts.",
    practical: "Rest, completion, creative flow without committing to final versions, routine tasks. Avoid launching, signing, or making major decisions.",
    domains: ["Rest", "Completion", "Routine"],
  };

  if (event.type === "moon_phase") {
    const guides: Record<string, EventDetail> = {
      "New Moon":         { meaning:"Lunar cycle resets. The Moon is dark, aligned with the Sun. A seed-planting moment — potent for new intentions.", practical:"Set intentions for the next 28 days. Inward, initiatory energy.", domains:["Intentions","Inner work"] },
      "Waxing Crescent":  { meaning:"First visible crescent — momentum begins to build.", practical:"Take first steps. Send the early email, make the first call. Energy is tender but building.", domains:["Starting","Outreach"] },
      "First Quarter":    { meaning:"Moon is 90° from the Sun. First tension point — challenges surface that test your intention.", practical:"Push through resistance. Make a decision you've been hesitant about.", domains:["Decisions","Action"] },
      "Waxing Gibbous":   { meaning:"Just past halfway, approaching fullness. Refinement and intensification.", practical:"Review and adjust. Work intensively — conditions support sustained effort.", domains:["Refinement","Sustained effort"] },
      "Full Moon":        { meaning:"Maximum illumination. Emotional energy and visibility peak simultaneously. Cycles reach completion.", practical:"Share, perform, release. Watch for heightened emotional reactivity.", domains:["Visibility","Completion","Social"] },
      "Waning Gibbous":   { meaning:"Just past full — harvest period. Time to understand and share what you've learned.", practical:"Calibrate. What worked? Share wisdom and gratitude. Trim what isn't serving.", domains:["Review","Gratitude"] },
      "Last Quarter":     { meaning:"Release point — structures from the cycle are ready to dissolve.", practical:"Edit, archive, let go. Clear space — physical and digital.", domains:["Releasing","Clearing"] },
      "Waning Crescent":  { meaning:"Light nearly gone. Rest and restoration phase.", practical:"Withdraw from heavy demands. Rest, research, integrate.", domains:["Rest","Integration"] },
    };
    for (const [key, val] of Object.entries(guides)) if (title.includes(key)) return val;
    return { meaning:"A significant lunar phase transition.", practical:"Observe the natural rhythm.", domains:["Awareness"] };
  }

  if (event.type === "ingress") {
    const signEl: Record<string, { element: string; tone: string }> = {
      Aries:{element:"Fire",tone:"bold, initiating"}, Taurus:{element:"Earth",tone:"sensual, grounding"},
      Gemini:{element:"Air",tone:"curious, social"}, Cancer:{element:"Water",tone:"nurturing, emotional"},
      Leo:{element:"Fire",tone:"creative, expressive"}, Virgo:{element:"Earth",tone:"precise, analytical"},
      Libra:{element:"Air",tone:"relational, diplomatic"}, Scorpio:{element:"Water",tone:"intense, transformative"},
      Sagittarius:{element:"Fire",tone:"expansive, adventurous"}, Capricorn:{element:"Earth",tone:"ambitious, strategic"},
      Aquarius:{element:"Air",tone:"innovative, collective"}, Pisces:{element:"Water",tone:"intuitive, compassionate"},
    };
    const match = Object.entries(signEl).find(([sign]) => title.includes(sign));
    const info = match ? match[1] : { element:"?", tone:"shifting" };
    return {
      meaning:`Moon changes signs — emotional weather shifts for ~2.5 days. ${info.element} element: ${info.tone}.`,
      practical:info.element==="Fire"?"Bold action and energy.":info.element==="Earth"?"Grounded, practical work.":info.element==="Air"?"Collaborate and communicate.":"Honor feelings and rest.",
      domains:["Emotional tone","Planning"],
    };
  }

  if (event.type === "crossing") {
    const planets: Record<string, { meaning:string; domains:string[]; color:string }> = {
      Venus:   { meaning:"Relational and aesthetic energy at peak visibility. Beauty, grace, charm heightened.", domains:["Creative work","Social","Launches"], color:"#c06090" },
      Jupiter: { meaning:"Good fortune and expansiveness at its most powerful daily moment. Optimism and reach peak.", domains:["Launches","Pitches","Partnerships"], color:"#6040a0" },
      Mars:    { meaning:"Assertive energy peaks. Powerful for decisive action and bold moves — watch for impatience.", domains:["Decisive action","Physical effort","Confrontation"], color:"#c04040" },
      Sun:     { meaning:"Solar energy at its highest for the day. Reputation, authority, and visibility peak.", domains:["Visibility","Authority","Presentations"], color:"#c08020" },
      Mercury: { meaning:"Mental clarity and communication at sharpest. Excellent for negotiations and complex ideas.", domains:["Communication","Writing","Agreements"], color:"#608060" },
      Moon:    { meaning:"Emotional sensitivity and intuition at a peak moment. Creative and relational work.", domains:["Creative flow","Emotional work"], color:"#7080a0" },
      Saturn:  { meaning:"Discipline and structure at its most powerful. Serious planning and accountability.", domains:["Structure","Long-term planning"], color:"#807060" },
    };
    const entry = Object.entries(planets).find(([p]) => title.includes(p));
    if (entry) {
      const [pName, info] = entry;
      return {
        meaning:`${pName} crosses the chart angle. ${info.meaning}`,
        practical:`A precision window of 10–20 minutes, with a meaningful 1–2 hour window around it.`,
        domains: info.domains, planetColor: info.color,
      };
    }
    return { meaning:"A planet crosses one of the four chart angles.", practical:"Angular crossings mark peak moments for each planetary archetype.", domains:["Timing"] };
  }

  return { meaning:"A notable sky event.", practical:"Observe how this shifts the energy.", domains:["Awareness"] };
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function EventDetailPanel({ event, onClose }: { event: SkyEvent; onClose: () => void }) {
  const detail = interpretEvent(event);
  const qColor = QUALITY_COLORS[event.quality] ?? "#555";
  return (
    <div style={{ position:"absolute", top:0, right:0, bottom:0, width:300, zIndex:50, background:"#fff", borderLeft:"1px solid #d0cbc3", display:"flex", flexDirection:"column", boxShadow:"-4px 0 20px rgba(0,0,0,0.08)" }}>
      <div style={{ padding:"14px 16px", borderBottom:"1px solid #e8e4de", display:"flex", alignItems:"flex-start", gap:10 }}>
        <div style={{ fontSize:22, flexShrink:0, marginTop:2 }}>{event.icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:600, color:"#1a2a3a", lineHeight:1.3 }}>{event.title}</div>
          {event.time && <div style={{ fontSize:10, color:"#aaa", marginTop:2 }}>{event.time}</div>}
        </div>
        <button onClick={onClose} style={{ flexShrink:0, width:24, height:24, borderRadius:"50%", border:"none", background:"#f0ede8", color:"#888", cursor:"pointer", fontSize:12 }}>✕</button>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"16px" }}>
        <div style={{ marginBottom:12 }}>
          <span style={{ fontSize:9, padding:"2px 8px", borderRadius:8, fontWeight:600, textTransform:"uppercase", background:QUALITY_BG[event.quality]??"#f0ede8", color:qColor, border:`1px solid ${qColor}30` }}>
            {event.type?.replace(/_/g," ")} · {event.quality}
          </span>
        </div>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:8.5, textTransform:"uppercase", letterSpacing:"0.6px", color:"#bbb", marginBottom:6 }}>What this means</div>
          <div style={{ fontSize:11.5, color:"#333", lineHeight:1.7 }}>{detail.meaning}</div>
        </div>
        <div style={{ marginBottom:14, padding:"11px 13px", borderRadius:8, background:"#f7f4ef", border:"1px solid #e8e2d8" }}>
          <div style={{ fontSize:8.5, textTransform:"uppercase", letterSpacing:"0.6px", color:"#bbb", marginBottom:5 }}>How to use it</div>
          <div style={{ fontSize:11.5, color:"#555", lineHeight:1.7 }}>{detail.practical}</div>
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
          {detail.domains.map(d => (
            <span key={d} style={{ fontSize:10, padding:"3px 9px", borderRadius:10, border:"1px solid #e0dbd4", background:"#faf8f5", color:"#555" }}>{d}</span>
          ))}
        </div>
      </div>
      <div style={{ padding:"12px 16px", borderTop:"1px solid #e8e4de" }}>
        <button onClick={() => alert(`Plan session: ${event.title} ${event.time ?? ""}`)} style={{
          width:"100%", padding:"9px 0", borderRadius:8, border:"none",
          background:detail.planetColor??"#1a2a3a", color:"#fff", fontSize:11.5, fontWeight:500, cursor:"pointer",
        }}>
          {event.time ? `Plan session at ${event.time}` : "Plan around this event"}
        </button>
      </div>
    </div>
  );
}

// ── Event row (compact) ───────────────────────────────────────────────────────

const ASPECT_COLORS: Record<string, string> = {
  "☌":"#f0b060", "□":"#e06060", "△":"#60a060", "⚹":"#6090d0", "☍":"#e06060",
};

function EventRow({ event, selected, onSelect }: { event: SkyEvent; selected: boolean; onSelect: () => void }) {
  const qColor = QUALITY_COLORS[event.quality] ?? "#555";
  const planetEntry = event.type === "crossing"
    ? Object.entries(PLANET_COLORS).find(([p]) => (event.title ?? "").includes(p))
    : null;
  const aspectColor = event.type === "moon_aspect" ? (ASPECT_COLORS[event.icon] ?? "#7080a0") : null;
  const accentColor = aspectColor ?? (planetEntry ? planetEntry[1] : (event.quality === "favorable" ? "#3a6020" : event.quality === "caution" ? "#a05020" : "#888"));

  return (
    <button onClick={onSelect} style={{
      display:"flex", gap:10, alignItems:"flex-start", padding:"8px 12px",
      background: selected ? "#f5f2ed" : "transparent",
      border:`1px solid ${selected?"#c8c0b0":"transparent"}`,
      borderRadius:7, cursor:"pointer", textAlign:"left", width:"100%",
    }}>
      <div style={{ fontSize:14, width:20, textAlign:"center", flexShrink:0, marginTop:2 }}>{event.icon}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ fontSize:12, fontWeight:500, color:"#1a2a3a" }}>{event.title}</div>
          {event.time && <div style={{ fontSize:9.5, color:accentColor, fontWeight:500 }}>{event.time}</div>}
        </div>
        {event.subtitle && <div style={{ fontSize:10, color:"#888", lineHeight:1.4, marginTop:1 }}>{event.subtitle}</div>}
      </div>
      <div style={{ fontSize:9, color:"#ccc", flexShrink:0, marginTop:4 }}>›</div>
    </button>
  );
}

// ── Quality strip ─────────────────────────────────────────────────────────────

function QualityStrip({ week, days }: { week: any; days: number }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div style={{ padding:"8px 20px 10px", borderBottom:"1px solid #e8e4de", background:"#faf8f5", flexShrink:0 }}>
      <div style={{ fontSize:8, textTransform:"uppercase", letterSpacing:"0.6px", color:"#ccc", marginBottom:5 }}>Quality — next {days} days</div>
      <div style={{ display:"flex", gap:1.5, overflowX:"auto" }}>
        {(week?.days ?? []).map((day: any) => {
          const ec = ELEMENT_COLORS[day.element ?? "water"] ?? "#888";
          const isToday = day.date === today;
          const q = day.qualityScore ?? 5;
          const barH = Math.max(5, (q / 7) * 24);
          return (
            <div key={day.date} title={`${day.label} — ${day.quality} · ${day.moonSign}`}
              style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:1.5, minWidth:18, flexShrink:0 }}>
              <div style={{ fontSize:6, color:isToday?"#b07030":"#ccc", fontWeight:isToday?700:400 }}>
                {new Date(day.date+"T12:00:00").getDate()}
              </div>
              <div style={{ width:10, height:barH, borderRadius:2, background:ec, opacity:0.6+(q/28) }}/>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Sky({ testerId, lat = 40.7, lon = -74.0 }: { testerId: string | null; lat?: number; lon?: number }) {
  const [days, setDays] = useState(30);
  const [selectedEvent, setSelectedEvent] = useState<SkyEvent | null>(null);
  const [showAllCrossings, setShowAllCrossings] = useState(false);
  const { data: eventsData, isLoading } = useSkyEvents(days, lat, lon);
  const { data: week } = useTidesWeek(days, lat, lon);

  const allEvents = eventsData?.events ?? [];
  const weekDayMap = new Map((week?.days ?? []).map((d: any) => [d.date, d]));
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  function handleSelect(ev: SkyEvent) {
    setSelectedEvent(prev => prev === ev ? null : ev);
  }

  // Crossings — only next 4 hours by default
  const allCrossings = allEvents.filter(e => e.type === "crossing" && e.date >= today);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nearCrossings = allCrossings.filter(e => {
    if (e.date !== today || !e.time) return false;
    const [ch, cm] = e.time.split(":").map(Number);
    const crossMin = ch * 60 + (cm ?? 0);
    return crossMin >= nowMinutes - 10 && crossMin <= nowMinutes + 240;
  });
  const futureCrossings = allCrossings.filter(e => {
    if (e.date === today && e.time) {
      const [ch, cm] = e.time.split(":").map(Number);
      return ch * 60 + (cm ?? 0) > nowMinutes + 240;
    }
    return e.date > today;
  });

  // Lunar stream — ingresses + VOC + moon_phase + moon_aspect, sorted by date+time
  const lunarStream = allEvents
    .filter(e => ["ingress","voc","moon_phase","moon_aspect"].includes(e.type) && e.date >= today)
    .sort((a, b) => {
      const da = a.date + (a.time ?? "00:00");
      const db = b.date + (b.time ?? "00:00");
      return da < db ? -1 : da > db ? 1 : 0;
    });

  // Group lunar stream by date for display
  const lunarByDate: Record<string, SkyEvent[]> = {};
  for (const e of lunarStream) (lunarByDate[e.date] ??= []).push(e);

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* Topbar */}
      <div style={{ padding:"10px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid #d0cbc3", background:"#ece8e2", flexShrink:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:"#1a2a3a" }}>Sky ahead</div>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            style={{ fontSize:10, padding:"3px 8px", borderRadius:6, border:"1px solid #d0cbc3", background:"#f0ede8", color:"#555" }}>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </div>

      <QualityStrip week={week} days={days} />

      {/* Main area */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", position:"relative" }}>
        <div style={{ flex:1, overflowY:"auto", padding:"12px 16px", display:"flex", flexDirection:"column", gap:10 }}>
          {isLoading && <div style={{ color:"#bbb", fontSize:12, textAlign:"center", padding:"32px 0" }}>Computing sky events…</div>}

          {/* ── Angular crossings ── */}
          {!isLoading && (
            <Section
              label="Angular crossings"
              icon="⚡"
              accent="#c08020"
              desc="Planets at the chart angles — brief, potent timing peaks"
              defaultOpen={true}
            >
              {/* Near-term crossings (next 4 hours) */}
              {nearCrossings.length === 0 && (
                <div style={{ padding:"8px 12px", fontSize:11, color:"#bbb" }}>
                  No crossings in the next 4 hours.
                </div>
              )}
              {nearCrossings.map((ev, i) => {
                const pEntry = Object.entries(PLANET_COLORS).find(([p]) => (ev.title ?? "").includes(p));
                const pCol = pEntry ? pEntry[1] : "#c08020";
                return (
                  <div key={i} style={{ display:"flex", gap:10, alignItems:"center", padding:"8px 12px", borderBottom:"1px solid #f5f0e8" }}>
                    <div style={{ fontSize:14, width:22, textAlign:"center", flexShrink:0 }}>
                      {(() => {
                        const p = Object.keys(PLANET_ICONS).find(p => (ev.title ?? "").includes(p));
                        return p ? PLANET_ICONS[p] : "⚡";
                      })()}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:pCol }}>{ev.title}</div>
                      {ev.subtitle && <div style={{ fontSize:9.5, color:"#aaa", marginTop:1 }}>{ev.subtitle}</div>}
                    </div>
                    <div style={{ fontSize:11, fontWeight:600, color:pCol, flexShrink:0 }}>{ev.time}</div>
                    <button onClick={() => handleSelect(ev)} style={{ fontSize:9, color:"#bbb", background:"none", border:"none", cursor:"pointer", padding:"2px 6px" }}>›</button>
                  </div>
                );
              })}

              {/* Show more toggle */}
              {futureCrossings.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowAllCrossings(v => !v)}
                    style={{ width:"100%", padding:"8px 12px", background:"none", border:"none", borderTop:"1px solid #f0ede8", cursor:"pointer", fontSize:10, color:"#aaa", textAlign:"left", display:"flex", justifyContent:"space-between" }}
                  >
                    <span>{showAllCrossings ? "Hide upcoming crossings" : `${futureCrossings.length} more crossing${futureCrossings.length > 1 ? "s" : ""} — show all`}</span>
                    <span>{showAllCrossings ? "▲" : "▼"}</span>
                  </button>
                  {showAllCrossings && (() => {
                    const byCrossDate: Record<string, SkyEvent[]> = {};
                    for (const e of futureCrossings) (byCrossDate[e.date] ??= []).push(e);
                    return Object.entries(byCrossDate).sort(([a],[b])=>a<b?-1:1).map(([date, evs]) => (
                      <div key={date}>
                        <div style={{ padding:"5px 12px 3px", fontSize:9, color:"#bbb", background:"#faf8f5", fontWeight:600 }}>
                          {formatDate(date)} · {weekDayMap.get(date)?.moonSign ?? ""}
                        </div>
                        {evs.map((ev, i) => (
                          <EventRow key={i} event={ev} selected={selectedEvent===ev} onSelect={() => handleSelect(ev)}/>
                        ))}
                      </div>
                    ));
                  })()}
                </div>
              )}
            </Section>
          )}

          {/* ── Lunar stream ── */}
          {!isLoading && (
            <Section
              label="Lunar stream"
              icon="☽"
              accent="#5a7090"
              desc="Moon aspects, sign changes, phases, and void periods"
              defaultOpen={true}
            >
              {lunarStream.length === 0 && (
                <div style={{ padding:"8px 12px", fontSize:11, color:"#bbb" }}>No lunar events in this window.</div>
              )}
              {Object.entries(lunarByDate).sort(([a],[b])=>a<b?-1:1).slice(0, 14).map(([date, evs]) => {
                const dayData = weekDayMap.get(date);
                const ec = dayData ? (ELEMENT_COLORS[dayData.element] ?? "#888") : "#888";
                const isToday = date === today;
                return (
                  <div key={date}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 12px 3px", background:"#faf8f5", borderBottom:"1px solid #f0ede8" }}>
                      <div style={{ fontSize:isToday?10:9, fontWeight:isToday?700:600, color:isToday?"#b07030":"#999" }}>
                        {formatDate(date)}
                      </div>
                      {dayData && (
                        <div style={{ fontSize:8.5, color:ec, fontWeight:500 }}>{dayData.moonSign}</div>
                      )}
                      <div style={{ flex:1, height:1, background:"#ece8e2" }}/>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                      {evs.map((ev, i) => (
                        <EventRow key={i} event={ev} selected={selectedEvent===ev} onSelect={() => handleSelect(ev)}/>
                      ))}
                    </div>
                  </div>
                );
              })}
            </Section>
          )}
        </div>

        {/* Detail panel */}
        {selectedEvent && (
          <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
        )}
      </div>
    </div>
  );
}

// ── Reusable collapsible section ──────────────────────────────────────────────

function Section({ label, icon, accent, desc, defaultOpen, children }: {
  label: string; icon: string; accent: string; desc: string; defaultOpen: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border:`1px solid ${accent}28`, borderRadius:10, overflow:"hidden" }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width:"100%", display:"flex", alignItems:"center", gap:10, padding:"11px 14px",
        background: open ? `${accent}10` : `${accent}06`, border:"none", cursor:"pointer", textAlign:"left",
        borderBottom: open ? `1px solid ${accent}18` : "none",
      }}>
        <span style={{ fontSize:15, width:20, textAlign:"center", flexShrink:0 }}>{icon}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11.5, fontWeight:600, color:accent }}>{label}</div>
          <div style={{ fontSize:9.5, color:"#aaa", marginTop:1 }}>{desc}</div>
        </div>
        <span style={{ fontSize:10, color:"#ccc", transform:open?"rotate(90deg)":"none", transition:"transform 0.15s" }}>›</span>
      </button>
      {open && <div style={{ display:"flex", flexDirection:"column" }}>{children}</div>}
    </div>
  );
}
