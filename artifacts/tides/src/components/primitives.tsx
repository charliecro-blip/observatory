/**
 * THE SHARED VISUAL GRAMMAR (beta visual pass, 2026-08-24).
 *
 * Six pages had six private vocabularies for the same handful of ideas: a warm
 * card, a 1px border, an uppercase 9–10px label, a pale nested rectangle, a
 * chip, a disclosure, another border. Tasks alone drew fourteen borders and
 * twenty-nine corner radii; Calendar drew thirty-one and fifty-six. None of
 * that variation carried meaning — it was the same few thoughts, re-typed.
 *
 * ONE RULE DECIDES WHETHER SOMETHING GETS A RECTANGLE:
 *
 *     A border means THIS OBJECT CAN BE ACTED ON.
 *     It does not mean "this is a section".
 *
 * Everything that exists only to group content sits directly on the page,
 * under a label. That single distinction removes most of the chrome, because
 * most rectangles in this app were section containers wearing an object's
 * clothes — and it makes the remaining ones legible: if it is boxed, there is
 * something to do to it.
 *
 * Deliberately small. This is not a design system; it is the seven things the
 * daily-driver pages actually need, extracted while doing the beta pass rather
 * than designed ahead of it.
 */
import React from "react";

/* ── tokens ──────────────────────────────────────────────────────────────── */

const LABEL: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-3)",
};

/* ── PageLead ────────────────────────────────────────────────────────────── */

/**
 * The human-scale question a page answers, at the top of it, on open canvas.
 *
 * Not a card. A page's own title inside a bordered box is the clearest case of
 * a rectangle that means nothing — there is nothing to act on, and the border
 * competes with the first real object below it.
 */
export function PageLead({ title, sub, action }: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--color-foreground)" }}>
          {title}
        </h1>
        {sub && (
          <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 3, lineHeight: 1.5, maxWidth: "58ch" }}>
            {sub}
          </div>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

/* ── OpenSection ─────────────────────────────────────────────────────────── */

/**
 * A group of things, on the page itself. A label and a hairline, no box.
 *
 * This is what replaces most of the cards. The label says what the group is;
 * the rule separates it from the last one; the content sits on the canvas
 * where the reader's eye already is.
 */
export function OpenSection({ label, note, children, first }: {
  label?: string;
  /** A count or a state, right-aligned against the label. */
  note?: React.ReactNode;
  children: React.ReactNode;
  /** Skips the top rule — for the first section under a PageLead. */
  first?: boolean;
}) {
  return (
    <section style={{
      marginTop: first ? 0 : 22,
      paddingTop: first ? 0 : 16,
      borderTop: first ? "none" : "1px solid var(--color-border)",
    }}>
      {label && (
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
          <span style={LABEL}>{label}</span>
          {note && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{note}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

/* ── ActionObject ────────────────────────────────────────────────────────── */

/**
 * The one thing that keeps its rectangle: a surface you can do something to.
 *
 * A star you can open, a proposed placement you can keep, a draft you can
 * send. If nothing happens when you touch it, it is an OpenSection.
 */
export function ActionObject({ children, onClick, accent, padded = true }: {
  children: React.ReactNode;
  onClick?: () => void;
  /** A left edge, when the object carries a state worth seeing at a glance. */
  accent?: string;
  padded?: boolean;
}) {
  const style: React.CSSProperties = {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderLeft: accent ? `3px solid ${accent}` : "1px solid var(--color-border)",
    borderRadius: 10,
    padding: padded ? "12px 14px" : 0,
    width: "100%",
    textAlign: "left",
    display: "block",
    cursor: onClick ? "pointer" : "default",
    color: "inherit",
    font: "inherit",
  };
  return onClick
    ? <button type="button" onClick={onClick} style={style}>{children}</button>
    : <div style={style}>{children}</div>;
}

/* ── Row ─────────────────────────────────────────────────────────────────── */

/**
 * One line of a list, with the same anatomy everywhere: a mark, a title, its
 * own quiet meta, and whatever acts on it at the end.
 *
 * A task, a habit, an event, a piece of evidence and a logged activity were
 * five different row shapes for one idea. The trailing slot stays empty until
 * hover or focus at the call site's discretion — permanent ↑↓ furniture on
 * every row is most of what makes a list look like a database.
 */
export function Row({ mark, title, meta, trailing, muted, onClick }: {
  mark?: React.ReactNode;
  title: React.ReactNode;
  /** Under the title. One line, the things that change what you'd do. */
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  muted?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "7px 0",
        borderTop: "1px solid var(--color-border)",
        cursor: onClick ? "pointer" : "default",
        opacity: muted ? 0.55 : 1,
      }}
    >
      {mark && <div style={{ flexShrink: 0, paddingTop: 1 }}>{mark}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--color-foreground)", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis" }}>
          {title}
        </div>
        {meta && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2, lineHeight: 1.4 }}>{meta}</div>}
      </div>
      {trailing && <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>{trailing}</div>}
    </div>
  );
}

/* ── Disclosure ──────────────────────────────────────────────────────────── */

/**
 * Simple → detailed, in one visual language.
 *
 * The app had several: a chevron that rotated, a "▸ more" link, a chip that
 * expanded, a section that folded. They all meant the same thing.
 */
export function Disclosure({ label, children, defaultOpen = false }: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "none", border: "none", padding: "3px 0", cursor: "pointer",
          fontSize: 11.5, color: "var(--color-primary)", fontWeight: 500,
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 10.5, display: "inline-block", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.12s" }}>▸</span>
        {label}
      </button>
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}

/* ── Notice ──────────────────────────────────────────────────────────────── */

/**
 * A temporary condition, an invitation, or a failure — one slot per page.
 *
 * `tone` is the only thing that varies, and it varies semantically: green is
 * reserved for something actually convergent, never for decoration.
 */
export function Notice({ tone = "info", children }: {
  tone?: "info" | "good" | "caution" | "problem";
  children: React.ReactNode;
}) {
  const color = {
    info: "var(--color-muted)",
    good: "var(--color-quality-good)",
    caution: "var(--color-quality-caution)",
    problem: "var(--color-quality-challenge)",
  }[tone];
  return (
    <div role={tone === "problem" ? "status" : undefined} style={{
      display: "flex", gap: 9, alignItems: "flex-start",
      borderLeft: `3px solid ${color}`,
      padding: "9px 12px", marginBottom: 14,
      background: "var(--color-card-2)",
      fontSize: 12, lineHeight: 1.5, color: "var(--text-2)",
    }}>
      {children}
    </div>
  );
}

/* ── PrimaryInvitation ───────────────────────────────────────────────────── */

/** The page's dominant verb. One per page, or it is not dominant. */
export function PrimaryInvitation({ children, onClick, disabled }: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: 12.5, fontWeight: 600, padding: "8px 16px", borderRadius: 8,
        border: "1px solid var(--color-foreground)",
        background: disabled ? "transparent" : "var(--color-foreground)",
        color: disabled ? "var(--text-3)" : "var(--color-card)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >{children}</button>
  );
}

/* ── Chip / ChipGroup ────────────────────────────────────────────────────── */

/**
 * A one-tap option, on or off.
 *
 * The app had roughly fifty of these, each re-typed: a fontSize between 9 and
 * 10.5, a padding between "1px 4px" and "3px 9px", a radius of 4, 6, 7, 10 or
 * 999, and a colour scheme invented per group. The variation was not meaning —
 * an element chip and a phase chip do the same job and looked different
 * because they were written on different days.
 *
 * `color` stays a per-call decision, because THAT part does carry meaning: an
 * element chip should wear its element. The geometry does not.
 */
export function Chip({ on, onClick, color, title, children }: {
  on?: boolean;
  onClick?: () => void;
  /** The group's own hue when selected. Defaults to the page's foreground. */
  color?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const hue = color ?? "var(--color-foreground)";
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={onClick ? !!on : undefined}
      style={{
        fontSize: 11, lineHeight: 1.3, padding: "4px 10px", borderRadius: 999,
        border: `1px solid ${on ? hue : "var(--color-border)"}`,
        background: on ? `color-mix(in srgb, ${hue} 12%, transparent)` : "transparent",
        color: on ? hue : "var(--text-3)",
        fontWeight: on ? 600 : 400,
        cursor: onClick ? "pointer" : "default",
      }}
    >{children}</button>
  );
}

/** A labelled row of chips. The label is the shared one, above the 9px floor. */
export function ChipGroup({ label, note, children }: {
  label: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
        <span style={LABEL}>{label}</span>
        {note && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{note}</span>}
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}
