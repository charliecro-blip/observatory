// THE PROPOSAL, AS A WEEK RATHER THAN A LIST.
//
// The weave already grouped by day, but a list answers "what is on Tuesday"
// and not "how does this all sit together" — whether Wednesday is stacked
// while Thursday is empty, whether two things run back to back, whether the
// week has any air in it (owner, 2026-08-13: "i should be able to plan each
// of these individually. and see a calendar view of how they all fit
// together").
//
// Deliberately NOT a full calendar: no drag, no hour grid, no editing. It is
// a picture of the shape, drawn from the same `planned` array the list
// renders, so the two can never disagree. Moving something still happens in
// the list, where the alternatives and their reasons live.

import { ELEMENT_COLORS } from "@/lib/elements";

const ELEMENT_COLOR: Record<string, string> = {
  fire: "#c04830", earth: ELEMENT_COLORS.earth, air: ELEMENT_COLORS.air, water: ELEMENT_COLORS.water,
};

export interface CalItem {
  title: string;
  startAt: string;
  endAt: string;
  element: string;
  estimatedMinutes: number;
}

// The drawn band of the day. Most work happens inside these hours, and a
// window outside them is clamped into view rather than dropped — a 6am start
// must not vanish from the picture that is supposed to show the whole plan.
const DAY_START = 7;
const DAY_END = 22;
const SPAN = DAY_END - DAY_START;

const hourOf = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
};

export default function PlanCalendar({ items, dropped }: {
  items: CalItem[];
  /** Indices the user has dropped — excluded, so the picture matches the plan. */
  dropped?: Set<number>;
}) {
  const kept = items.filter((_, i) => !dropped?.has(i));
  if (!kept.length) return null;

  // Group by local calendar day, in order.
  const byDay = new Map<string, CalItem[]>();
  for (const it of kept) {
    const key = new Date(it.startAt).toDateString();
    byDay.set(key, [...(byDay.get(key) ?? []), it]);
  }
  const days = [...byDay.entries()]
    .sort((a, b) => Date.parse(a[1][0].startAt) - Date.parse(b[1][0].startAt));

  // One shared vertical scale so a taller day reads as a fuller day.
  const COL_H = 132;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-3)", marginBottom: 7 }}>
        How the week sits
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "stretch", overflowX: "auto", paddingBottom: 4 }}>
        {days.map(([key, dayItems]) => {
          const load = dayItems.reduce((n, it) => n + (it.estimatedMinutes || 0), 0);
          return (
            <div key={key} style={{ flex: "1 1 0", minWidth: 74 }}>
              <div style={{ fontSize: 9.5, color: "var(--color-muted)", marginBottom: 4, whiteSpace: "nowrap" }}>
                {new Date(dayItems[0].startAt).toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}
              </div>
              <div style={{
                position: "relative", height: COL_H, borderRadius: 7,
                background: "var(--color-card-2)", border: "1px solid var(--color-border)", overflow: "hidden",
              }}>
                {/* Midday rule — one reference line, so a block's height on
                    the column means something without an hour axis. */}
                <div style={{
                  position: "absolute", left: 0, right: 0, top: `${((13 - DAY_START) / SPAN) * 100}%`,
                  height: 1, background: "var(--color-border)", opacity: 0.7,
                }} />
                {dayItems.map((it, i) => {
                  const rawStart = hourOf(it.startAt);
                  const rawEnd = hourOf(it.endAt);
                  const start = Math.max(DAY_START, Math.min(DAY_END - 0.25, rawStart));
                  const end = Math.max(start + 0.25, Math.min(DAY_END, rawEnd));
                  const top = ((start - DAY_START) / SPAN) * 100;
                  const height = ((end - start) / SPAN) * 100;
                  const col = ELEMENT_COLOR[it.element] ?? "#8a8278";
                  return (
                    <div key={i}
                      title={`${it.title} · ${new Date(it.startAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
                      style={{
                        position: "absolute", left: 3, right: 3,
                        top: `${top}%`, height: `${Math.max(height, 4)}%`,
                        background: `${col}26`, borderLeft: `2px solid ${col}`, borderRadius: 4,
                        padding: "1px 4px", overflow: "hidden",
                      }}>
                      <div style={{ fontSize: 8.5, color: "var(--color-foreground)", lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {it.title}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* The day's load, stated — the picture shows crowding, this
                  says how much. */}
              <div style={{ fontSize: 9, color: "var(--text-3)", marginTop: 3, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                {load >= 60 ? `${Math.round(load / 60 * 10) / 10}h` : `${load}m`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
