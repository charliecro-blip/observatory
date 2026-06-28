import { useQuery } from "@tanstack/react-query";
import type { TidesNow, TidesWeek, ScoredPractice, PlanningWindow, SkyEvent } from "@/lib/types";

function authHeaders(testerId: string | null): Record<string, string> {
  return testerId ? { "x-tester-id": testerId } : {};
}

function loc(lat: number, lon: number) {
  return `lat=${lat}&lon=${lon}`;
}

export function useTidesNow(testerId: string | null, lat = 40.7, lon = -74.0) {
  return useQuery<TidesNow>({
    queryKey: ["tides-now", testerId, lat, lon],
    queryFn: async () => {
      const r = await fetch(`/api/tides/now?${loc(lat, lon)}`, { headers: authHeaders(testerId) });
      return r.json();
    },
    refetchInterval: 60_000,
  });
}

export function useTidesWeek(days = 7, lat = 40.7, lon = -74.0) {
  return useQuery<TidesWeek>({
    queryKey: ["tides-week", days, lat, lon],
    queryFn: async () => {
      const r = await fetch(`/api/tides/week?days=${days}&${loc(lat, lon)}`);
      return r.json();
    },
    refetchInterval: 300_000,
  });
}

export function useSkyEvents(days = 30, lat = 40.7, lon = -74.0) {
  return useQuery<{ events: SkyEvent[] }>({
    queryKey: ["sky-events", days, lat, lon],
    queryFn: async () => {
      const r = await fetch(`/api/tides/events?days=${days}&${loc(lat, lon)}`);
      return r.json();
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
