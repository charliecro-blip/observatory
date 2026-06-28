import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TesterProvider, useTester } from "@/contexts/tester-context";
import Rail from "@/components/Rail";
import Today from "@/pages/Today";
import Tasks from "@/pages/Tasks";
import Calendar from "@/pages/Calendar";
import { useTidesNow, useTidesWeek } from "@/hooks/useTides";

const queryClient = new QueryClient();

type View = "today" | "tasks" | "calendar";

const NAV: { id: View; label: string; icon: string }[] = [
  { id: "today",    label: "Today",    icon: "◎" },
  { id: "tasks",    label: "Tasks",    icon: "✓" },
  { id: "calendar", label: "Calendar", icon: "▦" },
];

function Shell() {
  const { profile, isReady, showModal, createAndApply } = useTester();
  const testerId = profile?.testerId ?? null;
  const [view, setView] = useState<View>("today");

  const { data: now } = useTidesNow(testerId);
  const { data: week } = useTidesWeek();

  if (showModal || !isReady) {
    return (
      <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f0ede8"}}>
        <div style={{background:"#fff",border:"1px solid #d0cbc3",borderRadius:14,padding:"32px 36px",maxWidth:340,width:"100%",textAlign:"center"}}>
          <div style={{fontSize:24,fontWeight:600,marginBottom:4,letterSpacing:"-0.3px"}}>Tides</div>
          <div style={{fontSize:13,color:"#888",marginBottom:24}}>Your timing companion. Enter a name to begin.</div>
          <form onSubmit={e => {
            e.preventDefault();
            const name = (e.currentTarget.elements.namedItem("name") as HTMLInputElement).value;
            createAndApply(name || "Observer");
          }}>
            <input name="name" placeholder="Your name" autoFocus
              style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid #d0cbc3",fontSize:13,marginBottom:10,outline:"none",background:"#faf8f5"}}/>
            <button type="submit" style={{width:"100%",padding:"9px 0",borderRadius:8,background:"#1a2a3a",color:"#fff",fontSize:13,fontWeight:500,border:"none",cursor:"pointer"}}>
              Enter Tides
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{display:"flex",height:"100vh",width:"100%",background:"#f0ede8",overflow:"hidden"}}>
      {/* Rail */}
      <div style={{display:"flex",flexDirection:"column"}}>
        <Rail now={now} />
        {/* Nav at bottom of rail */}
        <div style={{borderRight:"1px solid #d0cbc3",background:"#e8e4de",padding:"8px 10px",display:"flex",flexDirection:"column",gap:2}}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setView(n.id)} style={{
              display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:6,
              border:"none",cursor:"pointer",textAlign:"left",width:"100%",
              background:view===n.id?"#d8d2ca":"transparent",
              color:view===n.id?"#1a1a1a":"#666",fontWeight:view===n.id?500:400,fontSize:12,
            }}>
              <span style={{fontSize:13,width:16,textAlign:"center"}}>{n.icon}</span>
              {n.label}
            </button>
          ))}
          {/* Profile footer */}
          <div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #d0cbc3",fontSize:10,color:"#aaa",paddingLeft:2}}>
            {profile?.displayName}
          </div>
        </div>
      </div>

      {/* Main */}
      {view === "today"    && <Today    testerId={testerId} />}
      {view === "tasks"    && <Tasks    testerId={testerId} now={now} />}
      {view === "calendar" && <Calendar testerId={testerId} now={now} week={week} />}
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
