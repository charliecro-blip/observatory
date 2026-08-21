/**
 * BearingsCard — "where you are in time", at the top of Aims.
 *
 * You steer from where you are: the profection year (theme + lord + the
 * year's power days), and the chapter (Saturn stage + next waypoint + the
 * renovations in progress). Dated landmarks, not analysis — a trail map's
 * "you are here", not a reading.
 */
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PLANET_GLYPH } from "@/lib/glyphs";
import { useCurrents } from "@/hooks/useTides";
import { HOUSE_MEANINGS } from "@/lib/currents-content";
import { PLANET_LITERACY } from "@/lib/sky-literacy";
import { jsonArray } from "@/lib/jsonArray";

interface StarLite {
  id: number; title: string; status?: string; planet?: string | null;
  anchorKind?: string | null; anchorPlanet?: string | null; anchorHouse?: number | null;
}
interface TaskLite { id: number; title: string; done: string | null; planet?: string | null }

/**
 * "What is this?" — the mechanism behind a phrase, on request.
 *
 * DESIGN.md §17.3: a concept is explained where it is introduced, one tap
 * away, and never as a caption nobody asked for. Closed, it is a single
 * quiet mark; open, it is the plain account the engine shipped with the
 * number.
 */
function Explain({ text, open, onToggle }: { text?: string; open: boolean; onToggle: () => void }) {
  if (!text) return null;
  return (
    <>
      <button onClick={onToggle} aria-expanded={open}
        title={open ? "Hide" : "What does this mean?"}
        style={{
          background: "none", border: "none", padding: "0 3px", cursor: "pointer",
          color: open ? "var(--color-primary)" : "var(--text-3)", fontSize: 10.5, lineHeight: 1,
        }}>{open ? "✕" : "?"}</button>
      {open && (
        <div style={{
          fontSize: 11, color: "var(--color-muted)", lineHeight: 1.6, marginTop: 4,
          paddingLeft: 9, borderLeft: "2px solid var(--color-border)",
        }}>{text}</div>
      )}
    </>
  );
}

interface Activation { date: string; label: string }
interface Fix {
  year: {
    age: number; house: number; sign: string; lord: string; theme: string;
    yearEnd: string; monthHouse: number; monthTheme: string;
    lordActivations: Activation[];
    explain?: string;
  };
  chapter: {
    saturnStage: string;
    nextWaypoint: { name: string; date: string } | null;
    renovations: { line: string; note: string }[];
    explain?: string;
  };
}

/** "an 8th-house year" but "a 3rd-house year" — the article follows the
 *  ordinal's SOUND, and this line printed "an" unconditionally. */
const LINK: React.CSSProperties = {
  background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer",
  color: "var(--color-primary)", textDecoration: "underline", textUnderlineOffset: 2,
};
const artFor = (n: number) => (n === 8 || n === 11 || n === 18) ? "an" : "a";
const ord = (n: number) => `${n}${["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) === n % 10 && n % 10 < 4 ? n % 10 : 0] ?? "th"}`;
const fmtDate = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fmtMonthYear = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

export default function BearingsCard({ testerId, onOpenSettings, expanded = false, onNavigate }: {
  testerId: string | null;
  onOpenSettings?: () => void;
  /** The full room (its own Stars tab, 2026-08-21): each bearing opens into
   *  what it means and what of yours is riding it — stars anchored to the
   *  year or a chapter, stars and tasks that speak the planet. */
  expanded?: boolean;
  onNavigate?: (tab: "overview" | "tasks" | "habits") => void;
}) {
  const { data } = useQuery<{ available: boolean; reason?: string; fix?: Fix }>({
    queryKey: ["position-fix", testerId],
    queryFn: async () => {
      const r = await fetch("/api/position-fix", { headers: testerId ? { "x-tester-id": testerId } : {} });
      return r.json();
    },
    enabled: !!testerId,
    staleTime: 6 * 3600 * 1000, // bearings change daily at most
  });
  // ABOVE the early returns. Placed below them, this hook only ran on the
  // renders that got past "no chart yet", so the hook count changed between
  // renders and React threw "Rendered more hooks than during the previous
  // render" — the whole Stars page replaced by an error card. The same
  // violation this project hit once before in the app Shell; the rule is
  // that every hook precedes every conditional return, without exception.
  const [open, setOpen] = useState<"year" | "chapter" | null>(null);
  // Which slow transit has its meaning unfolded. Above the early returns for
  // the same reason as `open` — hooks precede every conditional return.
  const [openTransit, setOpenTransit] = useState<number | null>(null);
  // THE LONG CYCLES, from the engine that outlived its page. /api/currents
  // still computes profections, which slow planet sits in which natal house
  // and when it leaves, the real aspects those planets are making, and the
  // person's own caution planets — and since the Currents page was merged
  // away in 2026-08 almost none of it has been rendered anywhere. The data
  // never stopped being computed; it just stopped being shown.
  const { data: currents } = useCurrents(testerId, "whole-sign");
  // What of yours is riding these cycles. Same keys as Home and the hub, so
  // these are cache reads on a warm app, and always above the early returns.
  const { data: stars } = useQuery<StarLite[]>({
    queryKey: ["north-stars", testerId],
    queryFn: async () => jsonArray<StarLite>(await fetch("/api/planning/north-stars", { headers: testerId ? { "x-tester-id": testerId } : {} })),
    enabled: !!testerId && expanded,
  });
  const { data: tasks } = useQuery<TaskLite[]>({
    queryKey: ["tasks", "all"],
    queryFn: async () => jsonArray<TaskLite>(await fetch("/api/tasks", { headers: testerId ? { "x-tester-id": testerId } : {} })),
    enabled: !!testerId && expanded,
  });
  const [openChapter, setOpenChapter] = useState<string | null>(null);

  if (!testerId || !data) return null;
  if (!data.available) {
    if (data.reason === "no-chart") return (
      // Told people where to go and gave them no way to get there. A prompt
      // whose whole job is to send you somewhere should be the thing that
      // takes you.
      <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "10px 16px", marginBottom: 14, fontSize: 11.5, color: "var(--text-3)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ flex: 1, minWidth: 220 }}>
          Add your birth chart and this page opens with your bearings — the year you're in, its lord, and the chapter's landmarks.
        </span>
        {onOpenSettings && (
          <button onClick={onOpenSettings} style={{
            fontSize: 11, fontWeight: 600, padding: "5px 13px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap",
            border: "1px solid var(--color-border)", background: "var(--color-card-2)", color: "var(--color-primary)",
          }}>Add it in Settings →</button>
        )}
      </div>
    );
    return null; // no birth time: profections would be a guess — stay quiet
  }
  const fix = data.fix!;
  const nextHit = fix.year.lordActivations[0];

  return (
    <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "14px 18px 12px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 9 }}>
        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "1.2px", color: "var(--text-3)", fontWeight: 600 }}>Your bearings</span>
        <span style={{ fontSize: 10, color: "var(--color-muted)" }}>year turns {fmtDate(fix.year.yearEnd)}</span>
      </div>

      {/* THIS YEAR */}
      <div style={{ display: "flex", gap: 9, alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 9.5, letterSpacing: "0.8px", color: "var(--color-muted)", flexShrink: 0, width: 76 }}>THIS YEAR</span>
        <div style={{ fontSize: 12.5, color: "var(--color-foreground)", lineHeight: 1.55 }}>
          {artFor(fix.year.house)} {ord(fix.year.house)}-house year — <b>{fix.year.theme.split(" — ")[0]}</b>
          <span style={{ color: "var(--color-muted)" }}> · {PLANET_GLYPH[fix.year.lord] ?? ""} {fix.year.lord} holds the year</span>
          {nextHit && (
            <span style={{ color: "#8a6a30" }}> · next power day {fmtDate(nextHit.date)} ({nextHit.label})</span>
          )}
          <Explain text={fix.year.explain} open={open === "year"} onToggle={() => setOpen(open === "year" ? null : "year")} />
          {expanded && (() => {
            const live = (stars ?? []).filter(s => s.status !== "done" && s.status !== "paused");
            const riding = live.filter(s => s.anchorKind === "profection" && s.anchorHouse === fix.year.house);
            const hm = HOUSE_MEANINGS[fix.year.house];
            const lord = PLANET_LITERACY[fix.year.lord];
            return (
              <div style={{ marginTop: 7, paddingTop: 7, borderTop: "1px dashed var(--color-border)", fontSize: 11.5, lineHeight: 1.6, color: "var(--text-2)" }}>
                {hm && <div><b style={{ color: "var(--color-foreground)" }}>{hm.title}</b> — {hm.domains}.</div>}
                {lord?.longArc && <div style={{ color: "var(--color-muted)" }}>{lord.longArc}</div>}
                <div style={{ marginTop: 4 }}>
                  {riding.length > 0
                    ? <>Riding this year: {riding.map(s => <span key={s.id}>★ {s.title} </span>)}</>
                    : <>No star is set on this year yet.{onNavigate && <> <button onClick={() => onNavigate("overview")} style={LINK}>Set one on it →</button></>}</>}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* THE ARC — Saturn's ~29-year lap.
          It was labelled "THE CHAPTER", and a Guiding Star's anchor of kind
          "chapter" means something else entirely: one outer planet crossing
          one natal house ("rides Pluto through your 7th"). Two unrelated
          ideas under one word on adjacent surfaces, which is why the owner
          kept finding it confusing (2026-08-20). "Chapter" now belongs to
          the house transit — the meaning already user-facing in two places —
          and Saturn's lap is an arc, which is what it is. */}
      <div style={{ display: "flex", gap: 9, alignItems: "baseline", marginBottom: fix.chapter.renovations.length ? 6 : 0 }}>
        <span style={{ fontSize: 9.5, letterSpacing: "0.8px", color: "var(--color-muted)", flexShrink: 0, width: 76 }}>THE ARC</span>
        <div style={{ fontSize: 12.5, color: "var(--color-foreground)", lineHeight: 1.55 }}>
          {fix.chapter.saturnStage}
          {fix.chapter.nextWaypoint && (
            <span style={{ color: "var(--color-muted)" }}> · next waypoint: {fix.chapter.nextWaypoint.name}, {fmtMonthYear(fix.chapter.nextWaypoint.date)}</span>
          )}
          <Explain text={fix.chapter.explain} open={open === "chapter"} onToggle={() => setOpen(open === "chapter" ? null : "chapter")} />
        </div>
      </div>

      {/* RENOVATIONS */}
      {fix.chapter.renovations.length > 0 && (
        <div style={{ display: "flex", gap: 9, alignItems: "baseline" }}>
          <span style={{ fontSize: 9.5, letterSpacing: "0.8px", color: "var(--color-muted)", flexShrink: 0, width: 76 }}>IN PROGRESS</span>
          {/* Each transit opens its own meaning. These carried a `note` the
              engine had already written and showed it only as a hover title —
              invisible on a phone, and undiscoverable anywhere. "Each of
              these astrological aspects should have options to explore more"
              (owner, 2026-08-13) applies to this row as much as to the two
              above it. */}
          <div style={{ fontSize: 11.5, color: "var(--text-2)", lineHeight: 1.6 }}>
            {fix.chapter.renovations.map((r, i) => (
              <span key={i}>
                <button onClick={() => setOpenTransit(openTransit === i ? null : i)}
                  aria-expanded={openTransit === i}
                  style={{
                    background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer",
                    color: openTransit === i ? "var(--color-primary)" : "var(--text-2)",
                    textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3,
                  }}>{r.line}</button>
                {i < fix.chapter.renovations.length - 1 ? " · " : ""}
              </span>
            ))}
            {openTransit != null && fix.chapter.renovations[openTransit] && (
              <div style={{
                fontSize: 11, color: "var(--color-muted)", lineHeight: 1.6, marginTop: 5,
                paddingLeft: 9, borderLeft: "2px solid var(--color-border)",
              }}>{fix.chapter.renovations[openTransit].note}</div>
            )}
          </div>
        </div>
      )}

      {/* ── THE CHAPTERS — which slow planet is crossing which of your houses,
             and when it leaves. This is what a Guiding Star means when it says
             it "rides Pluto through your 7th", and until now the only place
             you could see the list was the anchor picker inside the star
             creation form. The engine has computed it all along. */}
      {(currents?.transitsByHouse?.length ?? 0) > 0 && (
        <div style={{ display: "flex", gap: 9, alignItems: "baseline", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--color-border)" }}>
          <span style={{ fontSize: 9.5, letterSpacing: "0.8px", color: "var(--color-muted)", flexShrink: 0, width: 76 }}>CHAPTERS</span>
          <div style={{ fontSize: 12, color: "var(--color-foreground)", lineHeight: 1.7, minWidth: 0 }}>
            {(currents!.transitsByHouse as any[]).map((t: any, i: number) => {
              const key = `${t.planet}:${t.house}`;
              const isOpen = expanded && openChapter === key;
              const line = (
                <>
                  {PLANET_GLYPH[t.planet] ?? ""} {t.planet} through your {ord(t.house)}
                  {HOUSE_MEANINGS[t.house] && (
                    <span style={{ color: "var(--color-muted)" }}> — {HOUSE_MEANINGS[t.house].domains}</span>
                  )}
                  {t.leavesHouse && (
                    <span style={{ color: "var(--text-3)" }}> · until {fmtMonthYear(String(t.leavesHouse).slice(0, 10))}</span>
                  )}
                  {t.retrograde && <span style={{ color: "var(--text-3)" }}> · retrograde</span>}
                </>
              );
              if (!expanded) return <div key={key}>{line}</div>;
              const live = (stars ?? []).filter(s => s.status !== "done" && s.status !== "paused");
              const riding = live.filter(s => s.anchorKind === "chapter" && s.anchorPlanet === t.planet && s.anchorHouse === t.house);
              const speaks = live.filter(s => s.planet === t.planet && !riding.some(r => r.id === s.id));
              const openTasks = (tasks ?? []).filter(x => x.done !== "true" && x.planet === t.planet);
              const lit = PLANET_LITERACY[t.planet];
              const hm = HOUSE_MEANINGS[t.house];
              return (
                <div key={key}>
                  <button onClick={() => setOpenChapter(isOpen ? null : key)} aria-expanded={isOpen} style={{
                    background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer", textAlign: "left",
                    color: isOpen ? "var(--color-primary)" : "inherit",
                  }}>
                    <span style={{ fontSize: 10, marginRight: 5, display: "inline-block", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 120ms" }}>▸</span>
                    {line}
                  </button>
                  {isOpen && (
                    <div style={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--text-2)", margin: "4px 0 8px 15px", paddingLeft: 9, borderLeft: "2px solid var(--color-border)" }}>
                      {hm && <div><b style={{ color: "var(--color-foreground)" }}>{hm.title}</b> — the {ord(t.house)} house holds {hm.domains}.</div>}
                      {lit?.longArc && <div style={{ color: "var(--color-muted)" }}>{lit.longArc}</div>}
                      <div style={{ marginTop: 4 }}>
                        {riding.length > 0
                          ? <>Riding this chapter: {riding.map(s => <span key={s.id}>★ {s.title} </span>)}</>
                          : <>No star is set on this chapter yet.{onNavigate && <> <button onClick={() => onNavigate("overview")} style={LINK}>Set one on it →</button></>}</>}
                      </div>
                      {(speaks.length > 0 || openTasks.length > 0) && (
                        <div style={{ marginTop: 2 }}>
                          Stars and tasks tuned to {t.planet}:{" "}
                          {speaks.map(s => <span key={`s${s.id}`}>★ {s.title} · </span>)}
                          {openTasks.slice(0, 5).map(x => <span key={`t${x.id}`}>{x.title} · </span>)}
                          {openTasks.length > 5 && <span>and {openTasks.length - 5} more</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── WHAT'S CLOSE — the actual aspects the slow planets are making, with
             their orbs. "In progress" above names the renovation; this says how
             close it is, which is the difference between a thing building and a
             thing happening this week. An orb is a measurement, never a
             forecast. */}
      {(currents?.majorTransits?.length ?? 0) > 0 && (
        <div style={{ display: "flex", gap: 9, alignItems: "baseline", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--color-border)" }}>
          <span style={{ fontSize: 9.5, letterSpacing: "0.8px", color: "var(--color-muted)", flexShrink: 0, width: 76 }}>CLOSE NOW</span>
          <div style={{ fontSize: 12, color: "var(--color-foreground)", lineHeight: 1.7, minWidth: 0 }}>
            {(currents!.majorTransits as any[])
              // IN PROGRESS above names the same renovations, from a second
              // computation of the same sky. Repeating them here made one
              // fact look like two — so this shows only what that row has
              // not already said, and adds the orb, which is the thing it
              // could not.
              .filter((t: any) => !fix.chapter.renovations.some(r =>
                r.line.includes(t.transitPlanet) && r.line.includes(t.natalPlanet)))
              .slice(0, 4).map((t: any, i: number) => (
              <div key={i}>
                {PLANET_GLYPH[t.transitPlanet] ?? ""} {t.transitPlanet} {String(t.aspect).toLowerCase()} your {t.natalPlanet}
                <span style={{ color: "var(--text-3)" }}>
                  {t.exact ? " · exact now" : ` · ${t.orb}° off`}
                  {t.natalHouse ? ` · ${ord(t.natalHouse)} house` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── YOUR OWN WEATHER. The planets this person said hit them hardest,
             and when those planets are lit. It is the one part of this card
             they wrote themselves, so it renders only once they have actually
             answered — never as an empty prompt. */}
      {(currents?.cautionWindows?.length ?? 0) > 0 && (
        <div style={{ display: "flex", gap: 9, alignItems: "baseline", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--color-border)" }}>
          <span style={{ fontSize: 9.5, letterSpacing: "0.8px", color: "var(--color-muted)", flexShrink: 0, width: 76 }}>WATCH</span>
          <div style={{ fontSize: 12, color: "var(--color-foreground)", lineHeight: 1.7, minWidth: 0 }}>
            {(currents!.cautionWindows as any[]).slice(0, 3).map((w: any, i: number) => (
              <div key={i}>
                {PLANET_GLYPH[w.transitPlanet] ?? ""} {w.transitPlanet} {String(w.aspect ?? "").toLowerCase()} your {w.natalPlanet}
                <span style={{ color: "var(--text-3)" }}> · you flagged this one</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
