/**
 * EVERYTHING HOME ASKS THE SERVER, AND EVERYTHING IT DERIVES FROM THE ANSWERS.
 *
 * Home.tsx had grown to ~1900 lines with ~600 of them before the first piece
 * of markup: eight queries, six mutations, and forty-odd derived bindings
 * interleaved with the view state that happens to sit beside them.
 *
 * The 2026-08-19 audit proposed extracting the render blocks into components
 * instead, and measuring killed that: "Your work" closes over 21 identifiers
 * from the body and "What lines up" over 17, so extracting them threads the
 * same coupling through eighteen props and calls it an improvement. The
 * coupling was never between the markup and the page — it was between the
 * markup and this pile of derived state. Naming the pile is the refactor.
 *
 * WHAT IS HERE: anything that reads or writes the server, and the derivations
 * built on those answers — the task buckets, the loop's lead, the failure
 * classification, the resolution sets.
 *
 * WHAT IS NOT: view state (which card is open, what is typed in a field) and
 * the row renderers, which are markup. The hook takes the few pieces of view
 * state its QUERIES genuinely depend on — a query gated on a disclosure being
 * open is a real dependency, not a leak.
 *
 * Mutations do not touch Home's setters. Clearing a field after a successful
 * write is the field's business, so Home passes a per-call `onSuccess` to
 * `mutate` instead — which also means a mutation fired from somewhere else
 * cannot silently clear a field that had nothing to do with it.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNorthStars, useTidesNow, useTidesWeek } from "@/hooks/useTides";
import { useCommittedWeek } from "@/components/WeekCommitted";
import { fetchJson, HttpError } from "@/lib/fetchJson";
import { parseWhen } from "@/lib/parseWhen";
import type { TouchTrail } from "@/lib/touches";
import { localToday } from "@/lib/dates";
/**
 * The shapes Home's answers arrive in. They lived in the page; they belong
 * beside the code that fetches and derives them.
 */
export interface Task {
  id: number;
  title: string;
  done: string | null;
  dueDate: string | null;
  planet?: string | null;
  bestWindowType?: string | null;
  startedAt?: string | null;
  sortOrder?: number;
  /** The window this task was scheduled into, when it has been. The
   *  authoritative direction — the task points at its window. */
  planningWindowId?: number | null;
}

export interface LinesUpResult {
  held: { id: string; title: string; kind: string };
  activityKey: string; activityLabel: string;
  alternative?: { key: string; label: string };
  startClock: string; endClock: string; allDay: boolean;
  startAt: string; endAt: string;
  state: "open-now" | "ahead" | "passed";
  supportLevel: string; suitability: string;
  personal: boolean; why: string;
  evidence: { family: string; text: string }[];
  noObjections: boolean;
}

export interface LinesUp {
  results: LinesUpResult[];
  clarify: { held: { id: string; title: string }; candidates: { key: string; label: string }[] }[];
  alreadyScheduled: { id: string; title: string }[];
  heldBack: { item: { id: string; title: string }; reason: string }[];
  quiet: "supported-only" | "nothing-singled-out" | "all-placed" | "thin-inventory" | null;
  /** One act and the one after it — the engine's own composition. */
  loop?: {
    now: { title: string; heldId: string; why: string; whyPlain?: string; until: string | null; inFlow: boolean; elapsedMin?: number } | null;
    then: { title: string; heldId: string; startClock: string } | null;
  };
  nextOpening: { activityLabel: string; date: string; startClock: string } | null;
  notPriced: number;
  chartAvailable: boolean;
}

export interface ShapedDay {
  placed: {
    item: { id: string; title: string; kind: string };
    startAt: string; endAt: string; minutes: number;
    assumedDuration: boolean; activityKey: string | null; basis: string;
  }[];
  unplaced: { item: { id: string; title: string }; reason: string }[];
  openTime: { startAt: string; endAt: string; minutes: number }[];
  warnings: string[];
}

export interface Resolution {
  needsActivity: { id: string; title: string; options: { key: string; label: string }[] }[];
  needsDuration: { id: string; title: string; activityKey: string; activityLabel: string; chips: number[] }[];
  ready: number;
}

export function useHomeData({ testerId, lat, lon, skyQuiet, locationKnown, shapeOpen, waterOpen, ritualMode }: {
  testerId: string | null;
  lat: number;
  lon: number;
  /** The quiet lens. Decides whether the answer card renders at all. */
  skyQuiet: boolean;
  /** Whether lat/lon are the user's real position or a timezone guess. */
  locationKnown: boolean;
  /** Disclosures whose CONTENTS are fetched only once opened. */
  shapeOpen: boolean;
  waterOpen: boolean;
  /** "morning" | "evening" during the person's own ritual hours, else null. */
  ritualMode: "morning" | "evening" | null;
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
  // Cycle tracking, for the condition slot. Absent for most people and cheap
  // when it is — a 404 is a real answer here (not set up), never a failure.
  const { data: cycle } = useQuery<{ cycleStartDate?: string; cycleLength: number; lutealLength: number } | null>({
    queryKey: ["cycle", testerId],
    queryFn: () => fetchJson<{ cycleStartDate?: string; cycleLength: number; lutealLength: number } | null>(
      "/api/cycle", { headers, absentStatuses: [404], absentValue: null }),
    enabled: !!testerId,
  });
  // Shares WhereYouAre's key, so the minimum-viable line costs no request.
  const { data: habitsForRisk } = useQuery<{ name: string; minimumViable?: string | null }[]>({
    queryKey: ["habits", testerId, today, lat, lon],
    queryFn: () => fetchJson<{ name: string; minimumViable?: string | null }[]>(
      `/api/habits?today=${today}&lat=${lat}&lon=${lon}`, { headers }),
    enabled: !!testerId,
  });
  const { data: now } = useTidesNow(testerId, lat, lon);
  // Read once and reused in both the key and the fetch. Every value the
  // response depends on belongs in the cache identity — this one didn't:
  // `tz` and `locationKnown` rode in the URL but not the key, so a change in
  // either (a DST transition mid-session, toggling location permission)
  // could serve the OLD answer from cache with no refetch, because
  // react-query had no way to see the input had changed. `ElectionPicker`
  // already learned this lesson once; this makes it a repository rule rather
  // than a fix applied one query at a time.
  const tz = new Date().getTimezoneOffset();
  // The IANA zone, alongside the numeric offset — corrects the day boundary
  // for the specific day in question (a DST-transition day, most of all)
  // rather than trusting a snapshot offset for the whole session.
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // The touch trails: which tasks were worked on, and when (wins.taskId).
  const { data: touchData } = useQuery<{ touches: Record<string, TouchTrail> }>({
    queryKey: ["touches", testerId],
    queryFn: () => fetchJson(`/api/planning/touches?tz=${new Date().getTimezoneOffset()}`, { headers }),
    enabled: !!testerId,
  });

  /**
   * A PAUSED QUERY IS UNREACHABLE, NOT LOADING.
   *
   * `isError` alone was not enough, and the gap is not small. When a fetch
   * fails, react-query consults its `onlineManager` before retrying; if that
   * says offline, the retry is PAUSED rather than run. A paused query sits at
   * `status: "pending"` indefinitely — `isError` never becomes true, no error
   * is ever surfaced, and a spinner spins forever.
   *
   * Measured with the API stopped: `fetchStatus: "paused"`, `failureCount: 1`,
   * `status: "pending"`, unchanged after ten seconds, while a hand-rolled
   * `fetch()` to the same URL returned 500 in 12ms. So the outage module built
   * for exactly this situation could not be reached in the situation it was
   * built for, because the flag it keyed on is the one flag that never flips.
   *
   * Both are the same admission — Compass could not get an answer — so both
   * lead to the same state. `fetchStatus` is checked rather than `isPaused` so
   * that a pause DURING a background refresh, when we still hold good data,
   * does not throw away a perfectly valid reading.
   */

  // WHICH read failed, and WHEN it failed — both from the server.
  //
  // Not knowing what someone holds and not having judged the sky are different
  // admissions, and the surface says different things for each. The timestamp
  // is the server's because a time the client makes up is not evidence: it
  // would say "didn't answer at 4:02 PM" about a moment nothing happened at.
  const { data: resolution } = useQuery<Resolution>({
    queryKey: ["needs-resolution", testerId],
    queryFn: () => fetchJson<Resolution>("/api/elections/needs-resolution", { headers }),
    enabled: !!testerId && shapeOpen,
  });
  // Storing the picked duration is what turns a SUGGESTION into a commitment.
  // Nothing is reserved until this runs — a chip on screen has committed
  // nothing, which is the difference between offering a duration and assuming
  // one.
  const setDuration = useMutation({
    mutationFn: ({ id, minutes }: { id: string; minutes: number }) =>
      fetchJson(`/api/tasks/${id.replace("task-", "")}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(headers ?? {}) },
        body: JSON.stringify({ estMinutes: minutes }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["needs-resolution"] });
      qc.invalidateQueries({ queryKey: ["shape-day"] });
      qc.invalidateQueries({ queryKey: ["shape-week"] });
    },
  });

  // Records the person's own answer. Without this the question below was
  // read-only — Compass asked "what kind of work is this?" and had nowhere to
  // put the reply, so the same question came back every time. A confirmed key
  // outranks the matcher everywhere it is read.
  const setActivity = useMutation({
    mutationFn: ({ id, activityKey }: { id: string; activityKey: string }) =>
      fetchJson(`/api/tasks/${id.replace("task-", "")}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(headers ?? {}) },
        body: JSON.stringify({ activityKey }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["needs-resolution"] });
      qc.invalidateQueries({ queryKey: ["shape-day"] });
      qc.invalidateQueries({ queryKey: ["shape-week"] });
    },
  });

  const { data: shaped, isFetching: shaping } = useQuery<ShapedDay>({
    // `skyQuiet` is in the key because it is in the URL: the plain weave and
    // the elected weave are different answers, and flipping the lens must not
    // serve one as the other from cache.
    queryKey: ["shape-day", testerId, lat, lon, tz, zone, locationKnown, skyQuiet],
    queryFn: () => fetchJson<ShapedDay>(
      `/api/elections/shape-day?lat=${lat}&lon=${lon}&tz=${tz}&timeZone=${encodeURIComponent(zone)}&locationKnown=${locationKnown}${skyQuiet ? "&sky=false" : ""}`, { headers }),
    enabled: !!testerId && shapeOpen,
  });

  // The week strip loads with the page rather than on demand: it is a shape,
  // not a plan, and it is the answer to Home being thin on a day when nothing
  // converges and nothing is void.
  //
  // COMMITTED, not proposed. This read `shape-week`, which only collects work
  // that has NOT been placed — so the card emptied out the moment a week was
  // fully woven and told the reader nothing was placed yet. See
  // components/WeekCommitted.tsx. The proposal still lives in Plan, which is
  // the tab that acts on it.
  // Sixty days, not seven: the strip draws a week, and everything past it
  // feeds the card's "Committed" footer — the launch you picked, standing
  // (HOME study W2).
  const { data: committed = [] } = useCommittedWeek(testerId, 60);

  // The Sunday review's gates. `rareShowing` mirrors RareMomentBanner's own
  // query by key, so asking here costs nothing extra and the two can't
  // disagree about whether the slot is held.
  const sundayToday = new Date().getDay() === 0;
  const reviewForced = new URLSearchParams(window.location.search).get("review") === "week";
  const { data: rareData } = useQuery<{ hits: unknown[] }>({
    queryKey: ["rare-today", tz],
    queryFn: async () => (await fetch(`/api/elections/rare-today?tz=${tz}`)).json(),
    staleTime: 1000 * 60 * 60 * 6,
    enabled: sundayToday || reviewForced,
  });
  const rareShowing = (rareData?.hits?.length ?? 0) > 0;
  const { data: water } = useTidesWeek(14, lat, lon, 0, waterOpen);
  const logWin = useMutation({
    mutationFn: (text: string) =>
      fetchJson("/api/planning/wins", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(headers ?? {}) },
        body: JSON.stringify({ text, tz: new Date().getTimezoneOffset() }),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["momentum"] }); },
  });
  const addTask = useMutation({
    // The one-line add reads dates the way the capture sheet does (F12):
    // "call mom friday" lands on Friday. Any parse trouble falls back to the
    // raw title due today — a date guess must never block the add.
    mutationFn: (raw: string) => {
      let title = raw, dueDate = today;
      try {
        const p = parseWhen(raw, today);
        if (p.title.trim()) title = p.title;
        if (p.dueDate) dueDate = p.dueDate;
      } catch { /* raw title, due today */ }
      return fetchJson("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(headers ?? {}) },
        body: JSON.stringify({ title, dueDate }),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); },
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

  // Reorder within a group (F11) — move buttons, not drag, for a first pass
  // that works on a phone. sortOrder has been in the schema all along; this
  // is the first UI that writes it.
  const reorder = useMutation({
    mutationFn: (updates: { id: number; sortOrder: number }[]) =>
      Promise.all(updates.map(u => fetchJson(`/api/tasks/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(headers ?? {}) },
        body: JSON.stringify({ sortOrder: u.sortOrder }),
      }))),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const moveWithin = (group: Task[], id: number, dir: -1 | 1) => {
    const idx = group.findIndex(t => t.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= group.length) return;
    const desired = [...group];
    [desired[idx], desired[j]] = [desired[j], desired[idx]];
    // Renumber the group in tens. Swapping two equal sortOrders (the default
    // 0) is a no-op, so the first move settles the whole group's numbers and
    // later moves are two-row writes.
    const updates = desired
      .map((t, i) => ({ id: t.id, sortOrder: i * 10 }))
      .filter(u => (desired.find(t => t.id === u.id)!.sortOrder ?? 0) !== u.sortOrder);
    if (updates.length) reorder.mutate(updates);
  };

  const all = tasks ?? [];
  const open = all.filter((t) => t.done !== "true");
  const doneToday = all.filter((t) => t.done === "true" && t.dueDate === today);

  // Overdue and undated are separated because they are different problems: one
  // is a promise you broke, the other is a thought you had. Merging them into
  // "open tasks" is what makes a list feel like an accusation.
  // WHICH TASKS ARE ALREADY PLACED, read from the task's own link to its
  // window rather than from the timing engine's answer.
  //
  // It came from lines-up until 2026-08-19, which meant the placed/loose
  // split depended on an expensive sky read that Home no longer makes — and
  // made an outage in the SKY move tasks between groups in the person's list,
  // which is a fact about their calendar and nothing to do with the weather.
  // `planningWindowId` is the authoritative direction and always was.
  const scheduled = new Set(all.filter(t => t.planningWindowId != null).map(t => t.id));
  // Placed tasks leave the date groups: their time is set, so "overdue" and
  // "no date" stop applying, and one labelled group carries the fact.
  const loose = open.filter((t) => !scheduled.has(t.id));
  const placed = open.filter((t) => scheduled.has(t.id));
  const overdue = loose.filter((t) => t.dueDate && t.dueDate < today);
  const dueToday = loose.filter((t) => t.dueDate === today);
  const later = loose.filter((t) => t.dueDate && t.dueDate > today);
  const undated = loose.filter((t) => !t.dueDate);

  // The label of the one group that has anything in it, when there is exactly
  // one. Drives the bare (unheaded) rendering below.
  const soleGroup = (() => {
    const filled = ([
      ["overdue", overdue], ["today", dueToday], ["no date", undated], ["later", later],
    ] as const).filter(([, items]) => items.length > 0);
    return filled.length === 1 ? filled[0][0] : null;
  })();

  // The Log appears only after you have engaged today. The owner's rule: "the
  // log should only come if someone has already engaged with the app that day —
  // and logging should also look like crossing off to-do tasks." An empty
  // review card on a day you have not started is a chore, not a reflection.
  const engagedToday = doneToday.length > 0 || all.some((t) => t.startedAt && t.startedAt.startsWith(today));

  // WHAT THE TIMING ENGINE USED TO PUT HERE IS GONE (owner, 2026-08-19: "it
  // shouldn't auto-suggest possibilities of what to do, unprompted... let
  // people ask/input context, rather than being told what to do").
  //
  // timingFor, heldBack, lead, secondary and showAnswerCard all existed to
  // feed two cards that told you what to do before you asked. What survives
  // is what asks YOU for something: a task with no duration or no kind of
  // work cannot be timed even when you do ask for it, and saying so is a
  // request for input rather than an instruction.
  const needsDuration = new Set((resolution?.needsDuration ?? []).map(n => Number(n.id.replace("task-", ""))));
  const needsActivity = new Set((resolution?.needsActivity ?? []).map(n => Number(n.id.replace("task-", ""))));


  // ── THE DAILY LOOP'S OWN DATA ────────────────────────────────────────────
  // Every one of these is gated on ritualMode, so outside the hours the card
  // renders in they cost nothing. That matters most for the week read: it is
  // the ~900ms call, and the evening card wants exactly one field out of it
  // (tomorrow's element), so it asks for two days rather than fourteen.
  const ritual = !!ritualMode;
  const { data: ritualTasks } = useQuery<Task[]>({
    queryKey: ["tasks-today", testerId, today, tz],
    queryFn: () => fetchJson<Task[]>(`/api/tasks?date=${today}&tz=${tz}`, { headers }),
    enabled: !!testerId && ritual,
  });
  const { data: ritualWindows } = useQuery<any[]>({
    queryKey: ["planning-windows-today", testerId, today, tz],
    queryFn: () => fetchJson<any[]>(`/api/planning/windows?date=${today}`, { headers }),
    enabled: !!testerId && ritual,
  });
  const { data: ritualWeek } = useTidesWeek(2, lat, lon, 0, ritual);


  return {
    ritualTasks, ritualWindows, ritualWeek,
    qc, today, headers, tasks, tasksFailed, northStars, cycle, habitsForRisk, now, tz, zone, touchData, resolution, setDuration, setActivity, shaped, shaping, committed, sundayToday, reviewForced, rareData, rareShowing, water, logWin, addTask, toggleTask, reorder, moveWithin, all, open, doneToday, scheduled, loose, placed, overdue, dueToday, later, undated, soleGroup, engagedToday, needsDuration, needsActivity, };
}
