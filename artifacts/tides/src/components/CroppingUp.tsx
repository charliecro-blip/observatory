// CROPPING UP — the fixed dates close enough ahead to steer around.
//
// Home's question is "how am I doing, and what's coming?", and until now the
// second half went unanswered: nothing on the page looked further ahead than
// the week strip. A Mercury station eight days out is exactly the thing a
// person wants to have seen before they commit the week, and it was reachable
// only by opening the almanac inside Plan.
//
// PANORAMIC MEANS BREADTH AT LOW RESOLUTION. This names what is coming and
// stops — no note, no interpretation, no advice. The almanac in Plan holds the
// full entry for every one of these, and the door at the bottom goes there.
// The moment this card starts explaining an eclipse it has become the place
// you read about eclipses, which is a tab, not a strip.
//
// Ordinary new and full moons are deliberately excluded. They arrive twice a
// month, so including them would fill every slot with the routine and push out
// the rare thing the card exists for — the same mistake the notice queue on
// Home already avoids by ordering on rarity. Eclipses come through the same
// `lunation` kind and DO qualify, which is why the filter reads the `eclipse`
// flag rather than the kind alone.

import { useQuery } from "@tanstack/react-query";
import type { AlmanacEntry } from "./Almanac";

/** How far out to look. Long enough to catch a station or an ingress, short
 *  enough that everything here is close enough to plan against. */
const HORIZON_DAYS = 45;
const MAX_ROWS = 4;

/**
 * Whole days between today and a date, in the VIEWER's calendar.
 *
 * Not `(then - now) / 86400000`. That measures elapsed time, so an event at
 * 9am tomorrow reads as 0 days away at 4pm today and would be labelled "today"
 * — the one label that has to be right. Both instants are floored to local
 * midnight first, which is also what makes this survive a DST boundary.
 */
function daysAway(iso: string, now: Date): number {
  const then = new Date(iso);
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const b = new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

function whenPhrase(iso: string, now: Date): string {
  const d = daysAway(iso, now);
  if (d <= 0) return "today";
  if (d === 1) return "tomorrow";
  if (d < 7) return new Date(iso).toLocaleDateString("en-US", { weekday: "long" });
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function CroppingUp({ onNavigate }: { onNavigate?: (v: string) => void }) {
  const { data, isPending, isError } = useQuery<{ entries: AlmanacEntry[] }>({
    queryKey: ["almanac", HORIZON_DAYS],
    queryFn: async () => {
      const r = await fetch(`/api/tides/almanac?days=${HORIZON_DAYS}`);
      if (!r.ok) throw new Error("almanac unavailable");
      return r.json();
    },
    staleTime: 6 * 60 * 60 * 1000,
  });

  const now = new Date();
  const entries = (data?.entries ?? [])
    .filter((e) => e.eclipse || e.kind === "station" || e.kind === "ingress")
    .slice(0, MAX_ROWS);

  // Nothing to say and nothing wrong: the card stands down rather than
  // printing a reassurance. A quiet forty-five days is real, but a panel
  // announcing its own emptiness is how a dashboard starts filling up with
  // sentences about the absence of content.
  if (!isError && !isPending && entries.length === 0) return null;

  return (
    <div style={{
      background: "var(--color-card)", border: "1px solid var(--color-border)",
      borderRadius: 12, flexShrink: 0,
    }}>
      <div style={{ padding: "11px 16px 6px" }}>
        <div style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: "0.9px", textTransform: "uppercase",
          color: "var(--text-3)",
        }}>Cropping up</div>
      </div>

      {isPending && (
        <div style={{ padding: "0 16px 13px", fontSize: 11.5, color: "var(--text-3)" }}>
          Reading the ephemeris…
        </div>
      )}

      {/* A failed fetch says so. An empty list in its place would report a
          quiet six weeks that nobody has actually looked at. */}
      {isError && (
        <div style={{ padding: "0 16px 13px", fontSize: 11.5, color: "var(--color-muted)", lineHeight: 1.5 }}>
          The almanac didn't load, so nothing ahead has been checked.
        </div>
      )}

      {entries.map((e) => (
        <div key={e.at + e.title} style={{
          display: "flex", gap: 10, alignItems: "baseline",
          padding: "7px 16px", borderTop: "1px solid var(--color-border)",
        }}>
          <span aria-hidden="true" style={{
            fontSize: 12, width: 15, flexShrink: 0, textAlign: "center",
            color: e.eclipse ? "var(--color-primary)" : "var(--text-3)",
          }}>{e.glyph}</span>
          <span style={{
            fontSize: 12.5, flex: 1, minWidth: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            fontWeight: e.eclipse || e.kind === "station" ? 600 : 400,
            color: "var(--color-foreground)",
          }}>{e.title}</span>
          <span style={{ fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>
            {whenPhrase(e.at, now)}
          </span>
        </div>
      ))}

      {onNavigate && (
        <div style={{ padding: "8px 16px 12px", borderTop: "1px solid var(--color-border)" }}>
          <button onClick={() => onNavigate("launch")} style={{
            fontSize: 11, background: "none", border: "none", padding: 0, cursor: "pointer",
            color: "var(--color-primary)",
          }}>Open Plan →</button>
        </div>
      )}
    </div>
  );
}
