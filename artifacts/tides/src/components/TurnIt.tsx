/**
 * TURN IT — a person says how they are, and the sky either has something
 * shaped like that or it doesn't (DESIGN-TRANSMUTE-2026-08-21).
 *
 * The door name is plain and verb-first so it sits beside Orient, This moment
 * and Timing without a glossary; the alchemy lives in the row labels, where
 * "what it is / what it's for" reads as English whether or not you know the
 * word transmute.
 *
 * THREE THINGS THIS COMPONENT MUST NOT DO.
 *
 * It must not interpret the person. Every line is about the SKY and about what
 * the energy is good for. There is no sentence here of the form "you are…".
 *
 * It must not claim cause. The server's grammar is "has the shape of" and "is
 * live", never "because" or "is making you", and this renders that grammar as
 * given rather than smoothing it into something more satisfying.
 *
 * It must not always find something. Roughly half of all readings come back
 * quiet, and the quiet card is designed rather than apologised for — it gets
 * the same weight as an answer, because "nothing up there matches this" is the
 * honest result and the thing every horoscope app refuses to say.
 *
 * Nothing typed here is stored. Keeping a moment is the diary's separate,
 * deliberate act.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { conditionalFits } from "@/lib/alternatives";
import { PLANET_COLORS } from "@/lib/planetColors";

type Tempo = "today" | "season";
interface Live { planet: string; literal: string; plain: string; tempo: Tempo; shadow?: string; gift?: string; work?: string }
interface Reading {
  blocked: false;
  mirror: { planets: string[]; rationale: string; capacity: "depleted" | "restless" | "social" | null };
  live: Live | null;
  quiet?: string;
}
interface Blocked { blocked: true; kind: string; message: string; resources: { label: string; detail: string }[] }
type Result = Reading | Blocked;

const BOX: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 9,
  border: "1px solid var(--color-border)", background: "var(--color-card-2)",
  fontSize: 13, lineHeight: 1.6, color: "var(--color-foreground)",
  outline: "none", resize: "vertical", fontFamily: "inherit",
};
const ROW_LABEL: React.CSSProperties = {
  fontSize: 9.5, letterSpacing: "0.09em", textTransform: "uppercase",
  color: "var(--text-3)", minWidth: 74, paddingTop: 2,
};
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
    <span style={ROW_LABEL}>{label}</span>
    <span style={{ fontSize: 12.5, lineHeight: 1.65, color: "var(--color-foreground)", flex: 1, minWidth: 0 }}>{children}</span>
  </div>
);

/** Support only. No planet, no reading, nothing to expand — that is the point. */
function SupportCard({ r }: { r: Blocked }) {
  return (
    <div style={{
      padding: "15px 16px", borderRadius: 10,
      border: "1px solid var(--color-border)", background: "var(--color-card-2)",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: "var(--color-foreground)" }}>{r.message}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {r.resources.map(x => (
          <div key={x.label}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-foreground)" }}>{x.label}</div>
            <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--color-muted)" }}>{x.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TurnIt({
  testerId, lat, lon, wakeTime, sleepTime, voc,
}: {
  testerId: string | null; lat: number; lon: number;
  wakeTime?: string | null; sleepTime?: string | null; voc?: boolean;
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const ask = useMutation({
    mutationFn: async (t: string): Promise<Result> => {
      const res = await fetch("/api/feeling", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) },
        body: JSON.stringify({ text: t, lat, lon }),
      });
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
    onSuccess: setResult,
  });

  const submit = () => { const t = text.trim(); if (t) ask.mutate(t); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      <textarea
        value={text}
        onChange={e => { setText(e.target.value); if (result) setResult(null); }}
        onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
        rows={2}
        placeholder="Restless and can't settle. Flat. Wound up about one conversation."
        style={BOX}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={submit}
          disabled={!text.trim() || ask.isPending}
          style={{
            fontSize: 12, fontWeight: 600, padding: "7px 15px", borderRadius: 8, cursor: text.trim() ? "pointer" : "default",
            border: "1px solid var(--color-border)",
            background: text.trim() ? "var(--color-primary)" : "var(--color-card-2)",
            color: text.trim() ? "#fff" : "var(--color-muted)",
          }}>
          {ask.isPending ? "Looking…" : "Look at the sky"}
        </button>
        <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>Nothing here is saved.</span>
      </div>

      {ask.isError && (
        <div style={{ fontSize: 12, color: "var(--color-muted)" }}>
          That didn't reach the sky. Try again in a moment.
        </div>
      )}

      {result?.blocked && <SupportCard r={result} />}

      {result && !result.blocked && result.live && (
        <Answer live={result.live} mirror={result.mirror} ctx={{ lat, lon, wakeTime, sleepTime, voc }} />
      )}

      {result && !result.blocked && !result.live && (
        <div style={{
          padding: "14px 15px", borderRadius: 10,
          border: "1px dashed var(--color-border)", background: "transparent",
        }}>
          <div style={{ ...ROW_LABEL, minWidth: 0, marginBottom: 6 }}>Nothing to match it</div>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7, color: "var(--color-muted)" }}>{result.quiet}</p>
        </div>
      )}
    </div>
  );
}

function Answer({
  live, mirror, ctx,
}: {
  live: Live;
  mirror: Reading["mirror"];
  ctx: { lat: number; lon: number; wakeTime?: string | null; sleepTime?: string | null; voc?: boolean };
}) {
  const color = PLANET_COLORS[live.planet] ?? "var(--color-primary)";

  // alternatives.ts, finally consumed. It answers a question the engine cannot:
  // how the person actually has capacity right now. When their own words named
  // a capacity we show that one; when they didn't, all three conditions stand
  // and the person picks by consulting themselves, which is what the module was
  // written for.
  const fits = conditionalFits({
    planet: live.planet, at: new Date(),
    wakeTime: ctx.wakeTime, sleepTime: ctx.sleepTime, voc: ctx.voc,
  });
  const shown = mirror.capacity ? fits.filter(f => f.capacity === mirror.capacity) : fits;

  return (
    <div style={{
      padding: "15px 16px", borderRadius: 10,
      border: "1px solid var(--color-border)", background: "var(--color-card-2)",
      borderLeft: `2.5px solid ${color}`,
      display: "flex", flexDirection: "column", gap: 11,
    }}>
      <div>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--color-foreground)" }}>
          That has the shape of {live.planet}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginTop: 3 }}>
          {live.tempo === "season"
            ? `${live.planet} is live right now, and has been for a while.`
            : `${live.planet} is live right now.`}
        </div>
      </div>

      {/* The labels carry the turn: the same energy at its worst, at its best,
          and then what to spend it on. "what it is" sat on the SHADOW here at
          first, which said the shadow was the thing rather than one face of it.

          The gift and shadow rows drop out when the configuration line already
          ends in them — synthesis appends the transiting planet's gift (or
          "watch {shadow}") to its own note, so printing the row underneath
          repeated the sentence verbatim. That is the same tautology the reading
          itself was de-duplicated for on 2026-08-21. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Row label="in the sky">{live.literal}</Row>
        {live.shadow && !live.literal.includes(live.shadow) && <Row label="at its worst">{live.shadow}</Row>}
        {live.gift && !live.literal.includes(live.gift) && <Row label="at its best">{live.gift}</Row>}
        {live.work && <Row label="what it's for">{live.work}</Row>}
      </div>

      {shown.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 3, borderTop: "1px solid var(--color-border)" }}>
          {shown.map(f => (
            <div key={f.capacity} style={{ fontSize: 12, lineHeight: 1.6, color: "var(--color-muted)" }}>
              <span style={{ color: "var(--text-3)" }}>{f.condition}</span> — {f.suggestion}
            </div>
          ))}
        </div>
      )}

      <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.6, color: "var(--text-3)" }}>
        A resemblance between what you named and what the sky is doing, not a cause of it.
      </p>
    </div>
  );
}
