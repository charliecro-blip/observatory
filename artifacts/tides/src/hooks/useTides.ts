import { useQuery } from "@tanstack/react-query";
import type { TidesNow, TidesWeek, ScoredPractice, PlanningWindow, SkyEvent } from "@/lib/types";

function authHeaders(testerId: string | null): Record<string, string> {
  return testerId ? { "x-tester-id": testerId } : {};
}

function loc(lat: number, lon: number) {
  return `lat=${lat}&lon=${lon}`;
}

// Browser timezone offset in minutes (Date.getTimezoneOffset convention: minutes to
// ADD to local time to reach UTC — e.g. +300 for US Central). Sent to endpoints that
// compute a whole local-day window server-side, so they use the viewer's day, not UTC.
function tzParam() {
  return `tz=${new Date().getTimezoneOffset()}`;
}

export function useNorthStars(testerId: string | null) {
  return useQuery<any[]>({
    queryKey: ["north-stars", testerId],
    queryFn: async () => {
      const r = await fetch("/api/planning/north-stars", { headers: authHeaders(testerId) });
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 30_000,
  });
}

export function useCurrents(testerId: string | null, houseSystem: string) {
  return useQuery<any>({
    queryKey: ["currents", testerId, houseSystem],
    queryFn: async () => {
      const r = await fetch(`/api/currents?houseSystem=${encodeURIComponent(houseSystem)}`, { headers: authHeaders(testerId) });
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 3600_000,
  });
}

export function useTidesNow(testerId: string | null, lat = 40.7, lon = -74.0) {
  return useQuery<TidesNow>({
    queryKey: ["tides-now", testerId, lat, lon],
    queryFn: async () => {
      const r = await fetch(`/api/tides/now?${loc(lat, lon)}&${tzParam()}`, { headers: authHeaders(testerId) });
      return r.json();
    },
    refetchInterval: 60_000,
  });
}

// Localize a UTC "HH:MM" fallback via the `at` instant, in the viewer's timezone.
function localizeClock(at: string | undefined, fallback: string): string {
  if (!at) return fallback;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return fallback;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function useTidesWeek(days = 7, lat = 40.7, lon = -74.0) {
  return useQuery<TidesWeek>({
    queryKey: ["tides-week", days, lat, lon],
    queryFn: async () => {
      const r = await fetch(`/api/tides/week?days=${days}&${loc(lat, lon)}`);
      const data: TidesWeek = await r.json();
      for (const day of data.days ?? []) {
        if (day.crossings) {
          day.crossings = day.crossings.map(c => ({ ...c, time: localizeClock(c.at, c.time) }));
        }
      }
      return data;
    },
    refetchInterval: 300_000,
  });
}

// Server sends timed events with an `at` ISO-UTC instant. Localize date/time to the
// viewer's own timezone here, so every downstream consumer's string-based date/time
// logic stays correct regardless of the server's timezone (UTC on Railway).
function localizeSkyEvent(e: SkyEvent): SkyEvent {
  if (!e.at) return e;
  const d = new Date(e.at);
  if (Number.isNaN(d.getTime())) return e;
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { ...e, date, time };
}

export function useSkyEvents(days = 30, lat = 40.7, lon = -74.0) {
  return useQuery<{ events: SkyEvent[] }>({
    queryKey: ["sky-events", days, lat, lon],
    queryFn: async () => {
      const r = await fetch(`/api/tides/events?days=${days}&${loc(lat, lon)}`);
      const data: { events: SkyEvent[] } = await r.json();
      return { events: (data.events ?? []).map(localizeSkyEvent) };
    },
    refetchInterval: 3_600_000,
  });
}

export function usePractices(testerId: string | null, lat = 40.7, lon = -74.0) {
  return useQuery<{ practices: ScoredPractice[] }>({
    queryKey: ["tides-practices", testerId, lat, lon],
    queryFn: async () => {
      const r = await fetch(`/api/tides/practices?${loc(lat, lon)}`, { headers: authHeaders(testerId) });
      return r.json();
    },
    refetchInterval: 60_000,
  });
}

export function useTodayWindows(testerId: string | null, date: string) {
  return useQuery<PlanningWindow[]>({
    queryKey: ["planning-windows", testerId, date],
    queryFn: async () => {
      const r = await fetch(`/api/planning/windows?date=${date}`, { headers: authHeaders(testerId) });
      return r.json();
    },
    enabled: !!testerId,
    refetchInterval: 120_000,
  });
}

export interface GCalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string | null;
  htmlLink: string;
  location?: string;
  description?: string;
  organizer?: string;
  calendarName?: string;
}

export function useGCalStatus(testerId: string | null) {
  return useQuery<{ connected: boolean; email?: string; configured?: boolean }>({
    queryKey: ["gcal-status", testerId],
    queryFn: async () => {
      const r = await fetch("/api/integrations/google-cal/status", { headers: authHeaders(testerId) });
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 30_000,
  });
}

export function useGCalEvents(testerId: string | null, start: string, end: string, enabled: boolean) {
  return useQuery<{ events: GCalEvent[] }>({
    queryKey: ["gcal-events", testerId, start, end],
    queryFn: async () => {
      const r = await fetch(
        `/api/integrations/google-cal/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
        { headers: authHeaders(testerId) }
      );
      return r.json();
    },
    enabled: !!testerId && enabled,
    staleTime: 300_000,
    refetchInterval: 600_000,
  });
}

export function useTidesWindows(lat = 40.7, lon = -74.0) {
  return useQuery<{ windows: Array<{ startTime: string; endTime: string; element: string; voidOfCourse: boolean; planetaryHour: string; quality: string }> }>({
    queryKey: ["tides-windows", lat, lon],
    queryFn: async () => {
      const r = await fetch(`/api/tides/windows?hours=18&${loc(lat, lon)}`);
      return r.json();
    },
    refetchInterval: 1_800_000,
  });
}
