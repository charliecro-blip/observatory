import React from "react";
import { useTidesNow, useTidesWeek } from "@/hooks/useTides";

const MOON_SIGN_HOME: Record<string, string> = {
  Aries:       "Quick tasks, bold changes — start renovations, clear clutter fast.",
  Taurus:      "Sensory comfort: fresh flowers, beautiful objects, cooking, garden.",
  Gemini:      "Organize papers, files, and correspondence. Light, versatile arrangements.",
  Cancer:      "The power sign for home — deep nourishing, family gatherings, kitchen work.",
  Leo:         "Beautify and display. Creative home projects, dining rituals, entertaining.",
  Virgo:       "Deep cleaning, systematic organizing, and routine maintenance.",
  Libra:       "Aesthetics and balance — art, decoration, creating harmonious spaces.",
  Scorpio:     "Purging and releasing — let go of what you no longer need.",
  Sagittarius: "Expansive projects, library organization, travel-inspired spaces.",
  Capricorn:   "Structural repairs, practical improvements, long-term home investments.",
  Aquarius:    "Technological upgrades, unconventional arrangements, shared spaces.",
  Pisces:      "Sanctuary creation — soft lighting, music, retreat atmosphere.",
};

const BIODYNAMIC_HOME: Record<string, { label: string; tasks: string[] }> = {
  root:    { label:"Root day", tasks:["Root vegetable gardening", "Basement organization", "Foundation and flooring work", "Root cellar"] },
  leaf:    { label:"Leaf day", tasks:["Leafy herb tending", "House plant care", "Watering", "Pruning foliage"] },
  flower:  { label:"Flower day", tasks:["Cut flowers", "Bedroom and living space decorating", "Garden blooms", "Fragrance and aromatherapy"] },
  fruit:   { label:"Fruit day", tasks:["Harvest and cooking", "Kitchen projects", "Fruit tree tending", "Preserving and fermenting"] },
};

function dayHomeScore(day: any): number {
  const el = (day.element ?? "earth").toLowerCase();
  const elScore: Record<string, number> = { earth: 1.0, water: 0.85, fire: 0.6, air: 0.5 };
  const base = elScore[el] ?? 0.5;
  const q = (day.qualityScore ?? 4) / 7;
  const vocPen = day.voidPeriods ? 0.2 : 0;
  return Math.max(0, Math.min(1, base * 0.5 + q * 0.5 - vocPen));
}

const SATURN_COLOR = "#807060";
const VENUS_COLOR  = "#c06090";
const MOON_COLOR   = "#7080a0";

export default function HomeModule({
  testerId, lat = 40.7, lon = -74.0,
}: { testerId: string | null; lat?: number; lon?: number }) {
  const { data: now } = useTidesNow(testerId, lat, lon);
  const { data: week } = useTidesWeek(14, lat, lon);

  const moonSign = now?.moonSign ?? "";
  const element  = (now?.element as any)?.element ?? now?.element ?? "earth";
  const biotype  = (now as any)?.biodynamicType ?? "root";
  const signNote = MOON_SIGN_HOME[moonSign];
  const bioData  = BIODYNAMIC_HOME[(biotype as string).toLowerCase()] ?? BIODYNAMIC_HOME.root;

  const days = (week?.days ?? []).map((d: any) => ({ ...d, score: dayHomeScore(d) }));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ fontSize:20, fontWeight:600, color:"#1a2a3a" }}>Home & Space</div>
      <div style={{ fontSize:11, color:"#888", marginTop:-8 }}>
        Timing for cleaning, organizing, gardening, cooking, and creating sanctuary — aligned to biodynamic and lunar cycles.
      </div>

      {/* Today card */}
      <div style={{ background:"#fff", border:"1px solid #e0dbd4", borderRadius:12, padding:"18px 20px" }}>
        <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.6px", color:"#aaa", marginBottom:8 }}>Right now</div>
        {moonSign && (
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:600, color:"#1a2a3a", marginBottom:4 }}>Moon in {moonSign}</div>
            <div style={{ fontSize:11, color:"#555", lineHeight:1.65 }}>{signNote ?? "A shifting domestic energy."}</div>
          </div>
        )}
        <div style={{ padding:"11px 13px", borderRadius:8, background:"#f5f2ef", border:"1px solid #e0dbd0" }}>
          <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.6px", color:"#bbb", marginBottom:6 }}>
            {bioData.label} — biodynamic focus
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
            {bioData.tasks.map(t => (
              <span key={t} style={{ fontSize:10, padding:"3px 9px", borderRadius:10, border:"1px solid #e0dbd4", background:"#faf8f5", color:"#555" }}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* 14-day view */}
      <div style={{ background:"#fff", border:"1px solid #e0dbd4", borderRadius:12, padding:"16px 20px" }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>14-day home rhythm</div>
        <div style={{ fontSize:10, color:"#aaa", marginBottom:14 }}>Earth and water days are best for home work. VOC days: routine only.</div>
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          {days.map((d: any) => {
            const el = (d.element ?? "earth").toLowerCase();
            const col = ({ earth:"#5a7040", water:"#3060a0", fire:"#c04020", air:"#6040a0" } as any)[el] ?? "#888";
            const date = new Date(d.date + "T12:00:00");
            const label = date.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });
            const isToday = d.date === today;
            const bio = BIODYNAMIC_HOME[(d.biodynamicType ?? "root").toLowerCase()];
            return (
              <div key={d.date} style={{
                display:"flex", alignItems:"center", gap:10, padding:"7px 10px", borderRadius:8,
                background: isToday ? "#f0ede8" : "#faf8f5",
                border:`1px solid ${isToday ? "#c0b8b0" : "#e8e4de"}`,
              }}>
                <div style={{ width:90, fontSize:10.5, color: isToday ? "#1a2a3a" : "#555", fontWeight: isToday ? 600 : 400, flexShrink:0 }}>{label}</div>
                <div style={{ flex:1, height:4, borderRadius:3, background:"#e8e4de", overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${Math.round(d.score*100)}%`, background:col, borderRadius:3 }} />
                </div>
                <div style={{ fontSize:9, color:col, width:60, flexShrink:0, textAlign:"right" }}>{el}</div>
                <div style={{ fontSize:9, color:"#aaa", width:70, flexShrink:0, textAlign:"right" }}>{bio?.label ?? ""}</div>
                {d.voidPeriods && <div style={{ fontSize:8.5, color:"#b0a060", flexShrink:0 }}>VOC</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Planetary hours for home */}
      <div style={{ background:"#fff", border:"1px solid #e0dbd4", borderRadius:12, padding:"16px 20px" }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>Planetary hours for home work</div>
        {[
          { planet:"Moon",    icon:"☽", color:MOON_COLOR,    note:"Nurturing, cooking, family rhythms. The home body." },
          { planet:"Venus",   icon:"♀", color:VENUS_COLOR,   note:"Beautifying, decorating, flowers, and aesthetic harmony." },
          { planet:"Saturn",  icon:"♄", color:SATURN_COLOR,  note:"Repairs, structural work, deep declutter, and long-term home projects." },
          { planet:"Sun",     icon:"☉", color:"#c08020",     note:"Airing out, brightening spaces, solar cleaning rituals." },
          { planet:"Mercury", icon:"☿", color:"#608060",     note:"Organizing papers, files, shelves — systems and labeling." },
        ].map(({ planet, icon, color, note }) => (
          <div key={planet} style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:10 }}>
            <div style={{ width:28, height:28, borderRadius:"50%", background:`${color}20`, color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>
              {icon}
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
