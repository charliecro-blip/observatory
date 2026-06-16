import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  useGetNatalChart,
  useUpsertNatalChart,
  useGetNatalHealthInsights,
  useGetNatalTransits,
  getGetNatalChartQueryKey,
  getGetNatalHealthInsightsQueryKey,
  getGetNatalTransitsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Loader2, Star, AlertCircle, Zap, Shield, TrendingUp,
  Edit2, ChevronDown, ChevronUp, MapPin, Search, X, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTester } from "@/contexts/tester-context";

const HOUSE_ICONS: Record<number, React.ReactNode> = {
  1: <Shield className="w-4 h-4" />,
  6: <AlertCircle className="w-4 h-4" />,
  10: <TrendingUp className="w-4 h-4" />,
};

const HOUSE_LABELS: Record<number, string> = {
  1: "1st House — Body & Vitality",
  6: "6th House — Health & Healing",
  10: "10th House — Purpose Vitality",
};

const HOUSE_SUBTITLES: Record<number, string> = {
  1: "Your physical constitution, body type, and therapeutic styles",
  6: "Health vulnerabilities, healing needs, and daily wellness requirements",
  10: "How your vocation and purpose connect to your vitality",
};

const HOUSE_COLORS: Record<number, string> = {
  1: "border-chart-2/30 bg-chart-2/5",
  6: "border-chart-3/30 bg-chart-3/5",
  10: "border-chart-1/30 bg-chart-1/5",
};

const ASPECT_COLORS: Record<string, string> = {
  Conjunction: "text-chart-1",
  Trine: "text-chart-2",
  Sextile: "text-chart-2",
  Square: "text-chart-3",
  Opposition: "text-chart-3",
};

interface LocationResult {
  displayName: string;
  city: string | null;
  state: string | null;
  country: string | null;
  lat: number;
  lon: number;
  timezoneName: string | null;
  utcOffsetStandard: number | null;
  utcOffsetDST: number | null;
  abbreviationSTD: string | null;
  abbreviationDST: string | null;
}

function isDSTActive(timezoneName: string, birthDate: string): boolean | null {
  if (!birthDate || !timezoneName) return null;
  try {
    const date = new Date(birthDate + "T12:00:00");
    const janOffset = new Intl.DateTimeFormat("en-US", {
      timeZone: timezoneName,
      timeZoneName: "shortOffset",
    })
      .formatToParts(new Date(birthDate.split("-")[0] + "-01-15T12:00:00"))
      .find((p) => p.type === "timeZoneName")?.value;

    const dateOffset = new Intl.DateTimeFormat("en-US", {
      timeZone: timezoneName,
      timeZoneName: "shortOffset",
    })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value;

    return janOffset !== dateOffset;
  } catch {
    return null;
  }
}

// ── House Insight Card ─────────────────────────────────────────────────────────

function HouseInsightCard({ insight, houseNumber }: { insight: any; houseNumber: number }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = HOUSE_COLORS[houseNumber] ?? "border-border/30 bg-card/40";

  return (
    <div className={`rounded-2xl border ${colorClass} backdrop-blur-md p-6 flex flex-col gap-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={houseNumber === 6 ? "text-chart-3" : houseNumber === 1 ? "text-chart-2" : "text-chart-1"}>
              {HOUSE_ICONS[houseNumber]}
            </span>
            <h3 className="font-serif text-lg text-foreground">{HOUSE_LABELS[houseNumber]}</h3>
          </div>
          <p className="text-xs text-muted-foreground">{HOUSE_SUBTITLES[houseNumber]}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-serif text-foreground">{insight.sign}</p>
          <p className="text-xs text-muted-foreground">Ruler: {insight.ruler} in {insight.rulerSign} (H{insight.rulerHouse})</p>
        </div>
      </div>

      {insight.planetsInHouse.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {insight.planetsInHouse.map((p: string) => (
            <span key={p} className="text-xs px-2.5 py-1 rounded-full bg-accent/40 border border-border/40 text-accent-foreground">
              {p} in H{houseNumber}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {(expanded ? insight.themes : insight.themes.slice(0, 2)).map((theme: string, i: number) => (
          <p key={i} className="text-sm text-foreground/80 leading-relaxed pl-3 border-l-2 border-primary/20">
            {theme}
          </p>
        ))}
        {insight.themes.length > 2 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary mt-1 w-fit"
          >
            {expanded
              ? <><ChevronUp className="w-3 h-3" /> Show less</>
              : <><ChevronDown className="w-3 h-3" /> {insight.themes.length - 2} more insights</>}
          </button>
        )}
      </div>

      {insight.currentActivations.length > 0 && (
        <div className="border-t border-border/30 pt-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2">Now Active</p>
          {insight.currentActivations.map((a: string, i: number) => (
            <div key={i} className="flex items-start gap-2 mb-1.5">
              <Zap className="w-3 h-3 text-chart-1 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/70 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Place Search Hook ──────────────────────────────────────────────────────────

function usePlaceSearch(testerId: string) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cache = useRef<Map<string, LocationResult[]>>(new Map());

  const search = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (q.length < 3) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      debounceRef.current = setTimeout(async () => {
        if (cache.current.has(q)) {
          setResults(cache.current.get(q)!);
          setLoading(false);
          return;
        }
        try {
          const res = await fetch(`/api/location-search?q=${encodeURIComponent(q)}`, {
            headers: { "x-tester-id": testerId },
          });
          if (res.status === 503) {
            setUnavailable(true);
            setResults([]);
            return;
          }
          const data: LocationResult[] = res.ok ? await res.json() : [];
          cache.current.set(q, data);
          setResults(data);
        } catch {
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 350);
    },
    [testerId],
  );

  useEffect(() => {
    search(query);
  }, [query, search]);

  const clear = () => {
    setQuery("");
    setResults([]);
  };

  return { query, setQuery, results, loading, unavailable, clear };
}

// ── Birth Data Form ────────────────────────────────────────────────────────────

function BirthDataForm({ onSave, existing }: { onSave: () => void; existing?: any }) {
  const upsert = useUpsertNatalChart();
  const { toast } = useToast();
  const { testerId } = useTester();

  const [form, setForm] = useState({
    birthDate: existing?.birthDate ?? "",
    birthTime: existing?.birthTime ?? "",
    birthPlace: existing?.birthPlace ?? "",
    birthLat: existing?.birthLat?.toString() ?? "",
    birthLon: existing?.birthLon?.toString() ?? "",
    utcOffset: existing?.utcOffset?.toString() ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tzNote, setTzNote] = useState<string | null>(null);

  // Track whether a location has been selected from search
  const [selectedLoc, setSelectedLoc] = useState<LocationResult | null>(
    existing?.birthPlace ? ({ displayName: existing.birthPlace } as LocationResult) : null,
  );

  const { query, setQuery, results, loading: searchLoading, unavailable, clear: clearSearch } = usePlaceSearch(testerId);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Open dropdown when results arrive
  useEffect(() => {
    if (results.length > 0) setDropdownOpen(true);
    else if (query.length < 3) setDropdownOpen(false);
  }, [results, query]);

  const selectLocation = (loc: LocationResult) => {
    const lat = loc.lat.toFixed(4);
    const lon = loc.lon.toFixed(4);
    let utcOffset = "";
    let note: string | null = null;

    if (loc.utcOffsetStandard !== null && loc.timezoneName) {
      const dst = form.birthDate ? isDSTActive(loc.timezoneName, form.birthDate) : null;
      if (dst === true && loc.utcOffsetDST !== null) {
        utcOffset = loc.utcOffsetDST.toString();
        note = `DST was likely active on your birth date — filled ${loc.abbreviationDST ?? "DST"} (${loc.utcOffsetDST > 0 ? "+" : ""}${loc.utcOffsetDST}). Adjust below if needed.`;
      } else if (dst === false) {
        utcOffset = loc.utcOffsetStandard.toString();
        note = `Standard time applied — filled ${loc.abbreviationSTD ?? "STD"} (${loc.utcOffsetStandard > 0 ? "+" : ""}${loc.utcOffsetStandard}). Adjust below if needed.`;
      } else {
        utcOffset = loc.utcOffsetStandard.toString();
        note = `Filled standard time offset (${loc.abbreviationSTD}, ${loc.utcOffsetStandard > 0 ? "+" : ""}${loc.utcOffsetStandard}). Enter birth date first for DST detection, or adjust manually.`;
      }
    } else {
      note = "Timezone unavailable — enter UTC offset manually below. CST −6 · CDT −5 · EST −5 · EDT −4 · GMT 0 · BST +1.";
    }

    setForm((p) => ({ ...p, birthPlace: loc.displayName, birthLat: lat, birthLon: lon, utcOffset }));
    setTzNote(note);
    setSelectedLoc(loc);
    // Fix: was { ...n, ...p } which crashed (n undefined). Correct is { ...prev }.
    setErrors((prev) => {
      const next = { ...prev };
      delete next.birthPlace;
      delete next.birthLat;
      delete next.birthLon;
      if (utcOffset) delete next.utcOffset;
      return next;
    });
    setDropdownOpen(false);
    clearSearch();
  };

  const resetLocation = () => {
    setSelectedLoc(null);
    setTzNote(null);
    setForm((p) => ({ ...p, birthPlace: "", birthLat: "", birthLon: "", utcOffset: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.birthDate) e.birthDate = "Birth date is required";
    if (!form.birthPlace.trim()) e.birthPlace = "Search and select a birthplace above, or type a city name";
    const lat = parseFloat(form.birthLat);
    if (form.birthLat === "" || isNaN(lat) || lat < -90 || lat > 90)
      e.birthLat = "Enter a valid latitude (−90 to 90)";
    const lon = parseFloat(form.birthLon);
    if (form.birthLon === "" || isNaN(lon) || lon < -180 || lon > 180)
      e.birthLon = "Enter a valid longitude (−180 to 180)";
    const utc = parseFloat(form.utcOffset);
    if (form.utcOffset === "" || isNaN(utc) || utc < -12 || utc > 14)
      e.utcOffset = "Enter a valid UTC offset (−12 to +14)";
    return e;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    upsert.mutate(
      {
        data: {
          birthDate: form.birthDate,
          birthTime: form.birthTime || "12:00",
          birthPlace: form.birthPlace.trim(),
          birthLat: parseFloat(form.birthLat),
          birthLon: parseFloat(form.birthLon),
          utcOffset: parseFloat(form.utcOffset),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Natal chart saved" });
          onSave();
        },
        onError: () => toast({ title: "Save failed", variant: "destructive" }),
      },
    );
  };

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
    setErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
          <Star className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-serif text-foreground">
          {existing ? "Update Birth Data" : "Enter Your Birth Data"}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Your natal chart reveals your constitutional health blueprint — the body you were born into and the healing path written in your chart.
        </p>
      </div>

      {/* ── Step 1: Birthplace search — OUTSIDE the card so the dropdown has no stacking context clipping ── */}
      <div className="mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <MapPin className="w-3 h-3" /> Step 1 — Find your birthplace
        </p>

        {unavailable ? (
          <div className="rounded-xl border border-border/40 bg-card/60 p-3 text-xs text-muted-foreground">
            Birthplace search unavailable. Enter coordinates manually in the form below.
          </div>
        ) : selectedLoc ? (
          /* Selected location pill */
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/8 border border-primary/30">
            <Check className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{form.birthPlace}</p>
              {form.birthLat && form.birthLon && (
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {parseFloat(form.birthLat).toFixed(4)}, {parseFloat(form.birthLon).toFixed(4)}
                  {form.utcOffset ? `  ·  UTC ${parseFloat(form.utcOffset) >= 0 ? "+" : ""}${form.utcOffset}` : ""}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={resetLocation}
              className="flex-shrink-0 text-xs text-muted-foreground hover:text-foreground border border-border/50 hover:border-border px-2.5 py-1 rounded-lg transition-colors"
            >
              Change
            </button>
          </div>
        ) : (
          /* Search input + dropdown — rendered here, not inside backdrop-blur card */
          <div className="relative" ref={searchWrapRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => results.length > 0 && setDropdownOpen(true)}
                placeholder="Type your birth city — e.g. Chicago, London, Mumbai…"
                autoComplete="off"
                className="w-full h-11 rounded-xl border border-border/70 bg-card/90 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all shadow-sm"
              />
              {searchLoading ? (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground/50" />
              ) : query.length > 0 ? (
                <button
                  type="button"
                  onClick={() => { clearSearch(); setDropdownOpen(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : null}
            </div>

            {/* Dropdown — high z-index, outside any backdrop-blur stacking context */}
            {(dropdownOpen || (query.length >= 3 && !searchLoading && results.length === 0)) && (
              <div
                className="absolute left-0 right-0 mt-1.5 rounded-xl border border-border/60 bg-popover shadow-2xl overflow-hidden"
                style={{ zIndex: 9999, top: "100%" }}
              >
                {results.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-muted-foreground">
                    No results found. Try a different spelling or nearby city.
                  </div>
                ) : (
                  <ul>
                    {results.map((loc, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          // Use onMouseDown so it fires before the input's onBlur closes the dropdown
                          onMouseDown={(e) => { e.preventDefault(); selectLocation(loc); }}
                          className="w-full text-left px-4 py-3 hover:bg-primary/8 active:bg-primary/15 border-b border-border/20 last:border-0 transition-colors flex items-start gap-3"
                        >
                          <MapPin className="w-3.5 h-3.5 text-primary/50 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{loc.displayName}</p>
                            {loc.timezoneName && (
                              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                                {loc.timezoneName} · {loc.abbreviationSTD} / {loc.abbreviationDST}
                              </p>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground/50 flex-shrink-0 pt-0.5 tabular-nums">
                            {loc.lat.toFixed(2)}, {loc.lon.toFixed(2)}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {query.length > 0 && query.length < 3 && (
              <p className="text-[10px] text-muted-foreground/50 mt-1.5 pl-1">Keep typing…</p>
            )}
          </div>
        )}

        {errors.birthPlace && <p className="text-xs text-destructive mt-1.5">{errors.birthPlace}</p>}
      </div>

      {/* ── Step 2 & 3 inside the card (no backdrop-blur to avoid stacking context) ── */}
      <form onSubmit={handleSubmit} className="space-y-5 bg-card/60 border border-border/40 rounded-2xl p-6">

        {/* Date & Time */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Star className="w-3 h-3" /> Step 2 — Birth date &amp; time
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Birth Date</Label>
              <Input
                type="date" required
                value={form.birthDate} onChange={f("birthDate")}
                className={`bg-background/60 ${errors.birthDate ? "border-destructive" : ""}`}
              />
              {errors.birthDate && <p className="text-xs text-destructive">{errors.birthDate}</p>}
            </div>
            <div className="space-y-2">
              <Label>Birth Time <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
              <Input
                type="time"
                value={form.birthTime} onChange={f("birthTime")}
                className="bg-background/60"
              />
              <p className="text-[10px] text-muted-foreground/60">Unknown? Leave blank (defaults to noon)</p>
            </div>
          </div>
        </div>

        {/* Coordinates & Timezone — secondary section, auto-filled from search */}
        <div className="border-t border-border/30 pt-5 space-y-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <MapPin className="w-3 h-3" /> Step 3 — Coordinates &amp; timezone
            <span className="text-[10px] font-normal normal-case ml-1 text-muted-foreground/50">(auto-filled from search · editable)</span>
          </p>

          {/* Place name — single editable field */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Place Name</Label>
            <Input
              required
              placeholder="e.g. Chicago, IL"
              value={form.birthPlace} onChange={f("birthPlace")}
              className="bg-background/60 text-sm"
            />
          </div>

          {/* Lat / Lon */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Latitude <span className="font-normal">(N+)</span></Label>
              <Input
                type="number" step="0.0001" min="-90" max="90" required
                placeholder="29.4241"
                value={form.birthLat} onChange={f("birthLat")}
                className={`bg-background/60 text-sm ${errors.birthLat ? "border-destructive" : ""}`}
              />
              {errors.birthLat && <p className="text-xs text-destructive">{errors.birthLat}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Longitude <span className="font-normal">(W–)</span></Label>
              <Input
                type="number" step="0.0001" min="-180" max="180" required
                placeholder="-98.4936"
                value={form.birthLon} onChange={f("birthLon")}
                className={`bg-background/60 text-sm ${errors.birthLon ? "border-destructive" : ""}`}
              />
              {errors.birthLon && <p className="text-xs text-destructive">{errors.birthLon}</p>}
            </div>
          </div>

          {/* UTC Offset */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">UTC Offset at Birth</Label>
            <Input
              type="number" step="0.5" min="-12" max="14" required
              placeholder="-6"
              value={form.utcOffset} onChange={f("utcOffset")}
              className={`bg-background/60 text-sm ${errors.utcOffset ? "border-destructive" : ""}`}
            />
            {tzNote ? (
              <p className="text-[11px] text-primary/70 leading-relaxed">{tzNote}</p>
            ) : (
              <p className="text-[10px] text-muted-foreground/50">
                CST −6 · CDT −5 · EST −5 · EDT −4 · GMT 0 · BST +1 · CET +1 · IST +5.5
              </p>
            )}
            {errors.utcOffset && <p className="text-xs text-destructive">{errors.utcOffset}</p>}
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={upsert.isPending}>
          {upsert.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {existing ? "Update Chart" : "Calculate My Natal Chart"}
        </Button>
      </form>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function Natal() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: chart, isLoading: chartLoading } = useGetNatalChart();
  const { data: insights, isLoading: insightsLoading } = useGetNatalHealthInsights({
    query: { enabled: !!chart },
  });
  const { data: transits, isLoading: transitsLoading } = useGetNatalTransits({
    query: { enabled: !!chart },
  });

  const handleSave = () => {
    queryClient.invalidateQueries({ queryKey: getGetNatalChartQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetNatalHealthInsightsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetNatalTransitsQueryKey() });
    setEditing(false);
  };

  const noChart = !chart && !chartLoading;

  if (chartLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (noChart || editing) {
    return (
      <div className="p-8 max-w-4xl mx-auto pb-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-4xl font-serif text-foreground tracking-tight">Natal Chart</h1>
            <p className="text-muted-foreground mt-1">Your astrological health blueprint.</p>
          </div>
          {editing && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
          )}
        </div>
        <BirthDataForm onSave={handleSave} existing={editing ? chart : undefined} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto pb-16 flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-serif text-foreground tracking-tight">Natal Chart</h1>
          <p className="text-muted-foreground mt-1">
            {chart.birthPlace} · {chart.birthDate} {chart.birthTime}
          </p>
          <span className="inline-block mt-1.5 text-xs px-2.5 py-0.5 rounded-full border border-primary/20 bg-primary/5 text-primary/70 font-medium tracking-wide">
            Regiomontanus Houses
          </span>
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setEditing(true)}>
          <Edit2 className="w-3.5 h-3.5" /> Edit
        </Button>
      </div>

      {/* ASC / MC / key points */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl bg-card/50 border border-primary/20 p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Ascendant</p>
          <p className="text-xl font-serif text-primary">{chart.ascendant.sign}</p>
          <p className="text-xs text-muted-foreground">{chart.ascendant.degree.toFixed(1)}°</p>
        </div>
        <div className="rounded-xl bg-card/50 border border-secondary/20 p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Midheaven</p>
          <p className="text-xl font-serif text-secondary-foreground">{chart.midheaven.sign}</p>
          <p className="text-xs text-muted-foreground">{chart.midheaven.degree.toFixed(1)}°</p>
        </div>
        {chart.planets.slice(0, 2).map((p: any) => (
          <div key={p.planet} className="rounded-xl bg-card/40 border border-border/30 p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{p.planet}</p>
            <p className="text-lg font-serif text-foreground">{p.sign}</p>
            <p className="text-xs text-muted-foreground">{p.degree.toFixed(1)}° H{p.houseNumber}</p>
          </div>
        ))}
      </div>

      {/* Full planet table */}
      <div className="rounded-2xl bg-card/40 border border-border/40 overflow-hidden">
        <div className="px-5 py-3 border-b border-border/30">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Natal Planets</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y divide-border/20">
          {chart.planets.map((p: any) => (
            <div key={p.planet} className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{p.planet}</p>
                <p className="text-sm font-medium text-foreground">{p.sign} {p.degree.toFixed(1)}°</p>
              </div>
              <span className="text-xs text-muted-foreground/60 bg-muted/30 px-2 py-0.5 rounded-full">H{p.houseNumber}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      {insights?.summary && (
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-5">
          <p className="text-sm text-foreground/80 leading-relaxed italic">"{insights.summary}"</p>
        </div>
      )}

      {/* Three house insights */}
      {insightsLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : insights ? (
        <div className="flex flex-col gap-5">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground font-medium">Your Health Blueprint</h2>
          <HouseInsightCard insight={insights.ascendant} houseNumber={1} />
          <HouseInsightCard insight={insights.sixthHouse} houseNumber={6} />
          <HouseInsightCard insight={insights.tenthHouse} houseNumber={10} />
        </div>
      ) : null}

      {/* Transit aspects */}
      <div>
        <h2 className="text-sm uppercase tracking-widest text-muted-foreground font-medium mb-4">Current Transits to Natal Chart</h2>
        {transitsLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : !transits || transits.length === 0 ? (
          <div className="rounded-xl border border-border/30 bg-card/30 p-8 text-center">
            <p className="text-muted-foreground text-sm">No significant transits at this time.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {transits.map((t: any, i: number) => (
              <div
                key={i}
                className={`flex flex-col gap-3 p-4 rounded-xl border backdrop-blur-sm transition-colors ${
                  t.severity === "major" ? "bg-violet-500/5 border-violet-500/20" :
                  t.severity === "strong" ? "bg-amber-500/5 border-amber-500/20" :
                  t.exact ? "bg-primary/5 border-primary/20" : "bg-card/40 border-border/30"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 text-right w-24">
                    <p className="text-sm font-medium text-foreground">{t.transitPlanet}</p>
                    <p className="text-xs text-muted-foreground">{t.transitSign}</p>
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-center gap-0.5 pt-0.5">
                    <span className={`text-xs font-medium ${ASPECT_COLORS[t.aspect] ?? "text-muted-foreground"}`}>
                      {t.aspect}
                    </span>
                    <span className="text-xs text-muted-foreground/50">{t.orb.toFixed(1)}°</span>
                  </div>
                  <div className="flex-shrink-0">
                    <p className="text-sm text-muted-foreground">natal {t.natalPlanet}</p>
                    <p className="text-xs text-muted-foreground/60">{t.natalSign} · H{t.natalHouse}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                    {t.severity && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        t.severity === "major"    ? "bg-violet-500/15 text-violet-400" :
                        t.severity === "strong"   ? "bg-amber-500/15 text-amber-400" :
                        t.severity === "moderate" ? "bg-blue-500/15 text-blue-400" :
                                                    "bg-muted/40 text-muted-foreground"
                      }`}>
                        {t.severity}
                      </span>
                    )}
                    {t.exact && (
                      <span className="text-xs text-primary font-medium">● exact</span>
                    )}
                  </div>
                </div>
                <div className="pl-28">
                  <p className="text-sm text-foreground/70 leading-relaxed">{t.healthNote}</p>
                  {t.likelyDomains && t.likelyDomains.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {t.likelyDomains.map((d: string) => (
                        <span key={d} className="text-xs text-muted-foreground/60 bg-muted/20 px-2 py-0.5 rounded-md">
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
