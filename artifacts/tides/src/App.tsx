import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TesterProvider, useTester } from "@/contexts/tester-context";
import Rail from "@/components/Rail";
import Today from "@/pages/Today";
import { useTidesNow } from "@/hooks/useTides";

const queryClient = new QueryClient();

function Shell() {
  const { profile, isReady, showModal, createAndApply } = useTester();
  const testerId = profile?.testerId ?? null;
  const { data: now } = useTidesNow(testerId);

  if (showModal || !isReady) {
    return (
      <div style={{
        height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#f0ede8",
      }}>
        <div style={{
          background: "#fff", border: "1px solid #d0cbc3", borderRadius: 14, padding: "32px 36px",
          maxWidth: 340, width: "100%", textAlign: "center",
        }}>
          <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Welcome to Tides</div>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>
            Your timing companion. Enter a name to get started.
          </div>
          <form onSubmit={e => {
            e.preventDefault();
            const name = (e.currentTarget.elements.namedItem("name") as HTMLInputElement).value;
            createAndApply(name || "Observer");
          }}>
            <input
              name="name"
              placeholder="Your name"
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #d0cbc3",
                fontSize: 13, marginBottom: 10, outline: "none", background: "#faf8f5",
              }}
            />
            <button type="submit" style={{
              width: "100%", padding: "9px 0", borderRadius: 8, background: "#1a2a3a",
              color: "#fff", fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer",
            }}>
              Enter Tides
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", background: "#f0ede8", overflow: "hidden" }}>
      <Rail now={now} />
      <Today testerId={testerId} />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TesterProvider>
        <Shell />
      </TesterProvider>
    </QueryClientProvider>
  );
}
