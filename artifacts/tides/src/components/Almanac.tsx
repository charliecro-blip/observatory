// THE ALMANAC — the sky's own calendar, in the tab where work gets placed.
//
// Plan answers "when should this go?" against your inventory. This answers the
// question underneath it: what the month is doing regardless of your list. The
// dates here are fixed before you arrive, so the use of them is to plan around
// them (owner, 2026-08-13: "the plan tab might have a few almanac-type
// calendar functions available there, too").
//
// Deliberately impersonal. Everything else in Plan reads your chart, your
// inventory, your windows; this reads none of them, which is exactly why it
// can be trusted as reference rather than suggestion. It reports what the sky
// does and stops there, leaving what to do about it to the surfaces that know
// your inventory.
//
// Grouped by month because that is the scale these events live at, collapsed
// by default because Plan's job is planning and this is reference beside it.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

/**
 * Mirrors AlmanacEntry in api-server/src/lib/almanac.ts. A hand-kept copy of a
 * server contract, which is the third one this week to drift — the practices
 * route renamed its fields and nothing noticed, and the election verdict union
 * lost "caution" the same way. Typecheck only catches it when the copy is used
 * somewhere the compiler can see the mismatch, which is luck rather than
 * design. If a fourth turns up, generate these from the server types.
 */
export interface AlmanacEntry {
  at: string;
  kind: "lunation" | "quarter" | "station" | "ingress" | "aspect";
  title: string;
  note: string;
  glyph: string;
  eclipse?: "solar" | "lunar";
  /** Aspects only: a span is a stretch, not an instant. */
  startDate?: string;
  endDate?: string;
  active?: boolean;
}

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

// One filter chip per kind, plus "all". Stations and eclipses are what people
// actually plan around, so they get to be reachable in one click.
const FILTERS = [
  { id: "all", label: "Everything" },
  { id: "lunation", label: "Moon" },
  { id: "station", label: "Retrogrades" },
  { id: "ingress", label: "Seasons" },
] as const;
type FilterId = typeof FILTERS[number]["id"];

export default function Almanac({ days = 90, openOnMount = false }: { days?: number; openOnMount?: boolean }) {
  // Arriving FROM a list of named sky events, a closed drawer is the wrong
  // greeting: you clicked "Lunar eclipse · Mercury stations" and landed on a
  // button asking whether you would like to see what the months are doing.
  // Collapsed stays the default for anyone who simply opened Plan.
  const [open, setOpen] = useState(openOnMount);
  const [filter, setFilter] = useState<FilterId>("all");

  const { data, isPending, isError } = useQuery<{ entries: AlmanacEntry[] }>({
    queryKey: ["almanac", days],
    queryFn: async () => {
      const r = await fetch(`/api/tides/almanac?days=${days}`);
      if (!r.ok) throw new Error("almanac unavailable");
      return r.json();
    },
    enabled: open,          // reference material: nobody pays for it until they open it
    staleTime: 6 * 60 * 60 * 1000,
  });

  const entries = data?.entries ?? [];
  // "Moon" folds quarters in with lunations — the distinction matters in the
  // list, not in the filter.
  const shown = entries.filter(e =>
    filter === "all" ? true :
    filter === "lunation" ? (e.kind === "lunation" || e.kind === "quarter") :
    e.kind === filter);

  const byMonth = new Map<string, AlmanacEntry[]>();
  for (const e of shown) {
    const key = monthLabel(e.at);
    byMonth.set(key, [...(byMonth.get(key) ?? []), e]);
  }

  return (
    <div style={{ marginTop: 26, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{
          fontSize: 12.5, background: "none", border: "none", padding: 0,
          cursor: "pointer", color: "var(--color-primary)", textAlign: "left",
        }}>
        {open ? "Hide the almanac" : <>What the next three months are doing <span aria-hidden="true">→</span></>}
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 12, lineHeight: 1.6, maxWidth: 520 }}>
            Dates that are fixed before you get to them, so you can place work with them in view.
          </div>

          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                style={{
                  fontSize: 10.5, padding: "3px 10px", borderRadius: 999, cursor: "pointer",
                  border: "1px solid var(--color-border)",
                  background: filter === f.id ? "var(--color-card-2)" : "transparent",
                  color: filter === f.id ? "var(--color-primary)" : "var(--text-3)",
                  fontWeight: filter === f.id ? 600 : 400,
                }}>{f.label}</button>
            ))}
          </div>

          {isPending && (
            <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>Reading the ephemeris…</div>
          )}

          {/* A failed fetch is a connection problem, and saying so beats an
              empty list that reads as a quiet three months. */}
          {isError && (
            <div style={{ fontSize: 11.5, color: "var(--color-muted)" }}>
              Couldn't reach the almanac just now, which is a connection problem rather than an empty sky.
            </div>
          )}

          {!isPending && !isError && shown.length === 0 && (
            <div style={{ fontSize: 11.5, color: "var(--color-muted)" }}>
              Nothing of this kind falls in the next {days} days.
            </div>
          )}

          {[...byMonth.entries()].map(([month, list]) => (
            <div key={month} style={{ marginBottom: 18 }}>
              <div style={{
                fontSize: 11, textTransform: "uppercase", letterSpacing: "0.7px",
                color: "var(--text-3)", marginBottom: 7,
              }}>{month}</div>

              {list.map(e => (
                <div key={e.at + e.title} style={{
                  display: "flex", gap: 10, alignItems: "baseline",
                  padding: "7px 0", borderTop: "1px solid var(--color-border)",
                }}>
                  <span aria-hidden="true" style={{
                    fontSize: 13, width: 18, flexShrink: 0, textAlign: "center",
                    color: e.eclipse ? "var(--color-primary)" : "var(--text-3)",
                  }}>{e.glyph}</span>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: 12.5,
                        fontWeight: e.eclipse || e.kind === "station" ? 600 : 500,
                        color: "var(--color-foreground)",
                      }}>{e.title}</span>
                      <span style={{ fontSize: 10, color: "var(--text-3)" }}>
                        {dayLabel(e.at)} · {clock(e.at)}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-muted)", lineHeight: 1.55, marginTop: 2 }}>
                      {e.note}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
