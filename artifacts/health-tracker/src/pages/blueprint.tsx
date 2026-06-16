import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Loader2, RefreshCw, Copy, Check, Scroll, Star, AlertTriangle } from "lucide-react";
import { useTester } from "@/contexts/tester-context";

interface BlueprintContent {
  constitutionOverview: string;
  ascendantBodyVitality: string;
  moonBodyRhythm: string;
  sixthHousePatterns: string;
  secondHouseIntake: string;
  eighthHouseProcesses: string;
  tenthHouseTherapies: string;
  marsSaturnStress: string;
  venusJupiterSupport: string;
  contradictionsMixedTestimony: string;
  whatToTrack: string[];
  supportivePrinciples: string[];
  safetyNote: string;
}

interface BlueprintResponse {
  id: number;
  testerId: string;
  natalChartId: number;
  content: BlueprintContent;
  promptVersion: string;
  createdAt: string;
  updatedAt: string;
}

type PageState = "loading" | "no_natal_chart" | "empty" | "generating" | "ready" | "error";

function SectionCard({
  label,
  text,
  accent,
}: {
  label: string;
  text: string;
  accent?: "amber" | "violet" | "default";
}) {
  const borderClass =
    accent === "amber" ? "border-amber-500/20 bg-amber-500/5" :
    accent === "violet" ? "border-primary/20 bg-primary/5" :
    "border-border/30 bg-card/40";

  return (
    <div className={`rounded-xl border p-5 backdrop-blur-sm ${borderClass}`}>
      <h3 className={`text-xs uppercase tracking-widest font-medium mb-3 ${
        accent === "amber" ? "text-amber-400" :
        accent === "violet" ? "text-primary" :
        "text-muted-foreground"
      }`}>
        {label}
      </h3>
      <p className="text-sm text-foreground/80 leading-relaxed">{text}</p>
    </div>
  );
}

function ListCard({
  label,
  items,
  accent,
}: {
  label: string;
  items: string[];
  accent?: "teal" | "default";
}) {
  return (
    <div className={`rounded-xl border p-5 backdrop-blur-sm ${
      accent === "teal" ? "border-chart-2/20 bg-chart-2/5" : "border-border/30 bg-card/40"
    }`}>
      <h3 className={`text-xs uppercase tracking-widest font-medium mb-3 ${
        accent === "teal" ? "text-chart-2" : "text-muted-foreground"
      }`}>
        {label}
      </h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/80 leading-relaxed">
            <span className="text-muted-foreground/40 flex-shrink-0 mt-0.5 text-xs">◦</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Blueprint() {
  const { profile } = useTester();
  const testerId = profile?.testerId ?? null;
  const [pageState, setPageState] = useState<PageState>("loading");
  const [blueprint, setBlueprint] = useState<BlueprintResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const fetchBlueprint = useCallback(async () => {
    if (!testerId) return;
    setPageState("loading");
    try {
      const res = await fetch("/api/natal-chart/blueprint", {
        headers: { "x-tester-id": testerId },
      });
      if (res.ok) {
        const data = await res.json();
        setBlueprint(data);
        setPageState("ready");
      } else if (res.status === 404) {
        const body = await res.json().catch(() => ({}));
        if (body?.error === "no_natal_chart") {
          setPageState("no_natal_chart");
        } else {
          setPageState("empty");
        }
      } else {
        setPageState("error");
        setErrorMsg("Failed to load blueprint.");
      }
    } catch {
      setPageState("error");
      setErrorMsg("Network error — please try again.");
    }
  }, [testerId]);

  useEffect(() => {
    fetchBlueprint();
  }, [fetchBlueprint]);

  const handleGenerate = async (force = false) => {
    if (!testerId) return;
    setPageState("generating");
    setErrorMsg("");
    try {
      const res = await fetch("/api/natal-chart/blueprint/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tester-id": testerId,
        },
        body: JSON.stringify({ force }),
      });
      if (res.ok) {
        const data = await res.json();
        setBlueprint(data);
        setPageState("ready");
      } else {
        const body = await res.json().catch(() => ({}));
        if (body?.error === "no_natal_chart") {
          setPageState("no_natal_chart");
        } else {
          setPageState("error");
          setErrorMsg(body?.message ?? "Generation failed — please try again.");
        }
      }
    } catch {
      setPageState("error");
      setErrorMsg("Network error — please try again.");
    }
  };

  const handleCopy = () => {
    if (!blueprint?.content) return;
    const c = blueprint.content;
    const text = [
      "NATAL HEALTH BLUEPRINT",
      `Generated: ${new Date(blueprint.updatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
      "",
      "CONSTITUTION OVERVIEW",
      c.constitutionOverview,
      "",
      "1ST HOUSE / ASCENDANT — BODY AND VITALITY",
      c.ascendantBodyVitality,
      "",
      "MOON — BODY RHYTHM, FLUIDS, NEEDS",
      c.moonBodyRhythm,
      "",
      "6TH HOUSE — HEALTH PATTERNS AND ROUTINE",
      c.sixthHousePatterns,
      "",
      "2ND HOUSE — DIET, INTAKE, NOURISHMENT",
      c.secondHouseIntake,
      "",
      "8TH HOUSE — CHRONICITY AND HIDDEN PROCESSES",
      c.eighthHouseProcesses,
      "",
      "10TH HOUSE — THERAPIES AND SUPPORT DIRECTION",
      c.tenthHouseTherapies,
      "",
      "MARS AND SATURN — STRESS AND DEPLETION SIGNATURES",
      c.marsSaturnStress,
      "",
      "VENUS AND JUPITER — RESTORATION AND SUPPORT",
      c.venusJupiterSupport,
      "",
      "CONTRADICTIONS AND MIXED TESTIMONY",
      c.contradictionsMixedTestimony,
      "",
      "WHAT TO TRACK",
      ...(c.whatToTrack ?? []).map((t) => `• ${t}`),
      "",
      "SUPPORTIVE PRINCIPLES",
      ...(c.supportivePrinciples ?? []).map((p) => `• ${p}`),
      "",
      "SAFETY NOTE",
      c.safetyNote,
    ].join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const generatedDate = blueprint
    ? new Date(blueprint.updatedAt).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      })
    : null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <Scroll className="w-4 h-4 text-primary" />
          </div>
          <h1 className="font-serif text-2xl text-foreground tracking-wide">Natal Blueprint</h1>
        </div>
        <p className="text-sm text-muted-foreground pl-11">
          A structured medical astrology analysis of your natal chart, generated for pattern awareness and self-tracking.
        </p>
      </div>

      {/* No natal chart state */}
      {pageState === "no_natal_chart" && (
        <div className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm p-10 text-center space-y-4">
          <Star className="w-8 h-8 text-muted-foreground/40 mx-auto" />
          <div>
            <p className="text-foreground font-medium mb-1">No natal chart saved yet</p>
            <p className="text-sm text-muted-foreground">
              Add your birth data first to generate your blueprint.
            </p>
          </div>
          <Link
            href="/natal"
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 border border-primary/30 hover:border-primary/50 px-4 py-2 rounded-lg transition-colors"
          >
            Go to Natal Chart
          </Link>
        </div>
      )}

      {/* Loading state */}
      {pageState === "loading" && (
        <div className="flex justify-center p-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary/50" />
        </div>
      )}

      {/* Generating state */}
      {pageState === "generating" && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 backdrop-blur-sm p-10 text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <div>
            <p className="text-foreground font-medium mb-1">Generating your blueprint…</p>
            <p className="text-sm text-muted-foreground">
              This takes 20–40 seconds. The AI is reading your full natal chart.
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {pageState === "error" && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm text-foreground/80">{errorMsg || "Something went wrong."}</p>
            <button
              onClick={() => handleGenerate(true)}
              className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Empty state — no blueprint yet */}
      {pageState === "empty" && (
        <div className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-primary/8 border border-primary/15 flex items-center justify-center mx-auto">
            <Scroll className="w-5 h-5 text-primary/60" />
          </div>
          <div>
            <p className="text-foreground font-medium mb-1">Your blueprint hasn't been generated yet</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              This is a one-time AI analysis of your natal chart across 12 health dimensions. It takes about 30 seconds.
            </p>
          </div>
          <button
            onClick={() => handleGenerate(false)}
            className="inline-flex items-center gap-2 text-sm font-medium bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 hover:border-primary/50 px-5 py-2.5 rounded-lg transition-colors"
          >
            <Scroll className="w-4 h-4" />
            Generate Blueprint
          </button>
        </div>
      )}

      {/* Ready state — blueprint content */}
      {pageState === "ready" && blueprint?.content && (
        <>
          {/* Action bar */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Generated {generatedDate}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/50 hover:border-border px-3 py-1.5 rounded-lg transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-chart-2" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied" : "Copy Report"}
              </button>
              <button
                onClick={() => handleGenerate(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/50 hover:border-border px-3 py-1.5 rounded-lg transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Regenerate
              </button>
            </div>
          </div>

          {/* Constitution Overview — hero card */}
          <div className="rounded-xl border border-primary/25 bg-primary/5 backdrop-blur-sm p-6">
            <h3 className="text-xs uppercase tracking-widest text-primary font-medium mb-3">
              Constitution Overview
            </h3>
            <p className="text-sm text-foreground/85 leading-relaxed">
              {blueprint.content.constitutionOverview}
            </p>
          </div>

          {/* House + planet sections — 2-column grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SectionCard
              label="1st House / Ascendant — Body &amp; Vitality"
              text={blueprint.content.ascendantBodyVitality}
            />
            <SectionCard
              label="Moon — Body Rhythm &amp; Needs"
              text={blueprint.content.moonBodyRhythm}
            />
            <SectionCard
              label="6th House — Health Patterns &amp; Routine"
              text={blueprint.content.sixthHousePatterns}
            />
            <SectionCard
              label="2nd House — Diet &amp; Nourishment"
              text={blueprint.content.secondHouseIntake}
            />
            <SectionCard
              label="8th House — Chronicity &amp; Hidden Processes"
              text={blueprint.content.eighthHouseProcesses}
            />
            <SectionCard
              label="10th House — Therapies &amp; Support Direction"
              text={blueprint.content.tenthHouseTherapies}
            />
            <SectionCard
              label="Mars &amp; Saturn — Stress &amp; Depletion"
              text={blueprint.content.marsSaturnStress}
            />
            <SectionCard
              label="Venus &amp; Jupiter — Restoration &amp; Support"
              text={blueprint.content.venusJupiterSupport}
            />
          </div>

          {/* Contradictions — full width, amber accent */}
          <SectionCard
            label="Contradictions &amp; Mixed Testimony"
            text={blueprint.content.contradictionsMixedTestimony}
            accent="amber"
          />

          {/* Lists — 2-column */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ListCard
              label="What to Track"
              items={blueprint.content.whatToTrack ?? []}
              accent="teal"
            />
            <ListCard
              label="Supportive Principles"
              items={blueprint.content.supportivePrinciples ?? []}
            />
          </div>

          {/* Safety note */}
          <div className="rounded-xl border border-border/20 bg-muted/10 backdrop-blur-sm p-5">
            <p className="text-xs text-muted-foreground/70 leading-relaxed italic">
              {blueprint.content.safetyNote}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
