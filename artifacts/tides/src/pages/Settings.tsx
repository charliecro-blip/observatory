import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTester } from "@/contexts/tester-context";

function authH(tid:string|null) {
  return { ...(tid?{"x-tester-id":tid}:{}), "Content-Type":"application/json" };
}

export default function Settings({ testerId }: { testerId:string|null }) {
  const qc = useQueryClient();
  const { profile, resetProfile, updateLocation, lat, lon } = useTester();
  const [saved, setSaved] = useState(false);
  const [natalForm, setNatalForm] = useState({
    birthDate:"", birthTime:"", birthLat:"", birthLon:"", utcOffset:"", birthPlace:""
  });
  const [locationForm, setLocationForm] = useState({ lat: String(lat), lon: String(lon), label: profile?.locationLabel ?? "New York" });
  const [locSaved, setLocSaved] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [journalOpen, setJournalOpen] = useState(false);

  // Build journal history from localStorage — last 14 days
  const journalEntries = useMemo(() => {
    const entries: { date: string; text: string }[] = [];
    for (let d = 0; d < 14; d++) {
      const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
      const key = `tides-journal-${testerId ?? "anon"}-${date}`;
      const text = localStorage.getItem(key);
      if (text?.trim()) entries.push({ date, text });
    }
    return entries;
  }, [testerId, journalOpen]);

  // Load existing natal chart
  const { data: natal } = useQuery({
    queryKey: ["natal-chart", testerId],
    queryFn: async () => {
      const r = await fetch("/api/natal-chart", { headers: authH(testerId) });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!testerId,
  });

  useEffect(() => {
    if (natal) {
      setNatalForm({
        birthDate: natal.birthDate ?? "",
        birthTime: natal.birthTime ?? "",
        birthLat: String(natal.birthLat ?? ""),
        birthLon: String(natal.birthLon ?? ""),
        utcOffset: String(natal.utcOffset ?? ""),
        birthPlace: natal.birthPlace ?? "",
      });
    }
  }, [natal]);

  const saveNatal = useMutation({
    mutationFn: async () => {
      const method = natal ? "PATCH" : "POST";
      await fetch("/api/natal-chart", {
        method, headers: authH(testerId),
        body: JSON.stringify({
          birthDate: natalForm.birthDate,
          birthTime: natalForm.birthTime,
          birthLat: parseFloat(natalForm.birthLat),
          birthLon: parseFloat(natalForm.birthLon),
          utcOffset: parseFloat(natalForm.utcOffset),
          birthPlace: natalForm.birthPlace,
        }),
      });
    },
    onSuccess: () => { qc.invalidateQueries({queryKey:["natal-chart"]}); setSaved(true); setTimeout(()=>setSaved(false),2000); },
  });

  const Field = ({ label, children }: { label:string; children:React.ReactNode }) => (
    <div style={{display:"flex",flexDirection:"column",gap:4}}>
      <label style={{fontSize:9,textTransform:"uppercase",letterSpacing:"0.6px",color:"#aaa"}}>{label}</label>
      {children}
    </div>
  );

  const input = (val:string, onChange:(v:string)=>void, rest={} as any) => (
    <input value={val} onChange={e=>onChange(e.target.value)} {...rest}
      style={{padding:"7px 10px",borderRadius:7,border:"1px solid #d8d2ca",fontSize:13,background:"#faf8f5",outline:"none",...(rest.style??{})}}/>
  );

  // iCal URL
  const icalUrl = testerId ? `/api/tides/calendar.ics?tid=${testerId}` : null;

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"10px 20px",borderBottom:"1px solid #d0cbc3",background:"#ece8e2",flexShrink:0}}>
        <div style={{fontSize:12,color:"#888"}}>Settings</div>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"20px",display:"flex",flexDirection:"column",gap:20,maxWidth:520}}>

        {/* Profile */}
        <div style={{background:"#fff",border:"1px solid #e8e4de",borderRadius:10,padding:"16px"}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>Profile</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <div>
              <div style={{fontSize:13,fontWeight:500}}>{profile?.displayName}</div>
              <div style={{fontSize:10,color:"#aaa",fontFamily:"monospace",marginTop:2}}>{profile?.testerId}</div>
            </div>
            <button onClick={resetProfile} style={{marginLeft:"auto",fontSize:11,padding:"5px 12px",borderRadius:7,border:"1px solid #d0cbc3",background:"#fff",color:"#888",cursor:"pointer"}}>
              Switch profile
            </button>
          </div>
        </div>

        {/* Natal Chart */}
        <div style={{background:"#fff",border:"1px solid #e8e4de",borderRadius:10,padding:"16px"}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>Natal chart</div>
          <div style={{fontSize:11,color:"#aaa",marginBottom:14}}>Used for personal transit overlays in the Today view.</div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <Field label="Birth date">
              {input(natalForm.birthDate, v=>setNatalForm(f=>({...f,birthDate:v})), {type:"date"})}
            </Field>
            <Field label="Birth time">
              {input(natalForm.birthTime, v=>setNatalForm(f=>({...f,birthTime:v})), {type:"time"})}
            </Field>
            <Field label="Place">
              {input(natalForm.birthPlace, v=>setNatalForm(f=>({...f,birthPlace:v})), {placeholder:"City, Country"})}
            </Field>
            <Field label="UTC offset">
              {input(natalForm.utcOffset, v=>setNatalForm(f=>({...f,utcOffset:v})), {placeholder:"-5", type:"number", step:"0.5"})}
            </Field>
            <Field label="Latitude">
              {input(natalForm.birthLat, v=>setNatalForm(f=>({...f,birthLat:v})), {placeholder:"40.7", type:"number", step:"0.01"})}
            </Field>
            <Field label="Longitude">
              {input(natalForm.birthLon, v=>setNatalForm(f=>({...f,birthLon:v})), {placeholder:"-74.0", type:"number", step:"0.01"})}
            </Field>
          </div>

          <button onClick={()=>saveNatal.mutate()} disabled={!natalForm.birthDate} style={{
            padding:"8px 20px",borderRadius:8,border:"none",fontSize:12,cursor:"pointer",
            background:natalForm.birthDate?"#1a2a3a":"#e0dcd6",color:natalForm.birthDate?"#fff":"#aaa",
          }}>
            {saved ? "Saved ✓" : natal ? "Update chart" : "Save chart"}
          </button>
        </div>

        {/* Current location */}
        <div style={{background:"#fff",border:"1px solid #e8e4de",borderRadius:10,padding:"16px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
            <div style={{fontSize:13,fontWeight:600}}>Current location</div>
            <button
              onClick={() => {
                if (!navigator.geolocation) { setGeoError("Geolocation not supported."); return; }
                setGeoLoading(true); setGeoError("");
                navigator.geolocation.getCurrentPosition(
                  pos => {
                    const la = parseFloat(pos.coords.latitude.toFixed(4));
                    const lo = parseFloat(pos.coords.longitude.toFixed(4));
                    setLocationForm(f => ({ ...f, lat: String(la), lon: String(lo) }));
                    setGeoLoading(false);
                  },
                  err => { setGeoError(err.message); setGeoLoading(false); },
                  { timeout: 8000 }
                );
              }}
              style={{fontSize:10,padding:"4px 10px",borderRadius:6,border:"1px solid #d0cbc3",background:"#f8f5f0",color:"#555",cursor:"pointer"}}
            >
              {geoLoading ? "Locating…" : "⊙ Use my location"}
            </button>
          </div>
          <div style={{fontSize:11,color:"#aaa",marginBottom:14}}>Used for planetary hours and angle calculations.</div>
          {geoError && <div style={{fontSize:10,color:"#c05030",marginBottom:8}}>{geoError}</div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
            <Field label="City">{input(locationForm.label,v=>setLocationForm(f=>({...f,label:v})),{placeholder:"New York"})}</Field>
            <Field label="Latitude">{input(locationForm.lat,v=>setLocationForm(f=>({...f,lat:v})),{type:"number",step:"0.0001"})}</Field>
            <Field label="Longitude">{input(locationForm.lon,v=>setLocationForm(f=>({...f,lon:v})),{type:"number",step:"0.0001"})}</Field>
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:8}}>
            {locSaved && <span style={{fontSize:10,color:"#60a060"}}>Saved ✓ All calculations now use this location.</span>}
            <button onClick={() => {
              const la = parseFloat(locationForm.lat), lo = parseFloat(locationForm.lon);
              if (!isNaN(la) && !isNaN(lo)) {
                updateLocation(la, lo, locationForm.label);
                setLocSaved(true);
                setTimeout(() => setLocSaved(false), 3000);
              }
            }} style={{fontSize:11,padding:"5px 14px",borderRadius:7,border:"none",background:"#1a2a3a",color:"#fff",cursor:"pointer"}}>
              Save location
            </button>
          </div>
        </div>

        {/* Journal history */}
        <div style={{background:"#fff",border:"1px solid #e8e4de",borderRadius:10,padding:"16px"}}>
          <button onClick={() => setJournalOpen(v => !v)}
            style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:"none",border:"none",cursor:"pointer",padding:0}}>
            <div style={{fontSize:13,fontWeight:600}}>Journal history</div>
            <span style={{fontSize:11,color:"#aaa"}}>{journalOpen ? "▲" : "▼"} {journalEntries.length} entries</span>
          </button>
          {journalOpen && (
            <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:10}}>
              {journalEntries.length === 0 && (
                <div style={{fontSize:11,color:"#bbb",textAlign:"center",padding:"12px 0"}}>No journal entries in the last 14 days.</div>
              )}
              {journalEntries.map(({ date, text }) => {
                const d = new Date(date + "T12:00:00");
                const label = d.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });
                return (
                  <div key={date} style={{borderTop:"1px solid #f0ede8",paddingTop:10}}>
                    <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:"0.6px",color:"#bbb",marginBottom:4}}>{label}</div>
                    <div style={{fontSize:12,color:"#444",lineHeight:1.5,whiteSpace:"pre-wrap"}}>{text}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* iCal */}
        {icalUrl && (
          <div style={{background:"#fff",border:"1px solid #e8e4de",borderRadius:10,padding:"16px"}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>Calendar export</div>
            <div style={{fontSize:11,color:"#aaa",marginBottom:10}}>Subscribe to your planning windows in Apple Calendar, Fantastical, or Google Calendar.</div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <div style={{flex:1,fontSize:10,fontFamily:"monospace",background:"#f5f2ee",padding:"7px 10px",borderRadius:6,color:"#555",wordBreak:"break-all"}}>
                {window.location.origin}{icalUrl}
              </div>
              <button onClick={()=>navigator.clipboard.writeText(window.location.origin+icalUrl)} style={{fontSize:11,padding:"6px 12px",borderRadius:7,border:"1px solid #d0cbc3",background:"#fff",color:"#555",cursor:"pointer",flexShrink:0}}>
                Copy
              </button>
            </div>
            <a href={icalUrl} download="tides.ics" style={{display:"inline-block",marginTop:8,fontSize:10,color:"#6090c0"}}>
              ↓ Download .ics file
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
