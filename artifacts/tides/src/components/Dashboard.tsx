import React from "react";
import { useCurrents, useNatalAngles } from "@/hooks/useTides";
import { usePreferences } from "@/contexts/preferences-context";
import { PLANET_LITERACY } from "@/lib/sky-literacy";
import { ELEMENT_COLORS } from "@/lib/elements";

// The daily report — the home as a navigation console. Weather + calendar +
// where you're steering, in one glance, day-focused with a look down the week.
// Each card is a compact instrument that opens its fuller surface. Assembled
// entirely from data the home already fetches (plus currents).

const ELEMENT_COLOR: Record<string, string> = { fire: "#c04830", earth: ELEMENT_COLORS.earth, air: ELEMENT_COLORS.air, water: ELEMENT_COLORS.water, spirit: "#6f6a90" };
const ASPECT_GLYPH: Record<string, string> = { conjunction: "☌︎", opposition: "☍︎", square: "□", trine: "△", sextile: "⚹" };

function Card({ title, icon, onOpen, tourId, children }: { title: string; icon: string; onOpen?: () => void; tourId?: string; children: React.ReactNode }) {
  return (
    <div onClick={onOpen} data-tour={tourId} style={{
      background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "13px 15px",
      cursor: onOpen ? "pointer" : "default", display: "flex", flexDirection: "column", minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-3)", flex: 1 }}>{icon} {title}</span>
        {onOpen && <span style={{ fontSize: 12, color: "var(--text-3)" }}>→</span>}
      </div>
      {children}
    </div>
  );
}

export default function Dashboard({
  now, week, northStars, windows, testerId, today, onNavigate, lat = 40.7, lon = -74.0, essential = false,
}: {
  now: any; week: any; northStars: any[] | undefined; windows: any[] | undefined;
  testerId: string | null; today: string; onNavigate?: (v: string) => void; lat?: number; lon?: number;
  /** Essential density: skip this component's weather hero — the tide hero
   *  directly above it already carries the day (it was a duplicate). Keep the
   *  two core cards (Guiding stars, On deck): they ARE the journey. */
  essential?: boolean;
}) {
  const { data: currents } = useCurrents(testerId, (typeof localStorage !== "undefined" && localStorage.getItem("obs_house_system")) || "whole-sign");
  const { data: anglesData } = useNatalAngles(testerId, lat, lon);
  const { prefs } = usePreferences();

  const el = now?.tide?.element ?? now?.element?.element ?? "water";
  const stars = (northStars ?? []).slice(0, 3);
  const todayWindows = (windows ?? []).slice(0, 4);
  const aspects = (now?.aspects ?? []).slice(0, 2);
  const weekDays = (week?.days ?? week ?? []).slice(0, 7);
  const prof = currents?.hasChart ? currents?.profection : null;

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <div style={{ marginBottom: 22 }}>
      {/* (The weather hero was removed entirely — owner 2026-07-23: it was
          the page's second "today's weather / Surge tide" mention; the tide
          hero directly above this component is the one voice.) */}

      {/* Instrument bento */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>

        {/* tourId: the walkthrough's "set a direction" stop lands here. */}
        <Card title="Guiding stars" icon="✦" tourId="today-stars" onOpen={onNavigate ? () => onNavigate("work") : undefined}>
          {stars.length > 0 ? stars.map((g: any, i: number) => {
            const col = ELEMENT_COLOR[g.element ?? ""] ?? "#8a8278";
            const target = Math.max(g.scheduledCount ?? 0, 2);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 0" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: col, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: "var(--color-foreground)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}</span>
                <span style={{ fontSize: 10, color: "var(--text-3)" }}>{g.completedCount ?? 0}/{target}</span>
              </div>
            );
          }) : <div style={{ fontSize: 12, color: "var(--text-3)" }}>Set a guiding star to steer by →</div>}
        </Card>

        <Card title="On deck · today" icon="◷" onOpen={onNavigate ? () => onNavigate("launch") : undefined}>
          {todayWindows.length > 0 ? todayWindows.map((w: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "3px 0" }}>
              <span style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0, minWidth: 52 }}>{fmtTime(w.startTime)}</span>
              <span style={{ fontSize: 12.5, color: "var(--color-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.title}</span>
            </div>
          )) : <div style={{ fontSize: 12, color: "var(--text-3)" }}>Nothing scheduled — weave your day in Plan →</div>}
        </Card>

        {/* (The big-sky card was dropped — the full explorable BigSky section
            renders directly below the dashboard, so it only echoed it.) */}

        {/* Week-ahead and month's-water were removed from Today (owner
            2026-07-15): the day view should stay about today. The week and
            month live in the Calendar/Ahead views where the longer horizons
            belong. Home now shows only your aims and what's on deck. */}
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
