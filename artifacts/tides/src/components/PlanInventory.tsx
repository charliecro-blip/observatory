/**
 * THE SCHEDULE ROOM — one question, then what you're holding.
 *
 * Before this (workshop 2026-08-21) the room rendered seven open tasks as the
 * sentence "You're holding 7 things already" and offered a paste box for work
 * not yet captured: a front door built for the first session and met by the
 * hundredth. The inventory the app already had could not be placed from here
 * at all.
 *
 * Now: the question and the week's real conditions, then every open task with
 * the kind of work it is and the hour that suits it. Pressing "Spread them"
 * runs the week weave, which was a text link under an empty state.
 */
import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTester } from "@/contexts/tester-context";
import { localToday } from "@/lib/dates";

interface Win {
  date: string; dow: string; startAt: string; endAt: string;
  startClock: string; endClock: string; allDay: boolean; tier: string; why: string;
}
interface Held {
  id: number; title: string; dueDate: string | null; estMinutes: number | null; goalId: number | null;
  activityKey: string | null; activityLabel: string | null; inferredKind?: boolean;
  kindOptions?: { key: string; label: string }[];
  state: "placeable" | "needs-duration" | "needs-kind" | "scheduled";
  window?: Win | null; unscanned?: boolean;
}
interface Inventory {
  holding: Held[];
  week: { days: number; voidDays: string[]; eclipse: { kind: string; date: string; daysAway: number } | null };
}

const DURATIONS = [15, 30, 60, 90];
const fmtDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });

export default function PlanInventory({ testerId, lat, lon, onSpread, spreading, onPaste }: {
  testerId: string | null; lat: number; lon: number;
  onSpread: () => void; spreading: boolean; onPaste: () => void;
}) {
  const qc = useQueryClient();
  const { locationKnown } = useTester();
  const tz = new Date().getTimezoneOffset();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const H = { "Content-Type": "application/json", ...(testerId ? { "x-tester-id": testerId } : {}) };

  const { data, isPending, isError } = useQuery<Inventory>({
    // Everything the answer depends on is in the key — the lesson this repo
    // has paid for more than once.
    queryKey: ["plan-inventory", testerId, lat.toFixed(2), lon.toFixed(2), tz, zone, locationKnown],
    queryFn: async () => (await fetch(
      `/api/plan/inventory?lat=${lat}&lon=${lon}&tz=${tz}&timeZone=${encodeURIComponent(zone)}&locationKnown=${locationKnown}`,
      { headers: H },
    )).json(),
    enabled: !!testerId,
  });

  const setDuration = useMutation({
    mutationFn: async ({ id, minutes }: { id: number; minutes: number }) => {
      const r = await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: H, body: JSON.stringify({ estMinutes: minutes }) });
      if (!r.ok) throw new Error(String(r.status));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan-inventory"] }),
  });
  const setKind = useMutation({
    mutationFn: async ({ id, activityKey }: { id: number; activityKey: string }) => {
      const r = await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: H, body: JSON.stringify({ activityKey }) });
      if (!r.ok) throw new Error(String(r.status));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan-inventory"] }),
  });
  const place = useMutation({
    mutationFn: async ({ t }: { t: Held }) => {
      const w = t.window!;
      const r = await fetch("/api/planning/windows", {
        method: "POST", headers: H,
        body: JSON.stringify({
          title: t.title, windowType: "deep_work",
          startTime: w.startAt, endTime: w.endAt, taskId: t.id, goalId: t.goalId ?? undefined,
        }),
      });
      if (!r.ok) throw new Error(String(r.status));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plan-inventory"] });
      qc.invalidateQueries({ queryKey: ["already-woven"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const holding = (data?.holding ?? []).filter(t => t.state !== "scheduled");
  const n = holding.length;
  const week = data?.week;

  // The week's own conditions, stated before anything is offered.
  const conditions = (() => {
    if (!week) return null;
    const bits: string[] = [];
    if (week.voidDays.length) bits.push(`${week.voidDays.length} of the next ${week.days} days carry a void`);
    if (week.eclipse) {
      bits.push(week.eclipse.daysAway === 0
        ? `a ${week.eclipse.kind} eclipse falls today`
        : `a ${week.eclipse.kind} eclipse falls ${week.eclipse.daysAway === 1 ? "tomorrow" : `in ${week.eclipse.daysAway} days`}`);
    }
    if (!bits.length) return "Nothing unusual in the week ahead.";
    return `${bits.join(", and ")} — the week gets read before anything is placed.`;
  })();

  return (
    <div>
      {/* ── THE QUESTION ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 15.5, fontWeight: 600, color: "var(--color-foreground)" }}>
          {isPending ? "Reading your list…" : n === 0 ? "Nothing on the list yet." : `You're holding ${n} thing${n === 1 ? "" : "s"}.`}
        </div>
        {n > 0 && (
          <div style={{ fontSize: 13, color: "var(--color-muted)", marginTop: 2 }}>
            Shall I spread them across this week?
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        {n > 0 && (
          <button onClick={onSpread} disabled={spreading} style={{
            fontSize: 12.5, fontWeight: 600, padding: "8px 17px", borderRadius: 9,
            border: "none", background: "#1a2a3a", color: "#fff", cursor: spreading ? "default" : "pointer",
          }}>{spreading ? "Working…" : "Spread them →"}</button>
        )}
        <button onClick={onPaste} style={{
          fontSize: 12, background: "none", border: "none", padding: 0,
          cursor: "pointer", color: "var(--color-primary)",
        }}>{n === 0 ? "Paste a list →" : "Paste a new list →"}</button>
      </div>
      {conditions && (
        <div style={{ fontSize: 11.5, color: "var(--text-3)", marginTop: 10, lineHeight: 1.55 }}>{conditions}</div>
      )}

      {isError && (
        <div style={{ fontSize: 12, color: "#a03030", marginTop: 14 }}>
          Your list didn't load. It's intact; it's the connection.
        </div>
      )}

      {/* ── WHAT YOU'RE HOLDING ──────────────────────────────────────── */}
      {holding.length > 0 && (
        <div style={{ marginTop: 18, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.9px", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 6 }}>
            Holding · {holding.length}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {holding.map(t => (
              <div key={t.id} style={{
                display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap",
                padding: "7px 0", borderTop: "1px solid var(--color-border)",
              }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <span style={{ fontSize: 13, color: "var(--color-foreground)" }}>{t.title}</span>
                  <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>
                    {t.dueDate && t.dueDate < localToday() ? " · past its date"
                      : t.dueDate === localToday() ? " · due today"
                      : t.dueDate ? " · due " + fmtDay(t.dueDate) : ""}
                    {t.activityLabel ? ` · ${t.activityLabel.toLowerCase()}${t.inferredKind ? "?" : ""}` : ""}
                    {t.estMinutes ? ` · ${t.estMinutes}m` : ""}
                  </span>
                </div>
                {t.state === "needs-kind" && (
                  (t.kindOptions ?? []).length > 0 ? (
                    <span style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>what kind?</span>
                      {t.kindOptions!.map(o => (
                        <button key={o.key} onClick={() => setKind.mutate({ id: t.id, activityKey: o.key })} disabled={setKind.isPending}
                          style={{
                            fontSize: 10, padding: "2px 8px", borderRadius: 999, cursor: "pointer",
                            border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-foreground)",
                          }}>{o.label}</button>
                      ))}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>no kind of work fits this yet</span>
                  )
                )}
                {t.state === "needs-duration" && (
                  <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <span style={{ fontSize: 10.5, color: "var(--text-3)" }}>how long?</span>
                    {DURATIONS.map(m => (
                      <button key={m} onClick={() => setDuration.mutate({ id: t.id, minutes: m })} disabled={setDuration.isPending}
                        style={{
                          fontSize: 10, padding: "2px 8px", borderRadius: 999, cursor: "pointer",
                          border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-foreground)",
                        }}>{m < 60 ? `${m}m` : `${m / 60}h`}</button>
                    ))}
                  </span>
                )}
                {t.state === "placeable" && t.window && (
                  <span style={{ display: "flex", gap: 9, alignItems: "baseline" }}>
                    <span title={t.window.why} style={{ fontSize: 11.5, color: "var(--color-muted)", fontVariantNumeric: "tabular-nums", cursor: "help" }}>
                      {t.window.dow} {t.window.allDay ? "all day" : t.window.startClock}
                    </span>
                    <button onClick={() => place.mutate({ t })} disabled={place.isPending} style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 11px", borderRadius: 8, cursor: "pointer",
                      border: "1px solid var(--color-border)", background: "var(--color-card)", color: "var(--color-primary)",
                    }}>place →</button>
                  </span>
                )}
                {t.state === "placeable" && !t.window && (
                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                    {t.unscanned ? "not read yet — spread the week to place it" : "no window this week suits it"}
                  </span>
                )}
              </div>
            ))}
          </div>
          {place.isError && (
            <div style={{ fontSize: 11, color: "#a03030", marginTop: 6 }}>That didn't go on the calendar. Try it again.</div>
          )}
        </div>
      )}
    </div>
  );
}
