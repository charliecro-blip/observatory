import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/fetchJson";
import { localDayRange } from "@/lib/dates";
import { PLANET_GLYPH } from "@/lib/glyphs";
import { PLANET_COLORS } from "@/lib/planetColors";
import { useTimeFormat } from "@/contexts/preferences-context";
import type { Perfection } from "@/lib/types";

/**
 * WHEN THE DAY'S ASPECTS PERFECT, TO THE MINUTE.
 *
 * One source for every surface that names an aspect's exact time on a given
 * day (Day view, the Month day panel, Agenda), so they cannot disagree the way
 * the hourly events feed and the rail once did (owner 2026-09-30: "on the day
 * view, i want to see when lunar/planetary aspects are perfecting").
 */
export function usePerfections(dateStr: string, enabled = true) {
  return useQuery<Perfection[]>({
    queryKey: ["perfections", dateStr],
    queryFn: async () => {
      const { from, to } = localDayRange(dateStr);
      const r = await fetchJson<{ perfections: Perfection[] }>(
        `/api/tides/perfections?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      return r.perfections;
    },
    enabled,
    // The sky of a given day does not change; one fetch per day is enough.
    staleTime: Infinity,
  });
}

export const ASPECT_SYMBOL: Record<string, string> = {
  conjunction: "☌", sextile: "⚹", square: "□", trine: "△", opposition: "☍",
};

/** Harmonious, hard, or blending: the colour the rest of the calendar uses. */
export function aspectColor(aspect: string): string {
  if (aspect === "trine" || aspect === "sextile") return "#3a6020";
  if (aspect === "square" || aspect === "opposition") return "#a05020";
  return "#60708a";
}

export function perfectionGlyphs(p: Perfection): string {
  return `${PLANET_GLYPH[p.body1] ?? p.body1}${ASPECT_SYMBOL[p.aspect] ?? ""}${PLANET_GLYPH[p.body2] ?? p.body2}`;
}

/** "Moon sextile Mars", the plain words for the glyphs. */
export function perfectionWords(p: Perfection): string {
  return `${p.body1} ${p.aspect} ${p.body2}`;
}

/**
 * The day's exact aspects as a list. Renders nothing while loading or when the
 * day has none, since a day without a perfection is ordinary and needs no
 * sentence; a failed load says so rather than looking like an empty day.
 */
export function ExactList({ dateStr, title = "Exact today", compact = false }: {
  dateStr: string; title?: string; compact?: boolean;
}) {
  const fmtTime = useTimeFormat();
  const { data, isError, refetch } = usePerfections(dateStr);
  if (isError) {
    return (
      <div role="alert" style={{ fontSize: 12, color: "var(--text-2)" }}>
        The day’s exact aspects didn’t load.{" "}
        <button onClick={() => refetch()} style={{ fontSize: 12, background: "none", border: "none", padding: 0, color: "var(--color-primary)", cursor: "pointer" }}>Try again</button>
      </div>
    );
  }
  if (!data?.length) return null;
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 4 }}>{title}</div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {data.map((p) => (
          <li key={`${p.at}${p.body1}${p.body2}`} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: compact ? "3px 0" : "5px 0", borderTop: "1px solid var(--color-border)" }}>
            <span aria-hidden="true" style={{ fontFamily: "var(--font-symbol)", color: aspectColor(p.aspect), minWidth: 34 }}>
              <span style={{ color: PLANET_COLORS[p.body1] }}>{PLANET_GLYPH[p.body1]}</span>
              {ASPECT_SYMBOL[p.aspect]}
              <span style={{ color: PLANET_COLORS[p.body2] }}>{PLANET_GLYPH[p.body2]}</span>
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--color-foreground)" }}>{perfectionWords(p)}</span>
            <span style={{ fontSize: 12, color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>{fmtTime(new Date(p.at))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
