import { useState } from "react";
import { SIGN_MYTHOS, ELEMENT_MYTHOS, PLANET_MYTHOS } from "@/lib/mythos";
import { CURRICULUM } from "@/lib/sky-literacy";
import SpineGauge from "@/components/SpineGauge";
import { useTheme } from "@/contexts/theme-context";
import { elementColor } from "@/lib/elements";

// The reference — the book you look things up in. A plain-language "what does
// this mean" layer (elements, planets, signs, the curriculum) so the app is
// legible to someone who knows no astrology. It lives on the Planets page now
// that the Almanac tab is retired — one home for the sky's meanings. Extracted
// from pages/Sky.tsx when that page's last route died and the rest of the file
// (~450 lines of unreachable Almanac) was deleted.
export function ReferenceSection({ onStartStar, onVisitPlanet }: { onStartStar?: (element: string) => void; onVisitPlanet?: (planet: string) => void }) {
  const { theme } = useTheme();
  const [tab, setTab] = useState<"learn" | "elements" | "planets" | "signs">("learn");
  const [open, setOpen] = useState<string | null>(null);
  // The whole reference is a big block; let people fold it away when they're
  // here for the day's sky, not the textbook (owner #23: needs expand/contract).
  const [sectionOpen, setSectionOpen] = useState(false);

  const items: { key: string; glyph: string; name: string; sub: string; color: string; body: string; element?: string; planet?: string }[] =
    tab === "learn"
      // The sequenced primer — the curriculum ladder, rung by rung. Reading
      // ahead is allowed; living it is the actual course.
      ? CURRICULUM.map((l) => ({
          key: String(l.n), glyph: String(l.n), name: l.title, sub: l.essence, color: "#8a7050",
          body: `${l.body}\n\nPractice: ${l.practice}`,
        }))
      : tab === "elements"
      // Fuller read (#24): the myth, the life-domains it governs, and concrete
      // things you'd plan or log under it — all already in ELEMENT_MYTHOS, just
      // wasn't being surfaced here.
      ? (["fire", "earth", "air", "water"] as const).map((el) => {
          const m = ELEMENT_MYTHOS[el];
          return {
            key: el, glyph: "●", name: m.name, sub: m.essence, color: m.color, element: el,
            body: `${m.myth}\n\nGoverns: ${(m.domains ?? []).join(" · ")}\n\nPlan or log here: ${(m.activities ?? []).join(" · ")}`,
          };
        })
      : tab === "planets"
      // Fuller read (#24): the myth, what the voice speaks for, and what to do
      // when it's loud.
      ? Object.values(PLANET_MYTHOS).map((m) => ({
          key: m.key, glyph: m.glyph, name: `${m.name} — ${m.archetype}`, sub: m.essence, color: m.color, planet: m.name,
          body: `${m.myth}\n\nSpeaks for: ${(m.speaksFor ?? []).join(" · ")}\n\nWhen it's loud: ${m.whenLoud}`,
        }))
      : Object.values(SIGN_MYTHOS).map((m) => ({ key: m.key, glyph: m.glyph, name: m.name, sub: m.essence, color: elementColor(m.element, "var(--color-muted)"), body: `${m.feel} Favors: ${(m.favors ?? []).slice(0, 4).join(" · ")}.`, element: m.element }));

  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
      <button onClick={() => setSectionOpen(v => !v)} style={{
        width: "100%", textAlign: "left", padding: "11px 14px", background: "var(--color-card-2)",
        border: "none", borderBottom: sectionOpen ? "1px solid var(--color-border)" : "none", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--color-primary)" }}>📖 Reference — what the sky's pieces mean</div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>Start with the six-step path, or look anything up — no astrology background needed</div>
        </div>
        <span style={{ fontSize: 10, color: "var(--text-3)", transform: sectionOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s", flexShrink: 0 }}>›</span>
      </button>
      {sectionOpen && (
      <div style={{ padding: "0 14px 11px", background: "var(--color-card-2)", borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ display: "flex", gap: 5, marginTop: 10 }}>
          {(["learn", "elements", "planets", "signs"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); setOpen(null); }} style={{
              fontSize: 10, padding: "3px 11px", borderRadius: 20, cursor: "pointer", textTransform: "capitalize",
              border: tab === t ? "1px solid #1a2a3a" : "1px solid var(--color-border)",
              background: tab === t ? "#1a2a3a" : "var(--color-card)", color: tab === t ? "#ffffff" : "var(--color-muted)", fontWeight: tab === t ? 600 : 400,
            }}>{t === "learn" ? <><span aria-hidden="true">✦</span> learn the sky</> : t}</button>
          ))}
        </div>
      </div>
      )}
      {/* The spine — the nested-rhythm ladder leads the primer, since it's the
          map every other lesson is a rung of. */}
      {sectionOpen && tab === "learn" && (
        <div style={{ padding: "14px 14px 4px" }}>
          <SpineGauge dark={theme === "dark"} />
        </div>
      )}
      {sectionOpen && (
      <div style={{ display: tab === "signs" ? "grid" : "flex", gridTemplateColumns: tab === "signs" ? "1fr 1fr" : undefined, flexDirection: tab === "signs" ? undefined : "column" }}>
        {items.map((it) => (
          <div key={it.key} style={{ borderBottom: "1px solid var(--color-border)", borderRight: tab === "signs" ? "1px solid var(--color-border)" : "none" }}>
            <button onClick={() => setOpen(open === it.key ? null : it.key)} style={{
              width: "100%", textAlign: "left", padding: "8px 14px", background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 9,
            }}>
              <span style={{ fontSize: 14, color: it.color, width: 18, textAlign: "center", flexShrink: 0 }}>{it.glyph}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--color-foreground)" }}>{it.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.sub}</div>
              </div>
              <span style={{ fontSize: 10.5, color: "var(--text-3)", flexShrink: 0 }}>{open === it.key ? "−" : "+"}</span>
            </button>
            {open === it.key && (
              <div style={{ padding: "0 14px 10px 41px", fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.6, whiteSpace: "pre-line" }}>
                {it.body}
                {/* Turn a meaning into an intention (#25): steer a Guiding Star
                    into this element, or open the full planet page (#24). */}
                {(it.element || it.planet) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    {it.element && onStartStar && (
                      <button onClick={() => onStartStar(it.element!)} style={{
                        fontSize: 10, padding: "4px 11px", borderRadius: 8, cursor: "pointer",
                        border: `1px solid ${it.color}55`, background: `${it.color}12`, color: it.color, fontWeight: 600,
                      }}>✦ Set a Guiding Star in {ELEMENT_MYTHOS[it.element]?.name ?? it.element}</button>
                    )}
                    {it.planet && onVisitPlanet && (
                      <button onClick={() => onVisitPlanet(it.planet!)} style={{
                        fontSize: 10, padding: "4px 11px", borderRadius: 8, cursor: "pointer",
                        border: `1px solid ${it.color}55`, background: `${it.color}12`, color: it.color, fontWeight: 600,
                      }}>Open {it.planet} →</button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
