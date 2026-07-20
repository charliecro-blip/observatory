import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ELEMENT_COLORS, ELEMENT_BG, ELEMENT_TAGLINE, ELEMENT_TODAY_GUIDANCE, SIGN_ELEMENTS, MODULE_ELEMENTS, moduleResonance, CHARACTER_ELEMENT, CHARACTER_LABEL, CHARACTER_ESSENCE, tideGuidance, CONFIDENCE_NOTE, QUIET_DAY_GUIDANCE, type Element, type TideCharacter } from "@/lib/elements";
import { PLANET_LITERACY } from "@/lib/sky-literacy";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTidesNow, useTidesWeek, usePractices, useTodayWindows, useTidesWindows, useSkyEvents, useNorthStars } from "@/hooks/useTides";
import Dashboard from "@/components/Dashboard";
import RhythmCard from "@/components/RhythmCard";
import { ASPECT_GEOMETRY, SIGN_INFLECTION, PLANET_CORE, composeTakes, composeEssence, composeGuidance, aspectSignificance, type AspectName } from "@/lib/sky-readings";
import { Skeleton, SkeletonCard } from "@/components/Skeleton";
import { usePreferences, useTimeFormat } from "@/contexts/preferences-context";
import { useTester } from "@/contexts/tester-context";
import { Tooltip, HelpBadge } from "@/components/Tooltip";
import type { Goal, SkyEvent, Crossing } from "@/lib/types";
import { activeEclipse, RETRO_NOTES, ASPECT_GLYPH, PLANET_GLYPH } from "@/lib/conditions";
import { Studio } from "@/components/Studio";
import { StarRows, EveningHarvest, ReviewCard } from "@/components/Momentum";
import { SIGN_MYTHOS, PLANET_MYTHOS, PLANET_ACTIVITIES } from "@/lib/mythos";
import { UnifiedTideChart } from "@/components/TideWater";
import { smoothPathD } from "@/lib/smoothPath";
import { isWithinFreeWindow } from "@/lib/chronotype";
import { PremiumExploreModal } from "@/components/PremiumGate";
import { PLANET_GLYPH as PLANET_ICONS, PLANET_GLYPH as BIGSKY_PLANET_GLYPH } from "@/lib/glyphs";

const PLANET_COLORS: Record<string, string> = {
  Sun: "#c08020", Moon: "#7080a0", Mercury: "#608060", Venus: "#c06090",
  Mars: "#c04040", Jupiter: "#6040a0", Saturn: "#807060", Uranus: "#3090a0",
};

const PLANET_SIGNIFICATION: Record<string, string> = {
  Moon: "nourishment · care · small tasks · environment",
  Mars: "action · ignition · assertion · exertion",
  Saturn: "slowing · focusing · consolidation · rest",
  Venus: "beauty · pleasure · connection · relationship",
  Jupiter: "expansion · abundance · generosity · vision",
  Sun: "visibility · leadership · vitality · clarity",
  Mercury: "communication · ideas · movement · craft",
  Uranus: "disruption · surprise · liberation · shake-up",
};


const QUALITY_COLORS: Record<string, string> = {
  good: "#60a060", supported: "#60a060", challenging: "#c04040", caution: "#d0a040", neutral: "#888",
};

const WINDOW_COLORS: Record<string, string> = {
  deep_work: "#3a7aaa", creative: "#9060b0", planning: "#c08040", admin: "#888",
  social: "#d06060", relationship: "#b04080", recovery: "#60a080", retreat: "#6080a0",
  launch: "#c04040", study: "#5060a0",
};

function heroText(now: any): string {
  const el = now?.element?.element ?? "water";
  const q = now?.quality ?? "supported";
  const map: Record<string, Record<string, string>> = {
    water: {
      good: "Deep, still water — ideal for absorption and focus.",
      supported: "High, slow water — good for deep, absorbing work.",
      challenging: "Turbulent water — move carefully, attend to feelings.",
      caution: "Shifting tides — steady, methodical work holds.",
      neutral: "Calm water — a good moment for reflection.",
    },
    fire: {
      good: "Bright fire — driven, visible action flourishes.",
      supported: "Warm fire — energy is available, use it boldly.",
      challenging: "Harsh fire — tempers run high, choose words carefully.",
      caution: "Flickering fire — ambition is present but scattered.",
      neutral: "Steady fire — good for sustained creative effort.",
    },
    earth: {
      good: "Rich earth — grounded, patient work yields results.",
      supported: "Stable earth — a good moment for structure and planning.",
      challenging: "Heavy earth — progress is slow, persistence wins.",
      caution: "Shifting ground — tend to foundations before expanding.",
      neutral: "Firm earth — reliable conditions for methodical work.",
    },
    air: {
      good: "Clear air — communication and ideas flow well.",
      supported: "Moving air — connection and outreach are favored.",
      challenging: "Gusty air — scattered attention, anchor before acting.",
      caution: "Thin air — ideas surface easily but may not stick.",
      neutral: "Still air — good for writing, editing, thinking.",
    },
  };
  return map[el]?.[q] ?? map[el]?.["neutral"] ?? "A moment worth inhabiting.";
}

function journalKey(testerId: string | null, date: string) {
  return `tides-journal-${testerId ?? "anon"}-${date}`;
}

// "No saved location" now means we're on the timezone-derived fallback (right
// timezone, approximate city) rather than a fixed New York default — still
// worth nudging for a real location since sunrise/sunset and the planetary-
// hour grid sharpen with real coordinates.
function hasSavedLocation(profile: { lat?: number; lon?: number } | null) {
  return profile?.lat != null && profile?.lon != null;
}

// ── Pin button ────────────────────────────────────────────────────────────────

function PinButton({ onPin }: { onPin: () => void }) {
  const [pinned, setPinned] = useState(false);
  return (
    <button
      onClick={() => { onPin(); setPinned(true); setTimeout(() => setPinned(false), 2000); }}
      title="Save this insight"
      style={{
        background: "none", border: "none", cursor: "pointer", padding: "2px 4px",
        fontSize: 13, color: pinned ? "#c08020" : "#ccc", flexShrink: 0,
        transition: "color 0.2s",
      }}
    >
      {pinned ? "★" : "☆"}
    </button>
  );
}

// ── Moment Advisor ────────────────────────────────────────────────────────────

// mode "send" fires immediately; mode "fill" drops a natural starter into the
// input for you to complete, so the message reads as your own words (no
// awkward "ask me what it is" instructions sent on your behalf).
const QUICK_INTENTIONS: { label: string; mode: "send" | "fill"; value: string }[] = [
  { label: "What should I do right now?", mode: "send", value: "Given the sky right now and my tasks and goals, what's the best thing I could do with this moment?" },
  { label: "What should I work on?", mode: "send", value: "Looking at my tasks and goals and the current sky, what should I focus on right now?" },
  { label: "What movement fits now?", mode: "send", value: "What kind of movement or workout best matches this moment?" },
  { label: "Is now a good time to…", mode: "fill", value: "Is now a good time to " },
  { label: "When should I…", mode: "fill", value: "When today or this week should I " },
  { label: "When should I launch…", mode: "fill", value: "When would be the best timing to launch " },
];

interface AdvisorMessage { role: "user" | "assistant"; content: string; }

function MomentAdvisor({ testerId, lat, lon, onClose, gcalEvents, weekSummary, onAddTask, seedMessage, now, northStars }: {
  testerId: string | null;
  lat: number;
  lon: number;
  onClose: () => void;
  gcalEvents: { title: string; start: string; end: string; allDay: boolean }[];
  weekSummary: string;
  onAddTask: (title: string) => void;
  seedMessage?: string | null;
  now?: any;
  northStars?: any[] | null;
}) {
  const [history, setHistory] = useState<AdvisorMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [showPins, setShowPins] = useState(false);
  const [memSaved, setMemSaved] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const pinsKey = `tides-advisor-pins-${testerId ?? "anon"}`;
  const pins: { content: string; ts: string }[] = JSON.parse(localStorage.getItem(pinsKey) ?? "[]");

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history, streamBuffer]);
  // Opened from a "reflect with Compass" prompt elsewhere (e.g. a planet
  // check-in) — auto-ask it once so the conversation starts on that thread.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seedMessage && !seededRef.current) { seededRef.current = true; send(seedMessage); }
  }, [seedMessage]);

  async function send(message: string) {
    if (!message.trim() || streaming) return;
    const userMsg: AdvisorMessage = { role: "user", content: message.trim() };
    setHistory(h => [...h, userMsg]);
    setInput("");
    setStreaming(true);
    setStreamBuffer("");

    try {
      const res = await fetch("/api/advise", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(testerId ? { "x-tester-id": testerId } : {}),
        },
        body: JSON.stringify({ message: message.trim(), history, lat, lon, gcalEvents, weekSummary }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      let buf = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.delta) {
              accumulated += parsed.delta;
              setStreamBuffer(accumulated);
            }
          } catch { /* skip malformed */ }
        }
      }

      if (accumulated) {
        setHistory(h => [...h, { role: "assistant", content: accumulated }]);
      }
    } catch {
      setHistory(h => [...h, { role: "assistant", content: "Something went wrong. Try again." }]);
    } finally {
      setStreaming(false);
      setStreamBuffer("");
    }
  }

  const allMessages: AdvisorMessage[] = streaming && streamBuffer
    ? [...history, { role: "assistant", content: streamBuffer }]
    : history;

  function pinMessage(content: string) {
    const key = `tides-advisor-pins-${testerId ?? "anon"}`;
    const existing: { content: string; ts: string }[] = JSON.parse(localStorage.getItem(key) ?? "[]");
    existing.unshift({ content, ts: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(existing.slice(0, 20)));
  }

  async function saveToMemory(content: string, idx: number) {
    if (!testerId) return;
    try {
      await fetch("/api/daemon-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tester-id": testerId },
        body: JSON.stringify({ content: content.slice(0, 300) }),
      });
      setMemSaved(idx);
      setTimeout(() => setMemSaved(null), 2000);
    } catch { /* silent */ }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,20,30,0.55)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "var(--color-card-2)", borderRadius: 16, width: 520, maxWidth: "calc(100vw - 40px)",
        maxHeight: "80vh", display: "flex", flexDirection: "column",
        boxShadow: "0 12px 48px rgba(0,0,0,0.22)", border: "1px solid #ddd8d0",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px 14px", borderBottom: "1px solid var(--color-border)", flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-primary)" }}>🧭 Compass</div>
            <div style={{ fontSize: 10, color: "#999", marginTop: 1 }}>What do you want to orient to?</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {history.length > 0 && !showPins && (
              <button onClick={() => { setHistory([]); setStreamBuffer(""); setInput(""); }} style={{
                fontSize: 10, padding: "3px 10px", borderRadius: 8, border: "1px solid var(--color-border)",
                background: "var(--color-card)", color: "#4a5a6a", cursor: "pointer",
              }}>← New question</button>
            )}
            {pins.length > 0 && (
              <button onClick={() => setShowPins(v => !v)} style={{
                fontSize: 10, padding: "3px 10px", borderRadius: 8, border: "1px solid var(--color-border)",
                background: showPins ? "#1a2a3a" : "#fff", color: showPins ? "var(--color-background)" : "#4a5a6a",
                cursor: "pointer",
              }}>★ Saved ({pins.length})</button>
            )}
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#aaa", lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* Saved pins panel */}
        {showPins && (
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {pins.length === 0 && <div style={{ fontSize: 12, color: "#bbb", textAlign: "center", marginTop: 16 }}>No saved insights yet.</div>}
            {pins.map((p, i) => (
              <div key={i} style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 13, color: "var(--color-primary)", lineHeight: 1.5 }}>{p.content}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                  <span style={{ fontSize: 9, color: "#bbb" }}>{new Date(p.ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  <button onClick={() => onAddTask(p.content.slice(0, 80))} style={{
                    fontSize: 9, padding: "2px 8px", borderRadius: 6, border: "1px solid var(--color-border)",
                    background: "var(--color-card-2)", color: "#4a5a6a", cursor: "pointer",
                  }}>→ task</button>
                </div>
              </div>
            ))}
            <button onClick={() => setShowPins(false)} style={{ fontSize: 10, color: "#bbb", background: "none", border: "none", cursor: "pointer", alignSelf: "center", marginTop: 4 }}>← Back to conversation</button>
          </div>
        )}

        {!showPins && <>

        {/* Orientation picker (only before first message) — "what do you want
            to orient to?": your stars, this moment's grain, rest, or timing. */}
        {history.length === 0 && (() => {
          const tideChar = (now?.tide?.character ?? null) as TideCharacter | null;
          const charLabel = tideChar ? CHARACTER_LABEL[tideChar] : null;
          const charElement = tideChar ? CHARACTER_ELEMENT[tideChar] : null;
          const charColor = charElement ? (ELEMENT_COLORS[charElement] ?? "#4a5a6a") : "#4a5a6a";
          const level = now?.tide?.level ?? null;
          const restful = level === "low" || level === "ebb";
          const activeStars = (northStars ?? []).filter((s: any) => s.status === "active" || !s.status).slice(0, 4);

          const Row = ({ icon, iconColor, label, sub, onClick }: {
            icon: string; iconColor: string; label: string; sub?: string; onClick: () => void;
          }) => (
            <button onClick={onClick} style={{
              display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left",
              padding: "10px 12px", borderRadius: 10, border: "1px solid var(--color-border)",
              background: "var(--color-card)", cursor: "pointer",
            }}>
              <span style={{ fontSize: 15, color: iconColor, width: 18, textAlign: "center", flexShrink: 0 }}>{icon}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--color-primary)" }}>{label}</span>
                {sub && <span style={{ display: "block", fontSize: 10, color: "#999", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>}
              </span>
              <span style={{ fontSize: 11, color: "#ccc", flexShrink: 0 }}>→</span>
            </button>
          );

          return (
            <div style={{ padding: "14px 20px 4px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Your Guiding Stars */}
              {activeStars.length > 0 && (
                <div>
                  <div style={{ fontSize: 9, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 7 }}>Your guiding stars</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {activeStars.map((s: any) => (
                      <Row key={s.id} icon="✦" iconColor="#c19a3a"
                        label={s.title}
                        sub="Make progress on this — with the sky as it is now"
                        onClick={() => send(`Help me make progress on my guiding star "${s.title}" right now. Given the current sky and my rhythm, what's one concrete thing I could do toward it in this window, and is now a good time for that kind of effort? If the moment doesn't suit it, say so and tell me when would be better.`)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Right now — this moment's grain + rest */}
              <div>
                <div style={{ fontSize: 9, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 7 }}>Right now</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {charLabel && (
                    <Row icon="◐" iconColor={charColor}
                      label={`Work with the ${charLabel} tide`}
                      sub={tideChar ? CHARACTER_ESSENCE[tideChar] : undefined}
                      onClick={() => send(`The tide right now is ${charLabel}. Given that grain and my tasks and goals, what's the best thing I could do with this moment? Keep it to what genuinely fits this kind of energy.`)}
                    />
                  )}
                  <Row icon={restful ? "☾" : "⏸"} iconColor="#7080a0"
                    label={restful ? "Rest — the tide is low" : "Permission to rest"}
                    sub={restful ? "This window ebbs. Let me help you feel okay stepping back." : "Is stepping back the right call right now?"}
                    onClick={() => send(`Is this a moment to rest? Look honestly at the current tide and my chart. If the window supports rest or a gentler pace, help me feel okay about that instead of pushing. If it genuinely supports effort, tell me that plainly too.`)}
                  />
                </div>
              </div>

              {/* Ask about timing */}
              <div>
                <div style={{ fontSize: 9, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 7 }}>Ask about timing</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {QUICK_INTENTIONS.filter(q => q.mode === "fill").map(q => (
                    <button key={q.label} onClick={() => { setInput(q.value); inputRef.current?.focus(); }} style={{
                      fontSize: 11, padding: "5px 12px", borderRadius: 20, border: "1px solid var(--color-border)",
                      background: "var(--color-card)", color: "#4a5a6a", cursor: "pointer",
                    }}>{q.label}</button>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Message thread */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {allMessages.length === 0 && (
            <div style={{ color: "#bbb", fontSize: 12, textAlign: "center", marginTop: 8 }}>
              Choose above, or ask anything below.
            </div>
          )}
          {allMessages.map((m, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              alignItems: "flex-end", gap: 4,
            }}>
              <div style={{
                maxWidth: "82%", padding: "10px 14px", borderRadius: 12,
                fontSize: 13, lineHeight: 1.5,
                background: m.role === "user" ? "#1a2a3a" : "#fff",
                color: m.role === "user" ? "var(--color-background)" : "#1a2a3a",
                border: m.role === "assistant" ? "1px solid var(--color-border)" : "none",
                borderBottomRightRadius: m.role === "user" ? 4 : 12,
                borderBottomLeftRadius: m.role === "assistant" ? 4 : 12,
              } as React.CSSProperties}>
                {m.content}
                {streaming && i === allMessages.length - 1 && m.role === "assistant" && (
                  <span style={{ display: "inline-block", width: 6, height: 13, background: "#bbb", marginLeft: 3, verticalAlign: "text-bottom", animation: "blink 1s step-end infinite" }} />
                )}
              </div>
              {m.role === "assistant" && !streaming && (
                <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
                  <PinButton onPin={() => pinMessage(m.content)} />
                  <button
                    onClick={() => onAddTask(m.content.slice(0, 80))}
                    title="Add as task"
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "#ccc", padding: "1px 3px" }}
                  >→</button>
                  <button
                    onClick={() => saveToMemory(m.content, i)}
                    title="Save to daemon memory (persists across sessions)"
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 9, color: memSaved === i ? "#9060c0" : "#ddd", padding: "1px 3px" }}
                  >{memSaved === i ? "✦" : "◆"}</button>
                  <button
                    onClick={() => send("Why? Briefly show me which sky factors shaped that answer — the Moon's sign, the tide, the planetary hour, my transits — and what each one contributed. Teach me the mechanism so I could read it myself next time.")}
                    title="Why? — see the sky reasoning behind this answer"
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 9, color: "#c8b088", padding: "1px 3px", fontWeight: 700 }}
                  >?</button>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "12px 16px 16px", borderTop: "1px solid var(--color-border)", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder="Ask anything about this moment…"
              rows={2}
              style={{
                flex: 1, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--color-border)",
                fontSize: 13, outline: "none", background: "var(--color-card)", resize: "none",
                fontFamily: "inherit", lineHeight: 1.4, color: "var(--color-primary)",
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || streaming}
              style={{
                padding: "9px 16px", borderRadius: 10, border: "none",
                background: input.trim() && !streaming ? "#1a2a3a" : "#e0dcd6",
                color: input.trim() && !streaming ? "#fff" : "#aaa",
                fontSize: 12, fontWeight: 500, cursor: input.trim() && !streaming ? "pointer" : "default",
                flexShrink: 0,
              }}
            >
              {streaming ? "…" : "Send"}
            </button>
          </div>
          <div style={{ fontSize: 9, color: "#ccc", marginTop: 5 }}>Enter to send · Shift+Enter for new line</div>
        </div>

        </>}
      </div>
    </div>
  );
}

export default function Today({ testerId, lat = 40.7, lon = -74.0, onNavigate, showAdvisor, setShowAdvisor, advisorSeed, onVisitPlanet, onOpenStar }: {
  testerId: string | null; lat?: number; lon?: number; onNavigate?: (view: string) => void;
  onOpenStar?: (goalId: number) => void;
  showAdvisor: boolean; setShowAdvisor: (v: boolean) => void; advisorSeed?: string | null;
  onVisitPlanet?: (planet: string) => void;
}) {
  const qc = useQueryClient();
  const { prefs } = usePreferences();
  const { updateLocation, profile: testerProfile } = useTester();
  const { todayShowVOC, todayShowWave, todayShow14Day, todayShowJournal } = prefs.display;
  const today = new Date().toISOString().slice(0, 10);
  // Crossings display moved to Settings (a tuning knob, not a daily control).
  const crossingsOn = prefs.display.todayShowCrossings;
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);

  function useCurrentLocation() {
    if (!navigator.geolocation) { setLocationError(true); return; }
    setLocating(true);
    setLocationError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateLocation(pos.coords.latitude, pos.coords.longitude, "Current location");
        setLocating(false);
      },
      () => { setLocating(false); setLocationError(true); },
      { timeout: 10_000 },
    );
  }
  const [showTideCard, setShowTideCard] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [dismissedPremiumBanner, setDismissedPremiumBanner] = useState(() => localStorage.getItem("obs_seen_premium_banner") === "1");
  const [dismissedStarHint, setDismissedStarHint] = useState(() => localStorage.getItem("obs_seen_star_hint") === "1");
  const [tideView, setTideView] = useState<"day" | "week">("day");
  const [journalText, setJournalText] = useState("");
  const [journalSaved, setJournalSaved] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [waveHover, setWaveHover] = useState<{ x: number; y: number; hourIdx: number } | null>(null);
  const waveRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(journalKey(testerId, today));
    if (saved) { setJournalText(saved); return; }
    // No local copy (new device / cleared storage) — hydrate from the server
    // check-in so the journal follows the account, not the browser.
    if (!testerId) return;
    fetch("/api/check-ins/today", { headers: { "x-tester-id": testerId } })
      .then(r => (r.ok ? r.json() : null))
      .then(row => { if (row?.notes) setJournalText(row.notes); })
      .catch(() => {});
  }, [testerId, today]);

  // Journal persists to the day's check-in row (debounced) so it shows up in
  // The Log, sky-stamped — localStorage stays as the instant/offline copy.
  const journalPostTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function saveJournal(text: string) {
    setJournalText(text);
    localStorage.setItem(journalKey(testerId, today), text);
    setJournalSaved(true);
    setTimeout(() => setJournalSaved(false), 1500);
    if (!testerId) return;
    if (journalPostTimer.current) clearTimeout(journalPostTimer.current);
    journalPostTimer.current = setTimeout(() => {
      fetch("/api/check-ins", {
        method: "POST",
        headers: { "x-tester-id": testerId, "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, notes: text }),
      }).catch(() => {});
    }, 900);
  }

  const { data: now, isLoading: nowLoading } = useTidesNow(testerId, lat, lon);
  const { data: week } = useTidesWeek(14, lat, lon);
  const { data: skyEventsData } = useSkyEvents(3, lat, lon);
  const { data: practicesData } = usePractices(testerId, lat, lon);
  const { data: windows } = useTodayWindows(testerId, today);
  const { data: tidesWindowsData } = useTidesWindows(lat, lon);

  const { data: gcalStatus } = useQuery<{ connected: boolean }>({
    queryKey: ["gcal-status", testerId],
    queryFn: async () => {
      const r = await fetch("/api/integrations/google-cal/status", { headers: testerId ? { "x-tester-id": testerId } : {} });
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 60_000,
  });

  const todayStart = `${today}T00:00:00`;
  const todayEnd = `${today}T23:59:59`;
  const { data: gcalData } = useQuery<{ events: { title: string; start: string; end: string; allDay: boolean; color: string | null; htmlLink: string }[] }>({
    queryKey: ["gcal-events-today", testerId, today],
    queryFn: async () => {
      const r = await fetch(
        `/api/integrations/google-cal/events?start=${encodeURIComponent(todayStart)}&end=${encodeURIComponent(todayEnd)}`,
        { headers: testerId ? { "x-tester-id": testerId } : {} }
      );
      return r.json();
    },
    enabled: !!testerId && !!gcalStatus?.connected,
    staleTime: 300_000,
  });

  const { data: cycle } = useQuery<{ cycleStartDate: string; cycleLength: number; lutealLength: number } | null>({
    queryKey: ["cycle", testerId],
    queryFn: async () => {
      const r = await fetch("/api/cycle", { headers: testerId ? { "x-tester-id": testerId } : {} });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 3600_000,
  });

  const { data: habits = [] } = useQuery<any[]>({
    queryKey: ["habits", testerId],
    queryFn: async () => {
      const r = await fetch("/api/habits", { headers: testerId ? { "x-tester-id": testerId } : {} });
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 120_000,
  });

  const { data: goals } = useQuery<Goal[]>({
    queryKey: ["goals", testerId],
    queryFn: async () => {
      const r = await fetch("/api/planning/goals", { headers: testerId ? { "x-tester-id": testerId } : {} });
      const j = await r.json();
      return Array.isArray(j) ? j : []; // 429/500 error bodies must not crash .slice/.map
    },
    enabled: !!testerId,
  });

  const { data: northStars } = useNorthStars(testerId);

  interface SimpleTask { id: number; title: string; done: string; bestWindowType?: string; }
  const { data: todayTasks = [] } = useQuery<SimpleTask[]>({
    queryKey: ["tasks-today", testerId, today],
    queryFn: async () => {
      const r = await fetch(`/api/tasks?date=${today}`, { headers: testerId ? { "x-tester-id": testerId } : {} });
      const j = await r.json();
      return Array.isArray(j) ? j : []; // a transient error object must not crash .filter/.map
    },
    enabled: !!testerId,
    refetchInterval: 30_000,
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, done }: { id: number; done: boolean }) => {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({ done: String(done) }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const addTask = useMutation({
    mutationFn: async (title: string) => {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({ title, dueDate: today }),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setNewTaskTitle(""); setShowAddTask(false); },
  });

  const gcalEvents = (gcalData?.events ?? []).map(e => ({ title: e.title, start: e.start, end: e.end, allDay: e.allDay }));

  // Build a concise week quality summary for the advisor system prompt
  const weekSummary = (week?.days ?? []).slice(0, 7).map((d: any) => {
    const date = new Date(d.date + "T12:00:00");
    const dayName = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const qs = d.quality ?? "";
    const ms = d.moonSign ?? "";
    return `${dayName}: ${ms}${qs ? ` · ${qs.replace(/_/g," ")}` : ""}`;
  }).join("; ");

  const practices = practicesData?.practices ?? [];
  const resonant = practices.filter(p => p.timing === "resonant");
  const supported = practices.filter(p => p.timing === "supported");
  const soften = practices.filter(p => p.timing === "soften" || p.timing === "protect");

  const el = now?.element?.element ?? "water";
  const elemColor = ELEMENT_COLORS[el as Element] ?? "#888";
  const qColor = QUALITY_COLORS[now?.quality ?? "neutral"] ?? "#888";

  // Find ALL angle crossings active right now (recent past or near future), not just
  // the single nearest one — showing only one meant a second simultaneous crossing
  // (e.g. Jupiter AND Pluto both at an angle) was silently concealed behind it.
  const todayData = week?.days?.find(d => d.date === today);
  const nowMinutesForCross = new Date().getHours() * 60 + new Date().getMinutes();
  // A chart angle sweeps the ecliptic at ~14°/hr (the ~15°/hr diurnal rate,
  // minus the Moon's own ~0.5°/hr drift), so a 3° orb is ~13 minutes either
  // side of exact — the window an angle crossing is genuinely "active" for.
  // Owner: give any crossing a 3° orb and treat it as live, not past.
  const CROSS_DEG_PER_MIN = 14 / 60;      // ≈0.233°/min
  const CROSS_ORB_DEG = 3;
  const CROSS_WINDOW_MIN = CROSS_ORB_DEG / CROSS_DEG_PER_MIN; // ≈12.9 min
  const activeCrossings = (todayData?.crossings ?? [])
    .map(c => {
      if (!c.time) return null;
      const [ch, cm] = c.time.split(":").map(Number);
      const crossMin = ch * 60 + (cm ?? 0);
      const diff = crossMin - nowMinutesForCross;
      return { c, diff, orbDeg: Math.abs(diff) * CROSS_DEG_PER_MIN };
    })
    .filter((x): x is { c: Crossing; diff: number; orbDeg: number } => x !== null && Math.abs(x.diff) <= CROSS_WINDOW_MIN)
    .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff));

  // An active crossing is a peak moment — it rides at the very TOP of the page
  // (owner: "when that's active, this banner should come to the top of the
  // screen"), and reads as live, not "N min ago".
  const crossingBanner = crossingsOn && activeCrossings.length > 0 ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {activeCrossings.map(({ c: cr, diff, orbDeg }, i) => {
        const pCol = PLANET_COLORS[cr.planet] ?? "#c08020";
        const sig = PLANET_SIGNIFICATION[cr.planet];
        const isBenefic = ["Venus", "Jupiter", "Sun"].includes(cr.planet);
        const whenLabel = Math.abs(diff) < 2 ? "peaking now"
          : diff < 0 ? `exact ${Math.round(-diff)}m ago · ${orbDeg.toFixed(1)}° orb`
          : `exact in ${Math.round(diff)}m · ${orbDeg.toFixed(1)}° orb`;
        return (
          <div key={`${cr.planet}-${cr.angle}-${i}`} style={{
            background: `${pCol}14`, border: `1px solid ${pCol}55`, borderLeft: `3px solid ${pCol}`,
            borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
          }}>
            <span className="phrase-in" style={{ fontSize: 16, flexShrink: 0 }}>{PLANET_ICONS[cr.planet] ?? "⚡"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: pCol }}>
                {cr.planet} crosses {cr.angle} · active now
              </div>
              <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
                {cr.time} · {whenLabel}{sig ? ` — ${sig}` : ""}
              </div>
            </div>
            <div style={{ fontSize: 8, background: `${pCol}22`, color: pCol, padding: "2px 7px", borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>
              ● {isBenefic ? "↑" : ""} {cr.angle}
            </div>
          </div>
        );
      })}
    </div>
  ) : null;

  // Ritual mode — Today reads the clock. Morning opens the day's loop,
  // evening closes it; midday the page is its usual self.
  const localHour = new Date().getHours();
  const ritualMode: "morning" | "evening" | null = localHour < 12 ? "morning" : localHour >= 18 ? "evening" : null;

  // The reflect loop (felt rating + logbook line). In evening mode it rides
  // directly under the "Log the day" card — that IS the ritual — otherwise it
  // keeps its usual quiet spot further down the page.
  const reflectBlock = now ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <TideFeedback now={now} today={today} testerId={testerId} />
      {todayShowJournal && (
        <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-foreground)" }}>Logbook line</span>
            <span style={{ fontSize: 9, color: "var(--color-muted)" }}>
              {journalSaved ? "saved ✓" : "lands in The Log, stamped with today's sky"}
            </span>
          </div>
          <textarea
            value={journalText}
            onChange={e => saveJournal(e.target.value)}
            placeholder="A line about today — what you did, how the water was…"
            rows={2}
            style={{
              width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8,
              border: "1px solid var(--color-border)", background: "var(--color-card-2)",
              fontSize: 12, lineHeight: 1.5, color: "var(--color-foreground)",
              outline: "none", resize: "vertical", fontFamily: "inherit",
            }}
          />
        </div>
      )}
    </div>
  ) : null;

  if (nowLoading) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--color-border)", background: "var(--color-rail)", flexShrink: 0, height: 42 }} />
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <SkeletonCard rows={3} />
          <SkeletonCard rows={2} />
          <div style={{ display: "flex", gap: 4 }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} width={40} height={72} borderRadius={8} />
            ))}
          </div>
          <SkeletonCard rows={4} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Topbar */}
      <div style={{
        padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid var(--color-border)", background: "var(--color-rail)", flexShrink: 0,
      }}>
        <div style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {new Date().toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* One vocabulary, not two: the chip speaks tide (character × level)
              instead of the legacy good/workable favorability labels, which
              contradicted the coherence model (and carried a fire/air bias). */}
          <Tooltip content={
            <div>
              <div style={{ fontWeight: 600, color: "#fff", marginBottom: 4 }}>
                {now?.tide ? `${now.tide.characterLabel} tide — ${now.tide.levelLabel.toLowerCase()}` : `An ${el} day`}
              </div>
              <div style={{ fontSize: 10, color: "#b0aaa4" }}>
                The Moon in {now?.moonSign} sets the day's character ({el}); the level is how charged the water is and which way it's moving.
                {/* One state at a time — listing "rising: X, ebbing: Y" here read
                    as the tide being both at once. */}
                {now?.tide?.trend === "rising" ? " Rising — lean in."
                  : now?.tide?.trend === "ebbing" ? " Ebbing — finish and rest."
                  : " Steady — work as usual."}
              </div>
            </div>
          }>
            <div style={{ fontSize: 10, padding: "3px 10px", borderRadius: 10, background: `${elemColor}20`, color: elemColor, border: `1px solid ${elemColor}40`, cursor: "help" }}>
              {now?.tide ? `${now.tide.characterLabel} tide · ${now.tide.levelLabel.toLowerCase()}` : `${el} day`}
            </div>
          </Tooltip>
          {/* Crossings on/off moved to Settings → Today page — the topbar
              stays for status (location), not tuning knobs. */}
          {!hasSavedLocation(testerProfile) && (
            <button
              onClick={useCurrentLocation}
              disabled={locating}
              title="Sunrise, sunset, and planetary hours are computed for your location — right now we're estimating it from your timezone"
              style={{
                fontSize: 9, color: "#c07020", background: "#fff8ee", border: "1px solid #e0c080",
                borderRadius: 6, padding: "3px 9px", cursor: locating ? "default" : "pointer",
              }}
            >
              {locating ? "Locating…" : locationError ? "⚠ Couldn't get location — set it in Settings" : "⚠ Set location — hours & sun times are estimated"}
            </button>
          )}
        </div>
      </div>

      {showAdvisor && (
        <MomentAdvisor
          testerId={testerId}
          lat={lat}
          lon={lon}
          onClose={() => setShowAdvisor(false)}
          gcalEvents={gcalEvents}
          weekSummary={weekSummary}
          seedMessage={advisorSeed}
          now={now}
          northStars={northStars}
          onAddTask={title => {
            setNewTaskTitle(title);
            setShowAddTask(true);
            setShowAdvisor(false);
          }}
        />
      )}

      {/* The Studio replaced the old share-card modal (owner 2026-07-15):
          IG-shareable day/week/lunation cards, primary sky facts only. */}
      {showTideCard && now && <Studio now={now} lat={lat} lon={lon} onClose={() => setShowTideCard(false)} />}

      <div style={{
        flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14,
        // Time-of-day atmosphere — the page knows dawn from dusk from night.
        // A wash at the top of the scroll, gone by ~360px; subtle on purpose.
        background: localHour < 6 || localHour >= 21
          ? "linear-gradient(180deg, #26304414, transparent 360px)"   // night — cool indigo
          : localHour < 9
            ? "linear-gradient(180deg, #e0964018, transparent 360px)" // dawn — low gold
            : localHour >= 17
              ? "linear-gradient(180deg, #b06a5014, transparent 360px)" // dusk — rose
              : undefined,                                              // midday — plain light
      }}>

        {/* Active angle crossing(s) ride at the very top — a peak moment the
            day is passing through right now, above even the ritual card. */}
        {crossingBanner}

        {/* The ritual anchor — morning "Cast off" / evening "Log the day".
            First thing on the page during ritual hours, absent midday. */}
        {ritualMode && now && (
          <RitualCard
            mode={ritualMode}
            now={now}
            week={week}
            todayTasks={todayTasks}
            windows={windows}
            gcalEvents={gcalEvents}
            testerId={testerId}
            displayName={testerProfile?.displayName}
            onOpenStar={onOpenStar}
            lat={lat} lon={lon}
          />
        )}
        {ritualMode === "evening" && reflectBlock}

        {/* Review moments — Sundays (the week in the wake) and the New Moon
            window (cycle review + next intention). Self-gating; absent
            otherwise. ?review=week|cycle forces either for design work. */}
        <ReviewCard testerId={testerId} lat={lat} lon={lon} onOpenLog={() => onNavigate?.("log")} />

        {/* First-star hint — for users with no Guiding Stars yet, routing them
            to the app's strongest moment. Takes priority over the premium
            banner so new users see one nudge, not a stack of two. */}
        {northStars && northStars.length === 0 && !dismissedStarHint && (
          <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>★</span>
            <div style={{ flex: 1, fontSize: 11.5, color: "var(--color-foreground)" }}>
              Set your first <b>Guiding Star</b> — a long-term ideal the sky can help you steer toward. The app will suggest ones your current season supports.
            </div>
            <button onClick={() => onNavigate?.("work")} style={{ fontSize: 10.5, padding: "5px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-primary)", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>
              To your Aims →
            </button>
            <button onClick={() => { localStorage.setItem("obs_seen_star_hint", "1"); setDismissedStarHint(true); }} style={{ fontSize: 13, color: "#bbb", background: "none", border: "none", cursor: "pointer", padding: "0 2px", flexShrink: 0 }}>
              ✕
            </button>
          </div>
        )}

        {/* Deeper-currents discovery banner — dismissible, shown once until closed.
            Not part of onboarding (kept lean); this is the low-key invitation to
            explore premium features once someone's had a moment with the core loop. */}
        {(!northStars || northStars.length > 0 || dismissedStarHint) && !dismissedPremiumBanner && (
          <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>✦</span>
            <div style={{ flex: 1, fontSize: 11.5, color: "var(--color-foreground)" }}>
              This page is the day's weather. <b>Currents</b> (under Calendar) tracks your slow cycles — the multi-year transits moving through your chart right now.
            </div>
            <button onClick={() => setShowPremiumModal(true)} style={{ fontSize: 10.5, padding: "5px 12px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-primary)", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>
              Explore
            </button>
            <button onClick={() => { localStorage.setItem("obs_seen_premium_banner", "1"); setDismissedPremiumBanner(true); }} style={{ fontSize: 13, color: "#bbb", background: "none", border: "none", cursor: "pointer", padding: "0 2px", flexShrink: 0 }}>
              ✕
            </button>
          </div>
        )}
        {showPremiumModal && <PremiumExploreModal onClose={() => setShowPremiumModal(false)} />}

        {/* Hero card — tide-forward */}
        {(() => {
          const tide = now?.tide;
          const character = (tide?.character ?? "deep") as TideCharacter;
          const elKey = CHARACTER_ELEMENT[character] ?? "water";
          const elColor = ELEMENT_COLORS[elKey] ?? elemColor;
          const elBg    = ELEMENT_BG[elKey] ?? "#f0f0f0";
          const levelLabel = tide?.levelLabel ?? "Steady";
          // Quiet day: little is happening (low aspect activation, no swells ahead).
          // Report it honestly instead of manufacturing a reading.
          const activation = now?.dayArc?.heightFactors?.activation ?? 1;
          const aspectsAhead = (now?.dayArc?.events ?? []).filter((e: any) => e.kind === "aspect" && !e.past).length;
          const isQuiet = activation < 0.25 && aspectsAhead === 0 && (tide?.band ?? "mid") !== "high";
          const guidanceText = isQuiet ? QUIET_DAY_GUIDANCE[character]
            : tide ? tideGuidance(character, tide.level) : heroText(now);
          const confNote = isQuiet ? "" : tide ? CONFIDENCE_NOTE[tide.confidence] : "";

          // Tide curve marker position: Low(0) → Rising(0.25) → High(0.5) → Ebb(0.75) → Low(1)
          const curvePos = tide?.level === "low" ? 0.06
            : tide?.level === "rising" ? 0.28
            : tide?.level === "high" ? 0.5
            : tide?.level === "ebb" ? 0.72
            : 0.5; // "tide" mid sits at center
          const energyPct = Math.round((tide?.energy ?? 0.5) * 100);

          return (
            <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${elColor}30`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              {/* Tide banner */}
              <div style={{ background: `linear-gradient(135deg, ${elColor}, ${elColor}cc)`, padding: "24px 28px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: "1.8px", marginBottom: 8 }}>
                      {levelLabel}
                    </div>
                    <div style={{ fontSize: 44, fontWeight: 700, color: "#fff", letterSpacing: "-1px", lineHeight: 1 }}>
                      {tide?.headline ?? "Tide"}
                    </div>
                    <div style={{ fontSize: 15, color: "rgba(255,255,255,0.8)", marginTop: 10, maxWidth: 340, lineHeight: 1.4 }}>
                      {CHARACTER_ESSENCE[character]}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
                    <button onClick={() => setShowTideCard(true)} title="Share today's tide" style={{
                      fontSize: 11.5, padding: "5px 14px", borderRadius: 20, cursor: "pointer",
                      border: "1px solid rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.15)", color: "#fff", fontWeight: 500,
                    }}>↗ Share</button>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", textAlign: "right", lineHeight: 1.7 }}>
                      {now?.moonSign ?? ""}<br/>{now?.planetaryHour?.planet} hour<br/>{now?.moonPhase ?? ""}
                    </div>
                  </div>
                </div>
                {/* Tide curve */}
                <div style={{ marginTop: 20, position: "relative", height: 30 }}>
                  <svg viewBox="0 0 300 22" preserveAspectRatio="none" style={{ width: "100%", height: 30 }}>
                    <path d="M0,20 C40,20 55,4 75,4 C110,4 105,20 150,20 C195,20 190,4 225,4 C245,4 260,20 300,20"
                      fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                    <circle cx={curvePos * 300} cy={curvePos < 0.5 ? (curvePos < 0.2 ? 20 : 4) : (curvePos > 0.6 ? 12 : 4)} r="4.5" fill="#fff" />
                  </svg>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "rgba(255,255,255,0.55)", marginTop: 3, letterSpacing: "0.6px" }}>
                    <span>LOW</span><span>RISING</span><span>HIGH</span><span>EBB</span><span>LOW</span>
                  </div>
                </div>
              </div>

              {/* Guidance + meta */}
              <div style={{ background: elBg, padding: "16px 24px" }}>
                <div style={{ fontSize: 14.5, color: "#2a2a2a", lineHeight: 1.6, marginBottom: confNote ? 7 : 12 }}>
                  {guidanceText}
                </div>
                {confNote && (
                  <div style={{ fontSize: 11, color: "#907040", fontStyle: "italic", marginBottom: 12 }}>{confNote}</div>
                )}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ fontSize: 9.5, color: elColor, display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: elColor }} />
                    Energy {energyPct}%
                  </div>
                  <div style={{ fontSize: 9.5, color: "#888", display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#aaa" }} />
                    {tide?.trend ?? "steady"}
                  </div>
                  <div style={{ fontSize: 9.5, color: "#888", display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#aaa" }} />
                    {tide?.confidence ?? "medium"} confidence
                  </div>
                  {now?.voc?.isVOC && (
                    <div style={{ fontSize: 9.5, color: "#b0a060", display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#b0a060" }} />
                      Moon VOC
                    </div>
                  )}
                </div>

                {/* Personal modifier line — the moat, shown when a hard transit is active */}
                {tide?.personal && (now?.personalTransits?.length ?? 0) > 0 && (
                  <div style={{ marginTop: 11, paddingTop: 10, borderTop: `1px solid ${elColor}22`, display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#a04040", background: "#a0404015", padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>YOU</span>
                    <span style={{ fontSize: 10.5, color: "#8a4040" }}>
                      World tide is {levelLabel.toLowerCase()}, but yours is choppy — {now!.personalTransits![0].summary}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Daily report — the home as a navigation console: weather + where you're
            steering + what's on deck + the week, at a glance. */}
        {/* Teachable moment — when the Moon is on a planet today, name the
            flavor in feeling-language and offer the door into Star Base. The
            sky schedules the lesson; we just point at it. */}
        {(() => {
          if (!now?.moonAspects?.length) return null;
          const HARD = new Set(["conjunction", "square", "opposition"]);
          // Slow/social planets carry the distinct, learnable flavors; skip
          // Sun (already the day-ruler story) and Mercury/Venus at low weight.
          const WEIGHT: Record<string, number> = { Saturn: 9, Pluto: 8, Neptune: 7, Uranus: 6, Jupiter: 5, Mars: 4, Venus: 2, Mercury: 1 };
          const best = (now.moonAspects as any[])
            .map((a) => ({ ...a, partner: a.planet1 === "Moon" ? a.planet2 : a.planet1 }))
            .filter((a) => HARD.has(a.aspect) && WEIGHT[a.partner] && a.orb <= 4)
            .sort((a, b) => (WEIGHT[b.partner] - WEIGHT[a.partner]) || (a.orb - b.orb))[0];
          if (!best) return null;
          const lit = PLANET_LITERACY[best.partner];
          if (!lit) return null;
          const pc = { Sun: "#c8971e", Mercury: "#7a8a4a", Venus: "#3f8493", Mars: "#c04830", Jupiter: "#7a5cae", Saturn: "#6a6258", Uranus: "#3a9aa8", Neptune: "#5a6cae", Pluto: "#7a3a5a" }[best.partner] ?? "#888";
          // Say WHEN, not just what: perfection time → a part-of-day phrase.
          const partOfDay = (d: Date) => {
            const h = d.getHours();
            return h < 5 ? "overnight" : h < 12 ? "this morning" : h < 17 ? "this afternoon" : h < 21 ? "this evening" : "tonight";
          };
          const clock = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric" });
          const whenPhrase = best.applying && best.hoursToExact != null
            ? (() => { const d = new Date(Date.now() + best.hoursToExact * 3600000); return `peaks ${partOfDay(d)} around ${clock(d)}`; })()
            : !best.applying && best.hoursSinceExact != null
              ? (() => { const d = new Date(Date.now() - best.hoursSinceExact * 3600000); return `peaked ${partOfDay(d)}, now easing`; })()
              : null;
          return (
            <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderLeft: `3px solid ${pc}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <span style={{ fontSize: 12, color: "var(--color-foreground)", lineHeight: 1.55 }}>
                  Today has {lit.undertone}.
                </span>
                <span style={{ fontSize: 10.5, color: "#999", marginLeft: 6 }}>
                  Moon {best.aspect} {best.partner}{whenPhrase ? ` — ${whenPhrase}` : ""} · comes around about once a week.
                </span>
              </div>
              {onVisitPlanet && (
                <button onClick={() => onVisitPlanet(best.partner)} style={{
                  fontSize: 10.5, fontWeight: 600, padding: "4px 11px", borderRadius: 8, cursor: "pointer",
                  border: `1px solid ${pc}50`, background: `${pc}10`, color: pc, flexShrink: 0,
                }}>check in with your {best.partner} →</button>
              )}
            </div>
          );
        })()}

        {now && <Dashboard now={now} week={week} northStars={northStars} windows={windows} testerId={testerId} today={today} onNavigate={onNavigate} lat={lat} lon={lon} />}

        {/* The month's water (30-day view) was removed from Today (owner
            2026-07-15): the day view stays about today; the month lives in the
            Calendar/Almanac. MonthBars is still defined for that surface. */}

        {/* Your rhythm today — body cycles read against the sky's (rhythm as
            the app's foundation: chronotype↔solar, menstrual↔lunar). */}
        {now && <RhythmCard now={now} />}

        {/* The big sky — the moment's defining aspects, explored */}
        {now && <BigSky now={now} />}

        {/* (North Stars card absorbed into the dashboard's Guiding stars card —
            it duplicated the same list right below it.) */}

        {/* Today's habits — check-off on the glance layer, so the daily loop
            (glance → act → check off) closes without a trip into Helm.
            During ritual hours the RitualCard carries the habit chips, so
            this card stands down to keep the page lean. */}
        {testerId && !ritualMode && <TodayHabits testerId={testerId} now={now} />}

        {/* The tide — one coherent chart for the whole day */}
        {now?.dayArc && <UnifiedTideChart arc={now.dayArc} now={now} lat={lat} lon={lon} />}

        {/* Module recommendations — "what fits right now" moved up near the tide
            chart, since it was previously the very last thing on the page. */}
        {now && <ModulePulse now={now} onNavigate={onNavigate} />}

        {/* Standing conditions */}
        {now && <ConditionsStrip now={now} today={today} />}

        {/* Logbook — the reflect loop, in its usual quiet spot midday only:
            evenings it rides up under "Log the day", and mornings it stands
            down entirely ("how did today feel?" is a nonsense question at 8am
            — the morning card asks about yesterday instead). */}
        {ritualMode === null && reflectBlock}

        {/* VOC banner */}
        {todayShowVOC && now?.voc?.isVOC && (
          <div style={{
            background: "var(--color-card-2)", border: "1px solid #d8d0c0", borderLeft: "3px solid #b0a080",
            borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>◌</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6a5030" }}>
                Moon void of course{now.voc.nextIngress ? ` · until ${now.voc.nextIngress}` : ""}
              </div>
              <div style={{ fontSize: 10, color: "#9a7050", marginTop: 2 }}>
                Avoid new beginnings. Good for completion, review, routine, and rest.
              </div>
            </div>
          </div>
        )}

        {/* Cycle phase banner */}
        {cycle?.cycleStartDate && (() => {
          const start = new Date(cycle.cycleStartDate + "T12:00:00");
          const today_ = new Date();
          const diff = Math.floor((today_.getTime() - start.getTime()) / 86400000);
          if (diff < 0) return null;
          const dayOfCycle = (diff % cycle.cycleLength) + 1;
          const follEnd = cycle.cycleLength - cycle.lutealLength;
          const phases = [
            { name: "Menstrual", max: 5,        color: "#c04050", desc: "Rest · release · introspection" },
            { name: "Follicular", max: follEnd-4, color: "#d08020", desc: "Rising energy · creativity · planning" },
            { name: "Ovulatory",  max: follEnd,   color: "#50a050", desc: "Peak energy · visibility · connection" },
            { name: "Luteal",     max: cycle.cycleLength, color: "#6050a0", desc: "Focus · nesting · detail work" },
          ];
          const phase = phases.find(p => dayOfCycle <= p.max) ?? phases[3];
          return (
            <div style={{
              background: `${phase.color}10`, border: `1px solid ${phase.color}30`, borderLeft: `3px solid ${phase.color}`,
              borderRadius: 8, padding: "9px 14px", display: "flex", alignItems: "center", gap: 10,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: phase.color }}>{phase.name} · day {dayOfCycle} of cycle</div>
                <div style={{ fontSize: 10, color: "#888", marginTop: 1 }}>{phase.desc}</div>
              </div>
              <div style={{ fontSize: 8, color: `${phase.color}80`, background: `${phase.color}15`, padding: "2px 7px", borderRadius: 4, flexShrink: 0 }}>cycle</div>
            </div>
          );
        })()}

        {/* Rhythm-risk banner */}
        {now?.rhythmRisk && (
          <div style={{
            background: "#fff8f0", border: "1px solid #e0b080", borderLeft: "3px solid #c05020",
            borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 10,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#803020" }}>Rhythm-risk window · move gently</div>
              {(now.rhythmRiskFactors ?? []).length > 0 && (
                <div style={{ fontSize: 10, color: "#a05030", marginTop: 2 }}>
                  {(now.rhythmRiskFactors ?? []).join(" · ")}
                </div>
              )}
              {habits.filter((h: any) => h.minimumViable).length > 0 && (
                <div style={{ fontSize: 10, color: "#888", marginTop: 6 }}>
                  <span style={{ fontWeight: 600, color: "#6a4020" }}>Minimum viable: </span>
                  {habits.filter((h: any) => h.minimumViable).map((h: any) => `${h.name}: ${h.minimumViable}`).join(" · ")}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Waves — flat unified list: practices + tasks + goals */}
        <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
          <div style={{ padding: "12px 18px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>Waves</div>
            {todayTasks.filter(t => t.done === "true").length > 0 && (
              <span style={{ fontSize: 9, color: "#60a060" }}>{todayTasks.filter(t => t.done === "true").length} done ✓</span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Practices moved into the Habits & practices card — habits and
                practices are one concept now; Waves is tasks + goals. */}
            {/* Active tasks */}
            {todayTasks.filter(t => t.done !== "true").map(t => (
              <WaveRow key={`t-${t.id}`} type="task"
                label={t.title}
                sub={t.bestWindowType?.replace("_"," ")}
                onCheck={() => toggleTask.mutate({ id: t.id, done: true })}
              />
            ))}
            {/* Goals */}
            {(goals ?? []).slice(0, 4).map(g => (
              <WaveRow key={`g-${g.id}`} type="goal" label={g.title}
                sub={g.horizon} />
            ))}
            {/* Add task */}
            <div style={{ padding: "8px 18px", borderTop: "1px solid var(--color-border)" }}>
              {showAddTask ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <input autoFocus value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && newTaskTitle.trim()) addTask.mutate(newTaskTitle); if (e.key === "Escape") { setShowAddTask(false); setNewTaskTitle(""); } }}
                    placeholder="Add task for today…"
                    style={{ flex: 1, padding: "5px 9px", borderRadius: 6, border: "1px solid var(--color-border)", fontSize: 12, outline: "none", background: "var(--color-card-2)" }}
                  />
                  <button onClick={() => newTaskTitle.trim() && addTask.mutate(newTaskTitle)}
                    style={{ padding: "5px 11px", borderRadius: 6, border: "none", background: "#1a2a3a", color: "#fff", fontSize: 11, cursor: "pointer" }}>Add</button>
                </div>
              ) : (
                <button onClick={() => setShowAddTask(true)} style={{ fontSize: 11, color: "#ccc", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  + add task
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Elemental balance */}
        {habits.length > 0 && <ElementalBalance habits={habits} tasks={todayTasks} />}

        {/* Planetary pulse */}
        {now && <PlanetaryPulse now={now} />}

      </div>
    </div>
  );
}

// ── NorthStarsCard — chief aims for the week ────────────────────────────────────

const NS_ELEMENT_INFO: Record<string, { color: string; label: string }> = {
  fire: { color: "#c04830", label: "Fire" }, earth: { color: "#4a7040", label: "Earth" },
  air: { color: "#c19a3a", label: "Air" }, water: { color: "#3a5a80", label: "Water" },
};

function NorthStarsCard({ stars, testerId, onNavigate }: { stars: any[]; testerId: string | null; onNavigate?: (v: string) => void }) {
  const qc = useQueryClient();
  const logSession = useMutation({
    mutationFn: async (goalId: number) => {
      const now = new Date().toISOString();
      await fetch("/api/planning/windows", {
        method: "POST", headers: { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) },
        body: JSON.stringify({ title: "Logged session", goalId, adHoc: true, startTime: now, endTime: now }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["north-stars"] }),
  });

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "13px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)" }}>★ North Stars</div>
        <button onClick={() => onNavigate?.("work")} style={{ fontSize: 9.5, color: "#aaa", background: "none", border: "none", cursor: "pointer" }}>manage →</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {stars.map((g: any) => {
          const info = NS_ELEMENT_INFO[g.element ?? ""] ?? { color: "#8a8278", label: "" };
          const target = Math.max(g.scheduledCount, 2); // aim for at least 2-3 sessions/week
          const pct = Math.min(100, Math.round((g.completedCount / target) * 100));
          return (
            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: info.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}</span>
                  {info.label && <span style={{ fontSize: 8.5, color: info.color }}>{info.label}</span>}
                </div>
                <div style={{ height: 3, background: "var(--color-background)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: info.color, borderRadius: 2, opacity: 0.75 }} />
                </div>
              </div>
              <span style={{ fontSize: 9.5, color: "#999", flexShrink: 0 }}>{g.completedCount}/{target} this wk</span>
              <button onClick={() => logSession.mutate(g.id)} title="Log a session for this goal" style={{
                fontSize: 9.5, padding: "3px 9px", borderRadius: 12, border: "1px solid #e0dad0",
                background: "var(--color-card-2)", color: "#6a6258", cursor: "pointer", flexShrink: 0,
              }}>+ log</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ConditionsStrip ──────────────────────────────────────────────────────────────

// Slow outer retrogrades run nearly half of every year — they're wallpaper, not
// news, and shouldn't sit front-and-center next to a Mercury retrograde that
// actually changes your week. They collapse to one muted line at the bottom.
const FAST_RETRO = new Set(["Mercury", "Venus", "Mars"]);

function ConditionsStrip({ now, today }: { now: any; today: string }) {
  const retros: string[] = now?.retrogrades ?? [];
  const fastRetros = retros.filter((p) => FAST_RETRO.has(p));
  const slowRetros = retros.filter((p) => !FAST_RETRO.has(p));
  const ecl = activeEclipse(today, 5);
  // Planet-planet aspects moved OUT of this strip — they're the moment's
  // headline now (BigSky, up top), not a background condition. This strip is
  // for the genuinely standing weather: retrogrades and eclipse windows.
  const signOf = (p: string) => (now?.planets ?? []).find((x: any) => x.planet === p)?.sign ?? "";

  const hasAny = retros.length > 0 || ecl;
  if (!hasAny) return null;

  return (
    <div style={{ background: "var(--color-card-2)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--color-muted)", marginBottom: 8 }}>
        Standing conditions
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {ecl && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ fontSize: 13, flexShrink: 0 }}>{ecl.eclipse.kind === "solar" ? "☀" : "🌑"}</span>
            <div style={{ fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.45 }}>
              <b style={{ color: "#8a6a30" }}>
                {ecl.daysAway === 0 ? "Today" : ecl.daysAway > 0 ? `In ${ecl.daysAway}d` : `${-ecl.daysAway}d ago`}
                {" · "}{ecl.eclipse.type} {ecl.eclipse.kind} eclipse
              </b>
              <div style={{ color: "var(--color-muted)" }}>{ecl.eclipse.note}</div>
            </div>
          </div>
        )}
        {fastRetros.map((p) => (
          <div key={p} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ fontSize: 12, flexShrink: 0, color: "#a06040" }}>{PLANET_GLYPH[p] ?? p[0]}℞</span>
            <div style={{ fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.45 }}>
              <b style={{ color: "#8a5a40" }}>{p} retrograde{signOf(p) ? ` in ${signOf(p)}` : ""}</b>
              {" — "}{(RETRO_NOTES[p] ?? `${p} retrograde.`).replace(`${p} retrograde — `, "")}
            </div>
          </div>
        ))}
        {slowRetros.length > 0 && (
          <div style={{ fontSize: 9.5, color: "#b0a89c", paddingTop: 5, borderTop: "1px solid var(--color-border)", lineHeight: 1.5 }}>
            background · {slowRetros.map((p) => `${p} ℞${signOf(p) ? ` in ${signOf(p)}` : ""}`).join(" · ")} — slow inner revisions, in effect for months
          </div>
        )}
      </div>
    </div>
  );
}

// ── TideFeedback (the reflect-don't-predict loop) ───────────────────────────────

const FELT_OPTIONS: { key: string; label: string; icon: string; color: string }[] = [
  { key: "aligned", label: "Aligned", icon: "◎", color: "#4a8060" },
  { key: "mixed",   label: "Mixed",   icon: "◐", color: "#a08040" },
  { key: "off",     label: "Off",     icon: "○", color: "#9a6060" },
];

function feltKey(testerId: string | null, date: string) { return `obs_felt_${testerId ?? "anon"}_${date}`; }

function TideFeedback({ now, today, testerId }: { now: any; today: string; testerId: string | null }) {
  const [rating, setRating] = useState<string | null>(() => {
    try { const r = JSON.parse(localStorage.getItem(feltKey(testerId, today)) ?? "null"); return r?.felt ?? null; } catch { return null; }
  });

  // Retrospective: scan the last 30 days of felt logs, tally by tide character
  const retro = useMemo(() => {
    const byChar: Record<string, { aligned: number; total: number }> = {};
    for (let d = 0; d < 30; d++) {
      const day = new Date(new Date(today).getTime() - d * 86400000).toISOString().slice(0, 10);
      try {
        const r = JSON.parse(localStorage.getItem(feltKey(testerId, day)) ?? "null");
        if (r?.felt && r?.character) {
          byChar[r.character] = byChar[r.character] ?? { aligned: 0, total: 0 };
          byChar[r.character].total += 1;
          if (r.felt === "aligned") byChar[r.character].aligned += 1;
        }
      } catch { /* skip */ }
    }
    const ranked = Object.entries(byChar)
      .filter(([, v]) => v.total >= 2)
      .map(([c, v]) => ({ character: c, rate: v.aligned / v.total, total: v.total }))
      .sort((a, b) => b.rate - a.rate);
    return ranked;
  }, [today, testerId, rating]);

  function pick(felt: string) {
    setRating(felt);
    localStorage.setItem(feltKey(testerId, today), JSON.stringify({
      felt, character: now?.tide?.character ?? null, level: now?.tide?.level ?? null, date: today,
    }));
    // Mirror to the day's check-in row (as behaviorTags — no schema change) so
    // the felt loop survives browser clears and reads back in The Log.
    if (!testerId) return;
    const tags = [`felt:${felt}`];
    if (now?.tide?.character) tags.push(`tideChar:${now.tide.character}`);
    if (now?.tide?.level) tags.push(`tideLevel:${now.tide.level}`);
    fetch("/api/check-ins", {
      method: "POST",
      headers: { "x-tester-id": testerId, "Content-Type": "application/json" },
      body: JSON.stringify({ date: today, behaviorTags: tags }),
    }).catch(() => {});
  }

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-foreground)" }}>How did today feel?</span>
        {rating && <span style={{ fontSize: 9, color: "var(--color-muted)" }}>logged ✓ — tap to change</span>}
      </div>
      <div style={{ display: "flex", gap: 7 }}>
        {FELT_OPTIONS.map((o) => (
          <button key={o.key} onClick={() => pick(o.key)} style={{
            flex: 1, padding: "8px 6px", borderRadius: 8, cursor: "pointer",
            border: rating === o.key ? `1.5px solid ${o.color}` : "1px solid var(--color-border)",
            background: rating === o.key ? `${o.color}12` : "var(--color-card-2)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          }}>
            <span style={{ fontSize: 15, color: o.color }}>{o.icon}</span>
            <span style={{ fontSize: 9.5, color: rating === o.key ? o.color : "var(--color-muted)", fontWeight: rating === o.key ? 600 : 400 }}>{o.label}</span>
          </button>
        ))}
      </div>
      {retro.length > 0 && (
        <div style={{ marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--color-border)" }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--color-muted)", marginBottom: 6 }}>
            Your pattern (last 30 days)
          </div>
          <div style={{ fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.5 }}>
            Your most aligned days have been{" "}
            <b style={{ color: "#4a8060" }}>
              {retro[0].character.charAt(0).toUpperCase() + retro[0].character.slice(1)} Tides
            </b>{" "}
            ({Math.round(retro[0].rate * 100)}% aligned, {retro[0].total} logged).
          </div>
        </div>
      )}
    </div>
  );
}

// ── DayTimeline ────────────────────────────────────────────────────────────────

const CHALDEAN_TL = ["Saturn","Jupiter","Mars","Sun","Venus","Mercury","Moon"];
const WEEKDAY_RULERS_TL = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"];

const PLANET_COLORS_TL: Record<string,string> = {
  Sun:"#c08020", Moon:"#7080a0", Mercury:"#608060", Venus:"#c06090",
  Mars:"#c04040", Jupiter:"#6040a0", Saturn:"#807060",
};

const ASPECT_ICON: Record<string,string> = {
  conjunction:"☌", trine:"△", sextile:"⚹", square:"□", opposition:"☍",
};

const EVENT_COLORS: Record<string,string> = {
  moon_phase:"#7080a0", ingress:"#4a7040", voc:"#b0a030", crossing:"#6040a0", moon_aspect:"#3a7080", quality_window:"#40a060",
};

function tlApproxSunriseSunset(dateStr: string, lat: number, lon: number): {sunrise: Date; sunset: Date} | null {
  const base = new Date(dateStr + "T12:00:00");
  const jd = base.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = ((280.460 + 0.9856474 * n) % 360 + 360) % 360;
  const g = (((357.528 + 0.9856003 * n) % 360 + 360) % 360) * Math.PI / 180;
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180;
  const sinDec = Math.sin(23.439 * Math.PI / 180) * Math.sin(lambda);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.sin(-0.833 * Math.PI / 180) - Math.sin(lat * Math.PI / 180) * sinDec) /
               (Math.cos(lat * Math.PI / 180) * cosDec);
  if (Math.abs(cosH) > 1) return null;
  const H = Math.acos(cosH) * 180 / Math.PI;
  const B = (360 / 365) * (n - 81) * Math.PI / 180;
  const EqT = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const lstNoon = 12 - lon / 15 - EqT / 60;
  const sunriseH = lstNoon - H / 15;
  const sunsetH  = lstNoon + H / 15;
  const midnight = new Date(dateStr + "T00:00:00");
  return {
    sunrise: new Date(midnight.getTime() + sunriseH * 3600000),
    sunset:  new Date(midnight.getTime() + sunsetH  * 3600000),
  };
}

function tlComputePlanetaryHours(dateStr: string, lat: number, lon: number) {
  const ss = tlApproxSunriseSunset(dateStr, lat, lon);
  const ss1 = tlApproxSunriseSunset(
    new Date(new Date(dateStr).getTime() + 86400000).toISOString().slice(0,10), lat, lon
  );
  if (!ss || !ss1) return [];
  const { sunrise, sunset } = ss;
  const { sunrise: nextSunrise } = ss1;
  const dayRuler = WEEKDAY_RULERS_TL[sunrise.getDay()];
  const dayIdx = CHALDEAN_TL.indexOf(dayRuler);
  const dayLen = sunset.getTime() - sunrise.getTime();
  const dayH = dayLen / 12;
  const nightLen = nextSunrise.getTime() - sunset.getTime();
  const nightH = nightLen / 12;
  const hours: {ruler:string; start:Date; end:Date; isDay:boolean}[] = [];
  for (let i = 0; i < 12; i++) {
    hours.push({ ruler: CHALDEAN_TL[(dayIdx + i) % 7], start: new Date(sunrise.getTime() + i * dayH), end: new Date(sunrise.getTime() + (i+1) * dayH), isDay: true });
  }
  for (let i = 0; i < 12; i++) {
    hours.push({ ruler: CHALDEAN_TL[(dayIdx + 12 + i) % 7], start: new Date(sunset.getTime() + i * nightH), end: new Date(sunset.getTime() + (i+1) * nightH), isDay: false });
  }
  return hours;
}

function DayTimeline({ today, now, lat, lon, skyEvents }: {
  today: string; now: any; lat: number; lon: number; skyEvents: SkyEvent[];
}) {
  const fmtTime = useTimeFormat();
  const HOUR_START = 5, HOUR_END = 23;
  const ROW_H = 52;

  const planetHours = useMemo(() => tlComputePlanetaryHours(today, lat, lon), [today, lat, lon]);
  const nowDate = new Date();
  const nowFrac = (nowDate.getHours() + nowDate.getMinutes() / 60 - HOUR_START) / (HOUR_END - HOUR_START);

  const todayEvents = useMemo(() =>
    skyEvents.filter(e => e.date === today && e.time),
    [skyEvents, today]
  );

  function hourFrac(h: number) { return (h - HOUR_START) / (HOUR_END - HOUR_START); }

  // Map events to fractional position
  const eventPositions = useMemo(() =>
    todayEvents.map(e => {
      const [hh, mm] = (e.time ?? "00:00").split(":").map(Number);
      const frac = hourFrac(hh + mm / 60);
      return { e, frac };
    }).filter(x => x.frac >= 0 && x.frac <= 1),
    [todayEvents]
  );

  const totalH = (HOUR_END - HOUR_START) * ROW_H;

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
      <div style={{ padding: "12px 18px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>Today's Hours</div>
        <div style={{ fontSize: 9, color: "#aaa" }}>Planetary hours + sky events</div>
      </div>
      <div style={{ position: "relative", height: Math.min(totalH, 560), overflowY: "auto" }}>
        {/* Hour rows */}
        {Array.from({length: HOUR_END - HOUR_START}, (_, i) => {
          const h = HOUR_START + i;
          const isNow = nowDate.getHours() === h;
          // find planetary hour for midpoint of this clock hour
          const midMs = new Date(today + `T${String(h).padStart(2,"0")}:30:00`).getTime();
          const ph = planetHours.find(p => p.start.getTime() <= midMs && p.end.getTime() > midMs);
          const pColor = ph ? (PLANET_COLORS_TL[ph.ruler] ?? "#888") : "#ccc";
          return (
            <div key={h} style={{
              height: ROW_H, display: "flex", alignItems: "stretch",
              borderBottom: "1px solid var(--color-border)",
              background: isNow ? "#fffbf0" : ph?.isDay === false ? "#f5f3f7" : "#fff",
            }}>
              {/* Time label */}
              <div style={{ width: 42, flexShrink: 0, display: "flex", alignItems: "flex-start", paddingTop: 6, paddingLeft: 12, fontSize: 9, color: isNow ? "#b07820" : "#bbb", fontWeight: isNow ? 700 : 400 }}>
                {h === 12 ? "12p" : h > 12 ? `${h-12}p` : `${h}a`}
              </div>
              {/* Planet hour bar */}
              <div style={{ width: 54, flexShrink: 0, display: "flex", alignItems: "center", paddingLeft: 4, borderLeft: `3px solid ${pColor}30`, background: `${pColor}08` }}>
                {ph && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <div style={{ fontSize: 9, color: pColor, fontWeight: 600 }}>{ph.ruler}</div>
                    <div style={{ fontSize: 7, color: "#bbb" }}>{ph.isDay ? "☉" : "☽"}</div>
                  </div>
                )}
              </div>
              {/* Event slot */}
              <div style={{ flex: 1, position: "relative", paddingLeft: 8, display: "flex", flexDirection: "column", justifyContent: "center", gap: 2 }}>
                {eventPositions
                  .filter(({ frac }) => {
                    const evH = HOUR_START + frac * (HOUR_END - HOUR_START);
                    return Math.floor(evH) === h;
                  })
                  .map(({ e }, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: EVENT_COLORS[e.type] ?? "#aaa", flexShrink: 0 }} />
                      <div style={{ fontSize: 9.5, color: EVENT_COLORS[e.type] ?? "#666", fontWeight: 500 }}>{e.icon} {e.title}</div>
                      {e.time && <div style={{ fontSize: 8, color: "#bbb", marginLeft: "auto", paddingRight: 12 }}>
                        {fmtTime(new Date(`${today}T${e.time}`))}
                      </div>}
                    </div>
                  ))
                }
                {/* Now indicator line */}
                {isNow && (
                  <div style={{
                    position: "absolute", left: 0, right: 0,
                    top: `${(nowDate.getMinutes() / 60) * 100}%`,
                    height: 2, background: "#b07820", opacity: 0.6, pointerEvents: "none",
                  }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ModulePulse ────────────────────────────────────────────────────────────────

const MODULE_META: Record<string, { label: string; icon: string; view: string }> = {
  health:        { label: "Health",        icon: "◎", view: "work" },
  creative:      { label: "Creative",      icon: "✦", view: "work" },
  spiritual:     { label: "Spiritual",     icon: "☽", view: "work" },
  home:          { label: "Home",          icon: "⌂", view: "work" },
  financial:     { label: "Financial",     icon: "◇", view: "work" },
  relationships: { label: "Relationships", icon: "◈", view: "work" },
  content:       { label: "Content",       icon: "◻", view: "work" },
};

// Resonant Now, redesigned per feedback: the Moon's sign was the only driver and
// the module names (Creative/Spiritual/Relationships) were too vague to act on.
// Now THREE independent voices each contribute one CONCRETE suggestion, each
// with a chip naming its source: the planetary hour (fastest), the Moon's sign
// (the ~2.5-day texture), and the strongest applying Moon aspect (the day's
// event). Concrete verbs come from the language layer (PLANET_ACTIVITIES /
// SIGN_MYTHOS) instead of module labels.
function ModulePulse({ now }: { now: any; onNavigate?: (v: string) => void }) {
  const moonSign: string = (now?.moonSign ?? "").split(" ")[0];
  const hourPlanet: string = now?.planetaryHour?.planet ?? "";
  const sm = SIGN_MYTHOS[moonSign];
  // Tap-to-cycle offsets, one per card. Each card carries its voice's WHOLE
  // list — the seeded pick is just the opening suggestion, and tapping turns
  // up the other ways that same influence could play out, in place.
  const [offs, setOffs] = useState<Record<number, number>>({});

  const suggestions: { options: string[]; seed: number; source: string; color: string; title?: string; suffix?: string }[] = [];

  // 1 — the hour's voice (seed rotates with the hour so untouched cards vary)
  const hourActs = PLANET_ACTIVITIES[hourPlanet];
  if (hourActs?.length) {
    suggestions.push({
      options: hourActs,
      seed: new Date().getHours(),
      source: `${hourPlanet} hour`,
      color: PLANET_THEMES[hourPlanet]?.color ?? "#8a8278",
      title: PLANET_MYTHOS[hourPlanet]?.whenLoud,
    });
  }

  // 2 — the Moon's sign (seed rotates daily so a 2.5-day sign doesn't repeat)
  if (sm) {
    suggestions.push({
      options: sm.favors,
      seed: new Date().getDate(),
      source: `Moon in ${moonSign}`,
      color: ELEMENT_COLORS[sm.element as Element] ?? "#4a6a90",
      title: sm.feel,
    });
  }

  // 3 — the strongest applying Moon aspect: harmonious → lean into the partner's
  // activities; hard → the partner's voice needs a deliberate, softer outlet.
  const applying = (now?.moonAspects ?? [])
    .filter((a: any) => a.applying)
    .sort((a: any, b: any) => (a.hoursToExact ?? 99) - (b.hoursToExact ?? 99))[0];
  if (applying) {
    const partner = applying.planet1 === "Moon" ? applying.planet2 : applying.planet1;
    const acts = PLANET_ACTIVITIES[partner];
    const hard = applying.aspect === "square" || applying.aspect === "opposition";
    if (acts?.length) {
      suggestions.push({
        options: acts,
        seed: hard ? 0 : new Date().getDate(),
        suffix: hard ? " — gently; this current runs hot" : undefined,
        source: `Moon ${applying.aspect} ${partner}`,
        color: hard ? "#a05050" : "#4a7aa0",
        title: PLANET_MYTHOS[partner]?.essence,
      });
    }
  }

  if (suggestions.length === 0) return null;

  return (
    <div style={{ margin: "12px 0" }}>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.8px", color: "#9a9090", marginBottom: 8 }}>
        Resonant now <span style={{ letterSpacing: 0, textTransform: "none", color: "#c0b8ac" }}>· tap a card for another way in</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {suggestions.map((s, i) => {
          const n = s.options.length;
          const idx = (((s.seed % n) + n) % n + (offs[i] ?? 0)) % n;
          return (
            <button key={i} onClick={() => setOffs((o) => ({ ...o, [i]: (o[i] ?? 0) + 1 }))} title={s.title} style={{
              flex: "1 1 180px", background: "var(--color-card)", border: `1px solid ${s.color}30`,
              borderLeft: `3px solid ${s.color}`, borderRadius: 10, padding: "10px 12px",
              cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 5,
            }}>
              <div key={idx} className="phrase-in" style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)", lineHeight: 1.35 }}>
                {s.options[idx]}{s.suffix && <span style={{ fontWeight: 400, color: "#a05050" }}>{s.suffix}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
                <span style={{ fontSize: 8.5, color: s.color, fontWeight: 600 }}>{s.source}</span>
                <span style={{ fontSize: 8.5, color: "#c0b8ac", flexShrink: 0 }}>⟳ {idx + 1}/{n}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── BigSky — the moment's defining aspects, prominent and explorable ──────────
// The sky's headline weather (a tight Sun□Saturn, a Mars☌Uranus) was buried as
// one-liners in Standing Conditions. These are often THE pronounced qualities
// of a moment, so they get real estate right under the hero: one plain
// sentence collapsed, and on expand a full reading with cycling "takes,"
// planet-in-sign context, and a plain explanation of the aspect itself.


function BigSkyCard({ asp, signOf }: { asp: any; signOf: (p: string) => string }) {
  const [open, setOpen] = useState(false);
  const [takeIdx, setTakeIdx] = useState(0);
  const aspect = (asp.aspect ?? "").toLowerCase() as AspectName;
  const geo = ASPECT_GEOMETRY[aspect];
  if (!geo) return null;

  const a = { planet: asp.planet1, sign: signOf(asp.planet1) };
  const b = { planet: asp.planet2, sign: signOf(asp.planet2) };
  const takes = composeTakes(a, b, aspect);
  const essence = composeEssence(a, b, aspect);
  const guidance = composeGuidance(a, b, aspect);
  const hard = aspect === "square" || aspect === "opposition";
  const accent = hard ? "#a05020" : aspect === "conjunction" ? "#8a6a20" : "#3a6020";

  const timing = asp.stationsBeforeExact
    ? "℞ stations before exact"
    : asp.neverPerfected
      ? "℞ separating · never perfected"
      : asp.applying && asp.hoursToExact != null
        ? `exact ${fmtExactWhen(asp.hoursToExact)}`
        : !asp.applying && asp.hoursSinceExact != null
          ? `peaked ${fmtSinceExact(asp.hoursSinceExact)}`
          : null;

  return (
    <div style={{ border: `1px solid ${accent}30`, borderLeft: `3px solid ${accent}`, borderRadius: 12, background: "var(--color-card)", overflow: "hidden" }}>
      <button onClick={() => setOpen(v => !v)} style={{ width: "100%", textAlign: "left", padding: "12px 14px", border: "none", background: "none", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, letterSpacing: 1 }}>
            {BIGSKY_PLANET_GLYPH[a.planet]}<span style={{ color: accent, fontWeight: 700 }}>{geo.symbol}</span>{BIGSKY_PLANET_GLYPH[b.planet]}
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-primary)" }}>
            {a.planet} in {a.sign} {geo.symbol} {b.planet} in {b.sign}
          </span>
          {timing && <span style={{ fontSize: 9, color: "#b07030", background: "#fff8e8", border: "1px solid #e8d080", padding: "1px 6px", borderRadius: 5 }}>{timing}</span>}
          <span style={{ marginLeft: "auto", fontSize: 10, color: "#bbb", flexShrink: 0 }}>{open ? "▲ less" : "▼ explore"}</span>
        </div>
        <div style={{ fontSize: 11.5, color: "#666", lineHeight: 1.55, marginTop: 5 }}>{essence}</div>
      </button>

      {open && (
        <div style={{ padding: "0 14px 12px", borderTop: "1px solid var(--color-border)" }}>
          {/* The take — cycle through genuinely different framings */}
          <div style={{ marginTop: 10, background: "var(--color-card-2)", borderRadius: 9, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: accent }}>{takes[takeIdx].label}</span>
              <button onClick={() => setTakeIdx(i => (i + 1) % takes.length)} style={{ fontSize: 9.5, color: "#7a8a9a", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                another take ↻ <span style={{ color: "#bbb" }}>{takeIdx + 1}/{takes.length}</span>
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: "#555", lineHeight: 1.65 }}>{takes[takeIdx].text}</div>
          </div>

          {/* Favors / watch */}
          <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#3a6020" }}>FAVORS </span>
              <span style={{ fontSize: 10.5, color: "#666", lineHeight: 1.5 }}>{guidance.favors}</span>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#a04030" }}>WATCH </span>
              <span style={{ fontSize: 10.5, color: "#666", lineHeight: 1.5 }}>{guidance.watch}</span>
            </div>
          </div>

          {/* The players — planet-in-sign context */}
          <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 4 }}>
            {[a, b].map((p) => {
              const pc = PLANET_CORE[p.planet];
              return (
                <div key={p.planet} style={{ fontSize: 10.5, color: "#8a8278", lineHeight: 1.5 }}>
                  <span style={{ color: "var(--color-foreground)", fontWeight: 600 }}>{BIGSKY_PLANET_GLYPH[p.planet]} {p.planet} in {p.sign}</span>
                  {pc ? ` — ${pc.is}.` : ""}
                  <span style={{ color: "#a89a88" }}> In {p.sign}: {SIGN_INFLECTION[p.sign] ?? ""}.</span>
                </div>
              );
            })}
          </div>

          {/* The concept, explained plainly */}
          <div style={{ marginTop: 9, fontSize: 10, color: "#a09888", lineHeight: 1.55, fontStyle: "italic" }}>
            What a {geo.word} is: {geo.angle} apart. {geo.explain}
          </div>
        </div>
      )}
    </div>
  );
}

function BigSky({ now }: { now: any }) {
  const aspects: any[] = now?.aspects ?? [];
  const planets: any[] = now?.planets ?? [];
  const signOf = (p: string) => planets.find((x) => x.planet === p)?.sign ?? "";

  const headliners = aspects
    .filter((a) => a.planet1 !== "Moon" && a.planet2 !== "Moon" && a.orb <= 6)
    .map((a) => ({ a, score: aspectSignificance(a) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, 3)
    // Keep only genuinely loud ones — a lone weak sextile shouldn't fake a headline.
    .filter(({ score }, i) => i === 0 || score >= 12)
    .map(({ a }) => a);

  if (headliners.length === 0) return null;

  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 7, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "#8a8278" }}>The big sky</div>
        <div style={{ fontSize: 10, color: "#b0a898" }}>the strongest planet-to-planet weather right now — tap to explore</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {headliners.map((a, i) => <BigSkyCard key={`${a.planet1}-${a.planet2}-${i}`} asp={a} signOf={signOf} />)}
      </div>
    </div>
  );
}

// ── TodayHabits — compact check-off strip on the glance layer ─────────────────

// ── RitualCard — the twice-a-day check-in anchor ─────────────────────────────
// Today reads the clock: mornings open with "Cast off" (weather line, habit
// encouragement with streaks, today's three), evenings close with "Log the
// day" (what got done, an earned accomplishment line, tomorrow's water).
// Midday, the card stays out of the way entirely.

const STREAK_NUDGE = (streak: number) =>
  streak >= 21 ? `day ${streak + 1} — this is who you are now`
  : streak >= 7 ? `day ${streak + 1} — the streak is the point`
  : streak >= 3 ? `day ${streak + 1} — momentum is real`
  : "small and daily beats big and rare";

function RitualCard({ mode, now, week, todayTasks, windows, gcalEvents, testerId, displayName, onOpenStar, lat, lon }: {
  mode: "morning" | "evening";
  now: any; week: any;
  todayTasks: { id: number; title: string; done: string }[];
  windows: any[] | undefined;
  gcalEvents: { title: string; start: string; end: string; allDay: boolean }[];
  testerId: string | null;
  displayName?: string;
  onOpenStar?: (goalId: number) => void;
  lat?: number; lon?: number;
}) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  // Defensive: these come from queries that can momentarily hand back a
  // non-array (a transient error body). The ritual card is time-gated, so a
  // bad value here surfaces as a whole-page crash rather than a skipped card.
  const tasks = Array.isArray(todayTasks) ? todayTasks : [];
  const wins = Array.isArray(windows) ? windows : [];
  const cal = Array.isArray(gcalEvents) ? gcalEvents : [];
  const { data: habitsRaw = [] } = useQuery<any[]>({
    queryKey: ["habits", testerId],
    queryFn: async () => { const j = await (await fetch("/api/habits", { headers: { "x-tester-id": testerId ?? "" } })).json(); return Array.isArray(j) ? j : []; },
    enabled: !!testerId,
  });
  const habits = Array.isArray(habitsRaw) ? habitsRaw : [];
  const toggleLog = useMutation({
    mutationFn: async ({ id, done }: { id: number; done: boolean }) => {
      const headers = { "x-tester-id": testerId ?? "", "Content-Type": "application/json" };
      if (done) await fetch(`/api/habits/${id}/log?date=${today}`, { method: "DELETE", headers });
      else await fetch(`/api/habits/${id}/log`, { method: "POST", headers, body: JSON.stringify({ date: today }) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits"] }),
  });

  const tide = now?.tide;
  const character = (tide?.character ?? "deep") as TideCharacter;
  const elKey = CHARACTER_ELEMENT[character] ?? "water";
  const elColor = ELEMENT_COLORS[elKey] ?? "#3a5a80";
  const habitList = Array.isArray(habits) ? habits : [];
  const el = now?.element?.element ?? "";

  // The day's flavor, for an honest accomplishment line on heavy days
  const HARD = new Set(["conjunction", "square", "opposition"]);
  const HEAVY = new Set(["Saturn", "Mars", "Pluto"]);
  const heavyContact = (now?.moonAspects ?? [])
    .map((a: any) => ({ ...a, partner: a.planet1 === "Moon" ? a.planet2 : a.planet1 }))
    .find((a: any) => HARD.has(a.aspect) && HEAVY.has(a.partner) && a.orb <= 4);
  const heavyAdj = heavyContact ? PLANET_LITERACY[heavyContact.partner]?.adjective : null;

  const firstName = (displayName ?? "").split(" ")[0];

  // Morning-only: if yesterday was never rated, offer it here — the reflect
  // loop's question belongs to the evening, but an unrated yesterday is still
  // worth thirty seconds over coffee.
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const { data: yDay } = useQuery<any>({
    queryKey: ["logs-day", testerId, yesterday],
    queryFn: async () => {
      const r = await fetch(`/api/logs/day?date=${yesterday}&tz=${new Date().getTimezoneOffset()}`, { headers: { "x-tester-id": testerId ?? "" } });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!testerId && mode === "morning",
    staleTime: 1000 * 60 * 30,
  });
  const [yRated, setYRated] = useState<string | null>(null);
  const yesterdayFelt = yRated ?? (yDay?.checkIn?.behaviorTags ?? []).find((t: string) => t.startsWith("felt:"))?.slice(5) ?? null;
  const rateYesterday = (felt: string) => {
    setYRated(felt);
    fetch("/api/check-ins", {
      method: "POST",
      headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
      body: JSON.stringify({ date: yesterday, behaviorTags: [`felt:${felt}`] }),
    }).catch(() => {});
  };

  if (mode === "morning") {
    const nowMs = Date.now();
    const nextEvent = cal
      .filter((e) => !e.allDay && Date.parse(e.end) > nowMs)
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
    const nextBlock = wins.filter((w: any) => !w.completedAt)
      .sort((a: any, b: any) => Date.parse(a.startTime) - Date.parse(b.startTime))[0];
    const nextTask = tasks.find((t) => t.done !== "true");
    const three = [
      nextTask && { glyph: "☐", label: nextTask.title, sub: "top task" },
      nextEvent && { glyph: "◷", label: nextEvent.title, sub: new Date(nextEvent.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) },
      nextBlock && { glyph: "▸", label: nextBlock.title, sub: new Date(nextBlock.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) },
    ].filter(Boolean) as { glyph: string; label: string; sub: string }[];

    return (
      <div style={{ background: `linear-gradient(135deg, ${elColor}16, ${elColor}05)`, border: `1px solid ${elColor}30`, borderRadius: 14, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--color-primary)" }}>⛵ Cast off{firstName ? `, ${firstName}` : ""}</span>
          <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: elColor }}>morning</span>
        </div>
        <div style={{ fontSize: 11.5, color: "#777", marginBottom: 10 }}>
          {CHARACTER_LABEL[character]} tide, {tide?.levelLabel?.toLowerCase() ?? "steady"} — {CHARACTER_ESSENCE[character]?.toLowerCase().replace(/\.$/, "")}.
        </div>

        {/* Yesterday, if it slipped past unrated */}
        {testerId && yDay !== undefined && !yesterdayFelt && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 10.5, color: "#998a76" }}>
            <span>Yesterday felt…</span>
            {[["aligned", "●", "#4a8060"], ["mixed", "◐", "#a08040"], ["off", "○", "#9a6060"]].map(([k, icon, c]) => (
              <button key={k} onClick={() => rateYesterday(k)} style={{
                fontSize: 10.5, padding: "2px 10px", borderRadius: 12, cursor: "pointer",
                border: "1px solid var(--color-border)", background: "var(--color-card)", color: c,
              }}>{icon} {k}</button>
            ))}
          </div>
        )}
        {yRated && <div style={{ fontSize: 10, color: "#4a8060", marginBottom: 10 }}>✓ yesterday logged</div>}

        {/* The morning glance: one row per Guiding Star — next move + today's
            best window for its element; tap → that star's game plan. */}
        <StarRows testerId={testerId} lat={lat} lon={lon} onOpenStar={onOpenStar} />

        {habitList.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {habitList.map((h: any) => {
                const resonant = !h.doneToday && el && h.favoredElements?.includes(el);
                // Daily sun/moon anchor — fire rides sunrise, air the high sun,
                // earth lands by sunset, water takes the Moon's own hour.
                const dl = (now as any)?.daylight;
                const moonHr = ((now as any)?.upcomingHours ?? []).find((u: any) => u.planet === "Moon");
                const fmtT = (iso?: string) => iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;
                const fe = h.favoredElements?.[0];
                const anchor = h.doneToday ? null
                  : fe === "fire" && dl?.sunrise ? `☉ ${fmtT(dl.sunrise)}`
                  : fe === "air" && dl?.sunrise && dl?.sunset ? `☉ ${fmtT(new Date((Date.parse(dl.sunrise) + Date.parse(dl.sunset)) / 2).toISOString())}`
                  : fe === "earth" && dl?.sunset ? `☉ by ${fmtT(dl.sunset)}`
                  : fe === "water" && moonHr ? `☽ ${moonHr.time}`
                  : null;
                return (
                  <button key={h.id} onClick={() => toggleLog.mutate({ id: h.id, done: h.doneToday })}
                    title={anchor ? "A daily sky anchor for this habit — sun or moon time that suits its element" : undefined}
                    style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 18, cursor: "pointer",
                    border: h.doneToday ? "1px solid #4a806040" : `1px solid ${resonant ? elColor : "var(--color-border)"}`,
                    background: h.doneToday ? "#4a806012" : "var(--color-card)",
                  }}>
                    <span style={{ fontSize: 11, color: h.doneToday ? "#4a8060" : "#999" }}>{h.doneToday ? "✓" : "○"}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: h.doneToday ? "#4a8060" : "var(--color-foreground)" }}>{h.name}</span>
                    {resonant && <span style={{ fontSize: 10, color: elColor }}>✦</span>}
                    <span style={{ fontSize: 9, color: "#aaa" }}>{h.doneToday ? `${h.streak}d` : STREAK_NUDGE(h.streak ?? 0)}</span>
                    {anchor && <span style={{ fontSize: 8.5, color: "#998a76" }}>{anchor}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {three.length > 0 ? (
          <div>
            <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.6px", color: "#aaa", marginBottom: 5 }}>Today's three</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {three.map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12 }}>
                  <span style={{ color: elColor, width: 14, textAlign: "center", flexShrink: 0 }}>{t.glyph}</span>
                  <span style={{ color: "var(--color-foreground)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</span>
                  <span style={{ fontSize: 9.5, color: "#aaa", flexShrink: 0 }}>{t.sub}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "#999" }}>Nothing on deck yet — weave the day in <b>Plan</b>, or just ride the tide.</div>
        )}
      </div>
    );
  }

  // ── Evening: Log the day ──
  const keptHabits = habitList.filter((h: any) => h.doneToday);
  const doneBlocks = wins.filter((w: any) => w.completedAt);
  const closedTasks = tasks.filter((t) => t.done === "true");
  const didAnything = keptHabits.length + doneBlocks.length + closedTasks.length > 0;
  const parts: string[] = [];
  if (habitList.length) parts.push(`kept ${keptHabits.length} of ${habitList.length} habit${habitList.length === 1 ? "" : "s"}`);
  if (closedTasks.length) parts.push(`closed ${closedTasks.length} task${closedTasks.length === 1 ? "" : "s"}`);
  if (doneBlocks.length) parts.push(`completed ${doneBlocks.length} block${doneBlocks.length === 1 ? "" : "s"}`);
  const tomorrow = (week?.days ?? [])[1];
  const tomorrowChar = tomorrow?.element ? ({ water: "Deep", fire: "Surge", earth: "Building", air: "Clear" } as Record<string, string>)[tomorrow.element] : null;

  return (
    <div style={{ background: `linear-gradient(135deg, ${elColor}16, ${elColor}05)`, border: `1px solid ${elColor}30`, borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--color-primary)" }}>🌙 Log the day{firstName ? `, ${firstName}` : ""}</span>
        <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: elColor }}>evening</span>
      </div>

      {didAnything ? (
        <>
          <div style={{ fontSize: 12.5, color: "var(--color-foreground)", marginBottom: 6 }}>
            You {parts.join(" · ")}.
            {heavyAdj && <span style={{ color: "#8a7060" }}> On a {heavyAdj} day, that counts double.</span>}
          </div>
          {keptHabits.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
              {keptHabits.map((h: any) => (
                <span key={h.id} style={{ fontSize: 10, padding: "3px 9px", borderRadius: 14, background: "#4a806012", border: "1px solid #4a806030", color: "#4a8060", fontWeight: 600 }}>
                  ✓ {h.name}{h.streak > 0 ? ` · ${h.streak}d` : ""}
                </span>
              ))}
            </div>
          )}
          {habitList.some((h: any) => !h.doneToday) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
              {habitList.filter((h: any) => !h.doneToday).map((h: any) => (
                <button key={h.id} onClick={() => toggleLog.mutate({ id: h.id, done: false })} style={{
                  fontSize: 10, padding: "3px 9px", borderRadius: 14, background: "var(--color-card)",
                  border: "1px solid var(--color-border)", color: "#999", cursor: "pointer",
                }}>○ {h.name} — did it? tap to log</button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
          A quiet day in the log is still a day in the log.
          {(tide?.level === "low" || tide?.level === "ebb") && " The tide was low — resting was reading the water right."}
        </div>
      )}

      {/* The harvest: today's wins (auto + named) and the line in your own
          words — this is the loop's evening half. */}
      <EveningHarvest testerId={testerId} lat={lat} lon={lon} />

      <div style={{ fontSize: 10.5, color: "#999", paddingTop: 8, borderTop: "1px solid var(--color-border)" }}>
        Rate the day below — it lands in the Log, stamped with tonight's sky.
        {tomorrowChar && <span style={{ color: "#8a8278" }}> Tomorrow: a {tomorrowChar} day.</span>}
      </div>
    </div>
  );
}

function TodayHabits({ testerId, now }: { testerId: string; now: any }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: habits = [] } = useQuery<any[]>({
    queryKey: ["habits", testerId],
    queryFn: async () => (await fetch("/api/habits", { headers: { "x-tester-id": testerId } })).json(),
  });

  const toggleLog = useMutation({
    mutationFn: async ({ id, done }: { id: number; done: boolean }) => {
      const headers = { "x-tester-id": testerId, "Content-Type": "application/json" };
      if (done) await fetch(`/api/habits/${id}/log?date=${today}`, { method: "DELETE", headers });
      else await fetch(`/api/habits/${id}/log`, { method: "POST", headers, body: JSON.stringify({ date: today }) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits"] }),
  });

  // Practices fold in here — habits and practices are ONE daily-doing card
  // now, with practice timing expressed in the app's FIT language instead of
  // its own resonant/supported/soften dialect.
  const { data: practicesData } = usePractices(testerId, 40.7, -74.0);
  const practiceRows = (practicesData?.practices ?? []).filter((p: any) => p.timing !== "neutral").slice(0, 4);
  const FIT_LABEL: Record<string, { text: string; color: string }> = {
    resonant: { text: "✦ a great time for this", color: "#3a7040" },
    supported: { text: "· this time will do", color: "#8a8278" },
    soften: { text: "≋ against the current — soften it", color: "#a06020" },
    protect: { text: "≋ against the current — protect the minimum", color: "#a06020" },
  };

  // Daily sun/moon link per habit — a concrete anchor in the day's real sky:
  // fire → sunrise, air → midday sun, earth → before sunset, water → the
  // Moon's own planetary hour.
  const fmtT = (iso?: string) => iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;
  const dl = (now as any)?.daylight;
  const moonHour = ((now as any)?.upcomingHours ?? []).find((u: any) => u.planet === "Moon");
  const anchorFor = (h: any): { label: string; why: string } | null => {
    const e = h.favoredElements?.[0];
    if (e === "fire" && dl?.sunrise) return { label: `☉ sunrise ${fmtT(dl.sunrise)}`, why: "Fire habits ride the rising sun — anchor it to first light." };
    if (e === "air" && dl?.sunrise && dl?.sunset) {
      const noon = new Date((Date.parse(dl.sunrise) + Date.parse(dl.sunset)) / 2);
      return { label: `☉ midday ${fmtT(noon.toISOString())}`, why: "Air habits suit the high sun — clear head, full light." };
    }
    if (e === "earth" && dl?.sunset) return { label: `☉ by sunset ${fmtT(dl.sunset)}`, why: "Earth habits close the day — land it before the light goes." };
    if (e === "water" && moonHour) return { label: `☽ Moon hour ${moonHour.time}`, why: "Water habits belong to the Moon — its own hour today." };
    return null;
  };

  if ((!Array.isArray(habits) || habits.length === 0) && practiceRows.length === 0) return null;
  const doneCount = habits.filter((h) => h.doneToday).length;

  // Resonance against the current moment, same lightweight scoring the Habits
  // page uses — a habit whose favored element matches today floats up.
  const el = now?.element?.element ?? "";
  const sorted = [...habits].sort((a, b) => {
    const score = (h: any) => (h.doneToday ? -2 : 0) + (h.favoredElements?.includes(el) ? 1 : 0);
    return score(b) - score(a);
  });

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "12px 16px", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>Habits & practices</div>
        {habits.length > 0 && <div style={{ fontSize: 9.5, color: "#999" }}>{doneCount}/{habits.length} done</div>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {sorted.map((h) => {
          const resonant = !h.doneToday && el && h.favoredElements?.includes(el);
          const anchor = !h.doneToday ? anchorFor(h) : null;
          return (
            <button key={h.id} onClick={() => toggleLog.mutate({ id: h.id, done: h.doneToday })}
              title={[resonant ? `Favors ${el} days — a great time for this` : null, anchor?.why].filter(Boolean).join(" ") || undefined}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 12px 6px 8px", borderRadius: 18,
                cursor: "pointer", fontSize: 11.5,
                border: h.doneToday ? "1px solid #a8c898" : resonant ? "1px solid #b8ccb0" : "1px solid var(--color-border)",
                background: h.doneToday ? "#eef6e8" : "var(--color-card-2)",
                color: h.doneToday ? "#4a7040" : "var(--color-foreground)",
              }}>
              <span style={{
                width: 16, height: 16, borderRadius: "50%", flexShrink: 0, fontSize: 10, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: h.doneToday ? "#80b870" : "transparent",
                border: h.doneToday ? "none" : "1.5px solid #c0bab0",
              }}>{h.doneToday ? "✓" : ""}</span>
              {h.emoji ? `${h.emoji} ` : ""}{h.name}
              {resonant && <span style={{ fontSize: 8.5, color: "#4a8060" }}>✦</span>}
              {anchor && <span style={{ fontSize: 8.5, color: "#998a76" }}>{anchor.label}</span>}
            </button>
          );
        })}
      </div>
      {practiceRows.length > 0 && (
        <div style={{ marginTop: 9, paddingTop: 8, borderTop: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: 3 }}>
          {practiceRows.map((p: any) => {
            const fit = FIT_LABEL[p.timing];
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 11 }}>
                <span style={{ color: "var(--color-foreground)", fontWeight: 500 }}>{p.name}</span>
                {fit && <span style={{ fontSize: 9.5, color: fit.color, fontWeight: 600 }}>{fit.text}</span>}
                {p.reasons?.[0] && <span style={{ fontSize: 9, color: "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.reasons[0]}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── PlanetaryPulse ─────────────────────────────────────────────────────────────

const PLANET_THEMES: Record<string, { themes: string; icon: string; color: string }> = {
  Sun:     { icon:"☉", color:"#c08020", themes:"visibility · authority · vitality · identity" },
  Moon:    { icon:"☽", color:"#7080a0", themes:"feeling · intuition · nourishment · cycles" },
  Mercury: { icon:"☿", color:"#608060", themes:"communication · writing · analysis · ideas" },
  Venus:   { icon:"♀", color:"#c06090", themes:"connection · beauty · pleasure · values" },
  Mars:    { icon:"♂", color:"#c04040", themes:"drive · action · courage · physical energy" },
  Jupiter: { icon:"♃", color:"#6040a0", themes:"expansion · optimism · generosity · faith" },
  Saturn:  { icon:"♄", color:"#807060", themes:"discipline · structure · responsibility · long-term" },
  Uranus:  { icon:"♅", color:"#3090a0", themes:"disruption · innovation · liberation · surprise" },
  Neptune: { icon:"♆", color:"#5060b0", themes:"imagination · transcendence · compassion · dissolution" },
  Pluto:   { icon:"♇", color:"#703060", themes:"transformation · depth · power · shadow" },
};

const ASPECT_STRENGTH: Record<string, number> = {
  conjunction: 1.0, trine: 0.85, sextile: 0.7, opposition: 0.75, square: 0.75,
};
const ASPECT_NATURE: Record<string, { label: string; note: string }> = {
  conjunction: { label:"☌ conj",  note:"Fusion — both archetypes merge and amplify each other" },
  trine:       { label:"△ trine", note:"Flow — energy moves easily between these themes" },
  sextile:     { label:"⚹ sext",  note:"Opening — an invitation to blend these archetypes" },
  opposition:  { label:"☍ opp",   note:"Tension — integration of opposing principles is the work" },
  square:      { label:"□ sq",    note:"Friction — productive pressure to act or resolve" },
};

// Convert hours-from-now into a readable "when it perfects" label.
function fmtExactWhen(hours: number): string {
  const when = new Date(Date.now() + hours * 3600000);
  if (hours < 48) {
    const t = when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const day = hours < 12 && when.getDate() === new Date().getDate() ? "today"
      : when.toLocaleDateString("en-US", { weekday: "short" });
    return `${day} ${t}`;
  }
  if (hours < 24 * 45) return when.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return when.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// Convert hours-since-perfection into a readable "how long ago" label, for
// separating aspects (the mirror case of fmtExactWhen).
function fmtSinceExact(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m ago`;
  if (hours < 48) return `${Math.round(hours)}h ago`;
  const days = Math.round(hours / 24);
  return days < 45 ? `${days}d ago` : `${Math.round(days / 30)}mo ago`;
}

function PlanetaryPulse({ now }: { now: any }) {
  const moonAspects: any[] = now?.moonAspects ?? [];
  const aspects: any[] = now?.aspects ?? [];

  // Collect all active aspects, scoring by applying + aspect type
  const allAspects = [...moonAspects, ...aspects.filter(a => a.planet1 === "Sun" || a.planet2 === "Sun")];
  if (allAspects.length === 0) return null;

  // Build planet emphasis map
  const emphMap: Record<string, { score: number; aspects: { aspectName: string; partner: string; applying: boolean; hoursToExact: number | null; hoursSinceExact: number | null }[] }> = {};

  for (const a of allAspects) {
    const aspName = (a.aspect ?? "").toLowerCase();
    const strength = ASPECT_STRENGTH[aspName] ?? 0.5;
    const applyBonus = a.applying ? 0.2 : 0;
    const score = strength + applyBonus;

    for (const planet of [a.planet1, a.planet2]) {
      if (!planet || planet === "Moon") continue; // Moon is the lens, not the emphasis
      if (!emphMap[planet]) emphMap[planet] = { score: 0, aspects: [] };
      emphMap[planet].score = Math.max(emphMap[planet].score, score);
      emphMap[planet].aspects.push({
        aspectName: aspName, partner: a.planet1 === planet ? a.planet2 : a.planet1, applying: a.applying,
        hoursToExact: a.hoursToExact ?? null, hoursSinceExact: a.hoursSinceExact ?? null,
      });
    }
  }

  const emphasized = Object.entries(emphMap)
    .filter(([, v]) => v.score > 0.5)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 4);

  if (emphasized.length === 0) return null;

  // Each aspect involves two planets, so it lands in both planets' lists — but
  // the same square shown as "Sun □ Saturn" on one row and "Saturn □ Sun" on
  // the next reads as a duplicate. Show each pair once: the higher-emphasis
  // planet keeps it, the partner's row falls back to its next distinct aspect.
  const shownPairs = new Set<string>();
  const pairKey = (a: string, b: string, asp: string) => [a, b].sort().join("-") + ":" + asp;
  const rows = emphasized.map(([planet, data]) => {
    const asp = data.aspects.find(x => !shownPairs.has(pairKey(planet, x.partner, x.aspectName))) ?? null;
    if (asp) shownPairs.add(pairKey(planet, asp.partner, asp.aspectName));
    return { planet, data, asp };
  });

  return (
    <div style={{ background: "var(--color-card)", border:"1px solid var(--color-border)", borderRadius:12, padding:"14px 18px", flexShrink:0 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <div style={{ fontSize:13, fontWeight:600, color: "var(--color-primary)" }}>Planetary pulse</div>
        <div style={{ fontSize:9, color:"#bbb" }}>active sky emphasis</div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {rows.map(({ planet, data, asp }) => {
          const info = PLANET_THEMES[planet];
          if (!info) return null;
          const aspInfo = ASPECT_NATURE[asp?.aspectName ?? ""] ?? null;
          const sign = (now?.planets ?? []).find((x: any) => x.planet === planet)?.sign ?? "";
          const intensityW = Math.min(100, Math.round(data.score * 80));
          return (
            <div key={planet} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
              <div style={{ width:28, height:28, borderRadius:"50%", background:`${info.color}18`, color:info.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>
                {info.icon}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2, flexWrap:"wrap" }}>
                  <span style={{ fontSize:11, fontWeight:600, color: "var(--color-primary)" }}>
                    {planet}{sign && <span style={{ fontWeight:400, color:"#a09888" }}> in {sign}</span>}
                  </span>
                  {asp && (
                    <span style={{ fontSize:9, padding:"1px 6px", borderRadius:4, background:`${info.color}18`, color:info.color, fontWeight:500 }}>
                      {aspInfo?.label ?? asp.aspectName} {asp.partner}
                      {asp.applying && <span style={{ marginLeft:4, opacity:0.7 }}>↗</span>}
                    </span>
                  )}
                  {asp?.applying && asp.hoursToExact != null && (
                    <span style={{ fontSize:8.5, color:"#b07030" }}>exact {fmtExactWhen(asp.hoursToExact)}</span>
                  )}
                  {asp && !asp.applying && asp.hoursSinceExact != null && (
                    <span style={{ fontSize:8.5, color:"#999" }}>peaked {fmtSinceExact(asp.hoursSinceExact)}</span>
                  )}
                </div>
                <div style={{ fontSize:10, color:"#888", lineHeight:1.4, marginBottom:4 }}>{info.themes}</div>
                <div style={{ height:3, background: "var(--color-background)", borderRadius:2, overflow:"hidden" }}>
                  <div style={{ width:`${intensityW}%`, height:"100%", background:info.color, borderRadius:2, opacity:0.7 }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize:8.5, color:"#ccc", marginTop:10 }}>
        Moon and Sun aspects active now · applying = ↗ building
      </div>
    </div>
  );
}

// ── ElementalBalance ───────────────────────────────────────────────────────────

const WINDOW_TO_ELEMENT: Record<string, string> = {
  deep_work: "earth", study: "earth", planning: "earth", admin: "earth",
  creative: "fire", launch: "fire",
  social: "air", relationship: "air",
  recovery: "water", retreat: "water", rest: "water",
};

const ELEM_INFO: Record<string, { color: string; label: string; glyph: string }> = {
  fire:   { color: "#c04830", label: "Fire",   glyph: "🔥" },
  earth:  { color: "#4a7040", label: "Earth",  glyph: "🌱" },
  air:    { color: "#c19a3a", label: "Air",     glyph: "💨" },
  water:  { color: "#3a5a80", label: "Water",  glyph: "💧" },
  spirit: { color: "#a08060", label: "Spirit", glyph: "✦"  },
};

function ElementalBalance({ habits, tasks }: { habits: any[]; tasks: { bestWindowType?: string }[] }) {
  const counts: Record<string, number> = { fire: 0, earth: 0, air: 0, water: 0, spirit: 0 };

  for (const h of habits) {
    // favoredElements is an array now (merged practices model); tolerate the
    // legacy comma-string too.
    const els = Array.isArray(h.favoredElements) ? h.favoredElements : String(h.favoredElements ?? "").split(",").map((s: string) => s.trim()).filter(Boolean);
    for (const el of els) {
      if (el in counts) counts[el]++;
    }
  }
  for (const t of tasks) {
    const el = WINDOW_TO_ELEMENT[t.bestWindowType ?? ""] ?? "spirit";
    counts[el]++;
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const elems = Object.entries(counts).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a);
  const max = Math.max(...elems.map(([, v]) => v));

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "14px 18px", flexShrink: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)", marginBottom: 10 }}>Elemental balance</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {elems.map(([el, count]) => {
          const info = ELEM_INFO[el];
          const pct = (count / (max || 1)) * 100;
          const thin = pct < 30;
          return (
            <div key={el} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 52, fontSize: 10, color: info.color, fontWeight: 500, flexShrink: 0 }}>
                {info.glyph} {info.label}
              </div>
              <div style={{ flex: 1, height: 7, background: "var(--color-background)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: info.color, borderRadius: 4, opacity: thin ? 0.4 : 0.8, transition: "width 0.4s ease" }} />
              </div>
              <div style={{ width: 16, fontSize: 9, color: thin ? "#bbb" : info.color, textAlign: "right", flexShrink: 0 }}>{count}</div>
              {thin && <span style={{ fontSize: 8, color: "#bbb" }}>thin</span>}
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 8, color: "#ccc", marginTop: 8 }}>Based on active habits · pending tasks</div>
    </div>
  );
}

// ── TideChart ──────────────────────────────────────────────────────────────────

type ChartType = "flow" | "heart" | "create" | "move" | "focus" | "study" | "rest" | "launch";

const CHART_TYPES: { id: ChartType; label: string; color: string; desc: string }[] = [
  { id: "flow",   label: "Overall",  color: "#3a5a80", desc: "General quality — all factors" },
  { id: "focus",  label: "Focus",    color: "#4a6a50", desc: "Deep work · concentration · flow state" },
  { id: "move",   label: "Active",   color: "#c04040", desc: "Movement · exercise · assertion" },
  { id: "create", label: "Creative", color: "#6040a0", desc: "Art · expression · making" },
  { id: "heart",  label: "Social",   color: "#c06090", desc: "Connection · relationship · love" },
  { id: "study",  label: "Study",    color: "#405080", desc: "Learning · reading · research" },
  { id: "rest",   label: "Rest",     color: "#607060", desc: "Recovery · sleep · stillness" },
  { id: "launch", label: "Launch",   color: "#b05020", desc: "Starting · publishing · putting things out" },
];

const CHART_AMPS: Record<ChartType, Record<string, number>> = {
  flow:   { Venus:2.5, Jupiter:2.5, Sun:1.5, Mercury:1.2, Moon:1.0, Mars:-1.0, Saturn:-1.5 },
  focus:  { Saturn:3.0, Mercury:2.5, Sun:1.5, Jupiter:1.0, Moon:-0.5, Venus:-0.5, Mars:-1.0 },
  move:   { Mars:4.0, Sun:2.5, Jupiter:1.5, Moon:0.5, Saturn:0.5, Venus:0.5, Mercury:0.5 },
  create: { Moon:3.5, Venus:2.5, Mercury:2.0, Jupiter:1.5, Mars:0.5, Saturn:-1.0, Sun:1.0 },
  heart:  { Venus:4.0, Moon:3.0, Jupiter:1.5, Sun:1.0, Mercury:0.5, Mars:-0.5, Saturn:-2.0 },
  study:  { Mercury:4.0, Saturn:2.0, Jupiter:2.0, Sun:0.5, Moon:0.5, Venus:-0.5, Mars:-1.5 },
  rest:   { Moon:3.5, Saturn:2.0, Neptune:1.5, Venus:1.0, Jupiter:-0.5, Sun:-1.0, Mars:-3.0 },
  launch: { Jupiter:4.0, Sun:3.0, Mars:2.5, Venus:1.5, Mercury:1.0, Saturn:-2.0, Moon:-1.0 },
};

const QUALITY_SCORE_MAP: Record<string, number> = {
  excellent:7, good:6, workable:4, mixed:3, avoid_if_possible:2,
};

// ── Planetary hour computation (for weekly wave) ───────────────────────────────

const CHALDEAN_W = ["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"] as const;
const WEEKDAY_RULERS_W: Record<number,string> = {0:"Sun",1:"Moon",2:"Mars",3:"Mercury",4:"Jupiter",5:"Venus",6:"Saturn"};

function sunriseSunsetApprox(dateStr: string, lat: number, lon: number) {
  const base = new Date(dateStr + "T12:00:00");
  const jd = base.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = ((280.460 + 0.9856474 * n) % 360 + 360) % 360;
  const g = (((357.528 + 0.9856003 * n) % 360 + 360) % 360) * Math.PI / 180;
  const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180;
  const sinDec = Math.sin(23.439 * Math.PI / 180) * Math.sin(lambda);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.sin(-0.833 * Math.PI / 180) - Math.sin(lat * Math.PI / 180) * sinDec) /
               (Math.cos(lat * Math.PI / 180) * cosDec);
  if (Math.abs(cosH) > 1) return null;
  const H = Math.acos(cosH) * 180 / Math.PI;
  const B = (360 / 365) * (n - 81) * Math.PI / 180;
  const EqT = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const lstNoon = 12 - lon / 15 - EqT / 60;
  const midnight = new Date(dateStr + "T00:00:00");
  return {
    sunrise: new Date(midnight.getTime() + (lstNoon - H / 15) * 3600000),
    sunset:  new Date(midnight.getTime() + (lstNoon + H / 15) * 3600000),
  };
}

// Returns array of { planet, startH, endH } for a given day
function dayPlanetaryHoursSimple(dateStr: string, lat: number, lon: number): { planet: string; startH: number; endH: number }[] {
  const ss = sunriseSunsetApprox(dateStr, lat, lon);
  if (!ss) return [];
  const { sunrise, sunset } = ss;
  const midnight = new Date(dateStr + "T00:00:00");
  const srH = (sunrise.getTime() - midnight.getTime()) / 3600000;
  const ssH = (sunset.getTime() - midnight.getTime()) / 3600000;
  const dayLen = ssH - srH;
  const nightLen = 24 - ssH + srH; // approximate
  const dayHourLen = dayLen / 12;
  const nightHourLen = nightLen / 12;
  const dayNum = sunrise.getDay();
  const rulerIdx = CHALDEAN_W.indexOf(WEEKDAY_RULERS_W[dayNum] as any);

  const hours: { planet: string; startH: number; endH: number }[] = [];
  // day hours
  for (let i = 0; i < 12; i++) {
    hours.push({
      planet: CHALDEAN_W[(rulerIdx + i) % 7],
      startH: srH + i * dayHourLen,
      endH: srH + (i + 1) * dayHourLen,
    });
  }
  // night hours
  for (let i = 0; i < 12; i++) {
    hours.push({
      planet: CHALDEAN_W[(rulerIdx + 12 + i) % 7],
      startH: ssH + i * nightHourLen,
      endH: ssH + (i + 1) * nightHourLen,
    });
  }
  return hours;
}

const PHASE_COLORS: Record<string, string> = {
  "new moon":"#1a2a3a", "waxing crescent":"#4a6080", "first quarter":"#5a7090",
  "waxing gibbous":"#6a8aa0", "full moon":"#9ab0c0", "waning gibbous":"#7a8a9a",
  "last quarter":"#5a6a7a", "waning crescent":"#3a4a5a",
};

// Planetary hour quality contribution — these are relative weights, not absolute scores.
// They create spikes and dips within the normalized wave range.
const HOUR_QUALITY: Record<ChartType, Record<string, number>> = {
  flow:   { Sun:1.2, Moon:0.5, Mercury:0.8, Venus:1.2, Mars:-0.8, Jupiter:1.2, Saturn:-0.6 },
  focus:  { Saturn:2.0, Mercury:1.8, Sun:1.0, Jupiter:0.6, Moon:-0.6, Venus:-0.8, Mars:-1.2 },
  move:   { Sun:1.4, Moon:0.2, Mercury:0.3, Venus:-0.2, Mars:2.4, Jupiter:0.9, Saturn:0.2 },
  create: { Sun:0.6, Moon:1.6, Mercury:1.3, Venus:1.6, Mars:0.2, Jupiter:0.8, Saturn:-0.8 },
  heart:  { Sun:0.4, Moon:1.2, Mercury:0.4, Venus:2.2, Mars:-1.5, Jupiter:0.9, Saturn:-1.5 },
  study:  { Mercury:2.2, Saturn:1.4, Jupiter:1.4, Sun:0.4, Moon:0.2, Venus:-0.4, Mars:-1.8 },
  rest:   { Moon:2.0, Saturn:1.2, Venus:0.6, Jupiter:-0.4, Sun:-0.8, Mercury:-0.8, Mars:-2.2 },
  launch: { Jupiter:2.5, Sun:2.0, Mars:1.6, Venus:1.0, Mercury:0.8, Saturn:-1.6, Moon:-0.8 },
};

function buildWavePoints(
  crossings: any[],
  hourWindows: any[],
  chartType: ChartType,
  DAY_START_H: number,
  DAY_END_H: number,
  WIDTH: number,
  WAVE_H: number,
  moonAspects?: any[],
  planetaryAspects?: any[],
) {
  const STEP = 5; // 5-min resolution
  const DAY_SPAN = (DAY_END_H - DAY_START_H) * 60;
  const AMPS = CHART_AMPS[chartType];
  const HQ = HOUR_QUALITY[chartType];
  const raw: { x: number; rawScore: number; win: any; label: string }[] = [];

  for (let minFromStart = 0; minFromStart <= DAY_SPAN; minFromStart += STEP) {
    const totalMin = DAY_START_H * 60 + minFromStart;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const x = (minFromStart / DAY_SPAN) * WIDTH;

    const win = hourWindows.find((w: any) => {
      const wh = new Date(w.startTime).getHours();
      const eh = new Date(w.endTime).getHours();
      return h >= wh && h < eh;
    });
    // Base: use a compressed quality range so planet-hour variation shows clearly
    let score = win ? (QUALITY_SCORE_MAP[win.quality] ?? 3) * 0.55 : 2;
    if (win?.voidOfCourse) score -= 0.6;

    // Planetary hour — primary source of within-day variation
    const hourPlanet = win?.planet ?? win?.planetaryHour ?? null;
    if (hourPlanet && HQ[hourPlanet] !== undefined) {
      score += HQ[hourPlanet];
    }

    // Angular crossing Gaussian bumps
    for (const c of crossings) {
      if (!c.time) continue;
      const [ch, cm] = c.time.split(":").map(Number);
      const crossMin = (ch - DAY_START_H) * 60 + (cm ?? 0);
      const delta = minFromStart - crossMin;
      const amp = (AMPS[c.planet] ?? 0) * 0.5;
      if (amp === 0) continue;
      score += amp * Math.exp(-0.5 * (delta / 45) ** 2);
    }

    // Moon aspect bumps (day-level, centered near noon)
    if (moonAspects) {
      const ASPECT_BUMP: Record<string, number> = { trine:0.4, sextile:0.25, conjunction:0.15, square:-0.25, opposition:-0.3 };
      const noonMin = (12 - DAY_START_H) * 60;
      for (const a of moonAspects) {
        const bumpAmp = ASPECT_BUMP[a.aspect] ?? 0;
        if (bumpAmp === 0) continue;
        score += bumpAmp * Math.exp(-0.5 * (Math.abs(minFromStart - noonMin) / 200) ** 2);
      }
    }

    // Non-lunar planetary aspects — steady background tilt across the day
    if (planetaryAspects) {
      const PASP_BUMP: Record<string, number> = { trine:0.2, sextile:0.12, conjunction:0.1, square:-0.15, opposition:-0.18 };
      for (const a of planetaryAspects) {
        const baseAmp = PASP_BUMP[a.aspect] ?? 0;
        if (baseAmp === 0) continue;
        const dayFraction = minFromStart / ((DAY_END_H - DAY_START_H) * 60);
        score += baseAmp * (0.5 + 0.5 * (a.applying ? dayFraction : 1 - dayFraction));
      }
    }

    raw.push({ x, rawScore: score, win, label: `${h}:${m.toString().padStart(2,"0")}` });
  }

  // Normalize so the wave always fills the full visual range
  const scores = raw.map(r => r.rawScore);
  const minS = Math.min(...scores);
  const maxS = Math.max(...scores);
  const range = maxS - minS;
  // Normalize to 0.5–6.5 range (keep some headroom), or use raw if nearly flat
  const normalize = (s: number) => range > 0.3
    ? 0.5 + ((s - minS) / range) * 6.0
    : 3.5; // flat line in the middle when no variation

  const pts = raw.map(r => {
    const score = normalize(r.rawScore);
    const y = WAVE_H - 10 - (score / 7) * (WAVE_H - 20);
    return { x: r.x, y, score, win: r.win, label: r.label };
  });

  return { pts, STEP, DAY_SPAN };
}

function smoothPath(pts: { x: number; y: number }[], WAVE_H: number) {
  if (pts.length < 2) return { pathD: "", fillPath: "" };
  // Catmull-Rom-style smoothing via bezier control points
  let pathD = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 2)];
    const p1 = pts[i - 1];
    const p2 = pts[i];
    const p3 = pts[Math.min(pts.length - 1, i + 1)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    pathD += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  const last = pts[pts.length - 1], first = pts[0];
  const fillPath = `${pathD} L${last.x},${WAVE_H} L${first.x},${WAVE_H}Z`;
  return { pathD, fillPath };
}

// Maps wave type to bestWindowType values from tasks
const WAVE_TO_WINDOW: Record<ChartType, string[]> = {
  flow:   ["deep_work","creative","planning","study","social","admin","launch","recovery","retreat","relationship"],
  focus:  ["deep_work","study","planning"],
  move:   ["recovery"],
  create: ["creative"],
  heart:  ["social","relationship"],
  study:  ["study","deep_work"],
  rest:   ["recovery","retreat"],
  launch: ["launch"],
};

function TideChart({
  elemColor, todayData, tidesWindowsData, windows, now, week, today,
  tideView, setTideView, crossingsOn, waveRef, waveHover, setWaveHover, todayShowWave, lat, lon,
  tasks, allGoals,
}: {
  elemColor: string; todayData: any; tidesWindowsData: any; windows: any;
  now: any; week: any; today: string;
  tideView: "day" | "week"; setTideView: (v: "day"|"week") => void;
  crossingsOn: boolean; waveRef: React.RefObject<SVGSVGElement | null>;
  waveHover: { x: number; y: number; hourIdx: number } | null;
  setWaveHover: (v: { x: number; y: number; hourIdx: number } | null) => void;
  todayShowWave: boolean; lat: number; lon: number;
  tasks: { id: number; title: string; done: string; bestWindowType?: string }[];
  allGoals: Goal[];
}) {
  const [chartType, setChartType] = useState<ChartType>("flow");
  const fmtTime = useTimeFormat();

  const todayCrossings = todayData?.crossings ?? [];
  const hourWindows = tidesWindowsData?.windows ?? [];
  const now_ = new Date();
  const nowMinutes = now_.getHours() * 60 + now_.getMinutes();

  const DAY_START_H = 5, DAY_END_H = 24;
  const WIDTH = 700, WAVE_H = 150, BAND_H = 10, BAND_GAP = 2, BANDS = 2;
  const TOTAL_H = WAVE_H + BANDS * (BAND_H + BAND_GAP) + 8;
  const DAY_SPAN = (DAY_END_H - DAY_START_H) * 60;

  const ct = CHART_TYPES.find(c => c.id === chartType)!;
  const waveColor = ct.color;

  const moonPhaseName = now?.moonPhase ?? "";
  const phaseColor = PHASE_COLORS[moonPhaseName.toLowerCase().replace(/_/g," ")] ?? "#6a8090";
  const isWaxing = moonPhaseName.toLowerCase().includes("waxing") || moonPhaseName.toLowerCase().includes("full");
  const phaseBonus = isWaxing ? 0.8 : 0;

  const STEP = 5;
  const BAND_Y = (i: number) => WAVE_H + 6 + i * (BAND_H + BAND_GAP);

  // Hour tick positions along X axis
  const hourTicks = [];
  for (let h = DAY_START_H; h <= DAY_END_H; h += 3) {
    const x = ((h - DAY_START_H) * 60 / DAY_SPAN) * WIDTH;
    const d = new Date(); d.setHours(h, 0, 0, 0);
    const label = fmtTime(d);
    hourTicks.push({ x, label });
  }

  const todayMoonAspects = todayData?.moonAspects ?? [];
  const nonLunarAspects = (now?.aspects ?? []).filter((a: any) => a.planet1 !== "Moon" && a.planet2 !== "Moon");
  const { pts, } = buildWavePoints(todayCrossings, hourWindows, chartType, DAY_START_H, DAY_END_H, WIDTH, WAVE_H, todayMoonAspects, nonLunarAspects);
  const { pathD, fillPath } = smoothPath(pts, WAVE_H);

  const nowX = Math.min(WIDTH, Math.max(0, ((nowMinutes - DAY_START_H * 60) / DAY_SPAN) * WIDTH));
  const nowIdx = Math.round((nowMinutes - DAY_START_H * 60) / STEP);
  const nowPt = pts[Math.min(nowIdx, pts.length - 1)];
  const nowY = nowPt?.y ?? WAVE_H / 2;

  const hoverPt = waveHover ? pts[Math.min(waveHover.hourIdx, pts.length - 1)] : null;
  const hoverCrossings = hoverPt ? todayCrossings.filter((c: any) => {
    if (!c.time) return false;
    const [ch, cm] = c.time.split(":").map(Number);
    const crossMin = (ch - DAY_START_H) * 60 + (cm ?? 0);
    const hoverMin = (hoverPt.label.split(":").map(Number)[0] - DAY_START_H) * 60 + (hoverPt.label.split(":").map(Number)[1] ?? 0);
    return Math.abs(crossMin - hoverMin) < 45;
  }) : [];

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
      {/* Header row */}
      <div style={{ padding: "12px 18px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>The tide</div>
          <div style={{ fontSize: 10, color: "#aaa", marginTop: 1 }}>{now?.momentLabel}</div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {/* View toggle */}
          <div style={{ display: "flex", background: "var(--color-background)", borderRadius: 5, padding: 2, gap: 1 }}>
            {(["Day", "Week"] as const).map(t => (
              <div key={t} onClick={() => setTideView(t.toLowerCase() as "day"|"week")} style={{
                fontSize: 10, padding: "2px 9px", borderRadius: 4,
                background: tideView === t.toLowerCase() ? "#fff" : "transparent",
                color: tideView === t.toLowerCase() ? "#333" : "#999",
                fontWeight: tideView === t.toLowerCase() ? 500 : 400, cursor: "pointer",
              }}>{t}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart type tabs */}
      <div style={{ display: "flex", gap: 0, padding: "10px 18px 0", borderBottom: "1px solid var(--color-border)" }}>
        {CHART_TYPES.map(ct2 => (
          <button key={ct2.id} onClick={() => setChartType(ct2.id)} style={{
            fontSize: 10, padding: "5px 12px", border: "none", background: "none", cursor: "pointer",
            color: chartType === ct2.id ? ct2.color : "#bbb",
            fontWeight: chartType === ct2.id ? 600 : 400,
            borderBottom: chartType === ct2.id ? `2px solid ${ct2.color}` : "2px solid transparent",
            marginBottom: -1,
          }}>{ct2.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 9, color: "#bbb", alignSelf: "center", paddingBottom: 4 }}>{ct.desc}</div>
      </div>

      {/* Wave → task bridge: surface matching open tasks */}
      {(() => {
        const matchWindows = WAVE_TO_WINDOW[chartType] ?? [];
        const pending = tasks.filter(t => t.done !== "true");
        const matching = chartType === "flow"
          ? pending.slice(0, 3)  // overall: just top tasks
          : pending.filter(t => t.bestWindowType && matchWindows.includes(t.bestWindowType)).slice(0, 3);
        if (!matching.length) return null;
        return (
          <div style={{ padding: "8px 18px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", borderBottom: "1px solid var(--color-border)", background: `${ct.color}08` }}>
            <span style={{ fontSize: 8.5, color: ct.color, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, flexShrink: 0 }}>
              {chartType === "flow" ? "Today" : `${ct.label} tasks`}
            </span>
            {matching.map(t => (
              <span key={t.id} style={{
                fontSize: 10, padding: "2px 9px", borderRadius: 10,
                background: "var(--color-card)", border: `1px solid ${ct.color}40`,
                color: "#333", flexShrink: 0,
              }}>{t.title}</span>
            ))}
          </div>
        );
      })()}

      {/* Wave chart — day view */}
      {tideView === "day" && todayShowWave && (
        <div style={{ padding: "12px 18px 10px", position: "relative" }}>
          <svg
            ref={waveRef}
            width="100%" height={TOTAL_H}
            viewBox={`0 0 ${WIDTH} ${TOTAL_H}`}
            style={{ display: "block", cursor: "crosshair", overflow: "visible" }}
            onMouseMove={e => {
              const rect = waveRef.current?.getBoundingClientRect();
              if (!rect) return;
              const svgX = ((e.clientX - rect.left) / rect.width) * WIDTH;
              const minFromStart = (svgX / WIDTH) * DAY_SPAN;
              const hourIdx = Math.max(0, Math.min(Math.round(minFromStart / STEP), pts.length - 1));
              setWaveHover({ x: svgX, y: e.clientY - rect.top, hourIdx });
            }}
            onMouseLeave={() => setWaveHover(null)}
          >
            <rect width={WIDTH} height={TOTAL_H} fill="#f9f7f4" rx="6"/>

            {/* Hour grid lines — labels at top to avoid overlap with bands */}
            {hourTicks.map(({ x, label }) => (
              <g key={label}>
                <line x1={x} y1={18} x2={x} y2={WAVE_H} stroke="#ddd9d2" strokeWidth="1" strokeDasharray="2,3"/>
                <text x={x} y={11} fontSize="8" fill="#9aabba" fontFamily="sans-serif" textAnchor="middle" dominantBaseline="middle">{label}</text>
              </g>
            ))}

            {/* Resonance glow */}
            {pts.slice(0, -1).map((pt, i) => {
              const resScore = pt.score + phaseBonus;
              if (resScore < 5.2) return null;
              const nextPt = pts[i + 1];
              const alpha = Math.min(0.16, (resScore - 5) * 0.07);
              return <rect key={i} x={pt.x} y={0} width={nextPt.x - pt.x + 0.5} height={WAVE_H} fill={`rgba(210,170,60,${alpha})`}/>;
            })}

            {/* VOC background */}
            {hourWindows.filter((w: any) => w.voidOfCourse).map((w: any, i: number) => {
              const x1 = Math.max(0, ((new Date(w.startTime).getHours() - DAY_START_H) * 60 / DAY_SPAN) * WIDTH);
              const x2 = Math.min(WIDTH, ((new Date(w.endTime).getHours() - DAY_START_H) * 60 / DAY_SPAN) * WIDTH);
              return <rect key={i} x={x1} y={0} width={x2 - x1} height={WAVE_H} fill="#ede9e2" opacity="0.6">
                <title>Void of Course</title>
              </rect>;
            })}

            {/* Wave fill + stroke */}
            {fillPath && <path d={fillPath} fill={`${waveColor}22`}/>}
            {pathD && <path d={pathD} stroke={waveColor} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>}

            {/* Crossing markers */}
            {crossingsOn && todayCrossings.map((c: any, i: number) => {
              if (!c.time) return null;
              const [ch, cm] = c.time.split(":").map(Number);
              const cx_ = ((ch * 60 + cm - DAY_START_H * 60) / DAY_SPAN) * WIDTH;
              if (cx_ < -10 || cx_ > WIDTH + 10) return null;
              const pCol = PLANET_COLORS[c.planet] ?? "#c8b870";
              const AMPS = CHART_AMPS[chartType];
              const amp = AMPS[c.planet] ?? 0;
              const isBenefic = amp > 1.5;
              const isMalefic = amp < 0;
              return (
                <g key={i}>
                  <line x1={cx_} y1={6} x2={cx_} y2={WAVE_H - 2} stroke={pCol} strokeWidth="1" strokeDasharray={isMalefic ? "3,3" : "none"} opacity="0.5"/>
                  {isBenefic && <polygon points={`${cx_},4 ${cx_-5},12 ${cx_+5},12`} fill={pCol} opacity="0.8"/>}
                  {isMalefic && <polygon points={`${cx_},12 ${cx_-4},4 ${cx_+4},4`} fill={pCol} opacity="0.6"/>}
                  <text x={cx_} y={WAVE_H - 4} fontSize="7.5" fill={pCol} fontFamily="sans-serif" textAnchor="middle" opacity="0.9">
                    {PLANET_ICONS[c.planet] ?? c.planet[0]}
                  </text>
                </g>
              );
            })}

            {/* Now marker */}
            {nowX >= 0 && nowX <= WIDTH && <>
              <line x1={nowX} y1={0} x2={nowX} y2={WAVE_H} stroke="#1a2a3a" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.5"/>
              <circle cx={nowX} cy={nowY} r="4" fill={waveColor} stroke="#fff" strokeWidth="1.5"/>
              <rect x={nowX - 14} y={nowY - 17} width={28} height={13} rx="3" fill="#1a2a3a" opacity="0.85"/>
              <text x={nowX} y={nowY - 8} fontSize="7.5" fill="#fff" fontFamily="sans-serif" textAnchor="middle">now</text>
            </>}

            {/* Scheduled windows */}
            {(windows ?? []).map((w: any, i: number) => {
              const [sh, sm] = w.startTime.split(":").map(Number);
              const [eh, em] = w.endTime.split(":").map(Number);
              const x0 = Math.max(0, ((sh * 60 + sm - DAY_START_H * 60) / DAY_SPAN) * WIDTH);
              const x1 = Math.max(x0 + 16, ((eh * 60 + em - DAY_START_H * 60) / DAY_SPAN) * WIDTH);
              const color = WINDOW_COLORS[w.type] ?? "#888";
              return (
                <g key={w.id}>
                  <rect x={x0} y={WAVE_H - 20} width={x1 - x0} height={16} rx="3" fill={color} opacity="0.8"/>
                  <text x={(x0+x1)/2} y={WAVE_H - 9} fontSize="6" fill="#fff" fontFamily="sans-serif" textAnchor="middle">{w.title}</text>
                </g>
              );
            })}

            {/* Band 1: quality */}
            {pts.slice(0, -1).map((pt, i) => {
              const nextPt = pts[i + 1];
              const q = pt.score;
              const hue = q >= 5.5 ? "#50a050" : q >= 4 ? "#c8a030" : "#c06040";
              return <rect key={i} x={pt.x} y={BAND_Y(0)} width={nextPt.x - pt.x + 0.5} height={BAND_H} fill={hue} opacity={Math.min(0.9, 0.2 + q * 0.1)}/>;
            })}

            {/* Band 2: lunar phase */}
            <rect x={0} y={BAND_Y(1)} width={WIDTH} height={BAND_H} fill={phaseColor} opacity={0.35}/>
            <text x={4} y={BAND_Y(1) + 7.5} fontSize="7" fill="#e0ddd8" fontFamily="sans-serif" dominantBaseline="middle">
              {(moonPhaseName ?? "").replace(/_/g," ")}
            </text>

            {/* Crossing dots on quality band */}
            {todayCrossings.map((c: any, i: number) => {
              if (!c.time) return null;
              const [ch, cm] = c.time.split(":").map(Number);
              const cx_ = ((ch * 60 + cm - DAY_START_H * 60) / DAY_SPAN) * WIDTH;
              if (cx_ < 0 || cx_ > WIDTH) return null;
              return <circle key={i} cx={cx_} cy={BAND_Y(0) + BAND_H/2} r={3.5} fill={PLANET_COLORS[c.planet] ?? "#c8b870"} opacity={0.9}/>;
            })}

            {/* Hover scrubber line */}
            {waveHover && (
              <line x1={waveHover.x} y1={0} x2={waveHover.x} y2={WAVE_H + BANDS*(BAND_H+BAND_GAP)+4}
                stroke="#1a2a3a" strokeWidth="1" strokeDasharray="2,3" opacity="0.25"/>
            )}
          </svg>

          {/* Hover tooltip */}
          {waveHover && hoverPt && (() => {
            const svgW = waveRef.current?.getBoundingClientRect().width ?? WIDTH;
            const scaleX = svgW / WIDTH;
            const tipLeft = Math.min(Math.max(waveHover.x * scaleX - 90, 0), svgW - 200);
            const tipTop = Math.min(waveHover.y - 90, WAVE_H * (svgW/WIDTH) - 100);
            return (
              <div style={{
                position:"absolute", top:12+tipTop, left:18+tipLeft,
                background:"#1a2a3a", color:"#e8e4de", borderRadius:9, padding:"9px 12px",
                fontSize:10.5, lineHeight:1.45, width:200, pointerEvents:"none",
                boxShadow:"0 6px 20px rgba(0,0,0,0.25)",
              }}>
                <div style={{ fontWeight:600, marginBottom:3, display:"flex", justifyContent:"space-between" }}>
                  <span>{(() => { const [h,m] = hoverPt.label.split(":").map(Number); const d = new Date(); d.setHours(h,m,0,0); return fmtTime(d); })()}</span>
                  <span style={{ color:hoverPt.score>=5.5?"#80d080":hoverPt.score>=3.5?"#d0c060":"#e08060", fontWeight:400, fontSize:9.5 }}>
                    quality {hoverPt.score.toFixed(1)}
                  </span>
                </div>
                {hoverPt.win && (
                  <div style={{ color:"#8a9aaa", fontSize:9.5, marginBottom:hoverCrossings.length>0?5:0 }}>
                    {hoverPt.win.quality?.replace(/_/g," ")}
                    {hoverPt.win.voidOfCourse?" · void of course":""}
                  </div>
                )}
                {hoverCrossings.map((c: any, ci: number) => (
                  <div key={ci} style={{ marginTop:4, paddingTop: ci===0?4:0, borderTop: ci===0?"1px solid #2a3a4a":"none" }}>
                    <div style={{ color:PLANET_COLORS[c.planet]??"#c8b870", fontWeight:600, fontSize:10 }}>
                      {PLANET_ICONS[c.planet]??"○"} {c.planet} × {c.angle} · {c.time}
                    </div>
                    <div style={{ color:"#7080a0", fontSize:9, marginTop:1 }}>{PLANET_SIGNIFICATION[c.planet]}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Legend */}
          <div style={{ display:"flex", gap:12, marginTop:6, fontSize:8, color:"#bbb", alignItems:"center" }}>
            <div style={{ display:"flex", gap:4, alignItems:"center" }}>
              <div style={{ width:14, height:5, background:"linear-gradient(to right, #c06040, #c8a030, #50a050)", borderRadius:2 }}/>
              quality band
            </div>
            <div style={{ display:"flex", gap:4, alignItems:"center" }}>
              <div style={{ width:12, height:5, background:phaseColor, borderRadius:2, opacity:0.6 }}/>
              {(moonPhaseName ?? "").replace(/_/g," ").split(" ").slice(0,2).join(" ")}
            </div>
            {crossingsOn && <div style={{ display:"flex", gap:4, alignItems:"center" }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:waveColor, opacity:0.7 }}/>
              crossings
            </div>}
            <HelpBadge term="resonance" style={{ marginLeft:"auto" }}/>
          </div>
        </div>
      )}

      {/* Week view — wave + day columns */}
      {tideView === "week" && (() => {
        const days7 = (week?.days ?? []).slice(0, 7);
        if (!days7.length) return <div style={{ padding:20, color:"#bbb", fontSize:12 }}>No week data.</div>;

        const WEEK_W = 700, WAVE_H2 = 100;
        const DAY_W = WEEK_W / 7;
        const ASPECT_GLYPHS: Record<string, string> = { conjunction:"☌", opposition:"☍", trine:"△", square:"□", sextile:"⚹" };
        const MOON_PHASE_GLYPHS: Record<string, string> = {
          new_moon:"🌑", waxing_crescent:"🌒", first_quarter:"🌓", waxing_gibbous:"🌔",
          full_moon:"🌕", waning_gibbous:"🌖", last_quarter:"🌗", waning_crescent:"🌘",
        };

        // Build a smooth 7-day wave: per-day quality + crossing spikes + planetary hour spikes
        const WK_HQ = HOUR_QUALITY[chartType];
        const rawWkPts: { x: number; rawScore: number }[] = [];
        days7.forEach((d: any, di: number) => {
          // Macro shape follows the day's real tide energy (moon-phase driven — it
          // genuinely rises and falls across the week). Planetary hours are texture.
          const dayEnergy = d.tide?.energy ?? ((d.qualityScore ?? 4) / 7);
          const qs = dayEnergy * 4.5;
          const dayCrossings = d.crossings ?? [];
          const planetHours = dayPlanetaryHoursSimple(d.date, lat ?? 40.7, lon ?? -74.0);
          const STEPS = 48;
          for (let step = 0; step <= STEPS; step++) {
            const h = step * (24 / STEPS);
            const x = di * DAY_W + (step / STEPS) * DAY_W;
            let score = qs;
            const ph = planetHours.find(p => h >= p.startH && h < p.endH);
            if (ph && WK_HQ[ph.planet] !== undefined) score += WK_HQ[ph.planet] * 0.32;
            for (const c of dayCrossings) {
              if (!c.time) continue;
              const [ch, cm] = c.time.split(":").map(Number);
              const crossH = ch + (cm ?? 0) / 60;
              const amp = (CHART_AMPS[chartType][c.planet] ?? 0) * 0.5;
              if (amp === 0) continue;
              score += amp * Math.exp(-0.5 * ((h - crossH) / 1.5) ** 2);
            }
            const moonAspects: any[] = d.moonAspects ?? [];
            const ABUMP: Record<string,number> = { trine:0.3, sextile:0.2, conjunction:0.1, square:-0.2, opposition:-0.25 };
            for (const a of moonAspects) {
              const bump = ABUMP[a.aspect] ?? 0;
              if (bump === 0) continue;
              score += bump * Math.exp(-0.5 * ((h - 12) / 5) ** 2);
            }
            rawWkPts.push({ x, rawScore: score });
          }
        });
        // Normalize weekly wave to full visual range
        const wkScores = rawWkPts.map(p => p.rawScore);
        const wkMin = Math.min(...wkScores), wkMax = Math.max(...wkScores);
        const wkRange = wkMax - wkMin;
        const allWkPts = rawWkPts.map(p => {
          const score = wkRange > 0.3 ? 0.5 + ((p.rawScore - wkMin) / wkRange) * 6.0 : 3.5;
          return { x: p.x, y: WAVE_H2 - 10 - (score / 7) * (WAVE_H2 - 20), score };
        });
        const { pathD: wkPathD, fillPath: wkFillPath } = smoothPath(allWkPts, WAVE_H2);
        const todayDi = days7.findIndex((d: any) => d.date === today);

        return (
          <div style={{ padding:"10px 18px 14px" }}>
            {/* 7-day wave */}
            <svg width="100%" height={WAVE_H2 + 4} viewBox={`0 0 ${WEEK_W} ${WAVE_H2 + 4}`} style={{ display:"block", overflow:"visible", marginBottom:6 }}>
              <rect width={WEEK_W} height={WAVE_H2} fill="#f9f7f4" rx="6"/>
              {/* Day separators */}
              {days7.map((_: any, di: number) => di > 0 && (
                <line key={di} x1={di*DAY_W} y1={0} x2={di*DAY_W} y2={WAVE_H2} stroke="#e0dcd6" strokeWidth="1"/>
              ))}
              {/* Wave */}
              {wkFillPath && <path d={wkFillPath} fill={`${waveColor}20`}/>}
              {wkPathD && <path d={wkPathD} stroke={waveColor} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>}
              {/* Today marker */}
              {todayDi >= 0 && <line x1={todayDi*DAY_W + DAY_W/2} y1={0} x2={todayDi*DAY_W + DAY_W/2} y2={WAVE_H2} stroke="#1a2a3a" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.4"/>}
              {/* Crossing dots on wave */}
              {days7.map((d: any, di: number) => (d.crossings ?? []).map((c: any, ci: number) => {
                if (!c.time) return null;
                const [ch, cm] = c.time.split(":").map(Number);
                const cx_ = di * DAY_W + ((ch + (cm??0)/60) / 24) * DAY_W;
                const pCol = PLANET_COLORS[c.planet] ?? "#c8b870";
                return <circle key={`${di}-${ci}`} cx={cx_} cy={WAVE_H2 - 6} r={2.5} fill={pCol} opacity={0.8}/>;
              }))}
            </svg>

            {/* Day columns below wave */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:3 }}>
              {days7.map((d: any) => {
                const isToday = d.date === today;
                const ec = ELEMENT_COLORS[(d.element ?? "water") as Element] ?? "#888";
                const qs = d.qualityScore ?? 4;
                const barColor = qs >= 5.5 ? "#50a050" : qs >= 3.5 ? "#c8a030" : "#c06040";
                const moonAspects: any[] = d.moonAspects ?? [];
                const phaseGlyph = MOON_PHASE_GLYPHS[(d.moonPhase ?? "").replace(/ /g,"_").toLowerCase()] ?? "";
                const dateLabel = new Date(d.date + "T12:00:00").getDate();
                const dayLabel = d.label?.slice(0, 3) ?? "";

                return (
                  <div key={d.date} style={{
                    background: isToday ? `${ec}12` : "var(--color-card-2)",
                    border: isToday ? `1.5px solid ${ec}40` : "1px solid #ede9e4",
                    borderRadius: 6, padding:"5px 4px", display:"flex", flexDirection:"column", gap:3, alignItems:"center",
                  }}>
                    <div style={{ fontSize:7.5, color: isToday ? ec : "#aaa", fontWeight: isToday ? 700 : 400, textTransform:"uppercase" }}>{dayLabel}</div>
                    <div style={{ fontSize:13, fontWeight: isToday ? 700 : 500, color: isToday ? ec : "#3a4a5a", lineHeight:1 }}>{dateLabel}</div>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:barColor, opacity:0.85 }}/>
                    <div style={{ fontSize:8, color:"#6a7a8a" }}>{phaseGlyph} {d.moonSign?.slice(0,3)}</div>
                    {moonAspects.slice(0,1).map((a: any, ai: number) => (
                      <div key={ai} style={{ fontSize:7, color: PLANET_COLORS[a.planet] ?? "#888" }}>
                        ☽{ASPECT_GLYPHS[a.aspect] ?? "·"}{PLANET_ICONS[a.planet] ?? a.planet?.[0]}
                      </div>
                    ))}
                    {d.voidPeriods && <div style={{ fontSize:6.5, color:"#bbb" }}>voc</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── WaveRow ────────────────────────────────────────────────────────────────────
type WaveRowType = "practice-resonant" | "practice-supported" | "practice-soften" | "task" | "goal";

const WAVE_ROW_STYLE: Record<WaveRowType, { border: string; dot: string; textColor: string; dim?: boolean }> = {
  "practice-resonant":  { border: "#60a060", dot: "#60a060", textColor: "#2a5020" },
  "practice-supported": { border: "#6090d0", dot: "#6090d0", textColor: "#3a5a80" },
  "practice-soften":    { border: "#d0a060", dot: "#d0a060", textColor: "#8a5020", dim: true },
  "task":               { border: "#c0bab0", dot: "#8080a0", textColor: "#222" },
  "goal":               { border: "#a060c0", dot: "#a060c0", textColor: "#c19a3a" },
};

function WaveRow({ type, label, sub, onCheck }: { type: WaveRowType; label: string; sub?: string; onCheck?: () => void }) {
  const s = WAVE_ROW_STYLE[type];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "8px 18px",
      borderBottom: "1px solid #f5f2ee",
      borderLeft: `3px solid ${s.border}`,
      opacity: s.dim ? 0.6 : 1,
      background: type === "practice-resonant" ? "#fafff8" : "transparent",
    }}>
      {onCheck ? (
        <button onClick={onCheck} style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${s.border}`, background: "transparent", flexShrink: 0, cursor: "pointer" }} />
      ) : (
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: s.textColor, fontWeight: type === "practice-resonant" ? 500 : 400 }}>{label}</div>
        {sub && <div style={{ fontSize: 9, color: "#bbb", marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── MonthBars — the Almanac's 30-day view, brought home and made tappable ────
// Each bar is a day: element color, height = how charged. Tapping a bar opens
// the day's explanation (character, moon, vibe, aspects) so the strip teaches
// instead of just decorating.
function MonthBars({ testerId, lat, lon, today }: { testerId: string | null; lat: number; lon: number; today: string }) {
  const { data: month } = useTidesWeek(30, lat, lon);
  const [sel, setSel] = useState<string | null>(null);
  const days = (month?.days ?? []) as any[];
  if (!days.length) return null;
  const selDay = days.find((d) => d.date === sel);

  const CHAR_WORD: Record<string, string> = { water: "Deep", fire: "Surge", earth: "Building", air: "Clear" };
  const chargeLine = (qs: number) =>
    qs >= 5.5 ? "high charge — a day to lean in" : qs >= 3.5 ? "steady water — this day will do for most things" : "low water — keep plans light";

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "14px 18px", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary)" }}>The month's water</span>
        <span style={{ fontSize: 9.5, color: "#aaa" }}>next 30 days · tap a day</span>
      </div>
      <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 52 }}>
        {days.map((d) => {
          // Always a 6-digit hex (so the `${ec}55` alpha suffix stays valid) and
          // a defined color for spirit/VOC days — they were rendering as a
          // broken white-body/grey-top bar because "spirit" fell to "#888".
          const MB_HEX: Record<string, string> = { fire: "#b84020", earth: "#4a7040", air: "#c19a3a", water: "#2a5a80", spirit: "#7a7196" };
          const ec = MB_HEX[d.element ?? "water"] ?? "#7a7196";
          const qs = d.qualityScore ?? 4;
          const h = 10 + Math.round((qs / 7) * 38);
          const active = sel === d.date;
          const isToday = d.date === today;
          return (
            <button key={d.date} onClick={() => setSel(active ? null : d.date)}
              title={new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              style={{
                flex: 1, height: h, minWidth: 0, padding: 0, cursor: "pointer",
                background: active ? ec : `${ec}${isToday ? "88" : "55"}`,
                border: "none", borderTop: `2px solid ${ec}`, borderRadius: 2,
                outline: isToday ? `1.5px solid ${ec}` : "none", outlineOffset: 1,
              }} />
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#bbb", marginTop: 3 }}>
        <span>today</span><span>+30d</span>
      </div>

      {selDay && (() => {
        const ec = ELEMENT_COLORS[(selDay.element ?? "water") as Element] ?? "#888";
        const aspects = (selDay.moonAspects ?? []) as any[];
        const d = new Date(selDay.date + "T12:00:00");
        return (
          <div style={{ marginTop: 10, padding: "10px 12px", background: `${ec}0a`, borderLeft: `3px solid ${ec}`, borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary)" }}>
              {d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              <span style={{ color: ec, marginLeft: 8 }}>{CHAR_WORD[selDay.element] ?? ""} day</span>
              <span style={{ fontWeight: 400, color: "#999", marginLeft: 6, fontSize: 10.5 }}>· {selDay.element}</span>
            </div>
            <div style={{ fontSize: 10.5, color: "#888", marginTop: 3 }}>{chargeLine(selDay.qualityScore ?? 4)}</div>
            <div style={{ fontSize: 10.5, color: "#777", marginTop: 5, lineHeight: 1.5 }}>{buildDayVibe(selDay)}</div>
            {aspects.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6 }}>
                {aspects.slice(0, 3).map((a: any, i: number) => (
                  <div key={i} style={{ fontSize: 9.5, color: "#666" }}>
                    <span style={{ color: ASP_COLOR[a.aspect] ?? "#888", fontWeight: 600 }}>☽ {ASP_SYM[a.aspect] ?? a.aspect} {a.planet}</span>
                    {" — "}{ASP_MEANING_SHORT[a.aspect] ?? ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ── FourteenDays ───────────────────────────────────────────────────────────────

const MOON_GLYPHS: Record<string, string> = {
  new_moon:"🌑", waxing_crescent:"🌒", first_quarter:"🌓", waxing_gibbous:"🌔",
  full_moon:"🌕", waning_gibbous:"🌖", last_quarter:"🌗", waning_crescent:"🌘",
};
const ASP_SYM: Record<string, string> = { conjunction:"☌", trine:"△", sextile:"⚹", square:"□", opposition:"☍" };
const ASP_COLOR: Record<string, string> = { trine:"#60a060", sextile:"#6090d0", conjunction:"#f0b060", square:"#e06060", opposition:"#e06060" };

const ASP_MEANING_SHORT: Record<string, string> = {
  trine: "ease + flow", sextile: "opportunity", conjunction: "fusion + intensity",
  square: "friction + growth", opposition: "tension + awareness",
};

function buildDayVibe(day: any): string {
  const parts: string[] = [];
  const el = day.element ?? "water";
  const sign = day.moonSign ?? "";
  const phase = (day.moonPhase ?? "").replace(/_/g," ");
  const voc = !!day.voidPeriods;
  const aspects: any[] = day.moonAspects ?? [];
  const q = day.quality ?? "neutral";

  // Element + sign tone
  const elTone: Record<string,string> = { fire:"vital and initiating", earth:"grounded and practical", air:"communicative and social", water:"reflective and feeling" };
  if (sign) parts.push(`Moon in ${sign} — ${elTone[el] ?? el}`);
  if (phase) parts.push(phase);
  if (voc) parts.push("void of course period");

  // Dominant aspect — week data uses { planet, aspect }, now data uses { planet1, planet2, aspect }
  const mainAsp = aspects[0];
  if (mainAsp) {
    const other = mainAsp.planet
      ?? (mainAsp.planet1 === "Moon" ? mainAsp.planet2 : mainAsp.planet1);
    const aspShort: Record<string,string> = { trine:"flowing with", sextile:"opportunity via", conjunction:"merged with", square:"friction with", opposition:"tension across" };
    if (other) parts.push(`${aspShort[mainAsp.aspect] ?? mainAsp.aspect} ${other}`);
  }

  // Quality note
  const qNote: Record<string,string> = { excellent:"excellent overall", good:"generally favorable", workable:"workable with care", mixed:"mixed currents", avoid_if_possible:"challenging — move gently" };
  if (qNote[q]) parts.push(qNote[q]);

  return parts.join(" · ");
}
const ELEMENT_TONE: Record<string, string> = {
  fire: "initiative · energy · expression", earth: "grounding · building · tending",
  air: "connection · clarity · exchange", water: "feeling · reflection · depth", spirit: "liminal · rest · release",
};

function FourteenDays({ week, today }: { week: any; today: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const days = week?.days ?? [];
  if (!days.length) return null;

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "14px 18px", flexShrink: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display:"flex", alignItems:"center", gap:6 }}>
        14 days ahead
        <HelpBadge term="moonAspects"/>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {days.map((day: any) => {
          const isToday = day.date === today;
          const ec = ELEMENT_COLORS[(day.element ?? "water") as Element] ?? "#888";
          const phaseKey = (day.moonPhase ?? "").replace(/ /g,"_").toLowerCase();
          const phaseGlyph = MOON_GLYPHS[phaseKey];
          const aspects = (day.moonAspects ?? []) as { planet: string; aspect: string; applying: boolean; orb: number }[];
          const d = new Date(day.date + "T12:00:00");
          const isOpen = expanded === day.date;
          const qs = day.qualityScore ?? 4;
          const qColor = qs >= 5.5 ? "#50a050" : qs >= 3.5 ? "#c8a030" : "#c06040";

          return (
            <div key={day.date} style={{ borderBottom: "1px solid #f5f2ee" }}>
              {/* Main row — clickable */}
              <button onClick={() => setExpanded(isOpen ? null : day.date)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 0 9px 8px", width:"100%",
                background: isToday ? `${ec}08` : "transparent",
                borderLeft: isToday ? `3px solid ${ec}` : "3px solid transparent",
                border: "none", cursor: "pointer", textAlign:"left",
              }}>
                {/* Date */}
                <div style={{ width: 36, flexShrink: 0 }}>
                  <div style={{ fontSize: 8, textTransform: "uppercase", color: isToday ? ec : "#bbb", fontWeight: isToday ? 700 : 400 }}>{day.label?.slice(0,3)}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: isToday ? ec : "#333", lineHeight: 1 }}>{d.getDate()}</div>
                </div>
                {/* Quality dot */}
                <div style={{ width:6, height:6, borderRadius:"50%", background:qColor, flexShrink:0 }}/>
                {/* Moon info */}
                <div style={{ width: 76, flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: ec, fontWeight: 500 }}>{day.moonSign}</div>
                  {phaseGlyph && <div style={{ fontSize: 8.5, color: "#aaa", marginTop: 1 }}>{phaseGlyph} {day.moonPhase?.replace(/_/g," ").split(" ").slice(0,2).join(" ")}</div>}
                  {day.voidPeriods && <div style={{ fontSize: 7.5, color: "#9a8050", marginTop: 1 }}>◌ VOC</div>}
                </div>
                {/* Vibe line */}
                <div style={{ flex: 1, fontSize: 9, color: "#888", textAlign: "left", lineHeight: 1.4, paddingRight: 4 }}>
                  {buildDayVibe(day)}
                </div>
                {/* Aspects — small, compact */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 6px", flexShrink: 0 }}>
                  {aspects.slice(0,3).map((a, i) => {
                    const sym = ASP_SYM[a.aspect] ?? a.aspect;
                    const col = ASP_COLOR[a.aspect] ?? "#888";
                    return (
                      <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:1, fontSize:9.5 }}>
                        <span style={{ color:"#7080a0" }}>☽</span>
                        <span style={{ color:col, fontWeight:700 }}>{sym}</span>
                        <span style={{ color:"#666" }}>{a.planet?.slice(0,3)}</span>
                      </span>
                    );
                  })}
                  {aspects.length === 0 && <span style={{ fontSize:9, color:"#ddd" }}>quiet</span>}
                </div>
                {/* Crossings */}
                <div style={{ flexShrink:0, fontSize:7.5, color:"#c08020", textAlign:"right" }}>
                  {(day.crossings as any[] ?? []).slice(0,2).map((c: any, i: number) => (
                    <div key={i}>{PLANET_ICONS[c.planet] ?? c.planet[0]} {c.angle} {c.time?.slice(0,5)}</div>
                  ))}
                </div>
                <span style={{ fontSize:8, color:"#ccc", flexShrink:0 }}>{isOpen ? "▲" : "▾"}</span>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{ padding:"8px 8px 12px 18px", background:`${ec}06`, borderLeft:`2px solid ${ec}30` }}>
                  <div style={{ fontSize:9, color:ec, fontWeight:600, marginBottom:4 }}>
                    {day.element ? `${day.element} day` : ""} · {day.quality?.replace(/_/g," ")} · score {qs.toFixed(1)}
                  </div>
                  {ELEMENT_TONE[day.element] && (
                    <div style={{ fontSize:9, color:"#888", marginBottom:5 }}>{ELEMENT_TONE[day.element]}</div>
                  )}
                  {day.tone && <div style={{ fontSize:9, color:"#777", fontStyle:"italic", marginBottom:5 }}>"{day.tone}"</div>}
                  {aspects.length > 0 && (
                    <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                      {aspects.map((a, i) => {
                        const col = ASP_COLOR[a.aspect] ?? "#888";
                        return (
                          <div key={i} style={{ fontSize:9, color:"#666" }}>
                            <span style={{ color:col, fontWeight:600 }}>☽ {ASP_SYM[a.aspect] ?? a.aspect} {a.planet}</span>
                            {" — "}{ASP_MEANING_SHORT[a.aspect] ?? ""}
                            <span style={{ color:"#bbb" }}> · {a.applying ? "applying" : `${a.orb.toFixed(1)}° past`}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {(day.crossings ?? []).length > 0 && (
                    <div style={{ marginTop:5, display:"flex", flexWrap:"wrap", gap:"3px 10px" }}>
                      {(day.crossings as any[]).map((c: any, i: number) => {
                        const pCol = PLANET_COLORS[c.planet] ?? "#888";
                        return (
                          <span key={i} style={{ fontSize:8.5, color:pCol }}>
                            {PLANET_ICONS[c.planet] ?? c.planet[0]} {c.planet} × {c.angle} · {c.time?.slice(0,5)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
