import React, { useState } from "react";
import { localToday, addDaysLocal } from "@/lib/dates";
import { invalidateWindows } from "@/lib/invalidateWindows";
import { useQueryClient } from "@tanstack/react-query";
import { useSkyEvents, useTidesWeek, useTidesNow } from "@/hooks/useTides";
import type { SkyEvent } from "@/lib/types";
import { SIGN_MYTHOS, ELEMENT_MYTHOS, PLANET_MYTHOS } from "@/lib/mythos";
import { CURRICULUM } from "@/lib/sky-literacy";
import SpineGauge from "@/components/SpineGauge";
import { useTheme } from "@/contexts/theme-context";
import { PLANET_GLYPH as PLANET_ICONS } from "@/lib/glyphs";
import { PLANET_COLORS } from "@/lib/planetColors";
import { ELEMENT_COLORS, elementColor } from "@/lib/elements";
import { PAIR_MEANINGS, pairKey } from "@/lib/aspectMeanings";

const QUALITY_COLORS: Record<string, string> = {
  favorable: "#3a6020", caution: "#a05020", neutral: "#555",
};
const QUALITY_BG: Record<string, string> = {
  favorable: "#e8f5e0", caution: "#f8ede0", neutral: "var(--color-background)",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const today = localToday();
  const tomorrow = addDaysLocal(today, 1);
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
      Venus:   { meaning:"Relational and aesthetic energy at peak visibility. Beauty, grace, charm heightened.", domains:["Creative work","Social","Launches"], color:PLANET_COLORS.Venus },
      Jupiter: { meaning:"Good fortune and expansiveness at its most powerful daily moment. Optimism and reach peak.", domains:["Launches","Pitches","Partnerships"], color:PLANET_COLORS.Jupiter },
      Mars:    { meaning:"Assertive energy peaks. Powerful for decisive action and bold moves — watch for impatience.", domains:["Decisive action","Physical effort","Confrontation"], color:PLANET_COLORS.Mars },
      Sun:     { meaning:"Solar energy at its highest for the day. Reputation, authority, and visibility peak.", domains:["Visibility","Authority","Presentations"], color:PLANET_COLORS.Sun },
      Mercury: { meaning:"Mental clarity and communication at sharpest. Excellent for negotiations and complex ideas.", domains:["Communication","Writing","Agreements"], color:PLANET_COLORS.Mercury },
      Moon:    { meaning:"Emotional sensitivity and intuition at a peak moment. Creative and relational work.", domains:["Creative flow","Emotional work"], color:PLANET_COLORS.Moon },
      Saturn:  { meaning:"Discipline and structure at its most powerful. Serious planning and accountability.", domains:["Structure","Long-term planning"], color:PLANET_COLORS.Saturn },
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

  // ── Aspect interpretation (moon_aspect + general aspect events) ───────────
  if (event.type === "moon_aspect" || event.type === ("aspect" as string)) {
    const ASPECT_NAMES: Record<string, string> = {
      "☌︎":"conjunction", "△":"trine", "⚹":"sextile", "□":"square", "☍︎":"opposition",
    };
    // Parse title like "Moon △ Jupiter" or "Sun □ Mars"
    const titleMatch = title.match(/^(\w+)\s*(☌|△|⚹|□|☍)\s*(\w+)$/);
    if (titleMatch) {
      const p1 = titleMatch[1];
      const sym = titleMatch[2];
      const p2 = titleMatch[3];
      const aspectName = ASPECT_NAMES[sym] ?? sym;
      const isHard = sym === "□" || sym === "☍︎";
      const isSoft = sym === "△" || sym === "⚹";
      const isConj = sym === "☌︎";
      const color = PLANET_COLORS[p2] ?? PLANET_COLORS[p1] ?? "#557";

      // Planet-pair descriptions keyed as "P1|P2" (canonical order: smaller body first if Moon involved)
      type PairData = { meaning: string; hard: string; soft: string; conj: string; domains: string[] };
      // Copy lives in lib/aspectMeanings, with tests/aspectCopy.test.ts
      // pinning the style. It was inline here and drifted into horoscope voice.
      const key = pairKey(p1, p2);
      const data = PAIR_MEANINGS[key];

      if (data) {
        const description = isConj ? data.conj : isSoft ? data.soft : isHard ? data.hard : data.meaning;
        return {
          meaning: `${p1} ${sym} ${p2} (${aspectName}): ${description}`,
          practical: isConj
            ? `Conjunctions fuse the two energies completely — lean in to the combined archetype. The window is most exact at the listed time but resonates for hours.`
            : isSoft
              ? `Trines and sextiles offer a natural opening — the energy is available but not forced. Actively use it rather than waiting.`
              : `Squares and oppositions create productive tension. The friction is an invitation to integrate, not a reason to stop. Work through it.`,
          domains: data.domains,
          planetColor: color,
        };
      }
    }
    // Generic fallback for unparsed aspects
    const aspectIsHard = title.includes("□") || title.includes("☍︎");
    return {
      meaning: `${title} — two planetary archetypes make contact, blending their themes.`,
      practical: aspectIsHard ? "Tension aspects invite integration. Work with the friction." : "Supportive aspects open doors. Take the opening.",
      domains: ["Sky","Timing"],
      planetColor: PLANET_COLORS[title.split(" ")[0]] ?? "#557",
    };

  }

  return { meaning:"A notable sky event.", practical:"Observe how this shifts the energy.", domains:["Awareness"] };
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function EventDetailPanel({ event, onClose, testerId }: { event: SkyEvent; onClose: () => void; testerId: string | null }) {
  const detail = interpretEvent(event);
  const qColor = QUALITY_COLORS[event.quality] ?? "#555";
  const qc = useQueryClient();
  const [planned, setPlanned] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [planErr, setPlanErr] = useState(false);

  async function planSession() {
    if (!testerId || planned) return;
    setPlanning(true);
    try {
      // Build a 1-hour window anchored to the event time (or noon if no time)
      const timeStr = event.time ?? "12:00";
      const [hh, mm] = timeStr.split(":").map(Number);
      const start = `${event.date}T${String(hh).padStart(2,"0")}:${String(mm ?? 0).padStart(2,"0")}:00`;
      const endH = hh + 1;
      const end   = `${event.date}T${String(endH).padStart(2,"0")}:${String(mm ?? 0).padStart(2,"0")}:00`;
      const windowType = event.type === "crossing" ? "deep_work"
        : event.type === "moon_phase" ? "planning"
        : event.type === "ingress" ? "planning"
        : "creative";
      const r = await fetch("/api/planning/windows", {
        method: "POST",
        headers: { "x-tester-id": testerId, "Content-Type": "application/json" },
        body: JSON.stringify({ title: event.title, windowType, startTime: start, endTime: end, note: detail.meaning.slice(0, 200) }),
      });
      if (!r.ok) throw new Error(`plan failed (${r.status})`);
      invalidateWindows(qc);
      setPlanned(true);
    } catch {
      setPlanErr(true);
      setTimeout(() => setPlanErr(false), 4000);
    } finally {
      setPlanning(false);
    }
  }

  return (
    <div style={{ position:"absolute", top:0, right:0, bottom:0, width:300, zIndex:50, background: "var(--color-card)", borderLeft:"1px solid var(--color-border)", display:"flex", flexDirection:"column", boxShadow:"-4px 0 20px rgba(0,0,0,0.08)" }}>
      <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--color-border)", display:"flex", alignItems:"flex-start", gap:10 }}>
        <div style={{ fontSize:22, flexShrink:0, marginTop:2 }}>{event.icon}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:600, color: "var(--color-primary)", lineHeight:1.3 }}>{event.title}</div>
          {event.time && <div style={{ fontSize:10, color:"var(--text-3)", marginTop:2 }}>{event.time}</div>}
        </div>
        <button onClick={onClose} style={{ flexShrink:0, width:24, height:24, borderRadius:"50%", border:"none", background: "var(--color-background)", color:"var(--color-muted)", cursor:"pointer", fontSize:12 }}>✕</button>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"16px" }}>
        <div style={{ marginBottom:12 }}>
          <span style={{ fontSize:9, padding:"2px 8px", borderRadius:8, fontWeight:600, textTransform:"uppercase", background:QUALITY_BG[event.quality]??"var(--color-background)", color:qColor, border:`1px solid ${qColor}30` }}>
            {event.type?.replace(/_/g," ")} · {event.quality}
          </span>
        </div>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:8.5, textTransform:"uppercase", letterSpacing:"0.6px", color:"var(--text-3)", marginBottom:6 }}>What this means</div>
          <div style={{ fontSize:11.5, color:"var(--color-foreground)", lineHeight:1.7 }}>{detail.meaning}</div>
        </div>
        <div style={{ marginBottom:14, padding:"11px 13px", borderRadius:8, background:"var(--color-card-2)", border:"1px solid var(--color-border)" }}>
          <div style={{ fontSize:8.5, textTransform:"uppercase", letterSpacing:"0.6px", color:"var(--text-3)", marginBottom:5 }}>How to use it</div>
          <div style={{ fontSize:11.5, color:"var(--color-muted)", lineHeight:1.7 }}>{detail.practical}</div>
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
          {detail.domains.map(d => (
            <span key={d} style={{ fontSize:10, padding:"3px 9px", borderRadius:10, border:"1px solid var(--color-border)", background: "var(--color-card-2)", color:"var(--text-2)" }}>{d}</span>
          ))}
        </div>
      </div>
      <div style={{ padding:"12px 16px", borderTop:"1px solid var(--color-border)" }}>
        {planErr && <div style={{ fontSize:10.5, color:"#c05030", marginBottom:6 }}>Couldn't add it — try again.</div>}
        <button onClick={planSession} disabled={planned || planning || !testerId} style={{
          width:"100%", padding:"9px 0", borderRadius:8, border:"none", cursor: planned ? "default" : "pointer",
          background: planned ? "#e8f5e0" : (detail.planetColor ?? "#1a2a3a"),
          color: planned ? ELEMENT_COLORS.earth : "#fff", fontSize:11.5, fontWeight:500,
          opacity: planning ? 0.7 : 1,
        }}>
          {planned ? "✓ Added to Calendar" : planning ? "Adding…" : event.time ? `Plan session at ${event.time}` : "Plan around this event"}
        </button>
      </div>
    </div>
  );
}

// ── Event row (compact) ───────────────────────────────────────────────────────

const ASPECT_COLORS: Record<string, string> = {
  "☌︎":"#f0b060", "□":"#e06060", "△":"#60a060", "⚹":"#6090d0", "☍︎":"#e06060",
};

function EventRow({ event, selected, onSelect }: { event: SkyEvent; selected: boolean; onSelect: () => void }) {
  const qColor = QUALITY_COLORS[event.quality] ?? "#555";
  const planetEntry = event.type === "crossing"
    ? Object.entries(PLANET_COLORS).find(([p]) => (event.title ?? "").includes(p))
    : null;
  const aspectColor = event.type === "moon_aspect" ? (ASPECT_COLORS[event.icon] ?? PLANET_COLORS.Moon) : null;
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
          <div style={{ fontSize:12, fontWeight:500, color: "var(--color-primary)" }}>{event.title}</div>
          {event.time && <div style={{ fontSize:9.5, color:accentColor, fontWeight:500 }}>{event.time}</div>}
        </div>
        {event.subtitle && <div style={{ fontSize:10, color:"var(--color-muted)", lineHeight:1.4, marginTop:1 }}>{event.subtitle}</div>}
        {/* Ingresses get the sign's concrete "so what" — what the new water favors */}
        {event.type === "ingress" && (() => {
          const sign = Object.keys(SIGN_MYTHOS).find(s => (event.title ?? "").includes(s));
          const sm = sign ? SIGN_MYTHOS[sign] : null;
          if (!sm) return null;
          return (
            <div style={{ fontSize:9.5, color:"var(--color-muted)", lineHeight:1.45, marginTop:2 }}>
              <span style={{ color:"var(--text-3)" }}>favors</span> {sm.favors.slice(0, 3).join(" · ")}
            </div>
          );
        })()}
      </div>
      <div style={{ fontSize:9, color:"var(--text-3)", flexShrink:0, marginTop:4 }}>›</div>
    </button>
  );
}

// ── Quality strip ─────────────────────────────────────────────────────────────
// The 30-day wave chart — exported: it lives at the top of Calendar now that
// the Almanac tab is retired (owner 2026-07-29: "the wave chart is money").

export function QualityStrip({ week, days, onPick }: { week: any; days: number; onPick?: (date: string) => void }) {
  const today = localToday();
  return (
    <div style={{ padding:"12px 20px 14px", borderBottom:"1px solid var(--color-border)", background: "var(--color-card-2)", flexShrink:0 }}>
      <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.6px", color:"var(--text-3)", marginBottom:8 }}>The water ahead — next {days} days</div>
      <div style={{ display:"flex", gap:2.5, overflowX:"auto" }}>
        {(week?.days ?? []).slice(0, days).map((day: any) => {
          const ec = elementColor(day.element ?? "water", "#888");
          const isToday = day.date === today;
          const q = day.qualityScore ?? 5;
          const barH = Math.max(8, (q / 7) * 44);
          return (
            <button key={day.date} title={`${day.label} — ${day.quality} · ${day.moonSign}`}
              onClick={onPick ? () => onPick(day.date) : undefined}
              style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2.5, minWidth:24, flexShrink:0,
                background:"none", border:"none", padding:0, cursor: onPick ? "pointer" : "default" }}>
              <div style={{ fontSize:8, color:isToday?"#b07030":"var(--text-3)", fontWeight:isToday?700:400 }}>
                {new Date(day.date+"T12:00:00").getDate()}
              </div>
              <div style={{ width:16, height:44, display:"flex", alignItems:"flex-end" }}>
                <div style={{ width:16, height:barH, borderRadius:3, background:ec, opacity:0.6+(q/28) }}/>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Sky({ testerId, lat = 40.7, lon = -74.0, onStartStar, onVisitPlanet }: { testerId: string | null; lat?: number; lon?: number; onStartStar?: (element: string) => void; onVisitPlanet?: (planet: string) => void }) {
  const [days, setDays] = useState(30);
  const [selectedEvent, setSelectedEvent] = useState<SkyEvent | null>(null);
  const [showAllCrossings, setShowAllCrossings] = useState(false);
  const { data: eventsData, isLoading } = useSkyEvents(days, lat, lon);
  const { data: week } = useTidesWeek(days, lat, lon);
  const { data: tidesNow } = useTidesNow(testerId, lat, lon);

  const allEvents = eventsData?.events ?? [];
  const weekDayMap = new Map((week?.days ?? []).map((d: any) => [d.date, d]));
  const today = localToday();
  const nowDate = new Date();

  function handleSelect(ev: SkyEvent) {
    setSelectedEvent(prev => prev === ev ? null : ev);
  }

  // Crossings — only next 4 hours by default
  const allCrossings = allEvents.filter(e => e.type === "crossing" && e.date >= today);
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
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
      <div style={{ padding:"10px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid var(--color-border)", background: "var(--color-rail)", flexShrink:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color: "var(--color-primary)" }}>Almanac</div>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            style={{ fontSize:10, padding:"3px 8px", borderRadius:6, border:"1px solid var(--color-border)", background: "var(--color-background)", color:"var(--text-2)" }}>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </div>

      <QualityStrip week={week} days={days} />

      {/* Main area — content column capped at a readable width so the sections
          render identically whether or not the detail panel is open (previously
          the panel-less state sprawled full-bleed and looked broken until a
          click opened the panel and narrowed it). */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", position:"relative" }}>
        <div style={{ flex:1, overflowY:"auto", padding:"12px 16px", display:"flex", flexDirection:"column", gap:10, maxWidth:760, margin:"0 auto", width:"100%" }}>
          {/* Reference / learning — the Almanac's identity as "the book you look
              things up in," distinct from Ahead's "your calendar." */}
          <ReferenceSection onStartStar={onStartStar} onVisitPlanet={onVisitPlanet} />

          {isLoading && <div style={{ color:"var(--text-3)", fontSize:12, textAlign:"center", padding:"32px 0" }}>Computing sky events…</div>}

          {/* ── Angular crossings ── */}
          {!isLoading && (
            <Section
              label="Angular crossings"
              icon="⚡"
              accent={PLANET_COLORS.Sun}
              desc="Planets at the chart angles — brief, potent timing peaks"
              defaultOpen={true}
            >
              {/* Near-term crossings (next 4 hours) */}
              {nearCrossings.length === 0 && (
                <div style={{ padding:"8px 12px", fontSize:11, color:"var(--text-3)" }}>
                  No crossings in the next 4 hours.
                </div>
              )}
              {nearCrossings.map((ev, i) => {
                const pEntry = Object.entries(PLANET_COLORS).find(([p]) => (ev.title ?? "").includes(p));
                const pCol = pEntry ? pEntry[1] : PLANET_COLORS.Sun;
                return (
                  <div key={i} style={{ display:"flex", gap:10, alignItems:"center", padding:"8px 12px", borderBottom:"1px solid #f5f0e8" }}>
                    <div style={{ fontSize:14, width:22, textAlign:"center", flexShrink:0 }}>
                      {(() => {
                        const p = Object.keys(PLANET_ICONS).find(p => (ev.title ?? "").includes(p));
                        return p ? PLANET_ICONS[p] : "⚡";
                      })()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:pCol }}>{ev.title}</div>
                      {ev.subtitle && <div style={{ fontSize:9.5, color:"var(--text-3)", marginTop:1 }}>{ev.subtitle}</div>}
                    </div>
                    <div style={{ fontSize:11, fontWeight:600, color:pCol, flexShrink:0 }}>{ev.time}</div>
                    <button onClick={() => handleSelect(ev)} style={{ fontSize:9, color:"var(--text-3)", background:"none", border:"none", cursor:"pointer", padding:"2px 6px", flexShrink:0 }}>›</button>
                  </div>
                );
              })}

              {/* Show more toggle */}
              {futureCrossings.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowAllCrossings(v => !v)}
                    style={{ width:"100%", padding:"8px 12px", background:"none", border:"none", borderTop:"1px solid var(--color-border)", cursor:"pointer", fontSize:10, color:"var(--text-3)", textAlign:"left", display:"flex", justifyContent:"space-between" }}
                  >
                    <span>{showAllCrossings ? "Hide upcoming crossings" : `${futureCrossings.length} more crossing${futureCrossings.length > 1 ? "s" : ""} — show all`}</span>
                    <span>{showAllCrossings ? "▲" : "▼"}</span>
                  </button>
                  {showAllCrossings && (() => {
                    const byCrossDate: Record<string, SkyEvent[]> = {};
                    for (const e of futureCrossings) (byCrossDate[e.date] ??= []).push(e);
                    return Object.entries(byCrossDate).sort(([a],[b])=>a<b?-1:1).map(([date, evs]) => (
                      <div key={date}>
                        <div style={{ padding:"5px 12px 3px", fontSize:9, color:"var(--text-3)", background: "var(--color-card-2)", fontWeight:600 }}>
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

          {/* ── Planetary aspects (non-lunar) ── */}
          {!isLoading && tidesNow?.aspects && tidesNow.aspects.filter((a: any) => a.planet1 !== "Moon" && a.planet2 !== "Moon").length > 0 && (
            <Section
              label="Planetary aspects"
              icon="✦"
              accent={PLANET_COLORS.Jupiter}
              desc="Active sky geometry between planets — background influence on the day"
              defaultOpen={true}
            >
              {(() => {
                const ASP_SYM2: Record<string,string> = { conjunction:"☌︎", opposition:"☍︎", square:"□", trine:"△", sextile:"⚹" };
                const ASP_COL2: Record<string,string> = { conjunction:"#f0b060", opposition:"#e06060", square:"#e06060", trine:"#60a060", sextile:"#6090d0" };
                const ASP_NAT: Record<string,string> = { trine:"Harmonious", sextile:"Supportive", conjunction:"Amplifying", square:"Tension", opposition:"Polarity" };
                const ASP_DESC: Record<string,string> = {
                  conjunction:"0° — the two bodies fuse into a single voice; their meanings become inseparable and you feel them from the inside, not as an observer. The most potent and least objective aspect. Whatever these planets signify is amplified and blended for the duration.",
                  sextile:"60° — an open door rather than a push. The energies cooperate willingly, but only if you take the first step. Opportunity that rewards initiative and quietly passes if ignored.",
                  square:"90° — two drives pulling at right angles, each demanding what the other blocks. Genuine tension that won't dissolve by waiting. Its gift is momentum: channelled into a decision, the friction is what actually builds things; resisted, it just grinds.",
                  trine:"120° — the energies flow together with no resistance: talent, ease, grace. The catch is that what comes this easily can go unused precisely because it never demands your attention.",
                  opposition:"180° — the planets face each other, each holding half of a whole. Felt first as an external tension — a person, a circumstance, a tug-of-war — until you own both ends. The resolution is integration, not winning.",
                };
                const nonMoon = tidesNow!.aspects!.filter((a: any) => a.planet1 !== "Moon" && a.planet2 !== "Moon");
                const signOf = (p: string) => ((tidesNow as any)?.planets ?? []).find((x: any) => x.planet === p)?.sign ?? "";
                return nonMoon.map((a: any, i: number) => {
                  const sym = ASP_SYM2[a.aspect] ?? "·";
                  const col = ASP_COL2[a.aspect] ?? "#888";
                  const p1c = PLANET_COLORS[a.planet1] ?? "#888";
                  const p2c = PLANET_COLORS[a.planet2] ?? "#888";
                  const hrsToExact = a.hoursToExact ?? null;
                  const exactSoon = a.applying && hrsToExact != null;
                  const exactLabel = hrsToExact == null ? ""
                    : hrsToExact < 1 ? `exact in <1h`
                    : hrsToExact < 48 ? `exact in ~${Math.round(hrsToExact)}h`
                    : hrsToExact < 24 * 60 ? `exact in ~${Math.round(hrsToExact / 24)}d`
                    : `exact in ~${Math.round(hrsToExact / 24 / 30)}mo`;
                  return (
                    <div key={i} style={{ padding:"10px 14px", borderBottom:"1px solid #f5f0ec", display:"flex", gap:12, alignItems:"flex-start" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0, marginTop:1 }}>
                        <span style={{ fontSize:16, color:p1c }}>{PLANET_ICONS[a.planet1] ?? a.planet1[0]}</span>
                        <span style={{ fontSize:15, color:col, fontWeight:700 }}>{sym}</span>
                        <span style={{ fontSize:16, color:p2c }}>{PLANET_ICONS[a.planet2] ?? a.planet2[0]}</span>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                          <span style={{ fontSize:11.5, fontWeight:600, color: "var(--color-primary)" }}>
                            {a.planet1}{signOf(a.planet1) ? ` in ${signOf(a.planet1)}` : ""} {sym} {a.planet2}{signOf(a.planet2) ? ` in ${signOf(a.planet2)}` : ""}
                          </span>
                          <span style={{ fontSize:9, padding:"1px 6px", borderRadius:6, background:`${col}18`, color:col, fontWeight:600 }}>{ASP_NAT[a.aspect] ?? a.aspect}</span>
                          {exactSoon && <span style={{ fontSize:9, color:"#b07030", background:"#fff8e8", border:"1px solid #e8d080", padding:"1px 5px", borderRadius:4 }}>
                            {exactLabel}
                          </span>}
                        </div>
                        <div style={{ fontSize:10, color:"var(--color-muted)", lineHeight:1.5 }}>{ASP_DESC[a.aspect]}</div>
                        <div style={{ fontSize:9, color:"var(--text-3)", marginTop:3 }}>
                          {a.stationsBeforeExact ? `Closing at ${a.orb.toFixed(1)}° — but a station turns it back before this perfects`
                            : a.neverPerfected ? `Separating at ${a.orb.toFixed(1)}° — never perfected; a station turned it back short of exact`
                            : a.applying ? `Applying — ${a.orb.toFixed(1)}° to exact` : `Separating — ${a.orb.toFixed(1)}° past exact`}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </Section>
          )}

          {/* ── Lunar stream ── */}
          {!isLoading && (
            <Section
              label="Lunar stream"
              icon="☽︎"
              accent="#5a7090"
              desc="Moon aspects, sign changes, phases, and void periods"
              defaultOpen={true}
            >
              {lunarStream.length === 0 && (
                <div style={{ padding:"8px 12px", fontSize:11, color:"var(--text-3)" }}>No lunar events in this window.</div>
              )}
              {Object.entries(lunarByDate).sort(([a],[b])=>a<b?-1:1).slice(0, 14).map(([date, evs]) => {
                const dayData = weekDayMap.get(date);
                const ec = dayData ? (elementColor(dayData.element, "#888")) : "#888";
                const isToday = date === today;
                return (
                  <div key={date}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 12px 3px", background: "var(--color-card-2)", borderBottom:"1px solid var(--color-border)" }}>
                      <div style={{ fontSize:isToday?10:9, fontWeight:isToday?700:600, color:isToday?"#b07030":"var(--text-3)" }}>
                        {formatDate(date)}
                      </div>
                      {dayData && (
                        <div style={{ fontSize:8.5, color:ec, fontWeight:500 }}>{dayData.moonSign}</div>
                      )}
                      <div style={{ flex:1, height:1, background: "var(--color-rail)" }}/>
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
          <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} testerId={testerId} />
        )}
      </div>
    </div>
  );
}

// ── Reusable collapsible section ──────────────────────────────────────────────

// The reference — the book you look things up in. A plain-language "what does
// this mean" layer (elements, planets, signs, the curriculum) so the app is
// legible to someone who knows no astrology. Exported: it lives on the Planets
// page now that the Almanac tab is retired — one home for the sky's meanings.
export function ReferenceSection({ onStartStar, onVisitPlanet }: { onStartStar?: (element: string) => void; onVisitPlanet?: (planet: string) => void }) {
  const { theme } = useTheme();
  const [tab, setTab] = useState<"learn" | "elements" | "planets" | "signs">("learn");
  const [open, setOpen] = useState<string | null>(null);
  // The whole reference is a big block; let people fold it away when they're
  // here for the day's sky, not the textbook (owner #23: needs expand/contract).
  const [sectionOpen, setSectionOpen] = useState(false);

  const items: { key: string; glyph: string; name: string; sub: string; color: string; body: string; element?: string; planet?: string }[] =
    tab === "learn"
      // The sequenced primer — the curriculum ladder, rung by rung. Reading
      // ahead is allowed; living it is the actual course.
      ? CURRICULUM.map((l) => ({
          key: String(l.n), glyph: String(l.n), name: l.title, sub: l.essence, color: "#8a7050",
          body: `${l.body}\n\nPractice: ${l.practice}`,
        }))
      : tab === "elements"
      // Fuller read (#24): the myth, the life-domains it governs, and concrete
      // things you'd plan or log under it — all already in ELEMENT_MYTHOS, just
      // wasn't being surfaced here.
      ? (["fire", "earth", "air", "water"] as const).map((el) => {
          const m = ELEMENT_MYTHOS[el];
          return {
            key: el, glyph: "●", name: m.name, sub: m.essence, color: m.color, element: el,
            body: `${m.myth}\n\nGoverns: ${(m.domains ?? []).join(" · ")}\n\nPlan or log here: ${(m.activities ?? []).join(" · ")}`,
          };
        })
      : tab === "planets"
      // Fuller read (#24): the myth, what the voice speaks for, and what to do
      // when it's loud.
      ? Object.values(PLANET_MYTHOS).map((m) => ({
          key: m.key, glyph: m.glyph, name: `${m.name} — ${m.archetype}`, sub: m.essence, color: m.color, planet: m.name,
          body: `${m.myth}\n\nSpeaks for: ${(m.speaksFor ?? []).join(" · ")}\n\nWhen it's loud: ${m.whenLoud}`,
        }))
      : Object.values(SIGN_MYTHOS).map((m) => ({ key: m.key, glyph: m.glyph, name: m.name, sub: m.essence, color: elementColor(m.element, "var(--color-muted)"), body: `${m.feel} Favors: ${(m.favors ?? []).slice(0, 4).join(" · ")}.`, element: m.element }));

  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
      <button onClick={() => setSectionOpen(v => !v)} style={{
        width: "100%", textAlign: "left", padding: "11px 14px", background: "var(--color-card-2)",
        border: "none", borderBottom: sectionOpen ? "1px solid var(--color-border)" : "none", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--color-primary)" }}>📖 Reference — what the sky's pieces mean</div>
          <div style={{ fontSize: 9.5, color: "var(--text-3)", marginTop: 1 }}>Start with the six-step path, or look anything up — no astrology background needed</div>
        </div>
        <span style={{ fontSize: 10, color: "var(--text-3)", transform: sectionOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>›</span>
      </button>
      {sectionOpen && (
      <div style={{ padding: "0 14px 11px", background: "var(--color-card-2)", borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ display: "flex", gap: 5, marginTop: 10 }}>
          {(["learn", "elements", "planets", "signs"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setOpen(null); }} style={{
              fontSize: 10, padding: "3px 11px", borderRadius: 20, cursor: "pointer", textTransform: "capitalize",
              border: tab === t ? "1px solid #1a2a3a" : "1px solid var(--color-border)",
              background: tab === t ? "#1a2a3a" : "var(--color-card)", color: tab === t ? "#fff" : "var(--color-muted)", fontWeight: tab === t ? 600 : 400,
            }}>{t === "learn" ? "✦ learn the sky" : t}</button>
          ))}
        </div>
      </div>
      )}
      {/* The spine — the nested-rhythm ladder leads the primer, since it's the
          map every other lesson is a rung of. */}
      {sectionOpen && tab === "learn" && (
        <div style={{ padding: "14px 14px 4px" }}>
          <SpineGauge dark={theme === "dark"} />
        </div>
      )}
      {sectionOpen && (
      <div style={{ display: tab === "signs" ? "grid" : "flex", gridTemplateColumns: tab === "signs" ? "1fr 1fr" : undefined, flexDirection: tab === "signs" ? undefined : "column" }}>
        {items.map((it) => (
          <div key={it.key} style={{ borderBottom: "1px solid var(--color-border)", borderRight: tab === "signs" ? "1px solid var(--color-border)" : "none" }}>
            <button onClick={() => setOpen(open === it.key ? null : it.key)} style={{
              width: "100%", textAlign: "left", padding: "8px 14px", background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 9,
            }}>
              <span style={{ fontSize: 14, color: it.color, width: 18, textAlign: "center", flexShrink: 0 }}>{it.glyph}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--color-foreground)" }}>{it.name}</div>
                <div style={{ fontSize: 9.5, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.sub}</div>
              </div>
              <span style={{ fontSize: 9, color: "var(--text-3)", flexShrink: 0 }}>{open === it.key ? "−" : "+"}</span>
            </button>
            {open === it.key && (
              <div style={{ padding: "0 14px 10px 41px", fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.6, whiteSpace: "pre-line" }}>
                {it.body}
                {/* Turn a meaning into an intention (#25): steer a Guiding Star
                    into this element, or open the full planet page (#24). */}
                {(it.element || it.planet) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    {it.element && onStartStar && (
                      <button onClick={() => onStartStar(it.element!)} style={{
                        fontSize: 10, padding: "4px 11px", borderRadius: 8, cursor: "pointer",
                        border: `1px solid ${it.color}55`, background: `${it.color}12`, color: it.color, fontWeight: 600,
                      }}>✦ Set a Guiding Star in {ELEMENT_MYTHOS[it.element]?.name ?? it.element}</button>
                    )}
                    {it.planet && onVisitPlanet && (
                      <button onClick={() => onVisitPlanet(it.planet!)} style={{
                        fontSize: 10, padding: "4px 11px", borderRadius: 8, cursor: "pointer",
                        border: `1px solid ${it.color}55`, background: `${it.color}12`, color: it.color, fontWeight: 600,
                      }}>Open {it.planet} →</button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

function Section({ label, icon, accent, desc, defaultOpen, children }: {
  label: string; icon: string; accent: string; desc: string; defaultOpen: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    // flexShrink:0 is load-bearing: this box lives in a flex column with
    // overflow:hidden, so without it the column compresses the section below
    // its content height and clips the header/rows — the "renders wrong until
    // you click it" bug (a click forced a relayout that papered over it).
    <div style={{ border:`1px solid ${accent}28`, borderRadius:10, overflow:"hidden", flexShrink:0 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width:"100%", display:"flex", alignItems:"center", gap:10, padding:"11px 14px",
        background: open ? `${accent}10` : `${accent}06`, border:"none", cursor:"pointer", textAlign:"left",
        borderBottom: open ? `1px solid ${accent}18` : "none",
      }}>
        <span style={{ fontSize:15, width:20, textAlign:"center", flexShrink:0 }}>{icon}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:11.5, fontWeight:600, color:accent }}>{label}</div>
          <div style={{ fontSize:9.5, color:"var(--text-3)", marginTop:1, whiteSpace:"normal" }}>{desc}</div>
        </div>
        <span style={{ fontSize:10, color:"var(--text-3)", transform:open?"rotate(90deg)":"none", transition:"transform 0.15s", flexShrink:0 }}>›</span>
      </button>
      {open && <div style={{ display:"flex", flexDirection:"column" }}>{children}</div>}
    </div>
  );
}
