import React from "react";
import { reportError } from "@/lib/errorReport";

interface State { hasError: boolean; message: string }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  // This boundary showed the user a message and told us nothing. During a beta
  // that means a crash is only ever as visible as a tester's willingness to
  // mention it — and the ones who hit it early are the ones least likely to.
  componentDidCatch(err: Error, info: React.ErrorInfo) {
    reportError("render", err, {
      componentStack: (info.componentStack ?? "").slice(0, 600),
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--color-background)", flexDirection: "column", gap: 12, padding: 40,
      }}>
        <div aria-hidden="true" style={{ fontSize: 28, opacity: 0.4 }}>◌</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)" }}>Something went wrong</div>
        <div style={{ fontSize: 11, color: "var(--text-3)", maxWidth: 300, textAlign: "center" }}>
          {this.state.message || "An unexpected error occurred."}
        </div>
        <button
          onClick={() => this.setState({ hasError: false, message: "" })}
          style={{ marginTop: 8, fontSize: 11, padding: "6px 16px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-card)", cursor: "pointer" }}
        >
          Try again
        </button>
      </div>
    );
  }
}
