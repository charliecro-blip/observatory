import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Action from "@/components/Action";
import { useTester } from "@/contexts/tester-context";
import { timingIcal } from "@/lib/timingQuery";
import { invalidateWindows } from "@/lib/invalidateWindows";
import { logEvent } from "@/lib/analytics";

/** The shape /api/timing/report returns (api-server/src/lib/electionReport.ts). */
interface Pick {
  id: string; date: string; start: string; end: string; startClock: string; endClock: string;
  broad: boolean; tier: "good" | "great"; evidence: string[]; objections: string[]; personal: boolean;
  availability: "clear" | "conflict" | "unchecked" | "unavailable";
  alsoThatDay: { startClock: string; endClock: string }[];
  /** The search /timing/choose re-runs to save this window; null when it can't be chosen. */
  choice: Record<string, unknown> | null;
}
interface Report {
  status: "complete" | "partial" | "error" | "unsupported";
  activity: { key: string; label: string } | null;
  horizon: { days: number };
  motion: { planet: string; sentence: string | null }[];
  standing: string[];
  picks: Pick[];
  busyButStrong: Pick[];
  avoid: { date: string; reasons: string[] }[];
  afterClears: { from: string; planet: string; searchedDays: number; picks: Pick[] } | null;
  coverage: {
    scannedDays: number; failedChunks: number;
    chart: "applied" | "absent" | "birth-time-unknown";
    calendar: "checked" | "unchecked" | "not-connected" | "unavailable";
    withheld: { hourOnly: number; voidMoon: number };
  };
}

const dayLabel = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Saving a pick: the same /timing/choose Find a time uses, so the server re-checks it first. */
interface Saving {
  busyId: string | null;
  saved: Map<string, number>;
  error: { id: string; text: string } | null;
  save: (p: Pick) => void;
  download: (p: Pick) => void;
}

function PickRow({ p, calendarChecked, saving }: { p: Pick; calendarChecked: boolean; saving: Saving }) {
  const savedId = saving.saved.get(p.id);
  return (
    <li className="report-pick">
      <p className="report-when">
        <strong>{dayLabel(p.date)}</strong>, {p.broad ? "most of the day" : `${p.startClock} to ${p.endClock}`}
        {calendarChecked && p.availability === "clear" && <span className="report-open"> Open on your calendar.</span>}
        {p.availability === "conflict" && <span className="report-taken"> Taken on your calendar.</span>}
      </p>
      <ul className="report-evidence">
        {p.evidence.map((e, i) => <li key={i}>{e}</li>)}
      </ul>
      {/* The motion of the governing planet is said once, under Conditions;
          what is left here is particular to this time. */}
      {p.objections.filter((o) => !/ is (retrograde|stationing)/.test(o)).length > 0 && (
        <p className="report-against">Against it: {p.objections.filter((o) => !/ is (retrograde|stationing)/.test(o)).join("; ")}.</p>
      )}
      {p.alsoThatDay.length > 0 && (
        <p className="report-also">Also that day: {p.alsoThatDay.map((a) => `${a.startClock} to ${a.endClock}`).join(", ")}.</p>
      )}
      {p.choice && (savedId == null
        ? <Action variant="text" className="report-save" disabled={saving.busyId != null} onClick={() => saving.save(p)}>Save this time</Action>
        : <p className="report-saved" role="status">Saved to your Compass calendar. <Action variant="text" onClick={() => saving.download(p)}>Download calendar event</Action></p>)}
      {saving.error?.id === p.id && <p className="report-save-error" role="alert">{saving.error.text}</p>}
    </li>
  );
}

/**
 * The election report (plan Part A, phase 2): a longer span than one search
 * covers, with the person's chart and calendar. Every time on it comes from
 * the timing engine; this only lays it out. Gaps are printed, not hidden.
 */
export default function ElectionReportView({ activity, days, timeZone, onBack }: {
  activity: string; days: number; timeZone: string; onBack: () => void;
}) {
  const { profile, lat, lon, locationKnown } = useTester();
  const testerId = profile?.testerId ?? null;
  const qc = useQueryClient();
  const keys = useRef(new Map<string, string>());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saved, setSaved] = useState(new Map<string, number>());
  const [saveError, setSaveError] = useState<Saving["error"]>(null);
  const { data, isLoading, isError, refetch } = useQuery<Report>({
    queryKey: ["election-report", testerId, activity, days, timeZone, lat, lon],
    enabled: !!testerId && locationKnown,
    staleTime: 10 * 60_000,
    retry: false,
    queryFn: async () => {
      const post = (checkCalendar: boolean) => fetch("/api/timing/report", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tester-id": testerId! },
        body: JSON.stringify({ activity, days, timeZone, location: { lat, lon }, useNatal: true, checkCalendar }),
      });
      let r = await post(true);
      // A plan without calendar placement still gets the report, with the gap named.
      if (r.status === 402) r = await post(false);
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  if (!locationKnown)
    return <main className="timing-main report"><p>Set your location in Settings first. The times depend on where you are.</p><Action onClick={onBack}>Back</Action></main>;

  const title = data?.activity?.label ?? "Chosen time";
  async function save(p: Pick) {
    // One key per pick, so a retry after a dropped response finds the saved row.
    const choiceKey = keys.current.get(p.id) ?? crypto.randomUUID();
    keys.current.set(p.id, choiceKey);
    setBusyId(p.id);
    setSaveError(null);
    try {
      const r = await fetch("/api/timing/choose", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tester-id": testerId! },
        body: JSON.stringify({ query: p.choice, choiceKey, candidateId: p.id, title }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok || !body.window) {
        setSaveError({ id: p.id, text: body.error === "choice_needs_review"
          ? "Compass checked this time again before saving and it no longer fits, so nothing was saved. Reload the report to see the times that do."
          : "Compass couldn’t save this time; try again in a moment." });
        return;
      }
      setSaved((m) => new Map(m).set(p.id, body.window.id));
      invalidateWindows(qc);
      logEvent("timing_window_chosen", { source: "report", activity, windowId: body.window.id });
    } catch {
      setSaveError({ id: p.id, text: "Compass couldn’t save this time; try again in a moment." });
    } finally {
      setBusyId(null);
    }
  }
  function download(p: Pick) {
    const id = saved.get(p.id);
    if (id == null) return;
    const url = URL.createObjectURL(new Blob([timingIcal(id, title, p.start, p.end, new Date())], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "compass-time.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const saving: Saving = { busyId, saved, error: saveError, save, download };

  const c = data?.coverage;
  const calendarChecked = c?.calendar === "checked";
  return (
    <main className="timing-main report">
      <div className="report-head">
        <Action variant="text" onClick={onBack}>Back</Action>
        <h1>{data?.activity?.label ?? "Times"}, the next {days} days</h1>
      </div>
      {isLoading && <p role="status">Reading {days} days against your chart and calendar. This takes a few seconds.</p>}
      {isError && <p role="alert">The report didn’t load. <Action variant="text" onClick={() => refetch()}>Try again</Action></p>}
      {data?.status === "unsupported" && <p>Compass doesn’t have a timing match for that activity yet.</p>}
      {data && data.status !== "unsupported" && (
        <>
          {(data.motion.length > 0 || data.standing?.length > 0) && (
            <section>
              <h2>Conditions</h2>
              {data.motion.map((m) => <p key={m.planet}>{m.sentence}</p>)}
              {data.standing?.map((t) => <p key={t}>{t}</p>)}
            </section>
          )}
          <section>
            <h2>Best times</h2>
            {data.picks.length === 0
              ? <p>The engine found no open time in these {days} days.</p>
              : <ol className="report-list">{data.picks.map((p) => <PickRow key={p.id} p={p} calendarChecked={calendarChecked} saving={saving} />)}</ol>}
          </section>
          {data.busyButStrong.length > 0 && (
            <section>
              <h2>Strong times your calendar already holds</h2>
              <ol className="report-list">{data.busyButStrong.map((p) => <PickRow key={p.id} p={p} calendarChecked={calendarChecked} saving={saving} />)}</ol>
            </section>
          )}
          {data.afterClears && (
            <section>
              <h2>If it can wait</h2>
              <p>
                {data.afterClears.planet} turns direct on {dayLabel(data.afterClears.from)}.{" "}
                {data.afterClears.picks.length === 0
                  ? `The engine found no time in the ${data.afterClears.searchedDays} days after that.`
                  : `The best times in the ${data.afterClears.searchedDays} days after that, without a calendar check:`}
              </p>
              {data.afterClears.picks.length > 0 && <ol className="report-list">{data.afterClears.picks.map((p) => <PickRow key={p.id} p={p} calendarChecked={false} saving={saving} />)}</ol>}
            </section>
          )}
          {data.avoid.length > 0 && (
            <section>
              <h2>Days to leave alone</h2>
              <ul className="report-avoid">
                {data.avoid.map((a) => <li key={a.date}><strong>{dayLabel(a.date)}</strong> {a.reasons.join(" ")}</li>)}
              </ul>
            </section>
          )}
          <footer className="report-coverage">
            {c?.chart === "absent" && <p>Your chart wasn’t used because none is saved.</p>}
            {c?.chart === "birth-time-unknown" && <p>Your chart’s houses and angles weren’t used because the birth time is unknown.</p>}
            {c?.calendar === "unchecked" && <p>Your calendar wasn’t checked.</p>}
            {c?.calendar === "not-connected" && <p>Your calendar isn’t connected, so no time here is confirmed open.</p>}
            {c?.calendar === "unavailable" && <p>Your calendar couldn’t be read, so no time here is confirmed open.</p>}
            {!!c?.failedChunks && <p>{plural(c.failedChunks, "day", "days")} couldn’t be searched.</p>}
            {!!c?.withheld.voidMoon && <p>{plural(c.withheld.voidMoon, "day-long window", "day-long windows")} left out because the Moon is void for most of {c.withheld.voidMoon === 1 ? "it" : "them"}.</p>}
            {!!c?.withheld.hourOnly && <p>{plural(c.withheld.hourOnly, "matching hour isn’t", "matching hours aren’t")} listed on their own.</p>}
          </footer>
        </>
      )}
    </main>
  );
}
