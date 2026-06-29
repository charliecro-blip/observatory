import React from "react";
import { ModuleShell } from "../shared/ModuleShell";
import { healthLogic } from "./healthLogic";

export default function HealthModule({
  testerId, lat = 40.7, lon = -74.0,
}: { testerId: string | null; lat?: number; lon?: number }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ fontSize:20, fontWeight:600, color:"#1a2a3a" }}>Health & Body</div>
      <div style={{ fontSize:11, color:"#888", marginTop:-8 }}>
        Physical training, recovery, fasting, and vitality windows aligned to biodynamic and lunar cycles.
      </div>
      <ModuleShell testerId={testerId} lat={lat} lon={lon} logic={healthLogic} />
    </div>
  );
}
