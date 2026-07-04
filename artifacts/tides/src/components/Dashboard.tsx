import React from "react";
import { useCurrents } from "@/hooks/useTides";

// The daily report — the home as a navigation console. Weather + calendar +
// where you're steering, in one glance, day-focused with a look down the week.
// Each card is a compact instrument that opens its fuller surface. Assembled
// entirely from data the home already fetches (plus currents).

const ELEMENT_COLOR: Record<string, string> = { fire: "#c04830", earth: "#4a7040", air: "#7040a0", water: "#3a5a80", spirit: "#6f6a90" };
const ASPECT_GLYPH: Record<string, string> = { conjunction: "☌", opposition: "☍", square: "□", trine: "△", sextile: "⚹" };
const PLANET_GLYPH: Record<string, string> = { Sun: "☉", Moon: "☽", Mercury: "☿", Venus: "♀", Mars: "♂", Jupiter: "♃", Saturn: "♄", Uranus: "♅", Neptune: "♆", Pluto: "♇" };
const MOON_EMOJI: Record<string, string> = { new: "🌑", waxing_crescent: "🌒", first_quarter: "🌓", waxing_gibbous: "🌔", full: "🌕", waning_gibbous: "🌖", last_quarter: "🌗", waning_crescent: "🌘" };

function Card({ title, icon, onOpen, children }: { title: string; icon: string; onOpen?: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onOpen} style={{
      background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "13px 15px",
      cursor: onOpen ? "pointer" : "default", display: "flex", flexDirection: "column", minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.7px", color: "#aaa", flex: 1 }}>{icon} {title}</span>
        {onOpen && <span style={{ fontSize: 12, color: "#ccc" }}>→</span>}
      </div>
      {children}
    </div>
  );
}

export default function Dashboard({
  now, week, northStars, windows, testerId, today, onNavigate,
}: {
  now: any; week: any; northStars: any[] | undefined; windows: any[] | undefined;
  testerId: string | null; today: string; onNavigate?: (v: string) => void;
}) {
  const { data: currents } = useCurrents(testerId, (typeof localStorage !== "undefined" && localStorage.getItem("obs_house_system")) || "whole-sign");

  const el = now?.tide?.element ?? now?.element?.element ?? "water";
  const elCol = ELEMENT_COLOR[el] ?? "#888";
  const phase = now?.moonPhase ?? "";
  const stars = (northStars ?? []).slice(0, 3);
  const todayWindows = (windows ?? []).slice(0, 4);
  const aspects = (now?.aspects ?? []).slice(0, 2);
  const weekDays = (week?.days ?? week ?? []).slice(0, 7);
  const prof = currents?.hasChart ? currents?.profection : null;

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <div style={{ marginBottom: 22 }}>
      {/* Hero — today's weather */}
      <div style={{
        background: `linear-gradient(180deg, ${elCol}14, ${elCol}06)`, border: "1px solid var(--color-border)",
        borderRadius: 14, padding: "15px 18px", marginBottom: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.8px", color: elCol, fontWeight: 600 }}>Today's weather</span>
          <span style={{ fontSize: 11, color: "#999" }}>{phase && MOON_EMOJI[phase]} {phase.replace(/_/g, " ")} · {Math.round((now?.moonIllumination ?? 0) * 100)}%</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "-0.3px" }}>{now?.tide?.headline ?? "—"}</span>
          <span style={{ fontSize: 13, color: elCol, fontWeight: 600 }}>{now?.tide?.levelLabel ?? ""}</span>
          <span style={{ fontSize: 12.5, color: "#888", textTransform: "capitalize" }}>· {el} · {now?.quality ?? ""}</span>
        </div>
      </div>

      {/* Instrument bento */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>

        <Card title="Guiding stars" icon="✦" onOpen={onNavigate ? () => onNavigate("work") : undefined}>
          {stars.length > 0 ? stars.map((g: any, i: number) => {
            const col = ELEMENT_COLOR[g.element ?? ""] ?? "#8a8278";
            const target = Math.max(g.scheduledCount ?? 0, 2);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 0" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: col, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: "var(--color-foreground)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}</span>
                <span style={{ fontSize: 10, color: "#aaa" }}>{g.completedCount ?? 0}/{target}</span>
              </div>
            );
          }) : <div style={{ fontSize: 12, color: "#aaa" }}>Set a guiding star to steer by →</div>}
        </Card>

        <Card title="On deck · today" icon="◷" onOpen={onNavigate ? () => onNavigate("calendar") : undefined}>
          {todayWindows.length > 0 ? todayWindows.map((w: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "3px 0" }}>
              <span style={{ fontSize: 11, color: "#999", flexShrink: 0, minWidth: 52 }}>{fmtTime(w.startTime)}</span>
              <span style={{ fontSize: 12.5, color: "var(--color-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.title}</span>
            </div>
          )) : <div style={{ fontSize: 12, color: "#aaa" }}>Nothing scheduled. Plan your day in When →</div>}
        </Card>

        <Card title="The big sky" icon="◈" onOpen={onNavigate ? () => onNavigate("calendar") : undefined}>
          {aspects.length > 0 ? aspects.map((a: any, i: number) => (
            <div key={i} style={{ fontSize: 12.5, color: "var(--color-foreground)", padding: "3px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {PLANET_GLYPH[a.planet1] ?? a.planet1} {ASPECT_GLYPH[a.aspect] ?? ""} {PLANET_GLYPH[a.planet2] ?? a.planet2}
              <span style={{ color: "#999", fontSize: 11, marginLeft: 5 }}>{a.planet1} {a.aspect} {a.planet2}</span>
            </div>
          )) : <div style={{ fontSize: 12, color: "#aaa" }}>Calm skies — no strong aspects right now.</div>}
        </Card>

        <Card title="The week ahead" icon="↝" onOpen={onNavigate ? () => onNavigate("calendar") : undefined}>
          <div style={{ display: "flex", gap: 5, alignItems: "flex-end", height: 44 }}>
            {weekDays.map((d: any, i: number) => {
              const col = ELEMENT_COLOR[d.element ?? ""] ?? "#ccc";
              const h = 12 + Math.round(((d.qualityScore ?? 3) / 7) * 30);
              const dd = new Date((d.date ?? today) + "T12:00:00");
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ width: "100%", height: h, background: `${col}55`, borderTop: `2px solid ${col}`, borderRadius: 2 }} />
                  <span style={{ fontSize: 8.5, color: i === 0 ? "var(--color-primary)" : "#aaa", fontWeight: i === 0 ? 700 : 400 }}>{dd.toLocaleDateString("en-US", { weekday: "narrow" })}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {prof && (
          <Card title="Currents · the long season" icon="≋" onOpen={onNavigate ? () => onNavigate("work") : undefined}>
            <div style={{ fontSize: 12.5, color: "var(--color-foreground)" }}>
              {PLANET_GLYPH[prof.timeLord] ?? ""} Your {ordinal(prof.house)}-house year
            </div>
            <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>ruled by {prof.timeLord}</div>
          </Card>
        )}
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
