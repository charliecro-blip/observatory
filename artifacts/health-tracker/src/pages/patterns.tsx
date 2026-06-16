import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Loader2, Sprout } from "lucide-react";
import { useTester } from "@/contexts/tester-context";
import {
  ELEMENT_ORDER, ELEMENT_BADGE_CLS, ELEMENT_DOT_CLS, ELEMENT_COLOR_CLS, ELEMENT_CARD_CLS,
  ELEMENT_LABELS, ELEMENT_SYMBOLS,
  type ElementKey,
} from "@/lib/elements";

// ── Element config ────────────────────────────────────────────────────────────

const ELEMENT_META: Record<ElementKey, {
  label: string; symbol: string;
  card: string; glow: string; badge: string; bar: string;
}> = {
  fire:   { label: ELEMENT_LABELS.fire,   symbol: ELEMENT_SYMBOLS.fire,   card: ELEMENT_CARD_CLS.fire,   glow: ELEMENT_COLOR_CLS.fire,   badge: ELEMENT_BADGE_CLS.fire,   bar: ELEMENT_DOT_CLS.fire },
  earth:  { label: ELEMENT_LABELS.earth,  symbol: ELEMENT_SYMBOLS.earth,  card: ELEMENT_CARD_CLS.earth,  glow: ELEMENT_COLOR_CLS.earth,  badge: ELEMENT_BADGE_CLS.earth,  bar: ELEMENT_DOT_CLS.earth },
  air:    { label: ELEMENT_LABELS.air,    symbol: ELEMENT_SYMBOLS.air,    card: ELEMENT_CARD_CLS.air,    glow: ELEMENT_COLOR_CLS.air,    badge: ELEMENT_BADGE_CLS.air,    bar: ELEMENT_DOT_CLS.air },
  water:  { label: ELEMENT_LABELS.water,  symbol: ELEMENT_SYMBOLS.water,  card: ELEMENT_CARD_CLS.water,  glow: ELEMENT_COLOR_CLS.water,  badge: ELEMENT_BADGE_CLS.water,  bar: ELEMENT_DOT_CLS.water },
  spirit: { label: ELEMENT_LABELS.spirit, symbol: ELEMENT_SYMBOLS.spirit, card: ELEMENT_CARD_CLS.spirit, glow: ELEMENT_COLOR_CLS.spirit, badge: ELEMENT_BADGE_CLS.spirit, bar: ELEMENT_DOT_CLS.spirit },
};

// ── Trend computation ─────────────────────────────────────────────────────────

type Range = "7d" | "30d" | "all";

const TREND_THRESHOLDS: Record<Range, [number, number, number, number]> = {
  "7d":  [0, 2, 5, 9],
  "30d": [0, 7, 18, 27],
  "all": [0, 9, 30, 60],
};

type TrendWord = "quiet" | "returning" | "steady" | "active" | "overloaded";

function trendWord(sessions: number, range: Range): TrendWord {
  const [t0, t1, t2, t3] = TREND_THRESHOLDS[range];
  if (sessions <= t0) return "quiet";
  if (sessions <= t1) return "returning";
  if (sessions <= t2) return "steady";
  if (sessions <= t3) return "active";
  return "overloaded";
}

function trendPhrase(word: TrendWord, label: string): string {
  switch (word) {
    case "quiet":      return `${label} has been quiet.`;
    case "returning":  return `${label} is returning.`;
    case "steady":     return `${label} has been steady.`;
    case "active":     return `${label} is active.`;
    case "overloaded": return `${label} is overloaded.`;
  }
}

// ── Insight suggestions ───────────────────────────────────────────────────────

const ELEMENT_SUGGESTIONS: Record<ElementKey, string> = {
  fire:   "creative projects, movement, or energizing practices",
  earth:  "nourishing food, body care, or slow grounding walks",
  air:    "breathwork, writing, study, or social connection",
  water:  "journaling, art, dreamwork, or emotional processing",
  spirit: "meditation, ritual, contemplation, or time in nature",
};

const RANGE_PERIOD: Record<Range, string> = {
  "7d":  "this week",
  "30d": "this month",
  "all": "recently",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Practice {
  cultivationId: number;
  title: string;
  domain: string;
  elements: string[];
  status: string;
  sessions: number;
}

interface ReportData {
  range: string;
  practices: Practice[];
}

interface ElementGroup {
  element: ElementKey;
  sessions: number;
  practices: Practice[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Balance() {
  const { profile } = useTester();
  const testerId = profile?.testerId ?? null;
  const [range, setRange] = useState<Range>("7d");

  const { data: report, isLoading } = useQuery<ReportData>({
    queryKey: ["element-report", testerId, range],
    queryFn: async () => {
      const res = await fetch(`/api/cultivations/element-report?range=${range}`, {
        headers: { "x-tester-id": testerId ?? "" },
      });
      if (!res.ok) throw new Error("Failed to fetch element report");
      return res.json();
    },
    enabled: !!testerId,
  });

  // Group practices by explicit elements array (multi-element aware)
  const elementGroups: ElementGroup[] = ELEMENT_ORDER.map((el) => {
    const practices = (report?.practices ?? []).filter((p) =>
      (p.elements ?? []).includes(el),
    );
    return {
      element: el,
      sessions: practices.reduce((sum, p) => sum + p.sessions, 0),
      practices: practices.filter((p) => p.sessions > 0).sort((a, b) => b.sessions - a.sessions),
    };
  });

  const totalSessions = elementGroups.reduce((sum, g) => sum + g.sessions, 0);
  const hasPractices = (report?.practices ?? []).length > 0;

  // Computed insight: find the quietest element that has at least one practice assigned to it
  const elementsWithPractices = elementGroups.filter((g) =>
    (report?.practices ?? []).some((p) => (p.elements ?? []).includes(g.element)),
  );
  const quietestWithPractices = elementsWithPractices.length > 0
    ? [...elementsWithPractices].sort((a, b) => a.sessions - b.sessions)[0]
    : null;
  const showInsight =
    totalSessions > 0 &&
    quietestWithPractices !== null &&
    quietestWithPractices.sessions === 0;

  function maxInGroup(g: ElementGroup): number {
    return Math.max(1, ...g.practices.map((p) => p.sessions));
  }

  const rangeLabels: { value: Range; label: string }[] = [
    { value: "7d", label: "7 days" },
    { value: "30d", label: "30 days" },
    { value: "all", label: "All time" },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto pb-20 flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-serif text-foreground tracking-tight">Balance</h1>
          <p className="text-muted-foreground mt-1">How the field has been tended.</p>
        </div>

        {/* Range toggle */}
        <div className="flex items-center gap-1 rounded-xl bg-muted/30 border border-border/30 p-1">
          {rangeLabels.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setRange(value)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                range === value
                  ? "bg-primary/20 border border-primary/40 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
        </div>
      ) : !hasPractices ? (
        <div className="rounded-2xl border border-border/30 bg-card/30 p-14 text-center flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-chart-2/10 border border-chart-2/20 flex items-center justify-center">
            <Sprout className="w-5 h-5 text-chart-2/60" />
          </div>
          <div className="space-y-1">
            <p className="text-foreground/70 font-medium font-serif text-lg">The field is waiting.</p>
            <p className="text-muted-foreground/60 text-sm leading-relaxed max-w-xs mx-auto">
              Plant your first cultivation to begin tracking the rhythm of your practice.
            </p>
          </div>
          <Link href="/cultivator">
            <span className="text-xs text-primary/70 hover:text-primary transition-colors border border-primary/20 hover:border-primary/40 rounded-lg px-4 py-2 inline-block">
              Begin in Practices →
            </span>
          </Link>
        </div>
      ) : (
        <>
          {/* Computed insight */}
          {showInsight && quietestWithPractices && (
            <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm p-5 flex items-start gap-4">
              <span className="text-xl flex-shrink-0 mt-0.5">
                {ELEMENT_META[quietestWithPractices.element].symbol}
              </span>
              <div className="space-y-0.5">
                <p className={`text-sm font-medium ${ELEMENT_META[quietestWithPractices.element].glow}`}>
                  {ELEMENT_META[quietestWithPractices.element].label} has been quiet {RANGE_PERIOD[range]}.
                </p>
                <p className="text-sm text-muted-foreground/70 leading-relaxed">
                  Consider {ELEMENT_SUGGESTIONS[quietestWithPractices.element]}.
                </p>
              </div>
            </div>
          )}

          {/* Element cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {elementGroups.map((group) => {
              const meta = ELEMENT_META[group.element];
              const word = trendWord(group.sessions, range);
              const phrase = trendPhrase(word, meta.label);
              const max = maxInGroup(group);

              const allInElement = (report?.practices ?? []).filter((p) =>
                (p.elements ?? []).includes(group.element),
              );

              if (allInElement.length === 0) return null;

              return (
                <div
                  key={group.element}
                  className={`rounded-2xl border backdrop-blur-sm p-5 flex flex-col gap-4 transition-all ${meta.card}`}
                >
                  {/* Element header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{meta.symbol}</span>
                      <span className={`text-base font-serif font-medium ${meta.glow}`}>{meta.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${meta.badge}`}>
                        {word}
                      </span>
                      <span className="text-xs text-muted-foreground/50">
                        {group.sessions} {group.sessions === 1 ? "session" : "sessions"}
                      </span>
                    </div>
                  </div>

                  {/* Trend sentence */}
                  <p className="text-xs text-muted-foreground/60 -mt-2">{phrase}</p>

                  {/* Practice breakdown */}
                  {group.sessions === 0 ? (
                    <p className="text-xs text-muted-foreground/40 italic">No tending recorded {RANGE_PERIOD[range]}.</p>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {group.practices.map((p) => (
                        <div key={p.cultivationId} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground/70 truncate flex-1 min-w-0">{p.title}</span>
                          <span className="text-xs text-muted-foreground/50 flex-shrink-0 w-12 text-right">
                            {p.sessions}×
                          </span>
                          <div className="w-20 h-1 bg-muted/40 rounded-full overflow-hidden flex-shrink-0">
                            <div
                              className={`h-full rounded-full ${meta.bar} opacity-70 transition-all`}
                              style={{ width: `${Math.round((p.sessions / max) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Total summary */}
          {totalSessions === 0 && (
            <div className="text-center py-6">
              <p className="text-muted-foreground/50 text-sm font-serif italic">
                The field is still {RANGE_PERIOD[range]}.
              </p>
              <Link href="/log">
                <span className="text-xs text-primary/60 hover:text-primary transition-colors mt-2 inline-block">
                  Begin tending →
                </span>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
