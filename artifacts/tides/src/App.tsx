import React, { useState, useRef, useEffect } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ApiErrorBanner } from "@/components/ApiError";
import { TesterProvider, useTester } from "@/contexts/tester-context";
import { PreferencesProvider } from "@/contexts/preferences-context";
import Rail from "@/components/Rail";
import Today from "@/pages/Today";
import Tasks from "@/pages/Tasks";
import Calendar from "@/pages/Calendar";
import Habits from "@/pages/Habits";
import Goals from "@/pages/Goals";
import Sky from "@/pages/Sky";
import Settings from "@/pages/Settings";
import { useTidesNow, useTidesWeek } from "@/hooks/useTides";

const queryClient = new QueryClient();

type View = "today"|"habits"|"tasks"|"goals"|"calendar"|"sky"|"settings";

const NAV: {id:View; label:string; icon:string}[] = [
  {id:"today",    label:"Today",    icon:"◎"},
  {id:"habits",   label:"Habits",   icon:"⟳"},
  {id:"tasks",    label:"Tasks",    icon:"✓"},
  {id:"goals",    label:"Goals",    icon:"◇"},
  {id:"calendar", label:"Calendar", icon:"▦"},
  {id:"sky",      label:"Sky",      icon:"✦"},
];

const WINDOW_TYPES = [
  "deep_work","creative","planning","admin","social","relationship","recovery","study","launch","retreat",
];
const WINDOW_LABELS: Record<string,string> = {
  deep_work:"Deep work",creative:"Creative",planning:"Planning",admin:"Admin",
  social:"Social",relationship:"Relationship",recovery:"Recovery",study:"Study",launch:"Launch",retreat:"Retreat",
};

function QuickCapture({ testerId, onClose }: { testerId: string|null; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [windowType, setWindowType] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function submit() {
    if (!title.trim() || !testerId) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "x-tester-id": testerId, "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), bestWindowType: windowType || undefined }),
    });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    onClose();
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 999,
      display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 120,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "#fff", borderRadius: 14, padding: "20px 22px", width: 420,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)", border: "1px solid #e0dbd4",
      }}>
        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 10 }}>Quick capture</div>
        <input ref={inputRef} value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") onClose(); }}
          placeholder="What needs to get done?"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d8d2ca", fontSize: 14, outline: "none", background: "#faf8f5", marginBottom: 10 }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <select value={windowType} onChange={e => setWindowType(e.target.value)}
            style={{ flex: 1, padding: "7px 10px", borderRadius: 7, border: "1px solid #d8d2ca", fontSize: 11, color: "#555", background: "#faf8f5" }}>
            <option value="">Best time: any</option>
            {WINDOW_TYPES.map(t => <option key={t} value={t}>{WINDOW_LABELS[t]}</option>)}
          </select>
          <button onClick={submit} disabled={!title.trim()}
            style={{ padding: "7px 18px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 500, cursor: "pointer", background: title.trim() ? "#1a2a3a" : "#e0dcd6", color: title.trim() ? "#fff" : "#aaa" }}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function Shell() {
  const { profile, isReady, showModal, createAndApply, lat, lon } = useTester();
  const testerId = profile?.testerId ?? null;
  const [view, setView] = useState<View>("today");
  const [capture, setCapture] = useState(false);

  const { data: now, isError: nowError, refetch: refetchNow } = useTidesNow(testerId, lat, lon);
  const { data: week } = useTidesWeek(14, lat, lon);

  if (showModal || !isReady) {
    return (
      <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f0ede8"}}>
        <div style={{background:"#fff",border:"1px solid #d0cbc3",borderRadius:14,padding:"32px 36px",maxWidth:340,width:"100%",textAlign:"center"}}>
          <div style={{fontSize:24,fontWeight:600,marginBottom:4,letterSpacing:"-0.3px"}}>Tides</div>
          <div style={{fontSize:13,color:"#888",marginBottom:24}}>Your timing companion. Enter a name to begin.</div>
          <form onSubmit={e => {
            e.preventDefault();
            const name = (e.currentTarget.elements.namedItem("name") as HTMLInputElement).value;
            createAndApply(name||"Observer");
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
    <div style={{display:"flex",height:"100vh",width:"100%",background:"#f0ede8",overflow:"hidden",flexDirection:"column"}}>
      {nowError && <ApiErrorBanner retry={() => refetchNow()} />}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
      {capture && testerId && <QuickCapture testerId={testerId} onClose={() => setCapture(false)} />}

      <div style={{display:"flex",flexDirection:"column",borderRight:"1px solid #d0cbc3"}}>
        <Rail now={now} />
        <div style={{background:"#e8e4de",padding:"8px 10px",display:"flex",flexDirection:"column",gap:2,flex:1}}>
          {NAV.map(n => (
            <button key={n.id} onClick={()=>setView(n.id)} style={{
              display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:6,
              border:"none",cursor:"pointer",textAlign:"left",width:"100%",
              background:view===n.id?"#d8d2ca":"transparent",
              color:view===n.id?"#1a1a1a":"#666",fontWeight:view===n.id?500:400,fontSize:12,
            }}>
              <span style={{fontSize:13,width:16,textAlign:"center"}}>{n.icon}</span>
              {n.label}
            </button>
          ))}
          <div style={{flex:1}}/>
          {/* Quick capture */}
          <button onClick={() => setCapture(true)} style={{
            display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:6,
            border:"1px solid #c0bab0",cursor:"pointer",textAlign:"left",width:"100%",
            background:"#fff",color:"#555",fontSize:11,marginBottom:4,
          }}>
            <span style={{fontSize:13,width:16,textAlign:"center"}}>+</span>
            Quick task
          </button>
          <button onClick={()=>setView("settings")} style={{
            display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:6,
            border:"none",cursor:"pointer",textAlign:"left",width:"100%",
            background:view==="settings"?"#d8d2ca":"transparent",
            color:view==="settings"?"#1a1a1a":"#aaa",fontSize:11,
          }}>
            <span style={{fontSize:12,width:16,textAlign:"center"}}>⚙</span>
            Settings
          </button>
          <div style={{fontSize:10,color:"#bbb",paddingLeft:12,paddingBottom:4}}>{profile?.displayName}</div>
        </div>
      </div>

      {view==="today"    && <Today    testerId={testerId} lat={lat} lon={lon}/>}
      {view==="habits"   && <Habits   testerId={testerId} now={now} lat={lat} lon={lon}/>}
      {view==="tasks"    && <Tasks    testerId={testerId} now={now}/>}
      {view==="goals"    && <Goals    testerId={testerId}/>}
      {view==="calendar" && <Calendar testerId={testerId} now={now} week={week}/>}
      {view==="sky"      && <Sky      testerId={testerId} lat={lat} lon={lon}/>}
      {view==="settings" && <Settings testerId={testerId}/>}
      </div>
    </div>
  );
}

export default function App() {
  // Register service worker once on mount
  React.useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TesterProvider>
        <PreferencesProvider>
          <ErrorBoundary>
            <Shell/>
          </ErrorBoundary>
        </PreferencesProvider>
      </TesterProvider>
    </QueryClientProvider>
  );
}
