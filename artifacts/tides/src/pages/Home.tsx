/**
 * Home — the dashboard you land on.
 *
 * The owner's brief, 2026-08-03: "rather than the Today tab, which is now super
 * busy and a little overwhelming, make the homepage more of a dashboard … the
 * astro might increasingly fade to the back … I actually want to center the
 * Compass and the to-do dump … the really important things are moments of
 * convergence for particular activities, globally and especially personally."
 *
 * So the order here is an argument, not a layout preference:
 *
 *   1. THE COMPASS      what you are deciding about, and when the sky backs it
 *   2. THE DUMP         everything you are holding, in one view
 *   3. GUIDING STARS    visible, not central
 *   4. THE LOG          only once you have actually done something today
 *
 * Today keeps the day laid out in time. This page is what you are steering.
 *
 * WHAT IS DELIBERATELY ABSENT
 * ---------------------------------------------------------------------------
 * No tide hero, no woven reading, no standing conditions. The owner's call was
 * that the tide is "a widget right now" and that "there can be different hero
 * moments within a single day" — a single hero curve at the top asserts one
 * shape for the whole day, which is the claim he stopped believing. The sky
 * lives in the left rail and on Today.
 *
 * Customisability is deferred by explicit decision ("customizability can come
 * later"), so the order is fixed rather than stored. Nothing here is
 * per-user-configurable yet, and the code should not pretend otherwise by
 * building a settings shape nobody can reach.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ElectionPicker } from "@/components/ElectionPicker";
import { useNorthStars, useTidesNow } from "@/hooks/useTides";
import { fetchJson } from "@/lib/fetchJson";
import { localToday } from "@/lib/dates";
import type { AskElectionContext } from "@/App";

interface Task {
  id: number;
  title: string;
  done: string | null;
  dueDate: string | null;
  planet?: string | null;
  bestWindowType?: string | null;
  startedAt?: string | null;
}

// `overflow: hidden` used to be here, to keep the group rows' full-bleed
// dividers inside the rounded corners. It also CLIPPED the Compass — the
// activity picker is taller than its parent expected, so the last row of
// pills ("Intimacy & sex") was cut off at the card edge with no scrollbar and
// no hint that anything was missing. Rounded corners are not worth silently
// eating content; the rows clip themselves instead, below.
const card: React.CSSProperties = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
};

// A column has a comfortable measure. Task rows were running the full 1250px
// of a desktop window with a 15px checkbox stranded at the far left, so the
// eye had to cross the screen to get from the control to the text. This is
// what made a correct list feel awkward.
const COLUMN_MAX = 760;

function SectionTitle({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div style={{ padding: "12px 18px 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>{children}</div>
      {note && <div style={{ fontSize: 9.5, color: "var(--text-3)" }}>{note}</div>}
    </div>
  );
}

export default function Home({
  testerId, lat, lon, onNavigate, onAskAboutElection,
}: {
  testerId: string | null;
  lat: number;
  lon: number;
  onNavigate: (v: string) => void;
  onAskAboutElection?: (ctx: AskElectionContext, seed: string) => void;
}) {
  const qc = useQueryClient();
  const today = localToday();
  const headers = testerId ? { "x-tester-id": testerId } : undefined;

  // EVERY task, not today's. "The capacity to see all of one's tasks in a
  // single view is important" — a dashboard that showed only today's would be
  // the third place in the app that does that, and none of them answer "what am
  // I actually holding".
  const { data: tasks, isError: tasksFailed } = useQuery<Task[]>({
    queryKey: ["tasks", "all"],
    queryFn: () => fetchJson<Task[]>("/api/tasks", { headers }),
    enabled: !!testerId,
  });
  const { data: northStars } = useNorthStars(testerId);
  const { data: now } = useTidesNow(testerId, lat, lon);

  const [newTitle, setNewTitle] = useState("");
  const addTask = useMutation({
    mutationFn: (title: string) =>
      fetchJson("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(headers ?? {}) },
        body: JSON.stringify({ title, dueDate: today }),
      }),
    onSuccess: () => { setNewTitle(""); qc.invalidateQueries({ queryKey: ["tasks"] }); },
  });
  const toggleTask = useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      fetchJson(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(headers ?? {}) },
        body: JSON.stringify({ done: done ? "true" : "false" }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const all = tasks ?? [];
  const open = all.filter((t) => t.done !== "true");
  const doneToday = all.filter((t) => t.done === "true" && t.dueDate === today);

  // Overdue and undated are separated because they are different problems: one
  // is a promise you broke, the other is a thought you had. Merging them into
  // "open tasks" is what makes a list feel like an accusation.
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today);
  const dueToday = open.filter((t) => t.dueDate === today);
  const later = open.filter((t) => t.dueDate && t.dueDate > today);
  const undated = open.filter((t) => !t.dueDate);

  // The Log appears only after you have engaged today. The owner's rule: "the
  // log should only come if someone has already engaged with the app that day —
  // and logging should also look like crossing off to-do tasks." An empty
  // review card on a day you have not started is a chore, not a reflection.
  const engagedToday = doneToday.length > 0 || all.some((t) => t.startedAt && t.startedAt.startsWith(today));

  const Row = ({ t, muted }: { t: Task; muted?: boolean }) => (
    <div style={{
      display: "flex", alignItems: "center", gap: 9, padding: "7px 18px",
      borderTop: "1px solid var(--color-border)",
    }}>
      <button
        onClick={() => toggleTask.mutate({ id: t.id, done: t.done !== "true" })}
        aria-label={t.done === "true" ? `Reopen ${t.title}` : `Complete ${t.title}`}
        style={{
          width: 15, height: 15, borderRadius: 4, flexShrink: 0, cursor: "pointer", padding: 0,
          border: `1.5px solid ${t.done === "true" ? "#60a060" : "var(--color-border)"}`,
          background: t.done === "true" ? "#60a060" : "transparent",
          color: "#fff", fontSize: 10, lineHeight: 1,
        }}
      >{t.done === "true" ? "✓" : ""}</button>
      <span style={{
        fontSize: 12.5, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        color: muted ? "var(--text-3)" : "var(--color-foreground)",
        textDecoration: t.done === "true" ? "line-through" : "none",
      }}>{t.title}</span>
      {t.bestWindowType && (
        <span style={{ fontSize: 9, color: "var(--text-3)", flexShrink: 0 }}>{t.bestWindowType.replace("_", " ")}</span>
      )}
    </div>
  );

  const Group = ({ label, items, muted }: { label: string; items: Task[]; muted?: boolean }) =>
    items.length === 0 ? null : (
      <>
        <div style={{
          fontSize: 8, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-3)",
          padding: "8px 18px 2px", borderTop: "1px solid var(--color-border)",
        }}>{label} · {items.length}</div>
        {items.map((t) => <Row key={t.id} t={t} muted={muted} />)}
      </>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "14px 0 40px", maxWidth: COLUMN_MAX, margin: "0 auto", width: "100%" }}>

      {/* 0 · RIGHT NOW — only when there is something that changes what to do.
          The owner, looking at this page while the Moon was void: "the hero
          should reflect what is most important right now, which is the VoC
          quality." The rail knew she was void and Home said nothing.

          It appears and disappears rather than always holding a headline. A
          permanent hero here would either duplicate Today's woven reading or
          get filled with something true-but-inert on the ~85% of days nothing
          is gating — and a banner that is always present is one people stop
          seeing, which would waste it on the days it matters. */}
      {now?.voc?.isVOC && now.voc.reading && (
        <div style={{
          ...card,
          // Benign is Lilly's four (Taurus, Cancer, Sagittarius, Pisces), where
          // the tradition says the void is not so malevolent. Colouring those
          // like a warning would contradict the sentence inside them.
          borderLeft: `3px solid ${now.voc.reading.benign ? "#6f6a90" : "#a08040"}`,
          padding: "12px 18px",
        }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)", marginBottom: 4 }}>
            Right now · the Moon is void
            {now.voc.nextIngress && <span style={{ textTransform: "none", letterSpacing: 0 }}> until {now.voc.nextIngress}</span>}
          </div>
          <div style={{ fontSize: 13, color: "var(--color-foreground)", lineHeight: 1.5 }}>{now.voc.reading.feel}</div>
          <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.5, marginTop: 4 }}>{now.voc.reading.instead}</div>
        </div>
      )}

      {/* 1 · THE COMPASS — the point of the app. Convergence for a particular
          activity, globally and personally, is the thing the owner named as
          "the really important thing", so it opens the page rather than
          sitting behind a tab. */}
      {/* No card wrapper either: ElectionPicker draws its own bordered panel,
          so wrapping it produced a box inside a box with a strip of dead
          background between the two borders. */}
      <div>
        {/* No SectionTitle here on purpose. ElectionPicker already titles
            itself "Find the time for anything · Auspice" with its own
            one-line explanation, so a wrapper heading produced two titles and
            two subtitles stacked, both saying the same thing. One name per
            surface — the same rule the terminology audit applied to features. */}
        <ElectionPicker testerId={testerId} lat={lat} lon={lon} onAsk={onAskAboutElection} />
      </div>

      {/* 2 · THE DUMP */}
      <div style={card}>
        <SectionTitle note={open.length ? `${open.length} open` : undefined}>Everything you're holding</SectionTitle>

        <div style={{ padding: "0 18px 10px" }}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) addTask.mutate(newTitle.trim()); }}
            placeholder="Dump it here — one line, no ceremony"
            style={{
              width: "100%", padding: "8px 11px", borderRadius: 8, fontSize: 12.5, outline: "none",
              border: "1px solid var(--color-border)", background: "var(--color-card-2)",
              color: "var(--color-foreground)",
            }}
          />
          {addTask.isError && (
            <div style={{ fontSize: 10, color: "#a03030", marginTop: 4 }}>Didn't save — try again.</div>
          )}
        </div>

        {/* A failed request must not render as a clear plate. */}
        {tasksFailed ? (
          <div style={{ padding: "10px 18px 14px", fontSize: 11.5, color: "#a03030", borderTop: "1px solid var(--color-border)" }}>
            I couldn't load your tasks. This is a connection problem, not an empty list.
          </div>
        ) : (
          <>
            <Group label="overdue" items={overdue} />
            <Group label="today" items={dueToday} />
            <Group label="no date" items={undated} />
            <Group label="later" items={later} muted />
            {open.length === 0 && tasks && (
              <div style={{ padding: "4px 18px 14px", fontSize: 11.5, color: "var(--text-3)" }}>
                Nothing on the list.
              </div>
            )}
          </>
        )}
      </div>

      {/* 3 · GUIDING STARS — "visible but not central". One row, no progress
          bars, no weekly targets: the Stars tab owns all of that. */}
      {(northStars ?? []).filter((g: any) => g.status !== "done" && g.status !== "paused").length > 0 && (
        <div style={card}>
          <SectionTitle note="the long aims — open the tab to work on them">Guiding Stars</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 18px 14px" }}>
            {(northStars ?? [])
              .filter((g: any) => g.status !== "done" && g.status !== "paused")
              .map((g: any) => (
                <button key={g.id} onClick={() => onNavigate("work")} style={{
                  fontSize: 11, padding: "4px 11px", borderRadius: 999, cursor: "pointer",
                  border: "1px solid var(--color-border)", background: "var(--color-card-2)",
                  color: "var(--color-foreground)",
                }}>{g.title}</button>
              ))}
          </div>
        </div>
      )}

      {/* 4 · THE LOG — gated on having actually done something today, and shaped
          like the crossing-off above rather than like a journal prompt. */}
      {engagedToday && (
        <div style={card}>
          <SectionTitle note={`${doneToday.length} crossed off today`}>Today's log</SectionTitle>
          {doneToday.map((t) => <Row key={t.id} t={t} />)}
          <div style={{ padding: "10px 18px 14px", borderTop: "1px solid var(--color-border)" }}>
            <button onClick={() => onNavigate("log")} style={{
              fontSize: 11.5, background: "none", border: "none", cursor: "pointer",
              color: "var(--color-primary)", padding: 0,
            }}>Add a note about how it went →</button>
          </div>
        </div>
      )}
    </div>
  );
}
