/**
 * A DASHBOARD, NOT A TEXT BOX.
 *
 * The habit icon has been editable since 2026-08-13 — a two-character input
 * with a placeholder — but "editable" and "a picker" are different asks. The
 * owner named it directly (2026-08-31): "am i supposed to be able to change
 * the emoji here on this habit? I need an emoji dashboard."
 *
 * CURATED, NOT THE FULL UNICODE TABLE. A general emoji browser is a large,
 * separate piece of UI — search, skin-tone variants, recently-used, thousands
 * of glyphs — for a field that exists to mark one habit among a handful on a
 * list. The set below is picked for what a habit actually is: body, mind,
 * spirit, care, craft, home, nature, time. Free typing stays available
 * underneath for anything not here; the dashboard is an accelerator, not a
 * cage.
 */

import { useState } from "react";
import { useDialog } from "@/hooks/useDialog";

const GROUPS: { label: string; glyphs: string[] }[] = [
  { label: "Body",   glyphs: ["🏃","🧘","🏋️","🚶","🧗","🚴","🏊","💪","🦵","🩸"] },
  { label: "Mind",   glyphs: ["📖","✍️","🧠","🎯","📚","🗣️","💭","🔍","🧩","♟️"] },
  { label: "Spirit", glyphs: ["🕯️","🌿","🙏","🔮","🌙","✨","🧿","🪷","☯️","🌸"] },
  { label: "Care",   glyphs: ["💊","🛌","🚿","🦷","🧴","💧","🥗","☕","🍎","😴"] },
  { label: "Craft",  glyphs: ["🎨","🎸","📷","🧵","🔨","🪴","🧶","🎹","🖌️","📝"] },
  { label: "Home",   glyphs: ["🧹","🧺","🍳","🗑️","🪴","🧽","📦","🛠️","🔑","🧾"] },
  { label: "Nature", glyphs: ["🌱","☀️","🌊","🔥","🌲","🌧️","⛰️","🌾","🐦","🌻"] },
  { label: "Time",   glyphs: ["⏰","📅","🌅","🌇","🕰️","⏳","🔔","📆","🌃","🗓️"] },
];

export default function EmojiPicker({ value, onChange, onClose }: {
  value: string;
  onChange: (emoji: string) => void;
  onClose: () => void;
}) {
  const { ref, props } = useDialog(onClose, "Pick an icon");
  const [custom, setCustom] = useState(value);

  const pick = (g: string) => { onChange(g); onClose(); };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(20,16,12,0.35)", zIndex: "var(--z-dialog)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div ref={ref} {...props} onClick={e => e.stopPropagation()} style={{
        background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 14,
        padding: "16px 18px", width: 340, maxWidth: "100%", maxHeight: "80vh", overflowY: "auto",
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)", marginBottom: 12 }}>Pick an icon</div>

        {GROUPS.map(g => (
          <div key={g.label} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-3)", marginBottom: 5 }}>{g.label}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {g.glyphs.map(gl => (
                <button key={gl} onClick={() => pick(gl)} aria-label={gl}
                  style={{
                    width: 34, height: 34, fontSize: 18, borderRadius: 7, cursor: "pointer",
                    border: value === gl ? "1.5px solid var(--color-primary)" : "1px solid transparent",
                    background: value === gl ? "var(--color-card-2)" : "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{gl}</button>
              ))}
            </div>
          </div>
        ))}

        {/* The escape hatch. The dashboard is eighty glyphs; Unicode has
            thousands, and nobody should be blocked from the one they want
            because it is not in a curated set. */}
        <div style={{ borderTop: "1px solid var(--color-border)", marginTop: 6, paddingTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <input value={custom} maxLength={2} placeholder="🌿"
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && custom.trim()) pick(custom.trim()); }}
            style={{ width: 44, padding: "7px", borderRadius: 7, border: "1px solid var(--color-border)", fontSize: 18, textAlign: "center", background: "var(--color-card-2)" }} />
          <span style={{ fontSize: 11, color: "var(--text-3)", flex: 1 }}>or type your own, then Enter</span>
          <button onClick={onClose} style={{ fontSize: 11, padding: "6px 12px", borderRadius: 7, border: "1px solid var(--color-border)", background: "none", color: "var(--text-3)", cursor: "pointer" }}>Close</button>
        </div>
      </div>
    </div>
  );
}
