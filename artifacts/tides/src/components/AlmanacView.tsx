/**
 * THE ALMANAC — two calendars, and only one of them has an opinion.
 *
 * THE SKY ITSELF answers "what happens regardless of me": eclipses, stations,
 * ingresses, the aspect spans. Dates fixed before anyone arrives — reference,
 * not a verdict.
 *
 * A LENS answers the question people actually arrive with: when is a good day
 * for THIS. That half is the product. It is the only calendar that can refuse,
 * because refusal needs an external standard a fit-optimiser structurally
 * lacks (BACKLOG §8).
 *
 * THE BOUNDARY THAT STILL HOLDS: a fixed date has no verdict and a verdict has
 * no fixed date. What changed 2026-09-03 (owner: "it just says new moon — but
 * where is it?") is that a row can now say WHERE without saying WHETHER —
 * which house it falls in, when a chart is on file, is a location, not a
 * grade. Clicking a row reveals that plus, on a new moon only, a plain door
 * into starting something (Guiding Stars) — a place to go, not a score for
 * going there. Nothing here is a suitability verdict; that stays the lens's
 * job alone.
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
import ActivityWeek from "@/components/ActivityWeek";
import { useQuery } from "@tanstack/react-query";
import LunationArc from "@/components/LunationArc";
import type { MoonCycle } from "@/lib/lunation";

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
  /** An aspect row's reading, kept apart from the aspect it reads. */
  gloss?: string;
  eclipse?: "solar" | "lunar";
  // Aspects carry a window rather than an instant.
  startDate?: string; endDate?: string; active?: boolean;
  /** Whole-sign house context, present only with a timed chart on file. */
  house?: number; houseTheme?: string;
}
interface Horizon { days: number; aspectsThrough: string }

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
/** 1st, 2nd, 3rd, 4th… — for "your 7th house", not "your 7 house". */
const ordinal = (n: number) => {
  const s = n % 100;
  if (s >= 11 && s <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
};

// Kept in sync with the same table in api-server/src/lib/almanac.ts.
// "opposition" used to gloss to "opposes" — the same word with a different
// ending, so the row said the same thing twice (owner, 2026-09-03: "wtf?").
// Every other entry here actually translates the term; this one now does too.
const ASPECT_WORD: Record<string, string> = {
  conjunction: "meets", opposition: "pulls against", square: "grinds against",
  trine: "flows with", sextile: "supports",
};

export default function AlmanacView({ testerId, lat = 40.7, lon = -74.0, locationKnown = true, moonCycle, nodeIngress, onOpenElections, onNavigate }: {
  testerId: string | null; lat?: number; lon?: number;
  locationKnown?: boolean;
  /** From /tides/now, which the page already holds — the arc costs no request. */
  moonCycle?: MoonCycle | null;
  /** The nodal axis changing sign. Null on almost every day, by nature. */
  nodeIngress?: { from: string; to: string; daysAway: number } | null;
  /** Into Pick a Day, where inception doctrine lives. */
  onOpenElections?: () => void;
  /** A new-moon row's "start something" door, into Guiding Stars. */
  onNavigate?: (view: string) => void;
}) {
  // No default lens. The sky's own calendar stands on its own and needs no
  // question asked; inventing one on arrival would be the app deciding what
  // you came for.
  const [lens, setLens] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  // A row opens on click rather than always showing its house context inline
  // — most rows have none (no chart, or a kind house math doesn't reach yet),
  // and a line that's blank nine times in ten reads as a bug, not a feature.
  const [expanded, setExpanded] = useState<string | null>(null);
  // Off by default: crossings run roughly one a day, and folding them into a
  // ninety-day list unconditionally would make them most of it (owner
  // 2026-09-03: "I still want to be able to see planetary crossings on the
  // almanac" — available on request, not always on).
  const [showCrossings, setShowCrossings] = useState(false);

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

  // ONE call. The aspect spans used to come from /transits/spans and get
  // stitched together with these client-side — the same facts, dated the same
  // way, assembled somewhere that had to remember to do it. They are folded in
  // at the source now, so this is the sky's calendar rather than two thirds of
  // it plus an assembly step.
  const skyQ = useQuery<{ entries: SkyEntry[]; horizon: Horizon }>({
    // Location only rides along when it is REAL (never the app's timezone-
    // guess default) — crossings are cut from the local horizon, and a
    // guessed meridian would draw ones that are simply wrong.
    queryKey: ["almanac-sky", 90, testerId, locationKnown ? lat.toFixed(2) : null, locationKnown ? lon.toFixed(2) : null, showCrossings],
    queryFn: async () => {
      const loc = locationKnown ? `&lat=${lat}&lon=${lon}&crossings=${showCrossings}` : "";
      const r = await fetch(`/api/tides/almanac?days=90&tz=${new Date().getTimezoneOffset()}${loc}`,
        { headers: testerId ? { "x-tester-id": testerId } : {} });
      if (!r.ok) throw new Error("almanac unavailable");
      return r.json();
    },
    staleTime: 6 * 60 * 60 * 1000,
  });

  const label = LENSES.find(l => l.key === lens)?.label;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px 40px" }}>

      {/* ══ WHAT A RUN OF DAYS IS GOOD FOR ═══════════════════════════════
          This asked an ELECTION question — launch a business, sign a
          contract, marry — which is inception doctrine: the strict, refusing,
          once-in-a-decision kind of timing. An almanac that only answers
          those is an almanac nobody opens, because nobody founds a company
          on a Tuesday afternoon (owner, 2026-08-25).

          The ordinary question is "when should I train / write / have the
          hard conversation", and it already had an answer: ActivityWeek,
          built in August for exactly this and living in Pick a Day, where it
          sat beside the inception tool it is not. It moves here.

          Elections stay in Pick a Day. Keeping the two doctrines in separate
          rooms is the point — strict-inception vocabulary must not bleed into
          everyday timing — so this room points at that one rather than
          growing a second copy of it. */}
      <ActivityWeek testerId={testerId} lat={lat} lon={lon} locationKnown={locationKnown} />

      <button onClick={() => onOpenElections?.()} style={{
        alignSelf: "flex-start", display: "flex", alignItems: "baseline", gap: 7,
        background: "none", border: "none", padding: "10px 2px 18px", cursor: onOpenElections ? "pointer" : "default",
        fontSize: 12.5, color: "var(--color-primary)", fontWeight: 500,
      }}>Electing a beginning <span aria-hidden="true">→</span>
        <span style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 400 }}>
          launching, signing, publishing — the stricter rules, in Pick a Day
        </span>
      </button>

      {/* ── the sky itself ───────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--color-meridian)" }}>
          The sky itself
        </div>
        <label title={locationKnown ? "Add the day's angle crossings — roughly one a day, for the next two weeks" : "Needs your location"}
          style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: locationKnown ? "var(--text-3)" : "var(--text-3)", opacity: locationKnown ? 1 : 0.5, cursor: locationKnown ? "pointer" : "default", marginLeft: "auto" }}>
          <input type="checkbox" checked={showCrossings} disabled={!locationKnown}
            onChange={e => setShowCrossings(e.target.checked)}
            style={{ margin: 0, cursor: locationKnown ? "pointer" : "default" }} />
          angle crossings
        </label>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 12, maxWidth: 560 }}>
        Fixed before you get here, and true for everyone. No verdict attached — what to do about these is your call.
        {" "}Tap one to see where it lands for you{skyQ.data?.entries.some(e => e.house != null) ? "" : ", once your chart's on file"}.
      </div>

      {/* ══ THE CYCLE THE REST OF THE LIST SITS INSIDE ═══════════════════
          Fullness had one representation everywhere in the app: a 15px disc
          and "95% lit". That says what tonight looks like and nothing about
          where tonight sits in the month ("I wonder if we want another
          vizualization for the lunar cycle fullness", owner 2026-08-25).

          Here rather than the rail because the rail already needs 985px of a
          709px column, and here rather than Home because the Almanac is the
          sky's own calendar and a lunation is the first thing in it. Drawn
          from moonCycle, so it adds no request. */}
      {moonCycle && (
        <div style={{ marginBottom: 20 }}>
          <LunationArc cycle={moonCycle} />
        </div>
      )}

      {/* ══ THE AXIS CHANGING SIGN ═══════════════════════════════════════
          The nodes move about a sign every eighteen months, so this is among
          the rarest things the app can report — and it was nowhere in it. The
          axis crossed from Pisces/Virgo into Aquarius/Leo in August 2026 and
          the app had the number the whole time, spending it only on eclipse
          detection.

          Read against the mean node, so a cusp is named once: the true node
          wobbles back over a sign boundary for weeks, and reporting each pass
          would cry rare four times in a season. */}
      {nodeIngress && (
        <div style={{
          marginBottom: 20, padding: "11px 14px", borderRadius: 10,
          border: "1px solid var(--color-border)", background: "var(--color-card)",
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 3 }}>
            The nodes change sign
          </div>
          <div style={{ fontSize: 12.5, color: "var(--color-foreground)", lineHeight: 1.5 }}>
            The eclipse axis {nodeIngress.daysAway <= 0 ? "moved" : "moves"} from {nodeIngress.from} to {nodeIngress.to}
            {nodeIngress.daysAway === 0 ? " today" :
             nodeIngress.daysAway < 0 ? ` ${Math.abs(nodeIngress.daysAway)} day${Math.abs(nodeIngress.daysAway) === 1 ? "" : "s"} ago` :
             ` in ${nodeIngress.daysAway} day${nodeIngress.daysAway === 1 ? "" : "s"}`}.
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3, lineHeight: 1.5 }}>
            Eclipses fall near this axis, so it sets where the next eighteen months of them land.
          </div>
        </div>
      )}

      {skyQ.isError && (
        <div style={{ fontSize: 11.5, color: "var(--color-muted)" }}>
          Couldn't reach the almanac just now, which is a connection problem rather than a quiet three months.
        </div>
      )}

      {(() => {
        const entries = skyQ.data?.entries ?? [];
        if (!entries.length && !skyQ.isPending) return null;

        let month = "";
        return entries.map((e, i) => {
          const m = monthOf(e.at.slice(0, 10));
          const newMonth = m !== month;
          month = m;
          const isAspect = e.kind === "aspect";
          const isCrossing = e.kind === "crossing";
          const key = `${e.at}-${i}`;
          const isNewMoon = e.kind === "lunation" && e.title.includes("New Moon") && !e.eclipse;
          const isOpen = expanded === key;
          const hasMore = e.house != null || isNewMoon;
          return (
            <div key={key}>
              {newMonth && (
                <div style={{ fontSize: 10, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: i ? 14 : 0, marginBottom: 4 }}>{m}</div>
              )}
              <div onClick={() => hasMore && setExpanded(isOpen ? null : key)}
                style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "5px 0", borderTop: "1px solid var(--color-border)",
                  opacity: isCrossing ? 0.72 : 1, cursor: hasMore ? "pointer" : "default" }}>
                <span style={{ width: 96, flexShrink: 0, fontSize: 11, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>
                  {dayLabel(e.at.slice(0, 10))}
                </span>
                <span aria-hidden style={{ width: 14, flexShrink: 0, fontSize: 11, color: e.eclipse ? "var(--color-brass)" : "var(--color-meridian)" }}>{e.glyph}</span>
                {/* The transit, then the reading of it. The row used to lead
                    with "Mars grinds against Saturn" and never say the aspect,
                    so the one checkable fact in it was missing (owner,
                    2026-08-28). */}
                <span style={{ fontSize: 12, color: "var(--color-foreground)", fontWeight: e.eclipse ? 600 : 400, flexShrink: 0 }}>{e.title}</span>
                {e.gloss && (
                  <span style={{ fontSize: 11, color: "var(--color-meridian)", flexShrink: 0 }}>{e.gloss}</span>
                )}
                <span style={{ fontSize: 11, color: "var(--text-3)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {/* An aspect is a stretch, so it says its stretch. A fixed
                      event is an instant and says what it means instead. */}
                  {isAspect && e.startDate && e.endDate
                    ? (e.active ? `in force now, through ${dayLabel(e.endDate)}` : `${dayLabel(e.startDate)} to ${dayLabel(e.endDate)}`)
                    : e.note}
                </span>
                {hasMore && <span aria-hidden="true" style={{ fontSize: 10, color: "var(--text-3)", flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>}
              </div>
              {isOpen && (
                <div style={{ padding: "2px 0 10px 120px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {e.house != null && (
                    <div style={{ fontSize: 11.5, color: "var(--color-foreground)" }}>
                      Falls in your {e.house}{ordinal(e.house)} house — {e.houseTheme}.
                    </div>
                  )}
                  {isNewMoon && (
                    <button onClick={ev => { ev.stopPropagation(); onNavigate?.("work"); }} style={{
                      alignSelf: "flex-start", fontSize: 11.5, fontWeight: 500, background: "none", border: "none",
                      padding: 0, cursor: onNavigate ? "pointer" : "default", color: "var(--color-primary)",
                    }}>Start something here <span aria-hidden="true">→</span></button>
                  )}
                </div>
              )}
            </div>
          );
        });
      })()}

      {/* WHERE THE ASPECTS STOP. The fixed events run the full ninety days;
          the aspect scan reaches twenty-one. Without this line the list simply
          thins out and reads as a quiet autumn, which is the false-emptiness
          this app has spent real time removing everywhere else. */}
      {skyQ.data?.horizon && (
        <div style={{ marginTop: 12, paddingTop: 8, borderTop: "1px solid var(--color-border)", fontSize: 10.5, color: "var(--text-3)" }}>
          Fixed dates run to the end of this list. Aspects are only scanned to{" "}
          {dayLabel(skyQ.data.horizon.aspectsThrough)} — past that the sky here is unread, not empty.
        </div>
      )}
    </div>
  );
}
