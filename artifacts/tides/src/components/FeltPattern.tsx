// YOUR OWN PATTERN, REPORTED BACK — the §7 promise, finally on screen.
//
// The endpoint (/check-ins/felt-pattern) has existed for a while, complete
// with the thresholds that keep it honest, and NOTHING rendered it: the
// integration audit found felt ratings written, stored, and read by nobody
// (2026-08-13, gap 2). A trust engine nobody can see is a diary.
//
// What this deliberately is NOT: a claim that the sky caused anything, or a
// tuning signal fed back into the engine. DESIGN.md §7 is careful about
// this — the user discovers their own pattern rather than the app asserting
// one. So the copy reports counts and rates the person could recount
// themselves, and the comparison ("against N% on other days") is what stops
// a bare percentage from sounding like a verdict.
//
// It says nothing at all below the thresholds. Four ratings of one character
// is an anecdote, and dressing an anecdote as a finding is how an app that
// claims to reflect starts predicting.

import { useQuery } from "@tanstack/react-query";
import { ELEMENT_COLORS } from "@/lib/elements";

interface CharacterRow {
  character: string;
  aligned: number;
  total: number;
  rate: number;
  otherRate: number | null;
}
interface Pattern {
  enough: boolean;
  ratedTotal: number;
  minTotal: number;
  minPerCharacter: number;
  windowDays: number;
  characters: CharacterRow[];
}

// Character → the element that colours it, matching the tide vocabulary.
const CHAR_ELEMENT: Record<string, keyof typeof ELEMENT_COLORS> = {
  deep: "water", surge: "fire", building: "earth", clear: "air",
};
const CHAR_LABEL: Record<string, string> = {
  deep: "Deep", surge: "Surge", building: "Building", clear: "Clear",
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function FeltPattern({ testerId, days = 60 }: { testerId: string | null; days?: number }) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const { data } = useQuery<Pattern>({
    queryKey: ["felt-pattern", testerId, days, todayStr],
    queryFn: async () => {
      const r = await fetch(`/api/check-ins/felt-pattern?days=${days}&today=${todayStr}`,
        { headers: testerId ? { "x-tester-id": testerId } : {} });
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 1000 * 60 * 30,
  });

  if (!data) return null;

  // NOT YET is a real state, and it names what would change it. Silence here
  // would read as a broken panel; a fabricated pattern would be worse.
  if (!data.enough) {
    const short = Math.max(0, (data.minTotal ?? 10) - (data.ratedTotal ?? 0));
    return (
      <div style={{
        background: "var(--color-card)", border: "1px solid var(--color-border)",
        borderRadius: 12, padding: "12px 16px",
      }}>
        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)" }}>
          Your pattern
        </div>
        <div style={{ fontSize: 12.5, color: "var(--color-muted)", lineHeight: 1.55, marginTop: 4 }}>
          {data.ratedTotal > 0
            ? `${data.ratedTotal} day${data.ratedTotal === 1 ? "" : "s"} rated so far. About ${short} more and Compass can show you which kinds of day you actually rate highest — your own record, not a claim about the sky.`
            : "Rate a few days as you close them out and this becomes a record of which kinds of day you rate highest."}
        </div>
      </div>
    );
  }

  const top = data.characters[0];
  const topElement = ELEMENT_COLORS[CHAR_ELEMENT[top.character] ?? "earth"];

  return (
    <div style={{
      background: "var(--color-card)", border: "1px solid var(--color-border)",
      borderLeft: `3px solid ${topElement}`, borderRadius: 12, padding: "13px 16px 14px",
    }}>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-3)" }}>
        Your pattern · last {Math.round(data.windowDays / 30)} month{data.windowDays >= 60 ? "s" : ""}
      </div>

      <div style={{ fontFamily: "var(--font-display)", fontSize: 19, lineHeight: 1.3, color: "var(--color-foreground)", marginTop: 5 }}>
        Your {CHAR_LABEL[top.character] ?? top.character} days land best.
      </div>

      <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.55, marginTop: 3 }}>
        You marked {top.aligned} of {top.total} of them aligned ({pct(top.rate)})
        {top.otherRate != null && <> — against {pct(top.otherRate)} on every other day you rated</>}.
      </div>

      {/* The rest, plainly, so the top line is checkable rather than taken on
          faith. A reader who disagrees with the headline can see the counts
          it came from. */}
      {data.characters.length > 1 && (
        <div style={{ marginTop: 9, paddingTop: 8, borderTop: "1px solid var(--color-border)" }}>
          {data.characters.map((c) => {
            const col = ELEMENT_COLORS[CHAR_ELEMENT[c.character] ?? "earth"];
            return (
              <div key={c.character} style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: col, flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, color: "var(--color-foreground)", flex: 1 }}>
                  {CHAR_LABEL[c.character] ?? c.character}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>
                  {c.aligned}/{c.total} · {pct(c.rate)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 10.5, color: "var(--text-3)", lineHeight: 1.5, marginTop: 8 }}>
        Your record, not a forecast — Compass doesn't change its timing based on this.
      </div>
    </div>
  );
}
