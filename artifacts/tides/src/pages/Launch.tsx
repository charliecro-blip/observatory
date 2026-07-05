import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useElectionCategories, useElectionScan, type ElectionResult, type ElectionVerdict } from "@/hooks/useElection";
import Planner from "@/components/Planner";
import { PLANET_GLYPH as PLANET_ICONS } from "@/lib/glyphs";

const VERDICT_COLORS: Record<ElectionVerdict, string> = {
  strong: "#3a6020", workable: "#3a5a80", caution: "#a05020", avoid: "#a03030",
};
const VERDICT_BG: Record<ElectionVerdict, string> = {
  strong: "#e8f5e0", workable: "#e8eef8", caution: "#f8ede0", avoid: "#f8e4e0",
};
const VERDICT_LABELS: Record<ElectionVerdict, string> = {
  strong: "Strong", workable: "Workable", caution: "Caution", avoid: "Avoid",
};

function fmtRange(startIso: string, endIso: string): string {
  const s = new Date(startIso), e = new Date(endIso);
  const dateLabel = s.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const t = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dateLabel} · ${t(s)}–${t(e)}`;
}

function RuleRow({ rule }: { rule: ElectionResult["rules"][number] }) {
  const ok = rule.passed;
  const dotColor = rule.severity === "support"
    ? (ok ? "#3a6020" : "#bbb")
    : (ok ? "#3a6020" : rule.severity === "hard" ? "#a03030" : "#a05020");
  return (
    <div style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--color-border)" }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, marginTop: 4, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--color-foreground)" }}>
          {rule.label}
          <span style={{ fontWeight: 400, color: "#999", marginLeft: 6, textTransform: "uppercase", fontSize: 8.5, letterSpacing: "0.4px" }}>
            {rule.severity}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "#888", lineHeight: 1.5, marginTop: 2 }}>{rule.detail}</div>
      </div>
    </div>
  );
}

function ElectionWindowCard({ result, defaultOpen, testerId, categoryLabel }: { result: ElectionResult; defaultOpen: boolean; testerId: string | null; categoryLabel: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const failedHard = result.rules.filter((r) => r.severity === "hard" && !r.passed);
  const qc = useQueryClient();
  const [added, setAdded] = useState(false);

  // Putting a chosen window on the calendar is a plain manual schedule (free) —
  // it writes a planning window at that time so Launch stops dead-ending.
  const addToCalendar = useMutation({
    mutationFn: async () => {
      await fetch("/api/planning/windows", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) },
        body: JSON.stringify({
          title: categoryLabel,
          windowType: "launch",
          startTime: result.windowStart,
          endTime: result.windowEnd,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["windows"] });
      qc.invalidateQueries({ queryKey: ["planning-windows-all"] });
      setAdded(true);
    },
  });

  return (
    <div style={{
      border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-card)",
      marginBottom: 10, overflow: "hidden",
    }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        width: "100%", textAlign: "left", padding: "12px 14px", border: "none", cursor: "pointer",
        background: "none", display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          fontSize: 9.5, fontWeight: 700, padding: "3px 9px", borderRadius: 20, letterSpacing: "0.3px",
          color: VERDICT_COLORS[result.verdict], background: VERDICT_BG[result.verdict], flexShrink: 0,
        }}>{VERDICT_LABELS[result.verdict]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-foreground)" }}>
            {fmtRange(result.windowStart, result.windowEnd)}
          </div>
          <div style={{ fontSize: 10.5, color: "#999", marginTop: 1 }}>
            {PLANET_ICONS[result.planetaryHour] ?? ""} {result.planetaryHour} hour{result.planetaryHourMatch ? " · matches this venture" : ""}
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#bbb" }}>{open ? "▲" : "▼"}</div>
      </button>
      <div style={{ padding: "0 14px 10px" }}>
        <div style={{ fontSize: 11.5, color: "#666", lineHeight: 1.5, marginBottom: 8 }}>{result.summary}</div>
        {open && (
          <div style={{ marginTop: 4, marginBottom: 8 }}>
            {result.rules.map((r) => <RuleRow key={r.key} rule={r} />)}
          </div>
        )}
        {result.verdict !== "avoid" && (
          added ? (
            <div style={{ fontSize: 11, color: "#3a6020", fontWeight: 600 }}>✓ Added to your calendar (Ahead)</div>
          ) : (
            <button onClick={() => addToCalendar.mutate()} disabled={addToCalendar.isPending} style={{
              fontSize: 11, fontWeight: 600, padding: "6px 13px", borderRadius: 8, cursor: "pointer",
              border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-primary)",
            }}>{addToCalendar.isPending ? "Adding…" : "＋ Put it on my calendar"}</button>
          )
        )}
      </div>
      {failedHard.length > 0 && !open && (
        <div style={{ padding: "0 14px 10px", fontSize: 10.5, color: "#a03030" }}>
          {failedHard.map((r) => r.label).join(", ")}
        </div>
      )}
    </div>
  );
}

export default function Launch({ testerId, lat, lon }: { testerId: string | null; lat: number; lon: number }) {
  const [category, setCategory] = useState<string | null>(null);
  const [days, setDays] = useState(14);
  const { data: catData } = useElectionCategories();
  const { data: scan, isLoading } = useElectionScan(category, days, lat, lon);
  const categories = catData?.categories ?? [];
  const activeCategory = categories.find((c) => c.key === category);

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "24px 28px 60px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* The Planner leads — "when should I do all of this?" */}
        <Planner testerId={testerId} lat={lat} lon={lon} />

        <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 22 }} />

        {/* Electional — "when should I BEGIN one specific venture?" */}
        <div style={{ marginBottom: 4, fontSize: 20, fontWeight: 700, color: "var(--color-primary)", letterSpacing: "-0.3px" }}>
          Begin something
        </div>
        <div style={{ fontSize: 12.5, color: "#888", lineHeight: 1.6, marginBottom: 22 }}>
          When's a good moment to begin something? The sky's timing describes the shape and early tempo of a
          beginning — not a guaranteed outcome. Perfect windows are rare; this shows the best available one honestly.
        </div>

        {/* Category picker */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
          {categories.map((c) => (
            <button key={c.key} onClick={() => setCategory(c.key)} style={{
              textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
              border: category === c.key ? "1.5px solid #1a2a3a" : "1px solid var(--color-border)",
              background: category === c.key ? "#1a2a3a10" : "var(--color-card)",
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: category === c.key ? "#1a2a3a" : "var(--color-foreground)" }}>
                {c.label}
              </div>
              <div style={{ fontSize: 10, color: "#999", marginTop: 2, lineHeight: 1.4 }}>{c.description}</div>
            </button>
          ))}
        </div>

        {category && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 11, color: "#999" }}>Scan next</span>
              {[7, 14, 30].map((d) => (
                <button key={d} onClick={() => setDays(d)} style={{
                  padding: "5px 12px", borderRadius: 8, fontSize: 11, cursor: "pointer",
                  border: days === d ? "1.5px solid #1a2a3a" : "1px solid var(--color-border)",
                  background: days === d ? "#1a2a3a10" : "var(--color-card)",
                  color: days === d ? "#1a2a3a" : "#888", fontWeight: days === d ? 600 : 400,
                }}>{d} days</button>
              ))}
            </div>

            {isLoading && <div style={{ fontSize: 12, color: "#999" }}>Scanning the sky…</div>}

            {scan?.hardBlock && (
              <div style={{
                padding: "12px 14px", borderRadius: 10, background: "#f8e4e0", border: "1px solid #e0c0b8",
                marginBottom: 16, fontSize: 12, color: "#8a3020", lineHeight: 1.55,
              }}>
                Mercury is retrograde right now — classically avoided for {activeCategory?.label.toLowerCase()},
                regardless of how the Moon looks. {scan.hardBlock.clearsOn
                  ? `The nearest genuinely clear window opens after Mercury turns direct on ${new Date(scan.hardBlock.clearsOn).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`
                  : "It doesn't clear within this scan range — try a longer window."}
              </div>
            )}

            {scan && scan.windows.length === 0 && !isLoading && (
              <div style={{ fontSize: 12, color: "#999" }}>No windows found in this range.</div>
            )}

            {scan?.windows.map((w, i) => (
              <ElectionWindowCard key={w.date} result={w} defaultOpen={i === 0 && activeCategory?.weight !== "light"}
                testerId={testerId} categoryLabel={activeCategory?.label ?? "Launch"} />
            ))}
          </>
        )}

        <div style={{ marginTop: 24, fontSize: 10, color: "#bbb", lineHeight: 1.6, borderTop: "1px solid var(--color-border)", paddingTop: 14 }}>
          A v1 ruleset — sources disagree on some secondary rules, and this takes reasonable, commonly-cited
          positions. Health, surgical, and medical timing decisions are out of scope everywhere in this app.
        </div>
      </div>
    </div>
  );
}
