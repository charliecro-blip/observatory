/**
 * ASK — the advisor panel, and the app's chief function.
 *
 * It lived inside Today, which meant every route into Ask had to NAVIGATE
 * there first: App's askAboutElection did `setView("today")` before opening
 * the panel, so tapping "Timing" on Home's Ask card silently threw away the
 * page you were on. The panel is a modal; it never had any business belonging
 * to a route.
 *
 * App renders it now, above whatever view is showing, and the seed carries
 * the subject with it — so an ask that started from Home's answer is still
 * about THAT pick rather than about whatever the page underneath would have
 * proposed. That is the rule the seeded `subject` already encoded and the
 * navigation quietly broke.
 */

import React, { useState, useEffect, useRef } from "react";
import { aiErrorMessage } from "@/lib/aiError";
import AskDoors from "@/components/AskDoors";
import { PLANET_COLORS } from "@/lib/planetColors";
import type { AskElectionContext } from "@/App";
import { useDialog } from "@/hooks/useDialog";
import { scrollBehavior } from "@/lib/reducedMotion";

interface AdvisorMessage { role: "user" | "assistant"; content: string; }

export default function MomentAdvisor({ testerId, lat, lon, onClose, gcalEvents = [], weekSummary = "", onAddTask, seedMessage, electionContext, strongestFit, now, northStars }: {
  testerId: string | null;
  lat: number;
  lon: number;
  onClose: () => void;
  /** Context the ask is enriched with, never gated on: the advisor answers
   *  fine without a calendar or a week, and pretending otherwise would make
   *  Ask unavailable to anyone who has not connected one. */
  gcalEvents?: { title: string; start: string; end: string; allDay: boolean }[];
  weekSummary?: string;
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
  const { ref, props } = useDialog(onClose, "Ask");
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
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: scrollBehavior() }); }, [history, streamBuffer]);
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
      position: "fixed", inset: 0, background: "rgba(15,20,30,0.55)", zIndex: "var(--z-sheet)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={ref} {...props} style={{
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
              }}><span aria-hidden="true">←</span> New question</button>
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
                  }}><span aria-hidden="true">→</span> task</button>
                </div>
              </div>
            ))}
            <button onClick={() => setShowPins(false)} style={{ fontSize: 10, color: "var(--text-3)", background: "none", border: "none", cursor: "pointer", alignSelf: "center", marginTop: 4 }}><span aria-hidden="true">←</span> Back to conversation</button>
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
              {/* No "Turn it" door here. The other three doors send a question
                  to the advisor; that one answers locally and never calls the
                  model. In this panel its composer stacked directly above the
                  advisor's own — two fields, no visual difference between them,
                  and typing "restless" into the wrong one silently gets you a
                  different kind of answer. It lives on Home, where the doors
                  open in place and nothing competes with it. */}
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
                fontSize: 13, background: "var(--color-card)", resize: "none",
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
