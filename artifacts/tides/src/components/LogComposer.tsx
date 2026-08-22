/**
 * The Log's writing surface — three variants, switchable, so the shape can be
 * chosen by using it rather than by describing it.
 *
 *   A "A page"       one large surface under one question drawn from the day
 *   B "Three asks"   short structured answers, comparable across days
 *   C "In the margin" a note beside each thing the day actually holds
 *
 * All three write the same two places: `notes` keeps the day's plain paragraph
 * (every older reader keeps working), and `reflection` keeps the structure —
 * which question was asked, which answer went where — so the rhythm read-back
 * can compare like with like instead of grepping a blob.
 */
import React, { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { useMomentum } from "@/components/Momentum";

export type LogVariant = "page" | "asks" | "margin" | "tally";

export const LOG_VARIANTS: { key: LogVariant; label: string; blurb: string }[] = [
  { key: "page", label: "A page", blurb: "one question, one big surface" },
  { key: "asks", label: "Three asks", blurb: "short answers, same three every day" },
  { key: "margin", label: "In the margin", blurb: "a note beside each thing you did" },
  // The fourth shape (design §8 leftover): wins only, no prose. For the
  // person whose record is the list of what got done, and who will never
  // write a paragraph about it.
  { key: "tally", label: "The tally", blurb: "what got done, and nothing to write" },
];

const FELT_META: Record<string, { label: string; icon: string; color: string }> = {
  aligned: { label: "Aligned", icon: "●", color: "#4a8060" },
  mixed: { label: "Mixed", icon: "◐", color: "#a08040" },
  off: { label: "Off", icon: "○", color: "#9a6060" },
};

const ELEMENT_WORD: Record<string, string> = {
  fire: "hot", earth: "slow", air: "scattered", water: "deep",
};

const ELEMENT_TO_CHARACTER: Record<string, string> = {
  water: "deep", fire: "surge", earth: "building", air: "clear",
};

function decodeFelt(tags: string[] | null | undefined) {
  const get = (p: string) => tags?.find((t) => t.startsWith(p))?.slice(p.length) ?? null;
  return { felt: get("felt:"), tideChar: get("tideChar:"), tideLevel: get("tideLevel:") };
}

/** Questions that don't depend on the day — asked in a stable rotation. */
const GENERAL_PROMPTS = [
  "What took more out of you than you expected?",
  "What do you want to remember about this day?",
  "Where did the day go differently than you'd planned?",
  "What would you do the same way again?",
  "Who was in it?",
  "What were you avoiding?",
  "What was the first thing you did that felt like yours?",
  "What was the hour you'd take back?",
];

/**
 * The bank for one day: the questions this particular day can ask, then the
 * general ones. Day-derived questions come first because they're the ones that
 * prove the app was paying attention.
 */
export function promptsFor(day: {
  date: string;
  ledgerCount: number;
  element?: string | null;
  flavors?: string[] | null;
}): string[] {
  const dow = (() => { try { return format(parseISO(day.date), "EEEE"); } catch { return "that day"; } })();
  const out: string[] = [];
  if (day.ledgerCount > 1) {
    out.push(`Of the ${day.ledgerCount} things you logged, which one actually mattered?`);
  } else if (day.ledgerCount === 0) {
    out.push(`Nothing's on ${dow} yet. What did you actually do?`);
  }
  const w = day.element ? ELEMENT_WORD[day.element] : null;
  if (w) out.push(`Did ${dow} feel as ${w} from the inside as the sky read it?`);
  const planet = day.flavors?.[0];
  if (planet) out.push(`${planet} was in that day; where did you meet it?`);
  // A stable rotation rather than a random one, so returning to a day asks the
  // same thing it asked last time.
  const raw = day.date.split("-").reduce((a, p) => a + Number(p), 0);
  const seed = Number.isFinite(raw) ? raw : 0;
  for (let i = 0; i < GENERAL_PROMPTS.length; i++) {
    out.push(GENERAL_PROMPTS[(seed + i) % GENERAL_PROMPTS.length]);
  }
  return out;
}

const ASKS = [
  { key: "happened", q: "What actually happened?", hint: "the shape of the day, not the highlights" },
  { key: "cost", q: "What took more than you expected?", hint: "a person, a task, an hour" },
  { key: "keep", q: "What do you want to remember?", hint: "one thing is enough" },
];

const BOX: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8,
  border: "1px solid var(--color-border)", background: "var(--color-card-2)",
  fontSize: 13, lineHeight: 1.6, color: "var(--color-foreground)",
  resize: "vertical", fontFamily: "inherit",
};

const CARD: React.CSSProperties = {
  marginBottom: 24, padding: "14px 16px", background: "var(--color-card)",
  border: "1px solid var(--color-border)", borderRadius: 10,
};

const CAP: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: "var(--color-muted)",
  textTransform: "uppercase", letterSpacing: 0.4,
};

export default function LogComposer({ testerId, date, dayDetail, variant, onPickVariant }: {
  testerId: string | null;
  date: string;
  dayDetail: any;
  variant: LogVariant;
  onPickVariant: (v: LogVariant) => void;
}) {
  const qc = useQueryClient();
  const existingTags = decodeFelt(dayDetail.checkIn?.behaviorTags);
  const existingNotes: string = dayDetail.checkIn?.notes ?? "";
  const existingRef = dayDetail.checkIn?.reflection ?? null;

  const [felt, setFelt] = useState<string | null>(existingTags.felt);
  const [note, setNote] = useState(existingNotes);
  const [answers, setAnswers] = useState<Record<string, string>>(existingRef?.answers ?? {});
  const [items, setItems] = useState<Record<string, string>>(existingRef?.items ?? {});
  const [promptIdx, setPromptIdx] = useState(0);
  const [winText, setWinText] = useState("");
  const [winSaving, setWinSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const r = dayDetail.checkIn?.reflection ?? null;
    setFelt(decodeFelt(dayDetail.checkIn?.behaviorTags).felt);
    setNote(dayDetail.checkIn?.notes ?? "");
    setAnswers(r?.answers ?? {});
    setItems(r?.items ?? {});
    setPromptIdx(0);
    setSaved(false);
  }, [date, dayDetail.checkIn?.id]);

  const { data: momentum } = useMomentum(testerId);
  // What this day actually holds, one list: named and auto wins from the wake,
  // completed windows, health logs. The margin variant writes against it, and
  // the page variant counts it to decide what to ask.
  const ledger = useMemo(() => {
    const rows: { key: string; label: string; sub?: string }[] = [];
    for (const l of (momentum?.ledger ?? []).filter((x) => x.date === date)) {
      // Auto wins have no id — key them by their text, which is derived from
      // the thing itself and so is stable across refetches.
      rows.push({ key: `win:${l.winId ?? l.text}`, label: l.text, sub: l.source === "named" ? undefined : l.source });
    }
    for (const a of dayDetail.activities ?? []) {
      rows.push({ key: `act:${a.id}`, label: a.title, sub: a.windowType });
    }
    for (const h of dayDetail.healthLogs ?? []) {
      rows.push({ key: `health:${h.id}`, label: h.name, sub: h.type });
    }
    return rows;
  }, [momentum, date, dayDetail]);

  async function addWin() {
    if (!testerId || winSaving || !winText.trim()) return;
    setWinSaving(true);
    try {
      const r = await fetch("/api/planning/wins", {
        method: "POST",
        headers: { "x-tester-id": testerId, "Content-Type": "application/json" },
        body: JSON.stringify({ text: winText.trim(), date, tz: new Date().getTimezoneOffset() }),
      });
      if (!r.ok) throw new Error(String(r.status));
      qc.invalidateQueries({ queryKey: ["momentum"] });
      setWinText("");
    } catch {
      setErr("Didn't save. It's still in the box.");
    } finally {
      setWinSaving(false);
    }
  }

  const prompts = useMemo(() => promptsFor({
    date,
    ledgerCount: ledger.length,
    element: dayDetail.sky?.element,
    flavors: dayDetail.sky?.flavors,
  }), [date, ledger.length, dayDetail.sky]);
  const prompt = prompts[promptIdx % prompts.length];

  async function save() {
    if (!testerId || saving) return;
    setSaving(true);
    setErr(null);
    try {
      // `notes` is the day in plain prose whichever variant wrote it, so the
      // timeline, the reports and the advisor all keep reading one field.
      const plain =
        variant === "asks"
          ? ASKS.map((a) => (answers[a.key]?.trim() ? `${a.q} ${answers[a.key].trim()}` : null))
              .filter(Boolean).join("\n\n")
          : variant === "tally"
          ? existingNotes   // the tally writes no prose; whatever was there stays
          : note.trim();
      // Merge rather than replace: while three shapes are live, saving in one
      // must not throw away what another already wrote for this day.
      const reflection = {
        ...(existingRef ?? {}),
        ...(variant === "page" ? { prompt } : variant === "asks" ? { answers } : variant === "margin" ? { items } : {}),
      };

      const body: Record<string, unknown> = { date, notes: plain || null, reflection };
      if (felt) {
        const tags = [`felt:${felt}`];
        const ch = existingTags.tideChar ?? ELEMENT_TO_CHARACTER[dayDetail.sky?.element];
        if (ch) tags.push(`tideChar:${ch}`);
        if (existingTags.tideLevel) tags.push(`tideLevel:${existingTags.tideLevel}`);
        body.behaviorTags = tags;
      }
      const r = await fetch("/api/check-ins", {
        method: "POST",
        headers: { "x-tester-id": testerId, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(String(r.status));
      qc.invalidateQueries({ queryKey: ["logs-day"] });
      qc.invalidateQueries({ queryKey: ["logs-timeline"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setErr("Didn't save. Your writing is still in the box.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={CARD}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={CAP}>{dayDetail.checkIn ? "Your reflection" : "Reflect on this day"}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "var(--text-3)" }}>trying three shapes:</span>
          {LOG_VARIANTS.map((v) => (
            <button key={v.key} title={v.blurb} onClick={() => onPickVariant(v.key)} style={{
              fontSize: 10.5, padding: "3px 9px", borderRadius: 11, cursor: "pointer",
              border: `1px solid ${variant === v.key ? "var(--color-primary)" : "var(--color-border)"}`,
              background: variant === v.key ? "var(--color-primary)" : "var(--color-background)",
              color: variant === v.key ? "#fff" : "var(--color-muted)",
            }}>{v.label}</button>
          ))}
        </div>
      </div>

      {/* The felt rating is the structured signal the rhythm read-back leans on,
          so it stays put no matter which writing surface is showing. */}
      <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
        {Object.entries(FELT_META).map(([key, o]) => (
          <button key={key} onClick={() => setFelt(felt === key ? null : key)} style={{
            flex: 1, padding: "7px 6px", borderRadius: 8, cursor: "pointer",
            border: felt === key ? `1.5px solid ${o.color}` : "1px solid var(--color-border)",
            background: felt === key ? `${o.color}12` : "var(--color-card-2)",
            fontSize: 11, color: felt === key ? o.color : "var(--color-muted)",
            fontWeight: felt === key ? 600 : 400,
          }}>{o.icon} {o.label}</button>
        ))}
      </div>

      {variant === "page" && (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 7 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-foreground)", lineHeight: 1.4 }}>
              {prompt}
            </div>
            <button onClick={() => setPromptIdx((i) => i + 1)} style={{
              flexShrink: 0, background: "none", border: "none", cursor: "pointer",
              fontSize: 11, color: "var(--color-primary)", padding: 0,
            }}>ask me something else</button>
          </div>
          <textarea
            value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="However much you want to write."
            rows={10} style={BOX}
          />
        </>
      )}

      {variant === "asks" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ASKS.map((a) => (
            <div key={a.key}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-foreground)", marginBottom: 5 }}>{a.q}</div>
              <textarea
                value={answers[a.key] ?? ""}
                onChange={(e) => setAnswers((s) => ({ ...s, [a.key]: e.target.value }))}
                placeholder={a.hint} rows={3} style={BOX}
              />
            </div>
          ))}
        </div>
      )}

      {variant === "tally" && (
        <div>
          {ledger.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.6, marginBottom: 8 }}>Nothing on the tally yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
              {ledger.map((row) => (
                <div key={row.key} style={{ display: "flex", alignItems: "baseline", gap: 9, fontSize: 13 }}>
                  <span style={{ color: "#3f7a4a", fontSize: 11 }}>✓</span>
                  <span style={{ flex: 1, color: "var(--color-foreground)" }}>{row.label}</span>
                  {row.sub && <span style={{ fontSize: 10, color: "var(--text-3)" }}>{row.sub}</span>}
                </div>
              ))}
              <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 2 }}>{ledger.length} on the day</div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={winText}
              onChange={(e) => setWinText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addWin(); }}
              placeholder="Something else you did that day"
              style={{ ...BOX, resize: "none", padding: "7px 11px", fontSize: 12.5 } as React.CSSProperties}
            />
            <button onClick={addWin} disabled={winSaving || !winText.trim()} style={{
              padding: "7px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 500,
              cursor: winText.trim() ? "pointer" : "default",
              background: winText.trim() ? "#1a2a3a" : "var(--color-border)", color: winText.trim() ? "#fff" : "var(--text-3)",
            }}>{winSaving ? "…" : "Add"}</button>
          </div>
        </div>
      )}

      {variant === "margin" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ledger.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.6 }}>
              This day holds nothing to write beside yet. Log something you did and it appears here,
              or use the box below for the day as a whole.
            </div>
          ) : ledger.map((row) => (
            <div key={row.key} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: "38%", flexShrink: 0, paddingTop: 6 }}>
                <div style={{ fontSize: 12.5, color: "var(--color-foreground)", lineHeight: 1.4 }}>{row.label}</div>
                {row.sub && <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>{row.sub}</div>}
              </div>
              <textarea
                value={items[row.key] ?? ""}
                onChange={(e) => setItems((s) => ({ ...s, [row.key]: e.target.value }))}
                placeholder="How did it go?" rows={2} style={{ ...BOX, fontSize: 12 }}
              />
            </div>
          ))}
          <div>
            <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 5 }}>And the day as a whole</div>
            <textarea
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Anything the list above doesn't cover." rows={3} style={BOX}
            />
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 10 }}>
        {saved && <span style={{ fontSize: 10.5, color: "#4a8060" }}>saved ✓</span>}
        {err && <span style={{ fontSize: 10.5, color: "#a03030" }}>{err}</span>}
        <button onClick={save} disabled={saving} style={{
          padding: "7px 16px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 500,
          cursor: saving ? "default" : "pointer", background: "#1a2a3a", color: "#fff",
        }}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}
