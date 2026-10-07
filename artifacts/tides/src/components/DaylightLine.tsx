import type React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetchJson";
import { useTimeFormat } from "@/contexts/preferences-context";
import { useTester } from "@/contexts/tester-context";

interface Daylight {
  date: string;
  polar: "day" | "night" | null;
  sunrise: string | null;
  solarNoon: string | null;
  sunset: string | null;
}

/**
 * The Sun's day for a civil date, from the server (one computation for every
 * surface that prints it; the browser's own approximation ran up to 3.3
 * minutes off). A day's light does not change, so one fetch is enough.
 */
export function useDaylight(dateStr: string, lat: number, lon: number, enabled = true) {
  return useQuery<Daylight>({
    queryKey: ["daylight", dateStr, lat, lon],
    queryFn: () => fetchJson<Daylight>(`/api/tides/daylight?date=${dateStr}&lat=${lat}&lon=${lon}`),
    enabled,
    staleTime: Infinity,
  });
}

/**
 * "Sunrise 7:26 AM, solar noon 1:17 PM, sunset 7:13 PM." Plain facts, so it
 * shows at every level of astrological detail. Renders nothing while loading
 * or when the location is a guess: a time for the wrong place is worse than
 * none. A failed load says so rather than looking like a day without light.
 */
export function DaylightLine({ dateStr, className, style }: { dateStr: string; className?: string; style?: React.CSSProperties }) {
  const { lat, lon, locationKnown } = useTester();
  const fmtTime = useTimeFormat();
  const { data, isError } = useDaylight(dateStr, lat, lon, locationKnown);
  if (!locationKnown) return null;
  if (isError) return <p className={className} style={style} role="status">The sunrise and sunset times didn’t load.</p>;
  if (!data) return null;
  if (data.polar)
    return <p className={className} style={style}>{data.polar === "day" ? "The Sun stays up all day here." : "The Sun stays below the horizon all day here."}</p>;
  return (
    <p className={className} style={style}>
      Sunrise {fmtTime(new Date(data.sunrise!))}, solar noon {fmtTime(new Date(data.solarNoon!))}, sunset {fmtTime(new Date(data.sunset!))}.
    </p>
  );
}

/**
 * Sunrise, solar noon and sunset as marks on an hour grid (the Day view), from
 * the same server source as the line above. Positioned by the browser's clock,
 * as everything else on that grid is. Same gating: nothing for a guessed place.
 */
export function DaylightMarks({ dateStr, hourStart, hours, rowH, left }: {
  dateStr: string; hourStart: number; hours: number; rowH: number; left: number;
}) {
  const { lat, lon, locationKnown } = useTester();
  const fmtTime = useTimeFormat();
  const { data } = useDaylight(dateStr, lat, lon, locationKnown);
  if (!locationKnown || !data || data.polar) return null;
  const marks: [string, string][] = [];
  for (const [label, at] of [["Sunrise", data.sunrise], ["Solar noon", data.solarNoon], ["Sunset", data.sunset]] as const)
    if (at) marks.push([label, at]);
  return (
    <>
      {marks.map(([label, at]) => {
        const d = new Date(at);
        const top = (d.getHours() + d.getMinutes() / 60 - hourStart) * rowH;
        if (top < 0 || top > hours * rowH) return null;
        return (
          <div key={label} className="daylight-mark" style={{ top, left }}>
            <span>{label} {fmtTime(d)}</span>
          </div>
        );
      })}
    </>
  );
}
