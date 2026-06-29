import React from "react";
import { ModuleShell } from "../shared/ModuleShell";
import { financialLogic } from "./financialLogic";

export default function FinancialModule({
  testerId, lat = 40.7, lon = -74.0,
}: { testerId: string | null; lat?: number; lon?: number }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ fontSize:20, fontWeight:600, color:"#1a2a3a" }}>Financial Decisions</div>
      <div style={{ fontSize:11, color:"#888", marginTop:-8 }}>
        Timing for investments, contracts, negotiations, and major financial commitments.
      </div>
      <ModuleShell testerId={testerId} lat={lat} lon={lon} logic={financialLogic} />
    </div>
  );
}
