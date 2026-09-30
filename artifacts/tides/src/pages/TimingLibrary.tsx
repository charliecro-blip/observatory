import Action from "@/components/Action";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { timingIcal } from "@/lib/timingQuery";

type SavedTime = {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  completedAt: string | null;
  adHoc: boolean;
};

export default function TimingLibrary({
  testerId,
  timeZone,
  onSearch,
}: {
  testerId: string;
  timeZone: string;
  onSearch: () => void;
}) {
  const [past, setPast] = useState(false);
  const [exported, setExported] = useState<number | null>(null);
  const { data, isLoading, isError, refetch } = useQuery<SavedTime[]>({
    queryKey: ["timing-saved", testerId],
    queryFn: async () => {
      const response = await fetch("/api/planning/windows", {
        headers: { "x-tester-id": testerId },
      });
      if (!response.ok) throw new Error("Saved times unavailable");
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error("Invalid saved times");
      return rows;
    },
  });
  const now = Date.now();
  const times = (data ?? []).filter(
    (w) =>
      !w.adHoc &&
      (past ? Date.parse(w.endTime) <= now : Date.parse(w.endTime) > now),
  );
  times.sort((a, b) => (past ? -1 : 1) * (Date.parse(a.startTime) - Date.parse(b.startTime)));
  const format = (date: string) =>
    new Date(date).toLocaleString("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  function download(w: SavedTime) {
    const url = URL.createObjectURL(
      new Blob(
        [timingIcal(w.id, w.title, w.startTime, w.endTime, new Date())],
        { type: "text/calendar;charset=utf-8" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "compass-time.ics";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(w.id);
  }
  return (
    <main className="timing-main timing-secondary">
      
      <h1>Saved times</h1>
      <p>
        Times you chose in Compass and blocks from your workspace calendar. All
        times are shown in {timeZone}.
      </p>
      <div className="timing-library-toolbar">
        <div className="compass-segments" role="group" aria-label="Saved times period">
          <Action aria-pressed={!past} onClick={() => setPast(false)}>
            Upcoming
          </Action>
          <Action aria-pressed={past} onClick={() => setPast(true)}>
            Past
          </Action>
        </div>
        <Action onClick={onSearch}>Find another time</Action>
      </div>
      {isLoading && <p role="status">Loading saved times…</p>}
      {isError && (
        <div role="alert">
          <p>Your saved times could not load.</p>
          <Action onClick={() => void refetch()}>Try again</Action>
        </div>
      )}
      {!isLoading && !isError && !times.length && (
        <div className="timing-empty">
          <h2>{past ? "No past times yet" : "No upcoming times saved"}</h2>
          <p>{past ? "Your saved times will move here after they end." : "Choose an opening from a search and it will appear here."}</p>
        </div>
      )}
      <div className="timing-library-list">
        {times.map((w) => (
          <article key={w.id}>
            <div>
              <h2>{w.title}</h2>
              <p>
                {format(w.startTime)} to {format(w.endTime)}
              </p>
              {w.completedAt && <small>Marked complete in Workspace</small>}
            </div>
            <Action onClick={() => download(w)}>Download calendar event</Action>
            {exported === w.id && (
              <p role="status">
                Calendar file offered for download. Import it into your calendar
                to add the event.
              </p>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
