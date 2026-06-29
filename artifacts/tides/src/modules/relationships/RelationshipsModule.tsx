import React from "react";
import { ModuleShell } from "../shared/ModuleShell";
import { relationshipsLogic } from "./relationshipsLogic";

export default function RelationshipsModule({
  testerId, lat = 40.7, lon = -74.0,
}: { testerId: string | null; lat?: number; lon?: number }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ fontSize:20, fontWeight:600, color:"#1a2a3a" }}>Relationships</div>
      <div style={{ fontSize:11, color:"#888", marginTop:-8 }}>
        Social planning, connection, difficult conversations, and relational care.
      </div>
      <ModuleShell testerId={testerId} lat={lat} lon={lon} logic={relationshipsLogic} />
    </div>
  );
}
