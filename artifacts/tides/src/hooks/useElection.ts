import { useQuery } from "@tanstack/react-query";

export interface ElectionCategorySummary {
  key: string;
  label: string;
  weight: "light" | "standard" | "heavy";
  description: string;
}

export interface ElectionRule {
  key: string;
  label: string;
  severity: "hard" | "soft" | "support";
  passed: boolean;
  detail: string;
  /** Which tradition asserts this rule. */
  source?: "classical" | "compass";
  /** Named dissent where practitioners genuinely differ — shown with the rule
   *  so a contested position never reads as settled fact. */
  dispute?: string;
}

export type ElectionVerdict = "strong" | "workable" | "caution" | "avoid";

export interface ElectionResult {
  date: string;
  windowStart: string;
  windowEnd: string;
  category: string;
  verdict: ElectionVerdict;
  rules: ElectionRule[];
  planetaryHour: string;
  planetaryHourMatch: boolean;
  summary: string;
  /** The ruleset that produced this verdict, stored with it. */
  ruleset?: string;
}

export interface ElectionScanResult {
  category: string;
  windows: ElectionResult[];
  hardBlock?: { rule: string; clearsOn: string | null };
}

function loc(lat: number, lon: number) {
  return `lat=${lat}&lon=${lon}`;
}

export function useElectionCategories() {
  return useQuery<{ categories: ElectionCategorySummary[] }>({
    queryKey: ["election-categories"],
    queryFn: async () => {
      const r = await fetch("/api/election/categories");
      return r.json();
    },
    staleTime: Infinity,
  });
}

export function useElectionScan(category: string | null, days: number, lat = 40.7, lon = -74.0) {
  return useQuery<ElectionScanResult>({
    queryKey: ["election-scan", category, days, lat, lon],
    queryFn: async () => {
      const r = await fetch(`/api/election/scan?category=${category}&days=${days}&${loc(lat, lon)}`);
      return r.json();
    },
    enabled: !!category,
  });
}
