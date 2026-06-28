import React from "react";

interface State { hasError: boolean; message: string }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        background: "#f0ede8", flexDirection: "column", gap: 12, padding: 40,
      }}>
        <div style={{ fontSize: 28, opacity: 0.4 }}>◌</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#555" }}>Something went wrong</div>
        <div style={{ fontSize: 11, color: "#aaa", maxWidth: 300, textAlign: "center" }}>
          {this.state.message || "An unexpected error occurred."}
        </div>
        <button
          onClick={() => this.setState({ hasError: false, message: "" })}
          style={{ marginTop: 8, fontSize: 11, padding: "6px 16px", borderRadius: 7, border: "1px solid #d0cbc3", background: "#fff", cursor: "pointer" }}
        >
          Try again
        </button>
      </div>
    );
  }
}
