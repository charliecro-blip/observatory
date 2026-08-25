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
import { useFold, FoldToggle } from "@/components/ModuleFold";

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



export default function CroppingUp({ testerId, onNavigate, water }: {
  testerId?: string | null;
  onNavigate?: (v: string) => void;
  /** The fortnight's shape, drawn inside this card rather than beside it —
   *  "cropping up and the water ahead should be shown in one breath" (owner,
   *  2026-08-19). Two cards asking "what's coming" made the reader answer the
   *  question twice: the dates ahead, then the shape of the days they land
   *  in, are one look at the horizon. */
  water?: React.ReactNode;
}) {
  const folded = useFold().isFolded("croppingUp");
  // THE NON-LUNAR ASPECTS (owner, 2026-08-19). The card looked ahead at
  // stations, ingresses and eclipses and never at planet-to-planet aspects —
  // the fortnight-scale weather between them.
  //
  // Read from the SAME engine the sprint suggester uses, so the horizon card
  // and the suggestion can never disagree about what is coming. The Moon is
  // excluded there by construction, which is exactly right here too: a lunar
  // aspect lasts hours and this card's whole claim is "close enough ahead to
  // steer around".
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
  const fixed = (data?.entries ?? [])
    .filter((e) => e.eclipse || e.kind === "station" || e.kind === "ingress");

  // ONE SOURCE. These came from /transits/spans and were stitched onto the
  // almanac's entries here; both endpoints dated the same facts the same way,
  // and this card was the place that had to remember to combine them. The
  // spans are folded in at the source now, so the aspects arrive in the same
  // list as the eclipses.
  //
  // The card's own question is unchanged: what is COMING, so a pair already in
  // force is not news. `active` still carries that, it just arrives here
  // rather than being computed from a second response.
  const aspectRows = (data?.entries ?? [])
    .filter((e) => e.kind === "aspect" && !e.active)
    .map((e) => ({
      at: e.startDate ? `${e.startDate}T12:00:00` : e.at,
      glyph: "✦",
      title: e.title,
      eclipse: false,
      kind: "aspect" as const,
      key: `${e.title}-${e.startDate ?? e.at}`,
    }));

  // Interleaved by date and capped together, so a busy fortnight of aspects
  // cannot push the eclipse off the card — the rarity ordering this card was
  // built on still decides what survives the cap.
  const entries = [...fixed, ...aspectRows]
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .sort((a, b) => Number(!!b.eclipse) - Number(!!a.eclipse))
    .slice(0, MAX_ROWS)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

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
      <div style={{ padding: folded ? "11px 16px" : "11px 16px 6px", display: "flex", alignItems: "baseline", gap: 8 }}>
        <FoldToggle id="croppingUp" label="Cropping up" />
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.9px", textTransform: "uppercase",
          color: "var(--text-3)",
        }}>Cropping up</div>
        {/* The count is the whole fact this card holds at a glance, and it is
            what the fold leaves standing — never "hidden", which would make
            the person's own choice look like something the app withheld. */}
        {folded && (
          <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>
            {isError ? "not loaded" : entries.length ? `${entries.length} ahead` : "nothing ahead"}
          </span>
        )}
      </div>
      {folded ? null : <>

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
          {/* "Open Plan" promised these events and could not keep it: three of
              the four rows above are aspect spans, and Plan's almanac reads a
              different endpoint that has no aspects in it at all. It now says
              what it actually opens, and opens it — the almanac is collapsed
              by default, so this used to land on a closed drawer. The aspects
              still live only here until they have somewhere to go. */}
          <button onClick={() => onNavigate("almanac")} style={{
            fontSize: 11, background: "none", border: "none", padding: 0, cursor: "pointer",
            color: "var(--color-primary)",
          }}>The sky's calendar, in Plan <span aria-hidden="true">→</span></button>
        </div>
      )}
      </>}
      {!folded && water}
    </div>
  );
}
