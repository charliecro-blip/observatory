import React, { useState, useEffect, useMemo } from "react";
import {
  useGetTodayCheckIn,
  useUpsertCheckIn,
  getGetTodayCheckInQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2, Circle, Save, ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// ── Tag data ──────────────────────────────────────────────────────────────────

interface TagCategory {
  name: string;
  tags: string[];
}

const SYMPTOM_CATEGORIES: TagCategory[] = [
  {
    name: "Digestive",
    tags: [
      "Bloating", "Nausea", "Constipation", "Loose stool", "Reflux",
      "Low appetite", "Strong appetite", "Food cravings", "Heavy/sluggish after eating",
      "Abdominal pain", "Gas", "Dry stool", "Undigested food",
    ],
  },
  {
    name: "Energy / Fatigue",
    tags: [
      "Fatigue", "Wired but tired", "Heavy body", "Weakness",
      "Afternoon crash", "Low motivation", "Restless energy", "Burnout feeling",
    ],
  },
  {
    name: "Nervous System / Mood",
    tags: [
      "Anxiety", "Irritability", "Low mood", "Emotional sensitivity", "Restlessness",
      "Brain fog", "Racing thoughts", "Scattered focus", "Panic feeling",
      "Grief", "Anger", "Overwhelm", "Dissociation/numbness", "Weepiness", "Social sensitivity",
    ],
  },
  {
    name: "Sleep",
    tags: [
      "Insomnia", "Trouble falling asleep", "Waking during night", "Early waking",
      "Vivid dreams", "Night sweats", "Unrefreshing sleep",
    ],
  },
  {
    name: "Pain / Body",
    tags: [
      "Headache", "Neck tension", "Jaw tension", "Shoulder tension", "Chest tightness",
      "Rib-side pain", "Low back ache", "Hip/pelvic tension", "Joint pain",
      "Muscle soreness", "Body aches", "Testicular/pelvic discomfort", "Eye strain", "Dizziness",
    ],
  },
  {
    name: "Heat / Inflammation",
    tags: [
      "Feeling hot", "Flushing", "Skin breakout", "Redness", "Itching",
      "Cyst/pimple flare", "Sore throat", "Mouth sores", "Burning sensation", "Increased thirst",
    ],
  },
  {
    name: "Cold / Deficiency",
    tags: [
      "Feeling cold", "Cold hands/feet", "Low libido", "Low warmth", "Pale/washed out", "Need for warmth",
    ],
  },
  {
    name: "Damp / Phlegm",
    tags: [
      "Congestion", "Mucus/phlegm", "Sinus pressure", "Swelling/puffiness",
      "Heaviness", "Cloudy mind", "Damp/sticky feeling",
    ],
  },
  {
    name: "Circulation",
    tags: [
      "Sharp pain", "Fixed pain", "Purple/dark marks", "Visible capillaries",
      "Numbness/tingling", "Stagnant feeling", "Chest pressure",
    ],
  },
  {
    name: "Urinary / Reproductive",
    tags: [
      "Frequent urination", "Dark urine", "Low urination", "Menstrual symptoms",
      "PMS", "Cramps", "Breast tenderness", "Libido high", "Libido low",
    ],
  },
  {
    name: "Breath / Heart",
    tags: [
      "Shortness of breath", "Palpitations", "Air hunger", "Heart racing",
    ],
  },
];

const BEHAVIOR_CATEGORIES: TagCategory[] = [
  {
    name: "Food / Substances",
    tags: [
      "Caffeine", "Alcohol", "Cannabis", "Sugar", "Heavy meal", "Fried/greasy food",
      "Dairy", "Gluten", "Spicy food", "Cold/raw food", "Late meal", "Fasting",
      "Low protein", "High protein", "Ate out", "Hydrated well", "Dehydrated",
    ],
  },
  {
    name: "Movement / Body Care",
    tags: [
      "Exercise", "Heavy workout", "Gentle walk", "Stretching", "Yoga",
      "Somatic movement", "Martial arts", "Sauna", "Hot bath", "Cold plunge",
      "Breathwork", "Meditation", "Acupuncture", "Herbs/supplements",
      "Massage/bodywork", "Sunlight", "Poor posture", "Long drive",
    ],
  },
  {
    name: "Life Context",
    tags: [
      "Social event", "Conflict", "Travel", "Overwork", "Client sessions",
      "Class/studying", "Deadline pressure", "Creative flow", "Screen overload",
      "Poor sleep night before", "Rest day", "Alone time", "Dating/romance",
      "Family stress", "Money stress", "Grief/emotional processing", "Crying",
      "Sex", "Big decision", "Cleaning/organizing",
    ],
  },
  {
    name: "Environment",
    tags: [
      "Heat exposure", "Cold exposure", "Weather shift", "Allergens",
      "Mold/damp environment", "Poor air quality", "Loud environment",
    ],
  },
];

// ── Slider config ─────────────────────────────────────────────────────────────

const SLIDER_FIELDS = [
  { key: "energy", label: "Energy", low: "Depleted", high: "Vibrant" },
  { key: "mood", label: "Mood", low: "Very low", high: "Excellent" },
  { key: "stress", label: "Stress", low: "None", high: "Overwhelming" },
  { key: "focus", label: "Focus", low: "Scattered", high: "Sharp" },
  { key: "digestion", label: "Digestion", low: "Very poor", high: "Smooth" },
  { key: "sleepQuality", label: "Sleep Quality", low: "Very poor", high: "Excellent" },
  { key: "pain", label: "Body Pain / Discomfort", low: "None", high: "Severe" },
  { key: "regulation", label: "Nervous System Regulation", low: "Dysregulated", high: "Calm" },
] as const;

type SliderKey = (typeof SLIDER_FIELDS)[number]["key"];
type Scores = Record<SliderKey, number>;

const DEFAULT_SCORES: Scores = {
  energy: 5, mood: 5, stress: 5, focus: 5,
  digestion: 5, sleepQuality: 5, pain: 1, regulation: 5,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreSlider({
  label, low, high, value, onChange,
}: {
  label: string;
  low: string;
  high: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const color =
    value <= 3 ? "text-chart-3" : value <= 6 ? "text-chart-4" : "text-chart-2";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground/90">{label}</span>
        <span className={`text-lg font-mono font-bold leading-none ${color}`}>{value}</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 appearance-none rounded-full bg-muted/60 accent-primary cursor-pointer"
      />
      <div className="flex justify-between text-xs text-muted-foreground/40">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

function TagPill({
  label, selected, onClick, variant = "symptom",
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  variant?: "symptom" | "behavior";
}) {
  const activeClass =
    variant === "symptom"
      ? "bg-chart-3/20 text-chart-3 border-chart-3/40"
      : "bg-primary/15 text-primary border-primary/40";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
        selected
          ? activeClass
          : "bg-muted/30 text-muted-foreground border-border/40 hover:border-primary/30 hover:text-foreground/80"
      }`}
    >
      {label}
    </button>
  );
}

function CategorySection({
  category,
  selected,
  onToggle,
  isOpen,
  onOpenToggle,
  variant,
}: {
  category: TagCategory;
  selected: string[];
  onToggle: (tag: string) => void;
  isOpen: boolean;
  onOpenToggle: () => void;
  variant: "symptom" | "behavior";
}) {
  const selectedInCategory = category.tags.filter((t) => selected.includes(t));
  const count = selectedInCategory.length;

  return (
    <div className="border border-border/30 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onOpenToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/10 hover:bg-muted/20 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-medium text-foreground/80">{category.name}</span>
          {count > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              variant === "symptom"
                ? "bg-chart-3/20 text-chart-3"
                : "bg-primary/15 text-primary"
            }`}>
              {count}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="px-4 py-3 flex flex-wrap gap-2 border-t border-border/20 bg-card/30">
          {category.tags.map((tag) => (
            <TagPill
              key={tag}
              label={tag}
              selected={selected.includes(tag)}
              onClick={() => onToggle(tag)}
              variant={variant}
            />
          ))}
        </div>
      )}

      {!isOpen && count > 0 && (
        <div className="px-4 py-2.5 flex flex-wrap gap-1.5 border-t border-border/15 bg-card/20">
          {selectedInCategory.map((tag) => (
            <TagPill
              key={tag}
              label={tag}
              selected
              onClick={() => onToggle(tag)}
              variant={variant}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Track() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: existing,
    isLoading,
    isError,
  } = useGetTodayCheckIn({ query: { retry: false } });

  const upsertCheckIn = useUpsertCheckIn();

  const [scores, setScores] = useState<Scores>(DEFAULT_SCORES);
  const [symptomTags, setSymptomTags] = useState<string[]>([]);
  const [behaviorTags, setBehaviorTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [populated, setPopulated] = useState(false);

  const [symptomSearch, setSymptomSearch] = useState("");
  const [openSymptomCats, setOpenSymptomCats] = useState<Set<string>>(new Set());
  const [openBehaviorCats, setOpenBehaviorCats] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (existing && !populated) {
      setScores({
        energy: existing.energy ?? 5,
        mood: existing.mood ?? 5,
        stress: existing.stress ?? 5,
        focus: existing.focus ?? 5,
        digestion: existing.digestion ?? 5,
        sleepQuality: existing.sleepQuality ?? 5,
        pain: existing.pain ?? 1,
        regulation: existing.regulation ?? 5,
      });
      setSymptomTags((existing.symptomTags as string[]) ?? []);
      setBehaviorTags((existing.behaviorTags as string[]) ?? []);
      setNotes(existing.notes ?? "");
      setPopulated(true);
    }
  }, [existing, populated]);

  const toggleSymptom = (tag: string) =>
    setSymptomTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const toggleBehavior = (tag: string) =>
    setBehaviorTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const toggleSymptomCat = (name: string) =>
    setOpenSymptomCats((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const toggleBehaviorCat = (name: string) =>
    setOpenBehaviorCats((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  // Search: flat list of all symptom tags that match the query
  const searchResults = useMemo(() => {
    if (!symptomSearch.trim()) return null;
    const q = symptomSearch.toLowerCase();
    return SYMPTOM_CATEGORIES.flatMap((c) =>
      c.tags.filter((t) => t.toLowerCase().includes(q))
    );
  }, [symptomSearch]);

  const handleSave = () => {
    upsertCheckIn.mutate(
      {
        data: {
          ...scores,
          symptomTags,
          behaviorTags,
          notes: notes || null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTodayCheckInQueryKey() });
          setPopulated(false);
          toast({ title: "Check-in saved" });
        },
        onError: () => {
          toast({ title: "Save failed", description: "Please try again.", variant: "destructive" });
        },
      }
    );
  };

  const isComplete = !isLoading && !isError && !!existing;
  const savedAt = existing ? format(new Date(existing.updatedAt), "h:mm a") : null;
  const totalSymptoms = symptomTags.length;
  const totalBehaviors = behaviorTags.length;

  return (
    <div className="p-8 max-w-3xl mx-auto pb-16 flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-serif text-foreground tracking-tight">Daily Check-In</h1>
          <p className="text-muted-foreground mt-1">How is your body today?</p>
        </div>
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : isComplete ? (
          <div className="flex items-center gap-2 text-chart-2 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Saved {savedAt}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Circle className="w-4 h-4" />
            No check-in yet today
          </div>
        )}
      </div>

      {/* Sliders */}
      <div className="rounded-2xl bg-card/60 border border-border/50 backdrop-blur-md p-6 flex flex-col gap-6">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
          How you feel today
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {SLIDER_FIELDS.map(({ key, label, low, high }) => (
            <ScoreSlider
              key={key}
              label={label}
              low={low}
              high={high}
              value={scores[key]}
              onChange={(v) => setScores((prev) => ({ ...prev, [key]: v }))}
            />
          ))}
        </div>
      </div>

      {/* Symptom tags */}
      <div className="rounded-2xl bg-card/60 border border-border/50 backdrop-blur-md p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Symptoms
            </h2>
            {totalSymptoms > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-chart-3/20 text-chart-3 font-medium">
                {totalSymptoms} selected
              </span>
            )}
          </div>
          {totalSymptoms > 0 && (
            <button
              type="button"
              onClick={() => setSymptomTags([])}
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
          <input
            type="text"
            value={symptomSearch}
            onChange={(e) => setSymptomSearch(e.target.value)}
            placeholder="Search symptoms..."
            className="w-full pl-8 pr-8 py-2 text-sm bg-background/40 border border-border/40 rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 transition-colors"
          />
          {symptomSearch && (
            <button
              type="button"
              onClick={() => setSymptomSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search results or categorized accordion */}
        {searchResults !== null ? (
          searchResults.length === 0 ? (
            <p className="text-sm text-muted-foreground/50 text-center py-3">No symptoms match "{symptomSearch}"</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {searchResults.map((tag) => (
                <TagPill
                  key={tag}
                  label={tag}
                  selected={symptomTags.includes(tag)}
                  onClick={() => toggleSymptom(tag)}
                  variant="symptom"
                />
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col gap-2">
            {SYMPTOM_CATEGORIES.map((cat) => (
              <CategorySection
                key={cat.name}
                category={cat}
                selected={symptomTags}
                onToggle={toggleSymptom}
                isOpen={openSymptomCats.has(cat.name)}
                onOpenToggle={() => toggleSymptomCat(cat.name)}
                variant="symptom"
              />
            ))}
          </div>
        )}
      </div>

      {/* Behavior/context tags */}
      <div className="rounded-2xl bg-card/60 border border-border/50 backdrop-blur-md p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
              Context &amp; behaviors
            </h2>
            {totalBehaviors > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                {totalBehaviors} selected
              </span>
            )}
          </div>
          {totalBehaviors > 0 && (
            <button
              type="button"
              onClick={() => setBehaviorTags([])}
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {BEHAVIOR_CATEGORIES.map((cat) => (
            <CategorySection
              key={cat.name}
              category={cat}
              selected={behaviorTags}
              onToggle={toggleBehavior}
              isOpen={openBehaviorCats.has(cat.name)}
              onOpenToggle={() => toggleBehaviorCat(cat.name)}
              variant="behavior"
            />
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-2xl bg-card/60 border border-border/50 backdrop-blur-md p-6 flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
          Notes
        </h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What happened today? Anything notable about your body, mind, or environment..."
          className="w-full min-h-[100px] bg-background/40 border border-border/50 rounded-lg p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary/50 transition-colors leading-relaxed"
        />
      </div>

      {/* Save */}
      <Button
        onClick={handleSave}
        disabled={upsertCheckIn.isPending}
        size="lg"
        className="w-full gap-2"
      >
        {upsertCheckIn.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {isComplete ? "Update today's check-in" : "Save today's check-in"}
      </Button>
    </div>
  );
}
