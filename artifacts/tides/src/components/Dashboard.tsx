import React from "react";
import { yourDay, type DayTask } from "@/lib/your-day";
import { currentlyInProgress } from "@/lib/in-progress";
import type { ZoneFraming } from "@/lib/modes";

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

function Card({ title, icon, onOpen, children }: { title: string; icon: string; onOpen?: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onOpen} style={{
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

export default function Dashboard({ windows, todayTasks, onNavigate, framing }: {
  windows: any[] | undefined;
  todayTasks?: DayTask[];
  onNavigate?: (v: string) => void;
  /** Mode framing — "Your day" in the middle of the day, "Already committed"
   *  in the morning, "How the day went" at night. Same data throughout. */
  framing: ZoneFraming;
}) {
  // Both this card and the Keep-going card above read the SAME in-progress
  // answer. They disagreed once — "you're already in this" directly above
  // "still loose: the same task" — and one shared call is the fix.
  const running = currentlyInProgress(todayTasks as any);
  const day = yourDay(windows as any, todayTasks, new Date(), running?.task ?? null);

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>

        {/* The Guiding stars card moved to Home (2026-08-14, the Home/Today
            split). A star's progress is measured in weeks, and this page
            answers "what do I do next?" — so a week-scale figure sat here as
            standing reference on a surface about the next hour. Home is the
            panoramic view and now carries it, with the same rule about
            denominators intact.

            The walkthrough's "set a direction" stop moved with it, to the
            Home tab in the nav (lib/tour.ts). */}

        {/* Zone 3 — YOUR DAY. Was "On deck · today", which listed scheduled
            windows only: a day holding six unscheduled things rendered as
            "Nothing scheduled" and looked clear when it was not. Three rows,
            three questions — what you're inside of, what's coming, and what
            still has no time on it. */}
        <Card title={framing.dayLabel} icon="◷" onOpen={onNavigate ? () => onNavigate("launch") : undefined}>
          {day.empty
            ? <div style={{ fontSize: 12, color: "var(--text-3)" }}>{framing.dayEmpty}</div>
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
