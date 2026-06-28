import { useQuery } from "@tanstack/react-query";
import type { TidesNow, TidesWeek, ScoredPractice, PlanningWindow } from "@/lib/types";

function authHeaders(testerId: string | null) {
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

export function useTidesWeek() {
  return useQuery<TidesWeek>({
    queryKey: ["tides-week"],
    queryFn: async () => {
      const r = await fetch("/api/tides/week");
      return r.json();
    },
    refetchInterval: 300_000,
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
