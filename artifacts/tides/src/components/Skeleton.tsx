import React from "react";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: number;
  style?: React.CSSProperties;
}

export function Skeleton({ width = "100%", height = 14, borderRadius = 6, style }: SkeletonProps) {
  return (
    <div style={{
      width, height, borderRadius,
      background: "linear-gradient(90deg, var(--color-rail) 25%, #e4e0da 50%, var(--color-rail) 75%)",
      backgroundSize: "200% 100%",
      animation: "skeleton-shimmer 1.4s ease infinite",
      ...style,
    }} />
  );
}

export function SkeletonCard({ rows = 3, height = 80 }: { rows?: number; height?: number }) {
  return (
    <div style={{
      background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10,
      padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8,
    }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} width={i === 0 ? "60%" : i % 2 === 0 ? "85%" : "75%"} height={12} />
      ))}
    </div>
  );
}

// Inject the animation once
if (typeof document !== "undefined" && !document.getElementById("skeleton-style")) {
  const style = document.createElement("style");
  style.id = "skeleton-style";
  style.textContent = `
    @keyframes skeleton-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  document.head.appendChild(style);
}
