import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSkyEvents, useTidesWeek, useTidesNow } from "@/hooks/useTides";
import type { SkyEvent } from "@/lib/types";
import { SIGN_MYTHOS, ELEMENT_MYTHOS, PLANET_MYTHOS } from "@/lib/mythos";

const QUALITY_COLORS: Record<string, string> = {
  favorable: "#3a6020", caution: "#a05020", neutral: "#555",
};
const QUALITY_BG: Record<string, string> = {
  favorable: "#e8f5e0", caution: "#f8ede0", neutral: "var(--color-background)",
};
const ELEMENT_COLORS: Record<string, string> = {
  water: "#3a5a80", fire: "#8a3a20", earth: "#3a6030", air: "#c19a3a",
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

  // ── Aspect interpretation (moon_aspect + general aspect events) ───────────
  if (event.type === "moon_aspect" || event.type === ("aspect" as string)) {
    const ASPECT_NAMES: Record<string, string> = {
      "☌":"conjunction", "△":"trine", "⚹":"sextile", "□":"square", "☍":"opposition",
    };
    // Parse title like "Moon △ Jupiter" or "Sun □ Mars"
    const titleMatch = title.match(/^(\w+)\s*(☌|△|⚹|□|☍)\s*(\w+)$/);
    if (titleMatch) {
      const p1 = titleMatch[1];
      const sym = titleMatch[2];
      const p2 = titleMatch[3];
      const aspectName = ASPECT_NAMES[sym] ?? sym;
      const isHard = sym === "□" || sym === "☍";
      const isSoft = sym === "△" || sym === "⚹";
      const isConj = sym === "☌";
      const color = PLANET_COLORS[p2] ?? PLANET_COLORS[p1] ?? "#557";

      // Planet-pair descriptions keyed as "P1|P2" (canonical order: smaller body first if Moon involved)
      type PairData = { meaning: string; hard: string; soft: string; conj: string; domains: string[] };
      const PAIR_DATA: Record<string, PairData> = {
        "Moon|Sun": {
          meaning: "Heart and vitality speak to each other.",
          conj:  "Instinct and will align completely — new lunar cycle begins. Intentions set now carry solar force. Visibility and mood feel unified.",
          soft:  "Emotional and personal energy work in harmony. Confidence feels natural, creative output is expressive and warm.",
          hard:  "Inner needs and outer goals pull in different directions. Tension between what you feel and what you're expected to project. Work to reconcile, don't suppress.",
          domains: ["Self-expression","Confidence","Emotional clarity"],
        },
        "Moon|Mercury": {
          meaning: "Feeling and thinking intertwine.",
          conj:  "Mind and mood merge — highly perceptive, but objectivity is low. Excellent for journaling, intuitive writing, or conversations that require emotional intelligence.",
          soft:  "Communication flows naturally from feeling. Write, speak, listen — emotional nuance in language is heightened.",
          hard:  "Thoughts and emotions interfere with each other. Over-thinking feelings or over-feeling thoughts. Take notes but delay final decisions.",
          domains: ["Communication","Writing","Emotional intelligence"],
        },
        "Moon|Venus": {
          meaning: "Nurture and beauty converge.",
          conj:  "Comfort, pleasure, and connection feel effortless. Excellent for aesthetic work, hosting, romance, or any activity centered on receiving and giving.",
          soft:  "Social warmth and artistic sensitivity are elevated. Relationships feel easy and nourishing; creative taste is refined.",
          hard:  "Emotional needs and desires create friction — craving comfort but feeling restless or dissatisfied. Avoid overindulgence; clarify what you truly value.",
          domains: ["Relationships","Creativity","Pleasure","Aesthetics"],
        },
        "Moon|Mars": {
          meaning: "Feeling and action collide.",
          conj:  "Emotional drive peaks. Highly motivated but potentially reactive. Channel into vigorous physical effort or decisive action; avoid picking fights.",
          soft:  "Courage and feeling align. Physical energy is high and mood is assertive in a productive way. Act on what you've been hesitant about.",
          hard:  "Irritability and emotional reactivity are elevated. Feelings surface as anger or impatience. Physical outlets help; avoid confrontation about sensitive topics.",
          domains: ["Physical energy","Assertiveness","Drive"],
        },
        "Moon|Jupiter": {
          meaning: "Emotional life meets expansion and optimism.",
          conj:  "Generosity, warmth, and confidence overflow. Excellent for social events, sharing work publicly, or beginning something you want to grow large.",
          soft:  "Optimism feels earned — mood lifts, opportunities feel abundant. Generosity and faith are well-placed. Share, celebrate, commit.",
          hard:  "Over-promising, emotional excess, or unrealistic expectations may surface. Good intentions without grounding. Enjoy the optimism but check the details.",
          domains: ["Abundance","Growth","Social","Publishing"],
        },
        "Moon|Saturn": {
          meaning: "Emotional needs meet structure and discipline.",
          conj:  "Serious, focused, and sober mood. Excellent for long-term planning, accountability, or taking on responsibility. Not light — but durable.",
          soft:  "Emotional discipline supports sustained effort. Mood is steady, reliable, and well-suited for important structural work.",
          hard:  "Emotional needs and responsibilities feel at odds. Loneliness, restriction, or heaviness may arise. Honor limits without catastrophizing.",
          domains: ["Structure","Discipline","Long-term planning","Responsibility"],
        },
        "Moon|Uranus": {
          meaning: "Emotional patterns meet the urge to break free.",
          conj:  "Unexpected events, sudden insights, or disrupted routines. Creative electricity is high; restlessness is too. Lean into novelty.",
          soft:  "Intuition is sharp and unconventional. Creative breakthroughs, social experimentation, and original ideas emerge naturally.",
          hard:  "Emotional disruption — unexpected changes in mood, plans, or environment. Flexibility is essential. Don't force comfort where change is at work.",
          domains: ["Innovation","Change","Intuition","Disruption"],
        },
        "Moon|Neptune": {
          meaning: "Feeling and imagination dissolve into each other.",
          conj:  "Boundary between self and world blurs. Deeply creative, empathic, and spiritual — but also prone to confusion or escapism. Ideal for art and inner work; poor for contracts.",
          soft:  "Imagination, compassion, and spiritual sensitivity are elevated. Meditation, music, and receptive creative states thrive.",
          hard:  "Confusion, illusion, or emotional dissipation. Boundaries feel unclear. Ground yourself; verify facts and feelings before acting.",
          domains: ["Creativity","Spirituality","Imagination","Boundaries"],
        },
        "Moon|Pluto": {
          meaning: "Emotional currents meet depth and transformation.",
          conj:  "Emotional intensity peaks. Deep feelings surface — possibly cathartic, possibly overwhelming. Inner work, therapy, and shadow material are accessible.",
          soft:  "Emotional power and psychological insight work for you. Research, depth work, and transformative conversations feel productive.",
          hard:  "Compulsive feelings, power struggles in relationships, or emotional confrontations. Strong currents. Don't suppress — but don't act impulsively.",
          domains: ["Transformation","Psychology","Power","Depth work"],
        },
        "Sun|Mercury": {
          meaning: "Will and communication align.",
          conj:  "Mind and identity fuse. Peak clarity of thought, but potentially blind to outside input. Write, plan, or commit to a perspective with confidence.",
          soft:  "Ideas and identity reinforce each other. Communication is authoritative and clear. A good time to voice positions publicly.",
          hard:  "Rationality and ego may collide — stubborn positions or overthinking self-presentation. Listen as much as you speak.",
          domains: ["Communication","Planning","Decision-making"],
        },
        "Sun|Venus": {
          meaning: "Vitality and beauty harmonize.",
          conj:  "Charisma, magnetism, and social warmth are at a peak. Excellent for launches, social events, relationship deepening, or anything where impression matters.",
          soft:  "Ease, pleasure, and creative expression flow. Relationships are warm; aesthetics are sharp.",
          hard:  "Tension between will and desire. Overindulgence or misaligned values with external expectations. Clarify what you actually want.",
          domains: ["Relationships","Creativity","Social","Aesthetics"],
        },
        "Sun|Mars": {
          meaning: "Vitality and drive amplify each other.",
          conj:  "Physical and motivational energy at a peak. Excellent for bold moves, competition, and strenuous effort. Manage heat and aggression.",
          soft:  "Confidence, courage, and decisiveness are supported. Move forward on plans that require nerve.",
          hard:  "Power struggles, ego conflicts, or physical burnout risk. Channel force productively; avoid ego-led confrontations.",
          domains: ["Drive","Physical effort","Courage","Competition"],
        },
        "Sun|Jupiter": {
          meaning: "Identity and expansion align.",
          conj:  "Confidence and optimism peak. Excellent for visibility, leadership, and ambitious undertakings. Watch for overreach.",
          soft:  "Good fortune and generous energy support growth. Share your work, pitch your ideas, commit to something bigger.",
          hard:  "Overconfidence or exaggeration. Ambition outpaces capacity. Stay grounded while remaining aspirational.",
          domains: ["Visibility","Growth","Leadership","Ambition"],
        },
        "Sun|Saturn": {
          meaning: "Vitality meets responsibility and structure.",
          conj:  "A serious, productive transit — discipline and authority combine. Excellent for committing to long-term work or taking on a leadership burden.",
          soft:  "Structural effort and disciplined output are rewarded. A good time for sustained, serious work.",
          hard:  "Heavy or constrained feeling. Authority figures, limits, or delays may press in. Work steadily through rather than fighting the wall.",
          domains: ["Discipline","Authority","Long-term work","Structure"],
        },
        "Mercury|Venus": {
          meaning: "Mind and heart communicate.",
          conj:  "Elegant thinking and charming expression peak. Writing, design, and diplomacy are favored.",
          soft:  "Aesthetic intelligence and kind communication flow. Excellent for creative writing, negotiation, and love letters.",
          hard:  "Values and logic in tension. What you want to say and what sounds good may not align.",
          domains: ["Communication","Aesthetics","Diplomacy"],
        },
        "Mercury|Mars": {
          meaning: "Thinking and action sharpen each other.",
          conj:  "Sharp, direct, and potentially cutting communication. Rapid thinking favors quick decisions — but watch for aggression in speech.",
          soft:  "Mental courage — you can speak hard truths with clarity. Advocacy, debate, and assertive communication are supported.",
          hard:  "Heated arguments or hasty conclusions. Slow down before sending. Words used as weapons leave residue.",
          domains: ["Communication","Debate","Decision-making"],
        },
        "Mercury|Jupiter": {
          meaning: "Thought and vision expand.",
          conj:  "Big ideas and philosophical insight. Excellent for writing, teaching, pitching, and planning at scale.",
          soft:  "Understanding deepens and communication expands naturally. Teaching, publishing, and long-form thinking are favored.",
          hard:  "Over-promising ideas or missing details in big plans. Enthusiasm outpaces precision. Sketch boldly, then fact-check.",
          domains: ["Ideas","Teaching","Publishing","Planning"],
        },
        "Mercury|Saturn": {
          meaning: "Thought and discipline meet.",
          conj:  "Serious, concentrated thinking. Excellent for editing, organizing, and making precise commitments.",
          soft:  "Mental discipline and clear, structured communication. Write the plan, outline the strategy, nail the details.",
          hard:  "Mental heaviness or self-criticism. Negative thinking or blocked communication. Write it out; don't speak it impulsively.",
          domains: ["Planning","Writing","Editing","Discipline"],
        },
        "Venus|Mars": {
          meaning: "Desire and drive interweave.",
          conj:  "Magnetic, passionate, and creative energy. Attraction, artistry, and assertive self-expression all peak simultaneously.",
          soft:  "Desire and action align — pursue what you want with charm and confidence.",
          hard:  "Push-pull tension in relationships or creative projects. Passion and irritability mixed. Channel into creation rather than conflict.",
          domains: ["Relationships","Creativity","Passion","Art"],
        },
        "Venus|Jupiter": {
          meaning: "Pleasure and abundance amplify each other.",
          conj:  "Joy, generosity, and social warmth peak. Excellent for celebrations, luxury, creative launches, and relationship milestones.",
          soft:  "Everything social and aesthetic flows easily. Enjoy — and share.",
          hard:  "Excess or overindulgence. Financial risk from emotional decisions. Enjoy pleasures in moderation.",
          domains: ["Pleasure","Abundance","Social","Aesthetics"],
        },
        "Venus|Saturn": {
          meaning: "Love and beauty meet commitment and form.",
          conj:  "Depth and seriousness in relationships and creative work. Commitments made now carry weight. Formal beauty, classic taste.",
          soft:  "Relationships deepen with maturity. Creative work benefits from disciplined refinement and lasting form.",
          hard:  "Emotional coldness or romantic difficulty. Feeling constrained or undervalued. Commit to genuine depth rather than surface relief.",
          domains: ["Relationships","Commitment","Creative refinement"],
        },
        "Mars|Jupiter": {
          meaning: "Drive and expansion propel each other.",
          conj:  "Peak ambition and energy — extremely productive for bold launches, competitive pursuits, and physical challenges.",
          soft:  "Enthusiasm and sustained energy. Pursue goals ambitiously with confident action.",
          hard:  "Reckless overreach or scattered effort. Enormous energy needs direction — set the target clearly.",
          domains: ["Ambition","Physical energy","Competition","Launches"],
        },
        "Mars|Saturn": {
          meaning: "Drive meets discipline and resistance.",
          conj:  "Controlled force — serious, strategic, and persistent. Excellent for difficult long-term projects requiring stamina.",
          soft:  "Disciplined action. Consistent effort toward structured goals is supported.",
          hard:  "Blocked or frustrated energy. Feeling stopped. Work the edges slowly; don't burn force against the wall.",
          domains: ["Discipline","Stamina","Strategy","Long-term effort"],
        },
        "Jupiter|Saturn": {
          meaning: "Vision and structure negotiate.",
          conj:  "A generational reset point (every ~20 years). Major commitments, restructured ambitions, or significant life-direction choices.",
          soft:  "Growth and discipline harmonize. Excellent for building something lasting that also expands.",
          hard:  "Tension between idealism and realism, opportunity and caution. Hold both — don't abandon vision or ignore limits.",
          domains: ["Long-term planning","Vision","Structure","Legacy"],
        },
      };

      // Canonicalize pair key
      const PLANET_ORDER = ["Moon","Sun","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"];
      const i1 = PLANET_ORDER.indexOf(p1);
      const i2 = PLANET_ORDER.indexOf(p2);
      const key = i1 <= i2 ? `${p1}|${p2}` : `${p2}|${p1}`;
      const data = PAIR_DATA[key];

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
    const aspectIsHard = title.includes("□") || title.includes("☍");
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
      await fetch("/api/planning/windows", {
        method: "POST",
        headers: { "x-tester-id": testerId, "Content-Type": "application/json" },
        body: JSON.stringify({ title: event.title, windowType, startTime: start, endTime: end, note: detail.meaning.slice(0, 200) }),
      });
      qc.invalidateQueries({ queryKey: ["planning-windows"] });
      setPlanned(true);
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
          {event.time && <div style={{ fontSize:10, color:"#aaa", marginTop:2 }}>{event.time}</div>}
        </div>
        <button onClick={onClose} style={{ flexShrink:0, width:24, height:24, borderRadius:"50%", border:"none", background: "var(--color-background)", color:"#888", cursor:"pointer", fontSize:12 }}>✕</button>
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"16px" }}>
        <div style={{ marginBottom:12 }}>
          <span style={{ fontSize:9, padding:"2px 8px", borderRadius:8, fontWeight:600, textTransform:"uppercase", background:QUALITY_BG[event.quality]??"var(--color-background)", color:qColor, border:`1px solid ${qColor}30` }}>
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
            <span key={d} style={{ fontSize:10, padding:"3px 9px", borderRadius:10, border:"1px solid var(--color-border)", background: "var(--color-card-2)", color:"#555" }}>{d}</span>
          ))}
        </div>
      </div>
      <div style={{ padding:"12px 16px", borderTop:"1px solid var(--color-border)" }}>
        <button onClick={planSession} disabled={planned || planning || !testerId} style={{
          width:"100%", padding:"9px 0", borderRadius:8, border:"none", cursor: planned ? "default" : "pointer",
          background: planned ? "#e8f5e0" : (detail.planetColor ?? "#1a2a3a"),
          color: planned ? "#3a6030" : "#fff", fontSize:11.5, fontWeight:500,
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
          <div style={{ fontSize:12, fontWeight:500, color: "var(--color-primary)" }}>{event.title}</div>
          {event.time && <div style={{ fontSize:9.5, color:accentColor, fontWeight:500 }}>{event.time}</div>}
        </div>
        {event.subtitle && <div style={{ fontSize:10, color:"#888", lineHeight:1.4, marginTop:1 }}>{event.subtitle}</div>}
        {/* Ingresses get the sign's concrete "so what" — what the new water favors */}
        {event.type === "ingress" && (() => {
          const sign = Object.keys(SIGN_MYTHOS).find(s => (event.title ?? "").includes(s));
          const sm = sign ? SIGN_MYTHOS[sign] : null;
          if (!sm) return null;
          return (
            <div style={{ fontSize:9.5, color:"#9a9284", lineHeight:1.45, marginTop:2 }}>
              <span style={{ color:"#b8b0a2" }}>favors</span> {sm.favors.slice(0, 3).join(" · ")}
            </div>
          );
        })()}
      </div>
      <div style={{ fontSize:9, color:"#ccc", flexShrink:0, marginTop:4 }}>›</div>
    </button>
  );
}

// ── Quality strip ─────────────────────────────────────────────────────────────

function QualityStrip({ week, days }: { week: any; days: number }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div style={{ padding:"12px 20px 14px", borderBottom:"1px solid var(--color-border)", background: "var(--color-card-2)", flexShrink:0 }}>
      <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.6px", color:"#bbb", marginBottom:8 }}>Quality — next {days} days</div>
      <div style={{ display:"flex", gap:2.5, overflowX:"auto" }}>
        {(week?.days ?? []).map((day: any) => {
          const ec = ELEMENT_COLORS[day.element ?? "water"] ?? "#888";
          const isToday = day.date === today;
          const q = day.qualityScore ?? 5;
          const barH = Math.max(8, (q / 7) * 44);
          return (
            <div key={day.date} title={`${day.label} — ${day.quality} · ${day.moonSign}`}
              style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2.5, minWidth:24, flexShrink:0 }}>
              <div style={{ fontSize:8, color:isToday?"#b07030":"#999", fontWeight:isToday?700:400 }}>
                {new Date(day.date+"T12:00:00").getDate()}
              </div>
              <div style={{ width:16, height:44, display:"flex", alignItems:"flex-end" }}>
                <div style={{ width:16, height:barH, borderRadius:3, background:ec, opacity:0.6+(q/28) }}/>
              </div>
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
  const { data: tidesNow } = useTidesNow(testerId, lat, lon);

  const allEvents = eventsData?.events ?? [];
  const weekDayMap = new Map((week?.days ?? []).map((d: any) => [d.date, d]));
  const today = new Date().toISOString().slice(0, 10);
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
            style={{ fontSize:10, padding:"3px 8px", borderRadius:6, border:"1px solid var(--color-border)", background: "var(--color-background)", color:"#555" }}>
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
          <ReferenceSection />

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
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:pCol }}>{ev.title}</div>
                      {ev.subtitle && <div style={{ fontSize:9.5, color:"#aaa", marginTop:1 }}>{ev.subtitle}</div>}
                    </div>
                    <div style={{ fontSize:11, fontWeight:600, color:pCol, flexShrink:0 }}>{ev.time}</div>
                    <button onClick={() => handleSelect(ev)} style={{ fontSize:9, color:"#bbb", background:"none", border:"none", cursor:"pointer", padding:"2px 6px", flexShrink:0 }}>›</button>
                  </div>
                );
              })}

              {/* Show more toggle */}
              {futureCrossings.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowAllCrossings(v => !v)}
                    style={{ width:"100%", padding:"8px 12px", background:"none", border:"none", borderTop:"1px solid var(--color-border)", cursor:"pointer", fontSize:10, color:"#aaa", textAlign:"left", display:"flex", justifyContent:"space-between" }}
                  >
                    <span>{showAllCrossings ? "Hide upcoming crossings" : `${futureCrossings.length} more crossing${futureCrossings.length > 1 ? "s" : ""} — show all`}</span>
                    <span>{showAllCrossings ? "▲" : "▼"}</span>
                  </button>
                  {showAllCrossings && (() => {
                    const byCrossDate: Record<string, SkyEvent[]> = {};
                    for (const e of futureCrossings) (byCrossDate[e.date] ??= []).push(e);
                    return Object.entries(byCrossDate).sort(([a],[b])=>a<b?-1:1).map(([date, evs]) => (
                      <div key={date}>
                        <div style={{ padding:"5px 12px 3px", fontSize:9, color:"#bbb", background: "var(--color-card-2)", fontWeight:600 }}>
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
              accent="#6040a0"
              desc="Active sky geometry between planets — background influence on the day"
              defaultOpen={true}
            >
              {(() => {
                const ASP_SYM2: Record<string,string> = { conjunction:"☌", opposition:"☍", square:"□", trine:"△", sextile:"⚹" };
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
                        <div style={{ fontSize:10, color:"#777", lineHeight:1.5 }}>{ASP_DESC[a.aspect]}</div>
                        <div style={{ fontSize:9, color:"#aaa", marginTop:3 }}>
                          {a.applying ? `Applying — ${a.orb.toFixed(1)}° to exact` : `Separating — ${a.orb.toFixed(1)}° past exact`}
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
                    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 12px 3px", background: "var(--color-card-2)", borderBottom:"1px solid var(--color-border)" }}>
                      <div style={{ fontSize:isToday?10:9, fontWeight:isToday?700:600, color:isToday?"#b07030":"#999" }}>
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

// The Almanac's reference identity — the book you look things up in. A plain-
// language "what does this mean" layer (elements, planets, signs) so the app is
// legible to someone who knows no astrology. Distinct from Ahead (your time):
// this is the sky's meanings, not its schedule.
function ReferenceSection() {
  const [tab, setTab] = useState<"elements" | "planets" | "signs">("elements");
  const [open, setOpen] = useState<string | null>(null);
  const ELEMENT_COLORS: Record<string, string> = { fire: "#c04830", earth: "#4a7040", air: "#c19a3a", water: "#3a5a80" };

  const items: { key: string; glyph: string; name: string; sub: string; color: string; body: string }[] =
    tab === "elements"
      ? (["fire", "earth", "air", "water"] as const).map((el) => {
          const m = ELEMENT_MYTHOS[el];
          return { key: el, glyph: "●", name: m.name, sub: m.essence, color: m.color, body: `${m.essence} ${(m.domains ?? []).join(" · ")}` };
        })
      : tab === "planets"
      ? Object.values(PLANET_MYTHOS).map((m) => ({ key: m.key, glyph: m.glyph, name: `${m.name} — ${m.archetype}`, sub: m.essence, color: m.color, body: m.myth }))
      : Object.values(SIGN_MYTHOS).map((m) => ({ key: m.key, glyph: m.glyph, name: m.name, sub: m.essence, color: ELEMENT_COLORS[m.element] ?? "#888", body: `${m.feel} Favors: ${(m.favors ?? []).slice(0, 4).join(" · ")}.` }));

  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
      <div style={{ padding: "11px 14px", background: "var(--color-card-2)", borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--color-primary)" }}>📖 Reference — what the sky's pieces mean</div>
        <div style={{ fontSize: 9.5, color: "#aaa", marginTop: 1 }}>Look anything up — no astrology background needed</div>
        <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
          {(["elements", "planets", "signs"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setOpen(null); }} style={{
              fontSize: 10, padding: "3px 11px", borderRadius: 20, cursor: "pointer", textTransform: "capitalize",
              border: tab === t ? "1px solid #1a2a3a" : "1px solid var(--color-border)",
              background: tab === t ? "#1a2a3a" : "var(--color-card)", color: tab === t ? "#fff" : "#888", fontWeight: tab === t ? 600 : 400,
            }}>{t}</button>
          ))}
        </div>
      </div>
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
                <div style={{ fontSize: 9.5, color: "#999", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.sub}</div>
              </div>
              <span style={{ fontSize: 9, color: "#ccc", flexShrink: 0 }}>{open === it.key ? "−" : "+"}</span>
            </button>
            {open === it.key && (
              <div style={{ padding: "0 14px 10px 41px", fontSize: 10.5, color: "#777", lineHeight: 1.6 }}>{it.body}</div>
            )}
          </div>
        ))}
      </div>
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
          <div style={{ fontSize:9.5, color:"#aaa", marginTop:1, whiteSpace:"normal" }}>{desc}</div>
        </div>
        <span style={{ fontSize:10, color:"#ccc", transform:open?"rotate(90deg)":"none", transition:"transform 0.15s", flexShrink:0 }}>›</span>
      </button>
      {open && <div style={{ display:"flex", flexDirection:"column" }}>{children}</div>}
    </div>
  );
}
