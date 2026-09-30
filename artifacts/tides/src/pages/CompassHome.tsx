import Action from "@/components/Action";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
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
  const upcoming = (plans.data ?? [])
    .filter((p) => !p.adHoc && Date.parse(p.endTime) > Date.now())
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
        {isError && (
          <p role="alert">
            The current reading could not load.{" "}
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
      <section
        className="compass-home-search"
        aria-labelledby="compass-request-title"
      >
        <h2 id="compass-request-title">What are you making time for?</h2>
        {children}
      </section>
      <section
        className="compass-upcoming"
        aria-labelledby="compass-plans-title"
      >
        <div className="compass-section-heading">
          <h2 id="compass-plans-title">On your calendar</h2>
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
