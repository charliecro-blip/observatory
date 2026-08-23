/**
 * WHERE YOU ARE — the top of Home (design 2026-08-19).
 *
 * The top strip used to hold whatever you wrote at the last new moon: true,
 * worth keeping, and a SOUVENIR — it held the most valuable band on the page
 * for up to a month after it stopped being news. What belongs there is the
 * thing that actually changes daily and actually accrues: how the habits are
 * going, and what has moved toward the Guiding Stars.
 *
 * IT ABSORBS TWO CARDS RATHER THAN ADDING A THIRD VOICE. RhythmProgress and
 * Home's Guiding Stars card both folded into this, so the page's module count
 * goes DOWN while gaining the report — the one-voice-per-fact rule those two
 * were already straining against.
 *
 * The tap survives: a check-off is a tally mark, not a workflow (HOME study
 * D5), and it was the busy-parent persona's one daily gesture. Editing,
 * scheduling and the streak detail stay behind the doors.
 *
 * What it never does: score a star it was never given a target for, or print
 * a denominator nobody set. A star with nothing yet says "nothing yet".
 *
 * ── GROUPED UNDER THE STARS (owner, 2026-08-19) ──────────────────────────
 * "There's a more elegant way of showing that these habits belong to the
 * guiding stars." The two columns — habits here, stars there — drew the
 * means and the end as two unrelated inventories.
 *
 * THE CARD HAS TWO LAYOUTS AND PICKS BY WHAT IS TRUE. Grouping is only an
 * improvement once something is actually tied: with no links at all it would
 * render four empty headings above one undifferentiated pile, which is worse
 * than the two columns AND reads as an accusation. So when nothing is tied
 * the old side-by-side stands, with one quiet door to go tie something; the
 * grouped view takes over the moment a single link exists, and gets better
 * from there. Nobody has to be taught the feature — it arrives when it has
 * something to say.
 *
 * A HABIT UNDER TWO STARS APPEARS UNDER BOTH, and says so. It is one ledger
 * item counted by each of its stars (see lib/starLinks), so the counts here
 * are over DISTINCT habits — the header's "1 of 5 today" must keep matching
 * the tally the person can see, however many groups a row appears in.
 *
 * UNASSIGNED IS A NAMED BUCKET, never a silent remainder. Gaps are output
 * with reasons is the house rule, and "not tied to a star" is a true fact
 * about someone's setup with a working door attached; an untitled leftover
 * pile at the bottom of the card is the same data saying nothing.
 *
 * Untied TASKS are counted, not listed. "Your work" sits directly below this
 * card and lists every task grouped by date; drawing them again here would
 * make Home the second place that answers the same question, and the date
 * axis is the better one for a list you are working from.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { jsonArray } from "@/lib/jsonArray";
import { localToday } from "@/lib/dates";
import { starIdsOf } from "@/lib/starLinks";
import { useFold, FoldToggle } from "@/components/ModuleFold";
import { useIsMobile } from "@/hooks/useIsMobile";
import { usePreferences } from "@/contexts/preferences-context";
import { effectiveRhythm } from "@/lib/preferences";
import { useMomentum } from "@/components/Momentum";

interface Habit {
  id: number; name: string; emoji?: string | null;
  doneToday?: boolean; windowDone?: number; windowTarget?: number;
  cadenceMet?: boolean; flavor?: string | null;
  goalId?: number | null; starIds?: string | null;
}
interface Star { id: number; title: string; status?: string; completedCount?: number; scheduledCount?: number;
  /** A real end date, or null. Null is a star you hold; a date makes it a project that finishes. */
  endsOn?: string | null }
interface Task { id: number; title: string; done: string | null; dueDate: string | null; goalId?: number | null }

/**
 * A project's date, and how far off it is. Noon anchors the parse so the day
 * cannot roll backwards in a western timezone.
 *
 * The count of days appears only inside a fortnight. Further out it is noise,
 * and a countdown on something eight months away manufactures a pressure the
 * date does not carry on its own.
 */
function endsLabel(endsOn: string, today: string): { text: string; near: boolean } {
  const day = new Date(endsOn + "T12:00:00");
  const when = day.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const days = Math.round((day.getTime() - new Date(today + "T12:00:00").getTime()) / 86400000);
  if (days < 0) return { text: `${when} — the date has passed`, near: true };
  if (days === 0) return { text: `${when} — today`, near: true };
  if (days <= 14) return { text: `${when} · ${days} day${days === 1 ? "" : "s"}`, near: true };
  return { text: `by ${when}`, near: false };
}

const KEPT = "#3f7a4a";
const BEHIND = "#a08040";
const MAX_HABIT_ROWS = 5;      // ungrouped layout
// Grouped layout, habits before tasks. TWO on a phone: at three rows each,
// two star groups plus the untied bucket ran ~830px on an 812px screen and
// pushed Compass's answer below the fold — the same 375px failure the HOME
// study found in the work grid (D3), in a card added to fix a different one.
const MAX_ROWS_PER_STAR = 3;
const MAX_ROWS_PER_STAR_MOBILE = 2;

export default function WhereYouAre({ testerId, lat, lon, onNavigate, onOpenStar }: {
  testerId: string | null; lat: number; lon: number; onNavigate: (v: string) => void;
  /** Open one star's game plan, scrolled to and highlighted. It rode on the
   *  morning card's star rows until those merged into this one (2026-08-19);
   *  the affordance follows the stars rather than the card. */
  onOpenStar?: (goalId: number) => void;
}) {
  const qc = useQueryClient();
  const today = localToday();
  const { isFolded } = useFold();
  const isMobile = useIsMobile();
  // PROGRESS LANGUAGE follows the rhythm (design §2, "progress language"):
  // a campaign counts wins, a route counts what was kept and for how long,
  // the field counts what was touched. Same numbers, different headline.
  const rhythm = effectiveRhythm(usePreferences().prefs.display);
  const { data: momentum } = useMomentum(testerId, lat, lon, rhythm === "campaign" || rhythm === "route");

  const { data: habits, isError: habitsFailed } = useQuery<Habit[]>({
    // Same key as every other habit read on the page, so this is one cache
    // entry shared rather than a second request for the same answer.
    queryKey: ["habits", testerId, today, lat, lon],
    queryFn: async () => jsonArray<Habit>(
      await fetch(`/api/habits?today=${today}&lat=${lat}&lon=${lon}`,
        { headers: testerId ? { "x-tester-id": testerId } : {} })),
    enabled: !!testerId,
  });
  const { data: stars } = useQuery<Star[]>({
    queryKey: ["north-stars", testerId],
    queryFn: async () => jsonArray<Star>(
      await fetch("/api/planning/north-stars", { headers: testerId ? { "x-tester-id": testerId } : {} })),
    enabled: !!testerId,
  });
  // Home's own key, deliberately: it already asks for every task, and the
  // grouping needs the same answer. Sharing the key makes this a cache read
  // rather than a second request.
  const { data: tasks } = useQuery<Task[]>({
    queryKey: ["tasks", "all"],
    queryFn: async () => jsonArray<Task>(
      await fetch("/api/tasks", { headers: testerId ? { "x-tester-id": testerId } : {} })),
    enabled: !!testerId,
  });

  const toggleToday = useMutation({
    mutationFn: async ({ id, done }: { id: number; done: boolean }) => {
      const headers: Record<string, string> = { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) };
      if (done) await fetch(`/api/habits/${id}/log?date=${today}`, { method: "DELETE", headers });
      else await fetch(`/api/habits/${id}/log`, { method: "POST", headers, body: JSON.stringify({ date: today }) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["north-stars"] });
      qc.invalidateQueries({ queryKey: ["momentum"] });
    },
  });

  const liveHabits = habits ?? [];
  const liveStars = (stars ?? []).filter(s => s.status !== "done" && s.status !== "paused");
  const openTasks = (tasks ?? []).filter(t => t.done !== "true");

  // Nothing held at all is not a state worth a card — the cold-start doors
  // below say it better, with the right offer attached.
  // Stars whose hidden rows the reader has asked to see. "and 1 more" named
  // something real and then refused to show it — the card knows the row, it
  // is already loaded, and the only thing missing was somewhere to click.
  // Opening in place rather than navigating, because the star's own heading
  // is already the door to the star; a second control going the same place
  // would make the count decorative twice over.
  const [openStars, setOpenStars] = useState<Set<number>>(new Set());
  // Both by default — seeing them together is the whole point of one card.
  const [lens, setLens] = useState<"both" | "held" | "moving">("both");
  const toggleStar = (id: number) => setOpenStars(prev => {
    const next = new Set(prev);
    if (!next.delete(id)) next.add(id);
    return next;
  });

  if (habitsFailed || (liveHabits.length === 0 && liveStars.length === 0)) return null;

  // Counts are over DISTINCT habits, computed before any grouping, so a habit
  // serving two stars cannot inflate the header it appears under twice.
  const doneToday = liveHabits.filter(h => h.doneToday).length;
  const weekKept = liveHabits.reduce((n, h) => n + (h.windowDone ?? 0), 0);
  // What needs looking at first: behind, then untouched, then already kept.
  const rank = (h: Habit) => (h.cadenceMet === false ? 0 : 2) + (h.doneToday ? 1 : 0);
  const sorted = [...liveHabits].sort((a, b) => rank(a) - rank(b));

  const starIdSet = new Set(liveStars.map(s => s.id));
  // A link only counts when it points at a star that is still live. A habit
  // tied to a star since paused is untied as far as this card is concerned —
  // otherwise it disappears from both the group (there is none) and the
  // unassigned bucket, which is the silent drop the house rule forbids.
  const habitStars = new Map<number, number[]>(
    liveHabits.map(h => [h.id, starIdsOf(h).filter(id => starIdSet.has(id))]));
  const tiedHabits = liveHabits.filter(h => (habitStars.get(h.id) ?? []).length > 0);
  const untiedHabits = sorted.filter(h => (habitStars.get(h.id) ?? []).length === 0);
  const untiedTasks = openTasks.filter(t => !t.goalId || !starIdSet.has(t.goalId));
  const grouped = tiedHabits.length > 0
    || openTasks.some(t => t.goalId != null && starIdSet.has(t.goalId));

  // Two objects were living in one list under one word: things you HOLD, which
  // never finish, and things you are MOVING, which do. They read differently —
  // a quiet week against a value is a quiet week, while a quiet week against a
  // date is slippage — so they are drawn apart rather than interleaved.
  const held = liveStars.filter(s => !s.endsOn);
  const moving = liveStars.filter(s => !!s.endsOn)
    .sort((a, b) => (a.endsOn ?? "").localeCompare(b.endsOn ?? ""));

  const starTitle = new Map(liveStars.map(s => [s.id, s.title]));
  const folded = isFolded("whereYouAre");
  const perStar = isMobile ? MAX_ROWS_PER_STAR_MOBILE : MAX_ROWS_PER_STAR;

  const habitTally = (h: Habit) => {
    const chore = h.flavor === "chore";
    const target = h.windowTarget ?? 0;
    const done = h.windowDone ?? 0;
    if (chore) return h.doneToday ? "done today" : done > 0 ? `done ${done}×` : "";
    if (target > 0) return `${done} of ${target}`;
    return done > 0 ? `${done} this week` : "nothing yet";
  };
  const tallyColor = (h: Habit) =>
    h.flavor === "chore" ? "var(--text-3)"
    : h.cadenceMet === false ? BEHIND
    : (h.windowDone ?? 0) > 0 ? KEPT : "var(--text-3)";

  const HabitRow = ({ h, also }: { h: Habit; also?: string }) => (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <button
          onClick={() => toggleToday.mutate({ id: h.id, done: !!h.doneToday })}
          disabled={toggleToday.isPending}
          aria-pressed={!!h.doneToday}
          aria-label={`${h.doneToday ? "Unmark" : "Mark"} ${h.name} for today`}
          style={{
            // The mark stays 14px — the row is meant to be quiet. The TARGET is
            // 24px, which is WCAG 2.5.8's floor and what this failed at: on a
            // phone it rendered 17px, and it is the gesture a daily user makes
            // more than any other. The negative margin hands the extra space
            // back to the layout, so the row sits exactly where it did.
            width: 24, height: 24, margin: -5, flexShrink: 0, padding: 0,
            border: "none", background: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: toggleToday.isPending ? "default" : "pointer",
          }}>
          <span style={{
            width: 14, height: 14, borderRadius: h.flavor === "chore" ? 4 : "50%",
            border: h.doneToday ? "none" : "1.5px solid var(--color-border)",
            background: h.doneToday ? KEPT : "transparent",
            color: "#ffffff", fontSize: 8.5, lineHeight: 1,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{h.doneToday ? "✓" : ""}</span></button>
        <span style={{
          flex: 1, minWidth: 0, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          color: h.doneToday ? "var(--text-3)" : "var(--color-foreground)",
          textDecoration: h.doneToday ? "line-through" : "none",
        }}>{h.emoji ? `${h.emoji} ` : ""}{h.name}</span>
        <span style={{ fontSize: 10, flexShrink: 0, color: tallyColor(h) }}>{habitTally(h)}</span>
      </div>
      {/* The same habit, seen from another star. Its own line rather than a
          suffix on the name: the name span already truncates, and this is the
          first thing to lose when it does — exactly the wrong priority for
          the one label explaining why a row appears twice on the page. */}
      {also && (
        <div style={{ fontSize: 9.5, color: "var(--text-3)", paddingLeft: 23, marginTop: 1 }}>{also}</div>
      )}
    </div>
  );

  return (
    <div style={{
      background: "var(--color-card)", border: "1px solid var(--color-border)",
      borderRadius: 12, padding: folded ? "12px 16px" : "12px 16px 14px", flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: folded ? 0 : 10 }}>
        <FoldToggle id="whereYouAre" label="Where you are" />
        <span style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: "0.9px", textTransform: "uppercase",
          color: "var(--text-3)",
        }}>Where you are</span>
        {/* The count IS the summary — it is the single most-glanced number on
            the card, so a folded version keeps exactly the line someone would
            have opened it for. */}
        {liveHabits.length > 0 && (
          <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>
            {rhythm === "campaign"
              ? `${momentum?.winsWeek ?? 0} win${(momentum?.winsWeek ?? 0) === 1 ? "" : "s"} this week · ${doneToday} of ${liveHabits.length} today`
              : rhythm === "route"
              ? `${weekKept} kept this week${(momentum?.streak ?? 0) > 0 ? ` · ${momentum!.streak} day${momentum!.streak === 1 ? "" : "s"} running` : ""} · ${doneToday} of ${liveHabits.length} today`
              : rhythm === "field"
              ? `${doneToday} touched today · ${openTasks.length} open`
              : `${doneToday} of ${liveHabits.length} today${weekKept > 0 ? ` · ${weekKept} this week` : ""}`}
          </span>
        )}
        <button onClick={() => onNavigate("work")} style={{
          marginLeft: "auto", fontSize: 10.5, background: "none", border: "none",
          padding: 0, cursor: "pointer", color: "var(--color-primary)",
        }}>Open <span aria-hidden="true">→</span></button>
      </div>

      {folded ? null : grouped ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {/* TWO COLUMNS WHERE THERE IS ROOM. Stacked, five stars of three
              rows each ran the card past 650px — the top of Home spending
              more than a phone screen on the summary before the answer. The
              rows are short and the card is wide, so half of it was empty
              margin. `auto-fit` with a 250px floor gives two columns on a
              laptop and one on a phone without a breakpoint to maintain. */}
          {(() => {
            // One renderer, two bands. The bands differ in what they say ABOUT
            // a row, never in how a row is drawn — a project's habits are still
            // habits.
            const renderStar = (s: Star) => {
            const mine = sorted.filter(h => (habitStars.get(h.id) ?? []).includes(s.id));
            const myTasks = openTasks.filter(t => t.goalId === s.id);
            if (!mine.length && !myTasks.length) return null;
            const isOpen = openStars.has(s.id);
            const shownHabits = isOpen ? mine : mine.slice(0, perStar);
            const shownTasks = isOpen ? myTasks : myTasks.slice(0, Math.max(0, perStar - shownHabits.length));
            const hidden = (mine.length - shownHabits.length) + (myTasks.length - shownTasks.length);
            // What the control would reveal, which stays constant while open —
            // "fewer" needs to know there was something to fold back.
            const foldable = (mine.length + myTasks.length) - perStar;
            const done = s.completedCount ?? 0;
            const scheduled = s.scheduledCount ?? 0;
            return (
              <div key={s.id}>
                <button onClick={() => onOpenStar ? onOpenStar(s.id) : onNavigate("work")} style={{
                  display: "flex", alignItems: "baseline", gap: 8, width: "100%", textAlign: "left",
                  padding: 0, background: "none", border: "none", cursor: "pointer", marginBottom: 4,
                }}>
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: "var(--color-foreground)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{s.title}</span>
                  {/* A project is read against its date; a star is read against
                      its week. The same span, because they answer the same
                      question — how is this going — in the two different terms
                      the two objects actually have. */}
                  {s.endsOn ? (() => {
                    const e = endsLabel(s.endsOn, today);
                    return (
                      <span style={{ fontSize: 10, flexShrink: 0, color: e.near ? "var(--color-brass)" : "var(--text-3)", fontWeight: e.near ? 600 : 400 }}>
                        {e.text}
                      </span>
                    );
                  })() : (
                    <span style={{ fontSize: 10, flexShrink: 0, color: done > 0 ? KEPT : "var(--text-3)" }}>
                      {done > 0 ? `${done} this week` : scheduled > 0 ? `${scheduled} scheduled` : "nothing yet"}
                    </span>
                  )}
                </button>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 10, borderLeft: "1px solid var(--color-border)" }}>
                  {shownHabits.map(h => {
                    const others = (habitStars.get(h.id) ?? []).filter(id => id !== s.id);
                    const also = others.length === 0 ? undefined
                      : others.length === 1 ? `also counts toward ${starTitle.get(others[0])}`
                      : `also counts toward ${others.length} other stars`;
                    return <HabitRow key={h.id} h={h} also={also} />;
                  })}
                  {shownTasks.map(t => (
                    <button key={t.id} onClick={() => onNavigate("work")} style={{
                      display: "flex", alignItems: "baseline", gap: 9, width: "100%", textAlign: "left",
                      padding: 0, background: "none", border: "none", cursor: "pointer",
                    }}>
                      <span style={{ width: 14, flexShrink: 0, fontSize: 10, color: "var(--text-3)", lineHeight: 1.6 }}>·</span>
                      <span style={{
                        flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--color-foreground)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{t.title}</span>
                      {t.dueDate && (
                        <span style={{ fontSize: 10, flexShrink: 0, color: t.dueDate < today ? BEHIND : "var(--text-3)" }}>
                          {t.dueDate < today ? "past its date" : t.dueDate === today ? "today" : ""}
                        </span>
                      )}
                    </button>
                  ))}
                  {(hidden > 0 || (isOpen && foldable > 0)) && (
                    <button
                      onClick={() => toggleStar(s.id)}
                      aria-expanded={isOpen}
                      style={{
                        fontSize: 10, color: "var(--text-3)", background: "none", border: "none",
                        padding: 0, textAlign: "left", cursor: "pointer", width: "fit-content",
                      }}
                    >
                      {isOpen ? "fewer" : `and ${hidden} more`}
                    </button>
                  )}
                </div>
              </div>
            );
            };

            const bands: Array<{ key: "held" | "moving"; head: string; note: string; rows: Star[] }> = [
              { key: "held" as const, head: "What you're holding", note: "no end, and none needed", rows: held },
              { key: "moving" as const, head: "What you're moving", note: "these finish", rows: moving },
            ].filter(b => b.rows.length > 0 && (lens === "both" || lens === b.key));

            // The switch earns its place only when there is something on both
            // sides — otherwise it is a control with one setting.
            const showLens = held.length > 0 && moving.length > 0;

            return (
              <>
                {showLens && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -2 }} role="group" aria-label="Which to show">
                    {(["both", "held", "moving"] as const).map((k, i, arr) => (
                      <button key={k} onClick={() => setLens(k)} aria-pressed={lens === k}
                        style={{
                          fontSize: 9.5, padding: "2px 9px", cursor: "pointer",
                          border: "1px solid var(--color-border)",
                          borderLeftWidth: i === 0 ? 1 : 0,
                          borderRadius: i === 0 ? "5px 0 0 5px" : i === arr.length - 1 ? "0 5px 5px 0" : 0,
                          background: lens === k ? "var(--color-foreground)" : "var(--color-card-2)",
                          color: lens === k ? "var(--color-card)" : "var(--text-3)",
                          fontWeight: lens === k ? 600 : 400,
                        }}>
                        {k === "both" ? "Both" : k === "held" ? "Holding" : "Moving"}
                      </button>
                    ))}
                  </div>
                )}
                {bands.map(b => (
                  <div key={b.key}>
                    {(bands.length > 1 || lens !== "both") && (
                      <div style={{
                        fontSize: 9.5, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase",
                        color: b.key === "moving" ? "var(--color-meridian)" : "var(--color-brass)",
                        marginBottom: 6, display: "flex", alignItems: "baseline", gap: 7,
                      }}>
                        {b.head}
                        <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, color: "var(--text-3)" }}>· {b.note}</span>
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "11px 20px" }}>
                      {b.rows.map(renderStar)}
                    </div>
                  </div>
                ))}
              </>
            );
          })()}

          {/* Stars nothing points at yet, named in one line rather than given
              an empty heading each. The count is the useful part and the door
              is the point; four blank groups would be four accusations. */}
          {(() => {
            const bare = liveStars.filter(s =>
              !liveHabits.some(h => (habitStars.get(h.id) ?? []).includes(s.id))
              && !openTasks.some(t => t.goalId === s.id));
            if (!bare.length) return null;
            return (
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, borderTop: "1px solid var(--color-border)", paddingTop: 9 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Nothing tied yet: {bare.map(s => s.title).join(" · ")}
                </span>
                <button onClick={() => onNavigate("work")} style={{
                  flexShrink: 0, fontSize: 10.5, background: "none", border: "none",
                  padding: 0, cursor: "pointer", color: "var(--color-primary)",
                }}>Tie something to them <span aria-hidden="true">→</span></button>
              </div>
            );
          })()}

          {(untiedHabits.length > 0 || untiedTasks.length > 0) && (
            <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 9 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)" }}>Not tied to a star</span>
                <button onClick={() => onNavigate("habits")} style={{
                  marginLeft: "auto", fontSize: 10.5, background: "none", border: "none",
                  padding: 0, cursor: "pointer", color: "var(--color-primary)",
                }}>Tie them in <span aria-hidden="true">→</span></button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {untiedHabits.slice(0, perStar).map(h => <HabitRow key={h.id} h={h} />)}
                {untiedHabits.length > perStar && (
                  <div style={{ fontSize: 10, color: "var(--text-3)" }}>
                    and {untiedHabits.length - perStar} more habits
                  </div>
                )}
                {/* Counted, not listed — "Your work" below lists every task by
                    date, and that is the better axis for a list you work from. */}
                {untiedTasks.length > 0 && (
                  <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                    {untiedTasks.length} {untiedTasks.length === 1 ? "task" : "tasks"}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: liveStars.length && liveHabits.length ? "minmax(0, 1.35fr) minmax(0, 1fr)" : "minmax(0, 1fr)", gap: 20 }}>
            {liveHabits.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>Habits</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {sorted.slice(0, MAX_HABIT_ROWS).map(h => <HabitRow key={h.id} h={h} />)}
                  {liveHabits.length > MAX_HABIT_ROWS && (
                    <div style={{ fontSize: 10, color: "var(--text-3)", paddingTop: 2 }}>
                      and {liveHabits.length - MAX_HABIT_ROWS} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {liveStars.length > 0 && (
              <div style={{ borderLeft: liveHabits.length ? "1px solid var(--color-border)" : "none", paddingLeft: liveHabits.length ? 20 : 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>Guiding Stars</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {liveStars.map(g => {
                    const done = g.completedCount ?? 0;
                    const scheduled = g.scheduledCount ?? 0;
                    return (
                      <button key={g.id} onClick={() => onOpenStar ? onOpenStar(g.id) : onNavigate("work")} style={{
                        display: "flex", alignItems: "baseline", gap: 8, width: "100%", textAlign: "left",
                        padding: 0, background: "none", border: "none", cursor: "pointer",
                      }}>
                        <span style={{
                          flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--color-foreground)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{g.title}</span>
                        <span style={{ fontSize: 10, flexShrink: 0, color: done > 0 ? KEPT : "var(--text-3)" }}>
                          {done > 0 ? `${done} this week` : scheduled > 0 ? `${scheduled} scheduled` : "nothing yet"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* NO STARS YET. This was a dismissible banner on Today (audit §5)
              — a page the person may never open, and a nudge sitting in the
              notice band above the day itself. The offer belongs in the card
              that already draws the stars: what is missing is visible in the
              same glance as what is there, and it needs no dismiss button
              because it disappears the moment it is answered.

              Only when there are habits. With nothing held at all the card
              does not render, and the cold-start doors below make a better
              first offer than this one. */}
          {liveStars.length === 0 && liveHabits.length > 0 && (
            <button onClick={() => onNavigate("work")} style={{
              marginTop: 10, fontSize: 11, background: "none", border: "none",
              padding: 0, cursor: "pointer", color: "var(--color-primary)", textAlign: "left",
            }}>Name a Guiding Star these can count toward <span aria-hidden="true">→</span></button>
          )}

          {/* The door to the grouped view, offered only when both halves
              exist: with no stars or no habits there is nothing to weave and
              the invitation would be a chore assigned by the page.

              It used to read "…and they group here", which was the interface
              captioning its own behavior. If grouping needs a caption to be
              discoverable, that is a design fault rather than a copy one, and
              the caption would only hide it. */}
          {liveHabits.length > 0 && liveStars.length > 0 && (
            <button onClick={() => onNavigate("habits")} style={{
              marginTop: 10, fontSize: 10.5, background: "none", border: "none",
              padding: 0, cursor: "pointer", color: "var(--color-primary)", textAlign: "left",
            }}>Tie a habit to a star <span aria-hidden="true">→</span></button>
          )}
        </>
      )}
    </div>
  );
}
