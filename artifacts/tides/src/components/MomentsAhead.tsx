/**
 * MOMENTS AHEAD — the hours you have left, and what each is for.
 *
 * Lifted out of Today's "Waves" card (audit 2026-08-19 §3). Waves was two
 * cards under one header: a list of today's unscheduled tasks, which Home
 * already draws grouped by date, and THIS — the part no surface on Home could
 * answer. `DayAhead` shows what has been placed and `CompassNow` shows one
 * pick; neither shows the shape of the hours still to come.
 *
 * It was ~110 lines of inline IIFE inside a 3181-line page, which is also why
 * none of its reasoning was testable where it sat.
 *
 * WHAT IT MATCHES, AND WHY THAT ORDER:
 *
 *  1. LUNAR CONTACTS LEAD. The census puts `planetary-time` at 99% frequency
 *     — so common it can never establish convergence on its own — while
 *     `lunar-contact` runs at 39% and IS an establishing family. When the
 *     list is cut, the hour loses its place, never the aspect.
 *  2. Applying only, and only what perfects before the day is out. A
 *     separating aspect is a wave already passed, and listing one would be
 *     the same error as showing an hour that has ended.
 *  3. Hours that line up with something you HOLD come next: tasks and stars
 *     carry an auto-diagnosed ruling planet, and when an upcoming hour's
 *     ruler matches, that hour is the moment.
 *  4. The rest are filled with what each hour is FOR, via suggestApproach —
 *     which is day-part aware rather than PLANET_ACTIVITIES[planet][0]. That
 *     flat list had no sense of the hour, which is how "Mars hour — train
 *     hard" once arrived at 21:20 against a stated 23:00 bedtime.
 *
 * The generic rows are NOT an all-or-nothing fallback. They used to fire only
 * when nothing else matched, so holding a single relevant task collapsed the
 * list to one line ("I also wanted more waves"): the hours were always there,
 * the code just stopped naming them the moment one of them had a task on it.
 *
 * It is sky vocabulary end to end, so every caller gates it on the lens. At
 * minimal it should not render at all — there is nothing here to translate,
 * because the rows ARE the planetary hours.
 */

import { suggestApproach } from "@/lib/approach";
import { PLANET_COLORS } from "@/lib/planetColors";
import { useFold, FoldToggle } from "@/components/ModuleFold";

/** Never advice — these sit beside tasks, and a line telling someone to avoid
 *  a square would contradict the task listed on the very next row. */
const LUNAR_MOMENT: Record<string, string> = {
  supportive: "an easier stretch — use it on something real",
  flowing: "things move without being pushed",
  challenging: "friction, and it's workable",
  polarizing: "two pulls at once — pick one",
  intensifying: "whatever's already going gets louder",
};

export interface MomentHolder { id: number; title: string; planet?: string | null }

export default function MomentsAhead({
  now, tasks, stars, chronotype, label = "Ahead", maxRows = 4, framed = false, onOpen,
}: {
  now: any;
  /** OPEN tasks only — a finished one is not a moment ahead. */
  tasks: MomentHolder[];
  /** ACTIVE stars only. */
  stars: MomentHolder[];
  chronotype?: { wakeTime?: string; sleepTime?: string } | null;
  label?: string;
  maxRows?: number;
  /** Home draws its own card; Today nests this inside Waves. */
  framed?: boolean;
  onOpen?: () => void;
}) {
  const { isFolded } = useFold();
  const folded = framed && isFolded("momentsAhead");
  const upcoming = (now?.upcomingHours ?? []).slice(0, 8);
  const at = (t: string) => {
    const hhmm = String(t ?? "").match(/^(\d{1,2}):(\d{2})/);
    const when = new Date();
    if (hhmm) when.setHours(Number(hhmm[1]), Number(hhmm[2]), 0, 0);
    return when;
  };

  const moments = upcoming.map((h: any) => ({
    ...h,
    task: tasks.find(t => t.planet === h.planet),
    star: stars.find(g => g.planet === h.planet),
  })).filter((m: any) => m.task || m.star).slice(0, maxRows);

  const used = new Set(moments.map((m: any) => m.time));
  const generic = upcoming
    .filter((h: any) => !used.has(h.time))
    .map((h: any) => {
      const a = suggestApproach({
        planet: h.planet,
        at: at(h.time),
        wakeTime: chronotype?.wakeTime,
        sleepTime: chronotype?.sleepTime,
        voc: !!now?.voc?.isVOC,
        moonSign: now?.moonSign,
      });
      return a ? { ...h, generic: a.text } : null;
    })
    .filter(Boolean) as any[];

  const lunar = ((now?.moonAspects ?? []) as any[])
    .filter(a => a.applying && !a.stationsBeforeExact)
    .filter(a => typeof a.hoursToExact === "number" && a.hoursToExact > 0 && a.hoursToExact <= 12)
    .map(a => {
      const when = new Date(Date.now() + a.hoursToExact * 3600000);
      const other = a.planet1 === "Moon" ? a.planet2 : a.planet1;
      return {
        time: `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`,
        lunar: { other, aspect: a.aspect, nature: a.nature },
        task: tasks.find(t => t.planet === other),
        star: stars.find(g => g.planet === other),
      };
    })
    .sort((a, b) => String(a.time).localeCompare(String(b.time)))
    .slice(0, 2);   // two at most; this is a rail, not an ephemeris

  const rows = [...lunar, ...moments, ...generic]
    .sort((a: any, b: any) => String(a.time).localeCompare(String(b.time)))
    .slice(0, maxRows + lunar.length);

  if (!rows.length) return null;

  const inner = (
    <>
      <div style={{
        fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.8px",
        color: "var(--text-3)", marginBottom: 5, display: "flex", alignItems: "baseline", gap: 8,
      }}>
        {framed && <FoldToggle id="momentsAhead" label={label} />}
        <span>{label}</span>
        {/* The count, not the rows: "4 ahead" is a true fact this module
            already holds, and it is what the fold leaves behind. */}
        {folded && <span style={{ textTransform: "none", letterSpacing: 0, fontSize: 10.5 }}>
          {rows.length} ahead
        </span>}
        {onOpen && !folded && (
          <button onClick={onOpen} style={{
            marginLeft: "auto", fontSize: 10.5, textTransform: "none", letterSpacing: 0,
            background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--color-primary)",
          }}>Open Today →</button>
        )}
      </div>
      {!folded && rows.map((m: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 7, padding: "2px 0", fontSize: 11.5, lineHeight: 1.5 }}>
          <span style={{ color: "var(--text-3)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{m.time}</span>
          <span style={{ color: "var(--color-foreground)" }}>
            {m.lunar
              ? <><span style={{ color: PLANET_COLORS.Moon }}>☽</span> {m.lunar.aspect} {m.lunar.other}</>
              : <>{m.planet} hour</>}
            {" — "}
            {m.task ? <>a window for “<b>{m.task.title}</b>”</>
              : m.star ? <>moves “<b>{m.star.title}</b>”</>
              : m.lunar ? <>{LUNAR_MOMENT[m.lunar.nature as string] ?? "the day turns here"}</>
              : <>{m.generic}</>}
          </span>
        </div>
      ))}
    </>
  );

  if (!framed) {
    return <div style={{ padding: "8px 18px 4px", borderTop: "1px solid var(--color-border)" }}>{inner}</div>;
  }
  return (
    <div style={{
      background: "var(--color-card)", border: "1px solid var(--color-border)",
      borderRadius: 10, padding: "10px 14px 8px", flexShrink: 0,
    }}>{inner}</div>
  );
}
