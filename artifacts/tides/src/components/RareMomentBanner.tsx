// "Today is one of the good ones" — the across-every-category notice.
//
// The engine behind it (lib/rareWindows.rareToday) is strict on purpose:
// an activity has to sit in the top 1% of a two-year horizon AND today has
// to be the crest of its own stretch, so a fortnight of Venus in Libra
// produces one notice rather than fourteen. Measured fire rate: about
// fourteen days a year, never on consecutive days.
//
// On every other day this renders nothing at all. That silence is the
// feature — it is what makes the notice worth reading on the days it comes.

import { useQuery } from "@tanstack/react-query";
import { ELEMENT_COLORS } from "@/lib/elements";

const ACCENT = ELEMENT_COLORS.air; // the brass of the instrument, not an alarm

interface Hit {
  activityKey: string;
  activityLabel: string;
  category: string;
  percentile: number;
  reasons: string[];
  against: string[];
}

export default function RareMomentBanner({ suppressed, onNavigate }: {
  /** True when a rarer banner (a turning point) holds the slot today. */
  suppressed?: boolean;
  onNavigate?: (v: string) => void;
}) {
  const tzOffset = new Date().getTimezoneOffset();
  const { data } = useQuery<{ date: string; hits: Hit[] }>({
    queryKey: ["rare-today", tzOffset],
    queryFn: async () => (await fetch(`/api/elections/rare-today?tz=${tzOffset}`)).json(),
    // The answer changes once a day and costs a two-year scan to produce.
    staleTime: 1000 * 60 * 60 * 6,
    enabled: !suppressed,
  });

  const hits = data?.hits ?? [];
  if (suppressed || !hits.length) return null;

  const lead = hits[0];
  const others = hits.slice(1);

  return (
    <div style={{
      background: "var(--color-card)", border: "1px solid var(--color-border)",
      borderLeft: `3px solid ${ACCENT}`, borderRadius: 12, padding: "11px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)" }}>
          A rare one · top {Math.max(0.1, Math.round((100 - lead.percentile) * 10) / 10)}% of two years
        </span>
        {onNavigate && (
          <button onClick={() => onNavigate("launch")} style={{
            fontSize: 10.5, background: "none", border: "none", padding: 0,
            cursor: "pointer", color: "var(--color-primary)",
          }}>find a time <span aria-hidden="true">→</span></button>
        )}
      </div>

      <div style={{ fontSize: 13.5, color: "var(--color-foreground)", marginTop: 4, lineHeight: 1.45 }}>
        Today is an unusually good day for <b style={{ fontWeight: 600 }}>{lead.activityLabel.toLowerCase()}</b>
        {others.length > 0 && (
          <span style={{ color: "var(--color-muted)" }}>
            {" — and for "}{others.map((h) => h.activityLabel.toLowerCase()).join(", ")}
          </span>
        )}
        .
      </div>

      {/* The reasons, so the claim can be checked rather than believed. */}
      {lead.reasons.length > 0 && (
        <div style={{ fontSize: 10.5, color: "var(--color-muted)", marginTop: 4 }}>
          {lead.reasons.join(" · ")}
        </div>
      )}
      {/* And the objection, when there is one. A rare day is not a perfect
          one, and hiding what stands against it would be the endorsement
          language the copy rules forbid. */}
      {lead.against.length > 0 && (
        <div style={{ fontSize: 10.5, color: "#8a7a50", marginTop: 2 }}>
          against: {lead.against.join(" · ")}
        </div>
      )}
    </div>
  );
}
