import React, { useState } from "react";
import ContentModule from "@/modules/content/ContentModule";

interface ModuleDef {
  id: string;
  label: string;
  icon: string;
  tagline: string;
  available: boolean;
}

const MODULES: ModuleDef[] = [
  {
    id: "content",
    label: "Content Planning",
    icon: "✎",
    tagline: "Align your editorial calendar with planetary cycles",
    available: true,
  },
  {
    id: "creative",
    label: "Creative Projects",
    icon: "◈",
    tagline: "Writing, music, art — when to create vs refine vs rest",
    available: false,
  },
  {
    id: "financial",
    label: "Financial Decisions",
    icon: "◆",
    tagline: "Timing for investments, contracts, and negotiations",
    available: false,
  },
  {
    id: "relationships",
    label: "Relationships",
    icon: "♡",
    tagline: "Social planning, difficult conversations, and connection",
    available: false,
  },
  {
    id: "health",
    label: "Health & Body",
    icon: "◉",
    tagline: "Physical training, fasting, rest, and recovery windows",
    available: false,
  },
];

function ComingSoonCard({ mod }: { mod: ModuleDef }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e8e4de", borderRadius: 10,
      padding: "16px 18px", opacity: 0.7,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: "#e8e4de",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, color: "#aaa",
        }}>
          {mod.icon}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#555" }}>{mod.label}</div>
          <div style={{ fontSize: 10, color: "#bbb" }}>Coming soon</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.5 }}>{mod.tagline}</div>
    </div>
  );
}

export default function Modules({
  testerId, lat = 40.7, lon = -74.0
}: { testerId: string | null; lat?: number; lon?: number }) {
  const [activeModule, setActiveModule] = useState("content");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        padding: "10px 20px", borderBottom: "1px solid #d0cbc3",
        background: "#ece8e2", flexShrink: 0,
      }}>
        <div style={{ fontSize: 12, color: "#888" }}>Modules</div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Module sidebar */}
        <div style={{
          width: 200, minWidth: 200, borderRight: "1px solid #d8d2ca",
          background: "#f5f2ee", display: "flex", flexDirection: "column",
          overflowY: "auto", padding: "12px 8px", gap: 4,
        }}>
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: "#bbb", padding: "0 8px", marginBottom: 4 }}>
            Available
          </div>
          {MODULES.filter(m => m.available).map(mod => (
            <button
              key={mod.id}
              onClick={() => setActiveModule(mod.id)}
              style={{
                display: "flex", alignItems: "center", gap: 9, padding: "8px 10px",
                borderRadius: 7, border: "none", cursor: "pointer", textAlign: "left",
                background: activeModule === mod.id ? "#e8e4de" : "transparent",
                color: activeModule === mod.id ? "#1a1a1a" : "#555",
              }}
            >
              <span style={{ fontSize: 14, width: 18, textAlign: "center" }}>{mod.icon}</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: activeModule === mod.id ? 600 : 400 }}>{mod.label}</div>
                <div style={{ fontSize: 9, color: "#aaa", marginTop: 1 }}>{mod.tagline}</div>
              </div>
            </button>
          ))}

          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.6px", color: "#bbb", padding: "8px 8px 4px", marginTop: 8 }}>
            Coming soon
          </div>
          {MODULES.filter(m => !m.available).map(mod => (
            <div
              key={mod.id}
              style={{
                display: "flex", alignItems: "center", gap: 9, padding: "8px 10px",
                borderRadius: 7, opacity: 0.5,
              }}
            >
              <span style={{ fontSize: 14, width: 18, textAlign: "center", color: "#aaa" }}>{mod.icon}</span>
              <div>
                <div style={{ fontSize: 11, color: "#888" }}>{mod.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Module content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {activeModule === "content" && (
            <ContentModule testerId={testerId} lat={lat} lon={lon} />
          )}
        </div>
      </div>
    </div>
  );
}
