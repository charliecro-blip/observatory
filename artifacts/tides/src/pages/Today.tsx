import React, { useState, useEffect, useRef, useMemo } from "react";
import { fetchJson } from "@/lib/fetchJson";
import { recordVisit } from "@/lib/visits";
import { jsonArray } from "@/lib/jsonArray";
import { ELEMENT_COLORS, ELEMENT_SURFACE, ELEMENT_BG, CHARACTER_ELEMENT, CHARACTER_LABEL, CHARACTER_ESSENCE, tideGuidance, CONFIDENCE_NOTE, QUIET_DAY_GUIDANCE, plainGuidance, type Element, type TideCharacter } from "@/lib/elements";
import { PLANET_LITERACY } from "@/lib/sky-literacy";
import { logEvent } from "@/lib/analytics";
import { localToday, addDaysLocal, localDayRange } from "@/lib/dates";
import { Outbox, type OutboxState } from "@/lib/outbox";
import { invalidateWindows } from "@/lib/invalidateWindows";
import { aiErrorMessage } from "@/lib/aiError";
import { pickNextMove } from "@/lib/next-move";
import { approachOptions } from "@/lib/approach";
import { conditionalFits } from "@/lib/alternatives";
import { currentlyInProgress, elapsedLabel } from "@/lib/in-progress";
import { framingFor, modeFrom } from "@/lib/modes";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTidesNow, useTidesWeek, useTodayWindows, useTidesWindows, useNorthStars } from "@/hooks/useTides";
import Dashboard from "@/components/Dashboard";
import { ASPECT_GEOMETRY, SIGN_INFLECTION, PLANET_CORE, composeTakes, composeEssence, composeGuidance, aspectSignificance, type AspectName } from "@/lib/sky-readings";
import { Skeleton, SkeletonCard } from "@/components/Skeleton";
import { usePreferences, useAstroDetail, useUiDensity } from "@/contexts/preferences-context";
import { useTester } from "@/contexts/tester-context";
import { Tooltip } from "@/components/Tooltip";
import type { Crossing } from "@/lib/types";
import { activeEclipse, RETRO_NOTES, PLANET_GLYPH } from "@/lib/conditions";
import { Studio } from "@/components/Studio";
import { StarRows, EveningHarvest } from "@/components/Momentum";
import { SIGN_MYTHOS, PLANET_MYTHOS, PLANET_ACTIVITIES } from "@/lib/mythos";
import { UnifiedTideChart } from "@/components/TideWater";
import { ritualPhase } from "@/lib/chronotype";
import WovenReading from "@/components/WovenReading";
import ReadZone from "@/components/ReadZone";
import AskDoors from "@/components/AskDoors";
import MomentsAhead from "@/components/MomentsAhead";
import { PLANET_GLYPH as PLANET_ICONS, PLANET_GLYPH as BIGSKY_PLANET_GLYPH } from "@/lib/glyphs";
import { PLANET_COLORS } from "@/lib/planetColors";




// A planet crossing a chart angle is a ~20-min peak for that planet's kind of


const QUALITY_COLORS: Record<string, string> = {
  good: "#60a060", supported: "#60a060", challenging: PLANET_COLORS.Mars, caution: "#d0a040", neutral: "#888888",
};

const WINDOW_COLORS: Record<string, string> = {
  deep_work: "#3a7aaa", creative: "#9060b0", planning: "#c08040", admin: "#888888",
  social: "#d06060", relationship: "#b04080", recovery: "#60a080", retreat: "#6080a0",
  launch: PLANET_COLORS.Mars, study: "#5060a0",
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

/** Text written but not yet accepted by the server. Survives a closed tab. */
function journalPendingKey(testerId: string | null, date: string) {
  return `tides-journal-pending-${testerId ?? "anon"}-${date}`;
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
        fontSize: 13, color: pinned ? PLANET_COLORS.Sun : "var(--text-3)", flexShrink: 0,
        transition: "color 0.2s",
      }}
    >
      {pinned ? "★" : "☆"}
    </button>
  );
}

interface AdvisorMessage { role: "user" | "assistant"; content: string; }

function MomentAdvisor({ testerId, lat, lon, onClose, gcalEvents, weekSummary, onAddTask, seedMessage, electionContext, strongestFit, now, northStars }: {
  testerId: string | null;
  lat: number;
  lon: number;
  onClose: () => void;
  gcalEvents: { title: string; start: string; end: string; allDay: boolean }[];
  weekSummary: string;
  onAddTask: (title: string) => void;
  seedMessage?: string | null;
  // When opened from Auspice's election picker: the activity + real candidate
  // windows + the user's note. Rides into /api/advise as given facts.
  electionContext?: { activity: string; note?: string; windows: { label: string; tier?: string; why?: string }[] } | null;
  /** Today's deterministic pick — Ask explains THIS rather than producing a
   *  rival answer to the same question. */
  strongestFit?: { title: string; why: string; when: string; kind: string } | null;
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
        // Without this the advisor reasons in the server's zone (UTC in
        // production) — for anyone west of Greenwich in the evening that is
        // tomorrow, so it advised confidently about the wrong day.
        body: JSON.stringify({ message: message.trim(), history, lat, lon, tzOffsetMin: new Date().getTimezoneOffset(), gcalEvents, weekSummary,
          ...(electionContext ? { electionContext } : {}),
          ...(strongestFit ? { strongestFit } : {}) }),
      });

      // A 429 here is a quota, not an outage — surfacing it as "couldn't
      // reach the sky" told users to retry, which just burns another attempt
      // against the same cap.
      if (!res.ok) throw new Error(await aiErrorMessage(res));
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
            // The backend emits {error} on a model/key failure; the stream
            // still closes cleanly, so we must surface it — otherwise Ask
            // silently shows nothing (empty spinner, no answer, no error).
            if (parsed.error) throw new Error(String(parsed.error));
            if (parsed.delta) {
              accumulated += parsed.delta;
              setStreamBuffer(accumulated);
            }
          } catch (e) {
            if (e instanceof Error && e.message && !/JSON|Unexpected/.test(e.message)) throw e;
            /* else: skip a malformed SSE chunk */
          }
        }
      }

      if (accumulated) {
        setHistory(h => [...h, { role: "assistant", content: accumulated }]);
      } else {
        setHistory(h => [...h, { role: "assistant", content: "Ask couldn't reach the sky just now — the advisor service didn't respond. Give it another try in a moment." }]);
      }
    } catch (e) {
      const msg = e instanceof Error && e.message && !/^advise |No stream/.test(e.message)
        ? e.message
        : "Ask couldn't reach the sky just now — the advisor service didn't respond. Give it another try in a moment.";
      setHistory(h => [...h, { role: "assistant", content: msg }]);
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
      const _mr = await fetch("/api/daemon-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tester-id": testerId },
        body: JSON.stringify({ content: content.slice(0, 300) }),
      });
      if (!_mr.ok) throw new Error("Couldn't save that to memory — try again.");
      setMemSaved(idx);
      setTimeout(() => setMemSaved(null), 2000);
    } catch { /* no ✓ shown — better silent than a false confirmation */ }
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
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-primary)", display: "flex", alignItems: "baseline", gap: 6 }}>
              ✦ Ask
              {/* Sub-brand tag (brand kit): Ask signs in Meridian small-caps. */}
              <span style={{ fontSize: 8.5, letterSpacing: "1.6px", textTransform: "uppercase", color: "var(--color-meridian, #3b3f8f)", fontFamily: "var(--font-display)", fontWeight: 500 }}>· the advisor</span>
            </div>
            <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 1 }}>What do you want to orient to?</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {history.length > 0 && !showPins && (
              <button onClick={() => { setHistory([]); setStreamBuffer(""); setInput(""); }} style={{
                fontSize: 10, padding: "3px 10px", borderRadius: 8, border: "1px solid var(--color-border)",
                background: "var(--color-card)", color: "var(--text-2)", cursor: "pointer",
              }}>← New question</button>
            )}
            {pins.length > 0 && (
              <button onClick={() => setShowPins(v => !v)} style={{
                fontSize: 10, padding: "3px 10px", borderRadius: 8, border: "1px solid var(--color-border)",
                background: showPins ? "#1a2a3a" : "var(--color-card)", color: showPins ? "var(--color-background)" : "var(--text-2)",
                cursor: "pointer",
              }}>★ Saved ({pins.length})</button>
            )}
            <button onClick={onClose} aria-label="Close the advisor" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-3)", lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* Saved pins panel */}
        {showPins && (
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {pins.length === 0 && <div style={{ fontSize: 12, color: "var(--text-3)", textAlign: "center", marginTop: 16 }}>No saved insights yet.</div>}
            {pins.map((p, i) => (
              <div key={i} style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 13, color: "var(--color-primary)", lineHeight: 1.5 }}>{p.content}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                  <span style={{ fontSize: 9, color: "var(--text-3)" }}>{new Date(p.ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  <button onClick={() => onAddTask(p.content.slice(0, 80))} style={{
                    fontSize: 9, padding: "2px 8px", borderRadius: 6, border: "1px solid var(--color-border)",
                    background: "var(--color-card-2)", color: "var(--text-2)", cursor: "pointer",
                  }}>→ task</button>
                </div>
              </div>
            ))}
            <button onClick={() => setShowPins(false)} style={{ fontSize: 10, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", alignSelf: "center", marginTop: 4 }}>← Back to conversation</button>
          </div>
        )}

        {!showPins && <>

        {/* Orientation picker (only before first message) — "what do you want
            to orient to?": your stars, this moment's grain, rest, or timing. */}
        {history.length === 0 && (() => {
          const activeStars = (northStars ?? [])
            .filter((s: any) => s.status === "active" || !s.status)
            .slice(0, 4)
            .map((s: any) => ({ id: s.id, title: s.title }));
          return (
            <div style={{ padding: "14px 20px 4px", flexShrink: 0 }}>
              <AskDoors
                layout="rows"
                stars={activeStars}
                strongestFit={strongestFit}
                note="Compass has already answered on the page behind this — these are for thinking it through."
                onPick={(pick) => {
                  // A door item with a fragment prefills the field here (this
                  // surface has one); everything else sends its question.
                  if (pick.fill) { setInput(pick.fill); inputRef.current?.focus(); }
                  else send(pick.send);
                }}
              />
            </div>
          );
        })()}

        {/* Message thread */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {allMessages.length === 0 && (
            <div style={{ color: "var(--text-3)", fontSize: 12, textAlign: "center", marginTop: 8 }}>
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
                background: m.role === "user" ? "#1a2a3a" : "var(--color-card)",
                color: m.role === "user" ? "var(--color-background)" : "var(--color-foreground)",
                border: m.role === "assistant" ? "1px solid var(--color-border)" : "none",
                borderBottomRightRadius: m.role === "user" ? 4 : 12,
                borderBottomLeftRadius: m.role === "assistant" ? 4 : 12,
              } as React.CSSProperties}>
                {m.content}
                {streaming && i === allMessages.length - 1 && m.role === "assistant" && (
                  <span style={{ display: "inline-block", width: 6, height: 13, background: "#bbbbbb", marginLeft: 3, verticalAlign: "text-bottom", animation: "blink 1s step-end infinite" }} />
                )}
              </div>
              {m.role === "assistant" && !streaming && (
                <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
                  <PinButton onPin={() => pinMessage(m.content)} />
                  <button
                    onClick={() => onAddTask(m.content.slice(0, 80))}
                    title="Add as task"
                    aria-label="Add as task"
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 10, color: "var(--text-3)", padding: "1px 3px" }}
                  >→</button>
                  <button
                    onClick={() => saveToMemory(m.content, i)}
                    title="Save to daemon memory (persists across sessions)"
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 9, color: memSaved === i ? "#9060c0" : "var(--text-3)", padding: "1px 3px" }}
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
                background: input.trim() && !streaming ? "#1a2a3a" : "var(--color-border)",
                color: input.trim() && !streaming ? "#ffffff" : "var(--text-3)",
                fontSize: 12, fontWeight: 500, cursor: input.trim() && !streaming ? "pointer" : "default",
                flexShrink: 0,
              }}
            >
              {streaming ? "…" : "Send"}
            </button>
          </div>
          <div style={{ fontSize: 9, color: "var(--text-3)", marginTop: 5 }}>Enter to send · Shift+Enter for new line</div>
        </div>

        </>}
      </div>
    </div>
  );
}

export default function Today({ testerId, lat = 40.7, lon = -74.0, onNavigate, showAdvisor, setShowAdvisor, advisorSeed, askContext, onOpenStar, firstRun = false }: {
  testerId: string | null; lat?: number; lon?: number; onNavigate?: (view: string) => void;
  onOpenStar?: (goalId: number) => void;
  showAdvisor: boolean; setShowAdvisor: (v: boolean) => void; advisorSeed?: string | null;
  askContext?: { activity: string; note?: string; windows: { label: string; tier?: string; why?: string }[]; subject?: { title: string; why?: string; when?: string; kind?: string } } | null;
  /** The walkthrough hasn't been answered yet — hold back anything that asks
   *  the user for something before they've been shown what this page is. */
  firstRun?: boolean;
}) {
  const qc = useQueryClient();
  const { prefs } = usePreferences();
  const astro = useAstroDetail();
  // Essential density (default): the core journey only — the tide, today's
  // plan, your aims, the ritual loop. The instrument add-ons are one tap away.
  const { essential, setDensity } = useUiDensity();
  const { updateLocation, profile: testerProfile } = useTester();
  const prefsDisplay = prefs.display;
  // The lens outranks the per-module toggles: someone at "just the guidance"
  // did not opt into a void banner, a tide wave or a fortnight strip, whatever
  // those switches happen to say (AUDIT-JOURNEY J2).
  const quiet = (prefs.display.astroDetail ?? "full") === "minimal";
  const todayShowWave = !quiet && prefsDisplay.todayShowWave;
  const todayShow14Day = !quiet && prefsDisplay.todayShow14Day;
  const todayShowJournal = prefsDisplay.todayShowJournal;
  const today = localToday();
  // Crossings display moved to Settings (a tuning knob, not a daily control).
  const crossingsOn = prefs.display.todayShowCrossings;
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);
  // Travel hint dismissal is per-day: dismissing today shouldn't hide a real
  // move next month.
  const [dismissedTravelHint, setDismissedTravelHint] = useState(() =>
    localStorage.getItem("obs_travel_hint_dismissed") === localToday());

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
  // The guide, and a one-line way in. The intro runs exactly once and is gone
  // by Thursday; this is the strip that survives long enough to be useful, and
  // it dismisses for good on first open.
  const [tideView, setTideView] = useState<"day" | "week">("day");
  const [journalText, setJournalText] = useState("");
  const [journalSync, setJournalSync] = useState<OutboxState>("clean");
  // Guards the server-hydrate race (audit P1): if the user starts typing
  // before the "no local copy" server fetch resolves, the fetch must not
  // stomp what they just typed.
  const journalTypedRef = useRef(false);
  // The outbox is created once and outlives re-renders, so it reads these
  // through refs rather than closing over a stale first-render value.
  const testerIdRef = useRef(testerId);
  const todayRef = useRef(today);
  testerIdRef.current = testerId;
  todayRef.current = today;
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
    fetch(`/api/check-ins/today?date=${today}`, { headers: { "x-tester-id": testerId } })
      .then(r => (r.ok ? r.json() : null))
      .then(row => { if (row?.notes && !journalTypedRef.current) setJournalText(row.notes); })
      .catch(() => {});
  }, [testerId, today]);

  // Journal persists to the day's check-in row so it shows up in The Log,
  // sky-stamped — localStorage stays as the instant/offline copy.
  //
  // Through an Outbox, because the old code set a "will retry" flag and then
  // never retried: text written offline sat on disk forever while the UI said
  // it was safe. The outbox actually retries, reports honestly when it can't,
  // and keeps the words either way.
  const outboxRef = useRef<Outbox | null>(null);
  if (!outboxRef.current) {
    outboxRef.current = new Outbox({
      send: async (notes) => {
        if (!testerIdRef.current) return false;
        const r = await fetch("/api/check-ins", {
          method: "POST",
          headers: { "x-tester-id": testerIdRef.current, "Content-Type": "application/json" },
          body: JSON.stringify({ date: todayRef.current, notes }),
        });
        if (r.ok) localStorage.removeItem(journalPendingKey(testerIdRef.current, todayRef.current));
        return r.ok;
      },
      onState: (s) => setJournalSync(s),
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      debounceMs: 900,
    });
  }

  // Unsent text from a previous session, plus a retry the moment the network
  // comes back — the two paths that made "will retry" a lie.
  useEffect(() => {
    if (!testerId) return;
    const pending = localStorage.getItem(journalPendingKey(testerId, today));
    if (pending) outboxRef.current?.restore(pending);
    const onOnline = () => outboxRef.current?.retryNow();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [testerId, today]);

  useEffect(() => () => outboxRef.current?.dispose(), []);

  function saveJournal(text: string) {
    journalTypedRef.current = true;
    setJournalText(text);
    localStorage.setItem(journalKey(testerId, today), text);
    if (!testerId) return;
    // Marked unsent BEFORE the attempt, so a tab closed mid-flight leaves a
    // record to pick up rather than a silent gap.
    localStorage.setItem(journalPendingKey(testerId, today), text);
    outboxRef.current?.queue(text);
  }

  const { data: now, isLoading: nowLoading } = useTidesNow(testerId, lat, lon);
  const { data: week } = useTidesWeek(14, lat, lon);
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

  // RFC 3339 WITH an offset — Google's timeMin/timeMax reject a bare local
  // string, and the failure comes back as HTTP 200 + an empty list, which is
  // indistinguishable from "no events today". Calendar.tsx always sent proper
  // instants; this one didn't, so Today silently showed an empty day.
  const todayStart = new Date(`${today}T00:00:00`).toISOString();
  const todayEnd = new Date(`${today}T23:59:59`).toISOString();
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

  // ONE KEY, ONE URL — and the key names everything the URL sends.
  //
  // Three habit queries on this page shared the key `["habits", testerId]`
  // while asking for three different things: two without coordinates and one
  // with. React Query has no idea they differ, so whichever mounted first won
  // and the others read its answer out of the cache. The habits route defaults
  // an absent `lat` to 40.7 — New York — so a viewer in Los Angeles could get
  // sunrise/sunset anchors and elemental resonance computed for a city they
  // are not in, which is the exact defect the audit already fixed once by
  // passing coordinates to `usePractices`. It came back through the cache.
  //
  // The day is in the key for the ordinary reason: `today` is in the URL, and
  // without it a tab left open across midnight keeps yesterday's answer,
  // including `doneToday` and the streak.
  const { data: habits = [] } = useQuery<any[]>({
    queryKey: ["habits", testerId, today, lat, lon],
    queryFn: async () => {
      const r = await fetch(`/api/habits?today=${today}&lat=${lat}&lon=${lon}`, { headers: testerId ? { "x-tester-id": testerId } : {} });
      return jsonArray(r);
    },
    enabled: !!testerId,
    staleTime: 120_000,
  });

  const { data: northStars } = useNorthStars(testerId);

  interface SimpleTask { id: number; title: string; done: string; bestWindowType?: string; planet?: string | null; goalId?: number | null; startedAt?: string | null; }
  const { data: todayTasks = [] } = useQuery<SimpleTask[]>({
    // tz rides along so the server can include tasks SCHEDULED today, not
    // just those due today — a woven task carries no deadline, and without
    // the offset the server cannot know which instants are this local day.
    queryKey: ["tasks-today", testerId, today, new Date().getTimezoneOffset()],
    queryFn: async () => {
      const r = await fetch(`/api/tasks?date=${today}&tz=${new Date().getTimezoneOffset()}`, { headers: testerId ? { "x-tester-id": testerId } : {} });
      const j = await r.json();
      return Array.isArray(j) ? j : []; // a transient error object must not crash .filter/.map
    },
    enabled: !!testerId,
    refetchInterval: 30_000,
  });

  // Marking a start is what lets the stateless engine know you're mid-way
  // through something. Without it, "strongest fit right now" will keep
  // proposing that you switch off work already underway.
  const startTask = useMutation({
    mutationFn: async ({ id, started }: { id: number; started: boolean }) => {
      const r = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({ started: String(started) }),
      });
      if (!r.ok) throw new Error(`couldn't update that task (${r.status})`);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["tasks-today"] }); },
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, done }: { id: number; done: boolean }) => {
      const r = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({ done: String(done) }),
      });
      // Was unchecked: a failed tick still ran onSuccess, so the refetch simply
      // put the box back and the user couldn't tell a failure from a misclick.
      if (!r.ok) throw new Error(`couldn't update that task (${r.status})`);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["tasks-today"] }); },
  });

  // Stopping on purpose offers — never demands — to keep the stretch (§3,
  // home-base build). Held here so the offer survives the release mutation's
  // refetch flipping the card out of its in-flow state.
  const [stretchOffer, setStretchOffer] = useState<{ taskId: number; title: string; minutes: number } | null>(null);
  const logStretch = useMutation({
    mutationFn: async (o: { taskId: number; title: string; minutes: number }) => {
      const r = await fetch("/api/planning/wins", {
        method: "POST",
        headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `worked on: ${o.title}`, taskId: o.taskId,
          minutes: Math.max(1, o.minutes), tz: new Date().getTimezoneOffset(),
        }),
      });
      if (!r.ok) throw new Error(`couldn't log that (${r.status})`);
    },
    onSuccess: () => { setStretchOffer(null); qc.invalidateQueries({ queryKey: ["momentum"] }); },
  });

  const addTask = useMutation({
    mutationFn: async (title: string) => {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({ title, dueDate: today }),
      });
      if (!r.ok) throw new Error("add task failed"); // was silent — the typed title vanished on failure
    },
    onSuccess: () => { logEvent("task_add", { from: "waves" }); { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["tasks-today"] }); }; setNewTaskTitle(""); setShowAddTask(false); },
  });

  // The deterministic pick, computed ONCE at component level so the card and
  // the advisor are guaranteed to be talking about the same recommendation.
  // Ask is an explanation layer over this — if it were handed nothing, it would
  // have to invent its own answer to "what should I do?", which is precisely
  // the two-oracles problem (power-user audit, 2026-08-02).
  const move = useMemo(() => {
    const openTasks = todayTasks.filter(t => t.done !== "true");
    const activeStars = (northStars ?? []).filter((g: any) => g.status !== "done");
    return pickNextMove({
      now: new Date(),
      skyQuiet: (prefs.display.astroDetail ?? "full") === "minimal",
      currentHour: now?.planetaryHour ? {
        planet: now.planetaryHour.planet,
        began: now.planetaryHour.began,
        ends: now.planetaryHour.ends,
      } : null,
      upcomingHours: (now?.upcomingHours ?? []).map((h: any) => ({ planet: h.planet, time: h.time })),
      // A task's element comes from the star it hangs off — tasks don't carry
      // one of their own.
      tasks: openTasks.map(t => ({
        id: t.id, title: t.title, planet: t.planet,
        element: t.goalId ? (activeStars.find((g: any) => g.id === t.goalId)?.element ?? null) : null,
      })),
      stars: activeStars.map((g: any) => ({ id: g.id, title: g.title, planet: g.planet, element: g.element })),
      dayElement: now?.reading?.element ?? now?.tide?.element ?? null,
      voc: !!now?.voc?.isVOC,
    });
  }, [todayTasks, northStars, now]);

  const gcalEvents = (gcalData?.events ?? []).map(e => ({ title: e.title, start: e.start, end: e.end, allDay: e.allDay }));

  // Build a concise week quality summary for the advisor system prompt
  const weekSummary = (week?.days ?? []).slice(0, 7).map((d: any) => {
    const date = new Date(d.date + "T12:00:00");
    const dayName = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const qs = d.quality ?? "";
    const ms = d.moonSign ?? "";
    return `${dayName}: ${ms}${qs ? ` · ${qs.replace(/_/g," ")}` : ""}`;
  }).join("; ");

  const el = now?.element?.element ?? "water";
  const elemColor = ELEMENT_COLORS[el as Element] ?? "#888888";
  const qColor = QUALITY_COLORS[now?.quality ?? "neutral"] ?? "#888888";


  // Ritual mode — Today reads the *person's* day, not the office clock.
  // Morning opens the loop (the first hours after waking), evening closes it
  // (the last hours before sleep); in between the page is its usual self.
  // Falls back to the wall clock when no chronotype has been set.
  const ritualMode = ritualPhase(testerProfile?.chronotype);
  // Four zones, three temporal modes — the mode REFRAMES the zones rather than
  // stacking another card above them. Follows the user's own hours via
  // ritualPhase, so a night owl's 1am is never framed as their morning.
  const framing = framingFor(modeFrom(ritualMode));
  // Recorded in an effect, not during render: a render-time write would count
  // re-renders as visits and inflate the number the prompt gates on.
  useEffect(() => { recordVisit(today); }, [today]);
  // Still the wall clock, deliberately: this drives the page's dawn/dusk/night
  // wash further down, and dawn is solar — it doesn't move because you sleep in.
  const localHour = new Date().getHours();

  // The reflect loop (felt rating + logbook line). In evening mode it rides
  // directly under the "Log the day" card — that IS the ritual — otherwise it
  // keeps its usual quiet spot further down the page.
  const reflectBlock = now ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <DonePattern today={today} testerId={testerId} />
      {todayShowJournal && (
        <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-foreground)" }}>Logbook line</span>
            {/* Four states that are each literally true, rather than one
                reassuring sentence that wasn't. "Failed" offers the verb it
                names — a Retry button that retries. */}
            <span style={{ fontSize: 9, display: "flex", alignItems: "center", gap: 6, color: journalSync === "failed" ? "#a03030" : "var(--color-muted)" }}>
              {journalSync === "failed" ? (
                <>
                  saved on this device — couldn't sync
                  <button onClick={() => outboxRef.current?.retryNow()}
                    style={{ fontSize: 9, padding: "1px 7px", borderRadius: 10, cursor: "pointer",
                             border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--text-2)" }}>
                    Retry
                  </button>
                </>
              ) : journalSync === "syncing" || journalSync === "pending" ? "saving…"
                : journalTypedRef.current ? "saved ✓"
                : "lands in The Log, stamped with today's sky"}
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
        <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {new Date().toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* One vocabulary, not two: the chip speaks tide (character × level)
              instead of the legacy good/workable favorability labels. The hover
              tooltip was removed (owner 2026-07-21) — it overflowed off-screen
              in the top-right corner and the chip reads clearly on its own. */}
          {astro.level !== "minimal" && (
            <div style={{ fontSize: 10, padding: "3px 10px", borderRadius: 10, background: `${elemColor}20`, color: elemColor, border: `1px solid ${elemColor}40` }}>
              {now?.tide ? `${now.tide.characterLabel} tide · ${now.tide.levelLabel.toLowerCase()}` : `${el} day`}
            </div>
          )}
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
          {/* Travel detector (owner 2026-07-28: "the location hasn't reset" after
              travelling): the saved longitude implies a solar timezone; when the
              DEVICE's timezone disagrees by ≥2 hours, you've probably moved — one
              tap re-fixes. Heuristic on purpose: no background geolocation. */}
          {hasSavedLocation(testerProfile) && !dismissedTravelHint && (() => {
            const deviceTzH = -new Date().getTimezoneOffset() / 60;
            const savedTzH = Math.round((lon ?? -74) / 15);
            if (Math.abs(deviceTzH - savedTzH) < 2) return null;
            return (
              <span style={{ display: "inline-flex", gap: 4 }}>
                <button onClick={useCurrentLocation} disabled={locating} style={{
                  fontSize: 9, color: "#4a6a8a", background: "#eef4fa", border: "1px solid #b0c8dc",
                  borderRadius: 6, padding: "3px 9px", cursor: locating ? "default" : "pointer",
                }}>
                  {locating ? "Locating…" : "📍 In a new place? Tap to update your sky"}
                </button>
                <button onClick={() => { localStorage.setItem("obs_travel_hint_dismissed", localToday()); setDismissedTravelHint(true); }} aria-label="Dismiss location hint"
                  style={{ fontSize: 9, color: "var(--color-muted)", background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}>✕</button>
              </span>
            );
          })()}
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
          electionContext={askContext}
          // A seeded ask carries its own subject; Today's next-move stands
          // aside for it. Handing the advisor a rival pick while the seed
          // question names another is the two-authorities bug (2026-08-18).
          strongestFit={askContext?.subject ? {
            title: askContext.subject.title,
            why: askContext.subject.why ?? "",
            when: askContext.subject.when ?? "",
            kind: askContext.subject.kind ?? "loop",
          } : move}
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

        {/* The "New here?" reading strip is gone — first-run teaching is the
            spotlight tour over the real interface (App.tsx), and the Guide
            survives as the reference manual in Settings. A new tester's first
            screen is their day. */}


        {/* The ritual anchor — morning "Cast off" / evening "Log the day".
            First thing on the page during ritual hours, absent midday. */}
        {ritualMode && now && (
          <RitualCard
            mode={ritualMode}
            now={now}
            week={week}
            todayTasks={todayTasks}
            windows={windows}
            testerId={testerId}
            displayName={testerProfile?.displayName}
            onOpenStar={onOpenStar}
            lat={lat} lon={lon}
          />
        )}
        {ritualMode === "evening" && reflectBlock}

        {/* The review moments left this page (HOME study W1). The Sunday
            review sits in Home's notice queue — the study found Home-landers
            never met it here — and the cycle review folded into the
            turning-point check-in, which had been asking its intention
            question a second time from a surface that could not see the
            answer. */}



        {/* Hero card — tide-forward */}
        {(() => {
          const tide = now?.tide;
          const character = (tide?.character ?? "deep") as TideCharacter;
          const elKey = CHARACTER_ELEMENT[character] ?? "water";
          const elColor = ELEMENT_COLORS[elKey] ?? elemColor;
          // The hero is a filled panel with white text on it, so it takes the
          // deep surface tone rather than the (dark-mode-lifted) text hue.
          const elFill  = ELEMENT_SURFACE[elKey] ?? elemColor;
          const elBg    = ELEMENT_BG[elKey] ?? "#f0f0f0";
          const levelLabel = tide?.levelLabel ?? "Steady";
          // Quiet day: little is happening (low aspect activation, no swells ahead).
          // Report it honestly instead of manufacturing a reading.
          const activation = now?.dayArc?.heightFactors?.activation ?? 1;
          const aspectsAhead = (now?.dayArc?.events ?? []).filter((e: any) => e.kind === "aspect" && !e.past).length;
          const isQuiet = activation < 0.25 && aspectsAhead === 0 && (tide?.band ?? "mid") !== "high";
          // The guidance line IS what the quiet lens's reader bought ("plain
          // language, what to do and when"), so it stays — but the tide
          // vocabulary in it does not. Same sentence, sky words removed;
          // nothing is invented to replace them.
          const rawGuidance = isQuiet ? QUIET_DAY_GUIDANCE[character]
            : tide ? tideGuidance(character, tide.level, !!now?.voc?.isVOC) : heroText(now);
          const guidanceText = astro.level === "minimal" ? plainGuidance(rawGuidance) : rawGuidance;
          const confNote = isQuiet || astro.level === "minimal" ? "" : tide ? CONFIDENCE_NOTE[tide.confidence] : "";


          return (
            // flexShrink 0: this is the page's only overflow-hidden card, so
            // inside the fixed-height flex column it absorbed ALL the flex
            // shrinkage and collapsed to its 2px borders (invisible hero).
            <div data-tour="today-hero" style={{ borderRadius: 14, overflow: "hidden", flexShrink: 0, border: `1px solid ${elColor}30`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              {/* Tide banner */}
              <div style={{ background: `linear-gradient(135deg, ${elFill}, ${elFill}cc)`, padding: "24px 28px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    {/* THE HERO OBEYS THE LENS (AUDIT-JOURNEY J2). The quiet
                        lens reached Home, the rail, Calendar, Plan and the
                        timer and left this — the loudest sky surface in the
                        app — speaking tide levels and moon signs to someone
                        who asked for none of it. At minimal the banner states
                        the day plainly and keeps the guidance line below,
                        which is the part that was always for everyone. */}
                    <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: "1.8px", marginBottom: 8 }}>
                      {astro.level === "minimal" ? "Today" : levelLabel}
                    </div>
                    <div style={{ fontSize: 44, fontWeight: 700, color: "#ffffff", letterSpacing: "-1px", lineHeight: 1 }}>
                      {astro.level === "minimal"
                        ? new Date().toLocaleDateString("en-US", { weekday: "long" })
                        : (tide?.headline ?? "Tide")}
                    </div>
                    <div style={{ fontSize: 15, color: "rgba(255,255,255,0.8)", marginTop: 10, maxWidth: 340, lineHeight: 1.4 }}>
                      {astro.level === "minimal"
                        ? new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })
                        : CHARACTER_ESSENCE[character]}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
                    {/* The Studio publishes moon phases and aspects — nothing
                        the quiet lens's reader asked for. */}
                    {astro.level !== "minimal" && (
                      <button onClick={() => setShowTideCard(true)} title="Share today's tide" style={{
                        fontSize: 11.5, padding: "5px 14px", borderRadius: 20, cursor: "pointer",
                        border: "1px solid rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.15)", color: "#ffffff", fontWeight: 500,
                      }}>↗ Share</button>
                    )}
                    {astro.level !== "minimal" && (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", textAlign: "right", lineHeight: 1.7 }}>
                        {now?.moonSign ?? ""}<br/>{now?.planetaryHour?.planet} hour<br/>{now?.moonPhase ?? ""}
                      </div>
                    )}
                  </div>
                </div>
                {/* WHERE IN THE LUNAR CYCLE.
                    This was a sine wave labelled LOW · RISING · HIGH · EBB ·
                    LOW with a marker on it, and the owner asked the question
                    that ended it: "what is the cycle?" There wasn't one. The
                    wave was drawn from Math.sin and the marker was a five-way
                    lookup from a categorical tide level, so it could only jump
                    between five fixed stops on a period nothing computed.

                    The fix for that is not a disclaimer. A caption reading
                    "not a graph of the day" underneath a graph is an admission
                    that the picture is lying and a request to be forgiven for
                    it — so the caption is gone and so is the invented curve.

                    What replaces it is a real position in a real period:
                    elongation / 360, the canonical definition of where the
                    Moon is in its month. Every mark below is computed. */}
                {astro.level !== "minimal" && now?.moonCycle && (() => {
                  const mc = now.moonCycle;
                  const STOPS = [
                    { at: 0,    label: "new" },
                    { at: 0.25, label: "first ¼" },
                    { at: 0.5,  label: "full" },
                    { at: 0.75, label: "last ¼" },
                    { at: 1,    label: "new" },
                  ];
                  return (
                    <div style={{ marginTop: 20 }}
                      title={`${mc.phase} — ${Math.round(mc.position * 100)}% through the lunar month (${mc.elongationDeg}° from the Sun)`}>
                      <div style={{ position: "relative", height: 15 }}>
                        {/* The track IS the cycle: one lunar month, left to right. */}
                        <div style={{ position: "absolute", left: 0, right: 0, top: 6,
                          height: 2, background: "rgba(255,255,255,0.22)", borderRadius: 1 }} />
                        {/* Elapsed portion — how much of this month is behind you. */}
                        <div style={{ position: "absolute", left: 0, top: 6, height: 2,
                          width: `${mc.position * 100}%`, background: "rgba(255,255,255,0.55)", borderRadius: 1 }} />
                        {STOPS.slice(0, 4).map((st) => (
                          <div key={st.at} style={{ position: "absolute", left: `${st.at * 100}%`, top: 3,
                            width: 1, height: 8, background: "rgba(255,255,255,0.35)" }} />
                        ))}
                        <div style={{ position: "absolute", left: `${mc.position * 100}%`, top: 0,
                          width: 14, height: 14, marginLeft: -7, borderRadius: "50%",
                          background: "#ffffff", boxShadow: "0 0 0 3px rgba(255,255,255,0.18)" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9,
                        color: "rgba(255,255,255,0.55)", marginTop: 5, letterSpacing: "0.6px" }}>
                        {STOPS.map((st, i) => <span key={i}>{st.label}</span>)}
                      </div>
                      <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.8)", marginTop: 7, letterSpacing: "0.2px" }}>
                        {mc.phase} · {mc.waxing ? "waxing" : "waning"} — a stretch for {({
                          initiate: "starting", build: "building", refine: "refining",
                          release: "releasing", consolidate: "consolidating", recover: "recovering",
                        } as Record<string, string>)[mc.approach] ?? mc.approach}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Guidance + meta */}
              <div style={{ background: elBg, padding: "16px 24px" }}>
                <div style={{ fontSize: 14.5, color: "var(--text-1)", lineHeight: 1.6, marginBottom: confNote ? 7 : 12 }}>
                  {guidanceText}
                </div>
                {confNote && (
                  <div style={{ fontSize: 11, color: "#907040", fontStyle: "italic", marginBottom: 12 }}>{confNote}</div>
                )}

                {/* The woven sentence — the synthesis engine's one-line
                    judgment. Kept; it is the flavour, and it reads well. */}
                {/* The synthesis engine's sentence names elements and planets
                    outright ("an earth day … with Venus steady underneath"),
                    so it belongs to the lenses that asked for them. */}
                {astro.level !== "minimal" && now?.reading?.flavour && (
                  <div style={{ fontSize: 13.5, color: "var(--text-1)", lineHeight: 1.6, marginTop: 12 }}>
                    {now.reading.flavour.charAt(0).toUpperCase() + now.reading.flavour.slice(1)}
                  </div>
                )}

                {/* Zone 1's stack replaces WATCH + counterpoint + pattern chips.
                    Those were three channels for one class of fact, and they
                    repeatedly said the same thing in different clothes — fixed
                    three separate times before the general case was caught.
                    One stack, sorted by duration, with a lead that is allowed
                    to be "nothing". The full testimony table still lives in the
                    receipt below at full detail. */}
                {/* The testimony stack — planetary hours, day rulers, the
                    slower layers. Sky by definition, so it folds at minimal
                    and the guidance line above stands alone (J2). */}
                {astro.level !== "minimal" && (
                  <ReadZone reading={now?.reading} testerId={testerId} accent={elColor} />
                )}

                {astro.level === "full" && (
                  <WovenReading
                    reading={now?.reading} level={astro.level} accent={elColor}
                    saidAlready={now?.voc?.isVOC ? ["voc", "Void of course"] : []}
                    workingOnly
                  />
                )}

                {/* Every figure here says what it MEANS on hover/tap. A bare
                    "Energy 83% · medium confidence" invites the reader to
                    supply their own definition — and the likeliest guess
                    ("83% good") is the one thing it doesn't mean. "Confidence"
                    is relabelled "signal agreement", which is what it actually
                    measures: how much the testimonies concur. It was never a
                    calibrated probability and shouldn't borrow the authority
                    of one. */}
                {astro.level !== "minimal" && <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  {/* No percentage. "Energy 89%" invited exactly the question
                      the owner asked — how does that square with a 74% lit
                      Moon? — and the honest answer was damning: energy IS the
                      illumination, plus up to 0.15 for angular planets and 0.10
                      for tight aspects. A number that is mostly one input with
                      two bonuses stapled on should not be published to two
                      significant figures, and the spec already said to drop it
                      (§"What survives of the tide scalar": demote or remove the
                      public numeric). The scalar stays an internal input; the
                      surface says the band, which is all it can support. */}
                  <div title="How charged this moment is — not how favorable. A charged hour can be a difficult one. Deliberately a band, not a percentage: the underlying number is mostly lunar illumination and cannot carry more precision than that."
                    style={{ fontSize: 9.5, color: elColor, display: "flex", alignItems: "center", gap: 4, cursor: "help" }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: elColor }} />
                    {tide?.band === "high" ? "strongly charged" : tide?.band === "low" ? "quietly charged" : "moderately charged"}
                  </div>
                  <div title="Which way the day's activation is moving — rising, steady, or ebbing."
                    style={{ fontSize: 9.5, color: "var(--color-muted)", display: "flex", alignItems: "center", gap: 4, cursor: "help" }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#aaaaaa" }} />
                    {tide?.trend ?? "steady"}
                  </div>
                  <div title="How much the day's separate testimonies point the same way. High agreement means a clear picture — not a guarantee about the outcome."
                    style={{ fontSize: 9.5, color: "var(--color-muted)", display: "flex", alignItems: "center", gap: 4, cursor: "help" }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#aaaaaa" }} />
                    {tide?.confidence ?? "medium"} signal agreement
                  </div>
                  {now?.voc?.isVOC && (
                    <div style={{ fontSize: 9.5, color: "#b0a060", display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#b0a060" }} />
                      Moon VOC
                    </div>
                  )}
                </div>}

                {/* Personal modifier line — the moat, shown when a hard transit is
                    active. Day-scale movers only: a Pluto/Neptune/Uranus transit is
                    a months-long chapter and doesn't belong on a single day's card
                    (owner 2026-07-23) — those live in Currents. */}
                {(() => {
                  if (!tide?.personal) return null;
                  const LONG_CYCLE = new Set(["Uranus", "Neptune", "Pluto"]);
                  const dayScale = (now?.personalTransits ?? []).find((t: any) => !LONG_CYCLE.has(t.transitPlanet));
                  if (!dayScale) return null;
                  return (
                    <div style={{ marginTop: 11, paddingTop: 10, borderTop: `1px solid ${elColor}22`, display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#a04040", background: "#a0404015", padding: "2px 6px", borderRadius: 4, flexShrink: 0 }}>YOU</span>
                      <span style={{ fontSize: 10.5, color: "var(--color-quality-challenge)" }}>
                        World tide is {levelLabel.toLowerCase()}, but yours is choppy — {dayScale.summary}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })()}


        {/* Daily report — the home as a navigation console: weather + where you're
            steering + what's on deck + the week, at a glance. */}
        {/* The teachable-moment card was removed 2026-08-03 (owner review).
            Three problems at once:
              1. It said "Moon conjunction Saturn" — a fact the READ zone
                 already leads with and the Resonant Now cards already carry.
                 Third telling of one fact.
              2. Its CTA sent people to Planets, a surface deliberately
                 DEMOTED out of the nav. The home page should not promote
                 what the product decided to de-emphasise.
              3. Stacked under the Currents banner it pushed the actual day
                 below the fold, which is how the owner found it at all.
            The education layer belongs where someone goes looking for it. */}
        {/* No longer gated on `now`: this card shows your own stars and tasks,
            which have nothing to do with whether the sky has finished loading. */}
        <Dashboard windows={windows} todayTasks={todayTasks} onNavigate={onNavigate} framing={framing} />

        {/* The month's water (30-day view) was removed from Today (owner
            2026-07-15): the day view stays about today; the month lives in the
            Calendar/Almanac. MonthBars is still defined for that surface. */}

        {/* (RhythmCard removed from Today — owner 2026-07-23 "not sure why
            'your rhythm today' is there." The rhythm framing lives in
            Settings/chronotype and, since the 2026-08-19 consolidation, in
            Home's condition slot — the cycle banner this used to point at is
            no longer below.) */}

        {/* The big sky — the moment's defining aspects, explored. Full detail
            only: at minimal/medium this planet-to-planet aspect read-out is
            exactly the jargon we're hiding. */}
        {!essential && now && astro.aspects && <BigSky now={now} />}

        {/* (North Stars card absorbed into the dashboard's Guiding stars card —
            it duplicated the same list right below it.) */}


        {/* Resonant now — "what fits right now", above the chart rather than
            below it (owner 2026-08-02: "the resonant now set of tabs is very
            helpful — that might be lifted higher"). It answers the same
            question the hero raises, so it belongs with the answer, not after
            the instrument that explains it. */}
        {!essential && now && <ModulePulse now={now} onNavigate={onNavigate} />}

        {/* The tide — one coherent chart for the whole day */}
        {!essential && now?.dayArc && <UnifiedTideChart arc={now.dayArc} now={now} lat={lat} lon={lon} />}


        {/* Logbook — evenings ONLY (owner 2026-07-23): "how did today feel?"
            belongs to the day's close. It renders under "Log the day" during
            evening ritual hours (see reflectBlock above); midday and morning
            it stands down entirely. */}


        {/* The density toggle — the add-ons are one tap away, and the tap
            persists. This is the whole "core by default, add-ons available"
            contract (owner 2026-07-23). */}
        <button data-tour="today-density" onClick={() => setDensity(essential ? "expanded" : "essential")} style={{
          alignSelf: "center", margin: "6px 0 10px", padding: "7px 18px", borderRadius: 18,
          border: "1px solid var(--color-border)", background: "var(--color-card)",
          fontSize: 11, color: "var(--color-muted)", cursor: "pointer", letterSpacing: "0.3px", flexShrink: 0,
        }}>
          {essential ? "Show the full instrument panel ↓" : "Simplify to the essentials ↑"}
        </button>

      </div>
    </div>
  );
}

// ── ConditionsStrip ──────────────────────────────────────────────────────────────

// Slow outer retrogrades run nearly half of every year — they're wallpaper, not
// news, and shouldn't sit front-and-center next to a Mercury retrograde that
// actually changes your week. They collapse to one muted line at the bottom.
const FAST_RETRO = new Set(["Mercury", "Venus", "Mars"]);

// The slow sky as an era: each outer planet's sign is a years-long backdrop
// worth naming even when it isn't retrograde (owner 2026-07-23 — "standing
// conditions should be fleshed out").
const ERA_GLOSS: Record<string, string> = {
  Saturn:  "where the work is structural",
  Uranus:  "where the old pattern breaks",
  Neptune: "where the dream dissolves and re-forms",
  Pluto:   "where power is being renegotiated",
};


/**
 * Today's scheduled blocks, with a way to say one happened.
 *
 * Deliberately only ONE verb. "Skip" needs no button — not pressing anything is
 * already that, and a schedule that demands you account for every unmet block
 * is the guilt ledger this product refuses (BACKLOG §4, do-not-copy).
 */
/**
 * "Your 2pm ran long — shift the next three?"
 *
 * The consent card. Three things it must do that a silent reschedule cannot:
 *
 *  · Show the cost. Each row says what the block's timing becomes, in the
 *    weaver's own grading ("a great time for this" / "this time will do" /
 *    "swimming against the current"). A block that no longer suits its new
 *    hour says so BEFORE you agree, not after.
 *  · Offer a middle. "Just the next one" is the honest answer most of the
 *    time — the 3pm slipped, the 6pm is fine where it is.
 *  · Make leaving them the easy, blameless option. Nothing here is a failure
 *    state, so nothing is styled like one.
 */
function CascadeCard({ cascade, onApply, onDismiss, pending }: {
  cascade: { overrunMinutes: number; anchorTitle: string; affected: any[] };
  onApply: (shifts: { id: number; startAt: string; endAt: string }[]) => void;
  onDismiss: () => void;
  pending: boolean;
}) {
  const t = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const shiftOf = (a: any) => ({ id: a.id, startAt: a.to.startAt, endAt: a.to.endAt });
  const all = cascade.affected.map(shiftOf);
  const n = cascade.affected.length;
  const costs = cascade.affected.filter((a: any) => a.verdict !== "holds").length;

  // Shifting ONLY the next block can push it on top of the one after, which
  // "shift all" never does because everything moves together. The card exists
  // to say what a move costs, so it cannot quietly hand back a double-booking.
  const soloOverlaps =
    n > 1 && new Date(cascade.affected[0].to.endAt) > new Date(cascade.affected[1].from.startAt);

  return (
    <div style={{
      marginBottom: 10, padding: "11px 13px", borderRadius: 10,
      background: "var(--color-card-2)", border: "1px solid var(--color-border)",
    }}>
      <div style={{ fontSize: 12, color: "var(--text-1)", marginBottom: 2 }}>
        <strong>{cascade.anchorTitle}</strong> ran {cascade.overrunMinutes} min long.
      </div>
      <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 8 }}>
        {n === 1 ? "One block sits after it." : `${n} blocks sit after it.`}{" "}
        {costs === 0
          ? "They'd all still suit their new times."
          : costs === n
            ? n === 1 ? "Moving it costs something:" : "Moving them costs something:"
            : `${costs} of them would lose something:`}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 9 }}>
        {cascade.affected.map((a: any) => (
          <div key={a.id} style={{ fontSize: 11, lineHeight: 1.45 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
              <span style={{ color: "var(--text-1)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.title}
              </span>
              <span style={{ color: "var(--text-3)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                {t(a.from.startAt)} → {t(a.to.startAt)}
              </span>
            </div>
            <div style={{ color: a.verdict === "holds" ? "var(--text-3)" : "var(--text-2)", fontSize: 10.5 }}>
              {a.verdict === "holds" ? "still " : "now "}{a.to.tierNote}
              {a.runsPastDay && " · runs past the end of your day"}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button onClick={() => onApply(all)} disabled={pending}
          style={{ fontSize: 11, padding: "4px 11px", borderRadius: 14, cursor: "pointer",
                   border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--text-1)", fontWeight: 500 }}>
          {n === 1 ? "Shift it" : `Shift all ${n}`}
        </button>
        {n > 1 && (
          <button onClick={() => onApply([all[0]])} disabled={pending}
            title={soloOverlaps
              ? `Would run into ${cascade.affected[1].title} at ${t(cascade.affected[1].from.startAt)}`
              : undefined}
            style={{ fontSize: 11, padding: "4px 11px", borderRadius: 14, cursor: "pointer",
                     border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--text-2)" }}>
            Just the next one
          </button>
        )}
        <button onClick={onDismiss} disabled={pending}
          style={{ fontSize: 11, padding: "4px 11px", borderRadius: 14, cursor: "pointer",
                   border: "none", background: "none", color: "var(--text-3)" }}>
          Leave them
        </button>
      </div>
      {soloOverlaps && (
        // Visible, not a tooltip — hover-only information is already a known
        // debt here (BACKLOG §3b) and this one changes what you'd choose.
        <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 6, lineHeight: 1.45 }}>
          Moving just the next one would run it into {cascade.affected[1].title} at{" "}
          {t(cascade.affected[1].from.startAt)}. Shifting all {n} keeps the gaps you had.
        </div>
      )}
    </div>
  );
}

/**
 * Where an undone block goes next.
 *
 * Deliberately NOT "same time tomorrow". The reason this block sat at 2pm
 * today doesn't transfer to 2pm tomorrow, so the times offered are scored for
 * the work — the same grading the weaver used to place it in the first place.
 *
 * The one verb rule holds: choosing a time is the only action. Doing nothing
 * leaves the block where it is, and nothing here counts, scolds, or tallies.
 */
function RehomeInline({ win, testerId, lat, lon, wakeHour, sleepHour, onDone }: {
  win: any; testerId: string | null; lat: number; lon: number;
  wakeHour: number; sleepHour: number; onDone: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { from, to } = localDayRange(addDaysLocal(localToday(), 1));
        const r = await fetch("/api/planning/rehome/suggest", {
          method: "POST",
          headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
          body: JSON.stringify({
            windowId: win.id, from, to, lat, lon,
            tzOffsetMin: new Date().getTimezoneOffset(), wakeHour, sleepHour,
          }),
        });
        if (!r.ok) throw new Error("no");
        const j = await r.json();
        if (alive) { setData(j); setState("ready"); }
      } catch {
        if (alive) setState("failed");
      }
    })();
    return () => { alive = false; };
  }, [win.id, testerId, lat, lon, wakeHour, sleepHour]);

  async function place(s: { startAt: string; endAt: string }) {
    setSaving(true);
    try {
      // PATCH /planning/windows/:id — shipped with the Planner and, until now,
      // never once called from the client.
      const r = await fetch(`/api/planning/windows/${win.id}`, {
        method: "PATCH",
        headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({ startTime: s.startAt, endTime: s.endAt }),
      });
      if (!r.ok) throw new Error("no");
      onDone();
    } catch {
      setState("failed");
    } finally {
      setSaving(false);
    }
  }

  const box = {
    marginTop: 4, marginBottom: 2, padding: "7px 9px", borderRadius: 8,
    background: "var(--color-card-2)", border: "1px solid var(--color-border)",
  } as const;

  if (state === "loading") {
    return <div style={{ ...box, fontSize: 10.5, color: "var(--text-3)" }}>Reading tomorrow…</div>;
  }
  if (state === "failed") {
    return <div style={{ ...box, fontSize: 10.5, color: "var(--text-3)" }}>
      Couldn't work out tomorrow just now — it'll keep.
    </div>;
  }
  if (!data?.suggestions?.length) {
    return <div style={{ ...box, fontSize: 10.5, color: "var(--text-3)" }}>
      {data?.fullDay
        ? "Tomorrow's already spoken for. This one can wait for a real opening."
        : "Nothing on tomorrow suits this yet."}
    </div>;
  }

  return (
    <div style={box}>
      <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 5 }}>
        Tomorrow, when it would actually suit:
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {data.suggestions.map((s: any) => (
          <button key={s.startAt} onClick={() => place(s)} disabled={saving}
            style={{
              display: "flex", gap: 8, alignItems: "baseline", textAlign: "left",
              padding: "4px 8px", borderRadius: 7, cursor: "pointer", width: "100%",
              border: "1px solid var(--color-border)", background: "var(--color-card)",
              fontFamily: "inherit",
            }}>
            <span style={{ fontSize: 11, color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>
              {new Date(s.startAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </span>
            <span style={{ fontSize: 10, color: "var(--text-2)" }}>{s.tierNote}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BlockCheck({ wins, markBlock, blockError, elColor, testerId, lat, lon, wakeHour, sleepHour, onRehomed }: {
  wins: any[]; markBlock: any; blockError: number | null; elColor: string;
  testerId: string | null; lat: number; lon: number;
  wakeHour: number; sleepHour: number; onRehomed: () => void;
}) {
  const open = wins.filter((w: any) => !w.completedAt);
  const [moving, setMoving] = useState<number | null>(null);
  if (open.length === 0) return null;
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-3)", marginBottom: 4 }}>
        Did these happen?
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {open.slice(0, 4).map((w: any) => {
          const t = new Date(w.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          // Only once its hour has actually gone. Offering to re-home a block
          // that hasn't started yet would be the app deciding, on your behalf,
          // that you aren't going to do it.
          const past = Date.now() > new Date(w.endTime).getTime();
          return (
            <div key={w.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--text-2)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t} · {w.title}
                </span>
                {blockError === w.id && (
                  <span style={{ fontSize: 9, color: "#a03030" }}>didn't save</span>
                )}
                {past && (
                  <button
                    onClick={() => setMoving(moving === w.id ? null : w.id)}
                    style={{
                      fontSize: 10, padding: "2px 9px", borderRadius: 12, cursor: "pointer",
                      border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--text-3)",
                    }}
                  >{moving === w.id ? "never mind" : "→ move it"}</button>
                )}
                <button
                  onClick={() => markBlock.mutate({ id: w.id, done: true })}
                  disabled={markBlock.isPending}
                  style={{
                    fontSize: 10, padding: "2px 10px", borderRadius: 12, cursor: "pointer",
                    border: `1px solid ${elColor}40`, background: `${elColor}12`, color: elColor, fontWeight: 600,
                  }}
                >✓ did it</button>
              </div>
              {moving === w.id && (
                <RehomeInline
                  win={w} testerId={testerId} lat={lat} lon={lon}
                  wakeHour={wakeHour} sleepHour={sleepHour}
                  onDone={() => { setMoving(null); onRehomed(); }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── The pattern panel ────────────────────────────────────────────────────────



/**
 * What you get done, by the kind of day it was.
 *
 * This replaced the felt rating (aligned / mixed / off), which was removed for
 * two reasons that both survived checking:
 *
 *   · It was write-only. Traced 2026-07-31: the rating had ZERO references in
 *     electionEngine, election, synthesis, dayarc, interpretation or plan. It
 *     changed no recommendation anywhere. Thirty seconds a day for a sentence.
 *   · It was confounded by its own advice. The app says "a Deep day — rest",
 *     you rest, and it asks whether that felt right. Agreement is compliance,
 *     not evidence.
 *
 * Completions cost the reader nothing and nobody was told to produce them.
 *
 * The epistemic rules are inherited wholesale, because they were the good part:
 * silent below a floor, always the counts and the window, always the
 * comparison, and never a causal claim — what HAPPENED on those days, not what
 * those days do to you.
 */
function DonePattern({ today, testerId }: { today: string; testerId: string | null }) {
  const { data } = useQuery<{
    enough: boolean; daysObserved: number; activeDays: number; itemsCompleted: number;
    range: { from: string; to: string };
    characters: { character: string; days: number; activeDays: number; items: number; perDay: number; otherDays: number; otherPerDay: number | null }[];
    voidOfCourse: { days: number; perDay: number; otherDays: number; otherPerDay: number | null } | null;
  }>({
    queryKey: ["done-pattern", testerId, today],
    queryFn: async () => {
      const r = await fetch(`/api/check-ins/done-pattern?days=60&today=${today}&tz=${new Date().getTimezoneOffset()}`,
        { headers: { "x-tester-id": testerId ?? "" } });
      if (!r.ok) throw new Error("pattern unavailable");
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 10 * 60_000,
  });

  if (!data) return null;
  const top = data.enough ? data.characters[0] : null;
  const voc = data.enough ? data.voidOfCourse : null;
  const rate = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

  // Nothing to say yet, and nothing to nag about — this accrues on its own from
  // work the reader was doing anyway, so there is no call to action here.
  if (!top) {
    if (data.itemsCompleted === 0) return null;
    return (
      <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "11px 14px" }}>
        <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--color-muted)", marginBottom: 5 }}>Your pattern</div>
        <div style={{ fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.55 }}>
          {data.itemsCompleted} finished across {data.activeDays} of the last {data.daysObserved} days. Not enough yet to say which kinds of day suit you — it builds as you go, with nothing extra to log.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--color-muted)", marginBottom: 6 }}>
        What you've finished
      </div>
      <div style={{ fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.55 }}>
        You close <b style={{ color: "#4a8060" }}>{rate(top.perDay)} a day</b> on{" "}
        {top.character.charAt(0).toUpperCase() + top.character.slice(1)} days ({top.days} of them)
        {top.otherPerDay != null && <> — against {rate(top.otherPerDay)} on the other {top.otherDays}</>}.
      </div>
      {voc && voc.otherPerDay != null && (
        <div style={{ fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.55, marginTop: 5 }}>
          On void-of-course days: <b>{rate(voc.perDay)} a day</b> across {voc.days} — against {rate(voc.otherPerDay)} on the other {voc.otherDays}.
        </div>
      )}
      <div style={{ fontSize: 9.5, color: "var(--text-3)", marginTop: 5 }}>
        {data.itemsCompleted} items · {data.range.from} to {data.range.to}. What happened on those days, not what they do to you.
      </div>
    </div>
  );
}

// (DayTimeline was removed 2026-08-03 — 161 lines defining a component
//  that was never rendered anywhere, plus the useSkyEvents fetch that fed
//  it. The fetch was still running on every Today load: a third wasted
//  request alongside the two found in Dashboard.)

// ── ModulePulse ────────────────────────────────────────────────────────────────

const MODULE_META: Record<string, { label: string; icon: string; view: string }> = {
  health:        { label: "Health",        icon: "◎", view: "work" },
  creative:      { label: "Creative",      icon: "✦", view: "work" },
  spiritual:     { label: "Spiritual",     icon: "☽︎", view: "work" },
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
  const { profile: pulseProfile } = useTester();
  const moonSign: string = (now?.moonSign ?? "").split(" ")[0];
  const hourPlanet: string = now?.planetaryHour?.planet ?? "";
  const sm = SIGN_MYTHOS[moonSign];
  // Tap-to-cycle offsets, one per card. Each card carries its voice's WHOLE
  // list — the seeded pick is just the opening suggestion, and tapping turns
  // up the other ways that same influence could play out, in place.
  const [offs, setOffs] = useState<Record<number, number>>({});

  const suggestions: { options: string[]; seed: number; source: string; color: string; title?: string; suffix?: string }[] = [];

  // 1 — the hour's voice (seed rotates with the hour so untouched cards vary)
  //
  // Through the approach layer, not PLANET_ACTIVITIES. This card was the third
  // surface found still reading the flat list raw — after Today's ahead rows
  // and the collapsed rail — which meant a Mars hour could offer "train hard"
  // here at 11pm, the exact sentence that layer exists to prevent. The flat
  // list stays only as a fallback for a body the approach layer doesn't cover.
  const hourActs = hourPlanet
    ? (() => {
        const opts = approachOptions({
          planet: hourPlanet,
          at: new Date(),
          wakeTime: pulseProfile?.chronotype?.wakeTime,
          sleepTime: pulseProfile?.chronotype?.sleepTime,
          voc: !!now?.voc?.isVOC,
          moonSign,
        });
        return opts.length ? opts : PLANET_ACTIVITIES[hourPlanet];
      })()
    : undefined;
  if (hourActs?.length) {
    suggestions.push({
      options: hourActs,
      seed: new Date().getHours(),
      source: `${hourPlanet} hour`,
      // Hex fallback, because this value is later concatenated with an alpha
      // suffix (`${s.color}30`) — `var(--color-muted)30` is not a colour and
      // fails silently, leaving the card borderless for any ruler missing
      // from PLANET_THEMES. The blue matches the sibling builders' fallback
      // rather than a neutral grey, which the raw-grey guard rightly bans.
      color: PLANET_THEMES[hourPlanet]?.color ?? "#4a6a90",
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
    // Fourth site, found by the broadened test rather than by reading. Same
    // rule: the aspect partner's verbs must respect the clock and the void
    // like every other card's do.
    const partnerOpts = approachOptions({
      planet: partner,
      at: new Date(),
      wakeTime: pulseProfile?.chronotype?.wakeTime,
      sleepTime: pulseProfile?.chronotype?.sleepTime,
      voc: !!now?.voc?.isVOC,
      moonSign,
    });
    const acts = partnerOpts.length ? partnerOpts : PLANET_ACTIVITIES[partner];
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
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--color-muted)", marginBottom: 8 }}>
        Resonant now <span style={{ letterSpacing: 0, textTransform: "none", color: "var(--text-3)" }}>· tap a card for another way in</span>
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
                {/* explicit invitation — the muted counter alone read as decoration */}
                <span style={{ fontSize: 9, color: "var(--color-muted)", flexShrink: 0 }}>⟳ tap for more · {idx + 1}/{n}</span>
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
          <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-3)", flexShrink: 0 }}>{open ? "▲ less" : "▼ explore"}</span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.55, marginTop: 5 }}>{essence}</div>
      </button>

      {open && (
        <div style={{ padding: "0 14px 12px", borderTop: "1px solid var(--color-border)" }}>
          {/* The take — cycle through genuinely different framings */}
          <div style={{ marginTop: 10, background: "var(--color-card-2)", borderRadius: 9, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: accent }}>{takes[takeIdx].label}</span>
              <button onClick={() => setTakeIdx(i => (i + 1) % takes.length)} style={{ fontSize: 9.5, color: "var(--text-2)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                another take ↻ <span style={{ color: "var(--text-3)" }}>{takeIdx + 1}/{takes.length}</span>
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.65 }}>{takes[takeIdx].text}</div>
          </div>

          {/* Favors / watch */}
          <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#3a6020" }}>FAVORS </span>
              <span style={{ fontSize: 10.5, color: "var(--text-2)", lineHeight: 1.5 }}>{guidance.favors}</span>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#a04030" }}>WATCH </span>
              <span style={{ fontSize: 10.5, color: "var(--text-2)", lineHeight: 1.5 }}>{guidance.watch}</span>
            </div>
          </div>

          {/* The players — planet-in-sign context */}
          <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 4 }}>
            {[a, b].map((p) => {
              const pc = PLANET_CORE[p.planet];
              return (
                <div key={p.planet} style={{ fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.5 }}>
                  <span style={{ color: "var(--color-foreground)", fontWeight: 600 }}>{BIGSKY_PLANET_GLYPH[p.planet]} {p.planet} in {p.sign}</span>
                  {pc ? ` — ${pc.is}.` : ""}
                  <span style={{ color: "var(--text-3)" }}> In {p.sign}: {SIGN_INFLECTION[p.sign] ?? ""}.</span>
                </div>
              );
            })}
          </div>

          {/* The concept, explained plainly */}
          <div style={{ marginTop: 9, fontSize: 10, color: "var(--color-muted)", lineHeight: 1.55, fontStyle: "italic" }}>
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
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--color-muted)" }}>The big sky</div>
        <div style={{ fontSize: 10, color: "var(--color-muted)" }}>the strongest planet-to-planet weather right now — tap to explore</div>
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

function RitualCard({ mode, now, week, todayTasks, windows, testerId, displayName, onOpenStar, lat, lon }: {
  mode: "morning" | "evening";
  now: any; week: any;
  todayTasks: { id: number; title: string; done: string }[];
  windows: any[] | undefined;
  testerId: string | null;
  displayName?: string;
  onOpenStar?: (goalId: number) => void;
  lat?: number; lon?: number;
}) {
  const qc = useQueryClient();
  const today = localToday();
  // Waking hours for re-homing, so nothing is ever proposed for 4am. The
  // chronotype is optional, hence the plain fallback; and when sleep is
  // earlier than wake it wraps past midnight, so the scan runs to end of day.
  const { profile: ritualProfile } = useTester();
  const parseHour = (v: string | undefined, fallback: number) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? ""));
    if (!m) return fallback;
    const h = parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
    return h >= 0 && h <= 24 ? h : fallback;
  };
  const wakeHour = parseHour(ritualProfile?.chronotype?.wakeTime, 7);
  const sleepRaw = parseHour(ritualProfile?.chronotype?.sleepTime, 22);
  const sleepHour = sleepRaw > wakeHour ? sleepRaw : 24;
  // Defensive: these come from queries that can momentarily hand back a
  // non-array (a transient error body). The ritual card is time-gated, so a
  // bad value here surfaces as a whole-page crash rather than a skipped card.
  const tasks = Array.isArray(todayTasks) ? todayTasks : [];
  const wins = Array.isArray(windows) ? windows : [];
  const { data: habitsRaw = [] } = useQuery<any[]>({
    // Same key and same URL as every other habits read on the page — see the
    // note on Today's own query above for what sharing a key while asking for
    // something different cost.
    queryKey: ["habits", testerId, today, lat, lon],
    queryFn: async () => { const j = await fetchJson(`/api/habits?today=${today}&lat=${lat}&lon=${lon}`, { headers: { "x-tester-id": testerId ?? "" } }); return Array.isArray(j) ? j : []; },
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

  // Marking a scheduled block done — the door that was missing.
  // POST /planning/windows/:id/complete has existed since the Planner shipped
  // and was never called from anywhere, so `completedAt` was null on virtually
  // every row. The evening card already SAID "completed N blocks"; it just had
  // no way for anyone to make that true. It is also one of the three signals
  // the done-pattern reads, so an unwired verb meant a third of that evidence
  // never existed.
  const [blockError, setBlockError] = useState<number | null>(null);
  const markBlock = useMutation({
    mutationFn: async ({ id, done }: { id: number; done: boolean }) => {
      const r = await fetch(`/api/planning/windows/${id}/complete`, {
        method: "POST",
        headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
      });
      // Checked, because a silent write failure here is the exact bug class
      // this codebase spent a day removing (BACKLOG §2).
      if (!r.ok) throw new Error("could not save");
      return id;
    },
    onMutate: ({ id }) => { setBlockError(null); void id; },
    onError: (_e, v) => setBlockError(v.id),
    onSuccess: (id) => {
      invalidateWindows(qc);
      void offerCascade(id);
    },
  });

  // ── The cascade ───────────────────────────────────────────────────────────
  // Marking a block done AFTER its scheduled end is the moment we learn the
  // day slipped — and the only moment where asking about it isn't a nag,
  // because the user just told us.
  //
  // It ASKS. Motion ripples silently and its own users call that "AI calendar
  // anxiety"; Structured refuses to ripple at all, which is its loudest unmet
  // request. Both fall out of treating a block as a slot. A Compass window is
  // a claim that this time suits this work, so the card leads with what the
  // move COSTS — in the weaver's own words, not a second vocabulary.
  const [cascade, setCascade] = useState<null | {
    overrunMinutes: number; anchorTitle: string; affected: any[];
  }>(null);

  async function offerCascade(id: number) {
    const w = wins.find((x: any) => x.id === id);
    if (!w || !testerId) return;
    const overran = Date.now() - new Date(w.endTime).getTime();
    if (overran <= 60_000) return; // finished on time — nothing slipped
    try {
      const { from, to } = localDayRange(localToday());
      const r = await fetch("/api/planning/cascade/preview", {
        method: "POST",
        headers: { "x-tester-id": testerId, "Content-Type": "application/json" },
        body: JSON.stringify({
          windowId: id, from, to, lat, lon,
          tzOffsetMin: new Date().getTimezoneOffset(),
        }),
      });
      if (!r.ok) return; // a failed preview is silence, never a wrong offer
      const p = await r.json();
      if (p?.affected?.length) setCascade({ ...p, anchorTitle: w.title });
    } catch {
      // Same reasoning: if we can't say what a move costs, we don't offer one.
    }
  }

  const applyCascade = useMutation({
    mutationFn: async (shifts: { id: number; startAt: string; endAt: string }[]) => {
      const r = await fetch("/api/planning/cascade/apply", {
        method: "POST",
        headers: { "x-tester-id": testerId ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({ shifts }),
      });
      if (!r.ok) throw new Error("could not move those");
      return r.json();
    },
    onSuccess: () => { invalidateWindows(qc); setCascade(null); },
  });

  const tide = now?.tide;
  const character = (tide?.character ?? "deep") as TideCharacter;
  const elKey = CHARACTER_ELEMENT[character] ?? "water";
  const elColor = ELEMENT_COLORS[elKey] ?? ELEMENT_COLORS.water;
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

  if (mode === "morning") {
    // "Today's three" (top task · next event · next block) used to render here.
    // It was YOUR DAY's now / next / still loose, computed by a second
    // algorithm — two surfaces answering one question two ways, which is how
    // the week caption came to argue with its own labels and how the
    // Keep-going card came to sit above "still loose: the same task". YOUR DAY
    // owns it, and in the morning it is framed "Already committed".
    //
    // The tide restatement went with it: the hero says the same sentence
    // verbatim a few inches above. This card's job is the twice-daily anchor —
    // the greeting, the star rows, the evening harvest — not a second reading
    // of a day already on screen.

    return (
      <div style={{ background: `linear-gradient(135deg, ${elColor}16, ${elColor}05)`, border: `1px solid ${elColor}30`, borderRadius: 14, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--color-primary)" }}>⛵ Cast off{firstName ? `, ${firstName}` : ""}</span>
          <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: elColor }}>morning</span>
        </div>


        {/* The morning glance: one row per Guiding Star — next move + today's
            best window for its element; tap → that star's game plan. */}
        <StarRows testerId={testerId} lat={lat} lon={lon} onOpenStar={onOpenStar} />

        {/* Morning chips: every daily, plus any looser practice that's actually
            BEHIND its own cadence. An "whenever it fits" habit never appears
            here unprompted — the morning glance shouldn't manufacture a
            to-do out of something that declared it has no schedule. */}
        {(() => {
          const morningHabits = habitList.filter((h: any) => {
            const cad = h.cadence ?? "daily";
            if (cad === "daily") return true;
            if (cad === "occasional") return false;
            return h.cadenceMet === false;
          });
          return morningHabits.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {morningHabits.map((h: any) => {
                const resonant = !h.doneToday && el && h.favoredElements?.includes(el);
                // An explicit solar anchor wins; otherwise fall back to the
                // element's implied rhythm — fire rides sunrise, air the high
                // sun, earth lands by sunset, water takes the Moon's own hour.
                const dl = (now as any)?.daylight;
                const moonHr = ((now as any)?.upcomingHours ?? []).find((u: any) => u.planet === "Moon");
                const fmtT = (iso?: string) => iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;
                const fe = h.favoredElements?.[0];
                // Bed is the chronotype's hour, not the sky's — the server
                // sends no instant for it, so the time renders from the
                // person's own sleepTime here.
                const sleepT = ritualProfile?.chronotype?.sleepTime;
                const anchor = h.doneToday ? null
                  : h.solarAnchor === "bed" ? `⏾ by ${sleepT ? new Date(`2000-01-01T${sleepT.padStart(5, "0")}:00`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "bed"}`
                  : h.solarAnchorAt ? `${h.solarAnchor === "sunset" ? "☾" : "☉"} ${h.solarAnchor === "sunset" ? "by " : ""}${fmtT(h.solarAnchorAt)}`
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
                    <span style={{ fontSize: 11, color: h.doneToday ? "#4a8060" : "var(--text-3)" }}>{h.doneToday ? "✓" : "○"}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: h.doneToday ? "#4a8060" : "var(--color-foreground)" }}>{h.name}</span>
                    {resonant && <span style={{ fontSize: 10, color: elColor }}>✦</span>}
                    {/* A streak reads as encouragement on a daily and as
                        nonsense on a 3×/week — so non-dailies show their
                        cadence position instead. */}
                    <span style={{ fontSize: 9, color: "var(--text-3)" }}>
                      {(h.cadence ?? "daily") !== "daily"
                        ? `${h.windowDone ?? 0}/${h.windowTarget ?? 0} this week`
                        : h.doneToday ? `${h.streak}d` : STREAK_NUDGE(h.streak ?? 0)}
                    </span>
                    {anchor && <span style={{ fontSize: 8.5, color: "var(--text-3)" }}>{anchor}</span>}
                  </button>
                );
              })}
            </div>
          </div>
          );
        })()}

      </div>
    );
  }

  // ── Evening: Log the day ──
  const keptHabits = habitList.filter((h: any) => h.doneToday);
  // The denominator is DAILIES only. Counting a 3×/week or "whenever it fits"
  // practice as a miss every day it isn't done is exactly the cramped feeling
  // the cadence model exists to remove (owner 2026-07-29) — a day with two
  // dailies kept should read as two of two, not two of nine.
  const dailyHabits = habitList.filter((h: any) => (h.cadence ?? "daily") === "daily");
  const keptDailies = dailyHabits.filter((h: any) => h.doneToday);
  const doneBlocks = wins.filter((w: any) => w.completedAt);
  const closedTasks = tasks.filter((t) => t.done === "true");
  const didAnything = keptHabits.length + doneBlocks.length + closedTasks.length > 0;
  const parts: string[] = [];
  if (dailyHabits.length) parts.push(`kept ${keptDailies.length} of ${dailyHabits.length} dail${dailyHabits.length === 1 ? "y" : "ies"}`);
  // Non-daily practices are pure credit when they happen, never a shortfall.
  const keptOther = keptHabits.length - keptDailies.length;
  if (keptOther > 0) parts.push(`${keptOther} other practice${keptOther === 1 ? "" : "s"}`);
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

      {/* Outside the didAnything branch, deliberately. BlockCheck is the ONLY
          way to mark a scheduled block complete, and it used to sit INSIDE it —
          so on a day whose only activity was blocks, `didAnything` was false
          and the verb never rendered. You could record a block only if you had
          already recorded something else. The door existed and was locked from
          the inside, which also starved the done-pattern of a third of its
          evidence for exactly the people who plan in blocks. */}
      {cascade && (
        <CascadeCard
          cascade={cascade}
          pending={applyCascade.isPending}
          onApply={(shifts) => applyCascade.mutate(shifts)}
          onDismiss={() => setCascade(null)}
        />
      )}
      <BlockCheck
        wins={wins} markBlock={markBlock} blockError={blockError} elColor={elColor}
        testerId={testerId} lat={lat ?? 30.27} lon={lon ?? -97.74}
        wakeHour={wakeHour} sleepHour={sleepHour}
        onRehomed={() => invalidateWindows(qc)}
      />

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
                  border: "1px solid var(--color-border)", color: "var(--text-3)", cursor: "pointer",
                }}>○ {h.name} — did it? tap to log</button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 8 }}>
          A quiet day in the log is still a day in the log.
          {(tide?.level === "low" || tide?.level === "ebb") && " The tide was low — resting was reading the water right."}
        </div>
      )}

      {/* The harvest: today's wins (auto + named) and the line in your own
          words — this is the loop's evening half. */}
      <EveningHarvest testerId={testerId} lat={lat} lon={lon} />

      <div style={{ fontSize: 10.5, color: "var(--text-3)", paddingTop: 8, borderTop: "1px solid var(--color-border)" }}>
        Rate the day below — it lands in the Log, stamped with tonight's sky.
        {tomorrowChar && <span style={{ color: "var(--color-muted)" }}> Tomorrow: a {tomorrowChar} day.</span>}
      </div>
    </div>
  );
}

// ── Shared aspect + planet vocabulary ────────────────────────────────────────
//
// What survives the 2026-08-14 dead-code removal: `PLANET_THEMES`, read by
// ModulePulse for its fallback colour, and the two `fmt*Exact` helpers, read by
// BigSkyCard. All three were written for `PlanetaryPulse` and outlived it,
// because live components several hundred lines above had reached in and
// borrowed them — which is why deleting that component wholesale would have
// broken two cards that do render.

const PLANET_THEMES: Record<string, { themes: string; icon: string; color: string }> = {
  Sun:     { icon:"☉︎", color:PLANET_COLORS.Sun, themes:"visibility · authority · vitality · identity" },
  Moon:    { icon:"☽︎", color:PLANET_COLORS.Moon, themes:"feeling · intuition · nourishment · cycles" },
  Mercury: { icon:"☿︎", color:PLANET_COLORS.Mercury, themes:"communication · writing · analysis · ideas" },
  Venus:   { icon:"♀︎", color:PLANET_COLORS.Venus, themes:"connection · beauty · pleasure · values" },
  Mars:    { icon:"♂︎", color:PLANET_COLORS.Mars, themes:"drive · action · courage · physical energy" },
  Jupiter: { icon:"♃︎", color:PLANET_COLORS.Jupiter, themes:"expansion · optimism · generosity · faith" },
  Saturn:  { icon:"♄︎", color:PLANET_COLORS.Saturn, themes:"discipline · structure · responsibility · long-term" },
  Uranus:  { icon:"♅︎", color:PLANET_COLORS.Uranus, themes:"disruption · innovation · liberation · surprise" },
  Neptune: { icon:"♆︎", color:PLANET_COLORS.Neptune, themes:"imagination · transcendence · compassion · dissolution" },
  Pluto:   { icon:"♇︎", color:PLANET_COLORS.Pluto, themes:"transformation · depth · power · shadow" },
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

// ── WaveRow ────────────────────────────────────────────────────────────────────

