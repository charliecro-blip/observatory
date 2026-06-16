import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Loader2, PenLine, Check } from "lucide-react";
import { useTester } from "@/contexts/tester-context";
import { todayStr, ELEMENT_DOT_CLS, ELEMENT_BADGE_CLS, ELEMENT_ICONS, ELEMENT_COLOR_CLS, type ElementKey } from "@/lib/elements";

// ── Helpers ───────────────────────────────────────────────────────────────────

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** 0=Sunday..6=Saturday. Returns first weekday of the month. */
function firstWeekdayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function canLogDate(dateStr: string): boolean {
  const today = todayStr();
  if (dateStr > today) return false;
  // Max 30 days in past (matching API rule)
  const d = new Date(dateStr + "T12:00:00");
  const limit = new Date();
  limit.setDate(limit.getDate() - 30);
  return d >= limit;
}

// ── Element/type colors ───────────────────────────────────────────────────────

const ELEMENT_DOT = ELEMENT_DOT_CLS;
const ELEMENT_BADGE = ELEMENT_BADGE_CLS;

const LOG_TYPE_BADGE: Record<string, string> = {
  supplement: "bg-chart-1/15 text-chart-1 border-chart-1/25",
  activity:   "bg-chart-2/15 text-chart-2 border-chart-2/25",
  symptom:    "bg-chart-3/15 text-chart-3 border-chart-3/25",
  mood:       "bg-chart-4/15 text-chart-4 border-chart-4/25",
  note:       "bg-muted/40 text-muted-foreground border-border/25",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface DayEntry { sessions: number; logs: number; element: string | null }
interface MonthData { month: string; days: Record<string, DayEntry> }

interface CheckIn {
  id: number;
  cultivationId: number;
  date: string;
  completed: boolean;
  note: string | null;
  durationMinutes: number | null;
  cultivationTitle: string;
  cultivationDomain: string;
  cultivationElement: string | null;
  cultivationElements: string[] | null;
}

interface HealthLog {
  id: number;
  loggedAt: string;
  type: string;
  notes: string | null;
  symptoms: string | null;
  mood: number | null;
  energyLevel: number | null;
  supplementName: string | null;
  activityName: string | null;
  dosageTaken: string | null;
  durationMinutes: number | null;
}

interface Rhythm {
  moonSign: string;
  moonPhase: string;
  moonFraction: number;
  sunSign: string;
  voidOfCourse: boolean;
  element: string;
}
interface DayDetail { date: string; checkins: CheckIn[]; logs: HealthLog[]; rhythm?: Rhythm }

// ── Component ─────────────────────────────────────────────────────────────────

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const { profile } = useTester();
  const testerId = profile?.testerId ?? null;

  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const headers = useCallback(
    () => ({ "x-tester-id": testerId ?? "" }),
    [testerId],
  );

  const month = monthKey(viewDate);

  const { data: monthData, isLoading: monthLoading } = useQuery<MonthData>({
    queryKey: ["calendar-month", testerId, month],
    queryFn: async () => {
      const res = await fetch(`/api/calendar?month=${month}`, { headers: headers() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!testerId,
  });

  const { data: dayDetail, isLoading: dayLoading } = useQuery<DayDetail>({
    queryKey: ["calendar-day", testerId, selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/calendar/${selectedDate}`, { headers: headers() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!testerId && !!selectedDate,
  });

  const prevMonth = () => {
    setSelectedDate(null);
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setSelectedDate(null);
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  const year = viewDate.getFullYear();
  const monthIdx = viewDate.getMonth();
  const totalDays = daysInMonth(year, monthIdx);
  const firstWeekday = firstWeekdayOfMonth(year, monthIdx);
  const today = todayStr();

  // Build grid cells: null for padding, number for day
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  function dayStr(day: number): string {
    return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto pb-20 flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-serif text-foreground tracking-tight">Calendar</h1>
        <p className="text-muted-foreground mt-1">Days the field was tended.</p>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-serif text-lg text-foreground">{formatMonthLabel(viewDate)}</span>
        <button
          onClick={nextMonth}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1">
        {DOW_LABELS.map((d) => (
          <div key={d} className="text-center text-xs text-muted-foreground/50 font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {monthLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`pad-${idx}`} />;
            }

            const ds = dayStr(day);
            const entry = monthData?.days[ds];
            const hasSessions = (entry?.sessions ?? 0) > 0;
            const hasLogs = (entry?.logs ?? 0) > 0;
            const isToday = ds === today;
            const isSelected = ds === selectedDate;
            const isFuture = ds > today;

            return (
              <button
                key={ds}
                onClick={() => setSelectedDate(isSelected ? null : ds)}
                disabled={isFuture}
                className={`
                  relative flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-all text-xs font-medium
                  ${isFuture ? "opacity-25 cursor-default" : "cursor-pointer hover:bg-muted/20"}
                  ${isSelected ? "bg-primary/15 border border-primary/40 ring-1 ring-primary/20" : "border border-transparent"}
                  ${isToday && !isSelected ? "border-border/50 bg-card/30" : ""}
                `}
              >
                <span className={`${isToday ? "text-primary font-semibold" : "text-foreground/70"}`}>
                  {day}
                </span>
                {/* Indicators */}
                <div className="flex gap-0.5 h-1.5 items-center">
                  {hasSessions && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full opacity-80 ${entry?.element ? ELEMENT_DOT[entry.element] : "bg-chart-2"}`}
                    />
                  )}
                  {hasLogs && (
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground/50">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 opacity-80" /> practice
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" /> observation
        </span>
        <span className="flex items-center gap-1.5 italic">dot color = dominant element</span>
      </div>

      {/* Day detail */}
      {selectedDate && (
        <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h2 className="font-serif text-base text-foreground">{formatDayLabel(selectedDate)}</h2>
              {dayDetail?.rhythm && (() => {
                const r = dayDetail.rhythm!;
                const elKey = (r.element ?? "water") as ElementKey;
                const ElIcon = ELEMENT_ICONS[elKey] as React.ElementType;
                const pct = Math.round(r.moonFraction * 100);
                const colorCls = ELEMENT_COLOR_CLS[elKey];
                return (
                  <p className={`text-xs mt-0.5 flex items-center gap-1.5 ${colorCls}`}>
                    <ElIcon className="w-3 h-3 flex-shrink-0" />
                    <span>
                      {r.moonPhase} in {r.moonSign}
                      {" · "}{pct}% illuminated
                      {r.voidOfCourse && " · void of course"}
                    </span>
                  </p>
                );
              })()}
              {dayDetail && !dayDetail.rhythm && (
                <p className="text-xs text-muted-foreground/50 mt-0.5">
                  {dayDetail.checkins.length + dayDetail.logs.length === 0
                    ? "Nothing recorded."
                    : `${dayDetail.checkins.length + dayDetail.logs.length} entr${dayDetail.checkins.length + dayDetail.logs.length === 1 ? "y" : "ies"}`}
                </p>
              )}
            </div>
            {canLogDate(selectedDate) && (
              <Link href={`/log?date=${selectedDate}`}>
                <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/50 transition-all">
                  <PenLine className="w-3 h-3" />
                  Log for this day
                </span>
              </Link>
            )}
          </div>

          {dayLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/40" />
            </div>
          ) : !dayDetail || (dayDetail.checkins.length === 0 && dayDetail.logs.length === 0) ? (
            <p className="text-sm text-muted-foreground/40 italic py-2">
              The field was still on this day.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Practice check-ins */}
              {dayDetail.checkins.map((ci) => {
                const el = (ci.cultivationElements?.[0]) ?? ci.cultivationElement ?? "earth";
                const dotCls = ELEMENT_DOT[el] ?? "bg-muted";
                const badgeCls = ELEMENT_BADGE[el] ?? "bg-muted/30 text-muted-foreground border-border/20";
                return (
                  <div
                    key={ci.id}
                    className="flex items-start gap-3 py-2.5 px-3 rounded-xl bg-chart-2/5 border border-chart-2/20"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${dotCls}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground/85">{ci.cultivationTitle}</span>
                        {ci.completed && (
                          <span className="flex items-center gap-0.5 text-[10px] text-chart-2/80">
                            <Check className="w-3 h-3" /> tended
                          </span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badgeCls}`}>
                          {ci.cultivationDomain.replace(/-/g, " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {ci.durationMinutes && (
                          <span className="text-xs text-muted-foreground/50">{ci.durationMinutes} min</span>
                        )}
                        {ci.note && (
                          <span className="text-xs text-muted-foreground/60 italic truncate">{ci.note}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Health logs */}
              {dayDetail.logs.map((log) => {
                const badgeCls = LOG_TYPE_BADGE[log.type] ?? LOG_TYPE_BADGE.note;
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 py-2.5 px-3 rounded-xl bg-muted/10 border border-border/20"
                  >
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium flex-shrink-0 mt-0.5 ${badgeCls}`}>
                      {log.type}
                    </span>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      {(log.supplementName || log.activityName) && (
                        <p className="text-sm font-medium text-foreground/85">{log.supplementName || log.activityName}</p>
                      )}
                      {log.dosageTaken && <p className="text-xs text-muted-foreground/60">{log.dosageTaken}</p>}
                      {log.mood && <p className="text-xs text-muted-foreground/60">mood {log.mood}/10</p>}
                      {log.energyLevel && <p className="text-xs text-muted-foreground/60">energy {log.energyLevel}/10</p>}
                      {log.symptoms && <p className="text-xs text-chart-3/70">{log.symptoms}</p>}
                      {log.notes && <p className="text-xs text-muted-foreground/70 leading-relaxed">{log.notes}</p>}
                      {log.durationMinutes && (
                        <p className="text-xs text-muted-foreground/50">{log.durationMinutes} min</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Hint when nothing selected */}
      {!selectedDate && !monthLoading && (
        <p className="text-center text-xs text-muted-foreground/35 italic">
          Tap a day to see what was recorded.
        </p>
      )}
    </div>
  );
}
