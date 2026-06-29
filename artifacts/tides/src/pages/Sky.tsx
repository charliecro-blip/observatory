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

// ── Event interpretation library ─────────────────────────────────────────────

interface EventDetail {
  meaning: string;
  practical: string;
  domains: string[];
  planetColor?: string;
}

function interpretEvent(event: SkyEvent): EventDetail {
  const title = event.title ?? "";
  const subtitle = event.subtitle ?? "";

  if (event.type === "voc") return {
    meaning: "The Moon has made its last major aspect before changing signs, entering a 'void' period. Astrological tradition holds that matters initiated during void-of-course tend to 'come to nothing' — plans change, the context shifts, or the endeavor doesn't reach its intended form.",
    practical: "Use this window for rest, completion, routine tasks, creative flow (without committing to final versions), and anything that doesn't need to 'stick.' Avoid signing contracts, launching projects, or making major decisions.",
    domains: ["Planning", "Decisions", "Creativity"],
  };

  if (event.type === "moon_phase") {
    const phaseGuides: Record<string, EventDetail> = {
      "New Moon": { meaning:"The lunar cycle resets. The Moon is dark, aligned with the Sun, making it invisible. Astrologically, this is the beginning of a new emotional and manifestation cycle — a potent seed-planting moment.", practical:"Set intentions for the next 28 days. Begin journaling, planning, and clarifying what you want. Avoid external pressure — this is an inward, initiatory moment.", domains:["Intentions","Planning","Inner work"] },
      "Waxing Crescent": { meaning:"The first visible crescent emerges after new moon. Momentum begins to build as the Moon separates from the Sun. The 'seed' of the new moon begins to sprout.", practical:"Take first steps. Send the early email, write the first draft, make the first call. Energy is tender but building — act with lightness, not force.", domains:["Starting","Outreach","Creative drafts"] },
      "First Quarter": { meaning:"The Moon is 90° from the Sun — the first major tension point of the cycle. Challenges surface that test the intention set at the new moon.", practical:"Push through resistance. Make a decision you've been hesitant about. The discomfort is productive — this is the moment to commit.", domains:["Decisions","Action","Overcoming inertia"] },
      "Waxing Gibbous": { meaning:"Just past the halfway point, the Moon approaches fullness. Energy accumulates rapidly. This is a period of refinement and intensification before the peak.", practical:"Review and adjust your direction without abandoning it. Continue building. Work intensively — conditions support sustained effort.", domains:["Refinement","Momentum","Sustained effort"] },
      "Full Moon": { meaning:"The Moon opposes the Sun at maximum illumination. Emotional energy and visibility peak simultaneously. Cycles reach completion and things come to light.", practical:"Share, perform, release, and celebrate. Present work publicly. Watch for heightened emotional reactivity in yourself and others — take a breath before responding.", domains:["Visibility","Sharing","Completion","Social"] },
      "Waning Gibbous": { meaning:"Just past full, the Moon begins its gradual diminishment. The harvest period — time to understand and share what you've learned.", practical:"Calibrate and deepen. What worked? What needs attention? Share wisdom and gratitude. Trim what isn't serving the work.", domains:["Review","Gratitude","Sharing learnings"] },
      "Last Quarter": { meaning:"The Moon squares the Sun again, now waning. A release point — structures from the cycle are ready to be dissolved.", practical:"Edit, archive, let go. This is an excellent time to divest, unsubscribe, end habits that no longer fit, and clear physical and digital space.", domains:["Editing","Releasing","Divesting","Clearing"] },
      "Waning Crescent": { meaning:"The Moon's light is nearly gone. The field is fallow. This is the rest and restoration phase of the lunar cycle.", practical:"Withdraw from heavy external demands. Rest, research, absorb, and allow integration. Creativity doesn't require output right now.", domains:["Rest","Research","Integration"] },
      "Balsamic Moon": { meaning:"The final, darkest sliver before new moon. Surrender time — the deepest inward phase of the cycle.", practical:"Rest completely. Don't start anything new. Let the subconscious work. Trust that the next cycle will bring clarity.", domains:["Rest","Surrender","Inner work"] },
    };
    for (const [key, val] of Object.entries(phaseGuides)) {
      if (title.includes(key)) return val;
    }
    return { meaning:"A significant lunar phase transition marks a shift in the emotional and energetic quality of the coming days.", practical:"Observe the natural rhythm of the cycle. Note what themes are surfacing for you personally.", domains:["Cycles","Awareness"] };
  }

  if (event.type === "ingress") {
    const signEl: Record<string, { element: string; tone: string }> = {
      Aries:     { element:"Fire",  tone:"bold, initiating, competitive" },
      Taurus:    { element:"Earth", tone:"sensual, patient, grounding" },
      Gemini:    { element:"Air",   tone:"curious, social, eclectic" },
      Cancer:    { element:"Water", tone:"nurturing, emotional, domestic" },
      Leo:       { element:"Fire",  tone:"creative, expressive, magnanimous" },
      Virgo:     { element:"Earth", tone:"precise, analytical, health-focused" },
      Libra:     { element:"Air",   tone:"relational, aesthetic, diplomatic" },
      Scorpio:   { element:"Water", tone:"intense, investigative, transformative" },
      Sagittarius:{ element:"Fire", tone:"philosophical, expansive, adventurous" },
      Capricorn: { element:"Earth", tone:"ambitious, disciplined, strategic" },
      Aquarius:  { element:"Air",   tone:"innovative, collective, unconventional" },
      Pisces:    { element:"Water", tone:"intuitive, dreamy, compassionate" },
    };
    const match = Object.entries(signEl).find(([sign]) => title.includes(sign));
    const info = match ? match[1] : { element:"unknown", tone:"shifting" };
    return {
      meaning:`The Moon changes signs, shifting emotional weather for the next ~2.5 days. ${info.element} element energy takes hold — ${info.tone}.`,
      practical:`Tune into the new sign's quality. ${info.element === "Fire" ? "Take bold action and bring energy to projects." : info.element === "Earth" ? "Focus on grounded, practical, and tangible work." : info.element === "Air" ? "Collaborate, communicate, and make connections." : "Honor feelings, rest, and creative intuition."}`,
      domains:["Emotional tone","Planning","Social"],
    };
  }

  if (event.type === "crossing") {
    const planets: Record<string, { meaning: string; domains: string[]; color: string }> = {
      Venus:   { meaning:"Venus at an angle brings relational and aesthetic energy to its peak moment of visibility for the day. Beauty, grace, and charm are heightened — you are seen through a Venusian lens.", domains:["Creative work","Social","Launches","Public image"], color:"#a06080" },
      Jupiter: { meaning:"Jupiter at an angle amplifies good fortune and expansiveness at its most powerful daily moment. Optimism, reach, and abundance are at their peak.", domains:["Launches","Pitches","Ambitious asks","Partnerships"], color:"#6040a0" },
      Mars:    { meaning:"Mars at an angle peaks in assertive energy. This is a powerful moment for decisive action, cutting through resistance, and bold moves — but watch for impatience.", domains:["Decisive action","Confronting obstacles","Physical effort"], color:"#c04040" },
      Sun:     { meaning:"The Sun exactly at an angle (especially the MC) marks the highest point of solar energy for the day. Reputation, authority, and public visibility peak.", domains:["Visibility","Authority","Public presentations"], color:"#c08020" },
      Mercury: { meaning:"Mercury at an angle heightens mental clarity and communication at its sharpest point. Excellent for negotiations, presentations, and articulating complex ideas.", domains:["Communication","Negotiations","Writing","Agreements"], color:"#608060" },
      Moon:    { meaning:"The Moon at an angle brings emotional sensitivity and intuition to a peak moment. Useful for creative and relational work; less ideal for purely rational decisions.", domains:["Creative flow","Emotional work","Intuition"], color:"#7080a0" },
      Saturn:  { meaning:"Saturn at an angle sharpens discipline and structure at its most powerful daily moment. Best for serious long-term planning, accountability, and difficult conversations.", domains:["Structure","Long-term planning","Serious commitments"], color:"#807060" },
    };
    const angle = title.includes("ASC") || subtitle.includes("ASC") ? "ASC" : "MC";
    const entry = Object.entries(planets).find(([p]) => title.includes(p) || subtitle.includes(p));
    if (entry) {
      const [pName, info] = entry;
      return {
        meaning:`${pName} crosses the ${angle === "ASC" ? "Ascendant (eastern horizon)" : "Midheaven (top of the sky)"}. ${info.meaning}`,
        practical:`This is a ${angle === "MC" ? "peak visibility and reputation" : "peak personal energy and presence"} window — a precision moment lasting roughly 10–20 minutes, with a meaningful window of 1–2 hours.`,
        domains: info.domains,
        planetColor: info.color,
      };
    }
    return {
      meaning:"A planet crosses one of the four most powerful angles of the chart, creating a brief but potent window of that planet's energy.",
      practical:"Pay attention to this window — angular crossings mark the strongest daily moments for each planetary archetype.",
      domains:["Timing","Energy peaks"],
    };
  }

  if (event.type === "quality_window") return {
    meaning:"Multiple timing factors align simultaneously — planetary hour quality, biodynamic day type, lunar phase, and elemental energy all support each other. These stacked conditions create rare days of elevated resonance.",
    practical:"Prioritize ambitious, high-value work for this window. Launch, create, connect, and act on things that matter. These conditions are worth noting in advance.",
    domains:["All domains","Launches","Creative work","Decisions"],
  };

  return {
    meaning:"A notable sky event that shifts the quality or character of the timing environment.",
    practical:"Observe how this event influences the energy of the day.",
    domains:["Awareness","Timing"],
  };
}

// ── Event detail panel ────────────────────────────────────────────────────────

function EventDetailPanel({ event, onClose }: { event: SkyEvent; onClose: () => void }) {
  const detail = interpretEvent(event);
  const qColor = QUALITY_COLORS[event.quality] ?? "#555";

  function handleStartSession() {
    const msg = event.time
      ? `Starting a session timed for: ${event.title} at ${event.time}`
      : `Starting a session around: ${event.title}`;
    alert(msg); // Placeholder — integrate with SessionTimer when desired
  }

  return (
    <div style={{
      position:"absolute", top:0, right:0, bottom:0, width:320, zIndex:50,
      background:"#fff", borderLeft:"1px solid #d0cbc3",
      display:"flex", flexDirection:"column", boxShadow:"-4px 0 20px rgba(0,0,0,0.08)",
    }}>
      {/* Header */}
      <div style={{ padding:"14px 16px", borderBottom:"1px solid #e8e4de", display:"flex", alignItems:"flex-start", gap:10 }}>
        <div style={{ fontSize:22, flexShrink:0, marginTop:2 }}>{event.icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:600, color:"#1a2a3a", lineHeight:1.3 }}>{event.title}</div>
          {event.time && <div style={{ fontSize:10, color:"#aaa", marginTop:2 }}>{event.time}</div>}
        </div>
        <button onClick={onClose} style={{
          flexShrink:0, width:24, height:24, borderRadius:"50%", border:"none",
          background:"#f0ede8", color:"#888", cursor:"pointer", fontSize:12, fontWeight:600,
        }}>✕</button>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"16px" }}>
        {/* Quality badge */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
          <span style={{
            fontSize:9, padding:"2px 8px", borderRadius:8, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.4px",
            background:QUALITY_BG[event.quality] ?? "#f0ede8", color:qColor,
            border:`1px solid ${qColor}40`,
          }}>
            {TYPE_LABELS[event.type] ?? event.type} · {event.quality}
          </span>
        </div>

        {/* Meaning */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:9, textTransform:"uppercase", letterSpacing:"0.6px", color:"#bbb", marginBottom:6 }}>What this means</div>
          <div style={{ fontSize:11.5, color:"#333", lineHeight:1.7 }}>{detail.meaning}</div>
        </div>

        {/* Practical */}
        <div style={{ marginBottom:14, padding:"12px 14px", borderRadius:8, background:"#f7f4ef", border:"1px solid #e8e2d8" }}>
          <div style={{ fontSize:9, textTransform:"uppercase", letterSpacing:"0.6px", color:"#bbb", marginBottom:6 }}>How to use it</div>
          <div style={{ fontSize:11.5, color:"#555", lineHeight:1.7 }}>{detail.practical}</div>
        </div>

        {/* Domains */}
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:9, textTransform:"uppercase", letterSpacing:"0.6px", color:"#bbb", marginBottom:7 }}>Best for</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
            {detail.domains.map(d => (
              <span key={d} style={{
                fontSize:10, padding:"3px 9px", borderRadius:10, border:"1px solid #e0dbd4",
                background:"#faf8f5", color:"#555",
              }}>{d}</span>
            ))}
          </div>
        </div>

        {/* Subtitle if any */}
        {event.subtitle && (
          <div style={{ fontSize:10, color:"#aaa", lineHeight:1.5, marginBottom:16 }}>{event.subtitle}</div>
        )}
      </div>

      {/* Footer action */}
      <div style={{ padding:"12px 16px", borderTop:"1px solid #e8e4de" }}>
        <button onClick={handleStartSession} style={{
          width:"100%", padding:"9px 0", borderRadius:8, border:"none",
          background: detail.planetColor ?? "#1a2a3a", color:"#fff",
          fontSize:11.5, fontWeight:500, cursor:"pointer",
        }}>
          {event.time ? `Plan session at ${event.time}` : "Plan around this event"}
        </button>
        <div style={{ fontSize:9, color:"#bbb", textAlign:"center", marginTop:6 }}>
          Adds to your timing awareness for the day
        </div>
      </div>
    </div>
  );
}

// ── Event card ────────────────────────────────────────────────────────────────

function EventCard({ event, selected, onSelect }: { event: SkyEvent; selected: boolean; onSelect: () => void }) {
  const qColor = QUALITY_COLORS[event.quality] ?? "#555";
  const qBg    = QUALITY_BG[event.quality] ?? "#f0ede8";
  return (
    <button onClick={onSelect} style={{
      display:"flex", gap:10, alignItems:"flex-start", padding:"9px 12px",
      borderRadius:8, background: selected ? "#f0ede8" : "#fff",
      border:`1px solid ${selected ? "#c0b8a8" : event.quality === "caution" ? "#f0d8b0" : event.quality === "favorable" ? "#c8e0b8" : "#e8e4de"}`,
      cursor:"pointer", textAlign:"left", width:"100%",
      transition:"background 0.12s",
    }}>
      <div style={{ fontSize:16, width:22, textAlign:"center", flexShrink:0, marginTop:1 }}>
        {event.icon}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
          <div style={{ fontSize:12, fontWeight:500, color:"#1a2a3a" }}>{event.title}</div>
          {event.time && <div style={{ fontSize:9, color:"#aaa" }}>{event.time}</div>}
        </div>
        {event.subtitle && (
          <div style={{ fontSize:10, color:"#777", lineHeight:1.4 }}>{event.subtitle}</div>
        )}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
        <div style={{
          fontSize:7, padding:"2px 6px", borderRadius:4, background:qBg, color:qColor,
          fontWeight:600, textTransform:"uppercase", letterSpacing:"0.4px",
        }}>
          {TYPE_LABELS[event.type] ?? event.type}
        </div>
        <div style={{ fontSize:9, color:"#ccc" }}>›</div>
      </div>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Sky({ testerId, lat = 40.7, lon = -74.0 }: { testerId: string | null; lat?: number; lon?: number }) {
  const [filter, setFilter] = useState("all");
  const [days, setDays] = useState(30);
  const [selectedEvent, setSelectedEvent] = useState<SkyEvent | null>(null);
  const { data: eventsData, isLoading } = useSkyEvents(days, lat, lon);
  const { data: week } = useTidesWeek(days, lat, lon);

  const allEvents = eventsData?.events ?? [];
  const filtered = filter === "all" ? allEvents : allEvents.filter(e => e.type === filter);
  const grouped = groupByDate(filtered);
  const dates = Object.keys(grouped).sort();

  const weekDayMap = new Map((week?.days ?? []).map(d => [d.date, d]));

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* Topbar */}
      <div style={{ padding:"10px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid #d0cbc3", background:"#ece8e2", flexShrink:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:"#1a2a3a" }}>Sky ahead</div>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          {selectedEvent && (
            <div style={{ fontSize:10, color:"#aaa", marginRight:4 }}>
              {selectedEvent.title} →
            </div>
          )}
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            style={{ fontSize:10, padding:"3px 8px", borderRadius:6, border:"1px solid #d0cbc3", background:"#f0ede8", color:"#555" }}>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
          </select>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ padding:"8px 20px", display:"flex", gap:4, flexWrap:"wrap", borderBottom:"1px solid #e8e4de", background:"#f4f0ea", flexShrink:0 }}>
        {FILTER_TYPES.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            fontSize:9, padding:"3px 9px", borderRadius:10, border:"1px solid #d0cbc3", cursor:"pointer",
            background: filter === f.id ? "#1a2a3a" : "#fff",
            color: filter === f.id ? "#fff" : "#666", fontWeight: filter === f.id ? 600 : 400,
          }}>
            {f.label}
          </button>
        ))}
        <div style={{ marginLeft:"auto", fontSize:10, color:"#aaa", lineHeight:"24px" }}>
          {filtered.length} events
        </div>
      </div>

      {/* 30-day quality strip */}
      {filter === "all" && (
        <div style={{ padding:"10px 20px", borderBottom:"1px solid #e8e4de", background:"#faf8f5", flexShrink:0 }}>
          <div style={{ fontSize:9, textTransform:"uppercase", letterSpacing:"0.6px", color:"#aaa", marginBottom:6 }}>Quality at a glance</div>
          <div style={{ display:"flex", gap:2, overflowX:"auto" }}>
            {(week?.days ?? []).map(day => {
              const ec = ELEMENT_COLORS[day.element ?? "water"] ?? "#888";
              const today = new Date().toISOString().slice(0, 10);
              const isToday = day.date === today;
              const q = day.qualityScore ?? 5;
              const h = Math.max(8, (q / 7) * 28);
              return (
                <div key={day.date} title={`${day.label} — ${day.quality} (${day.element})`} style={{
                  display:"flex", flexDirection:"column", alignItems:"center", gap:2,
                  minWidth:22, flexShrink:0,
                }}>
                  <div style={{ fontSize:7, color: isToday ? "#b07030" : "#ccc", fontWeight: isToday ? 700 : 400 }}>
                    {new Date(day.date + "T12:00:00").getDate()}
                  </div>
                  <div style={{ width:14, height:h, borderRadius:3, background:ec, opacity:0.7 + (q / 35) }} />
                  {(day.crossings ?? []).length > 0 && (
                    <div style={{ width:4, height:4, borderRadius:"50%", background:"#e0a040" }} />
                  )}
                  {day.voidPeriods && (
                    <div style={{ width:4, height:4, borderRadius:"50%", background:"#bbb" }} />
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex", gap:12, marginTop:6, fontSize:8, color:"#bbb" }}>
            <span>■ element quality</span>
            <span style={{ color:"#e0a040" }}>● crossing</span>
            <span>● VOC</span>
          </div>
        </div>
      )}

      {/* Main area with optional detail panel */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", position:"relative" }}>
        {/* Event feed */}
        <div style={{ flex:1, overflowY:"auto", padding:"14px 20px", display:"flex", flexDirection:"column", gap:18 }}>
          {isLoading && (
            <div style={{ color:"#bbb", fontSize:12, textAlign:"center", padding:"32px 0" }}>Computing sky events…</div>
          )}
          {!isLoading && dates.length === 0 && (
            <div style={{ color:"#bbb", fontSize:12, textAlign:"center", padding:"32px 0" }}>No events match this filter.</div>
          )}

          {dates.map(date => {
            const dayEvents = grouped[date];
            const dayData = weekDayMap.get(date);
            const ec = dayData ? (ELEMENT_COLORS[dayData.element] ?? "#888") : "#888";
            const isToday = date === new Date().toISOString().slice(0, 10);
            return (
              <div key={date}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <div style={{ fontSize: isToday ? 12 : 10, fontWeight: isToday ? 700 : 600, color: isToday ? "#b07030" : "#555" }}>
                    {formatDate(date)}
                  </div>
                  {dayData && (
                    <div style={{ fontSize:8, color:ec, opacity:0.8 }}>{dayData.moonSign} · {dayData.element}</div>
                  )}
                  <div style={{ flex:1, height:1, background:"#e8e4de" }} />
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  {dayEvents.map((ev, i) => (
                    <EventCard
                      key={i}
                      event={ev}
                      selected={selectedEvent === ev}
                      onSelect={() => setSelectedEvent(selectedEvent === ev ? null : ev)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        {selectedEvent && (
          <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
        )}
      </div>
    </div>
  );
}
