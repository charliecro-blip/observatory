import React from "react";
import { ELEMENT_COLORS } from "@/lib/elements";
import { yourDay, type DayTask } from "@/lib/your-day";

// The two cards that ARE the journey: where you're steering, and what today
// actually holds. Everything else this component once carried has been removed
// over time — the weather hero (a duplicate of the tide hero directly above
// it), the big-sky card (the full section renders below), and the week/month
// views (the day view stays about today; longer horizons live in Calendar).
//
// Those removals left their props and hooks behind. `useCurrents` and
// `useNatalAngles` were still being called here with their results entirely
// unused, costing two API requests on every Today load against a measured
// problem of 27 requests per cold load. Removed with the rest of the residue.

const ELEMENT_COLOR: Record<string, string> = {
  fire: "#c04830", earth: ELEMENT_COLORS.earth, air: ELEMENT_COLORS.air,
  water: ELEMENT_COLORS.water, spirit: "#6f6a90",
};

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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "3px 0" }}>
      <span style={{ fontSize: 9.5, color: "var(--text-3)", flexShrink: 0, minWidth: 58 }}>{label}</span>
      <span style={{ fontSize: 12.5, color: "var(--color-foreground)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{children}</span>
    </div>
  );
}

export default function Dashboard({ northStars, windows, todayTasks, onNavigate }: {
  northStars: any[] | undefined;
  windows: any[] | undefined;
  todayTasks?: DayTask[];
  onNavigate?: (v: string) => void;
}) {
  const stars = (northStars ?? []).slice(0, 3);
  const day = yourDay(windows as any, todayTasks);

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>

        {/* tourId: the walkthrough's "set a direction" stop lands here. */}
        <Card title="Guiding stars" icon="✦" tourId="today-stars" onOpen={onNavigate ? () => onNavigate("work") : undefined}>
          {stars.length > 0 ? stars.map((g: any, i: number) => {
            const col = ELEMENT_COLOR[g.element ?? ""] ?? "#8a8278";
            // Report what HAPPENED, never a target the user didn't set. This
            // read `{done}/{max(scheduled, 2)}` — so a star with nothing
            // scheduled showed "0/2", an obligation invented by the app and
            // then scored against. Movement is worth reflecting; a denominator
            // nobody chose is just a quiet accusation.
            const done = g.completedCount ?? 0;
            const scheduled = g.scheduledCount ?? 0;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "3px 0" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: col, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: "var(--color-foreground)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}</span>
                <span style={{ fontSize: 10, color: "var(--text-3)" }}>
                  {done > 0 ? `${done} this week` : scheduled > 0 ? `${scheduled} scheduled` : "—"}
                </span>
              </div>
            );
          }) : <div style={{ fontSize: 12, color: "var(--text-3)" }}>Set a guiding star to steer by →</div>}
        </Card>

        {/* Zone 3 — YOUR DAY. Was "On deck · today", which listed scheduled
            windows only: a day holding six unscheduled things rendered as
            "Nothing scheduled" and looked clear when it was not. Three rows,
            three questions — what you're inside of, what's coming, and what
            still has no time on it. */}
        <Card title="Your day" icon="◷" onOpen={onNavigate ? () => onNavigate("launch") : undefined}>
          {day.empty
            ? <div style={{ fontSize: 12, color: "var(--text-3)" }}>Nothing on today — weave your day in Plan →</div>
            : (
              <>
                {day.now && <Row label="now"><span style={{ color: "var(--text-3)" }}>{day.now.when} · </span>{day.now.title}</Row>}
                {day.next && <Row label="next"><span style={{ color: "var(--text-3)" }}>{day.next.when} · </span>{day.next.title}</Row>}
                {day.loose.length > 0 && (
                  <Row label="still loose">
                    <span style={{ color: "var(--color-muted)" }}>
                      {day.loose.slice(0, 3).map((t) => t.title).join(" · ")}
                      {day.loose.length > 3 && ` · +${day.loose.length - 3}`}
                    </span>
                  </Row>
                )}
              </>
            )}
        </Card>
      </div>
    </div>
  );
}
