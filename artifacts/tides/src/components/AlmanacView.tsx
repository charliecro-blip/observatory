/**
 * THE ALMANAC — two calendars, and only one of them has an opinion.
 *
 * THE SKY ITSELF answers "what happens regardless of me": eclipses, stations,
 * ingresses, the aspect spans. Dates fixed before anyone arrives. It is
 * reference, it is impersonal, and that is exactly why it can be trusted — it
 * reads no chart and makes no suggestion.
 *
 * A LENS answers the question people actually arrive with: when is a good day
 * for THIS. That half is the product. It is the only calendar that can refuse,
 * because refusal needs an external standard a fit-optimiser structurally
 * lacks (BACKLOG §8).
 *
 * The two are drawn apart and never share a vocabulary. A fixed date has no
 * verdict and a verdict has no fixed date; merging them would imply the sky
 * approves of your Tuesday, which is the one thing this page must not say.
 *
 * WHY IT LIVES IN CALENDAR. The Almanac had its own tab once and it was
 * retired — about 450 lines deleted as unreachable — because reference with no
 * work to do does not earn a nav slot. Calendar already owns "time, laid out",
 * so this is a fourth way of looking at it rather than a sixth place to go.
 *
 * WHY THE LENS IS CHEAP. It reads /tides/almanac/lens, which scores one day at
 * a time (~32ms) rather than running the window search per activity. Thirteen
 * activities through that search would be forty seconds; this repo has already
 * shipped a 42-second election scan and a 90-second calendar request.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

// All FOUR of them. The first draft of this file declared three, which
// typechecked perfectly because the wrong union was declared locally rather
// than taken from the engine — and then the server returned "caution" and the
// lookup below handed back undefined. Same shape as the practices bug: a
// client-side copy of a server contract that quietly stopped matching it.
// Mirrors ElectionVerdict in api-server/src/lib/inceptionElection.ts.
type Verdict = "strong" | "workable" | "caution" | "avoid";

interface LensDay {
  date: string;
  verdict: Verdict;
  against: string[];
  supports: string[];
  planetaryHour: string;
}
interface LensResponse { category: string; label: string; days: number; entries: LensDay[] }

interface SkyEntry {
  at: string; kind: string; title: string; note: string; glyph: string;
  eclipse?: "solar" | "lunar";
}
interface Span {
  key: string; transitPlanet: string; aspect: string; targetPlanet: string;
  startDate: string; peakDate: string; endDate: string; active: boolean; theme?: string;
}

/** The questions the engine can actually answer, in its own words. */
const LENSES: { key: string; label: string }[] = [
  { key: "creative_launch",  label: "Creative launch" },
  { key: "writing_start",    label: "Start writing" },
  { key: "publishing",       label: "Publish or release" },
  { key: "business_launch",  label: "Launch a business" },
  { key: "job_application",  label: "Apply for a job" },
  { key: "job_start",        label: "Start a job" },
  { key: "contract",         label: "Sign a contract" },
  { key: "financial_venture",label: "Financial venture" },
  { key: "conversation",     label: "A hard conversation" },
  { key: "date",             label: "A date" },
  { key: "marriage",         label: "Marriage" },
  { key: "habit_start",      label: "Begin a practice" },
  { key: "travel_short",     label: "Short trip" },
  { key: "travel_long",      label: "Long journey" },
  { key: "home_purchase",    label: "Move house" },
];

const VERDICT: Record<Verdict, { word: string; color: string; bg: string }> = {
  strong:   { word: "strong",     color: "var(--color-quality-good)",      bg: "var(--color-quality-good)" },
  workable: { word: "workable",   color: "var(--color-quality-caution)",   bg: "var(--color-quality-caution)" },
  // Not "bad" and not "blocked". The verdict names what the day is like, not
  // what you are forbidden to do with it (BACKLOG: describe conditions, never
  // promise outcomes).
  caution:  { word: "care needed", color: "var(--color-quality-caution)",   bg: "var(--color-quality-caution)" },
  avoid:    { word: "against it", color: "var(--color-quality-challenge)", bg: "var(--color-quality-challenge)" },
};

/** Never index the table blind: an unknown verdict should read as unknown
 *  rather than throw, because the engine's vocabulary can grow again. */
const verdictOf = (v: string) =>
  VERDICT[v as Verdict] ?? { word: v, color: "var(--text-3)", bg: "var(--color-border)" };

const dayLabel = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const monthOf = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });

const ASPECT_WORD: Record<string, string> = {
  conjunction: "meets", opposition: "opposes", square: "grinds against",
  trine: "flows with", sextile: "supports",
};

export default function AlmanacView({ testerId, lat = 40.7, lon = -74.0 }: {
  testerId: string | null; lat?: number; lon?: number;
}) {
  // No default lens. The sky's own calendar stands on its own and needs no
  // question asked; inventing one on arrival would be the app deciding what
  // you came for.
  const [lens, setLens] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const lensQ = useQuery<LensResponse>({
    queryKey: ["almanac-lens", lens, days, lat, lon],
    queryFn: async () => {
      const r = await fetch(`/api/tides/almanac/lens?category=${lens}&days=${days}&lat=${lat}&lon=${lon}`);
      if (!r.ok) throw new Error("lens unavailable");
      return r.json();
    },
    enabled: !!lens,
    staleTime: 6 * 60 * 60 * 1000,
  });

  const skyQ = useQuery<{ entries: SkyEntry[] }>({
    queryKey: ["almanac-sky", 90],
    queryFn: async () => {
      const r = await fetch("/api/tides/almanac?days=90");
      if (!r.ok) throw new Error("almanac unavailable");
      return r.json();
    },
    staleTime: 6 * 60 * 60 * 1000,
  });

  // The aspect spans lived ONLY on Home's sky-events card, whose "open Plan"
  // link pointed at a surface that reads a different endpoint and has no
  // aspects in it at all. This is the destination that card never had.
  const spanQ = useQuery<{ spans: Span[] }>({
    queryKey: ["almanac-spans", testerId],
    queryFn: async () => {
      const r = await fetch(`/api/transits/spans?tz=${new Date().getTimezoneOffset()}`,
        { headers: testerId ? { "x-tester-id": testerId } : {} });
      if (!r.ok) throw new Error("spans unavailable");
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 6 * 60 * 60 * 1000,
  });

  const label = LENSES.find(l => l.key === lens)?.label;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px 40px" }}>

      {/* ── the question ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 6, fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--color-brass)" }}>
        What is it good for
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 10, maxWidth: 560 }}>
        Pick a question and the next {days} days are scored against it — including the days it argues against.
      </div>

      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
        {LENSES.map(l => {
          const on = lens === l.key;
          return (
            <button key={l.key} onClick={() => setLens(on ? null : l.key)} aria-pressed={on}
              style={{
                fontSize: 10.5, padding: "3px 10px", borderRadius: 999, cursor: "pointer",
                border: `1px solid ${on ? "var(--color-foreground)" : "var(--color-border)"}`,
                background: on ? "var(--color-foreground)" : "transparent",
                color: on ? "var(--color-card)" : "var(--text-3)",
                fontWeight: on ? 600 : 400,
              }}>{l.label}</button>
          );
        })}
      </div>

      {lens && (
        <div style={{ marginBottom: 26 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-foreground)" }}>{label}</span>
            <div style={{ display: "flex", gap: 4 }}>
              {[14, 30, 60].map(d => (
                <button key={d} onClick={() => setDays(d)} aria-pressed={days === d}
                  style={{
                    fontSize: 9.5, padding: "2px 8px", borderRadius: 5, cursor: "pointer",
                    border: "1px solid var(--color-border)",
                    background: days === d ? "var(--color-card-2)" : "transparent",
                    color: days === d ? "var(--color-primary)" : "var(--text-3)",
                    fontWeight: days === d ? 600 : 400,
                  }}>{d}d</button>
              ))}
            </div>
            {lensQ.data && (() => {
              const c = lensQ.data.entries.reduce((a, e) => { a[e.verdict] = (a[e.verdict] ?? 0) + 1; return a; }, {} as Record<string, number>);
              return (
                <span style={{ fontSize: 10.5, color: "var(--text-3)", marginLeft: "auto" }}>
                  {c.strong ?? 0} strong · {c.workable ?? 0} workable · {c.caution ?? 0} care needed · {c.avoid ?? 0} against
                </span>
              );
            })()}
          </div>

          {lensQ.isPending && <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>Scoring the days…</div>}
          {lensQ.isError && (
            <div style={{ fontSize: 11.5, color: "var(--color-muted)" }}>
              Couldn't score those days just now — that's a connection problem, not a verdict.
            </div>
          )}

          {lensQ.data?.entries.map(e => {
            const v = verdictOf(e.verdict);
            return (
              <div key={e.date} style={{
                display: "flex", alignItems: "baseline", gap: 10, padding: "6px 0",
                borderTop: "1px solid var(--color-border)",
              }}>
                <span style={{ width: 96, flexShrink: 0, fontSize: 11, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>
                  {dayLabel(e.date)}
                </span>
                <span aria-hidden style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: v.bg, opacity: e.verdict === "workable" || e.verdict === "caution" ? 0.55 : 0.9, flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, color: v.color, fontWeight: 600, width: 74, flexShrink: 0 }}>{v.word}</span>
                {/* The reasons are the point. A verdict with no receipt is a
                    horoscope, and this engine's whole claim is that it can
                    show its working. */}
                <span style={{ fontSize: 11, color: "var(--text-3)", flex: 1, minWidth: 0 }}>
                  {e.against.length ? e.against.join(" · ")
                    : e.supports.length ? e.supports.join(" · ")
                    : "nothing standing in the way"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── the sky itself ───────────────────────────────────────────── */}
      <div style={{ marginBottom: 6, fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--color-meridian)" }}>
        The sky itself
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 12, maxWidth: 560 }}>
        Fixed before you get here, and true for everyone. No verdict attached — what to do about these is your call.
      </div>

      {skyQ.isError && (
        <div style={{ fontSize: 11.5, color: "var(--color-muted)" }}>
          Couldn't reach the almanac just now, which is a connection problem rather than a quiet three months.
        </div>
      )}

      {(() => {
        const entries = skyQ.data?.entries ?? [];
        // Aspect spans folded in beside the fixed dates, sorted together —
        // they are the same KIND of fact (the sky, dated, impersonal) and were
        // only separate because they come from a different endpoint.
        const spanRows = (spanQ.data?.spans ?? []).map(s => ({
          at: `${s.peakDate}T12:00:00`,
          kind: "aspect" as const,
          glyph: "✦",
          title: `${s.transitPlanet} ${ASPECT_WORD[s.aspect] ?? "meets"} ${s.targetPlanet}`,
          note: s.active ? `in force now, through ${dayLabel(s.endDate)}` : `${dayLabel(s.startDate)} to ${dayLabel(s.endDate)}`,
          eclipse: undefined,
        }));
        const all = [...entries, ...spanRows].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
        if (!all.length && !skyQ.isPending) return null;

        let month = "";
        return all.map((e, i) => {
          const m = monthOf(e.at.slice(0, 10));
          const newMonth = m !== month;
          month = m;
          return (
            <div key={`${e.at}-${i}`}>
              {newMonth && (
                <div style={{ fontSize: 10, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: i ? 14 : 0, marginBottom: 4 }}>{m}</div>
              )}
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "5px 0", borderTop: "1px solid var(--color-border)" }}>
                <span style={{ width: 96, flexShrink: 0, fontSize: 11, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>
                  {dayLabel(e.at.slice(0, 10))}
                </span>
                <span aria-hidden style={{ width: 14, flexShrink: 0, fontSize: 11, color: e.eclipse ? "var(--color-brass)" : "var(--color-meridian)" }}>{e.glyph}</span>
                <span style={{ fontSize: 12, color: "var(--color-foreground)", fontWeight: e.eclipse ? 600 : 400, flexShrink: 0 }}>{e.title}</span>
                <span style={{ fontSize: 11, color: "var(--text-3)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.note}</span>
              </div>
            </div>
          );
        });
      })()}
    </div>
  );
}
