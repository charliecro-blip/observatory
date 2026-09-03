/**
 * HABIT PROGRESS — four cadences, four drawings.
 *
 * The model already says a 3×-a-week practice is not a broken daily; until
 * now every cadence rendered as the same nine-pixel line of text, so the
 * distinction lived in the server and nowhere the reader could see it.
 *
 * The four cadences are four different shapes of time, and one component
 * rendered four ways is what made a weekly habit feel judged:
 *
 *   daily       a RUN — the question is continuity, so it's drawn as a line
 *               with gaps in it. It never resets to zero, because the rule
 *               (BACKLOG §4, "reveal patterns, don't score obedience") says
 *               a rhythm has a beat you can miss and return to.
 *   several     a DAILY QUOTA — N discs filling within TODAY, not the week.
 *               Borrows weekly's shape (a target nobody schedules against
 *               specific days) but the window is one day and resets with
 *               it, because "drink water 4 times" is a rhythm inside a day,
 *               not across one.
 *   most_days   a THRESHOLD — ~5 of 7, forgiving on purpose. The waterline
 *               IS the point, so it's the thing drawn; kept days rise to it.
 *   weekly      a QUOTA — choosing "3× a week" is choosing not to care which
 *               days, so the drawing must not imply days. N discs, filling.
 *   occasional  a RECORD — no target means no possible deficit, so there are
 *               NO empty slots. An empty slot is a claim that something is
 *               owed, and nothing is owed here.
 *
 * Every shape is a fixed 320-unit viewBox scaled by CSS, so the same
 * component reads at rail size and at page size without a second variant.
 *
 * Colors come from the tokens, never literals — `--kept` and friends are
 * defined for both themes in index.css. See lessons: a hue defined only
 * under one theme renders one theme's ink on the other theme's paper.
 */

export type HabitCadence = "daily" | "most_days" | "weekly" | "several" | "occasional";

export interface HabitProgressDay {
  date: string;
  done: boolean;
  isToday: boolean;
}

interface Props {
  cadence: HabitCadence;
  /** Fourteen days, oldest first, last entry today — the server's shape. */
  days: HabitProgressDay[];
  /** Kept within the rolling 7 days ending today. */
  windowDone: number;
  /** 7 for daily, 5 for most_days, 1–7 for weekly, targetPerDay×7 for
   *  several, 0 for occasional. */
  windowTarget: number;
  /** `several` only: how many of today's target have been logged. */
  countToday?: number;
  /** `several` only: how many a day this habit asks for. */
  targetPerDay?: number | null;
  /** Consecutive days back from YESTERDAY — the server excludes today. */
  streak: number;
  doneToday: boolean;
  /** A chore never speaks streak language, whatever its cadence (owner F7). */
  chore?: boolean;
  /** When given, each day becomes the control for itself. */
  onToggleDay?: (date: string, done: boolean) => void;
  busy?: boolean;
  /** For accessible labels: "Mark <name> on Tuesday". */
  name?: string;
  /** Rail and other tight surfaces. */
  compact?: boolean;
}

const dayLabel = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric",
  });

/**
 * A day's hit target. The dot itself is 7–10px, which is unhittable on a
 * phone; the button pads out around it and pulls the padding back in with a
 * negative margin so the row still reads as a row.
 */
function DayHit({
  day, name, onToggle, busy, children,
}: {
  day: HabitProgressDay; name?: string;
  onToggle?: (date: string, done: boolean) => void;
  busy?: boolean; children: React.ReactNode;
}) {
  const label = dayLabel(day.date);
  const what = `${label}${day.done ? " — done" : day.isToday ? " — today, not yet" : " — not done"}`;
  if (!onToggle) {
    return <span title={what} style={{ lineHeight: 0, flexShrink: 0 }}>{children}</span>;
  }
  return (
    <button
      onClick={() => onToggle(day.date, day.done)}
      disabled={busy}
      aria-pressed={day.done}
      aria-label={`${day.done ? "Unmark" : "Mark"} ${name ?? "habit"} on ${label}`}
      title={`${what}. Click to ${day.done ? "clear" : "mark done"}.`}
      style={{
        padding: 4, margin: -4, background: "none", border: "none",
        cursor: busy ? "default" : "pointer", lineHeight: 0, flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

/** The reading beside the drawing — the same sentence the label used to be. */
function Reading({ text, tone }: { text: string; tone: "met" | "progress" | "quiet" }) {
  return (
    <span style={{
      fontSize: 10.5,
      color: tone === "met" ? "var(--color-quality-good)" : "var(--text-3)",
      fontWeight: tone === "met" ? 600 : 400,
      whiteSpace: "nowrap",
    }}>{text}</span>
  );
}

/* ------------------------------------------------------------------ daily */

/**
 * A run, drawn as a line with gaps. Kept days carry a crest; missed days
 * leave the line flat and dashed. What survives a gap is the COUNT — "9 of
 * 14 days" — a fact about the record rather than a verdict on it.
 */
function DailyRun({ days, streak, doneToday, chore, name, onToggleDay, busy, compact }: Props) {
  const shown = compact ? days.slice(-7) : days;
  const kept = shown.filter(d => d.done).length;
  const reading = chore
    ? (doneToday ? "done today" : kept > 0 ? `done ${kept}× recently` : "")
    : streak > 0
      ? `${streak}-day run${doneToday ? " · today kept" : ""}`
      : doneToday ? "begun again" : `${kept} of ${shown.length} days`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 3, alignItems: "center" }}
        title="Each day of the run — filled means kept. Click a day to change it.">
        {shown.map((d, i) => {
          const prevKept = i > 0 && shown[i - 1].done;
          return (
            <span key={d.date} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              {i > 0 && (
                // The join between two days: solid where the run continued,
                // dashed where it lapsed. This is the gap-in-a-line, and it
                // is why nothing here has to reset to zero.
                <span aria-hidden style={{
                  width: compact ? 6 : 8, height: 1.5, borderRadius: 1,
                  background: prevKept && d.done ? "var(--color-quality-good)" : "var(--color-border)",
                  opacity: prevKept && d.done ? 0.85 : 0.6,
                }} />
              )}
              <DayHit day={d} name={name} onToggle={onToggleDay} busy={busy}>
                <span style={{
                  display: "block",
                  width: d.isToday ? 10 : 7, height: d.isToday ? 10 : 7, borderRadius: "50%",
                  background: d.done ? "var(--color-quality-good)" : "var(--color-card-2)",
                  border: d.isToday
                    ? `1.5px solid ${doneToday ? "var(--color-quality-good)" : "var(--color-brass)"}`
                    : "none",
                  opacity: d.done || d.isToday ? 1 : 0.45,
                }} />
              </DayHit>
            </span>
          );
        })}
      </div>
      {reading && <Reading text={reading} tone={doneToday ? "met" : chore ? "quiet" : "progress"} />}
    </div>
  );
}

/* ------------------------------------------------------------- most days */

/**
 * A waterline. Kept days rise to the threshold, missed days sit below it as
 * shallows — so a miss reads as survivable rather than as a break, which is
 * the entire reason this cadence exists.
 */
function MostDays({ days, windowDone, windowTarget, name, onToggleDay, busy, doneToday }: Props) {
  const week = days.slice(-7);
  const met = windowDone >= windowTarget;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div style={{ position: "relative", display: "flex", gap: 3, alignItems: "flex-end", height: 22 }}
        title={`The last seven days against a ${windowTarget}-day waterline. Click a day to change it.`}>
        {/* The line itself, at the height a kept day reaches. */}
        <span aria-hidden style={{
          position: "absolute", left: 0, right: 0, top: 6, height: 0,
          borderTop: "1px dashed var(--color-brass)", opacity: 0.75, pointerEvents: "none",
        }} />
        {week.map(d => (
          <DayHit key={d.date} day={d} name={name} onToggle={onToggleDay} busy={busy}>
            <span style={{
              display: "block", width: 9,
              height: d.done ? 16 : 8,
              borderRadius: 1.5,
              background: d.done ? "var(--color-water)" : "var(--color-card-2)",
              border: d.isToday ? "1px solid var(--color-brass)" : "1px solid var(--color-border)",
              opacity: d.done ? 0.9 : 0.6,
            }} />
          </DayHit>
        ))}
      </div>
      <Reading
        text={met ? `${windowDone} of ${windowTarget} · above the line` : `${windowDone} of ${windowTarget} kept`}
        tone={met ? "met" : doneToday ? "met" : "progress"}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- weekly */

/**
 * A quota, drawn as discs that fill. Deliberately NOT seven day-slots: the
 * point of choosing "3× a week" is that which days is not the question, and
 * a seven-slot drawing would silently re-ask it.
 *
 * The unfilled discs are dashed outlines rather than empty wells — room
 * left, not debt owed. That is the whole difference between this and a
 * guilt ledger, and it lives entirely in the empty state.
 */
/**
 * The daily twin of WeeklyQuota. Same drawing — N discs, filling — over a
 * different window: TODAY's count against today's target, not the rolling
 * week. Kept as its own function rather than a parameter on WeeklyQuota
 * because the two answer different questions ("how many today" vs "how many
 * this week") and a shared component that silently meant either would be
 * exactly the kind of ambiguity the four-drawings doc above exists to avoid.
 */
function DailyQuota({ countToday, targetPerDay, windowDone, windowTarget }: Props) {
  const target = Math.max(1, targetPerDay ?? 1);
  const done = countToday ?? 0;
  const filled = Math.min(done, target);
  const met = done >= target;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}
        title={`${done} of ${target} today.`}>
        {Array.from({ length: target }, (_, i) => {
          const on = i < filled;
          const last = i === target - 1;
          return (
            <span key={i} style={{ position: "relative", display: "block", lineHeight: 0 }}>
              <span style={{
                display: "block", width: 12, height: 12, borderRadius: "50%",
                background: on ? "var(--color-quality-good)" : "transparent",
                border: on ? "none" : "1.5px dashed var(--text-3)",
                opacity: on ? 0.95 : 0.6,
              }} />
              {met && last && (
                <span aria-hidden style={{
                  position: "absolute", inset: -3, borderRadius: "50%",
                  border: "1px solid var(--color-brass)", opacity: 0.55,
                }} />
              )}
            </span>
          );
        })}
      </div>
      <Reading text={`${done} of ${target} today`} tone={met ? "met" : "progress"} />
      {/* The week, said once and quietly underneath — several habits still
          have a week, it is just not what the discs above are counting. */}
      {typeof windowTarget === "number" && windowTarget > 0 && (
        <span style={{ fontSize: 10, color: "var(--text-3)" }}>· {windowDone} of {windowTarget} this week</span>
      )}
    </div>
  );
}

function WeeklyQuota({ windowDone, windowTarget, doneToday }: Props) {
  const target = Math.max(1, windowTarget);
  const filled = Math.min(windowDone, target);
  const met = windowDone >= target;
  // NO countdown here, deliberately. The window is the rolling seven days
  // ending today (server: days.slice(-7)) — it slides forward every morning
  // and never expires, so "4 days left" named a deadline that does not
  // exist. Room left is the dashed discs' job; the sentence states the count
  // and stops.
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}
        title={`${windowDone} of ${target} kept in the last seven days.`}>
        {Array.from({ length: target }, (_, i) => {
          const on = i < filled;
          const last = i === target - 1;
          return (
            <span key={i} style={{ position: "relative", display: "block", lineHeight: 0 }}>
              <span style={{
                display: "block", width: 12, height: 12, borderRadius: "50%",
                background: on ? "var(--color-quality-good)" : "transparent",
                // --color-border on a card is ~1.1:1 — the empty discs were
                // effectively invisible, which turns "room left" into "there
                // is nothing here". They have to read as slots.
                border: on ? "none" : "1.5px dashed var(--text-3)",
                opacity: on ? 0.95 : 0.6,
              }} />
              {/* The quota's completion gets one quiet brass ring, on the
                  disc that finished it — a mark, not a fanfare. */}
              {met && last && (
                <span aria-hidden style={{
                  position: "absolute", inset: -3, borderRadius: "50%",
                  border: "1px solid var(--color-brass)", opacity: 0.55,
                }} />
              )}
            </span>
          );
        })}
      </div>
      <Reading
        text={`${windowDone} of ${target} this week`}
        tone={met ? "met" : doneToday ? "met" : "progress"}
      />
    </div>
  );
}

/* ------------------------------------------------------------- occasional */

/**
 * Marks on a horizon. No target, so no empty slots anywhere — the drawing
 * can only ever show what happened, never what didn't. Clustering is the
 * one real signal: three in a fortnight and nothing since is a pattern.
 */
function OccasionalMarks({ days, name, onToggleDay, busy }: Props) {
  const kept = days.filter(d => d.done);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div style={{ position: "relative", height: 14, flex: "0 0 auto", width: 150 }}
        title="When this happened, over the last fortnight.">
        <span aria-hidden style={{
          position: "absolute", left: 0, right: 0, bottom: 3, height: 1,
          background: "var(--color-border)",
        }} />
        {days.map((d, i) => {
          if (!d.done && !d.isToday) return null;
          const x = (i / (days.length - 1)) * 100;
          return (
            <span key={d.date} style={{
              position: "absolute", left: `${x}%`, bottom: 3, transform: "translateX(-50%)", lineHeight: 0,
            }}>
              <DayHit day={d} name={name} onToggle={onToggleDay} busy={busy}>
                <span style={{
                  display: "block", width: d.done ? 2 : 6, height: d.done ? 9 : 6,
                  borderRadius: d.done ? 1 : "50%",
                  background: d.done ? "var(--color-meridian)" : "transparent",
                  border: d.done ? "none" : "1px solid var(--color-brass)",
                  opacity: d.done ? 0.9 : 0.7,
                }} />
              </DayHit>
            </span>
          );
        })}
      </div>
      <Reading
        text={kept.length > 0 ? `${kept.length}× in the last fortnight` : "whenever it fits"}
        tone="quiet"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ entry */

export default function HabitProgress(props: Props) {
  if (!props.days?.length) return null;
  // A chore borrows the daily drawing but never its streak language — the
  // record is the fact it happened, said once and quietly.
  if (props.chore) return <DailyRun {...props} />;
  switch (props.cadence) {
    case "weekly":     return <WeeklyQuota {...props} />;
    case "several":    return <DailyQuota {...props} />;
    case "most_days":  return <MostDays {...props} />;
    case "occasional": return <OccasionalMarks {...props} />;
    default:           return <DailyRun {...props} />;
  }
}
