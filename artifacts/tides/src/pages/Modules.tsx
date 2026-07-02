import React, { useState } from "react";
import { useTidesNow } from "@/hooks/useTides";
import ContentModule from "@/modules/content/ContentModule";
import CreativeModule from "@/modules/creative/CreativeModule";
import FinancialModule from "@/modules/financial/FinancialModule";
import RelationshipsModule from "@/modules/relationships/RelationshipsModule";
import HealthModule from "@/modules/health/HealthModule";
import SpiritualModule from "@/modules/spiritual/SpiritualModule";
import HomeModule from "@/modules/home/HomeModule";
import PlanetModule from "@/modules/planetary/PlanetModule";

interface ModuleDef {
  id: string;
  label: string;
  icon: string;
  group: string;
}

const MODULES: ModuleDef[] = [
  { id:"content",        label:"Content",       icon:"✎",  group:"Work" },
  { id:"creative",       label:"Creative",      icon:"◈",  group:"Work" },
  { id:"financial",      label:"Financial",     icon:"◆",  group:"Work" },
  { id:"relationships",  label:"Relationships", icon:"♡",  group:"Life" },
  { id:"health",         label:"Health & Body", icon:"◉",  group:"Life" },
  { id:"spiritual",      label:"Spiritual",     icon:"✦",  group:"Life" },
  { id:"home",           label:"Home & Space",  icon:"⌂",  group:"Life" },
  { id:"planet:Sun",     label:"Sun",           icon:"☉",  group:"Planets" },
  { id:"planet:Moon",    label:"Moon",          icon:"☽",  group:"Planets" },
  { id:"planet:Mercury", label:"Mercury",       icon:"☿",  group:"Planets" },
  { id:"planet:Venus",   label:"Venus",         icon:"♀",  group:"Planets" },
  { id:"planet:Mars",    label:"Mars",          icon:"♂",  group:"Planets" },
  { id:"planet:Jupiter", label:"Jupiter",       icon:"♃",  group:"Planets" },
  { id:"planet:Saturn",  label:"Saturn",        icon:"♄",  group:"Planets" },
];

const PLANET_COLORS: Record<string, string> = {
  Sun:"#c08020", Moon:"#7080a0", Mercury:"#608060", Venus:"#c06090",
  Mars:"#c04040", Jupiter:"#6040a0", Saturn:"#807060",
};

const GROUPS = ["Work", "Life", "Planets"];

function usePlanetEmphasis(testerId: string | null, lat: number, lon: number): Set<string> {
  const { data: now } = useTidesNow(testerId, lat, lon);
  const emphasized = new Set<string>();
  const moonAspects: any[] = now?.moonAspects ?? [];
  const aspects: any[] = now?.aspects ?? [];
  const allAspects = [...moonAspects, ...aspects.filter((a: any) => a.planet1 === "Sun" || a.planet2 === "Sun")];
  for (const a of allAspects) {
    if (a.planet1 && a.planet1 !== "Moon") emphasized.add(a.planet1);
    if (a.planet2 && a.planet2 !== "Moon") emphasized.add(a.planet2);
  }
  return emphasized;
}

export default function Modules({
  testerId, lat = 40.7, lon = -74.0
}: { testerId: string | null; lat?: number; lon?: number }) {
  const [activeModule, setActiveModule] = useState("content");
  const planetEmphasis = usePlanetEmphasis(testerId, lat, lon);

  function renderContent() {
    if (activeModule.startsWith("planet:")) {
      return <PlanetModule testerId={testerId} lat={lat} lon={lon} planetName={activeModule.replace("planet:", "")} />;
    }
    switch (activeModule) {
      case "content":       return <ContentModule       testerId={testerId} lat={lat} lon={lon} />;
      case "creative":      return <CreativeModule      testerId={testerId} lat={lat} lon={lon} />;
      case "financial":     return <FinancialModule     testerId={testerId} lat={lat} lon={lon} />;
      case "relationships": return <RelationshipsModule testerId={testerId} lat={lat} lon={lon} />;
      case "health":        return <HealthModule        testerId={testerId} lat={lat} lon={lon} />;
      case "spiritual":     return <SpiritualModule     testerId={testerId} lat={lat} lon={lon} />;
      case "home":          return <HomeModule          testerId={testerId} lat={lat} lon={lon} />;
      default:              return null;
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--color-border)", background: "var(--color-rail)", flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: "#888" }}>Modules</div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Sidebar */}
        <div style={{
          width: 185, minWidth: 185, borderRight: "1px solid var(--color-border)",
          background: "var(--color-card-2)", display: "flex", flexDirection: "column",
          overflowY: "auto", padding: "8px 6px",
        }}>
          {GROUPS.map(group => {
            const mods = MODULES.filter(m => m.group === group);
            return (
              <div key={group} style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.7px", color: "#bbb", padding: "5px 8px 2px" }}>
                  {group}
                </div>
                {mods.map(mod => {
                  const isActive = activeModule === mod.id;
                  const pColor = mod.id.startsWith("planet:") ? PLANET_COLORS[mod.label] : undefined;
                  return (
                    <button key={mod.id} onClick={() => setActiveModule(mod.id)} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "7px 9px",
                      borderRadius: 6, border: "none", cursor: "pointer", textAlign: "left", width: "100%",
                      background: isActive ? "#e8e4de" : "transparent",
                      color: isActive ? "#1a1a1a" : "#555",
                    }}>
                      <span style={{ fontSize: 13, width: 16, textAlign: "center", flexShrink: 0, color: pColor ?? (isActive ? "#1a1a1a" : "#888") }}>
                        {mod.icon}
                      </span>
                      <div style={{ fontSize: 10.5, fontWeight: isActive ? 600 : 400, flex: 1 }}>{mod.label}</div>
                      {mod.id.startsWith("planet:") && planetEmphasis.has(mod.label) && (
                        <div title="Active sky emphasis" style={{ width: 6, height: 6, borderRadius: "50%", background: pColor ?? "#888", flexShrink: 0, opacity: 0.85 }} />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
