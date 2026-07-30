/**
 * BearingsCard — "where you are in time", at the top of Aims.
 *
 * You steer from where you are: the profection year (theme + lord + the
 * year's power days), and the chapter (Saturn stage + next waypoint + the
 * renovations in progress). Dated landmarks, not analysis — a trail map's
 * "you are here", not a reading.
 */
import { useQuery } from "@tanstack/react-query";
import { PLANET_GLYPH } from "@/lib/glyphs";

interface Activation { date: string; label: string }
interface Fix {
  year: {
    age: number; house: number; sign: string; lord: string; theme: string;
    yearEnd: string; monthHouse: number; monthTheme: string;
    lordActivations: Activation[];
  };
  chapter: {
    saturnStage: string;
    nextWaypoint: { name: string; date: string } | null;
    renovations: { line: string; note: string }[];
  };
}

const ord = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) === n % 10 && n % 10 < 4 ? n % 10 : 0] ?? "th"}`;
const fmtDate = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fmtMonthYear = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

export default function BearingsCard({ testerId }: { testerId: string | null }) {
  const { data } = useQuery<{ available: boolean; reason?: string; fix?: Fix }>({
    queryKey: ["position-fix", testerId],
    queryFn: async () => {
      const r = await fetch("/api/position-fix", { headers: testerId ? { "x-tester-id": testerId } : {} });
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 6 * 3600 * 1000, // bearings change daily at most
  });

  if (!testerId || !data) return null;
  if (!data.available) {
    if (data.reason === "no-chart") return (
      <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "10px 16px", marginBottom: 14, fontSize: 11.5, color: "var(--text-3)" }}>
        Add your birth chart in Settings and this page opens with your bearings — the year you're in, its lord, and the chapter's landmarks.
      </div>
    );
    return null; // no birth time: profections would be a guess — stay quiet
  }
  const fix = data.fix!;
  const nextHit = fix.year.lordActivations[0];

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "14px 18px 12px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 9 }}>
        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "1.2px", color: "var(--text-3)", fontWeight: 600 }}>Your bearings</span>
        <span style={{ fontSize: 10, color: "var(--color-muted)" }}>year turns {fmtDate(fix.year.yearEnd)}</span>
      </div>

      {/* THIS YEAR */}
      <div style={{ display: "flex", gap: 9, alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 9.5, letterSpacing: "0.8px", color: "var(--color-muted)", flexShrink: 0, width: 76 }}>THIS YEAR</span>
        <div style={{ fontSize: 12.5, color: "var(--color-foreground)", lineHeight: 1.55 }}>
          an {ord(fix.year.house)}-house year — <b>{fix.year.theme.split(" — ")[0]}</b>
          <span style={{ color: "var(--color-muted)" }}> · {PLANET_GLYPH[fix.year.lord] ?? ""} {fix.year.lord} holds the year</span>
          {nextHit && (
            <span style={{ color: "#8a6a30" }}> · next power day {fmtDate(nextHit.date)} ({nextHit.label})</span>
          )}
        </div>
      </div>

      {/* THE CHAPTER */}
      <div style={{ display: "flex", gap: 9, alignItems: "baseline", marginBottom: fix.chapter.renovations.length ? 6 : 0 }}>
        <span style={{ fontSize: 9.5, letterSpacing: "0.8px", color: "var(--color-muted)", flexShrink: 0, width: 76 }}>THE CHAPTER</span>
        <div style={{ fontSize: 12.5, color: "var(--color-foreground)", lineHeight: 1.55 }}>
          {fix.chapter.saturnStage}
          {fix.chapter.nextWaypoint && (
            <span style={{ color: "var(--color-muted)" }}> · next waypoint: {fix.chapter.nextWaypoint.name}, {fmtMonthYear(fix.chapter.nextWaypoint.date)}</span>
          )}
        </div>
      </div>

      {/* RENOVATIONS */}
      {fix.chapter.renovations.length > 0 && (
        <div style={{ display: "flex", gap: 9, alignItems: "baseline" }}>
          <span style={{ fontSize: 9.5, letterSpacing: "0.8px", color: "var(--color-muted)", flexShrink: 0, width: 76 }}>IN PROGRESS</span>
          <div style={{ fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.6 }}>
            {fix.chapter.renovations.map((r, i) => (
              <span key={i} title={r.note}>{r.line}{i < fix.chapter.renovations.length - 1 ? " · " : ""}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
