import React, { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTester } from "@/contexts/tester-context";
import { interpretTimingRange, timingIcal } from "@/lib/timingQuery";
import { logEvent } from "@/lib/analytics";
import type { TimingResponse } from "../../../api-server/src/lib/timingPresentation";
import "./FindTime.css";

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
export default function FindTime({ onWorkspace }: { onWorkspace: () => void }) {
  const { profile, lat, lon, locationKnown } = useTester();
  const testerId = profile!.testerId;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [text, setText] = useState("");
  const [activity, setActivity] = useState("");
  const [draft, setDraft] = useState<ReturnType<
    typeof interpretTimingRange
  > | null>(null);
  const [compare, setCompare] = useState(false);
  const [suppliedStarts, setSuppliedStarts] = useState(["", ""]);
  const [useNatal, setUseNatal] = useState(false);
  const [interpretation, setInterpretation] = useState("");
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
  async function post(path: string, body: unknown) {
    const r = await fetch(`/api/timing/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-tester-id": testerId },
      body: JSON.stringify(body),
    });
    const data = await r.json();
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
    setBusy(true);
    setError("");
    setResponse(null);
    setChosen(null);
    setExported(false);
    try {
      const result = await post("interpret", { text: value });
      setDraft(interpretTimingRange(value, new Date()));
      setCompare(false);
      setSuppliedStarts(["", ""]);
      setActivity(result.state === "resolved" ? result.options[0].key : "");
      setInterpretation(
        result.state === "resolved"
          ? ""
          : result.state === "ambiguous"
            ? "Which activity did you mean? Choose one below."
            : "Compass does not have a clear timing match for this request. You can choose an activity below if one fits.",
      );
      queryId.current = crypto.randomUUID();
      if (result.state === "unsupported")
        logEvent("unsupported_activity_requested", {
          queryId: queryId.current,
          category: result.state,
        });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function search(checkCalendar = false) {
    if (!draft || !activity) return;
    setBusy(true);
    setError("");
    setChosen(null);
    setExported(false);
    try {
      const q: Query =
        checkCalendar && query
          ? { ...query, checkCalendar: true }
          : {
              activity,
              start: new Date(draft.start).toISOString(),
              end: new Date(draft.end).toISOString(),
              timeZone,
              ...(draft.duration
                ? { durationMinutes: Number(draft.duration) }
                : {}),
              ...(compare
                ? {
                    candidateIntervals: suppliedStarts.map((start) => ({
                      start: new Date(start).toISOString(),
                      end: comparisonEnd(start, draft.duration)!,
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
  const dayKey = (c: Candidate) =>
    new Date(c.start).toLocaleDateString("en-CA", { timeZone });
  const groups = Object.groupBy(response?.candidates ?? [], dayKey);
  function card(c: Candidate) {
    const canChoose =
      !c.broad &&
      !c.shortfall &&
      c.suitability !== "defer" &&
      c.availability.status !== "conflict" &&
      !(query?.checkCalendar && c.availability.status !== "clear");
    return (
      <article className="timing-card" key={c.id}>
        <h3>{format(c.start)}</h3>
        <p className="timing-end">Until {format(c.end)}</p>
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
          <button
            className="timing-choose"
            disabled={busy || chosen?.candidate.id === c.id}
            onClick={() => choose(c)}
          >
            {chosen?.candidate.id === c.id ? "Chosen" : "Choose this time"}
          </button>
        )}
      </article>
    );
  }
  return (
    <div className="timing-shell">
      <header className="timing-header">
        <span className="timing-brand">Compass</span>
        <details className="timing-account">
          <summary>{profile?.displayName || "Account"}</summary>
          <button onClick={onWorkspace}>Workspace</button>
        </details>
      </header>
      <main className="timing-main">
        <div className="timing-intro">
          <p className="timing-kicker">Find a time</p>
          <h1>What would you like to do?</h1>
          <p>Find astrological openings for something you have in mind.</p>
        </div>
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
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setDraft(null);
              setResponse(null);
            }}
            maxLength={500}
            placeholder="Three hours of deep work this weekend"
            rows={2}
            required
          />
          <button disabled={busy || !text.trim()} type="submit">
            Review request
          </button>
        </form>
        {!draft && (
          <div className="timing-examples">
            {[
              "Three hours of deep work this weekend",
              "Write tomorrow",
              "A first date Saturday",
            ].map((example) => (
              <button
                disabled={busy}
                key={example}
                onClick={() => {
                  setText(example);
                  void interpret(example);
                }}
              >
                {example}
              </button>
            ))}
          </div>
        )}
        {draft && (
          <form
            className="timing-interpretation"
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
          >
            <h2>Your search</h2>
            {interpretation && <p role="status">{interpretation}</p>}
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
            <div className="timing-fields">
              <label>
                Activity
                <select
                  required
                  value={activity}
                  onChange={(e) => {
                    setActivity(e.target.value);
                    setResponse(null);
                  }}
                >
                  <option value="">Choose an activity</option>
                  {catalogue?.activities.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.key === "first-date" ? "A first date" : a.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                From
                <input
                  required
                  type="datetime-local"
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
                            current.map((v, n) =>
                              n === i ? value : v,
                            ),
                          );
                          setResponse(null);
                        }}
                      />
                    </label>
                    {comparisonEnd(start, draft.duration) && (
                      <p>
                        Until {format(comparisonEnd(start, draft.duration)!)}
                      </p>
                    )}
                    {suppliedStarts.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSuppliedStarts((current) =>
                            current.filter((_, n) => n !== i),
                          );
                          setResponse(null);
                        }}
                      >
                        Remove time {i + 1}
                      </button>
                    )}
                  </div>
                ))}
                {suppliedStarts.length < 6 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSuppliedStarts((current) => [...current, ""]);
                      setResponse(null);
                    }}
                  >
                    Add another time
                  </button>
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
              {draft.duration && !compare && " Sessions use 7 AM–11 PM."}
            </p>
            {draft.needsRangeReview && (
              <p>
                Please check the dates above; this request needs a more specific
                range.
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
                No location is set, so these results use the sky conditions that
                do not depend on your location.
              </p>
            )}
            {catalogueError && (
              <p role="alert">
                The activity list could not load. Refresh the page to try again.
              </p>
            )}
            <button disabled={busy || !activity}>
              {compare ? "Compare times" : "Find times"}
            </button>
          </form>
        )}
        {busy && <p role="status">Reading your request…</p>}
        {error && (
          <p className="timing-error" role="alert">
            {error}
          </p>
        )}
        {chosen && (
          <section className="timing-confirmation" role="status">
            <h2>Saved to Compass</h2>
            <p>
              {chosen.title} · {format(chosen.candidate.start)}
            </p>
            <p>Your chosen time is in Workspace Calendar.</p>
            <button onClick={exportChoice}>Download calendar event</button>
            {exported && (
              <p>
                The calendar file was offered for download. Import it into your
                calendar to add the event.
              </p>
            )}
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
              <div role="group" aria-label="Results view">
                <button
                  aria-pressed={view === "list"}
                  onClick={() => setView("list")}
                >
                  List
                </button>
                <button
                  aria-pressed={view === "week"}
                  onClick={() => setView("week")}
                >
                  Week
                </button>
              </div>
            </div>
            {response.result.status !== "complete" && (
              <p role="alert">
                {response.result.coverage.failed.length} part(s) of this range
                could not be read. The results below cover only the completed
                parts.
              </p>
            )}
            {response.result.context.natal ===
              "omitted_comparison_unsupported" && (
              <p>Your birth chart was not used for this comparison.</p>
            )}
            {query?.candidateIntervals && (
              <p>
                Compare the readings and qualifications below. Similar readings
                may give you no astrological preference between these times.
              </p>
            )}
            {response.result.context.natal ===
              "omitted_session_unsupported" && (
              <p>Your birth chart was not used for this duration search.</p>
            )}
            {response.result.outcome === "empty" && (
              <p>
                No full opening was returned for this request. Try another range
                or review the duration.
              </p>
            )}
            <button disabled={busy} onClick={() => search(true)}>
              Check against my calendar
            </button>
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
      </main>
    </div>
  );
}
