import { useQuery } from "@tanstack/react-query";
import type { TidesNow, TidesWeek, ScoredPractice, PlanningWindow, SkyEvent } from "@/lib/types";

function authHeaders(testerId: string | null): Record<string, string> {
  return testerId ? { "x-tester-id": testerId } : {};
}

export function useTidesNow(testerId: string | null) {
  return useQuery<TidesNow>({
    queryKey: ["tides-now", testerId],
    queryFn: async () => {
      const r = await fetch("/api/tides/now", { headers: authHeaders(testerId) });
      return r.json();
    },
    refetchInterval: 60_000,
  });
}

export function useTidesWeek(days = 7) {
  return useQuery<TidesWeek>({
    queryKey: ["tides-week", days],
    queryFn: async () => {
      const r = await fetch(`/api/tides/week?days=${days}`);
      return r.json();
    },
    refetchInterval: 300_000,
  });
}

export function useSkyEvents(days = 30) {
  return useQuery<{ events: SkyEvent[] }>({
    queryKey: ["sky-events", days],
    queryFn: async () => {
      const r = await fetch(`/api/tides/events?days=${days}`);
      return r.json();
    },
    refetchInterval: 3_600_000, // hourly — events don't change fast
  });
}

export function usePractices(testerId: string | null) {
  return useQuery<{ practices: ScoredPractice[] }>({
    queryKey: ["tides-practices", testerId],
    queryFn: async () => {
      const r = await fetch("/api/tides/practices", { headers: authHeaders(testerId) });
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
