import { useState, useEffect } from "react";
import { useTester } from "@/contexts/tester-context";
import {
  useGetSupportPreferences,
  useUpdateSupportPreferences,
  getGetSupportPreferencesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Check, Leaf } from "lucide-react";

interface SupportCategory {
  value: string;
  label: string;
  description: string;
  note?: string;
}

const SUPPORT_CATEGORIES: SupportCategory[] = [
  {
    value: "food-rhythm",
    label: "Food Rhythm & Nourishment",
    description: "Meal timing, nourishing foods, eating rhythm",
  },
  {
    value: "rest-sleep",
    label: "Rest & Sleep Hygiene",
    description: "Sleep rituals, wind-down practices, rest quality",
  },
  {
    value: "movement",
    label: "Movement Practices",
    description: "Walking, stretching, embodied movement",
  },
  {
    value: "somatic",
    label: "Somatic Practices",
    description: "Body-based awareness, grounding, felt-sense work",
  },
  {
    value: "meditation",
    label: "Meditation",
    description: "Stillness practices, mindfulness, presence",
  },
  {
    value: "breathwork",
    label: "Breathwork",
    description: "Conscious breathing, nervous system regulation",
  },
  {
    value: "guided-visualization",
    label: "Guided Visualization",
    description: "Imagery practices, inner landscape work",
  },
  {
    value: "journaling",
    label: "Journaling",
    description: "Written reflection, tracking, processing",
  },
  {
    value: "acupressure",
    label: "Acupressure",
    description: "Self-applied pressure point work",
  },
  {
    value: "aromatherapy",
    label: "Aromatherapy",
    description: "Essential oils and scent-based support",
  },
  {
    value: "herbal-research",
    label: "Herbal Research",
    description: "Categories to explore with qualified guidance",
    note: "Observatory suggests herbal categories to research with a qualified practitioner — never specific herbs or dosages.",
  },
  {
    value: "creative-practice",
    label: "Creative Practice",
    description: "Art, music, writing, expressive work",
  },
  {
    value: "social-boundary",
    label: "Social & Boundary Practices",
    description: "Connection rhythms, rest from social demands",
  },
];

function CategoryCard({
  category,
  enabled,
  onToggle,
  saving,
}: {
  category: SupportCategory;
  enabled: boolean;
  onToggle: () => void;
  saving: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={saving}
      className={`w-full text-left rounded-xl border p-4 transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-chart-2/40 disabled:opacity-60 ${
        enabled
          ? "border-chart-2/40 bg-chart-2/8"
          : "border-border/30 bg-card/30 hover:border-border/50 hover:bg-card/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
            enabled
              ? "bg-chart-2/60 border-chart-2/60"
              : "border-border/50 bg-transparent"
          }`}
        >
          {enabled && <Check className="w-3 h-3 text-background" strokeWidth={3} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug ${enabled ? "text-foreground" : "text-foreground/70"}`}>
            {category.label}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-0.5 leading-relaxed">
            {category.description}
          </p>
          {category.note && (
            <p className="text-xs text-amber-400/70 mt-1.5 leading-relaxed italic">
              {category.note}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

export default function Settings() {
  const { profile } = useTester();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const { data: prefs, isLoading } = useGetSupportPreferences({
    query: { queryKey: getGetSupportPreferencesQueryKey(), enabled: !!profile?.testerId },
  });

  const update = useUpdateSupportPreferences({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetSupportPreferencesQueryKey() });
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
      },
      onError: () => {
        toast({
          title: "Couldn't save preference",
          description: "Please try again.",
          variant: "destructive",
        });
      },
    },
  });

  useEffect(() => {
    if (prefs && !initialized) {
      setSelected(new Set(prefs.categories ?? []));
      setInitialized(true);
    }
  }, [prefs, initialized]);

  function toggle(value: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      update.mutate({ data: { categories: Array.from(next) } });
      return next;
    });
  }

  const selectedCount = selected.size;
  const saving = update.isPending;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">Support Preferences</h1>
          <span
            className={`text-xs px-2 py-0.5 rounded-full transition-all duration-500 ${
              savedFlash
                ? "bg-chart-2/20 text-chart-2 opacity-100"
                : "opacity-0"
            }`}
          >
            saved
          </span>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Choose the kinds of support Observatory may suggest. Body Weather and other insights
          will only draw from categories you've selected.
        </p>
        {!isLoading && selectedCount === 0 && (
          <p className="text-xs text-amber-400/70 pt-1">
            No categories selected — Observatory will suggest from any appropriate area.
          </p>
        )}
        {selectedCount > 0 && (
          <p className="text-xs text-chart-2/70 pt-1">
            {selectedCount} {selectedCount === 1 ? "category" : "categories"} selected
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-border/20 bg-card/20 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUPPORT_CATEGORIES.map((cat) => (
            <CategoryCard
              key={cat.value}
              category={cat}
              enabled={selected.has(cat.value)}
              onToggle={() => toggle(cat.value)}
              saving={saving}
            />
          ))}
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-border/20 bg-card/20 p-4">
        <Leaf className="w-4 h-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground/60 leading-relaxed">
          Observatory does not provide medical advice. All suggestions are informational and
          supportive only. For health-related decisions, work with qualified practitioners.
        </p>
      </div>
    </div>
  );
}
