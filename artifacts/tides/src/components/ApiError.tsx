import React from "react";

export function ApiErrorBanner({ retry }: { retry?: () => void }) {
  return (
    <div style={{
      background: "#fff8f0", border: "1px solid #f0d8b0", borderTop: "2px solid #e0a040",
      padding: "8px 20px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
    }}>
      <span style={{ fontSize: 13 }}>⚠</span>
      <div style={{ fontSize: 11, color: "#8a5020", flex: 1 }}>
        Can't reach Compass right now — this is usually a brief connection hiccup. Your data is safe; try again in a moment.
      </div>
      {retry && (
        <button onClick={retry} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 6, border: "1px solid #e0b870", background: "var(--color-card)", color: "#8a5020", cursor: "pointer" }}>
          Retry
        </button>
      )}
    </div>
  );
}
