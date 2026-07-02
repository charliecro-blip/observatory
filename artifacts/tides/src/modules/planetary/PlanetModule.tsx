import React from "react";
import { useTidesNow, useTidesWeek } from "@/hooks/useTides";

export interface PlanetDef {
  name: string;
  icon: string;
  color: string;
  domains: string[];
  moonAspectNote: string;   // what to emphasize when Moon strongly aspects this planet
  sunAspectNote: string;    // what to emphasize during the ~10-day Sun aspect window
  dayThemes: string[];      // practices/activities aligned with this planet
  hourNote: string;         // what to do during this planet's hour
  signNotes: Partial<Record<string, string>>;
}

export const PLANETS: Record<string, PlanetDef> = {
  Sun: {
    name: "Sun", icon: "☉", color: "#c08020",
    domains: ["Identity","Vitality","Visibility","Authority","Leadership"],
    moonAspectNote: "Emotional confidence peaks — great for visibility, self-expression, and leadership moments.",
    sunAspectNote:  "A ~10-day window where solar themes are amplified. Reputation, ambition, and identity matters surface. Take bold steps in career and self-presentation.",
    dayThemes: ["Outdoor exposure", "Public-facing work", "Leadership decisions", "Brand & reputation"],
    hourNote: "Peak window for high-visibility tasks, presenting, and anything requiring authority.",
    signNotes: {
      Aries: "Solar energy is fierce and pioneering. Ideal for bold starts and courage.",
      Leo:   "Sun is at home in Leo. Maximum creative and personal expression.",
      Libra: "Solar energy seeks balance. Visible partnership and collaborative leadership.",
    },
  },
  Moon: {
    name: "Moon", icon: "☽", color: "#7080a0",
    domains: ["Emotion","Intuition","Cycles","Nourishment","The public"],
    moonAspectNote: "The Moon is connecting to herself in cycles — heightened emotional intelligence and sensitivity.",
    sunAspectNote:  "Sun-Moon aspect window: emotional life and personal direction come into focus. A time to check in with your inner world and emotional needs.",
    dayThemes: ["Emotional check-ins", "Intuitive creativity", "Nourishment rituals", "Rest and receptivity"],
    hourNote: "Best for creative, emotional, and relational work. Avoid high-pressure analytical tasks.",
    signNotes: {},
  },
  Mercury: {
    name: "Mercury", icon: "☿", color: "#608060",
    domains: ["Communication","Writing","Analysis","Learning","Trade"],
    moonAspectNote: "Feeling and thinking are in dialogue — emotionally intelligent communication and sharp intuition about language.",
    sunAspectNote:  "Sun-Mercury conjunction or aspect: a ~10-day period of heightened mental focus and communication. Write, pitch, negotiate, or launch communications.",
    dayThemes: ["Writing", "Negotiation", "Study", "Correspondence", "Analysis"],
    hourNote: "Mental clarity peaks. Best for writing, complex analysis, negotiation, and sharp communication.",
    signNotes: {
      Gemini: "Mercury in home sign — fast, agile, and curious thinking.",
      Virgo:  "Precise, analytical, and detail-oriented communication.",
    },
  },
  Venus: {
    name: "Venus", icon: "♀", color: "#c06090",
    domains: ["Relationships","Beauty","Aesthetics","Pleasure","Values","Money"],
    moonAspectNote: "Emotional warmth and relational grace are heightened. Excellent for connection, creative work, and anything requiring charm.",
    sunAspectNote:  "Sun-Venus window: values, aesthetics, and relationships come into focus. A good time for financial decisions, creative launches, and deepening bonds.",
    dayThemes: ["Relationship deepening", "Creative projects", "Beauty rituals", "Social events", "Financial review"],
    hourNote: "The most charming and socially magnetic hour. Ideal for relationship talks, creative work, and aesthetic decisions.",
    signNotes: {
      Taurus: "Venus at home — sensory pleasure, financial groundedness, and beauty.",
      Libra:  "Venus at home — relational harmony, aesthetics, and fair exchange.",
    },
  },
  Mars: {
    name: "Mars", icon: "♂", color: "#c04040",
    domains: ["Drive","Action","Competition","Physical energy","Courage","Conflict"],
    moonAspectNote: "Emotional fire and assertive drive combine. Use this for bold action; watch for reactive or impatient moods.",
    sunAspectNote:  "Sun-Mars window (~10 days): ambition and drive surge. Pursue competitive goals, physical challenges, or anything requiring decisive action and courage.",
    dayThemes: ["High-intensity training", "Bold decisions", "Competitive pursuits", "Confrontations and boundaries"],
    hourNote: "Peak drive and physical energy. Best for training, executive decisions, and assertive action.",
    signNotes: {
      Aries:     "Mars at home — raw, fast, and pioneering energy.",
      Scorpio:   "Mars in depth — strategic, relentless, and transformative.",
      Capricorn: "Mars exalted — disciplined, structured, and highly effective.",
    },
  },
  Jupiter: {
    name: "Jupiter", icon: "♃", color: "#6040a0",
    domains: ["Growth","Expansion","Optimism","Faith","Teaching","Travel","Abundance"],
    moonAspectNote: "Emotional generosity and optimism swell. Excellent for social connection, launching big ideas, and acts of generosity.",
    sunAspectNote:  "Sun-Jupiter window: a ~10-day amplification of ambition, opportunity, and optimism. Risk believing bigger. Commit to growth.",
    dayThemes: ["Publishing", "Teaching", "Big-picture planning", "Abundance rituals", "Generous acts"],
    hourNote: "Auspicious for launches, pitches, and anything requiring faith in a positive outcome.",
    signNotes: {
      Sagittarius: "Jupiter at home — maximum philosophical and adventurous expansion.",
      Pisces:      "Jupiter in co-ruling sign — compassionate, mystical abundance.",
    },
  },
  Saturn: {
    name: "Saturn", icon: "♄", color: "#807060",
    domains: ["Discipline","Structure","Responsibility","Long-term","Limits","Karma","Authority"],
    moonAspectNote: "Emotional needs and structural demands converge. Honor limitations honestly. Sustained, disciplined emotional work is supported.",
    sunAspectNote:  "Sun-Saturn window: a ~10-day period where responsibility and long-term commitments are clarified. Face what must be faced; build what must be built.",
    dayThemes: ["Long-term planning", "Accountability", "Structural projects", "Mentorship", "Formal agreements"],
    hourNote: "Best for serious, disciplined, structural work. Not light — but lasting.",
    signNotes: {
      Capricorn: "Saturn at home — maximum authority, discipline, and worldly mastery.",
      Aquarius:  "Saturn in co-ruling sign — structural reform and collective responsibility.",
    },
  },
};

function emphasisScore(planetName: string, now: any): { score: number; reasons: string[] } {
  if (!now) return { score: 0, reasons: [] };
  const reasons: string[] = [];
  let score = 0;

  // Moon in planet's sign gives moderate emphasis
  const moonSign = now.moonSign ?? "";
  const p = PLANETS[planetName];

  // Check if Moon is aspecting this planet (via tidesNow moonAspects array if available)
  const moonAspects: any[] = now.moonAspects ?? [];
  const moonAsp = moonAspects.find((a: any) =>
    a.planet === planetName || a.planet2 === planetName
  );
  if (moonAsp) {
    const aspType = moonAsp.aspect ?? moonAsp.type ?? "";
    const isStrong = ["conjunction","trine","sextile","square","opposition"].includes(aspType.toLowerCase());
    if (isStrong) {
      score += 0.5;
      reasons.push(`Moon ${aspType} ${planetName} — ${p.moonAspectNote}`);
    }
  }

  // Sign correlation — if moon is in a sign strongly associated with this planet
  if (p.signNotes[moonSign]) {
    score += 0.3;
    reasons.push(`Moon in ${moonSign}: ${p.signNotes[moonSign]}`);
  }

  return { score: Math.min(1, score), reasons };
}

export default function PlanetModule({
  testerId, lat = 40.7, lon = -74.0, planetName,
}: { testerId: string | null; lat?: number; lon?: number; planetName: string }) {
  const { data: now } = useTidesNow(testerId, lat, lon);
  const { data: week } = useTidesWeek(14, lat, lon);

  const p = PLANETS[planetName];
  if (!p) return <div>Unknown planet: {planetName}</div>;

  const { score: emphScore, reasons: emphReasons } = emphasisScore(planetName, now);
  const today = new Date().toISOString().slice(0, 10);

  // Score days: planetary hour quality + element affinity
  const days = (week?.days ?? []).map((d: any) => {
    const q = (d.qualityScore ?? 4) / 7;
    return { ...d, score: q };
  });

  const emphLevel = emphScore > 0.7 ? "strong" : emphScore > 0.3 ? "moderate" : "background";
  const emphColors = { strong: p.color, moderate: p.color + "aa", background: "#aaa" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:40, height:40, borderRadius:"50%", background:`${p.color}20`, color:p.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>
          {p.icon}
        </div>
        <div>
          <div style={{ fontSize:20, fontWeight:600, color:"#1a2a3a" }}>{p.name}</div>
          <div style={{ fontSize:10, color:"#aaa" }}>{p.domains.join(" · ")}</div>
        </div>
      </div>

      {/* Current emphasis */}
      <div style={{ background:"#fff", border:"1px solid #e0dbd4", borderRadius:12, padding:"18px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.6px", color:"#aaa" }}>Emphasis today</div>
          <span style={{ fontSize:10, padding:"3px 10px", borderRadius:8, background:`${emphColors[emphLevel]}20`, color:emphColors[emphLevel], border:`1px solid ${emphColors[emphLevel]}40`, fontWeight:600 }}>
            {emphLevel}
          </span>
        </div>

        {emphReasons.length > 0 ? (
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {emphReasons.map((r, i) => (
              <div key={i} style={{ fontSize:11, color:"#555", lineHeight:1.6, display:"flex", gap:6 }}>
                <span style={{ color:p.color }}>◆</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize:11, color:"#888" }}>
            No strong Moon-{p.name} contact today. {p.name} themes are available as background support.
          </div>
        )}

        <div style={{ marginTop:14, padding:"10px 12px", borderRadius:8, background:"#f7f4ef", border:"1px solid #e8e2d8" }}>
          <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.6px", color:"#bbb", marginBottom:4 }}>During {p.name} hours</div>
          <div style={{ fontSize:11, color:"#555", lineHeight:1.6 }}>{p.hourNote}</div>
        </div>
      </div>

      {/* Practices */}
      <div style={{ background:"#fff", border:"1px solid #e0dbd4", borderRadius:12, padding:"16px 20px" }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:10 }}>{p.name} practices & themes</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
          {p.dayThemes.map(t => (
            <span key={t} style={{ fontSize:10.5, padding:"4px 11px", borderRadius:10, border:`1px solid ${p.color}40`, background:`${p.color}10`, color:p.color }}>
              {t}
            </span>
          ))}
        </div>
        <div>
          <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.6px", color:"#bbb", marginBottom:5 }}>When Moon aspects {p.name}</div>
          <div style={{ fontSize:11, color:"#555", lineHeight:1.6 }}>{p.moonAspectNote}</div>
        </div>
        <div style={{ marginTop:10 }}>
          <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.6px", color:"#bbb", marginBottom:5 }}>When Sun aspects {p.name} (~10-day window)</div>
          <div style={{ fontSize:11, color:"#555", lineHeight:1.6 }}>{p.sunAspectNote}</div>
        </div>
      </div>

      {/* 14-day quality */}
      <div style={{ background:"#fff", border:"1px solid #e0dbd4", borderRadius:12, padding:"16px 20px" }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>Sky quality — next 14 days</div>
        <div style={{ fontSize:10, color:"#aaa", marginBottom:14 }}>Higher quality days support {p.name} themes more broadly.</div>
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          {days.map((d: any) => {
            const date = new Date(d.date + "T12:00:00");
            const label = date.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });
            const isToday = d.date === today;
            const bar = Math.round(d.score * 100);
            return (
              <div key={d.date} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:90, fontSize:10.5, color: isToday ? "#1a2a3a" : "#555", fontWeight: isToday ? 600 : 400, flexShrink:0 }}>{label}</div>
                <div style={{ flex:1, height:4, borderRadius:3, background:"#e8e4de", overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${bar}%`, background:d.score > 0.65 ? p.color : "#bbb", borderRadius:3 }} />
                </div>
                <div style={{ fontSize:9, color:"#aaa", width:60, flexShrink:0, textAlign:"right" }}>{d.moonSign}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
