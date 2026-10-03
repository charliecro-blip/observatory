import Action from "@/components/Action";
import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTester } from "@/contexts/tester-context";
import { timingIcal, inputTime } from "@/lib/timingQuery";
import type { interpretTimingRequest } from "../../../api-server/src/lib/timingRequest";
import { logEvent } from "@/lib/analytics";
import type { TimingResponse } from "../../../api-server/src/lib/timingPresentation";
import "./FindTime.css";
import TimingLibrary from "./TimingLibrary";
import TimingSources from "./TimingSources";
import Home from "./Home";
import CompassHome from "./CompassHome";
import { addDaysLocal } from "@/lib/dates";
import { invalidateWindows } from "@/lib/invalidateWindows";
import Calendar, { type CalendarOpening } from "./Calendar";
import { useTidesNow } from "@/hooks/useTides";
import { SessionTimer } from "@/components/SessionTimer";
import { asksForNowOverview } from "@/lib/timingDestination";
import { useTheme } from "@/contexts/theme-context";
import Rail from "@/components/Rail";
import { WorkPage, QuickCapture, type WorkTab } from "./Workspace";
import Launch from "./Launch";
import Settings from "./Settings";
import MomentAdvisor from "@/components/MomentAdvisor";
import FeedbackDoor from "@/components/FeedbackDoor";
import { Guide } from "@/components/Guide";
import type { AskElectionContext } from "@/App";

type Query = {
  activity: string;
  start: string;
  end: string;
  timeZone: string;
  durationMinutes?: number;
  candidateIntervals?: { start: string; end: string }[];
  location?: { lat: number; lon: number };
  useNatal: boolean;
  checkCalendar: boolean;
};
type Candidate = TimingResponse["candidates"][number];
function comparisonEnd(start: string, duration: string): string | null {
  const startMs = Date.parse(start);
  const minutes = Number(duration);
  if (
    !Number.isFinite(startMs) ||
    !Number.isInteger(minutes) ||
    minutes < 1 ||
    minutes > 1440
  )
    return null;
  return new Date(startMs + minutes * 60_000).toISOString();
}
const ERRORS: Record<string, string> = {
  upgrade_required:
    "This search needs beta or paid access. Your account settings are in Workspace.",
  horizon_exceeds_seven_civil_days:
    "Choose a range covering no more than seven calendar days.",
  invalid_horizon: "Check the start and end of your search.",
  invalid_comparison_intervals:
    "Enter two to six distinct times with the same duration, all within your search range.",
  duplicate_comparison_interval:
    "These times include a duplicate. Choose distinct start times.",
  invalid_duration: "Enter a duration between 1 and 1,440 minutes.",
  choice_needs_review:
    "This time needs another look. Run the search again before choosing it.",
  unknown_activity: "Compass does not have timing rules for this activity yet.",
  custom_session_unsupported:
    "Duration searches are not available for this custom activity yet.",
  context_unavailable:
    "Compass could not load the context for this search. Please try again.",
};
function qualifications(c: Candidate): string[] {
  if (c.kind === "session")
    return c.reasons.map((r) =>
      r
        .replace(
          /primary significator/g,
          "a planet associated with this activity",
        )
        .replace(
          /significator station/g,
          "a planet associated with this activity is changing direction",
        ),
    );
  return c.reasons.map((r) => {
    switch (r.kind) {
      case "primary-significator-stationing-retrograde":
        return `${r.planet} is turning retrograde, which this reading treats as a reason to wait before beginning.`;
      case "primary-significator-stationing-direct":
        return `${r.planet} is turning direct, so the reading qualifies this time while its motion changes.`;
      case "primary-significator-retrograde":
        return `${r.planet} is retrograde; the reading favors allowing for revision.`;
      case "mercury-retrograde":
        return "Mercury is retrograde; allow for revisions and follow-up.";
      case "significator-station":
        return `${r.planet} is changing direction during this period.`;
    }
  });
}
export default function FindTime({
  onWorkspace,
}: {
  onWorkspace: (
    view?: "home" | "work" | "launch" | "settings",
    starId?: number,
  ) => void;
}) {
  const { profile, lat, lon, locationKnown } = useTester();
  const testerId = profile!.testerId;
  const qc = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  // THE SKY PANEL, on request. The workspace's left rail (the hour, the Moon,
  // aspects, waves) was the thing the owner checked most in passing, and the
  // new shell dropped it; they asked for it back as a toggle, not a fixture
  // (2026-09-30). Off by default, remembered per device.
  // Restored only where it sits beside the page. On a phone it is a drawer
  // over the page, and reopening the app into a covered screen is not a
  // preference anyone set.
  const [railOpen, setRailOpen] = useState(() => {
    try {
      return localStorage.getItem("compass-rail-open") === "true"
        && window.matchMedia("(min-width: 901px)").matches;
    } catch { return false; }
  });
  const toggleRail = () => setRailOpen((open) => {
    try { localStorage.setItem("compass-rail-open", String(!open)); } catch { /* private mode */ }
    return !open;
  });
  const { data: railNow } = useTidesNow(testerId, lat, lon);
  const [destination, setDestination] = useState<
    "search" | "now" | "calendar" | "almanac" | "saved" | "workspace" | "about" | "settings"
  >("search");
  // WORKSPACE UNDER THIS HEADER (density pass 2026-09-30, W5). It used to swap
  // the whole app for the old one: its own navigation, its own top bar, a
  // second Home and a second Calendar, and a thin bar as the only way back.
  // Its pages now open here, on Tasks, beside the timing destinations.
  type WorkSection = "tasks" | "habits" | "stars" | "plan" | "bearings";
  const [workSection, setWorkSection] = useState<WorkSection>("tasks");
  const [starSeed, setStarSeed] = useState<string | null>(null);
  const [focusStar, setFocusStar] = useState<number | null>(null);
  const [plannerSeed, setPlannerSeed] = useState<string | null>(null);
  const [spreadOnOpen, setSpreadOnOpen] = useState(false);
  const [capture, setCapture] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [advisor, setAdvisor] = useState<{ seed: string | null; ctx: AskElectionContext | null } | null>(null);
  const [sessionOn, setSessionOn] = useState<{ title: string } | null>(null);
  /** Every door that used to leave for the old shell lands here instead. */
  function openWorkspace(view?: string, starId?: number) {
    if (view === "settings") { setDestination("settings"); return; }
    if (view === "calendar" || view === "almanac") { setDestination(view); return; }
    const section: WorkSection =
      view === "launch" || view === "planets" ? "plan"
      : view === "habits" ? "habits"
      : view === "bearings" ? "bearings"
      : view === "work" || view === "overview" ? "stars"
      : "tasks";
    if (starId != null) setFocusStar(starId);
    setWorkSection(starId != null ? "stars" : section);
    setDestination("workspace");
  }
  const WORK_TO_PAGE: Record<Exclude<WorkSection, "plan">, WorkTab> = {
    tasks: "tasks", habits: "habits", stars: "overview", bearings: "bearings",
  };
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [text, setText] = useState("");
  const [calendarScope, setCalendarScope] = useState<string | null>(null);
  function searchCalendarDay(date: string) {
    setChosen(null);
    setExported(false);
    setError("");
    setQuery(null);
    setCalendarScope(date);
    setText("");
    setDraft(null);
    setResponse(null);
    setDestination("search");
  }
  const [activity, setActivity] = useState("");
  const [draft, setDraft] = useState<
    ReturnType<typeof interpretTimingRequest>["draft"] | null
  >(null);
  const hasDraft = draft !== null;
  // A VISIT IS A FACT WORTH KEEPING. The old shell logged "view" on every
  // navigation; this one logged only searches, so after 2026-09-30 nothing
  // could say whether the owner opened the app at all, which is the measure
  // the reset plan runs on. Same event, marked with this shell.
  useEffect(() => {
    const view = destination === "search" ? (hasDraft ? "search-results" : "home")
      : destination === "workspace" ? `workspace:${workSection}` : destination;
    logEvent("view", { view, shell: "timing" });
  }, [destination, workSection, hasDraft]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [destination, hasDraft]);
  const [compare, setCompare] = useState(false);
  const [suppliedStarts, setSuppliedStarts] = useState(["", ""]);
  const [useNatal, setUseNatal] = useState(false);
  const [interpretation, setInterpretation] = useState("");
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [activityOptions, setActivityOptions] = useState<
    { key: string; label: string }[]
  >([]);
  const [response, setResponse] = useState<TimingResponse | null>(null);
  const [query, setQuery] = useState<Query | null>(null);
  const [view, setView] = useState<"list" | "week">("list");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [chosen, setChosen] = useState<{
    id: number;
    candidate: Candidate;
    title: string;
  } | null>(null);
  const [exported, setExported] = useState(false);
  const keys = useRef(new Map<string, string>());
  const queryId = useRef(crypto.randomUUID());
  const rangeStart = useRef<HTMLInputElement>(null);
  function startFreshSearch() {
    setText("");
    setDraft(null);
    setResponse(null);
    setQuery(null);
    setChosen(null);
    setExported(false);
    setError("");
    setCalendarScope(null);
    setDestination("search");
  }

  async function post(path: string, body: unknown) {
    let r: Response;
    try {
      r = await fetch(`/api/timing/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tester-id": testerId },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error("Compass could not connect. Check your connection and try again.");
    }
    let data;
    try {
      data = await r.json();
    } catch {
      throw new Error("Compass could not load a response. Please try again.");
    }
    if (!r.ok || data.error)
      throw new Error(
        ERRORS[data.error] ??
          "Compass could not finish that request. Please try again.",
      );
    return data;
  }
  const { data: catalogue, isError: catalogueError } = useQuery<{
    activities: { key: string; label: string }[];
  }>({
    queryKey: ["timing-catalogue", testerId],
    queryFn: async () => {
      const r = await fetch("/api/elections/activities", {
        headers: { "x-tester-id": testerId },
      });
      if (!r.ok) throw Error();
      return r.json();
    },
  });
  async function interpret(value = text) {
    if (!value.trim()) return;
    // Home's example requests are for a first visit (density pass, H6).
    try { localStorage.setItem("compass-has-searched", "true"); } catch { /* private mode */ }
    if (asksForNowOverview(value)) {
      setError("");
      setDestination("now");
      return;
    }
    setBusy(true);
    setError("");
    setResponse(null);
    setChosen(null);
    setExported(false);
    try {
      const result = await post("interpret", { text: value, timeZone });
      const nextDraft = calendarScope
        ? {
            ...result.draft,
            start: `${calendarScope}T00:00`,
            end: `${addDaysLocal(calendarScope, 1)}T00:00`,
            needsRangeReview: true,
          }
        : result.draft;
      setAssumptions(
        calendarScope
          ? [
              "Using the day selected in Calendar; review the range before searching.",
            ]
          : (result.assumptions ?? []),
      );
      setUnresolved(result.unresolved ?? []);
      const nextActivity =
        result.state === "resolved" ? result.options[0].key : "";
      setDraft(nextDraft);
      setCompare(false);
      setSuppliedStarts(["", ""]);
      setActivity(nextActivity);
      setActivityOptions(result.options);
      setInterpretation(
        result.clarification ??
          (result.state === "resolved"
            ? ""
            : result.state === "ambiguous"
              ? "Which activity did you mean? Choose one below."
              : "Compass does not have a timing match for this activity yet. You can change your request above."),
      );
      queryId.current = crypto.randomUUID();
      if (result.state === "unsupported")
        logEvent("unsupported_activity_requested", {
          queryId: queryId.current,
          category: result.state,
        });
      if (result.state === "resolved" && !nextDraft.needsRangeReview)
        await search(false, nextDraft, nextActivity, false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function search(
    checkCalendar = false,
    searchDraft = draft,
    searchActivity = activity,
    searchCompare = compare,
  ) {
    if (!searchDraft || !searchActivity) return;
    setBusy(true);
    setError("");
    setChosen(null);
    setExported(false);
    try {
      const q: Query =
        checkCalendar && query
          ? { ...query, checkCalendar: true }
          : {
              activity: searchActivity,
              start: new Date(searchDraft.start).toISOString(),
              end: new Date(searchDraft.end).toISOString(),
              timeZone,
              ...(searchDraft.duration
                ? { durationMinutes: Number(searchDraft.duration) }
                : {}),
              ...(searchCompare
                ? {
                    candidateIntervals: suppliedStarts.map((start) => ({
                      start: new Date(start).toISOString(),
                      end: comparisonEnd(start, searchDraft.duration)!,
                    })),
                  }
                : {}),
              ...(locationKnown ? { location: { lat, lon } } : {}),
              useNatal,
              checkCalendar,
            };
      const data: TimingResponse = await post("search", q);
      if (!("days" in data.result)) {
        setError(
          ERRORS[data.result.code] ??
            "Check the activity and dates for this search.",
        );
        setResponse(null);
        return;
      }
      setQuery(q);
      setResponse(data);
      logEvent("timing_search_result", {
        queryId: queryId.current,
        activity: q.activity,
        status: data.result.status,
        outcome: data.result.outcome,
        durationMinutes: q.durationMinutes ?? null,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function choose(c: Candidate) {
    if (!query) return;
    if (!query.durationMinutes && draft) {
      setDraft({
        ...draft,
        start: inputTime(new Date(c.start)),
        end: inputTime(new Date(c.end)),
        duration: "60",
        needsRangeReview: false,
      });
      setResponse(null);
      setUnresolved([]);
      setAssumptions([
        "The search is now limited to the opening you selected.",
      ]);
      setInterpretation(
        "How much time would you like? One hour is filled in as a starting point; review the duration before searching.",
      );
      return;
    }
    setBusy(true);
    setError("");
    const title =
      catalogue?.activities.find((a) => a.key === query.activity)?.label ??
      "Chosen time";
    const identity = JSON.stringify({ query, candidateId: c.id });
    const key = keys.current.get(identity) ?? crypto.randomUUID();
    keys.current.set(identity, key);
    try {
      const saved = await post("choose", {
        query,
        choiceKey: key,
        candidateId: c.id,
        title,
      });
      setChosen({ id: saved.window.id, candidate: c, title });
      invalidateWindows(qc);
      logEvent("timing_window_chosen", {
        queryId: queryId.current,
        activity: query.activity,
        windowId: saved.window.id,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function exportChoice() {
    if (!chosen) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          timingIcal(
            chosen.id,
            chosen.title,
            chosen.candidate.start,
            chosen.candidate.end,
            new Date(),
          ),
        ],
        { type: "text/calendar;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "compass-time.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(true);
    logEvent("timing_export_offered", {
      queryId: queryId.current,
      windowId: chosen.id,
    });
  }
  const format = (s: string) =>
    new Date(s).toLocaleString("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  const formatDay = (s: string) =>
    new Date(s).toLocaleDateString("en-US", {
      timeZone,
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  const formatClock = (s: string) =>
    new Date(s).toLocaleTimeString("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
    });
  const dayKey = (c: Candidate) =>
    new Date(c.start).toLocaleDateString("en-CA", { timeZone });
  const groups = Object.groupBy(response?.candidates ?? [], dayKey);
  function card(c: Candidate) {
    const canChoose =
      (!c.broad || !query?.durationMinutes) &&
      !c.shortfall &&
      c.suitability !== "defer" &&
      c.availability.status !== "conflict" &&
      !(query?.checkCalendar && c.availability.status !== "clear");
    return (
      <article
        className="timing-card"
        key={c.id}
        id={`opening-${c.id}`}
        tabIndex={-1}
      >
        <div className="timing-signal" aria-hidden="true" />
        <div
          className="timing-time"
          aria-label={`${format(c.start)} until ${format(c.end)}`}
        >
          <span>{formatDay(c.start)}</span>
          <div>
            <strong>{formatClock(c.start)}</strong>
            <i>—</i>
            <b>{formatClock(c.end)}</b>
          </div>
        </div>
        {c.broad && (
          <p>
            Broad conditions for this period. Add a duration to find a specific
            session.
          </p>
        )}
        {c.shortfall && (
          <p role="status">
            Only {Math.round((Date.parse(c.end) - Date.parse(c.start)) / 60000)}{" "}
            minutes fit here. Your requested duration is still{" "}
            {query?.durationMinutes} minutes.
          </p>
        )}
        <p>{c.explanation}</p>
        {c.suitability !== "clear" && (
          <div className="timing-qualification">
            <strong>
              {c.suitability === "defer"
                ? "The reading advises waiting"
                : "What to consider"}
            </strong>
            <ul>
              {qualifications(c).map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="timing-availability">
          {
            {
              unchecked: "Calendar not checked",
              clear: "No conflicts found in Google Calendar",
              conflict: "Busy then",
              unavailable:
                "Calendar unavailable; free time could not be checked",
            }[c.availability.status]
          }
        </p>
        <details
          onToggle={(e) => {
            if (e.currentTarget.open)
              logEvent("timing_evidence_opened", { queryId: queryId.current });
          }}
        >
          <summary>Why this?</summary>
          {c.kind === "ordinary" && "evidence" in c.evidence && (
            <ul>
              {c.evidence.evidence?.map((e, i) => (
                <li key={i}>{e.text}</li>
              ))}
            </ul>
          )}
          {c.kind === "comparison" && (
            <>
              <p>
                This reading assesses the supplied interval. It does not
                establish a favorable opening or rank it against the other
                times.
              </p>
              {c.evidence.transitions.filter((t) => t.role !== "irrelevant")
                .length > 0 && (
                <ul>
                  {c.evidence.transitions
                    .filter((t) => t.role !== "irrelevant")
                    .map((t, i) => (
                      <li key={i}>
                        {t.kind.replaceAll("-", " ")} at {format(String(t.at))}
                      </li>
                    ))}
                </ul>
              )}
            </>
          )}
          {c.kind === "session" && (
            <>
              <p>
                {
                  {
                    uninterrupted: "Selected for an uninterrupted session.",
                    anchored: "Selected around an exact lunar contact.",
                    earliest:
                      "The earliest workable session in this part of the range.",
                    shortfall:
                      "The longest available interval is shorter than requested.",
                  }[c.evidence.tradeoff as "uninterrupted"]
                }
              </p>
              <p>
                {c.evidence.backgroundFit === "aligned"
                  ? "The Moon’s sign matches this activity."
                  : c.evidence.backgroundFit === "contrary"
                    ? "The Moon’s sign does not match this activity’s usual preference."
                    : "The Moon’s sign adds no preference for this activity."}
              </p>
              {c.evidence.anchor && (
                <p>
                  {c.evidence.anchor.label} at{" "}
                  {format(String(c.evidence.anchor.at))}; this contact describes
                  a moment within the session.
                </p>
              )}
              {c.evidence.arc.length > 0 && (
                <ul>
                  {c.evidence.arc.map((a, i) => (
                    <li key={i}>
                      {a.ruler}: {a.minutes} minutes from{" "}
                      {format(String(a.startAt))}
                      {a.preferred
                        ? ", a preferred planetary hour for this activity"
                        : ""}
                    </li>
                  ))}
                </ul>
              )}
              {c.evidence.transitions.filter((t) => t.kind !== "hour-change")
                .length > 0 && (
                <ul>
                  {c.evidence.transitions
                    .filter((t) => t.kind !== "hour-change")
                    .map((t, i) => (
                      <li key={i}>
                        {t.label} at {format(String(t.at))}
                      </li>
                    ))}
                </ul>
              )}
            </>
          )}
          <details>
            <summary>Full evidence</summary>
            <pre>{JSON.stringify(c.evidence, null, 2)}</pre>
          </details>
        </details>
        {canChoose && (
          <Action
            className="timing-choose"
            disabled={busy || chosen?.candidate.id === c.id}
            onClick={() => choose(c)}
          >
            {chosen?.candidate.id === c.id
              ? "Chosen"
              : query?.durationMinutes
                ? "Choose this time"
                : "Find a session here"}
          </Action>
        )}
      </article>
    );
  }
  return (
    <div className="timing-shell">
      <header className="timing-header">
        {/* The panel opens on the left, so its switch sits on the left too. */}
        <div className="timing-header-start">
        <Action
          className="timing-brand"
          onClick={() => {
            setChosen(null);
            setError("");
            setCalendarScope(null);
            setDraft(null);
            setResponse(null);
            setDestination("search");
          }}
        >
          Compass
        </Action>
          <Action
            className="timing-rail-toggle"
            aria-pressed={railOpen}
            aria-controls="timing-rail"
            onClick={toggleRail}
            aria-label="Sky panel"
          >
            <span className="timing-rail-icon" aria-hidden="true">◐</span>
            <span className="timing-rail-label">Sky panel</span>
          </Action>
        </div>
        <nav className="timing-nav" aria-label="Compass">
          <Action
            aria-current={
              (destination === "search" && !draft) || destination === "now"
                ? "page"
                : undefined
            }
            onClick={() => {
              setCalendarScope(null);
              setChosen(null);
              setError("");
              setCalendarScope(null);
              setDraft(null);
              setResponse(null);
              setDestination("search");
            }}
          >
            Home
          </Action>
          <Action
            aria-current={
              destination === "calendar" ||
              destination === "saved" ||
              (destination === "search" && !!draft)
                ? "page"
                : undefined
            }
            onClick={() => setDestination("calendar")}
          >
            Calendar
          </Action>
          <Action
            aria-current={destination === "almanac" ? "page" : undefined}
            onClick={() => setDestination("almanac")}
          >
            Almanac
          </Action>
          <Action
            aria-current={destination === "workspace" ? "page" : undefined}
            onClick={() => setDestination("workspace")}
          >
            Workspace
          </Action>
        </nav>
        <details className="timing-account" onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.open = false;
            e.currentTarget.querySelector("summary")?.focus();
          }
        }}>
          <summary aria-label={profile?.displayName || "Account"}>
            <span className="timing-account-initial" aria-hidden="true">{(profile?.displayName || "A").slice(0, 1).toUpperCase()}</span>
            <span className="timing-account-name">{profile?.displayName || "Account"}</span>
          </summary>
          <div className="timing-account-menu">
            <Action onClick={toggleTheme}>
              {theme === "dark" ? "Light appearance" : "Dark appearance"}
            </Action>
            <Action onClick={() => setDestination("about")}>
              About Compass
            </Action>
            {/* From the old top bar (W8): the Guide and the feedback door keep
                a place on every screen, in the menu that is on every screen. */}
            <Action onClick={() => setShowGuide(true)}>How Compass works</Action>
            <Action onClick={() => setFeedbackOpen(true)}>Send feedback</Action>
            <Action onClick={() => setDestination("settings")}>
              Account and settings
            </Action>
          </div>
        </details>
      </header>
      {capture && (
        <QuickCapture testerId={testerId} onClose={() => setCapture(false)}
          onDumpToPlanner={(list) => { setCapture(false); setPlannerSeed(list); setWorkSection("plan"); setDestination("workspace"); }} />
      )}
      {showGuide && <Guide onClose={() => setShowGuide(false)} />}
      {feedbackOpen && <FeedbackDoor testerId={testerId} view={destination} onClose={() => setFeedbackOpen(false)} />}
      {advisor && (
        <MomentAdvisor
          testerId={testerId} lat={lat} lon={lon}
          onClose={() => setAdvisor(null)}
          seedMessage={advisor.seed}
          electionContext={advisor.ctx}
          strongestFit={advisor.ctx?.subject ? {
            title: advisor.ctx.subject.title, why: advisor.ctx.subject.why ?? "",
            when: advisor.ctx.subject.when ?? "", kind: advisor.ctx.subject.kind ?? "loop",
          } : null}
          now={railNow}
          onAddTask={() => { setAdvisor(null); setCapture(true); }}
        />
      )}
      <div className={railOpen ? "timing-body timing-body-rail" : "timing-body"}>
      {railOpen && (
        <aside id="timing-rail" className="timing-rail" aria-label="Sky panel">
          <Action className="timing-rail-close" onClick={toggleRail}>Close</Action>
          <Rail
            now={railNow}
            testerId={testerId}
            lat={lat}
            lon={lon}
            hideWordmark
            onNavigate={(v) => {
              if (v === "work" || v === "settings") openWorkspace(v);
              else setDestination("now");
            }}
          />
        </aside>
      )}
      <div className="timing-body-content">
      {destination === "search" ? (
        <main
          className={
            draft
              ? "timing-main timing-calendar-search"
              : "timing-main compass-home"
          }
        >
          {draft && (
            <div className="timing-intro">
              <p className="timing-kicker">Find a time</p>
              <a className="compass-calendar-jump" href="#search-calendar">
                View calendar
              </a>
              <h1>
                {draft
                  ? response?.candidates.length
                    ? "Your openings"
                    : "Your search"
                  : "What would you like to do?"}
              </h1>
              {!draft && (
                <p>
                  Find a time for the things you want to do, with astrology you
                  can inspect and a choice you can keep.
                </p>
              )}
            </div>
          )}
          {busy && <p role="status">Working on your request…</p>}
          {error && (
            <p id="timing-request-error" className="timing-error" role="alert">
              {error}
            </p>
          )}
          {!draft && (
            <CompassHome
              onSpread={() => { setSpreadOnOpen(true); setWorkSection("plan"); setDestination("workspace"); }}
              onCalendar={() => setDestination("calendar")}
              onNow={() => setDestination("now")}
              examples={
                <div className="timing-examples">
                  {[
                    "Three hours of deep work this weekend",
                    "Write tomorrow",
                    "A first date Saturday",
                  ].map((example) => (
                    <Action
                      disabled={busy}
                      key={example}
                      onClick={() => {
                        setText(example);
                        void interpret(example);
                      }}
                    >
                      {example}
                    </Action>
                  ))}
                </div>
              }
            >
              {calendarScope && (
                <p role="status">
                  Selected in Calendar: {calendarScope}.{" "}
                  <Action onClick={() => setCalendarScope(null)}>
                    Clear date
                  </Action>
                </p>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void interpret();
                }}
                className="timing-question"
              >
                <label htmlFor="timing-intent">Your request</label>
                <textarea
                  id="timing-intent"
                  aria-describedby={error ? "timing-request-error" : undefined}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setDraft(null);
                    setResponse(null);
                  }}
                  maxLength={500}
                  placeholder="Write tomorrow"
                  rows={1}
                  required
                />
                <Action disabled={busy || !text.trim()} type="submit">
                  Find a time
                </Action>
              </form>
            </CompassHome>
          )}
          {draft && (
            <div className="compass-calendar-context" id="search-calendar">
              <RestoredTimeView
                view="calendar"
                key={draft.start.slice(0, 10)}
                initialDate={draft.start.slice(0, 10)}
                openings={response?.candidates
                  .filter((c) => c.id !== chosen?.candidate.id)
                  .map((c) => ({
                    id: c.id,
                    start: c.start,
                    end: c.end,
                    label: `${format(c.start)} to ${format(c.end)}`,
                  }))}
                onInspectOpening={(id) => {
                  const el = document.getElementById(`opening-${id}`);
                  el?.focus();
                  el?.scrollIntoView({ block: "center" });
                }}
                onFindTime={searchCalendarDay}
                onNavigate={() => openWorkspace("launch")}
              />
            </div>
          )}
          <div className={draft ? "compass-search-results" : undefined}>
            {draft && (
              <section className="timing-query-receipt">
                <div>
                  <span>Your request</span>
                  <strong>{text}</strong>
                  {assumptions.map((line) => (
                    <small key={line}>{line}</small>
                  ))}
                  {activity && (
                    <small>
                      {catalogue?.activities.find((a) => a.key === activity)
                        ?.label ?? activity}{" "}
                      ·{" "}
                      {draft.duration
                        ? `${draft.duration} minutes`
                        : "Any opening"}
                    </small>
                  )}
                  <small>
                    {format(draft.start)} to {format(draft.end)} · {timeZone}
                  </small>
                  {!locationKnown && (
                    <small>
                      Using sky conditions that do not require your location.
                    </small>
                  )}
                </div>
                <Action
                  type="button"
                  onClick={() => {
                    setDraft(null);
                    setResponse(null);
                    setChosen(null);
                  }}
                >
                  Change
                </Action>
              </section>
            )}
            {response && "days" in response.result && (
              <section className="timing-results" aria-label="Search results">
                <div className="timing-results-header">
                  <h2>
                    {query?.candidateIntervals
                      ? "Your times compared"
                      : "Possible times"}
                  </h2>
                  {!query?.candidateIntervals && (
                    <p>
                      Choose any interval that fits. The reading stays inside
                      the time shown.
                    </p>
                  )}
                  <div role="group" aria-label="Results view">
                    <Action
                      aria-pressed={view === "list"}
                      onClick={() => setView("list")}
                    >
                      List
                    </Action>
                    <Action
                      aria-pressed={view === "week"}
                      onClick={() => setView("week")}
                    >
                      Week
                    </Action>
                  </div>
                </div>
                {response.result.status !== "complete" && (
                  <p role="alert">
                    {response.result.coverage.failed.length} part(s) of this
                    range could not be read. The results below cover only the
                    completed parts.
                  </p>
                )}
                {response.result.context.natal ===
                  "omitted_comparison_unsupported" && (
                  <p>Your birth chart was not used for this comparison.</p>
                )}
                {query?.candidateIntervals && (
                  <p>
                    Compare the readings and qualifications below. Similar
                    readings may give you no astrological preference between
                    these times.
                  </p>
                )}
                {response.result.context.natal ===
                  "omitted_session_unsupported" && (
                  <p>Your birth chart was not used for this duration search.</p>
                )}
                {response.result.outcome === "empty" && (
                  <p>
                    No full opening was returned for this request. Try another
                    range or review the duration.
                  </p>
                )}
                <Action disabled={busy} onClick={() => search(true)}>
                  Check against my calendar
                </Action>
                <div className={`timing-candidates timing-${view}`}>
                  {view === "list"
                    ? response.candidates.map(card)
                    : Object.entries(groups).map(([day, candidates]) => (
                        <section key={day} className="timing-day">
                          <h3>{day}</h3>
                          {candidates?.map(card)}
                        </section>
                      ))}
                </div>
              </section>
            )}
            {draft && (
              <details
                className="timing-adjust"
                key={response && activity ? "settled" : "setup"}
                open={!response || !activity}
              >
                <summary>Adjust search</summary>
                <form
                  className="timing-interpretation"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void search();
                  }}
                >
                  <h2>Your search</h2>
                  {interpretation && <p role="status">{interpretation}</p>}
                  {unresolved.length > 0 && (
                    <ul id="timing-constraints" role="status">
                      {unresolved.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  )}
                  <label className="timing-checkbox">
                    <input
                      type="checkbox"
                      checked={compare}
                      onChange={(e) => {
                        setCompare(e.target.checked);
                        setResponse(null);
                        setChosen(null);
                      }}
                    />
                    Compare times I already have in mind
                  </label>
                  {!activity && activityOptions.length > 0 && (
                    <div
                      className="timing-activity-choices"
                      role="group"
                      aria-label="Activity choices"
                    >
                      {activityOptions.map((option) => (
                        <Action
                          key={option.key}
                          type="button"
                          onClick={() => {
                            setActivity(option.key);
                            setInterpretation("");
                            setResponse(null);
                            if (!draft.needsRangeReview)
                              void search(false, draft, option.key, false);
                            else rangeStart.current?.focus();
                          }}
                        >
                          {option.label}
                        </Action>
                      ))}
                    </div>
                  )}
                  {activity && (
                    <p className="timing-activity-confirmed">
                      <span>Activity</span>
                      <strong>
                        {activityOptions.find((o) => o.key === activity)
                          ?.label ??
                          catalogue?.activities.find((o) => o.key === activity)
                            ?.label}
                      </strong>
                    </p>
                  )}
                  <div className="timing-fields">
                    <label>
                      From
                      <input
                        required
                        type="datetime-local"
                        ref={rangeStart}
                        aria-describedby={
                          unresolved.length ? "timing-constraints" : undefined
                        }
                        value={draft.start}
                        onChange={(e) => {
                          setDraft({ ...draft, start: e.target.value });
                          setResponse(null);
                        }}
                      />
                    </label>
                    <label>
                      Until
                      <input
                        required
                        type="datetime-local"
                        value={draft.end}
                        onChange={(e) => {
                          setDraft({ ...draft, end: e.target.value });
                          setResponse(null);
                        }}
                      />
                    </label>
                    <label>
                      Duration in minutes
                      <input
                        type="number"
                        min="1"
                        max="1440"
                        step="1"
                        required={compare}
                        placeholder="Any opening"
                        value={draft.duration}
                        onChange={(e) => {
                          setDraft({ ...draft, duration: e.target.value });
                          setResponse(null);
                        }}
                      />
                    </label>
                  </div>
                  {compare && (
                    <fieldset className="timing-comparison-inputs">
                      <legend>Times to compare</legend>
                      <p>
                        Use the same activity and duration for every time. Each
                        interval must fit between From and Until.
                      </p>
                      {suppliedStarts.map((start, i) => (
                        <div key={i}>
                          <label>
                            Start time {i + 1}
                            <input
                              required
                              type="datetime-local"
                              value={start}
                              onChange={(e) => {
                                const value = e.target.value;
                                setSuppliedStarts((current) =>
                                  current.map((v, n) => (n === i ? value : v)),
                                );
                                setResponse(null);
                              }}
                            />
                          </label>
                          {comparisonEnd(start, draft.duration) && (
                            <p>
                              Until{" "}
                              {format(comparisonEnd(start, draft.duration)!)}
                            </p>
                          )}
                          {suppliedStarts.length > 2 && (
                            <Action
                              type="button"
                              onClick={() => {
                                setSuppliedStarts((current) =>
                                  current.filter((_, n) => n !== i),
                                );
                                setResponse(null);
                              }}
                            >
                              Remove time {i + 1}
                            </Action>
                          )}
                        </div>
                      ))}
                      {suppliedStarts.length < 6 && (
                        <Action
                          type="button"
                          onClick={() => {
                            setSuppliedStarts((current) => [...current, ""]);
                            setResponse(null);
                          }}
                        >
                          Add another time
                        </Action>
                      )}
                      <p>
                        Times stay in the order you enter them; Compass does not
                        select a winner. Duration is elapsed time, including any
                        daylight-saving clock change.
                      </p>
                    </fieldset>
                  )}
                  <p className="timing-note">
                    Times in {timeZone}. Search up to seven calendar days.
                    {!compare && " Searches currently check 7 AM–11 PM."}
                  </p>
                  {draft.needsRangeReview && (
                    <p>
                      Please check the dates above; this request needs a more
                      specific range.
                    </p>
                  )}
                  <label className="timing-checkbox">
                    <input
                      type="checkbox"
                      checked={useNatal}
                      onChange={(e) => {
                        setUseNatal(e.target.checked);
                        setResponse(null);
                      }}
                    />
                    Include my birth chart if available
                  </label>
                  {!locationKnown && (
                    <p className="timing-note">
                      No location is set, so these results use the sky
                      conditions that do not depend on your location.
                    </p>
                  )}
                  {catalogueError && (
                    <p role="alert">
                      The activity list could not load. Refresh the page to try
                      again.
                    </p>
                  )}
                  <Action disabled={busy || !activity}>
                    {compare ? "Compare times" : "Find times"}
                  </Action>
                </form>
              </details>
            )}
            {chosen && (
              <section className="timing-confirmation" role="status">
                <h2>Saved to Compass</h2>
                <p>
                  {chosen.title} · {format(chosen.candidate.start)} to {format(chosen.candidate.end)}
                </p>
                <p>Your chosen time is saved in your Compass calendar.</p>
                <Action onClick={() => {
                  setDestination("calendar");
                  setChosen(null);
                }}>Open calendar</Action>
                <Action onClick={exportChoice}>Download calendar event</Action>
                <Action variant="text" onClick={() => setDestination("saved")}>
                  View saved times
                </Action>
                {exported && (
                  <p>
                    The calendar file was offered for download. Import it into
                    your calendar to add the event.
                  </p>
                )}
              </section>
            )}
          </div>
        </main>
      ) : destination === "now" ||
        destination === "calendar" ||
        destination === "almanac" ? (
        <>
          <div className="compass-calendar-actions">
            <h1>{destination === "almanac" ? "Almanac" : destination === "calendar" ? "Calendar" : "What to do now"}</h1>
            {/* Calendar offers this from its More menu (density pass, C1). */}
            {destination === "almanac" && (
              <Action variant="text" onClick={() => setDestination("saved")}>
                Saved choices
              </Action>
            )}
          </div>
          <RestoredTimeView
            key={destination}
            view={destination}
            onFindTime={searchCalendarDay}
            onSavedChoices={() => setDestination("saved")}
            onNavigate={(view, starId) => {
              if (view === "calendar" || view === "almanac")
                setDestination(view);
              else openWorkspace(view, starId);
            }}
          />
        </>
      ) : destination === "saved" ? (
        <TimingLibrary
          testerId={testerId}
          timeZone={timeZone}
          onSearch={startFreshSearch}
        />
      ) : destination === "workspace" ? (
        <main className="timing-workspace">
          <div className="timing-workspace-bar">
            <div className="compass-segments" role="tablist" aria-label="Workspace">
              {([["tasks","Tasks"],["habits","Habits"],["stars","Stars"],["plan","Plan"],["bearings","Bearings"]] as const).map(([id, label]) => (
                <Action key={id} role="tab" aria-selected={workSection === id} aria-pressed={workSection === id} onClick={() => { setSpreadOnOpen(false); setWorkSection(id); }}>{label}</Action>
              ))}
            </div>
            <div className="timing-workspace-actions">
              <Action onClick={() => setCapture(true)}>+ task</Action>
              {railNow?.planetaryHour && (
                <SessionTimer planetaryHour={railNow.planetaryHour} openOn={sessionOn} onOpened={() => setSessionOn(null)} />
              )}
              <Action onClick={() => setAdvisor({ seed: null, ctx: null })}><span aria-hidden="true">✦</span> Ask</Action>
            </div>
          </div>
          <div className="timing-workspace-page">
            {workSection === "plan" ? (
              <Launch
                key={spreadOnOpen ? "spread" : "plan"}
                spreadOnOpen={spreadOnOpen}
                testerId={testerId} lat={lat} lon={lon}
                plannerSeed={plannerSeed} onPlannerSeedConsumed={() => setPlannerSeed(null)}
                onAskAboutElection={(ctx, seed) => setAdvisor({ seed, ctx })}
                onNavigate={(v) => openWorkspace(v)}
                planets={{
                  onReflect: (seed: string) => setAdvisor({ seed, ctx: null }),
                  initialPlanet: null,
                  onStartStar: (element: string) => { setStarSeed(element); setWorkSection("stars"); },
                }}
              />
            ) : (
              <WorkPage
                testerId={testerId} now={railNow} lat={lat} lon={lon}
                tab={WORK_TO_PAGE[workSection]}
                onTabChange={(t) => setWorkSection(t === "overview" ? "stars" : t)}
                seedElement={starSeed} onSeedConsumed={() => setStarSeed(null)}
                focusStarId={focusStar} onFocusConsumed={() => setFocusStar(null)}
                onOpenSettings={() => setDestination("settings")}
                onLeaveWork={(v) => openWorkspace(v)}
              />
            )}
          </div>
        </main>
      ) : destination === "settings" ? (
        <main className="timing-restored">
          <Settings testerId={testerId} />
        </main>
      ) : (
        <main className="timing-main timing-secondary">
          <p className="timing-kicker">About Compass</p>
          <h1>A time for what matters to you.</h1>
          <p>
            Bring something you want to do and the time you have available.
            Compass looks for astrological openings, explains the conditions,
            and lets you choose what fits your life.
          </p>
          <div className="timing-feature-grid">
            <article>
              <h2>Start with one intention</h2>
              <p>
                Try “three hours of deep work this weekend” or “a first date
                Saturday.” You can adjust the activity, dates, and duration
                after searching.
              </p>
            </article>
            <article>
              <h2>Read the reasons</h2>
              <p>
                Each opening comes with its evidence and any qualifications.
                Timing describes conditions; the decision remains yours.
              </p>
            </article>
            <article>
              <h2>Keep your choice</h2>
              <p>
                Save a time in Compass and download an event for your calendar.
                Check calendar availability when you need it.
              </p>
            </article>
            <article>
              <h2>Add context as you go</h2>
              <p>
                You can search without a birth chart. Location, personal
                context, and the optional workspace provide more detail when you
                want it.
              </p>
            </article>
          </div>
          <Action onClick={() => setDestination("search")}>Find a time</Action>
        </main>
      )}
      </div>
      </div>
    </div>
  );
}

/** The existing instruments retain their queries, controls, and visual language. */
function RestoredTimeView({
  view,
  onSavedChoices,
  onNavigate,
  initialDate,
  onFindTime,
  openings,
  onInspectOpening,
}: {
  openings?: CalendarOpening[];
  onInspectOpening?: (id: string) => void;
  initialDate?: string;
  onFindTime?: (date: string) => void;
  view: "now" | "calendar" | "almanac";
  onSavedChoices?: () => void;
  onNavigate: (view: string, starId?: number) => void;
}) {
  const { profile, lat, lon, locationKnown } = useTester();
  const testerId = profile?.testerId ?? null;
  const { data: now, isError, refetch } = useTidesNow(testerId, lat, lon);
  const [session, setSession] = useState<{ title: string } | null>(null);
  return (
    <div className="timing-restored">
      {isError && (
        <p role="alert">
          The current sky could not load.{" "}
          <Action onClick={() => refetch()}>Try again</Action>
        </p>
      )}
      {view === "now" ? (
        <>
          <div className="timing-restored-heading">
            {/* The shell's heading names this page; a second "Now" under it
                repeated it. The row stays for the session timer. */}
            <span />
            {now && (
              <SessionTimer
                planetaryHour={now.planetaryHour}
                openOn={session}
                onOpened={() => setSession(null)}
              />
            )}
          </div>
          <Home
            testerId={testerId}
            lat={lat}
            lon={lon}
            onNavigate={onNavigate}
            onStartSession={(title) => setSession({ title })}
            onOpenStar={(starId) => onNavigate("work", starId)}
            answerPage
          />
        </>
      ) : (
        <Calendar
          testerId={testerId}
          now={now}
          lat={lat}
          lon={lon}
          locationKnown={locationKnown}
          initialView={
            view === "almanac" ? "almanac" : initialDate ? "week" : undefined
          }
          shellNavigation
          initialDate={initialDate}
          onFindTime={onFindTime}
          onSavedChoices={onSavedChoices}
          openings={openings}
          onInspectOpening={onInspectOpening}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
