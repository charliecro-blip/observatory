import Action from "@/components/Action";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetchJson";
import { localToday } from "@/lib/dates";
import Planner from "@/components/Planner";
import { useTester } from "@/contexts/tester-context";
import { useTidesNow } from "@/hooks/useTides";
import LunationArc from "@/components/LunationArc";
import TideStrip from "@/components/TideStrip";

type Plan = {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  adHoc: boolean;
};

type Practice = {
  id: number;
  name: string;
  emoji: string | null;
  cadence: string;
  doneToday: boolean;
  countToday: number;
  targetPerDay: number | null;
};

/**
 * Today's practices, one tap each.
 *
 * Measured on the owner's own account (Aug 2026): the habits that lasted were
 * practices (mantras 22 days, qigong 12), and ticking them was the most
 * repeated thing they did in the app. The new Home dropped them entirely, so
 * the one daily act had moved two screens away. Renders nothing for someone
 * with no habits: a newcomer should not meet an empty productivity module.
 */
function TodaysPractices({ testerId, lat, lon }: { testerId: string; lat: number; lon: number }) {
  const qc = useQueryClient();
  const today = localToday();
  const headers = { "x-tester-id": testerId };
  const practices = useQuery<Practice[]>({
    queryKey: ["habits", testerId, today, lat, lon, "home"],
    queryFn: () => fetchJson<Practice[]>(`/api/habits?today=${today}&lat=${lat}&lon=${lon}`, { headers }),
  });
  const toggle = useMutation({
    mutationFn: async (p: Practice) => {
      // A `several` practice counts up until its target is met; a tap on a
      // met one takes the latest tick back, same as the Habits page.
      const r = p.doneToday
        ? await fetch(`/api/habits/${p.id}/log?date=${today}`, { method: "DELETE", headers })
        : await fetch(`/api/habits/${p.id}/log`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ date: today }),
          });
      if (!r.ok) throw new Error("not saved");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["calendar-habits"] });
    },
  });
  if (practices.isLoading) return null;
  if (practices.isError) {
    return (
      <section className="compass-practices" aria-labelledby="compass-practices-title">
        <h2 id="compass-practices-title">Today’s practices</h2>
        <p role="alert">
          Your practices couldn’t load.{" "}
          <Action onClick={() => practices.refetch()}>Try again</Action>
        </p>
      </section>
    );
  }
  const list = practices.data ?? [];
  if (list.length === 0) return null;
  // Still to do first, so the row reads as what is left rather than a ledger.
  const ordered = [...list].sort((a, b) => Number(a.doneToday) - Number(b.doneToday));
  return (
    <section className="compass-practices" aria-labelledby="compass-practices-title">
      <h2 id="compass-practices-title">Today’s practices</h2>
      <ul>
        {ordered.map((p) => {
          const pending = toggle.isPending && toggle.variables?.id === p.id;
          const several = p.cadence === "several" && p.targetPerDay;
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={p.doneToday}
                disabled={pending}
                onClick={() => toggle.mutate(p)}
                aria-label={`${p.doneToday ? "Unmark" : "Mark"} ${p.name} for today`}
              >
                <span className="compass-practice-mark" aria-hidden="true">{p.doneToday ? "✓" : ""}</span>
                <span className="compass-practice-name">{p.emoji ? `${p.emoji} ` : ""}{p.name}</span>
                {several && <span className="compass-practice-count">{p.countToday} of {p.targetPerDay}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {toggle.isError && <p role="alert">That didn’t save. Tap it again to retry.</p>}
    </section>
  );
}

/** A small orientation surface, using the existing reading and calendar records. */
export default function CompassHome({
  children,
  onCalendar,
  onNow,
}: {
  children: ReactNode;
  onCalendar: () => void;
  onNow: () => void;
}) {
  const { profile, lat, lon } = useTester();
  const testerId = profile?.testerId ?? null;
  const {
    data: now,
    isLoading,
    isError,
    refetch,
    dataUpdatedAt,
  } = useTidesNow(testerId, lat, lon);
  const plans = useQuery<Plan[]>({
    queryKey: ["timing-saved", testerId],
    queryFn: async () => {
      const r = await fetch("/api/planning/windows", {
        headers: { "x-tester-id": testerId! },
      });
      if (!r.ok) throw new Error("Calendar unavailable");
      return r.json();
    },
    enabled: !!testerId,
  });
  const chosen = (plans.data ?? []).filter((p) => !p.adHoc);
  const upcoming = chosen
    .filter((p) => Date.parse(p.endTime) > Date.now())
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))
    .slice(0, 3);
  return (
    <>
      <section className="compass-orientation" aria-label="Today">
        <div className="compass-home-heading">
          <div>
            <p className="timing-kicker">Your day</p>
            <h1>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h1>
          </div>

        </div>
        {isLoading && <p role="status">Reading the current sky…</p>}
        {/* A failed refetch keeps the last good reading on screen. Say how old
            it is, so a reading from hours ago is not taken for the present. */}
        {isError && (
          <p role="alert">
            {now && dataUpdatedAt
              ? `Showing the reading from ${new Date(dataUpdatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} because the latest one didn’t load.`
              : "The current reading could not load."}{" "}
            <Action onClick={() => refetch()}>Try again</Action>
          </p>
        )}
        {now && (
          <>
            <TideStrip now={now} minimal={true} hideHeading />
            <div className="compass-reading-footer">
              <LunationArc cycle={now.moonCycle} compact />
              <Action variant="text" onClick={onNow}>Current reading</Action>
            </div>
          </>
        )}
      </section>
      {testerId && <TodaysPractices testerId={testerId} lat={lat} lon={lon} />}
      <section
        className="compass-home-search"
        aria-labelledby="compass-request-title"
      >
        <h2 id="compass-request-title">What are you making time for?</h2>
        {children}
      </section>
      {/* Several things at once. The week that worked (owner, Aug 14) was a
          list of seven, placed by the weaver in one go and six of them done;
          the request box above answers one activity at a time. Same Planner
          as the Plan tab, so a draft started in either place is the same
          draft. */}
      <section className="compass-plan-several" aria-labelledby="compass-plan-title">
        <h2 id="compass-plan-title">Plan a few things</h2>
        <p>Write one thing per line and Compass will suggest a time for each, without saving anything until you keep it.</p>
        <Planner testerId={testerId} lat={lat} lon={lon} embedded />
      </section>
      <section
        className="compass-upcoming"
        aria-labelledby="compass-plans-title"
      >
        <div className="compass-section-heading">
          {/* Planning windows only; Google events live in Calendar. The old
              heading promised the whole calendar and showed a slice of it. */}
          <h2 id="compass-plans-title">Times you’ve chosen</h2>
          <Action variant="text" onClick={onCalendar}>Open calendar</Action>
        </div>
        {plans.isLoading ? (
          <p role="status">Loading your plans…</p>
        ) : plans.isError ? (
          <p role="alert">
            Your plans could not load.{" "}
            <Action onClick={() => plans.refetch()}>Try again</Action>
          </p>
        ) : upcoming.length ? (
          <ol>
            {upcoming.map((p) => (
              <li key={p.id}>
                <time dateTime={p.startTime}>
                  {new Date(p.startTime).toLocaleString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
                <strong>{p.title}</strong>
              </li>
            ))}
          </ol>
        ) : chosen.length > 0 ? (
          <p>No times chosen for the days ahead.</p>
        ) : (
          <p>
            You haven’t chosen a time in Compass yet. Find an opening above, or
            open Calendar to see your schedule and connection options.
          </p>
        )}
      </section>
    </>
  );
}
