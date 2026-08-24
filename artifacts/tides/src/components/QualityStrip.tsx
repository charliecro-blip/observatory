import { localToday } from "@/lib/dates";
import { elementColor } from "@/lib/elements";

// The 30-day wave chart — it lives at the top of Calendar now that the
// Almanac tab is retired (owner 2026-07-29: "the wave chart is money").
// Extracted from pages/Sky.tsx when that page's last route died and the
// rest of the file (~450 lines of unreachable Almanac) was deleted.

export function QualityStrip({ week, days, onPick }: { week: any; days: number; onPick?: (date: string) => void }) {
  const today = localToday();
  return (
    <div style={{ padding:"12px 20px 14px", borderBottom:"1px solid var(--color-border)", background: "var(--color-card-2)", flexShrink:0 }}>
      <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.6px", color:"var(--text-3)", marginBottom:8 }}>The water ahead — next {days} days</div>
      <div style={{ display:"flex", gap:2.5, overflowX:"auto" }}>
        {/* AHEAD MEANS AHEAD. Calendar fetches back-days so the month grid can
            draw the days either side of the first of the month, and this
            strip used to slice from index 0 — so a chart titled "the water
            ahead" opened half-spent, with today sitting in the middle of it
            (owner, 2026-08-14: "we're midway thru the chart it's showing").
            Filter to today onward first, then take the count. */}
        {(week?.days ?? []).filter((d: any) => d?.date >= today).slice(0, days).map((day: any) => {
          const ec = elementColor(day.element ?? "water", "#888888");
          const isToday = day.date === today;
          const q = day.qualityScore ?? 5;
          const barH = Math.max(8, (q / 7) * 44);
          return (
            <button key={day.date} title={`${day.label} — ${day.quality} · ${day.moonSign}`}
              onClick={onPick ? () => onPick(day.date) : undefined}
              style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2.5, minWidth:24, flexShrink:0,
                background:"none", border:"none", padding:0, cursor: onPick ? "pointer" : "default" }}>
              <div style={{ fontSize:9, color:isToday?"#b07030":"var(--text-3)", fontWeight:isToday?700:400 }}>
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
