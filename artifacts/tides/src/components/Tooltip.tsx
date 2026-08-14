import React, { useState, useRef, useCallback } from "react";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  width?: number;
  delay?: number;
}

export function Tooltip({ content, children, width = 220, delay = 120 }: TooltipProps) {
  const [hovering, setHovering] = useState(false);
  // A tap PINS the tooltip open — hover has no equivalent on a touch screen,
  // so without this every HelpBadge glossary entry and Calendar crossing
  // explainer was simply unreachable on a phone (beta pass §B5; beta users
  // will be on phones). Tap-to-pin works identically on desktop, so this
  // replaces rather than branches on hover vs. touch.
  const [pinned, setPinned] = useState(false);
  const visible = hovering || pinned;
  const [pos, setPos] = useState({ top: 0, left: 0, below: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    // Clamp left so tooltip stays within viewport (assuming tooltip is ~width px wide)
    const safeLeft = Math.max(width / 2 + 8, Math.min(window.innerWidth - width / 2 - 8, rect.left + rect.width / 2));
    // If element is near top, show tooltip below instead
    const showBelow = rect.top < 140;
    setPos({ top: showBelow ? rect.bottom + 8 : rect.top - 8, left: safeLeft, below: showBelow });
  }, [width]);

  const show = useCallback(() => {
    timer.current = setTimeout(() => { place(); setHovering(true); }, delay);
  }, [delay, place]);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setHovering(false);
  }, []);

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (pinned) { setPinned(false); return; }
    place();
    setPinned(true);
  }, [pinned, place]);

  return (
    <>
      {/* A full-screen catcher behind the pinned tooltip — tapping anywhere
          else dismisses it, since there's no mouseleave to fall back on. */}
      {pinned && (
        <div onClick={() => setPinned(false)} style={{ position: "fixed", inset: 0, zIndex: 9998 }} />
      )}
      <div ref={triggerRef} onMouseEnter={show} onMouseLeave={hide} onClick={toggle} style={{ display: "inline-flex" }}>
        {children}
      </div>
      {visible && (
        <div style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          transform: pos.below ? "translate(-50%, 0)" : "translate(-50%, -100%)",
          zIndex: 9999,
          pointerEvents: "none",
        }}>
          {/* Arrow (top when showing above, bottom when showing below) */}
          {pos.below && (
            <div style={{ width:0, height:0, borderLeft:"6px solid transparent", borderRight:"6px solid transparent", borderBottom:"6px solid #1a2a3a", margin:"0 auto", marginBottom:0 }} />
          )}
          <div style={{
            background: "#1a2a3a",
            color: "var(--text-3)",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 11,
            lineHeight: 1.5,
            width,
            boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
            marginBottom: pos.below ? 0 : 6,
            marginTop: pos.below ? 0 : 0,
          }}>
            {content}
          </div>
          {!pos.below && (
            <div style={{ width:0, height:0, borderLeft:"6px solid transparent", borderRight:"6px solid transparent", borderTop:"6px solid #1a2a3a", margin:"0 auto" }} />
          )}
        </div>
      )}
    </>
  );
}

interface HelpBadgeProps {
  term: keyof typeof GLOSSARY;
  style?: React.CSSProperties;
}

export const GLOSSARY = {
  planetaryHour: {
    title: "Planetary Hour",
    body: "Each day is divided into 24 unequal hours, each ruled by one of the seven classical planets. The ruling planet colours the hour's quality — Sun hours favour visibility and leadership; Moon hours favour intuition and home; Mercury favours communication; Venus favours beauty and relationship; Mars favours action and assertion; Jupiter favours expansion; Saturn favours structure and consolidation.",
  },
  voidOfCourse: {
    title: "Void of Course Moon",
    body: "After the Moon makes its last major aspect to another planet before changing signs, it enters a \"void of course\" period. Traditional timing advice: avoid starting new ventures, signing contracts, or making major decisions. Good for completion, review, rest, and routine tasks. Things begun during VOC often don't proceed as intended.",
  },
  moonAspects: {
    title: "Moon Aspects",
    body: "The angular relationships between the Moon and other planets. Trines (△) and sextiles (⚹) are harmonious — energy flows easily. Squares (□) and oppositions (☍) create friction and tension. Conjunctions (☌) amplify the combined energy, which can be either supportive or challenging depending on the planets involved.",
  },
  retrogrades: {
    title: "Retrograde Planets",
    body: "When a planet appears to move backward from Earth's perspective. Retrograde periods are traditionally times for re-visiting, re-evaluating, and refining — not for bold new starts. Mercury retrograde affects communication and technology. Venus affects relationships and finances. Mars affects decisive action.",
  },
  element: {
    title: "Day Element",
    body: "The element of the current lunar sign shapes the day's underlying quality. Fire (Aries, Leo, Sagittarius) — dynamic, initiating, high energy. Earth (Taurus, Virgo, Capricorn) — grounded, practical, productive. Air (Gemini, Libra, Aquarius) — social, communicative, intellectual. Water (Cancer, Scorpio, Pisces) — intuitive, emotional, receptive.",
  },
  qualityScore: {
    title: "Quality Score",
    body: "A 1–7 composite score drawing on lunar aspects, element, void of course status, and planetary hour quality. 6–7 = excellent or good window; 4–5 = workable; 1–3 = mixed or challenging. The score is a guide, not a guarantee.",
  },
  angleCrossing: {
    title: "Angle Crossing",
    body: "The exact moment a planet crosses one of the four chart angles: Ascendant (ASC, eastern horizon), Midheaven (MC, highest point), Descendant (DSC), or Imum Coeli (IC, lowest point). These are considered peak moments of that planet's influence. Venus crossing the ASC or MC is especially notable for creative and social timing.",
  },
  benefic: {
    title: "Benefic Planets",
    body: "Venus and Jupiter are traditionally the \"greater\" and \"lesser\" benefics — their influences are generally supportive, expansive, and fortunate. Crossings by benefics tend to open windows of opportunity, ease, creativity, and good fortune.",
  },
  malefic: {
    title: "Malefic Planets",
    body: "Mars and Saturn are the traditional malefics — their influences tend toward challenge, friction, or restriction. This doesn't mean bad; Mars crossings can be excellent for decisive action, assertion, and physical work. Saturn crossings favour discipline and consolidation.",
  },
  moonPhase: {
    title: "Lunar Phase",
    body: "The Moon's 29.5-day cycle from new to full and back. New Moon — plant seeds, set intentions. Waxing Crescent to First Quarter — build momentum. Waxing Gibbous — refine and adjust. Full Moon — peak energy, harvest, illuminate. Waning Gibbous — gratitude, share. Last Quarter — release and evaluate. Balsamic — rest and let go.",
  },
  resonance: {
    title: "Cycle Resonance",
    body: "The alignment of multiple timing cycles simultaneously. A high-resonance moment occurs when the planetary hour, lunar phase, element, and aspect quality all point in the same direction. The bands below the wave show each cycle independently — look for moments when all three glow warm at the same column.",
  },
} as const;

export function HelpBadge({ term, style }: HelpBadgeProps) {
  const entry = GLOSSARY[term];
  return (
    <Tooltip
      content={
        <div>
          <div style={{ fontWeight: 600, marginBottom: 5, color: "#ffffff" }}>{entry.title}</div>
          <div style={{ color: "var(--color-muted)", fontSize: 10.5, lineHeight: 1.55 }}>{entry.body}</div>
        </div>
      }
      width={260}
    >
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 14, height: 14, borderRadius: "50%", fontSize: 8.5, fontWeight: 600,
        background: "var(--color-border)", color: "var(--color-muted)", cursor: "help", marginLeft: 4,
        flexShrink: 0, ...style,
      }}>?</span>
    </Tooltip>
  );
}
