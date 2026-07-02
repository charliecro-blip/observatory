import React from "react";
import { useTidesNow, useTidesWeek } from "@/hooks/useTides";

const MOON_SIGN_NOTES: Record<string, string> = {
  Aries:       "Direct, courageous spiritual work — mantras, fire practices, active ritual.",
  Taurus:      "Grounding and sensory devotion — earthwork, altar tending, embodied presence.",
  Gemini:      "Contemplative study, sacred reading, and meaningful conversation.",
  Cancer:      "Deep feeling and ancestral connection. Honoring lineage and home altar.",
  Leo:         "Devotion through creative expression — mantra, ceremony, sacred art.",
  Virgo:       "Service and purification rituals. Consecrating daily routine as practice.",
  Libra:       "Balance and beauty in spiritual aesthetics. Partner practice and ceremony.",
  Scorpio:     "Shadow work, depth meditation, facing what is hidden. Transformative ritual.",
  Sagittarius: "Philosophical inquiry, teaching, pilgrimage energy. Expand the spiritual view.",
  Capricorn:   "Disciplined daily practice, formal lineage study, long-term commitment.",
  Aquarius:    "Collective meditation, humanitarian prayer, visionary practice.",
  Pisces:      "Dissolution and surrender. Deep meditation, dream work, forgiveness.",
};

const ELEMENT_PRACTICES: Record<string, string[]> = {
  fire:  ["Tratak (candle gazing)", "Sun salutations", "Mantra chanting", "Fire ceremony"],
  earth: ["Walking meditation", "Forest bathing", "Grounding breathwork", "Altar tending"],
  air:   ["Pranayama", "Sacred reading", "Contemplative writing", "Sound meditation"],
  water: ["Yin yoga", "Dream journaling", "Water blessing", "Emotional release ritual"],
};

const PHASE_SPIRITUAL: Record<string, { meaning: string; practice: string }> = {
  "New Moon":        { meaning:"Seed intention for your practice. A dark, potent beginning.", practice:"Set a 28-day spiritual intention. Silent meditation. Journaling." },
  "Waxing Crescent": { meaning:"First devotional momentum builds.", practice:"Start a new practice or ritual. Commit to daily consistency." },
  "First Quarter":   { meaning:"The practice meets resistance. Stay the course.", practice:"Recommit. Review your intention. Push through spiritual dryness." },
  "Waxing Gibbous":  { meaning:"Deepening and refinement — don't let up.", practice:"Extend session lengths. Deepen study. Review lineage texts." },
  "Full Moon":       { meaning:"Peak illumination — revelations, heightened sensitivity.", practice:"Ceremony, group practice, sharing, and celebration of the path." },
  "Waning Gibbous":  { meaning:"Harvest and integrate spiritual insight.", practice:"Teach, write, or share what you've learned. Gratitude practice." },
  "Last Quarter":    { meaning:"Release what's blocking the practice.", practice:"Shadow work. Let go of spiritual identity or rigidity." },
  "Waning Crescent": { meaning:"Rest and restoration before the next cycle.", practice:"Retreat, silence, and deep surrender. Listen, don't strive." },
};

export default function SpiritualModule({
  testerId, lat = 40.7, lon = -74.0,
}: { testerId: string | null; lat?: number; lon?: number }) {
  const { data: now } = useTidesNow(testerId, lat, lon);
  const { data: week } = useTidesWeek(14, lat, lon);
  const moonSign = now?.moonSign ?? "";
  const element = (now?.element as any)?.element ?? now?.element ?? "water";
  const phase = now?.moonPhase ?? "";
  const phaseData = Object.entries(PHASE_SPIRITUAL).find(([k]) => phase.includes(k))?.[1];
  const signNote = MOON_SIGN_NOTES[moonSign];
  const practices = ELEMENT_PRACTICES[(element as string).toLowerCase()] ?? ELEMENT_PRACTICES.water;

  const NEPTUNE_COLOR = "#4060b0";
  const JUPITER_COLOR = "#6040a0";

  // Days with high spiritual resonance (water/air element + high quality)
  const days = (week?.days ?? []).map((d: any) => {
    const el = (d.element ?? "water").toLowerCase();
    const score = (el === "water" ? 1 : el === "air" ? 0.8 : el === "earth" ? 0.5 : 0.3)
      * ((d.qualityScore ?? 4) / 7);
    return { ...d, score };
  }).sort((a: any, b: any) => b.score - a.score);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ fontSize:20, fontWeight:600, color:"#1a2a3a" }}>Spiritual Practice</div>
      <div style={{ fontSize:11, color:"#888", marginTop:-8 }}>
        Timing for meditation, ritual, devotion, and inner work — tuned to lunar cycles and elemental tides.
      </div>

      {/* Today card */}
      <div style={{ background:"#fff", border:"1px solid #e0dbd4", borderRadius:12, padding:"18px 20px" }}>
        <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.6px", color:"#aaa", marginBottom:8 }}>Right now</div>
        {moonSign && (
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:600, color:"#1a2a3a", marginBottom:4 }}>Moon in {moonSign}</div>
            <div style={{ fontSize:11, color:"#555", lineHeight:1.65 }}>{signNote ?? "A shifting lunar quality."}</div>
          </div>
        )}
        {phaseData && (
          <div style={{ padding:"11px 13px", borderRadius:8, background:"#f5f2ef", border:"1px solid #e0dbd0", marginBottom:12 }}>
            <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.6px", color:"#bbb", marginBottom:4 }}>
              {phase} — spiritual meaning
            </div>
            <div style={{ fontSize:11, color:"#333", lineHeight:1.6, marginBottom:6 }}>{phaseData.meaning}</div>
            <div style={{ fontSize:10.5, color:"#555", fontStyle:"italic" }}>{phaseData.practice}</div>
          </div>
        )}
        <div>
          <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.6px", color:"#bbb", marginBottom:8 }}>
            {element} element practices
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {practices.map(p => (
              <span key={p} style={{ fontSize:10, padding:"4px 10px", borderRadius:10, border:"1px solid #e0dbd4", background:"#faf8f5", color:"#555" }}>{p}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Best days strip */}
      <div style={{ background:"#fff", border:"1px solid #e0dbd4", borderRadius:12, padding:"16px 20px" }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>Best practice days ahead</div>
        <div style={{ fontSize:10, color:"#aaa", marginBottom:14 }}>Water and Air days favor inward work and intuition.</div>
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          {days.slice(0, 7).map((d: any) => {
            const el = (d.element ?? "water").toLowerCase();
            const col = ({ water:"#3060a0", air:"#6040a0", earth:"#5a7040", fire:"#c04020" } as any)[el] ?? "#888";
            const date = new Date(d.date + "T12:00:00");
            const label = date.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });
            const scoreBar = Math.round(d.score * 100);
            return (
              <div key={d.date} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:90, fontSize:10.5, color:"#555", flexShrink:0 }}>{label}</div>
                <div style={{ flex:1, height:5, borderRadius:3, background:"#e8e4de", overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${scoreBar}%`, background:col, borderRadius:3 }} />
                </div>
                <div style={{ fontSize:9.5, color:col, width:55, flexShrink:0 }}>{el} · {d.moonSign}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Suggested planetary hours for inner work */}
      <div style={{ background:"#fff", border:"1px solid #e0dbd4", borderRadius:12, padding:"16px 20px" }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>Planetary hours for inner work</div>
        {[
          { planet:"Moon",    color:"#7080a0", note:"Dream recall, emotional processing, intuitive receptivity." },
          { planet:"Neptune", color:NEPTUNE_COLOR, note:"Dissolution, transcendence, deep meditation (Neptune sub-hours are subtle — check Moon aspects)." },
          { planet:"Jupiter", color:JUPITER_COLOR, note:"Expansion of faith, gratitude practice, ceremonial generosity." },
          { planet:"Saturn",  color:"#807060", note:"Structured practice, long-term commitment, formal lineage study." },
          { planet:"Venus",   color:"#c06090", note:"Devotional arts, beauty as a spiritual act, bhakti." },
        ].map(({ planet, color, note }) => (
          <div key={planet} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:10 }}>
            <div style={{ width:28, height:28, borderRadius:"50%", background:`${color}20`, color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>
              {({ Moon:"☽", Neptune:"♆", Jupiter:"♃", Saturn:"♄", Venus:"♀" } as any)[planet]}
            </div>
            <div>
              <div style={{ fontSize:11, fontWeight:500, color:"#333" }}>{planet}</div>
              <div style={{ fontSize:10, color:"#888", lineHeight:1.5 }}>{note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
